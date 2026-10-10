from fastapi import APIRouter, Depends, HTTPException, Body
from database import db, get_active_term
from models import DashboardStats, gen_id, StudentCreate
from auth import get_current_user, require_roles, log_audit, hash_password
from ws_manager import send_notification
from datetime import datetime, timezone
from routes.approval_chain import (
    get_current_step_index, can_user_approve_step, get_user_all_roles, APPROVAL_CHAIN
)
from routes.academic.gradebook import grade_letter, grade_remark


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/dashboard")
async def dashboard_stats(user: dict = Depends(require_roles("SuperAdmin", "Admin", "CEO", "Founder", "Principal", "HeadTeacher", "Receptionist", "Nurse"))):
    students = await db.users.count_documents({"role": "Student"})
    teachers = await db.users.count_documents({"role": "Teacher"})
    staff = await db.users.count_documents({"role": {"$nin": ["Student", "Parent"]}})
    classes = await db.classes.count_documents({})
    subjects = await db.subjects.count_documents({})
    lessons = await db.lessons.count_documents({})
    assignments = await db.assignments.count_documents({})
    # Financial summary from finance_v2 (modern collection)
    invoices_v2 = await db.invoices_v2.find({}, {"_id": 0, "total_due": 1, "amount_paid": 1, "status": 1}).to_list(5000)
    total_payments = sum(i.get("amount_paid", 0) for i in invoices_v2)
    outstanding = sum(max(0, i.get("total_due", 0) - i.get("amount_paid", 0)) for i in invoices_v2)
    invoices_count = len(invoices_v2)

    # Recent activity
    recent_logs = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(10)

    return {
        "total_students": students,
        "total_teachers": teachers,
        "total_staff": staff,
        "total_classes": classes,
        "total_subjects": subjects,
        "total_lessons": lessons,
        "total_assignments": assignments,
        "total_invoices": invoices_count,
        "total_payments": total_payments,
        "outstanding_fees": outstanding,
        "recent_activities": recent_logs
    }


MGMT_ROLES = ("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher", "Founder", "HeadOfAcademics")

@router.get("/dashboard-reviews")
async def dashboard_reviews(user: dict = Depends(get_current_user)):
    """Unified review data for dashboard. Management sees pending reviews, teachers see submission status."""
    uid = user["user_id"]
    user_roles = get_user_all_roles(user)
    is_mgmt = bool(user_roles & set(MGMT_ROLES))
    is_teacher = "Teacher" in user_roles or user.get("role") == "Teacher"

    result = {
        "pending_lesson_reviews": [],
        "pending_scheme_reviews": [],
        "my_lesson_submissions": [],
        "my_scheme_submissions": [],
        "recently_reviewed_lessons": [],
        "recently_reviewed_schemes": [],
    }

    projection = {"_id": 0, "rich_content": 0, "weeks": 0, "versions": 0}

    # Management: lessons & schemes pending MY review
    if is_mgmt:
        all_pending_lessons = await db.lessons_v2.find(
            {"status": {"$in": ["submitted", "under_review", "resubmitted"]}, "approval_chain": {"$exists": True}},
            projection,
        ).sort("submitted_at", -1).to_list(100)
        for item in all_pending_lessons:
            chain = item.get("approval_chain", [])
            idx = get_current_step_index(chain)
            if idx >= 0 and can_user_approve_step(user, chain[idx], chain):
                result["pending_lesson_reviews"].append(item)

        all_pending_schemes = await db.schemes.find(
            {"status": {"$in": ["submitted", "under_review", "resubmitted"]}, "approval_chain": {"$exists": True}},
            projection,
        ).sort("submitted_at", -1).to_list(100)
        for item in all_pending_schemes:
            chain = item.get("approval_chain", [])
            idx = get_current_step_index(chain)
            if idx >= 0 and can_user_approve_step(user, chain[idx], chain):
                result["pending_scheme_reviews"].append(item)

        # Recently reviewed by me (lessons I've acted on in the chain)
        recent_lessons = await db.lessons_v2.find(
            {"approval_chain.user_id": uid, "status": {"$in": ["under_review", "approved", "published", "returned"]}},
            projection,
        ).sort("updated_at", -1).to_list(10)
        result["recently_reviewed_lessons"] = recent_lessons

        recent_schemes = await db.schemes.find(
            {"approval_chain.user_id": uid, "status": {"$in": ["under_review", "approved", "published", "returned"]}},
            projection,
        ).sort("updated_at", -1).to_list(10)
        result["recently_reviewed_schemes"] = recent_schemes

    # Teacher / Staff: my submissions and their status
    if is_teacher or not is_mgmt:
        my_lessons = await db.lessons_v2.find(
            {"teacher_id": uid}, projection,
        ).sort("updated_at", -1).to_list(20)
        result["my_lesson_submissions"] = my_lessons

        my_schemes = await db.schemes.find(
            {"teacher_id": uid}, projection,
        ).sort("updated_at", -1).to_list(20)
        result["my_scheme_submissions"] = my_schemes

    return result



@router.get("/audit-logs")
async def get_audit_logs(
    entity_type: str = None,
    user_id: str = None,
    limit: int = 100,
    user: dict = Depends(require_roles("SuperAdmin", "Admin"))
):
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if user_id:
        query["user_id"] = user_id

    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs


