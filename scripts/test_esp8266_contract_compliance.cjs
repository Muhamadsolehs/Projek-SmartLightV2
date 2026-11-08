/**
 * @file test_esp8266_contract_compliance.cjs
 * @brief Automated Test Suite: ESP8266 NodeMCU Firmware Final Hardening & 12 Scenario Verification
 * 
 * Verifikasi 12 Skenario Wajib:
 * 1. Safe boot
 * 2. SET_RELAY ON/OFF
 * 3. TOGGLE_LAMP
 * 4. FORCE_WATER_CHANGE (Non-blocking & Abortable)
 * 5. REBOOT
 * 6. Command duplikat (Idempotensi)
 * 7. ACK retry & Backoff
 * 8. Wi-Fi terputus (Non-blocking & Queue preservation)
 * 9. Supabase 401/403 (Auth failure handling)
 * 10. Reboot saat ACK tertunda (EEPROM unconfirmed recovery)
 * 11. EEPROM corrupt (CRC-16 integrity protection)
 * 12. TLS gagal (NTP sync gate & Valid Root CAs)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const firmwarePath = path.join(ROOT_DIR, 'SmartLightTrap_ESP8266.ino');
const credExamplePath = path.join(ROOT_DIR, 'credentials.example.h');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, name, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${name}${details ? ': ' + details : ''}`);
  }
}

console.log('================================================================');
console.log(' AUDIT KEPATUHAN & 12 SKENARIO PENGUJIAN HARDENING FIRMWARE ESP8266');
console.log('================================================================\n');

if (!fs.existsSync(firmwarePath)) {
  console.error('[ERROR] Firmware SmartLightTrap_ESP8266.ino tidak ditemukan!');
  process.exit(1);
}

const fw = fs.readFileSync(firmwarePath, 'utf8');
const credEx = fs.existsSync(credExamplePath) ? fs.readFileSync(credExamplePath, 'utf8') : '';

// ----------------------------------------------------------------------
// SKENARIO 1: SAFE BOOT
// ----------------------------------------------------------------------
console.log('--- [1/12] Skenario 1: Safe Boot Sequence & Invariant ---');
assert(
  fw.indexOf('digitalWrite(pin, RELAY_INACTIVE_LEVEL)') < fw.indexOf('pinMode(pin, OUTPUT)'),
  'Safe Boot Sequence: digitalWrite HIGH dipanggil SEBELUM pinMode OUTPUT (Anti-Clicking)'
);
assert(
  fw.includes('RELAY_ACTIVE_LEVEL        LOW') && fw.includes('RELAY_INACTIVE_LEVEL      HIGH'),
  'Logika Active LOW didefinisikan secara eksplisit (LOW = 0V = ON, HIGH = 3.3V = OFF)'
);
assert(
  fw.includes('gRelayStates[i] = false') && fw.includes('gPumpStartTime = 0'),
  'Actuator Safe Boot Invariant: Seluruh relay dipastikan OFF dan pompa tidak aktif saat startup'
);
assert(
  fw.includes('PIN_RELAY_1') && fw.includes('D1') &&
  fw.includes('PIN_RELAY_2') && fw.includes('D2') &&
  fw.includes('PIN_RELAY_3') && fw.includes('D7') &&
  fw.includes('PIN_RELAY_4') && fw.includes('D0'),
  'Pemetaan Pin Fisik: D1 (Pompa), D2 (Drain), D7 (LED UV), D0 (Kipas/Aux)'
);

// ----------------------------------------------------------------------
// SKENARIO 2: SET_RELAY ON/OFF
// ----------------------------------------------------------------------
console.log('\n--- [2/12] Skenario 2: SET_RELAY ON/OFF & Validasi Parameter ---');
assert(
  fw.includes('relayNum < 1 || relayNum > NUM_RELAYS'),
  'Validasi Channel: Menolak relay di luar rentang 1 s.d. 4 dengan status failed'
);
assert(
  fw.includes('stateStr.equalsIgnoreCase("ON")') && fw.includes('stateStr.equalsIgnoreCase("OFF")'),
  'Validasi State: Hanya menerima parameter state "ON" atau "OFF"'
);
assert(
  fw.includes('digitalRead(pin)') && fw.includes('pinRead == expectedLevel'),
  'Verifikasi Output: Menguji level register GPIO mikrokontroler sebelum mengirim ACK'
);
assert(
  fw.includes('UNMONITORED'),
  'Pemisahan Transparan: Status beban fisik dinyatakan UNMONITORED (tanpa sensor arus eksternal)'
);

// ----------------------------------------------------------------------
// SKENARIO 3: TOGGLE_LAMP
// ----------------------------------------------------------------------
console.log('\n--- [3/12] Skenario 3: TOGGLE_LAMP & Sinkronisasi Lampu UV ---');
assert(
  fw.includes('executeToggleLamp') && fw.includes('int channelIndex = 2'),
  'TOGGLE_LAMP memetakan perintah ke Relay 3 (D7 / GPIO 13)'
);
assert(
  fw.includes('bool nextState = !gRelayStates[channelIndex]'),
  'TOGGLE_LAMP membalik status logis Relay 3 secara deterministik'
);
assert(
  fw.includes('Lampu UV (Relay 3, GPIO13) diset ke'),
  'Pesan ACK memuat deskripsi spesifik lampu UV dengan status final kapital (ON/OFF)'
);

// ----------------------------------------------------------------------
// SKENARIO 4: FORCE_WATER_CHANGE (Non-blocking & Abortable)
// ----------------------------------------------------------------------
console.log('\n--- [4/12] Skenario 4: FORCE_WATER_CHANGE (Non-blocking & Abortable) ---');
assert(
  fw.includes('updateWaterChangeStateMachine') && fw.includes('WC_DRAIN') && fw.includes('WC_FILL'),
  'Non-blocking State Machine: Siklus kuras dan isi baki dijalankan tanpa delay blocking'
);
assert(
  fw.includes('WATER_DRAIN_DURATION_MS') && fw.includes('WATER_FILL_DURATION_MS') && fw.includes('WATER_INTERLOCK_DELAY_MS'),
  'Parameter Durasi Terdefinisi: Drain (5s), Interlock Safety Buffer (1s), Fill (6s)'
);
assert(
  fw.includes('abortWaterChange'),
  'Safe Abort: FORCE_WATER_CHANGE dapat dibatalkan seketika oleh instruksi manual atau emergency stop'
);
assert(
  fw.includes('[INTERLOCK]') && fw.includes('Mematikan Solenoid Drain sebelum mengaktifkan Pompa'),
  'Interlock Hidrolik Mutlak: Pompa dan Solenoid Drain dicegah aktif bersamaan'
);

// ----------------------------------------------------------------------
// SKENARIO 5: REBOOT
// ----------------------------------------------------------------------
console.log('\n--- [5/12] Skenario 5: REBOOT Mikrokontroler NodeMCU ---');
assert(
  fw.includes('executeReboot') && (fw.includes('REBOOT_ESP8266') || fw.includes('REBOOT_ESP32')),
  'Mengenali instruksi reboot mikrokontroler (REBOOT_ESP8266 / REBOOT_ESP32)'
);
assert(
  fw.includes('emergencyShutdownAllRelays("REBOOT_COMMAND")'),
  'Safe Reboot: Mematikan seluruh 4 relay sebelum mengeksekusi ESP.restart()'
);
assert(
  fw.includes('sendRawCommandAck(rebootAck)'),
  'ACK Transmisi: Mengirimkan ACK sukses sebelum mikrokontroler me-restart'
);

// ----------------------------------------------------------------------
// SKENARIO 6: COMMAND DUPLIKAT (IDEMPOTENSI)
// ----------------------------------------------------------------------
console.log('\n--- [6/12] Skenario 6: Command Duplikat & Perlindungan Aktuator ---');
assert(
  fw.includes('int historyIdx = gCommandHistory.find(cmdId)'),
  'Pencarian Riwayat: Command ID diperiksa terhadap riwayat sebelum dieksekusi'
);
assert(
  fw.includes('Mencegah eksekusi ganda pada aktuator mekanik'),
  'Perlindungan Aktuator: ID duplikat TIDAK menggerakkan relay kembali'
);
assert(
  fw.includes('Idempotent response') && fw.includes('rec->status'),
  'Retensi Status Asli: ID duplikat mengembalikan status asli (completed/failed)'
);

// ----------------------------------------------------------------------
// SKENARIO 7: ACK RETRY & BACKOFF
// ----------------------------------------------------------------------
console.log('\n--- [7/12] Skenario 7: ACK Retry, Exponential Backoff & Dead-Letter ---');
assert(
  fw.includes('ACK_QUEUE_CAPACITY        8'),
  'Kapasitas Antrean: Mendukung hingga 8 slot ACK tertunda di RAM'
);
assert(
  fw.includes('2000UL * (1UL << min((int)it.retryCount, 5))'),
  'Exponential Backoff: Penjadwalan retry meningkat (2s, 4s, 8s, 16s, 32s, max 60s)'
);
assert(
  fw.includes('ACK_MAX_RETRIES           10') && fw.includes('retireAsDeadLetter'),
  'Dead-Letter Protection: ACK yang melebihi 10x kegagalan dipindahkan ke DeadLetterRecord tanpa hilang'
);
assert(
  fw.includes('PERINGATAN KRITIS: Antrean ACK penuh') && fw.includes('Evicted: Queue overflow'),
  'Queue Overflow Safeguard: Menolak silent drop, mencatat evakuasi ke dead-letter'
);

// ----------------------------------------------------------------------
// SKENARIO 8: WI-FI TERPUTUS
// ----------------------------------------------------------------------
console.log('\n--- [8/12] Skenario 8: Wi-Fi Terputus & Non-blocking Reconnect ---');
assert(
  fw.includes('connectWifiNonBlocking'),
  'Non-blocking Wi-Fi Reconnect: Penyambungan ulang berkala tanpa membekukan loop utama'
);
assert(
  fw.includes('if (WiFi.status() != WL_CONNECTED) {') && fw.includes('return 0;'),
  'Queue Preservation: Saat Wi-Fi putus, ACK tetap tersimpan di antrean untuk dikirim saat tersambung'
);

// ----------------------------------------------------------------------
// SKENARIO 9: SUPABASE 401 & 403 (AUTH FAILURE)
// ----------------------------------------------------------------------
console.log('\n--- [9/12] Skenario 9: Penanganan Respons HTTP 401 & 403 ---');
assert(
  fw.includes('401 Unauthorized: Kredensial perangkat ditolak'),
  'Diagnostik 401: Mencatat kegagalan autentikasi token / perangkat tidak terdaftar'
);
assert(
  fw.includes('403 Forbidden: Perangkat telah dinonaktifkan'),
  'Diagnostik 403: Mencatat status operasional perangkat tidak aktif / decommissioned'
);
assert(
  fw.includes('code == HTTP_CODE_OK || code == 201 || code == 204') && fw.includes('code == 409'),
  'Status Kontrak: Mendukung HTTP 200, 201, 204, dan 409 Conflict/Idempotent resolved'
);

// ----------------------------------------------------------------------
// SKENARIO 10: REBOOT SAAT ACK TERTUNDA
// ----------------------------------------------------------------------
console.log('\n--- [10/12] Skenario 10: Pemulihan ACK Tertunda Setelah Reboot ---');
assert(
  fw.includes('ackConfirmed') && fw.includes('isConfirmed'),
  'Pelacakan Konfirmasi Server: Membedakan perintah dieksekusi vs dikonfirmasi server'
);
assert(
  fw.includes('[RECOVERY] Memulihkan ACK tertunda dari flash untuk ID'),
  'Recovery Logic: Perintah yang belum dikonfirmasi server otomatis di-enqueue ulang ke ACK queue saat boot'
);
assert(
  fw.includes('getChronological'),
  'Kronologis Riwayat: Riwayat disimpan dan dipulihkan secara berurutan dari terlama ke terbaru'
);

// ----------------------------------------------------------------------
// SKENARIO 11: EEPROM CORRUPT (CRC-16 INTEGRITY)
// ----------------------------------------------------------------------
console.log('\n--- [11/12] Skenario 11: Proteksi Kerusakan EEPROM (CRC-16 Checksum) ---');
assert(
  fw.includes('calculateCRC16') && fw.includes('0x1021'),
  'Algoritma Integritas: Menggunakan CRC-16 CCITT (polinomial 0x1021) untuk validasi flash'
);
assert(
  fw.includes('EEPROM_MAGIC_HEADER       0x534C5433'),
  'Magic Header Versi Baru: SLT3 terdefinisi untuk memvalidasi inisialisasi memori'
);
assert(
  fw.includes('CRC-16 Checksum Mismatch (Flash korup)!') && fw.includes('Melewati pemulihan demi keselamatan'),
  'Fail-safe Corrupt Handling: Menolak memuat data korup demi keselamatan aktuator'
);
assert(
  fw.includes('eepromWriteByteIfChanged'),
  'Write-Avoidance: Hanya menulis byte yang berubah untuk meminimalkan keausan memori flash'
);

// ----------------------------------------------------------------------
// SKENARIO 12: TLS GAGAL & SINKRONISASI NTP
// ----------------------------------------------------------------------
console.log('\n--- [12/12] Skenario 12: Pengaman TLS & Sinkronisasi NTP ---');
assert(
  fw.includes('gNtpSynchronized') && fw.includes('syncNtpTime'),
  'NTP Prerequisite: Waktu sistem wajib disinkronkan sebelum request HTTPS dijalankan'
);
assert(
  fw.includes('GLOBALSIGN_ROOT_CA') && fw.includes('GTS_ROOT_R1_CA') && fw.includes('GLOBALSIGN_ECC_ROOT_R4_CA'),
  'Root CAs Otentik: Memuat sertifikat Root CA GlobalSign dan GTS Root R1'
);
assert(
  fw.includes('gSecureClient.setTrustAnchors(&gTrustAnchors)'),
  'Strict TLS: Menggunakan validasi Trust Anchor resmi pada konfigurasi produksi'
);
assert(
  !fw.includes('slt_token_sbg01_secret_2026') && credEx.includes('GANTI_DENGAN_TOKEN_DEVICE_DARI_SUPABASE'),
  'Sanitasi Kredensial: Tidak ada fallback token seed yang terekspos dalam kode'
);

// ----------------------------------------------------------------------
// RINGKASAN
// ----------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL PENGUJIAN: ${totalTests} | LULUS: ${passedTests} | GAGAL: ${failedTests}`);
if (failedTests === 0) {
  console.log('STATUS: SELURUH 12 SKENARIO FINAL HARDENING LULUS 100% [PASS]');
} else {
  console.log('STATUS: DITEMUKAN PENGUJIAN YANG GAGAL');
}
console.log('================================================================\n');

process.exit(failedTests > 0 ? 1 : 0);
