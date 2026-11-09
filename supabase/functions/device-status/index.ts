import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';
import { verifyDeviceAuth } from '../_shared/auth.ts';
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
    const device = await verifyDeviceAuth(req);
    const body = await req.json();
    const supabase = getAdminClient();

    const eventType = body.event_type || 'BOOT';
    const severity = body.severity || 'info';
    const details = body.details || {};
    const previousStatus = device.connection_status || 'offline';
    const newStatus = eventType === 'NETWORK_LOSS' ? 'offline' : 'online';

    // 1. Record device event
    const { data: event, error: evErr } = await supabase
      .from('device_events')
      .insert({
        device_id: device.id,
        event_type: eventType,
        severity,
        details,
      })
      .select('id')
      .single();

    if (evErr) throw evErr;

    // 2. If warning or critical, create corresponding alert
    if (severity === 'critical' || severity === 'warning') {
      let alertCategory: any = 'sensor_fault';
      if (eventType === 'NETWORK_LOSS') alertCategory = 'device_offline';
      else if (eventType === 'DRY_RUN_LOCKOUT') alertCategory = 'water_critical';

      await supabase.from('device_alerts').insert({
        device_id: device.id,
        alert_type: alertCategory,
        severity,
        title: body.title || `Hardware Event: ${eventType}`,
        message: body.message || `Perangkat ${device.device_code} melaporkan kejadian ${eventType}.`,
        status: 'triggered',
        metadata: details,
      });
    }

    // 3. Update device heartbeat
    const nowIso = new Date().toISOString();
    await supabase
      .from('devices')
      .update({
        last_seen_at: nowIso,
        connection_status: newStatus,
      })
      .eq('id', device.id);

    // 4. Non-blocking Telegram Notification Dispatch (Post-Commit)
    // Rule 1: Device online: Kirim HANYA saat status berubah dari offline menjadi online.
    if (previousStatus === 'offline' && newStatus === 'online') {
      const eventKey = `online_${device.id}_${new Date(nowIso).getTime()}`;
      notifyTelegram({
        event_type: 'DEVICE_ONLINE',
        event_key: eventKey,
        device_id: device.id,
        device_code: device.device_code,
        timestamp: nowIso,
      }).catch((e) => console.error('[device-status] Telegram online notify error:', e));
    }
    // Rule 2: Device offline via NETWORK_LOSS event:
    else if (newStatus === 'offline' && previousStatus !== 'offline') {
      const eventKey = `offline_${device.id}_${new Date(nowIso).getTime()}`;
      notifyTelegram({
        event_type: 'DEVICE_OFFLINE',
        event_key: eventKey,
        device_id: device.id,
        device_code: device.device_code,
        last_seen_at: nowIso,
      }).catch((e) => console.error('[device-status] Telegram offline notify error:', e));
    }

    // Rule 6: Hardware Critical / Fault Error Notification
    if (severity === 'critical' || eventType === 'SENSOR_FAULT' || eventType === 'DRY_RUN_LOCKOUT') {
      const eventKey = `error_${device.id}_${event.id}`;
      notifyTelegram({
        event_type: 'DEVICE_ERROR',
        event_key: eventKey,
        device_id: device.id,
        device_code: device.device_code,
        category: eventType,
        message: body.message || `Perangkat ${device.device_code} melaporkan ${eventType}.`,
        timestamp: nowIso,
      }).catch((e) => console.error('[device-status] Telegram error notify error:', e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: event.id,
        device_code: device.device_code,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    if (error instanceof Response) return error;

    return new Response(
      JSON.stringify({ error: error?.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
