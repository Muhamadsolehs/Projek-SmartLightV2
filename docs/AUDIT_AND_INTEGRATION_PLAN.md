# AUDIT REPOSITORY DAN ANALISIS INTEGRASI SMART LIGHT TRAP

## 1. Ringkasan Arsitektur Proyek Saat Ini
- **Framework Frontend**: React 19.0.1 dengan TypeScript 7.0.2 dan Vite 8.3.0.
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite` 4.3.3) dengan tema visual nuansa hijau agritech (`#132A13`, `#31572C`, `#4F772D`, `#90A955`, `#ECF39E`).
- **Komponen Eksternal**: `lucide-react` (iconography), `three` (simulasi visual 3D Smart Trap di landing page), `@google/genai` (klien Gemini).
- **Struktur Halaman & Navigasi**: Tab-based routing diatur melalui `src/App.tsx` dan `src/context/DeviceContext.tsx` dengan status proteksi autentikasi:
  1. **Landing Page (`LandingPageView`)**: Pengenalan sistem, fitur pilar, visualisasi 3D perangkat, dan tombol login.
  2. **Ringkasan Lahan (`OverviewView`)**: KPI status armada, ringkasan hama hari ini, status energi & hidraulik, tren tangkapan 7 hari.
  3. **Monitoring Perangkat (`DeviceListView`, `DeviceDetailModal`)**: Daftar unit, status online/offline, pencarian, filter, modal detail telemetri lengkap.
  4. **Analisis Hama PHT (`PestAnalyticsView`)**: Grafik tren harian 7d/14d, rincian per spesies hama sasaran, ambang kendali ekonomi PHT.
  5. **Galeri Foto & CV (`PhotoGalleryView`)**: Citra baki perangkap beriluminasi UV, bounding box deteksi AI YOLOv8, verifikasi manual agronomis.
  6. **Daya & Baterai (`EnergyMonitoringView`)**: Telemetri sensor INA226 (tegangan bus, arus shunt, daya solar), grafik 24 jam.
  7. **Siklus & Air Baki (`WaterManagementView`)**: Status baki, level tandon, kekeruhan NTU (DF-Robot optik), katup drain, pompa pengisi, riwayat flushing.
  8. **Pusat Notifikasi (`AlertsView`)**: Peringatan kritis/warning/info, filter keparahan, acknowledgment status, simulasi bot Telegram.
  9. **Pengaturan & OTA (`DeviceSettingsView`)**: Konfigurasi parameter lampu, jadwal operasional, batas cut-off tegangan, ambang hama, simulasi cek OTA firmware.
  10. **Arsitektur & API (`ArchitectureApiView`)**: Referensi teknis skema SQL, endpoint REST, alur mikrokontroler ESP32-S3.
  11. **Simulator Hardware Lapangan (`HardwareSimulatorModal`)**: Modal pengujian interaktif skenario telemetri.

## 2. Identifikasi Data Dummy dan Sumber Data Tiruan
Saat ini seluruh data tersimpan secara lokal dan disimulasikan melalui:
1. `src/data/mockData.ts`:
   - `INSECT_SPECIES_LIST`: Master 6 spesies serangga padi (Penggerek Batang, Wereng Coklat, Ulat Grayak, Walang Sangit, Putih Palsu, Netral).
   - `INITIAL_DEVICES`: 4 unit perangkat Subang (`SLT-SBG-01` s/d `SLT-SBG-04`) dengan telemetri statis.
   - `INITIAL_ALERTS`: 5 data notifikasi awal.
   - `INITIAL_COMMANDS`: 3 data perintah historis.
   - `MOCK_WATER_LOGS`: 4 riwayat pengurasan air baki.
   - `MOCK_CAPTURES`: 3 sesi foto baki dengan bounding boxes array.
   - `MOCK_DAILY_TRENDS`: 14 hari rekaman tangkapan hama per spesies.
   - `MOCK_BATTERY_24H`: 24 jam log tegangan dan daya solar.
