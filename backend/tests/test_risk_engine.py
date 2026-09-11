"""
JanDrishti - Canonical Risk Engine Unit Test Suite

Verifies:
1. All six signals available.
2. Correct six-signal weighted calculation.
3. 0–100 output scale.
4. Missing signal handling with weight renormalization.
5. Missing vs. actual zero distinction.
6. Multiple missing signals handling.
7. All signals missing -> 'Insufficient Data'.
8. Invalid values rejected (-10, 101, 120, 'abc').
9. Boolean values handled safely (True -> 100, False -> 0).
10. Exact risk boundaries (30 Low, 31 Med, 60 Med, 61 High, 80 High, 81 Critical, 100 Critical).
11. Deterministic repeated calculation over 50 iterations.
12. Signal breakdown correctness.
13. Weighted contribution correctness.
14. Top risk factors ranking.
15. Safe / non-accusatory observations (anti-fraud check).
16. Alert generation on >= 70 score or High/Critical level.
17. Investigation Agent compatibility hook.
"""

import unittest
from ml.risk_engine import (
    RiskEngine,
    DEFAULT_SIGNAL_WEIGHTS,
    BAND_LOW_MAX,
    BAND_MEDIUM_MAX,
    BAND_HIGH_MAX,
    ALERT_SCORE_THRESHOLD,
)
from app.services.risk.alerts import AlertManager, alert_manager
from app.services.risk.scoring import RiskScorer


