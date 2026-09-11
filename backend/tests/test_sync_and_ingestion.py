import unittest
import httpx
from app.database import SessionLocal
from app.models.work import Work
from app.models.mp_summary import MPFinancialSummary
from app.models.macro_summary import MacroMetric

BASE_URL = "http://127.0.0.1:8000"


class TestSyncAndIngestion(unittest.TestCase):
    """Integration test suite for completed works ingestion, sync endpoint, and data foundation APIs."""

    def test_01_existing_endpoints_functional(self):
        """Verify health, root, works list, mps list, and dashboard endpoints respond with 200 OK."""
        with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
            # 1. Health
            r_health = client.get("/health")
            self.assertEqual(r_health.status_code, 200)
            self.assertEqual(r_health.json(), {"status": "healthy"})

            # 2. Root
            r_root = client.get("/")
            self.assertEqual(r_root.status_code, 200)
            self.assertEqual(r_root.json()["project"], "JanDrishti")

            # 3. Works list
            r_works = client.get("/api/works")
            self.assertEqual(r_works.status_code, 200)
            self.assertIn("items", r_works.json())

            # 4. MPs list
            r_mps = client.get("/api/mps?limit=2")
            self.assertEqual(r_mps.status_code, 200)
            self.assertEqual(r_mps.json()["total"], 774)

            # 5. Dashboard
            r_dash = client.get("/api/dashboard")
            self.assertEqual(r_dash.status_code, 200)
            self.assertIn("works_summary", r_dash.json())
            self.assertIn("mps_summary", r_dash.json())

    def test_02_default_sync_national(self):
        """Verify default POST /api/sync fetches national completed works capped at max_pages=5 (500 works)."""
        with httpx.Client(base_url=BASE_URL, timeout=120.0) as client:
            resp = client.post("/api/sync")
            self.assertEqual(resp.status_code, 200, resp.text)
            data = resp.json()

            self.assertIn(data["status"], ["success", "partial_success"])
            works_summary = data["summary"]["works"]
            self.assertEqual(works_summary["scope"], "national")
            self.assertEqual(works_summary["max_pages"], 5)
            self.assertEqual(works_summary["fetched"], 500)
            self.assertEqual(works_summary["errors"], 0)
            self.assertGreaterEqual(works_summary["inserted"] + works_summary["updated"], 500)

            # Verify database count
            db = SessionLocal()
            try:
                work_count = db.query(Work).count()
                # Should have at least 500 works now
                self.assertGreaterEqual(work_count, 500)
            finally:
                db.close()

    def test_03_constituency_sync(self):
        """Verify POST /api/sync with constituency parameter."""
        with httpx.Client(base_url=BASE_URL, timeout=60.0) as client:
            resp = client.post("/api/sync?constituency=MALKAJGIRI")
            self.assertEqual(resp.status_code, 200, resp.text)
            data = resp.json()

            works_summary = data["summary"]["works"]
            self.assertEqual(works_summary["scope"], "constituency")
            self.assertEqual(works_summary["constituency"], "MALKAJGIRI")
            self.assertEqual(works_summary["fetched"], 29)
            self.assertEqual(works_summary["errors"], 0)

    def test_04_state_sync(self):
        """Verify POST /api/sync with state parameter and custom max_pages."""
        with httpx.Client(base_url=BASE_URL, timeout=60.0) as client:
            resp = client.post("/api/sync?state=Goa&max_pages=2")
            self.assertEqual(resp.status_code, 200, resp.text)
            data = resp.json()

            works_summary = data["summary"]["works"]
            self.assertEqual(works_summary["scope"], "state")
            self.assertEqual(works_summary["state"], "Goa")
            self.assertEqual(works_summary["max_pages"], 2)
            self.assertGreater(works_summary["fetched"], 0)
            self.assertEqual(works_summary["errors"], 0)

    def test_05_idempotent_repeated_sync(self):
        """Verify repeated sync executions do not duplicate database rows."""
        db = SessionLocal()
        try:
            initial_count = db.query(Work).count()

            # Run default sync again
            with httpx.Client(base_url=BASE_URL, timeout=120.0) as client:
                resp = client.post("/api/sync")
                self.assertEqual(resp.status_code, 200)
                data = resp.json()
                # On repeat run with same 5 national pages, inserted should be 0 and updated should be 500
                self.assertEqual(data["summary"]["works"]["inserted"], 0)
                self.assertEqual(data["summary"]["works"]["updated"], 500)

            after_count = db.query(Work).count()
            self.assertEqual(after_count, initial_count, f"Work count changed from {initial_count} to {after_count}")
        finally:
            db.close()

    def test_06_mp_detail_endpoint(self):
        """Verify GET /api/mps/{id} returns single MP and 404 for missing."""
        with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
            r_list = client.get("/api/mps?limit=1")
            self.assertEqual(r_list.status_code, 200)
            first_mp = r_list.json()["items"][0]
            mp_id = first_mp["id"]

            r_single = client.get(f"/api/mps/{mp_id}")
            self.assertEqual(r_single.status_code, 200)
            self.assertEqual(r_single.json()["id"], mp_id)
            self.assertEqual(r_single.json()["mp_name"], first_mp["mp_name"])

            r_404 = client.get("/api/mps/99999999")
            self.assertEqual(r_404.status_code, 404)

    def test_07_works_detail_and_filters(self):
        """Verify GET /api/works with filters and GET /api/works/{work_id}."""
        with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
            # Query Malkajgiri works
            r_const = client.get("/api/works?constituency=MALKAJGIRI")
            self.assertEqual(r_const.status_code, 200)
            self.assertGreaterEqual(r_const.json()["total"], 29)

            first_work = r_const.json()["items"][0]
            work_id = first_work["work_id"]

            # Detail lookup
            r_detail = client.get(f"/api/works/{work_id}")
            self.assertEqual(r_detail.status_code, 200)
            self.assertEqual(r_detail.json()["work_id"], work_id)
            self.assertEqual(r_detail.json()["source"], "empowered_indian")


if __name__ == "__main__":
    unittest.main()
