# DOKUMENTASI ENDPOINT SUPABASE EDGE FUNCTIONS

## Smart Light Trap IoT Agritech System - Subang, Jawa Barat

Base URL Edge Functions: `https://<YOUR-PROJECT-ID>.supabase.co/functions/v1/`

Seluruh komunikasi dari perangkat ESP32-S3 lapangan wajib menggunakan protokol aman **HTTPS** dengan header otentikasi:
- **`X-Device-Code`**: Kode unik unit terdaftar (contoh: `SLT-SBG-01`).
- **`X-Device-Token`**: Token rahasia per unit yang diverifikasi server terhadap hash SHA-256 dalam database.

---

### Ringkasan Endpoint

| Endpoint | Method | Fungsi Utama | Otentikasi |
| :--- | :---: | :--- | :--- |
| `/device-telemetry` | `POST` | Ingest sensor INA226, baki air, lampu, dan heartbeat | Token Perangkat |
| `/device-image-upload` | `POST` | Alokasi signed upload URL atau upload foto baki | Token Perangkat |
| `/device-detections` | `POST` | Penerimaan hasil inferensi YOLOv8 & evaluasi ambang PHT | Token Perangkat / AI Key |
| `/device-config` | `GET` | Pengambilan jadwal lampu, batas cutoff, dan sinkron RTC | Token Perangkat |
| `/device-command-poll` | `GET` | Pengambilan antrean perintah aktuator yang tertunda | Token Perangkat |
| `/device-command-ack` | `POST` | Konfirmasi eksekusi perintah (ACK/COMPLETED/FAILED) | Token Perangkat |
| `/device-status` | `POST` | Pencatatan kejadian siklus hidup (boot, offline, lockout) | Token Perangkat |
| `/send-telegram-alert` | `POST` | Pengiriman notifikasi Telegram dengan deduplikasi | Internal Service Role |

---

## 1. `POST /device-telemetry`

Menerima pembacaan telemetri periodik (setiap 5 menit) dan memperbarui status online unit.

### Request Headers
```http
Content-Type: application/json
X-Device-Code: SLT-SBG-01
X-Device-Token: slt_token_sbg01_secret_2026
```

### Request Body (JSON)
```json
{
  "sequence_number": 4892,
  "timestamp": "2026-10-24T20:45:00+07:00",
  "battery": {
    "bus_voltage_v": 13.18,
    "shunt_voltage_mv": -42.50,
    "current_ma": -860,
    "power_mw": 11334,
    "is_charging": false,
    "solar_voltage_v": 0.0,
    "solar_current_ma": 0.0
  },
  "water": {
    "tray_level_percent": 82,
    "tray_level_cm": 4.10,
    "tank_level_percent": 78,
    "tank_volume_liters": 39.0,
    "turbidity_ntu": 38,
    "drain_valve_status": "closed",
    "fill_pump_status": "idle",
    "last_water_change": "2026-10-23T17:15:00+07:00",
    "safety_lockout": false
  },
  "lamp": {
    "is_active": true,
    "mode": "schedule_auto",
    "wavelength_nm": 365,
    "led_current_ma": 850,
    "is_healthy": true
  },
  "connectivity": {
    "network_type": "4G_LTE",
    "rssi_dbm": -72,
    "operator": "Telkomsel IoT SIM",
    "unsynced_microsd_packets": 0
  },
  "temperature_c": 25.8,
  "humidity_percent": 88
}
```

### Response Sukses (200 OK)
```json
{
  "success": true,
  "telemetry_id": "f8a12345-6789-4b1a-8cde-0123456789ab",
  "device_code": "SLT-SBG-01",
  "status": "online",
  "server_time": "2026-10-24T13:45:02.124Z"
}
```

### Response Duplikasi Paket (200 OK)
Jika ESP32 mengirim ulang nomor urut paket yang sudah ada:
```json
{
  "status": "duplicate_ignored",
  "message": "Sequence 4892 was already ingested."
}
```

---

## 2. `POST /device-image-upload`

