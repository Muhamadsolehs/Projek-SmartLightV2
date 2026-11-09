#!/usr/bin/env python3
"""
Test Suite: Detection Reliability, Idempotency & Nightly Pest Accumulation.
Validates the mathematical and architectural logic of:
  - Idempotent session processing (prevents double inserts on retry)
  - Asia/Jakarta (WIB) 18:00 - 06:00 operational night cycle calculation
  - Multi-session cumulative pest accumulation per device
  - Isolation between devices (no cross-device pollution)
  - Exclusion of unmapped species from target count
  - Deduplication of Telegram alert events
"""

import sys
import unittest
from datetime import datetime, timezone, timedelta
import threading

# Definition of WIB timezone (UTC+7)
WIB = timezone(timedelta(hours=7))


def get_active_night_cycle(target_time_utc: datetime):
    """
    Python reference implementation of get_operational_night_bounds.
    Timezone: Asia/Jakarta (WIB = UTC+7).
    """
    wib_time = target_time_utc.astimezone(WIB)
    year = wib_time.year
    month = wib_time.month
    day = wib_time.day
    hour = wib_time.hour

    ref_date = datetime(year, month, day).date()

    if hour < 6:
        # 00:00 - 05:59 WIB belongs to the night that started yesterday at 18:00 WIB
        ref_date = ref_date - timedelta(days=1)

    # Night starts at 18:00 WIB of ref_date
    night_start = datetime(ref_date.year, ref_date.month, ref_date.day, 18, 0, 0, tzinfo=WIB)
    # Night ends at 06:00 WIB of ref_date + 1 day
    next_day = ref_date + timedelta(days=1)
    night_end = datetime(next_day.year, next_day.month, next_day.day, 6, 0, 0, tzinfo=WIB)

    return {
        "night_date_str": ref_date.strftime("%Y-%m-%d"),
        "night_start": night_start.astimezone(timezone.utc),
        "night_end": night_end.astimezone(timezone.utc),
    }


class MockDatabase:
    """Mock storage to emulate PostgreSQL tables in memory with threading lock for concurrency validation."""

    def __init__(self):
        self.lock = threading.Lock()
        self.devices = {}
        self.capture_sessions = {}
        self.insect_detections = []
        self.device_alerts = []
        self.telegram_logs = {}

    def add_device(self, device_id: str, device_code: str, threshold: int = 50):
        self.devices[device_id] = {
            "id": device_id,
            "device_code": device_code,
            "pest_threshold_per_night": threshold,
        }

    def create_session(self, session_id: str, device_id: str, captured_at: datetime):
        self.capture_sessions[session_id] = {
            "id": session_id,
            "device_id": device_id,
            "captured_at": captured_at,
            "processing_status": "pending",
            "total_pests": 0,
            "target_pests_count": 0,
            "other_insects_count": 0,
        }

    def process_detections(self, session_id: str, device_id: str, detections: list, model_version: str):
        with self.lock:
            session = self.capture_sessions.get(session_id)
            if not session:
                return {"error": "not_found", "status": 404}

            if session["device_id"] != device_id:
                return {"error": "forbidden", "status": 403}

            # IDEMPOTENCY CHECK (Emulating FOR UPDATE row check)
            if session["processing_status"] in ("completed", "verified"):
                return {
                    "success": True,
                    "already_processed": True,
                    "total_detections": session["total_pests"],
                    "target_pests": session["target_pests_count"],
                    "other_insects": session["other_insects_count"],
                    "message": "Duplicate ignored",
                }

            # Delete any previous detections for this session
            self.insect_detections = [d for d in self.insect_detections if d["capture_session_id"] != session_id]

            target_count = 0
            other_count = 0
            VALID_TARGET_CODES = {"scirpophaga_incertulas", "nilaparvata_lugens", "spodoptera_frugiperda", "leptocorisa_oratoria", "cnaphalocrocis_medinalis"}

            for det in detections:
                sp_code = det.get("species_code", "other_neutral")
                is_target = sp_code in VALID_TARGET_CODES
                if is_target:
                    target_count += det.get("count", 1)
                else:
                    other_count += det.get("count", 1)

                self.insect_detections.append({
                    "capture_session_id": session_id,
                    "device_id": device_id,
                    "species_code": sp_code if is_target else "other_neutral",
                    "count": det.get("count", 1),
                })

            # Update session
            session["processing_status"] = "completed"
            session["total_pests"] = target_count + other_count
            session["target_pests_count"] = target_count
            session["other_insects_count"] = other_count

            # Cumulative calculation for this night
            cycle = get_active_night_cycle(session["captured_at"])
            night_start = cycle["night_start"]
            night_end = cycle["night_end"]

            cumulative_target = 0
            for s in self.capture_sessions.values():
                if s["device_id"] == device_id and s["processing_status"] in ("completed", "verified"):
                    if night_start <= s["captured_at"] < night_end:
                        cumulative_target += s["target_pests_count"]

            threshold = self.devices[device_id]["pest_threshold_per_night"]
            threshold_exceeded = cumulative_target >= threshold

            if threshold_exceeded:
                self.device_alerts.append({
                    "device_id": device_id,
                    "cumulative_target": cumulative_target,
                    "threshold": threshold,
                })

            return {
                "success": True,
                "already_processed": False,
                "total_detections": session["total_pests"],
                "target_pests": target_count,
                "other_insects": other_count,
                "cumulative_target_pests": cumulative_target,
                "threshold_exceeded": threshold_exceeded,
                "threshold": threshold,
                "night_date": cycle["night_date_str"],
            }

    def dispatch_telegram_mock(self, event_key: str, event_type: str, simulate_network_fail: bool = False):
        with self.lock:
            existing = self.telegram_logs.get(event_key)
            if existing and existing["delivery_status"] == "sent":
                return {"status": "already_sent", "sent": False}

            if simulate_network_fail:
                self.telegram_logs[event_key] = {"event_key": event_key, "event_type": event_type, "delivery_status": "failed"}
                return {"status": "failed", "sent": False, "error": "Connection timeout to Telegram API"}

            self.telegram_logs[event_key] = {"event_key": event_key, "event_type": event_type, "delivery_status": "sent"}
            return {"status": "sent", "sent": True}


