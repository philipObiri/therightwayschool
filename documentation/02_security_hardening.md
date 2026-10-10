# Security Hardening Guide

**Priority**: CRITICAL — must be completed before any production deployment  
**Last Updated**: 2026-05-23

---

## Critical Issues (Deployment Blockers)

### 1. Default JWT Secret — `auth.py:13`, `ws_manager.py:9`

**Problem**:
```python
JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret')
```
If `JWT_SECRET` is missing from `.env`, the fallback `'default_secret'` is used. Anyone with the source code can forge valid JWT tokens.

**Fix** — fail loudly on startup:
```python
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")
```

---

### 2. Hardcoded Passwords — `auth.py:384-412`, `server.py:260-265`

**Problem**:
```python
'Teacher': 'teacher123'
'Admin': 'admin123'
'Student': 'student123'
# etc.
```

**Fix**: Remove all hardcoded password blocks entirely. Seed initial accounts via a one-time migration script (`scripts/seed_admin.py`) that reads from environment variables.

---

### 3. Password Reset via GET — `auth.py` `GET /fix-passwords`

**Problem**: A GET request resets all user passwords. Can be triggered by URL prefetching, browser bookmarks, search engine crawlers.

**Fix**: Delete the entire `GET /fix-passwords` endpoint. Keep only the POST version and protect it with a superadmin-only check.

---

### 4. No Rate Limiting

**Problem**: Login endpoint has zero protection. 1000 brute-force attempts per second is trivial.

**Fix** — add `slowapi`:
```bash
pip install slowapi
```
```python
# server.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# auth.py
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, ...):
    ...
```

Apply limits:
| Endpoint | Limit |
|----------|-------|
| `POST /auth/login` | 5/minute per IP |
| `POST /auth/register` | 3/minute per IP |
| `POST /ai/*` | 30/minute per user |
| `POST /website/register` | 3/minute per IP |

---

### 5. CORS Wildcard — `server.py`

**Problem**:
```python
allow_origins=["*"]  # default
```

**Fix**:
```python
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "").split(",")
if not CORS_ORIGINS or CORS_ORIGINS == [""]:
    raise RuntimeError("CORS_ORIGINS environment variable is required")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)
```

`.env` example:
```bash
CORS_ORIGINS=https://learnrightschool.com,https://www.learnrightschool.com,http://localhost:3000
```

---

### 6. Weak Password Policy — `auth.py:274`

**Problem**:
```python
if not new_pass or len(new_pass) < 6:
```

**Fix**:
```python
import re

def validate_password(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not re.search(r'[A-Z]', password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r'[0-9]', password):
        raise ValueError("Password must contain at least one number")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        raise ValueError("Password must contain at least one special character")
    return password
```

---

## High Priority Issues

### 7. WebSocket Token in Query Params — `server.py:187`

**Problem**:
```python
token = websocket.query_params.get("token")
```
Token appears in: server access logs, browser history, proxy logs, Nginx logs.

**Fix** — use WebSocket subprotocol header:
```python
# Client sends: Sec-WebSocket-Protocol: token.{jwt_here}
token = None
for protocol in websocket.headers.get("sec-websocket-protocol", "").split(","):
    protocol = protocol.strip()
    if protocol.startswith("token."):
        token = protocol[6:]
        break
```

---

### 8. No MongoDB TTL on Sessions

**Problem**: Sessions in `user_sessions` collection never expire from the database.

**Fix** — add TTL index at startup in `server.py`:
```python
@app.on_event("startup")
async def startup():
    # TTL index: auto-delete sessions after 7 days
    await db.user_sessions.create_index(
        "expires_at",
        expireAfterSeconds=0  # uses the datetime value in the field
    )
```

---

### 9. NoSQL Injection via Regex — `admissions.py:27`

**Problem**:
```python
await db.admissions.count_documents({"created_at": {"$regex": f"^{current_year}"}})
```

**Fix** — use datetime range:
```python
from datetime import datetime, timezone

year_start = datetime(current_year, 1, 1, tzinfo=timezone.utc)
year_end = datetime(current_year + 1, 1, 1, tzinfo=timezone.utc)
await db.admissions.count_documents({
    "created_at": {"$gte": year_start, "$lt": year_end}
})
```

---

### 10. Security Headers Middleware

Create `backend/middleware/security.py`:
```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://accounts.google.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://api.anthropic.com https://generativelanguage.googleapis.com;"
        )
        return response
```

Register in `server.py`:
```python
from backend.middleware.security import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)
```

---

## Hardening Checklist

### Week 1 (Blocking)
- [ ] Fix JWT secret (no fallback)
- [ ] Remove hardcoded passwords
- [ ] Delete GET /fix-passwords
- [ ] Add slowapi rate limiting
- [ ] Fix CORS wildcard
- [ ] Enforce password complexity
- [ ] Add MongoDB TTL index on user_sessions

### Week 2 (High Priority)
- [ ] Add Pydantic models to all routes using `data.get()`
- [ ] Move WebSocket tokens to headers
- [ ] Fix regex date queries → datetime comparisons
- [ ] Add SecurityHeadersMiddleware
- [ ] Add audit log rotation (90 days)

### Week 3 (Medium)
- [ ] Add structured JSON logging (rotating file handlers)
- [ ] Add Redis session storage
- [ ] Security test suite (auth bypass, rate limiting, CORS tests)
- [ ] Remove test credentials from `conftest.py`
