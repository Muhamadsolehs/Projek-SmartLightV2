/**
 * ============================================================================
 * SMART LIGHT TRAP IoT SYSTEM — ESP8266 NodeMCU FIRMWARE (FINAL HARDENED)
 * ============================================================================
 * Target Hardware    : ESP8266 NodeMCU (ESP-12E / ESP-12F Module)
 * Lokasi Operasional : Subang, Jawa Barat
 * Arsitektur         : 4-Channel Relay (Active LOW), HTTPS Supabase Edge Functions
 * 
 * PEMETAAN PIN RELAY AKTUAL (ESP8266 NodeMCU):
 * - Relay 1 : D1 / GPIO 5  -> Pompa Air Pengisi Baki Kuras
 * - Relay 2 : D2 / GPIO 4  -> Katup Solenoid Drain / Cadangan
 * - Relay 3 : D7 / GPIO 13 -> Lampu LED UV 365nm Penarik Serangga
 * - Relay 4 : D0 / GPIO 16 -> Kipas Blower / Beban Aux
 * 
 * LOGIKA OPERASIONAL RELAY (ACTIVE LOW):
 * - LOW  (0V)   = Relay ON  (Kontak COM terhubung ke NO / Beban Aktif)
 * - HIGH (3.3V) = Relay OFF (Kontak COM terhubung ke NC / Beban Mati)
 * - Safe Boot Sequence: Semua pin ditulis HIGH SEBELUM pinMode(OUTPUT) untuk
 *   mencegah relay clicking / berderik transien saat booting.
 * 
 * KONTRAK SUPABASE EDGE FUNCTIONS:
 * - GET  /device-command-poll : Mengambil antrean perintah (pending -> sent)
 * - POST /device-command-ack  : Mengirim konfirmasi fisik (completed / failed)
 * - POST /device-status       : Melaporkan status boot, heartbeat, & diagnostik
 * - POST /device-telemetry    : Telemetri lingkungan (HANYA jika sensor fisik terpasang)
 * ============================================================================
 */

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <time.h>

// ============================================================================
// 1. KREDENSIAL WI-FI & OTENTIKASI SUPABASE (ZERO LEAK ARCHITECTURE)
// ============================================================================
#if __has_include("credentials.h")
  #include "credentials.h"
  #define HAS_CREDENTIALS_FILE 1
#else
  #define HAS_CREDENTIALS_FILE 0
#endif

// Placeholder fallback aman untuk kompilasi (JANGAN simpan kredensial nyata di sini!)
// Firmware akan menolak booting jika HAS_CREDENTIALS_FILE == 0 atau nilai masih placeholder.
#ifndef WIFI_SSID
  #define WIFI_SSID "NAMA_WIFI_ANDA"
#endif
#ifndef WIFI_PASSWORD
  #define WIFI_PASSWORD "PASSWORD_WIFI_ANDA"
#endif
#ifndef DEVICE_CODE
  #define DEVICE_CODE "SLT-SBG-01"
#endif
#ifndef DEVICE_TOKEN
  #define DEVICE_TOKEN "GANTI_DENGAN_TOKEN_DEVICE_DARI_SUPABASE"
#endif
#ifndef SUPABASE_BASE_URL
  #define SUPABASE_BASE_URL "https://xzzjfwstrpayhnpymqpq.supabase.co/functions/v1"
#endif

// ============================================================================
// 2. METADATA PERANGKAT & URL ENDPOINTS
// ============================================================================
#define FIRMWARE_VERSION          "v2.7.0-esp8266-nodemcu"
#define HARDWARE_CHIP             "ESP8266_NodeMCU"
#define BAUDRATE                  115200

#define URL_COMMAND_POLL          SUPABASE_BASE_URL "/device-command-poll"
#define URL_COMMAND_ACK           SUPABASE_BASE_URL "/device-command-ack"
#define URL_DEVICE_STATUS         SUPABASE_BASE_URL "/device-status"
#define URL_DEVICE_TELEMETRY      SUPABASE_BASE_URL "/device-telemetry"

// ============================================================================
// 3. DEFINISI PIN PERANGKAT KERAS (ESP8266 NodeMCU)
// ============================================================================
#define PIN_RELAY_1               D1 // GPIO 5  - Pompa Pengisi Baki
#define PIN_RELAY_2               D2 // GPIO 4  - Katup Solenoid Drain
#define PIN_RELAY_3               D7 // GPIO 13 - Kipas Blower / Beban Aux
#define PIN_RELAY_4               D0 // GPIO 16 - Lampu LED Penarik Serangga UV
#define PIN_LED_BUILDIN           D4 // GPIO 2  - LED Internal NodeMCU (Active LOW)

#define RELAY_ACTIVE_LEVEL        LOW  // 0V = ON
#define RELAY_INACTIVE_LEVEL      HIGH // 3.3V = OFF
#define NUM_RELAYS                4

const uint8_t RELAY_PINS[NUM_RELAYS] = {
  PIN_RELAY_1,
  PIN_RELAY_2,
  PIN_RELAY_3,
  PIN_RELAY_4
};

const char* const RELAY_NAMES[NUM_RELAYS] = {
  "D1", "D2", "D7", "D0"
};

const char* const RELAY_LABELS[NUM_RELAYS] = {
  "Relay 1 (D1/GPIO5 - Pompa Baki)",
  "Relay 2 (D2/GPIO4 - Solenoid Drain)",
  "Relay 3 (D7/GPIO13 - Kipas / Aux)",
  "Relay 4 (D0/GPIO16 - Lampu LED UV)"
};

// ============================================================================
// 4. INTERVAL, TIMEOUT & AUDIT KESELAMATAN AKTUATOR
// ============================================================================
#define INTERVAL_POLL_COMMAND_MS  4000    // Polling antrean komando setiap 4 detik
#define INTERVAL_HEARTBEAT_MS     60000   // Lapor status / heartbeat setiap 60 detik
#define INTERVAL_WIFI_RETRY_MS    10000   // Verifikasi koneksi Wi-Fi setiap 10 detik
#define HTTP_CLIENT_TIMEOUT_MS    8000    // Timeout HTTPS 8 detik

// [CONFIG_REQUIRE_APPROVAL] Batas auto-cutoff 45 detik adalah batas proteksi waktu
// (time-based safeguard) default untuk mencegah motor pompa terbakar saat baki kosong.
#define SAFETY_PUMP_CUTOFF_ENABLED true
#define PUMP_AUTO_CUTOFF_LIMIT_MS 45000UL

// Durasi siklus kuras dan isi air baki (FORCE_WATER_CHANGE non-blocking)
// [CONFIG_REQUIRE_APPROVAL] Durasi kuras 5s dan isi 6s disesuaikan volume baki fisik.
#define WATER_DRAIN_DURATION_MS   5000UL
#define WATER_FILL_DURATION_MS    6000UL
#define WATER_INTERLOCK_DELAY_MS  1000UL // Jeda interlock sebelum pompa nyala

// Alokasi EEPROM untuk persistensi status, riwayat perintah & status ACK
#define EEPROM_ALLOC_SIZE         512
#define EEPROM_MAGIC_HEADER       0x534C5433 // "SLT3"
#define DEDUP_HISTORY_CAPACITY    8
#define EEPROM_RECORDS_TO_SAVE    8
#define EEPROM_RECORD_SIZE        57
#define EEPROM_DATA_OFFSET        8

// Kebijakan Telemetri: JANGAN kirim data dummy fiktif jika sensor fisik tidak ada
#define ENABLE_ENVIRONMENTAL_SENSORS false

// Mode Validasi TLS Produksi:
// true  = Menggunakan validasi Trust Anchor Root CA dengan sinkronisasi waktu NTP
// false = gSecureClient.setInsecure() untuk kemudahan pengujian pengembang lokal
#define USE_STRICT_TLS_VALIDATION true

