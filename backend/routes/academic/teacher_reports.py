"""Teacher Reports: Teacher → Admin → optionally forwarded to Parent."""
from fastapi import APIRouter, Depends, HTTPException, Body
from database import db, get_active_term
from models import gen_id
from auth import get_current_user, require_roles
from ws_manager import send_notification
from datetime import datetime, timezone

router = APIRouter(prefix="/api/teacher-reports", tags=["teacher-reports"])

MGMT_ROLES = ("Admin", "SuperAdmin", "CEO", "Principal", "HeadTeacher", "HeadOfAcademics", "Founder")


@router.post("/")
async def create_report(data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Teacher creates a report about a student (academic, behaviour, etc.)."""
    student_id = data.get("student_id", "")
    if not student_id:
        raise HTTPException(400, "student_id required")

    student = await db.users.find_one({"user_id": student_id}, {"_id": 0, "name": 1, "year_group": 1, "class_id": 1})
    if not student:
        raise HTTPException(404, "Student not found")

    active_term, _ = await get_active_term()
    now = datetime.now(timezone.utc).isoformat()
    report_id = gen_id("rpt_")

    doc = {
        "report_id": report_id,
        "student_id": student_id,
        "student_name": student.get("name", ""),
        "subject_id": data.get("subject_id", ""),
        "subject_name": data.get("subject_name", ""),
        "teacher_id": user["user_id"],
        "teacher_name": user.get("name", ""),
        "type": data.get("type", "general"),
        "title": data.get("title", ""),
        "content": data.get("content", ""),
        "severity": data.get("severity", "info"),
        "term": active_term,
        "status": "pending_review",
        "forwarded_to_parent": False,
        "forwarded_at": None,
        "forwarded_by": None,
        "admin_notes": "",
        "created_at": now,
        "updated_at": now,
    }
    await db.teacher_reports.insert_one(doc)
    doc.pop("_id", None)

    # Notify admin/management
    mgmt = await db.users.find({"role": {"$in": list(MGMT_ROLES)}}, {"_id": 0, "user_id": 1}).to_list(10)
    for m in mgmt:
        await send_notification(db, m["user_id"], {
            "type": "teacher_report", "title": f"New Report: {student.get('name','')}",
            "message": f"{user['name']} submitted a report about {student.get('name','')}: {data.get('title','')}",
            "reference_type": "teacher_report", "reference_id": report_id,
        })

    return doc


@router.get("/")
async def list_reports(student_id: str = None, status: str = None, user: dict = Depends(get_current_user)):
    """List reports — teachers see their own, management sees all, parents see forwarded."""
    query = {}
    role = user.get("role", "")

    if role == "Parent":
        child_ids = user.get("children_ids", [])
        query = {"student_id": {"$in": child_ids}, "forwarded_to_parent": True}
    elif role == "Teacher":
        query["teacher_id"] = user["user_id"]
    elif role in MGMT_ROLES:
        pass  # see all
    else:
        query["teacher_id"] = user["user_id"]

    if student_id:
        query["student_id"] = student_id
    if status:
        query["status"] = status

    reports = await db.teacher_reports.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return reports


@router.post("/{report_id}/review")
async def review_report(report_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*MGMT_ROLES))):
    """Admin reviews a report and optionally forwards to parent."""
    report = await db.teacher_reports.find_one({"report_id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(404, "Report not found")

    now = datetime.now(timezone.utc).isoformat()
    action = data.get("action", "acknowledge")
    admin_notes = data.get("admin_notes", "")
    forward_to_parent = data.get("forward_to_parent", False)

    updates = {
        "status": "reviewed",
        "admin_notes": admin_notes,
        "reviewed_by": user["user_id"],
        "reviewed_by_name": user.get("name", ""),
        "reviewed_at": now,
        "updated_at": now,
    }

    if forward_to_parent:
        updates["forwarded_to_parent"] = True
        updates["forwarded_at"] = now
        updates["forwarded_by"] = user["user_id"]
        updates["forwarded_by_name"] = user.get("name", "")

        # Notify parent
        parents = await db.users.find(
            {"role": "Parent", "children_ids": report["student_id"]},
            {"_id": 0, "user_id": 1}
        ).to_list(5)
        for p in parents:
            await send_notification(db, p["user_id"], {
                "type": "parent_report", "title": f"Report: {report.get('student_name','')}",
                "message": f"A teacher report about {report.get('student_name','')} has been shared with you.",
                "reference_type": "teacher_report", "reference_id": report_id,
            })

    await db.teacher_reports.update_one({"report_id": report_id}, {"$set": updates})
    return {"message": f"Report {'forwarded to parent' if forward_to_parent else 'reviewed'}", "forwarded": forward_to_parent}
