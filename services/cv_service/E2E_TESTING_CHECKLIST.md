# Checklist & Bukti Pengujian End-to-End (E2E) — Smart Light Trap AI

**Dokumen Audit Integrasi & Bukti Eksekusi Pengujian Aktual**  
**Tanggal Pengujian:** 9 November 2026  
**Auditor:** Senior IoT, Computer Vision & Supabase Integration Engineer  

---

## 1. Matriks Evaluasi 10 Skenario End-to-End

| No | Tahapan Skenario E2E | Komponen Penguji | Input / Pemicu | Output Aktual | Status HTTP | Bukti Log / Hasil Eksekusi | Status Evaluasi |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| **1** | **Gambar Diunggah dari Perangkat Fisik** | Firmware ESP8266 / ESP32-S3 | Trigger tangkapan baki terjadwal | Firmware saat ini tidak memiliki modul kamera (OV2640/OV5640). Belum ada kode HTTP upload di `.ino`. | N/A | `firmware/esp32_smart_lightrap.ino` hanya menangani relay 4-ch, telemetry INA226, command poll, dan heartbeat. | **NOT TESTED (Hardware Kamera Belum Ada di Firmware)** |
| **2** | **Capture Session Dibuat di Database** | Edge Function `device-image-upload` | POST multipart image / presigned JSON request | Sesi baru berhasil dibuat di `public.capture_sessions` dengan `processing_status = 'pending'`. | `200 OK` | `{"success": true, "session_id": "uuid-...", "storage_path": "devices/SLT-SBG-01/..."}` | **PASS (Edge Function Level)** |
| **3** | **Gambar Tersimpan di Supabase Storage** | Supabase Storage (`device-images`) | File stream JPEG dari upload | File tersimpan di path `devices/{device_code}/{year}/{month}/{filename}`. | `200 OK` | Bucket privat `device-images` menyimpan file dan dapat menghasilkan signed URL. | **PASS** |
| **4** | **Worker Mengambil Gambar Baru** | Background Worker / Consumer | Polling status `capture_sessions.processing_status = 'pending'` | **Mekanisme worker background otomatis belum dibuat.** Pemrosesan saat ini harus dipicu manual via CLI `bridge.py`. | N/A | Tidak ada daemon process atau queue consumer yang memantau Supabase Storage secara realtime. | **FAIL (Worker Otomatis Belum Ada)** |
| **5** | **YOLO Menjalankan Inferensi** | FastAPI `/detect` (YOLOv8 IP102) | Citra baki perangkap JPEG | Model production (`best.pt`) belum selesai dilatih di Google Colab. API secara ketat mengembalikan error 503 `MODEL_NOT_TRAINED`. | `503 Service Unavailable` | `{"error_code": "MODEL_NOT_TRAINED", "message": "Production model checkpoint best.pt not found."}` | **BLOCKED (Menunggu Hasil Training Colab)** |
| **6** | **Hasil Dikirim ke Edge Function** | Python `bridge.py` | Payload JSON hasil inferensi model | Payload berhasil divalidasi, bounding box $0-100\%$, confidence $0-1$, format sesuai schema `device-detections`. | `200 OK` (simulasi) | `bridge.py` memvalidasi UUID v4, menyaring unmapped species, dan membungkus payload. | **PASS (Kontrak Payload Terverifikasi)** |
| **7** | **Database Menerima Deteksi** | Edge Function `device-detections` | POST payload ke `/device-detections` | Baris deteksi masuk ke `insect_detections`. Namun terdapat risiko FK error jika species_code tidak ada di `insect_species`, dan belum ada idempotency check (duplikasi pada retry). | `200 OK` (mapped) / `500 Error` (unmapped) | Jika `species_code = 'unmapped'` atau `'unidentified'`, Postgres melempar FK Violation karena tidak ada di master data. | **PARTIAL (Berisiko Foreign Key & Duplikasi Retry)** |
| **8** | **Dashboard Menampilkan Hasil** | React Dashboard (`PhotoGalleryView.tsx`) | Query Supabase `capture_sessions` join `insect_detections` | Dashboard berhasil memuat sesi, menampilkan status `pending`/`completed`, dan merender galeri. | `200 OK` | Data di-render langsung dari Supabase melalui `pestService.getCaptureSessions()`. | **PASS** |
| **9** | **Bounding Box Sesuai Koordinat Citra** | Komponen Canvas UI (`PhotoGalleryView.tsx`) | Objek deteksi dengan koordinat $x, y, w, h$ | Bounding box terpasang proporsional menggunakan styling persentase (`left: ${box.x}%`, `top: ${box.y}%`). | DOM Rendered | Koordinat persentase $0-100\%$ terbukti responsif pada berbagai resolusi layar tanpa overflow. | **PASS** |
| **10**| **Alert Telegram Terkirim saat Ambang Batas** | Edge Function `device-detections` -> `telegram-notify` | `target_pests_count >= pest_threshold_per_night` | Baris tercatat di `device_alerts`, **TETAPI TELEGRAM TIDAK PERNAH DIHUBUNGI!** `device-detections` tidak memanggil notifier, dan `telegram-notify` tidak memiliki event `PEST_THRESHOLD`. | N/A | Log membuktikan tidak ada pemanggilan HTTP ke Telegram Bot API dari `device-detections`. Notifikasi terputus. | **FAIL (Rantai Notifikasi Telegram Terputus)** |

