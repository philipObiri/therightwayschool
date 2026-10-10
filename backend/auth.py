from fastapi import APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from database import db
from models import UserCreate, UserLogin, UserResponse, TokenResponse, AuthResponse, SessionExchange, gen_id
import bcrypt as _bcrypt
from jose import jwt, JWTError
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import threading
import httpx
import os
import logging

logger = logging.getLogger(__name__)

# ── JWT config ────────────────────────────────────────────────────────────────
_raw_secret = os.environ.get('JWT_SECRET', '')
if not _raw_secret or len(_raw_secret) < 32:
    raise RuntimeError(
        "JWT_SECRET must be set to a random string of at least 32 characters. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )
JWT_SECRET = _raw_secret
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 8   # One school workday; tokens are invalidated on password change via token_version

COOKIE_NAME = "rw_token"

# ── Brute-force lockout (in-memory, per IP) ──────────────────────────────────
# 4 failed attempts → locked for 30 minutes
MAX_ATTEMPTS = 4
LOCKOUT_SECONDS = 30 * 60  # 30 minutes

_login_attempts: dict[str, list] = defaultdict(list)  # ip → [datetime, ...]
_lockout_until: dict[str, datetime] = {}               # ip → unlock_datetime
_bf_lock = threading.Lock()

def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def _check_lockout(ip: str):
    """Raise 429 if IP is currently locked out."""
    with _bf_lock:
        until = _lockout_until.get(ip)
        if until and datetime.now(timezone.utc) < until:
            remaining = int((until - datetime.now(timezone.utc)).total_seconds() // 60) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed login attempts. Account locked. Try again in {remaining} minute(s).",
                headers={"Retry-After": str(int((until - datetime.now(timezone.utc)).total_seconds()))},
            )
        # Clear expired lockout
        if until and datetime.now(timezone.utc) >= until:
            _lockout_until.pop(ip, None)
            _login_attempts.pop(ip, None)

def _record_failed(ip: str):
    """Record a failed attempt; lock out after MAX_ATTEMPTS."""
    with _bf_lock:
        now = datetime.now(timezone.utc)
        # Keep only attempts within the lockout window
        window = timedelta(seconds=LOCKOUT_SECONDS)
        _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < window]
        _login_attempts[ip].append(now)
        if len(_login_attempts[ip]) >= MAX_ATTEMPTS:
            _lockout_until[ip] = now + timedelta(seconds=LOCKOUT_SECONDS)
            _login_attempts.pop(ip, None)

def _clear_attempts(ip: str):
    """Clear failed attempts after a successful login."""
    with _bf_lock:
        _login_attempts.pop(ip, None)
        _lockout_until.pop(ip, None)


router = APIRouter(prefix="/api/auth", tags=["auth"])


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_token(user_id: str, role: str, token_version: int = 1) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "tv": token_version,   # token_version — incremented on password change to invalidate old tokens
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def _set_auth_cookie(response: Response, token: str):
    """Attach the JWT as an httpOnly, Secure, SameSite=Strict cookie."""
    is_prod = os.environ.get('ENVIRONMENT', 'development') == 'production'
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_prod,       # Secure=True in production (HTTPS required)
        samesite="strict",    # Blocks all cross-site requests — CSRF mitigation
        path="/",
        max_age=JWT_EXPIRY_HOURS * 3600,
    )

