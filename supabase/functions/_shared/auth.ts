import { corsHeaders } from './cors.ts';
import { getAdminClient } from './supabaseClient.ts';

export interface AuthenticatedDevice {
  id: string;
  device_code: string;
  device_name: string;
  location_name: string;
  farm_sector: string;
  lamp_status: boolean;
  battery_cutoff_threshold_v: number;
  pest_threshold_per_night: number;
  operational_status: string;
  connection_status?: string;
}

/**
 * Verify hardware device credentials from headers (X-Device-Code & X-Device-Token).
 * Rejects deactivated/decommissioned devices and invalid credentials.
 */
export async function verifyDeviceAuth(req: Request): Promise<AuthenticatedDevice> {
  const deviceCode = req.headers.get('x-device-code')?.trim();
  const deviceToken = req.headers.get('x-device-token')?.trim();

  if (!deviceCode || !deviceToken) {
    throw new Response(
      JSON.stringify({
        error: 'Unauthorized: Header X-Device-Code dan X-Device-Token wajib disertakan.',
      }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = getAdminClient();

  // Call PostgreSQL function verify_device_token
  const { data: isValid, error: rpcErr } = await supabase.rpc('verify_device_token', {
    p_device_code: deviceCode,
    p_raw_token: deviceToken,
  });

  if (rpcErr || !isValid) {
    throw new Response(
      JSON.stringify({
        error: 'Unauthorized: Kredensial perangkat tidak valid atau perangkat belum terdaftar/tidak aktif.',
      }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Fetch device details
  const { data: device, error: devErr } = await supabase
    .from('devices')
    .select('id, device_code, device_name, location_name, farm_sector, lamp_status, battery_cutoff_threshold_v, pest_threshold_per_night, operational_status, connection_status')
    .eq('device_code', deviceCode)
    .single();

  if (devErr || !device) {
    throw new Response(
      JSON.stringify({ error: 'Device record not found.' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (device.operational_status === 'decommissioned' || device.operational_status === 'inactive') {
    throw new Response(
      JSON.stringify({ error: 'Forbidden: Perangkat telah dinonaktifkan (inactive/decommissioned).' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return device;
}

/**
 * Verify administrator user session from Bearer JWT.
 * Validates session and checks public.profiles.role === 'admin' on server side.
 */
export async function verifyAdminAuth(req: Request): Promise<{ userId: string; email: string }> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader) {
    throw new Response(
      JSON.stringify({ error: 'Unauthorized: Header Authorization Bearer wajib disertakan.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new Response(
      JSON.stringify({ error: 'Unauthorized: Token autentikasi kosong.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = getAdminClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);

  if (userErr || !user) {
    throw new Response(
      JSON.stringify({ error: 'Unauthorized: Sesi login pengguna tidak valid atau telah kedaluwarsa.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profErr || profile?.role !== 'admin') {
    throw new Response(
      JSON.stringify({ error: 'Forbidden: Hanya akun Administrator yang memiliki wewenang untuk tindakan ini.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return { userId: user.id, email: user.email || '' };
}
