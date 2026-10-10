from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import os
import json
import logging
import time
import threading
from collections import defaultdict
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create the main app
app = FastAPI(title="RightWay Workstation API")


# ── Rate Limiting Middleware ──────────────────────────────────────────────────
# Sliding-window rate limiter, keyed by IP.
# Rules (requests / window_seconds):
#   /api/auth/login        →  10 / 60 s
#   /api/auth/register     →   5 / 60 s
#   /api/auth/reset-*      →   3 / 60 s
#   /api/wipay/*           →  20 / 60 s  (payment endpoints)
#   /api/files/upload      →  30 / 60 s
#   All other API routes   → 120 / 60 s  (generous ceiling)

_RATE_RULES: list[tuple[str, int, int]] = [
    ("/api/auth/login",    10, 60),
    ("/api/auth/register",  5, 60),
    ("/api/auth/reset",     3, 60),
    ("/api/wipay/",        20, 60),
    ("/api/files/upload",  30, 60),
    ("/api/",             120, 60),
]
_rl_store: dict[str, list[float]] = defaultdict(list)
_rl_lock = threading.Lock()

def _get_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def _get_rule(path: str):
    for prefix, limit, window in _RATE_RULES:
        if path.startswith(prefix):
            return limit, window
    return 200, 60  # fallback

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        # Only rate-limit API routes; skip health + static
        if not path.startswith("/api/") or path == "/api/health":
            return await call_next(request)
        ip = _get_ip(request)
        limit, window = _get_rule(path)
        key = f"{ip}:{path.split('/', 3)[:3]}"  # bucket per IP + top-level path
        now = time.time()
        with _rl_lock:
            # Prune old timestamps outside the window
            _rl_store[key] = [t for t in _rl_store[key] if now - t < window]
            count = len(_rl_store[key])
            if count >= limit:
                retry_after = int(window - (now - _rl_store[key][0])) + 1
                return JSONResponse(
                    status_code=429,
                    content={"detail": f"Too many requests. Retry in {retry_after}s."},
                    headers={"Retry-After": str(retry_after)},
                )
            _rl_store[key].append(now)
        return await call_next(request)

# ── Routers ──────────────────────────────────────────────────────────────────
# Grouped by domain to match the folder structure under routes/
from auth import router as auth_router

# academic/ — lessons, lectures, quizzes, gradebook, schemes, timetable
from routes.academic.academic import router as academic_router
from routes.academic.assignments import router as assignments_router
from routes.academic.gradebook import router as gradebook_router
from routes.academic.lectures import router as lectures_router
from routes.academic.lessons_v2 import router as lessons_v2_router
from routes.academic.quiz import router as quiz_router
from routes.academic.remarks import router as remarks_router
from routes.academic.schemes import router as schemes_router
from routes.academic.teacher_reports import router as teacher_reports_router
from routes.academic.timetable_gen import router as timetable_gen_router

# finance/ — invoices, payments, accounting, payment gateways
from routes.finance.finance_v2 import router as finance_router
from routes.finance.finance_ops import router as finance_ops_router
from routes.finance.finance_reports_pdf import router as finance_pdf_router
from routes.finance.accounting import router as accounting_router
from routes.finance.paystack import router as paystack_router
from routes.finance.wipay import router as wipay_router

# hr/ — staff attendance, behaviour, CPD, HR
from routes.hr.attendance import router as attendance_router
from routes.hr.behaviour import router as behaviour_router
from routes.hr.cpd import router as cpd_router
from routes.hr.hr import router as hr_router

# admin/ — users, admissions, analytics, bulk upload, monitoring
from routes.admin.admin import router as admin_router
from routes.admin.admissions import router as admissions_router
from routes.admin.analytics import router as analytics_router
from routes.admin.bulk_upload import router as bulk_upload_router
from routes.admin.monitoring import router as monitoring_router

# communication/ — chat, mail, announcements, meetings, push notifications
from routes.communication.announcements import router as announcements_router
from routes.communication.chat import router as chat_router, chat_ws
from routes.communication.mail_outlook import router as mail_router
from routes.communication.meetings import router as meetings_router
from routes.communication.push_notifications import router as push_notifications_router