def _clear_auth_cookie(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")


async def get_current_user(request: Request) -> dict:
    """
    Extract authenticated user from:
      1. httpOnly cookie  rw_token  (primary — browser requests)
      2. Authorization: Bearer <token>  (fallback — Swagger / API clients)
      3. session_token cookie  (Google OAuth sessions)
    The legacy ?token= query param is no longer accepted (security risk).
    """
    token = None

    # 1. httpOnly cookie (primary for browser)
    token = request.cookies.get(COOKIE_NAME)

    # 2. Authorization header (Swagger / mobile / API)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    # 3. Google OAuth session cookie
    if not token:
        token = request.cookies.get("session_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Try JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="Account disabled")

        # token_version check — invalidates tokens after password change
        db_tv = user.get("token_version", 1)
        jwt_tv = payload.get("tv", 1)
        if jwt_tv != db_tv:
            raise HTTPException(status_code=401, detail="Token invalidated — please log in again")

        # Update last_active (rate-limited to once per 2 minutes)
        now = datetime.now(timezone.utc).isoformat()
        last = user.get("last_active", "")
        if not last or now > (datetime.fromisoformat(last.replace('Z', '+00:00')) + timedelta(minutes=2)).isoformat():
            await db.users.update_one({"user_id": user_id}, {"$set": {"last_active": now}})
        return user
    except JWTError:
        pass

    # Try Google OAuth session token
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles):
    """Dependency factory for role-based access control. CEO/Founder get Admin-equivalent access."""
    ADMIN_EQUIVALENT = {"CEO", "Founder"}
    expanded_roles = set(roles)
    if "Admin" in expanded_roles or "SuperAdmin" in expanded_roles:
        expanded_roles.update(ADMIN_EQUIVALENT)
    async def check_role(user: dict = Depends(get_current_user)):
        user_role = user.get("role", "")
        user_roles = set(user.get("roles", []))
        user_roles.add(user_role)
        if "CEO" in user_roles:
            return user
        if user_roles & expanded_roles:
            return user
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return check_role


async def log_audit(user_id, user_name: str, action: str, entity_type: str, entity_id: str = "", details: dict = None):
    """Log an audit trail entry."""
    await db.audit_logs.insert_one({
        "log_id": gen_id("log_"),
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse)
async def register(data: UserCreate, response: Response):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = gen_id("user_")
    user_doc = {
        "user_id": user_id,
        "email": data.email,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "role": data.role,
        "picture": "",
        "phone": data.phone,
        "department": data.department,
        "is_active": True,
        "token_version": 1,
        "password_change_required": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, data.role, token_version=1)
    _set_auth_cookie(response, token)

    await log_audit(user_id, data.name, "register", "user", user_id)

    user_resp = {k: v for k, v in user_doc.items() if k not in ("password_hash", "_id")}
    return AuthResponse(user=UserResponse(**user_resp))


@router.post("/login")
async def login(data: UserLogin, request: Request, response: Response):
    ip = _get_client_ip(request)

    # Brute-force check — raises 429 if IP is locked out
    _check_lockout(ip)

    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        _record_failed(ip)
        await log_audit(None, data.email, "login_failed", "auth", data.email, {"reason": "user_not_found", "ip": ip})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Please use Google login for this account")

    if not verify_password(data.password, user["password_hash"]):
        _record_failed(ip)
        await log_audit(user["user_id"], user["name"], "login_failed", "auth", user["user_id"], {"reason": "wrong_password", "ip": ip})
        # Tell the user how many attempts remain before lockout
        with _bf_lock:
            attempts_left = MAX_ATTEMPTS - len(_login_attempts.get(ip, []))
        detail = "Invalid credentials"
        if 0 < attempts_left <= 2:
            detail = f"Invalid credentials. {attempts_left} attempt(s) remaining before 30-minute lockout."
        raise HTTPException(status_code=401, detail=detail)

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account disabled")

    # Successful login — clear failed attempts
    _clear_attempts(ip)

    tv = user.get("token_version", 1)
    token = create_token(user["user_id"], user["role"], token_version=tv)
    _set_auth_cookie(response, token)
    await log_audit(user["user_id"], user["name"], "login", "user", user["user_id"])

    user_resp = {k: v for k, v in user.items() if k not in ("password_hash", "last_set_password")}
    return {"user": user_resp}


@router.post("/session", response_model=AuthResponse)
async def exchange_session(data: SessionExchange, response: Response):
    """Exchange a Google ID token (credential) for a RightWay JWT.

    The frontend must pass the raw Google credential returned by the
    Google Identity Services library (accounts.google.com/gsi/client).
    Set GOOGLE_CLIENT_ID in the environment to validate the audience.
    """
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID is not configured on the server")

    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        idinfo = google_id_token.verify_oauth2_token(
            data.session_id,          # frontend sends the Google credential here
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        logger.warning("Google token verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid Google token")
    except Exception as e:
        logger.error("Auth error: %s", e)
        raise HTTPException(status_code=502, detail="Authentication failed")

    email = idinfo.get("email")
    name = idinfo.get("name", "")
    picture = idinfo.get("picture", "")
    session_token = idinfo.get("jti", "")  # Google's token ID as a session identifier

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
        role = existing.get("role", "Student")
        tv = existing.get("token_version", 1)
    else:
        user_id = gen_id("user_")
        role = "Student"
        tv = 1
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": role,
            "password_hash": "",
            "phone": "",
            "department": "",
            "is_active": True,
            "token_version": 1,
            "password_change_required": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    # Store OAuth session
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    is_prod = os.environ.get('ENVIRONMENT', 'development') == 'production'
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=is_prod,
        samesite="strict" if is_prod else "lax",
        path="/",
        max_age=7 * 24 * 3600
    )

    token = create_token(user_id, role, token_version=tv)
    _set_auth_cookie(response, token)
    await log_audit(user_id, name, "google_login", "user", user_id)

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user_resp = {k: v for k, v in user.items() if k not in ("password_hash", "last_set_password")}
    return AuthResponse(user=UserResponse(**user_resp))


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password_hash"}


@router.post("/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    _clear_auth_cookie(response)
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}


@router.post("/change-password")
async def change_password(data: dict, user: dict = Depends(get_current_user), response: Response = None):
    current = data.get("current_password", "")
    new_pass = data.get("new_password", "")
    if not new_pass or len(new_pass) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if user_doc.get("password_hash") and current:
        if not verify_password(current, user_doc["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Increment token_version to invalidate all existing tokens
    new_tv = (user_doc.get("token_version", 1) or 1) + 1
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "password_hash": hash_password(new_pass),
            "token_version": new_tv,
            "password_changed_at": datetime.now(timezone.utc).isoformat(),
            "password_change_required": False,
        }}
    )
    await log_audit(user["user_id"], user["name"], "change_password", "user", user["user_id"])

    # Issue a fresh cookie with new token_version
    if response:
        new_token = create_token(user["user_id"], user["role"], token_version=new_tv)
        _set_auth_cookie(response, new_token)
        return {"message": "Password changed successfully"}
    return {"message": "Password changed successfully"}


@router.post("/reset-password/{user_id}")
async def reset_password(user_id: str, data: dict = None, user: dict = Depends(require_roles("SuperAdmin", "CEO", "Admin"))):
    """SuperAdmin resets a user's password."""
    data = data or {}
    new_pass = data.get("new_password", "")
    if not new_pass or len(new_pass) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "token_version": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    new_tv = (target.get("token_version", 1) or 1) + 1
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "password_hash": hash_password(new_pass),
            "token_version": new_tv,
            "password_changed_at": datetime.now(timezone.utc).isoformat(),
            "password_change_required": True,
        }}
    )
    await log_audit(user["user_id"], user["name"], "reset_password", "user", user_id)
    return {"message": "Password reset successfully"}


