"""Sick Bay / Nurse Module — Student health admissions, treatment, medical records, emergency alerts."""
from fastapi import APIRouter, Depends, HTTPException, Body
from database import db, get_active_term
from models import gen_id
from auth import get_current_user, require_roles
from ws_manager import send_notification
from datetime import datetime, timezone

router = APIRouter(prefix="/api/sick-bay", tags=["sick-bay"])

NURSE_ROLES = ("Nurse", "Admin", "SuperAdmin", "CEO", "Principal", "Founder")


@router.get("/dashboard")
async def nurse_dashboard(user: dict = Depends(require_roles(*NURSE_ROLES))):
    """Nurse dashboard: today's stats, active admissions, inventory alerts."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    active = await db.sick_bay_admissions.count_documents({"status": {"$in": ["admitted", "under_observation", "resting"]}})
    today_admissions = await db.sick_bay_admissions.count_documents({"admitted_at": {"$regex": f"^{today}"}})
    today_discharged = await db.sick_bay_admissions.count_documents({"discharged_at": {"$regex": f"^{today}"}})
    total_records = await db.sick_bay_admissions.count_documents({})

    # Low stock meds
    low_stock = await db.medical_inventory.count_documents({"$expr": {"$lte": ["$quantity", "$min_threshold"]}})

    # Recent admissions
    recent = await db.sick_bay_admissions.find(
        {}, {"_id": 0}
    ).sort("admitted_at", -1).to_list(10)

    return {
        "active_admissions": active,
        "today_admissions": today_admissions,
        "today_discharged": today_discharged,
        "total_records": total_records,
        "low_stock_meds": low_stock,
        "recent_admissions": recent,
    }


@router.post("/admit")
async def admit_student(data: dict = Body(...), user: dict = Depends(require_roles(*NURSE_ROLES))):
    """Admit a student to sick bay and send notifications."""
    student_id = data.get("student_id")
    if not student_id:
        raise HTTPException(400, "student_id required")

    student = await db.users.find_one({"user_id": student_id}, {"_id": 0, "name": 1, "year_group": 1, "class_id": 1, "admission_number": 1})
    if not student:
        raise HTTPException(404, "Student not found")

    # Check if already admitted
    existing = await db.sick_bay_admissions.find_one(
        {"student_id": student_id, "status": {"$in": ["admitted", "under_observation", "resting"]}},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(400, "Student is already in sick bay")

    now = datetime.now(timezone.utc).isoformat()
    admission_id = gen_id("sba_")
    cls = await db.classes.find_one({"class_id": student.get("class_id")}, {"_id": 0, "name": 1})

    doc = {
        "admission_id": admission_id,
        "student_id": student_id,
        "student_name": student.get("name", ""),
        "year_group": student.get("year_group", ""),
        "class_name": cls.get("name", "") if cls else "",
        "admission_number": student.get("admission_number", ""),
        "reason": data.get("reason", ""),
        "reason_category": data.get("reason_category", "general"),
        "symptoms": data.get("symptoms", ""),
        "temperature": data.get("temperature", ""),
        "notes": data.get("notes", ""),
        "status": "admitted",
        "admitted_by": user["user_id"],
        "admitted_by_name": user.get("name", ""),
        "admitted_at": now,
        "treatments": [],
        "status_log": [{"status": "admitted", "at": now, "by": user.get("name", "")}],
        "discharged_at": None,
        "discharged_by": None,
        "discharge_notes": "",
    }
    await db.sick_bay_admissions.insert_one(doc)
    doc.pop("_id", None)

    # Send notifications to teachers, admin, principal
    notify_roles = ["Admin", "SuperAdmin", "CEO", "Principal", "HeadTeacher", "Teacher"]
    staff = await db.users.find({"role": {"$in": notify_roles}}, {"_id": 0, "user_id": 1}).to_list(50)
    for s in staff:
        await send_notification(db, s["user_id"], {
            "type": "sick_bay_admission",
            "title": f"Sick Bay: {student.get('name', '')}",
            "message": f"{student.get('name', '')} ({student.get('year_group', '')}) admitted to sick bay. Reason: {data.get('reason', 'Not specified')}",
            "reference_type": "sick_bay", "reference_id": admission_id,
        })

    # Notify parents
    parents = await db.users.find({"role": "Parent", "children_ids": student_id}, {"_id": 0, "user_id": 1}).to_list(5)
    for p in parents:
        await send_notification(db, p["user_id"], {
            "type": "sick_bay_admission",
            "title": "Your child is in sick bay",
            "message": f"{student.get('name', '')} has been admitted to the sick bay. Reason: {data.get('reason', 'General check-up')}",
            "reference_type": "sick_bay", "reference_id": admission_id,
        })

    return doc


@router.get("/admissions")
async def list_admissions(status: str = None, date: str = None, user: dict = Depends(require_roles(*NURSE_ROLES))):
    """List sick bay admissions, optionally filtered."""
    query = {}
    if status:
        query["status"] = status if status != "active" else {"$in": ["admitted", "under_observation", "resting"]}
    if date:
        query["admitted_at"] = {"$regex": f"^{date}"}
    admissions = await db.sick_bay_admissions.find(query, {"_id": 0}).sort("admitted_at", -1).to_list(200)
    return admissions


@router.put("/admissions/{admission_id}/status")
async def update_status(admission_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*NURSE_ROLES))):
    """Update admission status (under_observation, resting, referred, discharged)."""
    admission = await db.sick_bay_admissions.find_one({"admission_id": admission_id}, {"_id": 0})
    if not admission:
        raise HTTPException(404, "Admission not found")

    new_status = data.get("status")
    valid = ["admitted", "under_observation", "resting", "referred_to_hospital", "discharged"]
    if new_status not in valid:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid}")

    now = datetime.now(timezone.utc).isoformat()
    updates = {
        "status": new_status,
        "updated_at": now,
    }

    # Append to status log
    log_entry = {"status": new_status, "at": now, "by": user.get("name", ""), "notes": data.get("notes", "")}

    if new_status == "discharged":
        updates["discharged_at"] = now
        updates["discharged_by"] = user["user_id"]
        updates["discharged_by_name"] = user.get("name", "")
        updates["discharge_notes"] = data.get("notes", "")

        # Notify on discharge
        parents = await db.users.find({"role": "Parent", "children_ids": admission["student_id"]}, {"_id": 0, "user_id": 1}).to_list(5)
        for p in parents:
            await send_notification(db, p["user_id"], {
                "type": "sick_bay_discharge",
                "title": "Child discharged from sick bay",
                "message": f"{admission['student_name']} has been discharged from the sick bay.",
                "reference_type": "sick_bay", "reference_id": admission_id,
            })

    await db.sick_bay_admissions.update_one(
        {"admission_id": admission_id},
        {"$set": updates, "$push": {"status_log": log_entry}}
    )
    return {"message": f"Status updated to {new_status}"}


@router.post("/admissions/{admission_id}/treatment")
async def add_treatment(admission_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*NURSE_ROLES))):
    """Add a treatment record to an admission."""
    now = datetime.now(timezone.utc).isoformat()
    treatment = {
        "treatment_id": gen_id("trt_"),
        "treatment_type": data.get("treatment_type", "medication"),
        "description": data.get("description", ""),
        "medication": data.get("medication", ""),
        "dosage": data.get("dosage", ""),
        "administered_by": user.get("name", ""),
        "administered_at": now,
        "notes": data.get("notes", ""),
    }
    await db.sick_bay_admissions.update_one(
        {"admission_id": admission_id},
        {"$push": {"treatments": treatment}}
    )
    return treatment


@router.post("/emergency")
async def emergency_alert(data: dict = Body(...), user: dict = Depends(require_roles(*NURSE_ROLES))):
    """One-click emergency alert — notifies Admin, Principal, CEO immediately."""
    now = datetime.now(timezone.utc).isoformat()
    alert_id = gen_id("emg_")

    doc = {
        "alert_id": alert_id,
        "student_id": data.get("student_id", ""),
        "student_name": data.get("student_name", ""),
        "description": data.get("description", "EMERGENCY in Sick Bay"),
        "triggered_by": user["user_id"],
        "triggered_by_name": user.get("name", ""),
        "triggered_at": now,
        "status": "active",
        "acknowledged_by": [],
    }
    await db.emergency_alerts.insert_one(doc)

    # Notify ALL admin/management immediately
    urgent_roles = ["Admin", "SuperAdmin", "CEO", "Principal", "Founder", "HeadTeacher"]
    staff = await db.users.find({"role": {"$in": urgent_roles}}, {"_id": 0, "user_id": 1}).to_list(20)
    for s in staff:
        await send_notification(db, s["user_id"], {
            "type": "sick_bay_emergency",
            "title": "EMERGENCY ALERT - Sick Bay",
            "message": f"URGENT: {data.get('description', 'Emergency in sick bay')}. Student: {data.get('student_name', 'Unknown')}. Triggered by {user.get('name', '')}",
            "reference_type": "emergency", "reference_id": alert_id,
            "priority": "urgent",
        })

    # Broadcast push to ALL subscribed devices (emergency = everyone needs to know)
    from ws_manager import send_push_to_all
    await send_push_to_all(db, {
        "title": "EMERGENCY - Sick Bay",
        "message": f"{data.get('student_name', 'Student')}: {data.get('description', 'Emergency')}",
        "type": "sick_bay_emergency",
        "url": "/",
    })

    return {"alert_id": alert_id, "message": "Emergency alert sent to all management"}


@router.get("/emergency/active")
async def active_emergencies(user: dict = Depends(get_current_user)):
    """Get active emergency alerts not yet acknowledged by this user."""
    uid = user["user_id"]
    alerts = await db.emergency_alerts.find(
        {"status": "active", "acknowledged_by": {"$not": {"$elemMatch": {"$eq": uid}}}},
        {"_id": 0}
    ).sort("triggered_at", -1).to_list(10)
    return alerts


@router.post("/emergency/{alert_id}/acknowledge")
async def acknowledge_emergency(alert_id: str, user: dict = Depends(get_current_user)):
    """Mark an emergency alert as acknowledged by this user."""
    alert = await db.emergency_alerts.find_one({"alert_id": alert_id}, {"_id": 0})
    if not alert:
        raise HTTPException(404, "Alert not found")
    await db.emergency_alerts.update_one(
        {"alert_id": alert_id},
        {"$addToSet": {"acknowledged_by": user["user_id"]}}
    )
    return {"message": "Alert acknowledged"}



# ─── MEDICAL INVENTORY ───
@router.get("/inventory")
async def list_medical_inventory(category: str = None, user: dict = Depends(require_roles(*NURSE_ROLES))):
    query = {}
    if category:
        query["category"] = category
    items = await db.medical_inventory.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    return items


@router.post("/inventory")
async def add_medical_item(data: dict = Body(...), user: dict = Depends(require_roles(*NURSE_ROLES))):
    now = datetime.now(timezone.utc).isoformat()
    item_id = gen_id("med_")
    doc = {
        "item_id": item_id,
        "name": data.get("name", ""),
        "category": data.get("category", "medication"),
        "description": data.get("description", ""),
        "quantity": data.get("quantity", 0),
        "unit": data.get("unit", "units"),
        "min_threshold": data.get("min_threshold", 5),
        "expiry_date": data.get("expiry_date", ""),
        "supplier": data.get("supplier", ""),
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now,
        "movement_log": [{"type": "initial", "quantity": data.get("quantity", 0), "at": now, "by": user.get("name", "")}],
    }
    await db.medical_inventory.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/inventory/{item_id}")
async def update_medical_item(item_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*NURSE_ROLES))):
    item = await db.medical_inventory.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Item not found")
    now = datetime.now(timezone.utc).isoformat()
    updates = {}
    for field in ["name", "category", "description", "unit", "min_threshold", "expiry_date", "supplier"]:
        if field in data:
            updates[field] = data[field]
    if "quantity_change" in data:
        change = int(data["quantity_change"])
        new_qty = max(0, item.get("quantity", 0) + change)
        updates["quantity"] = new_qty
        log_entry = {"type": "adjustment", "change": change, "new_qty": new_qty, "at": now, "by": user.get("name", ""), "reason": data.get("reason", "")}
        await db.medical_inventory.update_one({"item_id": item_id}, {"$push": {"movement_log": log_entry}})
    if "quantity" in data and "quantity_change" not in data:
        updates["quantity"] = data["quantity"]
    updates["updated_at"] = now
    await db.medical_inventory.update_one({"item_id": item_id}, {"$set": updates})
    updated = await db.medical_inventory.find_one({"item_id": item_id}, {"_id": 0})
    return updated


@router.delete("/inventory/{item_id}")
async def delete_medical_item(item_id: str, user: dict = Depends(require_roles(*NURSE_ROLES))):
    result = await db.medical_inventory.delete_one({"item_id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Item not found")
    return {"message": "Item deleted"}


# ─── STUDENT MEDICAL HISTORY ───
@router.get("/history/{student_id}")
async def student_medical_history(student_id: str, user: dict = Depends(require_roles(*NURSE_ROLES))):
    """Get all sick bay admissions for a specific student."""
    records = await db.sick_bay_admissions.find(
        {"student_id": student_id}, {"_id": 0}
    ).sort("admitted_at", -1).to_list(100)
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0, "name": 1, "year_group": 1, "class_id": 1, "admission_number": 1})
    return {"student": student, "records": records}


# ─── SEARCH STUDENTS (for admission form) ───
@router.get("/students/search")
async def search_students(q: str = "", user: dict = Depends(require_roles(*NURSE_ROLES))):
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
