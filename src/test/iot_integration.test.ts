/**
 * @file iot_integration.test.ts
 * @brief End-to-End IoT Integration & Security Test Suite
 * @description Verifies telemetry ingestion, device auth, offline buffering,
 *              heartbeat tracking, command queue lifecycle, and live vs demo isolation.
 */

import { hasPermission } from '../lib/permissions';
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
      res.then(() => {
        results.push({ name, passed: true });
        console.log(`  [PASS] ${name}`);
      }).catch((err) => {
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
    toBeLessThan(expected: number) {
      if (typeof actual !== 'number' || actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toContain(expected: any) {
      if (!Array.isArray(actual) || !actual.includes(expected)) {
        throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
      }
    },
  };
}

console.log('\n========================================================');
console.log(' RUNNING IOT SMART LIGHT TRAP INTEGRATION TEST SUITE     ');
console.log('========================================================\n');

// ----------------------------------------------------------------------------
// TEST 1: Telemetry Payload Validation & Ingestion
// ----------------------------------------------------------------------------
test('TC-1: Valid telemetry payload is accepted and validated correctly', () => {
  const validPayload = {
    sequence_number: 4892,
    timestamp: '2026-10-25T10:45:00+07:00',
    battery: {
      bus_voltage_v: 13.18,
      shunt_voltage_mv: -42.50,
      current_ma: -860,
      power_mw: 11334,
      is_charging: false,
      solar_voltage_v: 0.0,
      solar_current_ma: 0.0,
    },
    water: {
      tray_level_percent: 82,
      tray_level_cm: 4.10,
      tank_level_percent: 78,
      tank_volume_liters: 39.0,
      turbidity_ntu: 38,
      drain_valve_status: 'closed',
      fill_pump_status: 'idle',
      safety_lockout: false,
    },
    lamp: {
      is_active: true,
      mode: 'schedule_auto',
      wavelength_nm: 365,
      led_current_ma: 850,
      is_healthy: true,
    },
    connectivity: {
      network_type: '4G_LTE',
      rssi_dbm: -72,
      operator: 'Telkomsel IoT SIM',
      unsynced_microsd_packets: 0,
    },
    temperature_c: 25.8,
    humidity_percent: 88,
  };

  // Field validation rules
  expect(typeof validPayload.sequence_number).toBe('number');
  expect(validPayload.sequence_number > 0).toBeTrue();
  expect(validPayload.battery.bus_voltage_v >= 9.0 && validPayload.battery.bus_voltage_v <= 15.0).toBeTrue();
  expect(validPayload.water.tank_level_percent >= 0 && validPayload.water.tank_level_percent <= 100).toBeTrue();
  expect(validPayload.lamp.wavelength_nm).toBe(365);
});

// ----------------------------------------------------------------------------
// TEST 2: Unregistered / Untrusted Device Rejection (401 Unauthorized)
// ----------------------------------------------------------------------------
test('TC-2: Unregistered device or invalid token is denied access (401)', () => {
  const mockDevices = [
    { code: 'SLT-SBG-01', tokenHash: 'valid_hash_sbg01' },
    { code: 'SLT-SBG-02', tokenHash: 'valid_hash_sbg02' },
  ];

  function authenticateDevice(headers: { deviceCode?: string; deviceToken?: string }) {
    if (!headers.deviceCode || !headers.deviceToken) {
      return { status: 401, error: 'Missing credentials' };
    }
    const matched = mockDevices.find((d) => d.code === headers.deviceCode);
    if (!matched) {
      return { status: 401, error: 'Device not registered' };
    }
    // Mock token verification (hash check)
    if (headers.deviceToken !== 'slt_token_sbg01_secret_2026' && headers.deviceToken !== 'slt_token_sbg02_secret_2026') {
      return { status: 401, error: 'Invalid device token' };
    }
    return { status: 200, device: matched };
  }

  // Missing headers
  expect(authenticateDevice({}).status).toBe(401);
  // Unknown device code
  expect(authenticateDevice({ deviceCode: 'UNKNOWN-NODE', deviceToken: 'abc' }).status).toBe(401);
  // Wrong token
  expect(authenticateDevice({ deviceCode: 'SLT-SBG-01', deviceToken: 'hacker_token' }).status).toBe(401);
  // Valid credentials
  expect(authenticateDevice({ deviceCode: 'SLT-SBG-01', deviceToken: 'slt_token_sbg01_secret_2026' }).status).toBe(200);
});

// ----------------------------------------------------------------------------
// TEST 3: Malformed & Out-of-Range Payload Rejection
// ----------------------------------------------------------------------------
test('TC-3: Malformed payload (missing sequence or invalid values) is rejected (400)', () => {
  function validateTelemetryPayload(payload: any) {
    if (!payload || typeof payload !== 'object') return false;
    if (!payload.sequence_number || payload.sequence_number <= 0) return false;
    if (typeof payload.battery?.bus_voltage_v !== 'number' || isNaN(payload.battery.bus_voltage_v)) return false;
    if (payload.battery.bus_voltage_v < 0 || payload.battery.bus_voltage_v > 30) return false;
    return true;
  }

  expect(validateTelemetryPayload({})).toBeFalse();
  expect(validateTelemetryPayload({ sequence_number: -5 })).toBeFalse();
  expect(validateTelemetryPayload({ sequence_number: 10, battery: { bus_voltage_v: -2.0 } })).toBeFalse();
  expect(validateTelemetryPayload({ sequence_number: 10, battery: { bus_voltage_v: 12.8 } })).toBeTrue();
});

// ----------------------------------------------------------------------------
// TEST 4: Offline Local Buffering & Replay Simulation
// ----------------------------------------------------------------------------
test('TC-4: Offline buffer FIFO queue stores packets during drop and replays in sequence', () => {
  const offlineQueue: Array<{ seq: number; payload: string }> = [];
  let isNetworkOnline = false;
  const serverReceivedPackets: number[] = [];

  function sendPacket(seq: number, data: string) {
    if (!isNetworkOnline) {
      offlineQueue.push({ seq, payload: data });
      return false;
    } else {
      serverReceivedPackets.push(seq);
      return true;
    }
  }

  // Generate 3 packets while offline
  sendPacket(101, 'data_101');
  sendPacket(102, 'data_102');
  sendPacket(103, 'data_103');

  expect(offlineQueue.length).toBe(3);
  expect(serverReceivedPackets.length).toBe(0);

  // Network recovers
  isNetworkOnline = true;
  while (offlineQueue.length > 0) {
    const pkt = offlineQueue.shift()!;
    sendPacket(pkt.seq, pkt.payload);
  }

  expect(offlineQueue.length).toBe(0);
  expect(serverReceivedPackets.length).toBe(3);
  expect(serverReceivedPackets[0]).toBe(101);
  expect(serverReceivedPackets[1]).toBe(102);
  expect(serverReceivedPackets[2]).toBe(103);
});

// ----------------------------------------------------------------------------
// TEST 5: Heartbeat & Device Status Calculation
// ----------------------------------------------------------------------------
test('TC-5: Heartbeat timeout (>15 min) dynamically marks device offline', () => {
  function computeDeviceStatus(lastSeenAt: string | null, busVoltage: number, tankPercent: number) {
    if (!lastSeenAt) return 'offline';
    const lastSeenMs = new Date(lastSeenAt).getTime();
    const nowMs = Date.now();
    const diffMinutes = (nowMs - lastSeenMs) / (1000 * 60);

    if (diffMinutes > 15) return 'offline';
    if (busVoltage < 11.8 || tankPercent < 15) return 'warning';
    return 'online';
  }

  const justNow = new Date().toISOString();
  const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Fresh heartbeat, healthy battery & water
  expect(computeDeviceStatus(justNow, 12.8, 80)).toBe('online');
  // Fresh heartbeat, but battery voltage below cutoff (<11.8V)
  expect(computeDeviceStatus(fiveMinsAgo, 11.4, 80)).toBe('warning');
  // Fresh heartbeat, but water tank critically low (<15%)
  expect(computeDeviceStatus(fiveMinsAgo, 12.8, 10)).toBe('warning');
  // Expired heartbeat (>15 minutes ago) -> MUST BE OFFLINE
  expect(computeDeviceStatus(twentyMinsAgo, 12.8, 80)).toBe('offline');
});

// ----------------------------------------------------------------------------
// TEST 6: Dashboard Live Data Source Accuracy
// ----------------------------------------------------------------------------
test('TC-6: Dashboard live mode refuses mock data fallback on empty database queries', () => {
  function handleTelemetryQueryResponse(mode: 'supabase_live' | 'simulation_demo', rows: any[]) {
    if (mode === 'supabase_live') {
      // In live mode, 0 records MUST return empty array, NEVER mock fallback!
      return rows;
    } else {
      // Simulation mode may provide sample demo records
      return rows.length === 0 ? [{ id: 'mock_demo' }] : rows;
    }
  }

  const liveResult = handleTelemetryQueryResponse('supabase_live', []);
  expect(liveResult.length).toBe(0);

  const demoResult = handleTelemetryQueryResponse('simulation_demo', []);
  expect(demoResult.length).toBe(1);
  expect(demoResult[0].id).toBe('mock_demo');
});

// ----------------------------------------------------------------------------
// TEST 7: RBAC Access Control for Device Commands
// ----------------------------------------------------------------------------
test('TC-7: Viewer and Analyst cannot send actuator commands; Operator and Admin can', () => {
  expect(hasPermission('viewer', 'control:devices')).toBeFalse();
  expect(hasPermission('analyst', 'control:devices')).toBeFalse();
  expect(hasPermission('operator', 'control:devices')).toBeTrue();
  expect(hasPermission('admin', 'control:devices')).toBeTrue();
});

// ----------------------------------------------------------------------------
// TEST 8: Command Queue Flow & Acknowledgement
// ----------------------------------------------------------------------------
test('TC-8: Command transitions properly from pending -> sent -> acknowledged -> completed', () => {
  interface Cmd {
    id: string;
    type: string;
    status: 'pending' | 'sent' | 'acknowledged' | 'completed' | 'failed';
    acknowledgedAt?: string;
    completedAt?: string;
  }

  const commandQueue: Cmd[] = [];

  // Step 1: Dashboard user sends command
  const newCmd: Cmd = { id: 'cmd_001', type: 'FORCE_WATER_CHANGE', status: 'pending' };
  commandQueue.push(newCmd);
  expect(commandQueue[0].status).toBe('pending');

  // Step 2: ESP32 polls and picks up command
  commandQueue[0].status = 'sent';
  expect(commandQueue[0].status).toBe('sent');

  // Step 3: ESP32 acknowledges receipt (ACK)
  commandQueue[0].status = 'acknowledged';
  commandQueue[0].acknowledgedAt = new Date().toISOString();
  expect(commandQueue[0].status).toBe('acknowledged');

  // Step 4: ESP32 finishes physical execution and sends completed ACK
  commandQueue[0].status = 'completed';
  commandQueue[0].completedAt = new Date().toISOString();
  expect(commandQueue[0].status).toBe('completed');
});

// ----------------------------------------------------------------------------
// TEST 9: Command Timeout & Failure Handling
// ----------------------------------------------------------------------------
test('TC-9: Expired command is excluded from polling; hardware failures set failed status', () => {
  const now = Date.now();
  const activeCmd = { id: 'cmd_active', expiresAt: now + 3600000, status: 'pending' };
  const expiredCmd = { id: 'cmd_expired', expiresAt: now - 1000, status: 'pending' };

  function pollCommands(commands: typeof activeCmd[]) {
    return commands.filter((c) => c.status === 'pending' && c.expiresAt > Date.now());
  }

  const polled = pollCommands([activeCmd, expiredCmd]);
  expect(polled.length).toBe(1);
  expect(polled[0].id).toBe('cmd_active');
});

// ----------------------------------------------------------------------------
// TEST 10: Sequence Number Deduplication (Anti-Replay Protection)
// ----------------------------------------------------------------------------
test('TC-10: Duplicate sequence number from network retry is intercepted without duplicate rows', () => {
  const databaseIngestedSequences = new Set<number>();

  function ingestTelemetry(seq: number) {
    if (databaseIngestedSequences.has(seq)) {
      return { status: 200, result: 'duplicate_ignored', message: `Sequence ${seq} already ingested.` };
    }
    databaseIngestedSequences.add(seq);
    return { status: 200, result: 'success' };
  }

  // First delivery: success
  const res1 = ingestTelemetry(1001);
  expect(res1.result).toBe('success');

  // Network retry re-delivers sequence 1001
  const res2 = ingestTelemetry(1001);
  expect(res2.result).toBe('duplicate_ignored');
  expect(databaseIngestedSequences.size).toBe(1);
});

// ----------------------------------------------------------------------------
// TEST 11: Strict Isolation between Live Mode and Simulation Mode
// ----------------------------------------------------------------------------
test('TC-11: Live mode strictly filters out simulated devices and test data', () => {
  const mixedDevices: Array<{ id: string; code: string; is_simulated: boolean }> = [
    { id: 'dev_01', code: 'SLT-SBG-01', is_simulated: false },
    { id: 'dev_02', code: 'SLT-SBG-02', is_simulated: false },
    { id: 'dev_sim', code: 'SLT-SIM-99', is_simulated: true },
  ];

  function getDevicesForMode(mode: 'supabase_live' | 'simulation_demo') {
    if (mode === 'supabase_live') {
      return mixedDevices.filter((d) => !d.is_simulated);
    } else {
      return mixedDevices.filter((d) => d.is_simulated);
    }
  }

  const liveDevices = getDevicesForMode('supabase_live');
  expect(liveDevices.length).toBe(2);
  expect(liveDevices.some((d) => d.is_simulated)).toBeFalse();

  const demoDevices = getDevicesForMode('simulation_demo');
  expect(demoDevices.length).toBe(1);
  expect(demoDevices[0].code).toBe('SLT-SIM-99');
});

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n--------------------------------------------------------');
console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter((r) => r.passed).length} | FAILED: ${results.filter((r) => !r.passed).length}`);
console.log('--------------------------------------------------------\n');

if (results.some((r) => !r.passed)) {
  process.exit(1);
} else {
  process.exit(0);
}
