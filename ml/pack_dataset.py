#!/usr/bin/env python3
"""
CLI Tool: Fast Pack IP102 YOLO Dataset into a Single ZIP Archive for Google Colab / Kaggle.
Creates IP102_YOLO.zip containing images/, labels/, and data.yaml.
Uses high-performance system archiver (tar.exe) if available, with fallback to Python zipfile.
"""

import os
import sys
import shutil
import subprocess
import zipfile
from pathlib import Path
from tqdm import tqdm


def pack_dataset(
    source_dir: str = "datasets/IP102_YOLO",
    output_zip: str = "IP102_YOLO.zip",
):
    src_path = Path(source_dir).resolve()
    if not src_path.exists():
        print(f"[ERROR] Direktori sumber dataset tidak ditemukan: {src_path}")
        print("Silakan jalankan preparasi dataset terlebih dahulu: py ml/prepare_dataset.py")
        sys.exit(1)

    out_path = Path(output_zip).resolve()
    print("=" * 60)
    print(" PENGEMASAN DATASET IP102 YOLO KE GOOGLE DRIVE ARSIP ZIP")
    print("=" * 60)
    print(f"Sumber Dataset : {src_path}")
    print(f"Target Arsip   : {out_path}")
    print("=" * 60)

    # Check if system tar.exe is available for ultra-fast multi-core C compression
    tar_exe = shutil.which("tar")
    if tar_exe:
        print(f"Menggunakan system archiver berkecepatan tinggi: {tar_exe}...")
        cmd = [
            tar_exe,
            "-a",
            "-cf",
            str(out_path),
            "-C",
            str(src_path.parent),
            src_path.name,
        ]
        ret = subprocess.run(cmd)
        if ret.returncode == 0 and out_path.exists():
            size_mb = out_path.stat().st_size / (1024 * 1024)
            print("=" * 60)
            print(f"✓ SELESAI! File arsip siap: {out_path}")
            print(f"Ukuran Arsip: {size_mb:.2f} MB")
            print("=" * 60)
            return

    # Fallback to Python zipfile with fast STORED or level 1 compression
    print("Menggunakan modul zipfile Python (Fast Compression)...")
    all_files = []
    for root, dirs, files in os.walk(src_path):
        for f in files:
            full_p = Path(root) / f
            rel_p = full_p.relative_to(src_path.parent)
            all_files.append((full_p, rel_p))

    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED, compresslevel=1) as zf:
        for full_p, rel_p in tqdm(all_files, desc="Mengompresi file", unit="file"):
            zf.write(full_p, arcname=str(rel_p))

    size_mb = out_path.stat().st_size / (1024 * 1024)
    print("=" * 60)
    print(f"✓ SELESAI! File arsip siap: {out_path}")
    print(f"Ukuran Arsip: {size_mb:.2f} MB")
    print("=" * 60)


if __name__ == "__main__":
    pack_dataset()
