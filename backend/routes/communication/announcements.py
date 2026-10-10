from fastapi import APIRouter, Depends, HTTPException, Body
from database import db
from models import gen_id
from auth import get_current_user, require_roles
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/api/announcements", tags=["Announcements"])

SENDER_ROLES = ("SuperAdmin", "Principal")


@router.post("/create")
async def create_announcement(data: dict = Body(...), user: dict = Depends(require_roles(*SENDER_ROLES))):
    """Create a new announcement that pops up for all users on login."""
    title = data.get("title", "").strip()
    body = data.get("body", "").strip()
    duration_days = int(data.get("duration_days", 7))
    if not title or not body:
        raise HTTPException(status_code=400, detail="Title and body are required")
    if duration_days < 1 or duration_days > 90:
        raise HTTPException(status_code=400, detail="Duration must be between 1 and 90 days")

    now = datetime.now(timezone.utc)
    target = data.get("target", "all")  # all, parents, students, individuals
    target_ids = data.get("target_ids", [])  # user_ids for individuals
    if target not in ("all", "parents", "students", "teachers", "individuals"):
        raise HTTPException(status_code=400, detail="Invalid target type")
    if target == "individuals" and not target_ids:
        raise HTTPException(status_code=400, detail="Select at least one person")

    ann = {
        "announcement_id": gen_id("ann_"),
        "title": title,
        "body": body,
        "target": target,
        "target_ids": target_ids if target == "individuals" else [],
        "created_by": user["user_id"],
        "sender_name": user.get("name", ""),
        "sender_role": user.get("role", ""),
        "is_active": True,
        "duration_days": duration_days,
        "expires_at": (now + timedelta(days=duration_days)).isoformat(),
        "created_at": now.isoformat(),
        "read_by": [],
    }
    await db.announcements.insert_one(ann)

    # Send push notification to all users for announcements
    from ws_manager import send_push_to_all
    await send_push_to_all(db, {
        "title": f"Announcement: {title[:50]}",
        "message": body[:120],
        "type": "announcement",
        "url": "/",
    })

    return {"message": "Announcement published", "announcement_id": ann["announcement_id"]}


@router.get("/active")
async def get_active_announcements(user: dict = Depends(get_current_user)):
    """Get announcements the current user hasn't acknowledged yet."""
    uid = user["user_id"]
    role = user.get("role", "")
    now = datetime.now(timezone.utc).isoformat()

    # Target filter: user sees announcements targeted to them
    target_filter = {"$or": [
        {"target": "all"},
        {"target": {"$exists": False}},  # legacy announcements
        {"target": "parents", "$expr": {"$eq": [role, "Parent"]}},
        {"target": "students", "$expr": {"$eq": [role, "Student"]}},
        {"target": "individuals", "target_ids": uid},
    ]}

    base_filter = {
        "is_active": True,
        "read_by": {"$ne": uid},
        "$or": [{"expires_at": {"$gt": now}}, {"expires_at": {"$exists": False}}],
    }

    # Combine: fetch all valid, then filter by target in-app for simplicity
    announcements = await db.announcements.find(
        {**base_filter}, {"_id": 0, "read_by": 0}
    ).sort("created_at", -1).to_list(20)

    # Filter by target
    result = []
    for a in announcements:
        t = a.get("target", "all")
        if t == "all" or t is None:
            result.append(a)
        elif t == "parents" and role == "Parent":
            result.append(a)
        elif t == "students" and role == "Student":
            result.append(a)
        elif t == "teachers" and role in ("Teacher", "HeadTeacher"):
            result.append(a)
        elif t == "individuals" and uid in a.get("target_ids", []):
            result.append(a)
        if len(result) >= 10:
            break

    return result


@router.post("/{announcement_id}/acknowledge")
async def acknowledge_announcement(announcement_id: str, user: dict = Depends(get_current_user)):
    """User acknowledges they have read the announcement."""
    ann = await db.announcements.find_one({"announcement_id": announcement_id}, {"_id": 0})
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")

    uid = user["user_id"]
    await db.announcements.update_one(
        {"announcement_id": announcement_id},
        {"$addToSet": {"read_by": uid}}
    )

    # Log the acknowledgment
    await db.announcement_logs.insert_one({
        "log_id": gen_id("alog_"),
        "announcement_id": announcement_id,
        "announcement_title": ann.get("title", ""),
        "user_id": uid,
        "user_name": user.get("name", ""),
        "user_role": user.get("role", ""),
        "sender_id": ann.get("created_by", ""),
        "acknowledged_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"message": "Acknowledged"}


@router.get("/search-users")
async def search_users_for_announcement(q: str = "", user: dict = Depends(require_roles(*SENDER_ROLES))):
    """Search users to target individual announcements."""
    query = {"role": {"$in": ["Student", "Parent", "Teacher", "FinanceOfficer", "HeadTeacher"]}}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    users = await db.users.find(query, {"_id": 0, "user_id": 1, "name": 1, "role": 1, "year_group": 1}).sort("name", 1).to_list(50)
    return users


@router.get("/logs")
async def get_announcement_logs(user: dict = Depends(require_roles(*SENDER_ROLES))):
    """Get acknowledgment logs for the sender."""
    logs = await db.announcement_logs.find(
        {}, {"_id": 0}
    ).sort("acknowledged_at", -1).to_list(500)
    return logs


@router.get("/all")
async def list_all_announcements(user: dict = Depends(require_roles(*SENDER_ROLES))):
    """List all announcements for management."""
    anns = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for a in anns:
        a["read_count"] = len(a.get("read_by", []))
        a.pop("read_by", None)
    return anns


@router.patch("/{announcement_id}/deactivate")
async def deactivate_announcement(announcement_id: str, user: dict = Depends(require_roles(*SENDER_ROLES))):
    """Deactivate an announcement so it no longer shows on login."""
    result = await db.announcements.update_one(
        {"announcement_id": announcement_id},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Not found or already inactive")
    return {"message": "Announcement deactivated"}
