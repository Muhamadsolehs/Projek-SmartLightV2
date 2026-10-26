/**
 * @file diagnose_device_auth.cjs
 * Prosedur diagnostik aman untuk menguji kecocokan kredensial firmware ESP32
 * dengan database Supabase TANPA mencetak token mentah atau hash ke terminal/log.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const workspaceDir = path.resolve(__dirname, '..');
const configPath = path.join(workspaceDir, 'firmware', 'esp32_smart_lightrap', 'config.h');
const envPath = path.join(workspaceDir, '.env');

// Baca .env
if (!fs.existsSync(envPath)) {
  console.error('[DIAGNOSTIK] File .env tidak ditemukan.');
  process.exit(1);
}

const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[DIAGNOSTIK] VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY belum dikonfigurasi.');
  process.exit(1);
}

// Baca kredensial dari config.h secara privat di memori
if (!fs.existsSync(configPath)) {
  console.error('[DIAGNOSTIK] File config.h tidak ditemukan.');
  process.exit(1);
}

const configContent = fs.readFileSync(configPath, 'utf8');

const deviceCodeMatch = configContent.match(/#define\s+DEVICE_CODE\s+"([^"]+)"/);
const deviceTokenMatch = configContent.match(/#define\s+DEVICE_TOKEN\s+"([^"]+)"/);

if (!deviceCodeMatch || !deviceTokenMatch) {
  console.error('[DIAGNOSTIK] DEVICE_CODE atau DEVICE_TOKEN tidak ditemukan di config.h.');
  process.exit(1);
}

const privateDeviceCode = deviceCodeMatch[1];
const privateDeviceToken = deviceTokenMatch[1];

async function runSafeDiagnostics() {
  console.log('================================================================');
  console.log('   PROSEDUR DIAGNOSTIK KEAMANAN OTENTIKASI PERANGKAT SMART TRAP');
  console.log('================================================================');
  console.log(`Target Perangkat : ${privateDeviceCode}`);
  console.log(`Panjang Token    : ${privateDeviceToken.length} karakter (nilai rahasia disembunyikan)`);
  console.log(`Supabase URL     : ${supabaseUrl}`);
  console.log('----------------------------------------------------------------');

  const { createClient } = require(path.join(workspaceDir, 'node_modules', '@supabase', 'supabase-js'));
  const client = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Uji RPC verify_device_token
  console.log('[1/2] Mengevaluasi RPC public.verify_device_token()...');
  try {
    const { data: isValid, error: rpcErr } = await client.rpc('verify_device_token', {
      p_device_code: privateDeviceCode,
      p_raw_token: privateDeviceToken,
    });

    if (rpcErr) {
      console.log(`[-] Hasil RPC : ERROR (${rpcErr.message})`);
    } else if (isValid === true) {
      console.log('[+] Hasil RPC : COCOK (VALID) — Hash SHA-256 di database cocok dengan token firmware.');
    } else {
      console.log('[-] Hasil RPC : TIDAK COCOK (INVALID) — Baris perangkat belum ada di tabel atau hash berbeda.');
    }
  } catch (err) {
    console.log(`[-] Hasil RPC : Gagal menghubungi database (${err.message})`);
  }

  // 2. Uji HTTP Endpoint Edge Function device-command-poll
  console.log('\n[2/2] Menguji HTTP Handshake ke Edge Function device-command-poll...');
  const pollUrl = new URL(`${supabaseUrl}/functions/v1/device-command-poll`);

  const reqOptions = {
    hostname: pollUrl.hostname,
    path: pollUrl.pathname,
    method: 'GET',
    headers: {
      'x-device-code': privateDeviceCode,
      'x-device-token': privateDeviceToken,
      'Content-Type': 'application/json',
    },
  };

  const req = https.request(reqOptions, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`[+] HTTP Status : ${res.statusCode} ${res.statusMessage}`);
      if (res.statusCode === 200) {
        console.log('[+] Hasil HTTP  : OTENTIKASI BERHASIL (ESP32 diterima oleh Edge Functions)');
      } else if (res.statusCode === 401) {
        console.log('[-] Hasil HTTP  : UNAUTHORIZED (Ditolak oleh Edge Function: kredensial tidak cocok/perangkat tidak aktif)');
      } else if (res.statusCode === 404) {
        console.log('[-] Hasil HTTP  : NOT FOUND (Endpoint belum terdeploy atau URL salah)');
      } else {
        console.log(`[-] Hasil HTTP  : Status tidak terduga (${res.statusCode})`);
      }
      console.log('================================================================');
    });
  });

  req.on('error', (err) => {
    console.error(`[-] Jaringan Error: ${err.message}`);
    console.log('================================================================');
  });

  req.end();
}

runSafeDiagnostics().catch(console.error);
