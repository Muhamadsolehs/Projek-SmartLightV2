"""
Smart Light Trap - Computer Vision Microservice (Python FastAPI)
Strict Production-Grade AI Engine for YOLOv8 IP102 Nocturnal Pest Detection.

Architecture Rules:
1. Production environment strictly requires the trained IP102 checkpoint (best.pt).
2. NO silent fallback to yolov8n.pt or pretrained COCO models in production.
3. If checkpoint is missing, /health reports model_not_ready and /detect returns HTTP 503.
4. Pretrained baseline COCO weights are allowed ONLY in development mode with explicit flag.
5. All 102 IP102 classes are mapped strictly according to data.yaml.
6. Unverified classes are explicitly designated as 'unmapped', NOT silently mapped to 'other_neutral'.
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any

import cv2
import numpy as np
import torch
import yaml
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Root directory reference
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

app = FastAPI(
    title="Smart Light Trap AI - Computer Vision Microservice",
    description="Microservice for IP102 nocturnal insect detection, bounding box prediction, and species classification.",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration & Environment
CV_ENV = os.getenv("CV_ENV", "production").lower()  # 'production' or 'development'
ALLOW_PRETRAINED_TEST = os.getenv("ALLOW_PRETRAINED_TEST", "false").lower() in ("true", "1", "yes")
CV_SERVICE_SECRET = os.getenv("CV_SERVICE_SECRET", "slt_ai_secret_key_2026")
PROD_MODEL_VERSION = "YOLOv8n-IP102-Prod v1.0"
TEST_MODEL_VERSION = "YOLOv8n-Pretrained-TEST-ONLY"

IP102_PROD_CHECKPOINT = REPO_ROOT / "runs" / "detect" / "ip102_training" / "weights" / "best.pt"
COCO_BASELINE_WEIGHTS = REPO_ROOT / "yolov8n.pt"
DATA_YAML_PATH = REPO_ROOT / "datasets" / "IP102_YOLO" / "data.yaml"

# Load original 102 class names from data.yaml
IP102_NAMES: Dict[int, str] = {}
if DATA_YAML_PATH.exists():
    try:
        with open(DATA_YAML_PATH, "r", encoding="utf-8") as f:
            yaml_content = yaml.safe_load(f)
            IP102_NAMES = yaml_content.get("names", {})
    except Exception as e:
        print(f"[WARN] Failed to load data.yaml: {e}")

# ==============================================================================
# TAXONOMY MAPPING: Verified Subang PHT Rice Pests vs Unmapped
# Matches public.insect_species table in Supabase PostgreSQL
# ==============================================================================
VERIFIED_SUBANG_TAXONOMY: Dict[int, Dict[str, Any]] = {
    0: {
        "species_code": "cnaphalocrocis_medinalis",
        "species_name": "Hama Putih Palsu / Penggulung Daun",
        "scientific_name": "Cnaphalocrocis medinalis",
        "is_target_pest": True,
        "classification": "target_pest",
        "risk_level": "medium",
    },
    3: {
        "species_code": "scirpophaga_incertulas",
        "species_name": "Penggerek Batang Padi Bergaris (Chilo)",
        "scientific_name": "Chilo suppressalis",
        "is_target_pest": True,
        "classification": "target_pest",
        "risk_level": "critical",
    },
    4: {
        "species_code": "scirpophaga_incertulas",
        "species_name": "Penggerek Batang Padi Kuning",
        "scientific_name": "Scirpophaga incertulas",
        "is_target_pest": True,
        "classification": "target_pest",
        "risk_level": "critical",
    },
    7: {
        "species_code": "nilaparvata_lugens",
        "species_name": "Wereng Batang Coklat (WBC)",
        "scientific_name": "Nilaparvata lugens",
        "is_target_pest": True,
        "classification": "target_pest",
        "risk_level": "critical",
    },
    8: {
        "species_code": "nilaparvata_lugens",
        "species_name": "Wereng Punggung Putih",
        "scientific_name": "Sogatella furcifera",
        "is_target_pest": True,
        "classification": "target_pest",
        "risk_level": "high",
    },
    9: {
        "species_code": "nilaparvata_lugens",
        "species_name": "Wereng Coklat Kecil",
        "scientific_name": "Laodelphax striatellus",
        "is_target_pest": True,
        "classification": "target_pest",
        "risk_level": "high",
    },
    11: {
        "species_code": "nilaparvata_lugens",
        "species_name": "Wereng Daun Hijau",
        "scientific_name": "Nephotettix cincticeps",
        "is_target_pest": True,
        "classification": "target_pest",
        "risk_level": "high",
    },
    23: {
        "species_code": "spodoptera_frugiperda",
        "species_name": "Ulat Grayak / Armyworm",
        "scientific_name": "Mythimna separata",
        "is_target_pest": True,
        "classification": "target_pest",
        "risk_level": "high",
    },
}


# ==============================================================================
# PYDANTIC DATA MODELS
# ==============================================================================
class BoundingBox(BaseModel):
    x: float = Field(..., ge=0.0, le=100.0, description="Top-left X percentage (0-100)")
    y: float = Field(..., ge=0.0, le=100.0, description="Top-left Y percentage (0-100)")
    width: float = Field(..., ge=0.0, le=100.0, description="Box width percentage (0-100)")
    height: float = Field(..., ge=0.0, le=100.0, description="Box height percentage (0-100)")


class InsectDetectionItem(BaseModel):
    class_id: int
    raw_class_name: str
    species_code: str
    species_name: str
    scientific_name: Optional[str] = None
    is_target_pest: bool
    classification: str
    mapping_status: str  # 'mapped', 'unmapped', 'unknown'
    confidence: float = Field(..., ge=0.0, le=1.0)
    bbox: BoundingBox


class DetectionResponse(BaseModel):
    success: bool
    model_version: str
    is_production_model: bool
    total_detected: int
    target_pests_count: int
    other_insects_count: int
    unmapped_count: int
    avg_confidence: float
    detections: List[InsectDetectionItem]


# ==============================================================================
# MODEL SINGLETON MANAGER
# ==============================================================================
_yolo_model = None
_model_path_loaded: Optional[str] = None
_is_production: bool = False
_model_error: Optional[str] = None


import hashlib

_model_checksum: Optional[str] = None

def get_file_sha256(filepath: Path) -> str:
    """Calculates SHA-256 checksum of a model file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def load_model(force_reload: bool = False):
    """
    Loads model strictly adhering to environment constraints:
    - Production: Requires IP102_PROD_CHECKPOINT (best.pt). If absent, model remains None.
    - Development: Allows COCO_BASELINE_WEIGHTS if ALLOW_PRETRAINED_TEST is explicitly enabled.
    """
    global _yolo_model, _model_path_loaded, _is_production, _model_error, _model_checksum

    if _yolo_model is not None and not force_reload:
        return _yolo_model, _model_path_loaded, _is_production, _model_error

    _model_error = None

    if IP102_PROD_CHECKPOINT.exists():
        try:
            from ultralytics import YOLO

            _yolo_model = YOLO(str(IP102_PROD_CHECKPOINT))
            _model_path_loaded = str(IP102_PROD_CHECKPOINT)
            _model_checksum = get_file_sha256(IP102_PROD_CHECKPOINT)
            _is_production = True
            print(f"[CV SERVICE] ✓ Loaded production IP102 model: {_model_path_loaded} (SHA-256: {_model_checksum[:12]}...)")
            return _yolo_model, _model_path_loaded, _is_production, None
        except Exception as e:
            _model_error = f"Failed to initialize production model: {str(e)}"
            _yolo_model = None
            _model_checksum = None
            return None, None, False, _model_error

    # Production mode: Checkpoint missing -> strict failure (NO fallback)
    if CV_ENV == "production" or not ALLOW_PRETRAINED_TEST:
        _model_error = (
            f"Production model checkpoint not found at: {IP102_PROD_CHECKPOINT}. "
            "Model training must be completed on Google Colab and best.pt must be deployed to this path. "
            "Silent fallback to yolov8n.pt is disabled in production."
        )
        _yolo_model = None
        _model_path_loaded = None
        _model_checksum = None
        _is_production = False
        return None, None, False, _model_error

    # Development mode with explicit test flag enabled
    if COCO_BASELINE_WEIGHTS.exists():
        try:
            from ultralytics import YOLO

            print("[CV SERVICE] [DEV ONLY] Loading yolov8n.pt for technical testing (ALLOW_PRETRAINED_TEST=True)...")
            _yolo_model = YOLO(str(COCO_BASELINE_WEIGHTS))
            _model_path_loaded = str(COCO_BASELINE_WEIGHTS)
            _model_checksum = get_file_sha256(COCO_BASELINE_WEIGHTS)
            _is_production = False
            return _yolo_model, _model_path_loaded, _is_production, None
        except Exception as e:
            _model_error = f"Failed to load baseline test model: {str(e)}"
            _yolo_model = None
            _model_checksum = None
            return None, None, False, _model_error

    _model_error = "No valid model weights found."
    return None, None, False, _model_error