# ai/ — AI diagram generation, plagiarism detection, smart search
from routes.ai.ai_diagrams import router as ai_diagrams_router
from routes.ai.plagiarism import router as plagiarism_router
from routes.ai.search import router as search_router

# student/ — LMS, live classes, booster, discussions, sick bay
from routes.student.booster import router as booster_router
from routes.student.discussions import router as discussions_router
from routes.student.live_classes import router as live_router
from routes.student.lms import router as lms_router
from routes.student.sick_bay import router as sick_bay_router

# content/ — file uploads, knowledge base
from routes.content.files import router as files_router
from routes.content.knowledge_base import router as kb_router

# property/ — boarding, guesthouse, receptionist
from routes.property.boarding import router as boarding_router
from routes.property.guesthouse import router as guesthouse_router
from routes.property.receptionist import router as receptionist_router

# tools/ — calendar, tasks, public website
from routes.tools.calendar import router as calendar_router
from routes.tools.tasks import router as tasks_router
from routes.tools.website import router as website_router

# working_papers/ — working papers (v1/v2/advanced) and collaboration
from routes.working_papers.working_paper import router as working_paper_router
from routes.working_papers.working_paper_v2 import router as working_paper_v2_router
from routes.working_papers.working_paper_advanced import router as working_paper_adv_router
from routes.working_papers.wp_collab import router as wp_collab_router

# Include all routers
app.include_router(auth_router)
app.include_router(academic_router)
app.include_router(lms_router)
app.include_router(assignments_router)
app.include_router(attendance_router)
app.include_router(finance_router)
app.include_router(finance_ops_router)
app.include_router(finance_pdf_router)
app.include_router(mail_router)
app.include_router(tasks_router)
app.include_router(admin_router)
app.include_router(search_router)
app.include_router(hr_router)
app.include_router(monitoring_router)
app.include_router(live_router)
app.include_router(files_router)
app.include_router(gradebook_router)
app.include_router(cpd_router)
app.include_router(behaviour_router)
app.include_router(quiz_router)
app.include_router(boarding_router)
app.include_router(admissions_router)
app.include_router(working_paper_router)
app.include_router(working_paper_v2_router)
app.include_router(working_paper_adv_router)
app.include_router(wp_collab_router)
app.include_router(chat_router)
app.include_router(schemes_router)
app.include_router(meetings_router)
app.include_router(calendar_router)
app.include_router(kb_router)
app.include_router(remarks_router)
app.include_router(lessons_v2_router)
app.include_router(analytics_router)
app.include_router(discussions_router)
app.include_router(lectures_router)
app.include_router(push_notifications_router)
app.include_router(plagiarism_router)
app.include_router(accounting_router)
app.include_router(ai_diagrams_router)
app.include_router(paystack_router)
app.include_router(timetable_gen_router)
app.include_router(teacher_reports_router)
app.include_router(receptionist_router)
app.include_router(sick_bay_router)
app.include_router(guesthouse_router)
app.include_router(booster_router)
app.include_router(bulk_upload_router)

app.include_router(announcements_router)
app.include_router(website_router, prefix="/api")

app.include_router(wipay_router)

app.add_middleware(RateLimitMiddleware)

# ── Security Headers Middleware ───────────────────────────────────────────────
_IS_PROD = os.environ.get('ENVIRONMENT', 'development') == 'production'

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if _IS_PROD:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────────────
_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
_ALLOWED_HEADERS = ["Authorization", "Content-Type", "Accept", "X-Requested-With"]

cors_origins = os.environ.get('CORS_ORIGINS', '*')
if cors_origins == '*':
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=False,
        allow_origins=["*"],
        allow_methods=_ALLOWED_METHODS,
        allow_headers=_ALLOWED_HEADERS,
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=[o.strip() for o in cors_origins.split(',')],
        allow_methods=_ALLOWED_METHODS,
        allow_headers=_ALLOWED_HEADERS,
    )

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "RightWay Workstation"}


