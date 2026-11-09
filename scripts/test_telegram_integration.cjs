/**
 * @file test_telegram_integration.cjs
 * @brief Automated Test Suite for Smart Light Trap Telegram Bot Integration
 * 
 * Tests the 15 required scenarios:
 *  1. Telegram token valid
 *  2. Telegram token invalid (HTTP 401 handling)
 *  3. Chat ID invalid (HTTP 400 Bad Request handling)
 *  4. Chat not initiated with bot (HTTP 403 Forbidden handling)
 *  5. Internal secret invalid / missing (HTTP 401 Unauthorized)
 *  6. Message delivery success
 *  7. Message delivery failure (Network / 5xx handling)
 *  8. Event deduplication (Strict event_key idempotency)
 *  9. Concurrent duplicate events (Race condition handling)
 * 10. Device online event format & escaping
 * 11. Device offline event format & escaping
 * 12. Relay ON/OFF event format & mapping
 * 13. Water change completed event format & duration
 * 14. Device error alert event format
 * 15. Telegram API rate limit (HTTP 429 & retry_after handling)
 */

const http = require('http');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}${details ? ': ' + details : ''}`);
  }
}

// ============================================================================
// SIMULATION ENGINE: Simulates Edge Function logic & Telegram Bot API
// ============================================================================

const ALLOWED_EVENT_TYPES = [
  'DEVICE_ONLINE',
  'DEVICE_OFFLINE',
  'RELAY_STATUS',
  'WATER_CHANGE',
  'BATTERY_LOW',
  'DEVICE_ERROR',
  'TEST_NOTIFICATION',
];

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatWibTime(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  return validDate.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }) + ' WIB';
}

function getRelayFunctionName(relayNum) {
  switch (Number(relayNum)) {
    case 1: return 'Pompa Pengisi Baki Air';
    case 2: return 'Katup Solenoid Drain';
    case 3: return 'Lampu UV';
    case 4: return 'Kipas Blower Aux';
    default: return `Relay Channel ${relayNum}`;
  }
}

function buildHtmlMessage(eventType, payload, targetChatId) {
  const deviceCode = escapeHtml(payload.device_code || 'SLT-SBG-01');
  const timestamp = formatWibTime(payload.timestamp || payload.recorded_at || payload.occurred_at);

  switch (eventType) {
    case 'DEVICE_ONLINE': {
      return [
        `🟢 <b>SMART LIGHT TRAP</b>`,
        ``,
        `Perangkat berhasil terhubung.`,
        ``,
        `<b>Device:</b> <code>${deviceCode}</code>`,
        `<b>Status:</b> ONLINE`,
        `<b>Waktu:</b> ${timestamp}`,
      ].join('\n');
    }

    case 'DEVICE_OFFLINE': {
      const lastSeen = formatWibTime(payload.last_seen_at);
      return [
        `🔴 <b>SMART LIGHT TRAP ALERT</b>`,
        ``,
        `Perangkat tidak lagi mengirim heartbeat.`,
        ``,
        `<b>Device:</b> <code>${deviceCode}</code>`,
        `<b>Status:</b> OFFLINE`,
        `<b>Last Seen:</b> ${lastSeen}`,
      ].join('\n');
    }

    case 'RELAY_STATUS': {
      const relayNum = Number(payload.relay ?? payload.relay_number ?? 3);
      const relayFunc = escapeHtml(payload.function_name || getRelayFunctionName(relayNum));
      const relayState = escapeHtml(String(payload.status || payload.state || 'UNKNOWN').toUpperCase());
      return [
        `⚙️ <b>RELAY STATUS</b>`,
        ``,
        `<b>Device:</b> <code>${deviceCode}</code>`,
        `<b>Relay:</b> Relay ${relayNum}`,
        `<b>Fungsi:</b> ${relayFunc}`,
        `<b>Status:</b> ${relayState}`,
        `<b>Waktu:</b> ${timestamp}`,
      ].join('\n');
    }

    case 'WATER_CHANGE': {
      const status = escapeHtml(String(payload.status || 'COMPLETED').toUpperCase());
      const lines = [
        `💧 <b>WATER CHANGE</b>`,
        ``,
        status === 'FAILED'
          ? `Proses penggantian air mengalami kendala.`
          : `Proses penggantian air telah selesai.`,
        ``,
        `<b>Device:</b> <code>${deviceCode}</code>`,
        `<b>Status:</b> ${status}`,
      ];

      if (payload.duration_seconds !== undefined && payload.duration_seconds !== null) {
        lines.push(`<b>Durasi:</b> ${escapeHtml(payload.duration_seconds)} detik`);
      } else if (payload.duration !== undefined && payload.duration !== null) {
        lines.push(`<b>Durasi:</b> ${escapeHtml(payload.duration)}`);
      }

      if (status === 'FAILED' && payload.error_message) {
        lines.push(`<b>Alasan:</b> ${escapeHtml(payload.error_message)}`);
      }

      lines.push(`<b>Waktu:</b> ${timestamp}`);
      return lines.join('\n');
    }

    case 'BATTERY_LOW': {
      const voltage = payload.voltage !== undefined ? Number(payload.voltage).toFixed(2) : null;
      const lines = [
        `🔋 <b>LOW BATTERY ALERT</b>`,
        ``,
        `Tegangan baterai melewati batas aman proteksi.`,
        ``,
        `<b>Device:</b> <code>${deviceCode}</code>`,
      ];
      if (voltage !== null) {
        lines.push(`<b>Tegangan:</b> ${voltage} V`);
      }
      if (payload.threshold_v !== undefined && payload.threshold_v !== null) {
        lines.push(`<b>Batas Cutoff:</b> ${Number(payload.threshold_v).toFixed(2)} V`);
      }
      lines.push(`<b>Status:</b> LOW`);
      lines.push(`<b>Waktu:</b> ${timestamp}`);
      return lines.join('\n');
    }

    case 'DEVICE_ERROR': {
      const category = escapeHtml(payload.category || payload.error_type || 'Hardware Anomaly');
      const detail = escapeHtml(payload.message || payload.error_message || 'Terdeteksi kegagalan pada sensor/aktuator');
      return [
        `⚠️ <b>SMART LIGHT TRAP ERROR</b>`,
        ``,
        `Terjadi gangguan pada perangkat lapangan.`,
        ``,
        `<b>Device:</b> <code>${deviceCode}</code>`,
        `<b>Kategori:</b> ${category}`,
        `<b>Detail:</b> ${detail}`,
        `<b>Waktu:</b> ${timestamp}`,
      ].join('\n');
    }

    case 'TEST_NOTIFICATION': {
      const title = escapeHtml(payload.title || 'Tes Integrasi Telegram Bot');
      const note = escapeHtml(payload.message || 'Pesan verifikasi operasional dari backend Supabase.');
      return [
        `🧪 <b>${title}</b>`,
        ``,
        `Bot: @Lighrice_bot`,
        `Sistem: Smart Light Trap Subang`,
        `Status: Integrasi Berfungsi Normal`,
        ``,
        `<b>Target Chat ID:</b> <code>${escapeHtml(targetChatId)}</code>`,
        `<b>Detail:</b> ${note}`,
        `<b>Waktu:</b> ${timestamp}`,
      ].join('\n');
    }

    default:
      return `Notification: ${eventType}`;
  }
}

/**
 * In-memory simulated database table: telegram_notification_logs
 */
class MockDatabase {
  constructor() {
    this.logs = new Map(); // key = event_key, value = record
  }

  async findByEventKey(eventKey) {
    return this.logs.get(eventKey) || null;
  }

  async insert(record) {
    if (this.logs.has(record.event_key)) {
      const err = new Error('duplicate key value violates unique constraint "uq_telegram_logs_event_key"');
      err.code = '23505';
      throw err;
    }
    const id = 'uuid-' + Math.random().toString(36).substring(2, 9);
    const newRecord = {
      id,
      ...record,
      created_at: new Date().toISOString(),
    };
    this.logs.set(record.event_key, newRecord);
    return newRecord;
  }

  async update(id, updates) {
    for (const [key, rec] of this.logs.entries()) {
      if (rec.id === id) {
        Object.assign(rec, updates);
        return rec;
      }
    }
    return null;
  }
}

/**
 * Mock Handler mimicking telegram-notify Edge Function
 */
async function simulateTelegramNotify({
  headers = {},
  body = {},
  env = {},
  db,
  telegramApiMock,
}) {
  const expectedSecret = env.TELEGRAM_INTERNAL_SECRET || 'test_internal_secret_key';
  const providedSecret = headers['x-internal-secret'] || (headers['authorization'] || '').replace(/^Bearer\s+/i, '');

  // 1. Verify internal secret
  if (!providedSecret || providedSecret !== expectedSecret) {
    return {
      status: 401,
      body: { error: 'Unauthorized: Invalid or missing internal secret.' },
    };
  }

  // 2. Validate payload
  const eventType = body.event_type;
  if (!eventType || !ALLOWED_EVENT_TYPES.includes(eventType)) {
    return {
      status: 400,
      body: { error: `Invalid event_type "${eventType}". Allowed: ${ALLOWED_EVENT_TYPES.join(', ')}` },
    };
  }

  const eventKey = body.event_key;
  if (!eventKey) {
    return {
      status: 400,
      body: { error: 'event_key is required for strict deduplication.' },
    };
  }

  // 3. Telegram config
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID || '1523500422';

  if (!botToken) {
    return {
      status: 503,
      body: { error: 'Telegram Bot Token is not configured on the server.' },
    };
  }

  const message = buildHtmlMessage(eventType, body, chatId);

  // 4. Check DB for deduplication
  const existing = await db.findByEventKey(eventKey);
  if (existing) {
    if (existing.delivery_status === 'sent') {
      return {
        status: 200,
        body: {
          status: 'already_sent',
          message: 'Notification with this event_key was already delivered.',
          log_id: existing.id,
          telegram_message_id: existing.telegram_message_id,
        },
      };
    }
    if (existing.delivery_status === 'pending') {
      return {
        status: 200,
        body: {
          status: 'in_flight',
          message: 'Notification is currently being processed by another worker.',
          log_id: existing.id,
        },
      };
    }
  }

  // 5. Insert pending log
  let logRecord;
  try {
    logRecord = await db.insert({
      event_key: eventKey,
      device_id: body.device_id || null,
      event_type: eventType,
      message,
      delivery_status: 'pending',
    });
  } catch (err) {
    if (err.code === '23505') {
      return {
        status: 200,
        body: {
          status: 'concurrent_duplicate',
          message: 'Concurrent duplicate event_key intercepted by unique constraint.',
        },
      };
    }
    throw err;
  }

  // 6. Call Telegram API Mock
  const apiRes = await telegramApiMock({
    botToken,
    chatId,
    text: message,
    parseMode: 'HTML',
  });

  if (!apiRes.ok) {
    await db.update(logRecord.id, {
      delivery_status: 'failed',
      error_message: `Telegram Error [${apiRes.error_code}]: ${apiRes.description}`,
    });

    return {
      status: apiRes.error_code === 429 ? 429 : 502,
      body: {
        success: false,
        delivery_status: 'failed',
        error_code: apiRes.error_code,
        error_message: apiRes.description,
        retry_after: apiRes.parameters?.retry_after,
        log_id: logRecord.id,
      },
    };
  }

  // 7. Update log as sent
  await db.update(logRecord.id, {
    delivery_status: 'sent',
    telegram_message_id: apiRes.result.message_id,
    sent_at: new Date().toISOString(),
  });

  return {
    status: 200,
    body: {
      success: true,
      delivery_status: 'sent',
      telegram_message_id: apiRes.result.message_id,
      chat_id: chatId,
      event_key: eventKey,
      log_id: logRecord.id,
    },
  };
}

// ============================================================================
// TEST SUITE EXECUTION
// ============================================================================

async function runTestSuite() {
  console.log('========================================================================');
  console.log(' TEST SUITE: TELEGRAM BOT NOTIFICATION INTEGRATION (SUPABASE + IOT)');
  console.log(' Bot: @Lighrice_bot | Chat ID Target: 1523500422');
  console.log('========================================================================\n');

  const defaultEnv = {
    TELEGRAM_INTERNAL_SECRET: 'super_secret_internal_key_2026',
    TELEGRAM_BOT_TOKEN: 'valid_bot_token_sample',
    TELEGRAM_CHAT_ID: '1523500422',
  };

  const validMockApi = async () => ({
    ok: true,
    result: { message_id: 882041 },
  });

  // --------------------------------------------------------------------------
  // Skenario 1: Telegram token valid
  // --------------------------------------------------------------------------
  console.log('--- Skenario 1: Telegram token valid ---');
  {
    const db = new MockDatabase();
    const res = await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'TEST_NOTIFICATION',
        event_key: 'test_valid_token_01',
      },
      env: defaultEnv,
      db,
      telegramApiMock: validMockApi,
    });

    assert(res.status === 200, 'HTTP Status 200 OK');
    assert(res.body.success === true, 'Response payload success === true');
    assert(res.body.delivery_status === 'sent', 'delivery_status === "sent"');
    assert(res.body.telegram_message_id === 882041, 'Valid telegram_message_id returned');
  }

  // --------------------------------------------------------------------------
  // Skenario 2: Telegram token tidak valid (401)
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 2: Telegram token tidak valid (401) ---');
  {
    const db = new MockDatabase();
    const invalidTokenApi = async () => ({
      ok: false,
      error_code: 401,
      description: 'Unauthorized: invalid bot token',
    });

    const res = await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'DEVICE_ONLINE',
        event_key: 'test_invalid_token_01',
        device_code: 'SLT-SBG-01',
      },
      env: { ...defaultEnv, TELEGRAM_BOT_TOKEN: 'revoked_or_invalid_token' },
      db,
      telegramApiMock: invalidTokenApi,
    });

    assert(res.status === 502, 'HTTP Status 502 Bad Gateway on upstream 401');
    assert(res.body.success === false, 'success === false');
    assert(res.body.error_code === 401, 'error_code === 401 recorded');
    const log = await db.findByEventKey('test_invalid_token_01');
    assert(log.delivery_status === 'failed', 'DB record updated to failed status');
    assert(log.error_message.includes('401'), 'DB record contains error details');
  }

  // --------------------------------------------------------------------------
  // Skenario 3: Chat ID tidak valid (400)
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 3: Chat ID tidak valid (400) ---');
  {
    const db = new MockDatabase();
    const invalidChatApi = async () => ({
      ok: false,
      error_code: 400,
      description: 'Bad Request: chat not found',
    });

    const res = await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'DEVICE_ONLINE',
        event_key: 'test_invalid_chat_01',
        device_code: 'SLT-SBG-01',
      },
      env: { ...defaultEnv, TELEGRAM_CHAT_ID: 'non_existent_chat_id' },
      db,
      telegramApiMock: invalidChatApi,
    });

    assert(res.status === 502, 'HTTP Status 502 returned on invalid chat');
    assert(res.body.error_code === 400, 'error_code 400 captured safely');
    const log = await db.findByEventKey('test_invalid_chat_01');
    assert(log.delivery_status === 'failed', 'DB log marked as failed');
  }

  // --------------------------------------------------------------------------
  // Skenario 4: Chat belum memulai percakapan dengan bot (403)
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 4: Chat belum memulai percakapan dengan bot (403) ---');
  {
    const db = new MockDatabase();
    const forbiddenChatApi = async () => ({
      ok: false,
      error_code: 403,
      description: 'Forbidden: bot can\'t initiate conversation with a user',
    });

    const res = await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'DEVICE_ONLINE',
        event_key: 'test_forbidden_chat_01',
        device_code: 'SLT-SBG-01',
      },
      env: defaultEnv,
      db,
      telegramApiMock: forbiddenChatApi,
    });

    assert(res.status === 502, 'HTTP Status 502 returned on 403 Forbidden');
    assert(res.body.error_code === 403, 'error_code 403 reported in response');
    const log = await db.findByEventKey('test_forbidden_chat_01');
    assert(log.delivery_status === 'failed', 'Log marked as failed');
  }

  // --------------------------------------------------------------------------
  // Skenario 5: Internal secret tidak valid / hilang (401)
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 5: Internal secret tidak valid (401) ---');
  {
    const db = new MockDatabase();
    let apiCalled = false;
    const trackingApi = async () => { apiCalled = true; return { ok: true }; };

    // Test missing secret
    const resNoSecret = await simulateTelegramNotify({
      headers: {},
      body: { event_type: 'DEVICE_ONLINE', event_key: 'test_no_secret' },
      env: defaultEnv,
      db,
      telegramApiMock: trackingApi,
    });
    assert(resNoSecret.status === 401, 'Rejects request missing internal secret with 401');

    // Test wrong secret
    const resWrongSecret = await simulateTelegramNotify({
      headers: { 'x-internal-secret': 'wrong_secret' },
      body: { event_type: 'DEVICE_ONLINE', event_key: 'test_wrong_secret' },
      env: defaultEnv,
      db,
      telegramApiMock: trackingApi,
    });
    assert(resWrongSecret.status === 401, 'Rejects request with incorrect internal secret');
    assert(apiCalled === false, 'Telegram API was NOT called for unauthorized requests');
  }

  // --------------------------------------------------------------------------
  // Skenario 6: Pesan berhasil terkirim
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 6: Pesan berhasil terkirim ---');
  {
    const db = new MockDatabase();
    const res = await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'TEST_NOTIFICATION',
        event_key: 'test_msg_success_01',
        title: 'Verifikasi Berhasil',
        message: 'Pengujian berhasil dikirim',
      },
      env: defaultEnv,
      db,
      telegramApiMock: validMockApi,
    });

    assert(res.status === 200, 'HTTP Status 200');
    assert(res.body.delivery_status === 'sent', 'delivery_status is sent');
    assert(res.body.telegram_message_id > 0, 'telegram_message_id returned');
  }

  // --------------------------------------------------------------------------
  // Skenario 7: Pesan gagal terkirim (Server error 500)
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 7: Pesan gagal terkirim (Server error 500) ---');
  {
    const db = new MockDatabase();
    const serverErrApi = async () => ({
      ok: false,
      error_code: 500,
      description: 'Internal Server Error on Telegram server',
    });

    const res = await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'TEST_NOTIFICATION',
        event_key: 'test_msg_fail_01',
      },
      env: defaultEnv,
      db,
      telegramApiMock: serverErrApi,
    });

    assert(res.status === 502, 'HTTP 502 returned on upstream 500');
    assert(res.body.delivery_status === 'failed', 'delivery_status recorded as failed');
    const log = await db.findByEventKey('test_msg_fail_01');
    assert(log !== null, 'Log preserved in database without being deleted');
    assert(log.delivery_status === 'failed', 'Log delivery_status is failed');
  }

  // --------------------------------------------------------------------------
  // Skenario 8: Duplikasi event (Idempotency)
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 8: Duplikasi event ---');
  {
    const db = new MockDatabase();
    let apiCallCount = 0;
    const countingApi = async () => {
      apiCallCount++;
      return { ok: true, result: { message_id: 1000 + apiCallCount } };
    };

    // First call: sends message
    const res1 = await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'DEVICE_ONLINE',
        event_key: 'idempotent_event_key_101',
        device_code: 'SLT-SBG-01',
      },
      env: defaultEnv,
      db,
      telegramApiMock: countingApi,
    });
    assert(res1.body.delivery_status === 'sent', 'First call delivers message');
    assert(apiCallCount === 1, 'Telegram API called once');

    // Second call: duplicate event_key
    const res2 = await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'DEVICE_ONLINE',
        event_key: 'idempotent_event_key_101',
        device_code: 'SLT-SBG-01',
      },
      env: defaultEnv,
      db,
      telegramApiMock: countingApi,
    });
    assert(res2.body.status === 'already_sent', 'Second call returns already_sent');
    assert(apiCallCount === 1, 'Telegram API was NOT called again (Zero duplicate messages sent!)');
  }

  // --------------------------------------------------------------------------
  // Skenario 9: Dua event bersamaan (Concurrency Race Condition)
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 9: Dua event bersamaan ---');
  {
    const db = new MockDatabase();
    let apiCallCount = 0;
    const delayedApi = async () => {
      apiCallCount++;
      await new Promise((r) => setTimeout(r, 50));
      return { ok: true, result: { message_id: 555 } };
    };

    // Fire two identical event requests simultaneously
    const req1 = simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'RELAY_STATUS',
        event_key: 'concurrent_race_event_01',
        device_code: 'SLT-SBG-01',
        relay: 1,
        status: 'ON',
      },
      env: defaultEnv,
      db,
      telegramApiMock: delayedApi,
    });

    const req2 = simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'RELAY_STATUS',
        event_key: 'concurrent_race_event_01',
        device_code: 'SLT-SBG-01',
        relay: 1,
        status: 'ON',
      },
      env: defaultEnv,
      db,
      telegramApiMock: delayedApi,
    });

    const [out1, out2] = await Promise.all([req1, req2]);
    const statuses = [out1.body.status || out1.body.delivery_status, out2.body.status || out2.body.delivery_status];

    assert(statuses.includes('sent'), 'One process successfully sent message');
    assert(statuses.includes('concurrent_duplicate') || statuses.includes('in_flight') || statuses.includes('already_sent'),
      'Other process safely prevented duplicate dispatch');
    assert(apiCallCount === 1, 'Telegram API was invoked strictly once across concurrent workers');
  }

  // --------------------------------------------------------------------------
  // Skenario 10: Device online format
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 10: Device online ---');
  {
    let capturedText = '';
    const spyApi = async ({ text }) => { capturedText = text; return { ok: true, result: { message_id: 1 } }; };
    const db = new MockDatabase();

    await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'DEVICE_ONLINE',
        event_key: 'online_event_slt_01',
        device_code: 'SLT-SBG-01<script>alert(1)</script>',
      },
      env: defaultEnv,
      db,
      telegramApiMock: spyApi,
    });

    assert(capturedText.includes('🟢 <b>SMART LIGHT TRAP</b>'), 'Contains green icon & bold title');
    assert(capturedText.includes('Perangkat berhasil terhubung.'), 'Contains connection text');
    assert(capturedText.includes('SLT-SBG-01&lt;script&gt;'), 'HTML correctly escaped (XSS prevention)');
    assert(capturedText.includes('ONLINE'), 'Contains ONLINE status');
    assert(capturedText.includes('WIB'), 'Timestamp formatted in Asia/Jakarta (WIB)');
  }

  // --------------------------------------------------------------------------
  // Skenario 11: Device offline format
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 11: Device offline ---');
  {
    let capturedText = '';
    const spyApi = async ({ text }) => { capturedText = text; return { ok: true, result: { message_id: 1 } }; };
    const db = new MockDatabase();

    await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'DEVICE_OFFLINE',
        event_key: 'offline_event_slt_01',
        device_code: 'SLT-SBG-01',
        last_seen_at: '2026-11-09T03:45:00.000Z',
      },
      env: defaultEnv,
      db,
      telegramApiMock: spyApi,
    });

    assert(capturedText.includes('🔴 <b>SMART LIGHT TRAP ALERT</b>'), 'Contains red alert icon');
    assert(capturedText.includes('Perangkat tidak lagi mengirim heartbeat.'), 'Contains offline reason');
    assert(capturedText.includes('OFFLINE'), 'Contains OFFLINE status');
    assert(capturedText.includes('Last Seen:'), 'Contains Last Seen timestamp');
    assert(capturedText.includes('WIB'), 'Timestamp in WIB');
  }

  // --------------------------------------------------------------------------
  // Skenario 12: Relay ON/OFF format & mapping
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 12: Relay ON/OFF ---');
  {
    let capturedText = '';
    const spyApi = async ({ text }) => { capturedText = text; return { ok: true, result: { message_id: 1 } }; };
    const db = new MockDatabase();

    await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'RELAY_STATUS',
        event_key: 'relay_cmd_ack_01',
        device_code: 'SLT-SBG-01',
        relay: 3,
        status: 'ON',
      },
      env: defaultEnv,
      db,
      telegramApiMock: spyApi,
    });

    assert(capturedText.includes('⚙️ <b>RELAY STATUS</b>'), 'Contains gear icon & title');
    assert(capturedText.includes('Relay 3'), 'Contains Relay channel number');
    assert(capturedText.includes('Lampu UV'), 'Auto-mapped relay 3 to Lampu UV');
    assert(capturedText.includes('ON'), 'Status is ON');
  }

  // --------------------------------------------------------------------------
  // Skenario 13: Water change selesai format
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 13: Water change selesai ---');
  {
    let capturedText = '';
    const spyApi = async ({ text }) => { capturedText = text; return { ok: true, result: { message_id: 1 } }; };
    const db = new MockDatabase();

    await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'WATER_CHANGE',
        event_key: 'water_cmd_ack_01',
        device_code: 'SLT-SBG-01',
        status: 'COMPLETED',
        duration_seconds: 45,
      },
      env: defaultEnv,
      db,
      telegramApiMock: spyApi,
    });

    assert(capturedText.includes('💧 <b>WATER CHANGE</b>'), 'Contains water drop icon');
    assert(capturedText.includes('Proses penggantian air telah selesai.'), 'Contains completion message');
    assert(capturedText.includes('COMPLETED'), 'Status is COMPLETED');
    assert(capturedText.includes('45 detik'), 'Shows actual duration');

    // Test without duration: No fake numbers!
    const textNoDur = buildHtmlMessage('WATER_CHANGE', { device_code: 'SLT-SBG-01', status: 'COMPLETED' }, '1523500422');
    assert(!textNoDur.includes('Durasi:'), 'Omits duration when not available (No fake numbers)');
  }

  // --------------------------------------------------------------------------
  // Skenario 14: Error perangkat format
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 14: Error perangkat ---');
  {
    let capturedText = '';
    const spyApi = async ({ text }) => { capturedText = text; return { ok: true, result: { message_id: 1 } }; };
    const db = new MockDatabase();

    await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'DEVICE_ERROR',
        event_key: 'device_err_01',
        device_code: 'SLT-SBG-01',
        category: 'DRY_RUN_LOCKOUT',
        message: 'Level air tandon kritis, pompa dikunci.',
      },
      env: defaultEnv,
      db,
      telegramApiMock: spyApi,
    });

    assert(capturedText.includes('⚠️ <b>SMART LIGHT TRAP ERROR</b>'), 'Contains warning icon');
    assert(capturedText.includes('DRY_RUN_LOCKOUT'), 'Contains category');
    assert(capturedText.includes('Level air tandon kritis, pompa dikunci.'), 'Contains detail message');
  }

  // --------------------------------------------------------------------------
  // Skenario 15: Telegram API rate limit (429)
  // --------------------------------------------------------------------------
  console.log('\n--- Skenario 15: Telegram API rate limit (429) ---');
  {
    const db = new MockDatabase();
    const rateLimitedApi = async () => ({
      ok: false,
      error_code: 429,
      description: 'Too Many Requests: retry after 30',
      parameters: { retry_after: 30 },
    });

    const res = await simulateTelegramNotify({
      headers: { 'x-internal-secret': defaultEnv.TELEGRAM_INTERNAL_SECRET },
      body: {
        event_type: 'TEST_NOTIFICATION',
        event_key: 'rate_limited_event_01',
      },
      env: defaultEnv,
      db,
      telegramApiMock: rateLimitedApi,
    });

    assert(res.status === 429, 'Returns HTTP 429 to caller');
    assert(res.body.error_code === 429, 'error_code is 429');
    assert(res.body.retry_after === 30, 'retry_after parameter returned to caller');
    const log = await db.findByEventKey('rate_limited_event_01');
    assert(log.delivery_status === 'failed', 'Log status updated to failed');
    assert(log.error_message.includes('429'), 'Log contains 429 error code');
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(` HASIL PENGUJIAN: ${passedTests} / ${totalTests} BERHASIL (${failedTests} GAGAL)`);
  console.log('========================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
