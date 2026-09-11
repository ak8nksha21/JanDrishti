import os
import unittest
import httpx


def get_base_url() -> str:
    env_url = os.environ.get("TEST_BASE_URL")
    if env_url:
        return env_url
    for candidate in ["http://[::1]:8000", "http://127.0.0.1:8000", "http://localhost:8000"]:
        try:
            r = httpx.get(f"{candidate}/health", timeout=2.0)
            if r.status_code == 200:
                r2 = httpx.get(f"{candidate}/api/anomalies/works?limit=1", timeout=3.0)
                if r2.status_code == 200:
                    return candidate
        except Exception:
            pass
    return "http://127.0.0.1:8000"


BASE_URL = get_base_url()


class TestAnomalyRoutes(unittest.TestCase):
    """Integration test suite for ML Anomaly Detection API endpoints."""

    def test_01_works_anomalies_list(self):
        """Verify GET /api/anomalies/works returns evaluated works with 0-100 scores and evidence."""
        with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
            resp = client.get("/api/anomalies/works?limit=5")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()

            self.assertIn("items", data)
            self.assertIn("total", data)
            self.assertIn("anomalies_count", data)
            self.assertGreater(data["total"], 0)

            item = data["items"][0]
            self.assertIn("cost_anomaly_score", item)
            self.assertIn("cost_score", item)
            self.assertIn("anomaly_score", item)
            self.assertIn("is_anomaly", item)
            self.assertIn("evidence", item)
            self.assertIn("cost_details", item["evidence"])

            # Verify score ranges 0-100
            score = item["cost_anomaly_score"]
            if score is not None:
                self.assertGreaterEqual(score, 0.0)
                self.assertLessEqual(score, 100.0)
                self.assertEqual(item["cost_anomaly_score"], item["cost_score"])

    def test_02_single_work_anomaly(self):
        """Verify GET /api/anomalies/works/{work_id} evaluates a specific work item."""
        with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
            # First get an existing work ID
            list_resp = client.get("/api/anomalies/works?limit=1")
            self.assertEqual(list_resp.status_code, 200)
            work_id = str(list_resp.json()["items"][0]["work_id"])

            resp = client.get(f"/api/anomalies/works/{work_id}")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertEqual(str(data["work_id"]), work_id)
            self.assertIn("cost_anomaly_score", data)
            self.assertIn("explanation", data)

            # 404 on nonexistent work
            resp_404 = client.get("/api/anomalies/works/999999999")
            self.assertEqual(resp_404.status_code, 404)

    def test_03_mps_anomalies_list(self):
        """Verify GET /api/anomalies/mps returns evaluated MP financial and utilization metrics."""
        with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
            resp = client.get("/api/anomalies/mps?limit=5")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()

            self.assertIn("items", data)
            self.assertIn("total", data)
            self.assertIn("anomalies_count", data)
            self.assertGreater(data["total"], 0)

            item = data["items"][0]
            self.assertIn("financial_anomaly_score", item)
            self.assertIn("ml_anomaly_score", item)
            self.assertIn("utilization_anomaly_score", item)
            self.assertIn("utilization_score", item)
            self.assertIn("evidence", item)

            fin_score = item["financial_anomaly_score"]
            util_score = item["utilization_anomaly_score"]

            if fin_score is not None:
                self.assertGreaterEqual(fin_score, 0.0)
                self.assertLessEqual(fin_score, 100.0)
                self.assertEqual(item["financial_anomaly_score"], item["ml_anomaly_score"])

            if util_score is not None:
                self.assertGreaterEqual(util_score, 0.0)
                self.assertLessEqual(util_score, 100.0)
                self.assertEqual(item["utilization_anomaly_score"], item["utilization_score"])

    def test_04_single_mp_anomaly(self):
        """Verify GET /api/anomalies/mps/{mp_id} evaluates a specific MP record."""
        with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
            list_resp = client.get("/api/anomalies/mps?limit=1")
            self.assertEqual(list_resp.status_code, 200)
            mp_id = str(list_resp.json()["items"][0]["id"])

            resp = client.get(f"/api/anomalies/mps/{mp_id}")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertEqual(str(data["id"]), mp_id)

            resp_404 = client.get("/api/anomalies/mps/999999999")
            self.assertEqual(resp_404.status_code, 404)

    def test_05_evaluate_custom_payload_and_edge_cases(self):
        """Verify POST /api/anomalies/evaluate handles normal, anomalous, missing, and zero-allocation records."""
        payload = {
            "records": [
                {
                    "work_id": 1001,
                    "cost": 500000.0,
                    "category": "Education",
                    "district": "TestDistrict",
                },
                {
                    "work_id": 1002,
                    "cost": None,
                    "category": "Roads",
                },
                {
                    "mp_name": "ZeroAlloc MP",
                    "allocated_amount": 0,
                    "total_expenditure": 50000.0,
                    "utilization_percentage": 20.0,
                },
                {
                    "mp_name": "Missing MP",
                    "allocated_amount": None,
                    "total_expenditure": None,
                },
            ]
        }
        with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
            resp = client.post("/api/anomalies/evaluate", json=payload)
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            results = data["results"]
            self.assertEqual(len(results), 4)

            # Record 1: Valid work
            self.assertEqual(results[0]["work_id"], 1001)

            # Record 2: Missing cost -> None
            self.assertIsNone(results[1]["cost_anomaly_score"])

            # Record 3: Zero allocation -> does not crash, valid score
            self.assertIsNotNone(results[2]["utilization_anomaly_score"])
            self.assertGreaterEqual(results[2]["utilization_anomaly_score"], 0.0)
            self.assertLessEqual(results[2]["utilization_anomaly_score"], 100.0)

            # Record 4: Missing MP financial -> None
            self.assertIsNone(results[3]["financial_anomaly_score"])
            self.assertIsNone(results[3]["utilization_anomaly_score"])

            # Verify no forbidden accusatory language
            forbidden = ["fraud", "corruption", "scam", "embezzlement", "criminal", "guilty", "illegal", "bribe"]
            for r in results:
                explanation = (r.get("explanation") or "").lower()
                for word in forbidden:
                    self.assertNotIn(word, explanation)


if __name__ == "__main__":
    unittest.main()
