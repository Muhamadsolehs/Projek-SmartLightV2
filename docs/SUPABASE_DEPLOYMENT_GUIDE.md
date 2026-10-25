# PANDUAN DEPLOYMENT & SETUP SUPABASE LENGKAP

## Smart Light Trap IoT Agritech System - Subang, Jawa Barat

Panduan ini memandu langkah demi langkah menyiapkan backend Supabase dari awal hingga terhubung ke frontend React.

---

### Langkah 1: Buat Proyek Supabase Baru
1. Masuk ke [Supabase Dashboard](https://supabase.com/dashboard).
2. Klik tombol **New Project**.
3. Beri nama proyek: `smart-light-trap-subang`.
4. Pilih Region yang paling dekat dengan Indonesia (contoh: **Singapore - ap-southeast-1**).
5. Buat Database Password yang kuat dan simpan dengan aman.
6. Tunggu hingga status proyek menjadi **Active**.

---

### Langkah 2: Jalankan Database Migrations
Buka menu **SQL Editor** pada dashboard Supabase Anda, lalu jalankan file migrasi secara berurutan:

1. **`00001_initial_schema.sql`**:
   - Salin isi file [00001_initial_schema.sql](../supabase/migrations/00001_initial_schema.sql).
   - Jalankan (*Run*). Skema 12 tabel, foreign key, index, dan trigger otomatis dibuat.
2. **`00002_security_rls.sql`**:
   - Salin isi file [00002_security_rls.sql](../supabase/migrations/00002_security_rls.sql).
   - Mengaktifkan Row Level Security (RLS) pada seluruh tabel dan fungsi verifikasi token hardware.
3. **`00003_storage_buckets.sql`**:
   - Salin isi file [00003_storage_buckets.sql](../supabase/migrations/00003_storage_buckets.sql).
   - Mengonfigurasi private storage bucket `device-images` dengan batas ukuran 10MB per file dan format JPEG/PNG/WebP.
4. **`00004_initial_seed.sql`**:
   - Salin isi file [00004_initial_seed.sql](../supabase/migrations/00004_initial_seed.sql).
   - Memasukkan master hama padi Subang, data 4 unit perangkat Subang, telemetri awal, dan konfigurasi.

---

### Langkah 3: Konfigurasi Supabase Auth
1. Buka menu **Authentication** > **Providers** > **Email**.
2. Pastikan **Enable Email Provider** aktif.
3. Untuk lingkungan development, Anda dapat menonaktifkan *Confirm email* agar pendaftaran pengguna demo langsung aktif tanpa harus konfirmasi tautan email.
4. Buat akun pertama pengguna Anda melalui **Authentication** > **Users** > **Add User** (misalnya `rahmat@smarttrap.id` dengan role `operator` atau `admin`).

---

### Langkah 4: Deploy Supabase Edge Functions
Pastikan [Supabase CLI](https://supabase.com/docs/guides/cli) telah terpasang di komputer Anda.

1. Login ke Supabase CLI:
   ```bash
   npx supabase login
   ```
2. Hubungkan proyek lokal dengan proyek cloud:
   ```bash
   npx supabase link --project-ref <YOUR-PROJECT-REFERENCE-ID>
   ```
3. Set secrets environment untuk Edge Functions:
   ```bash
   npx supabase secrets set TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
   npx supabase secrets set TELEGRAM_CHAT_ID="-100xxxxxxxxxx"
   npx supabase secrets set CV_SERVICE_SECRET="slt_ai_secret_key_2026"
   ```
4. Deploy seluruh Edge Functions:
   ```bash
   npx supabase functions deploy device-telemetry --no-verify-jwt
   npx supabase functions deploy device-image-upload --no-verify-jwt
   npx supabase functions deploy device-detections --no-verify-jwt
   npx supabase functions deploy device-config --no-verify-jwt
   npx supabase functions deploy device-command-poll --no-verify-jwt
   npx supabase functions deploy device-command-ack --no-verify-jwt
   npx supabase functions deploy device-status --no-verify-jwt
   npx supabase functions deploy send-telegram-alert --no-verify-jwt
   ```
   *Catatan*: Flag `--no-verify-jwt` digunakan karena endpoint perangkat menggunakan autentikasi token khusus hardware (`X-Device-Code` dan `X-Device-Token`) yang divalidasi server-side via SHA-256 hash database, bukan user JWT browser.

---

### Langkah 5: Konfigurasi Frontend React
1. Buka menu **Project Settings** > **API** di Supabase Dashboard.
2. Salin:
   - **Project URL**
   - **anon / public key**
3. Buka file `.env` di root repository proyek React dan masukkan nilainya:
   ```env
   VITE_SUPABASE_URL="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
   VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   VITE_OPERATIONAL_REGION="Subang, Jawa Barat"
   ```
4. Jalankan aplikasi:
   ```bash
   npm run dev
   ```
5. Buka `http://localhost:3000`. Dashboard otomatis terhubung ke database cloud Supabase, mendeteksi status live armada Subang, dan mendengarkan pembaruan Realtime!
