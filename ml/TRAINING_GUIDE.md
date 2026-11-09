# Panduan Pelatihan YOLOv8 — Smart Light Trap

Panduan komprehensif pelatihan model deteksi objek hama menggunakan **Ultralytics YOLOv8** pada dataset **IP102**, baik secara lokal (CPU/GPU) maupun menggunakan akselerasi cloud (Google Colab / Kaggle GPU).

---

## 1. Konfigurasi Baseline Model

- **Arsitektur Model**: `yolov8n.pt` (YOLOv8 Nano)
  - Alasan pemilihan: Kecepatan inferensi tinggi, footprint memori minimal (~6.2 MB), dan arsitektur optimal untuk *edge deployment* di lapangan.
- **Resolusi Citra (`imgsz`)**: `640` piksel.
- **Strategi Early Stopping**: `patience=10` (pelatihan otomatis dihentikan jika mAP50-95 pada set validasi tidak meningkat dalam 10 epoch berturut-turut).
- **Checkpoints**: `best.pt` (bobot dengan skor validasi tertinggi) dan `last.pt` (bobot epoch paling akhir).

---

## 2. Pelatihan Lokal (Komputer / Laptop)

### A. Eksekusi Pelatihan Standar
```bash
py ml/train.py --epochs 50 --batch 16 --imgsz 640
```

### B. Penyesuaian Perangkat (CPU vs GPU)
Sistem script `ml/src/trainer.py` secara otomatis mendeteksi ketersediaan NVIDIA CUDA GPU:
- Jika **CUDA tersedia**: Pelatihan menggunakan GPU `device='0'` dengan `batch_size=16`.
- Jika **CUDA tidak tersedia (CPU saja)**: Script otomatis menurunkan `batch_size=8` dan mengatur `workers=2` guna mencegah kepenuhan RAM.

> [!WARNING]
> Dataset IP102 memuat lebih dari 18.000 citra. Pelatihan 50 epoch pada CPU dapat memakan waktu puluhan jam. Untuk pelatihan skala penuh berkecepatan tinggi, sangat disarankan menggunakan GPU gratis di Google Colab atau Kaggle.

### C. Melanjutkan Pelatihan Terputus (Resume)
Jika pelatihan terhenti di tengah jalan (misal mati lampu atau timeout):
```bash
py ml/train.py --resume
```

---

## 3. Panduan Pelatihan Akselerasi Cloud (Google Colab / Kaggle)

Google Colab menyediakan GPU NVIDIA T4 (16 GB VRAM) gratis yang dapat menyelesaikan 50 epoch dalam 1.5–2.5 jam.

### Langkah-Langkah di Google Colab:
1. Buka [Google Colab](https://colab.research.google.com/) dan ubah Runtime ke **T4 GPU** (*Runtime > Change runtime type > T4 GPU*).
2. Jalankan sel kode berikut:

```python
# 1. Clone repository atau upload folder ml & dataset
!pip install ultralytics

# 2. Verifikasi ketersediaan GPU
import torch
print("GPU Aktif:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "Hanya CPU")

# 3. Jalankan pelatihan skala penuh
from ultralytics import YOLO

model = YOLO('yolov8n.pt')
results = model.train(
    data='datasets/IP102_YOLO/data.yaml',
    epochs=50,
    patience=10,
    batch=16,
    imgsz=640,
    device=0,
    project='runs/detect',
    name='ip102_training',
    save=True,
    plots=True
)
```

3. Unduh hasil file bobot terbaik `best.pt` dari folder `runs/detect/ip102_training/weights/best.pt` ke komputer lokal Anda.

---

## 4. Struktur Output Pelatihan

Hasil proses pelatihan tersimpan pada direktori:
`runs/detect/ip102_training/`

File yang dihasilkan mencakup:
- `weights/best.pt`: Bobot model dengan akurasi tertinggi pada data validasi.
- `weights/last.pt`: Bobot model pada epoch terakhir.
- `results.csv`: Log metrik per epoch (Loss Box, Loss Class, Loss DFL, mAP50, mAP50-95).
- `confusion_matrix.png`: Matriks kebingungan antar kelas hama.
- `results.png`: Grafik kurva loss dan metrik mAP sepanjang epoch.

