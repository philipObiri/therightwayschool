from fastapi import APIRouter, Depends, HTTPException
from database import db, get_active_term
from models import (
    AssignmentCreate, SubmissionCreate, GradeSubmission, gen_id
)
from auth import get_current_user, require_roles, log_audit
from ws_manager import send_notification
from routes.working_papers.working_paper import log_activity
from datetime import datetime, timezone

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.get("")
async def list_assignments(
    subject_id: str = None,
    class_id: str = None,
    teacher_id: str = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if subject_id:
        query["subject_id"] = subject_id
    if class_id:
        query["class_ids"] = class_id
    if teacher_id:
        query["teacher_id"] = teacher_id

    if user.get("role") == "Student":
        query["published"] = True
        if user.get("class_id"):
            query["class_ids"] = user["class_id"]
    elif user.get("role") == "Teacher":
        query["teacher_id"] = user["user_id"]

    assignments = await db.assignments.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

    # Batch fetch subjects, teachers, and submission counts
    subj_ids = list({a.get("subject_id") for a in assignments})
    teacher_ids = list({a.get("teacher_id") for a in assignments})
    asgn_ids = [a["assignment_id"] for a in assignments]
    subjects_list = await db.subjects.find({"subject_id": {"$in": subj_ids}}, {"_id": 0}).to_list(len(subj_ids))
    teachers_list = await db.users.find({"user_id": {"$in": teacher_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(teacher_ids))
    subj_map = {s["subject_id"]: s for s in subjects_list}
    teacher_map = {t["user_id"]: t for t in teachers_list}

    # Batch count submissions
    all_subs = await db.submissions.find({"assignment_id": {"$in": asgn_ids}}, {"_id": 0, "assignment_id": 1, "student_id": 1, "grade": 1, "submitted_at": 1, "feedback": 1}).to_list(5000)
    sub_count_map = {}
    sub_by_asgn = {}
    for s in all_subs:
        aid = s["assignment_id"]
        sub_count_map[aid] = sub_count_map.get(aid, 0) + 1
        if aid not in sub_by_asgn:
            sub_by_asgn[aid] = []
        sub_by_asgn[aid].append(s)

    for a in assignments:
        subj = subj_map.get(a.get("subject_id"))
        teacher = teacher_map.get(a.get("teacher_id"))
        a["subject_name"] = subj["name"] if subj else ""
        a["teacher_name"] = teacher["name"] if teacher else ""
        a["submission_count"] = sub_count_map.get(a["assignment_id"], 0)

        if user.get("role") == "Student":
            my_subs = [s for s in sub_by_asgn.get(a["assignment_id"], []) if s.get("student_id") == user["user_id"]]
            a["my_submission"] = my_subs[0] if my_subs else None
    return assignments


@router.post("")
async def create_assignment(
    data: dict = None,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "Teacher", "HeadTeacher", "Principal", "HeadOfAcademics", "CEO"))
):
    if data is None:
        data = {}
    active_term, active_year = await get_active_term()
    doc = {
        "assignment_id": gen_id("asgn_"),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "instructions": data.get("instructions", ""),
        "learning_objectives": data.get("learning_objectives", ""),
        "subject_id": data.get("subject_id", ""),
        "class_ids": data.get("class_ids", []),
        "teacher_id": user["user_id"],
        "teacher_name": user["name"],
        "due_date": data.get("due_date", ""),
        "max_score": data.get("max_score", 100),
        "attachments": data.get("attachments", []),
        "file_ids": data.get("file_ids", []),
        "published": data.get("published", True),
        "assignment_type": data.get("assignment_type", "individual"),
        "category": data.get("category", "homework"),
        "allow_late": data.get("allow_late", False),
        "late_penalty": data.get("late_penalty", 0),
        "rubric": data.get("rubric", ""),
        "term": data.get("term", "") or active_term,
        "academic_year": data.get("academic_year", "") or active_year,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.assignments.insert_one(doc)

    # Notify management
    if doc["published"]:
        subj = await db.subjects.find_one({"subject_id": doc["subject_id"]}, {"_id": 0, "name": 1})
        subj_name = subj["name"] if subj else ""
        mgmt = await db.users.find({"role": {"$in": ["CEO", "Principal", "HeadTeacher"]}}, {"_id": 0, "user_id": 1}).to_list(10)
        for m in mgmt:
            await send_notification(db, m["user_id"], {
                "type": "assignment_created",
                "title": f"New Assignment: {doc['title']}",
                "message": f"{user['name']} created an assignment for {subj_name}.",
                "reference_type": "assignment", "reference_id": doc["assignment_id"],
                "action_url": "/admin/assignments",
            })

        # Notify students in assigned classes
        for class_id in doc["class_ids"]:
            students = await db.users.find({"role": "Student", "class_id": class_id}, {"_id": 0, "user_id": 1}).to_list(200)
            for s in students:
                await send_notification(db, s["user_id"], {
                    "type": "new_assignment",
                    "title": f"New Assignment: {doc['title']}",
                    "message": f"{user['name']} assigned '{doc['title']}' in {subj_name}. Due: {doc['due_date'] or 'No deadline'}",
                    "reference_type": "assignment", "reference_id": doc["assignment_id"],
                    "action_url": "/student/assignments",
                })

    await log_audit(user["user_id"], user["name"], "create_assignment", "assignment", doc["assignment_id"])
    await log_activity(user["user_id"], user["name"], "create_assignment", f"Created assignment: {doc['title']}", "assignment", doc["assignment_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/{assignment_id}")
async def get_assignment(assignment_id: str, user: dict = Depends(get_current_user)):
    a = await db.assignments.find_one({"assignment_id": assignment_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    subj = await db.subjects.find_one({"subject_id": a.get("subject_id")}, {"_id": 0})
    teacher = await db.users.find_one({"user_id": a.get("teacher_id")}, {"_id": 0})
    a["subject_name"] = subj["name"] if subj else ""
    a["teacher_name"] = teacher["name"] if teacher else ""
    a["submission_count"] = await db.submissions.count_documents({"assignment_id": assignment_id})
    return a


@router.post("/{assignment_id}/submit")
async def submit_assignment(
    assignment_id: str,
    data: SubmissionCreate,
    user: dict = Depends(require_roles("Student"))
):
    assignment = await db.assignments.find_one({"assignment_id": assignment_id}, {"_id": 0})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    existing = await db.submissions.find_one(
        {"assignment_id": assignment_id, "student_id": user["user_id"]},
        {"_id": 0}
    )
    if existing:
        # Update existing submission
        await db.submissions.update_one(
            {"submission_id": existing["submission_id"]},
            {"$set": {
                "content": data.content,
                "file_url": data.file_url,
                "submitted_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": "Submission updated", "submission_id": existing["submission_id"]}

    doc = {
        "submission_id": gen_id("sub_"),
        "assignment_id": assignment_id,
        "student_id": user["user_id"],
        "content": data.content,
        "file_url": data.file_url,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "grade": None,
        "feedback": "",
        "graded_by": "",
        "graded_at": ""
    }
    await db.submissions.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "submit_assignment", "submission", doc["submission_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/{assignment_id}/submissions")
async def list_submissions(
    assignment_id: str,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "Teacher", "HeadTeacher", "Principal", "HeadOfAcademics"))
):
    subs = await db.submissions.find({"assignment_id": assignment_id}, {"_id": 0}).to_list(500)

    # Bulk fetch students to avoid N+1
    sub_student_ids = list({s.get("student_id") for s in subs if s.get("student_id")})
    sub_students = await db.users.find({"user_id": {"$in": sub_student_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(sub_student_ids)) if sub_student_ids else []
    sub_student_map = {st["user_id"]: st for st in sub_students}

    for s in subs:
        student = sub_student_map.get(s.get("student_id"))
        s["student_name"] = student["name"] if student else ""
    return subs


@router.post("/{assignment_id}/grade/{submission_id}")
async def grade_submission(
    assignment_id: str,
    submission_id: str,
    data: GradeSubmission,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "Teacher", "HeadTeacher", "Principal", "HeadOfAcademics"))
):
    result = await db.submissions.update_one(
        {"submission_id": submission_id, "assignment_id": assignment_id},
        {"$set": {
            "grade": data.grade,
            "feedback": data.feedback,
            "graded_by": user["user_id"],
            "graded_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")

    await log_audit(user["user_id"], user["name"], "grade_submission", "submission", submission_id,
                    {"grade": data.grade})
    return {"message": "Submission graded"}


@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: str,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "Teacher", "HeadTeacher", "Principal"))
):
    result = await db.assignments.delete_one({"assignment_id": assignment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.submissions.delete_many({"assignment_id": assignment_id})
    await log_audit(user["user_id"], user["name"], "delete_assignment", "assignment", assignment_id)
    return {"message": "Assignment deleted"}

