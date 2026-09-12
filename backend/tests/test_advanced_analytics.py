"""
JanDrishti - Unit and Integration Tests for Advanced Analytics Subsystems

Covers:
1. OfficialSanctionService (backend/app/services/enrichment/esakshi.py)
   - Cache integrity & dynamic total_records calculation
   - 591/591 offline fixture match verification
   - Provenance tracking (MoSPI e-SAKSHI, SANCTION_AMOUNT, SANCTION_DATE)
2. CostOverrunDetector (ml/cost_overrun.py)
   - Verified baseline exposure with insufficient_data when independent expenditure is missing
   - No false 0% overrun when reported cost == sanctioned baseline
   - True overrun calculation when genuine independent actual expenditure is supplied
3. DelayDetector (ml/delay_detection.py)
   - Official sanction date parsing (%d-%b-%Y)
   - Exact 107-day execution duration for Work #222927
   - Numerical peer median statistics and neutral classification
4. Canonical Risk Engine Preservation
   - Proves six canonical risk signals and weights remain unaltered.
"""

from datetime import datetime, date
import unittest
import pandas as pd

from ml.cost_overrun import CostOverrunDetector
from ml.delay_detection import DelayDetector
from ml.payment_anomaly import PaymentAnomalyDetector
from ml.risk_engine import DEFAULT_SIGNAL_WEIGHTS
from app.services.enrichment.esakshi import OfficialSanctionService, official_sanction_service
from app.services.agent.tools import (
    _try_cost_overrun_detector,
    _try_delay_detector,
    _try_payment_anomaly_detector,
)
from app.database import SessionLocal
from app.models.work import Work


class TestOfficialSanctionService(unittest.TestCase):
    """Unit and fixture tests for OfficialSanctionService (100% offline, zero live network calls)."""

    def setUp(self):
        self.service = official_sanction_service

    def test_cache_integrity_and_dynamic_count(self):
        """Verify cache total_records is derived strictly from len(records) as an integer."""
        self.assertIsInstance(self.service.total_records, int)
        self.assertEqual(self.service.total_records, len(self.service.records))
        self.assertGreater(self.service.total_records, 0)

    def test_deduplication_safeguard(self):
        """Verify build_cache_dict prevents duplicate IDs from inflating total_records."""
        raw_mock = [
            {"WORK_RECOMMENDATION_DTL_ID": 99999, "SANCTION_AMOUNT": 100000, "SANCTION_DATE": "01-Jan-2026"},
            {"WORK_RECOMMENDATION_DTL_ID": 99999, "SANCTION_AMOUNT": 100000, "SANCTION_DATE": "01-Jan-2026"},
            {"WORK_RECOMMENDATION_DTL_ID": 88888, "SANCTION_AMOUNT": 200000, "SANCTION_DATE": "02-Jan-2026"},
        ]
        built = OfficialSanctionService.build_cache_dict(raw_mock)
        self.assertEqual(built["total_records"], 2)
        self.assertEqual(len(built["records"]), 2)
        self.assertIsInstance(built["total_records"], int)

    def test_work_222927_sanction_info(self):
        """Verify Work #222927 retrieves verified sanction baseline and date from cache."""
        info = self.service.get_sanction_info(222927)
        self.assertIsNotNone(info)
        self.assertEqual(info["work_id"], 222927)
        self.assertEqual(info["official_sanction_amount"], 271441.0)
        self.assertEqual(info["official_sanction_date"], "22-Apr-2026")
        self.assertEqual(info["official_sanction_source"], "MoSPI e-SAKSHI")
        self.assertEqual(info["official_sanction_field"], "SANCTION_AMOUNT")
        self.assertEqual(info["official_sanction_match_key"], "WORK_RECOMMENDATION_DTL_ID == work_id")
        self.assertTrue(info["official_sanction_verified"])

    def test_sample_works_official_values(self):
        """Verify official sanction values for all test sample works."""
        expectations = {
            188167: (1593200.0, "19-Nov-2025"),
            191563: (661200.0, "19-Nov-2025"),
            222927: (271441.0, "22-Apr-2026"),
            270307: (2120197.0, "21-Jul-2026"),
            278726: (2400201.0, "27-Jul-2026"),
            214233: (1000000.0, "13-Jan-2026"),
        }
        for wid, (expected_amt, expected_date) in expectations.items():
            info = self.service.get_sanction_info(wid)
            self.assertIsNotNone(info, f"Missing sanction info for #{wid}")
            self.assertEqual(info["official_sanction_amount"], expected_amt, f"Amount mismatch for #{wid}")
            self.assertEqual(info["official_sanction_date"], expected_date, f"Date mismatch for #{wid}")
            self.assertEqual(info["official_sanction_source"], "MoSPI e-SAKSHI")

    def test_database_591_exact_match(self):
        """Verify that all 591 works in JanDrishti database match official cache records."""
        db = SessionLocal()
        works = db.query(Work).all()
        self.assertEqual(len(works), 591)

        matched = 0
        for w in works:
            wid = w.work_id or w.id
            if self.service.get_sanction_info(wid) is not None:
                matched += 1
        db.close()

        self.assertEqual(matched, 591)


