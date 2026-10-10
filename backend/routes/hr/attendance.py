from fastapi import APIRouter, Depends, HTTPException
from database import db
from models import AttendanceCreate, gen_id
from auth import get_current_user, require_roles, log_audit
from datetime import datetime, timezone
from routes.working_papers.working_paper import log_activity

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


@router.post("/record")
async def record_attendance(
    data: AttendanceCreate,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "Teacher", "HeadTeacher", "Principal", "CEO"))
):
    # Check if attendance already exists for this class/date/period
    existing = await db.attendance.find_one(
        {"class_id": data.class_id, "date": data.date, "period": data.period},
        {"_id": 0}
    )
    if existing:
        # Update existing record
        await db.attendance.update_one(
            {"record_id": existing["record_id"]},
            {"$set": {"records": [r.model_dump() for r in data.records]}}
        )
        return {"message": "Attendance updated", "record_id": existing["record_id"]}

    doc = {
        "record_id": gen_id("att_"),
        "class_id": data.class_id,
        "date": data.date,
        "period": data.period,
        "teacher_id": user["user_id"],
        "records": [r.model_dump() for r in data.records],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.attendance.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "record_attendance", "attendance", doc["record_id"])
    await log_activity(user["user_id"], user["name"], "record_attendance", f"Took attendance for class {data.class_id}", "attendance", doc["record_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("")
async def list_attendance(
    class_id: str = None,
    date: str = None,
    student_id: str = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if class_id:
        query["class_id"] = class_id
    if date:
        query["date"] = date

    records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(500)

    # Bulk fetch classes and teachers to avoid N+1
    class_ids = list({r.get("class_id") for r in records if r.get("class_id")})
    teacher_ids = list({r.get("teacher_id") for r in records if r.get("teacher_id")})
    classes_list = await db.classes.find({"class_id": {"$in": class_ids}}, {"_id": 0}).to_list(len(class_ids)) if class_ids else []
    teachers_list = await db.users.find({"user_id": {"$in": teacher_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(teacher_ids)) if teacher_ids else []
    class_map = {c["class_id"]: c for c in classes_list}
    teacher_map = {t["user_id"]: t for t in teachers_list}

    for r in records:
        cls = class_map.get(r.get("class_id"))
        teacher = teacher_map.get(r.get("teacher_id"))
        r["class_name"] = cls["name"] if cls else ""
        r["teacher_name"] = teacher["name"] if teacher else ""

    # If student_id filter, filter records to only include that student
    if student_id:
        filtered = []
        for r in records:
            student_records = [rec for rec in r.get("records", []) if rec.get("student_id") == student_id]
            if student_records:
                r["records"] = student_records
                filtered.append(r)
        return filtered

    return records


@router.get("/student/{student_id}")
async def get_student_attendance(student_id: str, user: dict = Depends(get_current_user)):
    # Get student's class
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    class_id = student.get("class_id", "")
    records = await db.attendance.find({"class_id": class_id}, {"_id": 0}).sort("date", -1).to_list(500)

    summary = {"present": 0, "absent": 0, "late": 0, "total": 0}
    student_records = []

    for r in records:
        for rec in r.get("records", []):
            if rec.get("student_id") == student_id:
                summary["total"] += 1
                status = rec.get("status", "present")
                summary[status] = summary.get(status, 0) + 1
                student_records.append({
                    "date": r["date"],
                    "period": r.get("period", ""),
                    "status": status,
                    "note": rec.get("note", "")
                })

    rate = (summary["present"] / summary["total"] * 100) if summary["total"] > 0 else 0
    return {
        "student_id": student_id,
        "student_name": student.get("name", ""),
        "summary": summary,
        "attendance_rate": round(rate, 1),
        "records": student_records
    }


@router.get("/summary")
async def attendance_summary(
    class_id: str = None,
    date: str = None,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "Teacher", "HeadTeacher", "Principal", "HeadOfAcademics"))
):
    query = {}
    if class_id:
        query["class_id"] = class_id
    if date:
        query["date"] = date

    records = await db.attendance.find(query, {"_id": 0}).to_list(1000)
    total_present = 0
    total_absent = 0
    total_late = 0
    total_records = 0

    for r in records:
        for rec in r.get("records", []):
            total_records += 1
            status = rec.get("status", "present")
            if status == "present":
                total_present += 1
            elif status == "absent":
                total_absent += 1
            elif status == "late":
                total_late += 1

    rate = (total_present / total_records * 100) if total_records > 0 else 0
    return {
        "total_records": total_records,
        "present": total_present,
        "absent": total_absent,
        "late": total_late,
        "attendance_rate": round(rate, 1)
    }

