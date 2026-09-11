"""
JanDrishti - Risk API Integration Test Suite

Verifies:
1. POST /api/risk/evaluate endpoint with 6 signals.
2. POST /api/risk/evaluate validation failure returns 400.
3. POST /api/risk/evaluate/batch endpoint.
4. GET /api/risk/alerts with filters.
5. GET /api/risk/config exposing transparent configuration.
6. GET /api/risk/{work_id} on stored database record.
7. GET /api/risk/{work_id} 404 on nonexistent work.
8. Unbroken existing endpoints (/health, /).
"""

import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_db, Base
from app.models.work import Work
from app.services.risk.alerts import alert_manager

# In-memory SQLite database for isolated API tests
TEST_SQLITE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_SQLITE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


class TestRiskAPIsIntegration(unittest.TestCase):
    """Integration tests for FastAPI Risk routes under the 0-100 contract."""

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=test_engine)
        app.dependency_overrides[get_db] = override_get_db

        # Seed a test work record in DB
        db = TestingSessionLocal()
        test_work = Work(
            work_id=77701,
            source_id="source_77701",
            work_description="Construction of rural community centre in Varanasi",
            cost=2500000.0,
            constituency="Varanasi",
            state="Uttar Pradesh",
            mp_name="Test MP Varanasi",
            category="Community Works",
            source="empowered_indian",
        )
        db.add(test_work)
        db.commit()
        db.close()

        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=test_engine)

    def setUp(self):
        alert_manager.clear()

    def test_01_post_evaluate_endpoint(self):
        """POST /api/risk/evaluate validates signals and returns complete evaluation on 0-100 scale."""
        payload = {
            "work_id": "API_TEST_01",
            "signals": {
                "ml_anomaly_score": 80.0,
                "cost_anomaly_score": 85.0,
                "duplicate_score": 75.0,
                "geographic_score": 30.0,
            },
            "evidence": [
                {
                    "source": "duplicate_detector",
                    "evidence_type": "text_similarity",
                    "description": "75% similarity match with project ID 98214.",
                    "reference_id": "98214",
                }
            ],
            "metadata": {
                "constituency": "NEW DELHI",
            }
        }
        resp = self.client.post("/api/risk/evaluate", json=payload)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()

        self.assertEqual(data["work_id"], "API_TEST_01")
        self.assertGreaterEqual(data["overall_score"], 60.0)
        self.assertLessEqual(data["overall_score"], 100.0)
        self.assertIn(data["risk_level"], ("High", "Critical", "Medium"))
        self.assertIn("top_risk_factors", data)
        self.assertIn("signal_breakdown", data)
        self.assertIn("observations", data)
        self.assertEqual(len(data["evidence"]), 1)
        self.assertEqual(data["evidence"][0]["reference_id"], "98214")

    def test_02_post_evaluate_invalid_signal_returns_400(self):
        """POST /api/risk/evaluate returns 400 Bad Request for out-of-bounds signal values."""
        payload = {
            "work_id": "INVALID_VAL",
            "signals": {
                "cost_anomaly_score": 150.0,  # Invalid: > 100
            }
        }
        resp = self.client.post("/api/risk/evaluate", json=payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("out of valid range", resp.json()["detail"])

    def test_03_post_evaluate_batch(self):
        """POST /api/risk/evaluate/batch evaluates multiple works in one call."""
        payload = {
            "items": [
                {
                    "work_id": "BATCH_01",
                    "signals": {"cost_anomaly_score": 10.0},
                },
                {
                    "work_id": "BATCH_02",
                    "signals": {"cost_anomaly_score": 90.0, "duplicate_score": 88.0},
                },
            ]
        }
        resp = self.client.post("/api/risk/evaluate/batch", json=payload)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()

        self.assertEqual(data["total"], 2)
        self.assertEqual(len(data["items"]), 2)
        self.assertEqual(data["items"][0]["risk_level"], "Low")
        self.assertIn(data["items"][1]["risk_level"], ("High", "Critical"))

    def test_04_get_alerts_endpoint(self):
        """GET /api/risk/alerts retrieves generated alerts with filters."""
        # 1. Trigger an alert via evaluate
        self.client.post("/api/risk/evaluate", json={
            "work_id": "ALERTED_WORK_99",
            "signals": {"cost_anomaly_score": 95.0, "ml_anomaly_score": 90.0},
        })

        # 2. Query alerts
        resp = self.client.get("/api/risk/alerts")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreaterEqual(data["total"], 1)
        alert = data["alerts"][0]
        self.assertEqual(alert["work_id"], "ALERTED_WORK_99")
        self.assertIn(alert["risk_level"], ("High", "Critical"))

        # 3. Filter with min_score filter
        resp_filtered = self.client.get("/api/risk/alerts?min_score=80.0")
        self.assertEqual(resp_filtered.status_code, 200)
        for a in resp_filtered.json()["alerts"]:
            self.assertGreaterEqual(a["risk_score"], 80.0)

    def test_05_get_config_endpoint(self):
        """GET /api/risk/config exposes transparent weights and thresholds on 0-100 scale."""
        resp = self.client.get("/api/risk/config")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertIn("weights", data)
        self.assertIn("ml_anomaly_score", data["weights"])
        self.assertEqual(data["weights"]["ml_anomaly_score"], 0.25)
        self.assertEqual(data["weights"]["cost_anomaly_score"], 0.25)
        self.assertEqual(data["weights"]["duplicate_score"], 0.20)
        self.assertEqual(data["weights"]["utilization_score"], 0.15)
        self.assertEqual(data["weights"]["geographic_score"], 0.10)
        self.assertEqual(data["weights"]["data_quality_score"], 0.05)
        self.assertIn("thresholds", data)
        self.assertEqual(data["thresholds"]["low"], 30.0)
        self.assertEqual(data["thresholds"]["medium"], 60.0)
        self.assertEqual(data["thresholds"]["high"], 80.0)
        self.assertEqual(data["thresholds"]["alert"], 70.0)
        self.assertIn("risk_levels", data)
        self.assertIn("Low", data["risk_levels"])
        self.assertIn("Critical", data["risk_levels"])

    def test_06_get_work_risk_endpoint_existing(self):
        """GET /api/risk/{work_id} returns risk evaluation for existing database work."""
        resp = self.client.get("/api/risk/77701")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["work_id"], "77701")
        self.assertIn("risk_level", data)
        self.assertEqual(data["metadata"]["constituency"], "Varanasi")

    def test_07_get_work_risk_endpoint_not_found(self):
        """GET /api/risk/{work_id} returns 404 for unknown work ID."""
        resp = self.client.get("/api/risk/99999999")
        self.assertEqual(resp.status_code, 404)
        self.assertIn("not found", resp.json()["detail"].lower())

    def test_08_existing_endpoints_unbroken(self):
        """Verify GET /health and GET / remain functional."""
        r_health = self.client.get("/health")
        self.assertEqual(r_health.status_code, 200)
        self.assertEqual(r_health.json(), {"status": "healthy"})

        r_root = self.client.get("/")
        self.assertEqual(r_root.status_code, 200)
        self.assertEqual(r_root.json()["project"], "JanDrishti")


if __name__ == "__main__":
    unittest.main()
