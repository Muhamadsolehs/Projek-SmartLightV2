import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { notifyTelegram } from '../_shared/telegramNotifier.ts';

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
    const body = await req.json().catch(() => ({}));

    const title = body.title || 'Tes Integrasi Telegram Bot';
    const message = body.message || 'Pesan verifikasi operasional dari dashboard Smart Light Trap.';
    const deviceCode = body.device_code || 'SLT-SBG-01';
    const eventKey = `test_admin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Dispatch to centralized telegram-notify Edge Function
    const result = await notifyTelegram({
      event_type: 'TEST_NOTIFICATION',
      event_key: eventKey,
      device_code: deviceCode,
      title,
      message,
      timestamp: new Date().toISOString(),
    });

    if (!result.success) {
      const isMissingToken = (result.error || '').toLowerCase().includes('token');
      const statusCode = isMissingToken ? 503 : 502;
      return new Response(
        JSON.stringify({
          error: 'Gagal mengirim notifikasi Telegram.',
          details: result.error || 'Periksa TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID di Supabase Secrets.',
          hint: isMissingToken
            ? 'Set TELEGRAM_BOT_TOKEN di Supabase Dashboard (Settings > Functions > Secrets).'
            : undefined,
        }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pesan uji coba Telegram berhasil dikirim ke bot @Lighrice_bot.',
        event_key: eventKey,
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
