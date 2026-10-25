import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// In-memory alert cooldown cache: key = `${device_code}_${alert_type}`, value = timestamp
const alertCooldownMap = new Map<string, number>();
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown per alert type

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();

    const title = body.title || 'Peringatan Operasional Smart Light Trap';
    const message = body.message || '';
    const severity = (body.severity || 'info').toUpperCase();
    const deviceCode = body.device_code || 'SLT-SBG-01';
    const locationName = body.location_name || 'Subang, Jawa Barat';
    const alertType = body.alert_type || 'general_alert';

    // 1. Check Cooldown Deduplication
    const cooldownKey = `${deviceCode}_${alertType}`;
    const now = Date.now();
    const lastSent = alertCooldownMap.get(cooldownKey);

    if (lastSent && now - lastSent < COOLDOWN_MS && alertType !== 'test_notification') {
      const remainingSec = Math.round((COOLDOWN_MS - (now - lastSent)) / 1000);
      return new Response(
        JSON.stringify({
          status: 'cooldown_active',
          message: `Notifikasi serupa baru saja dikirim. Cooldown aktif (${remainingSec}s tersisa).`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Read Server Secrets
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || body.bot_token;
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID') || Deno.env.get('TELEGRAM_DEFAULT_CHAT_ID') || body.chat_id;

    if (!botToken || !chatId) {
      return new Response(
        JSON.stringify({
          error: 'Telegram Bot Token or Chat ID is not configured in server secrets.',
          note: 'Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Supabase Edge Function Secrets.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Format Telegram Message
    const severityIcon = severity === 'CRITICAL' ? '🚨' : severity === 'WARNING' ? '⚠️' : 'ℹ️';
    const formattedText = [
      `${severityIcon} *[SMART LIGHT TRAP - PHT SUBANG]*`,
      `*Status:* \`${severity}\``,
      `*Perangkat:* \`${deviceCode}\` - ${locationName}`,
      `*Judul:* *${title}*`,
      `*Detail:* ${message}`,
      `*Waktu:* _${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB_`,
    ].join('\n');

    // 4. Send HTTP Request to Telegram Bot API
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: formattedText,
        parse_mode: 'Markdown',
      }),
    });

    const resJson = await response.json();
    if (!resJson.ok) {
      return new Response(
        JSON.stringify({
          error: 'Failed to deliver Telegram notification',
          details: resJson.description,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update cooldown
    alertCooldownMap.set(cooldownKey, now);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: resJson.result?.message_id,
        chat_id: chatId,
        sent_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
