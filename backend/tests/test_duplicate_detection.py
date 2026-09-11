import unittest
import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.models.work import Work
from app.database import SessionLocal, Base, engine
from ml.duplicate_detection import (
    DuplicateDetector,
    normalize_text,
    haversine_distance,
)
from app.services.duplicate import DuplicateService


class TestDuplicateDetectionML(unittest.TestCase):
    """Unit tests for the core ML duplicate detection algorithms."""

    def setUp(self):
        self.detector = DuplicateDetector(similarity_threshold=0.85)

    def test_text_normalization(self):
        """Verify normalization handles mixed case, extra spaces, punctuation, and Hindi text."""
        raw_en = "  CONSTRUCTION  OF C.C. ROAD  IN WARD NO. 4, VILLAGE XYZ!! "
        expected_en = "construction of c c road in ward no 4 village xyz"
        self.assertEqual(normalize_text(raw_en), expected_en)

        raw_hi = "  ग्राम पंचायत में इंटरलॉकिंग   सड़क निर्माण !! "
        norm_hi = normalize_text(raw_hi)
        self.assertIn("ग्राम", norm_hi)
        self.assertIn("इंटरलॉकिंग", norm_hi)
        self.assertNotIn("!", norm_hi)

        # None / empty handling
        self.assertEqual(normalize_text(None), "")
        self.assertEqual(normalize_text(""), "")

    def test_haversine_distance(self):
        """Verify Haversine distance calculates accurate meters between GPS points."""
        # Shahjahanpur center to a point ~1.1 km away
        lat1, lon1 = 27.8812, 79.9100
        lat2, lon2 = 27.8912, 79.9100
        distance = haversine_distance(lat1, lon1, lat2, lon2)
        self.assertGreater(distance, 1000)
        self.assertLess(distance, 1200)

        # Zero distance
        self.assertAlmostEqual(haversine_distance(lat1, lon1, lat1, lon1), 0.0, places=3)

    def test_exact_duplicate_detection(self):
        """Verify exact text matches are flagged with 1.0 similarity and exact match type."""
        works = [
            {
                "id": 1,
                "work_id": 1001,
                "work_description": "Construction of Solar High Mast Light at Primary School",
                "constituency": "SHAHJAHANPUR",
                "state": "Uttar Pradesh",
                "location": "Primary School Rampur",
                "cost": 250000.0,
                "latitude": 27.8812,
                "longitude": 79.9100,
            },
            {
                "id": 2,
                "work_id": 1002,
                "work_description": "construction of solar high mast light at primary school",
                "constituency": "SHAHJAHANPUR",
                "state": "Uttar Pradesh",
                "location": "Primary School Rampur",
                "cost": 250000.0,
                "latitude": 27.8814,
                "longitude": 79.9102,
            },
        ]
        pairs = self.detector.find_duplicate_pairs(works, threshold=0.85)
        self.assertEqual(len(pairs), 1)
        pair = pairs[0]
        self.assertEqual(pair["is_exact_text"], True)
        self.assertGreaterEqual(pair["text_similarity"], 0.99)
        self.assertGreaterEqual(pair["duplicate_score"], 99)
        self.assertEqual(pair["same_constituency"], True)
        self.assertEqual(pair["same_location"], True)
        self.assertEqual(pair["cost_difference"], 0.0)
        self.assertIsNotNone(pair["geo_distance_meters"])
        self.assertTrue(any("Exact description match" in r for r in pair["reasons"]))
        self.assertTrue(any("Identical location" in r for r in pair["reasons"]))
        self.assertTrue(any("Identical recorded cost" in r for r in pair["reasons"]))

    def test_no_self_comparison_and_no_symmetric_pairs(self):
        """Verify no work is compared to itself and symmetric pairs (B, A) are not returned."""
        works = [
            {"id": 1, "work_id": 101, "work_description": "Construction of Community Hall in Block A"},
            {"id": 2, "work_id": 102, "work_description": "Construction of Community Hall in Block A"},
            {"id": 3, "work_id": 103, "work_description": "Construction of Community Hall in Block A"},
        ]
        pairs = self.detector.find_duplicate_pairs(works, threshold=0.85)
        # With 3 identical items, combinations(3, 2) = 3 unique pairs: (1,2), (1,3), (2,3)
        self.assertEqual(len(pairs), 3)
        for p in pairs:
            # Ensure no self comparison
            self.assertNotEqual(p["work_a_id"], p["work_b_id"])

        # Verify no reverse pair exists
        seen_pairs = set()
        for p in pairs:
            a, b = p["work_a_id"], p["work_b_id"]
            self.assertNotIn((b, a), seen_pairs)
            seen_pairs.add((a, b))

    def test_configurable_threshold(self):
        """Verify threshold filters works appropriately."""
        works = [
            {"id": 1, "work_description": "Construction of paved drainage channel in Sector 14"},
            {"id": 2, "work_description": "Repair and construction of drainage channel in Sector 14"},
            {"id": 3, "work_description": "Installation of deep bore tube well in village farm"},
        ]
        # High threshold (e.g. 0.95) should filter out moderate similarity
        strict_pairs = self.detector.find_duplicate_pairs(works, threshold=0.95)
        self.assertEqual(len(strict_pairs), 0)

        # Moderate threshold (e.g. 0.50) should detect overlap between item 1 and 2
        lenient_pairs = self.detector.find_duplicate_pairs(works, threshold=0.50)
        self.assertEqual(len(lenient_pairs), 1)
        self.assertEqual(lenient_pairs[0]["work_a_id"], 1)
        self.assertEqual(lenient_pairs[0]["work_b_id"], 2)

    def test_missing_fields_graceful_handling(self):
        """Verify detector handles null location, cost, or GPS without error."""
        works = [
            {
                "id": 10,
                "work_description": "Supply of drinking water tank to Government High School",
                "constituency": None,
                "location": None,
                "cost": None,
                "latitude": None,
                "longitude": None,
            },
            {
                "id": 11,
                "work_description": "Supply of drinking water tank to Government High School",
                "constituency": "VARANASI",
                "location": "Ward 2",
                "cost": 150000.0,
                "latitude": None,
                "longitude": None,
            },
        ]
        pairs = self.detector.find_duplicate_pairs(works, threshold=0.85)
        self.assertEqual(len(pairs), 1)
        pair = pairs[0]
        self.assertIsNone(pair["cost_difference"])
        self.assertIsNone(pair["geo_distance_meters"])
        self.assertEqual(pair["same_constituency"], False)
        self.assertGreater(len(pair["reasons"]), 0)

    def test_dataframe_compatibility(self):
        """Verify DataFrame input interface works as expected."""
        df = pd.DataFrame([
            {"id": 1, "work_description": "Construction of Anganwadi Center Building"},
            {"id": 2, "work_description": "Construction of Anganwadi Center Building"},
        ])
        res_df = self.detector.find_duplicates(df, threshold=0.85)
        self.assertIsInstance(res_df, pd.DataFrame)
        self.assertGreaterEqual(len(res_df), 1)
        self.assertEqual(res_df.iloc[0]["is_exact_text"], True)

    def test_find_duplicates_for_target(self):
        """Verify finding duplicates for a single target work against candidate list."""
        target = {"id": 100, "work_id": 9999, "work_description": "Installation of 5 HP Solar Submersible Pump"}
        candidates = [
            {"id": 100, "work_id": 9999, "work_description": "Installation of 5 HP Solar Submersible Pump"},  # Self
            {"id": 101, "work_id": 8888, "work_description": "Installation of 5 HP Solar Submersible Pump for irrigation"},
            {"id": 102, "work_id": 7777, "work_description": "Construction of boundary wall at cremation ground"},
        ]
        matches = self.detector.find_duplicates_for_target(target, candidates, threshold=0.60)
        # Self-match (id 100) must be excluded
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["work_b_id"], 101)


