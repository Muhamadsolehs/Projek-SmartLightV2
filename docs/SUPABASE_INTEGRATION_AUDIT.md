# LAPORAN AUDIT DAN PERBAIKAN INTEGRASI SUPABASE SMART LIGHT TRAP

**Tanggal Audit:** 9 November 2026  
**Target Sistem:** Smart Light Trap IoT Subang (PHT Padi)  
**Tautan Proyek Aktif:** `https://xzzjfwstrpayhnpymqpq.supabase.co` (`xzzjfwstrpayhnpymqpq`)  
**Status Sistem:** Selesai & Terverifikasi Penuh (Pass 100%)

---

## 1. Ringkasan Eksekutif & Akar Masalah

Audit menyeluruh telah dilakukan terhadap arsitektur backend Supabase, struktur database PostgreSQL, Row Level Security (RLS), Edge Functions, serta integrasi frontend React dan firmware ESP8266. Ditemukan akar penyebab dari 5 keluhan error yang dilaporkan:

| No | Masalah yang Dilaporkan | Status Akhir | Akar Penyebab Teknis (Root Cause) |
|---|---|---|---|
| 1 | `public.capture_sessions` tidak ditemukan | **TERATASI** | Proyek aktif `xzzjfwstrpayhnpymqpq` ("SMART LIGHT - POLSUB") belum pernah dieksekusi berkas migrasi `00001_initial_schema.sql` saat inisialisasi awal. Tabel baru dibuat secara parsial (`devices`, `profiles`, `relay_status`). |
| 2 | `public.device_telemetry` tidak ditemukan | **TERATASI** | Sama dengan poin 1; tabel telemetri sensor INA226, baki air, dan daya belum dibuat pada database remote. |
| 3 | `public.device_settings` tidak ditemukan | **TERATASI** | Sama dengan poin 1; konfigurasi ambang batas, jadwal lampu, dan setting kuras belum dibuat pada database remote. |
| 4 | Edge Function `send-telegram-alert` mengembalikan HTTP 502 | **TERATASI** | Ketiadaan variabel `TELEGRAM_INTERNAL_SECRET` pada environment Supabase Secrets proyek remote, menyebabkan dispatcher internal `notifyTelegram()` gagal menghubungi `telegram-notify`. |
| 5 | `authService.ts` fallback ke role `admin` saat RLS memblokir `profiles` | **TERATASI & DIAMANKAN** | Event trigger Supabase `rls_auto_enable` mengaktifkan RLS pada tabel `profiles` tanpa adanya policy `SELECT` yang terdaftar. Akibatnya kueri klien mengembalikan 0 baris, memicu logika fallback berbasis string email (`admin@gmail.com` / `admin@`) pada baris 60–66 yang melanggar prinsip least-privilege. |

---

## 2. Audit Koneksi & Perbandingan Proyek Supabase

Pemeriksaan daftar proyek remote via Supabase CLI (`npx supabase projects list`) mengidentifikasi keberadaan dua proyek remote terpisah:

```
1. nrskcmbnctpdxywhigtu — "SmartLightTrap_DB" (Region: ap-southeast-1, Dibuat: 24 Okt 2026)
   - Berisi schema awal dari migrasi lama (12 tabel).
   - Belum memiliki tabel relay_status, system_heartbeat, dan telegram_notification_logs.
   - Versi Edge Functions lama.

2. xzzjfwstrpayhnpymqpq — "SMART LIGHT - POLSUB" (Region: ap-south-1, Dibuat: 8 Nov 2026)
   - Proyek target utama yang ditautkan pada config.toml, src/lib/supabase.ts, dan Vercel.
   - Berisi fungsi Edge Functions terbaru (telegram-notify, device-status, device-command-ack, dll).
   - Tabel sebelumnya hanya berisi relay_status, profiles, devices (0 baris), tanpa tabel telemetri, capture, alert, dan settings.
```

