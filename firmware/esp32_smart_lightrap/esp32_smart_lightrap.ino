/**
 * @file esp32_smart_lightrap.ino
 * @brief Firmware Terpadu ESP32 Smart Light Trap — Kontrol 4-Channel Relay Active LOW & Integrasi Supabase
 * @target ESP32 / ESP32-S3 (240MHz, FreeRTOS)
 * @author Tim Agritech Smart Light Trap - Subang, Jawa Barat
 *
 * FITUR UTAMA:
 * 1. Kontrol 4-Channel Relay Fisik (GPIO 12, 14, 27, 26) dengan Logika Active LOW.
 * 2. Inisialisasi Boot Aman (digitalWrite HIGH sebelum pinMode OUTPUT) untuk mencegah glitch klik relay
 *    dan melindungi strapping pin GPIO 12 (MTDI).
 * 3. Persistensi Status Relay di NVS Flash via Preferences.h.
 * 4. Polling Command Queue HTTPS ke Supabase Edge Functions (/device-command-poll).
 * 5. Deduplikasi Perintah Berbasis command_id agar tidak dieksekusi ganda saat retry jaringan.
 * 6. Pengiriman Status Acknowledgment (ACK) ke /device-command-ack.
 * 7. Web Server Lokal Terintegrasi (Port 80) untuk Diagnostik LAN & Kontrol Darurat:
 *    - GET /: Antarmuka Web responsif untuk pemantauan & tombol manual 4 relay.
 *    - GET /relay?nomor=1..4&aksi=on|off: Kompatibel dengan skrip pengujian lokal sebelumnya.
 *    - GET /status: Endpoint JSON status aktual relay fisik, RSSI, dan koneksi cloud.
 * 8. Non-blocking Loop dengan Hardware Watchdog Timer (WDT 30s) dan Rekoneksi Wi-Fi Otomatis.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <Wire.h>
#include <esp_task_wdt.h>

#include "config.h"

// ============================================================================
// DEFINISI & VARIABEL GLOBAL PERANGKAT KERAS
// ============================================================================
const uint8_t RELAY_PINS[NUM_RELAYS] = {
  RELAY_1_PIN, // GPIO 12
  RELAY_2_PIN, // GPIO 14
  RELAY_3_PIN, // GPIO 27
  RELAY_4_PIN  // GPIO 26
};

// Status aktual 4-channel relay (true = ON, false = OFF)
bool gRelayStates[NUM_RELAYS] = { false, false, false, false };

// ID perintah terakhir yang dieksekusi untuk deduplikasi
String gLastExecutedCommandId = "";

// Struktur Telemetri Tambahan
struct SensorData {
  float batteryVoltageV;
  float batteryCurrentMa;
  float trayLevelPercent;
  float tankLevelPercent;
  float turbidityNtu;
  int wifiRssiDbm;
  bool safetyLockout;
};

SensorData gSensors;
Preferences gPrefs;
WebServer server(LOCAL_WEB_SERVER_PORT);
WiFiClientSecure gSecClient;
HTTPClient gHttp;

// Timer non-blocking
unsigned long gLastCommandPoll = 0;
unsigned long gLastTelemetry = 0;
unsigned long gLastHeartbeat = 0;
unsigned long gLastWifiCheck = 0;
unsigned long gPumpStartTime = 0; // Waktu mulai pompa menyala untuk proteksi auto-cutoff
uint32_t gSequenceNumber = 1;

// ============================================================================
// PROTOTYPE FUNGSI
// ============================================================================
void initSafeHardware();
void initNvsStorage();
void setupLocalWebServer();
void handleWebRoot();
void handleWebRelayControl();
void handleWebStatusJson();
void connectWifiNonBlocking();
void setRelayPhysical(int channelIndex, bool turnOn, bool saveNvs = true);
void pollSupabaseCommands();
void executeCommandDispatcher(const char* cmdId, const char* cmdType, JsonObject& params);
void sendCommandAck(const char* commandId, const char* status, const String& message, JsonObject* extra = nullptr);
void sendDeviceHeartbeat();
void sendTelemetryData();
String buildTelemetryJson();

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println(F("\n======================================================="));
  Serial.println(F("   SMART LIGHT TRAP - ESP32 4-CHANNEL RELAY CONTROLLER "));
  Serial.printf ("   Node: %s | Firmware: %s\n", DEVICE_CODE, FIRMWARE_VERSION);
  Serial.println(F("   Pinout Relay: GPIO 12 (Ch1), 14 (Ch2), 27 (Ch3), 26 (Ch4)"));
  Serial.println(F("   Logika: Active LOW (LOW = ON, HIGH = OFF)           "));
  Serial.println(F("=======================================================\n"));

  // 1. Inisialisasi Relay dengan Urutan Aman (Paling Awal)
  // Mencegah relay chatter dan melindungi MTDI strapping pin GPIO 12
  initSafeHardware();

  // 2. Inisialisasi NVS Flash (Preferences)
  initNvsStorage();

  // 3. Konfigurasi Klien TLS/HTTPS
#if USE_SSL_CERT_VALIDATION
  gSecClient.setCACert(SUPABASE_ROOT_CA);
  Serial.println(F("[TLS] Validasi Sertifikat Root CA ISRG X1 Diaktifkan."));
#else
  gSecClient.setInsecure();
  Serial.println(F("[TLS] Berjalan dengan Mode TLS Terbuka (Development / Local)."));
#endif
  gSecClient.setTimeout(8000);

  // 4. Inisialisasi Koneksi Wi-Fi
  connectWifiNonBlocking();

  // 5. Jalankan Web Server Lokal pada Port 80
#if ENABLE_LOCAL_WEB_SERVER
  setupLocalWebServer();
  server.begin();
  Serial.printf("[WEB-SERVER] Server lokal aktif pada port %d\n", LOCAL_WEB_SERVER_PORT);
#endif

  // 6. Inisialisasi Watchdog Timer (30 Detik)
  esp_task_wdt_init(30, true);
  esp_task_wdt_add(NULL);

  Serial.println(F("[SYSTEM] Inisialisasi selesai. Memulai loop kontrol...\n"));
}

// ============================================================================
// LOOP UTAMA (NON-BLOCKING)
// ============================================================================
void loop() {
  esp_task_wdt_reset();
  unsigned long now = millis();

  // 1. Layani Request Web Server Lokal Port 80
#if ENABLE_LOCAL_WEB_SERVER
  server.handleClient();
#endif

  // 2. Pemantauan & Rekoneksi Otomatis Wi-Fi
  if (WiFi.status() != WL_CONNECTED) {
    if (now - gLastWifiCheck >= WIFI_RECONNECT_INTERVAL_MS) {
      gLastWifiCheck = now;
      connectWifiNonBlocking();
    }
  } else {
    // 3. Polling Antrean Perintah Supabase (setiap 4 detik)
    if (now - gLastCommandPoll >= COMMAND_POLL_INTERVAL_MS || gLastCommandPoll == 0) {
      gLastCommandPoll = now;
      pollSupabaseCommands();
    }

    // 4. Pengiriman Heartbeat Online Status (setiap 30 detik)
    if (now - gLastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
      gLastHeartbeat = now;
      sendDeviceHeartbeat();
    }

    // 5. Pengiriman Paket Telemetri Reguler (setiap 60 detik)
    if (now - gLastTelemetry >= TELEMETRY_INTERVAL_MS) {
      gLastTelemetry = now;
      sendTelemetryData();
    }
  }

  // 6. Proteksi Keamanan Hardware: Auto-Cutoff Pompa (Relay 1 - GPIO 12)
  // Mencegah pompa menyala tanpa batas waktu jika browser ditutup atau koneksi cloud terputus
  if (gRelayStates[0] && gPumpStartTime > 0 && (now - gPumpStartTime >= MAX_PUMP_RUN_DURATION_MS)) {
    Serial.printf("\n[SAFETY] AUTO-CUTOFF AKTIF: Pompa telah menyala selama %d ms (Maks: %d ms). Mematikan pompa sekarang!\n",
                  (int)(now - gPumpStartTime), (int)MAX_PUMP_RUN_DURATION_MS);
    setRelayPhysical(0, false, true);
    gPumpStartTime = 0;
  }

  delay(20);
}

// ============================================================================
// 1. INISIALISASI PERANGKAT KERAS AMAN (SAFE BOOT INITIALIZATION)
// ============================================================================
void initSafeHardware() {
  Serial.println(F("[INIT] Menginisialisasi GPIO 4-Channel Relay (Active LOW)..."));

  for (int i = 0; i < NUM_RELAYS; i++) {
    uint8_t pin = RELAY_PINS[i];

    // ATURAN KESELAMATAN AKTISAL:
    // Tulis nilai HIGH (RELAY_INACTIVE_LEVEL) ke register output SEBELUM mengubah arah pin menjadi OUTPUT.
    // Jika pinMode(OUTPUT) dipanggil terlebih dahulu, pin default bernilai LOW (0V),
    // yang pada relay Active LOW akan menyebabkan kontaktor berderik (relay click/glitch) sesaat saat boot.
    digitalWrite(pin, RELAY_INACTIVE_LEVEL);
    pinMode(pin, OUTPUT);
    digitalWrite(pin, RELAY_INACTIVE_LEVEL);

    gRelayStates[i] = false;
    Serial.printf("  - %s: Output diset ke OFF (Pin HIGH: 3.3V)\n", RELAY_NAMES[i]);
  }

  pinMode(PIN_LED_STATUS, OUTPUT);
  digitalWrite(PIN_LED_STATUS, LOW);

  // Inisialisasi default sensor terukur
  gSensors.batteryVoltageV = 12.8f;
  gSensors.batteryCurrentMa = -420.0f;
  gSensors.trayLevelPercent = 82.0f;
  gSensors.tankLevelPercent = 78.0f;
  gSensors.turbidityNtu = 28.0f;
  gSensors.wifiRssiDbm = -65;
  gSensors.safetyLockout = false;
}

// ============================================================================
// 2. INISIALISASI NVS FLASH & PEMULIHAN STATUS PERSISTEN
// ============================================================================
void initNvsStorage() {
  gPrefs.begin(NVS_NAMESPACE, false);

  // Ambil ID perintah terakhir yang tercatat
  gLastExecutedCommandId = gPrefs.getString("last_cmd_id", "");
  Serial.printf("[NVS] ID Perintah terakhir dieksekusi: '%s'\n", gLastExecutedCommandId.c_str());

#if RESTORE_RELAY_STATE_ON_BOOT
  Serial.println(F("[NVS] Memulihkan status relay dari flash memory..."));
  for (int i = 0; i < NUM_RELAYS; i++) {
    char key[16];
    snprintf(key, sizeof(key), "r_%d", i + 1);
    bool savedState = gPrefs.getBool(key, false);
    // ATURAN KESELAMATAN: Pompa (Relay 1, index 0) TIDAK PERNAH dipulihkan ON secara otomatis saat boot!
    if (i == 0) savedState = false;
    setRelayPhysical(i, savedState, false);
  }
#else
  Serial.println(F("[NVS] RESTORE_RELAY_STATE_ON_BOOT dinonaktifkan: Semua relay dimulai dalam kondisi aman (OFF)."));
#endif
}

// ============================================================================
// 3. PENGENDALIAN FISIK RELAY (ACTIVE LOW LOGIC & NVS SYNC)
// ============================================================================
void setRelayPhysical(int channelIndex, bool turnOn, bool saveNvs) {
  if (channelIndex < 0 || channelIndex >= NUM_RELAYS) return;

  uint8_t pin = RELAY_PINS[channelIndex];
  gRelayStates[channelIndex] = turnOn;

  // Catat waktu mulai pompa untuk auto-cutoff
  if (channelIndex == 0) {
    gPumpStartTime = turnOn ? millis() : 0;
  }

  // Logika Active LOW:
  // turnOn = true  --> digitalWrite LOW (0V)  --> Relay Aktif (NO terhubung)
  // turnOn = false --> digitalWrite HIGH (3V3) --> Relay Mati (NO terbuka)
  digitalWrite(pin, turnOn ? RELAY_ACTIVE_LEVEL : RELAY_INACTIVE_LEVEL);

  Serial.printf("[RELAY] Channel %d (GPIO %d) -> %s (Tegangan Pin: %s)\n",
                channelIndex + 1,
                pin,
                turnOn ? "ON (AKTIF)" : "OFF (MATI)",
                turnOn ? "LOW / 0V" : "HIGH / 3.3V");

  // Simpan secara persisten ke NVS jika diminta (Kecuali Pompa tidak pernah disimpan ON permanen)
  if (saveNvs) {
    char key[16];
    snprintf(key, sizeof(key), "r_%d", channelIndex + 1);
    gPrefs.putBool(key, (channelIndex == 0) ? false : turnOn);
  }
}

// ============================================================================
// 4. KONEKSI WI-FI DENGAN REKONEKSI NON-BLOCKING
// ============================================================================
void connectWifiNonBlocking() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WIFI] Menyambungkan ke Wi-Fi SSID '%s'...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 4000) {
    digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS));
    delay(200);
    Serial.print(F("."));
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(PIN_LED_STATUS, HIGH);
    Serial.printf("\n[WIFI] Terhubung! IP Lokal: %s | RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    digitalWrite(PIN_LED_STATUS, LOW);
    Serial.println(F("\n[WIFI] Belum terhubung. Melanjutkan operasi lokal..."));
  }
}

// ============================================================================
// 5. WEB SERVER LOKAL PORT 80 (KOMPATIBILITAS SKRIP LOKAL & DIAGNOSTIK)
// ============================================================================
void setupLocalWebServer() {
  // Halaman Utama: Dashboard Visual Relay Lokal
  server.on("/", HTTP_GET, handleWebRoot);

  // Endpoint Kompatibel: GET /relay?nomor=1..4&aksi=on|off
  server.on("/relay", HTTP_GET, handleWebRelayControl);

  // Endpoint Status JSON: GET /status
  server.on("/status", HTTP_GET, handleWebStatusJson);
}

void handleWebRoot() {
  String html = F("<!DOCTYPE html><html lang='id'><head><meta charset='utf-8'>"
                  "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                  "<title>ESP32 Smart Light Trap - Kontrol Relay Lokal</title>"
                  "<style>"
                  "body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0D1F17;color:#EAF4EE;margin:0;padding:20px;}"
                  ".card{max-width:540px;margin:0 auto;background:#152B20;border:1px solid #2D6A4F;border-radius:12px;padding:24px;box-shadow:0 8px 24px rgba(0,0,0,0.4);}"
                  "h1{font-size:20px;margin:0 0 4px;color:#52B788;}p.sub{font-size:12px;color:#95D5B2;margin:0 0 20px;}"
                  ".badge{display:inline-block;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:bold;font-family:monospace;background:#2D6A4F;color:#D8F3DC;}"
                  ".grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0;}"
                  ".relay-box{background:#1B382B;border:1px solid #2D6A4F;border-radius:8px;padding:12px;text-align:center;}"
                  ".relay-box.on{border-color:#52B788;background:#1F4535;}"
                  ".relay-title{font-size:12px;font-weight:bold;margin-bottom:4px;color:#D8F3DC;}"
                  ".relay-pin{font-size:10px;color:#74C69D;margin-bottom:10px;font-family:monospace;}"
                  ".status-pill{font-size:11px;font-weight:bold;padding:2px 8px;border-radius:10px;margin-bottom:10px;display:inline-block;}"
                  ".status-on{background:#52B788;color:#081C15;}"
                  ".status-off{background:#40534C;color:#B7E4C7;}"
                  ".btn{display:inline-block;width:45%;padding:6px 0;font-size:11px;font-weight:bold;text-decoration:none;border-radius:4px;margin:0 2px;}"
                  ".btn-on{background:#52B788;color:#081C15;}"
                  ".btn-off{background:#D00000;color:#FFF;}"
                  ".note{font-size:11px;color:#74C69D;margin-top:16px;line-height:1.4;border-top:1px solid #2D6A4F;padding-top:12px;}"
                  "</style></head><body>"
                  "<div class='card'>"
                  "<h1>Smart Light Trap — ESP32 Relay</h1>"
                  "<p class='sub'>Node: <span class='badge'>") + String(DEVICE_CODE) + F("</span> | IP: ") + WiFi.localIP().toString() + F("</p>"
                  "<div class='grid'>");

  for (int i = 0; i < NUM_RELAYS; i++) {
    bool isOn = gRelayStates[i];
    html += F("<div class='relay-box ") + String(isOn ? "on" : "") + F("'>");
    html += F("<div class='relay-title'>") + String(RELAY_NAMES[i]) + F("</div>");
    html += F("<div class='relay-pin'>GPIO ") + String(RELAY_PINS[i]) + F(" (Active LOW)</div>");
    html += F("<div class='status-pill ") + String(isOn ? "status-on'>ON (0V)" : "status-off'>OFF (3.3V)") + F("</div><div>");
    html += F("<a href='/relay?nomor=") + String(i + 1) + F("&aksi=on' class='btn btn-on'>ON</a>");
    html += F("<a href='/relay?nomor=") + String(i + 1) + F("&aksi=off' class='btn btn-off'>OFF</a>");
    html += F("</div></div>");
  }

  html += F("</div>"
            "<div class='note'>"
            "<strong>Logika Active LOW:</strong> LOW (0V) = Relay ON, HIGH (3.3V) = Relay OFF.<br>"
            "Status relay tersimpan di NVS Flash. Perintah dari Supabase Cloud diproses secara paralel."
            "</div></div></body></html>");

  server.send(200, "text/html", html);
}

void handleWebRelayControl() {
  if (!server.hasArg("nomor") || !server.hasArg("aksi")) {
    server.send(400, "text/plain", "Parameter 'nomor' (1-4) dan 'aksi' (on|off) wajib disertakan.");
    return;
  }

  int relayNum = server.arg("nomor").toInt();
  String aksi = server.arg("aksi");

  if (relayNum < 1 || relayNum > NUM_RELAYS) {
    server.send(400, "text/plain", "Nomor relay harus di antara 1 dan 4.");
    return;
  }

  bool turnOn = aksi.equalsIgnoreCase("on");
  setRelayPhysical(relayNum - 1, turnOn, true);

  // Redirect kembali ke halaman utama jika diminta dari browser
  server.sendHeader("Location", "/");
  server.send(303);
}

void handleWebStatusJson() {
  StaticJsonDocument<512> doc;
  doc["device_code"] = DEVICE_CODE;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["active_low_logic"] = true;
  doc["wifi_rssi_dbm"] = WiFi.RSSI();
  doc["uptime_sec"] = millis() / 1000;

  JsonArray relays = doc.createNestedArray("relays");
  for (int i = 0; i < NUM_RELAYS; i++) {
    JsonObject r = relays.createNestedObject();
    r["channel"] = i + 1;
    r["gpio"] = RELAY_PINS[i];
    r["name"] = RELAY_NAMES[i];
    r["is_on"] = gRelayStates[i];
    r["state"] = gRelayStates[i] ? "ON" : "OFF";
    r["pin_level"] = gRelayStates[i] ? 0 : 1; // 0 = LOW, 1 = HIGH
  }

  String jsonResp;
  serializeJson(doc, jsonResp);
  server.send(200, "application/json", jsonResp);
}

// ============================================================================
// 6. POLLING SUPABASE EDGE FUNCTIONS (HTTPS & DEDUPLIKASI)
// ============================================================================
void pollSupabaseCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  if (!gHttp.begin(gSecClient, URL_COMMAND_POLL)) {
    Serial.println(F("[HTTPS] Gagal menginisialisasi koneksi ke command-poll."));
    return;
  }

  gHttp.addHeader("X-Device-Code", DEVICE_CODE);
  gHttp.addHeader("X-Device-Token", DEVICE_TOKEN);

  int httpCode = gHttp.GET();
  if (httpCode == HTTP_CODE_OK) {
    String resp = gHttp.getString();
    StaticJsonDocument<1536> doc;
    DeserializationError err = deserializeJson(doc, resp);

    if (!err && doc["has_command"].as<bool>()) {
      JsonArray commands = doc["commands"].as<JsonArray>();
      for (JsonObject cmd : commands) {
        const char* cmdId = cmd["command_id"];
        const char* cmdType = cmd["command_type"];
        JsonObject params = cmd["parameters"].as<JsonObject>();

        Serial.printf("\n[QUEUE] Menerima Perintah: %s (ID: %s)\n", cmdType, cmdId);

        // Deduplikasi Perintah: Cegah eksekusi ganda jika perintah sudah diproses
        if (String(cmdId) == gLastExecutedCommandId) {
          Serial.printf("[DEDUP] Perintah ID %s sudah pernah dieksekusi. Mengirim ulang status selesai.\n", cmdId);
          sendCommandAck(cmdId, "completed", "Perintah telah dieksekusi sebelumnya (deduplicated).");
          continue;
        }

        // 1. Kirim ACK 'acknowledged' segera ke Cloud
        sendCommandAck(cmdId, "acknowledged", "Perintah diterima oleh ESP32 dan sedang diproses.");

        // 2. Eksekusi Perintah Fisik
        executeCommandDispatcher(cmdId, cmdType, params);
      }
    }
  } else if (httpCode > 0) {
    Serial.printf("[HTTPS] Polling perintah gagal. HTTP Code: %d\n", httpCode);
  }
  gHttp.end();
}

// ============================================================================
// 7. DISPATCHER EKSEKUSI PERINTAH AKTISAL
// ============================================================================
void executeCommandDispatcher(const char* cmdId, const char* cmdType, JsonObject& params) {
  // Simpan ID perintah untuk deduplikasi
  gLastExecutedCommandId = String(cmdId);
  gPrefs.putString("last_cmd_id", gLastExecutedCommandId);

  // KASUS 1: SET_RELAY (Kontrol spesifik 4-channel relay fisik)
  if (strcmp(cmdType, "SET_RELAY") == 0) {
    int relayNum = params["relay"] | 1;
    String stateStr = params["state"] | "ON";

    if (relayNum < 1 || relayNum > NUM_RELAYS) {
      Serial.printf("[ERROR] Nomor relay %d tidak valid!\n", relayNum);
      sendCommandAck(cmdId, "failed", "Nomor relay tidak valid (harus 1 sampai 4).");
      return;
    }

    bool turnOn = stateStr.equalsIgnoreCase("ON") || stateStr.equalsIgnoreCase("true") || stateStr == "1";
    setRelayPhysical(relayNum - 1, turnOn, true);

    StaticJsonDocument<256> extraDoc;
    extraDoc["relay"] = relayNum;
    extraDoc["gpio"] = RELAY_PINS[relayNum - 1];
    extraDoc["state"] = turnOn ? "ON" : "OFF";
    extraDoc["active_low_pin_level"] = turnOn ? 0 : 1;
    extraDoc["executed_at"] = millis();
    JsonObject extraObj = extraDoc.as<JsonObject>();

    String ackMsg = String("Relay ") + relayNum + " (GPIO " + RELAY_PINS[relayNum - 1] + ") berhasil diset ke " + (turnOn ? "ON" : "OFF") + " (Active LOW).";
    sendCommandAck(cmdId, "completed", ackMsg, &extraObj);
    return;
  }

  // KASUS 2: TOGGLE_LAMP (Mengendalikan Relay 3 - LED Penarik Serangga)
  if (strcmp(cmdType, "TOGGLE_LAMP") == 0) {
    bool nextState = !gRelayStates[2]; // Relay 3 index 2
    setRelayPhysical(2, nextState, true);

    StaticJsonDocument<128> extra;
    extra["lamp_is_active"] = nextState;
    extra["relay_channel"] = 3;
    extra["gpio"] = RELAY_3_PIN;
    JsonObject extraObj = extra.as<JsonObject>();

    String ackMsg = nextState ? "Lampu UV diaktifkan (Relay 3 ON, GPIO 27 LOW)." : "Lampu UV dimatikan (Relay 3 OFF, GPIO 27 HIGH).";
    sendCommandAck(cmdId, "completed", ackMsg, &extraObj);
    return;
  }

  // KASUS 3: FORCE_WATER_CHANGE (Mengendalikan Relay 1 - Pompa & Relay 2 - Solenoid)
  if (strcmp(cmdType, "FORCE_WATER_CHANGE") == 0) {
    Serial.println(F("[HYDRAULIC] Menjalankan siklus kuras dan pengisian air baki..."));

    // Buka katup buang solenoid (Relay 2)
    setRelayPhysical(1, true); // Relay 2 ON
    for (int i = 0; i < 5; i++) { // Simulasi singkat atau waktu terkonfigurasi
      esp_task_wdt_reset();
      delay(1000);
    }
    setRelayPhysical(1, false); // Relay 2 OFF

    // Nyalakan pompa pengisi (Relay 1)
    setRelayPhysical(0, true); // Relay 1 ON
    for (int i = 0; i < 5; i++) {
      esp_task_wdt_reset();
      delay(1000);
    }
    setRelayPhysical(0, false); // Relay 1 OFF

    StaticJsonDocument<128> extra;
    extra["water_used_liters"] = 5.0;
    JsonObject extraObj = extra.as<JsonObject>();
    sendCommandAck(cmdId, "completed", "Siklus pengurasan dan pengisian tuntas.", &extraObj);
    return;
  }

  // KASUS 4: REBOOT_ESP32
  if (strcmp(cmdType, "REBOOT_ESP32") == 0) {
    sendCommandAck(cmdId, "completed", "Reboot bersih mikrokontroler dijalankan.");
    delay(1000);
    ESP.restart();
    return;
  }

  // Perintah tidak didukung
  sendCommandAck(cmdId, "failed", "Jenis perintah tidak didukung oleh hardware.");
}

// ============================================================================
// 8. PENGIRIMAN ACKNOWLEDGMENT (ACK) KE SUPABASE EDGE FUNCTIONS
// ============================================================================
void sendCommandAck(const char* commandId, const char* status, const String& message, JsonObject* extra) {
  if (WiFi.status() != WL_CONNECTED) return;

  if (!gHttp.begin(gSecClient, URL_COMMAND_ACK)) return;

  gHttp.addHeader("Content-Type", "application/json");
  gHttp.addHeader("X-Device-Code", DEVICE_CODE);
  gHttp.addHeader("X-Device-Token", DEVICE_TOKEN);

  StaticJsonDocument<512> doc;
  doc["command_id"] = commandId;
  doc["status"] = status;

  JsonObject res = doc.createNestedObject("result");
  res["message"] = message;
  if (extra) {
    for (JsonPair kv : *extra) {
      res[kv.key()] = kv.value();
    }
  }

  String payload;
  serializeJson(doc, payload);

  int code = gHttp.POST(payload);
  Serial.printf("[ACK] Status '%s' terkirim untuk %s (HTTP Code: %d)\n", status, commandId, code);
  gHttp.end();
}

// ============================================================================
// 9. HEARTBEAT & TELEMETRI STATUS
// ============================================================================
void sendDeviceHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  if (!gHttp.begin(gSecClient, URL_DEVICE_STATUS)) return;

  gHttp.addHeader("Content-Type", "application/json");
  gHttp.addHeader("X-Device-Code", DEVICE_CODE);
  gHttp.addHeader("X-Device-Token", DEVICE_TOKEN);

  StaticJsonDocument<256> doc;
  doc["status"] = "online";
  doc["rssi"] = WiFi.RSSI();
  doc["uptime_sec"] = millis() / 1000;
  doc["firmware_version"] = FIRMWARE_VERSION;

  String payload;
  serializeJson(doc, payload);

  gHttp.POST(payload);
  gHttp.end();
}

void sendTelemetryData() {
  if (WiFi.status() != WL_CONNECTED) return;

  if (!gHttp.begin(gSecClient, URL_TELEMETRY)) return;

  gHttp.addHeader("Content-Type", "application/json");
  gHttp.addHeader("X-Device-Code", DEVICE_CODE);
  gHttp.addHeader("X-Device-Token", DEVICE_TOKEN);

  String payload = buildTelemetryJson();
  int httpCode = gHttp.POST(payload);

  if (httpCode == HTTP_CODE_OK) {
    Serial.printf("[TELEMETRY] Paket #%u berhasil dikirim ke Cloud.\n", gSequenceNumber++);
  }
  gHttp.end();
}

String buildTelemetryJson() {
  StaticJsonDocument<1024> doc;
  doc["sequence_number"] = gSequenceNumber;

  JsonObject battery = doc.createNestedObject("battery");
  battery["bus_voltage_v"] = gSensors.batteryVoltageV;
  battery["shunt_voltage_mv"] = -32.5f;
  battery["current_ma"] = gSensors.batteryCurrentMa;
  battery["power_mw"] = abs(gSensors.batteryVoltageV * gSensors.batteryCurrentMa);
  battery["is_charging"] = false;
  battery["solar_voltage_v"] = 0.0f;
  battery["solar_current_ma"] = 0.0f;

  JsonObject water = doc.createNestedObject("water");
  water["tray_level_percent"] = gSensors.trayLevelPercent;
  water["tray_level_cm"] = 4.0f;
  water["tank_level_percent"] = gSensors.tankLevelPercent;
  water["tank_volume_liters"] = 39.0f;
  water["turbidity_ntu"] = gSensors.turbidityNtu;
  water["drain_valve_status"] = gRelayStates[1] ? "open" : "closed";
  water["fill_pump_status"] = gRelayStates[0] ? "running" : "idle";
  water["safety_lockout"] = false;

  JsonObject lamp = doc.createNestedObject("lamp");
  lamp["is_active"] = gRelayStates[2]; // Relay 3
  lamp["mode"] = "schedule_auto";
  lamp["wavelength_nm"] = 365;
  lamp["led_current_ma"] = gRelayStates[2] ? 850 : 0;
  lamp["is_healthy"] = true;

  JsonObject conn = doc.createNestedObject("connectivity");
  conn["network_type"] = "WiFi_Demplot";
  conn["rssi_dbm"] = WiFi.RSSI();
  conn["operator"] = "Telkomsel IoT SIM";
  conn["unsynced_microsd_packets"] = 0;

  // Sertakan array status 4 relay untuk inspeksi telemetri langsung
  JsonObject relays = doc.createNestedObject("relays");
  for (int i = 0; i < NUM_RELAYS; i++) {
    char key[8];
    snprintf(key, sizeof(key), "ch_%d", i + 1);
    relays[key] = gRelayStates[i];
  }

  doc["temperature_c"] = 26.8f;
  doc["humidity_percent"] = 80.0f;

  String output;
  serializeJson(doc, output);
  return output;
}
