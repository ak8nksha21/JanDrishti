"""
JanDrishti - Unit and Integration Tests for Advanced Analytics Subsystems

Covers:
1. CostOverrunDetector (ml/cost_overrun.py)
2. DelayDetector (ml/delay_detection.py)
3. PaymentAnomalyDetector (ml/payment_anomaly.py)
4. Integration with Agent Tools (backend/app/services/agent/tools.py)
"""

from datetime import datetime, timedelta
import unittest
import pandas as pd

from ml.cost_overrun import CostOverrunDetector
from ml.delay_detection import DelayDetector
from ml.payment_anomaly import PaymentAnomalyDetector
from app.services.agent.tools import (
    _try_cost_overrun_detector,
    _try_delay_detector,
    _try_payment_anomaly_detector,
)
from app.models.work import Work


class TestCostOverrunDetector(unittest.TestCase):
    """Unit tests for work-level CostOverrunDetector."""

    def setUp(self):
        self.detector = CostOverrunDetector(
            tolerance_pct=0.0,
            moderate_pct=10.0,
            critical_pct=25.0,
        )

    def test_exact_no_overrun(self):
        """Test work where expenditure is within budget."""
        work = {
            "work_id": "W-001",
            "sanctioned_cost": 1000000.0,
            "actual_expenditure": 950000.0,
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["work_id"], "W-001")
        self.assertEqual(res["overrun_amount"], -50000.0)
        self.assertEqual(res["overrun_percentage"], -5.0)
        self.assertEqual(res["overrun_status"], "no_overrun")
        self.assertEqual(res["overrun_score"], 0.0)
        self.assertFalse(res["is_overrun"])
        self.assertIn("analytical_disclaimer", res)

    def test_moderate_overrun(self):
        """Test work with 8% overrun (within moderate threshold of 10%)."""
        work = {
            "work_id": "W-002",
            "sanctioned_cost": 1000000.0,
            "actual_expenditure": 1080000.0,
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["overrun_amount"], 80000.0)
        self.assertEqual(res["overrun_percentage"], 8.0)
        self.assertEqual(res["overrun_status"], "moderate_overrun")
        self.assertTrue(35.0 <= res["overrun_score"] <= 60.0)
        self.assertTrue(res["is_overrun"])
        self.assertTrue(any("moderate cost overrun" in ev for ev in res["evidence"]))

    def test_critical_overrun(self):
        """Test work with 40% overrun (above critical threshold of 25%)."""
        work = {
            "work_id": "W-003",
            "sanctioned_cost": 500000.0,
            "actual_expenditure": 700000.0,
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["overrun_amount"], 200000.0)
        self.assertEqual(res["overrun_percentage"], 40.0)
        self.assertEqual(res["overrun_status"], "critical_overrun")
        self.assertGreaterEqual(res["overrun_score"], 80.0)
        self.assertTrue(res["is_overrun"])
        self.assertTrue(any("Significant budget overrun detected" in ev for ev in res["evidence"]))

    def test_missing_data_handling(self):
        """Test safe handling when sanctioned cost or expenditure is missing."""
        work_missing_sanction = {"work_id": "W-004", "actual_expenditure": 500000.0}
        res = self.detector.evaluate_work(work_missing_sanction)
        self.assertIsNone(res["overrun_amount"])
        self.assertIsNone(res["overrun_percentage"])
        self.assertIsNone(res["overrun_score"])
        self.assertEqual(res["overrun_status"], "insufficient_data")
        self.assertFalse(res["is_overrun"])

    def test_zero_sanctioned_cost(self):
        """Test zero sanctioned cost with positive expenditure."""
        work = {
            "work_id": "W-005",
            "sanctioned_cost": 0.0,
            "actual_expenditure": 250000.0,
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["overrun_amount"], 250000.0)
        self.assertIsNone(res["overrun_percentage"])
        self.assertEqual(res["overrun_status"], "zero_cost_baseline_overrun")
        self.assertTrue(res["is_overrun"])

    def test_negative_financial_values(self):
        """Test negative financial numbers are flagged without breaking."""
        work = {
            "work_id": "W-006",
            "sanctioned_cost": -1000.0,
            "actual_expenditure": 50000.0,
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["overrun_status"], "invalid_negative_values")
        self.assertIsNone(res["overrun_score"])

    def test_batch_dataframe_audit(self):
        """Test DataFrame batch processing and enrichment."""
        df = pd.DataFrame([
            {"work_id": "W-1", "sanctioned_cost": 100.0, "actual_expenditure": 100.0},
            {"work_id": "W-2", "sanctioned_cost": 100.0, "actual_expenditure": 130.0},
            {"work_id": "W-3", "sanctioned_cost": None, "actual_expenditure": 130.0},
        ])
        enriched = self.detector.audit_dataframe(df)
        self.assertIn("overrun_amount", enriched.columns)
        self.assertIn("overrun_percentage", enriched.columns)
        self.assertIn("is_cost_overrun", enriched.columns)
        self.assertEqual(enriched.iloc[0]["overrun_status"], "no_overrun")
        self.assertEqual(enriched.iloc[1]["overrun_status"], "critical_overrun")
        self.assertEqual(enriched.iloc[2]["overrun_status"], "insufficient_data")