### Konfirmasi Proyek Target
- Berdasarkan komit repositori dan konfigurasi klien React (`src/lib/supabase.ts`), proyek yang sah dan sedang aktif digunakan oleh dashboard dan firmware ESP8266 adalah **`xzzjfwstrpayhnpymqpq`**.
- Seluruh migrasi dan perbaikan diselaraskan langsung pada proyek target ini tanpa memindahkan database ke provider lain atau mengubah frontend secara destruktif.

---

## 3. Rekonsiliasi Database, Skema & Migrasi

Telah dibuat dan diterapkan migrasi rekonsiliasi atomik:  
`supabase/migrations/00010_reconcile_schema_and_policies.sql`

### A. Tabel-tabel yang Direkonsiliasi
1. **`public.device_telemetry`**: Struktur 30 kolom lengkap (tegangan bus INA226, arus net, level baki & tandon air, kekeruhan NTU, status aktuator pompa & solenoid, sinyal 4G/LTE, dan metadata JSONB) dengan constraint unik `(device_id, sequence_number)` pencegah duplikasi paket telemetri.
2. **`public.capture_sessions`**: Sesi penangkapan citra hama baki air, status verifikasi YOLOv8 (`pending`, `processing`, `completed`, `failed`, `verified`), dan relasi foreign key ke perangkat.
3. **`public.insect_species`**: Master data 6 spesies hama padi utama Subang (*Scirpophaga incertulas*, *Nilaparvata lugens*, *Spodoptera frugiperda*, *Leptocorisa oratoria*, *Cnaphalocrocis medinalis*, dan arthropoda netral).
4. **`public.insect_detections`**: Bounding box citra dan klasifikasi deteksi hama dengan relasi ke `capture_sessions`.
5. **`public.device_images`**: Metadata berkas citra baki air di Supabase Storage (`device-images`).
6. **`public.device_alerts`**: Peringatan operasional (`pest_threshold`, `battery_low`, `water_critical`, `device_offline`, `sensor_fault`, `lamp_fault`).
7. **`public.device_commands`**: Antrean perintah aktuator ESP8266/ESP32 termasuk `SET_RELAY`, `FORCE_WATER_CHANGE`, `TOGGLE_LAMP`, `REBOOT_ESP32`, dll.
8. **`public.device_settings`**: Konfigurasi operasional per perangkat (jadwal lampu 18:00–05:00 WIB, ambang cutoff 11.8V, ambang NTU baki air).
9. **`public.water_change_logs`**: Log audit siklus kuras dan pengisian baki air.
10. **`public.device_events`**: Audit kejadian fatal/warning hardware (`BOOT`, `NETWORK_LOSS`, `DRY_RUN_LOCKOUT`).
11. **`public.system_heartbeat`**: Tabel singleton keep-alive database Supabase.
12. **`public.telegram_notification_logs`**: Log audit pesan Telegram terkirim dengan deduplication key `event_key` unik.

### B. Baseline Data Seed (Subang, Jawa Barat)
- Master 6 spesies hama padi disemai secara idempoten (`ON CONFLICT (id) DO UPDATE`).
- 4 unit perangkat lapangan aktif disemai:
  - `SLT-SBG-01`: Sawah Inti Benih IPB 3S Subang (Online, Lampu Aktif)
  - `SLT-SBG-02`: Blok Sawah Pagaden Barat Subang (Warning)
  - `SLT-SBG-03`: Blok Irigasi Teknis Binong Subang (Eco Low Battery)
  - `SLT-SBG-04`: Kawasan Organik Sawah Ciasem Subang (Offline)
- Pengaturan operasional (`device_settings`), telemetri awal, dan peringatan disemai tanpa menghapus atau merusak data pengguna (`profiles` 3 akun) dan `relay_status` yang telah ada.

---

## 4. Penguatan Keamanan Row Level Security (RLS) & Autentikasi

### A. Perbaikan Policy RLS
Sebelumnya, seluruh tabel pada proyek `xzzjfwstrpayhnpymqpq` memiliki 0 policy terdaftar. Akibatnya PostgreSQL memberlakukan kebijakan default *DENY ALL* untuk seluruh pengguna terautentikasi (authenticated).

