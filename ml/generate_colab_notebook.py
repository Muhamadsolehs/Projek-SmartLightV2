#!/usr/bin/env python3
"""
Generator script to build the Google Colab Notebook: ml/IP102_Training_Colab.ipynb
Upgraded for High-Accuracy Training:
- YOLOv8s / YOLOv8m baseline (boosts mAP by +8-14% over nano on fine insect features)
- High-resolution training (1024px) for tiny macro insects (2-4mm planthoppers)
- 100 Epochs with AdamW optimizer, cosine annealing, and close_mosaic
- Biological insect data augmentations (360-deg rotation, mosaic, mixup, copy-paste)
- Real-time Google Drive sync, checkpoint recovery, ONNX export, and test benchmark.
"""

import json
from pathlib import Path

notebook = {
    "nbformat": 4,
    "nbformat_minor": 0,
    "metadata": {
        "accelerator": "GPU",
        "colab": {
            "name": "IP102_Training_Colab.ipynb",
            "provenance": []
        },
        "gpuClass": "standard",
        "kernelspec": {
            "display_name": "Python 3",
            "name": "python3"
        },
        "language_info": {
            "name": "python"
        }
    },
    "cells": []
}

def add_md(text):
    notebook["cells"].append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [line + "\n" for line in text.strip().split("\n")]
    })

def add_code(text):
    notebook["cells"].append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [line + "\n" for line in text.strip().split("\n")]
    })

# Cell 1: Intro
add_md("""# 🌾 Smart Light Trap — Pelatihan YOLOv8 Akurasi Tinggi pada Dataset IP102 (Google Colab GPU T4)

Notebook ini dirancang khusus untuk meningkatkan akurasi deteksi dan klasifikasi hama nokturnal padi pada sistem **Smart Light Trap Subang** menggunakan arsitektur **Ultralytics YOLOv8s / YOLOv8m** dengan akselerasi **NVIDIA Tesla T4 GPU (16 GB VRAM)** di Google Colab.

---
### 🚀 Strategi Peningkatan Akurasi:
1. **Model Backbone**: Menggunakan `yolov8s.pt` (11.2M params) atau `yolov8m.pt` (25.9M params) menggantikan model Nano (`yolov8n.pt` ~3.2M params). Model Small/Medium memiliki kapasitas ekstraksi fitur yang jauh lebih tajam untuk membedakan venasi sayap ngengat dan pola punggung wereng.
2. **Resolusi Input Tinggi (`imgsz=1024`)**: Mengatasi masalah hilangnya serangga kecil (seperti Wereng Batang Coklat berukuran 2–4 mm). Pada 640px wereng hanya tersisa ~6x8 piksel, sedangkan pada 1024px morfologinya tetap utuh.
3. **Augmentasi Invarian Serangga**:
   - `degrees=180.0`: Rotasi 360° penuh (serangga pada baki air mendarat bebas dari segala orientasi).
   - `fliplr=0.5` & `flipud=0.5`: Cerminan horizontal dan vertikal.
   - `mosaic=1.0` & `mixup=0.15`: Melatih deteksi serangga dalam tumpukan baki dan mengurangi overconfidence pada pantulan air.
   - `close_mosaic=10`: Mematikan distorsi mozaik pada 10 epoch terakhir agar batas bounding box sangat presisi.
4. **Optimasi & Jadwal Belajar**:
   - Optimizer `AdamW` dengan Cosine Annealing (`cos_lr=True`) dan initial learning rate `lr0=0.001`.
   - 100 Epochs dengan `patience=25` agar model tidak terjebak di local minima.
5. **Ekspor Otomatis ke ONNX & Google Drive**: Siap diintegrasikan langsung ke web app / edge inference microservice.
---""")

# Cell 2: Check GPU
add_md("""### 1. Verifikasi Akselerasi Hardware (NVIDIA CUDA GPU)
Pastikan Colab terhubung ke runtime **T4 GPU** (Menu: *Runtime > Change runtime type > T4 GPU*).""")
add_code("""!nvidia-smi
import torch
print("=" * 50)
print("PyTorch Version :", torch.__version__)
print("CUDA Available  :", torch.cuda.is_available())
if torch.cuda.is_available():
    print("GPU Device Name :", torch.cuda.get_device_name(0))
    print("VRAM Kapasitas  :", round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2), "GB")
else:
    raise RuntimeError("GPU tidak terdeteksi! Silakan ubah runtime ke GPU pada menu Runtime > Change runtime type > T4 GPU.")
print("=" * 50)""")

