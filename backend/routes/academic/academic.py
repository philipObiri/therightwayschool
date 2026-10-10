from fastapi import APIRouter, Depends, HTTPException, Body
from database import db, get_active_term
from models import (
    SubjectCreate, SubjectResponse, ClassCreate, ClassResponse,
    TimetableEntryCreate, TimetableEntryResponse, gen_id
)
from auth import get_current_user, require_roles, log_audit
from datetime import datetime, timezone
import re

router = APIRouter(prefix="/api/academic", tags=["academic"])


@router.get("/subjects")
async def list_subjects(user: dict = Depends(get_current_user)):
    subjects = await db.subjects.find({}, {"_id": 0}).to_list(500)
    return subjects


MGMT_ROLES = ("Admin", "SuperAdmin", "CEO", "Founder", "Principal", "HeadTeacher", "HeadOfAcademics")

@router.get("/subjects/{subject_name}/teachers")
async def get_subject_teachers(subject_name: str, user: dict = Depends(require_roles(*MGMT_ROLES))):
    """Get all teachers who teach a given subject — searches lessons, lectures, schemes, assignments, and staff records."""
    subject_name = re.escape(subject_name)   # Prevent NoSQL regex injection
    teacher_map = {}

    # 1. Check staff teaching_subjects field
    staff = await db.users.find(
        {"role": {"$in": ["Teacher", "HeadOfAcademics"]}, "teaching_subjects": {"$regex": subject_name, "$options": "i"}},
        {"_id": 0, "user_id": 1, "name": 1, "department": 1}
    ).to_list(100)
    for s in staff:
        teacher_map[s["user_id"]] = {"user_id": s["user_id"], "name": s["name"], "department": s.get("department", "")}

    # 2. Lessons (uses teacher_id, subject_name)
    lessons = await db.lessons_v2.find(
        {"subject_name": {"$regex": subject_name, "$options": "i"}},
        {"_id": 0, "teacher_id": 1, "teacher_name": 1, "department": 1}
    ).to_list(500)
    for rec in lessons:
        uid = rec.get("teacher_id", "")
        if uid and uid not in teacher_map:
            teacher_map[uid] = {"user_id": uid, "name": rec.get("teacher_name", uid), "department": rec.get("department", "")}

    # 3. Lectures (uses teacher_id, subject)
    lectures = await db.lectures.find(
        {"subject": {"$regex": subject_name, "$options": "i"}},
        {"_id": 0, "teacher_id": 1, "teacher_name": 1}
    ).to_list(500)
    for rec in lectures:
        uid = rec.get("teacher_id", "")
        if uid and uid not in teacher_map:
            teacher_map[uid] = {"user_id": uid, "name": rec.get("teacher_name", uid), "department": ""}

    # 4. Schemes (collection: schemes, uses teacher_id, subject_name)
    schemes = await db.schemes.find(
        {"subject_name": {"$regex": subject_name, "$options": "i"}},
        {"_id": 0, "teacher_id": 1, "teacher_name": 1, "department": 1}
    ).to_list(200)
    for rec in schemes:
        uid = rec.get("teacher_id", "")
        if uid and uid not in teacher_map:
            teacher_map[uid] = {"user_id": uid, "name": rec.get("teacher_name", uid), "department": rec.get("department", "")}

    # 5. Assignments (uses teacher_id or created_by, subject)
    assignments = await db.assignments.find(
        {"subject": {"$regex": subject_name, "$options": "i"}},
        {"_id": 0, "teacher_id": 1, "created_by": 1, "teacher_name": 1}
    ).to_list(500)
    for rec in assignments:
        uid = rec.get("teacher_id") or rec.get("created_by", "")
        if uid and uid not in teacher_map:
            teacher_map[uid] = {"user_id": uid, "name": rec.get("teacher_name", uid), "department": ""}

    return list(teacher_map.values())


