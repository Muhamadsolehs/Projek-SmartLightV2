# Smart Light Trap IoT Agritech System

> **Sistem Pemantauan Hama PHT Nokturnal Berbasis IoT, AI Computer Vision & Supabase**  
> **Wilayah Operasional:** Subang, Jawa Barat (Sentra Padi Rendengan & Gadu)

---

## 🌾 Gambaran Umum Proyek

Smart Light Trap adalah platform agritech terintegrasi untuk pengendalian hama terpadu (PHT) pada tanaman padi sawah. Sistem ini menggabungkan perangkat keras lapangan berbasis **ESP32-S3** dengan modem 4G LTE, panel surya dengan sensor **INA226**, baki air beriluminasi UV dengan pembersihan mandiri (*self-cleaning hydraulic tray*), inferensi AI **YOLOv8**, dan backend terdistribusi **Supabase**.

Aplikasi web dashboard ini menyediakan pemantauan kondisi armada perangkap secara langsung (*real-time*), analisis dinamika populasi Penggerek Batang Padi Kuning dan Wereng Batang Coklat, galeri foto baki resolusi tinggi dengan verifikasi bounding box, manajemen siklus hidraulik, serta pusat notifikasi terintegrasi bot Telegram.

---

## 🛠️ Tumpukan Teknologi

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, Three.js (simulasi 3D).
- **Backend Database**: Supabase PostgreSQL 15+ dengan Row Level Security (RLS) dan triggler otomatis.
- **Autentikasi**: Supabase Auth (Email/Password, sesi JWT persisten, proteksi role `admin`, `operator`, `viewer`).
- **Penyimpanan Foto**: Supabase Storage (bucket privat `device-images` dengan signed URL aman).
- **Pembaruan Data Instan**: Supabase Realtime (channel subscription untuk telemetri, alert, dan status armada).
- **Edge API & Endpoint IoT**: Supabase Edge Functions (Deno / TypeScript) untuk komunikasi aman ESP32-S3.
- **Hardware Lapangan**: ESP32-S3-WROOM-1, modem 4G LTE CAT-1 (SIM7600E/A7670E), sensor arus/daya INA226, sensor kekeruhan optik, katup solenoid 12V, pompa celup, kamera OV5640 5MP.
- **Layanan AI Computer Vision**: Microservice terpisah Python 3.10+ dengan FastAPI untuk komputasi inferensi YOLOv8.

---

## 📂 Struktur Direktori Proyek

```
Web-Lightrap/
├── docs/                                  # Dokumentasi teknis komprehensif
│   ├── AUDIT_AND_INTEGRATION_PLAN.md      # Laporan audit repository & rencana implementasi
│   ├── DATABASE_SCHEMA.md                 # Dokumentasi skema tabel & kamus data PostgreSQL
│   ├── API_DOCUMENTATION.md               # Spesifikasi lengkap Supabase Edge Functions
│   ├── ESP32_PAYLOAD_EXAMPLES.md          # Contoh payload JSON & kode C++ ESP32-S3
│   ├── SUPABASE_DEPLOYMENT_GUIDE.md       # Panduan langkah demi langkah setup Supabase
│   ├── TESTING_CHECKLIST.md               # 16 poin checklist pengujian sistem
│   └── UNCONNECTED_FEATURES.md            # Transparansi status keterhubungan hardware
├── services/
│   └── cv_service/                        # Microservice Computer Vision (Python FastAPI)
│       ├── main.py                        # Endpoint inferensi YOLOv8 & deteksi bounding box
│       ├── requirements.txt               # Dependencies Python
│       └── README.md                      # Panduan menjalankan service CV
├── supabase/
│   ├── functions/                         # Supabase Edge Functions (Deno / TypeScript)
│   │   ├── _shared/                       # CORS, DB client, dan verifikasi auth hardware
│   │   ├── device-telemetry/              # Ingest telemetri sensor & heartbeat
│   │   ├── device-image-upload/           # Alokasi pre-signed upload URL foto baki
│   │   ├── device-detections/             # Penerimaan hasil klasifikasi serangga & PHT
│   │   ├── device-config/                 # Pengambilan jadwal lampu & batas proteksi
│   │   ├── device-command-poll/           # Polling antrean perintah aktuator
│   │   ├── device-command-ack/            # Konfirmasi eksekusi perintah (ACK/COMPLETED)
│   │   ├── device-status/                 # Log kejadian siklus hidup (boot, offline)
│   │   └── send-telegram-alert/           # Bot notifikasi Telegram dengan deduplikasi
│   └── migrations/                        # Skema database & migrasi SQL
│       ├── 00001_initial_schema.sql       # 12 tabel utama, indeks, dan trigger
│       ├── 00002_security_rls.sql         # Kebijakan Row Level Security role
│       ├── 00003_storage_buckets.sql      # Private storage bucket device-images
│       └── 00004_initial_seed.sql         # Seed data armada Subang & master hama
├── src/                                   # Kode sumber aplikasi React
│   ├── components/                        # Komponen modular antarmuka
│   │   ├── alerts/                        # Pusat notifikasi & integrasi Telegram
│   │   ├── architecture/                  # Tampilan referensi arsitektur & API
│   │   ├── auth/                          # Modal login & proteksi autentikasi
│   │   ├── common/                        # Logo resmi, modal share
│   │   ├── devices/                       # Daftar unit Subang & modal detail telemetri
│   │   ├── energy/                        # Monitoring panel surya & baterai INA226
│   │   ├── gallery/                       # Inspeksi foto baki & koreksi bounding box
│   │   ├── landing/                       # Landing page edukatif & simulasi 3D Three.js
│   │   ├── layout/                        # Sidebar navigasi tetap & header dinamis
│   │   ├── overview/                      # Ringkasan KPI armada & tren 7 hari
│   │   ├── pests/                         # Analisis populasi PHT & matriks tindakan
│   │   ├── settings/                      # Konfigurasi operasional & cek OTA
│   │   ├── simulator/                     # Modal simulator hardware interaktif
│   │   └── water/                         # Manajemen air baki & riwayat kuras
│   ├── context/
│   │   └── DeviceContext.tsx              # State management pusat & integrasi Supabase
│   ├── data/
│   │   └── mockData.ts                    # Data fallback cadangan untuk development offline
│   ├── lib/
│   │   └── supabase.ts                    # Inisialisasi klien Supabase
│   ├── services/                          # Service layer komunikasi Supabase
│   │   ├── alertService.ts                # Layanan query alert & acknowledgment
│   │   ├── authService.ts                 # Layanan autentikasi & profil role
│   │   ├── deviceService.ts               # Layanan perangkat & perintah aktuator
│   │   ├── pestService.ts                 # Layanan sesi tangkapan & spesies hama
│   │   ├── storageService.ts              # Layanan signed URL foto privat
│   │   └── waterService.ts                # Layanan riwayat flushing baki
│   ├── types/
│   │   └── index.ts                       # Definisi antarmuka TypeScript lengkap
│   ├── App.tsx                            # Root component & route protector
│   ├── index.css                          # Konfigurasi Tailwind CSS v4
│   └── main.tsx                           # Entry point aplikasi
├── .env.example                           # Contoh variabel lingkungan
├── package.json                           # Dependensi Node.js
└── vite.config.ts                         # Konfigurasi bundler Vite
```