// ============================================================================
// 5. ROOT CA CERTIFICATES (AUTHENTIC & FULL LENGTH)
// ============================================================================
// Sertifikat Root CA GlobalSign Root CA (Root penerbit sertifikat TLS Supabase Cloud) - Valid hingga 2028
const char GLOBALSIGN_ROOT_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDdTCCAl2gAwIBAgILBAAAAAABFUtaw5QwDQYJKoZIhvcNAQEFBQAwVzELMAkG
A1UEBhMCQkUxGTAXBgNVBAoTEEdsb2JhbFNpZ24gbnYtc2ExEDAOBgNVBAsTB1Jv
b3QgQ0ExGzAZBgNVBAMTEkdsb2JhbFNpZ24gUm9vdCBDQTAeFw05ODA5MDExMjAw
MDBaFw0yODAxMjgxMjAwMDBaMFcxCzAJBgNVBAYTAkJFMRkwFwYDVQQKExBHbG9i
YWxTaWduIG52LXNhMRAwDgYDVQQLEwdSb290IENBMRswGQYDVQQDExJHbG9iYWxT
aWduIFJvb3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDaDuaZ
jc6j40+Kfvvxi4Mla+pIH/EqsLmVEQS98GPR4mdmzxzdzxtIK+6NiY6arymAZavp
xy0Sy6scTHAHoT0KMM0VjU/43dSMUBUc71DuxC73/OlS8pF94G3VNTCOXkNz8kHp
1Wrjsok6Vjk4bwY8iGlbKk3Fp1S4bInMm/k8yuX9ifUSPJJ4ltbcdG6TRGHRjcdG
snUOhugZitVtbNV4FpWi6cgKOOvyJBNPc1STE4U6G7weNLWLBYy5d4ux2x8gkasJ
U26Qzns3dLlwR5EiUWMWea6xrkEmCMgZK9FGqkjWZCrXgzT/LCrBbBlDSgeF59N8
9iFo7+ryUp9/k5DPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8E
BTADAQH/MB0GA1UdDgQWBBRge2YaRQ2XyolQL30EzTSo//z9SzANBgkqhkiG9w0B
AQUFAAOCAQEA1nPnfE920I2/7LqivjTFKDK1fPxsnCwrvQmeU79rXqoRSLblCKOz
yj1hTdNGCbM+w6DjY1Ub8rrvrTnhQ7k4o+YviiY776BQVvnGCv04zcQLcFGUl5gE
38NflNUVyRRBnMRddWQVDf9VMOyGj/8N7yy5Y0b2qvzfvGn9LhJIZJrglfCm7ymP
AbEVtQwdpf5pLGkkeB6zpxxxYu7KyJesF12KwvhHhm4qxFYxldBniYUr+WymXUad
DKqC5JlR3XC321Y9YeRq4VzW9v493kHMB65jUr9TU/Qr6cf9tveCX4XSQRjbgbME
HMUfpIBvFSDJ3gyICh3WZlXi/EjJKSZp4A==
-----END CERTIFICATE-----
)EOF";

// Sertifikat Root CA Google Trust Services (GTS Root R1) - Valid hingga 2036
const char GTS_ROOT_R1_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQsw
CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU
MBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw
MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp
Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUA
A4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo
27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7w
Cl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjw
TcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0Pfybl
qAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaH
szVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8
Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmk
MiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92
wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70p
aDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrN
VjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQID
AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E
FgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibb
C5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEe
QkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuy
h6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM4
7HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8J
ZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6Ef
MgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/
Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT
6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ
0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm
2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bb
bP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c
-----END CERTIFICATE-----
)EOF";

// Sertifikat Root CA GlobalSign ECC Root CA - R4 - Valid hingga 2038
const char GLOBALSIGN_ECC_ROOT_R4_CA[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIB3DCCAYOgAwIBAgINAgPlfvU/k/2lCSGypjAKBggqhkjOPQQDAjBQMSQwIgYD
VQQLExtHbG9iYWxTaWduIEVDQyBSb290IENBIC0gUjQxEzARBgNVBAoTCkdsb2Jh
bFNpZ24xEzARBgNVBAMTCkdsb2JhbFNpZ24wHhcNMTIxMTEzMDAwMDAwWhcNMzgw
MTE5MDMxNDA3WjBQMSQwIgYDVQQLExtHbG9iYWxTaWduIEVDQyBSb290IENBIC0g
UjQxEzARBgNVBAoTCkdsb2JhbFNpZ24xEzARBgNVBAMTCkdsb2JhbFNpZ24wWTAT
BgcqhkjOPQIBBggqhkjOPQMBBwNCAAS4xnnTj2wlDp8uORkcA6SumuU5BwkWymOx
uYb4ilfBV85C+nOh92VC/x7BALJucw7/xyHlGKSq2XE/qNS5zowdo0IwQDAOBgNV
HQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUVLB7rUW44kB/
+wpu+74zyTyjhNUwCgYIKoZIzj0EAwIDRwAwRAIgIk90crlgr/HmnKAWBVBfw147
bmF0774BxL4YSFlhgjICICadVGNA3jdgUM/I2O2dgq43mLyjj0xMqTQrbO/7lZsm
-----END CERTIFICATE-----
)EOF";

// ============================================================================
// 6. STRUKTUR DATA: IDEMPOTENSI & DEDUPLIKASI COMMAND (RAM & EEPROM)
// ============================================================================
struct CommandRecord {
  char commandId[37];       // UUID 36 karakter + null terminator
  char status[12];          // "completed" atau "failed"
  int relay;                // 1..4 (atau 0 untuk instruksi global)
  char state[4];            // "ON", "OFF", atau ""
  bool gpioVerified;        // true jika digitalRead cocok
  uint8_t pinLevel;         // 0 (LOW) atau 1 (HIGH)
  uint32_t executedUptimeSec;
  bool ackConfirmed;        // true jika ACK berhasil dikonfirmasi server (HTTP 200/201/204/409)
  bool valid;
};

class CommandHistoryManager {
private:
  CommandRecord records[DEDUP_HISTORY_CAPACITY];
  int writeIndex = 0;
  int totalCount = 0;

public:
  CommandHistoryManager() {
    for (int i = 0; i < DEDUP_HISTORY_CAPACITY; i++) {
      records[i].valid = false;
      records[i].ackConfirmed = false;
      records[i].commandId[0] = '\0';
    }
  }

  void add(const char* id, const char* status, int relay = 0, const char* state = "", bool gpioVerified = false, uint8_t pinLevel = 1, bool ackConfirmed = false) {
    if (!id || strlen(id) == 0) return;
    
    CommandRecord& r = records[writeIndex];
    strncpy(r.commandId, id, sizeof(r.commandId) - 1);
    r.commandId[sizeof(r.commandId) - 1] = '\0';
    
    strncpy(r.status, status, sizeof(r.status) - 1);
    r.status[sizeof(r.status) - 1] = '\0';
    
    r.relay = relay;
    strncpy(r.state, state, sizeof(r.state) - 1);
    r.state[sizeof(r.state) - 1] = '\0';
    
    r.gpioVerified = gpioVerified;
    r.pinLevel = pinLevel;
    r.executedUptimeSec = millis() / 1000;
    r.ackConfirmed = ackConfirmed;
    r.valid = true;

    writeIndex = (writeIndex + 1) % DEDUP_HISTORY_CAPACITY;
    if (totalCount < DEDUP_HISTORY_CAPACITY) totalCount++;
  }

  int find(const char* id) const {
    if (!id || strlen(id) == 0) return -1;
    for (int i = 0; i < DEDUP_HISTORY_CAPACITY; i++) {
      if (records[i].valid && strcmp(records[i].commandId, id) == 0) {
        return i;
      }
    }
    return -1;
  }

  const CommandRecord* get(int index) const {
    if (index >= 0 && index < DEDUP_HISTORY_CAPACITY && records[index].valid) {
      return &records[index];
    }
    return nullptr;
  }

  int getActiveCount() const {
    return totalCount < DEDUP_HISTORY_CAPACITY ? totalCount : DEDUP_HISTORY_CAPACITY;
  }

  // Mengambil entri aktif terurut secara kronologis: chronIdx 0 (terlama) s.d. count-1 (terbaru)
  const CommandRecord* getChronological(int chronIdx) const {
    int n = getActiveCount();
    if (chronIdx < 0 || chronIdx >= n) return nullptr;
    int actualIdx = (writeIndex - n + chronIdx + DEDUP_HISTORY_CAPACITY) % DEDUP_HISTORY_CAPACITY;
    if (records[actualIdx].valid) {
      return &records[actualIdx];
    }
    return nullptr;
  }

  void markAckConfirmed(const char* id) {
    if (!id || strlen(id) == 0) return;
    for (int i = 0; i < DEDUP_HISTORY_CAPACITY; i++) {
      if (records[i].valid && strcmp(records[i].commandId, id) == 0) {
        records[i].ackConfirmed = true;
      }
    }
  }
};

// ============================================================================
// 7. STRUKTUR DATA: MULTI-SLOT ACK QUEUE DENGAN RETRY BACKOFF & DEAD-LETTER
// ============================================================================
#define ACK_QUEUE_CAPACITY        8
#define ACK_MAX_RETRIES           10

struct DeadLetterRecord {
  bool valid;
  char commandId[37];
  char status[12];
  char reason[64];
  uint32_t failUptimeSec;
};

struct AckItem {
  bool inUse;
  char commandId[37];
  char status[12];          // "completed" atau "failed"
  char message[128];
  int relay;
  char state[4];
  bool gpioVerified;
  uint8_t pinLevel;
  uint8_t retryCount;
  unsigned long nextRetryMillis;
  unsigned long createdAtMillis;
};

class AckQueueManager {
private:
  AckItem queue[ACK_QUEUE_CAPACITY];
  int count = 0;
  uint32_t deadLetterCount = 0;
  DeadLetterRecord lastDeadLetter;

public:
  AckQueueManager() {
    for (int i = 0; i < ACK_QUEUE_CAPACITY; i++) {
      queue[i].inUse = false;
    }
    lastDeadLetter.valid = false;
    lastDeadLetter.commandId[0] = '\0';
  }

