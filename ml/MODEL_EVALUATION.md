# Panduan Evaluasi Model & Analisis Metrik — Smart Light Trap

Panduan metodologis evaluasi model deteksi objek hama **YOLOv8** pada dataset **IP102** menggunakan Validation Set dan Test Set objektif.

---

## 1. Definisi Metrik Evaluasi Utama

Evaluasi tidak boleh hanya didasarkan pada penurunan *training loss*, melainkan wajib diukur menggunakan metrik deteksi standar industri pada citra yang tidak pernah dilihat model saat proses belajar (*unseen test set*):

### A. Precision (P)
Mengukur ketepatan deteksi dari seluruh hama yang diprediksi oleh model:
$$\text{Precision} = \frac{TP}{TP + FP}$$
*Jika Precision tinggi, alarm palsu (false alarm) hama di lapangan sangat minim.*

### B. Recall (R)
Mengukur kelengkapan model dalam menemukan hama yang sebenarnya ada di baki perangkap:
$$\text{Recall} = \frac{TP}{TP + FN}$$
*Jika Recall tinggi, hampir tidak ada serangga hama yang terlewat dari deteksi kamera.*

### C. mAP@0.5 (Mean Average Precision pada IoU = 0.50)
Rata-rata Average Precision (AP) seluruh 102 kelas hama ketika kotak prediksi bertumpukan minimal 50% dengan kotak anotasi asli (*Intersection over Union* $\ge 0.50$).

### D. mAP@0.5:0.95 (Metrik Utama Standar COCO)
Rata-rata AP pada rentang IoU dari 0.50 hingga 0.95 dengan interval langkah 0.05:
$$\text{mAP@[0.5:0.95]} = \frac{1}{10} \sum_{i=0}^{9} \text{AP}_{\text{IoU} = 0.50 + 0.05i}$$
*Ini merupakan indikator ketajaman dan kepresisian batas kotak deteksi yang paling ketat.*

---

## 2. Cara Menjalankan Evaluasi Model

### Evaluasi pada Test Set (3.798 citra resmi IP102)
```bash
py ml/evaluate.py --model runs/detect/ip102_training/weights/best.pt --split test --conf 0.25 --iou 0.60
```

### Evaluasi pada Validation Set
```bash
py ml/evaluate.py --model runs/detect/ip102_training/weights/best.pt --split val
```

---

## 3. Analisis Confusion Matrix & Kasus Khusus Hama Padi

Saat mengevaluasi model pada dataset IP102, perhatikan pola klasifikasi silang pada kelompok hama berordo seragam:

1. **Kelompok Wereng (Delphacidae & Cicadellidae)**:
   - *Brown plant hopper* (wereng coklat / ID 7) vs *White backed plant hopper* (wereng punggung putih / ID 8) vs *Small brown plant hopper* (ID 9).
   - Ketiganya memiliki morfologi tubuh mirip. Matriks kebingungan (*confusion matrix*) membantu mengidentifikasi apakah model memerlukan augmentasi kontras atau resolusi input lebih tinggi untuk membedakan corak sayap dan punggung.
2. **Kelompok Penggerek Batang**:
   - *Asiatic rice borer* (ID 3) vs *Yellow rice borer* (ID 4).

---

## 4. Benchmark Kecepatan Inferensi (*Latency*)

| Platform Komputasi | Resolusi Input | Model | Rata-Rata Latensi per Frame |
| :--- | :---: | :---: | :---: |
| **NVIDIA T4 GPU (Colab)** | 640x640 | YOLOv8n | ~6–10 ms (~100+ FPS) |
| **Intel Core i5 / AMD Ryzen CPU** | 640x640 | YOLOv8n | ~45–80 ms (~15 FPS) |
| **Raspberry Pi 4 / 5 (ONNX / NCNN)** | 640x640 | YOLOv8n | ~120–220 ms (~5–8 FPS) |

*Untuk implementasi Smart Light Trap di mana kamera mengambil snapshot baki setiap 15–30 menit, latensi di bawah 1 detik sudah sangat memadai untuk operasional harian.*

