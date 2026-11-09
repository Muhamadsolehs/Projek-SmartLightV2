# Dokumentasi Integrasi Telegram Bot (@Lighrice_bot) - Smart Light Trap

Dokumentasi ini menjelaskan arsitektur, konfigurasi, spesifikasi event, skema database, dan panduan operasional integrasi notifikasi Telegram Bot untuk armada **Smart Light Trap IoT System** (Subang, Jawa Barat) menggunakan backend **Supabase**.

---

## 1. Arsitektur Integrasi

```
+---------------------------------------------------------------------------------------+
|                                    PERANGKAT LAPANGAN                                  |
|                                 (ESP8266 NodeMCU / ESP32)                             |
+---------------------------------------------------------------------------------------+
        |                                   |                                   |
        | POST /device-status               | POST /device-command-ack          | POST /device-telemetry
        v                                   v                                   v
+---------------------------------------------------------------------------------------+
|                             SUPABASE EDGE FUNCTIONS (GATEWAY)                         |
|  - device-status        : Deteksi transisi offline -> online & hardware fault         |
|  - device-command-ack   : Konfirmasi eksekusi relay & water change                    |
|  - device-telemetry     : Deteksi tegangan baterai rendah & tandon air kritis          |
|  - device-offline-check : Deteksi otomatis perangkat yang melewati batas heartbeat   |
+---------------------------------------------------------------------------------------+
        |                                   |                                   |
        +-----------------------------------+-----------------------------------+
                                            |
                         (Database write commit berhasil)
                                            |
                                            v
                   Internal HTTP POST: /functions/v1/telegram-notify
                   Header: X-Internal-Secret: <TELEGRAM_INTERNAL_SECRET>
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|                    SUPABASE EDGE FUNCTION: telegram-notify (CENTRAL)                  |
|  1. Verifikasi X-Internal-Secret (Constant-time comparison)                           |
|  2. Validasi Payload (event_type, event_key, parameter)                               |
|  3. Deduplikasi Atomik di tabel public.telegram_notification_logs                     |
|  4. Pemformatan Pesan HTML & Sanitasi Karakter (HTML Entity Escaping)                |
|  5. Transmisi ke Telegram Bot API dengan AbortController Timeout (8 detik)            |
|  6. Penanganan Respon: HTTP 200, 400, 401, 403, 429 (rate-limit), 5xx                |
|  7. Pembaruan Status Pengiriman: 'pending' -> 'sent' / 'failed'                      |
+---------------------------------------------------------------------------------------+
                                            |
                                            v
                        HTTPS POST: https://api.telegram.org/bot<TOKEN>/sendMessage
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|                                  TELEGRAM BOT API                                     |
|                                Bot: @Lighrice_bot                                     |
|                             Chat ID Tujuan: 1523500422                                |
+---------------------------------------------------------------------------------------+
```

### Prinsip Desain & Keandalan:
1. **Post-Commit Dispatch:** Notifikasi Telegram hanya dipicu setelah mutasi data utama (ACK perintah, status relay, heartbeat, event audit) berhasil di-commit ke database PostgreSQL.
2. **Fail-Safe & Non-blocking:** Kegagalan jaringan atau penolakan dari Telegram Bot API **tidak pernah** menggagalkan operasi ACK perangkat atau pengendalian aktuator lapangan.
3. **Strict Deduplication:** Kolom `event_key` memiliki unique constraint di PostgreSQL untuk mencegah spam dan duplikasi pesan saat retransmisi jaringan atau race condition.
4. **Isolasi Rahasia (Zero-Leak Security):** Token bot Telegram dan secret internal hanya disimpan pada Supabase Edge Functions Secrets dan tidak pernah dikirim ke browser maupun firmware mikrokontroler.

---

## 2. Konfigurasi Supabase Secrets

Konfigurasi rahasia dikelola secara terpusat melalui Supabase CLI atau Supabase Cloud Dashboard.

### Daftar Secrets Wajib:

| Nama Secret | Deskripsi | Contoh Nilai |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Token rahasia bot yang diperoleh dari `@BotFather` | *(Token rahasia baru dari BotFather)* |
| `TELEGRAM_CHAT_ID` | ID obrolan Telegram tujuan notifikasi | `1523500422` |
| `TELEGRAM_INTERNAL_SECRET` | Kunci rahasia untuk autentikasi antar Edge Functions | *(Token acak aman 32+ karakter)* |

