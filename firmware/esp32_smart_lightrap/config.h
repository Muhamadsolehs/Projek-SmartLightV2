/**
 * @file config.h
 * @brief Konfigurasi Pinout Perangkat Keras, 4-Channel Relay Active LOW, Jaringan, dan Otentikasi Supabase
 * @target ESP32 / ESP32-S3 Node
 * @location Subang, Jawa Barat
 *
 * ARSITEKTUR INTEGRASI:
 * - 4-Channel Relay Module (Active LOW: LOW = ON, HIGH = OFF)
 *   Relay 1: GPIO 12 (Pompa Pengisi Tandon)
 *   Relay 2: GPIO 14 (Katup Solenoid Drain / Cadangan)
 *   Relay 3: GPIO 27 (LED Penarik Serangga / UV Lamp)
 *   Relay 4: GPIO 26 (Auxiliary / Beban Tambahan)
 * - Safe Boot Sequence: digitalWrite(pin, RELAY_OFF) SEBELUM pinMode(pin, OUTPUT)
 *   Mencegah relay clicking/glitching saat startup dan melindungi MTDI strapping pin GPIO 12.
 * - Local WebServer port 80 untuk fallback LAN / pengujian lokal (/relay?nomor=X&aksi=on|off & /status).
 * - HTTPS Polling ke Supabase Edge Functions dengan header autentikasi X-Device-Code & X-Device-Token.
 * - NVS Flash Persistence via Preferences.h agar status relay tersimpan dan pulih saat restart.
 */

#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

#if __has_include("credentials.h")
  #include "credentials.h"
#endif

// ============================================================================
// 1. IDENTITAS PERANGKAT & OTENTIKASI KEAMANAN SUPABASE
// ============================================================================
// Kode perangkat unik yang terdaftar pada tabel 'devices' di Supabase
#ifndef DEVICE_CODE
#define DEVICE_CODE "SLT-SBG-01"
#endif

// Token otentikasi rahasia per-perangkat (Diverifikasi via SHA-256 hash di Edge Functions)
// JANGAN PERNAH menyimpan Supabase service_role key di firmware!
#ifndef DEVICE_TOKEN
#define DEVICE_TOKEN "slt_token_sbg01_secret_2026"
#endif

// Versi firmware rilis
#ifndef FIRMWARE_VERSION
#define FIRMWARE_VERSION "v2.4.0-relay-mesh"
#endif

// ============================================================================
// 2. KREDENSIAL JARINGAN (WI-FI)
// ============================================================================
#ifndef WIFI_SSID
#define WIFI_SSID     "Amj"
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "Alya123*"
#endif

// Wi-Fi Connection Timeout & Retry parameters
#define WIFI_CONNECT_TIMEOUT_MS 15000
#define WIFI_RECONNECT_INTERVAL_MS 10000

// ============================================================================
// 3. ENDPOINT SUPABASE EDGE FUNCTIONS (HTTPS)
// ============================================================================
#define SUPABASE_BASE_URL "https://nrskcmbnctpdxywhigtu.supabase.co/functions/v1"

#define URL_COMMAND_POLL  SUPABASE_BASE_URL "/device-command-poll"
#define URL_COMMAND_ACK   SUPABASE_BASE_URL "/device-command-ack"
#define URL_TELEMETRY     SUPABASE_BASE_URL "/device-telemetry"
#define URL_DEVICE_STATUS SUPABASE_BASE_URL "/device-status"
// ============================================================================
// 4. PEMETAAN PIN 4-CHANNEL RELAY (ACTIVE LOW)
// ============================================================================
/**
 * Logika Active LOW:
 * - LOW  (0V) = Relay ON  (Coil energised, kontak COM terhubung ke NO)
 * - HIGH (3V3) = Relay OFF (Coil de-energised, kontak COM terhubung ke NC)
 */
#define RELAY_ACTIVE_LEVEL   LOW
#define RELAY_INACTIVE_LEVEL HIGH

// Pin GPIO Relay sesuai spesifikasi fisik:
#define RELAY_1_PIN 12 // Channel 1: Pompa Submersible Pengisi Air
#define RELAY_2_PIN 14 // Channel 2: Katup Solenoid Drain Kuras Baki
#define RELAY_3_PIN 27 // Channel 3: Lampu LED Penarik Serangga Nokturnal (UV)
#define RELAY_4_PIN 26 // Channel 4: Auxiliary / Beban Eksternal Tambahan

#define NUM_RELAYS 4

