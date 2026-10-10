"""Parent Concerns & Booster Lessons management."""
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from database import db, get_active_term
from models import gen_id
from auth import get_current_user, require_roles
from ws_manager import send_notification
from datetime import datetime, timezone

router = APIRouter(prefix="/api/booster", tags=["booster"])

MGMT_ROLES = ("Admin", "SuperAdmin", "CEO", "Founder", "Principal", "HeadTeacher", "HeadOfAcademics")
TEACHER_ROLES = ("Teacher", "Admin", "SuperAdmin", "CEO", "Founder", "Principal", "HeadTeacher", "HeadOfAcademics")


# ─── PARENT CONCERNS ───
@router.post("/concerns")
async def raise_concern(data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Parent or management raises a concern about a student."""
    now = datetime.now(timezone.utc).isoformat()
    active_term, active_year = await get_active_term()
    concern_id = gen_id("cnc_")
    doc = {
        "concern_id": concern_id,
        "student_id": data.get("student_id", ""),
        "student_name": data.get("student_name", ""),
        "student_year": data.get("student_year", ""),
        "raised_by": user["user_id"],
        "raised_by_name": user.get("name", ""),
        "raised_by_role": user.get("role", ""),
        "subject": data.get("subject", ""),
        "category": data.get("category", "academic"),
        "description": data.get("description", ""),
        "notes": data.get("notes", ""),
        "status": "open",
        "responses": [],
        "term": active_term,
        "academic_year": active_year,
        "created_at": now,
        "updated_at": now,
    }
    await db.parent_concerns.insert_one(doc)
    doc.pop("_id", None)

    # Notify management
    mgmt = await db.users.find({"role": {"$in": list(MGMT_ROLES)}}, {"_id": 0, "user_id": 1}).to_list(20)
    for m in mgmt:
        await send_notification(db, m["user_id"], {
            "type": "parent_concern",
            "title": f"Parent Concern: {data.get('student_name', '')}",
            "message": f"{data.get('category', 'General').title()}: {data.get('subject', '')[:80]}",
            "reference_type": "concern", "reference_id": concern_id,
        })
    return doc


@router.get("/concerns")
async def list_concerns(status: str = None, student_id: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if user.get("role") == "Parent":
        query["raised_by"] = user["user_id"]
    if status:
        query["status"] = status
    if student_id:
        query["student_id"] = student_id
    concerns = await db.parent_concerns.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return concerns


@router.post("/concerns/{concern_id}/respond")
async def respond_to_concern(concern_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*MGMT_ROLES))):
    now = datetime.now(timezone.utc).isoformat()
    response = {
        "response_id": gen_id("resp_"),
        "message": data.get("message", ""),
        "by": user.get("name", ""),
        "role": user.get("role", ""),
        "at": now,
    }
    new_status = data.get("status", None)
    update = {"$push": {"responses": response}, "$set": {"updated_at": now}}
    if new_status:
        update["$set"]["status"] = new_status

    await db.parent_concerns.update_one({"concern_id": concern_id}, update)

    concern = await db.parent_concerns.find_one({"concern_id": concern_id}, {"_id": 0})
    if concern:
        await send_notification(db, concern["raised_by"], {
            "type": "concern_response",
            "title": "Concern Update",
            "message": f"Your concern about {concern.get('student_name', '')} has been responded to",
            "reference_type": "concern", "reference_id": concern_id,
        })
    return {"message": "Response added"}


@router.put("/concerns/{concern_id}")
async def update_concern(concern_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*MGMT_ROLES))):
    updates = {}
    for f in ["subject", "category", "description", "notes", "status"]:
        if f in data:
            updates[f] = data[f]
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.parent_concerns.update_one({"concern_id": concern_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Concern not found")
    return {"message": "Concern updated"}


@router.delete("/concerns/{concern_id}")
async def delete_concern(concern_id: str, user: dict = Depends(require_roles(*MGMT_ROLES))):
    result = await db.parent_concerns.delete_one({"concern_id": concern_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Concern not found")
    return {"message": "Concern deleted"}


# ─── BOOSTER LESSONS ───
@router.post("/lessons")
async def book_booster_lesson(data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Book a booster lesson for a student (by parent or management)."""
    now = datetime.now(timezone.utc).isoformat()
    active_term, active_year = await get_active_term()
    lesson_id = gen_id("bst_")
    doc = {
        "lesson_id": lesson_id,
        "student_id": data.get("student_id", ""),
        "student_name": data.get("student_name", ""),
        "student_year": data.get("student_year", ""),
        "class_id": data.get("class_id", ""),
        "subject": data.get("subject", ""),
        "reason": data.get("reason", ""),
        "notes": data.get("notes", ""),
        "preferred_days": data.get("preferred_days", []),
        "booked_by": user["user_id"],
        "booked_by_name": user.get("name", ""),
        "booked_by_role": user.get("role", ""),
        "status": "requested",
        "teacher_id": data.get("teacher_id", ""),
        "teacher_name": data.get("teacher_name", ""),
        "term": active_term,
        "academic_year": active_year,
        "created_at": now,
        "updated_at": now,
    }
    await db.booster_lessons.insert_one(doc)
    doc.pop("_id", None)

    # Notify teacher if assigned
    if data.get("teacher_id"):
        await send_notification(db, data["teacher_id"], {
            "type": "booster_lesson",
            "title": "New Booster Lesson Request",
            "message": f"{data.get('student_name', '')} needs extra help in {data.get('subject', '')}",
            "reference_type": "booster_lesson", "reference_id": lesson_id,
        })

    # Notify management
    mgmt = await db.users.find({"role": {"$in": list(MGMT_ROLES)}}, {"_id": 0, "user_id": 1}).to_list(20)
    for m in mgmt:
        await send_notification(db, m["user_id"], {
            "type": "booster_lesson",
            "title": "Booster Lesson Booked",
            "message": f"{data.get('student_name', '')} - {data.get('subject', '')}",
            "reference_type": "booster_lesson", "reference_id": lesson_id,
        })
    return doc


@router.get("/lessons")
async def list_booster_lessons(status: str = None, student_id: str = None, class_id: str = None, teacher_id: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if user.get("role") == "Parent":
        query["booked_by"] = user["user_id"]
    elif user.get("role") == "Teacher":
        query["teacher_id"] = user["user_id"]
    if status:
        query["status"] = status
    if student_id:
        query["student_id"] = student_id
    if class_id:
        query["class_id"] = class_id
    if teacher_id:
        query["teacher_id"] = teacher_id
    lessons = await db.booster_lessons.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return lessons


@router.put("/lessons/{lesson_id}")
async def update_booster_lesson(lesson_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Update a booster lesson.
    - Management roles can update all fields.
    - The assigned teacher can only update: status, notes, preferred_days (progress-type fields).
    """
    existing = await db.booster_lessons.find_one({"lesson_id": lesson_id}, {"_id": 0, "teacher_id": 1})
    if not existing:
        raise HTTPException(status_code=404, detail="Booster lesson not found")

    role = user.get("role", "")
    roles = user.get("roles", []) or []
    is_mgmt = role in MGMT_ROLES or any(r in MGMT_ROLES for r in roles)
    is_assigned_teacher = existing.get("teacher_id") == user.get("user_id")

    if not is_mgmt and not is_assigned_teacher:
        raise HTTPException(status_code=403, detail="Only management or the assigned teacher can update this lesson")

    allowed_fields = {"status", "teacher_id", "teacher_name", "notes", "preferred_days"}
    if not is_mgmt:
        # Teacher can't reassign
        allowed_fields = {"status", "notes", "preferred_days"}

    updates = {k: v for k, v in data.items() if k in allowed_fields}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.booster_lessons.update_one({"lesson_id": lesson_id}, {"$set": updates})
    return {"message": "Booster lesson updated"}


@router.post("/lessons/{lesson_id}/comment")
async def comment_on_booster(lesson_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Add a comment to a booster lesson. Only the assigned teacher or management can comment."""
    message = (data.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    lesson = await db.booster_lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Booster lesson not found")

    role = user.get("role", "")
    roles = user.get("roles", []) or []
    is_mgmt = role in MGMT_ROLES or any(r in MGMT_ROLES for r in roles)
    is_teacher = role == "Teacher" or "Teacher" in roles
    is_assigned_teacher = lesson.get("teacher_id") == user.get("user_id")
    if not (is_mgmt or is_assigned_teacher or is_teacher):
        raise HTTPException(status_code=403, detail="Not authorized to comment on this lesson")

    now = datetime.now(timezone.utc).isoformat()
    comment = {
        "comment_id": gen_id("bcm_"),
        "message": message,
        "by": user.get("name", ""),
        "by_id": user.get("user_id", ""),
        "role": role,
        "at": now,
    }
    await db.booster_lessons.update_one(
        {"lesson_id": lesson_id},
        {"$push": {"comments": comment}, "$set": {"updated_at": now}},
    )

    # Notify the other party (management or assigned teacher)
    notify_ids = set()
    if lesson.get("teacher_id") and lesson.get("teacher_id") != user.get("user_id"):
        notify_ids.add(lesson["teacher_id"])
    if lesson.get("booked_by") and lesson.get("booked_by") != user.get("user_id"):
        notify_ids.add(lesson["booked_by"])
    # Also notify all management so HoDs see feedback
    mgmt = await db.users.find(
        {"$or": [{"role": {"$in": list(MGMT_ROLES)}}, {"roles": {"$in": list(MGMT_ROLES)}}]},
        {"_id": 0, "user_id": 1}
    ).to_list(30)
    for m in mgmt:
        if m["user_id"] != user.get("user_id"):
            notify_ids.add(m["user_id"])
    for uid in notify_ids:
        await send_notification(db, uid, {
            "type": "booster_comment",
            "title": f"Booster update: {lesson.get('student_name','')}",
            "message": f"{user.get('name','')}: {message[:100]}",
            "reference_type": "booster_lesson", "reference_id": lesson_id,
        })

    return comment


@router.delete("/lessons/{lesson_id}")
async def delete_booster_lesson(lesson_id: str, user: dict = Depends(require_roles(*MGMT_ROLES))):
    result = await db.booster_lessons.delete_one({"lesson_id": lesson_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return {"message": "Booster lesson deleted"}


@router.get("/lessons/by-class/{class_id}")
async def booster_students_for_class(class_id: str, user: dict = Depends(require_roles(*TEACHER_ROLES))):
    """Get all students with active booster lessons in a class — for teachers."""
    lessons = await db.booster_lessons.find(
        {"class_id": class_id, "status": {"$in": ["requested", "approved", "in_progress"]}},
        {"_id": 0}
    ).sort("student_name", 1).to_list(100)
    return lessons


# ─── SEARCH STUDENTS ───
@router.get("/concerns/by-class/{class_id}")
async def concerns_for_class(class_id: str, user: dict = Depends(require_roles(*TEACHER_ROLES))):
    """Get open concerns for students in a class — for teachers."""
    # First get student IDs in this class
    students = await db.users.find(
        {"role": "Student", "class_id": class_id},
        {"_id": 0, "user_id": 1}
    ).to_list(200)
    student_ids = [s["user_id"] for s in students]
    if not student_ids:
        return []
    concerns = await db.parent_concerns.find(
        {"student_id": {"$in": student_ids}, "status": {"$in": ["open", "in_progress"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return concerns


@router.get("/students/search")
async def search_students_booster(q: str = "", user: dict = Depends(get_current_user)):
    if not q or len(q) < 2:
        return []
    query = {
        "role": "Student",
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"admission_number": {"$regex": q, "$options": "i"}},
        ]
    }
    students = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(20)
    return students


@router.get("/teachers/search")
async def search_teachers(q: str = "", user: dict = Depends(get_current_user)):
    if not q or len(q) < 2:
        return []
    # Search Teachers AND anyone with management / academic-leadership roles
    # (either as primary `role` or in the secondary `roles` array).
    ASSIGNABLE_ROLES = [
        "Teacher", "HeadTeacher", "HeadOfAcademics", "Principal",
        "CEO", "Founder", "Admin", "SuperAdmin",
    ]
    query = {
        "name": {"$regex": q, "$options": "i"},
        "$or": [
            {"role": {"$in": ASSIGNABLE_ROLES}},
            {"roles": {"$in": ASSIGNABLE_ROLES}},
        ],
    }
    teachers = await db.users.find(
        query,
        {"_id": 0, "password_hash": 0}
    ).to_list(30)
    return teachers
