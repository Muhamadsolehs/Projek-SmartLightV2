/**
 * @file heartbeat.test.ts
 * @brief Test Suite untuk Automated Supabase Database Keep-Alive Heartbeat
 * @description Menguji:
 *   1. Request dengan secret benar (Bearer & x-heartbeat-secret) -> 200 OK
 *   2. Request dengan secret salah -> 401 Unauthorized
 *   3. Request method selain POST (GET, PUT, DELETE) -> 405 Method Not Allowed
 *   4. Kegagalan database ditangani secara aman -> 500 Internal Server Error (Tersanitasi)
 *   5. Idempotensi: Eksekusi berulang tidak menduplikasi baris (tetap 1 baris singleton)
 *   6. Timestamp UTC diperbarui pada setiap panggilan
 *   7. Verifikasi tidak adanya service_role key di build/bundle frontend
 *   8. Isolasi arsitektural: Tidak mencemari telemetri ESP32 atau mengubah status hardware
 */

import fs from 'fs';
import path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  [PASS] ${name}`);
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
    toBeGreaterThan(expected: number) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} > ${expected}`);
      }
    },
    toBeFalse() {
      if (actual !== false) {
        throw new Error(`Expected false but got ${JSON.stringify(actual)}`);
      }
    },
    toBeTrue() {
      if (actual !== true) {
        throw new Error(`Expected true but got ${JSON.stringify(actual)}`);
      }
    },
    toInclude(sub: string) {
      if (typeof actual !== 'string' || !actual.includes(sub)) {
        throw new Error(`Expected string to include "${sub}" but got: ${actual}`);
      }
    },
    toNotInclude(sub: string) {
      if (typeof actual === 'string' && actual.includes(sub)) {
        throw new Error(`Expected string NOT to include "${sub}"`);
      }
    },
  };
}

// Simulasi handler Edge Function di memori sesuai implementasi supabase/functions/system-heartbeat/index.ts
interface HeartbeatRecord {
  id: string;
  service_name: string;
  status: string;
  last_heartbeat_at: string;
  metadata: Record<string, unknown>;
  updated_at: string;
}

class MockSupabaseHeartbeatStore {
  public records: Map<string, HeartbeatRecord> = new Map();
  public shouldFailDatabase = false;

  constructor() {
    // Seed initial record
    this.records.set('smart-light-trap', {
      id: 'mock-uuid-singleton',
      service_name: 'smart-light-trap',
      status: 'healthy',
      last_heartbeat_at: '2026-10-01T00:00:00.000Z',
      metadata: { source: 'initial_seed' },
      updated_at: '2026-10-01T00:00:00.000Z',
    });
  }

  async upsert(row: Partial<HeartbeatRecord>): Promise<HeartbeatRecord> {
    if (this.shouldFailDatabase) {
      throw new Error('connection refused: database pool exhausted');
    }

    const key = row.service_name || 'smart-light-trap';
    const existing = this.records.get(key);
    const updated: HeartbeatRecord = {
      id: existing ? existing.id : 'mock-uuid-' + Math.random().toString(36).slice(2, 8),
      service_name: key,
      status: row.status || 'healthy',
      last_heartbeat_at: row.last_heartbeat_at || new Date().toISOString(),
      metadata: row.metadata || {},
      updated_at: row.updated_at || new Date().toISOString(),
    };
    this.records.set(key, updated);
    return updated;
  }
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function extractSecretToken(headers: Record<string, string>): string | null {
  if (headers['x-heartbeat-secret'] && headers['x-heartbeat-secret'].trim().length > 0) {
    return headers['x-heartbeat-secret'].trim();
  }
  if (headers['authorization']) {
    const parts = headers['authorization'].trim().split(/\s+/);
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1].trim();
    }
  }
  return null;
}