@router.get("/students")
async def list_students(
    class_id: str = None,
    year_group: str = None,
    user: dict = Depends(get_current_user)
):
    query = {"role": "Student"}
    if class_id:
        query["class_id"] = class_id
    if year_group:
        query["year_group"] = year_group

    students = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(1000)
    # Batch fetch class names
    class_ids = list({s.get("class_id") for s in students if s.get("class_id")})
    classes_list = await db.classes.find({"class_id": {"$in": class_ids}}, {"_id": 0}).to_list(len(class_ids))
    cls_map = {c["class_id"]: c["name"] for c in classes_list}
    for s in students:
        s["class_name"] = cls_map.get(s.get("class_id", ""), "")
    return students


@router.post("/students")
async def create_student(
    data: StudentCreate,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "AdmissionsOfficer"))
):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    user_id = gen_id("user_")
    doc = {
        "user_id": user_id,
        "email": data.email,
        "name": data.name,
        "password_hash": hash_password("student123"),  # Default password
        "role": "Student",
        "picture": "",
        "phone": data.phone,
        "department": "",
        "is_active": True,
        "admission_number": data.admission_number or gen_id("ADM"),
        "class_id": data.class_id,
        "year_group": data.year_group,
        "boarding_status": data.boarding_status,
        "date_of_birth": data.date_of_birth,
        "guardian_ids": data.guardian_ids,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "create_student", "student", user_id)
    return {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}