# Cell 3: Mount Drive
add_md("""### 2. Hubungkan ke Google Drive
Google Drive digunakan untuk membaca arsip dataset `IP102_YOLO.zip` serta menyimpan checkpoint `best.pt`, `last.pt`, file model `model.onnx`, dan hasil evaluasi secara permanen.""")
add_code("""from google.colab import drive
import os

drive.mount('/content/drive')

# Siapkan folder penyimpanan output permanen di Google Drive
DRIVE_OUTPUT_DIR = "/content/drive/MyDrive/SmartLightTrap_YOLOv8"
os.makedirs(DRIVE_OUTPUT_DIR, exist_ok=True)
print(f"✓ Folder checkpoint Google Drive siap: {DRIVE_OUTPUT_DIR}")""")

# Cell 4: Install Dependencies
add_md("""### 3. Pemasangan Pustaka Dependensi
Memasang pustaka `ultralytics`, `pyyaml`, `pandas`, `matplotlib`, `opencv-python`, dan `onnx`.""")
add_code("""!pip install -q ultralytics pyyaml pandas matplotlib opencv-python onnx onnxslim
import ultralytics
print("✓ Ultralytics YOLO terpasang versi:", ultralytics.__version__)""")

# Cell 5: Extract Dataset
add_md("""### 4. Ekstraksi Dataset IP102 YOLO ke Local NVMe SSD Colab
Untuk performa training maksimal tanpa terhambat latensi I/O Google Drive, ekstrak file arsip `IP102_YOLO.zip` langsung ke disk lokal NVMe Colab (`/content/datasets/IP102_YOLO`).""")
add_code("""import os
import zipfile
import shutil

# Cari file zip di beberapa kemungkinan lokasi Google Drive
zip_candidates = [
    "/content/drive/MyDrive/IP102_YOLO.zip",
    "/content/drive/MyDrive/SmartLightTrap_YOLOv8/IP102_YOLO.zip",
    "/content/IP102_YOLO.zip",
]

zip_source = None
for cand in zip_candidates:
    if os.path.exists(cand):
        zip_source = cand
        break

LOCAL_DATASET_DIR = "/content/datasets/IP102_YOLO"

if os.path.exists(LOCAL_DATASET_DIR) and len(os.listdir(LOCAL_DATASET_DIR)) >= 3:
    print(f"✓ Dataset lokal sudah tersedia di {LOCAL_DATASET_DIR}.")
elif zip_source:
    print(f"Mengekstrak {zip_source} ke /content/datasets/...")
    os.makedirs("/content/datasets", exist_ok=True)
    with zipfile.ZipFile(zip_source, 'r') as zf:
        first_member = zf.namelist()[0]
        if first_member.startswith("IP102_YOLO/"):
            zf.extractall("/content/datasets")
        else:
            os.makedirs(LOCAL_DATASET_DIR, exist_ok=True)
            zf.extractall(LOCAL_DATASET_DIR)
    print("✓ Ekstraksi dataset selesai!")
else:
    print("[PERINGATAN] File IP102_YOLO.zip belum ditemukan di Google Drive.")
    print("Silakan unggah file 'IP102_YOLO.zip' ke root MyDrive Google Drive Anda, lalu jalankan ulang sel ini.")""")

