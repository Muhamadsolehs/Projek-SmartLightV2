# CONTOH IMPLEMENTASI PAYLOAD & KODE C++ ESP32-S3

## Smart Light Trap IoT Agritech Node (Subang Edition)

Panduan ini mendemonstrasikan implementasi pengiriman paket telemetri dan polling perintah dari mikrokontroler **ESP32-S3** menggunakan modem 4G LTE (SIM7600E / A7670E) atau WiFi ke Supabase Edge Functions.

---

### 1. Struktur Payload Telemetri (ArduinoJson v6/v7)

```cpp
#include <ArduinoJson.h>

String buildTelemetryJson(
    uint32_t sequenceNumber,
    float busVoltageV,
    float shuntVoltageMv,
    float currentMa,
    float powerMw,
    bool isCharging,
    float trayLevelPercent,
    float trayLevelCm,
    float tankLevelPercent,
    float tankVolumeLiters,
    float turbidityNtu,
    bool lampIsActive,
    int lampCurrentMa,
    int rssiDbm,
    float temperatureC,
    float humidityPercent
) {
    StaticJsonDocument<1024> doc;

    doc["sequence_number"] = sequenceNumber;
    doc["timestamp"] = "2026-10-24T20:45:00+07:00"; // Dari RTC DS3231

    JsonObject battery = doc.createNestedObject("battery");
    battery["bus_voltage_v"] = busVoltageV;
    battery["shunt_voltage_mv"] = shuntVoltageMv;
    battery["current_ma"] = currentMa;
    battery["power_mw"] = powerMw;
    battery["is_charging"] = isCharging;
    battery["solar_voltage_v"] = 0.0;
    battery["solar_current_ma"] = 0.0;

    JsonObject water = doc.createNestedObject("water");
    water["tray_level_percent"] = trayLevelPercent;
    water["tray_level_cm"] = trayLevelCm;
    water["tank_level_percent"] = tankLevelPercent;
    water["tank_volume_liters"] = tankVolumeLiters;
    water["turbidity_ntu"] = turbidityNtu;
    water["drain_valve_status"] = "closed";
    water["fill_pump_status"] = "idle";
    water["safety_lockout"] = (tankLevelPercent < 15.0);

    JsonObject lamp = doc.createNestedObject("lamp");
    lamp["is_active"] = lampIsActive;
    lamp["mode"] = "schedule_auto";
    lamp["wavelength_nm"] = 365;
    lamp["led_current_ma"] = lampCurrentMa;
    lamp["is_healthy"] = true;

    JsonObject conn = doc.createNestedObject("connectivity");
    conn["network_type"] = "4G_LTE";
    conn["rssi_dbm"] = rssiDbm;
    conn["operator"] = "Telkomsel IoT SIM";
    conn["unsynced_microsd_packets"] = 0;

    doc["temperature_c"] = temperatureC;
    doc["humidity_percent"] = humidityPercent;

    String jsonOutput;
    serializeJson(doc, jsonOutput);
    return jsonOutput;
}
```

---

### 2. Fungsi Pengiriman HTTP POST Aman (HTTPS)

```cpp
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

const char* SUPABASE_FUNCTION_URL = "https://<PROJECT-ID>.supabase.co/functions/v1/device-telemetry";
const char* DEVICE_CODE = "SLT-SBG-01";
const char* DEVICE_TOKEN = "slt_token_sbg01_secret_2026"; // Rahasia tersimpan di NVS terenkripsi

bool sendTelemetryToServer(const String& payloadJson) {
    WiFiClientSecure client;
    client.setInsecure(); // Pada produksi, gunakan cert root CA Let's Encrypt / DigiCert

    HTTPClient https;
    if (https.begin(client, SUPABASE_FUNCTION_URL)) {
        https.addHeader("Content-Type", "application/json");
        https.addHeader("X-Device-Code", DEVICE_CODE);
        https.addHeader("X-Device-Token", DEVICE_TOKEN);

        int httpCode = https.POST(payloadJson);

        if (httpCode == HTTP_CODE_OK) {
            String response = https.getString();
            Serial.printf("[IOT] Telemetri berhasil terkirim. Respon: %s\n", response.c_str());
            https.end();
            return true;
        } else {
            Serial.printf("[IOT] Gagal mengirim telemetri. HTTP Code: %d\n", httpCode);
            https.end();
            return false;
        }
    }
    return false;
}
```

---

### 3. Fungsi Polling dan Acknowledgment Perintah

```cpp
const char* POLL_URL = "https://<PROJECT-ID>.supabase.co/functions/v1/device-command-poll";
const char* ACK_URL  = "https://<PROJECT-ID>.supabase.co/functions/v1/device-command-ack";

void checkRemoteCommands() {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient https;

    if (https.begin(client, POLL_URL)) {
        https.addHeader("X-Device-Code", DEVICE_CODE);
        https.addHeader("X-Device-Token", DEVICE_TOKEN);

        int httpCode = https.GET();
        if (httpCode == HTTP_CODE_OK) {
            String response = https.getString();
            StaticJsonDocument<1024> doc;
            deserializeJson(doc, response);

            bool hasCommand = doc["has_command"];
            if (hasCommand && doc["commands"].size() > 0) {
                JsonObject cmd = doc["commands"][0];
                const char* cmdId = cmd["command_id"];
                const char* cmdType = cmd["command_type"];

                Serial.printf("[COMMAND] Menerima instruksi: %s (ID: %s)\n", cmdType, cmdId);

                // Eksekusi aktuator lokal dengan proteksi keselamatan fisik
                if (strcmp(cmdType, "FORCE_WATER_CHANGE") == 0) {
                    executeHydraulicFlushCycle(cmdId);
                } else if (strcmp(cmdType, "TOGGLE_LAMP") == 0) {
                    toggleUvLamp(cmdId);
                }
            }
        }
        https.end();
    }
}

void sendCommandAck(const char* cmdId, const char* status, const String& resultJson) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient https;

    if (https.begin(client, ACK_URL)) {
        https.addHeader("Content-Type", "application/json");
        https.addHeader("X-Device-Code", DEVICE_CODE);
        https.addHeader("X-Device-Token", DEVICE_TOKEN);

        StaticJsonDocument<512> ackDoc;
        ackDoc["command_id"] = cmdId;
        ackDoc["status"] = status;
        JsonObject resObj = ackDoc.createNestedObject("result");
        resObj["message"] = "Eksekusi berhasil pada ESP32-S3";

        String ackPayload;
        serializeJson(ackDoc, ackPayload);

        https.POST(ackPayload);
        https.end();
    }
}
```