class TestCostOverrunDetector(unittest.TestCase):
    """Unit tests for work-level CostOverrunDetector with financial integrity rules."""

    def setUp(self):
        self.detector = CostOverrunDetector(
            tolerance_pct=0.0,
            moderate_pct=20.0,
            critical_pct=50.0,
        )

    def test_sanction_baseline_present_actual_expenditure_missing(self):
        """
        Critical Financial Integrity Rule:
        When official sanction baseline exists, but independent actual expenditure is unavailable,
        detector must return 'insufficient_data' (NOT 0% overrun).
        """
        work = {
            "work_id": "222927",
            "official_sanction_amount": 271441.0,
            "reported_completed_cost": 271441.0,
            "actual_expenditure": None,  # Missing independent ledger
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["work_id"], "222927")
        self.assertEqual(res["sanctioned_cost"], 271441.0)
        self.assertIsNone(res["actual_expenditure"])
        self.assertEqual(res["reported_completed_cost"], 271441.0)
        self.assertIsNone(res["overrun_amount"])
        self.assertIsNone(res["overrun_percentage"])
        self.assertIsNone(res["overrun_score"])
        self.assertEqual(res["overrun_status"], "insufficient_data")
        self.assertFalse(res["is_overrun"])
        self.assertTrue(res["baseline_available"])
        self.assertFalse(res["independent_actual_expenditure_available"])
        self.assertEqual(res["sanctioned_cost_source"], "MoSPI e-SAKSHI")
        self.assertEqual(res["sanctioned_cost_field"], "SANCTION_AMOUNT")
        self.assertTrue(any("Verified sanctioned baseline is available" in ev for ev in res["evidence"]))

    def test_equal_values_do_not_produce_zero_percent_overrun(self):
        """Prove that equal reported completed cost and sanctioned cost returns insufficient_data."""
        work = {
            "work_id": "188167",
            "sanctioned_cost": 1593200.0,
            "reported_completed_cost": 1593200.0,
            "actual_expenditure": None,
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["overrun_status"], "insufficient_data")
        self.assertIsNone(res["overrun_percentage"])
        self.assertIsNone(res["overrun_amount"])

    def test_true_overrun_with_independent_expenditure(self):
        """Test true budget overrun when independent actual expenditure is provided."""
        work = {
            "work_id": "W-TEST-1",
            "sanctioned_cost": 100000.0,
            "actual_expenditure": 120000.0,
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["overrun_amount"], 20000.0)
        self.assertEqual(res["overrun_percentage"], 20.0)
        self.assertEqual(res["overrun_status"], "moderate_overrun")
        self.assertTrue(res["is_overrun"])
        self.assertTrue(res["independent_actual_expenditure_available"])

    def test_missing_sanctioned_cost_baseline(self):
        """Test handling when sanctioned baseline is missing."""
        work = {
            "work_id": "W-TEST-2",
            "actual_expenditure": 120000.0,
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["overrun_status"], "insufficient_data")
        self.assertFalse(res["baseline_available"])
        self.assertIsNone(res["overrun_amount"])

    def test_zero_sanctioned_cost_with_expenditure(self):
        """Test zero sanctioned cost with positive expenditure."""
        work = {
            "work_id": "W-TEST-3",
            "sanctioned_cost": 0.0,
            "actual_expenditure": 250000.0,
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["overrun_amount"], 250000.0)
        self.assertEqual(res["overrun_status"], "zero_cost_baseline_overrun")
        self.assertTrue(res["is_overrun"])

    def test_negative_financial_values(self):
        """Test negative financial values are cleanly rejected without throwing."""
        work = {
            "work_id": "W-TEST-4",
            "sanctioned_cost": -5000.0,
            "actual_expenditure": 50000.0,
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["overrun_status"], "invalid_negative_values")
        self.assertIsNone(res["overrun_score"])