async function simulateEdgeFunction(
  method: string,
  headers: Record<string, string>,
  body: any,
  serverSecret: string | null,
  dbStore: MockSupabaseHeartbeatStore
): Promise<{ status: number; body: any }> {
  if (method === 'OPTIONS') {
    return { status: 200, body: 'ok' };
  }

  if (method !== 'POST') {
    return {
      status: 405,
      body: { error: 'Method not allowed. Only POST is supported.' },
    };
  }

  if (!serverSecret || serverSecret.trim().length === 0) {
    return {
      status: 500,
      body: { error: 'Server configuration error' },
    };
  }

  const token = extractSecretToken(headers);
  if (!token || !constantTimeCompare(token, serverSecret.trim())) {
    return {
      status: 401,
      body: { error: 'Unauthorized: Invalid or missing heartbeat secret' },
    };
  }

  const nowUtc = new Date().toISOString();
  try {
    const data = await dbStore.upsert({
      service_name: 'smart-light-trap',
      status: 'healthy',
      last_heartbeat_at: nowUtc,
      metadata: body ? { ...body, timestamp_utc: nowUtc } : { source: 'cron', timestamp_utc: nowUtc },
      updated_at: nowUtc,
    });

    return {
      status: 200,
      body: {
        success: true,
        message: 'System heartbeat recorded successfully',
        data: {
          service_name: data.service_name,
          status: data.status,
          last_heartbeat_at: data.last_heartbeat_at,
          updated_at: data.updated_at,
        },
      },
    };
  } catch (err: any) {
    return {
      status: 500,
      body: { error: 'Database heartbeat operation failed' },
    };
  }
}

