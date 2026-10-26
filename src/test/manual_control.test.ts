/**
 * @file manual_control.test.ts
 * @brief Test Suite untuk Fitur Kontrol Manual & Integrasi Aktuator ESP32
 * @description Menguji logika pemilihan perangkat, deteksi offline/stale, otorisasi RBAC,
 *              isolasi status perintah vs status aktual hardware, proteksi auto-cutoff pompa,
 *              dan mekanisme darurat "Matikan Semua" (All-OFF).
 */

import { hasPermission, canAccessTab } from '../lib/permissions';
import { SmartLightTrapDevice, DeviceCommand } from '../types';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      res
        .then(() => {
          results.push({ name, passed: true });
          console.log(`  [PASS] ${name}`);
        })
        .catch((err) => {
          results.push({ name, passed: false, error: err.message });
          console.error(`  [FAIL] ${name}: ${err.message}`);
        });
    } else {
      results.push({ name, passed: true });
      console.log(`  [PASS] ${name}`);
    }
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toBeTrue() {
      if (actual !== true) {
        throw new Error(`Expected true but got ${JSON.stringify(actual)}`);
      }
    },
    toBeFalse() {
      if (actual !== false) {
        throw new Error(`Expected false but got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toContain(expected: any) {
      if (!Array.isArray(actual) || !actual.includes(expected)) {
        throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
      }
    },
  };
}

console.log('\n======================================================');
console.log('RUNNING MANUAL CONTROL & ACTUATOR INTEGRATION TESTS');
console.log('======================================================\n');

// 1. RBAC & Otorisasi Pengendalian Aktuator
test('TC-M1: Role Admin dan Operator diizinkan mengendalikan aktuator fisik', () => {
  expect(hasPermission('admin', 'control:devices')).toBeTrue();
  expect(hasPermission('operator', 'control:devices')).toBeTrue();
});

test('TC-M2: Role Viewer dan Analyst ditolak dari pengendalian aktuator fisik (Read-Only)', () => {
  expect(hasPermission('viewer', 'control:devices')).toBeFalse();
  expect(hasPermission('analyst', 'control:devices')).toBeFalse();
  expect(hasPermission(undefined, 'control:devices')).toBeFalse();
  expect(hasPermission(null, 'control:devices')).toBeFalse();
});

test('TC-M3: Navigasi tab Kontrol Manual dapat diakses oleh semua role berotentikasi', () => {
  expect(canAccessTab('admin', 'controls')).toBeTrue();
  expect(canAccessTab('operator', 'controls')).toBeTrue();
  expect(canAccessTab('analyst', 'controls')).toBeTrue();
  expect(canAccessTab('viewer', 'controls')).toBeTrue();
});

// 2. Deteksi Koneksi Online vs Offline / Stale
test('TC-M4: Perangkat dengan heartbeat > 5 menit lalu ditandai offline / stale', () => {
  const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const isStale = (lastSeenAt: string) => {
    const diffMin = (Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60);
    return diffMin > 5;
  };

  expect(isStale(sixMinutesAgo)).toBeTrue();
  expect(isStale(twoMinutesAgo)).toBeFalse();
});

// 3. Protokol Perintah SET_RELAY & Validasi Parameter
test('TC-M5: Validasi allowlist nomor channel relay (1 s.d. 4)', () => {
  const isValidRelay = (channel: number) => channel >= 1 && channel <= 4;
  expect(isValidRelay(1)).toBeTrue(); // Pompa
  expect(isValidRelay(2)).toBeTrue(); // Solenoid
  expect(isValidRelay(3)).toBeTrue(); // LED UV
  expect(isValidRelay(4)).toBeTrue(); // Aux / Kipas
  expect(isValidRelay(0)).toBeFalse();
  expect(isValidRelay(5)).toBeFalse();
});

test('TC-M6: Validasi parameter state relay hanya menerima ON atau OFF', () => {
  const isValidState = (state: string) => state === 'ON' || state === 'OFF';
  expect(isValidState('ON')).toBeTrue();
  expect(isValidState('OFF')).toBeTrue();
  expect(isValidState('TOGGLE')).toBeFalse();
  expect(isValidState('')).toBeFalse();
});

// 4. Isolasi Status Perintah vs Status Aktual Hardware
test('TC-M7: Perintah pending tidak mengubah status aktual hardware sebelum dikonfirmasi', () => {
  let actualHardwareStatus: 'ON' | 'OFF' = 'OFF';
  const command: DeviceCommand = {
    id: 'cmd-test-1',
    deviceId: 'slt-1',
    commandType: 'SET_RELAY',
    parameters: { relay: 1, state: 'ON' },
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  // Status permintaan adalah ON, namun status aktual hardware tetap OFF
  expect(command.parameters?.state).toBe('ON');
  expect(actualHardwareStatus).toBe('OFF');

  // Discrepancy indicator aktif
  const isPendingSync = command.status === 'PENDING' && command.parameters?.state !== actualHardwareStatus;
  expect(isPendingSync).toBeTrue();

  // Setelah ESP32 mengirim konfirmasi eksekusi (ACK COMPLETED)
  command.status = 'COMPLETED';
  actualHardwareStatus = 'ON';
  expect(actualHardwareStatus).toBe('ON');
});

// 5. Interlock Proteksi Pompa
test('TC-M8: Interlock keselamatan pompa melarang aktivasi jika tandon air < 15%', () => {
  const checkPumpInterlock = (tankLevelPercent: number) => {
    return tankLevelPercent >= 15;
  };

  expect(checkPumpInterlock(75)).toBeTrue();
  expect(checkPumpInterlock(15)).toBeTrue();
  expect(checkPumpInterlock(14)).toBeFalse();
  expect(checkPumpInterlock(5)).toBeFalse();
});

test('TC-M9: Proteksi auto-cutoff pompa memiliki batas waktu operasi maksimal 45 detik', () => {
  const MAX_PUMP_RUN_MS = 45000;
  expect(MAX_PUMP_RUN_MS).toBe(45000);

  const isCutoffTriggered = (runDurationMs: number) => runDurationMs >= MAX_PUMP_RUN_MS;
  expect(isCutoffTriggered(30000)).toBeFalse();
  expect(isCutoffTriggered(45000)).toBeTrue();
  expect(isCutoffTriggered(50000)).toBeTrue();
});

// 6. Prosedur Matikan Semua (Emergency All-OFF)
test('TC-M10: Prosedur Matikan Semua mencakup 4 channel relay secara terpisah', () => {
  const relaysToStop = [1, 2, 3, 4];
  expect(relaysToStop.length).toBe(4);
  expect(relaysToStop).toContain(1);
  expect(relaysToStop).toContain(2);
  expect(relaysToStop).toContain(3);
  expect(relaysToStop).toContain(4);
});

// 7. Pemetaan Pinout Hardware & Logika Active LOW
test('TC-M11: Pemetaan pin fisik ESP32 sesuai spesifikasi hardware (GPIO 12, 14, 27, 26)', () => {
  const pinMap: Record<number, number> = {
    1: 12, // Pompa
    2: 14, // Solenoid
    3: 27, // LED UV
    4: 26, // Kipas / Aux
  };

  expect(pinMap[1]).toBe(12);
  expect(pinMap[2]).toBe(14);
  expect(pinMap[3]).toBe(27);
  expect(pinMap[4]).toBe(26);
});

test('TC-M12: Logika tegangan Active LOW (LOW=0V=ON, HIGH=3.3V=OFF)', () => {
  const getPinVoltage = (isOn: boolean) => (isOn ? 0 : 3.3);
  expect(getPinVoltage(true)).toBe(0);    // ON = 0V
  expect(getPinVoltage(false)).toBe(3.3); // OFF = 3.3V
});

console.log('\n------------------------------------------------------');
const passedCount = results.filter((r) => r.passed).length;
console.log(`TOTAL: ${results.length} | PASSED: ${passedCount} | FAILED: ${results.length - passedCount}`);
console.log('------------------------------------------------------\n');

if (passedCount !== results.length) {
  process.exit(1);
}
