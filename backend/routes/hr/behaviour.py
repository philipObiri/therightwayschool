from fastapi import APIRouter, Depends, HTTPException, Body
from database import db
from models import gen_id
from auth import get_current_user, require_roles, log_audit
from ws_manager import send_notification
from datetime import datetime, timezone

router = APIRouter(prefix="/api/behaviour", tags=["behaviour"])

LEADERSHIP_ROLES = ("CEO", "Founder", "Principal", "HeadTeacher", "Admin", "SuperAdmin")
REPORT_RECIPIENTS = {"Teacher": ["HeadTeacher", "Principal"], "HeadTeacher": ["CEO", "Principal"], "Principal": ["CEO"]}


@router.post("/reports")
async def create_report(data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Teacher creates a behaviour report on a student."""
    doc = {
        "report_id": gen_id("br_"), "student_id": data.get("student_id"),
        "reporter_id": user["user_id"], "reporter_name": user["name"],
        "reporter_role": user.get("role", ""),
        "class_id": data.get("class_id", ""), "subject_id": data.get("subject_id", ""),
        "incident_date": data.get("incident_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "category": data.get("category", "general"),  # general, academic, conduct, attendance, bullying, other
        "severity": data.get("severity", "minor"),  # minor, moderate, serious, critical
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "action_taken": data.get("action_taken", ""),
        "forwarded_to": [], "forwarded_history": [],
        "meeting_requested": False, "meeting_details": None,
        "status": "submitted",  # submitted, forwarded, meeting_called, resolved, closed
        "resolution": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.behaviour_reports.insert_one(doc)

    # Auto-forward to HeadTeacher and Principal for teachers
    student = await db.users.find_one({"user_id": data.get("student_id")}, {"_id": 0, "name": 1})
    auto_recipients = REPORT_RECIPIENTS.get(user.get("role"), [])
    if auto_recipients:
        recipients = await db.users.find({"role": {"$in": auto_recipients}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(20)
        for r in recipients:
            await send_notification(db, r["user_id"], {
                "type": "behaviour_report",
                "title": f"Behaviour Report: {student['name'] if student else 'Student'}",
                "message": f"{user['name']} reported {data.get('category', 'general')} incident ({data.get('severity', 'minor')}): {data.get('title', '')}",
                "reference_type": "behaviour_report", "reference_id": doc["report_id"],
                "action_url": f"/admin/behaviour/{doc['report_id']}",
            })
        doc["forwarded_to"] = [r["user_id"] for r in recipients]
        await db.behaviour_reports.update_one({"report_id": doc["report_id"]}, {"$set": {"forwarded_to": doc["forwarded_to"]}})

    await log_audit(user["user_id"], user["name"], "create_behaviour_report", "behaviour", doc["report_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/reports")
async def list_reports(
    student_id: str = None, status: str = None,
    class_id: str = None, my_reports: bool = False,
    user: dict = Depends(get_current_user)
):
    query = {}
    if student_id:
        query["student_id"] = student_id
    if status:
        query["status"] = status
    if class_id:
        query["class_id"] = class_id
    if my_reports or user.get("role") == "Teacher":
        query["$or"] = [
            {"reporter_id": user["user_id"]},
            {"forwarded_to": user["user_id"]}
        ]
    elif user.get("role") in LEADERSHIP_ROLES:
        # Leadership sees all reports or reports forwarded to them
        query["$or"] = [
            {"forwarded_to": user["user_id"]},
            {"reporter_role": {"$exists": True}}  # All reports
        ]

    reports = await db.behaviour_reports.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for r in reports:
        student = await db.users.find_one({"user_id": r.get("student_id")}, {"_id": 0, "name": 1, "year_group": 1, "class_id": 1})
        r["student_name"] = student["name"] if student else ""
        r["student_year"] = student.get("year_group", "") if student else ""
        cls = await db.classes.find_one({"class_id": r.get("class_id") or (student.get("class_id") if student else "")}, {"_id": 0, "name": 1})
        r["class_name"] = cls["name"] if cls else ""
    return reports


@router.get("/reports/{report_id}")
async def get_report(report_id: str, user: dict = Depends(get_current_user)):
    report = await db.behaviour_reports.find_one({"report_id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    student = await db.users.find_one({"user_id": report.get("student_id")}, {"_id": 0, "name": 1, "year_group": 1})
    report["student_name"] = student["name"] if student else ""
    return report


@router.post("/reports/{report_id}/forward")
async def forward_report(report_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Forward a report up the chain (HeadTeacher/Principal -> CEO)."""
    report = await db.behaviour_reports.find_one({"report_id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    to_role = data.get("to_role", "CEO")
    recipients = await db.users.find({"role": to_role}, {"_id": 0, "user_id": 1, "name": 1}).to_list(10)
    comment = data.get("comment", "")
    student = await db.users.find_one({"user_id": report.get("student_id")}, {"_id": 0, "name": 1})

    for r in recipients:
        await send_notification(db, r["user_id"], {
            "type": "report_forwarded",
            "title": f"Report Forwarded: {student['name'] if student else 'Student'}",
            "message": f"{user['name']} ({user.get('role','')}) forwarded a behaviour report. {comment}",
            "reference_type": "behaviour_report", "reference_id": report_id,
            "action_url": f"/admin/behaviour/{report_id}",
        })

    new_forwarded = list(set(report.get("forwarded_to", []) + [r["user_id"] for r in recipients]))
    history_entry = {
        "from_user": user["user_id"], "from_name": user["name"],
        "to_role": to_role, "comment": comment,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.behaviour_reports.update_one(
        {"report_id": report_id},
        {"$set": {"forwarded_to": new_forwarded, "status": "forwarded"},
         "$push": {"forwarded_history": history_entry}}
    )
    await log_audit(user["user_id"], user["name"], "forward_report", "behaviour", report_id, {"to_role": to_role})
    return {"message": f"Report forwarded to {to_role}"}


@router.post("/reports/{report_id}/meeting")
async def call_meeting(report_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    """CEO/Principal calls a meeting regarding a report."""
    report = await db.behaviour_reports.find_one({"report_id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    attendee_ids = data.get("attendees", [])
    # Always include the reporter
    if report.get("reporter_id") and report["reporter_id"] not in attendee_ids:
        attendee_ids.append(report["reporter_id"])

    meeting = {
        "called_by": user["user_id"], "called_by_name": user["name"],
        "date": data.get("date", ""), "time": data.get("time", ""),
        "location": data.get("location", "Head Office"),
        "agenda": data.get("agenda", f"Discussion regarding behaviour report"),
        "attendees": attendee_ids,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.behaviour_reports.update_one(
        {"report_id": report_id},
        {"$set": {"meeting_requested": True, "meeting_details": meeting, "status": "meeting_called"}}
    )

    # Notify all attendees
    student = await db.users.find_one({"user_id": report.get("student_id")}, {"_id": 0, "name": 1})
    for aid in attendee_ids:
        await send_notification(db, aid, {
            "type": "meeting_called",
            "title": f"Meeting Called: {student['name'] if student else 'Student'} Behaviour Report",
            "message": f"{user['name']} has called a meeting on {data.get('date', 'TBD')} at {data.get('time', 'TBD')}. Location: {data.get('location', 'Head Office')}",
            "reference_type": "behaviour_report", "reference_id": report_id,
            "action_url": f"/admin/behaviour/{report_id}",
        })

    await log_audit(user["user_id"], user["name"], "call_meeting", "behaviour", report_id)
    return {"message": f"Meeting called with {len(attendee_ids)} attendees"}


@router.post("/reports/{report_id}/resolve")
async def resolve_report(report_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    await db.behaviour_reports.update_one(
        {"report_id": report_id},
        {"$set": {"status": "resolved", "resolution": data.get("resolution", "")}}
    )
    return {"message": "Report resolved"}


# ─── Notifications ───
@router.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    notifs = await db.notifications.find(
        {"user_id": user["user_id"], "type": {"$ne": "chat_message"}}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return notifs


@router.get("/notifications/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": user["user_id"], "is_read": False, "type": {"$ne": "chat_message"}})
    return {"count": count}


@router.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"notif_id": notif_id}, {"$set": {"is_read": True}})
    return {"message": "Marked as read"}


@router.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["user_id"]}, {"$set": {"is_read": True}})
    return {"message": "All marked as read"}


# ─── Teacher's My Classes ───
@router.get("/my-classes")
async def my_classes(user: dict = Depends(get_current_user)):
    """Get classes assigned to teacher based on assigned_class_ids AND assigned_year_groups."""
    teacher = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    assigned_class_ids = teacher.get("assigned_class_ids", []) if teacher else []
    assigned_years = teacher.get("assigned_year_groups", []) if teacher else []
    teaching_subjects = teacher.get("teaching_subjects", []) if teacher else []

    seen_ids = set()
    classes = []

    # Add classes from assigned_class_ids
    if assigned_class_ids:
        for cid in assigned_class_ids:
            if cid in seen_ids:
                continue
            cls = await db.classes.find_one({"class_id": cid}, {"_id": 0})
            if cls:
                student_count = await db.users.count_documents({"role": "Student", "class_id": cid})
                cls["student_count"] = student_count
                cls["teaching_subjects"] = teaching_subjects
                classes.append(cls)
                seen_ids.add(cid)

    # ALSO add classes from assigned_year_groups (merge, don't skip)
    if assigned_years:
        for yg in assigned_years:
            year_classes = await db.classes.find({"year_group": yg}, {"_id": 0}).to_list(10)
            for cls in year_classes:
                if cls["class_id"] in seen_ids:
                    continue
                student_count = await db.users.count_documents({"role": "Student", "class_id": cls["class_id"]})
                cls["student_count"] = student_count
                cls["teaching_subjects"] = teaching_subjects
                classes.append(cls)
                seen_ids.add(cls["class_id"])
    else:
        # No assignments - fallback to all classes
        all_classes = await db.classes.find({}, {"_id": 0}).to_list(50)
        for cls in all_classes:
            cls["student_count"] = await db.users.count_documents({"role": "Student", "class_id": cls["class_id"]})
            cls["teaching_subjects"] = teaching_subjects
            classes.append(cls)

    return classes


@router.get("/class-students/{class_id}")
async def class_students(class_id: str, subject_id: str = None, user: dict = Depends(get_current_user)):
    query = {"role": "Student", "class_id": class_id}
    if subject_id:
        query["subject_ids"] = subject_id
    students = await db.users.find(
        query, {"_id": 0, "password_hash": 0}
    ).sort("name", 1).to_list(200)

    for s in students:
        s["report_count"] = await db.behaviour_reports.count_documents({"student_id": s["user_id"]})
    return students
