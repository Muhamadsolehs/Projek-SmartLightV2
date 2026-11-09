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
    // 1. Authenticate ESP32-S3 Device
    const device = await verifyDeviceAuth(req);
    const body = await req.json();

    // 2. Validate essential payload structure
    const sequenceNumber = Number(body.sequence_number);
    if (!sequenceNumber || sequenceNumber <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valid sequence_number is required for deduplication.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recordedAt = body.timestamp ? new Date(body.timestamp).toISOString() : new Date().toISOString();
    const battery = body.battery || {};
    const water = body.water || {};
    const lamp = body.lamp || {};
    const conn = body.connectivity || {};

    const busVoltage = Number(battery.bus_voltage_v) || 12.8;
    const currentMa = Number(battery.current_ma) || 0;
    const turbidityNtu = Number(water.turbidity_ntu) || 0;
    const tankPercent = Number(water.tank_level_percent) || 0;

    const supabase = getAdminClient();

    // 3. Insert Telemetry Record (Guaranteed deduplication via UNIQUE(device_id, sequence_number))
    const { data: telData, error: telErr } = await supabase
      .from('device_telemetry')
      .insert({
        device_id: device.id,
        sequence_number: sequenceNumber,
        recorded_at: recordedAt,
        battery_voltage: busVoltage,
        battery_current: currentMa,
        shunt_voltage_mv: Number(battery.shunt_voltage_mv) || 0,
        solar_voltage: Number(battery.solar_voltage_v) || 0,
        solar_current: Number(battery.solar_current_ma) || 0,
        power_mw: Number(battery.power_mw) || Math.abs(busVoltage * currentMa),
        is_charging: Boolean(battery.is_charging),
        solar_irradiance_wm2: Number(battery.solar_irradiance_estimate_wm2) || 0,
        tray_level: Number(water.tray_level_percent) || 0,
        tray_level_cm: Number(water.tray_level_cm) || 0,
        tank_level: tankPercent,
        tank_volume_liters: Number(water.tank_volume_liters) || 0,
        turbidity: turbidityNtu,
        is_turbid: turbidityNtu > 100,
        drain_valve_status: water.drain_valve_status || 'closed',
        fill_pump_status: water.fill_pump_status || 'idle',
        last_water_change: water.last_water_change || null,
        safety_lockout: Boolean(water.safety_lockout),
        lamp_status: Boolean(lamp.is_active),
        lamp_mode: lamp.mode || 'schedule_auto',
        lamp_led_current_ma: Number(lamp.led_current_ma) || 0,
        lamp_wavelength_nm: Number(lamp.wavelength_nm) || 365,
        lamp_is_healthy: lamp.is_healthy ?? true,
        temperature: Number(body.temperature_c) || null,
        humidity: Number(body.humidity_percent) || null,
        network_type: conn.network_type || '4G_LTE',
        modem_signal_strength: Number(conn.rssi_dbm) || null,
        operator: conn.operator || 'Telkomsel IoT SIM',
        unsynced_microsd_packets: Number(conn.unsynced_microsd_packets) || 0,
        payload_metadata: { rtc: body.rtc || null },
      })
      .select('id')
      .single();

    if (telErr) {
      if (telErr.code === '23505') {
        // Unique violation: Duplicate sequence packet received
        return new Response(
          JSON.stringify({
            status: 'duplicate_ignored',
            message: `Sequence ${sequenceNumber} was already ingested.`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw telErr;
    }

    // 4. Update Device Heartbeat and Health State
    let nextStatus: 'online' | 'warning' | 'offline' = 'online';
    if (busVoltage < device.battery_cutoff_threshold_v || turbidityNtu > 100 || tankPercent < 15) {
      nextStatus = 'warning';
    }

    await supabase
      .from('devices')
      .update({
        last_seen_at: new Date().toISOString(),
        connection_status: nextStatus,
        lamp_status: Boolean(lamp.is_active),
      })
      .eq('id', device.id);

    // 5. Automated Alert Generation & Telegram Dispatch (with hourly cooldown deduplication)
    const hourKey = new Date().toISOString().slice(0, 13); // e.g. '2026-11-09T11'

    if (busVoltage < device.battery_cutoff_threshold_v) {
      await supabase.from('device_alerts').insert({
        device_id: device.id,
        alert_type: 'battery_low',
        severity: 'warning',
        title: `Tegangan Baterai Rendah (${busVoltage.toFixed(2)}V)`,
        message: `Tegangan baterai perangkat ${device.device_code} (${busVoltage.toFixed(2)}V) berada di bawah ambang proteksi ${device.battery_cutoff_threshold_v}V. Mode hemat daya diaktifkan.`,
        status: 'triggered',
        metadata: { bus_voltage_v: busVoltage, cutoff_v: device.battery_cutoff_threshold_v },
      });

      // Dispatch Telegram notification (Non-blocking post-commit with hourly deduplication)
      const eventKey = `battery_low_${device.id}_${hourKey}`;
      notifyTelegram({
        event_type: 'BATTERY_LOW',
        event_key: eventKey,
        device_id: device.id,
        device_code: device.device_code,
        voltage: busVoltage,
        threshold_v: device.battery_cutoff_threshold_v,
        timestamp: recordedAt,
      }).catch((e) => console.error('[device-telemetry] Telegram battery notify error:', e));
    }

    if (tankPercent < 15) {
      await supabase.from('device_alerts').insert({
        device_id: device.id,
        alert_type: 'water_critical',
        severity: 'warning',
        title: `Tandon Air Kritis (${tankPercent}%)`,
        message: `Kapasitas tandon air pada ${device.device_name} tersisa ${tankPercent}%. Pompa terkunci dry-run.`,
        status: 'triggered',
        metadata: { tank_level_percent: tankPercent },
      });

      // Dispatch Telegram notification for critical water level
      const eventKey = `water_critical_${device.id}_${hourKey}`;
      notifyTelegram({
        event_type: 'DEVICE_ERROR',
        event_key: eventKey,
        device_id: device.id,
        device_code: device.device_code,
        category: 'WATER_TANK_CRITICAL',
        message: `Kapasitas tandon air tersisa ${tankPercent}%. Pompa diproteksi dry-run lockout.`,
        timestamp: recordedAt,
      }).catch((e) => console.error('[device-telemetry] Telegram water alert notify error:', e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        telemetry_id: telData.id,
        device_code: device.device_code,
        status: nextStatus,
        server_time: new Date().toISOString(),
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
