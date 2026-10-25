import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';
import { verifyDeviceAuth } from '../_shared/auth.ts';

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
    await supabase
      .from('devices')
      .update({
        last_seen_at: new Date().toISOString(),
        connection_status: eventType === 'NETWORK_LOSS' ? 'offline' : 'online',
      })
      .eq('id', device.id);

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