class TestDelayDetector(unittest.TestCase):
    """Unit tests for work DelayDetector and execution-time analysis."""

    def setUp(self):
        self.detector = DelayDetector()

    def test_completed_work_duration(self):
        """Test execution duration calculation for a completed work."""
        work = {
            "work_id": "W-101",
            "sanction_date": "2024-01-01",
            "completion_date": "2024-06-29",
            "category": "Roads",
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["work_id"], "W-101")
        self.assertEqual(res["duration_days"], 180)
        self.assertTrue(res["is_completed"])
        self.assertIsNotNone(res["delay_score"])
        self.assertIn("analytical_disclaimer", res)

    def test_missing_sanction_date_insufficient_data(self):
        """Strict requirement: missing sanction date yields insufficient_data without guessing."""
        work = {
            "work_id": "W-102",
            "completion_date": "2024-06-29",
            "category": "Roads",
        }
        res = self.detector.evaluate_work(work)
        self.assertIsNone(res["duration_days"])
        self.assertIsNone(res["delay_score"])
        self.assertEqual(res["delay_status"], "insufficient_data")
        self.assertTrue(any("verified sanction date is not present" in obs for obs in res["observations"]))

    def test_ongoing_work_with_reference_date(self):
        """Test elapsed ongoing duration calculation."""
        work = {
            "work_id": "W-103",
            "sanction_date": "2024-01-01",
            "completion_date": None,
            "category": "Water Supply",
        }
        ref_date = datetime(2024, 7, 1)  # 182 days later
        res = self.detector.evaluate_work(work, reference_date=ref_date)
        self.assertEqual(res["duration_days"], 182)
        self.assertFalse(res["is_completed"])
        self.assertIsNotNone(res["delay_score"])

    def test_chronology_anomaly(self):
        """Test work with completion date prior to sanction date."""
        work = {
            "work_id": "W-104",
            "sanction_date": "2024-06-01",
            "completion_date": "2024-01-01",
        }
        res = self.detector.evaluate_work(work)
        self.assertEqual(res["delay_status"], "invalid_chronology")
        self.assertIsNone(res["duration_days"])

    def test_peer_baseline_fitting(self):
        """Test peer category and global baseline computation."""
        historical_data = [
            {"sanction_date": "2023-01-01", "completion_date": "2023-04-01", "category": "Roads"},   # 90 days
            {"sanction_date": "2023-01-01", "completion_date": "2023-04-11", "category": "Roads"},   # 100 days
            {"sanction_date": "2023-01-01", "completion_date": "2023-04-21", "category": "Roads"},   # 110 days
            {"sanction_date": "2023-01-01", "completion_date": "2023-05-01", "category": "Roads"},   # 120 days
            {"sanction_date": "2023-01-01", "completion_date": "2023-05-11", "category": "Roads"},   # 130 days
        ]
        self.detector.fit(historical_data)
        self.assertIn("Roads", self.detector.peer_baselines_["category"])
        baseline = self.detector.peer_baselines_["category"]["Roads"]
        self.assertEqual(baseline["median_days"], 110.0)

        # Test evaluating an unusually long work in Roads (350 days vs 110 baseline)
        test_work = {
            "work_id": "W-105",
            "sanction_date": "2024-01-01",
            "completion_date": "2024-12-16",  # 350 days
            "category": "Roads",
        }
        res = self.detector.evaluate_work(test_work)
        self.assertEqual(res["duration_days"], 350)
        self.assertEqual(res["peer_median_days"], 110.0)
        self.assertEqual(res["delay_status"], "unusually_long_execution_duration")
        self.assertGreater(res["delay_score"], 70.0)


