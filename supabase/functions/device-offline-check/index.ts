import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';
import { notifyTelegram } from '../_shared/telegramNotifier.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getAdminClient();

    // Call PostgreSQL stored procedure check_and_mark_offline_devices
    // Default timeout is 180 seconds (3 missed 60s heartbeats)
    const { data: offlineDevices, error: rpcErr } = await supabase.rpc('check_and_mark_offline_devices', {
      p_timeout_seconds: 180,
    });

    if (rpcErr) {
      console.error('[device-offline-check] RPC error:', rpcErr.message);
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Array<{ device_code: string; last_seen_at: string; notification: any }> = [];

    if (offlineDevices && offlineDevices.length > 0) {
      console.log(`[device-offline-check] Detected ${offlineDevices.length} offline device(s).`);

      for (const dev of offlineDevices) {
        const lastSeenEpoch = dev.last_seen_at ? new Date(dev.last_seen_at).getTime() : 0;
        const eventKey = `offline_${dev.device_id}_${lastSeenEpoch}`;

        const notifResult = await notifyTelegram({
          event_type: 'DEVICE_OFFLINE',
          event_key: eventKey,
          device_id: dev.device_id,
          device_code: dev.device_code,
          last_seen_at: dev.last_seen_at,
        });

        results.push({
          device_code: dev.device_code,
          last_seen_at: dev.last_seen_at,
          notification: notifResult,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked_at: new Date().toISOString(),
        offline_count: offlineDevices?.length || 0,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[device-offline-check] Unexpected failure:', err?.message || err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

