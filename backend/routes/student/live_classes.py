from fastapi import APIRouter, Depends, HTTPException
from database import db
from models import LiveSessionCreate, gen_id
from auth import get_current_user, require_roles, log_audit
from datetime import datetime, timezone
import hashlib

router = APIRouter(prefix="/api/live", tags=["live"])


def generate_room_id(title: str, session_id: str) -> str:
    """Generate a unique Jitsi room ID."""
    raw = f"{title}-{session_id}"
    return "tcis-" + hashlib.sha256(raw.encode()).hexdigest()[:12]


@router.post("/sessions")
async def create_session(
    data: LiveSessionCreate,
    user: dict = Depends(require_roles("Admin", "SuperAdmin", "Teacher", "HeadTeacher", "Principal", "HeadOfAcademics"))
):
    session_id = gen_id("live_")
    room_id = generate_room_id(data.title, session_id)
    jitsi_url = f"https://meet.jit.si/{room_id}"

    doc = {
        "session_id": session_id, "title": data.title,
        "class_id": data.class_id, "subject_id": data.subject_id,
        "host_id": user["user_id"], "host_name": user["name"],
        "scheduled_at": data.scheduled_at,
        "duration_minutes": data.duration_minutes,
        "description": data.description,
        "room_id": room_id, "jitsi_url": jitsi_url,
        "status": "scheduled", "attendees": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.live_sessions.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "create_live_session", "live", session_id)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/sessions")
async def list_sessions(
    class_id: str = None, status: str = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if class_id:
        query["class_id"] = class_id
    if status:
        query["status"] = status

    sessions = await db.live_sessions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    for s in sessions:
        if s.get("subject_id"):
            subj = await db.subjects.find_one({"subject_id": s["subject_id"]}, {"_id": 0, "name": 1})
            s["subject_name"] = subj["name"] if subj else ""
        if s.get("class_id"):
            cls = await db.classes.find_one({"class_id": s["class_id"]}, {"_id": 0, "name": 1})
            s["class_name"] = cls["name"] if cls else ""
    return sessions


@router.post("/sessions/{session_id}/join")
async def join_session(session_id: str, user: dict = Depends(get_current_user)):
    session = await db.live_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Record attendance
    await db.live_sessions.update_one(
        {"session_id": session_id},
        {"$addToSet": {"attendees": {
            "user_id": user["user_id"], "name": user["name"],
            "joined_at": datetime.now(timezone.utc).isoformat()
        }}}
    )

    if session["status"] == "scheduled":
        await db.live_sessions.update_one(
            {"session_id": session_id}, {"$set": {"status": "active"}}
        )

    return {"jitsi_url": session["jitsi_url"], "room_id": session["room_id"]}


@router.post("/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    user: dict = Depends(require_roles("Admin", "SuperAdmin", "Teacher", "HeadTeacher", "Principal"))
):
    await db.live_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    await log_audit(user["user_id"], user["name"], "end_live_session", "live", session_id)
    return {"message": "Session ended"}


# ─── Announcements ───
@router.post("/announcements")
async def create_announcement(
    data: dict,
    user: dict = Depends(require_roles("Admin", "SuperAdmin", "HeadOfAcademics", "CEO", "Principal", "HeadTeacher"))
):
    doc = {
        "announcement_id": gen_id("ann_"),
        "title": data.get("title", ""),
        "body": data.get("body", ""),
        "target": data.get("target", "all"),
        "target_id": data.get("target_id", ""),
        "priority": data.get("priority", "normal"),
        "author_id": user["user_id"],
        "author_name": user["name"],
        "read_by": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.announcements.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/announcements")
async def list_announcements(user: dict = Depends(get_current_user)):
    announcements = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for a in announcements:
        a["is_read"] = user["user_id"] in a.get("read_by", [])
    return announcements
