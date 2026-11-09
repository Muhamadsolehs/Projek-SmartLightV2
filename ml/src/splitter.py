"""
Dataset Splitter and YOLO Dataset Generator for IP102.
Honors official IP102 trainval/test splits, prevents data leakage,
and creates the standard Ultralytics YOLO folder structure and data.yaml.
"""

import os
import shutil
import random
import yaml
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any, Optional

from ml.src.dataset_parser import AnnotationRecord
from ml.src.converter import YOLOConverter


class IP102DatasetSplitter:
    def __init__(
        self,
        output_dir: str,
        class_names: List[str],
        trainval_split_file: Optional[str] = None,
        test_split_file: Optional[str] = None,
        val_ratio_from_trainval: float = 0.20,
        seed: int = 42,
    ):
        self.output_dir = Path(output_dir).resolve()
        self.class_names = class_names
        self.trainval_split_file = trainval_split_file
        self.test_split_file = test_split_file
        self.val_ratio = val_ratio_from_trainval
        self.seed = seed

    def load_split_ids(self, file_path: str) -> List[str]:
        """Loads clean image IDs from a split text file (one ID per line)."""
        if not os.path.exists(file_path):
            return []
        with open(file_path, "r", encoding="utf-8") as f:
            ids = [line.strip().split()[0] for line in f if line.strip()]
        return ids

    def partition_records(
        self,
        records: List[AnnotationRecord],
    ) -> Dict[str, List[AnnotationRecord]]:
        """
        Partitions records into 'train', 'val', and 'test' using official splits.
        Guarantees zero data leakage between partitions.
        """
        record_map: Dict[str, AnnotationRecord] = {r.image_id: r for r in records}
        
        trainval_ids: Set[str] = set()
        test_ids: Set[str] = set()

        if self.trainval_split_file and os.path.exists(self.trainval_split_file):
            trainval_ids = set(self.load_split_ids(self.trainval_split_file))

        if self.test_split_file and os.path.exists(self.test_split_file):
            test_ids = set(self.load_split_ids(self.test_split_file))

        # Check for intersection / data leakage in official files
        overlap = trainval_ids.intersection(test_ids)
        if overlap:
            print(f"[WARNING] Detected {len(overlap)} overlapping IDs between official trainval and test splits. Removing overlaps from test set to prevent data leakage.")
            test_ids = test_ids - overlap

        # If official splits provided
        if trainval_ids or test_ids:
            tv_records = [record_map[i] for i in trainval_ids if i in record_map]
            test_records = [record_map[i] for i in test_ids if i in record_map]

            # Collect unassigned records
            assigned_ids = set(r.image_id for r in tv_records).union(set(r.image_id for r in test_records))
            unassigned = [r for r in records if r.image_id not in assigned_ids]
            
            # Append unassigned to trainval
            tv_records.extend(unassigned)
        else:
            # Fallback if no split file provided: 70/15/15 stratified
            print("[INFO] No official split files provided. Performing 70/15/15 randomized split.")
            shuffled = list(records)
            random.seed(self.seed)
            random.shuffle(shuffled)
            n_total = len(shuffled)
            n_test = int(n_total * 0.15)
            test_records = shuffled[:n_test]
            tv_records = shuffled[n_test:]

        # Split trainval into train & val
        random.seed(self.seed)
        shuffled_tv = list(tv_records)
        random.shuffle(shuffled_tv)

        n_val = int(len(shuffled_tv) * self.val_ratio)
        val_records = shuffled_tv[:n_val]
        train_records = shuffled_tv[n_val:]

        # Strict assertion against data leakage
        train_set = set(r.image_id for r in train_records)
        val_set = set(r.image_id for r in val_records)
        test_set = set(r.image_id for r in test_records)

        assert len(train_set.intersection(val_set)) == 0, "Data leakage between train and val!"
        assert len(train_set.intersection(test_set)) == 0, "Data leakage between train and test!"
        assert len(val_set.intersection(test_set)) == 0, "Data leakage between val and test!"

        return {
            "train": train_records,
            "val": val_records,
            "test": test_records,
        }

    def build_yolo_dataset(
        self,
        splits: Dict[str, List[AnnotationRecord]],
        copy_images: bool = True,
    ) -> Dict[str, Any]:
        """
        Creates images/ and labels/ subdirectories, copies/links images,
        writes YOLO annotation text files, and generates data.yaml.
        """
        # Create directory structure
        for split_name in ["train", "val", "test"]:
            (self.output_dir / "images" / split_name).mkdir(parents=True, exist_ok=True)
            (self.output_dir / "labels" / split_name).mkdir(parents=True, exist_ok=True)

        stats: Dict[str, Dict[str, int]] = {}

        for split_name, record_list in splits.items():
            img_dest_dir = self.output_dir / "images" / split_name
            lbl_dest_dir = self.output_dir / "labels" / split_name

            img_count = 0
            box_count = 0

            for rec in record_list:
                if not rec.image_path or not os.path.exists(rec.image_path):
                    continue

                # Copy or link image
                ext = Path(rec.image_path).suffix
                target_img_path = img_dest_dir / f"{rec.image_id}{ext}"
                if not target_img_path.exists():
                    if copy_images:
                        shutil.copy2(rec.image_path, target_img_path)
                    else:
                        try:
                            os.symlink(rec.image_path, target_img_path)
                        except OSError:
                            shutil.copy2(rec.image_path, target_img_path)

                # Write YOLO format label file
                yolo_lines = YOLOConverter.record_to_yolo_lines(rec)
                target_lbl_path = lbl_dest_dir / f"{rec.image_id}.txt"
                with open(target_lbl_path, "w", encoding="utf-8") as f:
                    if yolo_lines:
                        f.write("\n".join(yolo_lines) + "\n")

                img_count += 1
                box_count += len(yolo_lines)

            stats[split_name] = {"images": img_count, "boxes": box_count}

        # Write data.yaml for Ultralytics YOLOv8
        data_yaml_path = self.output_dir / "data.yaml"
        # Convert absolute path to POSIX string for cross-platform compatibility
        posix_root = self.output_dir.as_posix()

        yaml_content = {
            "path": posix_root,
            "train": "images/train",
            "val": "images/val",
            "test": "images/test",
            "nc": len(self.class_names),
            "names": {i: name for i, name in enumerate(self.class_names)},
        }

        with open(data_yaml_path, "w", encoding="utf-8") as f:
            yaml.dump(yaml_content, f, sort_keys=False, default_flow_style=False)

        return {
            "output_dir": str(self.output_dir),
            "data_yaml": str(data_yaml_path),
            "stats": stats,
            "nc": len(self.class_names),
        }

