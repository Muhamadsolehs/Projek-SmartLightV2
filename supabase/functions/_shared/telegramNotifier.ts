/**
 * Shared Telegram notification dispatcher for Supabase Edge Functions.
 * Communicates with the internal `telegram-notify` Edge Function using TELEGRAM_INTERNAL_SECRET.
 * Implements non-blocking, fail-safe architecture to ensure hardware operations (ACK, relay, telemetry)
 * never fail even if Telegram Bot API or network is unavailable.
 */

export interface TelegramNotifyPayload {
  event_type:
    | 'DEVICE_ONLINE'
    | 'DEVICE_OFFLINE'
    | 'RELAY_STATUS'
    | 'WATER_CHANGE'
    | 'BATTERY_LOW'
    | 'DEVICE_ERROR'
    | 'PEST_THRESHOLD'
    | 'TEST_NOTIFICATION';
  event_key: string;
  device_id?: string | null;
  device_code?: string;
  [key: string]: any;
}

export interface TelegramNotifyResult {
  success: boolean;
  status?: string;
  message?: string;
  error?: string;
}

const DEFAULT_INTERNAL_SECRET = 'slt_internal_sec_8f9a2b4e7c1d3f5a0e6b8c4d2e9f1a3b';
const DEFAULT_SUPABASE_URL = 'https://xzzjfwstrpayhnpymqpq.supabase.co';

/**
 * Dispatch an event to `telegram-notify` Edge Function.
 * Completely safe: Catches all errors internally, enforces strict timeout, and never throws.
 */
export async function notifyTelegram(payload: TelegramNotifyPayload): Promise<TelegramNotifyResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || DEFAULT_SUPABASE_URL;
  const internalSecret = Deno.env.get('TELEGRAM_INTERNAL_SECRET') || DEFAULT_INTERNAL_SECRET;

  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/telegram-notify`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s max timeout

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': internalSecret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const resData = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.warn(
        `[telegramNotifier] telegram-notify responded with HTTP ${res.status}: ${resData.error_message || resData.error || 'Unknown error'}`
      );
      return {
        success: false,
        status: resData.status || 'failed',
        error: resData.error_message || resData.error || `HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      status: resData.status || 'sent',
      message: resData.message,
    };
  } catch (err: any) {
    const errMsg = err?.name === 'AbortError' ? 'Call to telegram-notify timed out' : err?.message || 'Network error';
    console.warn(`[telegramNotifier] Failed to contact telegram-notify: ${errMsg}`);
    return {
      success: false,
      error: errMsg,
    };
  }
}

