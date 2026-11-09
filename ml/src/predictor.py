"""
Pest Detection Predictor for Smart Light Trap.
Performs object detection, bounding box visualization, and pest counting on new field images.
"""

import os
from pathlib import Path
from typing import Dict, List, Any, Optional
import cv2
import numpy as np
import torch


class PestPredictor:
    def __init__(
        self,
        model_path: str,
        conf_threshold: float = 0.25,
        iou_threshold: float = 0.45,
        device: str = "auto",
    ):
        self.model_path = str(Path(model_path).resolve())
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model checkpoint not found: {self.model_path}")

        from ultralytics import YOLO
        self.model = YOLO(self.model_path)
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        
        if device == "auto":
            self.device = "0" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

    def predict(
        self,
        image_path: str,
        save_dir: Optional[str] = "runs/predict",
        visualize: bool = True,
    ) -> Dict[str, Any]:
        """
        Runs pest detection on a single image.
        Returns bounding boxes, class counts, confidence scores, and saves visual image.
        """
        resolved_img = str(Path(image_path).resolve())
        if not os.path.exists(resolved_img):
            raise FileNotFoundError(f"Image not found at: {resolved_img}")

        results = self.model.predict(
            source=resolved_img,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            device=self.device,
            save=False,
            verbose=False,
        )[0]

        boxes_data = []
        class_counts: Dict[str, int] = {}
        names = self.model.names

        for box in results.boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            xyxy = box.xyxy[0].tolist()  # [xmin, ymin, xmax, ymax]
            class_name = names.get(cls_id, f"Class_{cls_id}") if isinstance(names, dict) else names[cls_id]

            boxes_data.append({
                "class_id": cls_id,
                "class_name": class_name,
                "confidence": round(conf, 4),
                "bbox_xyxy": [round(coord, 2) for coord in xyxy],
            })

            class_counts[class_name] = class_counts.get(class_name, 0) + 1

        total_detected = len(boxes_data)

        annotated_image_path = None
        if visualize and save_dir:
            save_path = Path(save_dir).resolve()
            save_path.mkdir(parents=True, exist_ok=True)
            out_file = save_path / f"detected_{Path(resolved_img).name}"
            
            # Plot Ultralytics annotated image
            plotted_bgr = results.plot()
            cv2.imwrite(str(out_file), plotted_bgr)
            annotated_image_path = str(out_file)

        report = {
            "image_source": resolved_img,
            "annotated_image_path": annotated_image_path,
            "total_detected": total_detected,
            "pest_counts": class_counts,
            "detections": boxes_data,
        }

        # Print user-friendly output
        print("-" * 50)
        print(f"Hasil Deteksi Hama: {Path(resolved_img).name}")
        print("-" * 50)
        if class_counts:
            for pest, count in sorted(class_counts.items(), key=lambda x: -x[1]):
                print(f"- {pest}: {count}")
        else:
            print("- Tidak ada hama terdeteksi di atas threshold confidence.")
        print(f"Total terdeteksi : {total_detected}")
        if annotated_image_path:
            print(f"Gambar hasil     : {annotated_image_path}")
        print("-" * 50)

        return report

