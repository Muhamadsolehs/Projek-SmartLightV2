"""
Format Converter: Pascal VOC to YOLO Object Detection Format.
Normalizes coordinates and generates YOLO .txt annotation lines.
"""

from typing import List, Tuple
from ml.src.dataset_parser import BoundingBox, AnnotationRecord


class YOLOConverter:
    @staticmethod
    def voc_to_yolo_bbox(
        bbox: BoundingBox,
        img_width: int,
        img_height: int,
    ) -> Tuple[int, float, float, float, float]:
        """
        Converts pixel coordinates (xmin, ymin, xmax, ymax) to normalized
        YOLO format: (class_id, x_center, y_center, width, height)
        """
        if img_width <= 0 or img_height <= 0:
            raise ValueError(f"Invalid image dimensions: {img_width}x{img_height}")

        # Clamping to ensure within image boundaries
        xmin = max(0.0, min(float(img_width), bbox.xmin))
        ymin = max(0.0, min(float(img_height), bbox.ymin))
        xmax = max(0.0, min(float(img_width), bbox.xmax))
        ymax = max(0.0, min(float(img_height), bbox.ymax))

        box_w = xmax - xmin
        box_h = ymax - ymin

        x_center = (xmin + (box_w / 2.0)) / float(img_width)
        y_center = (ymin + (box_h / 2.0)) / float(img_height)
        norm_w = box_w / float(img_width)
        norm_h = box_h / float(img_height)

        # Numerical stabilization clamp in [0.0, 1.0]
        x_center = max(0.0, min(1.0, x_center))
        y_center = max(0.0, min(1.0, y_center))
        norm_w = max(0.0, min(1.0, norm_w))
        norm_h = max(0.0, min(1.0, norm_h))

        return (bbox.class_id, round(x_center, 6), round(y_center, 6), round(norm_w, 6), round(norm_h, 6))

    @staticmethod
    def record_to_yolo_lines(record: AnnotationRecord) -> List[str]:
        """
        Converts an entire AnnotationRecord into list of formatted YOLO string lines.
        Returns empty list if no valid boxes exist.
        """
        lines = []
        for box in record.boxes:
            if not box.is_valid:
                continue
            cid, xc, yc, w, h = YOLOConverter.voc_to_yolo_bbox(box, record.width, record.height)
            lines.append(f"{cid} {xc:.6f} {yc:.6f} {w:.6f} {h:.6f}")
        return lines

