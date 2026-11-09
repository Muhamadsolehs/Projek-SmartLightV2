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

    const commandId = body.command_id;
    const status = (body.status || 'acknowledged').toLowerCase();
    const result = body.result || {};
    const errorMessage = body.error_message || null;

    if (!commandId) {
      return new Response(JSON.stringify({ error: 'command_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify command belongs to this device
    const { data: command, error: cmdErr } = await supabase
      .from('device_commands')
      .select('*')
      .eq('id', commandId)
      .eq('device_id', device.id)
      .single();

    if (cmdErr || !command) {
      return new Response(JSON.stringify({ error: 'Command not found or unauthorized' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updates: Record<string, any> = {
      status,
      result,
      error_message: errorMessage,
    };

    const nowIso = new Date().toISOString();
    if (status === 'acknowledged') {
      updates.acknowledged_at = nowIso;
    } else if (status === 'completed' || status === 'failed') {
      updates.completed_at = nowIso;
    }

    // Update command status in database
    const { error: updateErr } = await supabase.from('device_commands').update(updates).eq('id', commandId);
    if (updateErr) throw updateErr;

    // If hydraulic flush cycle completed, record in water_change_logs
    if (command.command_type === 'FORCE_WATER_CHANGE' && status === 'completed') {
      await supabase.from('water_change_logs').insert({
        device_id: device.id,
        started_at: command.created_at,
        completed_at: nowIso,
        trigger_reason: 'manual_operator',
        initial_turbidity_ntu: result.initial_turbidity_ntu || 120,
        final_turbidity_ntu: result.final_turbidity_ntu || 28,
        water_used_liters: result.water_used_liters || 5.0,
        status: 'SUCCESS',
      });
    }

    // If lamp command completed, sync device lamp_status
    let nextLampStatus = device.lamp_status;
    if (command.command_type === 'TOGGLE_LAMP' && status === 'completed') {
      nextLampStatus = result.lamp_is_active !== undefined ? result.lamp_is_active : !device.lamp_status;
      await supabase
        .from('devices')
        .update({ lamp_status: nextLampStatus })
        .eq('id', device.id);
    }

    // If SET_RELAY completed for relay 3 (LED/Lampu), sync device lamp_status
    if (command.command_type === 'SET_RELAY' && status === 'completed') {
      const relayNum = command.parameters?.relay ?? result.relay;
      const relayState = command.parameters?.state ?? result.state;
      if (relayNum === 3) {
        nextLampStatus = relayState === 'ON';
        await supabase
          .from('devices')
          .update({ lamp_status: nextLampStatus })
          .eq('id', device.id);
      }
    }

    // =========================================================================
    // POST-COMMIT TELEGRAM NOTIFICATIONS (Non-blocking, fail-safe)
    // Only dispatched AFTER database commits successfully!
    // =========================================================================

    // 1. Relay Status Confirmation
    if (command.command_type === 'SET_RELAY' && status === 'completed') {
      const relayNum = Number(command.parameters?.relay ?? result.relay ?? 1);
      const relayState = String(command.parameters?.state ?? result.state ?? 'ON').toUpperCase();
      const eventKey = `relay_${commandId}_${status}`;

      notifyTelegram({
        event_type: 'RELAY_STATUS',
        event_key: eventKey,
        device_id: device.id,
        device_code: device.device_code,
        relay: relayNum,
        status: relayState,
        timestamp: nowIso,
      }).catch((e) => console.error('[device-command-ack] Telegram relay notify error:', e));
    } else if (command.command_type === 'TOGGLE_LAMP' && status === 'completed') {
      const relayState = nextLampStatus ? 'ON' : 'OFF';
      const eventKey = `lamp_${commandId}_${status}`;

      notifyTelegram({
        event_type: 'RELAY_STATUS',
        event_key: eventKey,
        device_id: device.id,
        device_code: device.device_code,
        relay: 3,
        function_name: 'Lampu UV',
        status: relayState,
        timestamp: nowIso,
      }).catch((e) => console.error('[device-command-ack] Telegram lamp notify error:', e));
    }

    // 2. Water Change Execution Result (Completed or Failed)
    if (command.command_type === 'FORCE_WATER_CHANGE') {
      if (status === 'completed') {
        const eventKey = `water_${commandId}_completed`;
        let durationSec: number | undefined;
        if (result.duration_seconds !== undefined) {
          durationSec = Number(result.duration_seconds);
        } else if (command.created_at) {
          const diffMs = new Date(nowIso).getTime() - new Date(command.created_at).getTime();
          if (diffMs > 0 && diffMs < 3600000) {
            durationSec = Math.round(diffMs / 1000);
          }
        }

        notifyTelegram({
          event_type: 'WATER_CHANGE',
          event_key: eventKey,
          device_id: device.id,
          device_code: device.device_code,
          status: 'COMPLETED',
          duration_seconds: durationSec,
          timestamp: nowIso,
        }).catch((e) => console.error('[device-command-ack] Telegram water notify error:', e));
      } else if (status === 'failed') {
        const eventKey = `water_${commandId}_failed`;
        notifyTelegram({
          event_type: 'WATER_CHANGE',
          event_key: eventKey,
          device_id: device.id,
          device_code: device.device_code,
          status: 'FAILED',
          error_message: errorMessage || 'Eksekusi aktuator baki kuras gagal.',
          timestamp: nowIso,
        }).catch((e) => console.error('[device-command-ack] Telegram water failed notify error:', e));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        command_id: commandId,
        updated_status: status,
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