class TestDetectionReliability(unittest.TestCase):
    def setUp(self):
        self.db = MockDatabase()
        self.dev_1 = "dev-001-uuid"
        self.dev_2 = "dev-002-uuid"
        self.db.add_device(self.dev_1, "SLT-SBG-01", threshold=50)
        self.db.add_device(self.dev_2, "SLT-SBG-02", threshold=50)

    def test_01_single_session_processed(self):
        """Scenario 1: Session dikirim satu kali -> Deteksi tersimpan."""
        captured_time = datetime(2026, 11, 9, 13, 0, 0, tzinfo=timezone.utc)  # 20:00 WIB
        self.db.create_session("ses-1", self.dev_1, captured_time)

        dets = [{"species_code": "nilaparvata_lugens", "count": 10}]
        res = self.db.process_detections("ses-1", self.dev_1, dets, "YOLOv8-Test")

        self.assertTrue(res["success"])
        self.assertFalse(res["already_processed"])
        self.assertEqual(res["target_pests"], 10)
        self.assertEqual(len(self.db.insect_detections), 1)

    def test_02_idempotent_duplicate_retry(self):
        """Scenario 2: Session dikirim dua kali berturut-turut -> Tidak ada duplikasi."""
        captured_time = datetime(2026, 11, 9, 13, 0, 0, tzinfo=timezone.utc)
        self.db.create_session("ses-1", self.dev_1, captured_time)

        dets = [{"species_code": "nilaparvata_lugens", "count": 10}]
        res1 = self.db.process_detections("ses-1", self.dev_1, dets, "YOLOv8-Test")
        self.assertFalse(res1["already_processed"])
        self.assertEqual(len(self.db.insect_detections), 1)

        # Retry request
        res2 = self.db.process_detections("ses-1", self.dev_1, dets, "YOLOv8-Test")
        self.assertTrue(res2["already_processed"])
        # Detections row count must still be strictly 1, NOT 2!
        self.assertEqual(len(self.db.insect_detections), 1)

    def test_03_concurrent_requests(self):
        """Scenario 3: Dua request bersamaan untuk session sama -> Tetap satu hasil."""
        captured_time = datetime(2026, 11, 9, 13, 0, 0, tzinfo=timezone.utc)
        self.db.create_session("ses-concurrent", self.dev_1, captured_time)
        dets = [{"species_code": "nilaparvata_lugens", "count": 15}]

        results = []
        def worker():
            r = self.db.process_detections("ses-concurrent", self.dev_1, dets, "YOLOv8-Test")
            results.append(r)

        t1 = threading.Thread(target=worker)
        t2 = threading.Thread(target=worker)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Exactly one worker inserts, the other gets already_processed: True
        self.assertEqual(len(results), 2)
        processed_statuses = [r["already_processed"] for r in results]
        self.assertIn(False, processed_statuses)
        self.assertIn(True, processed_statuses)
        # Exactly one set of detections in DB
        self.assertEqual(len(self.db.insect_detections), 1)

    def test_04_05_06_07_nightly_pest_accumulation_and_threshold(self):
        """Scenario 4, 5, 6, 7: Akumulasi per-malam 20 + 20 + 20 = 60 (Threshold 50)."""
        time1 = datetime(2026, 11, 9, 12, 0, 0, tzinfo=timezone.utc)  # 19:00 WIB
        time2 = datetime(2026, 11, 9, 15, 0, 0, tzinfo=timezone.utc)  # 22:00 WIB
        time3 = datetime(2026, 11, 9, 19, 0, 0, tzinfo=timezone.utc)  # 02:00 WIB (Next day early morning)

        self.db.create_session("ses-1", self.dev_1, time1)
        self.db.create_session("ses-2", self.dev_1, time2)
        self.db.create_session("ses-3", self.dev_1, time3)

        # Scenario 4: Sesi 1 -> Akumulasi 20
        res1 = self.db.process_detections("ses-1", self.dev_1, [{"species_code": "nilaparvata_lugens", "count": 20}], "YOLOv8")
        self.assertEqual(res1["cumulative_target_pests"], 20)
        self.assertFalse(res1["threshold_exceeded"])

        # Scenario 5: Sesi 2 -> Akumulasi 40
        res2 = self.db.process_detections("ses-2", self.dev_1, [{"species_code": "nilaparvata_lugens", "count": 20}], "YOLOv8")
        self.assertEqual(res2["cumulative_target_pests"], 40)
        self.assertFalse(res2["threshold_exceeded"])

        # Scenario 6 & 7: Sesi 3 -> Akumulasi 60 -> Threshold 50 breached!
        res3 = self.db.process_detections("ses-3", self.dev_1, [{"species_code": "nilaparvata_lugens", "count": 20}], "YOLOv8")
        self.assertEqual(res3["cumulative_target_pests"], 60)
        self.assertTrue(res3["threshold_exceeded"])
        self.assertEqual(len(self.db.device_alerts), 1)

    def test_08_device_isolation(self):
        """Scenario 8: Perangkat lain memiliki deteksi -> Tidak tercampur."""
        time1 = datetime(2026, 11, 9, 14, 0, 0, tzinfo=timezone.utc)  # 21:00 WIB
        self.db.create_session("ses-dev1", self.dev_1, time1)
        self.db.create_session("ses-dev2", self.dev_2, time1)

        res_dev1 = self.db.process_detections("ses-dev1", self.dev_1, [{"species_code": "nilaparvata_lugens", "count": 30}], "YOLOv8")
        res_dev2 = self.db.process_detections("ses-dev2", self.dev_2, [{"species_code": "nilaparvata_lugens", "count": 40}], "YOLOv8")

        self.assertEqual(res_dev1["cumulative_target_pests"], 30)
        self.assertEqual(res_dev2["cumulative_target_pests"], 40)
        self.assertFalse(res_dev1["threshold_exceeded"])
        self.assertFalse(res_dev2["threshold_exceeded"])

    def test_09_unmapped_species_not_counted_as_target(self):
        """Scenario 9: Deteksi unmapped -> Tidak dihitung sebagai target pest."""
        time1 = datetime(2026, 11, 9, 14, 0, 0, tzinfo=timezone.utc)
        self.db.create_session("ses-unmapped", self.dev_1, time1)

        dets = [
            {"species_code": "nilaparvata_lugens", "count": 10},
            {"species_code": "unmapped", "count": 50},
        ]
        res = self.db.process_detections("ses-unmapped", self.dev_1, dets, "YOLOv8")
        self.assertEqual(res["target_pests"], 10)
        self.assertEqual(res["other_insects"], 50)
        self.assertEqual(res["cumulative_target_pests"], 10)
        self.assertFalse(res["threshold_exceeded"])

    def test_10_telegram_failure_does_not_break_db(self):
        """Scenario 10: Pengiriman Telegram gagal/timeout -> Deteksi tetap tersimpan di database."""
        time1 = datetime(2026, 11, 9, 14, 0, 0, tzinfo=timezone.utc)
        self.db.create_session("ses-tg-fail", self.dev_1, time1)

        # 60 target pests triggers threshold
        res = self.db.process_detections("ses-tg-fail", self.dev_1, [{"species_code": "nilaparvata_lugens", "count": 60}], "YOLOv8")
        self.assertTrue(res["threshold_exceeded"])
        self.assertEqual(len(self.db.insect_detections), 1)

        # Non-blocking Telegram attempt fails
        tg_res = self.db.dispatch_telegram_mock("pest_thresh_SLT-SBG-01_2026-11-09_tier1", "PEST_THRESHOLD", simulate_network_fail=True)
        self.assertEqual(tg_res["status"], "failed")

        # Database state remains completely intact and valid
        session = self.db.capture_sessions["ses-tg-fail"]
        self.assertEqual(session["processing_status"], "completed")
        self.assertEqual(session["target_pests_count"], 60)
        self.assertEqual(len(self.db.device_alerts), 1)

    def test_11_telegram_retry_deduplication(self):
        """Scenario 11: Retry event Telegram -> Tidak membuat alert ganda (event_key deduplication)."""
        event_key = "pest_thresh_SLT-SBG-01_2026-11-09_tier1"
        res1 = self.db.dispatch_telegram_mock(event_key, "PEST_THRESHOLD", simulate_network_fail=False)
        self.assertEqual(res1["status"], "sent")
        self.assertTrue(res1["sent"])

        # Second dispatch with identical event_key
        res2 = self.db.dispatch_telegram_mock(event_key, "PEST_THRESHOLD", simulate_network_fail=False)
        self.assertEqual(res2["status"], "already_sent")
        self.assertFalse(res2["sent"])
        # Exactly 1 log entry in telegram logs
        self.assertEqual(len(self.db.telegram_logs), 1)


if __name__ == "__main__":
    unittest.main()



if __name__ == "__main__":
    unittest.main()