@router.get("/subjects/{subject_name}/teacher/{teacher_id}/files")
async def get_teacher_subject_files(subject_name: str, teacher_id: str, user: dict = Depends(require_roles(*MGMT_ROLES))):
    """Get ALL documents/files by a teacher for a subject — lessons, assignments, schemes, lectures, uploaded files."""
    subject_name = re.escape(subject_name)   # Prevent NoSQL regex injection
    files = []

    # 1. Lessons (teacher_id, subject_name)
    lessons = await db.lessons_v2.find(
        {"$or": [
            {"subject_name": {"$regex": subject_name, "$options": "i"}, "teacher_id": teacher_id},
            {"subject_name": {"$regex": subject_name, "$options": "i"}, "created_by": teacher_id},
        ]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    for rec in lessons:
        files.append({
            "doc_id": rec.get("lesson_id", ""),
            "type": "lesson",
            "title": rec.get("title", "Untitled Lesson"),
            "subject": rec.get("subject_name", subject_name),
            "year_group": rec.get("year_group", ""),
            "status": rec.get("status", ""),
            "created_at": rec.get("created_at", ""),
            "file_ids": rec.get("file_ids", []),
            "original_file_id": rec.get("original_file_id"),
            "has_content": bool(rec.get("rich_content") or rec.get("content_html") or rec.get("content_text")),
        })

    # 2. Assignments (teacher_id or created_by, subject)
    assignments = await db.assignments.find(
        {"$or": [
            {"subject": {"$regex": subject_name, "$options": "i"}, "teacher_id": teacher_id},
            {"subject": {"$regex": subject_name, "$options": "i"}, "created_by": teacher_id},
        ]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    for rec in assignments:
        files.append({
            "doc_id": rec.get("assignment_id", ""),
            "type": "assignment",
            "title": rec.get("title", "Untitled Assignment"),
            "subject": rec.get("subject", subject_name),
            "year_group": rec.get("year_group", ""),
            "status": rec.get("status", ""),
            "created_at": rec.get("created_at", ""),
            "file_ids": rec.get("file_ids", []) + rec.get("attachments", []),
            "has_content": bool(rec.get("description") or rec.get("instructions")),
        })

    # 3. Schemes (collection: schemes, teacher_id, subject_name)
    schemes = await db.schemes.find(
        {"subject_name": {"$regex": subject_name, "$options": "i"}, "teacher_id": teacher_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for rec in schemes:
        files.append({
            "doc_id": rec.get("scheme_id", ""),
            "type": "scheme_of_work",
            "title": rec.get("title", "") or f"Scheme: {rec.get('subject_name', '')} - {rec.get('year_group', '')}",
            "subject": rec.get("subject_name", subject_name),
            "year_group": rec.get("year_group", ""),
            "status": rec.get("status", ""),
            "created_at": rec.get("created_at", ""),
            "file_ids": [],
            "original_file_id": rec.get("original_file_id"),
            "has_content": bool(rec.get("weeks") or rec.get("rich_content")),
        })

    # 4. Lectures (teacher_id, subject)
    lectures = await db.lectures.find(
        {"subject": {"$regex": subject_name, "$options": "i"}, "teacher_id": teacher_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    for rec in lectures:
        fids = []
        if rec.get("source_file_id"):
            fids.append(rec["source_file_id"])
        files.append({
            "doc_id": rec.get("lecture_id", ""),
            "type": "lecture",
            "title": rec.get("title", "Untitled Lecture"),
            "subject": rec.get("subject", subject_name),
            "year_group": rec.get("year_group", ""),
            "status": rec.get("status", "published"),
            "created_at": rec.get("created_at", ""),
            "file_ids": fids,
            "has_content": bool(rec.get("rich_content") or rec.get("slides")),
        })

    # 5. Uploaded files (owner_user_id, original_filename)
    file_assets = await db.file_assets.find(
        {"owner_user_id": teacher_id, "is_deleted": {"$ne": True}},
        {"_id": 0, "file_id": 1, "original_filename": 1, "content_type": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(500)

    # Collect all file_ids already referenced by docs
    referenced_fids = set()
    for f in files:
        for fid in f.get("file_ids", []):
            if isinstance(fid, str):
                referenced_fids.add(fid)
            elif isinstance(fid, dict):
                referenced_fids.add(fid.get("file_id", ""))
        if f.get("original_file_id"):
            referenced_fids.add(f["original_file_id"])

    # Add standalone uploaded files not already referenced
    for fa in file_assets:
        if fa["file_id"] not in referenced_fids:
            files.append({
                "doc_id": fa["file_id"],
                "type": "uploaded_file",
                "title": fa.get("original_filename", "Uploaded file"),
                "subject": subject_name,
                "year_group": "",
                "status": "",
                "created_at": fa.get("created_at", ""),
                "file_ids": [fa["file_id"]],
                "has_content": False,
            })

    files.sort(key=lambda f: f.get("created_at", ""), reverse=True)
    return files




@router.post("/subjects")
async def create_subject(
    data: SubjectCreate,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "HeadOfAcademics"))
):
    doc = {
        "subject_id": gen_id("subj_"),
        "name": data.name,
        "code": data.code,
        "department": data.department,
        "year_groups": data.year_groups,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.subjects.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "create_subject", "subject", doc["subject_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/classes")
async def list_classes(user: dict = Depends(get_current_user)):
    classes = await db.classes.find({}, {"_id": 0}).to_list(500)
    # Batch count students per class
    class_ids = [c["class_id"] for c in classes]
    students = await db.users.find({"role": "Student", "class_id": {"$in": class_ids}}, {"_id": 0, "class_id": 1}).to_list(5000)
    count_map = {}
    for s in students:
        count_map[s.get("class_id", "")] = count_map.get(s.get("class_id", ""), 0) + 1
    for cls in classes:
        cls["student_count"] = count_map.get(cls["class_id"], 0)

    # Sort: year group numeric (Year 7 → Year 13), then class name alphabetical
    def _year_key(name: str) -> int:
        import re
        m = re.search(r"(\d+)", name or "")
        return int(m.group(1)) if m else 99
    classes.sort(key=lambda c: (_year_key(c.get("year_group", "") or c.get("name", "")), (c.get("name", "") or "").lower()))
    return classes


@router.post("/classes")
async def create_class(
    data: ClassCreate,
    user: dict = Depends(require_roles("SuperAdmin", "Admin"))
):
    doc = {
        "class_id": gen_id("cls_"),
        "name": data.name,
        "year_group": data.year_group,
        "form_teacher_id": data.form_teacher_id,
        "subject_ids": data.subject_ids,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.classes.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "create_class", "class", doc["class_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/timetable")
async def get_timetable(
    class_id: str = None,
    teacher_id: str = None,
    day: str = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if class_id:
        query["class_id"] = class_id
    if teacher_id:
        query["teacher_id"] = teacher_id
    if day:
        query["day"] = day
    entries = await db.timetable.find(query, {"_id": 0}).to_list(500)

    # Batch fetch all related data
    subj_ids = list({e.get("subject_id") for e in entries})
    teacher_ids = list({e.get("teacher_id") for e in entries})
    cls_ids = list({e.get("class_id") for e in entries})
    subjects_list = await db.subjects.find({"subject_id": {"$in": subj_ids}}, {"_id": 0}).to_list(len(subj_ids))
    teachers_list = await db.users.find({"user_id": {"$in": teacher_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(teacher_ids))
    classes_list = await db.classes.find({"class_id": {"$in": cls_ids}}, {"_id": 0}).to_list(len(cls_ids))
    subj_map = {s["subject_id"]: s for s in subjects_list}
    teacher_map = {t["user_id"]: t for t in teachers_list}
    cls_map = {c["class_id"]: c for c in classes_list}

    for entry in entries:
        subj = subj_map.get(entry.get("subject_id"))
        teacher = teacher_map.get(entry.get("teacher_id"))
        cls = cls_map.get(entry.get("class_id"))
        entry["subject_name"] = subj["name"] if subj else ""
        entry["teacher_name"] = teacher["name"] if teacher else ""
        entry["class_name"] = cls["name"] if cls else ""
    return entries


@router.get("/admin-timetable")
async def admin_timetable(
    year_group: str = None,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher", "HeadOfAcademics"))
):
    """Get full timetable for a year group (admin view with all subjects)."""
    query = {}
    if year_group:
        query["year_group"] = year_group
    entries = await db.timetable_v2.find(query, {"_id": 0}).to_list(500)
    entries.sort(key=lambda x: (
        ["Monday","Tuesday","Wednesday","Thursday","Friday"].index(x["day"]) if x["day"] in ["Monday","Tuesday","Wednesday","Thursday","Friday"] else 9,
        x.get("start_time", "")
    ))
    year_groups = sorted(await db.timetable_v2.distinct("year_group"))
    return {"entries": entries, "year_groups": year_groups}


@router.put("/timetable/{entry_id}/reschedule")
async def reschedule_entry(
    entry_id: str,
    data: dict = Body(...),
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "HeadOfAcademics"))
):
    """Drag-and-drop reschedule: move a timetable entry to a new day/time."""
    new_day = data.get("day")
    new_start = data.get("start_time")
    new_end = data.get("end_time")
    if not new_day or not new_start:
        raise HTTPException(status_code=400, detail="day and start_time required")

    entry = await db.timetable_v2.find_one({"entry_id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found")

    valid_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    if new_day not in valid_days:
        raise HTTPException(status_code=400, detail="Invalid day")

    update = {"day": new_day, "start_time": new_start}
    if new_end:
        update["end_time"] = new_end

    await db.timetable_v2.update_one({"entry_id": entry_id}, {"$set": update})
    await log_audit(user["user_id"], user["name"], "reschedule_timetable", "timetable", entry_id,
                    details=f"Moved {entry['subject']} from {entry['day']} {entry['start_time']} to {new_day} {new_start}")

    updated = await db.timetable_v2.find_one({"entry_id": entry_id}, {"_id": 0})
    return updated


@router.put("/timetable/{entry_id}/swap")
async def swap_entries(
    entry_id: str,
    data: dict = Body(...),
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "HeadOfAcademics"))
):
    """Swap two timetable entries (drag onto an occupied slot)."""
    target_entry_id = data.get("target_entry_id")
    if not target_entry_id:
        raise HTTPException(status_code=400, detail="target_entry_id required")

    entry_a = await db.timetable_v2.find_one({"entry_id": entry_id}, {"_id": 0})
    entry_b = await db.timetable_v2.find_one({"entry_id": target_entry_id}, {"_id": 0})
    if not entry_a or not entry_b:
        raise HTTPException(status_code=404, detail="Entry not found")

    # Swap day and times
    await db.timetable_v2.update_one({"entry_id": entry_id}, {"$set": {
        "day": entry_b["day"], "start_time": entry_b["start_time"], "end_time": entry_b["end_time"]
    }})
    await db.timetable_v2.update_one({"entry_id": target_entry_id}, {"$set": {
        "day": entry_a["day"], "start_time": entry_a["start_time"], "end_time": entry_a["end_time"]
    }})
    await log_audit(user["user_id"], user["name"], "swap_timetable", "timetable", entry_id,
                    details=f"Swapped {entry_a['subject']} ({entry_a['day']} {entry_a['start_time']}) with {entry_b['subject']} ({entry_b['day']} {entry_b['start_time']})")

    return {"message": "Swapped", "entry_a": entry_a["entry_id"], "entry_b": target_entry_id}


@router.get("/my-timetable")
async def my_timetable(user: dict = Depends(get_current_user), student_id: str = None):
    """Get personalized timetable for student (by year group) or teacher (by subjects they teach).
    Parents can pass student_id to get a child's timetable."""
    # If a student_id is provided (parent viewing child's timetable), look up that student
    if student_id:
        student = await db.users.find_one({"user_id": student_id}, {"_id": 0})
        if student:
            year_group = student.get("year_group", "")
            entries = await db.timetable_v2.find({"year_group": year_group}, {"_id": 0}).to_list(100)
            entries.sort(key=lambda x: (["Monday","Tuesday","Wednesday","Thursday","Friday"].index(x["day"]) if x["day"] in ["Monday","Tuesday","Wednesday","Thursday","Friday"] else 9, x["start_time"]))
            return {"year_group": year_group, "entries": entries, "student_name": student.get("name", "")}

    if user.get("role") == "Student":
        year_group = user.get("year_group", "")
        entries = await db.timetable_v2.find({"year_group": year_group}, {"_id": 0}).to_list(100)
        entries.sort(key=lambda x: (["Monday","Tuesday","Wednesday","Thursday","Friday"].index(x["day"]) if x["day"] in ["Monday","Tuesday","Wednesday","Thursday","Friday"] else 9, x["start_time"]))
        return {"year_group": year_group, "entries": entries}
    else:
        # Teacher: find all entries matching their subjects across their year groups
        teaching_subjects = user.get("teaching_subjects", [])
        assigned_years = user.get("assigned_year_groups", [])
        if not teaching_subjects or not assigned_years:
            return {"entries": []}
        
        # Map teaching subject names to timetable subject names
        subject_patterns = []
        for s in teaching_subjects:
            subject_patterns.append(s.upper())
            # Also match partial names
            if "Mathematics" in s or "Math" in s: subject_patterns.extend(["MATH", "MATHS", "EXTENDED MATH", "EXTENDED MATHS", "ADD MATHS", "ADD MATH", "PURE MATHS", "PURE MATHS 1", "PURE MATHS 3"])
            if "English" in s: subject_patterns.extend(["ENGLISH", "ENGLISH LANGUAGE"])
            if "French" in s: subject_patterns.extend(["FRENCH", "FRENCH LANGUAGE"])
            if "ICT" in s or "Information" in s: subject_patterns.extend(["ICT", "INFORMATION TECHNOLOGY"])
            if "Biology" in s: subject_patterns.extend(["BIOLOGY", "COMBINED SCIENCE", "COORD SCIENCE", "COORDINATED SCIENCE"])
            if "Chemistry" in s: subject_patterns.extend(["CHEMISTRY", "COORD SCIENCE", "COMBINED SCIENCE", "COORDINATED SCIENCE"])
            if "Physics" in s: subject_patterns.extend(["PHYSICS", "COORD SCIENCE", "COMBINED SCIENCE", "COORDINATED SCIENCE", "MECHANICS"])
            if "Coordinated" in s: subject_patterns.extend(["COMBINED SCIENCE", "COORD SCIENCE", "COORDINATED SCIENCE"])
            if "Economics" in s: subject_patterns.append("ECONOMICS")
            if "Business" in s: subject_patterns.extend(["BUSINESS", "BUSINESS STUDIES"])
            if "Accounting" in s: subject_patterns.append("ACCOUNTING")
            if "Art" in s: subject_patterns.extend(["ARTS AND CRAFT", "ART"])
            if "Sociology" in s: subject_patterns.append("SOCIOLOGY")
            if "Geography" in s: subject_patterns.append("GEOGRAPHY")
            if "Christian" in s: subject_patterns.append("CHRISTIAN DOCTRINE")
            if "Global" in s: subject_patterns.extend(["GLOBAL PERSPECTIVE", "GLOBAL PERSPECTIVES"])
            if "Literature" in s: subject_patterns.append("LITERATURE")
            if "History" in s: subject_patterns.append("HISTORY")
            if "Probability" in s or "Statistics" in s: subject_patterns.extend(["STATISTICS", "MATH (STATISTICS)"])
            if "Pure Mathematics" in s or "Pure Math" in s: subject_patterns.extend(["PURE MATHS 1", "PURE MATHS 3", "PURE MATH"])
            if "Mechanics" in s: subject_patterns.append("MECHANICS")
            if "P.E" in s or "Physical" in s: subject_patterns.extend(["P.E", "PE"])

        subject_patterns = list(set(subject_patterns))
        
        all_entries = []
        for yg in assigned_years:
            entries = await db.timetable_v2.find({"year_group": yg}, {"_id": 0}).to_list(100)
            for e in entries:
                subj_upper = e["subject"].upper()
                if any(pat in subj_upper for pat in subject_patterns):
                    e["matched"] = True
                    all_entries.append(e)
        
        all_entries.sort(key=lambda x: (["Monday","Tuesday","Wednesday","Thursday","Friday"].index(x["day"]) if x["day"] in ["Monday","Tuesday","Wednesday","Thursday","Friday"] else 9, x["start_time"]))
        return {"entries": all_entries}


@router.post("/timetable")
async def create_timetable_entry(
    data: TimetableEntryCreate,
    user: dict = Depends(require_roles("SuperAdmin", "Admin"))
):
    doc = {
        "entry_id": gen_id("tt_"),
        "class_id": data.class_id,
        "subject_id": data.subject_id,
        "teacher_id": data.teacher_id,
        "day": data.day,
        "period": data.period,
        "start_time": data.start_time,
        "end_time": data.end_time,
    }
    await db.timetable.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "create_timetable", "timetable", doc["entry_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str, user: dict = Depends(require_roles("SuperAdmin", "Admin"))):
    result = await db.subjects.delete_one({"subject_id": subject_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
    await log_audit(user["user_id"], user["name"], "delete_subject", "subject", subject_id)
    return {"message": "Subject deleted"}


@router.delete("/classes/{class_id}")
async def delete_class(class_id: str, user: dict = Depends(require_roles("SuperAdmin", "Admin"))):
    result = await db.classes.delete_one({"class_id": class_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    await log_audit(user["user_id"], user["name"], "delete_class", "class", class_id)
    return {"message": "Class deleted"}


@router.post("/seed-timetable")
async def seed_timetable(user: dict = Depends(require_roles("SuperAdmin", "Admin", "CEO"))):
    """Manually seed timetable data for Years 9-13."""
    try:
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
        from populate_timetable_v2 import populate_all
        count = await populate_all()
        return {"message": f"Timetable seeded with {count} entries"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Seed failed: {str(e)}")



@router.get("/child-subject-detail")
async def child_subject_detail(student_id: str, subject_id: str, user: dict = Depends(get_current_user)):
    """Get comprehensive subject detail: grades, performance graph, teacher, schemes, lessons, reports."""
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(404, "Student not found")
    subject = await db.subjects.find_one({"subject_id": subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(404, "Subject not found")
    year_group = student.get("year_group", "")
    active_term, _ = await get_active_term()

    # Find teacher by subject name match against teaching_subjects
    subj_name = subject.get("name", "")
    teacher = await db.users.find_one(
        {"teaching_subjects": subj_name, "assigned_year_groups": year_group},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "department": 1}
    )
    if not teacher:
        teacher = await db.users.find_one(
            {"teaching_subjects": subj_name},
            {"_id": 0, "user_id": 1, "name": 1, "email": 1, "department": 1}
        )

    # ─── Gradebook entries for this student + subject (all terms) ───
    grade_entries = await db.gradebook_entries.find(
        {"student_id": student_id, "subject_id": subject_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)

    # Organize scores by type
    scores_by_type = {}
    for e in grade_entries:
        st = e.get("score_type", "unknown")
        if st not in scores_by_type:
            scores_by_type[st] = []
        score = e.get("final_score") or e.get("exam_score") or e.get("ca_score") or 0
        scores_by_type[st].append({
            "term": e.get("term", ""),
            "score": score,
            "grade_letter": e.get("grade_letter", ""),
            "teacher_comment": e.get("teacher_comment", ""),
            "created_at": e.get("created_at", ""),
        })

    # Latest scores summary
    latest_scores = {}
    for st in ["classwork", "progressive_test_1", "progressive_test_2", "progressive_test_3", "mid_term", "end_of_term", "mock_exam"]:
        entries_for_type = [e for e in grade_entries if e.get("score_type") == st]
        if entries_for_type:
            last = entries_for_type[-1]
            latest_scores[st] = {
                "score": last.get("final_score") or last.get("exam_score") or last.get("ca_score") or 0,
                "grade": last.get("grade_letter", ""),
                "term": last.get("term", ""),
                "comment": last.get("teacher_comment", ""),
            }

    # Performance trend for graph (all scores chronologically)
    performance_trend = []
    for e in grade_entries:
        score = e.get("final_score") or e.get("exam_score") or e.get("ca_score") or 0
        if score > 0:
            performance_trend.append({
                "label": f"{e.get('term','')} {e.get('score_type','').replace('_',' ').title()}",
                "score": score,
                "type": e.get("score_type", ""),
                "term": e.get("term", ""),
            })

    # Assignments for this subject
    assignments = await db.assignments.find(
        {"subject_id": subject_id, "published": True}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    for a in assignments:
        t = await db.users.find_one({"user_id": a.get("teacher_id", "")}, {"_id": 0, "name": 1})
        a["teacher_name"] = t["name"] if t else ""
        # Get student submission for this assignment
        sub = await db.assignment_submissions.find_one(
            {"assignment_id": a["assignment_id"], "student_id": student_id},
            {"_id": 0, "score": 1, "grade": 1, "submitted_at": 1, "feedback": 1}
        )
        a["submission"] = sub
        a.pop("teacher_id", None)

    # Approved schemes of work
    schemes = await db.schemes.find(
        {"subject_name": subj_name, "year_group": year_group, "status": {"$in": ["approved", "published"]}},
        {"_id": 0, "scheme_id": 1, "title": 1, "term": 1, "teacher_name": 1, "status": 1, "weeks": 1, "updated_at": 1}
    ).sort("updated_at", -1).to_list(20)

    # Published/approved lesson plans
    lessons = await db.lessons_v2.find(
        {"subject_name": subj_name, "year_group": year_group, "status": {"$in": ["approved", "published"]}},
        {"_id": 0, "lesson_id": 1, "title": 1, "term": 1, "teacher_name": 1, "status": 1, "week_number": 1, "updated_at": 1}
    ).sort("updated_at", -1).to_list(50)

    # Teacher reports forwarded to parent
    parent_reports = await db.teacher_reports.find(
        {"student_id": student_id, "subject_id": subject_id, "forwarded_to_parent": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)

    # Resources
    resources = await db.lms_resources.find(
        {"subject_id": subject_id, "published": True}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    for r in resources:
        t = await db.users.find_one({"user_id": r.get("teacher_id", "")}, {"_id": 0, "name": 1})
        r["teacher_name"] = t["name"] if t else ""

    return {
        "subject": {"subject_id": subject["subject_id"], "name": subject["name"], "code": subject.get("code", "")},
        "teacher": teacher,
        "year_group": year_group,
        "student_name": student.get("name", ""),
        "latest_scores": latest_scores,
        "performance_trend": performance_trend,
        "scores_by_type": scores_by_type,
        "assignments": assignments,
        "schemes": schemes,
        "lessons": lessons,
        "parent_reports": parent_reports,
        "resources": resources,
    }


@router.get("/child-finance")
async def child_finance(student_id: str, user: dict = Depends(get_current_user)):
    """Get finance data (invoices + payments) for a parent's child."""
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0, "name": 1, "year_group": 1, "balance": 1, "total_fees": 1, "total_paid": 1})
    if not student:
        raise HTTPException(404, "Student not found")
    invoices = await db.invoices_v2.find({"student_id": student_id, "status": {"$ne": "cancelled"}}, {"_id": 0}).sort("created_at", -1).to_list(100)
    payments = await db.payments_v2.find({"student_id": student_id, "status": {"$ne": "reversed"}}, {"_id": 0}).sort("created_at", -1).to_list(100)
    total_fees = sum(i.get("total_due", 0) for i in invoices)
    total_paid = sum(p.get("amount", 0) for p in payments)
    return {
        "student": student,
        "invoices": invoices,
        "payments": payments,
        "total_fees": total_fees,
        "total_paid": total_paid,
        "balance": total_fees - total_paid,
    }
