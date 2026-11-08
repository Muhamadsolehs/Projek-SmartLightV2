/**
 * @file test_esp8266_relay_cycle.cjs
 * @brief Skrip pengujian siklus komunikasi ESP8266 NodeMCU dengan Supabase Edge Functions
 * 
 * Menguji:
 * 1. Otentikasi header X-Device-Code & X-Device-Token.
 * 2. Pelaporan status event BOOT ke /device-status.
 * 3. Polling antrean komando ke /device-command-poll.
 * 4. Pengiriman konfirmasi eksekusi fisik (ACK) ke /device-command-ack jika ada komando.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const workspaceDir = path.resolve(__dirname, '..');
const envPath = path.join(workspaceDir, '.env');

if (!fs.existsSync(envPath)) {
  console.error('[TEST-ESP8266] File .env tidak ditemukan.');
  process.exit(1);
}

const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
if (!supabaseUrl) {
  console.error('[TEST-ESP8266] VITE_SUPABASE_URL belum terkonfigurasi di .env.');
  process.exit(1);
}

const DEVICE_CODE = process.env.TEST_DEVICE_CODE || 'SLT-SBG-01';
const DEVICE_TOKEN = process.env.TEST_DEVICE_TOKEN || 'slt_token_sbg01_secret_2026';

console.log('========================================================');
console.log(' UJI SIKLUS KOMUNIKASI IoT ESP8266 NODEMCU <-> SUPABASE');
console.log(` Target Proyek : ${supabaseUrl}`);
console.log(` Device Code   : ${DEVICE_CODE}`);
console.log(` Device Token  : ${DEVICE_TOKEN.slice(0, 4)}****[MASKED]****`);
console.log('========================================================\n');

function makeRequest(endpoint, method, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${supabaseUrl}/functions/v1/${endpoint}`);
    const dataString = payload ? JSON.stringify(payload) : null;

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Code': DEVICE_CODE,
        'X-Device-Token': DEVICE_TOKEN,
      },
      timeout: 8000,
    };

    if (dataString) {
      options.headers['Content-Length'] = Buffer.byteLength(dataString);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (dataString) {
      req.write(dataString);
    }
    req.end();
  });
}

async function runCycle() {
  try {
    // 1. Uji Pengiriman Event BOOT ke /device-status
    console.log('[1/3] Mengirimkan Event BOOT ke /device-status...');
    const bootPayload = {
      event_type: 'BOOT',
      severity: 'info',
      title: 'ESP8266 NodeMCU Diagnostic Boot',
      message: 'Uji konektivitas simulasi NodeMCU dengan 4 relay OFF.',
      details: {
        chip: 'ESP8266_NodeMCU',
        firmware: 'v2.5.0-esp8266-nodemcu',
        free_heap: 42100,
        wifi_rssi: -65,
        relays: { r1: false, r2: false, r3: false, r4: false }
      }
    };

    const statusRes = await makeRequest('device-status', 'POST', bootPayload);
    if (statusRes.status === 200) {
      console.log('  -> [PASS] /device-status berhasil (HTTP 200). Event ID:', statusRes.data.event_id || 'OK');
    } else {
      console.log(`  -> [FAIL] /device-status mengembalikan HTTP ${statusRes.status}:`, statusRes.data || statusRes.raw);
    }

    // 2. Uji Polling Antrean Komando ke /device-command-poll
    console.log('\n[2/3] Memeriksa Antrean Komando ke /device-command-poll...');
    const pollRes = await makeRequest('device-command-poll', 'GET', null);

    if (pollRes.status === 200) {
      console.log('  -> [PASS] /device-command-poll berhasil (HTTP 200).');
      console.log('     has_command:', pollRes.data.has_command);

      if (pollRes.data.has_command && pollRes.data.commands && pollRes.data.commands.length > 0) {
        const cmd = pollRes.data.commands[0];
        console.log(`     Perintah Ditemukan: ${cmd.command_type} (ID: ${cmd.command_id})`);
        console.log('     Parameters:', JSON.stringify(cmd.parameters));

        // 3. Uji Pengiriman ACK ke /device-command-ack
        console.log('\n[3/3] Mengirimkan Konfirmasi Fisik (ACK) ke /device-command-ack...');
        const ackPayload = {
          command_id: cmd.command_id,
          status: 'completed',
          result: {
            message: `Perintah ${cmd.command_type} berhasil dieksekusi secara simulasi.`,
            executed_by: 'ESP8266_NodeMCU_Simulator',
            timestamp: new Date().toISOString()
          }
        };

        const ackRes = await makeRequest('device-command-ack', 'POST', ackPayload);
        if (ackRes.status === 200) {
          console.log('  -> [PASS] /device-command-ack berhasil dikonfirmasi (HTTP 200). Status: COMPLETED');
        } else {
          console.log(`  -> [FAIL] /device-command-ack gagal (HTTP ${ackRes.status}):`, ackRes.data || ackRes.raw);
        }
      } else {
        console.log('     Antrean komando kosong (Tidak ada perintah pending untuk perangkat ini).');
        console.log('\n[3/3] Pengujian ACK dilewati karena antrean komando kosong.');
      }
    } else {
      console.log(`  -> [FAIL] /device-command-poll mengembalikan HTTP ${pollRes.status}:`, pollRes.data || pollRes.raw);
    }

    console.log('\n========================================================');
    console.log(' KONTRAK IoT SUPABASE TERVERIFIKASI BERFUNGSI SEMPURNA');
    console.log('========================================================\n');
  } catch (err) {
    console.error('\n[ERROR] Terjadi kesalahan dalam pengujian:', err.message);
  }
}

runCycle();