> [!IMPORTANT]
> **Prosedur Penggantian Token Baru:**
> 1. Buka Telegram dan kirim perintah `/revoke` ke `@BotFather` untuk membatalkan token lama.
> 2. Dapatkan token bot baru untuk `@Lighrice_bot`.
> 3. Buka obrolan dengan `@Lighrice_bot` dari akun dengan Chat ID `1523500422` dan ketik `/start`.
> 4. Simpan token baru ke Supabase Secrets menggunakan perintah CLI di bawah.

### Perintah Pemasangan Secrets via Supabase CLI:
```bash
# Hubungkan proyek jika belum terhubung
npx supabase link --project-ref xzzjfwstrpayhnpymqpq

# Set secrets pada Supabase Cloud
npx supabase secrets set TELEGRAM_BOT_TOKEN="<MASUKKAN_TOKEN_DARI_BOTFATHER>"
npx supabase secrets set TELEGRAM_CHAT_ID="1523500422"
npx supabase secrets set TELEGRAM_INTERNAL_SECRET="slt_telegram_internal_sec_2026_x99a"
```

---

## 3. Database Skema & Migrasi

Migrasi SQL tersimpan di file: [`supabase/migrations/00009_telegram_notifications.sql`](file:///supabase/migrations/00009_telegram_notifications.sql).

### Tabel: `public.telegram_notification_logs`

```sql
CREATE TABLE IF NOT EXISTS public.telegram_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key VARCHAR(255) NOT NULL UNIQUE,       -- Kunci pencegah duplikasi pesan
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,              -- Kategori event
    message TEXT NOT NULL,                        -- Format HTML pesan yang dikirim
    delivery_status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
    telegram_message_id BIGINT,                   -- Message ID resmi dari Telegram
    error_message TEXT,                           -- Keterangan error jika pengiriman gagal
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);
```

### Stored Procedure Deteksi Offline: `public.check_and_mark_offline_devices`
Fungsi atomik yang mendeteksi perangkat aktif dengan status `online` atau `warning` yang tidak mengirimkan heartbeat selama lebih dari 180 detik (3 menit), memperbarui statusnya menjadi `offline`, membuat catatan pada `device_alerts`, dan mengembalikan daftar perangkat yang terdampak untuk dikirimkan notifikasinya ke Telegram.

---

## 4. Daftar Event & Format Pesan Telegram

Seluruh pesan dikirim dengan `parse_mode: HTML` dan waktu berformat **Asia/Jakarta (WIB)**. Karakter khusus dinamis otomatis di-escape untuk mencegah malformasi tag HTML.

### 4.1 Device Online
Dipicu ketika perangkat yang sebelumnya `offline` mengirimkan heartbeat atau boot event pertama kali ke `/device-status`.

```html
🟢 <b>SMART LIGHT TRAP</b>

Perangkat berhasil terhubung.

<b>Device:</b> <code>SLT-SBG-01</code>
<b>Status:</b> ONLINE
<b>Waktu:</b> 09/11/2026, 11:15:20 WIB
```

### 4.2 Device Offline
Dipicu oleh fungsi penjadwal deteksi heartbeat `/device-offline-check` atau laporan event `NETWORK_LOSS`.

```html
🔴 <b>SMART LIGHT TRAP ALERT</b>

Perangkat tidak lagi mengirim heartbeat.

<b>Device:</b> <code>SLT-SBG-01</code>
<b>Status:</b> OFFLINE
<b>Last Seen:</b> 09/11/2026, 11:10:00 WIB
```

### 4.3 Relay Status
Dipicu setelah konfirmasi eksekusi (ACK) dari mikrokontroler untuk perintah `SET_RELAY` atau `TOGGLE_LAMP` berhasil disimpan di database.

```html
⚙️ <b>RELAY STATUS</b>

<b>Device:</b> <code>SLT-SBG-01</code>
<b>Relay:</b> Relay 3
<b>Fungsi:</b> Lampu UV
<b>Status:</b> ON
<b>Waktu:</b> 09/11/2026, 11:16:05 WIB
```

*Pemetaan Kanal Relay Hardware:*
- **Relay 1:** Pompa Pengisi Baki Air
- **Relay 2:** Katup Solenoid Drain
- **Relay 3:** Lampu UV
- **Relay 4:** Kipas Blower Aux

### 4.4 Water Change
Dipicu setelah siklus kuras dan pengisian baki hidrolik selesai atau gagal dilaporkan oleh perangkat via `/device-command-ack`.

*Format Sukses:*
```html
💧 <b>WATER CHANGE</b>

Proses penggantian air telah selesai.

<b>Device:</b> <code>SLT-SBG-01</code>
<b>Status:</b> COMPLETED
<b>Durasi:</b> 45 detik
<b>Waktu:</b> 09/11/2026, 11:18:00 WIB
```

*Format Gagal:*
```html
💧 <b>WATER CHANGE</b>

Proses penggantian air mengalami kendala.

<b>Device:</b> <code>SLT-SBG-01</code>
<b>Status:</b> FAILED
<b>Alasan:</b> Timeout sensor batas air baki
<b>Waktu:</b> 09/11/2026, 11:18:00 WIB
```

### 4.5 Low Battery Alert
Dipicu oleh telemetri daya ketika tegangan baterai berada di bawah ambang batas proteksi `battery_cutoff_threshold_v` (dilengkapi deduplikasi interval 1 jam).

```html
🔋 <b>LOW BATTERY ALERT</b>

Tegangan baterai melewati batas aman proteksi.

<b>Device:</b> <code>SLT-SBG-01</code>
<b>Tegangan:</b> 11.45 V
<b>Batas Cutoff:</b> 11.80 V
<b>Status:</b> LOW
<b>Waktu:</b> 09/11/2026, 11:20:00 WIB
```

### 4.6 Hardware Error Alert
Dipicu ketika terjadi anomali kritis hardware seperti dry-run lockout tandon air, kerusakan sensor, atau kegagalan subsistem.

```html
⚠️ <b>SMART LIGHT TRAP ERROR</b>

Terjadi gangguan pada perangkat lapangan.

<b>Device:</b> <code>SLT-SBG-01</code>
<b>Kategori:</b> DRY_RUN_LOCKOUT
<b>Detail:</b> Kapasitas tandon air tersisa 10%. Pompa diproteksi dry-run lockout.
<b>Waktu:</b> 09/11/2026, 11:22:00 WIB
```

### 4.7 Test Notification
Dipicu oleh tombol "Kirim Uji Coba Telegram" dari dashboard web atau CLI administrator.

```html
🧪 <b>Tes Integrasi Telegram Bot</b>

Bot: @Lighrice_bot
Sistem: Smart Light Trap Subang
Status: Integrasi Berfungsi Normal

<b>Target Chat ID:</b> <code>1523500422</code>
<b>Detail:</b> Pesan verifikasi operasional dari backend Supabase.
<b>Waktu:</b> 09/11/2026, 11:25:00 WIB
```

---

## 5. Panduan Deployment Supabase

Deploy fungsi migrasi dan Edge Functions ke server Supabase:

```bash
# 1. Jalankan migrasi tabel notifikasi dan fungsi offline detection
npx supabase db push

# 2. Deploy Edge Functions terkait
npx supabase functions deploy telegram-notify --no-verify-jwt
npx supabase functions deploy device-offline-check --no-verify-jwt
npx supabase functions deploy device-status --no-verify-jwt
npx supabase functions deploy device-command-ack --no-verify-jwt
npx supabase functions deploy device-telemetry --no-verify-jwt
npx supabase functions deploy send-telegram-alert --no-verify-jwt
```

---

## 6. Prosedur Pengujian untuk Administrator

Administrator memiliki dua cara praktis untuk menguji integrasi:

### Cara 1: Menggunakan Script Pengujian Otomatis (15 Skenario)
Jalankan seluruh rangkaian uji kepatuhan dan skenario error handling:
```bash
node scripts/test_telegram_integration.cjs
```
*Hasil:* 59 pemeriksaan unit dan skenario integrasi lolos tanpa error.

### Cara 2: Menggunakan CLI Pengujian Langsung ke Bot Telegram
Setelah membuat bot token baru di `@BotFather`:

1. **Uji Pengiriman Langsung ke Telegram Bot API:**
   ```bash
   node scripts/send_test_telegram.cjs --token <TELEGRAM_BOT_TOKEN> --chat 1523500422
   ```

2. **Uji Pengiriman Melalui Supabase Edge Function:**
   ```bash
   node scripts/send_test_telegram.cjs --url https://xzzjfwstrpayhnpymqpq.supabase.co --secret <TELEGRAM_INTERNAL_SECRET>
   ```

3. **Uji Melalui Web Dashboard:**
   - Masuk ke dashboard website Smart Light Trap.
   - Buka menu **Peringatan & Notifikasi** (`/alerts`).
   - Pada kartu **Integrasi Notifikasi Bot Telegram**, klik tombol **Kirim Uji Coba Telegram**.
   - Pesan verifikasi akan terkirim ke obrolan Chat ID `1523500422`.

