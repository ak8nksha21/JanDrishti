"""
JanDrishti - Comprehensive Unit Test Suite for ML Anomaly Detection

Tests compliance against statistical integrity, explainability, null safety,
and deterministic modeling standards across:
1. Cost Anomaly Detection (0-100 scale, hierarchical peer groups, structured evidence)
2. Multi-variable MP Financial Anomaly Detection (0-100 scale, Isolation Forest, ratio bounds)
3. Utilization Anomaly Detection (0-100 scale, cohort distributions, discrepancy checks)
4. Unified AnomalyDetector Integration & Downstream Compatibility
"""

import unittest
import numpy as np
import pandas as pd
import os
import sys

# Ensure repository root is on sys.path so canonical ml package is directly imported
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

try:
    from ml.anomaly_detection import (
        AnomalyDetector,
        CostAnomalyDetector,
        MPFinancialAnomalyDetector,
        UtilizationAnomalyDetector,
        safe_float,
        safe_int,
        safe_ratio,
        clip_score,
        MP_FINANCIAL_FIELD_MAP,
        normalize_mp_financial_dataframe,
    )
    ML_IMPORT_ERROR = None
except ModuleNotFoundError as err:
    AnomalyDetector = None
    ML_IMPORT_ERROR = str(err)


@unittest.skipIf(
    AnomalyDetector is None,
    f"Canonical 'ml' package could not be imported ({ML_IMPORT_ERROR}). "
    "Run tests from workspace root: python3 -m unittest discover -s backend/tests -p 'test_anomaly_detection.py'"
)
class TestAnomalyDetection(unittest.TestCase):
    """Comprehensive test suite for JanDrishti ML anomaly detection subsystem."""

    def setUp(self):
        """Set up standard synthetic baselines for works and MP financial records."""
        np.random.seed(42)

        # Baseline Works: 20 typical projects (costs 50k to 140k)
        baseline_costs = [
            50000, 55000, 60000, 62000, 65000, 70000, 72000, 75000, 78000, 80000,
            82000, 85000, 88000, 90000, 95000, 100000, 110000, 120000, 130000, 140000
        ]
        self.baseline_works_df = pd.DataFrame({
            "work_id": [1000 + i for i in range(len(baseline_costs))],
            "cost": baseline_costs,
            "category": ["Infrastructure"] * 10 + ["Drinking Water"] * 10,
            "district": ["District_A"] * 10 + ["District_B"] * 10,
            "constituency": ["Const_1"] * 10 + ["Const_2"] * 10,
            "completion_year": [2024] * 20,
            "completion_date": ["2024-06-15T00:00:00"] * 20,
        })

        # Baseline MP Financials: 20 typical MPs (70-79.5% utilization)
        self.baseline_mps_df = pd.DataFrame({
            "mp_name": [f"MP_{i}" for i in range(20)],
            "allocated_amount": [100000000.0] * 20,
            "total_expenditure": [70000000.0 + i * 500000.0 for i in range(20)],
            "utilization_percentage": [70.0 + i * 0.5 for i in range(20)],
            "completed_works_count": [50 + i for i in range(20)],
            "recommended_works_count": [100] * 20,
            "completion_rate": [50.0 + i for i in range(20)],
            "pending_works": [50 - i for i in range(20)],
            "unspent_amount": [30000000.0 - i * 500000.0 for i in range(20)],
            "completed_works_value": [40000000.0] * 20,
            "in_progress_payments": [10000000.0] * 20,
            "payment_gap_percentage": [15.0] * 20,
        })

    # =========================================================================
    # PART 1: REUSABLE DATA & SCORING HELPERS
    # =========================================================================

    def test_01_safe_helpers(self):
        """1. Test safe numeric, string, ratio, and clipping helpers."""
        self.assertIsNone(safe_float(None))
        self.assertIsNone(safe_float(""))
        self.assertIsNone(safe_float("invalid"))
        self.assertIsNone(safe_float(np.nan))
        self.assertEqual(safe_float("1,250,000"), 1250000.0)
        self.assertEqual(safe_float("78.5%"), 78.5)
        self.assertEqual(safe_float(100), 100.0)

        self.assertEqual(safe_int("100"), 100)
        self.assertEqual(safe_int("100.4"), 100)
        self.assertIsNone(safe_int(None))

        self.assertIsNone(safe_ratio(100, 0))
        self.assertIsNone(safe_ratio(100, None))
        self.assertEqual(safe_ratio(50, 100), 0.5)

        self.assertEqual(clip_score(-5.0), 0.0)
        self.assertEqual(clip_score(150.0), 100.0)
        self.assertEqual(clip_score(45.5), 45.5)
        self.assertIsNone(clip_score(None))

    # =========================================================================
    # PART 2: COST ANOMALY TESTS
    # =========================================================================

    def test_02_cost_normal_values(self):
        """2. Test that typical costs within IQR distribution produce low scores (0-30)."""
        detector = AnomalyDetector()
        detector.fit(self.baseline_works_df)

        normal_df = pd.DataFrame({
            "work_id": [9991, 9992],
            "cost": [70000.0, 80000.0],
            "category": ["Infrastructure", "Drinking Water"],
            "district": ["District_A", "District_B"],
            "completion_year": [2024, 2024],
        })

        results = detector.predict(normal_df)

        for _, row in results.iterrows():
            self.assertFalse(row["is_anomaly"])
            self.assertLessEqual(row["cost_anomaly_score"], 30.0)
            self.assertEqual(row["cost_score"], row["cost_anomaly_score"])
            self.assertIn("within normal statistical distribution", row["explanation"])
            self.assertIn("cost_details", row["evidence"])

    def test_03_cost_high_outlier(self):
        """3. Test that extreme cost outliers receive high 0-100 scores and structured evidence."""
        detector = AnomalyDetector()
        detector.fit(self.baseline_works_df)

        outlier_df = pd.DataFrame({
            "work_id": [9993],
            "cost": [5000000.0],  # 50 Lakhs vs baseline 50k-140k
            "category": ["Infrastructure"],
            "district": ["District_A"],
            "completion_year": [2024],
        })

        results = detector.predict(outlier_df)
        row = results.iloc[0]

        self.assertTrue(row["is_anomaly"])
        self.assertIn("cost_anomaly", row["anomaly_type"])
        self.assertGreaterEqual(row["cost_anomaly_score"], 80.0)
        self.assertLessEqual(row["cost_anomaly_score"], 100.0)
        self.assertIn("outlier", row["explanation"])
        self.assertNotIn("fraud", row["explanation"].lower())
        self.assertNotIn("cost overrun", row["explanation"].lower())

        # Structured evidence verification
        details = row["evidence"]["cost_details"]
        self.assertEqual(details["cost"], 5000000.0)
        self.assertGreater(details["peer_count"], 0)
        self.assertIsNotNone(details["peer_median_cost"])
        self.assertIsNotNone(details["deviation_percentage"])

    def test_04_cost_hierarchical_peer_groups(self):
        """4. Test that peer selection follows Category+District -> Category -> Global fallback."""
        cad = CostAnomalyDetector()
        cad.fit(self.baseline_works_df)

        # A. Matching category + district
        match_cat_dist = pd.DataFrame([{"cost": 75000.0, "category": "Infrastructure", "district": "District_A"}])
        res_a = cad.predict(match_cat_dist)[0]
        self.assertEqual(res_a["details"]["peer_group_used"], "category_district")

        # B. Matching category but unknown district -> falls back to category
        match_cat_only = pd.DataFrame([{"cost": 75000.0, "category": "Infrastructure", "district": "Unknown_Dist"}])
        res_b = cad.predict(match_cat_only)[0]
        self.assertEqual(res_b["details"]["peer_group_used"], "category")

        # C. Unknown category -> falls back to global
        match_global = pd.DataFrame([{"cost": 75000.0, "category": "Nonexistent_Cat", "district": "Unknown_Dist"}])
        res_c = cad.predict(match_global)[0]
        self.assertEqual(res_c["details"]["peer_group_used"], "global")

    def test_05_cost_missing_null_values(self):
        """5. Test that missing/null costs are handled gracefully without converting to zero."""
        detector = AnomalyDetector()
        detector.fit(self.baseline_works_df)

        missing_df = pd.DataFrame({
            "work_id": [9994, 9995],
            "cost": [None, np.nan],
            "category": ["Infrastructure", "Drinking Water"],
        })

        results = detector.predict(missing_df)

        row1 = results.iloc[0]
        self.assertTrue(pd.isna(row1["cost"]) or row1["cost"] is None)
        self.assertIsNone(row1["cost_anomaly_score"])
        self.assertFalse(row1["is_anomaly"])
        self.assertIn("Cost data is missing", row1["explanation"])

        row2 = results.iloc[1]
        self.assertIsNone(row2["cost_anomaly_score"])
        self.assertFalse(row2["is_anomaly"])

    def test_06_cost_constant_values(self):
        """6. Test uniform cost baseline (IQR == 0) without division-by-zero errors."""
        constant_df = pd.DataFrame({
            "work_id": [201, 202, 203, 204, 205],
            "cost": [500000.0] * 5,
            "category": ["Standard"] * 5,
        })
        detector = AnomalyDetector()
        detector.fit(constant_df)

        # Match uniform baseline
        match_test = pd.DataFrame([{"cost": 500000.0, "category": "Standard"}])
        res_match = detector.predict(match_test).iloc[0]
        self.assertFalse(res_match["is_anomaly"])
        self.assertEqual(res_match["cost_anomaly_score"], 0.0)

        # Deviate from uniform baseline
        dev_test = pd.DataFrame([{"cost": 2000000.0, "category": "Standard"}])
        res_dev = detector.predict(dev_test).iloc[0]
        self.assertTrue(res_dev["is_anomaly"])
        self.assertGreaterEqual(res_dev["cost_anomaly_score"], 60.0)

    # =========================================================================
    # PART 3: MP FINANCIAL ANOMALY TESTS
    # =========================================================================

    def test_07_financial_normal_mp(self):
        """7. Test that normal MP financial distributions produce low scores (< 30)."""
        fad = MPFinancialAnomalyDetector()
        fad.fit(self.baseline_mps_df)

        normal_mp = pd.DataFrame([{
            "allocated_amount": 100000000.0,
            "total_expenditure": 75000000.0,
            "utilization_percentage": 75.0,
            "unspent_amount": 25000000.0,
            "completed_works_count": 55,
            "recommended_works_count": 100,
            "completion_rate": 55.0,
            "payment_gap_percentage": 15.0,
        }])

        res = fad.predict(normal_mp)[0]
        self.assertFalse(res["is_anomalous"])
        self.assertLessEqual(res["financial_anomaly_score"], 30.0)
        self.assertIn("normal operational parameters", res["observations"][0])

    def test_08_financial_high_expenditure_anomaly(self):
        """8. Test that expenditure exceeding allocation (> 100%) triggers financial anomaly."""
        fad = MPFinancialAnomalyDetector()
        fad.fit(self.baseline_mps_df)

        over_exp_mp = pd.DataFrame([{
            "allocated_amount": 100000000.0,
            "total_expenditure": 140000000.0,  # 140%
            "utilization_percentage": 140.0,
            "unspent_amount": 0.0,
            "completed_works_count": 90,
            "recommended_works_count": 100,
            "payment_gap_percentage": 15.0,
        }])

        res = fad.predict(over_exp_mp)[0]
        self.assertTrue(res["is_anomalous"])
        self.assertGreaterEqual(res["financial_anomaly_score"], 60.0)
        self.assertLessEqual(res["financial_anomaly_score"], 100.0)
        self.assertTrue(any("exceeds allocated funds" in obs for obs in res["observations"]))
        self.assertEqual(res["details"]["derived_ratios"]["expenditure_to_allocation"], 1.4)

    def test_09_financial_unspent_and_payment_gap(self):
        """9. Test elevated payment gaps and excessive unspent funds."""
        fad = MPFinancialAnomalyDetector()
        fad.fit(self.baseline_mps_df)

        problem_mp = pd.DataFrame([{
            "allocated_amount": 100000000.0,
            "total_expenditure": 15000000.0,
            "utilization_percentage": 15.0,
            "unspent_amount": 85000000.0,  # 85% unspent
            "payment_gap_percentage": 65.0,  # High payment gap
        }])

        res = fad.predict(problem_mp)[0]
        self.assertTrue(res["is_anomalous"])
        self.assertGreaterEqual(res["financial_anomaly_score"], 60.0)
        self.assertTrue(any("Payment gap is elevated" in obs for obs in res["observations"]))

    def test_10_financial_small_and_empty_datasets(self):
        """10. Test that small/empty MP datasets do not crash and fall back safely."""
        fad = MPFinancialAnomalyDetector()

        # Empty DataFrame
        empty_df = pd.DataFrame()
        fad.fit(empty_df)
        self.assertTrue(fad.is_fitted_)
        res_empty = fad.predict(empty_df)
        self.assertEqual(len(res_empty), 0)

        # 1-row DataFrame
        one_row = pd.DataFrame([{"allocated_amount": 50000000.0, "total_expenditure": 40000000.0}])
        fad.fit(one_row)
        res_one = fad.predict(one_row)
        self.assertEqual(len(res_one), 1)
        self.assertIsNotNone(res_one[0]["financial_anomaly_score"])

        # Missing all financial columns
        no_fin = pd.DataFrame([{"unrelated_col": "text"}])
        res_no_fin = fad.predict(no_fin)[0]
        self.assertIsNone(res_no_fin["financial_anomaly_score"])
        self.assertEqual(res_no_fin["method"], "insufficient_data")

    # =========================================================================
    # PART 4: UTILIZATION ANOMALY TESTS
    # =========================================================================

    def test_11_utilization_normal(self):
        """11. Test that normal utilization matching cohort produces low score."""
        uad = UtilizationAnomalyDetector()
        uad.fit(self.baseline_mps_df)

        normal_mp = pd.DataFrame([{
            "allocated_amount": 100000000.0,
            "total_expenditure": 75000000.0,
            "utilization_percentage": 75.0,
            "unspent_amount": 25000000.0,
        }])

        res = uad.predict(normal_mp)[0]
        self.assertFalse(res["is_anomalous"])
        self.assertLessEqual(res["utilization_anomaly_score"], 30.0)
        self.assertEqual(res["actual_utilization"], 75.0)

    def test_12_utilization_severe_underutilization(self):
        """12. Test that severe underutilization relative to cohort is flagged."""
        uad = UtilizationAnomalyDetector()
        uad.fit(self.baseline_mps_df)

        low_util_mp = pd.DataFrame([{
            "allocated_amount": 100000000.0,
            "total_expenditure": 10000000.0,  # 10% vs cohort ~75%
            "utilization_percentage": 10.0,
            "unspent_amount": 90000000.0,
        }])

        res = uad.predict(low_util_mp)[0]
        self.assertTrue(res["is_anomalous"])
        self.assertGreaterEqual(res["utilization_anomaly_score"], 60.0)
        self.assertTrue(any("significantly lower than cohort median" in obs for obs in res["observations"]))
        self.assertNotIn("fraud", res["observations"][0].lower())

    def test_13_utilization_discrepancy_detection(self):
        """13. Test discrepancy between reported utilization and computed expenditure ratio."""
        uad = UtilizationAnomalyDetector()
        uad.fit(self.baseline_mps_df)

        # Actual: 40 Lakhs / 1 Crore = 40%, Reported: 95%
        disc_mp = pd.DataFrame([{
            "allocated_amount": 100000000.0,
            "total_expenditure": 40000000.0,
            "utilization_percentage": 95.0,
            "unspent_amount": 60000000.0,
        }])

        res = uad.predict(disc_mp)[0]
        self.assertTrue(res["is_anomalous"])
        self.assertIsNotNone(res["discrepancy"])
        self.assertGreater(res["discrepancy"], 50.0)
        self.assertTrue(any("Data inconsistency" in obs for obs in res["observations"]))
        self.assertEqual(res["actual_utilization"], 40.0)
        self.assertEqual(res["reported_utilization"], 95.0)

    def test_14_utilization_zero_and_missing_allocation(self):
        """14. Test handling of zero allocation and missing expenditures without division errors."""
        uad = UtilizationAnomalyDetector()
        uad.fit(self.baseline_mps_df)

        edge_mp = pd.DataFrame([
            {"allocated_amount": 0.0, "total_expenditure": 50000.0},
            {"allocated_amount": None, "total_expenditure": None},
        ])

        res = uad.predict(edge_mp)
        self.assertIsNone(res[0]["actual_utilization"])
        self.assertIsNone(res[1]["utilization_anomaly_score"])

    # =========================================================================
    # PART 5: UNIFIED ANOMALY DETECTOR INTEGRATION
    # =========================================================================

    def test_15_unified_detector_all_three_scores(self):
        """15. Test unified AnomalyDetector exposes all three independent scores and aliases."""
        mixed_df = pd.DataFrame([{
            "work_id": 101,
            "cost": 5000000.0,  # Extreme cost outlier
            "category": "Infrastructure",
            "district": "District_A",
            "allocated_amount": 100000000.0,
            "total_expenditure": 130000000.0,  # High financial outlier
            "utilization_percentage": 130.0,
            "unspent_amount": 0.0,
        }])

        detector = AnomalyDetector()
        detector.fit(self.baseline_works_df)
        detector.fit(self.baseline_mps_df)

        res = detector.predict(mixed_df)
        row = res.iloc[0]

        # Verify all 3 independent scores exist and are on [0, 100]
        self.assertIsNotNone(row["cost_anomaly_score"])
        self.assertIsNotNone(row["financial_anomaly_score"])
        self.assertIsNotNone(row["utilization_anomaly_score"])

        self.assertGreaterEqual(row["cost_anomaly_score"], 60.0)
        self.assertGreaterEqual(row["financial_anomaly_score"], 60.0)
        self.assertGreaterEqual(row["utilization_anomaly_score"], 60.0)

        # Verify downstream aliases
        self.assertEqual(row["cost_score"], row["cost_anomaly_score"])
        self.assertEqual(row["ml_anomaly_score"], row["financial_anomaly_score"])
        self.assertEqual(row["utilization_score"], row["utilization_anomaly_score"])

        # Verify structured evidence container
        ev = row["evidence"]
        self.assertIn("cost_details", ev)
        self.assertIn("financial_details", ev)
        self.assertIn("utilization_details", ev)
        self.assertIn("observations", ev)

    def test_16_unified_to_records(self):
        """16. Test that to_records() produces valid, serialized dictionaries."""
        detector = AnomalyDetector()
        detector.fit(self.baseline_works_df)
        res = detector.predict(self.baseline_works_df.head(3))

        records = detector.to_records(res)
        self.assertEqual(len(records), 3)

        expected_keys = [
            "work_id", "cost_anomaly_score", "financial_anomaly_score", "utilization_anomaly_score",
            "cost_score", "ml_anomaly_score", "utilization_score", "anomaly_score",
            "is_anomaly", "anomaly_type", "explanation", "evidence",
        ]
        for key in expected_keys:
            self.assertIn(key, records[0])

    def test_17_neutral_explanations(self):
        """17. Test that explanations never generate criminal or fraud accusations."""
        detector = AnomalyDetector()
        detector.fit(self.baseline_works_df)

        test_data = pd.DataFrame([
            {"cost": 99999999.0, "category": "Infrastructure"},
            {"cost": 50000.0, "category": "Infrastructure"},
        ])

        results = detector.predict(test_data)
        forbidden = ["fraud", "corrupt", "criminal", "scam", "illegal", "guilty", "stolen"]

        for _, row in results.iterrows():
            expl = row["explanation"].lower()
            for word in forbidden:
                self.assertNotIn(word, expl, f"Found forbidden accusatory word '{word}' in explanation: {expl}")

    def test_18_cost_low_outlier_and_missing_category(self):
        """18. Test lower-bound cost outlier and missing category fallback to global."""
        cad = CostAnomalyDetector()
        cad.fit(self.baseline_works_df)

        # Baseline Q1 is 60k, IQR is 20k -> Lower bound ~30k
        # Cost 10k is below lower bound
        low_cost_df = pd.DataFrame([{"cost": 10000.0, "category": None}])
        res = cad.predict(low_cost_df)[0]
        self.assertIsNotNone(res["cost_anomaly_score"])
        self.assertGreaterEqual(res["cost_anomaly_score"], 40.0)
        self.assertEqual(res["details"]["peer_group_used"], "global")
        self.assertTrue(any("falls unusually below" in obs for obs in res["observations"]))

    def test_19_cost_tiny_dataset(self):
        """19. Test cost detection on tiny dataset (N < 4) handles insufficient data safely."""
        cad = CostAnomalyDetector()
        tiny_df = pd.DataFrame([
            {"cost": 50000.0, "category": "Infra"},
            {"cost": 60000.0, "category": "Infra"},
        ])
        cad.fit(tiny_df)
        res = cad.predict(tiny_df)
        self.assertEqual(len(res), 2)
        self.assertIsNone(res[0]["cost_anomaly_score"])
        self.assertEqual(res[0]["method"], "insufficient_peers")

    def test_20_financial_two_rows_and_constants(self):
        """20. Test MP financial detector on 2 rows and uniform/constant features without crashing."""
        fad = MPFinancialAnomalyDetector()
        two_rows = pd.DataFrame([
            {"allocated_amount": 100000000.0, "total_expenditure": 80000000.0, "payment_gap_percentage": 10.0},
            {"allocated_amount": 100000000.0, "total_expenditure": 80000000.0, "payment_gap_percentage": 10.0},
        ])
        fad.fit(two_rows)
        res = fad.predict(two_rows)
        self.assertEqual(len(res), 2)
        self.assertFalse(res[0]["is_anomalous"])
        self.assertIsNotNone(res[0]["financial_anomaly_score"])

    def test_21_utilization_over_hundred(self):
        """21. Test that utilization over 100% is flagged contextually as administrative anomaly."""
        uad = UtilizationAnomalyDetector()
        uad.fit(self.baseline_mps_df)

        over_util_df = pd.DataFrame([{
            "allocated_amount": 100000000.0,
            "total_expenditure": 125000000.0,
            "utilization_percentage": 125.0,
        }])
        res = uad.predict(over_util_df)[0]
        self.assertTrue(res["is_anomalous"])
        self.assertGreaterEqual(res["utilization_anomaly_score"], 60.0)
        self.assertTrue(any("exceeds 100% of allocation" in obs for obs in res["observations"]))
        self.assertNotIn("fraud", res["observations"][0].lower())

    def test_22_risk_engine_interface(self):
        """22. Verify that Jayant's Risk Engine can consume cost_score, ml_anomaly_score, utilization_score."""
        mixed_data = pd.DataFrame([{
            "work_id": 501,
            "cost": 150000.0,
            "allocated_amount": 100000000.0,
            "total_expenditure": 85000000.0,
            "utilization_percentage": 85.0,
        }])
        detector = AnomalyDetector()
        detector.fit(self.baseline_works_df)
        detector.fit(self.baseline_mps_df)
        res = detector.predict(mixed_data)

        # Risk Engine expects exact 0-100 float values or None
        c_score = res.iloc[0]["cost_score"]
        ml_score = res.iloc[0]["ml_anomaly_score"]
        u_score = res.iloc[0]["utilization_score"]

        for s in [c_score, ml_score, u_score]:
            self.assertIsInstance(s, float)
            self.assertGreaterEqual(s, 0.0)
            self.assertLessEqual(s, 100.0)

    def test_23_investigation_agent_evidence_contract(self):
        """23. Verify that Akanksha's Investigation Agent receives structured, machine-readable evidence."""
        detector = AnomalyDetector()
        detector.fit(self.baseline_works_df)
        detector.fit(self.baseline_mps_df)

        test_data = pd.DataFrame([{
            "work_id": 901,
            "cost": 7500000.0,
            "category": "Infrastructure",
            "allocated_amount": 100000000.0,
            "total_expenditure": 150000000.0,
            "utilization_percentage": 150.0,
        }])
        res = detector.predict(test_data)
        ev = res.iloc[0]["evidence"]

        # Structured evidence verification
        self.assertIn("observations", ev)
        self.assertIsInstance(ev["observations"], list)
        self.assertGreater(len(ev["observations"]), 0)

        self.assertIn("cost_details", ev)
        self.assertIsInstance(ev["cost_details"], dict)
        self.assertEqual(ev["cost_details"]["cost"], 7500000.0)
        self.assertIn("peer_count", ev["cost_details"])

        self.assertIn("financial_details", ev)
        self.assertIsInstance(ev["financial_details"], dict)
        self.assertIn("derived_ratios", ev["financial_details"])

    # =========================================================================
    # PART 5: FIELD NORMALIZATION & CAMELCASE COMPATIBILITY
    # =========================================================================

    def test_24_camelcase_and_snakecase_mp_inputs(self):
        """24. Test that camelCase and snake_case MP inputs produce consistent normalized predictions."""
        camel_df = pd.DataFrame([{
            "mpName": "Test MP",
            "allocatedAmount": 100000000.0,
            "totalExpenditure": 75000000.0,
            "utilizationPercentage": 75.0,
            "completedWorksCount": 80,
            "recommendedWorksCount": 100,
            "completionRate": 80.0,
            "pendingWorks": 20,
            "unspentAmount": 25000000.0,
            "completedWorksValue": 70000000.0,
            "inProgressPayments": 5000000.0,
            "paymentGapPercentage": 10.0,
        }])

        snake_df = pd.DataFrame([{
            "mp_name": "Test MP",
            "allocated_amount": 100000000.0,
            "total_expenditure": 75000000.0,
            "utilization_percentage": 75.0,
            "completed_works_count": 80,
            "recommended_works_count": 100,
            "completion_rate": 80.0,
            "pending_works": 20,
            "unspent_amount": 25000000.0,
            "completed_works_value": 70000000.0,
            "in_progress_payments": 5000000.0,
            "payment_gap_percentage": 10.0,
        }])

        det_camel = AnomalyDetector()
        res_camel = det_camel.predict(camel_df)

        det_snake = AnomalyDetector()
        res_snake = det_snake.predict(snake_df)

        self.assertEqual(
            res_camel.iloc[0]["financial_anomaly_score"],
            res_snake.iloc[0]["financial_anomaly_score"]
        )
        self.assertEqual(
            res_camel.iloc[0]["utilization_anomaly_score"],
            res_snake.iloc[0]["utilization_anomaly_score"]
        )
        self.assertEqual(
            res_camel.iloc[0]["anomaly_score"],
            res_snake.iloc[0]["anomaly_score"]
        )

    def test_25_camelcase_financial_score_produced(self):
        """25. Verify financial anomaly score is produced when valid camelCase fields are supplied."""
        fad = MPFinancialAnomalyDetector()
        camel_data = pd.DataFrame([{
            "allocatedAmount": 100000000.0,
            "totalExpenditure": 120000000.0,  # exceeds allocation by 20%
            "paymentGapPercentage": 55.0,     # elevated payment gap
            "unspentAmount": 5000000.0,
        }])
        res = fad.predict(camel_data)[0]
        self.assertIsNotNone(res["financial_anomaly_score"])
        self.assertGreaterEqual(res["financial_anomaly_score"], 60.0)
        self.assertTrue(res["is_anomalous"])
        self.assertEqual(res["status"], "anomalous")
        self.assertIn("expenditure_to_allocation", res["details"]["derived_ratios"])
        self.assertEqual(res["details"]["derived_ratios"]["expenditure_to_allocation"], 1.2)

    def test_26_utilization_from_allocated_amount_and_total_expenditure(self):
        """26. Verify utilization score is produced when allocatedAmount and totalExpenditure are supplied."""
        uad = UtilizationAnomalyDetector()
        data = pd.DataFrame([{
            "allocatedAmount": 100000000.0,
            "totalExpenditure": 80000000.0,
        }])
        res = uad.predict(data)[0]
        self.assertIsNotNone(res["utilization_anomaly_score"])
        self.assertEqual(res["calculated_utilization"], 80.0)
        self.assertEqual(res["actual_utilization"], 80.0)
        self.assertIsNone(res["reported_utilization"])
        self.assertIsNone(res["discrepancy"])

    def test_27_reported_utilization_discrepancy_detected(self):
        """27. Verify reported utilization discrepancy is detected with camelCase inputs."""
        uad = UtilizationAnomalyDetector()
        data = pd.DataFrame([{
            "allocatedAmount": 100000000.0,
            "totalExpenditure": 50000000.0,    # calculated is 50.0%
            "utilizationPercentage": 95.0,      # reported is 95.0%, discrepancy = 45%
        }])
        res = uad.predict(data)[0]
        self.assertIsNotNone(res["utilization_anomaly_score"])
        self.assertEqual(res["calculated_utilization"], 50.0)
        self.assertEqual(res["reported_utilization"], 95.0)
        self.assertEqual(res["discrepancy"], 45.0)
        self.assertTrue(res["is_anomalous"])
        self.assertTrue(any("diverges materially" in obs for obs in res["observations"]))

    def test_28_missing_fields_return_none_and_insufficient_data(self):
        """28. Verify missing fields return score=None and status=insufficient_data."""
        # 1. MPFinancialAnomalyDetector with missing fields
        fad = MPFinancialAnomalyDetector()
        empty_mp = pd.DataFrame([{"mpName": "Unknown MP"}])
        res_fin = fad.predict(empty_mp)[0]
        self.assertIsNone(res_fin["financial_anomaly_score"])
        self.assertEqual(res_fin["status"], "insufficient_data")

        # 2. UtilizationAnomalyDetector with missing fields
        uad = UtilizationAnomalyDetector()
        res_util = uad.predict(empty_mp)[0]
        self.assertIsNone(res_util["utilization_anomaly_score"])
        self.assertEqual(res_util["status"], "insufficient_data")

        # 3. AnomalyDetector with None/empty financial values
        detector = AnomalyDetector()
        none_df = pd.DataFrame([{"allocatedAmount": None, "totalExpenditure": None}])
        res_det = detector.predict(none_df)
        self.assertIsNone(res_det.iloc[0]["financial_anomaly_score"])
        self.assertIsNone(res_det.iloc[0]["utilization_anomaly_score"])

    def test_29_zero_allocation_does_not_crash(self):
        """29. Verify zero allocation does not crash or raise ZeroDivisionError."""
        zero_df = pd.DataFrame([{
            "mpName": "Zero MP",
            "allocatedAmount": 0,
            "totalExpenditure": 5000000,
            "utilizationPercentage": 40.0,
        }])
        detector = AnomalyDetector()
        res = detector.predict(zero_df)
        self.assertEqual(len(res), 1)
        self.assertIsNotNone(res.iloc[0]["utilization_anomaly_score"])
        self.assertGreaterEqual(res.iloc[0]["utilization_anomaly_score"], 0.0)
        self.assertLessEqual(res.iloc[0]["utilization_anomaly_score"], 100.0)

    def test_30_aliases_equal_independent_scores(self):
        """30. Verify Risk Engine aliases equal their corresponding independent scores for camelCase inputs."""
        camel_df = pd.DataFrame([{
            "mpName": "Test MP",
            "allocatedAmount": 100000000.0,
            "totalExpenditure": 75000000.0,
            "utilizationPercentage": 75.0,
            "completedWorksCount": 50,
            "recommendedWorksCount": 100,
            "unspentAmount": 25000000.0,
            "paymentGapPercentage": 10.0,
        }])
        detector = AnomalyDetector()
        res = detector.predict(camel_df)

        # Financial alias: ml_anomaly_score == financial_anomaly_score
        self.assertEqual(
            res.iloc[0]["financial_anomaly_score"],
            res.iloc[0]["ml_anomaly_score"]
        )
        # Utilization alias: utilization_score == utilization_anomaly_score
        self.assertEqual(
            res.iloc[0]["utilization_anomaly_score"],
            res.iloc[0]["utilization_score"]
        )
        # Cost alias (None for MP-only record): cost_score == cost_anomaly_score
        self.assertEqual(
            res.iloc[0]["cost_anomaly_score"],
            res.iloc[0]["cost_score"]
        )

    def test_31_normalization_preserves_none_and_no_fabrication(self):
        """31. Verify normalize_mp_financial_dataframe preserves None/NaN and does not fabricate zeros."""
        df_with_nones = pd.DataFrame([{
            "allocatedAmount": None,
            "totalExpenditure": np.nan,
            "utilizationPercentage": "",
            "unspentAmount": 50000.0,
        }])
        norm = normalize_mp_financial_dataframe(df_with_nones)

        self.assertIsNone(norm.iloc[0]["allocated_amount"])
        self.assertTrue(pd.isna(norm.iloc[0]["total_expenditure"]))
        self.assertEqual(norm.iloc[0]["unspent_amount"], 50000.0)
        # None must not be converted to 0.0
        self.assertNotEqual(norm.iloc[0]["allocated_amount"], 0.0)


if __name__ == "__main__":
    unittest.main()