  bool enqueue(const char* cmdId, const char* status, const char* msg, int relay = 0, const char* state = "", bool gpioVerified = false, uint8_t pinLevel = 1) {
    if (!cmdId || strlen(cmdId) == 0) return false;

    // Cek apakah command_id ini sudah ada di antrean
    for (int i = 0; i < ACK_QUEUE_CAPACITY; i++) {
      if (queue[i].inUse && strcmp(queue[i].commandId, cmdId) == 0) {
        // Perbarui data yang ada tanpa duplikasi slot
        strncpy(queue[i].status, status, sizeof(queue[i].status) - 1);
        queue[i].status[sizeof(queue[i].status) - 1] = '\0';
        strncpy(queue[i].message, msg, sizeof(queue[i].message) - 1);
        queue[i].message[sizeof(queue[i].message) - 1] = '\0';
        queue[i].relay = relay;
        strncpy(queue[i].state, state, sizeof(queue[i].state) - 1);
        queue[i].state[sizeof(queue[i].state) - 1] = '\0';
        queue[i].gpioVerified = gpioVerified;
        queue[i].pinLevel = pinLevel;
        return true;
      }
    }

    // Cari slot kosong
    for (int i = 0; i < ACK_QUEUE_CAPACITY; i++) {
      if (!queue[i].inUse) {
        AckItem& item = queue[i];
        item.inUse = true;
        strncpy(item.commandId, cmdId, sizeof(item.commandId) - 1);
        item.commandId[sizeof(item.commandId) - 1] = '\0';
        
        strncpy(item.status, status, sizeof(item.status) - 1);
        item.status[sizeof(item.status) - 1] = '\0';
        
        strncpy(item.message, msg, sizeof(item.message) - 1);
        item.message[sizeof(item.message) - 1] = '\0';
        
        item.relay = relay;
        strncpy(item.state, state, sizeof(item.state) - 1);
        item.state[sizeof(item.state) - 1] = '\0';
        
        item.gpioVerified = gpioVerified;
        item.pinLevel = pinLevel;
        item.retryCount = 0;
        item.nextRetryMillis = millis(); // Siap kirim segera
        item.createdAtMillis = millis();
        count++;
        return true;
      }
    }

    // Jika antrean penuh, JANGAN diam-diam menghapus tanpa jejak!
    Serial.printf("[ACK_QUEUE] PERINGATAN KRITIS: Antrean ACK penuh (%d/%d)! Memindahkan item tertua/retry terbanyak ke dead-letter...\n",
                  ACK_QUEUE_CAPACITY, ACK_QUEUE_CAPACITY);
    
    int evictIdx = 0;
    int maxRetries = -1;
    for (int i = 0; i < ACK_QUEUE_CAPACITY; i++) {
      if (queue[i].retryCount > maxRetries) {
        maxRetries = queue[i].retryCount;
        evictIdx = i;
      }
    }

    lastDeadLetter.valid = true;
    strncpy(lastDeadLetter.commandId, queue[evictIdx].commandId, sizeof(lastDeadLetter.commandId) - 1);
    lastDeadLetter.commandId[sizeof(lastDeadLetter.commandId) - 1] = '\0';
    strncpy(lastDeadLetter.status, queue[evictIdx].status, sizeof(lastDeadLetter.status) - 1);
    lastDeadLetter.status[sizeof(lastDeadLetter.status) - 1] = '\0';
    snprintf(lastDeadLetter.reason, sizeof(lastDeadLetter.reason), "Evicted: Queue overflow (%d slots full)", ACK_QUEUE_CAPACITY);
    lastDeadLetter.failUptimeSec = millis() / 1000;
    deadLetterCount++;

    AckItem& item = queue[evictIdx];
    item.inUse = true;
    strncpy(item.commandId, cmdId, sizeof(item.commandId) - 1);
    item.commandId[sizeof(item.commandId) - 1] = '\0';
    strncpy(item.status, status, sizeof(item.status) - 1);
    item.status[sizeof(item.status) - 1] = '\0';
    strncpy(item.message, msg, sizeof(item.message) - 1);
    item.message[sizeof(item.message) - 1] = '\0';
    item.relay = relay;
    strncpy(item.state, state, sizeof(item.state) - 1);
    item.state[sizeof(item.state) - 1] = '\0';
    item.gpioVerified = gpioVerified;
    item.pinLevel = pinLevel;
    item.retryCount = 0;
    item.nextRetryMillis = millis();
    item.createdAtMillis = millis();
    return true;
  }

  int getNextReadyIndex() {
    unsigned long now = millis();
    int bestIndex = -1;
    unsigned long oldestTime = 0xFFFFFFFF;

    for (int i = 0; i < ACK_QUEUE_CAPACITY; i++) {
      if (queue[i].inUse && now >= queue[i].nextRetryMillis) {
        if (queue[i].createdAtMillis < oldestTime) {
          oldestTime = queue[i].createdAtMillis;
          bestIndex = i;
        }
      }
    }
    return bestIndex;
  }

  AckItem* getItem(int index) {
    if (index >= 0 && index < ACK_QUEUE_CAPACITY && queue[index].inUse) {
      return &queue[index];
    }
    return nullptr;
  }

  void markSuccess(int index) {
    if (index >= 0 && index < ACK_QUEUE_CAPACITY && queue[index].inUse) {
      queue[index].inUse = false;
      count--;
    }
  }

  void retireAsDeadLetter(int index, const char* reason) {
    if (index >= 0 && index < ACK_QUEUE_CAPACITY && queue[index].inUse) {
      AckItem& it = queue[index];
      lastDeadLetter.valid = true;
      strncpy(lastDeadLetter.commandId, it.commandId, sizeof(lastDeadLetter.commandId) - 1);
      lastDeadLetter.commandId[sizeof(lastDeadLetter.commandId) - 1] = '\0';
      strncpy(lastDeadLetter.status, it.status, sizeof(lastDeadLetter.status) - 1);
      lastDeadLetter.status[sizeof(lastDeadLetter.status) - 1] = '\0';
      strncpy(lastDeadLetter.reason, reason, sizeof(lastDeadLetter.reason) - 1);
      lastDeadLetter.reason[sizeof(lastDeadLetter.reason) - 1] = '\0';
      lastDeadLetter.failUptimeSec = millis() / 1000;

      deadLetterCount++;
      it.inUse = false;
      count--;
      Serial.printf("[ACK_QUEUE] DEAD-LETTER: ACK untuk ID '%s' dipindahkan ke dead-letter (%s).\n",
                    it.commandId, reason);
    }
  }

  void markFailedAttempt(int index) {
    if (index >= 0 && index < ACK_QUEUE_CAPACITY && queue[index].inUse) {
      AckItem& it = queue[index];
      it.retryCount++;

      if (it.retryCount >= ACK_MAX_RETRIES) {
        retireAsDeadLetter(index, "Exceeded max retries (10x network/server failure)");
      } else {
        // Exponential backoff: 2s, 4s, 8s, 16s, 32s, maks 60s
        unsigned long backoffMs = 2000UL * (1UL << min((int)it.retryCount, 5));
        if (backoffMs > 60000UL) backoffMs = 60000UL;
        it.nextRetryMillis = millis() + backoffMs;
        Serial.printf("[ACK_QUEUE] Retry #%d untuk ID '%s' dijadwalkan dalam %lu ms.\n",
                      it.retryCount, it.commandId, backoffMs);
      }
    }
  }

  int getPendingCount() const { return count; }
  uint32_t getDeadLetterCount() const { return deadLetterCount; }
  const DeadLetterRecord* getLastDeadLetter() const {
    return lastDeadLetter.valid ? &lastDeadLetter : nullptr;
  }
};

// ============================================================================
// 8. VARIABEL GLOBAL SISTEM RUNTIME & NON-BLOCKING HYDRAULIC TASK
// ============================================================================
enum WaterChangeState {
  WC_IDLE,
  WC_DRAIN,
  WC_INTERLOCK,
  WC_FILL
};

struct WaterChangeTask {
  bool active;
  WaterChangeState state;
  unsigned long stageStartTime;
  char commandId[37];
};

bool gRelayStates[NUM_RELAYS] = { false, false, false, false };
unsigned long gPumpStartTime = 0;

unsigned long gLastPollTime = 0;
unsigned long gLastHeartbeatTime = 0;
unsigned long gLastWifiCheckTime = 0;
bool gNtpSynchronized = false;

CommandHistoryManager gCommandHistory;
AckQueueManager       gAckQueue;
WaterChangeTask       gWaterChangeTask = { false, WC_IDLE, 0, "" };

WiFiClientSecure gSecureClient;
HTTPClient       gHttpClient;
X509List         gTrustAnchors;

// ============================================================================
// 9. PROTOTIPE FUNGSI
// ============================================================================
bool validateCredentialsAtStartup();
void initHardwarePinsSafeBoot();
void initEEPROMStorage();
void saveCommandHistoryToEEPROM();
void loadCommandHistoryFromEEPROM();
void eepromWriteByteIfChanged(int addr, uint8_t val);
uint16_t calculateCRC16(int startAddr, int length);

void syncNtpTime();
void connectWifiNonBlocking();
void setRelayPhysical(int channelIndex, bool turnOn);
void emergencyShutdownAllRelays(const char* reason);
void updateWaterChangeStateMachine();
void abortWaterChange(const char* reason);

