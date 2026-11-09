# Smart Light Trap - Computer Vision Microservice & Supabase Bridge

Layanan microservice Python FastAPI dan bridge integrasi yang menangani komputasi model deteksi hama nokturnal berbasis **Ultralytics YOLOv8** pada dataset **IP102** untuk platform agritech **Smart Light Trap (Subang, Jawa Barat)**.

Layanan ini sengaja dipisahkan dari Supabase Edge Functions untuk menjamin isolasi komputasi intensif, pemanfaatan akselerasi GPU (CUDA) / CPU, kebebasan ekosistem AI (PyTorch, Ultralytics, OpenCV), dan menjaga latensi Edge Functions tetap responsif.

---

## 1. Arsitektur Taksonomi Hama PHT Subang

Microservice ini secara otomatis memetakan 102 kelas hama dataset benchmark IP102 ke skema taksonomi hama padi lokal pada tabel Supabase [`public.insect_species`](file:///d:/Projek%20Koding/Projek-SmartLightV2/supabase/migrations/00004_initial_seed.sql):

| ID Taksonomi Supabase | Nama Spesies Lokal / Ilmiah | IP102 Class ID | Klasifikasi PHT |
| :--- | :--- | :---: | :---: |
| `scirpophaga_incertulas` | Penggerek Batang Padi Kuning | Class 4 & 3 | **Target Pest (Critical)** |
| `nilaparvata_lugens` | Wereng Batang Coklat (WBC) & Wereng Padi | Class 7, 8, 9, 11 | **Target Pest (Critical)** |
| `spodoptera_frugiperda` | Ulat Grayak / Fall Armyworm | Class 23 | **Target Pest (High)** |
| `leptocorisa_oratoria` | Walang Sangit | Class 15 | **Target Pest (Medium)** |
| `cnaphalocrocis_medinalis` | Hama Putih Palsu / Penggulung Daun | Class 0 | **Target Pest (Medium)** |
| `other_neutral` | Serangga Netral / Non-Hama | Kelas lainnya (0–101) | **Neutral Insect** |

---

## 2. Struktur File

```text
services/cv_service/
├── main.py              # Server FastAPI, endpoint /health dan /detect (normalisasi persentase 0-100%)
├── bridge.py            # CLI Bridge untuk inferensi citra & transmisi otomatis ke Supabase Edge Function
├── requirements.txt     # Dependensi library (FastAPI, Uvicorn, OpenCV, Ultralytics, Requests)
└── README.md            # Dokumentasi panduan operasional
```

---

## 3. Menjalankan Server FastAPI

```bash
# Menjalankan server lokal di port 8000
py services/cv_service/main.py
```

- Endpoint Health: `GET http://localhost:8000/health`
- Endpoint Deteksi: `POST http://localhost:8000/detect` (menerima upload multipart image, menghasilkan bounding box persentase $x, y, w, h$)
- Dokumentasi Swagger UI: `http://localhost:8000/docs`

---

## 4. Menggunakan Script Bridge ke Supabase

Untuk menguji inferensi pada citra lapangan baki perangkap dan menyimulasikan transmisi payload ke Edge Function [`/device-detections`](file:///d:/Projek%20Koding/Projek-SmartLightV2/supabase/functions/device-detections/index.ts):

### Mode Simulasi (Dry Run):
```bash
py services/cv_service/bridge.py --image path/ke/foto_baki.jpg --dry-run
```

### Mode Transmisi Langsung ke Supabase:
```bash
py services/cv_service/bridge.py \
  --image path/ke/foto_baki.jpg \
  --session-id "<UUID_CAPTURE_SESSION>" \
  --supabase-url "https://<PROJECT_REF>.supabase.co" \
  --device-token "<DEVICE_ACCESS_TOKEN>"
```

Ketika target hama melewati ambang batas kontrol (`pest_threshold_per_night`), database PostgreSQL Supabase secara otomatis memicu notifikasi peringatan kritis ke bot Telegram `@Lighrice_bot`.