@router.get("/users", response_model=list)
async def list_users(
    role: str = None,
    user: dict = Depends(require_roles("SuperAdmin", "Admin"))
):
    query = {}
    if role:
        query["role"] = role
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(1000)
    return users


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    updates: dict,
    user: dict = Depends(get_current_user)
):
    is_admin = user.get("role") in ("SuperAdmin", "Admin", "CEO")
    is_self = user.get("user_id") == user_id
    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Not authorized")

    if is_self and not is_admin:
        safe_fields = {"name", "phone"}
    else:
        safe_fields = {"name", "role", "roles", "phone", "department", "is_active", "picture", "children_ids", "teaching_subjects", "assigned_year_groups"}

    update_data = {k: v for k, v in updates.items() if k in safe_fields}
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    result = await db.users.update_one({"user_id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    await log_audit(user["user_id"], user["name"], "update_user", "user", user_id, update_data)
    return {"message": "User updated"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(get_current_user)):
    """Delete a single user account (management roles only). Cannot self-delete."""
    if user.get("role") not in ("SuperAdmin", "Admin", "CEO", "Founder", "Principal"):
        raise HTTPException(status_code=403, detail="Not authorized to delete users")
    if user.get("user_id") == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1, "role": 1, "email": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.delete_one({"user_id": user_id})
    await log_audit(user["user_id"], user["name"], "delete_user", "user", user_id, target)
    return {"message": f"Deleted {target.get('name')} ({target.get('email')})"}


@router.post("/users/bulk-delete")
async def bulk_delete_users(payload: dict, user: dict = Depends(get_current_user)):
    """Delete multiple user accounts at once. Payload: { user_ids: [...] }"""
    if user.get("role") not in ("SuperAdmin", "Admin", "CEO", "Founder", "Principal"):
        raise HTTPException(status_code=403, detail="Not authorized to delete users")
    user_ids = payload.get("user_ids") or []
    if not isinstance(user_ids, list) or not user_ids:
        raise HTTPException(status_code=400, detail="user_ids must be a non-empty list")
    user_ids = [uid for uid in user_ids if uid != user.get("user_id")]
    if not user_ids:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    targets = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1}).to_list(1000)
    result = await db.users.delete_many({"user_id": {"$in": user_ids}})
    await log_audit(user["user_id"], user["name"], "bulk_delete_users", "user", ",".join(user_ids), {"count": result.deleted_count, "targets": targets})
    return {"message": f"Deleted {result.deleted_count} account(s)", "deleted_count": result.deleted_count, "deleted": targets}