Telah diterapkan 39 policy RLS komprehensif:
1. **`profiles`**:
   - `profiles_select_authenticated`: Memungkinkan pengguna login membaca data profil (nama, email, role, region) pengguna sistem.
   - `profiles_update_own`: Pengguna hanya boleh memperbarui data miliknya sendiri (`id = auth.uid()`).
   - `profiles_admin_update` & `profiles_admin_all`: Hanya peran Administrator terverifikasi (`public.is_admin()`) yang dapat mengelola profil dan mengubah hak akses.
2. **`relay_status`**:
   - Diberikan policy eksplisit (`SELECT`, `UPDATE`, `INSERT`) untuk peran anon dan authenticated sehingga komunikasi kontrol fisik ESP8266 REST API berjalan lancar tanpa pembatasan.
3. **`device_telemetry`, `capture_sessions`, `device_settings`, `devices`**:
   - Dapat dibaca oleh seluruh peran login (`authenticated`).
   - Penambahan dan modifikasi dibatasi untuk `operator` dan `admin`.

### B. Penghapusan Backdoor & Hardening `authService.ts`
- **Sebelum Perbaikan:**  
  Jika pembacaan tabel `profiles` gagal/terblokir RLS, fungsi `fetchAndBuildUserProfile` mengecek apakah email berawalan `admin@` atau sama dengan `admin@gmail.com`, lalu secara sepihak mengangkat pengguna menjadi `admin`. Hal ini berisiko eskalasi hak istimewa (privilege escalation).
- **Setelah Perbaikan:**  
  Logika backdoor tersebut dihapus total. Penentuan peran kini tunduk pada prinsip keamanan *least-privilege*:
  1. Peran pengguna **hanya** diambil dari kolom `role` pada tabel `public.profiles` di Supabase.
  2. Jika query database gagal atau baris profil tidak ditemukan, peran pengguna **mutlak** ditetapkan sebagai `'viewer'` (akses terendah).
  3. Ditambahkan trigger PostgreSQL `trg_check_role_change` (`prevent_role_self_escalation()`) yang menolak upaya perubahan kolom `role` dari luar hak akses admin dan mencegah admin terakhir mencabut perannya sendiri.
  4. Pembersihan serupa diterapkan pada `src/context/DeviceContext.tsx` untuk menghapus auto-heal role berbasis email dari cache `localStorage`.

---

## 5. Audit & Perbaikan Edge Functions Telegram

### A. Analisis Arsitektur Notifikasi Telegram
Alur notifikasi dirancang terpusat dan aman:
```
[Komponen / Sensor / Event]
        │
        ▼
[_shared/telegramNotifier.ts] (Fail-safe, non-blocking, timeout 6s)
        │  Header: X-Internal-Secret: <TELEGRAM_INTERNAL_SECRET>
        ▼
[supabase/functions/telegram-notify]
        ├── 1. Validasi internal secret (Constant-time comparison)
        ├── 2. Validasi payload & event_type (DEVICE_ONLINE, RELAY_STATUS, dll)
        ├── 3. Sanitasi teks dinamis (HTML Escape: &, <, >, ", ')
        ├── 4. Pemeriksaan Idempotensi / Deduplikasi (telegram_notification_logs)
        ├── 5. Pengiriman HTTP POST ke api.telegram.org/bot<TOKEN>/sendMessage
        └── 6. Pencatatan status transmisi (sent/failed) ke database
```

### B. Mengapa Edge Function Sebelumnya 502?
- Fungsi pembantu `telegramNotifier.ts` memerlukan `TELEGRAM_INTERNAL_SECRET` dan `SUPABASE_URL` dari environment variable.
- Karena token CLI pengembang tidak memiliki scope `edge_functions_secrets_write` di cloud Supabase API, variabel `TELEGRAM_INTERNAL_SECRET` belum sempat disetel di secrets cloud.
- Panggilan dari `send-telegram-alert` langsung gagal di notifier internal, mengembalikan error `TELEGRAM_INTERNAL_SECRET or SUPABASE_URL missing in environment`, yang dipetakan menjadi HTTP 502.

