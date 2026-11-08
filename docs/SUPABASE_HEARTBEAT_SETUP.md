# Panduan Implementasi & Operasional: Supabase Automated Database Heartbeat

Dokumentasi teknis mekanisme heartbeat otomatis untuk proyek **Smart Light Trap IoT System** (Subang, Jawa Barat). Mekanisme ini dirancang khusus untuk memicu aktivitas database I/O secara berkala pada tier Supabase Free agar tidak terkena kebijakan auto-pause akibat ketidakaktifan (inactivity).

---

## 1. Arsitektur & Prinsip Desain

```
+-----------------------------------------------------------------------------------+
|                           EXTERNAL SCHEDULER (cron-job.org)                       |
|                     Jadwal: Setiap 12 Jam (00:00 & 12:00 UTC)                     |
+-----------------------------------------------------------------------------------+
                                         |
                       POST /functions/v1/system-heartbeat
                       Header: Authorization: Bearer <HEARTBEAT_SECRET>
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                       SUPABASE EDGE FUNCTION: system-heartbeat                    |
|  - verify_jwt = false (Dilewati di API Gateway, divalidasi mandiri di fungsi)     |
|  - Verifikasi timing-safe terhadap Deno.env.get('HEARTBEAT_SECRET')               |
|  - Menggunakan SUPABASE_SERVICE_ROLE_KEY (Hanya di server, bypass RLS)            |
+-----------------------------------------------------------------------------------+
                                         |
                       UPSERT / RPC record_system_heartbeat
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                       POSTGRESQL DATABASE: public.system_heartbeat                |
|  - Singleton row untuk service_name = 'smart-light-trap'                          |
|  - Memperbarui last_heartbeat_at (UTC) & updated_at via server trigger            |
|  - Terisolasi penuh dari armada ESP32, telemetri, dan command queue               |
+-----------------------------------------------------------------------------------+
```

### Prinsip Utama:
1. **Idempotent & Singleton:** Hanya memutasi satu baris rekaman (`service_name = 'smart-light-trap'`). Eksekusi berulang tidak menambah baris baru.
2. **Zero Fake Telemetry:** Tidak mencemari tabel `device_telemetry`, tidak memalsukan tegangan baterai, solar, air, atau deteksi hama.
3. **Eksternal Scheduler Wajib:** Scheduler menggunakan pihak luar (seperti `cron-job.org`). **Jangan** mengandalkan `pg_cron` internal sebagai satu-satunya pemicu karena database Supabase yang terlanjur paused tidak dapat menjalankan job internal.
4. **Isolasi Keamanan:** Kredensial `HEARTBEAT_SECRET` tersimpan di Supabase Secrets. `service_role` key **tidak pernah** dikirimkan ke scheduler maupun client frontend.

---

## 2. Skema Database & Migrasi SQL

