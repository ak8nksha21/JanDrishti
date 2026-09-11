import unittest
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.models.work import Work
from app.database import SessionLocal, Base, engine
from ml.data_quality import (
    WorkDataQualityAuditor,
    QualityIssueCode,
    QualityIssueSeverity,
)
from app.services.duplicate import DataQualityService


class TestWorkDataQualityML(unittest.TestCase):
    """Unit tests for ML/rule-based data quality and consistency auditing."""

    def setUp(self):
        self.auditor = WorkDataQualityAuditor()

    def test_clean_valid_work(self):
        """Verify clean, complete work has 1.0 completeness and no critical/warning issues."""
        clean_work = {
            "id": 1,
            "work_id": 10001,
            "source_id": "clean_src_01",
            "work_description": "Construction of Concrete Pavement Road in Ward No 5",
            "cost": 450000.0,
            "completion_date": datetime(2023, 5, 15),
            "completion_year": 2023,
            "mp_name": "Shri Test MP",
            "constituency": "SHAHJAHANPUR",
            "state": "Uttar Pradesh",
            "district": "Shahjahanpur",
            "category": "Roads & Bridges",
            "location": "Ward No 5",
            "latitude": 27.8812,
            "longitude": 79.9100,
        }
        report = self.auditor.audit_work(clean_work)
        self.assertEqual(report["critical_issues_count"], 0)
        self.assertEqual(report["warning_issues_count"], 0)
        self.assertEqual(report["completeness_score"], 1.0)
        self.assertEqual(report["field_status"]["work_description"], "valid")
        self.assertEqual(report["field_status"]["cost"], "valid")
        self.assertEqual(report["field_status"]["gps"], "valid")

    def test_missing_critical_fields(self):
        """Verify missing identifiers and missing descriptions trigger CRITICAL issues."""
        corrupt_work = {
            "id": 2,
            "work_id": None,
            "source_id": None,
            "work_description": None,
            "cost": None,
        }
        report = self.auditor.audit_work(corrupt_work)
        self.assertTrue(report["has_issues"])
        codes = [i["code"] for i in report["issues"]]
        self.assertIn(QualityIssueCode.MISSING_ALL_IDENTIFIERS, codes)
        self.assertIn(QualityIssueCode.MISSING_DESCRIPTION, codes)
        self.assertIn(QualityIssueCode.MISSING_COST, codes)
        self.assertGreaterEqual(report["critical_issues_count"], 2)

    def test_placeholder_descriptions(self):
        """Verify suspicious placeholder descriptions (NA, test, ---) are flagged."""
        placeholders = ["NA", "n/a", "nil", "NULL", "test", "---", "?"]
        for p in placeholders:
            work = {
                "id": 3,
                "work_id": 10003,
                "work_description": p,
                "cost": 50000.0,
            }
            report = self.auditor.audit_work(work)
            codes = [i["code"] for i in report["issues"]]
            self.assertIn(
                QualityIssueCode.SUSPICIOUS_PLACEHOLDER_DESCRIPTION,
                codes,
                f"Failed to flag placeholder description: {p}"
            )

    def test_cost_validation_rules(self):
        """Verify negative, zero, and missing costs are distinctly and correctly handled."""
        # 1. Negative cost
        w_neg = {"id": 4, "work_id": 10004, "work_description": "Road work", "cost": -75000.0}
        rep_neg = self.auditor.audit_work(w_neg)
        self.assertIn(QualityIssueCode.NEGATIVE_COST, [i["code"] for i in rep_neg["issues"]])
        self.assertEqual(rep_neg["field_status"]["cost"], "negative")

        # 2. Zero cost
        w_zero = {"id": 5, "work_id": 10005, "work_description": "Road work", "cost": 0.0}
        rep_zero = self.auditor.audit_work(w_zero)
        self.assertIn(QualityIssueCode.ZERO_COST, [i["code"] for i in rep_zero["issues"]])
        self.assertEqual(rep_zero["field_status"]["cost"], "zero")

        # 3. Missing (NULL) cost - must NOT become zero
        w_null = {"id": 6, "work_id": 10006, "work_description": "Road work", "cost": None}
        rep_null = self.auditor.audit_work(w_null)
        self.assertIn(QualityIssueCode.MISSING_COST, [i["code"] for i in rep_null["issues"]])
        self.assertEqual(rep_null["field_status"]["cost"], "missing")
        # Ensure it was not treated as negative or zero
        self.assertNotIn(QualityIssueCode.NEGATIVE_COST, [i["code"] for i in rep_null["issues"]])
        self.assertNotIn(QualityIssueCode.ZERO_COST, [i["code"] for i in rep_null["issues"]])

    def test_date_timeline_validation(self):
        """Verify future dates, pre-MPLADS dates, and date/year mismatches are caught."""
        # Future date
        w_future = {
            "id": 7,
            "work_id": 10007,
            "work_description": "Hospital renovation",
            "completion_date": datetime(2045, 1, 1),
        }
        rep_future = self.auditor.audit_work(w_future)
        self.assertIn(QualityIssueCode.FUTURE_COMPLETION_DATE, [i["code"] for i in rep_future["issues"]])

        # Pre-MPLADS date (e.g., 1978)
        w_past = {
            "id": 8,
            "work_id": 10008,
            "work_description": "School boundary",
            "completion_date": datetime(1978, 4, 12),
        }
        rep_past = self.auditor.audit_work(w_past)
        self.assertIn(QualityIssueCode.PRE_MPLADS_COMPLETION_DATE, [i["code"] for i in rep_past["issues"]])

        # Year mismatch (completion_date in 2022, but completion_year = 2019)
        w_mismatch = {
            "id": 9,
            "work_id": 10009,
            "work_description": "Water pipeline",
            "completion_date": datetime(2022, 6, 20),
            "completion_year": 2019,
        }
        rep_mismatch = self.auditor.audit_work(w_mismatch)
        self.assertIn(QualityIssueCode.DATE_YEAR_MISMATCH, [i["code"] for i in rep_mismatch["issues"]])

    def test_batch_duplicate_work_ids(self):
        """Verify duplicate work_ids across multiple records in a batch are detected."""
        batch = [
            {"id": 10, "work_id": 88888, "work_description": "Project A in Village 1"},
            {"id": 11, "work_id": 88888, "work_description": "Project B in Village 2"},  # Duplicate work_id
            {"id": 12, "work_id": 99999, "work_description": "Project C in Village 3"},
        ]
        result = self.auditor.audit_batch(batch)
        self.assertEqual(result["total_works_audited"], 3)
        self.assertEqual(result["issue_breakdown_by_code"].get(QualityIssueCode.DUPLICATE_WORK_ID), 2)