void pollSupabaseCommands();
void processCommand(JsonObject& cmd);
void executeSetRelay(const char* cmdId, int relayNum, const String& stateStr);
void executeToggleLamp(const char* cmdId);
void executeForceWaterChange(const char* cmdId);
void executeReboot(const char* cmdId);

int sendRawCommandAck(const AckItem& item);
void processPendingAckQueue();
void sendDeviceStatus(const char* eventType, const char* severity, const char* title, const char* message);
void printMaskedToken();

// ============================================================================
// 10. SETUP INITIALIZATION
// ============================================================================
void setup() {
  Serial.begin(BAUDRATE);
  delay(250);
  Serial.println();
  Serial.println(F("========================================================"));
  Serial.println(F(" SMART LIGHT TRAP IoT SYSTEM — ESP8266 NodeMCU"));
  Serial.println(F(" Firmware Version: " FIRMWARE_VERSION));
  Serial.println(F(" Hardware Target : " HARDWARE_CHIP));
  Serial.println(F(" Target Armada   : Subang, Jawa Barat"));
  Serial.println(F("========================================================"));

  // 1. Inisialisasi Pin Relay Fisik dengan Prosedur Safe Boot Anti-Clicking
  // Seluruh relay dijamin dalam kondisi OFF (Pin HIGH) dan tidak pernah aktif saat boot
  initHardwarePinsSafeBoot();

  // 2. Verifikasi Kredensial & Tolak Kredensial Placeholder / Fallback Terpapar
  if (!validateCredentialsAtStartup()) {
    Serial.println();
    Serial.println(F("********************************************************"));
    Serial.println(F(" [CRITICAL_SECURITY] KREDENSIAL BELUM DIKONFIGURASI!"));
    Serial.println(F(" Firmware menolak melanjutkan proses untuk mencegah kebocoran"));
    Serial.println(F(" otentikasi atau serangan unauthorized request ke Supabase."));
    Serial.println(F(""));
    Serial.println(F(" CARA MEMPERBAIKI:"));
    Serial.println(F(" 1. Salin 'credentials.example.h' menjadi 'credentials.h'"));
    Serial.println(F(" 2. Masukkan SSID dan Password Wi-Fi aktual Anda."));
    Serial.println(F(" 3. Buka Web Dashboard Smart Light Trap -> Device Management"));
    Serial.println(F(" 4. Salin Token resmi perangkat SLT-SBG-01 (bukan seed lama)"));
    Serial.println(F(" 5. Masukkan ke DEVICE_TOKEN lalu compile & upload ulang."));
    Serial.println(F("********************************************************"));

    // Masuk ke mode halt aman: LED berkedip cepat tanpa request jaringan apa pun
    while (true) {
      digitalWrite(PIN_LED_BUILDIN, !digitalRead(PIN_LED_BUILDIN));
      delay(300);
      yield();
      ESP.wdtFeed();
    }
  }

  // 3. Inisialisasi Memori Non-Volatile EEPROM & Pulihkan Riwayat Idempotensi
  initEEPROMStorage();

  // 4. Konfigurasi Klien TLS BearSSL dengan Root CA Otentik
  gTrustAnchors.append(GLOBALSIGN_ROOT_CA);
  gTrustAnchors.append(GTS_ROOT_R1_CA);
  gTrustAnchors.append(GLOBALSIGN_ECC_ROOT_R4_CA);

  #if USE_STRICT_TLS_VALIDATION
    gSecureClient.setTrustAnchors(&gTrustAnchors);
    Serial.println(F("[TLS] Mode Strict TLS: Menggunakan Root CA Valid (GlobalSign & GTS Root R1)."));
  #else
    gSecureClient.setInsecure();
    Serial.println(F("[TLS] PERINGATAN: setInsecure aktif untuk keperluan pengujian staging non-produksi."));
  #endif
  gSecureClient.setTimeout(HTTP_CLIENT_TIMEOUT_MS);

  // 5. Hubungkan ke Jaringan Wi-Fi
  connectWifiNonBlocking();

  // 6. Sinkronisasi Waktu NTP untuk Keabsahan Sertifikat TLS
  #if USE_STRICT_TLS_VALIDATION
    if (WiFi.status() == WL_CONNECTED) {
      syncNtpTime();
    }
  #endif

  // 7. Kirim Event BOOT ke Supabase /device-status
  if (WiFi.status() == WL_CONNECTED) {
    sendDeviceStatus(
      "BOOT",
      "info",
      "ESP8266 NodeMCU Startup",
      "Perangkat berhasil booting dengan seluruh 4 relay dalam status OFF (Pin HIGH / 3.3V)."
    );
  }

  Serial.println(F("[SYSTEM] Setup selesai. Memulai loop operasional..."));
}

// ============================================================================
// 11. LOOP UTAMA PERANGKAT
// ============================================================================
void loop() {
  yield();
  ESP.wdtFeed();

  unsigned long currentMillis = millis();

  // 1. Eksekusi Non-blocking State Machine untuk Siklus FORCE_WATER_CHANGE
  updateWaterChangeStateMachine();

  // 2. Pantau Status Koneksi Wi-Fi secara periodik
  if (currentMillis - gLastWifiCheckTime >= INTERVAL_WIFI_RETRY_MS) {
    gLastWifiCheckTime = currentMillis;
    if (WiFi.status() != WL_CONNECTED) {
      connectWifiNonBlocking();
    } else if (!gNtpSynchronized) {
      syncNtpTime();
    }
  }

  // 3. Proses dan Kirimkan Antrean ACK Tertunda (Multi-slot FIFO dengan Backoff)
  if (WiFi.status() == WL_CONNECTED && gAckQueue.getPendingCount() > 0) {
    processPendingAckQueue();
  }

  // 4. Polling Antrean Komando Supabase (/device-command-poll)
  if (currentMillis - gLastPollTime >= INTERVAL_POLL_COMMAND_MS) {
    gLastPollTime = currentMillis;
    if (WiFi.status() == WL_CONNECTED) {
      pollSupabaseCommands();
    }
  }

  // 5. Kirim Heartbeat & Diagnostik Sistem (/device-status)
  if (currentMillis - gLastHeartbeatTime >= INTERVAL_HEARTBEAT_MS) {
    gLastHeartbeatTime = currentMillis;
    if (WiFi.status() == WL_CONNECTED) {
      sendDeviceStatus(
        "DEVICE_RECOVERY",
        "info",
        "ESP8266 Heartbeat",
        "Heartbeat rutin diagnostik NodeMCU dan sinkronisasi status 4-channel relay."
      );
    }
  }

  // 6. Proteksi Keselamatan Auto-Cutoff Pompa (Relay 1): Maksimal 45 detik
  #if SAFETY_PUMP_CUTOFF_ENABLED
  if (gRelayStates[0] && gPumpStartTime > 0 && !gWaterChangeTask.active) {
    if (currentMillis - gPumpStartTime >= PUMP_AUTO_CUTOFF_LIMIT_MS) {
      Serial.println(F("\n[SAFETY] AUTO-CUTOFF: Pompa telah menyala melampaui batas batas aman (45s)! Mematikan Relay 1..."));
      setRelayPhysical(0, false);
      gPumpStartTime = 0;

      sendDeviceStatus(
        "DRY_RUN_LOCKOUT",
        "warning",
        "Proteksi Auto-Cutoff Pompa Aktif",
        "Pompa baki (Relay 1) dimatikan otomatis oleh firmware setelah batas timeout proteksi dry-run 45 detik."
      );
    }
  }
  #endif
}

// ============================================================================
// 12. VALIDASI KREDENSIAL PADA SAAT STARTUP (ZERO PLACEHOLDER & SEED TOLERANCE)
// ============================================================================
bool validateCredentialsAtStartup() {
  #if !HAS_CREDENTIALS_FILE
    Serial.println(F("[SECURITY] File 'credentials.h' tidak ditemukan di direktori firmware!"));
    return false;
  #endif

  const char* ssid = WIFI_SSID;
  const char* tok = DEVICE_TOKEN;

  if (!ssid || strlen(ssid) == 0 || strcmp(ssid, "NAMA_WIFI_ANDA") == 0 || strstr(ssid, "YOUR_") != nullptr) {
    Serial.println(F("[SECURITY] WIFI_SSID masih menggunakan nilai placeholder atau kosong!"));
    return false;
  }

  if (!tok || strlen(tok) < 16) {
    Serial.println(F("[SECURITY] DEVICE_TOKEN tidak valid atau kurang dari 16 karakter!"));
    return false;
  }

  if (strcmp(tok, "GANTI_DENGAN_TOKEN_DEVICE_DARI_SUPABASE") == 0 ||
      strstr(tok, "sbg01_secret") != nullptr || // Blokir keras seed token lama yang sudah terekspos
      strstr(tok, "CHANGE_ME") != nullptr ||
      strstr(tok, "YOUR_") != nullptr ||
      strstr(tok, "PLACEHOLDER") != nullptr) {
    Serial.println(F("[SECURITY] DEVICE_TOKEN masih placeholder atau menggunakan seed token lama yang dilarang!"));
    return false;
  }

  return true;
}