class TestPaymentAnomalyDetector(unittest.TestCase):
    """Unit tests for PaymentAnomalyDetector."""

    def setUp(self):
        self.detector = PaymentAnomalyDetector()

    def test_financial_physical_mismatch(self):
        """Test detection of high expenditure (85%) with low physical completion (20%)."""
        record = {
            "source_id": "MP-001",
            "mp_name": "Test MP",
            "allocated_amount": 50000000.0,
            "total_expenditure": 42500000.0,
            "utilization_percentage": 85.0,
            "completion_rate": 20.0,
            "payment_gap_percentage": 10.0,
        }
        res = self.detector.evaluate_record(record)
        self.assertIn("FINANCIAL_PHYSICAL_MISMATCH", res["discrepancy_signals"])
        self.assertGreaterEqual(res["payment_risk_score"], 60.0)
        self.assertIn(res["financial_execution_status"], ["elevated_execution_risk", "critical_execution_mismatch"])
        self.assertTrue(any("Financial execution discrepancy" in obs for obs in res["observations"]))

    def test_critical_payment_gap(self):
        """Test detection of substantial payment gap (> 50%)."""
        record = {
            "source_id": "MP-002",
            "mp_name": "Test MP 2",
            "allocated_amount": 50000000.0,
            "utilization_percentage": 50.0,
            "completion_rate": 50.0,
            "payment_gap_percentage": 55.0,
        }
        res = self.detector.evaluate_record(record)
        self.assertIn("CRITICAL_PAYMENT_GAP", res["discrepancy_signals"])
        self.assertGreaterEqual(res["payment_risk_score"], 60.0)

    def test_insufficient_data(self):
        """Test safe handling when financial metrics are missing."""
        record = {"source_id": "MP-003", "mp_name": "Sparse MP"}
        res = self.detector.evaluate_record(record)
        self.assertIsNone(res["payment_risk_score"])
        self.assertEqual(res["financial_execution_status"], "insufficient_data")

    def test_conditional_isolation_forest_fitting(self):
        """
        Verify Isolation Forest is strictly fitted only when samples >= 10,
        and falls back cleanly to statistical ratios when samples < 10.
        """
        # 1. Sparse dataset (< 10 records) -> should NOT fit IsolationForest
        sparse_data = [
            {"allocated_amount": 100.0, "total_expenditure": 80.0, "utilization_percentage": 80.0, "completion_rate": 75.0}
            for _ in range(5)
        ]
        sparse_detector = PaymentAnomalyDetector()
        sparse_detector.fit(sparse_data)
        self.assertIsNone(sparse_detector.iforest_model_)

        # Evaluation should use statistical ratio fallback
        res_sparse = sparse_detector.evaluate_record(sparse_data[0])
        self.assertEqual(res_sparse["engine_mode"], "statistical_ratio_fallback")

        # 2. Rich dataset (>= 10 records) -> should fit IsolationForest
        rich_data = [
            {
                "allocated_amount": 100.0,
                "total_expenditure": 70.0 + (i % 20),
                "utilization_percentage": 70.0 + (i % 20),
                "completion_rate": 65.0 + (i % 25),
                "payment_gap_percentage": 5.0 + (i % 10),
                "unspent_amount": 10.0,
            }
            for i in range(15)
        ]
        rich_detector = PaymentAnomalyDetector()
        rich_detector.fit(rich_data)
        self.assertIsNotNone(rich_detector.iforest_model_)

        # Evaluation should reflect Isolation Forest inclusion
        res_rich = rich_detector.evaluate_record(rich_data[0])
        self.assertEqual(res_rich["engine_mode"], "isolation_forest_and_ratios")


class TestAgentAdapters(unittest.TestCase):
    """Tests for agent adapter functions in app/services/agent/tools.py."""

    def test_cost_overrun_adapter_with_orm_work(self):
        work = Work(
            id=999,
            work_id=99999,
            cost=500000.0,
        )
        res = _try_cost_overrun_detector(work)
        self.assertIsNotNone(res)
        self.assertEqual(res["work_id"], "99999")

    def test_delay_adapter_with_orm_work(self):
        work = Work(
            id=998,
            work_id=99998,
            completion_date=datetime(2024, 6, 1),
        )
        # Without sanction_date, should return insufficient_data cleanly
        res = _try_delay_detector(work)
        self.assertIsNotNone(res)
        self.assertEqual(res["delay_status"], "insufficient_data")

    def test_payment_anomaly_adapter(self):
        rec = {
            "source_id": "MP-99",
            "utilization_percentage": 85.0,
            "completion_rate": 15.0,
        }
        res = _try_payment_anomaly_detector(rec)
        self.assertIsNotNone(res)
        self.assertIn("FINANCIAL_PHYSICAL_MISMATCH", res["discrepancy_signals"])


if __name__ == "__main__":
    unittest.main()
