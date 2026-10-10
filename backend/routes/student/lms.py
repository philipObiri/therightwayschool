from fastapi import APIRouter, Depends, HTTPException, Body
from database import db, get_active_term
from models import LessonCreate, LessonResponse, gen_id
from auth import get_current_user, require_roles, log_audit
from ws_manager import send_notification
from routes.working_papers.working_paper import log_activity
from datetime import datetime, timezone

router = APIRouter(prefix="/api/lms", tags=["lms"])


@router.get("/lessons")
async def list_lessons(
    subject_id: str = None,
    teacher_id: str = None,
    class_id: str = None,
    published: bool = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if subject_id:
        query["subject_id"] = subject_id
    if teacher_id:
        query["teacher_id"] = teacher_id
    if class_id:
        query["class_ids"] = class_id
    if published is not None:
        query["published"] = published

    # Auto-filter by active term
    active_term, _ = await get_active_term()
    query["term"] = active_term

    # Students only see published lessons
    if user.get("role") == "Student":
        query["published"] = True
        if user.get("class_id"):
            query["class_ids"] = user["class_id"]

    lessons = await db.lessons.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

    # Batch fetch subjects and teachers
    subj_ids = list({l.get("subject_id") for l in lessons})
    teacher_ids = list({l.get("teacher_id") for l in lessons})
    subjects_list = await db.subjects.find({"subject_id": {"$in": subj_ids}}, {"_id": 0}).to_list(len(subj_ids))
    teachers_list = await db.users.find({"user_id": {"$in": teacher_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(teacher_ids))
    subj_map = {s["subject_id"]: s for s in subjects_list}
    teacher_map = {t["user_id"]: t for t in teachers_list}

    for lesson in lessons:
        subj = subj_map.get(lesson.get("subject_id"))
        teacher = teacher_map.get(lesson.get("teacher_id"))
        lesson["subject_name"] = subj["name"] if subj else ""
        lesson["teacher_name"] = teacher["name"] if teacher else ""
    return lessons


@router.post("/lessons")
async def create_lesson(
    data: dict,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "Teacher", "HeadTeacher", "Principal", "HeadOfAcademics", "HoD", "CEO"))
):
    is_published = data.get("published", True)
    active_term, active_year = await get_active_term()
    doc = {
        "lesson_id": gen_id("les_"),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "objectives": data.get("objectives", ""),
        "subject_id": data.get("subject_id", ""),
        "class_ids": data.get("class_ids", []),
        "teacher_id": user["user_id"],
        "teacher_name": user["name"],
        "lesson_type": data.get("lesson_type", "mixed"),
        "content_url": data.get("content_url", ""),
        "extra_links": data.get("extra_links", []),
        "content_text": data.get("content_text", ""),
        "thumbnail_url": data.get("thumbnail_url", ""),
        "file_ids": data.get("file_ids", []),
        "tags": data.get("tags", []),
        "term": data.get("term", "") or active_term,
        "academic_year": data.get("academic_year", "") or active_year,
        "duration_minutes": data.get("duration_minutes", 45),
        "published": is_published,
        "submitted_to_management": is_published,
        "submission_status": "pending" if is_published else "",
        "submitted_at": datetime.now(timezone.utc).isoformat() if is_published else "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lessons.insert_one(doc)

    # Auto-notify management when published
    if is_published:
        mgmt = await db.users.find(
            {"role": {"$in": ["HeadTeacher", "Principal", "CEO"]}},
            {"_id": 0, "user_id": 1}
        ).to_list(10)
        for m in mgmt:
            await send_notification(db, m["user_id"], {
                "type": "lesson_submitted",
                "title": f"New Lesson: {doc['title']}",
                "message": f"{user['name']} published a lesson pending your approval.",
                "reference_type": "lesson", "reference_id": doc["lesson_id"],
                "action_url": "/admin/lesson-approvals",
            })

    await log_audit(user["user_id"], user["name"], "create_lesson", "lesson", doc["lesson_id"])
    await log_activity(user["user_id"], user["name"], "create_lesson", f"Created lesson: {doc['title']}", "lesson", doc["lesson_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/lessons/pending-approval")
async def pending_approval_lessons(user: dict = Depends(require_roles("SuperAdmin", "Admin", "HeadTeacher", "Principal", "CEO"))):
    """Get all lessons submitted for management approval."""
    lessons = await db.lessons.find(
        {"submitted_to_management": True},
        {"_id": 0}
    ).sort("submitted_at", -1).to_list(500)

    # Bulk fetch subjects, teachers, and classes to avoid N+1
    subj_ids = list({l.get("subject_id") for l in lessons if l.get("subject_id")})
    teacher_ids = list({l.get("teacher_id") for l in lessons if l.get("teacher_id")})
    all_class_ids = list({cid for l in lessons for cid in l.get("class_ids", [])})
    subjects = await db.subjects.find({"subject_id": {"$in": subj_ids}}, {"_id": 0, "subject_id": 1, "name": 1}).to_list(len(subj_ids)) if subj_ids else []
    teachers = await db.users.find({"user_id": {"$in": teacher_ids}}, {"_id": 0, "user_id": 1, "name": 1, "department": 1}).to_list(len(teacher_ids)) if teacher_ids else []
    classes = await db.classes.find({"class_id": {"$in": all_class_ids}}, {"_id": 0, "class_id": 1, "name": 1}).to_list(len(all_class_ids)) if all_class_ids else []
    subj_map = {s["subject_id"]: s for s in subjects}
    teacher_map = {t["user_id"]: t for t in teachers}
    class_map = {c["class_id"]: c for c in classes}

    for l in lessons:
        subj = subj_map.get(l.get("subject_id"))
        l["subject_name"] = subj["name"] if subj else ""
        teacher = teacher_map.get(l.get("teacher_id"))
        l["teacher_name"] = teacher["name"] if teacher else ""
        l["teacher_department"] = teacher.get("department", "") if teacher else ""
        l["class_names"] = [class_map[cid]["name"] for cid in l.get("class_ids", []) if cid in class_map]
    return lessons


@router.get("/lessons/{lesson_id}")
async def get_lesson(lesson_id: str, user: dict = Depends(get_current_user)):
    lesson = await db.lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    subj = await db.subjects.find_one({"subject_id": lesson.get("subject_id")}, {"_id": 0})
    teacher = await db.users.find_one({"user_id": lesson.get("teacher_id")}, {"_id": 0})
    lesson["subject_name"] = subj["name"] if subj else ""
    lesson["teacher_name"] = teacher["name"] if teacher else ""

    # Track progress for students
    if user.get("role") == "Student":
        await db.lesson_progress.update_one(
            {"lesson_id": lesson_id, "student_id": user["user_id"]},
            {"$set": {
                "lesson_id": lesson_id,
                "student_id": user["user_id"],
                "last_viewed": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    return lesson


@router.put("/lessons/{lesson_id}")
async def update_lesson(
    lesson_id: str,
    data: dict = Body(...),
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "Teacher", "HeadOfAcademics", "HoD", "HeadTeacher", "CEO", "Principal"))
):
    existing = await db.lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lesson not found")

    safe_fields = {"title", "description", "content_text", "content_url", "lesson_type", "class_ids", "subject_id", "tags", "published", "thumbnail_url"}
    update_data = {k: v for k, v in data.items() if k in safe_fields}
    if update_data:
        await db.lessons.update_one({"lesson_id": lesson_id}, {"$set": update_data})
    await log_audit(user["user_id"], user["name"], "update_lesson", "lesson", lesson_id)
    return {"message": "Lesson updated"}


@router.delete("/lessons/{lesson_id}")
async def delete_lesson(
    lesson_id: str,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "Teacher"))
):
    result = await db.lessons.delete_one({"lesson_id": lesson_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lesson not found")
    await log_audit(user["user_id"], user["name"], "delete_lesson", "lesson", lesson_id)
    return {"message": "Lesson deleted"}



# â”€â”€â”€ Submit Lesson to Management â”€â”€â”€
@router.post("/lessons/{lesson_id}/submit-to-management")
async def submit_to_management(lesson_id: str, user: dict = Depends(get_current_user)):
    lesson = await db.lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    await db.lessons.update_one(
        {"lesson_id": lesson_id},
        {"$set": {"submitted_to_management": True, "submission_status": "submitted",
                  "submitted_at": datetime.now(timezone.utc).isoformat()}}
    )
    # Notify management
    mgmt = await db.users.find({"role": {"$in": ["HeadTeacher", "Principal", "CEO"]}}, {"_id": 0, "user_id": 1}).to_list(10)
    for m in mgmt:
        await send_notification(db, m["user_id"], {
            "type": "lesson_submitted", "title": f"Lesson Submitted: {lesson['title']}",
            "message": f"{user['name']} submitted a lesson for review.",
            "reference_type": "lesson", "reference_id": lesson_id,
            "action_url": "/admin/lesson-approvals",
        })
    await log_audit(user["user_id"], user["name"], "submit_lesson_mgmt", "lesson", lesson_id)
    return {"message": "Lesson submitted to management for review"}


@router.post("/lessons/{lesson_id}/review")
async def review_lesson(lesson_id: str, data: dict = None, user: dict = Depends(require_roles("SuperAdmin", "Admin", "HeadTeacher", "Principal", "CEO"))):
    data = data or {}
    status = "approved" if data.get("approved", True) else "returned"
    lesson = await db.lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    await db.lessons.update_one(
        {"lesson_id": lesson_id},
        {"$set": {"submission_status": status, "review_feedback": data.get("feedback", ""),
                  "reviewed_by": user["user_id"], "reviewed_at": datetime.now(timezone.utc).isoformat()}}
    )
    # Notify teacher
    if lesson and lesson.get("teacher_id"):
        action = "approved" if status == "approved" else "returned for revision"
        feedback = data.get("feedback", "")
        await send_notification(db, lesson["teacher_id"], {
            "type": "lesson_reviewed",
            "title": f"Lesson {status.title()}: {lesson.get('title', '')}",
            "message": f"{user['name']} has {action} your lesson.{(' Feedback: ' + feedback) if feedback else ''}",
            "reference_type": "lesson", "reference_id": lesson_id,
            "action_url": "/teacher/lessons",
        })
    return {"message": f"Lesson {status}"}


@router.post("/lessons/{lesson_id}/resubmit")
async def resubmit_lesson(lesson_id: str, user: dict = Depends(get_current_user)):
    """Teacher resubmits a returned lesson after editing."""
    lesson = await db.lessons.find_one({"lesson_id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if lesson.get("submission_status") != "returned":
        raise HTTPException(status_code=400, detail="Only returned lessons can be resubmitted")
    await db.lessons.update_one(
        {"lesson_id": lesson_id},
        {"$set": {"submission_status": "submitted", "submitted_at": datetime.now(timezone.utc).isoformat()}}
    )
    # Notify management
    mgmt = await db.users.find({"role": {"$in": ["HeadTeacher", "Principal", "CEO"]}}, {"_id": 0, "user_id": 1}).to_list(10)
    for m in mgmt:
        await send_notification(db, m["user_id"], {
            "type": "lesson_submitted", "title": f"Lesson Resubmitted: {lesson['title']}",
            "message": f"{user['name']} resubmitted a lesson for review.",
            "reference_type": "lesson", "reference_id": lesson_id,
            "action_url": "/admin/lesson-approvals",
        })
    await log_audit(user["user_id"], user["name"], "resubmit_lesson", "lesson", lesson_id)
    return {"message": "Lesson resubmitted for review"}


# â”€â”€â”€ Resources (Tests, Past Papers, Syllabus) â”€â”€â”€
@router.get("/resources")
async def list_resources(
    resource_type: str = None, subject_id: str = None,
    teacher_id: str = None, user: dict = Depends(get_current_user)
):
    query = {}
    if resource_type:
        query["resource_type"] = resource_type
    if subject_id:
        query["subject_id"] = subject_id
    if teacher_id:
        query["teacher_id"] = teacher_id
    elif user.get("role") == "Teacher":
        query["teacher_id"] = user["user_id"]
    resources = await db.lms_resources.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)

    # Bulk fetch subjects and teachers to avoid N+1
    res_subj_ids = list({r.get("subject_id") for r in resources if r.get("subject_id")})
    res_teacher_ids = list({r.get("teacher_id") for r in resources if r.get("teacher_id")})
    res_subjects = await db.subjects.find({"subject_id": {"$in": res_subj_ids}}, {"_id": 0, "subject_id": 1, "name": 1}).to_list(len(res_subj_ids)) if res_subj_ids else []
    res_teachers = await db.users.find({"user_id": {"$in": res_teacher_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(res_teacher_ids)) if res_teacher_ids else []
    res_subj_map = {s["subject_id"]: s for s in res_subjects}
    res_teacher_map = {t["user_id"]: t for t in res_teachers}

    for r in resources:
        subj = res_subj_map.get(r.get("subject_id"))
        r["subject_name"] = subj["name"] if subj else ""
        teacher = res_teacher_map.get(r.get("teacher_id"))
        r["teacher_name"] = teacher["name"] if teacher else ""
    return resources


@router.post("/resources")
async def create_resource(data: dict, user: dict = Depends(get_current_user)):
    doc = {
        "resource_id": gen_id("res_"), "title": data.get("title", ""),
        "description": data.get("description", ""),
        "resource_type": data.get("resource_type", "past_paper"),  # past_paper, test, syllabus, worksheet, other
        "subject_id": data.get("subject_id", ""),
        "class_id": data.get("class_id", ""),
        "term": data.get("term", ""),
        "year_group": data.get("year_group", ""),
        "file_ids": data.get("file_ids", []),
        "content_url": data.get("content_url", ""),
        "content_text": data.get("content_text", ""),
        "rich_content": data.get("rich_content", ""),
        "teacher_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lms_resources.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "create_resource", "resource", doc["resource_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/resources/{resource_id}")
async def delete_resource(resource_id: str, user: dict = Depends(get_current_user)):
    await db.lms_resources.delete_one({"resource_id": resource_id})
    return {"message": "Resource deleted"}


@router.put("/resources/{resource_id}")
async def update_resource(resource_id: str, data: dict, user: dict = Depends(get_current_user)):
    resource = await db.lms_resources.find_one({"resource_id": resource_id}, {"_id": 0})
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    safe_fields = {"title", "description", "resource_type", "subject_id", "content_url",
                   "content_text", "file_ids", "rich_content"}
    update_data = {k: v for k, v in data.items() if k in safe_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.lms_resources.update_one({"resource_id": resource_id}, {"$set": update_data})
    await log_audit(user["user_id"], user["name"], "update_resource", "resource", resource_id)
    updated = await db.lms_resources.find_one({"resource_id": resource_id}, {"_id": 0})
    return updated


@router.post("/resources/{resource_id}/publish")
async def publish_resource(resource_id: str, data: dict = None, user: dict = Depends(get_current_user)):
    """Publish a resource to specific classes so students can see it."""
    resource = await db.lms_resources.find_one({"resource_id": resource_id}, {"_id": 0})
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    class_ids = (data or {}).get("class_ids", [])
    await db.lms_resources.update_one({"resource_id": resource_id}, {"$set": {
        "published": True, "published_class_ids": class_ids,
        "published_at": datetime.now(timezone.utc).isoformat()
    }})

    # Notify students
    for cid in class_ids:
        students = await db.users.find({"role": "Student", "class_id": cid}, {"_id": 0, "user_id": 1}).to_list(200)
        for s in students:
            await send_notification(db, s["user_id"], {
                "type": "new_resource",
                "title": f"New Resource: {resource.get('title', '')}",
                "message": f"{user['name']} shared a {resource.get('resource_type', 'resource').replace('_',' ')} with your class.",
                "reference_type": "resource", "reference_id": resource_id,
                "action_url": "/student/resources",
            })

    await log_audit(user["user_id"], user["name"], "publish_resource", "resource", resource_id)
    return {"message": f"Resource published to {len(class_ids)} class(es)"}


@router.post("/resources/{resource_id}/unpublish")
async def unpublish_resource(resource_id: str, user: dict = Depends(get_current_user)):
    await db.lms_resources.update_one({"resource_id": resource_id}, {"$set": {"published": False, "published_class_ids": []}})
    return {"message": "Resource unpublished"}


@router.post("/resources/bulk-publish")
async def bulk_publish_resources(data: dict = None, user: dict = Depends(get_current_user)):
    """Publish all unpublished resources for this teacher to selected classes."""
    class_ids = (data or {}).get("class_ids", [])
    if not class_ids:
        raise HTTPException(status_code=400, detail="Select at least one class")

    query = {"teacher_id": user["user_id"], "published": {"$ne": True}}
    now = datetime.now(timezone.utc).isoformat()
    result = await db.lms_resources.update_many(query, {"$set": {
        "published": True, "published_class_ids": class_ids, "published_at": now
    }})
    count = result.modified_count

    # Notify students in bulk
    student_ids = set()
    for cid in class_ids:
        students = await db.users.find({"role": "Student", "class_id": cid}, {"_id": 0, "user_id": 1}).to_list(200)
        for s in students:
            student_ids.add(s["user_id"])
    for sid in student_ids:
        await send_notification(db, sid, {
            "type": "new_resource",
            "title": f"{count} New Resources Published",
            "message": f"{user['name']} published {count} resources to your class.",
            "reference_type": "resource", "reference_id": "",
            "action_url": "/student/resources",
        })

    await log_audit(user["user_id"], user["name"], "bulk_publish_resources", "resource", "", {"count": count, "class_ids": class_ids})
    return {"message": f"{count} resources published to {len(class_ids)} class(es)"}


@router.get("/resources/student")
async def student_resources(user: dict = Depends(get_current_user)):
    """Get resources published to the student's class."""
    class_id = user.get("class_id", "")
    resources = await db.lms_resources.find(
        {"published": True, "published_class_ids": class_id}, {"_id": 0}
    ).sort("published_at", -1).to_list(200)

    # Bulk fetch teachers to avoid N+1
    stu_teacher_ids = list({r.get("teacher_id") for r in resources if r.get("teacher_id")})
    stu_teachers = await db.users.find({"user_id": {"$in": stu_teacher_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(stu_teacher_ids)) if stu_teacher_ids else []
    stu_teacher_map = {t["user_id"]: t for t in stu_teachers}

    for r in resources:
        teacher = stu_teacher_map.get(r.get("teacher_id"))
        r["teacher_name"] = teacher["name"] if teacher else ""
    return resources