class TestDuplicateServiceAndAPI(unittest.TestCase):
    """Integration tests for Service layer and FastAPI Duplicate Detection routes."""

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Seed test works in a clean test session
        cls.w1 = Work(
            work_id=500001,
            source_id="test_src_01",
            work_description="Construction of CC Road from Main Gate to Panchayat Ghar",
            constituency="SHAHJAHANPUR",
            district="Shahjahanpur",
            state="Uttar Pradesh",
            category="Roads & Bridges",
            location="Village Piprola",
            cost=450000.0,
            mp_name="Test MP",
            source="test_source"
        )
        cls.w2 = Work(
            work_id=500002,
            source_id="test_src_02",
            work_description="Construction of CC Road from Main Gate to Panchayat Ghar",
            constituency="SHAHJAHANPUR",
            district="Shahjahanpur",
            state="Uttar Pradesh",
            category="Roads & Bridges",
            location="Village Piprola",
            cost=450000.0,
            mp_name="Test MP",
            source="test_source"
        )
        cls.w3 = Work(
            work_id=500003,
            source_id="test_src_03",
            work_description="Renovation and painting of community hall building",
            constituency="SHAHJAHANPUR",
            district="Shahjahanpur",
            state="Uttar Pradesh",
            category="Community Hall",
            location="Ward 12",
            cost=120000.0,
            mp_name="Test MP",
            source="test_source"
        )
        cls.db.add_all([cls.w1, cls.w2, cls.w3])
        cls.db.commit()
        cls.db.refresh(cls.w1)
        cls.db.refresh(cls.w2)
        cls.db.refresh(cls.w3)

    @classmethod
    def tearDownClass(cls):
        cls.db.query(Work).filter(Work.source == "test_source").delete()
        cls.db.commit()
        cls.db.close()

    def test_service_scan_duplicates(self):
        """Verify DuplicateService returns properly formatted scan response."""
        service = DuplicateService()
        result = service.scan_duplicates(
            db=self.db,
            constituency="SHAHJAHANPUR",
            min_similarity=0.85
        )
        self.assertGreaterEqual(result["total_works_analyzed"], 2)
        self.assertGreaterEqual(result["duplicate_pairs_found"], 1)
        first_pair = result["pairs"][0]
        self.assertEqual(first_pair["is_exact_text"], True)
        self.assertIn("Exact description match", first_pair["reasons"][0])

    def test_api_get_duplicates(self):
        """Verify GET /api/duplicates endpoint returns 200 OK and expected structure."""
        response = self.client.get("/api/duplicates?constituency=SHAHJAHANPUR&min_similarity=0.85")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total_works_analyzed", data)
        self.assertIn("duplicate_pairs_found", data)
        self.assertIn("pairs", data)
        self.assertGreaterEqual(data["duplicate_pairs_found"], 1)

    def test_api_get_duplicates_for_work(self):
        """Verify GET /api/duplicates/{work_id} endpoint returns matches for single work."""
        response = self.client.get(f"/api/duplicates/{self.w1.work_id}?min_similarity=0.80")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["target_work_id"], str(self.w1.work_id))
        self.assertGreaterEqual(data["matches_found"], 1)
        self.assertEqual(data["matches"][0]["work_b_work_id"], self.w2.work_id)

    def test_api_get_duplicates_for_nonexistent_work(self):
        """Verify GET /api/duplicates/{work_id} returns 404 for missing work."""
        response = self.client.get("/api/duplicates/9999999999")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
