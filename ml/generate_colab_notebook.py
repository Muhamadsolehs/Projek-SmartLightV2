#!/usr/bin/env python3
"""
Generator script to build the Google Colab Notebook: ml/IP102_Training_Colab.ipynb
Hardened with real-time Google Drive checkpoint sync, robust zip extraction,
automatic resume logic, comprehensive test set evaluation, and pest count visualization.
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
add_md("""# 🌾 Smart Light Trap — Pelatihan YOLOv8 pada Dataset IP102 (Google Colab GPU T4)

Notebook ini dirancang untuk melatih model **Ultralytics YOLOv8** pada benchmark dataset **IP102: A Large-Scale Benchmark Dataset for Insect Pest Recognition** (102 kelas hama pertanian) menggunakan akselerasi **NVIDIA Tesla T4 GPU (16 GB VRAM)** di Google Colab.

---
### 📋 Konfigurasi Pelatihan Resmi:
- **Arsitektur Model**: `yolov8n.pt` (YOLOv8 Nano Baseline, ~6.2 MB)
- **Dataset**: `IP102_YOLO` (102 kelas hama, 12.142 train, 3.035 val, 3.798 test)
- **Resolusi Gambar**: 640 x 640 piksel
- **Batch Size**: 16 (optimal untuk Tesla T4 16 GB, memori terpakai ~3.5 GB VRAM)
- **Epochs**: 50 epoch dengan Early Stopping (`patience=10`)
- **Penyimpanan Checkpoint**: Sinkronisasi real-time per epoch ke Google Drive (`MyDrive/SmartLightTrap_YOLOv8/`)
- **Dukungan Resume**: Otomatis dapat melanjutkan dari `last.pt` jika sesi runtime Colab terputus
- **Evaluasi Akhir**: Menguji bobot terbaik (`best.pt`) pada **Official Test Set (3.798 citra)**
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
Google Drive digunakan untuk membaca arsip dataset `IP102_YOLO.zip` serta menyimpan checkpoint `best.pt`, `last.pt`, dan hasil evaluasi secara permanen.""")
add_code("""from google.colab import drive
import os

drive.mount('/content/drive')

# Siapkan folder penyimpanan output permanen di Google Drive
DRIVE_OUTPUT_DIR = "/content/drive/MyDrive/SmartLightTrap_YOLOv8"
os.makedirs(DRIVE_OUTPUT_DIR, exist_ok=True)
print(f"✓ Folder checkpoint Google Drive siap: {DRIVE_OUTPUT_DIR}")""")

# Cell 4: Install Dependencies
add_md("""### 3. Pemasangan Pustaka Dependensi
Memasang pustaka `ultralytics`, `pyyaml`, `pandas`, `matplotlib`, dan `opencv-python`.""")
add_code("""!pip install -q ultralytics pyyaml pandas matplotlib opencv-python
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
        # Jika zip sudah memiliki root folder IP102_YOLO/
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
Memastikan direktori root pada file `data.yaml` mengarah tepat ke lokasi `/content/datasets/IP102_YOLO` dan memverifikasi 102 kelas.""")
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
    print("Wereng Coklat (7):", data_cfg['names'][7])
    print("Wereng Hijau (11):", data_cfg['names'][11])
    print("Indeks akhir(101):", data_cfg['names'][101])
    print("=" * 55)
else:
    print(f"[ERROR] File {data_yaml_path} belum ditemukan. Pastikan ekstraksi dataset pada langkah 4 berhasil.")""")

# Cell 7: Train YOLOv8n with Resume & Real-Time Drive Backup
add_md("""### 6. Memulai Pelatihan YOLOv8n Baseline (50 Epoch)
Pelatihan dijalankan dengan early stopping (`patience=10`), batch size 16, dan resolusi 640 piksel pada GPU Tesla T4.
Terdapat fitur **real-time backup per epoch** ke Google Drive dan **automatic resume** jika sesi Colab terputus sebelumnya.""")
add_code("""from ultralytics import YOLO
import shutil
import os

LOCAL_RUN_DIR = "/content/runs/detect/ip102_training"
DRIVE_LAST_CKPT = f"{DRIVE_OUTPUT_DIR}/last.pt"
LOCAL_LAST_CKPT = f"{LOCAL_RUN_DIR}/weights/last.pt"

# Periksa apakah ada checkpoint sebelumnya di Google Drive untuk resume
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
    print("Memulai pelatihan baru dari baseline yolov8n.pt...")
    model = YOLO('yolov8n.pt')

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

print("=" * 60)
print(" MEMULAI PELATIHAN YOLOV8N PADA DATASET IP102")
print("=" * 60)

if is_resuming:
    results = model.train(resume=True)
else:
    results = model.train(
        data=data_yaml_path,
        epochs=50,
        patience=10,
        batch=16,
        imgsz=640,
        device=0,
        optimizer='auto',
        lr0=0.01,
        lrf=0.01,
        project='/content/runs/detect',
        name='ip102_training',
        exist_ok=True,
        save=True,
        plots=True,
        verbose=True
    )

print("=" * 60)
print("✓ PELATIHAN SELESAI!")
print("=" * 60)""")