Mengalokasikan signed upload URL ke storage bucket privat `device-images`.

### Request (JSON)
```json
{
  "filename": "cap_SLT-SBG-01_20261024_200000.jpg",
  "width": 1920,
  "height": 1080,
  "file_size": 248102,
  "model_version": "YOLOv8-AgriPest v1.4-Edge"
}
```

### Response (200 OK)
```json
{
  "success": true,
  "session_id": "c1111111-1111-1111-1111-111111111111",
  "image_id": "d1111111-1111-1111-1111-111111111111",
  "storage_path": "devices/SLT-SBG-01/2026/10/cap_SLT-SBG-01_20261024_200000.jpg",
  "upload_url": "https://<PROJECT-ID>.supabase.co/storage/v1/object/upload/sign/device-images/...",
  "token": "eyJhbGciOi..."
}
```

---

## 3. `POST /device-detections`

Menerima hasil deteksi objek serangga dan bounding box prediksi YOLOv8.

### Request Body
```json
{
  "session_id": "c1111111-1111-1111-1111-111111111111",
  "model_version": "YOLOv8-AgriPest v1.4-Edge",
  "detections": [
    {
      "species_code": "scirpophaga_incertulas",
      "species_name": "Penggerek Batang Padi Kuning",
      "confidence": 0.97,
      "bbox": { "x": 22.0, "y": 34.0, "width": 9.0, "height": 12.0 }
    },
    {
      "species_code": "nilaparvata_lugens",
      "species_name": "Wereng Batang Coklat (WBC)",
      "confidence": 0.96,
      "bbox": { "x": 55.0, "y": 48.0, "width": 6.0, "height": 7.0 }
    }
  ]
}
```

---

## 4. `GET /device-config`

Mengambil jadwal lampu dan parameter ambang operasional yang disimpan di Supabase.

### Response (200 OK)
```json
{
  "device_code": "SLT-SBG-01",
  "device_name": "Smart Trap Unit 1 (Subang Sawah Inti)",
  "operational_region": "Subang, Jawa Barat",
  "server_timestamp": "2026-10-24T20:45:00.000Z",
  "lamp": {
    "schedule_start": "18:00",
    "schedule_end": "05:00",
    "wavelength_nm": 365,
    "default_led_current_ma": 850,
    "eco_led_current_ma": 420
  },
  "intervals": {
    "telemetry_interval_sec": 300,
    "photo_interval_sec": 3600,
    "heartbeat_interval_sec": 120
  },
  "safety": {
    "battery_cutoff_threshold_v": 11.8,
    "turbidity_threshold_ntu": 100,
    "flush_duration_sec": 25,
    "safety_min_tank_percent": 15
  }
}
```

---

## 5. `GET /device-command-poll`

Mengecek apakah terdapat perintah pending dari dashboard web.

### Response Jika Ada Perintah (200 OK)
```json
{
  "has_command": true,
  "count": 1,
  "commands": [
    {
      "command_id": "e1111111-1111-1111-1111-111111111111",
      "command_type": "FORCE_WATER_CHANGE",
      "parameters": { "reason": "manual_operator" },
      "created_at": "2026-10-24T20:40:00Z",
      "expires_at": "2026-10-24T21:40:00Z"
    }
  ]
}
```

---

## 6. `POST /device-command-ack`

Melaporkan status eksekusi perintah mikrokontroler.

### Request Body
```json
{
  "command_id": "e1111111-1111-1111-1111-111111111111",
  "status": "completed",
  "result": {
    "message": "Siklus kuras 25 detik dan pengisian baki tuntas.",
    "initial_turbidity_ntu": 124,
    "final_turbidity_ntu": 26,
    "water_used_liters": 4.9
  }
}
```

---

## 7. `POST /device-status`

Melaporkan kejadian hardware lapangan.

### Request Body
```json
{
  "event_type": "BOOT",
  "severity": "info",
  "details": {
    "chip": "ESP32-S3",
    "boot_reason": "POWERON_RESET",
    "modem_firmware": "SIM7600E_V1.2"
  }
}
```
