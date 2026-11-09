"""
YOLOv8 Model Training Module for Smart Light Trap Pest Detection.
Manages training lifecycle, checkpoints, early stopping, and artifact logging.
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional
import torch


class YOLOv8Trainer:
    def __init__(
        self,
        base_weights: str = "yolov8n.pt",
        project_dir: str = "runs/detect",
        experiment_name: str = "ip102_training",
    ):
        self.base_weights = base_weights
        self.project_dir = str(Path(project_dir).resolve())
        self.experiment_name = experiment_name
        self._check_environment()

    def _check_environment(self) -> None:
        """Verifies Ultralytics and PyTorch installation."""
        try:
            import ultralytics
            self.ultralytics_version = ultralytics.__version__
        except ImportError:
            raise ImportError(
                "Ultralytics is not installed. Please install it via: pip install ultralytics"
            )

    @staticmethod
    def get_optimal_device(requested_device: str = "auto") -> str:
        """
        Determines the optimal compute device.
        Defaults to CUDA GPU if available; falls back to CPU.
        """
        if requested_device != "auto":
            return requested_device

        if torch.cuda.is_available():
            device_name = torch.cuda.get_device_name(0)
            print(f"[COMPUTE] NVIDIA CUDA GPU detected: {device_name}")
            return "0"
        else:
            print("[COMPUTE] No CUDA GPU found. Falling back to CPU.")
            print("[TIP] For high-speed training on 18k+ images, consider running on Google Colab or Kaggle with a T4/A100 GPU.")
            return "cpu"

    def train(
        self,
        data_yaml: str,
        epochs: int = 50,
        patience: int = 10,
        batch_size: int = 16,
        imgsz: int = 640,
        device: str = "auto",
        optimizer: str = "auto",
        lr0: float = 0.01,
        lrf: float = 0.01,
        workers: int = 4,
        resume: bool = False,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Executes YOLOv8 model training.
        """
        from ultralytics import YOLO

        resolved_data_yaml = str(Path(data_yaml).resolve())
        if not os.path.exists(resolved_data_yaml):
            raise FileNotFoundError(f"data.yaml not found at: {resolved_data_yaml}")

        target_device = self.get_optimal_device(device)

        # On CPU, adjust batch size and workers if needed to prevent memory exhaustion
        if target_device == "cpu" and batch_size > 8:
            print(f"[ADAPT] Running on CPU with batch_size={batch_size}. Reducing to 8 to avoid RAM pressure.")
            batch_size = 8
            workers = min(workers, 2)

        print("=" * 60)
        print(" STARTING YOLOV8 MODEL TRAINING — SMART LIGHT TRAP")
        print("=" * 60)
        print(f"Base Weights : {self.base_weights}")
        print(f"Dataset      : {resolved_data_yaml}")
        print(f"Epochs       : {epochs}")
        print(f"Patience     : {patience}")
        print(f"Batch Size   : {batch_size}")
        print(f"Image Size   : {imgsz}")
        print(f"Device       : {target_device}")
        print(f"Project/Run  : {self.project_dir}/{self.experiment_name}")
        print("=" * 60)

        # Initialize and train model
        if resume:
            last_ckpt = Path(self.project_dir) / self.experiment_name / "weights" / "last.pt"
            if not last_ckpt.exists():
                raise FileNotFoundError(f"Cannot resume training: checkpoint not found at {last_ckpt}")
            print(f"[RESUME] Checkpoint ditemukan di {last_ckpt}. Melanjutkan pelatihan...")
            model = YOLO(str(last_ckpt))
            results = model.train(resume=True)
        else:
            model = YOLO(self.base_weights)
            results = model.train(
                data=resolved_data_yaml,
                epochs=epochs,
                patience=patience,
                batch=batch_size,
                imgsz=imgsz,
                device=target_device,
                optimizer=optimizer,
                lr0=lr0,
                lrf=lrf,
                workers=workers,
                project=self.project_dir,
                name=self.experiment_name,
                exist_ok=True,
                save=True,
                save_period=-1,
                plots=True,
                **kwargs,
            )

        run_path = Path(self.project_dir) / self.experiment_name
        best_pt = run_path / "weights" / "best.pt"
        last_pt = run_path / "weights" / "last.pt"
        results_csv = run_path / "results.csv"

        return {
            "run_dir": str(run_path),
            "best_pt": str(best_pt) if best_pt.exists() else None,
            "last_pt": str(last_pt) if last_pt.exists() else None,
            "results_csv": str(results_csv) if results_csv.exists() else None,
            "results_object": results,
        }