// ============================================================================
// 13. INISIALISASI HARDWARE (SAFE BOOT ANTI-CLICKING & ZERO ACTUATOR ON START)
// ============================================================================
void initHardwarePinsSafeBoot() {
  Serial.println(F("[HARDWARE] Menginisialisasi pin 4-channel relay (Active LOW)..."));

  // ATURAN KESELAMATAN AKTISAL:
  // Tulis nilai HIGH (3.3V) ke register SEBELUM memanggil pinMode(OUTPUT).
  // Mencegah kontak NO relay terhubung sesaat (glitch pulse) saat mikrokontroler boot.
  for (int i = 0; i < NUM_RELAYS; i++) {
    uint8_t pin = RELAY_PINS[i];
    digitalWrite(pin, RELAY_INACTIVE_LEVEL); // Pasang 3.3V (OFF)
    pinMode(pin, OUTPUT);                    // Pasang mode output
    digitalWrite(pin, RELAY_INACTIVE_LEVEL); // Pastikan tetap stabil di 3.3V
    gRelayStates[i] = false;
    Serial.printf("  -> %s: Inisialisasi OFF (Pin HIGH: 3.3V)\n", RELAY_LABELS[i]);
  }

  gPumpStartTime = 0;

  pinMode(PIN_LED_BUILDIN, OUTPUT);
  digitalWrite(PIN_LED_BUILDIN, HIGH); // LED Built-in OFF (Active LOW)
}

// ============================================================================
// 14. MEMORI NON-VOLATILE EEPROM (CRC-16, CHRONOLOGICAL DEDUP, WRITE-AVOIDANCE)
// ============================================================================
void eepromWriteByteIfChanged(int addr, uint8_t val) {
  if (addr >= 0 && addr < EEPROM_ALLOC_SIZE) {
    if (EEPROM.read(addr) != val) {
      EEPROM.write(addr, val);
    }
  }
}

uint16_t calculateCRC16(int startAddr, int length) {
  uint16_t crc = 0xFFFF;
  for (int i = 0; i < length; i++) {
    uint8_t data = EEPROM.read(startAddr + i);
    crc ^= ((uint16_t)data << 8);
    for (int j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return crc;
}

void initEEPROMStorage() {
  EEPROM.begin(EEPROM_ALLOC_SIZE);
  loadCommandHistoryFromEEPROM();
}

void saveCommandHistoryToEEPROM() {
  int n = gCommandHistory.getActiveCount();
  int numToSave = min(n, EEPROM_RECORDS_TO_SAVE);
  int baseAddr = EEPROM_DATA_OFFSET;
  int dataStart = baseAddr;

  for (int i = 0; i < EEPROM_RECORDS_TO_SAVE; i++) {
    const CommandRecord* rec = nullptr;
    if (i < numToSave) {
      // Ambil secara kronologis dari yang terlama ke yang terbaru
      int offset = n - numToSave;
      rec = gCommandHistory.getChronological(offset + i);
    }

    if (rec && rec->valid) {
      eepromWriteByteIfChanged(baseAddr++, 1); // Valid flag
      eepromWriteByteIfChanged(baseAddr++, rec->ackConfirmed ? 1 : 0); // ACK Confirmed flag
      
      // Tulis command_id (36 chars)
      for (int c = 0; c < 36; c++) {
        eepromWriteByteIfChanged(baseAddr++, (uint8_t)rec->commandId[c]);
      }
      // Tulis status ("completed" / "failed", 12 chars)
      for (int c = 0; c < 12; c++) {
        eepromWriteByteIfChanged(baseAddr++, (uint8_t)rec->status[c]);
      }
      eepromWriteByteIfChanged(baseAddr++, (uint8_t)rec->relay);
      for (int c = 0; c < 4; c++) {
        eepromWriteByteIfChanged(baseAddr++, (uint8_t)rec->state[c]);
      }
      eepromWriteByteIfChanged(baseAddr++, rec->gpioVerified ? 1 : 0);
      eepromWriteByteIfChanged(baseAddr++, rec->pinLevel);
    } else {
      eepromWriteByteIfChanged(baseAddr++, 0); // Invalid flag
      eepromWriteByteIfChanged(baseAddr++, 0);
      for (int c = 0; c < (36 + 12 + 1 + 4 + 1 + 1); c++) {
        eepromWriteByteIfChanged(baseAddr++, 0);
      }
    }
  }

  int dataLength = baseAddr - dataStart;
  uint16_t checksum = calculateCRC16(dataStart, dataLength);

  // Simpan Magic Header (Bytes 0..3)
  uint32_t magic = EEPROM_MAGIC_HEADER;
  for (int i = 0; i < 4; i++) {
    eepromWriteByteIfChanged(i, (magic >> (i * 8)) & 0xFF);
  }

  // Simpan CRC-16 Checksum (Bytes 4..5)
  eepromWriteByteIfChanged(4, (checksum >> 8) & 0xFF);
  eepromWriteByteIfChanged(5, checksum & 0xFF);

  // Simpan Metadata Jumlah Record & Flags (Bytes 6..7)
  eepromWriteByteIfChanged(6, (uint8_t)numToSave);
  eepromWriteByteIfChanged(7, 0x01);

  EEPROM.commit();
}

void loadCommandHistoryFromEEPROM() {
  uint32_t magic = 0;
  for (int i = 0; i < 4; i++) {
    magic |= ((uint32_t)EEPROM.read(i)) << (i * 8);
  }

  if (magic != EEPROM_MAGIC_HEADER) {
    Serial.println(F("[EEPROM] Magic header baru diinisialisasi (SLT3). Menyiapkan memori flash..."));
    return;
  }

  int baseAddr = EEPROM_DATA_OFFSET;
  int dataStart = baseAddr;
  int expectedLength = EEPROM_RECORDS_TO_SAVE * EEPROM_RECORD_SIZE;
  uint16_t storedChecksum = (((uint16_t)EEPROM.read(4)) << 8) | EEPROM.read(5);
  uint16_t computedChecksum = calculateCRC16(dataStart, expectedLength);

  if (storedChecksum != computedChecksum) {
    Serial.printf("[EEPROM] CRC-16 Checksum Mismatch (Flash korup)! Harap: 0x%04X, Dihitung: 0x%04X. Melewati pemulihan demi keselamatan.\n",
                  storedChecksum, computedChecksum);
    return;
  }

  int loadedCount = 0;
  int unconfirmedCount = 0;

  for (int i = 0; i < EEPROM_RECORDS_TO_SAVE; i++) {
    uint8_t valid = EEPROM.read(baseAddr++);
    uint8_t ackConf = EEPROM.read(baseAddr++);

    if (valid == 1) {
      char cmdId[37];
      for (int c = 0; c < 36; c++) cmdId[c] = (char)EEPROM.read(baseAddr++);
      cmdId[36] = '\0';

      char status[12];
      for (int c = 0; c < 12; c++) status[c] = (char)EEPROM.read(baseAddr++);
      status[11] = '\0';

      int relay = EEPROM.read(baseAddr++);

      char state[4];
      for (int c = 0; c < 4; c++) state[c] = (char)EEPROM.read(baseAddr++);
      state[3] = '\0';

      bool gpioVer = (EEPROM.read(baseAddr++) == 1);
      uint8_t pinLvl = EEPROM.read(baseAddr++);

      if (strlen(cmdId) >= 8) {
        bool isConfirmed = (ackConf == 1);
        gCommandHistory.add(cmdId, status, relay, state, gpioVer, pinLvl, isConfirmed);
        loadedCount++;

        // RECOVERY PEMULIHAN ACK TERTUNDA:
        // Jika perintah dieksekusi sebelum reboot namun ACK belum sempat dikonfirmasi oleh Supabase (ackConfirmed == false),
        // masukkan kembali ke antrean ACK RAM untuk ditransmisikan ulang begitu koneksi aktif!
        if (!isConfirmed) {
          unconfirmedCount++;
          Serial.printf("[RECOVERY] Memulihkan ACK tertunda dari flash untuk ID '%s' (Status: %s)...\n",
                        cmdId, status);
          gAckQueue.enqueue(cmdId, status, "ACK dipulihkan dari non-volatile EEPROM setelah reboot.",
                            relay, state, gpioVer, pinLvl);
        }
      }
    } else {
      baseAddr += (36 + 12 + 1 + 4 + 1 + 1);
    }
  }

  Serial.printf("[EEPROM] Berhasil memulihkan %d riwayat perintah kronologis (%d ACK tertunda dipulihkan ke antrean).\n",
                loadedCount, unconfirmedCount);
}

// ============================================================================
// 15. SINKRONISASI WAKTU NTP UNTUK TLS
// ============================================================================
void syncNtpTime() {
  Serial.println(F("[TLS] Menyinkronkan waktu sistem via NTP..."));
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
  time_t now = time(nullptr);
  int retry = 0;
  while (now < 1700000000 && retry < 15) {
    delay(300);
    Serial.print(F("."));
    now = time(nullptr);
    retry++;
    yield();
  }
  if (now >= 1700000000) {
    gNtpSynchronized = true;
    Serial.printf("\n[TLS] Waktu berhasil disinkronkan: %s", ctime(&now));
  } else {
    Serial.println(F("\n[TLS] Peringatan: NTP belum tersinkronisasi. Menunggu siklus berikutnya."));
  }
}

// ============================================================================
// 16. KONEKSI WI-FI NON-BLOCKING
// ============================================================================
void connectWifiNonBlocking() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WIFI] Menyambungkan ke SSID: '%s'...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 4000) {
    digitalWrite(PIN_LED_BUILDIN, !digitalRead(PIN_LED_BUILDIN));
    delay(200);
    Serial.print(F("."));
    yield();
    ESP.wdtFeed();
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(PIN_LED_BUILDIN, LOW); // LED ON menandakan koneksi stabil
    Serial.println();
    Serial.printf("[WIFI] Terhubung! IP Lokal: %s | RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    digitalWrite(PIN_LED_BUILDIN, HIGH);
    Serial.println(F("\n[WIFI] Belum terhubung. Menjadwalkan percobaan berikutnya..."));
  }
}

