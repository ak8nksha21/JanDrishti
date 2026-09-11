"""
JanDrishti - Unit Test Suite for ML Anomaly Detection

Tests compliance against statistical integrity, explainability, null safety,
and deterministic modeling standards.
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
    from ml.anomaly_detection import AnomalyDetector
    ML_IMPORT_ERROR = None
except ModuleNotFoundError as err:
    AnomalyDetector = None
    ML_IMPORT_ERROR = str(err)


@unittest.skipIf(
    AnomalyDetector is None,
    f"Canonical 'ml' package is located at workspace root and not mounted into backend container ({ML_IMPORT_ERROR}). "
    "Run ML anomaly tests from workspace root: python3 -m unittest discover -s backend/tests -p 'test_anomaly_detection.py'"
)
class TestAnomalyDetection(unittest.TestCase):
    """Unit tests for JanDrishti AnomalyDetector module."""

    def setUp(self):
        """Set up standard synthetic test distributions."""
        # Synthetic baseline: 20 typical projects with costs between 50k and 150k
        np.random.seed(42)
        baseline_costs = [
            50000, 55000, 60000, 62000, 65000, 70000, 72000, 75000, 78000, 80000,
            82000, 85000, 88000, 90000, 95000, 100000, 110000, 120000, 130000, 140000
        ]
        self.baseline_df = pd.DataFrame({
            "work_id": [1000 + i for i in range(len(baseline_costs))],
            "cost": baseline_costs,
            "category": ["Infrastructure"] * 10 + ["Drinking Water"] * 10,
            "completion_year": [2024] * 20,
            "completion_date": ["2024-06-15T00:00:00"] * 20,
        })

    def test_01_normal_values(self):
        """1. Test that typical costs within IQR distribution are not flagged as anomalies."""
        detector = AnomalyDetector()
        detector.fit(self.baseline_df)

        normal_df = pd.DataFrame({
            "work_id": [9991, 9992],
            "cost": [75000.0, 85000.0],
            "category": ["Infrastructure", "Drinking Water"],
            "completion_year": [2024, 2024],
        })

        results = detector.predict(normal_df)

        for _, row in results.iterrows():
            self.assertFalse(row["is_anomaly"], f"Normal cost {row['cost']} was unexpectedly flagged.")
            self.assertEqual(row["anomaly_type"], "none")
            self.assertLess(row["anomaly_score"], 0.50)
            self.assertIn("within normal statistical distribution", row["explanation"])

    def test_02_obvious_cost_outlier(self):
        """2. Test that an obvious cost outlier is flagged with high anomaly score and explanation."""
        detector = AnomalyDetector()
        detector.fit(self.baseline_df)

        outlier_df = pd.DataFrame({
            "work_id": [9993],
            "cost": [5000000.0],  # 50 Lakhs vs baseline 50k-140k
            "category": ["Infrastructure"],
            "completion_year": [2024],
        })

        results = detector.predict(outlier_df)
        row = results.iloc[0]

        self.assertTrue(row["is_anomaly"])
        self.assertIn("cost_anomaly", row["anomaly_type"])
        self.assertGreaterEqual(row["anomaly_score"], 0.50)
        self.assertIn("outlier", row["explanation"])
        self.assertIn("IQR threshold", row["explanation"])
        # Ensure it does NOT use the term 'cost overrun'
        self.assertNotIn("cost overrun", row["explanation"].lower())

    def test_03_missing_null_cost_safety(self):
        """3. Test that missing/null costs are handled gracefully and NEVER converted to zero."""
        detector = AnomalyDetector()
        detector.fit(self.baseline_df)

        missing_cost_df = pd.DataFrame({
            "work_id": [9994, 9995],
            "cost": [None, np.nan],
            "category": ["Infrastructure", "Drinking Water"],
            "completion_year": [2024, 2024],
        })

        results = detector.predict(missing_cost_df)

        # Check first row (None)
        row1 = results.iloc[0]
        self.assertTrue(pd.isna(row1["cost"]) or row1["cost"] is None)
        self.assertNotEqual(row1["cost"], 0.0, "Missing cost was incorrectly converted to 0.0")
        self.assertFalse(row1["is_anomaly"])
        self.assertIn("Cost data is missing", row1["explanation"])

        # Check second row (NaN)
        row2 = results.iloc[1]
        self.assertTrue(pd.isna(row2["cost"]))
        self.assertNotEqual(row2["cost"], 0.0, "NaN cost was incorrectly converted to 0.0")
        self.assertFalse(row2["is_anomaly"])

    def test_04_empty_dataframe(self):
        """4. Test that passing an empty DataFrame does not crash and returns expected columns."""
        detector = AnomalyDetector()
        empty_df = pd.DataFrame()

        # Fit on empty
        detector.fit(empty_df)
        self.assertTrue(detector.is_fitted_)

        # Predict on empty
        results = detector.predict(empty_df)
        self.assertTrue(results.empty)
        self.assertIn("anomaly_score", results.columns)
        self.assertIn("is_anomaly", results.columns)
        self.assertIn("anomaly_type", results.columns)
        self.assertIn("explanation", results.columns)

    def test_05_very_small_dataset(self):
        """5. Test that small datasets (like the 4 Shahjahanpur works) are handled without crashing."""
        small_df = pd.DataFrame({
            "work_id": [101, 102, 103, 104],
            "cost": [40095000.0, 9240000.0, 37908000.0, 9900000.0],
            "completion_year": [2025, 2025, 2024, 2024],
            "completion_date": ["2025-07-26", "2025-07-26", "2024-11-25", "2024-11-25"]
        })

        detector = AnomalyDetector()
        detector.fit(small_df)
        self.assertTrue(detector.is_fitted_)

        # Isolation Forest should be skipped gracefully due to small sample size
        self.assertIsNone(detector.iforest_model_)
        self.assertIsNotNone(detector.iforest_skip_reason_)
        self.assertIn("below minimum required", detector.iforest_skip_reason_)

        # Predict should succeed
        results = detector.predict(small_df)
        self.assertEqual(len(results), 4)
        self.assertIn("below minimum required", results.iloc[0]["explanation"])

    def test_06_constant_value_dataset(self):
        """6. Test that constant-value datasets (IQR == 0) do not cause division-by-zero errors."""
        constant_df = pd.DataFrame({
            "work_id": [201, 202, 203, 204, 205],
            "cost": [500000.0, 500000.0, 500000.0, 500000.0, 500000.0],
            "completion_year": [2024] * 5
        })

        detector = AnomalyDetector()
        detector.fit(constant_df)

        stats = detector.baseline_stats_["global_cost"]
        self.assertEqual(stats["iqr"], 0.0)

        # Test observation matching uniform baseline
        match_test = pd.DataFrame({"work_id": [206], "cost": [500000.0], "completion_year": [2024]})
        res_match = detector.predict(match_test)
        self.assertFalse(res_match.iloc[0]["is_anomaly"])
        self.assertEqual(res_match.iloc[0]["anomaly_score"], 0.0)

        # Test observation deviating from uniform baseline
        deviate_test = pd.DataFrame({"work_id": [207], "cost": [5000000.0], "completion_year": [2024]})
        res_deviate = detector.predict(deviate_test)
        self.assertTrue(res_deviate.iloc[0]["is_anomaly"])
        self.assertIn("deviates significantly from uniform baseline", res_deviate.iloc[0]["explanation"])

    def test_07_isolation_forest_deterministic(self):
        """7. Test that Isolation Forest produces deterministic scores when random_state is set."""
        # Baseline with 20 records satisfies min_samples_for_iforest (15)
        detector_1 = AnomalyDetector(config={"iforest_random_state": 42})
        detector_1.fit(self.baseline_df)
        self.assertIsNotNone(detector_1.iforest_model_)

        detector_2 = AnomalyDetector(config={"iforest_random_state": 42})
        detector_2.fit(self.baseline_df)

        test_data = pd.DataFrame({
            "work_id": [301, 302, 303],
            "cost": [65000.0, 95000.0, 350000.0],
            "completion_year": [2024, 2024, 2024],
        })

        res_1 = detector_1.predict(test_data)
        res_2 = detector_2.predict(test_data)

        # Scores must be completely identical across runs
        np.testing.assert_allclose(
            res_1["anomaly_score"].values,
            res_2["anomaly_score"].values,
            err_msg="Isolation Forest scores were not deterministic with identical random_state"
        )

    def test_08_expected_output_fields(self):
        """8. Test that output DataFrame strictly adheres to the expected schema contract."""
        detector = AnomalyDetector()
        results = detector.predict(self.baseline_df.head(5))

        required_cols = ["anomaly_score", "is_anomaly", "anomaly_type", "explanation"]
        for col in required_cols:
            self.assertIn(col, results.columns)

        # Ensure types match contract
        for _, row in results.iterrows():
            self.assertIsInstance(row["anomaly_score"], float)
            self.assertGreaterEqual(row["anomaly_score"], 0.0)
            self.assertLessEqual(row["anomaly_score"], 1.0)
            self.assertIsInstance(bool(row["is_anomaly"]), bool)
            self.assertIsInstance(row["anomaly_type"], str)
            self.assertIsInstance(row["explanation"], str)

        # Ensure to_records helper works
        records = detector.to_records(results)
        self.assertEqual(len(records), 5)
        self.assertIn("work_id", records[0])
        self.assertIn("anomaly_score", records[0])
        self.assertIn("is_anomaly", records[0])
        self.assertIn("anomaly_type", records[0])
        self.assertIn("explanation", records[0])

    def test_09_explanation_neutrality_and_evidence(self):
        """9. Test that explanations provide statistical evidence and NEVER make fraud accusations."""
        detector = AnomalyDetector()
        detector.fit(self.baseline_df)

        test_data = pd.DataFrame({
            "work_id": [401, 402],
            "cost": [70000.0, 8000000.0],  # normal vs extreme outlier
            "completion_year": [2024, 2024],
        })

        results = detector.predict(test_data)

        forbidden_words = ["fraud", "criminal", "corrupt", "guilty", "illegal", "scam"]
        for _, row in results.iterrows():
            expl = row["explanation"].lower()
            self.assertTrue(len(expl) > 0, "Explanation was unexpectedly empty.")
            for word in forbidden_words:
                self.assertNotIn(word, expl, f"Explanation contained forbidden accusatory word '{word}': {expl}")

    def test_10_no_fabricated_values_for_missing_fields(self):
        """10. Test that missing original fields remain uncorrupted and un-fabricated."""
        raw_df = pd.DataFrame({
            "work_id": [501],
            "cost": [None],
            "category": [None],
            "beneficiaries": [None],
            "latitude": [None],
            "completion_year": [None],
        })

        detector = AnomalyDetector()
        results = detector.predict(raw_df)
        row = results.iloc[0]

        # Verify none of the missing fields were populated with fake numbers/defaults
        self.assertTrue(pd.isna(row["cost"]))
        self.assertTrue(pd.isna(row["category"]))
        self.assertTrue(pd.isna(row["beneficiaries"]))
        self.assertTrue(pd.isna(row["latitude"]))
        self.assertTrue(pd.isna(row["completion_year"]))


if __name__ == "__main__":
    unittest.main()
