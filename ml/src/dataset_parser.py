"""
Dataset Parser and Validator for IP102 Dataset in Pascal VOC Format.
Validates bounding box coordinates, image files, and class indices.
"""

import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
from PIL import Image


@dataclass
class BoundingBox:
    class_id: int
    class_name: str
    xmin: float
    ymin: float
    xmax: float
    ymax: float
    is_valid: bool = True
    invalid_reason: Optional[str] = None


@dataclass
class AnnotationRecord:
    image_id: str
    image_path: str
    xml_path: str
    width: int
    height: int
    depth: int = 3
    boxes: List[BoundingBox] = field(default_factory=list)
    is_image_found: bool = True
    is_xml_valid: bool = True
    error_message: Optional[str] = None


class IP102Parser:
    def __init__(
        self,
        classes_file: str,
        annotations_dir: str,
        images_dir: str,
    ):
        self.classes_file = str(Path(classes_file))
        self.annotations_dir = str(Path(annotations_dir))
        self.images_dir = str(Path(images_dir))
        
        self.class_id_to_name: Dict[int, str] = {}
        self.class_name_to_id: Dict[str, int] = {}
        self.class_names: List[str] = []
        
        self.load_classes()

    def load_classes(self) -> None:
        """
        Loads classes.txt from IP102.
        File format:
          1  rice leaf roller
          2  rice leaf caterpillar
          ...
          102 Cicadellidae
        Classes are converted to 0-indexed indices (0 to 101) for YOLO compatibility.
        """
        if not os.path.exists(self.classes_file):
            raise FileNotFoundError(f"Classes file not found at: {self.classes_file}")

        with open(self.classes_file, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip()]

        self.class_names = []
        for line in lines:
            # Match: "<num> <name>"
            match = re.match(r"^(\d+)\s+(.+)$", line)
            if match:
                raw_idx = int(match.group(1))
                class_name = match.group(2).strip()
                zero_idx = raw_idx - 1  # 0-indexed
                self.class_id_to_name[zero_idx] = class_name
                self.class_name_to_id[class_name.lower()] = zero_idx
                self.class_names.append(class_name)
            else:
                # Raw name only
                zero_idx = len(self.class_names)
                self.class_id_to_name[zero_idx] = line
                self.class_name_to_id[line.lower()] = zero_idx
                self.class_names.append(line)

    def parse_class_identifier(self, raw_name: str) -> Optional[int]:
        """
        Converts the <name> tag from the XML into a 0-indexed class integer.
        In IP102, <name> is typically a string integer representing the 0-indexed class ID (e.g. '0'..'101').
        """
        raw_name = str(raw_name).strip()
        if raw_name.isdigit():
            cid = int(raw_name)
            if 0 <= cid < len(self.class_names):
                return cid
            if 1 <= cid <= len(self.class_names):
                # In case 1-based index was used
                return cid - 1
            return None

        # Check by name lookup
        low_name = raw_name.lower()
        if low_name in self.class_name_to_id:
            return self.class_name_to_id[low_name]

        return None

    def find_image_file(self, image_id: str, xml_filename: Optional[str] = None) -> Optional[str]:
        """
        Locates the image file matching image_id or filename in images_dir.
        Checks .jpg, .jpeg, .png case-insensitively.
        """
        candidates = []
        if xml_filename:
            candidates.append(os.path.join(self.images_dir, xml_filename))
        
        for ext in [".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"]:
            candidates.append(os.path.join(self.images_dir, f"{image_id}{ext}"))

        for path in candidates:
            if os.path.exists(path):
                return path

        return None

    def parse_single_xml(self, xml_path: str) -> AnnotationRecord:
        """
        Parses and validates a single Pascal VOC XML file.
        """
        image_id = Path(xml_path).stem
        record = AnnotationRecord(
            image_id=image_id,
            image_path="",
            xml_path=xml_path,
            width=0,
            height=0,
        )

        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()
        except Exception as e:
            record.is_xml_valid = False
            record.error_message = f"XML parse error: {str(e)}"
            return record

        # Read filename and dimensions
        filename_elem = root.find("filename")
        xml_filename = filename_elem.text.strip() if filename_elem is not None and filename_elem.text else None
        
        img_path = self.find_image_file(image_id, xml_filename)
        if not img_path:
            record.is_image_found = False
            record.error_message = f"Image file not found for image ID: {image_id}"
            return record
        record.image_path = img_path

        # Parse XML size
        size_elem = root.find("size")
        width, height = 0, 0
        if size_elem is not None:
            w_elem = size_elem.find("width")
            h_elem = size_elem.find("height")
            if w_elem is not None and w_elem.text and w_elem.text.isdigit():
                width = int(w_elem.text)
            if h_elem is not None and h_elem.text and h_elem.text.isdigit():
                height = int(h_elem.text)

        # Fallback to physical image size if XML size is missing or invalid
        if width <= 0 or height <= 0:
            try:
                with Image.open(img_path) as img:
                    width, height = img.size
            except Exception as e:
                record.is_image_found = False
                record.error_message = f"Cannot open image to retrieve size: {str(e)}"
                return record

        record.width = width
        record.height = height

        # Parse object elements
        objects = root.findall("object")
        for obj in objects:
            name_elem = obj.find("name")
            if name_elem is None or not name_elem.text:
                continue

            raw_name = name_elem.text.strip()
            class_id = self.parse_class_identifier(raw_name)
            if class_id is None:
                box = BoundingBox(
                    class_id=-1,
                    class_name=raw_name,
                    xmin=0, ymin=0, xmax=0, ymax=0,
                    is_valid=False,
                    invalid_reason=f"Unknown class identifier: '{raw_name}'",
                )
                record.boxes.append(box)
                continue

            class_name = self.class_id_to_name.get(class_id, f"class_{class_id}")
            bndbox = obj.find("bndbox")
            if bndbox is None:
                continue

            try:
                xmin = float(bndbox.find("xmin").text)
                ymin = float(bndbox.find("ymin").text)
                xmax = float(bndbox.find("xmax").text)
                ymax = float(bndbox.find("ymax").text)
            except Exception as e:
                box = BoundingBox(
                    class_id=class_id,
                    class_name=class_name,
                    xmin=0, ymin=0, xmax=0, ymax=0,
                    is_valid=False,
                    invalid_reason=f"Invalid coordinate format: {str(e)}",
                )
                record.boxes.append(box)
                continue

            # Validate bounding box geometry
            # Clamp minor 1px rounding edge cases
            xmin_clamped = max(0.0, min(float(width), xmin))
            ymin_clamped = max(0.0, min(float(height), ymin))
            xmax_clamped = max(0.0, min(float(width), xmax))
            ymax_clamped = max(0.0, min(float(height), ymax))

            if xmin_clamped >= xmax_clamped or ymin_clamped >= ymax_clamped:
                box = BoundingBox(
                    class_id=class_id,
                    class_name=class_name,
                    xmin=xmin, ymin=ymin, xmax=xmax, ymax=ymax,
                    is_valid=False,
                    invalid_reason=f"Degenerate box dimensions (w={xmax-xmin}, h={ymax-ymin})",
                )
                record.boxes.append(box)
                continue

            # Valid box
            box = BoundingBox(
                class_id=class_id,
                class_name=class_name,
                xmin=xmin_clamped,
                ymin=ymin_clamped,
                xmax=xmax_clamped,
                ymax=ymax_clamped,
                is_valid=True,
            )
            record.boxes.append(box)

        return record

    def inspect_dataset(self) -> Dict[str, Any]:
        """
        Parses all annotations and calculates comprehensive dataset health metrics.
        """
        if not os.path.exists(self.annotations_dir):
            raise FileNotFoundError(f"Annotations directory not found: {self.annotations_dir}")

        xml_files = sorted([
            os.path.join(self.annotations_dir, f)
            for f in os.listdir(self.annotations_dir)
            if f.endswith(".xml")
        ])

        total_xmls = len(xml_files)
        valid_records = []
        missing_images = []
        corrupt_xmls = []
        
        class_distribution: Dict[int, int] = {i: 0 for i in range(len(self.class_names))}
        invalid_boxes_log: List[Dict[str, Any]] = []
        total_valid_boxes = 0
        total_invalid_boxes = 0

        for idx, xml_path in enumerate(xml_files):
            record = self.parse_single_xml(xml_path)

            if not record.is_xml_valid:
                corrupt_xmls.append({"xml": xml_path, "reason": record.error_message})
                continue

            if not record.is_image_found:
                missing_images.append({"xml": xml_path, "reason": record.error_message})
                continue

            valid_boxes = []
            for b in record.boxes:
                if b.is_valid:
                    valid_boxes.append(b)
                    class_distribution[b.class_id] += 1
                    total_valid_boxes += 1
                else:
                    total_invalid_boxes += 1
                    invalid_boxes_log.append({
                        "image_id": record.image_id,
                        "class_id": b.class_id,
                        "class_name": b.class_name,
                        "reason": b.invalid_reason,
                    })

            # Retain only records with at least 1 valid box or keep track
            record.boxes = valid_boxes
            valid_records.append(record)

        # Identify classes with few samples (< 50 instances)
        low_data_classes = [
            {
                "class_id": cid,
                "class_name": self.class_id_to_name.get(cid, f"class_{cid}"),
                "count": count,
            }
            for cid, count in class_distribution.items()
            if count < 50
        ]

        return {
            "total_xml_found": total_xmls,
            "valid_records_count": len(valid_records),
            "missing_images_count": len(missing_images),
            "corrupt_xml_count": len(corrupt_xmls),
            "total_valid_boxes": total_valid_boxes,
            "total_invalid_boxes": total_invalid_boxes,
            "class_distribution": class_distribution,
            "low_data_classes": low_data_classes,
            "invalid_boxes_sample": invalid_boxes_log[:20],
            "valid_records": valid_records,
        }

