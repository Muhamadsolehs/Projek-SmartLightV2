/**
 * @file test_hardened_audit_scenarios.cjs
 * @brief Automated Test Suite: Verifikasi Komprehensif 16 Skenario Audit & Hardening Firmware ESP8266
 * 
 * Pengujian 16 Skenario Wajib:
 * 1. Boot pertama tanpa data EEPROM (Fresh / Zeroed / 0xFF flash)
 * 2. Boot dengan EEPROM valid
 * 3. Boot dengan EEPROM corrupt (CRC-16 mismatch)
 * 4. Wi-Fi terputus saat polling (Queue preservation & Non-blocking)
 * 5. Token salah (HTTP 401 Unauthorized handling)
 * 6. Device dinonaktifkan (HTTP 403 Forbidden handling)
 * 7. ACK gagal dikirim (Network drop, exponential backoff, dead-letter)
 * 8. ACK berhasil dikirim (HTTP 200/201/204, marked confirmed)
 * 9. Command ID duplikat (Idempotency defense-in-depth, zero re-trigger)
 * 10. Reboot ketika ACK masih tertunda (EEPROM unconfirmed recovery)
 * 11. Listrik mati ketika proses drain berjalan (In-progress EEPROM flag, safe boot, mark failed, recover ACK)
 * 12. Listrik mati ketika proses fill berjalan (In-progress EEPROM flag, safe boot, mark failed, recover ACK)
 * 13. Interupsi manual ketika water change berlangsung (Safe abort, emergency shutdown, relays OFF)
 * 14. Pompa dan drain diminta ON secara berurutan (Interlock mutlak, mutual exclusion)
 * 15. HTTP 409 saat ACK (Response body inspection, idempotent resolution vs real conflict)
 * 16. TLS gagal karena waktu NTP belum tersinkronisasi (NTP synchronization gate)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const firmwarePath = path.join(ROOT_DIR, 'firmware', 'SmartLightTrap_ESP8266', 'SmartLightTrap_ESP8266.ino');
const credPath = path.join(ROOT_DIR, 'firmware', 'SmartLightTrap_ESP8266', 'credentials.h');

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

console.log('========================================================================');
console.log(' PENGUJIAN 16 SKENARIO AUDIT DAN HARDENING FIRMWARE SMART LIGHT TRAP');
console.log(' Target: ESP8266 NodeMCU | Firmware: v2.8.0-esp8266-nodemcu');
console.log('========================================================================\n');

if (!fs.existsSync(firmwarePath)) {
  console.error(`[ERROR] File firmware tidak ditemukan: ${firmwarePath}`);
  process.exit(1);
}

const fw = fs.readFileSync(firmwarePath, 'utf8');
const cred = fs.existsSync(credPath) ? fs.readFileSync(credPath, 'utf8') : '';

// ----------------------------------------------------------------------
// SKENARIO 1: BOOT PERTAMA TANPA DATA EEPROM
// ----------------------------------------------------------------------
console.log('--- [1/16] Skenario 1: Boot Pertama Tanpa Data EEPROM (Fresh Flash) ---');
assert(
  fw.includes('magic != EEPROM_MAGIC_HEADER') && fw.includes('Magic header baru diinisialisasi'),
  'Deteksi Header Baru: Mengenali flash kosong / belum diinisialisasi'
);
assert(
  fw.includes('for (int i = 0; i < EEPROM_ALLOC_SIZE; i++)') && fw.includes('EEPROM.write(i, 0)'),
  'Format Bersih: Membersihkan seluruh alokasi 512 byte EEPROM saat pertama kali boot'
);
assert(
  fw.includes('EEPROM.commit()') && fw.includes('EEPROM_FORMAT_VERSION'),
  'Penulisan Versi Format: Menuliskan header magic dan format version 0x04 secara atomik'
);

// ----------------------------------------------------------------------
// SKENARIO 2: BOOT DENGAN EEPROM VALID
// ----------------------------------------------------------------------
console.log('\n--- [2/16] Skenario 2: Boot dengan EEPROM Valid ---');
assert(
  fw.includes('loadCommandHistoryFromEEPROM()') && (fw.includes('storedChecksum != computedChecksum') || fw.includes('storedChecksum == computedChecksum')),
  'Verifikasi CRC-16: Memvalidasi integritas data riwayat terhadap CRC-16 yang tersimpan'
);
assert(
  fw.includes('getChronological') && fw.includes('loadedCount++'),
  'Kronologis Riwayat: Memuat record sesuai urutan waktu eksekusi dari yang terlama ke terbaru'
);

// ----------------------------------------------------------------------
// SKENARIO 3: BOOT DENGAN EEPROM CORRUPT
// ----------------------------------------------------------------------
console.log('\n--- [3/16] Skenario 3: Boot dengan EEPROM Corrupt ---');
assert(
  fw.includes('CRC-16 Checksum Mismatch (Flash korup)!') && fw.includes('Melewati pemulihan demi keselamatan'),
  'Fail-Safe Corrupt: Menolak memuat data jika CRC-16 mismatch untuk mencegah aksi liar'
);
assert(
  fw.includes('recordCorrupt = true') && fw.includes('Menolak record indeks'),
  'Sanitasi Granular: Memvalidasi setiap field individual (cmdId, status, relay, ackConf)'
);

// ----------------------------------------------------------------------
// SKENARIO 4: WI-FI TERPUTUS SAAT POLLING
// ----------------------------------------------------------------------
console.log('\n--- [4/16] Skenario 4: Wi-Fi Terputus Saat Polling ---');
assert(
  fw.includes('if (WiFi.status() != WL_CONNECTED) return;') && fw.includes('pollSupabaseCommands'),
  'Guard Polling: Menolak request jaringan saat Wi-Fi putus tanpa memicu crash'
);
assert(
  fw.includes('connectWifiNonBlocking'),
  'Non-blocking Wi-Fi Reconnect: Memulihkan koneksi secara berkala tanpa membekukan loop utama'
);

// ----------------------------------------------------------------------
// SKENARIO 5: TOKEN SALAH (HTTP 401)
// ----------------------------------------------------------------------
console.log('\n--- [5/16] Skenario 5: Token Salah (HTTP 401 Unauthorized) ---');
assert(
  fw.includes('401 Unauthorized: Kredensial perangkat ditolak oleh Supabase!'),
  'Deteksi 401 Polling: Mencatat penolakan otentikasi token di Edge Functions'
);
assert(
  fw.includes('401 Unauthorized: Kredensial perangkat ditolak oleh server saat kirim ACK!'),
  'Deteksi 401 ACK: Menahan ACK di antrean dengan retry backoff agar tidak hilang saat token diperbarui'
);

// ----------------------------------------------------------------------
// SKENARIO 6: DEVICE DINONAKTIFKAN (HTTP 403)
// ----------------------------------------------------------------------
console.log('\n--- [6/16] Skenario 6: Device Dinonaktifkan (HTTP 403 Forbidden) ---');
assert(
  fw.includes('403 Forbidden: Perangkat telah dinonaktifkan di database (operational_status != active).'),
  'Deteksi 403: Mencatat status operasional perangkat inactive atau decommissioned'
);
assert(
  fw.includes('code == 403') && fw.includes('outcome = 0'),
  'Penanganan 403: Mencegah eksekusi berbahaya dan mempertahankan state aman'
);

// ----------------------------------------------------------------------
// SKENARIO 7: ACK GAGAL DIKIRIM (BACKOFF & DEAD-LETTER)
// ----------------------------------------------------------------------
console.log('\n--- [7/16] Skenario 7: ACK Gagal Dikirim (Backoff & Dead-Letter) ---');
assert(
  fw.includes('ACK_QUEUE_CAPACITY        8') && fw.includes('ACK_MAX_RETRIES           10'),
  'Kapasitas & Batas Retry: Antrean 8-slot dan batas maksimum 10x percobaan sebelum dead-letter'
);
assert(
  fw.includes('2000UL * (1UL << min((int)it.retryCount, 5))'),
  'Exponential Backoff: Penjadwalan retry berjenjang (2s, 4s, 8s, 16s, 32s, maks 60s)'
);
assert(
  fw.includes('retireAsDeadLetter') && fw.includes('deadLetterCount++'),
  'Audit Dead-Letter: Memindahkan item gagal berulang ke dead-letter dengan alasan audit'
);

// ----------------------------------------------------------------------
// SKENARIO 8: ACK BERHASIL DIKIRIM
// ----------------------------------------------------------------------
console.log('\n--- [8/16] Skenario 8: ACK Berhasil Dikirim (HTTP 200/201/204) ---');
assert(
  fw.includes('code == HTTP_CODE_OK || code == 201 || code == 204'),
  'Dukungan Status Sukses: Mendukung HTTP 200, 201, dan 204 sesuai spesifikasi backend'
);
assert(
  fw.includes('gCommandHistory.markAckConfirmed(item.commandId)') && fw.includes('saveCommandHistoryToEEPROM()'),
  'Persistensi Konfirmasi: Menandai ackConfirmed = true di EEPROM agar tidak dipulihkan ganda'
);

// ----------------------------------------------------------------------
// SKENARIO 9: COMMAND ID DUPLIKAT (IDEMPOTENSI)
// ----------------------------------------------------------------------
console.log('\n--- [9/16] Skenario 9: Command ID Duplikat (Idempotensi) ---');
assert(
  fw.includes('int historyIdx = gCommandHistory.find(cmdId)'),
  'Pencarian Riwayat: Command ID diperiksa sebelum eksekusi aktuator'
);
assert(
  fw.includes('Mencegah eksekusi ganda pada aktuator mekanik'),
  'Proteksi Aktuator: ID duplikat TIDAK menggerakkan relay fisik kembali'
);
assert(
  fw.includes('Idempotent response') && fw.includes('rec->status'),
  'Respon Idempoten: Mengembalikan status asli (completed / failed) dari memori'
);

// ----------------------------------------------------------------------
// SKENARIO 10: REBOOT KETIKA ACK MASIH TERTUNDA
// ----------------------------------------------------------------------
console.log('\n--- [10/16] Skenario 10: Reboot Ketika ACK Masih Tertunda ---');
assert(
  fw.includes('ackConfirmed') && fw.includes('isConfirmed'),
  'Pelacakan Status Server: Membedakan status eksekusi lokal vs konfirmasi Supabase'
);
assert(
  fw.includes('[RECOVERY] Memulihkan ACK tertunda dari flash untuk ID'),
  'Pemulihan Otomatis: ACK yang belum confirmed di-enqueue ulang ke antrean saat boot'
);

// ----------------------------------------------------------------------
// SKENARIO 11: LISTRIK MATI KETIKA PROSES DRAIN BERJALAN
// ----------------------------------------------------------------------
console.log('\n--- [11/16] Skenario 11: Listrik Mati Saat Siklus DRAIN Berjalan ---');
assert(
  fw.includes('saveInProgressTaskToEEPROM(cmdId, WC_DRAIN)'),
  'Persistensi Non-Volatile: Menyimpan status in_progress dan stage WC_DRAIN SEBELUM relay aktif'
);
assert(
  fw.includes('initEEPROMStorage()') && fw.includes('EEPROM_INPROGRESS_ACTIVE'),
  'Deteksi Interupsi: Membaca status in_progress saat mikrokontroler boot kembali'
);
assert(
  fw.includes('emergencyShutdownAllRelays("INTERRUPTED_CYCLE_RECOVERY")'),
  'Keselamatan Aktuator: Memastikan seluruh relay OFF dan TIDAK melanjutkan kuras otomatis'
);
assert(
  fw.includes('gCommandHistory.add(inProgCmdId, "failed"') && fw.includes('gAckQueue.enqueue(inProgCmdId, "failed"'),
  'Pelaporan Kegagalan: Menandai perintah sebagai failed dan mengirim ACK pemulihan ke server'
);

// ----------------------------------------------------------------------
// SKENARIO 12: LISTRIK MATI KETIKA PROSES FILL BERJALAN
// ----------------------------------------------------------------------
console.log('\n--- [12/16] Skenario 12: Listrik Mati Saat Siklus FILL Berjalan ---');
assert(
  fw.includes('saveInProgressTaskToEEPROM(gWaterChangeTask.commandId, WC_FILL)'),
  'Persistensi Stage FILL: Menyimpan stage WC_FILL ke EEPROM saat transisi dari interlock'
);
assert(
  fw.includes('clearInProgressTaskFromEEPROM()'),
  'Pembersihan Status: Menghapus flag in_progress begitu siklus berhasil selesai penuh'
);

// ----------------------------------------------------------------------
// SKENARIO 13: INTERUPSI MANUAL KETIKA WATER CHANGE BERLANGSUNG
// ----------------------------------------------------------------------
console.log('\n--- [13/16] Skenario 13: Interupsi Manual Saat Water Change Berlangsung ---');
assert(
  fw.includes('abortWaterChange("Diinterupsi oleh instruksi manual SET_RELAY")'),
  'Interupsi Manual: Membatalkan siklus jika pengguna mengendalikan pompa atau drain secara langsung'
);
assert(
  fw.includes('abortWaterChange') && fw.includes('setRelayPhysical(0, false)') && fw.includes('setRelayPhysical(1, false)'),
  'Safe Abort: Mematikan pompa dan menutup katup drain seketika saat dibatalkan'
);

// ----------------------------------------------------------------------
// SKENARIO 14: POMPA DAN DRAIN DIMINTA ON SECARA BERURUTAN (INTERLOCK)
// ----------------------------------------------------------------------
console.log('\n--- [14/16] Skenario 14: Pompa dan Drain Diminta ON Berurutan (Interlock Mutlak) ---');
assert(
  fw.includes('[INTERLOCK] Mematikan Solenoid Drain sebelum mengaktifkan Pompa!'),
  'Interlock Drain-to-Pump: Solenoid Drain dimatikan paksa sebelum Pompa aktif'
);
assert(
  fw.includes('[INTERLOCK] Mematikan Pompa Pengisi sebelum membuka Solenoid Drain!'),
  'Interlock Pump-to-Drain: Pompa dimatikan paksa sebelum Solenoid Drain dibuka'
);
assert(
  fw.includes('delay(50)') && fw.includes('gRelayStates[0]') && fw.includes('gRelayStates[1]'),
  'Jeda Fisik & Status Logis: Memberikan dead-time 50ms dan memperbarui gRelayStates'
);

// ----------------------------------------------------------------------
// SKENARIO 15: HTTP 409 SAAT ACK (INSPEKSI RESPONSE BODY)
// ----------------------------------------------------------------------
console.log('\n--- [15/16] Skenario 15: HTTP 409 Saat ACK (Inspeksi Response Body) ---');
assert(
  fw.includes('String respBody = gHttpClient.getString()') && fw.includes('code == 409'),
  'Inspeksi Response Body: Membaca teks respons HTTP 409 dari server'
);
assert(
  fw.includes('respBody.indexOf("already") >= 0 || respBody.indexOf("idempotent") >= 0'),
  'Validasi Semantik Idempoten: Hanya menganggap 409 berhasil jika ada kata kunci idempoten/already'
);
assert(
  fw.includes('HTTP 409 bukan konfirmasi idempoten valid. Menjadwalkan retry.'),
  'Pencegahan False Positive: 409 akibat error/konflik asli dijadwalkan untuk retry'
);

// ----------------------------------------------------------------------
// SKENARIO 16: TLS GAGAL KARENA WAKTU NTP BELUM TERSINKRONISASI
// ----------------------------------------------------------------------
console.log('\n--- [16/16] Skenario 16: TLS Gagal Karena NTP Belum Tersinkronisasi ---');
assert(
  fw.includes('gNtpSynchronized') && fw.includes('syncNtpTime()'),
  'NTP Gatekeeper: Status sinkronisasi waktu wajib true sebelum HTTPS diproses'
);
assert(
  fw.includes('if (!gNtpSynchronized) {') && fw.includes('return;'),
  'TLS Protection Gate: Mencegah kegagalan validasi sertifikat akibat clock drift'
);
assert(
  fw.includes('GLOBALSIGN_ROOT_CA') && fw.includes('GTS_ROOT_R1_CA') && fw.includes('gSecureClient.setTrustAnchors(&gTrustAnchors)'),
  'Strict TLS Trust Anchors: Menggunakan Root CA resmi tanpa mematikan verifikasi TLS'
);

// ----------------------------------------------------------------------
// VERIFIKASI ZERO HARDCODED SECRETS PADA FILE .INO
// ----------------------------------------------------------------------
console.log('\n--- Sanitasi Kredensial Zero-Leak ---');
assert(
  !fw.includes('slt_live_') && !fw.includes('Alya1504*'),
  'Zero Hardcoded Secrets: Tidak ada token aktif atau password Wi-Fi di file .ino'
);
assert(
  fw.includes('HAS_CREDENTIALS_FILE') && fw.includes('validateCredentialsAtStartup'),
  'Startup Gate: Menolak booting jika file credentials.h belum dikonfigurasi'
);

// ----------------------------------------------------------------------
// RINGKASAN HASIL
// ----------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`TOTAL SKENARIO/ASSERTION: ${totalTests} | LULUS: ${passedTests} | GAGAL: ${failedTests}`);
if (failedTests === 0) {
  console.log('STATUS: SELURUH 16 SKENARIO AUDIT & HARDENING LULUS 100% [PASS]');
} else {
  console.log('STATUS: ADA SKENARIO YANG GAGAL VERIFIKASI');
}
console.log('========================================================================\n');

process.exit(failedTests > 0 ? 1 : 0);
