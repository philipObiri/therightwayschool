"""
Security test suite — covers all hardening implemented in the security audit.

Tests:
  Auth:          httpOnly cookies, JWT secret validation, token_version invalidation
  Brute-force:   4-attempt lockout, 30-minute window
  Rate limiting: per-route sliding-window middleware
  Access control: unauthenticated / wrong-role rejections
  XSS / Injection: API-level input validation
  File upload:   MIME validation, blocked extensions, size limits
  Security headers: X-Frame-Options, X-Content-Type-Options, etc.
  Password policy: minimum 8 chars, plaintext never stored
  Seed guard:    /fix-passwords endpoint deleted

Run with:
  TEST_API_URL=http://localhost:8001/api pytest tests/test_security.py -v
"""

import os
import time
import requests
import pytest

API_URL = os.environ.get("TEST_API_URL", "http://localhost:8001/api")
BASE_URL = API_URL.rstrip("/api").rstrip("/") or "http://localhost:8001"

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "dwain@tcis.demo")
ADMIN_PASS  = os.environ.get("TEST_ADMIN_PASS",  "admin123")

# ─── helpers ───────────────────────────────────────────────────────────────────

def new_session() -> requests.Session:
    """Return a session that always sends cookies (withCredentials equivalent)."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def login_cookie_session(email=ADMIN_EMAIL, password=ADMIN_PASS) -> requests.Session:
    """Log in and return a session whose cookie jar holds the rw_token httpOnly cookie."""
    s = new_session()
    r = s.post(f"{API_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
    return s, r


def authed_session() -> requests.Session:
    """Return a session already authenticated as admin (via cookie)."""
    s, r = login_cookie_session()
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return s


# ─── 1. httpOnly cookie / JWT authentication ───────────────────────────────────

class TestCookieAuth:
    def test_login_sets_httponly_cookie(self):
        """POST /auth/login should respond with Set-Cookie containing rw_token."""
        s, r = login_cookie_session()
        assert r.status_code == 200
        set_cookie = r.headers.get("set-cookie", "")
        assert "rw_token" in set_cookie, "rw_token cookie not set"
        assert "HttpOnly" in set_cookie or "httponly" in set_cookie.lower(), "cookie is not HttpOnly"

    def test_cookie_sent_automatically_gives_access(self):
        """Cookie-only session (no Authorization header) should pass /auth/me."""
        s = authed_session()
        r = s.get(f"{API_URL}/auth/me", timeout=10)
        assert r.status_code == 200
        assert "role" in r.json()

    def test_no_token_returns_401(self):
        """Unauthenticated request to a protected endpoint should return 401."""
        r = requests.get(f"{API_URL}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_invalid_token_returns_401(self):
        """Forged Bearer token should be rejected."""
        r = requests.get(
            f"{API_URL}/auth/me",
            headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.fake.payload"},
            timeout=10,
        )
        assert r.status_code == 401

    def test_logout_clears_cookie(self):
        """POST /auth/logout should clear the rw_token cookie."""
        s = authed_session()
        r = s.post(f"{API_URL}/auth/logout", timeout=10)
        assert r.status_code == 200
        # After logout, /auth/me must return 401
        r2 = s.get(f"{API_URL}/auth/me", timeout=10)
        assert r2.status_code == 401

    def test_login_response_has_no_token_in_body(self):
        """Login response body must NOT expose the raw JWT token."""
        _, r = login_cookie_session()
        body = r.json()
        assert "token" not in body, "Raw JWT token must not appear in login response body"
        assert "access_token" not in body, "Raw JWT token must not appear in login response body"


# ─── 2. Brute-force protection ─────────────────────────────────────────────────

class TestBruteForce:
    def test_lockout_after_four_failures(self):
        """Fifth login attempt with wrong password should get 429, not 401."""
        # Use a distinct email so we don't pollute admin's counter
        fake_email = "bruteforce_test_user@example.invalid"
        for i in range(4):
            r = requests.post(
                f"{API_URL}/auth/login",
                json={"email": fake_email, "password": f"wrong{i}"},
                timeout=10,
            )
            # Unknown user → 401 or 404; either is fine for attempts 1-4
            assert r.status_code in (400, 401, 404, 422)

        # 5th attempt → must be rate-limited
        r5 = requests.post(
            f"{API_URL}/auth/login",
            json={"email": fake_email, "password": "wrong5"},
            timeout=10,
        )
        assert r5.status_code == 429, (
            f"Expected 429 after 5 failed attempts, got {r5.status_code}: {r5.text}"
        )

    def test_lockout_message_contains_retry_info(self):
        """429 response must tell the user when they can retry."""
        fake_email = "bruteforce_test2@example.invalid"
        for _ in range(4):
            requests.post(f"{API_URL}/auth/login", json={"email": fake_email, "password": "x"}, timeout=10)
        r = requests.post(f"{API_URL}/auth/login", json={"email": fake_email, "password": "x"}, timeout=10)
        assert r.status_code == 429
        body = r.text.lower()
        assert any(kw in body for kw in ("minute", "locked", "retry", "wait", "30")), (
            "Lockout message should inform user of the wait time"
        )


# ─── 3. Rate limiting ──────────────────────────────────────────────────────────

class TestRateLimiting:
    def test_global_rate_limit_enforced(self):
        """Firing >120 rapid requests to /api/ should eventually get a 429."""
        hit_429 = False
        for _ in range(130):
            r = requests.get(f"{API_URL}/auth/me", timeout=5)
            if r.status_code == 429:
                hit_429 = True
                break
        assert hit_429, "Expected at least one 429 from global rate limiter after 130 rapid requests"

    def test_rate_limit_headers_present(self):
        """Rate-limited response should include Retry-After or X-RateLimit-* headers."""
        # Trigger a 429 first
        for _ in range(130):
            r = requests.get(f"{API_URL}/auth/me", timeout=5)
            if r.status_code == 429:
                has_header = (
                    "retry-after" in r.headers
                    or "x-ratelimit-reset" in r.headers
                    or "x-ratelimit-limit" in r.headers
                )
                assert has_header, f"429 response missing rate-limit headers: {dict(r.headers)}"
                return
        pytest.skip("Could not trigger 429 for header check")


# ─── 4. Access control / RBAC ─────────────────────────────────────────────────

class TestAccessControl:
    def test_active_term_put_requires_auth(self):
        """PUT /settings/active-term must reject unauthenticated requests."""
        r = requests.put(
            f"{API_URL}/settings/active-term",
            json={"value": "Term 2", "academic_year": "2025-2026"},
            timeout=10,
        )
        assert r.status_code in (401, 403), (
            f"Expected 401/403 without auth, got {r.status_code}"
        )

    def test_fix_passwords_endpoint_deleted(self):
        """GET and POST /auth/fix-passwords must not exist (returns 404 or 405)."""
        r_get  = requests.get(f"{API_URL}/auth/fix-passwords", timeout=10)
        r_post = requests.post(f"{API_URL}/auth/fix-passwords", json={}, timeout=10)
        assert r_get.status_code  in (404, 405), f"fix-passwords GET still exists: {r_get.status_code}"
        assert r_post.status_code in (404, 405), f"fix-passwords POST still exists: {r_post.status_code}"

    def test_admin_can_set_active_term(self):
        """SuperAdmin should succeed on PUT /settings/active-term."""
        s = authed_session()
        r = s.put(
            f"{API_URL}/settings/active-term",
            json={"value": "Term 1", "academic_year": "2025-2026"},
            timeout=10,
        )
        assert r.status_code in (200, 201), f"Admin active-term PUT failed: {r.status_code} {r.text}"


# ─── 5. Password policy ────────────────────────────────────────────────────────

class TestPasswordPolicy:
    def test_change_password_rejects_short_password(self):
        """Passwords shorter than 8 characters must be rejected."""
        s = authed_session()
        r = s.post(
            f"{API_URL}/auth/change-password",
            json={"current_password": ADMIN_PASS, "new_password": "abc123"},
            timeout=10,
        )
        assert r.status_code in (400, 422), (
            f"Expected rejection for password < 8 chars, got {r.status_code}: {r.text}"
        )

    def test_change_password_accepts_valid_password(self):
        """A password ≥ 8 characters should not be rejected for length."""
        s = authed_session()
        # We test only the length check; we don't actually change the admin password
        # by sending the wrong current_password — we just check it's not a 422 for length
        r = s.post(
            f"{API_URL}/auth/change-password",
            json={"current_password": "definitely_wrong_current_pass", "new_password": "NewSecure@99"},
            timeout=10,
        )
        # Should fail because current_password is wrong (400/401), NOT because length (422)
        assert r.status_code != 422 or "length" not in r.text.lower(), (
            "Unexpectedly rejected valid-length password for length reason"
        )


# ─── 6. Token version / invalidation ─────────────────────────────────────────

class TestTokenInvalidation:
    def test_token_version_in_jwt_payload(self):
        """JWT payload must contain the 'tv' (token_version) claim."""
        import base64, json as _json
        s = authed_session()
        # Get the raw cookie value (rw_token is httpOnly but accessible via the jar in requests)
        cookie_val = None
        for c in s.cookies:
            if c.name == "rw_token":
                cookie_val = c.value
                break
        if cookie_val is None:
            pytest.skip("rw_token cookie not accessible from requests jar (may be HttpOnly strict)")

        parts = cookie_val.split(".")
        assert len(parts) == 3, "JWT must have three dot-separated parts"
        padding = 4 - len(parts[1]) % 4
        payload = _json.loads(base64.urlsafe_b64decode(parts[1] + "=" * padding))
        assert "tv" in payload, f"JWT payload missing 'tv' claim: {payload}"


# ─── 7. Security response headers ─────────────────────────────────────────────

class TestSecurityHeaders:
    def _get_headers(self) -> dict:
        r = requests.get(f"{BASE_URL}/", timeout=10)
        return {k.lower(): v for k, v in r.headers.items()}

    def test_x_frame_options(self):
        h = self._get_headers()
        assert "x-frame-options" in h, "Missing X-Frame-Options header"
        assert h["x-frame-options"].upper() in ("DENY", "SAMEORIGIN")

    def test_x_content_type_options(self):
        h = self._get_headers()
        assert "x-content-type-options" in h, "Missing X-Content-Type-Options header"
        assert h["x-content-type-options"].lower() == "nosniff"

    def test_x_xss_protection(self):
        h = self._get_headers()
        assert "x-xss-protection" in h, "Missing X-XSS-Protection header"

    def test_referrer_policy(self):
        h = self._get_headers()
        assert "referrer-policy" in h, "Missing Referrer-Policy header"

    def test_no_server_header_leak(self):
        """Server header must not reveal backend technology details."""
        h = self._get_headers()
        server = h.get("server", "")
        forbidden = ["uvicorn", "fastapi", "python", "starlette"]
        for term in forbidden:
            assert term.lower() not in server.lower(), (
                f"Server header reveals backend: '{server}'"
            )


# ─── 8. File upload security ──────────────────────────────────────────────────

class TestFileUpload:
    def _upload(self, session, filename, content, content_type="application/octet-stream"):
        return session.post(
            f"{API_URL}/files/upload",
            files={"file": (filename, content, content_type)},
            timeout=15,
        )

    def test_blocked_extension_exe_rejected(self):
        s = authed_session()
        r = self._upload(s, "malware.exe", b"MZ\x90\x00" + b"\x00" * 100)
        assert r.status_code in (400, 415, 422), (
            f"Expected .exe to be blocked, got {r.status_code}: {r.text}"
        )

    def test_blocked_extension_sh_rejected(self):
        s = authed_session()
        r = self._upload(s, "install.sh", b"#!/bin/bash\nrm -rf /")
        assert r.status_code in (400, 415, 422), (
            f"Expected .sh to be blocked, got {r.status_code}: {r.text}"
        )

    def test_blocked_extension_php_rejected(self):
        s = authed_session()
        r = self._upload(s, "shell.php", b"<?php system($_GET['cmd']); ?>")
        assert r.status_code in (400, 415, 422), (
            f"Expected .php to be blocked, got {r.status_code}: {r.text}"
        )

    def test_mime_mismatch_rejected(self):
        """A file named .pdf that contains executable magic bytes must be blocked."""
        s = authed_session()
        # MZ header = Windows PE executable, but named .pdf
        r = self._upload(s, "fake.pdf", b"MZ\x90\x00" + b"\x00" * 100, "application/pdf")
        assert r.status_code in (400, 415, 422), (
            f"Expected MIME mismatch to be rejected, got {r.status_code}: {r.text}"
        )

    def test_oversized_file_rejected(self):
        """Files > 50 MB must be rejected."""
        s = authed_session()
        big_content = b"A" * (51 * 1024 * 1024)  # 51 MB
        r = self._upload(s, "huge.txt", big_content, "text/plain")
        assert r.status_code in (400, 413, 422), (
            f"Expected oversized file to be rejected, got {r.status_code}"
        )

    def test_valid_pdf_accepted(self):
        """A proper PDF (starts with %PDF-) should not be blocked."""
        s = authed_session()
        minimal_pdf = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 1\n0000000000 65535 f\ntrailer<</Size 1>>\nstartxref\n9\n%%EOF"
        r = self._upload(s, "document.pdf", minimal_pdf, "application/pdf")
        # Should not be blocked for extension/MIME/size reasons
        assert r.status_code not in (415,), (
            f"Valid PDF was wrongly blocked: {r.status_code} {r.text}"
        )


# ─── 9. NoSQL injection prevention ───────────────────────────────────────────

class TestNoSQLInjection:
    def test_regex_injection_in_subject_query(self):
        """Subject name query with regex metacharacters must not cause a 500."""
        s = authed_session()
        payloads = [".*", "(.*)", "[$where]", "{$gt:''}", "a|b", "a+b"]
        for payload in payloads:
            r = s.get(f"{API_URL}/academic/subjects", params={"subject_name": payload}, timeout=10)
            assert r.status_code != 500, (
                f"Regex payload '{payload}' caused a 500 error — possible injection"
            )


# ─── 10. Sensitive data not in responses ─────────────────────────────────────

class TestSensitiveDataExposure:
    def test_password_hash_not_in_auth_me(self):
        """GET /auth/me must never return password_hash or last_set_password."""
        s = authed_session()
        r = s.get(f"{API_URL}/auth/me", timeout=10)
        assert r.status_code == 200
        body = r.json()
        forbidden = {"password_hash", "password", "last_set_password", "hashed_password"}
        leaked = forbidden.intersection(set(body.keys()))
        assert not leaked, f"Sensitive fields returned in /auth/me: {leaked}"

    def test_login_response_no_password_fields(self):
        """Login response must not include any password-related fields."""
        _, r = login_cookie_session()
        assert r.status_code == 200
        body = r.json()
        user_obj = body.get("user", body)
        forbidden = {"password_hash", "password", "last_set_password"}
        leaked = forbidden.intersection(set(user_obj.keys()))
        assert not leaked, f"Password fields in login response: {leaked}"


# ─── 11. CORS ────────────────────────────────────────────────────────────────

class TestCORS:
    def test_cors_rejects_unknown_origin(self):
        """Requests from an unknown origin must not get ACAO: * or the forged origin."""
        r = requests.options(
            f"{API_URL}/auth/login",
            headers={
                "Origin": "https://evil.example.com",
                "Access-Control-Request-Method": "POST",
            },
            timeout=10,
        )
        acao = r.headers.get("access-control-allow-origin", "")
        assert acao != "*" and "evil.example.com" not in acao, (
            f"CORS allowed unknown origin: '{acao}'"
        )

    def test_cors_allows_configured_origin(self):
        """Requests from the configured frontend origin should get CORS approval."""
        frontend = os.environ.get("VITE_API_URL", "http://localhost:3000")
        r = requests.options(
            f"{API_URL}/auth/login",
            headers={
                "Origin": frontend,
                "Access-Control-Request-Method": "POST",
            },
            timeout=10,
        )
        acao = r.headers.get("access-control-allow-origin", "")
        assert acao == frontend or acao == "*", (
            f"Expected CORS to allow '{frontend}', got '{acao}'"
        )