2. `src/context/DeviceContext.tsx`:
   - `DEMO_USERS`: 3 pengguna statis (`Pak Rahmat` - Agronomis Lapangan, `Siti Aminah` - Operator Teknis, `Dr. Hendra` - Supervisor PHT).
   - Autentikasi disimpan di `localStorage` kunci `slt_user` tanpa verifikasi token Supabase.
   - Fungsi `sendCommand`: Simulasi delay timeout (`setTimeout` 600ms -> 1400ms -> 2500ms) untuk mengubah status dari `PENDING` -> `SENT` -> `ACKNOWLEDGED` -> `COMPLETED`.
   - Fungsi `triggerHardwareSimulation`: Mengubah state lokal secara mutasi langsung.
   - Fungsi `updateBoundingBoxLabel`: Mengubah state lokal array `captures`.
   - Fungsi `testTelegramNotification`: Delay tiruan tanpa memanggil HTTP endpoint bot Telegram sesungguhnya.

## 3. Cakupan Wilayah Operasional
- Sistem difokuskan secara eksklusif untuk **Subang, Jawa Barat**.
- Titik koordinat dan lokasi perangkat mencakup wilayah sentra padi Subang:
  - *Pusat Benih Padi Subang* (`SLT-SBG-01`, lat: -6.5512, lon: 107.7588)
  - *Kelompok Tani Pagaden Subang* (`SLT-SBG-02`, lat: -6.5381, lon: 107.7423)
  - *Sentra Pertanian Binong Subang* (`SLT-SBG-03`, lat: -6.4912, lon: 107.7812)
  - *Demplot Organik Ciasem Subang* (`SLT-SBG-04`, lat: -6.4215, lon: 107.6984)
- **Aturan**: Tidak ada dropdown multi-wilayah di UI. Konfigurasi wilayah default: `Subang, Jawa Barat`.

## 4. Rencana Implementasi Bertahap
- **Tahap 1**: Dokumentasi Audit dan pemetaan komponen (Selesai).
- **Tahap 2 & 3**: Pembuatan skema database PostgreSQL lengkap dengan migrasi SQL Supabase:
  - Tabel: `profiles`, `devices`, `device_telemetry`, `capture_sessions`, `insect_species`, `insect_detections`, `device_images`, `device_alerts`, `device_commands`, `device_settings`, `water_change_logs`, `device_events`.
  - Keamanan Row Level Security (RLS) untuk role `admin`, `operator`, `viewer`.
  - Fungsi keamanan verifikasi API token perangkat ESP32-S3.
  - Setup private storage bucket `device-images`.
  - Seed data awal untuk pengujian lokal/staging.
- **Tahap 4**: Integrasi Autentikasi Supabase Auth ke frontend React:
  - `src/lib/supabase.ts` untuk inisialisasi client aman.
  - `authService.ts` untuk sinkronisasi sesi login/logout, pemulihan sesi, dan pengambilan profil role.
- **Tahap 5**: Integrasi Data Dashboard & Supabase Storage:
  - Pembuatan service data (`deviceService`, `pestService`, `waterService`, `alertService`, `storageService`).
  - Pembaruan `DeviceContext` dengan live querying dan graceful fallback.
- **Tahap 6**: Supabase Realtime & Notifikasi Telegram:
  - Channel subscription untuk pembaruan instan status armada, telemetri baru, alert baru, dan progres command.
  - Edge function pengiriman Telegram dengan deduplikasi.
- **Tahap 7 & 8**: Supabase Edge Functions untuk ESP32-S3 & Arsitektur Python CV:
  - Endpoint `device-telemetry`, `device-image-upload`, `device-detections`, `device-config`, `device-command-poll`, `device-command-ack`, `device-status`.
  - Spesifikasi layanan AI Python FastAPI terpisah untuk inferensi YOLOv8.
- **Tahap 9**: Pengujian, build verification, dan dokumentasi operasional lengkap.
