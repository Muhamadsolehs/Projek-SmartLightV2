#!/usr/bin/env python3
"""
Smart Light Trap - Computer Vision to Supabase Integration Bridge.
Strict Production-Audited Connector for /functions/v1/device-detections:
  - Enforces UUID validation for capture_sessions
  - Ensures Bounding Box percentages remain strictly clamped within 0.0 - 100.0%
  - Ensures Confidence scores remain strictly clamped within 0.0000 - 1.0000
  - Resolves species_code against valid database foreign keys
  - Prevents secret leakage and provides structured error diagnostics
"""

import os
import sys
import re
import json
import argparse
import requests
from pathlib import Path
from typing import Dict, Any, List, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from services.cv_service.main import (
    VERIFIED_SUBANG_TAXONOMY,
    load_model,
    PROD_MODEL_VERSION,
    TEST_MODEL_VERSION,
)
import cv2
import torch

UUID_REGEX = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

# List of valid IDs currently seeded in Supabase public.insect_species
VALID_DB_SPECIES_CODES = {
    "scirpophaga_incertulas",
    "nilaparvata_lugens",
    "spodoptera_frugiperda",
    "leptocorisa_oratoria",
    "cnaphalocrocis_medinalis",
    "other_neutral",
}


def validate_uuid(val: str) -> bool:
    """Validates if a string is a standard 36-character UUID."""
    return bool(UUID_REGEX.match(val))


def run_inference_on_file(
    image_path: str,
    conf_threshold: float = 0.25,
    iou_threshold: float = 0.45,
    allow_dev_test: bool = False,
) -> Dict[str, Any]:
    """Runs YOLOv8 model inference on an image file with strict coordinate validation."""
    img_path = Path(image_path).resolve()
    if not img_path.exists():
        raise FileNotFoundError(f"Image not found at {img_path}")

    model, model_path, is_prod, err = load_model()
    if model is None:
        raise RuntimeError(f"Computer Vision Model not ready: {err}")

    if not is_prod and not allow_dev_test:
        raise RuntimeError(
            "Production model checkpoint 'runs/detect/ip102_training/weights/best.pt' not found. "
            "Inference cannot proceed in production mode."
        )

    img_bgr = cv2.imread(str(img_path))
    if img_bgr is None:
        raise ValueError(f"Could not decode image at {img_path}")

    img_h, img_w = img_bgr.shape[:2]
    exec_device = "0" if torch.cuda.is_available() else "cpu"

    results = model.predict(
        source=img_bgr,
        conf=conf_threshold,
        iou=iou_threshold,
        device=exec_device,
        verbose=False,
    )[0]

    detections = []
    names = model.names

    for box in results.boxes:
        cls_id = int(box.cls[0].item())
        conf = float(box.conf[0].item())
        xmin, ymin, xmax, ymax = box.xyxy[0].tolist()

        # Strict clamping to 0.0 - 100.0%
        x_pct = max(0.0, min(100.0, round((xmin / img_w) * 100, 2)))
        y_pct = max(0.0, min(100.0, round((ymin / img_h) * 100, 2)))
        w_pct = max(0.0, min(100.0, round(((xmax - xmin) / img_w) * 100, 2)))
        h_pct = max(0.0, min(100.0, round(((ymax - ymin) / img_h) * 100, 2)))

        # Confidence strictly 0.0 to 1.0
        conf_clamped = max(0.0, min(1.0, round(conf, 4)))

        if cls_id in VERIFIED_SUBANG_TAXONOMY:
            tax = VERIFIED_SUBANG_TAXONOMY[cls_id]
            sp_code = tax["species_code"]
            sp_name = tax["species_name"]
            is_target = tax["is_target_pest"]
            mapping_status = "mapped"
        else:
            raw_name = names.get(cls_id, f"Class_{cls_id}") if isinstance(names, dict) else str(names[cls_id])
            sp_code = "unmapped"
            sp_name = f"Unmapped ({raw_name})"
            is_target = False
            mapping_status = "unmapped"

        detections.append({
            "class_id": cls_id,
            "species_code": sp_code,
            "species_name": sp_name,
            "is_target_pest": is_target,
            "mapping_status": mapping_status,
            "confidence": conf_clamped,
            "count": 1,
            "bbox": {
                "x": x_pct,
                "y": y_pct,
                "width": w_pct,
                "height": h_pct,
            },
        })

    version_str = PROD_MODEL_VERSION if is_prod else TEST_MODEL_VERSION

    return {
        "model_version": version_str,
        "is_production_model": is_prod,
        "image_resolution": f"{img_w}x{img_h}",
        "total_detections": len(detections),
        "detections": detections,
    }


