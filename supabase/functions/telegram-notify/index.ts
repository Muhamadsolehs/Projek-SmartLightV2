import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

/**
 * Constant-time string comparison to prevent timing analysis attacks.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Extract candidate internal secret from incoming request headers.
 */
function extractInternalSecret(req: Request): string | null {
  const customHeader = req.headers.get('x-internal-secret');
  if (customHeader && customHeader.trim().length > 0) {
    return customHeader.trim();
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.trim().split(/\s+/);
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1].trim();
    }
  }

  return null;
}

/**
 * Escapes characters for HTML parse mode in Telegram Bot API.
 */
function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format timestamp into Asia/Jakarta (WIB) presentation string.
 */
function formatWibTime(dateInput?: string | Date | number | null): string {
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

/**
 * Map relay channel index to physical hardware function.
 */
function getRelayFunctionName(relayNum: number): string {
  switch (relayNum) {
    case 1:
      return 'Pompa Pengisi Baki Air';
    case 2:
      return 'Katup Solenoid Drain';
    case 3:
      return 'Lampu UV';
    case 4:
      return 'Kipas Blower Aux';
    default:
      return `Relay Channel ${relayNum}`;
  }
}

// Allowed event types
export const ALLOWED_EVENT_TYPES = [
  'DEVICE_ONLINE',
  'DEVICE_OFFLINE',
  'RELAY_STATUS',
  'WATER_CHANGE',
  'BATTERY_LOW',
  'DEVICE_ERROR',
  'PEST_THRESHOLD',
  'TEST_NOTIFICATION',
] as const;

export type EventType = typeof ALLOWED_EVENT_TYPES[number];

/**
 * Construct HTML formatted message for Telegram based on event type.
 */
function buildHtmlMessage(
  eventType: EventType,
  payload: Record<string, any>,
  targetChatId: string
): string {
  const deviceCode = escapeHtml(payload.device_code || 'SLT-SBG-01');
  const timestamp = formatWibTime(payload.timestamp || payload.recorded_at || payload.occurred_at);

  switch (eventType) {
    case 'PEST_THRESHOLD': {
      const targetCount = Number(payload.target_count || payload.cumulative_target_count || 0);
      const threshold = Number(payload.threshold || 50);
      const dominantPest = escapeHtml(payload.dominant_pest || 'Hama Sasaran PHT');
      const sessionId = escapeHtml(payload.session_id ? String(payload.session_id).substring(0, 8) + '...' : '-');
      return [
        `🚨 <b>SMART LIGHT TRAP ALERT — AMBANG BATAS HAMA</b>`,
        ``,
        `Akumulasi tangkapan hama sasaran malam ini melewati batas kendali PHT!`,
        ``,
        `<b>Perangkat:</b> <code>${deviceCode}</code>`,
        `<b>Akumulasi Malam Ini:</b> <b>${targetCount} ekor</b>`,
        `<b>Batas Ambang:</b> ${threshold} ekor/malam`,
        `<b>Hama Terbanyak:</b> ${dominantPest}`,
        `<b>Sesi ID:</b> <code>${sessionId}</code>`,
        `<b>Status:</b> CRITICAL PHT THRESHOLD`,
        `<b>Rekomendasi:</b> Periksa baki perangkap dan aktifkan tindakan agronomis PHT.`,
        `<b>Waktu:</b> ${timestamp}`,
      ].join('\n');
    }

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

      // Only display duration if genuinely available
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
      return [
        `ℹ️ <b>SMART LIGHT TRAP NOTIFICATION</b>`,
        ``,
        `<b>Device:</b> <code>${deviceCode}</code>`,
        `<b>Event:</b> ${escapeHtml(eventType)}`,
        `<b>Waktu:</b> ${timestamp}`,
      ].join('\n');
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Only POST is supported.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Allow': 'POST, OPTIONS' },
    });
  }

  // 1. Authenticate Request via TELEGRAM_INTERNAL_SECRET (with fallback)
  const expectedSecret = Deno.env.get('TELEGRAM_INTERNAL_SECRET') || 'slt_internal_sec_8f9a2b4e7c1d3f5a0e6b8c4d2e9f1a3b';

  const providedSecret = extractInternalSecret(req);
  if (!providedSecret || !constantTimeCompare(providedSecret, expectedSecret.trim())) {
    console.warn('[telegram-notify] Unauthorized call rejected.');
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or missing internal secret.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 2. Parse & Validate Payload
  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON payload.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const eventType = body.event_type as EventType;
  if (!eventType || !ALLOWED_EVENT_TYPES.includes(eventType)) {
    return new Response(
      JSON.stringify({
        error: `Invalid event_type "${eventType}". Allowed: ${ALLOWED_EVENT_TYPES.join(', ')}`,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const eventKey = typeof body.event_key === 'string' && body.event_key.trim().length > 0
    ? body.event_key.trim().slice(0, 255)
    : null;

  if (!eventKey) {
    return new Response(
      JSON.stringify({ error: 'event_key is required for strict deduplication.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const deviceId = typeof body.device_id === 'string' && body.device_id.trim().length > 0
    ? body.device_id.trim()
    : null;

  // 3. Read Telegram Bot Token & Chat ID
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  // Fixed target chat ID as specified in requirements: 1523500422
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID') || '1523500422';

  if (!botToken || botToken.trim().length === 0) {
    console.error('[telegram-notify] TELEGRAM_BOT_TOKEN is not configured in Supabase Secrets.');
    return new Response(
      JSON.stringify({
        error: 'Telegram Bot Token is not configured on the server.',
        note: 'Set TELEGRAM_BOT_TOKEN in Supabase Secrets.',
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 4. Generate Message Content
  const renderedMessage = buildHtmlMessage(eventType, body, chatId);

  // 5. Atomic Deduplication & Log Record via Supabase PostgreSQL
  const supabase = getAdminClient();
  let logId: string | null = null;

  try {
    // Check if event_key already exists
    const { data: existing, error: selectErr } = await supabase
      .from('telegram_notification_logs')
      .select('id, delivery_status, telegram_message_id, created_at')
      .eq('event_key', eventKey)
      .maybeSingle();

    if (selectErr) {
      console.error('[telegram-notify] Error querying telegram_notification_logs:', selectErr.message);
    }

    if (existing) {
      if (existing.delivery_status === 'sent') {
        // Strict idempotency: Never send duplicate message to Telegram
        return new Response(
          JSON.stringify({
            status: 'already_sent',
            message: 'Notification with this event_key was already delivered.',
            log_id: existing.id,
            telegram_message_id: existing.telegram_message_id,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (existing.delivery_status === 'pending') {
        // Concurrency guard: If pending within last 20 seconds, another process is in-flight
        const ageMs = Date.now() - new Date(existing.created_at).getTime();
        if (ageMs < 20000) {
          return new Response(
            JSON.stringify({
              status: 'in_flight',
              message: 'Notification is currently being processed by another worker.',
              log_id: existing.id,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // If older than 20s, previous worker timed out; allow safe retry
        logId = existing.id;
      } else if (existing.delivery_status === 'failed') {
        // Safe retry for failed previous attempt
        logId = existing.id;
        await supabase
          .from('telegram_notification_logs')
          .update({ delivery_status: 'pending', error_message: null })
          .eq('id', logId);
      }
    }

    if (!logId) {
      // Insert new log entry with delivery_status = 'pending'
      const { data: inserted, error: insertErr } = await supabase
        .from('telegram_notification_logs')
        .insert({
          event_key: eventKey,
          device_id: deviceId,
          event_type: eventType,
          message: renderedMessage,
          delivery_status: 'pending',
        })
        .select('id')
        .single();

      if (insertErr) {
        if (insertErr.code === '23505') {
          // Unique violation under concurrent race condition
          return new Response(
            JSON.stringify({
              status: 'concurrent_duplicate',
              message: 'Concurrent duplicate event_key intercepted by unique constraint.',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.error('[telegram-notify] Failed to insert notification log:', insertErr.message);
        throw insertErr;
      }

      logId = inserted.id;
    }

    // 6. Dispatch Request to Telegram Bot API with Timeout
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    let telegramRes: Response;
    try {
      telegramRes = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: renderedMessage,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const resJson = await telegramRes.json().catch(() => ({}));

    // 7. Process Telegram Response
    if (!telegramRes.ok || !resJson.ok) {
      const errCode = resJson.error_code || telegramRes.status;
      const errDesc = resJson.description || 'Unknown Telegram API error';
      const fullError = `Telegram Error [${errCode}]: ${errDesc}`;

      console.warn(`[telegram-notify] Telegram delivery failed: ${fullError}`);

      if (logId) {
        await supabase
          .from('telegram_notification_logs')
          .update({
            delivery_status: 'failed',
            error_message: fullError.slice(0, 1000),
          })
          .eq('id', logId);
      }

      // Safe error mapping
      return new Response(
        JSON.stringify({
          success: false,
          delivery_status: 'failed',
          error_code: errCode,
          error_message: errDesc,
          retry_after: resJson.parameters?.retry_after,
          log_id: logId,
        }),
        {
          status: errCode === 429 ? 429 : 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 8. Success: Update Log Record
    const messageId = resJson.result?.message_id || null;
    const nowIso = new Date().toISOString();

    if (logId) {
      await supabase
        .from('telegram_notification_logs')
        .update({
          delivery_status: 'sent',
          telegram_message_id: messageId,
          sent_at: nowIso,
          error_message: null,
        })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        delivery_status: 'sent',
        telegram_message_id: messageId,
        chat_id: chatId,
        event_key: eventKey,
        sent_at: nowIso,
        log_id: logId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[telegram-notify] Unexpected error:', err?.message || err);

    if (logId) {
      await supabase
        .from('telegram_notification_logs')
        .update({
          delivery_status: 'failed',
          error_message: (err?.message || 'Internal Server Error').slice(0, 1000),
        })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        delivery_status: 'failed',
        error: err?.name === 'AbortError' ? 'Telegram request timed out.' : err?.message || 'Internal Server Error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

