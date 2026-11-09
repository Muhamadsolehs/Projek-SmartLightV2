# Panduan Pelatihan YOLOv8 IP102 di Google Colab (GPU T4)

Panduan langkah demi langkah menjalankan notebook [`ml/IP102_Training_Colab.ipynb`](file:///d:/Projek%20Koding/Projek-SmartLightV2/ml/IP102_Training_Colab.ipynb) mulai dari persiapan file hingga mengunduh bobot model terbaik (`best.pt`).

---

## 1. Persiapan File Dataset (Lokal ke Google Drive)

Untuk mempercepat transfer dan ekstraksi ke Google Colab tanpa lag I/O:

1. Jalankan script pengemasan dataset di terminal lokal Anda:
   ```bash
   py ml/pack_dataset.py
   ```
   Script ini akan mengompresi folder `datasets/IP102_YOLO/` menjadi satu file arsip bernama **`IP102_YOLO.zip`** (~700–800 MB).

2. Buka [Google Drive](https://drive.google.com/) dan unggah file **`IP102_YOLO.zip`** ke folder utama (**My Drive**).

---

## 2. Membuka Notebook di Google Colab

1. Buka peramban dan akses [Google Colaboratory](https://colab.research.google.com/).
2. Pilih tab **Upload** (*Unggah*) dan pilih file notebook lokal:
   [`ml/IP102_Training_Colab.ipynb`](file:///d:/Projek%20Koding/Projek-SmartLightV2/ml/IP102_Training_Colab.ipynb)
3. Setelah notebook terbuka, aktifkan akselerator GPU T4:
   - Klik menu **Runtime** di bilah atas.
   - Pilih **Change runtime type** (*Ubah jenis runtime*).
   - Pada bagian *Hardware accelerator*, pilih **T4 GPU**.
   - Klik tombol **Save** (*Simpan*).

---

## 3. Menjalankan Sel Pelatihan Secara Berurutan

Jalankan setiap sel kode di dalam notebook secara berurutan dari atas ke bawah:

| No | Nama Sel / Langkah | Deskripsi Fungsi |
| :---: | :--- | :--- |
| **1** | **Verifikasi GPU T4** | Memastikan PyTorch mendeteksi GPU NVIDIA Tesla T4 dengan VRAM 16 GB. |
| **2** | **Hubungkan Google Drive** | Melakukan mount `/content/drive` dan membuat folder output `MyDrive/SmartLightTrap_YOLOv8/`. |
| **3** | **Pemasangan Dependensi** | Memasang `ultralytics`, `pyyaml`, `pandas`, `matplotlib`, dan `opencv-python`. |
| **4** | **Ekstraksi Dataset** | Mengekstrak `IP102_YOLO.zip` dari Google Drive langsung ke NVMe SSD Colab `/content/datasets/IP102_YOLO`. |
| **5** | **Verifikasi `data.yaml`** | Menyesuaikan path direktori dataset ke lokasi lokal `/content/datasets/IP102_YOLO` (102 kelas hama). |
| **6** | **Training YOLOv8n (50 Epoch)** | Melatih model `yolov8n.pt` dengan `batch=16`, `imgsz=640`, dan early stopping `patience=10`. Waktu pelatihan berkisar ~1.5–2 jam. |
| **7** | **Pencadangan ke Google Drive** | Otomatis mencadangkan `best.pt`, `last.pt`, `results.csv`, dan grafik ke `MyDrive/SmartLightTrap_YOLOv8/`. |
| **8** | **Evaluasi Test Set (3.798 Citra)** | Menguji model terlatih pada official test set IP102 dan menampilkan **Precision, Recall, mAP50, dan mAP50-95**. |
| **9** | **Visualisasi Prediksi Hama** | Menampilkan bounding box dan rekapitulasi kuantitas hama per kategori pada sampel uji. |
| **10**| **Kurva Loss & Confusion Matrix** | Menampilkan grafik kurva pembelajaran dan matriks kebingungan klasifikasi. |

---

## 4. Mengambil Checkpoint `best.pt` ke Komputer Lokal

Setelah pelatihan dan evaluasi selesai di Google Colab:

1. Buka Google Drive Anda pada folder **`SmartLightTrap_YOLOv8`**.
2. Unduh file **`best.pt`** dan **`results.csv`**.
3. Letakkan file bobot terbaik tersebut pada folder lokal proyek Smart Light Trap:
   `runs/detect/ip102_training/weights/best.pt`
4. Jalankan inferensi pada citra lapangan baki perangkap baru di komputer lokal:
   ```bash
   py ml/predict.py --model runs/detect/ip102_training/weights/best.pt --source path/to/sample.jpg
   ```