// ============================================================================
// 17. KENDALI FISIK RELAY & INTERLOCK KESELAMATAN HIDROLIK
// ============================================================================
void setRelayPhysical(int channelIndex, bool turnOn) {
  if (channelIndex < 0 || channelIndex >= NUM_RELAYS) return;

  // INTERLOCK HIDROLIK MUTLAK (HARD SAFETY INVARIANT):
  // Relay 1 (Pompa - GPIO 5) dan Relay 2 (Drain - GPIO 4) TIDAK PERNAH boleh aktif bersamaan!
  if (turnOn) {
    if (channelIndex == 0 && gRelayStates[1]) {
      Serial.println(F("[INTERLOCK] Mematikan Solenoid Drain sebelum mengaktifkan Pompa!"));
      digitalWrite(RELAY_PINS[1], RELAY_INACTIVE_LEVEL);
      gRelayStates[1] = false;
      delay(50);
    } else if (channelIndex == 1 && gRelayStates[0]) {
      Serial.println(F("[INTERLOCK] Mematikan Pompa Pengisi sebelum membuka Solenoid Drain!"));
      digitalWrite(RELAY_PINS[0], RELAY_INACTIVE_LEVEL);
      gRelayStates[0] = false;
      gPumpStartTime = 0;
      delay(50);
    }
  }

  uint8_t pin = RELAY_PINS[channelIndex];
  uint8_t level = turnOn ? RELAY_ACTIVE_LEVEL : RELAY_INACTIVE_LEVEL;
  digitalWrite(pin, level);
  gRelayStates[channelIndex] = turnOn;

  if (channelIndex == 0) {
    gPumpStartTime = turnOn ? millis() : 0;
  }

  Serial.printf("[RELAY] %s diset ke %s (Level GPIO: %s, 3.3V=%s)\n",
                RELAY_LABELS[channelIndex],
                turnOn ? "ON" : "OFF",
                turnOn ? "0V" : "3.3V",
                turnOn ? "Beban Aktif" : "Beban Mati");
}

void emergencyShutdownAllRelays(const char* reason) {
  Serial.printf("\n[EMERGENCY_STOP] Mematikan seluruh 4 relay segera! Alasan: %s\n", reason);
  for (int i = 0; i < NUM_RELAYS; i++) {
    digitalWrite(RELAY_PINS[i], RELAY_INACTIVE_LEVEL);
    gRelayStates[i] = false;
  }
  gPumpStartTime = 0;
}

// ============================================================================
// 18. NON-BLOCKING HYDRAULIC STATE MACHINE (FORCE_WATER_CHANGE)
// ============================================================================
void updateWaterChangeStateMachine() {
  if (!gWaterChangeTask.active) return;

  unsigned long elapsed = millis() - gWaterChangeTask.stageStartTime;

  switch (gWaterChangeTask.state) {
    case WC_DRAIN:
      if (elapsed >= WATER_DRAIN_DURATION_MS) {
        // Selesai drain, tutup katup solenoid (Relay 2 OFF)
        setRelayPhysical(1, false);
        Serial.println(F("[HYDRAULIC] Tahap 1/3 (Drain) selesai. Memulai jeda interlock keselamatan..."));
        gWaterChangeTask.state = WC_INTERLOCK;
        gWaterChangeTask.stageStartTime = millis();
      }
      break;

    case WC_INTERLOCK:
      if (elapsed >= WATER_INTERLOCK_DELAY_MS) {
        // Selesai jeda interlock, nyalakan pompa pengisi (Relay 1 ON)
        setRelayPhysical(1, false);
        setRelayPhysical(0, true);
        Serial.println(F("[HYDRAULIC] Tahap 2/3 (Interlock) selesai. Menyalakan Pompa Pengisi Baki (Relay 1 ON)..."));
        gWaterChangeTask.state = WC_FILL;
        gWaterChangeTask.stageStartTime = millis();
      }
      break;

    case WC_FILL:
      if (elapsed >= WATER_FILL_DURATION_MS) {
        // Selesai fill, matikan pompa pengisi (Relay 1 OFF)
        setRelayPhysical(0, false);
        Serial.println(F("[HYDRAULIC] Tahap 3/3 (Fill) selesai. Siklus kuras dan isi tuntas secara aman."));
        
        String msg = "Siklus kuras (5s), interlock (1s), dan isi air baki (6s) selesai berurutan (Non-blocking).";
        gCommandHistory.add(gWaterChangeTask.commandId, "completed", 0, "", true, 1, false);
        gAckQueue.enqueue(gWaterChangeTask.commandId, "completed", msg.c_str());
        saveCommandHistoryToEEPROM();

        gWaterChangeTask.active = false;
        gWaterChangeTask.state = WC_IDLE;
      }
      break;

    default:
      gWaterChangeTask.active = false;
      gWaterChangeTask.state = WC_IDLE;
      break;
  }
}

void abortWaterChange(const char* reason) {
  if (gWaterChangeTask.active) {
    Serial.printf("[HYDRAULIC] ABORT: Siklus FORCE_WATER_CHANGE dibatalkan demi keselamatan (%s)!\n", reason);
    setRelayPhysical(0, false); // Matikan pompa
    setRelayPhysical(1, false); // Tutup katup drain
    String failMsg = String("Siklus FORCE_WATER_CHANGE dibatalkan: ") + reason;
    gCommandHistory.add(gWaterChangeTask.commandId, "failed", 0, "", false, 1, false);
    gAckQueue.enqueue(gWaterChangeTask.commandId, "failed", failMsg.c_str());
    saveCommandHistoryToEEPROM();

    gWaterChangeTask.active = false;
    gWaterChangeTask.state = WC_IDLE;
  }
}

// ============================================================================
// 19. POLLING PERINTAH SUPABASE EDGE FUNCTIONS (/device-command-poll)
// ============================================================================
void pollSupabaseCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  #if USE_STRICT_TLS_VALIDATION
    if (!gNtpSynchronized) {
      return;
    }
  #endif

  if (!gHttpClient.begin(gSecureClient, URL_COMMAND_POLL)) return;

  gHttpClient.addHeader("Content-Type", "application/json");
  gHttpClient.addHeader("X-Device-Code", DEVICE_CODE);
  gHttpClient.addHeader("X-Device-Token", DEVICE_TOKEN);

  int httpCode = gHttpClient.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = gHttpClient.getString();
    DynamicJsonDocument doc(2048);
    DeserializationError err = deserializeJson(doc, payload);

    if (err) {
      Serial.printf("[JSON] Gagal mengurai respon polling: %s\n", err.c_str());
      gHttpClient.end();
      return;
    }

    bool hasCommand = doc["has_command"] | false;
    if (hasCommand) {
      JsonArray commands = doc["commands"].as<JsonArray>();
      Serial.printf("\n[QUEUE] Menerima %u perintah dari antrean Cloud Supabase:\n", commands.size());

      for (JsonObject cmd : commands) {
        processCommand(cmd);
      }
    }
  } else if (httpCode == 401) {
    Serial.println(F("[AUTH] 401 Unauthorized: Kredensial perangkat ditolak oleh Supabase!"));
  } else if (httpCode == 403) {
    Serial.println(F("[AUTH] 403 Forbidden: Perangkat dinonaktifkan di database (operational_status != active)."));
  } else if (httpCode > 0) {
    Serial.printf("[HTTPS] Polling perintah gagal. HTTP Status: %d\n", httpCode);
  } else {
    Serial.printf("[HTTPS] Kegagalan koneksi: %s\n", gHttpClient.errorToString(httpCode).c_str());
  }

  gHttpClient.end();
}

