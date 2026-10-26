import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';
import { verifyAdminAuth } from '../_shared/auth.ts';

// Helper: Hitung hash SHA-256 menggunakan Web Crypto API standar (kompatibel dengan SQL encode(digest(token, 'sha256'), 'hex'))
async function sha256Hex(input: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Hasilkan token acak yang aman secara kriptografi (CSPRNG)
function generateSecureToken(prefix = 'slt_live_'): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Gunakan metode POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 1. Validasi Sesi & Otorisasi Admin di Server-Side
    // Memverifikasi JWT Bearer dan memastikan role === 'admin' pada public.profiles
    const adminUser = await verifyAdminAuth(req);
    const supabase = getAdminClient();

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'provision';

    // =========================================================================
    // ACTION A: ROTATE TOKEN PERANGKAT YANG SUDAH ADA
    // =========================================================================
    if (action === 'rotate-token') {
      const deviceCode = (body.device_code || '').trim().toUpperCase();
      if (!deviceCode) {
        return new Response(
          JSON.stringify({ error: 'Parameter device_code wajib diisi untuk rotasi token.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Pastikan perangkat terdaftar
      const { data: existingDevice, error: findErr } = await supabase
        .from('devices')
        .select('id, device_code, device_name, operational_status')
        .eq('device_code', deviceCode)
        .single();

      if (findErr || !existingDevice) {
        return new Response(
          JSON.stringify({ error: `Perangkat dengan kode '${deviceCode}' tidak ditemukan di database.` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate token baru menggunakan CSPRNG
      const newRawToken = generateSecureToken();
      const newApiKeyHash = await sha256Hex(newRawToken);

      // Simpan HANYA hash ke database
      const { error: updateErr } = await supabase
        .from('devices')
        .update({
          api_key_hash: newApiKeyHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDevice.id);

      if (updateErr) {
        throw new Error(`Gagal memperbarui api_key_hash: ${updateErr.message}`);
      }

      // Catat audit log rotasi di database (menggunakan event_type valid 'DEVICE_RECOVERY' sesuai skema check constraint)
      await supabase.from('device_events').insert({
        device_id: existingDevice.id,
        event_type: 'DEVICE_RECOVERY',
        severity: 'info',
        details: {
          action: 'CREDENTIAL_ROTATED',
          rotated_by: adminUser.email,
          timestamp: new Date().toISOString(),
        },
      });

      // Kembalikan token mentah HANYA SEKALI ke admin pemohon
      return new Response(
        JSON.stringify({
          status: 'success',
          success: true,
          message: `Token untuk perangkat '${deviceCode}' berhasil dirotasi.`,
          credentials: {
            device_code: deviceCode,
            raw_token: newRawToken,
            config_h_snippet: `#define DEVICE_CODE  "${deviceCode}"\n#define DEVICE_TOKEN "${newRawToken}"`,
            warning: 'PERHATIAN: Salin token atau snippet ini sekarang. Token mentah HANYA ditampilkan SATU KALI dan tidak disimpan di database.',
            instructions: 'Salin dan tanamkan token baru ini ke firmware config.h secara lokal. Token mentah ini HANYA ditampilkan SATU KALI.',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // ACTION B: PROVISION PERANGKAT BARU (CREATE DEVICE & SETTINGS)
    // =========================================================================
    if (action === 'provision') {
      const code = (body.device_code || body.code || '').trim().toUpperCase();
      const name = (body.device_name || body.name || '').trim();
      const locationName = (body.location_name || body.locationName || '').trim();
      const farmSector = (body.farm_sector || body.farmSector || '').trim();
      const cropType = (body.crop_type || body.cropType || 'Padi Varietas Ciherang').trim();
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      const batteryCutoff = Number(body.battery_cutoff_threshold_v ?? body.batteryCutoffThresholdV) || 11.8;
      const pestThreshold = parseInt(body.pest_threshold_per_night ?? body.pestThresholdPerNight, 10) || 50;
      const firmwareVersion = (body.firmware_version || body.firmwareVersion || 'v2.4.0-relay-mesh').trim();
      const plantingDate = body.planting_date || body.plantingDate || null;

    // Validasi input
    if (!code || !/^[A-Z0-9_-]{3,32}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: 'Kode perangkat harus 3-32 karakter alfanumerik (huruf besar, angka, strip, underscore).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!name || name.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Nama perangkat wajib diisi minimal 3 karakter.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!locationName || !farmSector) {
      return new Response(
        JSON.stringify({ error: 'Nama lokasi dan sektor lahan wajib diisi.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isNaN(latitude) || latitude < -90 || latitude > 90 || isNaN(longitude) || longitude < -180 || longitude > 180) {
      return new Response(
        JSON.stringify({ error: 'Koordinat GPS latitude/longitude tidak valid.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Periksa duplikasi device_code
    const { data: duplicateCheck } = await supabase
      .from('devices')
      .select('id')
      .eq('device_code', code)
      .maybeSingle();

    if (duplicateCheck) {
      return new Response(
        JSON.stringify({ error: `Kode perangkat '${code}' sudah terdaftar dalam sistem. Gunakan kode unik.` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate Kredensial Kriptografis Aman
    const rawToken = generateSecureToken();
    const apiKeyHash = await sha256Hex(rawToken);

    const chipRandomBytes = new Uint8Array(4);
    crypto.getRandomValues(chipRandomBytes);
    const chipId = 'ESP32S3-' + Array.from(chipRandomBytes).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    // 1. Insert ke tabel public.devices
    const { data: newDevice, error: devErr } = await supabase
      .from('devices')
      .insert({
        device_code: code,
        device_name: name,
        location_name: locationName,
        farm_sector: farmSector,
        latitude,
        longitude,
        crop_type: cropType,
        planting_date: plantingDate,
        firmware_version: firmwareVersion,
        esp32_chip_id: chipId,
        api_key_hash: apiKeyHash,
        connection_status: 'offline',
        lamp_status: false,
        operational_status: 'active',
        battery_cutoff_threshold_v: batteryCutoff,
        pest_threshold_per_night: pestThreshold,
        is_simulated: false,
        last_seen_at: null,
      })
      .select()
      .single();

    if (devErr || !newDevice) {
      throw new Error(`Gagal membuat entri perangkat: ${devErr?.message || 'Unknown database error'}`);
    }

    // 2. Insert ke tabel public.device_settings
    const { error: setErr } = await supabase.from('device_settings').insert({
      device_id: newDevice.id,
      lamp_on_time: '18:00:00',
      lamp_off_time: '05:00:00',
      timezone: 'Asia/Jakarta',
      photo_interval_minutes: 60,
      pest_alert_threshold: pestThreshold,
      battery_cutoff_threshold: batteryCutoff,
      telemetry_interval_minutes: 5,
      water_change_settings: {
        turbidityThresholdNtu: 100,
        flushDurationSec: 25,
        safetyMinTankPercent: 15,
      },
    });

    // Mekanisme kompensasi/rollback jika pembuatan settings gagal
    if (setErr) {
      await supabase.from('devices').delete().eq('id', newDevice.id);
      throw new Error(`Gagal menginisialisasi device_settings: ${setErr.message}. Operasi dibatalkan secara bersih.`);
    }

    // Kembalikan token mentah HANYA SEKALI ke admin pemohon (tidak disimpan di DB maupun log)
    return new Response(
      JSON.stringify({
        status: 'success',
        success: true,
        message: 'Perangkat berhasil diprovisioning.',
        device: {
          id: newDevice.id,
          code: newDevice.device_code,
          name: newDevice.device_name,
          locationName: newDevice.location_name,
          farmSector: newDevice.farm_sector,
          latitude: Number(newDevice.latitude),
          longitude: Number(newDevice.longitude),
          cropType: newDevice.crop_type,
          status: newDevice.connection_status,
          firmwareVersion: newDevice.firmware_version,
          esp32ChipId: newDevice.esp32_chip_id,
          batteryCutoffThresholdV: Number(newDevice.battery_cutoff_threshold_v),
          pestThresholdPerNight: newDevice.pest_threshold_per_night,
        },
        credentials: {
          device_code: newDevice.device_code,
          raw_token: rawToken,
          config_h_snippet: `#define DEVICE_CODE  "${newDevice.device_code}"\n#define DEVICE_TOKEN "${rawToken}"`,
          warning: 'PERHATIAN: Salin token atau snippet ini sekarang. Token mentah HANYA ditampilkan SATU KALI dan tidak disimpan di database.',
          instructions: 'Salin token rahasia ini sekarang. Demi keamanan, token mentah HANYA ditampilkan SATU KALI ini dan TIDAK DAPAT dilihat kembali.',
        },
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: `Aksi '${action}' tidak dikenal. Gunakan 'provision' atau 'rotate-token'.` }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
} catch (error: any) {
    if (error instanceof Response) return error;

    return new Response(
      JSON.stringify({ error: error?.message || 'Internal Server Error pada server provisioning.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
