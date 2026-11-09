# Panduan Dataset IP102 & Konversi Pascal VOC ke YOLOv8

Panduan teknis mengenai struktur dataset benchmark **IP102: A Large-Scale Benchmark Dataset for Insect Pest Recognition** (CVPR 2019), mekanisme validasi koordinat bounding box, dan konversi ke format Ultralytics YOLOv8.

---

## 1. Metadata & Karakteristik Dataset IP102

Dataset IP102 terdiri dari **102 kategori hama pertanian** dengan distribusi ekor panjang (*natural long-tailed distribution*). Khusus untuk tugas deteksi objek (*Object Detection*), dataset dilengkapi dengan anotasi bounding box dalam format standar Pascal VOC 2007.

- **Total Gambar Deteksi**: ~18.981 gambar JPG.
- **Total Anotasi XML**: ~18.984 file XML Pascal VOC.
- **Split Resmi CVPR 2019**:
  - `trainval.txt`: 15.178 gambar (~80%)
  - `test.txt`: 3.798 gambar (~20%)

### Daftar Kelas Kunci pada Ekosistem Sawah (Smart Light Trap Subang)
| ID (0-indexed) | ID (1-indexed) | Nama Kelas (IP102) | Spesies Ilmiah / Keterangan |
| :---: | :---: | :--- | :--- |
| **7** | 8 | brown plant hopper | *Nilaparvata lugens* (Wereng Coklat) |
| **8** | 9 | white backed plant hopper | *Sogatella furcifera* (Wereng Punggung Putih) |
| **9** | 10 | small brown plant hopper | *Laodelphax striatellus* |
| **11** | 12 | rice leafhopper | *Nephotettix cincticeps* (Wereng Hijau) |
| **3** | 4 | asiatic rice borer | *Chilo suppressalis* (Penggerek Batang Padi Bergaris) |
| **4** | 5 | yellow rice borer | *Scirpophaga incertulas* (Penggerek Batang Kuning) |
| **23** | 24 | army worm | *Mythimna separata* (Ulat Grayak) |

---

## 2. Struktur Direktori Asal vs Direktori YOLO

### Struktur Awal (Pascal VOC 2007)
```text
IP102_v1.1/
├── IP102/
│   ├── classes.txt                       # Daftar 102 nama kelas hama
│   └── README.md
└── Detection/
    └── VOC2007/
        ├── Annotations/                  # File XML Pascal VOC (*.xml)
        ├── JPEGImages/                   # File citra asli (*.jpg)
        └── ImageSets/
            └── Main/
                ├── trainval.txt          # Split resmi trainval (15.178 ID)
                └── test.txt              # Split resmi test (3.798 ID)
```

### Struktur Target (Ultralytics YOLO)
```text
datasets/IP102_YOLO/
├── data.yaml                             # Konfigurasi kelas & path YOLO
├── images/
│   ├── train/                            # 80% dari trainval (~12.142 gambar)
│   ├── val/                              # 20% dari trainval (~3.036 gambar)
│   └── test/                             # 100% dari test.txt (~3.798 gambar)
└── labels/
    ├── train/                            # Anotasi *.txt per gambar
    ├── val/
    └── test/
```

---

## 3. Rumus Normalisasi Koordinat Bounding Box

Format Pascal VOC mendefinisikan bounding box menggunakan koordinat piksel absolut:
$$(x_{min}, y_{min}, x_{max}, y_{max})$$

Format Ultralytics YOLO mewajibkan koordinat ternormalisasi dalam rentang $[0.0, 1.0]$ terhadap dimensi citra $(W, H)$:
$$\text{format: } \langle \text{class\_id} \rangle \quad \langle x_{center} \rangle \quad \langle y_{center} \rangle \quad \langle w \rangle \quad \langle h \rangle$$

Rumus konversi matematis:
$$x_{center} = \frac{x_{min} + x_{max}}{2 \cdot W}$$
$$y_{center} = \frac{y_{min} + y_{max}}{2 \cdot H}$$
$$w = \frac{x_{max} - x_{min}}{W}$$
$$h = \frac{y_{max} - y_{min}}{H}$$

---

## 4. Mekanisme Validasi Koordinat & Pembersihan Data

Script `ml/src/dataset_parser.py` dan `ml/prepare_dataset.py` menerapkan aturan validasi ketat:

1. **Inverted Bounding Box Filter**: Memastikan $x_{min} < x_{max}$ dan $y_{min} < y_{max}$. Jika koordinat terbalik atau menghasilkan lebar/tinggi $\le 0$, anotasi tersebut dibatalkan dan dicatat ke log error.
2. **Boundary Clamping**: Koordinat yang melampaui batas resolusi akibat pembulatan piksel otomatis dipotong (*clamped*) ke interval $[0.0, W]$ dan $[0.0, H]$.
3. **Image Size Synchronization**: Jika tag `<width>` atau `<height>` pada file XML bernilai 0 atau tidak valid, parser langsung membaca dimensi fisik file gambar menggunakan PIL/Pillow.
4. **Anti-Hallucination Annotations**: Gambar yang tidak memiliki objek serangga valid dibiarkan kosong tanpa label (tidak dibuatkan bounding box fiktif).
5. **Pencegahan Kebocoran Data (Data Leakage)**: Himpunan irisan antara `train`, `val`, dan `test` diverifikasi bernilai kosong:
   $$\text{Train} \cap \text{Val} = \emptyset, \quad \text{Train} \cap \text{Test} = \emptyset, \quad \text{Val} \cap \text{Test} = \emptyset$$

---

## 5. Cara Menjalankan Konversi Dataset

### Mode Audit & Verifikasi Cepat
Hanya memvalidasi kelengkapan gambar dan koordinat XML tanpa menyalin file:
```bash
py ml/prepare_dataset.py --verify-only
```

### Eksekusi Konversi Penuh
```bash
py ml/prepare_dataset.py
```

### Opsi Parameter CLI Tambahan
- `--config`: Mengarahkan ke file konfigurasi YAML khusus.
- `--output-dir`: Mengubah direktori target output YOLO.
- `--val-ratio`: Mengatur rasio pembagian validasi dari data `trainval` (default: `0.20`).
- `--symlink`: Menggunakan symlink sistem berkas alih-alih menyalin fisik gambar (menghemat kapasitas hard drive).
- `--max-samples`: Membatasi jumlah sampel awal untuk keperluan uji coba cepat.

