"""
Pytest conftest - Centralized test fixtures for all test files.

Auth uses httpOnly cookies (rw_token) — sessions carry the cookie automatically.
Bearer-header fixtures still work because get_current_user falls back to
Authorization: Bearer when the cookie is absent (used by API clients / Swagger).
"""
import pytest
import requests
import os

API_URL = os.environ.get("TEST_API_URL", "http://localhost:8001/api")

TEST_CREDS = {
    "superadmin": {"email": os.environ.get("TEST_ADMIN_EMAIL", "dwain@tcis.demo"),     "password": os.environ.get("TEST_ADMIN_PASS",    "admin123")},
    "finance":    {"email": os.environ.get("TEST_FINANCE_EMAIL", "finance@tcis.demo"),  "password": os.environ.get("TEST_FINANCE_PASS",  "finance123")},
    "teacher":    {"email": os.environ.get("TEST_TEACHER_EMAIL", "edmund@tcis.demo"),   "password": os.environ.get("TEST_TEACHER_PASS",  "teacher123")},
    "headteacher":{"email": os.environ.get("TEST_HT_EMAIL",  "headteacher@tcis.demo"), "password": os.environ.get("TEST_HT_PASS",       "headteacher123")},
    "ceo":        {"email": os.environ.get("TEST_CEO_EMAIL",  "ceo@tcis.demo"),         "password": os.environ.get("TEST_CEO_PASS",      "ceo123")},
    "parent":     {"email": os.environ.get("TEST_PARENT_EMAIL", "parent@tcis.demo"),    "password": os.environ.get("TEST_PARENT_PASS",   "parent123")},
}


def _login_session(role: str) -> requests.Session:
    """Return a requests.Session authenticated as *role* via httpOnly cookie."""
    creds = TEST_CREDS.get(role, TEST_CREDS["superadmin"])
    s = requests.Session()
    try:
        resp = s.post(f"{API_URL}/auth/login", json=creds, timeout=10)
        resp.raise_for_status()
    except Exception:
        pass  # Session remains unauthenticated — individual tests will fail with clear errors
    return s


def _get_cookie_value(role: str) -> str:
    """Return the raw JWT from the rw_token cookie (for Bearer header compat)."""
    s = _login_session(role)
    for c in s.cookies:
        if c.name == "rw_token":
            return c.value
    return ""


# ── Session fixtures (preferred — httpOnly cookie auth) ───────────────────────

@pytest.fixture(scope="session")
def api_url():
    return API_URL


@pytest.fixture(scope="session")
def admin_session() -> requests.Session:
    return _login_session("superadmin")


@pytest.fixture(scope="session")
def teacher_session() -> requests.Session:
    return _login_session("teacher")


@pytest.fixture(scope="session")
def finance_session() -> requests.Session:
    return _login_session("finance")


@pytest.fixture(scope="session")
def ceo_session() -> requests.Session:
    return _login_session("ceo")


@pytest.fixture(scope="session")
def parent_session() -> requests.Session:
    return _login_session("parent")


# ── Legacy Bearer-header fixtures (keep for existing tests) ───────────────────

@pytest.fixture(scope="session")
def admin_token():
    return _get_cookie_value("superadmin")


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def teacher_token():
    return _get_cookie_value("teacher")


@pytest.fixture(scope="session")
def teacher_headers(teacher_token):
    return {"Authorization": f"Bearer {teacher_token}"}


@pytest.fixture(scope="session")
def finance_token():
    return _get_cookie_value("finance")


@pytest.fixture(scope="session")
def finance_headers(finance_token):
    return {"Authorization": f"Bearer {finance_token}"}


@pytest.fixture(scope="session")
def ceo_token():
    return _get_cookie_value("ceo")


@pytest.fixture(scope="session")
def ceo_headers(ceo_token):
    return {"Authorization": f"Bearer {ceo_token}"}