// ============================================================================
// 20. PEMROSESAN & IDEMPOTENSI PERINTAH
// ============================================================================
void processCommand(JsonObject& cmd) {
  const char* cmdId = cmd["command_id"];
  const char* cmdType = cmd["command_type"];

  // Validasi format dan integritas Command ID (UUID 36 karakter)
  if (!cmdId || !cmdType || strlen(cmdId) < 10 || strlen(cmdId) > 36) {
    Serial.println(F("[ERROR] Format perintah cacat: command_id atau command_type tidak valid."));
    return;
  }

  Serial.println(F("--------------------------------------------------------"));
  Serial.printf(" ID Perintah   : %s\n", cmdId);
  Serial.printf(" Tipe Perintah : %s\n", cmdType);

  // 1. Lapisan Idempotensi Firmware (Defense-in-depth):
  // Jika ID pernah dieksekusi sebelumnya, JANGAN sentuh aktuator kembali.
  // Kembalikan status asli yang tercatat di riwayat (completed atau failed).
  int historyIdx = gCommandHistory.find(cmdId);
  if (historyIdx >= 0) {
    const CommandRecord* rec = gCommandHistory.get(historyIdx);
    if (rec) {
      Serial.printf("[IDEMPOTENSI] ID '%s' sudah pernah dieksekusi sebelumnya dengan status '%s'.\n",
                    cmdId, rec->status);
      Serial.println(F("              Mencegah eksekusi ganda pada aktuator mekanik. Mengirim ulang ACK..."));
      
      String msg = String("Perintah telah diproses sebelumnya (Idempotent response). Status asli: ") + rec->status;
      gAckQueue.enqueue(cmdId, rec->status, msg.c_str(), rec->relay, rec->state, rec->gpioVerified, rec->pinLevel);
      return;
    }
  }

  // 2. Dispatcher Berdasarkan Tipe Perintah
  if (strcmp(cmdType, "SET_RELAY") == 0) {
    JsonObject params = cmd["parameters"].as<JsonObject>();
    int relayNum = params["relay"] | 0;
    String stateStr = params["state"] | "";

    executeSetRelay(cmdId, relayNum, stateStr);
  }
  else if (strcmp(cmdType, "TOGGLE_LAMP") == 0) {
    executeToggleLamp(cmdId);
  }
  else if (strcmp(cmdType, "FORCE_WATER_CHANGE") == 0) {
    executeForceWaterChange(cmdId);
  }
  else if (strcmp(cmdType, "REBOOT_ESP8266") == 0 || strcmp(cmdType, "REBOOT_ESP32") == 0) {
    executeReboot(cmdId);
  }
  else {
    Serial.printf("[ERROR] Tipe perintah '%s' tidak didukung oleh hardware NodeMCU.\n", cmdType);
    String failMsg = String("Tipe perintah tidak didukung: ") + cmdType;
    gCommandHistory.add(cmdId, "failed", 0, "", false, 1, false);
    gAckQueue.enqueue(cmdId, "failed", failMsg.c_str());
    saveCommandHistoryToEEPROM();
  }
}

// ============================================================================
// 21. DISPATCHER EKSEKUSI PERINTAH FISIK
// ============================================================================

// A. SET_RELAY: Mengendalikan Channel 1 s.d. 4 secara Individual
void executeSetRelay(const char* cmdId, int relayNum, const String& stateStr) {
  // Batalkan water change otomatis jika pengguna mengendalikan pompa atau drain secara manual
  if (relayNum == 1 || relayNum == 2) {
    abortWaterChange("Diinterupsi oleh instruksi manual SET_RELAY");
  }

  // Validasi rentang nomor channel relay (1 s.d. 4)
  if (relayNum < 1 || relayNum > NUM_RELAYS) {
    Serial.printf("[FAIL] Nomor relay %d di luar batas valid (1-4)!\n", relayNum);
    String err = String("Nomor channel relay tidak valid (1-4): ") + relayNum;
    gCommandHistory.add(cmdId, "failed", relayNum, "", false, 1, false);
    gAckQueue.enqueue(cmdId, "failed", err.c_str(), relayNum, "");
    saveCommandHistoryToEEPROM();
    return;
  }

  // Validasi parameter state: Wajib bernilai ON atau OFF
  bool turnOn = false;
  String finalState = "";

  if (stateStr.equalsIgnoreCase("ON") || stateStr.equalsIgnoreCase("true") || stateStr == "1") {
    turnOn = true;
    finalState = "ON";
  } else if (stateStr.equalsIgnoreCase("OFF") || stateStr.equalsIgnoreCase("false") || stateStr == "0") {
    turnOn = false;
    finalState = "OFF";
  } else {
    Serial.printf("[FAIL] Parameter state '%s' tidak valid!\n", stateStr.c_str());
    String err = String("Parameter state harus 'ON' atau 'OFF', diterima: ") + stateStr;
    gCommandHistory.add(cmdId, "failed", relayNum, "", false, 1, false);
    gAckQueue.enqueue(cmdId, "failed", err.c_str(), relayNum, "");
    saveCommandHistoryToEEPROM();
    return;
  }

  int channelIndex = relayNum - 1;
  setRelayPhysical(channelIndex, turnOn);

  // Verifikasi tingkat register output GPIO
  uint8_t pin = RELAY_PINS[channelIndex];
  int pinRead = digitalRead(pin);
  uint8_t expectedLevel = turnOn ? RELAY_ACTIVE_LEVEL : RELAY_INACTIVE_LEVEL;
  bool verified = (pinRead == expectedLevel);

  String msg = String("Relay ") + relayNum + " (" + RELAY_NAMES[channelIndex] + ") diatur ke " + finalState +
               ". Register: " + (pinRead == 0 ? "0V (LOW)" : "3.3V (HIGH)") +
               ". Status logis: " + finalState + ". Beban fisik: UNMONITORED (tanpa sensor arus).";

  gCommandHistory.add(cmdId, "completed", relayNum, finalState.c_str(), verified, pinRead, false);
  gAckQueue.enqueue(cmdId, "completed", msg.c_str(), relayNum, finalState.c_str(), verified, pinRead);
  saveCommandHistoryToEEPROM();
}

// B. TOGGLE_LAMP: Mengendalikan Relay 4 (Lampu LED UV 365nm)
void executeToggleLamp(const char* cmdId) {
  int channelIndex = 3; // Relay 4 (D0 / GPIO 16)
  bool nextState = !gRelayStates[channelIndex];
  setRelayPhysical(channelIndex, nextState);

  uint8_t pin = RELAY_PINS[channelIndex];
  int pinRead = digitalRead(pin);
  String finalState = nextState ? "ON" : "OFF";
  
  String msg = String("Lampu UV (Relay 4, GPIO16) diset ke ") + finalState +
               ". Register: " + (nextState ? "0V" : "3.3V") + ". Beban fisik: UNMONITORED.";

  gCommandHistory.add(cmdId, "completed", 4, finalState.c_str(), true, pinRead, false);
  gAckQueue.enqueue(cmdId, "completed", msg.c_str(), 4, finalState.c_str(), true, pinRead);
  saveCommandHistoryToEEPROM();
}

// C. FORCE_WATER_CHANGE: Kuras Baki (Relay 2) dan Isi Air (Relay 1) Non-Blocking
void executeForceWaterChange(const char* cmdId) {
  Serial.println(F("[HYDRAULIC] Memulai siklus non-blocking kuras dan isi air baki dengan interlock ketat..."));

  if (gWaterChangeTask.active) {
    Serial.println(F("[HYDRAULIC] Siklus FORCE_WATER_CHANGE sedang berjalan. Mengabaikan perintah baru."));
    String failMsg = "Siklus kuras air sedang berlangsung (Task busy).";
    gCommandHistory.add(cmdId, "failed", 0, "", false, 1, false);
    gAckQueue.enqueue(cmdId, "failed", failMsg.c_str());
    saveCommandHistoryToEEPROM();
    return;
  }

  // Mulai Tahap 1: Pastikan pompa OFF, buka katup solenoid drain (Relay 2 ON)
  setRelayPhysical(0, false);
  setRelayPhysical(1, true);

  gWaterChangeTask.active = true;
  gWaterChangeTask.state = WC_DRAIN;
  gWaterChangeTask.stageStartTime = millis();
  strncpy(gWaterChangeTask.commandId, cmdId, sizeof(gWaterChangeTask.commandId) - 1);
  gWaterChangeTask.commandId[sizeof(gWaterChangeTask.commandId) - 1] = '\0';
}

// D. REBOOT: Restart Mikrokontroler NodeMCU
void executeReboot(const char* cmdId) {
  Serial.println(F("[SYSTEM] Menerima instruksi Reboot. Mematikan relay, menyimpan riwayat dan mengirim ACK..."));
  
  abortWaterChange("Reboot sequence initiated");
  emergencyShutdownAllRelays("REBOOT_COMMAND");

  gCommandHistory.add(cmdId, "completed", 0, "", true, 1, false);
  saveCommandHistoryToEEPROM();

  AckItem rebootAck;
  rebootAck.inUse = true;
  strncpy(rebootAck.commandId, cmdId, sizeof(rebootAck.commandId) - 1);
  rebootAck.commandId[sizeof(rebootAck.commandId) - 1] = '\0';
  strncpy(rebootAck.status, "completed", sizeof(rebootAck.status) - 1);
  rebootAck.status[sizeof(rebootAck.status) - 1] = '\0';
  strncpy(rebootAck.message, "NodeMCU ESP8266 berhasil mereset ulang secara bersih.", sizeof(rebootAck.message) - 1);
  rebootAck.message[sizeof(rebootAck.message) - 1] = '\0';
  rebootAck.relay = 0;
  rebootAck.state[0] = '\0';
  rebootAck.gpioVerified = true;
  rebootAck.pinLevel = 1;

  sendRawCommandAck(rebootAck);

  Serial.println(F("[SYSTEM] Memulai soft restart ESP8266 dalam 500 ms..."));
  delay(500);
  ESP.restart();
}

