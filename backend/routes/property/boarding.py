from fastapi import APIRouter, Depends, HTTPException, Body
from database import db
from models import gen_id
from auth import get_current_user, require_roles, log_audit
from ws_manager import send_notification
from datetime import datetime, timezone

router = APIRouter(prefix="/api/boarding", tags=["boarding"])

BOARDING_ROLES = ("BoardingOfficer", "Admin", "SuperAdmin", "CEO", "Principal", "HeadTeacher")


@router.get("/dashboard")
async def boarding_dashboard(user: dict = Depends(require_roles(*BOARDING_ROLES))):
    total_boarding = await db.users.count_documents({"role": "Student", "boarding_status": "boarding"})
    total_day = await db.users.count_documents({"role": "Student", "boarding_status": {"$ne": "boarding"}})
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    checked_in = await db.boarding_checkins.count_documents({"date": today, "type": "check_in"})
    checked_out = await db.boarding_checkins.count_documents({"date": today, "type": "check_out"})
    pending_leave = await db.boarding_leave.count_documents({"status": "pending"})
    open_incidents = await db.boarding_incidents.count_documents({"status": {"$in": ["open", "investigating"]}})
    dorms = await db.boarding_dorms.count_documents({})
    return {
        "total_boarding": total_boarding, "total_day": total_day,
        "checked_in_today": checked_in, "checked_out_today": checked_out,
        "pending_leave": pending_leave, "open_incidents": open_incidents,
        "total_dorms": dorms
    }


@router.get("/students")
async def list_boarding_students(year_group: str = None, dorm_id: str = None, user: dict = Depends(require_roles(*BOARDING_ROLES))):
    query = {"role": "Student", "boarding_status": "boarding"}
    if year_group:
        query["year_group"] = year_group
    if dorm_id:
        query["dorm_id"] = dorm_id
    students = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(500)
    # Bulk fetch classes
    class_ids = list({s.get("class_id") for s in students if s.get("class_id")})
    classes = await db.classes.find({"class_id": {"$in": class_ids}}, {"_id": 0}).to_list(len(class_ids)) if class_ids else []
    cls_map = {c["class_id"]: c["name"] for c in classes}
    for s in students:
        s["class_name"] = cls_map.get(s.get("class_id", ""), "")
    return students


# ─── Check-In / Check-Out ───
@router.post("/checkin")
async def record_checkin(data: dict = Body(...), user: dict = Depends(require_roles(*BOARDING_ROLES))):
    now = datetime.now(timezone.utc)
    doc = {
        "checkin_id": gen_id("bci_"),
        "student_id": data.get("student_id"),
        "type": data.get("type", "check_in"),  # check_in, check_out
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M"),
        "notes": data.get("notes", ""),
        "recorded_by": user["user_id"],
        "created_at": now.isoformat()
    }
    await db.boarding_checkins.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.post("/checkin/bulk")
async def bulk_checkin(data: dict = Body(...), user: dict = Depends(require_roles(*BOARDING_ROLES))):
    student_ids = data.get("student_ids", [])
    check_type = data.get("type", "check_in")
    now = datetime.now(timezone.utc)
    count = 0
    for sid in student_ids:
        await db.boarding_checkins.insert_one({
            "checkin_id": gen_id("bci_"), "student_id": sid,
            "type": check_type, "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M"), "notes": data.get("notes", ""),
            "recorded_by": user["user_id"], "created_at": now.isoformat()
        })
        count += 1
    return {"message": f"{count} students {check_type.replace('_', ' ')}ed"}