// Label default channel untuk diagnostik web server lokal
const char* const RELAY_NAMES[NUM_RELAYS] = {
  "Relay 1 (GPIO 12 - Pompa)",
  "Relay 2 (GPIO 14 - Solenoid)",
  "Relay 3 (GPIO 27 - LED UV)",
  "Relay 4 (GPIO 26 - Auxiliary)"
};

// ============================================================================
// 5. WEB SERVER LOKAL & DIAGNOSTIK
// ============================================================================
#define ENABLE_LOCAL_WEB_SERVER true
#define LOCAL_WEB_SERVER_PORT   80

// ============================================================================
// 6. PERSISTENSI NVS FLASH (PREFERENCES)
// ============================================================================
#define NVS_NAMESPACE "slt_relays"

// Jika false: boot selalu dalam keadaan OFF demi keselamatan aktuator mekanik.
// Jika true : muat status relay terakhir yang tersimpan di NVS flash saat boot.
#define RESTORE_RELAY_STATE_ON_BOOT false

// ============================================================================
// 7. SENSOR TAMBAHAN & PINOUT I2C
// ============================================================================
#define PIN_I2C_SDA 21
#define PIN_I2C_SCL 22
#define INA226_I2C_ADDRESS 0x40

#define PIN_JSN_TRIG 19
#define PIN_JSN_ECHO 18
#define PIN_TURBIDITY_ADC 34
#define PIN_LED_STATUS 2

// ============================================================================
// 8. INTERVAL WAKTU OPERASIONAL (MILLISECONDS)
// ============================================================================
#define COMMAND_POLL_INTERVAL_MS 4000   // Polling antrean perintah setiap 4 detik
#define TELEMETRY_INTERVAL_MS    60000  // Kirim telemetri & status relay setiap 60 detik
#define HEARTBEAT_INTERVAL_MS    30000  // Heartbeat ke backend setiap 30 detik

// ============================================================================
// 9. VALIDASI SERTIFIKAT SSL/TLS (ROOT CA)
// ============================================================================
// Atur true untuk mengaktifkan verifikasi Root CA Certificate resmi Supabase
// (Let's Encrypt ISRG Root X1). Jika sertifikat belum ditanam, gunakan false.
#define USE_SSL_CERT_VALIDATION false

#if USE_SSL_CERT_VALIDATION
// ISRG Root X1 Certificate (Valid hingga 2035)
const char* const SUPABASE_ROOT_CA =
"-----BEGIN CERTIFICATE-----\n"
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n"
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n"
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n"
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n"
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n"
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc\n"
"h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+\n"
"0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U\n"
"A5/TR5d8S5JlCd893/y8eoiEl5kwucPQOH239gDA57HFe5CP9IFFoVxqhmDFv89w\n"
"JhVGyZCG0Z65cxSRPnGdX1150lJB55G91bNBs5gUgli8AhHT07qY+dlLcd/ykEJa\n"
"mwfwaa5gdyWvhccSQ8nj+U5tJhKKkcNa24ohLnKAwc8XzIBVMK+DsPU5ZwYZoAZf\n"
"HCGZ0cgGTFS9RJSXq288pTaPRtSp3YQUU+OOVFR6Idsr9jdGTz2SfZ8VeMG0hGSk\n"
"AHHI28k9U3iwKYxEj65RqwdUaAPRE55Pn69tFi0aW6EhnWA7v7mAypTQ186O8KmM\n"
"l8URLa+DH+AZMWitrAgWBNCJWflDNdc3++XRULuhCEqwcIpObmlBB+BlUseMxri3\n"
"CQUNXQbG6s9AthmzDTMHvn479U5xZsUFUKhmDf4mVj1TxjuYTlkCTHZa5L9LTWUP\n"
"qW01l59S3trpei55ZzCAerjaOmJWXdBaU1DT9iDu8AOxpwWYT64UTnIj57g5UTaf\n"
"DyqNwC3a6SxATGODVCdH52VbAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV\n"
"HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAjGiBpFo5aoAzANBgkq\n"
"hkiG9w0BAQsFAAOCAgEAVR9Yqbyhurdt4XdmiCEzYNUPb10a1netFzyfbBV49/88\n"
"TrXZNmY/78Y5vtnTXgVVQgk954mlBiYDNQnzNeQKAOptBIAzWHRacdV7UhrIez+q\n"
"tK5bExXdQzOh52U42Wprotection/yErnvAelwPgEB4A4vdRReTA880lfVoHXRW4\n"
"dGobtx6SpyeyDXvNz5RHtdfy6SDgkR454Tr37Sm4KE4SShSr4wU5QSZL78n79gU=\n"
"-----END CERTIFICATE-----\n";
#endif

#endif // CONFIG_H