File migrasi: [`supabase/migrations/00008_system_heartbeat.sql`](file:///supabase/migrations/00008_system_heartbeat.sql)

```sql
-- 1. Tabel Singleton Heartbeat
CREATE TABLE IF NOT EXISTS public.system_heartbeat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'maintenance')),
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Trigger auto-update
CREATE TRIGGER trg_system_heartbeat_updated_at
    BEFORE UPDATE ON public.system_heartbeat
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Stored Procedure Atomik (RPC)
CREATE OR REPLACE FUNCTION public.record_system_heartbeat(
    p_service_name VARCHAR(64) DEFAULT 'smart-light-trap',
    p_status VARCHAR(32) DEFAULT 'healthy',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    service_name VARCHAR(64),
    status VARCHAR(32),
    last_heartbeat_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO public.system_heartbeat (service_name, status, last_heartbeat_at, metadata, updated_at)
    VALUES (p_service_name, p_status, NOW(), p_metadata, NOW())
    ON CONFLICT (service_name) DO UPDATE
    SET status = EXCLUDED.status,
        last_heartbeat_at = NOW(),
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING 
        system_heartbeat.service_name, 
        system_heartbeat.status, 
        system_heartbeat.last_heartbeat_at, 
        system_heartbeat.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Row Level Security (RLS)
ALTER TABLE public.system_heartbeat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_heartbeat_select_authenticated" ON public.system_heartbeat
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "system_heartbeat_admin_all" ON public.system_heartbeat
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. Seed Initial Record
INSERT INTO public.system_heartbeat (service_name, status, last_heartbeat_at, metadata)
VALUES ('smart-light-trap', 'healthy', NOW(), '{"source": "initial_seed"}'::jsonb)
ON CONFLICT (service_name) DO NOTHING;
```

---

## 3. Konfigurasi Environment & Secrets

### Secret Baru yang Dibutuhkan:
| Nama Secret | Lokasi Penyimpanan | Kegunaan | Contoh Nilai |
|-------------|--------------------|----------|--------------|
| `HEARTBEAT_SECRET` | Supabase Edge Function Secrets | Token autentikasi antara cron-job.org dan Edge Function | `slt_hb_sec_3f8a91b2c7e4...` (32+ karakter acak) |

### Cara Mengatur Secret di Supabase:
Jalankan melalui terminal pengembang:
```bash
# Buat string secret acak yang kuat (misalnya menggunakan openssl atau crypto)
# Simpan secret ke Supabase Edge Functions:
npx supabase secrets set HEARTBEAT_SECRET="slt_hb_sec_MasukanKarakterAcak32DigitDiSini"
```

Atau melalui Supabase Dashboard:
1. Masuk ke **Supabase Dashboard** -> Proyek Anda.
2. Buka menu **Project Settings** -> **Edge Functions**.
3. Pada bagian **Secrets**, klik **Add new secret**:
   - Name: `HEARTBEAT_SECRET`
   - Value: `<kunci-rahasia-yang-dibuat>`

> [!CAUTION]
> Jangan pernah menggunakan `VITE_SUPABASE_ANON_KEY` atau `SUPABASE_SERVICE_ROLE_KEY` sebagai nilai `HEARTBEAT_SECRET`. Anon key dapat dibaca publik di bundle web, sedangkan service role key memiliki izin penuh dan tidak boleh diserahkan ke pihak ketiga.

---

## 4. Panduan Konfigurasi Eksternal Scheduler (cron-job.org)

Layanan gratis [cron-job.org](https://cron-job.org) digunakan untuk memanggil endpoint setiap 12 jam.

### Langkah-langkah Pembuatan Job:
1. Masuk / Daftar di [cron-job.org](https://cron-job.org).
2. Klik tombol **Create Cronjob**.
3. Isi parameter konfigurasi berikut:
   - **Title**: `Smart Light Trap - Supabase Keep Alive Heartbeat`
   - **URL**: `https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/system-heartbeat`  
     *(Ganti `<YOUR-PROJECT-REF>` dengan ref proyek Supabase Anda, misal: `nrskcmbnctpdxywhigtu`)*
   - **Execution Schedule**:
     - Pilih **Every 12 hours** (Dua kali sehari, misalnya pukul 00:00 dan 12:00 UTC).
     - Atau gunakan Cron Expression: `0 0,12 * * *`.
   - **Request Method**: Pilih `POST`.
4. Buka tab **Advanced** / **Headers**:
   - Tambahkan Header:
     - Key: `Content-Type`  
       Value: `application/json`
     - Key: `Authorization`  
       Value: `Bearer <HEARTBEAT_SECRET_ANDA>`  
       *(Atau gunakan header `x-heartbeat-secret: <HEARTBEAT_SECRET_ANDA>`)*
5. Tab **Body**:
   - Masukkan JSON identitas pemanggil (opsional):
     ```json
     {
       "trigger": "cron-job.org",
       "client": "smart-light-trap-scheduler"
     }
     ```
6. Pengaturan Notifikasi Kegagalan:
   - Aktifkan **Failure notifications** ke email jika request menghasilkan status bukan 200 (misal status 401 atau 500).
7. Klik **Save**.

---

## 5. Prosedur Rotasi Secret (Secret Rotation)

Jika `HEARTBEAT_SECRET` diduga terekspos atau ingin diperbarui secara berkala:
1. Buat secret baru yang unik:
   ```bash
   # Contoh pembangkitan random token di terminal:
   node -e "console.log('slt_hb_' + require('crypto').randomBytes(24).toString('hex'))"
   ```
2. Buka scheduler **cron-job.org**, perbarui header `Authorization: Bearer <SECRET_BARU>`.
3. Perbarui secret di Supabase:
   ```bash
   npx supabase secrets set HEARTBEAT_SECRET="<SECRET_BARU>"
   ```
4. Lakukan pengujian manual menggunakan cURL atau fitur "Test run" di dashboard cron-job.org untuk memastikan respons HTTP 200 OK.

---

## 6. Prosedur Pengujian Manual (Manual Testing)

Anda dapat menguji endpoint secara langsung menggunakan cURL atau PowerShell:

### A. Uji Request Berhasil (Valid Secret)
```bash
curl -i -X POST "https://<PROJECT-REF>.supabase.co/functions/v1/system-heartbeat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <HEARTBEAT_SECRET>" \
  -d '{"trigger": "manual_test"}'
```
**Respons yang diharapkan:**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "System heartbeat recorded successfully",
  "data": {
    "service_name": "smart-light-trap",
    "status": "healthy",
    "last_heartbeat_at": "2026-11-08T07:30:15.123Z",
    "updated_at": "2026-11-08T07:30:15.123Z"
  }
}
```

### B. Uji Penolakan Secret Salah (Invalid Secret)
```bash
curl -i -X POST "https://<PROJECT-REF>.supabase.co/functions/v1/system-heartbeat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_secret_token"
```
**Respons yang diharapkan:**
```json
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "Unauthorized: Invalid or missing heartbeat secret"
}
```

### C. Uji Penolakan Method GET (Method Not Allowed)
```bash
curl -i -X GET "https://<PROJECT-REF>.supabase.co/functions/v1/system-heartbeat" \
  -H "Authorization: Bearer <HEARTBEAT_SECRET>"
```
**Respons yang diharapkan:**
```json
HTTP/1.1 405 Method Not Allowed
Allow: POST, OPTIONS

{
  "error": "Method not allowed. Only POST is supported."
}
```

---

## 7. Monitoring & Pemantauan di Frontend

Di frontend aplikasi **Smart Light Trap**:
1. Buka modal diagnostik melalui tombol status koneksi di Header atau modal **Status Koneksi Supabase & Uji Baca RLS**.
2. Terdapat kartu status khusus **Heartbeat Otomatis Supabase Keep-Alive (Free Tier)** yang menampilkan:
   - **Nama Layanan:** `smart-light-trap`
   - **Waktu Detak Terakhir:** Format Waktu Indonesia Barat (WIB) dan UTC ISO-8601.
   - **Indikator Kesegaran:** Badge `healthy (Aktif Terjadwal)` jika heartbeat terjadi < 24 jam terakhir.
3. **Pemberitahuan Arsitektur:** Tampilan diagnostik menegaskan bahwa heartbeat ini hanya mengukur keaktifan database PostgreSQL Supabase dan **bukan** representasi aktifnya armada ESP32 di lahan pertanian Subang.

---

## 8. Langkah-Langkah Deployment (Saat Disetujui Pengguna)

> [!NOTE]
> Sesuai batasan pengerjaan, tidak ada deployment live otomatis tanpa persetujuan pengguna. Berikut langkah-langkah yang dijalankan saat siap rilis:

1. **Terapkan Migrasi Database:**
   ```bash
   npx supabase db push
   # atau jalankan skrip supabase/migrations/00008_system_heartbeat.sql melalui SQL Editor Supabase Dashboard
   ```
2. **Deploy Edge Function:**
   ```bash
   npx supabase functions deploy system-heartbeat --no-verify-jwt
   ```
3. **Atur Secret:**
   ```bash
   npx supabase secrets set HEARTBEAT_SECRET="<YOUR_GENERATED_SECRET>"
   ```
4. **Deploy Frontend ke Vercel:**
   ```bash
   git add .
   git commit -m "feat: implement automated supabase keep-alive database heartbeat"
   git push origin main
   ```

