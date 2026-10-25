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

    if (status === 'acknowledged') {
      updates.acknowledged_at = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }

    await supabase.from('device_commands').update(updates).eq('id', commandId);

    // If hydraulic flush cycle completed, record in water_change_logs
    if (command.command_type === 'FORCE_WATER_CHANGE' && status === 'completed') {
      await supabase.from('water_change_logs').insert({
        device_id: device.id,
        started_at: command.created_at,
        completed_at: new Date().toISOString(),
        trigger_reason: 'manual_operator',
        initial_turbidity_ntu: result.initial_turbidity_ntu || 120,
        final_turbidity_ntu: result.final_turbidity_ntu || 28,
        water_used_liters: result.water_used_liters || 5.0,
        status: 'SUCCESS',
      });
    }

    // If lamp command completed, sync device lamp_status
    if (command.command_type === 'TOGGLE_LAMP' && status === 'completed') {
      const nextActive = result.lamp_is_active !== undefined ? result.lamp_is_active : !device.lamp_status;
      await supabase
        .from('devices')
        .update({ lamp_status: nextActive })
        .eq('id', device.id);
    }

    // If SET_RELAY completed for relay 3 (LED/Lampu), sync device lamp_status
    if (command.command_type === 'SET_RELAY' && status === 'completed') {
      const relayNum = command.parameters?.relay;
      const relayState = command.parameters?.state;
      if (relayNum === 3) {
        await supabase
          .from('devices')
          .update({ lamp_status: relayState === 'ON' })
          .eq('id', device.id);
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
