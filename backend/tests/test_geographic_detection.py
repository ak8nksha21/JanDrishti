import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.models.work import Work
from app.database import SessionLocal, Base, engine
from ml.geo_detection import (
    validate_coordinates,
    classify_proximity_level,
    GeoDetector,
)
from app.services.duplicate import GeoService


class TestGeographicDetectionML(unittest.TestCase):
    """Unit tests for geographic coordinate validation and proximity detection."""

    def setUp(self):
        self.detector = GeoDetector(default_max_distance_meters=500.0)

    def test_coordinate_validation_valid(self):
        """Verify valid Indian coordinates are accepted."""
        # Shahjahanpur, UP
        res = validate_coordinates(27.8812, 79.9100)
        self.assertEqual(res["status"], "valid")
        self.assertTrue(res["is_usable"])
        self.assertAlmostEqual(res["latitude"], 27.8812)
        self.assertAlmostEqual(res["longitude"], 79.9100)

    def test_coordinate_validation_missing(self):
        """Verify missing coordinates remain missing and are not converted to 0,0."""
        res_none = validate_coordinates(None, None)
        self.assertEqual(res_none["status"], "missing")
        self.assertFalse(res_none["is_usable"])
        self.assertIsNone(res_none["latitude"])
        self.assertIsNone(res_none["longitude"])

        res_empty = validate_coordinates("", "")
        self.assertEqual(res_empty["status"], "missing")
        self.assertFalse(res_empty["is_usable"])

    def test_coordinate_validation_null_island(self):
        """Verify (0.0, 0.0) placeholder is flagged as null island anomaly."""
        res = validate_coordinates(0.0, 0.0)
        self.assertEqual(res["status"], "null_island_placeholder")
        self.assertFalse(res["is_usable"])
        self.assertIn("Null Island", res["reason"])

    def test_coordinate_validation_math_out_of_range(self):
        """Verify coordinates exceeding mathematical limits (-90..90, -180..180) are flagged."""
        res_lat = validate_coordinates(95.0, 78.0)
        self.assertEqual(res_lat["status"], "out_of_mathematical_range")
        self.assertFalse(res_lat["is_usable"])

        res_lon = validate_coordinates(25.0, 200.0)
        self.assertEqual(res_lon["status"], "out_of_mathematical_range")
        self.assertFalse(res_lon["is_usable"])

    def test_coordinate_validation_swapped_coordinates(self):
        """Verify swapped latitude/longitude (lat=79.9, lon=27.8) is flagged."""
        res = validate_coordinates(79.9100, 27.8812)
        self.assertEqual(res["status"], "suspected_swapped_coordinates")
        self.assertFalse(res["is_usable"])
        self.assertIn("swapped", res["reason"])

    def test_coordinate_validation_outside_india_bounding_box(self):
        """Verify coordinates outside India (e.g. Paris or London) are flagged."""
        # Paris coordinates
        res = validate_coordinates(48.8566, 2.3522)
        self.assertEqual(res["status"], "outside_india_bounding_box")
        self.assertFalse(res["is_usable"])

    def test_proximity_level_classification(self):
        """Verify distance tiers are correctly classified."""
        self.assertEqual(classify_proximity_level(15.0), "immediate_overlap")
        self.assertEqual(classify_proximity_level(100.0), "same_compound_or_street")
        self.assertEqual(classify_proximity_level(350.0), "nearby_cluster")
        self.assertEqual(classify_proximity_level(800.0), "neighborhood")
        self.assertEqual(classify_proximity_level(2500.0), "same_locality")
        self.assertEqual(classify_proximity_level(10000.0), "distant")

    def test_proximity_alone_does_not_mean_duplicate(self):
        """
        CRITICAL PRINCIPLE:
        Geographically close works with distinct project descriptions must NOT be marked duplicate.
        """
        work_a = {
            "id": 1,
            "work_description": "Construction of Primary School Boundary Wall",
            "constituency": "SHAHJAHANPUR",
            "category": "Education",
            "latitude": 27.8812,
            "longitude": 79.9100,
            "cost": 150000.0
        }
        work_b = {
            "id": 2,
            "work_description": "Installation of Deep Tube Well Handpump for drinking water",
            "constituency": "SHAHJAHANPUR",
            "category": "Drinking Water Facility",
            "latitude": 27.8813,  # ~11 meters away
            "longitude": 79.9100,
            "cost": 65000.0
        }
        pair_res = self.detector.compare_geo_pair(work_a, work_b, max_distance_meters=500.0)
        self.assertIsNotNone(pair_res)
        self.assertLess(pair_res["distance_meters"], 50.0)
        self.assertEqual(pair_res["proximity_level"], "immediate_overlap")
        # Proximity alone must NOT be duplicate
        self.assertFalse(pair_res["is_potential_duplicate"])
        self.assertLess(pair_res["text_similarity"], 0.40)

    def test_proximity_with_high_text_similarity_is_flagged(self):
        """When spatial overlap is combined with high text similarity, flag as potential duplicate."""
        work_a = {
            "id": 1,
            "work_description": "Construction of Solar High Mast Light at Main Chauraha",
            "constituency": "SHAHJAHANPUR",
            "category": "Electricity",
            "latitude": 27.8812,
            "longitude": 79.9100,
            "cost": 250000.0
        }
        work_b = {
            "id": 2,
            "work_description": "Construction of Solar High Mast Light at Main Chauraha",
            "constituency": "SHAHJAHANPUR",
            "category": "Electricity",
            "latitude": 27.8813,  # ~11 meters away
            "longitude": 79.9100,
            "cost": 250000.0
        }
        pair_res = self.detector.compare_geo_pair(work_a, work_b, max_distance_meters=500.0)
        self.assertIsNotNone(pair_res)
        self.assertEqual(pair_res["is_potential_duplicate"], True)
        self.assertGreaterEqual(pair_res["text_similarity"], 0.99)
        self.assertTrue(any("Exact description match" in r for r in pair_res["reasons"]))