class TestDelayDetector(unittest.TestCase):
    """Unit tests for work DelayDetector and execution-time analysis."""

    def setUp(self):
        self.detector = DelayDetector()

    def test_work_222927_execution_duration(self):
        """
        Verify exact execution duration calculation for Work #222927:
        Official Sanction Date: 22-Apr-2026
        Completion Date: 07-Aug-2026
        Duration = (2026-08-07 - 2026-04-22).days = 107 days.
        """
        work = {
            "work_id": "222927",
            "official_sanction_date": "22-Apr-2026",
            "completion_date": "2026-08-07",
            "category": "Roads",
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["work_id"], "222927")
        self.assertEqual(res["duration_days"], 107)
        self.assertEqual(res["sanction_date"], "2026-04-22")
        self.assertEqual(res["completion_date"], "2026-08-07")
        self.assertEqual(res["sanction_date_source"], "MoSPI e-SAKSHI")
        self.assertEqual(res["sanction_date_field"], "SANCTION_DATE")
        self.assertTrue(res["sanction_date_verified"])
        self.assertTrue(res["is_completed"])
        self.assertIsNotNone(res["delay_score"])

    def test_missing_sanction_date_insufficient_data(self):
        """Strict rule: missing sanction date yields insufficient_data without assuming proxy."""
        work = {
            "work_id": "W-NO-DATE",
            "completion_date": "2026-08-07",
            "category": "Roads",
        }
        res = self.detector.evaluate_work(work)
        self.assertIsNone(res["duration_days"])
        self.assertEqual(res["delay_status"], "insufficient_data")
        self.assertFalse(res["sanction_date_verified"])

    def test_invalid_chronology(self):
        """Test work with completion date preceding sanction date."""
        work = {
            "work_id": "W-ANOMALY",
            "sanction_date": "2026-08-01",
            "completion_date": "2026-04-01",
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["delay_status"], "invalid_chronology")
        self.assertIsNone(res["duration_days"])

    def test_peer_baseline_fitting_and_numerical_median(self):
        """Test peer distribution fitting computes numerical median, not placeholder strings."""
        historical = [
            {"sanction_date": "01-Jan-2025", "completion_date": "01-Apr-2025", "category": "Sanitation"},  # 90 days
            {"sanction_date": "01-Jan-2025", "completion_date": "11-Apr-2025", "category": "Sanitation"},  # 100 days
            {"sanction_date": "01-Jan-2025", "completion_date": "21-Apr-2025", "category": "Sanitation"},  # 110 days
            {"sanction_date": "01-Jan-2025", "completion_date": "01-May-2025", "category": "Sanitation"},  # 120 days
            {"sanction_date": "01-Jan-2025", "completion_date": "11-May-2025", "category": "Sanitation"},  # 130 days
        ]
        self.detector.fit(historical)
        self.assertIn("Sanitation", self.detector.peer_baselines_["category"])
        baseline = self.detector.peer_baselines_["category"]["Sanitation"]
        self.assertEqual(baseline["median_days"], 110.0)
        self.assertIsInstance(baseline["median_days"], float)

        work = {
            "work_id": "W-SAN-1",
            "sanction_date": "01-Jan-2026",
            "completion_date": "11-Apr-2026",  # 100 days <= 110 median
            "category": "Sanitation",
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["duration_days"], 100)
        self.assertEqual(res["peer_median_days"], 110.0)
        self.assertEqual(res["delay_status"], "within_normal_baseline")


class TestCanonicalRiskPreservation(unittest.TestCase):
    """Prove canonical six-signal Risk Engine weights and logic are 100% unaltered."""

    def test_canonical_weights_preserved(self):
        expected_weights = {
            "ml_anomaly_score": 0.25,
            "cost_anomaly_score": 0.25,
            "duplicate_score": 0.20,
            "utilization_score": 0.15,
            "geographic_score": 0.10,
            "data_quality_score": 0.05,
        }
        self.assertEqual(DEFAULT_SIGNAL_WEIGHTS, expected_weights)
        self.assertNotIn("official_sanction_amount", DEFAULT_SIGNAL_WEIGHTS)
        self.assertNotIn("cost_overrun", DEFAULT_SIGNAL_WEIGHTS)
        self.assertNotIn("delay_analysis", DEFAULT_SIGNAL_WEIGHTS)
        self.assertNotIn("execution_duration", DEFAULT_SIGNAL_WEIGHTS)


if __name__ == "__main__":
    unittest.main()
