from fastapi import APIRouter, Depends, HTTPException
from database import db
from models import TaskCreateEnhanced, TaskTimeAction, TaskTimeManual, TaskSubmitAction, TaskApproveAction, gen_id
from auth import get_current_user, require_roles, log_audit
from datetime import datetime, timezone

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

VALID_STATUSES = ["draft", "assigned", "acknowledged", "in_progress", "blocked", "submitted", "returned", "approved", "closed"]


@router.get("")
async def list_tasks(
    assigned_to: str = None, status: str = None, priority: str = None,
    task_type: str = None, department: str = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if assigned_to:
        query["assigned_to"] = assigned_to
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if task_type:
        query["task_type"] = task_type
    if department:
        query["department"] = department

    if user.get("role") in ("Teacher", "Student"):
        query["$or"] = [{"assigned_to": user["user_id"]}, {"assigned_by": user["user_id"]}]

    tasks = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for t in tasks:
        assignee = await db.users.find_one({"user_id": t.get("assigned_to")}, {"_id": 0, "name": 1, "role": 1})
        assigner = await db.users.find_one({"user_id": t.get("assigned_by")}, {"_id": 0, "name": 1})
        t["assigned_to_name"] = assignee["name"] if assignee else ""
        t["assigned_to_role"] = assignee.get("role", "") if assignee else ""
        t["assigned_by_name"] = assigner["name"] if assigner else ""

        # Get active timer
        active_timer = await db.task_time_entries.find_one(
            {"task_id": t["task_id"], "user_id": user["user_id"], "status": "running"}, {"_id": 0}
        )
        t["has_active_timer"] = active_timer is not None
        t["active_timer"] = active_timer

        # Total time spent
        entries = await db.task_time_entries.find(
            {"task_id": t["task_id"], "status": {"$in": ["completed", "paused"]}}, {"_id": 0}
        ).to_list(100)
        t["total_time_seconds"] = sum(e.get("duration_seconds", 0) for e in entries)

        # Checklist progress
        checklist = t.get("checklist", [])
        if checklist:
            done = sum(1 for c in checklist if c.get("done"))
            t["checklist_progress"] = round(done / len(checklist) * 100)
        else:
            t["checklist_progress"] = t.get("progress_percent", 0)
    return tasks


@router.post("")
async def create_task(data: TaskCreateEnhanced, user: dict = Depends(get_current_user)):
    checklist = [{"id": gen_id("chk_"), "text": item, "done": False} for item in data.checklist]
    doc = {
        "task_id": gen_id("task_"), "title": data.title, "description": data.description,
        "task_type": data.task_type, "assigned_to": data.assigned_to,
        "assigned_role": data.assigned_role, "assigned_by": user["user_id"],
        "department": data.department, "priority": data.priority,
        "status": "assigned" if data.assigned_to else "draft",
        "start_date": data.start_date, "due_date": data.due_date,
        "estimated_minutes": data.estimated_minutes,
        "acceptance_criteria": data.acceptance_criteria,
        "confidentiality": data.confidentiality,
        "tags": data.tags, "checklist": checklist,
        "approvers": data.approvers, "sla_hours": data.sla_hours,
        "progress_percent": 0, "blockers": "",
        "comments": [], "evidence": [],
        "quality_rating": 0, "timeliness_rating": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "closed_at": ""
    }
    await db.tasks.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "create_task", "task", doc["task_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.post("/bulk")
async def create_bulk_tasks(data: dict, user: dict = Depends(get_current_user)):
    """Create a task for all teachers, or all teachers in a department."""
    query = {"role": "Teacher"}
    department = data.get("department", "")
    if department:
        query["department"] = department

    teachers = await db.users.find(query, {"_id": 0, "user_id": 1, "name": 1}).to_list(500)
    if not teachers:
        raise HTTPException(status_code=400, detail="No teachers found matching criteria")

    checklist_items = data.get("checklist", [])
    if isinstance(checklist_items, list) and checklist_items and isinstance(checklist_items[0], str):
        pass  # Already strings
    else:
        checklist_items = []

    created = 0
    for teacher in teachers:
        checklist = [{"id": gen_id("chk_"), "text": item, "done": False} for item in checklist_items]
        doc = {
            "task_id": gen_id("task_"), "title": data.get("title", ""),
            "description": data.get("description", ""),
            "task_type": data.get("task_type", "Operations"),
            "assigned_to": teacher["user_id"],
            "assigned_role": "Teacher", "assigned_by": user["user_id"],
            "department": department or teacher.get("department", ""),
            "priority": data.get("priority", "medium"),
            "status": "assigned",
            "start_date": data.get("start_date", ""),
            "due_date": data.get("due_date", ""),
            "estimated_minutes": int(data.get("estimated_minutes", 0)),
            "acceptance_criteria": data.get("acceptance_criteria", ""),
            "confidentiality": data.get("confidentiality", "public"),
            "tags": data.get("tags", []),
            "checklist": checklist,
            "approvers": [user["user_id"]],
            "sla_hours": int(data.get("sla_hours", 0)),
            "progress_percent": 0, "blockers": "",
            "comments": [], "evidence": [],
            "quality_rating": 0, "timeliness_rating": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "closed_at": ""
        }
        await db.tasks.insert_one(doc)
        created += 1

    await log_audit(user["user_id"], user["name"], "create_bulk_tasks", "task", "",
                    {"count": created, "department": department})
    return {"message": f"Task assigned to {created} teachers", "count": created}


@router.get("/{task_id}")
async def get_task(task_id: str, user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    assignee = await db.users.find_one({"user_id": task.get("assigned_to")}, {"_id": 0, "name": 1})
    assigner = await db.users.find_one({"user_id": task.get("assigned_by")}, {"_id": 0, "name": 1})
    task["assigned_to_name"] = assignee["name"] if assignee else ""
    task["assigned_by_name"] = assigner["name"] if assigner else ""

    # Time entries
    entries = await db.task_time_entries.find({"task_id": task_id}, {"_id": 0}).sort("start_at", -1).to_list(100)
    task["time_entries"] = entries
    task["total_time_seconds"] = sum(e.get("duration_seconds", 0) for e in entries if e.get("status") in ("completed", "paused"))

    active = await db.task_time_entries.find_one(
        {"task_id": task_id, "user_id": user["user_id"], "status": "running"}, {"_id": 0}
    )
    task["active_timer"] = active
    return task


# ─── Task Timer ───
@router.post("/{task_id}/time/start")
async def start_timer(task_id: str, user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check for existing running timer
    active = await db.task_time_entries.find_one(
        {"task_id": task_id, "user_id": user["user_id"], "status": "running"}, {"_id": 0}
    )
    if active:
        raise HTTPException(status_code=400, detail="Timer already running")

    entry = {
        "entry_id": gen_id("te_"), "task_id": task_id, "user_id": user["user_id"],
        "start_at": datetime.now(timezone.utc).isoformat(), "end_at": None,
        "duration_seconds": 0, "entry_type": "timer", "status": "running",
        "manual_reason": "", "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.task_time_entries.insert_one(entry)

    # Auto update task status to in_progress
    if task.get("status") in ("assigned", "acknowledged"):
        await db.tasks.update_one({"task_id": task_id}, {"$set": {"status": "in_progress"}})

    await log_audit(user["user_id"], user["name"], "timer_start", "task", task_id)
    return {k: v for k, v in entry.items() if k != "_id"}


@router.post("/{task_id}/time/pause")
async def pause_timer(task_id: str, user: dict = Depends(get_current_user)):
    active = await db.task_time_entries.find_one(
        {"task_id": task_id, "user_id": user["user_id"], "status": "running"}, {"_id": 0}
    )
    if not active:
        raise HTTPException(status_code=400, detail="No running timer")

    now = datetime.now(timezone.utc)
    start = datetime.fromisoformat(active["start_at"])
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    duration = int((now - start).total_seconds())

    await db.task_time_entries.update_one(
        {"entry_id": active["entry_id"]},
        {"$set": {"end_at": now.isoformat(), "duration_seconds": duration, "status": "paused"}}
    )
    await log_audit(user["user_id"], user["name"], "timer_pause", "task", task_id)
    return {"message": "Timer paused", "duration_seconds": duration}


@router.post("/{task_id}/time/resume")
async def resume_timer(task_id: str, user: dict = Depends(get_current_user)):
    active = await db.task_time_entries.find_one(
        {"task_id": task_id, "user_id": user["user_id"], "status": "running"}, {"_id": 0}
    )
    if active:
        raise HTTPException(status_code=400, detail="Timer already running")

    entry = {
        "entry_id": gen_id("te_"), "task_id": task_id, "user_id": user["user_id"],
        "start_at": datetime.now(timezone.utc).isoformat(), "end_at": None,
        "duration_seconds": 0, "entry_type": "timer", "status": "running",
        "manual_reason": "", "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.task_time_entries.insert_one(entry)
    await log_audit(user["user_id"], user["name"], "timer_resume", "task", task_id)
    return {k: v for k, v in entry.items() if k != "_id"}


@router.post("/{task_id}/time/stop")
async def stop_timer(task_id: str, user: dict = Depends(get_current_user)):
    active = await db.task_time_entries.find_one(
        {"task_id": task_id, "user_id": user["user_id"], "status": "running"}, {"_id": 0}
    )
    if not active:
        raise HTTPException(status_code=400, detail="No running timer")

    now = datetime.now(timezone.utc)
    start = datetime.fromisoformat(active["start_at"])
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    duration = int((now - start).total_seconds())

    await db.task_time_entries.update_one(
        {"entry_id": active["entry_id"]},
        {"$set": {"end_at": now.isoformat(), "duration_seconds": duration, "status": "completed"}}
    )
    await log_audit(user["user_id"], user["name"], "timer_stop", "task", task_id)
    return {"message": "Timer stopped", "duration_seconds": duration}


@router.post("/{task_id}/time/manual")
async def manual_time_entry(task_id: str, data: TaskTimeManual, user: dict = Depends(get_current_user)):
    entry = {
        "entry_id": gen_id("te_"), "task_id": task_id, "user_id": user["user_id"],
        "start_at": datetime.now(timezone.utc).isoformat(), "end_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": data.duration_minutes * 60, "entry_type": "manual",
        "status": "pending_approval", "manual_reason": data.reason,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.task_time_entries.insert_one(entry)
    return {k: v for k, v in entry.items() if k != "_id"}


# ─── Task Checklist ───
@router.post("/{task_id}/checklist/{item_id}/toggle")
async def toggle_checklist(task_id: str, item_id: str, user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    checklist = task.get("checklist", [])
    for item in checklist:
        if item["id"] == item_id:
            item["done"] = not item["done"]
            break

    done_count = sum(1 for c in checklist if c.get("done"))
    progress = round(done_count / len(checklist) * 100) if checklist else 0

    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {"checklist": checklist, "progress_percent": progress}}
    )
    return {"checklist": checklist, "progress_percent": progress}


# ─── Task Status Workflow ───
@router.post("/{task_id}/acknowledge")
async def acknowledge_task(task_id: str, user: dict = Depends(get_current_user)):
    await db.tasks.update_one(
        {"task_id": task_id}, {"$set": {"status": "acknowledged", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await log_audit(user["user_id"], user["name"], "acknowledge_task", "task", task_id)
    return {"message": "Task acknowledged"}


@router.post("/{task_id}/submit")
async def submit_task(task_id: str, data: TaskSubmitAction, user: dict = Depends(get_current_user)):
    update = {"status": "submitted", "updated_at": datetime.now(timezone.utc).isoformat()}
    if data.evidence:
        update["evidence"] = data.evidence
    if data.comment:
        comment = {"user_id": user["user_id"], "user_name": user["name"],
                   "text": data.comment, "timestamp": datetime.now(timezone.utc).isoformat()}
        await db.tasks.update_one({"task_id": task_id}, {"$push": {"comments": comment}, "$set": update})
    else:
        await db.tasks.update_one({"task_id": task_id}, {"$set": update})

    # Stop any running timer
    active = await db.task_time_entries.find_one(
        {"task_id": task_id, "user_id": user["user_id"], "status": "running"}, {"_id": 0}
    )
    if active:
        now = datetime.now(timezone.utc)
        start = datetime.fromisoformat(active["start_at"])
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        duration = int((now - start).total_seconds())
        await db.task_time_entries.update_one(
            {"entry_id": active["entry_id"]},
            {"$set": {"end_at": now.isoformat(), "duration_seconds": duration, "status": "completed"}}
        )

    await log_audit(user["user_id"], user["name"], "submit_task", "task", task_id)
    return {"message": "Task submitted for review"}


@router.post("/{task_id}/approve")
async def approve_task(task_id: str, data: TaskApproveAction, user: dict = Depends(get_current_user)):
    if data.approved:
        update = {
            "status": "approved", "closed_at": datetime.now(timezone.utc).isoformat(),
            "quality_rating": data.quality_rating, "timeliness_rating": data.timeliness_rating,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    else:
        update = {"status": "returned", "updated_at": datetime.now(timezone.utc).isoformat()}

    if data.feedback:
        comment = {"user_id": user["user_id"], "user_name": user["name"],
                   "text": data.feedback, "timestamp": datetime.now(timezone.utc).isoformat(), "type": "review"}
        await db.tasks.update_one({"task_id": task_id}, {"$push": {"comments": comment}, "$set": update})
    else:
        await db.tasks.update_one({"task_id": task_id}, {"$set": update})

    action = "approve_task" if data.approved else "return_task"
    await log_audit(user["user_id"], user["name"], action, "task", task_id)
    return {"message": f"Task {'approved' if data.approved else 'returned'}"}


@router.post("/{task_id}/comment")
async def add_comment(task_id: str, text: str = "", user: dict = Depends(get_current_user)):
    comment = {"user_id": user["user_id"], "user_name": user["name"],
               "text": text, "timestamp": datetime.now(timezone.utc).isoformat()}
    await db.tasks.update_one({"task_id": task_id}, {"$push": {"comments": comment}})
    return {"message": "Comment added"}


# ─── Task Analytics ───
@router.get("/analytics/summary")
async def task_analytics(user: dict = Depends(get_current_user)):
    pipeline_base = {}
    if user["role"] in ("Teacher", "Student"):
        pipeline_base = {"$or": [{"assigned_to": user["user_id"]}, {"assigned_by": user["user_id"]}]}

    total = await db.tasks.count_documents(pipeline_base)
    by_status = {}
    for s in VALID_STATUSES:
        by_status[s] = await db.tasks.count_documents({**pipeline_base, "status": s})

    overdue = await db.tasks.count_documents({
        **pipeline_base, "status": {"$nin": ["approved", "closed"]},
        "due_date": {"$lt": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "$ne": ""}
    })

    # Avg completion time
    completed = await db.tasks.find(
        {**pipeline_base, "status": {"$in": ["approved", "closed"]}}, {"_id": 0}
    ).to_list(500)
    avg_time = 0
    if completed:
        times = []
        for t in completed:
            entries = await db.task_time_entries.find(
                {"task_id": t["task_id"], "status": {"$in": ["completed", "paused"]}}, {"_id": 0}
            ).to_list(100)
            total_sec = sum(e.get("duration_seconds", 0) for e in entries)
            if total_sec > 0:
                times.append(total_sec)
        avg_time = sum(times) / len(times) if times else 0

    return {
        "total": total, "by_status": by_status, "overdue": overdue,
        "avg_completion_seconds": round(avg_time)
    }


@router.delete("/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(require_roles("SuperAdmin", "Admin"))):
    result = await db.tasks.delete_one({"task_id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.task_time_entries.delete_many({"task_id": task_id})
    await log_audit(user["user_id"], user["name"], "delete_task", "task", task_id)
    return {"message": "Task deleted"}
