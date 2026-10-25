import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';
import { verifyDeviceAuth } from '../_shared/auth.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const device = await verifyDeviceAuth(req);
    const supabase = getAdminClient();

    // Fetch device settings
    const { data: settings, error } = await supabase
      .from('device_settings')
      .select('*')
      .eq('device_id', device.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const lampOnTime = settings?.lamp_on_time || '18:00:00';
    const lampOffTime = settings?.lamp_off_time || '05:00:00';
    const photoIntervalMinutes = settings?.photo_interval_minutes || 60;
    const telemetryIntervalMinutes = settings?.telemetry_interval_minutes || 5;
    const batteryCutoff = settings?.battery_cutoff_threshold || 11.80;
    const waterSettings = settings?.water_change_settings || {
      turbidityThresholdNtu: 100,
      flushDurationSec: 25,
      safetyMinTankPercent: 15,
    };

    return new Response(
      JSON.stringify({
        device_code: device.device_code,
        device_name: device.device_name,
        operational_region: 'Subang, Jawa Barat',
        server_timestamp: new Date().toISOString(),
        lamp: {
          schedule_start: lampOnTime.slice(0, 5),
          schedule_end: lampOffTime.slice(0, 5),
          wavelength_nm: 365,
          default_led_current_ma: 850,
          eco_led_current_ma: 420,
        },
        intervals: {
          telemetry_interval_sec: telemetryIntervalMinutes * 60,
          photo_interval_sec: photoIntervalMinutes * 60,
          heartbeat_interval_sec: 120,
        },
        safety: {
          battery_cutoff_threshold_v: Number(batteryCutoff),
          turbidity_threshold_ntu: waterSettings.turbidityThresholdNtu || 100,
          flush_duration_sec: waterSettings.flushDurationSec || 25,
          safety_min_tank_percent: waterSettings.safetyMinTankPercent || 15,
        },
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
