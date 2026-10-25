# STATUS KETERHUBUNGAN FITUR & HARDWARE

## Smart Light Trap IoT Agritech System - Subang, Jawa Barat

Dokumen ini menjelaskan status keterhubungan setiap fitur pada sistem, membedakan antara fitur yang telah 100% terhubung ke database Supabase, fitur yang siap menerima komunikasi perangkat fisik, dan simulasi pengujian.

---

### Matriks Keterhubungan Fitur

| Fitur / Komponen | Sumber Data | Status Integrasi Backend | Kebutuhan Hardware Fisik |
| :--- | :--- | :--- | :--- |
| **Autentikasi Pengguna** | Supabase Auth (`profiles`) | ✅ **100% Terhubung** | Tidak ada (Berfungsi langsung) |
| **Monitoring Armada Subang** | Supabase DB (`devices`) | ✅ **100% Terhubung** | ESP32-S3 mengirim heartbeat ke `/device-telemetry` |
| **Telemetri INA226 & Daya** | Supabase DB (`device_telemetry`) | ✅ **100% Terhubung** | Sensor INA226 + panel surya di lapangan |
| **Siklus Air & Kekeruhan** | Supabase DB (`water_change_logs`) | ✅ **100% Terhubung** | Katup solenoid 12V, pompa celup, sensor optik NTU |
| **Pusat Notifikasi & Alert** | Supabase DB (`device_alerts`) | ✅ **100% Terhubung** | Dihasilkan otomatis saat batas ambang terlampaui |
| **Galeri Foto & Bounding Box** | Supabase Storage (`device-images`) | ✅ **100% Terhubung** | Modul kamera OV5640 / OV2640 mengirim foto |
| **Koreksi Label AI Manual** | Supabase DB (`insect_detections`) | ✅ **100% Terhubung** | Tidak ada (Dilakukan agronomis di web) |
| **Pengaturan Operasional & Jadwal** | Supabase DB (`device_settings`) | ✅ **100% Terhubung** | ESP32 mengambil via `/device-config` |
| **Antrean Perintah Aktuator** | Supabase DB (`device_commands`) | ✅ **100% Terhubung** | ESP32 polling via `/device-command-poll` |
| **Notifikasi Telegram** | Supabase Edge Functions | ✅ **100% Siap** | Memerlukan Bot Token & Chat ID Telegram di Secrets |
| **Pembaruan Firmware OTA** | Partisi NVS / binary release | ⚠️ **Siap Diintegrasikan** | Firmware binary diunggah ke storage saat rilis baru |
| **Inferensi YOLOv8 Berat** | Microservice Python FastAPI | ✅ **Arsitektur Terpisah Siap** | Server GPU / VPS saat model PyTorch di-deploy |

---

### Catatan Keamanan Aktuator
1. Tombol kontrol (seperti *Paksa Siklus Kuras* atau *Ubah Status Lampu*) pada frontend telah terhubung ke tabel `device_commands`. Perintah tidak langsung mengubah kondisi fisik seketika, melainkan mengantre dengan status `pending` untuk diambil oleh ESP32.
2. Ketika perangkat fisik ESP32-S3 di lapangan mengambil perintah tersebut, firmware lokal tetap menjalankan pengecekan keselamatan perangkat keras (contoh: pompa tidak akan menyala jika tandon air di bawah 15% untuk mencegah kebakaran *dry-run*).
3. Setelah eksekusi fisik berhasil atau gagal, ESP32 mengirim konfirmasi balik ke `/device-command-ack` yang memperbarui status di web dashboard secara real-time.