def send_to_supabase_edge_function(
    supabase_url: str,
    device_token: str,
    session_id: str,
    inference_result: Dict[str, Any],
    filter_unmapped: bool = True,
) -> Dict[str, Any]:
    """
    Posts inference detections to /functions/v1/device-detections.
    Prevents foreign key violations by filtering unmapped species or mapping safely.
    """
    if not validate_uuid(session_id):
        raise ValueError(f"Invalid session_id format: '{session_id}'. Must be a valid UUID v4.")

    if not device_token or len(device_token) < 8:
        raise ValueError("Invalid device_token. A valid secret X-Device-Token is required.")

    endpoint = f"{supabase_url.rstrip('/')}/functions/v1/device-detections"
    headers = {
        "Content-Type": "application/json",
        "X-Device-Token": device_token,
    }

    # Prepare payload strictly conforming to Edge Function and DB FK constraints
    prepared_detections = []
    for d in inference_result["detections"]:
        code = d["species_code"]

        # Handle unmapped species to protect DB Foreign Key constraint on public.insect_species(id)
        if code not in VALID_DB_SPECIES_CODES:
            if filter_unmapped:
                print(f"[BRIDGE] Skipping unmapped detection '{d['species_name']}' to prevent DB Foreign Key violation.")
                continue
            else:
                code = "other_neutral"

        prepared_detections.append({
            "species_code": code,
            "species_name": d["species_name"],
            "confidence": d["confidence"],
            "count": d["count"],
            "bbox": d["bbox"],
        })

    payload = {
        "session_id": session_id,
        "model_version": inference_result["model_version"],
        "detections": prepared_detections,
    }

    try:
        response = requests.post(endpoint, json=payload, headers=headers, timeout=15)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as http_err:
        status_c = response.status_code if response else "Unknown"
        err_body = response.text if response else ""
        raise RuntimeError(f"Edge Function error [HTTP {status_c}]: {err_body}") from http_err
    except requests.exceptions.RequestException as req_err:
        raise RuntimeError(f"Network connection failed when reaching Supabase: {req_err}") from req_err


def main():
    parser = argparse.ArgumentParser(
        description="Smart Light Trap - Computer Vision to Supabase Edge Function Bridge"
    )
    parser.add_argument(
        "--image",
        type=str,
        required=True,
        help="Path to trap image for pest inference",
    )
    parser.add_argument(
        "--session-id",
        type=str,
        default=None,
        help="Capture session UUID in Supabase (e.g. 12345678-1234-1234-1234-123456789abc)",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="Confidence threshold (default: 0.25)",
    )
    parser.add_argument(
        "--supabase-url",
        type=str,
        default=os.getenv("VITE_SUPABASE_URL", ""),
        help="Supabase Project URL",
    )
    parser.add_argument(
        "--device-token",
        type=str,
        default=os.getenv("DEVICE_TOKEN", ""),
        help="X-Device-Token for authenticating with the Edge Function",
    )
    parser.add_argument(
        "--allow-dev-test",
        action="store_true",
        help="Allow running baseline test weights if production best.pt is not available",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Perform inference and display payload without transmitting to Supabase",
    )

    args = parser.parse_args()

    session_id = args.session_id or "00000000-0000-4000-8000-000000000001"

    print("=" * 65)
    print(" SMART LIGHT TRAP — CV INFERENCE & SUPABASE BRIDGE")
    print("=" * 65)
    print(f"Citra Sumber      : {args.image}")
    print(f"Session ID        : {session_id} (UUID Valid: {validate_uuid(session_id)})")
    print(f"Confidence        : {args.conf}")
    print(f"Mode Operasi      : {'DRY RUN (Simulasi)' if args.dry_run or not args.supabase_url else 'LIVE TRANSMISSION'}")
    print("=" * 65)

    try:
        result = run_inference_on_file(
            args.image,
            conf_threshold=args.conf,
            allow_dev_test=args.allow_dev_test,
        )
    except Exception as e:
        print(f"\n[ERROR] Inferensi gagal: {e}")
        sys.exit(1)

    print("\nHASIL INFERENSI MODEL:")
    print(f"- Versi Model         : {result['model_version']}")
    print(f"- Production Model    : {result['is_production_model']}")
    print(f"- Resolusi Citra      : {result['image_resolution']}")
    print(f"- Total Deteksi       : {result['total_detections']}")

    if result["detections"]:
        print("\nRincian Serangga Terdeteksi:")
        for idx, det in enumerate(result["detections"], 1):
            bbox = det["bbox"]
            print(
                f"  [{idx}] {det['species_name']} (code: {det['species_code']}) "
                f"| Status: {det['mapping_status'].upper()} "
                f"| Conf: {det['confidence'] * 100:.1f}% "
                f"| Box: ({bbox['x']}%, {bbox['y']}%, {bbox['width']}%, {bbox['height']}%)"
            )
    else:
        print("- Tidak ada hama/serangga terdeteksi di atas batas ambang confidence.")

    if args.dry_run or not args.supabase_url or not args.device_token:
        print("\n" + "=" * 65)
        print("CONTOH PAYLOAD UNTUK EDGE FUNCTION 'device-detections':")
        print("=" * 65)
        sample_payload = {
            "session_id": session_id,
            "model_version": result["model_version"],
            "detections": result["detections"],
        }
        print(json.dumps(sample_payload, indent=2))
        print("=" * 65)
        print("Untuk transmisi live, sediakan --supabase-url dan --device-token.")
    else:
        print(f"\nMengirim payload ke Supabase Edge Function: {args.supabase_url}/functions/v1/device-detections...")
        try:
            res = send_to_supabase_edge_function(
                args.supabase_url,
                args.device_token,
                session_id,
                result,
            )
            print("✓ Berhasil terkirim!")
            print(json.dumps(res, indent=2))
        except Exception as e:
            print(f"[ERROR] Transmisi ke Supabase gagal: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
