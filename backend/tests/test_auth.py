import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User, UserActivity

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_test_users():
    """Clean up test users before and after test cases."""
    db = SessionLocal()
    try:
        db.query(UserActivity).filter(UserActivity.user_email.like("%@testauth.com")).delete(synchronize_session=False)
        db.query(User).filter(User.email.like("%@testauth.com")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
    yield
    db = SessionLocal()
    try:
        db.query(UserActivity).filter(UserActivity.user_email.like("%@testauth.com")).delete(synchronize_session=False)
        db.query(User).filter(User.email.like("%@testauth.com")).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def test_01_guest_public_access_without_login():
    """Verify that all core JanDrishti endpoints remain 100% publicly accessible without login."""
    endpoints = [
        "/health",
        "/",
        "/api/dashboard",
        "/api/works",
        "/api/mps",
        "/api/risk/summary",
        "/api/geo/proximity"
    ]
    for ep in endpoints:
        resp = client.get(ep)
        assert resp.status_code == 200, f"Expected 200 for guest request to {ep}, got {resp.status_code}"


def test_02_signup_success():
    """Verify signup creates user in database with securely hashed password."""
    payload = {
        "name": "Citizen Investigator",
        "email": "investigator@testauth.com",
        "password": "SecurePassword123!"
    }
    resp = client.post("/api/auth/signup", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert data["user"]["name"] == "Citizen Investigator"
    assert data["user"]["email"] == "investigator@testauth.com"
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]

    # Verify directly in PostgreSQL
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "investigator@testauth.com").first()
        assert user is not None
        assert user.password_hash.startswith("$2b$")
        assert user.password_hash != "SecurePassword123!"
    finally:
        db.close()


def test_03_signup_duplicate_email():
    """Verify that duplicate email registrations are safely rejected."""
    payload = {
        "name": "First User",
        "email": "duplicate@testauth.com",
        "password": "Password123!"
    }
    resp1 = client.post("/api/auth/signup", json=payload)
    assert resp1.status_code == 201

    # Attempt to signup again with same email
    resp2 = client.post("/api/auth/signup", json=payload)
    assert resp2.status_code == 400
    assert "already exists" in resp2.json()["detail"].lower()


def test_04_signup_validation_errors():
    """Verify input validation rules for name, email format, and password length."""
    # Password too short (<8 chars)
    resp_short_pwd = client.post("/api/auth/signup", json={
        "name": "User Short",
        "email": "short@testauth.com",
        "password": "short"
    })
    assert resp_short_pwd.status_code == 422

    # Invalid email format
    resp_invalid_email = client.post("/api/auth/signup", json={
        "name": "User Bad Email",
        "email": "not-an-email",
        "password": "ValidPassword123!"
    })
    assert resp_invalid_email.status_code == 422

    # Blank name
    resp_blank_name = client.post("/api/auth/signup", json={
        "name": "   ",
        "email": "blank@testauth.com",
        "password": "ValidPassword123!"
    })
    assert resp_blank_name.status_code == 400


def test_05_login_success():
    """Verify login authenticates credentials, returns JWT, and updates last_login_at."""
    # Register user first
    signup_resp = client.post("/api/auth/signup", json={
        "name": "Auditor User",
        "email": "auditor@testauth.com",
        "password": "AuditPassword123!"
    })
    assert signup_resp.status_code == 201

    # Log in
    login_resp = client.post("/api/auth/login", json={
        "email": "auditor@testauth.com",
        "password": "AuditPassword123!"
    })
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "auditor@testauth.com"
    assert data["user"]["last_login_at"] is not None


def test_06_login_invalid_credentials():
    """Verify login rejects wrong password and unregistered emails."""
    # Register user
    client.post("/api/auth/signup", json={
        "name": "Existing User",
        "email": "existing@testauth.com",
        "password": "CorrectPassword123!"
    })

    # Wrong password
    resp_wrong_pwd = client.post("/api/auth/login", json={
        "email": "existing@testauth.com",
        "password": "WrongPassword!"
    })
    assert resp_wrong_pwd.status_code == 401

    # Non-existent email
    resp_unknown = client.post("/api/auth/login", json={
        "email": "unknown@testauth.com",
        "password": "CorrectPassword123!"
    })
    assert resp_unknown.status_code == 401


def test_07_current_user_me():
    """Verify /auth/me and /api/auth/me return authenticated user profile and reject unauthenticated requests."""
    signup_resp = client.post("/api/auth/signup", json={
        "name": "Profile Tester",
        "email": "profile@testauth.com",
        "password": "ProfilePassword123!"
    })
    token = signup_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Test /api/auth/me
    resp_api_me = client.get("/api/auth/me", headers=headers)
    assert resp_api_me.status_code == 200
    assert resp_api_me.json()["email"] == "profile@testauth.com"
    assert resp_api_me.json()["name"] == "Profile Tester"

    # Test alias /auth/me
    resp_me = client.get("/auth/me", headers=headers)
    assert resp_me.status_code == 200
    assert resp_me.json()["email"] == "profile@testauth.com"

    # Unauthenticated /auth/me should return 401
    resp_unauth = client.get("/api/auth/me")
    assert resp_unauth.status_code == 401

    # Invalid token /auth/me should return 401
    resp_invalid = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.value"})
    assert resp_invalid.status_code == 401


def test_08_authenticated_access_to_public_endpoints():
    """
    CRITICAL: Verify authenticated users receive identical public data
    without any interference from authentication layer.
    """
    signup_resp = client.post("/api/auth/signup", json={
        "name": "Access Tester",
        "email": "access@testauth.com",
        "password": "AccessPassword123!"
    })
    token = signup_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Public endpoint responses with auth header
    endpoints = ["/api/dashboard", "/api/works", "/api/mps"]
    for ep in endpoints:
        guest_resp = client.get(ep)
        auth_resp = client.get(ep, headers=headers)
        assert guest_resp.status_code == 200
        assert auth_resp.status_code == 200
        assert guest_resp.json() == auth_resp.json(), f"Data mismatch between guest and auth on {ep}"


def test_09_logout():
    """Verify logout endpoint returns success message."""
    resp = client.post("/api/auth/logout")
    assert resp.status_code == 200
    assert "logged out" in resp.json()["message"].lower()

    # Also check /auth/logout alias
    resp_alias = client.post("/auth/logout")
    assert resp_alias.status_code == 200


def test_10_user_activity_recording():
    """Verify activity events are recorded in PostgreSQL for authenticated actions."""
    signup_resp = client.post("/api/auth/signup", json={
        "name": "Activity Tracker",
        "email": "activity@testauth.com",
        "password": "ActivityPassword123!"
    })
    token = signup_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Query activity
    act_resp = client.get("/api/auth/activity", headers=headers)
    assert act_resp.status_code == 200
    activities = act_resp.json()
    assert len(activities) >= 1
    actions = [a["action"] for a in activities]
    assert "user_signup" in actions