---

## 2. Rincian Teknis Temuan Kegagalan (Failures)

### A. Temuan Kegagalan 1: Tidak Ada Logika Kamera pada Firmware Fisik
- **Lokasi Kode:** `firmware/esp32_smart_lightrap/esp32_smart_lightrap.ino` dan `firmware/esp8266_smart_lightrap/SmartLightTrap_ESP8266.ino`.
- **Fakta Aktual:** Kedua file `.ino` murni berfokus pada kontrol saklar relay (pompa, solenoid, lampu UV, blower), monitoring arus/tegangan baterai via sensor INA226, dan polling perintah.
- **Rekomendasi Arsitektur:** Kamera harus dioperasikan oleh modul terpisah (misal: ESP32-CAM AI-Thinker atau Raspberry Pi Zero W) yang secara independen mengambil foto dan memanggil `/functions/v1/device-image-upload`.

### B. Temuan Kegagalan 2: Belum Adanya Worker Consumer Otomatis
- **Fakta Aktual:** Ketika sebuah citra diunggah dan tercatat di `capture_sessions` dengan status `pending`, tidak ada layanan yang secara otomatis mengambil citra tersebut untuk diproses oleh FastAPI.
- **Dampak:** Sesi tangkapan akan selamanya berstatus `pending` kecuali seorang operator mengeksekusi script `bridge.py` secara manual dari terminal.

### C. Temuan Kegagalan 3: Rantai Notifikasi Ambang Hama Telegram Terputus
- **Lokasi Kode:** `supabase/functions/device-detections/index.ts` (baris 80–95).
- **Fakta Aktual:**
  ```typescript
  // Hanya melakukan insert ke tabel device_alerts:
  await supabase.from('device_alerts').insert({ ... });
  // TIDAK ADA pemanggilan notifyTelegram()!
  ```
- **Ketiadaan Event di Notifier:** File `supabase/functions/telegram-notify/index.ts` hanya mendefinisikan `ALLOWED_EVENT_TYPES`:
  `'DEVICE_ONLINE' | 'DEVICE_OFFLINE' | 'RELAY_STATUS' | 'WATER_CHANGE' | 'BATTERY_LOW' | 'DEVICE_ERROR' | 'TEST_NOTIFICATION'`.
  Event untuk `PEST_THRESHOLD` sama sekali **BELUM DIDAFTARKAN**.

---

## 3. Rencana Perbaikan Bertahap (Roadmap)

1. **Jangka Pendek (Menyelesaikan Training & Model):**
   - Jalankan notebook `ml/IP102_Training_Colab.ipynb` di Google Colab GPU T4.
   - Ambil `best.pt` dan pasang di `runs/detect/ip102_training/weights/best.pt`.
2. **Jangka Menengah (Menyambungkan Notifikasi & Idempotensi):**
   - Tambahkan event `PEST_ALERT` pada `supabase/functions/_shared/telegramNotifier.ts` dan `supabase/functions/telegram-notify/index.ts`.
   - Perbarui `device-detections/index.ts` agar memanggil `notifyTelegram()` saat ambang batas terlampaui.
   - Tambahkan pembersihan/idempotensi deteksi lama jika sebuah `session_id` dikirim ulang untuk mencegah duplikasi baris.
3. **Jangka Panjang (Automasi Worker & Hardware Kamera):**
   - Kembangkan microservice worker Python (misal: `services/cv_service/worker.py`) yang melakukan polling berkala terhadap `capture_sessions` berstatus `pending`.
   - Kembangkan firmware kamera terdedikasi untuk ESP32-CAM.