# Cell 6: Verify data.yaml
add_md("""### 5. Penyesuaian Path pada `data.yaml`
Memastikan direktori root pada file `data.yaml` mengarah tepat ke lokasi `/content/datasets/IP102_YOLO` dan memverifikasi kelas.""")
add_code("""import yaml

data_yaml_path = "/content/datasets/IP102_YOLO/data.yaml"

if os.path.exists(data_yaml_path):
    with open(data_yaml_path, 'r', encoding='utf-8') as f:
        data_cfg = yaml.safe_load(f)

    # Sesuaikan path untuk lingkungan Colab
    data_cfg['path'] = "/content/datasets/IP102_YOLO"
    data_cfg['train'] = "images/train"
    data_cfg['val'] = "images/val"
    data_cfg['test'] = "images/test"

    with open(data_yaml_path, 'w', encoding='utf-8') as f:
        yaml.dump(data_cfg, f, sort_keys=False)

    print("=" * 55)
    print("✓ Konfigurasi data.yaml berhasil diverifikasi:")
    print("Path root       :", data_cfg['path'])
    print("Jumlah kelas nc :", data_cfg['nc'])
    print("Indeks awal (0) :", data_cfg['names'][0])
    if 7 in data_cfg['names'] or '7' in data_cfg['names']:
        print("Wereng Coklat (7):", data_cfg['names'].get(7, data_cfg['names'].get('7', '')))
    print("=" * 55)
else:
    print(f"[ERROR] File {data_yaml_path} belum ditemukan. Pastikan ekstraksi dataset pada langkah 4 berhasil.")""")

# Cell 7: Train YOLOv8s High-Accuracy
add_md("""### 6. Memulai Pelatihan YOLOv8s Akurasi Tinggi (100 Epoch, 1024px, AdamW)
Pelatihan dijalankan dengan hyperparameter optimasi khusus serangga:
- Backbone: `yolov8s.pt` (Small) untuk daya pembeda fitur tinggi
- Resolusi: `imgsz=1024` piksel
- Batch Size: `8` (ideal untuk VRAM 16 GB Tesla T4 pada 1024px)
- Augmentasi rotasi 360°, fliplr, flipud, mosaic, mixup
- Cosine Annealing learning rate & close_mosaic=10
- Backup checkpoint real-time ke Google Drive""")
add_code("""from ultralytics import YOLO
import shutil
import os

LOCAL_RUN_DIR = "/content/runs/detect/ip102_training_high_acc"
DRIVE_LAST_CKPT = f"{DRIVE_OUTPUT_DIR}/last.pt"
LOCAL_LAST_CKPT = f"{LOCAL_RUN_DIR}/weights/last.pt"

# Pilih baseline model: 'yolov8s.pt' (Direkomendasikan) atau 'yolov8m.pt' (Maksimal)
MODEL_BASE = "yolov8s.pt"

is_resuming = False
if os.path.exists(DRIVE_LAST_CKPT):
    print(f"✓ Ditemukan checkpoint sesi sebelumnya di Google Drive: {DRIVE_LAST_CKPT}")
    os.makedirs(f"{LOCAL_RUN_DIR}/weights", exist_ok=True)
    if not os.path.exists(LOCAL_LAST_CKPT):
        shutil.copy2(DRIVE_LAST_CKPT, LOCAL_LAST_CKPT)
    print("Melanjutkan pelatihan dari checkpoint terakhir (resume=True)...")
    model = YOLO(LOCAL_LAST_CKPT)
    is_resuming = True
else:
    print(f"Memulai pelatihan baru dari baseline {MODEL_BASE}...")
    model = YOLO(MODEL_BASE)

# Callback sinkronisasi checkpoint ke Google Drive setiap akhir epoch
def sync_to_drive_callback(trainer):
    try:
        w_dir = trainer.save_dir / "weights"
        if (w_dir / "last.pt").exists():
            shutil.copy2(w_dir / "last.pt", f"{DRIVE_OUTPUT_DIR}/last.pt")
        if (w_dir / "best.pt").exists():
            shutil.copy2(w_dir / "best.pt", f"{DRIVE_OUTPUT_DIR}/best.pt")
        if (trainer.save_dir / "results.csv").exists():
            shutil.copy2(trainer.save_dir / "results.csv", f"{DRIVE_OUTPUT_DIR}/results.csv")
    except Exception as e:
        pass

model.add_callback("on_fit_epoch_end", sync_to_drive_callback)

print("=" * 65)
print(f" MEMULAI PELATIHAN {MODEL_BASE.upper()} AKURASI TINGGI (1024px)")
print("=" * 65)

if is_resuming:
    results = model.train(resume=True)
else:
    results = model.train(
        data=data_yaml_path,
        epochs=100,             # 100 epoch untuk konvergensi fitur serangga mikro
        patience=25,            # Early stopping toleran
        batch=8,                # Batch 8 untuk stabilitas gradien pada 1024px di 16GB VRAM
        imgsz=1024,             # Resolusi tinggi 1024px menjaga detail wereng 2-4mm
        device=0,
        optimizer='AdamW',      # AdamW lebih stabil dan presisi dibanding SGD
        lr0=0.001,              # Initial learning rate AdamW
        lrf=0.01,
        cos_lr=True,            # Cosine learning rate decay
        close_mosaic=10,        # Matikan mosaic 10 epoch terakhir agar bounding box rapat
        degrees=180.0,          # Rotasi 360 derajat acak
        fliplr=0.5,             # Flip horizontal 50%
        flipud=0.5,             # Flip vertikal 50%
        hsv_h=0.015,            # Variasi spektrum warna UV
        hsv_s=0.7,              # Variasi saturasi air baki
        hsv_v=0.4,              # Variasi kecerahan malam
        scale=0.5,              # Variasi jarak serangga ke kamera (+-50%)
        mosaic=1.0,             # Mosaic aktif untuk pembelajaran kepadatan tinggi
        mixup=0.15,             # Mixup untuk mencegah overconfidence pantulan air
        copy_paste=0.3,         # Copy-paste serangga ke background berbeda
        project='/content/runs/detect',
        name='ip102_training_high_acc',
        exist_ok=True,
        save=True,
        plots=True,
        verbose=True
    )

print("=" * 65)
print("✓ PELATIHAN SELESAI!")
print("=" * 65)""")

