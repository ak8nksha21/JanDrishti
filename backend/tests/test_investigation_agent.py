import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime
import httpx
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.work import Work
from app.models.mp_summary import MPFinancialSummary
from app.services.agent.tools import InvestigationTools
from app.services.agent.agent import InvestigationAgent
from app.schemas.investigation import InvestigationResponse

BASE_URL = "http://127.0.0.1:8000"


class TestInvestigationAgent(unittest.TestCase):
    """
    Comprehensive test suite for the JanDrishti AI Investigation Agent & Tools.
    Validates deterministic execution, 8 tools, adapter hooks, teammate delegation,
    endpoint behavior, language safety, risk band mapping, and schema compliance.
    """

    @classmethod
    def setUpClass(cls):
        """Fetch a sample work record from the database for testing."""
        cls.db: Session = SessionLocal()
        cls.work = cls.db.query(Work).first()
        if not cls.work:
            # Create a temporary testing work if database is empty
            cls.work = Work(
                work_id=999001,
                source_id="test_work_source_001",
                work_description="Construction of CC Road from Main Gate to Community Hall",
                cost=450000.0,
                completion_date=datetime(2023, 5, 15),
                completion_year=2023,
                mp_name="TEST MP",
                constituency="TEST CONSTITUENCY",
                state="Uttar Pradesh",
                category="Roads and Bridges",
                district="Shahjahanpur",
                location="Ward 4",
                implementing_agency="Rural Engineering Services",
                quality_rating=4.2,
                latitude=27.88,
                longitude=79.91,
                source="empowered_indian"
            )
            cls.db.add(cls.work)
            cls.db.commit()
            cls.db.refresh(cls.work)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    # =========================================================================
    # 1. Tool 1: get_work_details
    # =========================================================================
    def test_01_get_work_details(self):
        details = InvestigationTools.get_work_details(self.work, self.db)
        self.assertIsInstance(details, dict)
        self.assertEqual(details["work_id"], self.work.work_id or self.work.id)
        self.assertEqual(details["work_description"], self.work.work_description)
        self.assertEqual(details["cost"], self.work.cost)
        self.assertIn("category", details)
        self.assertIn("source", details)

    # =========================================================================
    # 2. Tool 2: get_similar_works
    # =========================================================================
    def test_02_get_similar_works(self):
        res = InvestigationTools.get_similar_works(self.work, self.db, limit=3)
        self.assertIsInstance(res, dict)
        self.assertIn("similar_works", res)
        self.assertIn("total_candidates_analyzed", res)
        self.assertIn("highest_similarity_score", res)
        self.assertEqual(res.get("engine_mode"), "preliminary_similarity_baseline")
        self.assertLessEqual(len(res["similar_works"]), 3)
        for item in res["similar_works"]:
            self.assertIn("work_id", item)
            self.assertIn("similarity_score", item)

    # =========================================================================
    # 3. Tool 3: get_cost_analysis
    # =========================================================================
    def test_03_get_cost_analysis(self):
        res = InvestigationTools.get_cost_analysis(self.work, self.db)
        self.assertIsInstance(res, dict)
        self.assertIn("cost_score", res)
        self.assertGreaterEqual(res["cost_score"], 0.0)
        self.assertLessEqual(res["cost_score"], 100.0)
        self.assertIn("observations", res)
        self.assertEqual(res.get("engine_mode"), "preliminary_statistical_baseline")
        self.assertIsInstance(res["observations"], list)

    # =========================================================================
    # 4. Tool 4: get_mp_financials
    # =========================================================================
    def test_04_get_mp_financials(self):
        res = InvestigationTools.get_mp_financials(self.work, self.db)
        self.assertIsInstance(res, dict)
        self.assertIn("found", res)
        self.assertIn("utilization_score", res)
        self.assertEqual(res.get("engine_mode"), "database_lookup")
        self.assertGreaterEqual(res["utilization_score"], 0.0)
        self.assertLessEqual(res["utilization_score"], 100.0)

    # =========================================================================
    # 5. Tool 5: check_duplicate
    # =========================================================================
    def test_05_check_duplicate(self):
        res = InvestigationTools.check_duplicate(self.work, self.db)
        self.assertIsInstance(res, dict)
        self.assertIn("duplicate_score", res)
        self.assertIn("duplicate_detected", res)
        self.assertIn("potential_duplicates", res)
        self.assertEqual(res.get("engine_mode"), "preliminary_similarity_baseline")
        self.assertGreaterEqual(res["duplicate_score"], 0.0)
        self.assertLessEqual(res["duplicate_score"], 100.0)

    # =========================================================================
    # 6. Tool 6: check_data_quality
    # =========================================================================
    def test_06_check_data_quality(self):
        res = InvestigationTools.check_data_quality(self.work, self.db)
        self.assertIsInstance(res, dict)
        self.assertIn("data_quality_score", res)
        self.assertIn("completeness_percentage", res)
        self.assertIn("missing_fields", res)
        self.assertIn("audit_guidance", res)
        self.assertEqual(res.get("engine_mode"), "data_quality_auditor")
        self.assertGreaterEqual(res["data_quality_score"], 0.0)
        self.assertLessEqual(res["data_quality_score"], 100.0)
        self.assertNotIn("fraud detected", res["audit_guidance"].lower())

    # =========================================================================
    # 7. Tool 7: get_geographic_context
    # =========================================================================
    def test_07_get_geographic_context(self):
        res = InvestigationTools.get_geographic_context(self.work, self.db)
        self.assertIsInstance(res, dict)
        self.assertIn("coordinates_available", res)
        self.assertIn("geographic_score", res)
        self.assertEqual(res.get("engine_mode"), "geographic_validator")
        self.assertGreaterEqual(res["geographic_score"], 0.0)
        self.assertLessEqual(res["geographic_score"], 100.0)

    # =========================================================================
    # 8. Tool 8: get_risk_breakdown & PRD weights
    # =========================================================================
    def test_08_get_risk_breakdown(self):
        signals = {
            "ml_anomaly_score": 50.0,
            "cost_score": 60.0,
            "duplicate_score": 40.0,
            "utilization_score": 30.0,
            "geographic_score": 20.0,
            "data_quality_score": 10.0
        }
        res = InvestigationTools.get_risk_breakdown(self.work, self.db, signals)
        self.assertIsInstance(res, dict)
        self.assertIn("overall_score", res)
        self.assertIn("risk_level", res)
        self.assertIn("weights", res)
        self.assertEqual(res.get("engine_mode"), "preliminary_prd_weighted_fallback")

        expected_weights = {
            "ml_anomaly_score": 0.25,
            "cost_score": 0.25,
            "duplicate_score": 0.20,
            "utilization_score": 0.15,
            "geographic_score": 0.10,
            "data_quality_score": 0.05
        }
        self.assertEqual(res["weights"], expected_weights)

        # Expected score: 50*0.25 + 60*0.25 + 40*0.20 + 30*0.15 + 20*0.10 + 10*0.05
        # = 12.5 + 15.0 + 8.0 + 4.5 + 2.0 + 0.5 = 42.5 -> MEDIUM
        self.assertEqual(res["overall_score"], 42.5)
        self.assertEqual(res["risk_level"], "MEDIUM")

    # =========================================================================
    # 9. Complete Agent Investigation Orchestration & Synthesis
    # =========================================================================
    def test_09_agent_investigate_orchestration(self):
        agent = InvestigationAgent(db=self.db)
        response = agent.investigate(self.work)

        self.assertIsInstance(response, InvestigationResponse)
        self.assertEqual(response.work_id, self.work.work_id or self.work.id)
        self.assertIn(response.risk_level, ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertGreaterEqual(response.overall_score, 0.0)
        self.assertLessEqual(response.overall_score, 100.0)
        self.assertGreater(len(response.primary_reasons), 0)
        self.assertGreater(len(response.recommended_actions), 0)
        self.assertIsNotNone(response.tool_results)

    # =========================================================================
    # 10. HTTP Endpoint: POST /api/investigate/{work_id}
    # =========================================================================
    def test_10_endpoint_investigate_success(self):
        lookup_id = self.work.work_id if self.work.work_id else self.work.id
        with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
            resp = client.post(f"/api/investigate/{lookup_id}")
            self.assertEqual(resp.status_code, 200, resp.text)
            data = resp.json()

            self.assertEqual(data["work_id"], lookup_id)
            self.assertIn(data["risk_level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
            self.assertIn("signal_breakdown", data)
            self.assertIn("recommended_actions", data)
            self.assertIn("primary_reasons", data)
            self.assertIn("evidence", data)
            self.assertIn("summary", data)

    # =========================================================================
    # 11. Endpoint: Nonexistent work -> 404 Not Found
    # =========================================================================
    def test_11_endpoint_nonexistent_work_404(self):
        with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
            resp = client.post("/api/investigate/9999999999")
            self.assertEqual(resp.status_code, 404)
            self.assertIn("not found", resp.json()["detail"].lower())

    # =========================================================================
    # 12. Missing GPS Handling
    # =========================================================================
    def test_12_missing_gps_handling(self):
        temp_work = Work(
            work_id=999002,
            source_id="test_no_gps_002",
            work_description="Road repair work without GPS",
            cost=200000.0,
            latitude=None,
            longitude=None,
            source="empowered_indian"
        )
        geo_res = InvestigationTools.get_geographic_context(temp_work, self.db)
        self.assertFalse(geo_res["coordinates_available"])
        self.assertIn("unavailable", geo_res["message"].lower())
        self.assertEqual(geo_res["geographic_score"], 30.0)

    # =========================================================================
    # 13. Missing Optional Evidence / Null Fields Handling
    # =========================================================================
    def test_13_missing_optional_evidence_handling(self):
        temp_work = Work(
            work_id=999003,
            source_id="test_sparse_003",
            work_description=None,
            cost=None,
            completion_date=None,
            implementing_agency=None,
            photos_metadata=None,
            source="empowered_indian"
        )
        agent = InvestigationAgent(db=self.db)
        resp = agent.investigate(temp_work)
        self.assertIsInstance(resp, InvestigationResponse)
        self.assertIn("data completeness gaps", " ".join(resp.primary_reasons).lower())

    # =========================================================================
    # 14. Language Safety Policy Enforcement (No Fraud Terminology)
    # =========================================================================
    def test_14_language_safety_policy(self):
        agent = InvestigationAgent(db=self.db)
        resp = agent.investigate(self.work)

        full_text = " ".join([
            resp.summary,
            " ".join(resp.primary_reasons),
            " ".join([e.detail for e in resp.evidence]),
            " ".join(resp.recommended_actions)
        ]).lower()

        self.assertNotIn("fraud detected", full_text)
        self.assertNotIn("confirmed fraud", full_text)
        self.assertNotIn("fraudulent", full_text)

        has_safe_term = (
            "verification" in full_text
            or "irregularity" in full_text
            or "standard" in full_text
            or "review" in full_text
        )
        self.assertTrue(has_safe_term)

    # =========================================================================
    # 15. Risk Band Mapping & Range Checks
    # =========================================================================
    def test_15_risk_band_mapping(self):
        # 0 - 30: LOW
        r_low = InvestigationTools.get_risk_breakdown(self.work, self.db, {"ml_anomaly_score": 10.0, "cost_score": 10.0, "duplicate_score": 10.0, "utilization_score": 10.0, "geographic_score": 10.0, "data_quality_score": 10.0})
        self.assertEqual(r_low["risk_level"], "LOW")
        self.assertEqual(r_low["overall_score"], 10.0)

        # 31 - 60: MEDIUM
        r_med = InvestigationTools.get_risk_breakdown(self.work, self.db, {"ml_anomaly_score": 50.0, "cost_score": 50.0, "duplicate_score": 50.0, "utilization_score": 50.0, "geographic_score": 50.0, "data_quality_score": 50.0})
        self.assertEqual(r_med["risk_level"], "MEDIUM")
        self.assertEqual(r_med["overall_score"], 50.0)

        # 61 - 80: HIGH
        r_high = InvestigationTools.get_risk_breakdown(self.work, self.db, {"ml_anomaly_score": 75.0, "cost_score": 75.0, "duplicate_score": 75.0, "utilization_score": 75.0, "geographic_score": 75.0, "data_quality_score": 75.0})
        self.assertEqual(r_high["risk_level"], "HIGH")
        self.assertEqual(r_high["overall_score"], 75.0)

        # 81 - 100: CRITICAL
        r_crit = InvestigationTools.get_risk_breakdown(self.work, self.db, {"ml_anomaly_score": 95.0, "cost_score": 95.0, "duplicate_score": 95.0, "utilization_score": 95.0, "geographic_score": 95.0, "data_quality_score": 95.0})
        self.assertEqual(r_crit["risk_level"], "CRITICAL")
        self.assertEqual(r_crit["overall_score"], 95.0)

    # =========================================================================
    # 16. Akshansh Adapter: Fallback Mode
    # =========================================================================
    def test_16_anomaly_detector_fallback_mode(self):
        """Verify get_cost_analysis uses preliminary_statistical_baseline when ML detector is un-scored."""
        res = InvestigationTools.get_cost_analysis(self.work, self.db)
        self.assertEqual(res["engine_mode"], "preliminary_statistical_baseline")
        self.assertIn("peer_avg_cost", res)

    # =========================================================================
    # 17. Akshansh Adapter: Active Delegation Mode
    # =========================================================================
    @patch("app.services.agent.tools._get_anomaly_detector_class")
    def test_17_anomaly_detector_active_delegation(self, mock_get_cls):
        """Verify get_cost_analysis delegates to AnomalyDetector when callable and returns ml_detector mode."""
        mock_detector = MagicMock()
        mock_detector.predict.return_value = {
            "ml_anomaly_score": 88.0,
            "cost_anomaly_score": 92.0,
            "observations": ["Significant cost deviation flagged by active ML model."]
        }
        mock_get_cls.return_value = MagicMock(return_value=mock_detector)

        res = InvestigationTools.get_cost_analysis(self.work, self.db)
        self.assertEqual(res["engine_mode"], "ml_detector")
        self.assertEqual(res["cost_score"], 92.0)
        self.assertEqual(res["ml_anomaly_score"], 88.0)
        self.assertIn("active ML model", res["observations"][0])

    # =========================================================================
    # 18. Nitin Adapter: Fallback Mode
    # =========================================================================
    def test_18_duplicate_detector_fallback_mode(self):
        """Verify check_duplicate uses preliminary_similarity_baseline when DuplicateDetector is un-scored."""
        res = InvestigationTools.check_duplicate(self.work, self.db)
        self.assertEqual(res["engine_mode"], "preliminary_similarity_baseline")
        self.assertIn("duplicate_score", res)

    # =========================================================================
    # 19. Nitin Adapter: Active Delegation Mode
    # =========================================================================
    @patch("app.services.agent.tools._get_duplicate_detector_class")
    def test_19_duplicate_detector_active_delegation(self, mock_get_cls):
        """Verify check_duplicate delegates to DuplicateDetector when callable and returns duplicate_detector mode."""
        mock_detector = MagicMock()
        mock_detector.find_duplicates.return_value = {
            "duplicate_score": 78.5,
            "duplicate_detected": True,
            "reason": "Cluster overlap detected by Nitin's duplicate engine.",
            "potential_duplicates": [{"work_id": 194809, "similarity": 0.92}]
        }
        mock_get_cls.return_value = MagicMock(return_value=mock_detector)

        res = InvestigationTools.check_duplicate(self.work, self.db)
        self.assertEqual(res["engine_mode"], "duplicate_detector")
        self.assertEqual(res["duplicate_score"], 78.5)
        self.assertTrue(res["duplicate_detected"])
        self.assertIn("Nitin's duplicate engine", res["reason"])

    # =========================================================================
    # 20. Jayant Adapter: Fallback Mode
    # =========================================================================
    def test_20_risk_engine_fallback_mode(self):
        """Verify get_risk_breakdown uses preliminary_prd_weighted_fallback when RiskEngine is un-scored."""
        signals = {"ml_anomaly_score": 40.0, "cost_score": 40.0, "duplicate_score": 40.0, "utilization_score": 40.0, "geographic_score": 40.0, "data_quality_score": 40.0}
        res = InvestigationTools.get_risk_breakdown(self.work, self.db, signals)
        self.assertEqual(res["engine_mode"], "preliminary_prd_weighted_fallback")
        self.assertEqual(res["overall_score"], 40.0)

    # =========================================================================
    # 21. Jayant Adapter: Active Delegation Mode
    # =========================================================================
    @patch("app.services.agent.tools._get_risk_engine_class")
    def test_21_risk_engine_active_delegation(self, mock_get_cls):
        """Verify get_risk_breakdown delegates to RiskEngine when callable and returns risk_engine mode."""
        mock_engine = MagicMock()
        mock_engine.compute_risk.return_value = {
            "overall_score": 77.4,
            "risk_level": "HIGH",
            "weights": {"ml_anomaly_score": 0.25, "cost_score": 0.25, "duplicate_score": 0.20, "utilization_score": 0.15, "geographic_score": 0.10, "data_quality_score": 0.05}
        }
        mock_get_cls.return_value = MagicMock(return_value=mock_engine)

        signals = {"ml_anomaly_score": 80.0, "cost_score": 80.0, "duplicate_score": 75.0, "utilization_score": 70.0, "geographic_score": 60.0, "data_quality_score": 50.0}
        res = InvestigationTools.get_risk_breakdown(self.work, self.db, signals)
        self.assertEqual(res["engine_mode"], "risk_engine")
        self.assertEqual(res["overall_score"], 77.4)
        self.assertEqual(res["risk_level"], "HIGH")

    # =========================================================================
    # 22. Full Agent Synthesis with Active Teammate Adapters
    # =========================================================================
    @patch("app.services.agent.tools._get_anomaly_detector_class")
    @patch("app.services.agent.tools._get_duplicate_detector_class")
    @patch("app.services.agent.tools._get_risk_engine_class")
    def test_22_full_agent_synthesis_with_teammate_adapters(self, mock_get_risk, mock_get_dup, mock_get_anomaly):
        """Verify end-to-end investigation with all teammate adapters actively invoked."""
        mock_anomaly = MagicMock()
        mock_anomaly.predict.return_value = {"ml_anomaly_score": 85.0, "cost_anomaly_score": 88.0, "observations": ["Elevated cost anomaly."]}
        mock_get_anomaly.return_value = MagicMock(return_value=mock_anomaly)

        mock_dup = MagicMock()
        mock_dup.find_duplicates.return_value = {"duplicate_score": 82.0, "duplicate_detected": True, "reason": "High overlap."}
        mock_get_dup.return_value = MagicMock(return_value=mock_dup)

        mock_risk = MagicMock()
        mock_risk.compute_risk.return_value = {"overall_score": 76.5, "risk_level": "HIGH"}
        mock_get_risk.return_value = MagicMock(return_value=mock_risk)

        agent = InvestigationAgent(db=self.db)
        resp = agent.investigate(self.work)

        self.assertEqual(resp.risk_level, "HIGH")
        self.assertEqual(resp.overall_score, 76.5)
        self.assertEqual(resp.signal_breakdown.ml_anomaly_score, 85.0)
        self.assertEqual(resp.signal_breakdown.cost_score, 88.0)
        self.assertEqual(resp.signal_breakdown.duplicate_score, 82.0)
        self.assertEqual(resp.tool_results["cost_analysis"]["engine_mode"], "ml_detector")
        self.assertEqual(resp.tool_results["duplicate_check"]["engine_mode"], "duplicate_detector")
        self.assertEqual(resp.tool_results["risk_breakdown"]["engine_mode"], "risk_engine")


if __name__ == "__main__":
    unittest.main()
