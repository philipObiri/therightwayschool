from fastapi import APIRouter, Depends, HTTPException
from database import db
from models import ClockAction, LeaveRequestCreate, LeaveApproval, gen_id
from auth import get_current_user, require_roles, log_audit
from datetime import datetime, timezone

router = APIRouter(prefix="/api/hr", tags=["hr"])


# ─── Clock In/Out ───
@router.post("/clock")
async def clock_action(data: ClockAction, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    if data.action == "clock_in":
        # Check if already clocked in
        active = await db.clock_entries.find_one(
            {"user_id": user["user_id"], "clock_out": None}, {"_id": 0}
        )
        if active:
            raise HTTPException(status_code=400, detail="Already clocked in")
        doc = {
            "entry_id": gen_id("clk_"), "user_id": user["user_id"],
            "clock_in": now, "clock_out": None, "method": data.method,
            "created_at": now
        }
        await db.clock_entries.insert_one(doc)
        await log_audit(user["user_id"], user["name"], "clock_in", "hr", doc["entry_id"])
        return {"message": "Clocked in", "entry_id": doc["entry_id"], "clock_in": now}
    else:
        active = await db.clock_entries.find_one(
            {"user_id": user["user_id"], "clock_out": None}, {"_id": 0}
        )
        if not active:
            raise HTTPException(status_code=400, detail="Not clocked in")
        await db.clock_entries.update_one(
            {"entry_id": active["entry_id"]}, {"$set": {"clock_out": now}}
        )
        await log_audit(user["user_id"], user["name"], "clock_out", "hr", active["entry_id"])
        return {"message": "Clocked out", "entry_id": active["entry_id"], "clock_out": now}


@router.get("/clock/status")
async def clock_status(user: dict = Depends(get_current_user)):
    active = await db.clock_entries.find_one(
        {"user_id": user["user_id"], "clock_out": None}, {"_id": 0}
    )
    return {"clocked_in": active is not None, "entry": active}


@router.post("/clock/auto-in")
async def auto_clock_in(user: dict = Depends(get_current_user)):
    """Auto clock-in on login if not already clocked in today."""
    # Only for staff roles
    if user.get("role") in ("Student", "Parent"):
        return {"message": "Not applicable"}
    active = await db.clock_entries.find_one(
        {"user_id": user["user_id"], "clock_out": None}, {"_id": 0}
    )
    if active:
        return {"message": "Already clocked in", "entry_id": active["entry_id"]}
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "entry_id": gen_id("clk_"), "user_id": user["user_id"],
        "clock_in": now, "clock_out": None, "method": "auto_login",
        "created_at": now
    }
    await db.clock_entries.insert_one(doc)
    return {"message": "Auto clocked in", "entry_id": doc["entry_id"], "clock_in": now}


@router.get("/clock/history")
async def clock_history(user_id: str = None, user: dict = Depends(get_current_user)):
    target = user_id or user["user_id"]
    entries = await db.clock_entries.find(
        {"user_id": target}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return entries


# ─── Leave Management ───
@router.post("/leave")
async def request_leave(data: dict, user: dict = Depends(get_current_user)):
    doc = {
        "leave_id": gen_id("lv_"), "user_id": user["user_id"],
        "user_name": user["name"], "leave_type": data.get("leave_type", "annual"),
        "start_date": data.get("start_date", ""), "end_date": data.get("end_date", ""),
        "reason": data.get("reason", ""), "status": "pending",
        "attachment_file_id": data.get("attachment_file_id", ""),
        "approved_by": "", "approved_at": "", "comment": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.leave_requests.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "request_leave", "hr", doc["leave_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/leave")
async def list_leave(status: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] not in ("Admin", "SuperAdmin", "HR_Officer"):
        query["user_id"] = user["user_id"]
    if status:
        query["status"] = status
    leaves = await db.leave_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return leaves


@router.post("/leave/{leave_id}/approve")
async def approve_leave(
    leave_id: str, data: LeaveApproval,
    user: dict = Depends(require_roles("Admin", "SuperAdmin", "HR_Officer"))
):
    status = "approved" if data.approved else "rejected"
    await db.leave_requests.update_one(
        {"leave_id": leave_id},
        {"$set": {"status": status, "approved_by": user["user_id"],
                  "approved_at": datetime.now(timezone.utc).isoformat(), "comment": data.comment}}
    )
    await log_audit(user["user_id"], user["name"], f"leave_{status}", "hr", leave_id)
    return {"message": f"Leave {status}"}


# ─── Staff Documents ───
@router.get("/staff-documents")
async def list_staff_documents(user_id: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if user_id:
        query["user_id"] = user_id
    elif user["role"] not in ("Admin", "SuperAdmin", "HR_Officer", "CEO"):
        query["user_id"] = user["user_id"]  # Staff can see their own docs
    docs = await db.staff_documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@router.post("/staff-documents")
async def upload_staff_document(data: dict, user: dict = Depends(get_current_user)):
    doc = {
        "doc_id": gen_id("sdoc_"),
        "user_id": data.get("user_id", ""),
        "file_id": data.get("file_id", ""),
        "filename": data.get("filename", ""),
        "doc_type": data.get("doc_type", "other"),
        "title": data.get("title", ""),
        "uploaded_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.staff_documents.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "upload_staff_doc", "hr", doc["doc_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/staff-documents/{doc_id}")
async def delete_staff_document(doc_id: str, user: dict = Depends(get_current_user)):
    await db.staff_documents.delete_one({"doc_id": doc_id})
    return {"message": "Document deleted"}


HR_ADMIN_ROLES = ("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher", "HR_Officer")

@router.get("/dashboard")
async def hr_dashboard(user: dict = Depends(require_roles(*HR_ADMIN_ROLES))):
    """Full HR dashboard: clock-ins, CVs, working paper activity."""
    import asyncio

    # All staff (non-student, non-parent)
    staff = await db.users.find(
        {"role": {"$nin": ["Student", "Parent"]}},
        {"_id": 0, "password_hash": 0, "last_set_password": 0}
    ).to_list(200)

    # Today's clock-ins
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    active_clocks = await db.clock_entries.find(
        {"clock_out": None}, {"_id": 0}
    ).to_list(200)
    clocked_in_ids = {c["user_id"] for c in active_clocks}

    # Staff documents (CVs)
    all_docs = await db.staff_documents.find({}, {"_id": 0}).to_list(500)
    docs_by_user = {}
    for d in all_docs:
        docs_by_user.setdefault(d["user_id"], []).append(d)

    # Working paper activity (last 30 min)
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    live_activity = await db.working_paper_logs.find(
        {"created_at": {"$gte": cutoff}}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)

    # Recent WP audit
    wp_recent = await db.wp_audit.find({}, {"_id": 0}).sort("timestamp", -1).to_list(30)

    # Build staff list with status
    result = []
    for s in staff:
        uid = s["user_id"]
        s["clocked_in"] = uid in clocked_in_ids
        clock_entry = next((c for c in active_clocks if c["user_id"] == uid), None)
        s["clock_in_time"] = clock_entry.get("clock_in", "") if clock_entry else ""
        s["clock_method"] = clock_entry.get("method", "") if clock_entry else ""
        s["documents"] = docs_by_user.get(uid, [])
        s["doc_count"] = len(docs_by_user.get(uid, []))
        result.append(s)

    return {
        "staff": result,
        "total_staff": len(staff),
        "clocked_in_count": len(clocked_in_ids),
        "live_activity": live_activity,
        "wp_recent": wp_recent,
    }
