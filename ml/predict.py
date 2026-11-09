#!/usr/bin/env python3
"""
CLI Tool: Pest Detection Predictor on New Images for Smart Light Trap.
Takes a new image, performs object detection, draws bounding boxes with confidence,
and provides total counts per pest category.
"""

import os
import sys
import argparse
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.src.predictor import PestPredictor


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run Pest Detection and Counting on New Field Images"
    )
    parser.add_argument(
        "--source",
        type=str,
        required=True,
        help="Path to input image (or folder of images)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="runs/detect/ip102_training/weights/best.pt",
        help="Path to trained YOLOv8 model weights (default: runs/detect/ip102_training/weights/best.pt)",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="Confidence threshold (default: 0.25)",
    )
    parser.add_argument(
        "--iou",
        type=float,
        default=0.45,
        help="NMS IoU threshold (default: 0.45)",
    )
    parser.add_argument(
        "--save-dir",
        type=str,
        default="runs/predict",
        help="Directory to save annotated visualization images (default: runs/predict)",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="auto",
        help="Device to run inference ('0', 'cpu', 'auto')",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    # Model presence check
    model_path = args.model
    if not os.path.exists(model_path):
        # Check fallback to yolov8n.pt if best.pt not trained yet
        if os.path.exists("yolov8n.pt"):
            print(f"[INFO] Model {model_path} belum ditemukan. Menggunakan baseline yolov8n.pt...")
            model_path = "yolov8n.pt"
        else:
            print(f"\n[ERROR] Model weights tidak ditemukan pada: {model_path}")
            print("Silakan latih model terlebih dahulu dengan:")
            print("  py ml/train.py")
            sys.exit(1)

    source_path = Path(args.source)
    if not source_path.exists():
        print(f"\n[ERROR] File atau folder gambar sumber tidak ditemukan: {args.source}")
        sys.exit(1)

    predictor = PestPredictor(
        model_path=model_path,
        conf_threshold=args.conf,
        iou_threshold=args.iou,
        device=args.device,
    )

    if source_path.is_file():
        image_files = [source_path]
    else:
        valid_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        image_files = [f for f in source_path.iterdir() if f.suffix.lower() in valid_exts]

    if not image_files:
        print(f"[ERROR] Tidak ada file gambar yang didukung pada: {source_path}")
        sys.exit(1)

    print("=" * 60)
    print(" INFERENSI DETEKSI & PENGHITUNGAN HAMA — SMART LIGHT TRAP")
    print("=" * 60)
    print(f"Model       : {model_path}")
    print(f"Input       : {source_path} ({len(image_files)} gambar)")
    print(f"Confidence  : {args.conf}")
    print(f"Output Dir  : {args.save_dir}")
    print("=" * 60)

    for img_p in image_files:
        predictor.predict(
            image_path=str(img_p),
            save_dir=args.save_dir,
            visualize=True,
        )


if __name__ == "__main__":
    main()

