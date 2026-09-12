import pytest
from datetime import date
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from ml.trend_analysis import TrendDetector
from app.models.work import Work


@pytest.fixture
def detector():
    return TrendDetector()


@pytest.fixture
def client():
    return TestClient(app)


def test_trend_detector_increasing(detector):
    series = [
        {"period": "Q1 2025", "value": 20.0},
        {"period": "Q2 2025", "value": 30.0},
        {"period": "Q3 2025", "value": 45.0},
    ]
    result = detector.analyze_series(
        metric_name="Sample Metric",
        series=series,
        unit="units",
    )
    assert result["status"] == "available"
    assert result["trend_direction"] == "increasing"
    assert result["current_value"] == 45.0
    assert result["previous_value"] == 30.0
    assert result["change_percentage"] == 50.0
    assert result["linear_slope"] > 0


def test_trend_detector_decreasing(detector):
    series = [
        {"period": "Q1 2025", "value": 100.0},
        {"period": "Q2 2025", "value": 80.0},
        {"period": "Q3 2025", "value": 40.0},
    ]
    result = detector.analyze_series(
        metric_name="Sample Metric",
        series=series,
        unit="units",
    )
    assert result["status"] == "available"
    assert result["trend_direction"] == "decreasing"
    assert result["change_percentage"] == -50.0
    assert result["linear_slope"] < 0


def test_trend_detector_stable(detector):
    series = [
        {"period": "Q1 2025", "value": 50.0},
        {"period": "Q2 2025", "value": 50.5},
        {"period": "Q3 2025", "value": 50.2},
    ]
    result = detector.analyze_series(
        metric_name="Sample Metric",
        series=series,
        unit="units",
    )
    assert result["status"] == "available"
    assert result["trend_direction"] == "stable"


def test_trend_detector_insufficient_data(detector):
    # Single point
    series = [{"period": "Q1 2025", "value": 50.0}]
    result = detector.analyze_series(
        metric_name="Single Point Metric",
        series=series,
        unit="units",
    )
    assert result["status"] == "insufficient_data"
    assert result["trend_direction"] == "insufficient_data"
    assert result["confidence"] == "insufficient_data"


def test_trend_detector_empty_series(detector):
    result = detector.analyze_series(
        metric_name="Empty Metric",
        series=[],
        unit="units",
    )
    assert result["status"] == "insufficient_data"
    assert result["trend_direction"] == "insufficient_data"


def test_trend_detector_financial_snapshot(detector):
    result = detector.analyze_financial_metric(
        metric_name="National Parliamentary Expenditure",
        current_value=3995.34,
        unit="₹ Cr",
    )
    assert result["status"] == "insufficient_data"
    assert result["trend_direction"] == "insufficient_data"
    assert result["current_value"] == 3995.34
    assert result["required_data"] is not None


def test_trend_detector_completion_aggregation(detector):
    mock_works = [
        MagicMock(completion_date=date(2025, 1, 15)),
        MagicMock(completion_date=date(2025, 2, 20)),
        MagicMock(completion_date=date(2025, 5, 10)),
        MagicMock(completion_date=date(2025, 8, 5)),
        MagicMock(completion_date=date(2025, 8, 12)),
    ]
    result = detector.analyze_completion_activity(mock_works)
    assert result["status"] == "available"
    assert result["total_observations"] == 5.0
    assert len(result["historical_series"]) > 0


def test_trend_routes_summary(client):
    response = client.get("/api/trends/summary")
    assert response.status_code == 200
    data = response.json()
    assert "completion_activity" in data
    assert "expenditure_trend" in data
    assert "recommendations_trend" in data
    assert "unspent_balance_trend" in data
    assert data["completion_activity"]["status"] == "available"
    assert data["expenditure_trend"]["status"] == "insufficient_data"


def test_trend_routes_completion(client):
    response = client.get("/api/trends/completion")
    assert response.status_code == 200
    data = response.json()
    assert data["metric"] == "Project Completion Activity"
    assert isinstance(data["historical_series"], list)


def test_trend_routes_financial_valid(client):
    response = client.get("/api/trends/financial/expenditure")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "insufficient_data"
    assert data["metric"] == "National Parliamentary Expenditure"


def test_trend_routes_financial_invalid(client):
    response = client.get("/api/trends/financial/non_existent_metric")
    assert response.status_code == 400