---

## 🚀 Memulai Aplikasi Secara Lokal

### 1. Prasyarat
- Node.js versi 18+ (disarankan Node.js 20 atau 24).
- npm, yarn, pnpm, atau bun.

### 2. Instalasi Dependensi
```bash
npm install --legacy-peer-deps
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Isi variabel dengan kredensial proyek Supabase Anda:
```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-publishable-key"
VITE_OPERATIONAL_REGION="Subang, Jawa Barat"
```
*(Catatan: Jika `.env` dibiarkan kosong, aplikasi otomatis berjalan dalam **Mode Demo / Simulator Offline** menggunakan data terkalibrasi Subang tanpa melempar error).*

### 4. Menjalankan Server Pengembangan
```bash
npm run dev
```
Buka browser di `http://localhost:3000`.

### 5. Validasi TypeScript & Build Produksi
```bash
# Validasi tipe data tanpa kompilasi:
npm run lint

# Kompilasi bundle produksi:
npm run build
```

---

## 🔒 Keamanan & Hak Akses

1. **Prinsip Hak Akses Minimal**: Kunci API publik (`anon key`) yang digunakan pada frontend dibatasi ketat oleh Row Level Security (RLS) PostgreSQL. Kunci rahasia `service_role_key` **tidak pernah** disertakan dalam kode frontend.
2. **Autentikasi Hardware IoT**: Perangkat mikrokontroler ESP32-S3 berkomunikasi melalui Supabase Edge Functions menggunakan header `X-Device-Code` dan `X-Device-Token`. Server memvalidasi token terhadap hash SHA-256 yang tersimpan dalam tabel `devices`.
3. **Penyimpanan Foto Aman**: Bucket foto baki serangga bersifat **privat**. Tampilan foto pada dashboard menggunakan **Signed URL** berbatas waktu sementara yang dibuat secara dinamis oleh backend.
4. **Keselamatan Aktuator**: Perintah menyalakan lampu atau menguras baki diproses melalui antrean perintah dengan waktu kedaluwarsa (*expiration*), dan eksekusi fisik tetap dikontrol oleh batas pengaman firmware lokal ESP32-S3 (seperti *dry-run lockout* pada pompa celup).

---

## 📖 Dokumentasi Lengkap
- [Laporan Audit & Rencana Integrasi](docs/AUDIT_AND_INTEGRATION_PLAN.md)
- [Skema Database PostgreSQL](docs/DATABASE_SCHEMA.md)
- [Spesifikasi API & Endpoint Edge Functions](docs/API_DOCUMENTATION.md)
- [Contoh Payload & Kode C++ ESP32-S3](docs/ESP32_PAYLOAD_EXAMPLES.md)
- [Panduan Deployment Supabase](docs/SUPABASE_DEPLOYMENT_GUIDE.md)
- [Checklist Pengujian 16 Poin](docs/TESTING_CHECKLIST.md)
- [Transparansi Status Keterhubungan Fitur](docs/UNCONNECTED_FEATURES.md)