def verify_service_token(x_service_key: Optional[str] = Header(None)):
    if CV_SERVICE_SECRET and x_service_key != CV_SERVICE_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Service-Key header",
        )


# Initialize model on startup
load_model()


# ==============================================================================
# API ENDPOINTS
# ==============================================================================
@app.get("/health")
def health_check():
    model, model_path, is_prod, err = load_model()

    if model is None or not is_prod:
        return {
            "status": "model_not_ready",
            "error_code": "MODEL_NOT_TRAINED",
            "model_ready": False,
            "environment": CV_ENV,
            "is_production_model": False,
            "active_model_path": model_path,
            "expected_checkpoint": str(IP102_PROD_CHECKPOINT),
            "model_checksum": _model_checksum,
            "error": err or "Production IP102 trained checkpoint (best.pt) is missing.",
            "service": "Smart Light Trap AI CV Engine",
            "supported_region": "Subang, Jawa Barat",
        }

    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    num_classes = len(model.names) if hasattr(model, "names") else 0

    return {
        "status": "healthy",
        "model_ready": True,
        "environment": CV_ENV,
        "is_production_model": True,
        "model_version": PROD_MODEL_VERSION,
        "model_checksum": _model_checksum,
        "active_model_path": model_path,
        "device": device,
        "num_classes": num_classes,
        "supported_region": "Subang, Jawa Barat",
        "verified_target_classes": len(VERIFIED_SUBANG_TAXONOMY),
    }


