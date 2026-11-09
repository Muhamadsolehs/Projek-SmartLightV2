/**
 * @file send_test_telegram.cjs
 * @brief Admin Utility to test Telegram Bot Notification (@Lighrice_bot)
 * 
 * Usage:
 *   # Direct to Telegram Bot API (Live test with token):
 *   node scripts/send_test_telegram.cjs --token <BOT_TOKEN> [--chat 1523500422]
 * 
 *   # Via Supabase Edge Function:
 *   node scripts/send_test_telegram.cjs --url https://<PROJECT-REF>.supabase.co --secret <INTERNAL_SECRET>
 */

const https = require('https');
const http = require('http');

const DEFAULT_CHAT_ID = '1523500422';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--token' && args[i + 1]) {
      options.token = args[++i];
    } else if (args[i] === '--chat' && args[i + 1]) {
      options.chatId = args[++i];
    } else if (args[i] === '--url' && args[i + 1]) {
      options.url = args[++i];
    } else if (args[i] === '--secret' && args[i + 1]) {
      options.secret = args[++i];
    } else if (args[i] === '--event' && args[i + 1]) {
      options.event = args[++i];
    }
  }
  return options;
}

function sendDirectTelegram(token, chatId, text) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    const req = https.request(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 10000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body });
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out after 10s'));
    });

    req.write(postData);
    req.end();
  });
}

function sendViaEdgeFunction(baseUrl, secret, payload) {
  return new Promise((resolve, reject) => {
    const cleanUrl = new URL('/functions/v1/telegram-notify', baseUrl);
    const postData = JSON.stringify(payload);
    const client = cleanUrl.protocol === 'https:' ? https : http;

    const req = client.request(
      cleanUrl.toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': secret,
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 10000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body });
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out after 10s'));
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  const opts = parseArgs();
  const token = opts.token || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = opts.chatId || process.env.TELEGRAM_CHAT_ID || DEFAULT_CHAT_ID;
  const edgeUrl = opts.url || process.env.SUPABASE_URL;
  const edgeSecret = opts.secret || process.env.TELEGRAM_INTERNAL_SECRET;

  console.log('========================================================================');
  console.log(' SMART LIGHT TRAP - TELEGRAM NOTIFICATION TEST CLI');
  console.log(' Target Bot: @Lighrice_bot | Destination Chat ID: ' + chatId);
  console.log('========================================================================\n');

  const nowWib = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';

  if (edgeUrl && edgeSecret) {
    console.log(`[Mode] Dispatching via Supabase Edge Function: ${edgeUrl}`);
    const eventKey = `admin_test_cli_${Date.now()}`;
    const payload = {
      event_type: 'TEST_NOTIFICATION',
      event_key: eventKey,
      device_code: 'SLT-SBG-01',
      title: 'Uji Coba Notifikasi Admin CLI',
      message: `Pengujian integrasi bot Telegram @Lighrice_bot via Supabase Edge Function pada ${nowWib}.`,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await sendViaEdgeFunction(edgeUrl, edgeSecret, payload);
      console.log(`Response Status: HTTP ${res.statusCode}`);
      console.log('Response Body:', JSON.stringify(res.data, null, 2));

      if (res.statusCode === 200 && res.data?.success) {
        console.log('\n[SUCCESS] Pesan uji coba berhasil dikirim via Supabase Edge Function!');
      } else {
        console.error('\n[FAILED] Pengiriman gagal. Periksa respon di atas.');
      }
    } catch (err) {
      console.error('\n[ERROR] Request error:', err.message);
    }
  } else if (token) {
    console.log('[Mode] Direct test to Telegram Bot API');
    const testMessage = [
      `🧪 <b>TEST NOTIFICATION</b>`,
      ``,
      `Bot: @Lighrice_bot`,
      `Sistem: Smart Light Trap Subang`,
      `Status: Uji Coba Pengiriman Langsung`,
      ``,
      `<b>Target Chat ID:</b> <code>${chatId}</code>`,
      `<b>Detail:</b> Pesan verifikasi konektivitas Telegram Bot API langsung dari Admin CLI.`,
      `<b>Waktu:</b> ${nowWib}`,
    ].join('\n');

    try {
      const res = await sendDirectTelegram(token, chatId, testMessage);
      console.log(`Telegram API Status: HTTP ${res.statusCode}`);
      console.log('Telegram API Response:', JSON.stringify(res.data, null, 2));

      if (res.data?.ok) {
        console.log(`\n[SUCCESS] Pesan sukses terkirim ke Telegram! Message ID: ${res.data.result.message_id}`);
      } else {
        console.error(`\n[FAILED] Telegram menolak pengiriman: [${res.data.error_code}] ${res.data.description}`);
      }
    } catch (err) {
      console.error('\n[ERROR] Gagal menghubungi api.telegram.org:', err.message);
    }
  } else {
    console.log('PANDUAN PENGGUNAAN:\n');
    console.log('1. Uji langsung ke Telegram Bot API (setelah membuat token baru di @BotFather):');
    console.log('   node scripts/send_test_telegram.cjs --token <TELEGRAM_BOT_TOKEN> [--chat 1523500422]\n');
    console.log('2. Uji melalui Supabase Edge Function (setelah function dideploy dan secrets diset):');
    console.log('   node scripts/send_test_telegram.cjs --url https://<PROJECT-REF>.supabase.co --secret <TELEGRAM_INTERNAL_SECRET>\n');
    console.log('Atau set environment variable: TELEGRAM_BOT_TOKEN dan TELEGRAM_INTERNAL_SECRET.');
  }
}

main().catch(console.error);