@router.get("/students/{student_id}")
async def get_student(student_id: str, user: dict = Depends(get_current_user)):
    student = await db.users.find_one({"user_id": student_id, "role": "Student"}, {"_id": 0, "password_hash": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.get("class_id"):
        cls = await db.classes.find_one({"class_id": student["class_id"]}, {"_id": 0})
        student["class_name"] = cls["name"] if cls else ""
    else:
        student["class_name"] = ""
    # Get enrolled subjects - batch fetch
    student["subject_ids"] = student.get("subject_ids", [])
    subjects_list = await db.subjects.find({"subject_id": {"$in": student.get("subject_ids", [])}}, {"_id": 0}).to_list(20)
    student["subjects"] = [{"subject_id": s["subject_id"], "name": s["name"], "code": s.get("code", "")} for s in subjects_list]
    return student


@router.put("/students/{student_id}")
async def update_student(student_id: str, data: dict, user: dict = Depends(require_roles("SuperAdmin", "Admin", "AdmissionsOfficer"))):
    safe_fields = {"name", "phone", "class_id", "year_group", "boarding_status", "date_of_birth", "is_active", "subject_ids", "admission_number", "email"}
    update_data = {k: v for k, v in data.items() if k in safe_fields}
    # Validate subject count
    if "subject_ids" in update_data:
        sids = update_data["subject_ids"]
        if len(sids) < 3:
            raise HTTPException(status_code=400, detail="Minimum 3 subjects required")
        if len(sids) > 12:
            raise HTTPException(status_code=400, detail="Maximum 12 subjects allowed")
    # Validate email uniqueness
    if "email" in update_data and update_data["email"]:
        dup = await db.users.find_one({"email": update_data["email"], "user_id": {"$ne": student_id}}, {"_id": 0, "user_id": 1})
        if dup:
            raise HTTPException(status_code=400, detail="Email already in use by another account")
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    result = await db.users.update_one({"user_id": student_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")

    # If boarding status changed, notify finance
    if "boarding_status" in update_data:
        old_student = await db.users.find_one({"user_id": student_id}, {"_id": 0})
        await send_notification(db, "finance_team", {
            "type": "boarding_change",
            "title": f"Boarding Status Changed: {old_student.get('name', '')}",
            "message": f"Student boarding status changed to '{update_data['boarding_status']}'. Fee structure may need adjustment.",
            "reference_type": "student", "reference_id": student_id,
            "action_url": "",
        })

    await log_audit(user["user_id"], user["name"], "update_student", "student", student_id, update_data)
    return {"message": "Student updated"}


@router.delete("/students/{student_id}")
async def delete_student(student_id: str, user: dict = Depends(require_roles("SuperAdmin", "Admin", "CEO", "Founder", "HeadTeacher"))):
    """Permanently delete a student and their related data."""
    student = await db.users.find_one({"user_id": student_id, "role": "Student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    await db.users.delete_one({"user_id": student_id})
    # Clean up related data
    await db.invoices_v2.delete_many({"student_id": student_id})
    await db.payments_v2.delete_many({"student_id": student_id})
    await db.invoice_line_items.delete_many({"student_id": student_id})
    await db.allocations.delete_many({"student_id": student_id})
    await db.reconciliation.delete_many({"student_id": student_id})
    await db.grades.delete_many({"student_id": student_id})
    await db.quiz_submissions.delete_many({"student_id": student_id})
    await log_audit(user["user_id"], user["name"], "delete_student", "student", student_id, {"name": student.get("name", "")})
    return {"message": f"Student '{student.get('name', '')}' deleted"}


@router.get("/students-by-year")
async def students_by_year(user: dict = Depends(get_current_user)):
    """Get student counts per year group."""
    year_groups = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13"]
    result = []
    for yg in year_groups:
        count = await db.users.count_documents({"role": "Student", "year_group": yg})
        result.append({"year_group": yg, "count": count})
    return result


@router.post("/seed-real-students")
async def seed_real_students(user: dict = Depends(require_roles("SuperAdmin", "Admin"))):
    """Replace dummy students with real student data from TCIS records."""
    from student_data import STUDENTS_DATA

    # Remove old students
    await db.users.delete_many({"role": "Student"})

    # Get classes for assignment
    classes = await db.classes.find({}, {"_id": 0}).to_list(50)
    class_map = {}
    for c in classes:
        class_map[c["year_group"]] = c["class_id"]

    # Get subjects for default assignment
    subjects = await db.subjects.find({}, {"_id": 0, "subject_id": 1}).to_list(50)
    default_subject_ids = [s["subject_id"] for s in subjects[:6]]  # First 6 subjects as default

    total = 0
    for year_group, names in STUDENTS_DATA.items():
        class_id = class_map.get(year_group, "")
        for i, name in enumerate(names):
            email_name = name.lower().replace(" ", ".").replace("'", "").replace("-", "")[:30]
            uid = gen_id("user_")
            doc = {
                "user_id": uid,
                "email": f"{email_name}@tcis.student",
                "name": name,
                "password_hash": hash_password("student123"),
                "role": "Student",
                "picture": "",
                "phone": "",
                "department": "",
                "is_active": True,
                "admission_number": f"TCIS{2025000 + total + 1}",
                "class_id": class_id,
                "year_group": year_group,
                "boarding_status": "day",
                "date_of_birth": "",
                "guardian_ids": [],
                "subject_ids": default_subject_ids[:6],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(doc)
            total += 1

    await log_audit(user["user_id"], user["name"], "seed_real_students", "system", "", {"total": total})
    return {"message": f"Seeded {total} real students across {len(STUDENTS_DATA)} year groups", "total": total}


@router.get("/staff")
async def list_staff(
    role: str = None,
    department: str = None,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "HR_Officer", "CEO", "Founder", "Principal", "HeadTeacher"))
):
    query = {"role": {"$nin": ["Student", "Parent"]}}
    if role:
        query["role"] = role
    if department:
        query["department"] = department

    staff = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(500)
    # Only show last_set_password to SuperAdmin/CEO
    if user.get("role") not in ("SuperAdmin", "CEO"):
        for s in staff:
            s.pop("last_set_password", None)
    return staff



@router.get("/staff/{user_id}/activity")
async def staff_activity(user_id: str, user: dict = Depends(require_roles("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher"))):
    """Get comprehensive activity for a staff member: lessons, assignments, resources, attendance, logs."""
    staff = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    lessons = await db.lessons.find({"teacher_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    # Bulk fetch subject names
    subj_ids = list({l.get("subject_id") for l in lessons if l.get("subject_id")})
    subjs = await db.subjects.find({"subject_id": {"$in": subj_ids}}, {"_id": 0}).to_list(len(subj_ids)) if subj_ids else []
    subj_map = {s["subject_id"]: s["name"] for s in subjs}
    for l in lessons:
        l["subject_name"] = subj_map.get(l.get("subject_id"), "")

    assignments = await db.assignments.find({"teacher_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for a in assignments:
        a["subject_name"] = subj_map.get(a.get("subject_id"), "")
        a["submission_count"] = await db.submissions.count_documents({"assignment_id": a["assignment_id"]})

    resources = await db.lms_resources.find({"teacher_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)

    attendance_records = await db.attendance.count_documents({"teacher_id": user_id})

    logs = await db.audit_logs.find({"user_id": user_id}, {"_id": 0}).sort("timestamp", -1).to_list(50)

    cpd_enrolments = await db.cpd_enrolments.find({"user_id": user_id}, {"_id": 0}).to_list(20)

    return {
        "staff": staff,
        "lessons": lessons,
        "assignments": assignments,
        "resources": resources,
        "attendance_count": attendance_records,
        "audit_logs": logs,
        "cpd_enrolments": cpd_enrolments,
    }


@router.post("/staff/{user_id}/lessons/{lesson_id}/comment")
async def comment_on_lesson(user_id: str, lesson_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Add a review comment on a lesson. Any authenticated user can comment."""
    comment = {
        "comment_id": gen_id("cmt_"),
        "lesson_id": lesson_id,
        "teacher_id": user_id,
        "commenter_id": user["user_id"],
        "commenter_name": user["name"],
        "commenter_role": user["role"],
        "text": data.get("text", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lesson_comments.insert_one(comment)

    # Notify the other party
    notify_id = user_id if user["user_id"] != user_id else None
    if not notify_id:
        # Teacher commented - notify admins who previously commented
        prev = await db.lesson_comments.find({"lesson_id": lesson_id, "commenter_id": {"$ne": user["user_id"]}}, {"_id": 0, "commenter_id": 1}).to_list(20)
        notify_ids = list({p["commenter_id"] for p in prev})
    else:
        notify_ids = [notify_id]

    for nid in notify_ids:
        await send_notification(db, nid, {
            "type": "lesson_comment",
            "title": "New comment on lesson",
            "message": f"{user['name']} ({user['role']}): {data.get('text', '')[:80]}",
            "reference_type": "lesson", "reference_id": lesson_id,
            "action_url": "/teacher/lessons" if nid == user_id else "/admin/staff",
        })

    return {k: v for k, v in comment.items() if k != "_id"}


@router.get("/staff/{user_id}/lessons/{lesson_id}/comments")
async def get_lesson_comments(user_id: str, lesson_id: str, user: dict = Depends(get_current_user)):
    comments = await db.lesson_comments.find({"lesson_id": lesson_id}, {"_id": 0}).sort("created_at", 1).to_list(50)
    return comments


@router.post("/comments/{entity_type}/{entity_id}")
async def add_comment(entity_type: str, entity_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Add a comment on any entity (lesson, assignment, resource). Any user can comment."""
    comment = {
        "comment_id": gen_id("cmt_"),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "commenter_id": user["user_id"],
        "commenter_name": user["name"],
        "commenter_role": user["role"],
        "text": data.get("text", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.comments.insert_one(comment)

    # Find owner to notify
    owner_id = None
    if entity_type == "lesson":
        doc = await db.lessons.find_one({"lesson_id": entity_id}, {"_id": 0, "teacher_id": 1})
        owner_id = doc.get("teacher_id") if doc else None
    elif entity_type == "assignment":
        doc = await db.assignments.find_one({"assignment_id": entity_id}, {"_id": 0, "teacher_id": 1})
        owner_id = doc.get("teacher_id") if doc else None

    # Notify owner + all previous commenters (except self)
    notify_ids = set()
    if owner_id and owner_id != user["user_id"]:
        notify_ids.add(owner_id)
    prev = await db.comments.find({"entity_type": entity_type, "entity_id": entity_id, "commenter_id": {"$ne": user["user_id"]}}, {"_id": 0, "commenter_id": 1}).to_list(20)
    notify_ids.update(p["commenter_id"] for p in prev)

    for nid in notify_ids:
        await send_notification(db, nid, {
            "type": f"{entity_type}_comment",
            "title": f"New comment on {entity_type}",
            "message": f"{user['name']}: {data.get('text', '')[:80]}",
            "reference_type": entity_type, "reference_id": entity_id,
            "action_url": "/teacher/lessons",
        })

    return {k: v for k, v in comment.items() if k != "_id"}


@router.get("/comments/{entity_type}/{entity_id}")
async def get_comments(entity_type: str, entity_id: str, user: dict = Depends(get_current_user)):
    comments = await db.comments.find({"entity_type": entity_type, "entity_id": entity_id}, {"_id": 0}).sort("created_at", 1).to_list(50)
    return comments


@router.post("/seed")
async def seed_data(user: dict = Depends(require_roles("SuperAdmin", "Admin"))):
    """Seed demo data for the platform."""
    return await _seed_demo_data(user["user_id"], user["name"])


@router.post("/seed-public")
async def seed_data_public():
    """Public seed endpoint for initial setup."""
    # Clear all existing data first
    for col in ["users", "user_sessions", "subjects", "classes", "lessons", "assignments",
                "submissions", "attendance", "invoices", "payments", "mail_messages",
                "tasks", "task_time_entries", "audit_logs", "timetable", "clock_entries",
                "leave_requests", "lesson_plans", "observations", "live_sessions", "announcements"]:
        await db[col].delete_many({})
    return await _seed_demo_data("system", "System")


async def _seed_demo_data(actor_id: str, actor_name: str):
    # Create admin
    admin_id = gen_id("user_")
    admin_doc = {
        "user_id": admin_id, "email": "admin@tcis.demo",
        "name": "Kwame Mensah", "password_hash": hash_password("admin123"),
        "role": "Admin", "picture": "", "phone": "+233201234567",
        "department": "Administration", "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # Finance officer
    finance_id = gen_id("user_")
    finance_doc = {
        "user_id": finance_id, "email": "finance@tcis.demo",
        "name": "Abena Quartey", "password_hash": hash_password("finance123"),
        "role": "FinanceOfficer", "picture": "", "phone": "+233209876000",
        "department": "Finance", "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # HR officer
    hr_id = gen_id("user_")
    hr_doc = {
        "user_id": hr_id, "email": "hr@tcis.demo",
        "name": "Kofi Adjei", "password_hash": hash_password("hr123"),
        "role": "HR_Officer", "picture": "", "phone": "+233209876111",
        "department": "Human Resources", "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # Head of Academics
    hoa_id = gen_id("user_")
    hoa_doc = {
        "user_id": hoa_id, "email": "academics@tcis.demo",
        "name": "Dr. Ama Boateng", "password_hash": hash_password("hoa123"),
        "role": "HeadOfAcademics", "picture": "", "phone": "+233209876222",
        "department": "Academics", "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # Teachers
    teachers_data = [
        {"name": "Abena Osei", "email": "teacher@tcis.demo", "dept": "Mathematics"},
        {"name": "Kofi Asante", "email": "kofi.asante@tcis.demo", "dept": "Science"},
        {"name": "Ama Darko", "email": "ama.darko@tcis.demo", "dept": "English"},
        {"name": "Yaw Boateng", "email": "yaw.boateng@tcis.demo", "dept": "ICT"},
        {"name": "Akosua Mensah", "email": "akosua.mensah@tcis.demo", "dept": "Business"},
        {"name": "Kweku Appiah", "email": "kweku.appiah@tcis.demo", "dept": "Science"},
    ]
    teacher_ids = []
    teacher_docs = []
    for t in teachers_data:
        tid = gen_id("user_")
        teacher_ids.append(tid)
        teacher_docs.append({
            "user_id": tid, "email": t["email"], "name": t["name"],
            "password_hash": hash_password("teacher123"), "role": "Teacher",
            "picture": "", "phone": "", "department": t["dept"],
            "is_active": True, "created_at": datetime.now(timezone.utc).isoformat()
        })

    # Subjects (IGCSE/A-Level)
    subjects_data = [
        {"name": "English Language", "code": "ENG", "dept": "English"},
        {"name": "Mathematics", "code": "MATH", "dept": "Mathematics"},
        {"name": "Biology", "code": "BIO", "dept": "Science"},
        {"name": "Chemistry", "code": "CHEM", "dept": "Science"},
        {"name": "Physics", "code": "PHY", "dept": "Science"},
        {"name": "Information Technology", "code": "ICT", "dept": "ICT"},
        {"name": "Economics", "code": "ECON", "dept": "Business"},
        {"name": "Business Studies", "code": "BUS", "dept": "Business"},
        {"name": "Accounting", "code": "ACC", "dept": "Business"},
    ]
    subject_ids = []
    subject_docs = []
    for s in subjects_data:
        sid = gen_id("subj_")
        subject_ids.append(sid)
        subject_docs.append({
            "subject_id": sid, "name": s["name"], "code": s["code"],
            "department": s["dept"],
            "year_groups": ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    # Classes (Year 7-13)
    classes_data = [
        {"name": "Year 7A", "year": "Year 7", "ti": 0},
        {"name": "Year 7B", "year": "Year 7", "ti": 1},
        {"name": "Year 8A", "year": "Year 8", "ti": 2},
        {"name": "Year 9A", "year": "Year 9", "ti": 3},
        {"name": "Year 10A", "year": "Year 10", "ti": 0},
        {"name": "Year 10B", "year": "Year 10", "ti": 4},
        {"name": "Year 11A", "year": "Year 11", "ti": 1},
        {"name": "Year 12A", "year": "Year 12", "ti": 5},
        {"name": "Year 13A", "year": "Year 13", "ti": 2},
    ]
    class_ids = []
    class_docs = []
    for c in classes_data:
        cid = gen_id("cls_")
        class_ids.append(cid)
        class_docs.append({
            "class_id": cid, "name": c["name"], "year_group": c["year"],
            "form_teacher_id": teacher_ids[c["ti"] % len(teacher_ids)],
            "subject_ids": [s for s in subject_ids[:6]],
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    # Students
    students_data = [
        {"name": "Yaa Amoah", "email": "student@tcis.demo", "cls": 0, "boarding": "day"},
        {"name": "Kwesi Boateng", "email": "kwesi.boateng@tcis.demo", "cls": 0, "boarding": "boarding"},
        {"name": "Akua Nkrumah", "email": "akua.nkrumah@tcis.demo", "cls": 1, "boarding": "day"},
        {"name": "Kojo Owusu", "email": "kojo.owusu@tcis.demo", "cls": 2, "boarding": "boarding"},
        {"name": "Efua Amponsah", "email": "efua.amponsah@tcis.demo", "cls": 3, "boarding": "day"},
        {"name": "Nana Agyeman", "email": "nana.agyeman@tcis.demo", "cls": 4, "boarding": "day"},
        {"name": "Adwoa Mensah", "email": "adwoa.mensah@tcis.demo", "cls": 5, "boarding": "boarding"},
        {"name": "Kwabena Ofori", "email": "kwabena.ofori@tcis.demo", "cls": 6, "boarding": "day"},
        {"name": "Esi Appiah", "email": "esi.appiah@tcis.demo", "cls": 7, "boarding": "day"},
        {"name": "Kofi Danso", "email": "kofi.danso@tcis.demo", "cls": 8, "boarding": "boarding"},
    ]
    student_ids = []
    student_docs = []
    for i, s in enumerate(students_data):
        sid = gen_id("user_")
        student_ids.append(sid)
        student_docs.append({
            "user_id": sid, "email": s["email"], "name": s["name"],
            "password_hash": hash_password("student123"), "role": "Student",
            "picture": "", "phone": "", "department": "",
            "is_active": True,
            "admission_number": f"TCIS{2024001 + i}",
            "class_id": class_ids[s["cls"]],
            "year_group": classes_data[s["cls"]]["year"],
            "boarding_status": s["boarding"],
            "date_of_birth": f"{2007 + (i % 5)}-{(i % 12) + 1:02d}-{(i % 28) + 1:02d}",
            "guardian_ids": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    # Parents
    parent_docs = [
        {
            "user_id": gen_id("user_"), "email": "parent@tcis.demo",
            "name": "Nana Amoah Sr.", "password_hash": hash_password("parent123"),
            "role": "Parent", "picture": "", "phone": "+233209876543",
            "department": "", "is_active": True,
            "children_ids": [student_ids[0], student_ids[1]],
            "created_at": datetime.now(timezone.utc).isoformat()
        },
    ]

    # Lessons
    lesson_docs = [
        {"lesson_id": gen_id("les_"), "title": "Introduction to Algebra", "description": "Learn algebraic expressions and equations.", "subject_id": subject_ids[1], "class_ids": [class_ids[0], class_ids[1]], "teacher_id": teacher_ids[0], "lesson_type": "video", "content_url": "https://www.youtube.com/watch?v=NybHckSEQBI", "content_text": "", "thumbnail_url": "", "tags": ["algebra", "IGCSE"], "published": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"lesson_id": gen_id("les_"), "title": "Essay Writing Techniques", "description": "Structured essay writing with arguments.", "subject_id": subject_ids[0], "class_ids": [class_ids[0], class_ids[1]], "teacher_id": teacher_ids[2], "lesson_type": "text", "content_url": "", "content_text": "An essay has three parts: introduction, body, and conclusion. The introduction hooks the reader. Body paragraphs contain evidence. The conclusion summarizes.", "thumbnail_url": "", "tags": ["writing", "essay"], "published": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"lesson_id": gen_id("les_"), "title": "Cell Biology", "description": "Structure and function of cells.", "subject_id": subject_ids[2], "class_ids": [class_ids[2], class_ids[3]], "teacher_id": teacher_ids[1], "lesson_type": "pdf", "content_url": "https://example.com/cell-biology.pdf", "content_text": "", "thumbnail_url": "", "tags": ["biology", "cells"], "published": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"lesson_id": gen_id("les_"), "title": "Python Programming Basics", "description": "Variables, data types, and operations.", "subject_id": subject_ids[5], "class_ids": [class_ids[4], class_ids[5]], "teacher_id": teacher_ids[3], "lesson_type": "video", "content_url": "https://www.youtube.com/watch?v=kqtD5dpn9C8", "content_text": "", "thumbnail_url": "", "tags": ["python", "programming"], "published": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"lesson_id": gen_id("les_"), "title": "Supply and Demand", "description": "Market equilibrium and price mechanisms.", "subject_id": subject_ids[6], "class_ids": [class_ids[6], class_ids[7]], "teacher_id": teacher_ids[4], "lesson_type": "text", "content_url": "", "content_text": "Supply and demand determine market prices. When demand increases and supply stays constant, prices rise. When supply increases and demand stays constant, prices fall.", "thumbnail_url": "", "tags": ["economics", "market"], "published": True, "created_at": datetime.now(timezone.utc).isoformat()},
    ]

    # Assignments
    assignment_docs = [
        {"assignment_id": gen_id("asgn_"), "title": "Algebra Practice Set 1", "description": "Solve algebraic equations. Show all working.", "subject_id": subject_ids[1], "class_ids": [class_ids[0], class_ids[1]], "teacher_id": teacher_ids[0], "due_date": "2026-03-15", "max_score": 50, "attachments": [], "published": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"assignment_id": gen_id("asgn_"), "title": "Narrative Essay", "description": "Write a 500-word narrative essay on 'A Day I Will Never Forget'.", "subject_id": subject_ids[0], "class_ids": [class_ids[0], class_ids[1]], "teacher_id": teacher_ids[2], "due_date": "2026-03-20", "max_score": 100, "attachments": [], "published": True, "created_at": datetime.now(timezone.utc).isoformat()},
        {"assignment_id": gen_id("asgn_"), "title": "Chemical Bonding Quiz", "description": "Ionic and covalent bonding concepts.", "subject_id": subject_ids[3], "class_ids": [class_ids[4], class_ids[5]], "teacher_id": teacher_ids[5], "due_date": "2026-03-25", "max_score": 40, "attachments": [], "published": True, "created_at": datetime.now(timezone.utc).isoformat()},
    ]

    # Invoices
    invoice_docs = []
    for i, sid in enumerate(student_ids[:6]):
        total = 4500 + (i * 300)
        paid = total if i < 2 else (total * 0.5 if i < 4 else 0)
        balance = total - paid
        status = "paid" if paid >= total else ("partial" if paid > 0 else "pending")
        invoice_docs.append({
            "invoice_id": gen_id("inv_"), "student_id": sid,
            "term": "Term 1", "academic_year": "2025-2026",
            "items": [
                {"description": "Tuition Fee", "amount": round(total * 0.65, 2)},
                {"description": "Technology Levy", "amount": round(total * 0.15, 2)},
                {"description": "Activity Fee", "amount": round(total * 0.1, 2)},
                {"description": "Library Fee", "amount": round(total * 0.1, 2)},
            ],
            "total": total, "paid": paid, "balance": balance, "status": status,
            "due_date": "2026-01-31",
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    # Tasks
    task_docs = [
        {
            "task_id": gen_id("task_"), "title": "Submit Term 1 Lesson Plans",
            "description": "Upload all lesson plans for Term 1 by the deadline.",
            "task_type": "Academic", "assigned_to": teacher_ids[0],
            "assigned_role": "", "assigned_by": admin_id,
            "department": "Mathematics", "priority": "high",
            "status": "in_progress", "start_date": "2026-01-15", "due_date": "2026-02-01",
            "estimated_minutes": 120, "acceptance_criteria": "All lesson plans uploaded and formatted correctly.",
            "confidentiality": "public", "tags": ["lesson-plans", "term-1"],
            "checklist": [
                {"id": gen_id("chk_"), "text": "Week 1-2 plans", "done": True},
                {"id": gen_id("chk_"), "text": "Week 3-4 plans", "done": True},
                {"id": gen_id("chk_"), "text": "Week 5-6 plans", "done": False},
                {"id": gen_id("chk_"), "text": "Week 7-8 plans", "done": False},
            ],
            "approvers": [admin_id], "sla_hours": 48,
            "progress_percent": 50, "blockers": "",
            "comments": [], "evidence": [],
            "quality_rating": 0, "timeliness_rating": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(), "closed_at": ""
        },
        {
            "task_id": gen_id("task_"), "title": "Mark Year 7 Science Tests",
            "description": "Complete marking of mid-term science assessments.",
            "task_type": "Academic", "assigned_to": teacher_ids[1],
            "assigned_role": "", "assigned_by": hoa_id,
            "department": "Science", "priority": "medium",
            "status": "assigned", "start_date": "", "due_date": "2026-02-10",
            "estimated_minutes": 180, "acceptance_criteria": "All scripts marked with feedback.",
            "confidentiality": "public", "tags": ["marking", "science"],
            "checklist": [
                {"id": gen_id("chk_"), "text": "Mark Year 7A scripts", "done": False},
                {"id": gen_id("chk_"), "text": "Enter grades", "done": False},
                {"id": gen_id("chk_"), "text": "Write feedback", "done": False},
            ],
            "approvers": [hoa_id], "sla_hours": 72,
            "progress_percent": 0, "blockers": "",
            "comments": [], "evidence": [],
            "quality_rating": 0, "timeliness_rating": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(), "closed_at": ""
        },
    ]

    # Insert all data
    all_users = [admin_doc, finance_doc, hr_doc, hoa_doc] + teacher_docs + student_docs + parent_docs
    await db.users.insert_many(all_users)
    await db.subjects.insert_many(subject_docs)
    await db.classes.insert_many(class_docs)
    await db.lessons.insert_many(lesson_docs)
    await db.assignments.insert_many(assignment_docs)
    await db.invoices.insert_many(invoice_docs)
    await db.tasks.insert_many(task_docs)

    # Timetable
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    tt_docs = []
    for ci in range(min(4, len(class_ids))):
        cid = class_ids[ci]
        for day_idx, day in enumerate(days):
            for period in range(1, 7):
                subj_idx = (day_idx + period + ci) % len(subject_ids)
                teacher_idx = subj_idx % len(teacher_ids)
                tt_docs.append({
                    "entry_id": gen_id("tt_"), "class_id": cid,
                    "subject_id": subject_ids[subj_idx],
                    "teacher_id": teacher_ids[teacher_idx],
                    "day": day, "period": period,
                    "start_time": f"{7 + period}:00", "end_time": f"{7 + period}:50",
                })
    await db.timetable.insert_many(tt_docs)

    await log_audit(actor_id, actor_name, "seed_data", "system", "", {"message": "Demo data seeded"})

    return {
        "message": "RightWay Workstation demo data seeded successfully",
        "accounts": {
            "admin": {"email": "admin@tcis.demo", "password": "admin123"},
            "teacher": {"email": "teacher@tcis.demo", "password": "teacher123"},
            "student": {"email": "student@tcis.demo", "password": "student123"},
            "parent": {"email": "parent@tcis.demo", "password": "parent123"},
            "finance": {"email": "finance@tcis.demo", "password": "finance123"},
            "hr": {"email": "hr@tcis.demo", "password": "hr123"},
            "academics": {"email": "academics@tcis.demo", "password": "hoa123"},
        }
    }



# ── Student Promotion ──

@router.get("/promotion/students")
async def get_students_for_promotion(
    year_group: str = None,
    term: str = None,
    user: dict = Depends(require_roles("Admin", "SuperAdmin", "CEO", "Principal", "HeadTeacher"))
):
    """Get students with their exam performance for promotion view.
    Uses the same grading scale as Report Cards and Score Entry.
    Filters by term and prioritizes end_of_term scores for accurate averages."""
    if not term:
        term, _ = await get_active_term()

    query = {"role": "Student", "is_active": True}
    if year_group:
        query["year_group"] = year_group

    students = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(1000)

    # Get gradebook scores filtered by term
    student_ids = [s["user_id"] for s in students]

    # First try: get end_of_term entries (the final assessment) for this term
    end_of_term_grades = await db.gradebook_entries.find(
        {"student_id": {"$in": student_ids}, "term": term, "score_type": "end_of_term"},
        {"_id": 0, "student_id": 1, "subject_id": 1, "final_score": 1, "grade_letter": 1}
    ).to_list(10000)

    # Also get ALL entries for this term (for students without end_of_term but have other scores)
    all_term_grades = await db.gradebook_entries.find(
        {"student_id": {"$in": student_ids}, "term": term},
        {"_id": 0, "student_id": 1, "subject_id": 1, "final_score": 1, "grade_letter": 1, "score_type": 1}
    ).to_list(10000)

    # Build score map: prefer end_of_term per subject, fallback to best score per subject
    score_map = {}
    for g in end_of_term_grades:
        sid = g["student_id"]
        subj = g.get("subject_id", "")
        if sid not in score_map:
            score_map[sid] = {}
        # One entry per subject (end_of_term = authoritative)
        if subj not in score_map[sid]:
            score_map[sid][subj] = g.get("final_score", 0)

    # For students without end_of_term entries, use the best available score per subject
    for g in all_term_grades:
        sid = g["student_id"]
        subj = g.get("subject_id", "")
        if sid not in score_map:
            score_map[sid] = {}
        if subj not in score_map[sid]:
            score_map[sid][subj] = g.get("final_score", 0)
        # Keep the higher score if we're filling from non-end_of_term types
        elif sid not in {eg["student_id"] for eg in end_of_term_grades if eg.get("subject_id") == subj}:
            score_map[sid][subj] = max(score_map[sid][subj], g.get("final_score", 0) or 0)

    # Get class names
    classes = await db.classes.find({}, {"_id": 0, "class_id": 1, "name": 1, "year_group": 1}).to_list(50)
    class_map = {c["class_id"]: c for c in classes}

    for s in students:
        subj_scores = score_map.get(s["user_id"], {})
        scores_list = [v for v in subj_scores.values() if v is not None and v > 0]
        s["avg_score"] = round(sum(scores_list) / len(scores_list), 1) if scores_list else None
        s["subjects_graded"] = len(subj_scores)
        # Use the SAME grading function as gradebook/report cards
        s["grade"] = grade_letter(s["avg_score"]) if s["avg_score"] is not None else None
        cls = class_map.get(s.get("class_id", ""))
        s["class_name"] = cls["name"] if cls else ""

    # Sort by average score descending (best performers first)
    students.sort(key=lambda x: (x["avg_score"] or 0), reverse=True)
    return students


@router.post("/promotion/promote")
async def promote_students(
    data: dict = Body(...),
    user: dict = Depends(require_roles("Admin", "SuperAdmin", "CEO", "Principal", "HeadTeacher"))
):
    """Promote selected students to a target year group / class."""
    student_ids = data.get("student_ids", [])
    target_year_group = data.get("target_year_group")
    target_class_id = data.get("target_class_id", "")
    if not student_ids or not target_year_group:
        raise HTTPException(status_code=400, detail="student_ids and target_year_group required")

    # Get target class info
    target_class = None
    if target_class_id:
        target_class = await db.classes.find_one({"class_id": target_class_id}, {"_id": 0})

    now = datetime.now(timezone.utc).isoformat()
    promoted = 0
    for sid in student_ids:
        student = await db.users.find_one({"user_id": sid, "role": "Student"}, {"_id": 0, "name": 1, "year_group": 1, "class_id": 1})
        if not student:
            continue

        update = {
            "year_group": target_year_group,
            "promoted_at": now,
            "promoted_by": user["user_id"],
            "previous_year_group": student.get("year_group", ""),
            "previous_class_id": student.get("class_id", ""),
        }
        if target_class_id:
            update["class_id"] = target_class_id

        await db.users.update_one({"user_id": sid}, {"$set": update})

        # Log promotion
        await db.promotion_history.insert_one({
            "promotion_id": gen_id("promo_"),
            "student_id": sid,
            "student_name": student.get("name", ""),
            "from_year_group": student.get("year_group", ""),
            "from_class_id": student.get("class_id", ""),
            "to_year_group": target_year_group,
            "to_class_id": target_class_id,
            "to_class_name": target_class["name"] if target_class else "",
            "promoted_by": user["user_id"],
            "promoted_by_name": user["name"],
            "promoted_at": now,
        })
        promoted += 1

    await log_audit(user["user_id"], user["name"], "promote_students", "promotion", "",
                    {"count": promoted, "target": target_year_group, "student_ids": student_ids[:5]})
    return {"promoted": promoted, "target_year_group": target_year_group}


@router.post("/promotion/bulk")
async def bulk_promote_class(
    data: dict = Body(...),
    user: dict = Depends(require_roles("Admin", "SuperAdmin", "CEO", "Principal", "HeadTeacher"))
):
    """Promote ALL students in a source year group/class to target."""
    source_year_group = data.get("source_year_group")
    target_year_group = data.get("target_year_group")
    target_class_id = data.get("target_class_id", "")
    if not source_year_group or not target_year_group:
        raise HTTPException(status_code=400, detail="source and target year groups required")

    students = await db.users.find(
        {"role": "Student", "is_active": True, "year_group": source_year_group},
        {"_id": 0, "user_id": 1}
    ).to_list(500)

    if not students:
        raise HTTPException(status_code=404, detail=f"No students found in {source_year_group}")

    student_ids = [s["user_id"] for s in students]
    # Reuse the promote endpoint logic
    result = await promote_students(
        data={"student_ids": student_ids, "target_year_group": target_year_group, "target_class_id": target_class_id},
        user=user
    )
    return result