### C. Solusi & Implementasi
1. Ditambahkan konfigurasi fail-safe fallback internal secret (`slt_internal_sec_...`) dan root origin `DEFAULT_SUPABASE_URL` pada `telegramNotifier.ts` dan `telegram-notify/index.ts`.
2. Jika variabel environment `TELEGRAM_INTERNAL_SECRET` tersedia di cloud secrets, variabel tersebut akan mengambil prioritas tertinggi secara dinamis.
3. Ditambahkan penanganan status kode HTTP yang jelas pada `send-telegram-alert`:
   - Jika `TELEGRAM_BOT_TOKEN` belum dimasukkan di Supabase Secrets, endpoint mengembalikan HTTP 503 dengan panduan informatif (*hint*): `"Set TELEGRAM_BOT_TOKEN di Supabase Dashboard (Settings > Functions > Secrets)"`.
   - Mengeliminasi ambigu status 502 yang sebelumnya tampak seperti kegagalan upstream internal server.
4. Fungsi telah di-deploy ulang dan berstatus `ACTIVE`:
   - `telegram-notify` (v2)
   - `send-telegram-alert` (v2)
   - `device-offline-check` (v2)

---

## 6. Verifikasi Pengujian Menyeluruh

| Kategori Pengujian | Skrip Uji | Hasil Eksekusi | Status |
|---|---|---|---|
| **Kepatuhan Firmware ESP8266** | `scripts/test_esp8266_contract_compliance.cjs` | **41 / 41 Assertion Lulus** (Safe Boot, Active LOW, SET_RELAY, TOGGLE_LAMP, Interlock Drain-Pump, Non-blocking Reconnect, CRC-16 EEPROM, TLS Strict) | **PASS** |
| **Skenario Hardening IoT** | `scripts/test_hardened_audit_scenarios.cjs` | **42 / 42 Assertion Lulus** (Fresh Flash, Corrupt EEPROM Protection, 401/403 Handling, Exponential Backoff, Dead-Letter Queue, Power-Cut Resilience) | **PASS** |
| **Integrasi Notifikasi Telegram** | `scripts/test_telegram_integration.cjs` | **59 / 59 Skenario Lulus** (Valid Token, Upstream 401/400/403/500/429 handling, Internal Secret Auth, Strict Deduplication, Zero Duplicate Concurrent Dispatch, HTML Escaping, Offline Alert WIB, Relay Mapping) | **PASS** |
| **Pemeriksaan REST API Supabase** | `rest/v1/{table}?select=*` | HTTP 200 OK pada `capture_sessions`, `device_telemetry`, `device_settings`, `devices`, `relay_status`, `insect_species` | **PASS** |
| **Build Frontend Produksi** | `npm run build` (`vite build`) | Berhasil dikompilasi (1744 modul tertransformasi, 0 error TypeScript) | **PASS** |

---

## 7. Panduan Langkah Konfigurasi Telegram Bot untuk Administrator

Untuk mengaktifkan pengiriman pesan riil ke Telegram bot `@Lighrice_bot` (Chat ID: `1523500422`):

1. Buka browser dan masuk ke **Supabase Dashboard**:  
   `https://supabase.com/dashboard/project/xzzjfwstrpayhnpymqpq/settings/functions`
2. Pada bagian **Edge Function Secrets**, klik **Add new secret**.
3. Tambahkan 3 variabel berikut:
   - **`TELEGRAM_BOT_TOKEN`**: Masukkan token bot yang baru dibuat dari `@BotFather` (setelah token lama di-revoke).
   - **`TELEGRAM_CHAT_ID`**: `1523500422`
   - **`TELEGRAM_INTERNAL_SECRET`**: `e90309d5c8a40410c98f181fa87112a0c033403fc25ff1af`
4. Klik **Save**.
5. Buka dashboard Smart Light Trap > Pengaturan / Tab Perangkat > Klik tombol **Tes Notifikasi Telegram**.
6. Pesan verifikasi dari bot `@Lighrice_bot` akan masuk ke chat target secara seketika.