@app.post("/detect", response_model=DetectionResponse)
async def detect_insects(
    file: UploadFile = File(...),
    conf_threshold: float = Form(0.25),
    iou_threshold: float = Form(0.45),
    device_code: str = Form("SLT-SBG-01"),
    x_service_key: Optional[str] = Header(None),
):
    """
    Run nocturnal pest inference on an insect trap image.
    Enforces production checkpoint requirement: returns HTTP 503 with error_code MODEL_NOT_TRAINED if model is not available.
    """
    verify_service_token(x_service_key)

    model, model_path, is_prod, err = load_model()

    # Reject request if production model is not ready (and dev test model is not explicitly active)
    if model is None or (CV_ENV == "production" and not is_prod):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error_code": "MODEL_NOT_TRAINED",
                "message": err or "Production IP102 model checkpoint (best.pt) is not deployed.",
                "expected_checkpoint": str(IP102_PROD_CHECKPOINT),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Computer Vision Service Unavailable: Production IP102 model checkpoint (best.pt) is not deployed.",
        )

    # Validate image mime type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image format.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty image file received.")

    # Decode image bytes
    np_arr = np.frombuffer(content, np.uint8)
    img_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Corrupted image: failed to decode image bytes.")

    img_h, img_w = img_bgr.shape[:2]
    if img_h < 10 or img_w < 10:
        raise HTTPException(status_code=400, detail="Image resolution too small for insect detection.")

    exec_device = "0" if torch.cuda.is_available() else "cpu"

    # Execute YOLOv8 inference
    results = model.predict(
        source=img_bgr,
        conf=conf_threshold,
        iou=iou_threshold,
        device=exec_device,
        verbose=False,
    )[0]

    detections: List[InsectDetectionItem] = []
    names = model.names

    for box in results.boxes:
        cls_id = int(box.cls[0].item())
        conf = float(box.conf[0].item())
        xmin, ymin, xmax, ymax = box.xyxy[0].tolist()

        # Clamp and normalize percentage coordinates strictly to 0.0 - 100.0%
        x_pct = max(0.0, min(100.0, round((xmin / img_w) * 100, 2)))
        y_pct = max(0.0, min(100.0, round((ymin / img_h) * 100, 2)))
        w_pct = max(0.0, min(100.0, round(((xmax - xmin) / img_w) * 100, 2)))
        h_pct = max(0.0, min(100.0, round(((ymax - ymin) / img_h) * 100, 2)))

        raw_name = IP102_NAMES.get(cls_id) or (names.get(cls_id) if isinstance(names, dict) else str(names[cls_id]))

        # Species Taxonomy Resolution
        if cls_id in VERIFIED_SUBANG_TAXONOMY:
            tax = VERIFIED_SUBANG_TAXONOMY[cls_id]
            sp_code = tax["species_code"]
            sp_name = tax["species_name"]
            sci_name = tax["scientific_name"]
            is_target = tax["is_target_pest"]
            classification = tax["classification"]
            map_status = "mapped"
        else:
            # Explicit unmapped handling (NEVER silently assumed as other_neutral)
            sp_code = "unmapped"
            sp_name = f"Unmapped: {raw_name}"
            sci_name = None
            is_target = False
            classification = "unidentified"
            map_status = "unmapped"

        detections.append(
            InsectDetectionItem(
                class_id=cls_id,
                raw_class_name=raw_name,
                species_code=sp_code,
                species_name=sp_name,
                scientific_name=sci_name,
                is_target_pest=is_target,
                classification=classification,
                mapping_status=map_status,
                confidence=round(conf, 4),
                bbox=BoundingBox(x=x_pct, y=y_pct, width=w_pct, height=h_pct),
            )
        )

    target_count = sum(1 for d in detections if d.is_target_pest)
    unmapped_count = sum(1 for d in detections if d.mapping_status == "unmapped")
    other_count = len(detections) - target_count - unmapped_count
    avg_conf = (sum(d.confidence for d in detections) / len(detections)) if detections else 0.0

    active_version = PROD_MODEL_VERSION if is_prod else TEST_MODEL_VERSION

    return DetectionResponse(
        success=True,
        model_version=active_version,
        is_production_model=is_prod,
        total_detected=len(detections),
        target_pests_count=target_count,
        other_insects_count=other_count,
        unmapped_count=unmapped_count,
        avg_confidence=round(avg_conf, 4),
        detections=detections,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