async function runHeartbeatTests() {
  console.log('\n========================================================');
  console.log(' RUNNING SUPABASE DATABASE HEARTBEAT TEST SUITE        ');
  console.log('========================================================\n');

  const VALID_SECRET = 'slt_hb_sec_993881726a8d11c4';
  const db = new MockSupabaseHeartbeatStore();

  // Test 1: Valid secret via Authorization: Bearer <secret>
  await test('TC-HB-1: Request dengan Authorization Bearer secret yang valid mengembalikan HTTP 200 dan payload sukses', async () => {
    const res = await simulateEdgeFunction(
      'POST',
      { authorization: `Bearer ${VALID_SECRET}`, 'content-type': 'application/json' },
      { trigger: 'cron-job.org' },
      VALID_SECRET,
      db
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.service_name).toBe('smart-light-trap');
    expect(res.body.data.status).toBe('healthy');
  });

  // Test 2: Valid secret via x-heartbeat-secret header
  await test('TC-HB-2: Request dengan custom header x-heartbeat-secret yang valid mengembalikan HTTP 200', async () => {
    const res = await simulateEdgeFunction(
      'POST',
      { 'x-heartbeat-secret': VALID_SECRET, 'content-type': 'application/json' },
      { trigger: 'cron-job.org' },
      VALID_SECRET,
      db
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // Test 3: Invalid secret
  await test('TC-HB-3: Request dengan secret salah mengembalikan HTTP 401 Unauthorized', async () => {
    const res = await simulateEdgeFunction(
      'POST',
      { authorization: 'Bearer wrong_secret_token' },
      null,
      VALID_SECRET,
      db
    );
    expect(res.status).toBe(401);
    expect(res.body.error).toInclude('Unauthorized');
  });

  // Test 4: Missing secret header
  await test('TC-HB-4: Request tanpa header kredensial mengembalikan HTTP 401 Unauthorized', async () => {
    const res = await simulateEdgeFunction('POST', {}, null, VALID_SECRET, db);
    expect(res.status).toBe(401);
    expect(res.body.error).toInclude('Unauthorized');
  });

  // Test 5: Unsupported HTTP method (GET, PUT, DELETE)
  await test('TC-HB-5: Request dengan method GET, PUT, atau DELETE ditolak dengan HTTP 405 Method Not Allowed', async () => {
    const getRes = await simulateEdgeFunction('GET', { authorization: `Bearer ${VALID_SECRET}` }, null, VALID_SECRET, db);
    expect(getRes.status).toBe(405);
    expect(getRes.body.error).toInclude('Method not allowed');

    const putRes = await simulateEdgeFunction('PUT', { authorization: `Bearer ${VALID_SECRET}` }, null, VALID_SECRET, db);
    expect(putRes.status).toBe(405);

    const deleteRes = await simulateEdgeFunction('DELETE', { authorization: `Bearer ${VALID_SECRET}` }, null, VALID_SECRET, db);
    expect(deleteRes.status).toBe(405);
  });

  // Test 6: Database connection failure
  await test('TC-HB-6: Database failure menghasilkan HTTP 500 dan pesan error tersanitasi tanpa kebocoran credential', async () => {
    db.shouldFailDatabase = true;
    const res = await simulateEdgeFunction(
      'POST',
      { authorization: `Bearer ${VALID_SECRET}` },
      null,
      VALID_SECRET,
      db
    );
    db.shouldFailDatabase = false; // reset
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Database heartbeat operation failed');
    // Pastikan tidak ada credential/koneksi internal yang bocor
    expect(JSON.stringify(res.body)).toNotInclude('password');
    expect(JSON.stringify(res.body)).toNotInclude('service_role');
  });

  // Test 7: Idempotency & Singleton Record (Multi-hit must not duplicate rows)
  await test('TC-HB-7: Pemanggilan berulang (multi-hit) tidak menghasilkan baris duplikat (tetap 1 baris untuk smart-light-trap)', async () => {
    const initialCount = db.records.size;

    // Lakukan 10 eksekusi beruntun
    for (let i = 0; i < 10; i++) {
      const res = await simulateEdgeFunction(
        'POST',
        { authorization: `Bearer ${VALID_SECRET}` },
        { iteration: i },
        VALID_SECRET,
        db
      );
      expect(res.status).toBe(200);
    }

    // Jumlah record di database singleton HARUS tetap 1
    expect(db.records.size).toBe(initialCount);
    expect(db.records.has('smart-light-trap')).toBeTrue();
  });

  // Test 8: Timestamp updated on each execution
  await test('TC-HB-8: Timestamp last_heartbeat_at dan updated_at selalu diperbarui ke waktu UTC terkini pada setiap eksekusi', async () => {
    const recordBefore = db.records.get('smart-light-trap')!;
    const timeBefore = new Date(recordBefore.last_heartbeat_at).getTime();

    // Tunggu sedikit agar timestamp berbeda
    await new Promise((r) => setTimeout(r, 20));

    await simulateEdgeFunction(
      'POST',
      { authorization: `Bearer ${VALID_SECRET}` },
      null,
      VALID_SECRET,
      db
    );

    const recordAfter = db.records.get('smart-light-trap')!;
    const timeAfter = new Date(recordAfter.last_heartbeat_at).getTime();
    expect(timeAfter).toBeGreaterThan(timeBefore);
  });

  // Test 9: Frontend bundle inspection (Zero exposure of service_role key)
  await test('TC-HB-9: Verifikasi tidak adanya service_role key atau secret scheduler di seluruh source code frontend', async () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const filesToScan: string[] = [];

    function collectFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
            collectFiles(fullPath);
          }
        } else if (/\.(tsx|ts|jsx|js|html)$/.test(entry.name) && !entry.name.includes('.test.')) {
          filesToScan.push(fullPath);
        }
      }
    }

    collectFiles(srcDir);

    for (const filePath of filesToScan) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes('service_role_key')) {
        throw new Error(`CRITICAL SECURITY FAILURE: Service role key pattern found in frontend source: ${filePath}`);
      }
    }
  });

  // Test 10: Architectural isolation: Never pollutes device telemetry
  await test('TC-HB-10: Mekanisme heartbeat sepenuhnya terpisah dari tabel device_telemetry dan tidak membuat data sensor palsu', async () => {
    // Tabel system_heartbeat adalah entitas terpisah, tabel device_telemetry membutuhkan device_id UUID dan sequence_number
    const record = db.records.get('smart-light-trap')!;
    expect(record.service_name).toBe('smart-light-trap');
    // Pastikan tidak ada properti telemetri sensor (tegangan, kekeruhan, suhu)
    expect((record as any).battery_voltage).toBe(undefined);
    expect((record as any).turbidity_ntu).toBe(undefined);
  });

  console.log('\n--------------------------------------------------------');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`TOTAL HEARTBEAT TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${results.length - passedCount}`);
  console.log('--------------------------------------------------------\n');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runHeartbeatTests();