class TestDataQualityServiceAndAPI(unittest.TestCase):
    """Integration tests for DataQualityService and FastAPI endpoints."""

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        cls.w_good = Work(
            work_id=700001,
            source_id="dq_src_01",
            work_description="Construction of CC Road in Gram Panchayat Piprola",
            constituency="SHAHJAHANPUR",
            state="Uttar Pradesh",
            district="Shahjahanpur",
            category="Roads & Bridges",
            location="Piprola",
            cost=320000.0,
            completion_date=datetime(2023, 11, 10),
            completion_year=2023,
            mp_name="Test MP",
            source="test_quality"
        )
        cls.w_bad = Work(
            work_id=700002,
            source_id="dq_src_02",
            work_description="NA",  # Placeholder
            constituency="SHAHJAHANPUR",
            state="Uttar Pradesh",
            cost=-50000.0,          # Negative cost
            latitude=0.0,           # Null island
            longitude=0.0,
            source="test_quality"
        )

        cls.db.add_all([cls.w_good, cls.w_bad])
        cls.db.commit()
        cls.db.refresh(cls.w_good)
        cls.db.refresh(cls.w_bad)

    @classmethod
    def tearDownClass(cls):
        cls.db.query(Work).filter(Work.source == "test_quality").delete()
        cls.db.commit()
        cls.db.close()

    def test_service_audit_batch(self):
        """Verify DataQualityService audits batch and computes summary stats."""
        service = DataQualityService()
        result = service.audit_batch(db=self.db, constituency="SHAHJAHANPUR")
        self.assertGreaterEqual(result["total_works_audited"], 2)
        self.assertGreaterEqual(result["works_with_critical_issues"], 1)

    def test_service_audit_single_work(self):
        """Verify single work audit detects specific issues."""
        service = DataQualityService()
        rep = service.audit_single_work(db=self.db, work_id=str(self.w_bad.work_id))
        self.assertIsNotNone(rep)
        self.assertTrue(rep["has_issues"])
        codes = [i["code"] for i in rep["issues"]]
        self.assertIn(QualityIssueCode.SUSPICIOUS_PLACEHOLDER_DESCRIPTION, codes)
        self.assertIn(QualityIssueCode.NEGATIVE_COST, codes)
        self.assertIn(QualityIssueCode.NULL_ISLAND_GPS, codes)

    def test_api_get_data_quality_audit(self):
        """Verify GET /api/data-quality/audit endpoint."""
        response = self.client.get("/api/data-quality/audit?constituency=SHAHJAHANPUR")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total_works_audited", data)
        self.assertIn("work_reports", data)

    def test_api_get_data_quality_summary(self):
        """Verify GET /api/data-quality/summary endpoint."""
        response = self.client.get("/api/data-quality/summary?constituency=SHAHJAHANPUR")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("average_completeness_score", data)
        self.assertIn("issue_breakdown_by_code", data)

    def test_api_get_single_work_quality(self):
        """Verify GET /api/data-quality/works/{work_id} endpoint."""
        response = self.client.get(f"/api/data-quality/works/{self.w_good.work_id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["external_work_id"], self.w_good.work_id)
        self.assertEqual(data["critical_issues_count"], 0)

    def test_api_get_nonexistent_work_quality(self):
        """Verify 404 for nonexistent work ID in quality endpoint."""
        response = self.client.get("/api/data-quality/works/9999999999")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
