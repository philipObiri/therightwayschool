from fastapi import APIRouter, Depends, HTTPException, Body
from database import db
from models import gen_id
from auth import get_current_user, require_roles, log_audit
from ws_manager import send_notification
from datetime import datetime, timezone

router = APIRouter(prefix="/api/working-paper", tags=["working-paper"])

ADMIN_ROLES = ("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher")


# ─── Auto Activity Logging Helper ───
async def log_activity(user_id: str, user_name: str, action: str, description: str, entity_type: str = "", entity_id: str = "", shared: bool = False):
    """Log a work activity automatically. Called from other routes."""
    doc = {
        "log_id": gen_id("wlog_"),
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "description": description,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "shared": shared,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.working_paper_logs.insert_one(doc)
    return doc


# ─── Activity Feed ───
@router.get("/activity")
async def my_activity(limit: int = 50, user: dict = Depends(get_current_user)):
    """Get own activity log."""
    logs = await db.working_paper_logs.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return logs


@router.get("/activity/all")
async def all_activity(staff_id: str = None, subject: str = None, limit: int = 100, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    """Management view: all staff activity."""
    query = {}
    if staff_id:
        query["user_id"] = staff_id
    if subject:
        query["description"] = {"$regex": subject, "$options": "i"}
    logs = await db.working_paper_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return logs


@router.get("/activity/live")
async def live_activity(user: dict = Depends(require_roles(*ADMIN_ROLES))):
    """Get last 30 minutes of activity across all staff."""
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    logs = await db.working_paper_logs.find(
        {"created_at": {"$gte": cutoff}}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return logs


# ─── Manual Work Logs ───
@router.post("/logs")
async def add_manual_log(data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Staff manually logs what they're working on."""
    doc = {
        "log_id": gen_id("wlog_"),
        "user_id": user["user_id"],
        "user_name": user["name"],
        "action": "manual_log",
        "description": data.get("description", ""),
        "entity_type": data.get("category", "general"),
        "entity_id": "",
        "shared": data.get("shared", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.working_paper_logs.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/logs/{log_id}/share")
async def toggle_share(log_id: str, user: dict = Depends(get_current_user)):
    """Toggle sharing of a log entry."""
    log = await db.working_paper_logs.find_one({"log_id": log_id, "user_id": user["user_id"]}, {"_id": 0})
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    new_shared = not log.get("shared", False)
    await db.working_paper_logs.update_one({"log_id": log_id}, {"$set": {"shared": new_shared}})
    return {"shared": new_shared}


# ─── Files & Folders ───
@router.get("/folders")
async def list_folders(user: dict = Depends(get_current_user)):
    """Get folder structure for user's working paper."""
    folders = await db.working_paper_folders.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    return folders


@router.post("/folders")
async def create_folder(data: dict = Body(...), user: dict = Depends(get_current_user)):
    doc = {
        "folder_id": gen_id("wfld_"),
        "user_id": user["user_id"],
        "name": data.get("name", ""),
        "parent_id": data.get("parent_id", ""),
        "level": data.get("level", "subject"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.working_paper_folders.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/files")
async def list_files(folder_id: str = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["user_id"]}
    if folder_id:
        query["folder_id"] = folder_id
    files = await db.working_paper_files.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return files


@router.post("/files")
async def add_file(data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Add a file reference to working paper."""
    doc = {
        "wp_file_id": gen_id("wpf_"),
        "user_id": user["user_id"],
        "user_name": user["name"],
        "folder_id": data.get("folder_id", ""),
        "file_id": data.get("file_id", ""),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "shared": data.get("shared", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.working_paper_files.insert_one(doc)
    await log_activity(user["user_id"], user["name"], "upload_file", f"Uploaded: {doc['title']}", "file", doc["wp_file_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/files/{wp_file_id}")
async def delete_file(wp_file_id: str, user: dict = Depends(get_current_user)):
    await db.working_paper_files.delete_one({"wp_file_id": wp_file_id, "user_id": user["user_id"]})
    return {"message": "File removed"}


# ─── Staff Working Paper View (for management) ───
@router.get("/staff/{staff_id}")
async def staff_working_paper(staff_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    """Management views a staff member's working paper."""
    staff = await db.users.find_one({"user_id": staff_id}, {"_id": 0, "password_hash": 0, "last_set_password": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    # Get shared logs + all logs for admins
    logs = await db.working_paper_logs.find(
        {"user_id": staff_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    folders = await db.working_paper_folders.find({"user_id": staff_id}, {"_id": 0}).to_list(50)
    files = await db.working_paper_files.find({"user_id": staff_id}, {"_id": 0}).sort("created_at", -1).to_list(100)

    return {
        "staff": staff,
        "logs": logs,
        "folders": folders,
        "files": files,
    }


# ─── Management Dashboard Stats ───
@router.get("/dashboard")
async def dashboard_stats(user: dict = Depends(require_roles(*ADMIN_ROLES))):
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    cutoff_30m = (now - timedelta(minutes=30)).isoformat()
    cutoff_today = now.replace(hour=0, minute=0, second=0).isoformat()

    active_now = await db.working_paper_logs.distinct("user_id", {"created_at": {"$gte": cutoff_30m}})
    today_logs = await db.working_paper_logs.count_documents({"created_at": {"$gte": cutoff_today}})
    total_files = await db.working_paper_files.count_documents({})
    total_shared = await db.working_paper_logs.count_documents({"shared": True})

    # Get staff with most activity today
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff_today}}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}, "name": {"$first": "$user_name"}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_active = await db.working_paper_logs.aggregate(pipeline).to_list(10)

    return {
        "active_now": len(active_now),
        "active_user_ids": active_now,
        "today_logs": today_logs,
        "total_files": total_files,
        "total_shared": total_shared,
        "top_active": top_active,
    }