# Cell 8: Copy Final Checkpoint to Drive
add_md("""### 7. Simpan Model Terbaik (`best.pt`) & Seluruh Artefak ke Google Drive
Menyalin file bobot `best.pt`, `last.pt`, `results.csv`, grafik evaluasi, dan kurva metrik ke Google Drive.""")
add_code("""import shutil

LOCAL_RUN_DIR = "/content/runs/detect/ip102_training"
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
    print("✓ SELURUH CHECKPOINT DAN ARTEFAK BERHASIL DISIMPAN KE GOOGLE DRIVE!")
    print(f"Lokasi Drive: {DRIVE_OUTPUT_DIR}/")
    print("- best.pt")
    print("- last.pt")
    print("- results.csv")
    print("- confusion_matrix.png & results.png")
    print("=" * 60)
else:
    print("[PERINGATAN] File best.pt belum ditemukan. Pastikan proses training pada langkah 6 telah berjalan tuntas.")""")

# Cell 9: Evaluate on Test Set
add_md("""### 8. Evaluasi Model pada Official Test Set (3.798 Citra IP102)
Menguji performa model terlatih (`best.pt`) secara objektif pada data uji yang belum pernah dilihat saat pelatihan untuk mengukur **Precision, Recall, mAP50, dan mAP50-95**.""")
add_code("""from ultralytics import YOLO
import pandas as pd

# Gunakan model hasil training terbaik (best.pt), BUKAN yolov8n.pt pretrained
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
        imgsz=640,
        batch=16,
        conf=0.25,
        iou=0.60,
        device=0,
        project='/content/runs/detect',
        name='test_evaluation',
        exist_ok=True,
        plots=True,
        verbose=True
    )

    box = test_metrics.box
    print("\\n" + "=" * 60)
    print(" HASIL EVALUASI TEST SET (OFFICIAL IP102 BENCHMARK)")
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
        print("\\nTop 10 Hama dengan Akurasi Terendah (Data Sedikit):")
        display(df.tail(10))
else:
    print(f"[ERROR] File bobot terlatih {trained_model_path} tidak ditemukan.")""")

# Cell 10: Visualizing Predictions
add_md("""### 9. Visualisasi Prediksi & Penghitungan Populasi Hama Lapangan
Menguji model pada sampel citra baki perangkap dan menampilkan kuantitas setiap jenis hama yang terdeteksi.""")
add_code("""import glob
import cv2
import matplotlib.pyplot as plt
from PIL import Image

# Ambil 3 sampel citra dari test set
test_images = sorted(glob.glob("/content/datasets/IP102_YOLO/images/test/*.jpg"))[:3]

if os.path.exists(trained_model_path) and test_images:
    for img_path in test_images:
        res = eval_model.predict(img_path, conf=0.25, iou=0.45, device=0)[0]

        # Hitung hama per kategori
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
            print("  - Tidak ada hama terdeteksi di atas threshold confidence.")
        print(f"Total Hama Terdeteksi: {len(res.boxes)}")
        print("-" * 50)

        # Tampilkan visualisasi citra dengan bounding box
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
Menampilkan grafik metrik pembelajaran sepanjang 50 epoch dan matriks klasifikasi.""")
add_code("""from IPython.display import Image, display

# Tampilkan grafik hasil pelatihan
results_png = f"{LOCAL_RUN_DIR}/results.png"
if os.path.exists(results_png):
    print("Grafik Metrik Training (Loss & mAP Curves):")
    display(Image(filename=results_png))

# Tampilkan confusion matrix
cm_png = f"{LOCAL_RUN_DIR}/confusion_matrix.png"
if os.path.exists(cm_png):
    print("Confusion Matrix:")
    display(Image(filename=cm_png))""")

out_path = Path("ml/IP102_Training_Colab.ipynb")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(notebook, f, indent=1)

print(f"Successfully generated Colab notebook at: {out_path}")