class TestRiskEngineCanonical(unittest.TestCase):
    """Unit tests for the canonical 0-100 RiskEngine implementation."""

    def setUp(self):
        self.engine = RiskEngine()

    def test_01_all_six_signals_available(self):
        """Verify all six signals are accepted, weighted, and output is on 0-100 scale."""
        signals = {
            "ml_anomaly_score": 80.0,
            "cost_anomaly_score": 90.0,
            "duplicate_score": 30.0,
            "utilization_score": 70.0,
            "geographic_score": 60.0,
            "data_quality_score": 40.0,
        }
        res = self.engine.compute_risk(signals)
        self.assertIsNotNone(res["overall_score"])
        self.assertGreaterEqual(res["overall_score"], 0.0)
        self.assertLessEqual(res["overall_score"], 100.0)
        self.assertEqual(res["confidence"], 1.0)
        self.assertEqual(len(res["signal_breakdown"]), 6)
        self.assertIn("ml_anomaly_score", res["signal_breakdown"])
        self.assertIn("cost_anomaly_score", res["signal_breakdown"])
        self.assertIn("duplicate_score", res["signal_breakdown"])
        self.assertIn("utilization_score", res["signal_breakdown"])
        self.assertIn("geographic_score", res["signal_breakdown"])
        self.assertIn("data_quality_score", res["signal_breakdown"])

    def test_02_all_signals_zero(self):
        """All signals = 0 must result in overall_score = 0.0 and risk_level = 'Low'."""
        signals = {
            "ml_anomaly_score": 0,
            "cost_anomaly_score": 0,
            "duplicate_score": 0,
            "utilization_score": 0,
            "geographic_score": 0,
            "data_quality_score": 0,
        }
        res = self.engine.compute_risk(signals)
        self.assertEqual(res["overall_score"], 0.0)
        self.assertEqual(res["risk_level"], "Low")
        self.assertFalse(res["alert_required"])

    def test_03_all_signals_hundred(self):
        """All signals = 100 must result in overall_score = 100.0 and risk_level = 'Critical'."""
        signals = {
            "ml_anomaly_score": 100,
            "cost_anomaly_score": 100,
            "duplicate_score": 100,
            "utilization_score": 100,
            "geographic_score": 100,
            "data_quality_score": 100,
        }
        res = self.engine.compute_risk(signals)
        self.assertEqual(res["overall_score"], 100.0)
        self.assertEqual(res["risk_level"], "Critical")
        self.assertTrue(res["alert_required"])

    def test_04_correct_weighted_calculation(self):
        """
        Verify exact arithmetic:
        80*0.25 (20) + 90*0.25 (22.5) + 30*0.20 (6) + 70*0.15 (10.5) + 60*0.10 (6) + 40*0.05 (2) = 67.0
        """
        signals = {
            "ml_anomaly_score": 80,
            "cost_anomaly_score": 90,
            "duplicate_score": 30,
            "utilization_score": 70,
            "geographic_score": 60,
            "data_quality_score": 40,
        }
        res = self.engine.compute_risk(signals)
        self.assertEqual(res["overall_score"], 67.0)
        self.assertEqual(res["risk_level"], "High")

    def test_05_missing_geographic_signal_renormalization(self):
        """
        Missing geographic signal must not be treated as 0.
        Its 10% weight must be removed from denominator and remaining weights renormalized.
        """
        signals_without_geo = {
            "ml_anomaly_score": 80,
            "cost_anomaly_score": 90,
            "duplicate_score": 40,
            "utilization_score": 70,
            "geographic_score": None,
            "data_quality_score": 30,
        }
        res = self.engine.compute_risk(signals_without_geo)

        # Available weights: 0.25 + 0.25 + 0.20 + 0.15 + 0.05 = 0.90
        # Weighted sum: 80*0.25 (20) + 90*0.25 (22.5) + 40*0.20 (8) + 70*0.15 (10.5) + 30*0.05 (1.5) = 62.5
        # Renormalized: 62.5 / 0.90 = 69.444... -> 69.4
        self.assertAlmostEqual(res["overall_score"], 69.4, places=1)
        self.assertNotIn("geographic_score", res["signal_breakdown"])
        self.assertIn("geographic_score", res["missing_signals"])

        # Compare with case where geographic_score is actually 0.0
        signals_with_zero_geo = dict(signals_without_geo)
        signals_with_zero_geo["geographic_score"] = 0.0
        res_zero = self.engine.compute_risk(signals_with_zero_geo)
        # With zero geo: (62.5 + 0) / 1.00 = 62.5
        self.assertEqual(res_zero["overall_score"], 62.5)
        # Case without geo (missing) must have higher score than case with genuine 0.0
        self.assertGreater(res["overall_score"], res_zero["overall_score"])

    def test_06_multiple_missing_signals(self):
        """Calculation works accurately when multiple signals are missing."""
        signals = {
            "ml_anomaly_score": 80,
            "cost_anomaly_score": 90,
            "duplicate_score": None,
            "utilization_score": None,
            "geographic_score": None,
            "data_quality_score": None,
        }
        res = self.engine.compute_risk(signals)
        # Only ML and Cost: 80*0.25 + 90*0.25 = 42.5; sum of weights = 0.50 -> 42.5 / 0.50 = 85.0
        self.assertEqual(res["overall_score"], 85.0)
        self.assertEqual(res["risk_level"], "Critical")
        self.assertEqual(len(res["missing_signals"]), 4)

    def test_07_all_signals_missing_returns_insufficient_data(self):
        """If all signals are missing/None, return overall_score=None and risk_level='Insufficient Data'."""
        res_empty = self.engine.compute_risk({})
        self.assertIsNone(res_empty["overall_score"])
        self.assertEqual(res_empty["risk_level"], "Insufficient Data")
        self.assertEqual(res_empty["signal_breakdown"], {})
        self.assertEqual(res_empty["top_risk_factors"], [])
        self.assertIn("Insufficient risk signals available for assessment.", res_empty["observations"][0])

        res_all_none = self.engine.compute_risk({
            "ml_anomaly_score": None,
            "cost_anomaly_score": None,
            "duplicate_score": None,
            "utilization_score": None,
            "geographic_score": None,
            "data_quality_score": None,
        })
        self.assertIsNone(res_all_none["overall_score"])
        self.assertEqual(res_all_none["risk_level"], "Insufficient Data")

    def test_08_invalid_values_rejected(self):
        """Values outside [0, 100] or invalid strings raise ValueError."""
        with self.assertRaises(ValueError):
            self.engine.compute_risk({"cost_anomaly_score": -10})

        with self.assertRaises(ValueError):
            self.engine.compute_risk({"cost_anomaly_score": 101})

        with self.assertRaises(ValueError):
            self.engine.compute_risk({"cost_anomaly_score": 120})

        with self.assertRaises(ValueError):
            self.engine.compute_risk({"cost_anomaly_score": "abc"})

    def test_09_boolean_signal_handling(self):
        """Boolean values (e.g. data_quality binary flags) are converted safely."""
        res_true = self.engine.compute_risk({"data_quality_score": True})
        self.assertEqual(res_true["signal_breakdown"]["data_quality_score"]["score"], 100.0)

        res_false = self.engine.compute_risk({"data_quality_score": False})
        self.assertEqual(res_false["signal_breakdown"]["data_quality_score"]["score"], 0.0)

    def test_10_risk_boundary_behavior(self):
        """
        Verify exact band boundaries:
        30 -> Low
        31 -> Medium
        60 -> Medium
        61 -> High
        80 -> High
        81 -> Critical
        100 -> Critical
        """
        self.assertEqual(RiskEngine.get_risk_level(0.0), "Low")
        self.assertEqual(RiskEngine.get_risk_level(30.0), "Low")
        self.assertEqual(RiskEngine.get_risk_level(31.0), "Medium")
        self.assertEqual(RiskEngine.get_risk_level(60.0), "Medium")
        self.assertEqual(RiskEngine.get_risk_level(61.0), "High")
        self.assertEqual(RiskEngine.get_risk_level(80.0), "High")
        self.assertEqual(RiskEngine.get_risk_level(81.0), "Critical")
        self.assertEqual(RiskEngine.get_risk_level(100.0), "Critical")
        self.assertEqual(RiskEngine.get_risk_level(None), "Insufficient Data")

    def test_11_engine_determinism(self):
        """Engine produces byte-for-byte identical output over 50 repeat evaluations."""
        signals = {
            "ml_anomaly_score": 75,
            "cost_anomaly_score": 85,
            "duplicate_score": 45,
            "utilization_score": 60,
        }
        baseline = self.engine.compute_risk(signals)
        for _ in range(50):
            repeated = self.engine.compute_risk(signals)
            self.assertEqual(baseline["overall_score"], repeated["overall_score"])
            self.assertEqual(baseline["risk_level"], repeated["risk_level"])
            self.assertEqual(baseline["signal_breakdown"], repeated["signal_breakdown"])
            self.assertEqual(baseline["observations"], repeated["observations"])
            self.assertEqual(baseline["top_risk_factors"], repeated["top_risk_factors"])

    def test_12_signal_breakdown_structure(self):
        """Breakdown exposes score, configured_weight, effective_weight, and weighted_contribution."""
        signals = {
            "cost_anomaly_score": 90,
            "ml_anomaly_score": 80,
        }
        res = self.engine.compute_risk(signals)
        cost_breakdown = res["signal_breakdown"]["cost_anomaly_score"]
        self.assertEqual(cost_breakdown["score"], 90.0)
        self.assertEqual(cost_breakdown["configured_weight"], 0.25)
        self.assertEqual(cost_breakdown["effective_weight"], 0.5)  # 0.25 / 0.50
        self.assertEqual(cost_breakdown["weighted_contribution"], 45.0)

    def test_13_top_risk_factors_ranking(self):
        """Top risk factors correctly order signals by weighted contribution descending."""
        signals = {
            "cost_anomaly_score": 90,   # contrib = 22.5
            "ml_anomaly_score": 80,     # contrib = 20.0
            "duplicate_score": 30,      # contrib = 6.0
            "utilization_score": 70,    # contrib = 10.5
            "geographic_score": 60,     # contrib = 6.0
            "data_quality_score": 40,   # contrib = 2.0
        }
        res = self.engine.compute_risk(signals)
        top_factors = res["top_risk_factors"]
        self.assertEqual(top_factors[0], "cost_anomaly_score")
        self.assertEqual(top_factors[1], "ml_anomaly_score")
        self.assertEqual(top_factors[2], "utilization_score")

    def test_14_safe_non_accusatory_language(self):
        """System strictly avoids claiming 'fraud', 'corruption', 'guilt', or 'crime'."""
        signals = {
            "cost_anomaly_score": 100,
            "ml_anomaly_score": 100,
            "duplicate_score": 100,
            "utilization_score": 100,
            "geographic_score": 100,
            "data_quality_score": 100,
        }
        res = self.engine.compute_risk(signals)
        all_text = " ".join(res["observations"]).lower()
        forbidden_words = ["fraud", "corruption", "crime", "criminal", "guilty", "scam", "corrupt", "embezzle"]
        for forbidden in forbidden_words:
            self.assertNotIn(
                forbidden,
                all_text,
                f"Forbidden accusatory word '{forbidden}' found in observations!"
            )

    def test_15_alert_generation_condition(self):
        """Alert is triggered when score >= 70 or risk level is High/Critical."""
        mgr = AlertManager()
        mgr.clear()

        # High risk triggers alert
        res_high = self.engine.compute_risk({"cost_anomaly_score": 85, "ml_anomaly_score": 80})
        alert = mgr.generate_alert_if_eligible(
            work_id="TEST_HIGH",
            scoring_result=res_high,
            reasons=res_high["observations"],
        )
        self.assertIsNotNone(alert)
        self.assertGreaterEqual(alert.risk_score, 70.0)
        self.assertEqual(mgr.count, 1)

        # Low risk does not trigger alert
        res_low = self.engine.compute_risk({"cost_anomaly_score": 10, "ml_anomaly_score": 10})
        alert_low = mgr.generate_alert_if_eligible(
            work_id="TEST_LOW",
            scoring_result=res_low,
            reasons=res_low["observations"],
        )
        self.assertIsNone(alert_low)
        self.assertEqual(mgr.count, 1)

    def test_16_investigation_agent_compatibility(self):
        """
        Verify the exact Investigation Agent adapter contract:
        from ml.risk_engine import RiskEngine
        engine = RiskEngine()
        result = engine.compute_risk(signals)
        result['overall_score'] is 0-100 float.
        """
        from ml.risk_engine import RiskEngine as AgentExpectedEngine
        agent_engine = AgentExpectedEngine()
        signals = {
            "ml_anomaly_score": 80,
            "cost_anomaly_score": 90,
            "duplicate_score": 30,
            "utilization_score": 70,
            "geographic_score": 60,
            "data_quality_score": 40,
        }
        res = agent_engine.compute_risk(signals)
        self.assertIn("overall_score", res)
        self.assertIsInstance(res["overall_score"], (int, float))
        self.assertTrue(0.0 <= res["overall_score"] <= 100.0)
        self.assertIn("risk_level", res)
        self.assertIn("signal_breakdown", res)
        self.assertIn("observations", res)
        self.assertIn("top_risk_factors", res)


if __name__ == "__main__":
    unittest.main()
