"""
Model Evaluator for YOLOv8 Smart Light Trap Pest Detection.
Evaluates model checkpoints on validation and test splits,
computing Precision, Recall, mAP50, mAP50-95, and per-class performance metrics.
"""

import os
from pathlib import Path
from typing import Dict, Any, Optional
import pandas as pd
import torch


class YOLOv8Evaluator:
    def __init__(self, model_path: str):
        self.model_path = str(Path(model_path).resolve())
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model checkpoint not found: {self.model_path}")
        
        from ultralytics import YOLO
        self.model = YOLO(self.model_path)

    def evaluate(
        self,
        data_yaml: str,
        split: str = "val",
        imgsz: int = 640,
        batch_size: int = 16,
        conf_threshold: float = 0.25,
        iou_threshold: float = 0.60,
        device: str = "auto",
        project: str = "runs/detect",
        name: str = "eval_results",
    ) -> Dict[str, Any]:
        """
        Runs comprehensive evaluation on specified dataset split.
        """
        resolved_yaml = str(Path(data_yaml).resolve())
        if not os.path.exists(resolved_yaml):
            raise FileNotFoundError(f"data.yaml not found: {resolved_yaml}")

        target_device = "0" if (device == "auto" and torch.cuda.is_available()) else ("cpu" if device == "auto" else device)

        print("=" * 60)
        print(f" EVALUATING MODEL ON {split.upper()} SET — SMART LIGHT TRAP")
        print("=" * 60)
        print(f"Model       : {self.model_path}")
        print(f"Data YAML   : {resolved_yaml}")
        print(f"Split       : {split}")
        print(f"Conf / IoU  : {conf_threshold} / {iou_threshold}")
        print("=" * 60)

        # Run validation / evaluation
        metrics = self.model.val(
            data=resolved_yaml,
            split=split,
            imgsz=imgsz,
            batch=batch_size,
            conf=conf_threshold,
            iou=iou_threshold,
            device=target_device,
            project=project,
            name=name,
            exist_ok=True,
            plots=True,
            verbose=True,
        )

        # Extract macro metrics
        box_metrics = metrics.box
        precision = float(box_metrics.mp) if hasattr(box_metrics, "mp") else 0.0
        recall = float(box_metrics.mr) if hasattr(box_metrics, "mr") else 0.0
        map50 = float(box_metrics.map50) if hasattr(box_metrics, "map50") else 0.0
        map50_95 = float(box_metrics.map) if hasattr(box_metrics, "map") else 0.0

        # Per-class metrics
        class_summary = []
        if hasattr(box_metrics, "maps") and box_metrics.maps is not None:
            names = self.model.names
            for cid, map_val in enumerate(box_metrics.maps):
                cname = names.get(cid, f"Class_{cid}") if isinstance(names, dict) else names[cid]
                class_summary.append({
                    "class_id": cid,
                    "class_name": cname,
                    "mAP50_95": round(float(map_val), 4),
                })

        summary = {
            "model_path": self.model_path,
            "split": split,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "mAP50": round(map50, 4),
            "mAP50_95": round(map50_95, 4),
            "classes_evaluated": len(class_summary),
            "per_class_metrics": class_summary,
            "save_dir": str(metrics.save_dir) if hasattr(metrics, "save_dir") else project,
        }

        print("\n" + "=" * 60)
        print(" EVALUATION RESULTS SUMMARY")
        print("=" * 60)
        print(f"Precision (P)    : {summary['precision']:.4f}")
        print(f"Recall (R)       : {summary['recall']:.4f}")
        print(f"mAP@0.5          : {summary['mAP50']:.4f}")
        print(f"mAP@0.5:0.95     : {summary['mAP50_95']:.4f}")
        print(f"Artifacts Saved  : {summary['save_dir']}")
        print("=" * 60)

        return summary