class TestGeographicServiceAndAPI(unittest.TestCase):
    """Integration tests for GeoService and FastAPI routes."""

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Seed test works with varying coordinates
        cls.w_valid1 = Work(
            work_id=600001,
            source_id="geo_src_01",
            work_description="Construction of CC Road in Mohalla A",
            constituency="SHAHJAHANPUR",
            state="Uttar Pradesh",
            category="Roads & Bridges",
            latitude=27.8812,
            longitude=79.9100,
            source="test_geo"
        )
        cls.w_valid2 = Work(
            work_id=600002,
            source_id="geo_src_02",
            work_description="Installation of LED Streetlights in Mohalla A",
            constituency="SHAHJAHANPUR",
            state="Uttar Pradesh",
            category="Electricity",
            latitude=27.8815,  # ~33 meters apart
            longitude=79.9100,
            source="test_geo"
        )
        cls.w_null_island = Work(
            work_id=600003,
            source_id="geo_src_03",
            work_description="Sanctioned work with zero coordinates",
            constituency="SHAHJAHANPUR",
            state="Uttar Pradesh",
            latitude=0.0,
            longitude=0.0,
            source="test_geo"
        )
        cls.w_swapped = Work(
            work_id=600004,
            source_id="geo_src_04",
            work_description="Sanctioned work with inverted coordinates",
            constituency="SHAHJAHANPUR",
            state="Uttar Pradesh",
            latitude=79.9100,
            longitude=27.8812,
            source="test_geo"
        )
        cls.w_missing = Work(
            work_id=600005,
            source_id="geo_src_05",
            work_description="Sanctioned work without coordinates",
            constituency="SHAHJAHANPUR",
            state="Uttar Pradesh",
            latitude=None,
            longitude=None,
            source="test_geo"
        )

        cls.db.add_all([
            cls.w_valid1, cls.w_valid2, cls.w_null_island, cls.w_swapped, cls.w_missing
        ])
        cls.db.commit()
        cls.db.refresh(cls.w_valid1)
        cls.db.refresh(cls.w_valid2)
        cls.db.refresh(cls.w_null_island)
        cls.db.refresh(cls.w_swapped)
        cls.db.refresh(cls.w_missing)

    @classmethod
    def tearDownClass(cls):
        cls.db.query(Work).filter(Work.source == "test_geo").delete()
        cls.db.commit()
        cls.db.close()

    def test_service_scan_proximity(self):
        """Verify GeoService returns properly identified proximity pairs."""
        service = GeoService()
        res = service.scan_proximity(
            db=self.db,
            constituency="SHAHJAHANPUR",
            max_distance_meters=200.0
        )
        self.assertGreaterEqual(res["works_with_valid_coordinates"], 2)
        self.assertGreaterEqual(res["pairs_found"], 1)
        first_pair = res["pairs"][0]
        self.assertLess(first_pair["distance_meters"], 50.0)
        self.assertFalse(first_pair["is_potential_duplicate"])

    def test_service_detect_coordinate_anomalies(self):
        """Verify GeoService detects null island and swapped coordinates."""
        service = GeoService()
        res = service.detect_coordinate_anomalies(db=self.db, constituency="SHAHJAHANPUR")
        self.assertGreaterEqual(res["anomalies_detected"], 2)
        statuses = [a["status"] for a in res["anomalies"]]
        self.assertIn("null_island_placeholder", statuses)
        self.assertIn("suspected_swapped_coordinates", statuses)

    def test_api_get_geo_proximity(self):
        """Verify GET /api/geo/proximity endpoint."""
        response = self.client.get("/api/geo/proximity?constituency=SHAHJAHANPUR&max_distance_meters=200")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("works_with_valid_coordinates", data)
        self.assertIn("pairs", data)
        self.assertGreaterEqual(len(data["pairs"]), 1)

    def test_api_get_geo_anomalies(self):
        """Verify GET /api/geo/anomalies endpoint."""
        response = self.client.get("/api/geo/anomalies?constituency=SHAHJAHANPUR")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("anomalies_detected", data)
        self.assertGreaterEqual(data["anomalies_detected"], 2)

    def test_api_get_nearby_for_work(self):
        """Verify GET /api/geo/{work_id}/nearby endpoint."""
        response = self.client.get(f"/api/geo/{self.w_valid1.work_id}/nearby?max_distance_meters=200")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["target_work_id"], str(self.w_valid1.work_id))
        self.assertGreaterEqual(data["nearby_works_count"], 1)
        self.assertEqual(data["nearby_works"][0]["work_b_work_id"], self.w_valid2.work_id)

    def test_api_get_nearby_for_missing_coords_work(self):
        """Verify GET /api/geo/{work_id}/nearby returns clean 0 count with reason for missing coords."""
        response = self.client.get(f"/api/geo/{self.w_missing.work_id}/nearby")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["nearby_works_count"], 0)
        self.assertEqual(data["coordinate_status"], "missing")


if __name__ == "__main__":
    unittest.main()
