#!/usr/bin/env python3
"""
CLI Tool: YOLOv8 Training Script for Smart Light Trap Pest Detection.
Trains baseline YOLOv8 nano model on IP102 dataset with checkpointing & early stopping.
"""

import os
import sys
import argparse
import yaml
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.src.trainer import YOLOv8Trainer


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train Ultralytics YOLOv8 on IP102 Dataset"
    )
    parser.add_argument(
        "--config",
        type=str,
        default="ml/configs/train_config.yaml",
        help="Path to training config YAML",
    )
    parser.add_argument(
        "--data",
        type=str,
        default=None,
        help="Path to data.yaml (default: from config)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Base model weights (default: yolov8n.pt)",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=None,
        help="Number of training epochs (default: from config or 50)",
    )
    parser.add_argument(
        "--batch",
        type=int,
        default=None,
        help="Batch size (default: from config or 16)",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=None,
        help="Image size (default: 640)",
    )
    parser.add_argument(
        "--device",
        type=str,
        default=None,
        help="Compute device: '0' (GPU), 'cpu', or 'auto'",
    )
    parser.add_argument(
        "--patience",
        type=int,
        default=None,
        help="Early stopping patience (epochs without improvement)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume training from last.pt checkpoint",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    # Load configuration
    cfg = {}
    config_path = Path(args.config)
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}

    model_cfg = cfg.get("model", {})
    train_cfg = cfg.get("training", {})
    aug_cfg = cfg.get("augmentations", {})

    base_weights = args.model or model_cfg.get("base_weights", "yolov8s.pt")
    data_yaml = args.data or train_cfg.get("data_yaml", "datasets/IP102_YOLO/data.yaml")
    epochs = args.epochs or train_cfg.get("epochs", 100)
    batch_size = args.batch or train_cfg.get("batch_size", 8)
    imgsz = args.imgsz or train_cfg.get("image_size", 1024)
    patience = args.patience or train_cfg.get("patience", 25)
    device = args.device or train_cfg.get("device", "auto")
    optimizer = train_cfg.get("optimizer", "AdamW")
    lr0 = train_cfg.get("lr0", 0.001)
    lrf = train_cfg.get("lrf", 0.01)
    cos_lr = train_cfg.get("cos_lr", True)
    close_mosaic = train_cfg.get("close_mosaic", 10)
    project = train_cfg.get("project", "runs/detect")
    name = train_cfg.get("name", "ip102_training_high_acc")

    # Pre-flight check: data.yaml must exist
    if not os.path.exists(data_yaml):
        print(f"\n[ERROR] data.yaml tidak ditemukan pada: {data_yaml}")
        print("Silakan jalankan script preparasi dataset terlebih dahulu:")
        print("  -> py ml/prepare_dataset.py")
        sys.exit(1)

    trainer = YOLOv8Trainer(
        base_weights=base_weights,
        project_dir=project,
        experiment_name=name,
    )

    # Gabungkan hyperparameter dan konfigurasi augmentasi
    train_kwargs = {
        "optimizer": optimizer,
        "lr0": lr0,
        "lrf": lrf,
        "cos_lr": cos_lr,
        "close_mosaic": close_mosaic,
        **aug_cfg,
    }

    results = trainer.train(
        data_yaml=data_yaml,
        epochs=epochs,
        patience=patience,
        batch_size=batch_size,
        imgsz=imgsz,
        device=device,
        resume=args.resume,
        **train_kwargs,
    )

    print("\n" + "=" * 65)
    print(" HASIL TRAINING YOLOV8 SELESAI")
    print("=" * 65)
    print(f"Direktori Eksperimen : {results['run_dir']}")
    print(f"Best Weights (Model) : {results['best_pt']}")
    print(f"Last Weights         : {results['last_pt']}")
    print(f"Training Log (CSV)   : {results['results_csv']}")
    print("=" * 65)
    print("Untuk mengevaluasi performa model pada test set, jalankan:")
    print(f"  py ml/evaluate.py --model {results['best_pt']} --split test")


if __name__ == "__main__":
    main()

