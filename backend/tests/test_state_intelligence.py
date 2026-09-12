import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_states_list():
    response = client.get("/api/states")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "national_summary" in data
    assert data["total"] == 36
    assert len(data["items"]) == 36
    
    first = data["items"][0]
    assert "id" in first
    assert "state" in first
    assert "entity_type" in first
    assert "allocated_amount" in first
    assert "total_expenditure" in first
    assert "utilization_percentage" in first
    assert "status" in first
    assert "mp_count" in first
    assert "total_works" in first

def test_search_states():
    response = client.get("/api/states?search=Uttar Pradesh")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["id"] == "uttar-pradesh"
    assert data["items"][0]["state"] == "Uttar Pradesh"

def test_filter_states_by_region():
    response = client.get("/api/states?region=Union Territory")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) > 0
    for item in data["items"]:
        assert item["entity_type"] == "Union Territory"

def test_filter_states_by_status():
    response = client.get("/api/states?status=Requires Attention")
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["status"] == "Requires Attention"

def test_get_national_summary():
    response = client.get("/api/states/national-summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_states_monitored"] == 36
    assert data["national_utilization_percentage"] > 0
    assert data["total_national_allocation"] > 0
    assert data["total_national_expenditure"] > 0

def test_get_state_profile():
    response = client.get("/api/states/uttar-pradesh")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "uttar-pradesh"
    assert data["state"] == "Uttar Pradesh"
    assert data["entity_type"] == "State"
    assert "categories" in data
    assert "agencies" in data
    assert "benchmarks" in data
    assert "signals" in data
    assert data["allocated_amount"] > 0
    assert data["total_expenditure"] > 0
    assert data["mp_count"] > 0

def test_get_state_signals():
    response = client.get("/api/states/uttar-pradesh/signals")
    assert response.status_code == 200
    data = response.json()
    assert "state" in data
    assert "signals" in data
    assert isinstance(data["signals"], list)

def test_export_state_snapshot():
    response = client.get("/api/states/uttar-pradesh/export")
    assert response.status_code == 200
    data = response.json()
    assert data["state"] == "Uttar Pradesh"
    assert "metrics" in data
    assert "top_categories" in data
    assert "top_agencies" in data