// ============================================================================
// 22. PENGIRIMAN ACK (MULTI-SLOT QUEUE DENGAN BACKOFF & STATUS RESOLUTION)
// ============================================================================
int sendRawCommandAck(const AckItem& item) {
  if (WiFi.status() != WL_CONNECTED) {
    return 0;
  }

  #if USE_STRICT_TLS_VALIDATION
    if (!gNtpSynchronized) {
      return 0;
    }
  #endif

  if (!gHttpClient.begin(gSecureClient, URL_COMMAND_ACK)) {
    Serial.println(F("[ACK] Gagal menginisialisasi request HTTPS ke command-ack."));
    return 0;
  }

  gHttpClient.addHeader("Content-Type", "application/json");
  gHttpClient.addHeader("X-Device-Code", DEVICE_CODE);
  gHttpClient.addHeader("X-Device-Token", DEVICE_TOKEN);

  DynamicJsonDocument doc(1024);
  doc["command_id"] = item.commandId;
  doc["status"] = item.status;

  JsonObject result = doc.createNestedObject("result");
  result["message"] = item.message;
  result["executed_by"] = HARDWARE_CHIP;
  result["firmware"] = FIRMWARE_VERSION;
  result["timestamp_ms"] = millis();

  if (item.relay >= 1 && item.relay <= NUM_RELAYS) {
    int chIdx = item.relay - 1;
    result["relay"] = item.relay;
    result["relay_name"] = RELAY_NAMES[chIdx];
    result["state"] = item.state;
    result["gpio_pin"] = RELAY_PINS[chIdx];
    result["gpio_electrical_level"] = item.pinLevel;
    result["gpio_level_verified"] = item.gpioVerified;
    result["relay_logical_state"] = item.state;
    result["physical_load_feedback"] = "UNMONITORED";
    result["hardware_disclaimer"] = "digitalRead() hanya memverifikasi level logika GPIO register mikrokontroler. Tidak membuktikan beban fisik aktif tanpa sensor arus eksternal.";
  }

  if (strcmp(item.status, "failed") == 0) {
    doc["error_message"] = item.message;
  } else {
    doc["error_message"] = nullptr;
  }

  String payload;
  serializeJson(doc, payload);

  int code = gHttpClient.POST(payload);
  int outcome = 0;

  if (code == HTTP_CODE_OK || code == 201 || code == 204) {
    Serial.printf("[ACK] Berhasil mengonfirmasi status '%s' untuk komando %s (HTTP %d)\n",
                  item.status, item.commandId, code);
    gCommandHistory.markAckConfirmed(item.commandId);
    saveCommandHistoryToEEPROM();
    outcome = 1;
  } else if (code == 409) {
    Serial.printf("[ACK] Komando %s telah dikonfirmasi server sebelumnya (HTTP 409 Conflict/Idempotent resolved).\n",
                  item.commandId);
    gCommandHistory.markAckConfirmed(item.commandId);
    saveCommandHistoryToEEPROM();
    outcome = 1;
  } else if (code == 404) {
    Serial.printf("[ACK] Komando %s tidak ditemukan di server (HTTP 404). Dipindahkan ke dead-letter.\n",
                  item.commandId);
    outcome = -1;
  } else if (code == 401) {
    Serial.println(F("[AUTH] 401 Unauthorized: Kredensial perangkat ditolak oleh server saat kirim ACK!"));
    outcome = 0;
  } else if (code == 403) {
    Serial.println(F("[AUTH] 403 Forbidden: Perangkat telah dinonaktifkan di database (operational_status != active)."));
    outcome = 0;
  } else if (code > 0) {
    Serial.printf("[ACK] Gagal mengirim ACK ke Cloud (HTTP Code: %d)\n", code);
    outcome = 0;
  } else {
    Serial.printf("[ACK] Kegagalan jaringan/TLS: %s (Code: %d)\n", gHttpClient.errorToString(code).c_str(), code);
    outcome = 0;
  }

  gHttpClient.end();
  return outcome;
}

void processPendingAckQueue() {
  int readyIdx = gAckQueue.getNextReadyIndex();
  if (readyIdx < 0) return;

  AckItem* item = gAckQueue.getItem(readyIdx);
  if (!item) return;

  Serial.printf("[ACK_QUEUE] Memproses pengiriman ACK untuk komando '%s' (Status: %s)...\n",
                item->commandId, item->status);

  int outcome = sendRawCommandAck(*item);
  if (outcome == 1) {
    gAckQueue.markSuccess(readyIdx);
  } else if (outcome == -1) {
    gAckQueue.retireAsDeadLetter(readyIdx, "Server returned HTTP 404 (Command not found)");
  } else {
    gAckQueue.markFailedAttempt(readyIdx);
  }
}

// ============================================================================
// 23. STATUS PERANGKAT & DIAGNOSTIK HARDWARE (/device-status)
// ============================================================================
void sendDeviceStatus(const char* eventType, const char* severity, const char* title, const char* message) {
  if (WiFi.status() != WL_CONNECTED) return;

  #if USE_STRICT_TLS_VALIDATION
    if (!gNtpSynchronized) {
      return;
    }
  #endif

  if (!gHttpClient.begin(gSecureClient, URL_DEVICE_STATUS)) return;

  gHttpClient.addHeader("Content-Type", "application/json");
  gHttpClient.addHeader("X-Device-Code", DEVICE_CODE);
  gHttpClient.addHeader("X-Device-Token", DEVICE_TOKEN);

  DynamicJsonDocument doc(1536);
  doc["event_type"] = eventType;
  doc["severity"] = severity;
  doc["title"] = title;
  doc["message"] = message;

  JsonObject details = doc.createNestedObject("details");
  details["chip"] = HARDWARE_CHIP;
  details["firmware_version"] = FIRMWARE_VERSION;
  details["free_heap_bytes"] = ESP.getFreeHeap();
  details["uptime_seconds"] = millis() / 1000;
  details["wifi_rssi_dbm"] = WiFi.RSSI();
  details["ip_address"] = WiFi.localIP().toString();
  details["pending_acks_in_queue"] = gAckQueue.getPendingCount();
  details["dead_letter_acks_count"] = gAckQueue.getDeadLetterCount();

  const DeadLetterRecord* dl = gAckQueue.getLastDeadLetter();
  if (dl && dl->valid) {
    JsonObject dlo = details.createNestedObject("last_dead_letter");
    dlo["command_id"] = dl->commandId;
    dlo["status"] = dl->status;
    dlo["reason"] = dl->reason;
    dlo["fail_uptime_seconds"] = dl->failUptimeSec;
  }

  // Lampirkan status fisik keempat relay secara rinci dengan disklaimer teknis
  JsonObject relays = details.createNestedObject("relays");
  for (int i = 0; i < NUM_RELAYS; i++) {
    char key[12];
    snprintf(key, sizeof(key), "relay_%d", i + 1);
    JsonObject r = relays.createNestedObject(key);
    r["label"] = RELAY_LABELS[i];
    r["pin_name"] = RELAY_NAMES[i];
    r["gpio"] = RELAY_PINS[i];
    r["is_active"] = gRelayStates[i];
    r["logical_state"] = gRelayStates[i] ? "ON" : "OFF";
    r["gpio_pin_level"] = digitalRead(RELAY_PINS[i]);
    r["physical_load_feedback"] = "UNMONITORED";
  }

  String payload;
  serializeJson(doc, payload);

  int code = gHttpClient.POST(payload);
  if (code == HTTP_CODE_OK) {
    Serial.printf("[STATUS] Status event '%s' (%s) tersimpan di Supabase.\n", eventType, severity);
  } else if (code == 401) {
    Serial.println(F("[AUTH] 401 Unauthorized: Kredensial perangkat ditolak oleh Supabase!"));
    String resp = gHttpClient.getString();
    if (resp.length() > 0) {
      Serial.printf("[AUTH] Response: %s\n", resp.c_str());
    }
  } else if (code == 403) {
    Serial.println(F("[AUTH] 403 Forbidden: Perangkat telah dinonaktifkan di database (operational_status != active)."));
  } else if (code > 0) {
    Serial.printf("[STATUS] Gagal mengirim status. HTTP Code: %d\n", code);
  } else {
    Serial.printf("[STATUS] Kegagalan koneksi: %s\n", gHttpClient.errorToString(code).c_str());
  }

  gHttpClient.end();
}

// ============================================================================
// 24. KEAMANAN: CETAK TOKEN TERMASKIR (ZERO PLAINTEXT TOKEN IN SERIAL)
// ============================================================================
void printMaskedToken() {
  String token = String(DEVICE_TOKEN);
  if (token.length() <= 8) {
    Serial.print(F("********"));
  } else {
    Serial.print(token.substring(0, 4));
    Serial.print(F("****...[REDACTED]...****"));
    Serial.print(token.substring(token.length() - 4));
  }
}
