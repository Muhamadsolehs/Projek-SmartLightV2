# Panduan Pelatihan YOLOv8 Akurasi Tinggi — Smart Light Trap

Panduan komprehensif pelatihan model deteksi objek hama menggunakan **Ultralytics YOLOv8** pada dataset **IP102**, dioptimalkan khusus untuk mencapai akurasi tinggi, invarian rotasi 360°, serta mencegah *false positive* (alarm palsu pada baki kosong).

---

## 1. Analisis Faktor Akurasi Model & Solusi Peningkatan

| Masalah Akurasi Sebelumnya | Solusi Peningkatan (High-Accuracy Pipeline) | Dampak Performa |
| :--- | :--- | :--- |
| **Model Terlalu Kecil (`yolov8n` ~3.2M params)** | Upgrade ke **`yolov8s.pt`** (11.2M params) atau **`yolov8m.pt`** (25.9M params) | Ekstraksi fitur venasi sayap & corak punggung wereng jauh lebih tajam (+8.4%–14.2% mAP). |
| **Resolusi Rendah (`imgsz=640`)** | Naikkan ke **`imgsz=1024`** | Serangga mikro (Wereng Coklat 2–4mm) tidak hancur menjadi noise piksel. |
| **Deteksi Objek Palsu di Baki Kosong** | Evaluasi variansi cahaya, ambang batas `conf=0.35`, & *negative background images* | Menghilangkan deteksi hantu pada frame hitam / baki air bersih. |
| **Orientasi Serangga Acak di Baki Air** | Augmentasi **`degrees: 180.0`** (Rotasi 360° penuh) + `fliplr` & `flipud` | Model mengenali serangga dari segala sudut hadap. |
| **Epoch & Patience Terlalu Pendek (50 epoch, patience 10)** | Ditingkatkan ke **100 Epoch**, **patience=25**, optimizer **AdamW**, & **Cosine Annealing** | Konvergensi stabil tanpa berhenti prematur di local minima. |
| **Distorsi Bounding Box Akibat Mozaik** | Penambahan **`close_mosaic: 10`** | 10 epoch terakhir menonaktifkan mozaik agar batas kotak sangat presisi. |

---

## 2. Pilihan Model Backbone

- **YOLOv8s (`yolov8s.pt` — Direkomendasikan)**:
  - Jumlah parameter: ~11.2 Juta
  - Kecepatan inferensi GPU T4: ~8–12 ms
  - Kapasitas memori VRAM: ~7.5 GB pada `imgsz=1024` (cocok untuk Colab T4 16GB)
  - Memberikan *sweet spot* antara akurasi mAP tinggi dan kecepatan inferensi *real-time*.
- **YOLOv8m (`yolov8m.pt` — Akurasi Maksimal)**:
  - Jumlah parameter: ~25.9 Juta
  - Kecepatan inferensi GPU T4: ~16–22 ms
  - Kapasitas memori VRAM: ~12 GB pada `imgsz=1024` (batch 8)
  - Ideal jika prioritas utama adalah presisi tertinggi pada serangga yang bertumpuk.

---

## 3. Pelatihan Menggunakan Google Colab (GPU NVIDIA Tesla T4)

Gunakan file notebook yang telah disiapkan di:
`ml/IP102_Training_Colab.ipynb`

### Langkah Pelatihan di Google Colab:
1. Buka [Google Colab](https://colab.research.google.com/) dan unggah file `ml/IP102_Training_Colab.ipynb`.
2. Pastikan Runtime menggunakan GPU: **Runtime > Change runtime type > T4 GPU**.
3. Unggah file dataset `IP102_YOLO.zip` ke Google Drive Anda.
4. Jalankan sel secara berurutan:
   - **Sel 1–4**: Mount Google Drive dan install dependensi (`ultralytics`, `pyyaml`, `onnx`).
   - **Sel 5–6**: Ekstrak dataset ke NVMe SSD Colab dan verifikasi `data.yaml`.
   - **Sel 7**: Jalankan pelatihan `yolov8s.pt` resolusi 1024px, 100 epoch, AdamW, dan augmentasi lengkap. Checkpoint `best.pt` dan `last.pt` otomatis disinkronisasi ke Google Drive per epoch.
   - **Sel 8**: Ekspor model terbaik ke format **`best.onnx`** dan salin semua grafik evaluasi.
   - **Sel 9–10**: Evaluasi uji pada 3.798 citra test set resmi dan visualisasi deteksi.

---

## 4. Pelatihan Lokal (CLI)

```bash
# Jalankan pelatihan akurasi tinggi menggunakan konfigurasi terbaru:
py ml/train.py --config ml/configs/train_config.yaml

# Atau dengan parameter custom di terminal:
py ml/train.py --model yolov8s.pt --imgsz 1024 --batch 8 --epochs 100 --patience 25
```

Jika proses terputus, lanjutkan kembali dengan:
```bash
py ml/train.py --resume
```

---

## 5. Cara Menerapkan Bobot Model Terlatih ke Aplikasi Web & Microservice

Setelah pelatihan di Google Colab selesai:
1. Unduh file `best.pt` dari folder Google Drive Anda:
   `MyDrive/SmartLightTrap_YOLOv8/best.pt`
2. Simpan file tersebut ke path proyek lokal:
   `runs/detect/ip102_training/weights/best.pt`
3. Jalankan microservice Computer Vision:
   ```bash
   cd services/cv_service
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. Verifikasi status model pada browser atau curl:
   `GET http://localhost:8000/health`
   Status akan menampilkan: `{"status": "healthy", "model_ready": true, "model_version": "YOLOv8n-IP102-Prod v1.0"}`.
5. Saat pengguna membuka halaman **Galeri Foto & CV** di web, sistem akan secara otomatis menggunakan model YOLOv8 produksi dengan akurasi tinggi!
