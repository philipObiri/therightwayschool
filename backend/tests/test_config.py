"""
Shared test configuration. All credentials loaded from environment or test_credentials.md.
"""
import os
import sys

API_URL = os.environ.get("TEST_API_URL", "http://localhost:8001/api")

# Test credentials - loaded from env, NEVER hardcoded
TEST_ACCOUNTS = {
    "superadmin": {"email": os.environ.get("TEST_ADMIN_EMAIL", "dwain@tcis.demo"), "password": os.environ.get("TEST_ADMIN_PASS", "admin123")},
    "finance": {"email": os.environ.get("TEST_FINANCE_EMAIL", "finance@tcis.demo"), "password": os.environ.get("TEST_FINANCE_PASS", "finance123")},
    "teacher": {"email": os.environ.get("TEST_TEACHER_EMAIL", "edmund@tcis.demo"), "password": os.environ.get("TEST_TEACHER_PASS", "teacher123")},
    "headteacher": {"email": os.environ.get("TEST_HT_EMAIL", "headteacher@tcis.demo"), "password": os.environ.get("TEST_HT_PASS", "headteacher123")},
    "ceo": {"email": os.environ.get("TEST_CEO_EMAIL", "ceo@tcis.demo"), "password": os.environ.get("TEST_CEO_PASS", "ceo123")},
    "parent": {"email": os.environ.get("TEST_PARENT_EMAIL", "parent@tcis.demo"), "password": os.environ.get("TEST_PARENT_PASS", "parent123")},
}


def get_token(role: str = "superadmin") -> str:
    """Get a JWT token for the given test role by calling the auth endpoint."""
    import requests
    creds = TEST_ACCOUNTS.get(role, TEST_ACCOUNTS["superadmin"])
    resp = requests.post(f"{API_URL}/auth/login", json=creds)
    resp.raise_for_status()
    return resp.json()["token"]


def auth_headers(role: str = "superadmin") -> dict:
    """Return Authorization headers for a test role."""
    return {"Authorization": f"Bearer {get_token(role)}"}
