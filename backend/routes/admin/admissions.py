from fastapi import APIRouter, Depends, HTTPException, Body
from database import db
from models import gen_id
from auth import get_current_user, require_roles, log_audit, hash_password
from datetime import datetime, timezone

router = APIRouter(prefix="/api/admissions", tags=["admissions"])

ADMISSIONS_ROLES = ("AdmissionsOfficer", "Admin", "SuperAdmin", "CEO", "Principal")

PIPELINE_STAGES = ["received", "reviewed", "interviewed", "accepted", "waitlisted", "enrolled", "rejected"]

REQUIRED_DOCUMENTS = [
    "Birth Certificate", "Previous School Report", "Passport Photos",
    "Medical Records", "Immunization Records", "Guardian ID Copy",
    "Recommendation Letter"
]


@router.get("/dashboard")
async def admissions_dashboard(user: dict = Depends(require_roles(*ADMISSIONS_ROLES))):
    total = await db.admissions.count_documents({})
    by_stage = {}
    for stage in PIPELINE_STAGES:
        by_stage[stage] = await db.admissions.count_documents({"status": stage})
    current_year = datetime.now(timezone.utc).strftime("%Y")
    this_year = await db.admissions.count_documents({"created_at": {"$regex": f"^{current_year}"}})
    return {
        "total_applications": total,
        "by_stage": by_stage,
        "this_year": this_year,
        "pipeline_stages": PIPELINE_STAGES
    }


@router.get("/applications")
async def list_applications(status: str = None, year_group: str = None, limit: int = 200, user: dict = Depends(require_roles(*ADMISSIONS_ROLES))):
    query = {}
    if status:
        query["status"] = status
    if year_group:
        query["applying_for"] = year_group
    apps = await db.admissions.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return apps


@router.post("/applications")
async def create_application(data: dict = Body(...), user: dict = Depends(require_roles(*ADMISSIONS_ROLES))):
    doc = {
        "application_id": gen_id("app_"),
        "student_name": data.get("student_name", ""),
        "date_of_birth": data.get("date_of_birth", ""),
        "gender": data.get("gender", ""),
        "applying_for": data.get("applying_for", "Year 7"),
        "boarding_status": data.get("boarding_status", "day"),
        "guardian_name": data.get("guardian_name", ""),
        "guardian_phone": data.get("guardian_phone", ""),
        "guardian_email": data.get("guardian_email", ""),
        "previous_school": data.get("previous_school", ""),
        "notes": data.get("notes", ""),
        "status": "received",
        "documents_submitted": [],
        "interview_date": "",
        "interview_notes": "",
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.admissions.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "create_application", "admissions", doc["application_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/applications/{app_id}")
async def get_application(app_id: str, user: dict = Depends(require_roles(*ADMISSIONS_ROLES))):
    app = await db.admissions.find_one({"application_id": app_id}, {"_id": 0})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.put("/applications/{app_id}")
async def update_application(app_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*ADMISSIONS_ROLES))):
    safe_fields = {"student_name", "date_of_birth", "gender", "applying_for", "boarding_status",
                   "guardian_name", "guardian_phone", "guardian_email", "previous_school", "notes",
                   "interview_date", "interview_notes", "documents_submitted"}
    update = {k: v for k, v in data.items() if k in safe_fields}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.admissions.update_one({"application_id": app_id}, {"$set": update})
    return {"message": "Application updated"}


@router.put("/applications/{app_id}/status")
async def change_status(app_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*ADMISSIONS_ROLES))):
    new_status = data.get("status", "")
    if new_status not in PIPELINE_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {PIPELINE_STAGES}")
    await db.admissions.update_one({"application_id": app_id}, {
        "$set": {"status": new_status, "status_changed_by": user["user_id"], "status_changed_at": datetime.now(timezone.utc).isoformat()},
        "$push": {"status_history": {"status": new_status, "changed_by": user["name"], "at": datetime.now(timezone.utc).isoformat()}}
    })
    await log_audit(user["user_id"], user["name"], f"change_status_{new_status}", "admissions", app_id)
    return {"message": f"Status changed to {new_status}"}


@router.post("/applications/{app_id}/enroll")
async def enroll_student(app_id: str, data: dict = Body({}), user: dict = Depends(require_roles(*ADMISSIONS_ROLES))):
    """Convert accepted application into an active student."""
    app = await db.admissions.find_one({"application_id": app_id}, {"_id": 0})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app["status"] not in ("accepted", "enrolled"):
        raise HTTPException(status_code=400, detail="Only accepted applications can be enrolled")

    # Check for existing student with same name
    existing = await db.users.find_one({"name": app["student_name"], "role": "Student"}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="A student with this name already exists")

    # Find class for the year group
    cls = await db.classes.find_one({"year_group": app["applying_for"]}, {"_id": 0})
    class_id = cls["class_id"] if cls else ""

    # Generate admission number
    count = await db.users.count_documents({"role": "Student"})
    year = datetime.now(timezone.utc).strftime("%Y")
    adm_num = f"TCIS{year}{count + 1:03d}"

    # Create student user
    email = data.get("email", f"{app['student_name'].lower().replace(' ', '.')}@tcis.student")
    password = data.get("password", "student123")

    student_doc = {
        "user_id": gen_id("user_"),
        "name": app["student_name"],
        "email": email,
        "password_hash": hash_password(password),
        "role": "Student",
        "roles": [],
        "admission_number": adm_num,
        "class_id": class_id,
        "year_group": app["applying_for"],
        "boarding_status": app.get("boarding_status", "day"),
        "date_of_birth": app.get("date_of_birth", ""),
        "guardian_name": app.get("guardian_name", ""),
        "guardian_phone": app.get("guardian_phone", ""),
        "is_active": True,
        "subject_ids": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(student_doc)

    # Update application status
    await db.admissions.update_one({"application_id": app_id}, {
        "$set": {"status": "enrolled", "enrolled_user_id": student_doc["user_id"], "enrolled_at": datetime.now(timezone.utc).isoformat()}
    })

    await log_audit(user["user_id"], user["name"], "enroll_student", "admissions", app_id, {"student_id": student_doc["user_id"]})
    return {"message": f"Student enrolled: {app['student_name']} ({adm_num})", "user_id": student_doc["user_id"], "admission_number": adm_num, "email": email}


@router.get("/documents-checklist")
async def get_documents_checklist(user: dict = Depends(require_roles(*ADMISSIONS_ROLES))):
    return {"required_documents": REQUIRED_DOCUMENTS}


@router.delete("/applications/{app_id}")
async def delete_application(app_id: str, user: dict = Depends(require_roles(*ADMISSIONS_ROLES))):
    await db.admissions.delete_one({"application_id": app_id})
    return {"message": "Application deleted"}
