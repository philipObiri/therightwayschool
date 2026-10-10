"""
Teacher Remarks - General class remarks, subject complaints, needs, and book requests.
Teachers post remarks; Management (SuperAdmin, CEO, HeadTeacher, Admin) can view and respond.
"""
from fastapi import APIRouter, Depends, Body, HTTPException
from database import db, get_active_term
from auth import get_current_user, require_roles
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/remarks", tags=["remarks"])

def gen_id(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:12]}"

MANAGEMENT_ROLES = ("SuperAdmin", "CEO", "HeadTeacher", "Admin", "Principal", "Founder")
TEACHER_ROLES = ("Teacher", "SuperAdmin", "CEO", "HeadTeacher", "Admin", "Principal", "Founder")

CATEGORIES = ["class_remark", "subject_complaint", "book_request", "resource_need", "general", "suggestion"]


@router.get("/")
async def list_remarks(category: str = None, status: str = None, user: dict = Depends(get_current_user)):
    """List remarks. Teachers see their own; Management sees all."""
    query = {}
    user_roles = set(user.get("roles", []))
    user_roles.add(user.get("role", ""))
    is_management = bool(user_roles & set(MANAGEMENT_ROLES))
    if not is_management:
        query["author_id"] = user["user_id"]
    if category:
        query["category"] = category
    if status:
        query["status"] = status
    # Auto-filter by active term
    active_term, _ = await get_active_term()
    query["term"] = active_term

    remarks = await db.teacher_remarks.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return remarks


@router.post("/")
async def create_remark(data: dict = Body(...), user: dict = Depends(require_roles(*TEACHER_ROLES))):
    """Teacher creates a remark."""
    title = data.get("title", "").strip()
    body = data.get("body", "").strip()
    category = data.get("category", "general")
    subject = data.get("subject", "")
    year_group = data.get("year_group", "")

    if not title or not body:
        raise HTTPException(400, "Title and description are required")

    active_term, active_year = await get_active_term()
    now = datetime.now(timezone.utc).isoformat()
    remark = {
        "remark_id": gen_id("rmk_"),
        "title": title,
        "body": body,
        "category": category,
        "subject": subject,
        "year_group": year_group,
        "author_id": user["user_id"],
        "author_name": user["name"],
        "author_role": user["role"],
        "status": "open",
        "priority": data.get("priority", "normal"),
        "responses": [],
        "term": active_term,
        "academic_year": active_year,
        "created_at": now,
        "updated_at": now,
    }
    await db.teacher_remarks.insert_one(remark)
    return {k: v for k, v in remark.items() if k != "_id"}


@router.post("/{remark_id}/respond")
async def respond_to_remark(remark_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Management or original author responds to a remark."""
    remark = await db.teacher_remarks.find_one({"remark_id": remark_id}, {"_id": 0})
    if not remark:
        raise HTTPException(404, "Remark not found")

    text = data.get("text", "").strip()
    if not text:
        raise HTTPException(400, "Response text required")

    now = datetime.now(timezone.utc).isoformat()
    response = {
        "response_id": gen_id("res_"),
        "text": text,
        "author_id": user["user_id"],
        "author_name": user["name"],
        "author_role": user["role"],
        "created_at": now,
    }

    new_status = data.get("status")
    update = {"$push": {"responses": response}, "$set": {"updated_at": now}}
    if new_status and new_status in ("open", "acknowledged", "in_progress", "resolved", "closed"):
        update["$set"]["status"] = new_status

    await db.teacher_remarks.update_one({"remark_id": remark_id}, update)
    return {"message": "Response added", "response": response}


@router.patch("/{remark_id}/status")
async def update_remark_status(remark_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*MANAGEMENT_ROLES))):
    """Management updates status of a remark."""
    new_status = data.get("status", "")
    if new_status not in ("open", "acknowledged", "in_progress", "resolved", "closed"):
        raise HTTPException(400, "Invalid status")

    result = await db.teacher_remarks.update_one(
        {"remark_id": remark_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Remark not found")
    return {"message": f"Status updated to {new_status}"}


@router.delete("/{remark_id}")
async def delete_remark(remark_id: str, user: dict = Depends(get_current_user)):
    """Author or management can delete a remark."""
    remark = await db.teacher_remarks.find_one({"remark_id": remark_id}, {"_id": 0})
    if not remark:
        raise HTTPException(404, "Remark not found")
    if remark["author_id"] != user["user_id"] and user["role"] not in MANAGEMENT_ROLES:
        raise HTTPException(403, "Cannot delete this remark")

    await db.teacher_remarks.delete_one({"remark_id": remark_id})
    return {"message": "Remark deleted"}


@router.get("/stats")
async def remark_stats(user: dict = Depends(require_roles(*MANAGEMENT_ROLES))):
    """Stats for management dashboard."""
    total = await db.teacher_remarks.count_documents({})
    open_count = await db.teacher_remarks.count_documents({"status": "open"})
    in_progress = await db.teacher_remarks.count_documents({"status": "in_progress"})
    resolved = await db.teacher_remarks.count_documents({"status": {"$in": ["resolved", "closed"]}})

    cats = {}
    async for r in db.teacher_remarks.find({}, {"_id": 0, "category": 1}):
        c = r.get("category", "general")
        cats[c] = cats.get(c, 0) + 1

    return {"total": total, "open": open_count, "in_progress": in_progress, "resolved": resolved, "by_category": cats}
