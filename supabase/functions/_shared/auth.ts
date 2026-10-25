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
}

export async function verifyDeviceAuth(req: Request): Promise<AuthenticatedDevice> {
  const deviceCode = req.headers.get('x-device-code');
  const deviceToken = req.headers.get('x-device-token');

  if (!deviceCode || !deviceToken) {
    throw new Response(
      JSON.stringify({
        error: 'Unauthorized: Header X-Device-Code and X-Device-Token are required.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
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
        error: 'Unauthorized: Invalid device credentials or device is inactive.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Fetch device details
  const { data: device, error: devErr } = await supabase
    .from('devices')
    .select('id, device_code, device_name, location_name, farm_sector, lamp_status, battery_cutoff_threshold_v, pest_threshold_per_night')
    .eq('device_code', deviceCode)
    .single();

  if (devErr || !device) {
    throw new Response(
      JSON.stringify({ error: 'Device record not found.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return device;
}