@router.get("/checkins")
async def list_checkins(date: str = None, student_id: str = None, user: dict = Depends(require_roles(*BOARDING_ROLES))):
    query = {}
    if date:
        query["date"] = date
    else:
        query["date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if student_id:
        query["student_id"] = student_id
    records = await db.boarding_checkins.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Bulk fetch student names
    sids = list({r.get("student_id") for r in records if r.get("student_id")})
    students = await db.users.find({"user_id": {"$in": sids}}, {"_id": 0, "user_id": 1, "name": 1, "year_group": 1}).to_list(len(sids)) if sids else []
    s_map = {s["user_id"]: s for s in students}
    for r in records:
        st = s_map.get(r.get("student_id"))
        r["student_name"] = st["name"] if st else ""
        r["year_group"] = st.get("year_group", "") if st else ""
    return records


# ─── Incidents ───
@router.post("/incidents")
async def create_incident(data: dict = Body(...), user: dict = Depends(require_roles(*BOARDING_ROLES))):
    doc = {
        "incident_id": gen_id("binc_"),
        "student_id": data.get("student_id", ""),
        "category": data.get("category", "general"),  # health, disciplinary, maintenance, general
        "severity": data.get("severity", "low"),  # low, medium, high
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "status": "open",
        "reported_by": user["user_id"],
        "reporter_name": user["name"],
        "resolution": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.boarding_incidents.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "create_boarding_incident", "boarding", doc["incident_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/incidents")
async def list_incidents(status: str = None, user: dict = Depends(require_roles(*BOARDING_ROLES))):
    query = {}
    if status:
        query["status"] = status
    incidents = await db.boarding_incidents.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    sids = list({i.get("student_id") for i in incidents if i.get("student_id")})
    students = await db.users.find({"user_id": {"$in": sids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(sids)) if sids else []
    s_map = {s["user_id"]: s for s in students}
    for i in incidents:
        st = s_map.get(i.get("student_id"))
        i["student_name"] = st["name"] if st else ""
    return incidents


@router.put("/incidents/{incident_id}")
async def update_incident(incident_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*BOARDING_ROLES))):
    safe = {k: v for k, v in data.items() if k in ("status", "resolution", "severity")}
    if not safe:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.boarding_incidents.update_one({"incident_id": incident_id}, {"$set": safe})
    return {"message": "Incident updated"}


# ─── Leave Permissions ───
@router.post("/leave")
async def request_leave(data: dict = Body(...), user: dict = Depends(get_current_user)):
    doc = {
        "leave_id": gen_id("blv_"),
        "student_id": data.get("student_id", ""),
        "requested_by": user["user_id"],
        "requester_name": user["name"],
        "start_date": data.get("start_date", ""),
        "end_date": data.get("end_date", ""),
        "reason": data.get("reason", ""),
        "status": "pending",
        "approved_by": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.boarding_leave.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/leave")
async def list_leave(status: str = None, user: dict = Depends(require_roles(*BOARDING_ROLES))):
    query = {}
    if status:
        query["status"] = status
    leaves = await db.boarding_leave.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    sids = list({l.get("student_id") for l in leaves if l.get("student_id")})
    students = await db.users.find({"user_id": {"$in": sids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(sids)) if sids else []
    s_map = {s["user_id"]: s for s in students}
    for l in leaves:
        st = s_map.get(l.get("student_id"))
        l["student_name"] = st["name"] if st else ""
    return leaves


@router.put("/leave/{leave_id}/approve")
async def approve_leave(leave_id: str, user: dict = Depends(require_roles(*BOARDING_ROLES))):
    await db.boarding_leave.update_one({"leave_id": leave_id}, {"$set": {"status": "approved", "approved_by": user["user_id"]}})
    return {"message": "Leave approved"}


@router.put("/leave/{leave_id}/deny")
async def deny_leave(leave_id: str, data: dict = Body({}), user: dict = Depends(require_roles(*BOARDING_ROLES))):
    await db.boarding_leave.update_one({"leave_id": leave_id}, {"$set": {"status": "denied", "denial_reason": data.get("reason", "")}})
    return {"message": "Leave denied"}


# ─── Dorms ───
@router.get("/dorms")
async def list_dorms(user: dict = Depends(require_roles(*BOARDING_ROLES))):
    dorms = await db.boarding_dorms.find({}, {"_id": 0}).to_list(50)
    for d in dorms:
        d["occupancy"] = await db.users.count_documents({"dorm_id": d["dorm_id"]})
    return dorms


@router.post("/dorms")
async def create_dorm(data: dict = Body(...), user: dict = Depends(require_roles(*BOARDING_ROLES))):
    doc = {
        "dorm_id": gen_id("drm_"),
        "name": data.get("name", ""),
        "capacity": data.get("capacity", 20),
        "gender": data.get("gender", "mixed"),
        "floor": data.get("floor", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.boarding_dorms.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/students/{student_id}/assign-dorm")
async def assign_dorm(student_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*BOARDING_ROLES))):
    dorm_id = data.get("dorm_id", "")
    await db.users.update_one({"user_id": student_id}, {"$set": {"dorm_id": dorm_id}})
    return {"message": "Dorm assigned"}


@router.put("/students/{student_id}/boarding-status")
async def change_boarding_status(student_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*BOARDING_ROLES))):
    """Change a student's boarding status and notify finance to handle fees."""
    new_status = data.get("boarding_status", "")
    if new_status not in ("boarding", "day"):
        raise HTTPException(status_code=400, detail="Status must be 'boarding' or 'day'")

    student = await db.users.find_one({"user_id": student_id, "role": "Student"}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    old_status = student.get("boarding_status", "day")
    if old_status == new_status:
        return {"message": "No change needed"}

    # Update student boarding status
    await db.users.update_one({"user_id": student_id}, {"$set": {"boarding_status": new_status}})

    if new_status == "boarding":
        fee_action = "Please apply the appropriate boarding fee for this student."
    else:
        fee_action = "Please review and credit/cancel any outstanding boarding fees for this student."

    # Notify all finance staff
    finance_users = await db.users.find({"role": {"$in": ["FinanceOfficer", "SuperAdmin"]}}, {"_id": 0, "user_id": 1}).to_list(10)
    for fu in finance_users:
        await send_notification(db, fu["user_id"], {
            "type": "boarding_status_change",
            "title": f"Boarding Status Changed: {student['name']}",
            "message": f"{user['name']} changed {student['name']} from {old_status} to {new_status}. {fee_action}",
            "reference_type": "student", "reference_id": student_id,
            "action_url": "/admin/finance",
        })

    await log_audit(user["user_id"], user["name"], "change_boarding_status", "student", student_id,
                    {"old_status": old_status, "new_status": new_status})

    return {
        "message": f"Boarding status changed from {old_status} to {new_status}",
        "fee_action": fee_action,
        "student_name": student["name"]
    }