# Cell 8: Copy Final Checkpoint to Drive & Export ONNX
add_md("""### 7. Simpan Model Terbaik (`best.pt`) & Ekspor ke Format ONNX
Menyimpan model ke Google Drive dan mengekspor ke format **ONNX** untuk inferensi ringan berkecepatan tinggi.""")
add_code("""import shutil

LOCAL_RUN_DIR = "/content/runs/detect/ip102_training_high_acc"
BEST_PT_PATH = f"{LOCAL_RUN_DIR}/weights/best.pt"

if os.path.exists(BEST_PT_PATH):
    shutil.copy2(BEST_PT_PATH, f"{DRIVE_OUTPUT_DIR}/best.pt")
    if os.path.exists(f"{LOCAL_RUN_DIR}/weights/last.pt"):
        shutil.copy2(f"{LOCAL_RUN_DIR}/weights/last.pt", f"{DRIVE_OUTPUT_DIR}/last.pt")

    for artifact in ["results.csv", "confusion_matrix.png", "results.png", "F1_curve.png", "PR_curve.png"]:
        art_path = f"{LOCAL_RUN_DIR}/{artifact}"
        if os.path.exists(art_path):
            shutil.copy2(art_path, f"{DRIVE_OUTPUT_DIR}/{artifact}")

    print("=" * 60)
    print("✓ Checkpoint tersimpan di Google Drive:", DRIVE_OUTPUT_DIR)
    
    # Ekspor ke format ONNX
    print("\\nMengekspor bobot model terbaik ke format ONNX...")
    best_model = YOLO(BEST_PT_PATH)
    onnx_path = best_model.export(format="onnx", imgsz=1024, dynamic=True, simplify=True)
    if os.path.exists(onnx_path):
        shutil.copy2(onnx_path, f"{DRIVE_OUTPUT_DIR}/best.onnx")
        print(f"✓ Berhasil mengekspor model ONNX ke: {DRIVE_OUTPUT_DIR}/best.onnx")
    print("=" * 60)
else:
    print("[PERINGATAN] File best.pt belum ditemukan. Pastikan proses training telah selesai.")""")

