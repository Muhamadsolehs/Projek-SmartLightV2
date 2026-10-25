# CHECKLIST PENGUJIAN SISTEM SMART LIGHT TRAP

## Verifikasi Integrasi Backend Supabase & Frontend React (Subang Node)

Gunakan checklist ini untuk memvalidasi seluruh fungsionalitas sistem sebelum deployment ke lingkungan produksi.

---

| No | Komponen Pengujian | Langkah Validasi | Kriteria Keberhasilan | Status |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Koneksi Frontend ke Supabase** | Periksa inisialisasi `src/lib/supabase.ts` dengan `.env` | Klien Supabase terhubung tanpa melempar runtime exception, status live terdeteksi | [x] Siap Diuji |
| **2** | **Login & Logout** | Masuk melalui modal login dengan akun demo / Supabase Auth | Pengguna berhasil diautentikasi, sesi tersimpan di storage lokal, avatar & role tampil di Header | [x] Siap Diuji |
| **3** | **Protected Routes** | Buka URL dashboard dalam status unauthenticated | Akses dashboard diblokir, pengguna diarahkan ke Landing Page & LoginModal | [x] Terverifikasi |
| **4** | **Kebijakan RLS Setiap Role** | Coba query langsung dari client sebagai `viewer`, `operator`, dan `admin` | `viewer` hanya bisa membaca data; `operator` bisa update verifikasi & kirim perintah; `admin` memiliki akses penuh | [x] Terverifikasi |
| **5** | **CRUD Perangkat Sesuai Izin** | Coba ubah parameter unit melalui antarmuka atau database | Role non-admin ditolak saat menambah/menghapus unit; update status operasional diizinkan untuk operator | [x] Terverifikasi |
| **6** | **Penyimpanan Telemetri** | Kirim POST payload ke `/functions/v1/device-telemetry` | Baris baru masuk ke tabel `device_telemetry`, nilai tegangan, arus, dan kekeruhan tersimpan akurat | [x] Terverifikasi |
| **7** | **Pencegahan Duplikasi Paket** | Kirim paket telemetri dengan `sequence_number` yang sama dua kali | Server mengembalikan respon `duplicate_ignored` (HTTP 200) tanpa menambah baris duplikat | [x] Terverifikasi |
| **8** | **Pengambilan Data Dashboard** | Navigasi ke Ringkasan Lahan, Analisis Hama, Daya, dan Air | Data agregat tampil mulus, kartu KPI menghitung unit Subang, tren harian tersaji konsisten | [x] Terverifikasi |
| **9** | **Realtime Subscription** | Update baris tabel `device_telemetry` atau `devices` di database | Tampilan dashboard otomatis memperbarui data secara instan tanpa perlu reload halaman | [x] Terverifikasi |
| **10** | **Upload & Pembacaan Foto** | Upload foto serangga ke bucket privat `device-images` | Signed URL berhasil dibuat, foto dapat di-render di Galeri tanpa membuat bucket publik | [x] Terverifikasi |
| **11** | **Validasi Endpoint ESP32** | Panggil endpoint dengan token salah atau tanpa header | Server menolak dengan kode HTTP 401 Unauthorized; format JSON tidak valid menghasilkan 400 | [x] Terverifikasi |
| **12** | **Perintah & Acknowledgment** | Klik tombol "Kuras Air" atau "Ganti Lampu" dari dashboard | Perintah tersimpan dengan status `pending` -> ESP32 membaca jadi `sent` -> mengirim ACK `completed` | [x] Terverifikasi |
| **13** | **Notifikasi Telegram** | Picu kondisi ambang hama > 50 ekor atau klik tes notifikasi | Bot mengirim pesan Telegram berformat rapi; notifikasi kedua dalam 15 menit terkena cooldown | [x] Terverifikasi |
| **14** | **Error Handling Jaringan** | Putuskan koneksi internet / nonaktifkan backend sementara | Frontend menampilkan indikator status offline dengan graceful fallback ke cache lokal | [x] Terverifikasi |
| **15** | **Responsivitas & UI** | Uji navigasi di layar smartphone, tablet, dan desktop | Sidebar tetap fixed, scrolling konten utama independen, tidak ada layout shift | [x] Terverifikasi |
| **16** | **Build & TypeScript Lint** | Jalankan `npm run lint` dan `npm run build` di terminal | TypeScript lulus zero error (`tsc --noEmit`), Vite build menghasilkan bundle produksi bersih | [x] Lulus (0 Error) |
