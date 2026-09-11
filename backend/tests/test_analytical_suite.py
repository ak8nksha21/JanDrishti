import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.work import Work
from app.models.risk import RiskScore, Alert
from ml.anomaly_detection import CostAnomalyDetector, DataQualityDetector
from ml.duplicate_detection import NearDuplicateDetector
from ml.risk_engine import RiskEngine
from app.services.agent.investigator import AIAgentInvestigator


class TestAnalyticalSuite(unittest.TestCase):
    """Unit and API test suite for JanDrishti analytical detection, risk scoring, and agent."""

    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_01_root_and_health(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"status": "healthy"})

        res_root = self.client.get("/")
        self.assertEqual(res_root.status_code, 200)
        self.assertEqual(res_root.json()["project"], "JanDrishti")

    def test_02_risk_summary(self):
        res = self.client.get("/api/risk/summary")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total_works", data)
        self.assertIn("risk_distribution", data)
        self.assertIn("category_risk", data)

    def test_03_risk_works_list(self):
        res = self.client.get("/api/risk/works?limit=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("items", data)
        self.assertIn("total", data)
        if data["items"]:
            item = data["items"][0]
            self.assertIn("work_id", item)
            self.assertIn("overall_score", item)
            self.assertIn("risk_level", item)

    def test_04_alerts_list(self):
        res = self.client.get("/api/alerts")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)

    def test_05_investigation_brief(self):
        # Pick any work in db
        work = self.db.query(Work).first()
        if work:
            wid = str(work.work_id or work.id or work.source_id)
            res = self.client.post("/api/investigate/brief", json={"work_id": wid})
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["work_id"], wid)
            self.assertIn("primary_reasons", data)
            self.assertIn("recommended_action", data)
            self.assertIn("tools_called", data)
            self.assertGreaterEqual(len(data["tools_called"]), 5)

    def test_06_near_duplicate_detector(self):
        works = [
            {"work_id": "1", "description": "Construction of concrete road with drain", "cost": 10.0, "category": "Roads"},
            {"work_id": "2", "description": "Construction of concrete road with drain", "cost": 10.2, "category": "Roads"},
            {"work_id": "3", "description": "Installation of solar street lights in village", "cost": 2.0, "category": "Lighting"}
        ]
        detector = NearDuplicateDetector(similarity_threshold=0.5)
        scores, pairs = detector.analyze(works)
        self.assertGreater(scores["1"]["score"], 40.0)
        self.assertEqual(len(pairs), 2)  # (1, 2) and (2, 1)

    def test_07_cost_anomaly_detector(self):
        works = [
            {"work_id": "1", "cost": 5.0, "category": "Community Hall"},
            {"work_id": "2", "cost": 5.2, "category": "Community Hall"},
            {"work_id": "3", "cost": 4.8, "category": "Community Hall"},
            {"work_id": "4", "cost": 5.1, "category": "Community Hall"},
            {"work_id": "5", "cost": 38.0, "category": "Community Hall"}  # Extreme outlier > 7x median
        ]
        detector = CostAnomalyDetector()
        results = detector.analyze(works)
        self.assertGreater(results["5"]["score"], 65.0)
        self.assertGreater(results["5"]["ratio_to_median"], 5.0)

    def test_08_risk_engine_bands(self):
        engine = RiskEngine()
        # Normal low risk
        res_low = engine.compute_composite_score(cost_score=10.0, ml_score=15.0, dup_score=5.0)
        self.assertEqual(res_low["risk_level"], "Low")

        # High risk outlier
        res_high = engine.compute_composite_score(cost_score=85.0, ml_score=70.0, dup_score=80.0)
        self.assertIn(res_high["risk_level"], ["High", "Critical"])
