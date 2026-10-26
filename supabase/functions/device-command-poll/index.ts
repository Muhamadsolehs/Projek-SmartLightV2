import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';
import { verifyDeviceAuth } from '../_shared/auth.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const device = await verifyDeviceAuth(req);
    const supabase = getAdminClient();

    // Query pending commands strictly belonging to this authenticated device
    const nowIso = new Date().toISOString();
    const { data: commands, error } = await supabase
      .from('device_commands')
      .select('*')
      .eq('device_id', device.id)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) {
      console.error(`[CommandPoll] Database error for device ${device.device_code}:`, error.message);
      throw error;
    }

    if (!commands || commands.length === 0) {
      return new Response(
        JSON.stringify({ has_command: false, commands: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark retrieved commands as 'sent'
    const commandIds = commands.map((c: any) => c.id);
    await supabase
      .from('device_commands')
      .update({ status: 'sent' })
      .in('id', commandIds);

    return new Response(
      JSON.stringify({
        has_command: true,
        count: commands.length,
        commands: commands.map((c: any) => ({
          command_id: c.id,
          command_type: c.command_type,
          parameters: c.parameters,
          created_at: c.created_at,
          expires_at: c.expires_at,
        })),
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
