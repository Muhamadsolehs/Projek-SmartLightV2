#!/usr/bin/env python3
"""
CLI Tool: IP102 Dataset Preparation & YOLOv8 Converter for Smart Light Trap.
Reads Pascal VOC annotations, validates bounding boxes, and generates Ultralytics YOLO format.
"""

import os
import sys
import argparse
import yaml
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.src.dataset_parser import IP102Parser
from ml.src.splitter import IP102DatasetSplitter


def parse_args():
    parser = argparse.ArgumentParser(
        description="Convert IP102 Pascal VOC Dataset to YOLOv8 Format with Official Splits"
    )
    parser.add_argument(
        "--config",
        type=str,
        default="ml/configs/dataset_config.yaml",
        help="Path to dataset configuration YAML",
    )
    parser.add_argument(
        "--annotations-dir",
        type=str,
        default=None,
        help="Override path to Annotations/ folder",
    )
    parser.add_argument(
        "--images-dir",
        type=str,
        default=None,
        help="Override path to JPEGImages/ folder",
    )
    parser.add_argument(
        "--classes-file",
        type=str,
        default=None,
        help="Override path to classes.txt",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Override destination directory for YOLO dataset (default: datasets/IP102_YOLO)",
    )
    parser.add_argument(
        "--val-ratio",
        type=float,
        default=None,
        help="Validation split ratio from trainval (default: 0.20)",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Only inspect and validate annotations without copying files or converting",
    )
    parser.add_argument(
        "--symlink",
        action="store_true",
        help="Use symlinks instead of copying images to save disk space",
    )
    parser.add_argument(
        "--max-samples",
        type=int,
        default=None,
        help="Process only first N samples (useful for fast smoke tests)",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    # Load configuration
    config_path = Path(args.config)
    cfg = {}
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}

    raw_cfg = cfg.get("raw_dataset", {})
    yolo_cfg = cfg.get("yolo_dataset", {})

    annotations_dir = args.annotations_dir or raw_cfg.get("annotations_dir", "IP102_v1.1/Detection/VOC2007/Annotations")
    images_dir = args.images_dir or raw_cfg.get("images_dir", "IP102_v1.1/Detection/VOC2007/JPEGImages")
    classes_file = args.classes_file or raw_cfg.get("classes_file", "IP102_v1.1/IP102/classes.txt")
    trainval_split = raw_cfg.get("trainval_split", "IP102_v1.1/Detection/VOC2007/ImageSets/Main/trainval.txt")
    test_split = raw_cfg.get("test_split", "IP102_v1.1/Detection/VOC2007/ImageSets/Main/test.txt")

    output_dir = args.output_dir or yolo_cfg.get("output_dir", "datasets/IP102_YOLO")
    val_ratio = args.val_ratio if args.val_ratio is not None else yolo_cfg.get("val_ratio_from_trainval", 0.20)
    seed = yolo_cfg.get("seed", 42)

    print("=" * 65)
    print(" IP102 DATASET PREPARATION & YOLO CONVERTER — SMART LIGHT TRAP")
    print("=" * 65)
    print(f"Annotations Dir : {annotations_dir}")
    print(f"Images Dir      : {images_dir}")
    print(f"Classes File    : {classes_file}")
    print(f"Target Output   : {output_dir}")
    print(f"Trainval Split  : {trainval_split}")
    print(f"Test Split      : {test_split}")
    print("=" * 65)

    # Pre-flight Check: Ensure source folders exist
    if not os.path.exists(classes_file):
        print(f"\n[ERROR] Classes file not found at: {classes_file}")
        print("Silakan pastikan file metadata IP102 classes.txt berada pada folder IP102_v1.1/IP102/classes.txt.")
        sys.exit(1)

    if not os.path.exists(annotations_dir):
        print(f"\n[ERROR] Annotations directory not found at: {annotations_dir}")
        print("Silakan letakkan folder 'Annotations' dari dataset IP102 VOC2007 pada lokasi berikut:")
        print(f"  -> {os.path.abspath(annotations_dir)}")
        sys.exit(1)

    if not os.path.exists(images_dir):
        print(f"\n[ERROR] Images directory not found at: {images_dir}")
        print("Silakan letakkan folder 'JPEGImages' dari dataset IP102 VOC2007 pada lokasi berikut:")
        print(f"  -> {os.path.abspath(images_dir)}")
        sys.exit(1)

    # 1. Initialize Parser & Inspect Annotations
    print("\n[STEP 1/3] Parsing metadata kelas & validasi anotasi Pascal VOC...")
    parser = IP102Parser(
        classes_file=classes_file,
        annotations_dir=annotations_dir,
        images_dir=images_dir,
    )
    print(f"✓ Berhasil memuat {len(parser.class_names)} nama kelas dari metadata IP102.")

    metrics = parser.inspect_dataset()

    print("\n" + "-" * 50)
    print(" HASIL AUDIT INTEGRITAS DATASET IP102")
    print("-" * 50)
    print(f"Total XML ditemukan        : {metrics['total_xml_found']}")
    print(f"Anotasi XML valid          : {metrics['valid_records_count']}")
    print(f"Gambar hilang              : {metrics['missing_images_count']}")
    print(f"XML korup / tidak terbaca  : {metrics['corrupt_xml_count']}")
    print(f"Total Bounding Box valid   : {metrics['total_valid_boxes']}")
    print(f"Total Bounding Box invalid : {metrics['total_invalid_boxes']}")
    print(f"Kelas dengan < 50 data     : {len(metrics['low_data_classes'])} kelas")
    print("-" * 50)

    if metrics['low_data_classes']:
        print("\nContoh kelas dengan data sedikit (long-tail distribution):")
        for item in metrics['low_data_classes'][:5]:
            print(f"  - [{item['class_id']}] {item['class_name']}: {item['count']} bbox")

    if args.verify_only:
        print("\n[INFO] Mode verifikasi aktif (--verify-only). Selesai tanpa membuat file YOLO.")
        return

    # 2. Partition Dataset
    print("\n[STEP 2/3] Membagi dataset berdasarkan split resmi IP102...")
    records_to_split = metrics["valid_records"]
    if args.max_samples and len(records_to_split) > args.max_samples:
        print(f"[LIMIT] Membatasi konversi ke {args.max_samples} sampel pertama sesuai argumen --max-samples.")
        records_to_split = records_to_split[:args.max_samples]

    splitter = IP102DatasetSplitter(
        output_dir=output_dir,
        class_names=parser.class_names,
        trainval_split_file=trainval_split,
        test_split_file=test_split,
        val_ratio_from_trainval=val_ratio,
        seed=seed,
    )

    splits = splitter.partition_records(records_to_split)

    print("Hasil pembagian data:")
    for s_name, s_records in splits.items():
        print(f"  - {s_name.upper():<5}: {len(s_records)} gambar")

    # 3. Build YOLO Dataset Directory Structure
    print(f"\n[STEP 3/3] Mengonversi ke format YOLO dan membangun struktur direktori di {output_dir}...")
    copy_mode = not args.symlink
    result = splitter.build_yolo_dataset(splits, copy_images=copy_mode)

    print("\n" + "=" * 65)
    print(" STATUS KONVERSI DATASET YOLO SELESAI")
    print("=" * 65)
    print(f"Direktori Output : {result['output_dir']}")
    print(f"File data.yaml   : {result['data_yaml']}")
    for s_name, s_stat in result['stats'].items():
        print(f"  - {s_name.upper():<5} : {s_stat['images']} gambar | {s_stat['boxes']} bounding box")
    print("=" * 65)
    print("Dataset siap digunakan untuk pelatihan Ultralytics YOLOv8!")


if __name__ == "__main__":
    main()