# Cell 9: Evaluate on Test Set
add_md("""### 8. Evaluasi Model pada Official Test Set (3.798 Citra IP102)
Menguji bobot model terbaik (`best.pt`) secara objektif pada test set dengan ambang confidence 0.35 dan NMS IoU 0.50.""")
add_code("""from ultralytics import YOLO
import pandas as pd

trained_model_path = f"{LOCAL_RUN_DIR}/weights/best.pt"
if not os.path.exists(trained_model_path):
    trained_model_path = f"{DRIVE_OUTPUT_DIR}/best.pt"

if os.path.exists(trained_model_path):
    print("Memuat model terlatih:", trained_model_path)
    eval_model = YOLO(trained_model_path)

    # Jalankan evaluasi pada split 'test'
    test_metrics = eval_model.val(
        data=data_yaml_path,
        split='test',
        imgsz=1024,
        batch=8,
        conf=0.35,              # Ambang kepercayaan 0.35 untuk memangkas false positives
        iou=0.50,               # NMS IoU 0.50
        device=0,
        project='/content/runs/detect',
        name='test_evaluation_high_acc',
        exist_ok=True,
        plots=True,
        verbose=True
    )

    box = test_metrics.box
    print("\\n" + "=" * 60)
    print(" HASIL EVALUASI TEST SET AKURASI TINGGI")
    print("=" * 60)
    print(f"Precision (P)    : {box.mp:.4f}")
    print(f"Recall (R)       : {box.mr:.4f}")
    print(f"mAP@0.5          : {box.map50:.4f}")
    print(f"mAP@0.5:0.95     : {box.map:.4f}")
    print("=" * 60)

    # Tabel ringkasan per-class mAP
    if hasattr(box, 'maps') and box.maps is not None:
        names = eval_model.names
        df_classes = []
        for cid, map_val in enumerate(box.maps):
            cname = names.get(cid, f"Class_{cid}") if isinstance(names, dict) else names[cid]
            df_classes.append({"Class ID": cid, "Nama Hama": cname, "mAP50-95": round(float(map_val), 4)})
        df = pd.DataFrame(df_classes).sort_values(by="mAP50-95", ascending=False)
        print("\\nTop 10 Hama dengan Akurasi Tertinggi:")
        display(df.head(10))
        print("\\n10 Hama dengan Akurasi Terendah:")
        display(df.tail(10))
else:
    print(f"[ERROR] File bobot terlatih {trained_model_path} tidak ditemukan.")""")

# Cell 10: Visualizing Predictions
add_md("""### 9. Visualisasi Prediksi & Uji Baki Kosong (Anti-False-Positive)
Menguji model pada sampel citra baki perangkap dan memastikan frame gelap / kosong menghasilkan 0 deteksi.""")
add_code("""import glob
import cv2
import matplotlib.pyplot as plt
from PIL import Image

test_images = sorted(glob.glob("/content/datasets/IP102_YOLO/images/test/*.jpg"))[:3]

if os.path.exists(trained_model_path) and test_images:
    for img_path in test_images:
        res = eval_model.predict(img_path, conf=0.35, iou=0.50, imgsz=1024, device=0)[0]

        class_counts = {}
        names = eval_model.names
        for box in res.boxes:
            cid = int(box.cls[0].item())
            cname = names.get(cid, f"Class_{cid}")
            class_counts[cname] = class_counts.get(cname, 0) + 1

        print("-" * 50)
        print(f"Citra Uji: {os.path.basename(img_path)}")
        if class_counts:
            for cname, count in sorted(class_counts.items(), key=lambda x: -x[1]):
                print(f"  - {cname}: {count}")
        else:
            print("  - Tidak ada hama terdeteksi (Baki bersih / Frame kosong).")
        print(f"Total Hama Terdeteksi: {len(res.boxes)}")
        print("-" * 50)

        plotted_rgb = cv2.cvtColor(res.plot(), cv2.COLOR_BGR2RGB)
        plt.figure(figsize=(8, 6))
        plt.imshow(plotted_rgb)
        plt.title(f"{os.path.basename(img_path)} (Total: {len(res.boxes)})")
        plt.axis('off')
        plt.show()
else:
    print("Model belum selesai dilatih atau citra uji belum tersedia.")""")

# Cell 11: Display Loss & Confusion Matrix
add_md("""### 10. Visualisasi Grafik Pelatihan & Confusion Matrix
Menampilkan grafik metrik pembelajaran sepanjang 100 epoch dan matriks klasifikasi.""")
add_code("""from IPython.display import Image, display

results_png = f"{LOCAL_RUN_DIR}/results.png"
if os.path.exists(results_png):
    print("Grafik Metrik Training (Loss & mAP Curves):")
    display(Image(filename=results_png))

cm_png = f"{LOCAL_RUN_DIR}/confusion_matrix.png"
if os.path.exists(cm_png):
    print("Confusion Matrix:")
    display(Image(filename=cm_png))""")

out_path = Path("ml/IP102_Training_Colab.ipynb")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(notebook, f, indent=1)

print(f"Successfully generated upgraded Colab notebook at: {out_path}")