@app.get("/api/settings/active-term")
async def get_active_term():
    from database import db
    setting = await db.app_settings.find_one({"key": "active_term"}, {"_id": 0})
    if setting:
        return {"term": setting.get("value", "Term 1"), "academic_year": setting.get("academic_year", "2025-2026")}
    return {"term": "Term 1", "academic_year": "2025-2026"}


@app.put("/api/settings/active-term")
async def set_active_term(data: dict, request: Request):
    from database import db
    from auth import require_roles, log_audit
    from ws_manager import manager as ws_manager
    from datetime import datetime, timezone
    # Only SuperAdmin, CEO, and Principal can change the active term
    check = require_roles("SuperAdmin", "CEO", "Principal")
    auth_user = await check(request=request)
    term = data.get("term", "Term 1")
    academic_year = data.get("academic_year", "2025-2026")
    await db.app_settings.update_one(
        {"key": "active_term"},
        {"$set": {"key": "active_term", "value": term, "academic_year": academic_year,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    await ws_manager.broadcast_all({
        "event": "term_changed",
        "data": {"term": term, "academic_year": academic_year}
    })
    await log_audit(auth_user["user_id"], auth_user["name"], "set_active_term", "settings", term, {"academic_year": academic_year})
    return {"message": f"Active term set to {term} ({academic_year})", "term": term, "academic_year": academic_year}


from database import client
from ws_manager import manager as ws_manager


# ── Global exception handler — never leak stack traces to clients ─────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.websocket("/api/ws/notifications")
async def ws_notifications(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return
    user_id = ws_manager.authenticate(token)
    if not user_id:
        await websocket.close(code=4001, reason="Invalid token")
        return
    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)


@app.websocket("/api/chat/ws")
async def ws_chat(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return
    user_id = ws_manager.authenticate(token)
    if not user_id:
        await websocket.close(code=4001, reason="Invalid token")
        return
    await chat_ws.connect(user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                event = data.get("event", "")
                if event == "typing":
                    await chat_ws.broadcast_to_chat(
                        data.get("chat_id", ""),
                        {"event": "typing", "user_id": user_id, "chat_id": data.get("chat_id", "")},
                        exclude_user=user_id
                    )
                elif event == "stop_typing":
                    await chat_ws.broadcast_to_chat(
                        data.get("chat_id", ""),
                        {"event": "stop_typing", "user_id": user_id, "chat_id": data.get("chat_id", "")},
                        exclude_user=user_id
                    )
            except Exception:
                pass
    except WebSocketDisconnect:
        chat_ws.disconnect(user_id, websocket)


@app.on_event("startup")
async def startup():
    # Ensure DejaVu fonts are available for PDF generation
    import subprocess, os
    if not os.path.exists("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            subprocess.run(["apt-get", "install", "-y", "fonts-dejavu-core", "fonts-dejavu-extra"], capture_output=True, timeout=30)
            logger.info("DejaVu fonts installed")
        except Exception as e:
            logger.warning(f"Font install deferred: {e}")

# Only set default passwords for users who have NO password hash (new accounts)
    try:
        from auth import hash_password
        from database import db as startup_db
        PASSWORDS = {
            'Teacher': 'teacher123', 'Admin': 'admin123', 'SuperAdmin': 'admin123',
            'CEO': 'ceo123', 'Principal': 'principal123', 'HeadTeacher': 'headteacher123',
            'Founder': 'founder123', 'FinanceOfficer': 'finance123', 'HR_Officer': 'hr123',
            'HeadOfAcademics': 'hoa123', 'Student': 'student123', 'Parent': 'parent123',
            'BoardingOfficer': 'admin123', 'AdmissionsOfficer': 'admin123',
            'Receptionist': 'reception123', 'Nurse': 'nurse123',
        }
        users = await startup_db.users.find(
            {"$or": [{"password_hash": {"$exists": False}}, {"password_hash": ""}, {"password_hash": None}]},
            {"_id": 0, "user_id": 1, "role": 1}
        ).to_list(500)
        for u in users:
            pw = PASSWORDS.get(u.get("role", ""), "teacher123")
            await startup_db.users.update_one({"user_id": u["user_id"]}, {"$set": {"password_hash": hash_password(pw)}})
        if users:
            logger.info(f"Set default passwords for {len(users)} new users")
    except Exception as e:
        logger.warning(f"Password fix deferred: {e}")

    # Security & performance indexes
    try:
        await startup_db.users.create_index("user_id", unique=True)
        await startup_db.users.create_index("email", unique=True)
        await startup_db.user_sessions.create_index("session_token", unique=True)
        await startup_db.user_sessions.create_index("expires_at", expireAfterSeconds=0)  # TTL auto-delete
        await startup_db.audit_logs.create_index([("user_id", 1), ("created_at", -1)])
        await startup_db.audit_logs.create_index("created_at")
        await startup_db.invoices_v2.create_index("invoice_id", unique=True)
        await startup_db.wipay_payments.create_index("order_id", unique=True)
        # Remove plaintext passwords from existing docs (one-time migration)
        await startup_db.users.update_many(
            {"last_set_password": {"$exists": True}},
            {"$unset": {"last_set_password": ""}}
        )
        # Ensure all users have token_version field
        await startup_db.users.update_many(
            {"token_version": {"$exists": False}},
            {"$set": {"token_version": 1}}
        )
        logger.info("Security indexes and migrations applied")
    except Exception as e:
        logger.warning("Security index setup deferred: %s", e)

    # Create indexes for Working Paper performance
    try:
        await startup_db.wp_folders.create_index("parent_id")
        await startup_db.wp_folders.create_index("owner_id")
        await startup_db.wp_documents.create_index("folder_id")
        await startup_db.wp_entries.create_index("folder_id")
        await startup_db.wp_permissions.create_index([("folder_id", 1), ("user_id", 1)])
        await startup_db.wp_permissions.create_index([("folder_id", 1), ("role", 1)])
        await startup_db.wp_audit.create_index("timestamp")
        await startup_db.wp_audit.create_index("user_id")
    except Exception:
        pass

    # Auto-seed timetable data if empty
    try:
        tt_count = await startup_db.timetable_v2.count_documents({})
        if tt_count == 0:
            logger.info("Timetable empty - running auto-seed...")
            import sys
            sys.path.insert(0, os.path.dirname(__file__))
            from populate_timetable_v3 import populate_all
            await populate_all()
            new_count = await startup_db.timetable_v2.count_documents({})
            logger.info(f"Timetable seeded: {new_count} entries")
    except Exception as e:
        logger.warning(f"Timetable seed deferred: {e}")

    # Auto-seed Term 3 academic calendar if not present
    try:
        from models import gen_id as cal_gen_id
        from datetime import datetime as cal_dt, timezone as cal_tz
        cal_count = await startup_db.calendar_events.count_documents({"school_wide": True, "academic_term": "Term 3 2025-2026"})
        if cal_count == 0:
            logger.info("Term 3 calendar empty - auto-seeding...")
            cal_events = [
                {"title": "Boarders Arrive", "start": "2026-04-19", "end": "2026-04-19", "cat": "reopening", "color": "#1B2A4A", "desc": "Boarders report between 2:00pm - 5:00pm"},
                {"title": "Lessons Begin", "start": "2026-04-20", "end": "2026-04-24", "cat": "academic", "color": "#2E6CC4", "desc": "Term 3 lessons commence"},
                {"title": "Lessons Continue", "start": "2026-04-27", "end": "2026-05-01", "cat": "academic", "color": "#2E6CC4", "desc": ""},
                {"title": "Progressive Test 1", "start": "2026-05-04", "end": "2026-05-08", "cat": "assessment", "color": "#C5A55A", "desc": "Year 11 & 13 exam candidates are exempted"},
                {"title": "Lessons Continue", "start": "2026-05-11", "end": "2026-05-15", "cat": "academic", "color": "#2E6CC4", "desc": "Continuing students"},
                {"title": "Founders Math & Science Quiz", "start": "2026-05-15", "end": "2026-05-15", "cat": "competition", "color": "#059669", "desc": "Annual inter-class competition"},
                {"title": "1st Parental Visit", "start": "2026-05-17", "end": "2026-05-17", "cat": "parent_event", "color": "#7C3AED", "desc": "Parents visit day"},
                {"title": "Midterm Exam Begins", "start": "2026-05-18", "end": "2026-05-22", "cat": "exam", "color": "#DC2626", "desc": "Midterm examinations"},
                {"title": "Mid-Term Exam Continues", "start": "2026-05-25", "end": "2026-05-29", "cat": "exam", "color": "#DC2626", "desc": "Midterm examinations continue"},
                {"title": "AU Day Celebration", "start": "2026-05-28", "end": "2026-05-28", "cat": "celebration", "color": "#059669", "desc": "Details in newsletter"},
                {"title": "Labour Day (Public Holiday)", "start": "2026-05-01", "end": "2026-05-01", "cat": "holiday", "color": "#F59E0B", "desc": "Public Holiday - No school"},
                {"title": "Eid al-Adha (Public Holiday)", "start": "2026-05-29", "end": "2026-05-29", "cat": "holiday", "color": "#F59E0B", "desc": "Public Holiday"},
                {"title": "MID-TERM BREAK", "start": "2026-06-01", "end": "2026-06-05", "cat": "holiday", "color": "#F59E0B", "desc": "Mid-term break - no school"},
                {"title": "Revision Week", "start": "2026-06-08", "end": "2026-06-12", "cat": "academic", "color": "#2E6CC4", "desc": "Revision and preparation for End of Term exams"},
                {"title": "End of Term Exam Begins", "start": "2026-06-15", "end": "2026-06-19", "cat": "exam", "color": "#DC2626", "desc": "End of Term examinations"},
                {"title": "End of Term Exam Continues", "start": "2026-06-22", "end": "2026-06-26", "cat": "exam", "color": "#DC2626", "desc": "End of Term examinations continue"},
                {"title": "Speech Day & Graduation Rehearsals", "start": "2026-06-29", "end": "2026-07-03", "cat": "event", "color": "#7C3AED", "desc": "Rehearsals for speech and prize giving day"},
                {"title": "End of Term Exam (Final)", "start": "2026-07-06", "end": "2026-07-10", "cat": "exam", "color": "#DC2626", "desc": "Final End of Term examinations"},
                {"title": "Speech & Prize Giving Day / Graduation", "start": "2026-07-11", "end": "2026-07-11", "cat": "ceremony", "color": "#C5A55A", "desc": "Annual speech and prize giving day & graduation ceremony"},
                {"title": "School Closes - Vacation Begins", "start": "2026-07-11", "end": "2026-07-11", "cat": "closing", "color": "#1B2A4A", "desc": "Boarders and day students depart for vacation"},
                {"title": "Boarders Arrive (Next Year)", "start": "2026-09-13", "end": "2026-09-13", "cat": "reopening", "color": "#1B2A4A", "desc": "New academic year - boarders report"},
                {"title": "Classes Begin (Next Year)", "start": "2026-09-14", "end": "2026-09-14", "cat": "academic", "color": "#2E6CC4", "desc": "New academic year classes commence"},
            ]
            now = cal_dt.now(cal_tz.utc).isoformat()
            for e in cal_events:
                await startup_db.calendar_events.insert_one({
                    "event_id": cal_gen_id("evt_"), "title": e["title"], "description": e["desc"],
                    "start_time": f"{e['start']}T08:00:00+00:00", "end_time": f"{e['end']}T17:00:00+00:00",
                    "all_day": True, "color": e["color"], "category": e["cat"],
                    "event_type": "school", "school_wide": True, "academic_term": "Term 3 2025-2026",
                    "attendees": [], "created_by": "system", "created_by_name": "System", "created_at": now,
                })
            logger.info(f"Term 3 calendar seeded: {len(cal_events)} events")
    except Exception as e:
        logger.warning(f"Calendar seed deferred: {e}")

    # ─── Force-correct guest house rooms on every startup ───
    try:
        from routes.property.guesthouse import ensure_rooms
        await ensure_rooms()
        logger.info("Guest house rooms verified/corrected")
    except Exception as e:
        logger.warning(f"Guest house room check deferred: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
