import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.constituency.service import ConstituencyService
from app.database import SessionLocal
from app.models.work import Work
from app.models.mp_summary import MPFinancialSummary

client = TestClient(app)

def test_get_constituencies_list():
    response = client.get("/api/constituencies?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) > 0
    item = data["items"][0]
    assert "id" in item
    assert "constituency" in item
    assert "state" in item
    assert "allocated_amount" in item
    assert "total_expenditure" in item
    assert "utilization_percentage" in item
    assert "status" in item

def test_search_constituencies():
    response = client.get("/api/constituencies?search=Shahjahanpur")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 1
    found = any("shahjahanpur" in item["id"].lower() for item in data["items"])
    assert found

def test_get_constituency_digital_twin_profile():
    # Fetch Shahjahanpur
    response = client.get("/api/constituencies/shahjahanpur")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "shahjahanpur"
    assert data["constituency"].lower() == "shahjahanpur"
    assert "Uttar Pradesh" in data["state"]
    assert "health" in data
    assert "categories" in data
    assert "agencies" in data
    assert "comparison" in data
    assert "signals" in data
    assert "snapshot" in data
    
    # Check non-accusatory language and zero hallucinated metrics
    assert data["total_works_count"] >= 0
    assert "financial" in data["health"]
    assert "execution" in data["health"]
    assert "development_mix" in data["health"]
    assert "data_quality" in data["health"]

def test_get_constituency_works():
    response = client.get("/api/constituencies/darbhanga/works?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data

def test_get_constituency_signals():
    response = client.get("/api/constituencies/shahjahanpur/signals")
    assert response.status_code == 200
    data = response.json()
    assert "signals" in data
    assert isinstance(data["signals"], list)
    for sig in data["signals"]:
        assert "signal_type" in sig
        assert "severity" in sig
        assert "short_explanation" in sig
        assert "why" in sig or "calculation_methodology" in sig

def test_get_constituency_export():
    response = client.get("/api/constituencies/shahjahanpur/export")
    assert response.status_code == 200
    data = response.json()
    assert data["constituency"].lower() == "shahjahanpur"
    assert "allocated_amount" in data or "total_expenditure" in data
