#!/usr/bin/env python3
"""
CLI Tool: YOLOv8 Model Evaluation for Smart Light Trap.
Computes mAP50, mAP50-95, Precision, Recall, and per-class performance on Val / Test splits.
"""

import os
import sys
import argparse
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.src.evaluator import YOLOv8Evaluator


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate Trained YOLOv8 Model on Validation or Test Sets"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="runs/detect/ip102_training/weights/best.pt",
        help="Path to trained model weights (default: runs/detect/ip102_training/weights/best.pt)",
    )
    parser.add_argument(
        "--data",
        type=str,
        default="datasets/IP102_YOLO/data.yaml",
        help="Path to data.yaml (default: datasets/IP102_YOLO/data.yaml)",
    )
    parser.add_argument(
        "--split",
        type=str,
        default="test",
        choices=["val", "test"],
        help="Dataset split to evaluate ('val' or 'test', default: test)",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="Confidence threshold for predictions (default: 0.25)",
    )
    parser.add_argument(
        "--iou",
        type=float,
        default=0.60,
        help="IoU threshold for NMS evaluation (default: 0.60)",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Evaluation image resolution (default: 640)",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="auto",
        help="Device to evaluate on ('0', 'cpu', 'auto')",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if not os.path.exists(args.model):
        print(f"\n[ERROR] Model weights tidak ditemukan pada: {args.model}")
        print("Silakan latih model terlebih dahulu dengan perintah:")
        print("  py ml/train.py")
        sys.exit(1)

    if not os.path.exists(args.data):
        print(f"\n[ERROR] data.yaml tidak ditemukan pada: {args.data}")
        print("Silakan siapkan dataset terlebih dahulu:")
        print("  py ml/prepare_dataset.py")
        sys.exit(1)

    evaluator = YOLOv8Evaluator(model_path=args.model)
    results = evaluator.evaluate(
        data_yaml=args.data,
        split=args.split,
        imgsz=args.imgsz,
        conf_threshold=args.conf,
        iou_threshold=args.iou,
        device=args.device,
    )

    print("\nEvaluasi selesai secara objektif tanpa mengandalkan training loss semata.")


if __name__ == "__main__":
    main()

