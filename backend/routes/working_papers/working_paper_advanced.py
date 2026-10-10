"""
Working Paper Advanced Features
Smart folders, approval workflows, tasks, discussions, sharing, templates.
"""
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from database import db
from models import gen_id
from auth import get_current_user, require_roles
from ws_manager import send_notification
from datetime import datetime, timezone, timedelta
import hashlib, secrets

router = APIRouter(prefix="/api/wp", tags=["working-paper-advanced"])

ADMIN_ROLES = ("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher")


async def wp_audit(user_id, user_name, action, entity_type, entity_id, details=None):
    try:
        await db.wp_audit.insert_one({
            "audit_id": gen_id("wpa_"), "user_id": user_id, "user_name": user_name,
            "action": action, "entity_type": entity_type, "entity_id": entity_id,
            "details": details or {}, "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception:
        pass


# ═══════════════════════════════════════════
# SMART FOLDERS (Virtual Dynamic Views)
# ═══════════════════════════════════════════

@router.get("/smart-folders/{folder_type}")
async def get_smart_folder(folder_type: str, user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    is_admin = user.get("role") in ADMIN_ROLES
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()

    if folder_type == "pending_approval":
        query = {"status": "under_review"}
        if not is_admin:
            perms = await db.wp_permissions.find(
                {"$or": [{"user_id": uid}, {"role": user.get("role", "")}], "permissions": "approve"},
                {"_id": 0, "folder_id": 1}
            ).to_list(100)
            fids = [p["folder_id"] for p in perms]
            query["$or"] = [{"author_id": uid}, {"folder_id": {"$in": fids}}]
        docs = await db.wp_documents.find(query, {"_id": 0}).sort("updated_at", -1).to_list(100)
        return {"name": "Pending Approval", "icon": "clock", "documents": docs, "count": len(docs)}

    elif folder_type == "recently_edited":
        query = {"updated_at": {"$gte": week_ago}}
        if not is_admin:
            query["author_id"] = uid
        docs = await db.wp_documents.find(query, {"_id": 0}).sort("updated_at", -1).to_list(50)
        return {"name": "Recently Edited", "icon": "edit", "documents": docs, "count": len(docs)}

    elif folder_type == "shared_with_me":
        perms = await db.wp_permissions.find(
            {"$or": [{"user_id": uid}, {"role": user.get("role", "")}]},
            {"_id": 0, "folder_id": 1}
        ).to_list(200)
        fids = list({p["folder_id"] for p in perms})
        docs = await db.wp_documents.find(
            {"folder_id": {"$in": fids}, "author_id": {"$ne": uid}},
            {"_id": 0}
        ).sort("updated_at", -1).to_list(50)
        return {"name": "Shared With Me", "icon": "users", "documents": docs, "count": len(docs)}

    elif folder_type == "my_documents":
        docs = await db.wp_documents.find({"author_id": uid}, {"_id": 0}).sort("updated_at", -1).to_list(100)
        return {"name": "My Documents", "icon": "file", "documents": docs, "count": len(docs)}

    elif folder_type == "flagged":
        docs = await db.wp_documents.find({"flagged": True}, {"_id": 0}).sort("updated_at", -1).to_list(50)
        return {"name": "Flagged Documents", "icon": "flag", "documents": docs, "count": len(docs)}

    elif folder_type == "archived":
        docs = await db.wp_documents.find({"status": "archived"}, {"_id": 0}).sort("updated_at", -1).to_list(50)
        return {"name": "Archived", "icon": "archive", "documents": docs, "count": len(docs)}

    else:
        raise HTTPException(status_code=400, detail="Invalid smart folder type")


@router.get("/smart-folder-counts")
async def smart_folder_counts(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    is_admin = user.get("role") in ADMIN_ROLES
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()

    import asyncio
    pending_q = {"status": "under_review"}
    recent_q = {"updated_at": {"$gte": week_ago}}
    my_q = {"author_id": uid}
    flagged_q = {"flagged": True}
    archived_q = {"status": "archived"}

    if not is_admin:
        recent_q["author_id"] = uid

    perms = await db.wp_permissions.find(
        {"$or": [{"user_id": uid}, {"role": user.get("role", "")}]},
        {"_id": 0, "folder_id": 1}
    ).to_list(200)
    shared_fids = list({p["folder_id"] for p in perms})

    pending, recent, my_docs, shared, flagged, archived = await asyncio.gather(
        db.wp_documents.count_documents(pending_q),
        db.wp_documents.count_documents(recent_q),
        db.wp_documents.count_documents(my_q),
        db.wp_documents.count_documents({"folder_id": {"$in": shared_fids}, "author_id": {"$ne": uid}}),
        db.wp_documents.count_documents(flagged_q),
        db.wp_documents.count_documents(archived_q),
    )
    return {
        "pending_approval": pending, "recently_edited": recent,
        "my_documents": my_docs, "shared_with_me": shared,
        "flagged": flagged, "archived": archived,
    }


# ═══════════════════════════════════════════
# FOLDER TEMPLATES
# ═══════════════════════════════════════════

FOLDER_TEMPLATES = {
    "lesson_planning": {
        "name": "Lesson Planning Pack",
        "description": "Complete lesson planning folder structure",
        "classification": "restricted",
        "subfolders": ["Lesson Plans", "Schemes of Work", "Resources", "Assessments", "Reflections"]
    },
    "finance": {
        "name": "Finance Records",
        "description": "Financial documentation folder",
        "classification": "confidential",
        "subfolders": ["Budgets", "Invoices", "Receipts", "Audit Reports", "Procurement"]
    },
    "hr_records": {
        "name": "HR Records",
        "description": "Human resources documentation",
        "classification": "confidential",
        "subfolders": ["Contracts", "Appraisals", "Recruitment", "Training Records", "Disciplinary"]
    },
    "admissions": {
        "name": "Admissions Pack",
        "description": "Admissions documentation",
        "classification": "restricted",
        "subfolders": ["Applications", "Offer Letters", "Enrollment Forms", "Supporting Documents", "Correspondence"]
    },
    "board_meeting": {
        "name": "Board Meeting Pack",
        "description": "Board and leadership meeting documents",
        "classification": "confidential",
        "subfolders": ["Agenda", "Minutes", "Reports", "Resolutions", "Action Items"]
    },
    "department": {
        "name": "Department Folder",
        "description": "General department workspace",
        "classification": "restricted",
        "subfolders": ["Policies", "Reports", "Meeting Notes", "Resources", "Archive"]
    },
    "project": {
        "name": "Project Workspace",
        "description": "Project collaboration folder",
        "classification": "restricted",
        "subfolders": ["Planning", "Deliverables", "Reviews", "Communications"]
    },
    "compliance": {
        "name": "Compliance & Regulatory",
        "description": "Compliance and regulatory records",
        "classification": "confidential",
        "subfolders": ["Certifications", "Inspection Reports", "Policies", "Training Evidence", "Incident Reports"]
    }
}


@router.get("/folder-templates")
async def list_folder_templates(user: dict = Depends(get_current_user)):
    return [{"key": k, **v, "subfolders": v["subfolders"]} for k, v in FOLDER_TEMPLATES.items()]


@router.post("/create-from-template")
async def create_from_template(data: dict = Body(...), user: dict = Depends(get_current_user)):
    tpl_key = data.get("template_key", "")
    tpl = FOLDER_TEMPLATES.get(tpl_key)
    if not tpl:
        raise HTTPException(status_code=400, detail="Invalid template")

    parent_id = data.get("parent_id", "")
    custom_name = data.get("name", tpl["name"])
    dept = data.get("department", user.get("department", ""))
    now = datetime.now(timezone.utc).isoformat()

    root = {
        "folder_id": gen_id("wpf_"), "name": custom_name, "description": tpl["description"],
        "parent_id": parent_id, "owner_id": user["user_id"], "owner_name": user["name"],
        "department": dept, "classification": tpl["classification"],
        "retention_category": "standard", "workflow_enabled": tpl["classification"] != "public",
        "folder_type": "template_generated", "confidentiality_level": tpl["classification"],
        "template_source": tpl_key, "tags": [], "archived": False,
        "created_at": now, "updated_at": now,
    }
    await db.wp_folders.insert_one(root)

    created_subs = []
    for sub_name in tpl["subfolders"]:
        sub = {
            "folder_id": gen_id("wpf_"), "name": sub_name, "description": "",
            "parent_id": root["folder_id"], "owner_id": user["user_id"], "owner_name": user["name"],
            "department": dept, "classification": tpl["classification"],
            "retention_category": "standard", "workflow_enabled": False,
            "folder_type": "template_generated", "confidentiality_level": tpl["classification"],
            "tags": [], "archived": False, "created_at": now, "updated_at": now,
        }
        await db.wp_folders.insert_one(sub)
        created_subs.append(sub_name)

    await wp_audit(user["user_id"], user["name"], "create_from_template", "folder", root["folder_id"],
                   {"template": tpl_key, "subfolders": created_subs})
    return {"message": f"Created '{custom_name}' with {len(created_subs)} subfolders", "folder_id": root["folder_id"]}


# ═══════════════════════════════════════════
# MULTI-STAGE APPROVAL WORKFLOW
# ═══════════════════════════════════════════

@router.post("/documents/{doc_id}/approval-chain")
async def create_approval_chain(doc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    doc = await db.wp_documents.find_one({"document_id": doc_id}, {"_id": 0, "title": 1, "author_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    steps = data.get("steps", [])
    if not steps:
        raise HTTPException(status_code=400, detail="At least one approval step required")

    chain = {
        "chain_id": gen_id("wac_"), "document_id": doc_id,
        "steps": [{"step": i + 1, "user_id": s.get("user_id", ""), "role_label": s.get("role_label", f"Step {i+1}"),
                    "user_name": s.get("user_name", ""), "status": "pending",
                    "feedback": "", "completed_at": None} for i, s in enumerate(steps)],
        "current_step": 1, "status": "in_progress",
        "created_by": user["user_id"], "created_by_name": user["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.wp_approval_chains.insert_one(chain)
    await db.wp_documents.update_one({"document_id": doc_id}, {"$set": {"status": "under_review", "has_approval_chain": True}})

    # Notify first reviewer
    if steps[0].get("user_id"):
        await send_notification(db, steps[0]["user_id"], {
            "type": "wp_approval_request", "title": f"Review requested: {doc.get('title', '')}",
            "message": f"{user['name']} assigned you as reviewer (Step 1)",
            "reference_type": "wp_document", "reference_id": doc_id, "action_url": "/working-paper",
        })

    await wp_audit(user["user_id"], user["name"], "create_approval_chain", "document", doc_id, {"steps": len(steps)})
    return {k: v for k, v in chain.items() if k != "_id"}


@router.get("/documents/{doc_id}/approval-chain")
async def get_approval_chain(doc_id: str, user: dict = Depends(get_current_user)):
    chain = await db.wp_approval_chains.find_one({"document_id": doc_id, "status": {"$ne": "cancelled"}}, {"_id": 0})
    return chain or {}


@router.post("/documents/{doc_id}/review-step")
async def review_step(doc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    chain = await db.wp_approval_chains.find_one({"document_id": doc_id, "status": "in_progress"}, {"_id": 0})
    if not chain:
        raise HTTPException(status_code=404, detail="No active approval chain")

    action = data.get("action", "approve")  # approve or reject
    feedback = data.get("feedback", "")
    step_idx = chain["current_step"] - 1

    if step_idx >= len(chain["steps"]):
        raise HTTPException(status_code=400, detail="All steps completed")

    step = chain["steps"][step_idx]
    if step.get("user_id") and step["user_id"] != user["user_id"] and user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="You are not the assigned reviewer for this step")

    now = datetime.now(timezone.utc).isoformat()
    chain["steps"][step_idx]["status"] = "approved" if action == "approve" else "rejected"
    chain["steps"][step_idx]["feedback"] = feedback
    chain["steps"][step_idx]["completed_at"] = now
    chain["steps"][step_idx]["completed_by"] = user["name"]

    doc = await db.wp_documents.find_one({"document_id": doc_id}, {"_id": 0, "title": 1, "author_id": 1})

    if action == "reject":
        chain["status"] = "rejected"
        await db.wp_approval_chains.update_one({"chain_id": chain["chain_id"]}, {"$set": {"steps": chain["steps"], "status": "rejected"}})
        await db.wp_documents.update_one({"document_id": doc_id}, {"$set": {"status": "rejected"}})
        if doc.get("author_id"):
            await send_notification(db, doc["author_id"], {
                "type": "wp_approval_rejected", "title": f"Document rejected: {doc.get('title', '')}",
                "message": f"{user['name']} rejected at step {chain['current_step']}: {feedback}",
                "reference_type": "wp_document", "reference_id": doc_id, "action_url": "/working-paper",
            })
    else:
        next_step = chain["current_step"] + 1
        if next_step > len(chain["steps"]):
            chain["status"] = "completed"
            await db.wp_approval_chains.update_one({"chain_id": chain["chain_id"]}, {
                "$set": {"steps": chain["steps"], "status": "completed", "current_step": next_step}
            })
            await db.wp_documents.update_one({"document_id": doc_id}, {"$set": {"status": "approved"}})
            if doc.get("author_id"):
                await send_notification(db, doc["author_id"], {
                    "type": "wp_approval_completed", "title": f"Document approved: {doc.get('title', '')}",
                    "message": f"All approval steps completed", "reference_type": "wp_document",
                    "reference_id": doc_id, "action_url": "/working-paper",
                })
        else:
            await db.wp_approval_chains.update_one({"chain_id": chain["chain_id"]}, {
                "$set": {"steps": chain["steps"], "current_step": next_step}
            })
            next_reviewer = chain["steps"][next_step - 1]
            if next_reviewer.get("user_id"):
                await send_notification(db, next_reviewer["user_id"], {
                    "type": "wp_approval_request", "title": f"Review requested: {doc.get('title', '')}",
                    "message": f"Step {next_step} review needed",
                    "reference_type": "wp_document", "reference_id": doc_id, "action_url": "/working-paper",
                })

    await wp_audit(user["user_id"], user["name"], f"review_{action}", "document", doc_id,
                   {"step": chain["current_step"], "feedback": feedback})
    return {"message": f"Step {chain['current_step']} {action}d"}


# ═══════════════════════════════════════════
# DOCUMENT DISCUSSIONS (Threaded Chat)
# ═══════════════════════════════════════════

@router.post("/documents/{doc_id}/discussions")
async def add_discussion(doc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    msg = {
        "msg_id": gen_id("wdm_"), "document_id": doc_id,
        "parent_id": data.get("parent_id", ""),
        "author_id": user["user_id"], "author_name": user["name"], "author_role": user.get("role", ""),
        "content": data.get("content", ""), "type": data.get("type", "comment"),
        "mentions": data.get("mentions", []), "is_decision": data.get("is_decision", False),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.wp_discussions.insert_one(msg)

    for uid in msg["mentions"]:
        if uid != user["user_id"]:
            await send_notification(db, uid, {
                "type": "wp_mention", "title": f"{user['name']} mentioned you",
                "message": msg["content"][:100], "reference_type": "wp_document",
                "reference_id": doc_id, "action_url": "/working-paper",
            })

    return {k: v for k, v in msg.items() if k != "_id"}


@router.get("/documents/{doc_id}/discussions")
async def get_discussions(doc_id: str, user: dict = Depends(get_current_user)):
    msgs = await db.wp_discussions.find({"document_id": doc_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return msgs


# ═══════════════════════════════════════════
# ACTIVITY TIMELINE
# ═══════════════════════════════════════════

@router.get("/documents/{doc_id}/timeline")
async def document_timeline(doc_id: str, user: dict = Depends(get_current_user)):
    import asyncio
    audits, comments, discussions, versions, chain = await asyncio.gather(
        db.wp_audit.find({"entity_id": doc_id}, {"_id": 0}).sort("timestamp", -1).to_list(100),
        db.wp_comments.find({"entity_id": doc_id}, {"_id": 0}).sort("created_at", -1).to_list(50),
        db.wp_discussions.find({"document_id": doc_id}, {"_id": 0}).sort("created_at", -1).to_list(50),
        db.wp_versions.find({"document_id": doc_id}, {"_id": 0}).sort("created_at", -1).to_list(20),
        db.wp_approval_chains.find_one({"document_id": doc_id}, {"_id": 0}),
    )

    timeline = []
    for a in audits:
        timeline.append({"type": "audit", "action": a["action"], "user": a["user_name"],
                         "timestamp": a["timestamp"], "details": a.get("details", {})})
    for c in comments:
        timeline.append({"type": "comment", "action": "commented", "user": c["author_name"],
                         "timestamp": c["created_at"], "details": {"text": c["text"]}})
    for d in discussions:
        timeline.append({"type": "discussion", "action": "discussed", "user": d["author_name"],
                         "timestamp": d["created_at"], "details": {"content": d["content"], "is_decision": d.get("is_decision")}})
    for v in versions:
        timeline.append({"type": "version", "action": f"version {v['version']}", "user": v["edited_by_name"],
                         "timestamp": v["created_at"], "details": {"summary": v.get("change_summary", ""), "version_name": v.get("version_name", "")}})
    if chain:
        for s in chain.get("steps", []):
            if s.get("completed_at"):
                timeline.append({"type": "approval", "action": f"approval step {s['status']}",
                                 "user": s.get("completed_by", s.get("user_name", "")),
                                 "timestamp": s["completed_at"], "details": {"feedback": s.get("feedback", "")}})

    timeline.sort(key=lambda x: x["timestamp"], reverse=True)
    return timeline


# ═══════════════════════════════════════════
# NAMED VERSIONS
# ═══════════════════════════════════════════

@router.put("/versions/{version_id}/name")
async def name_version(version_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    name = data.get("name", "")
    await db.wp_versions.update_one({"version_id": version_id}, {"$set": {"version_name": name}})
    return {"message": "Version named"}


@router.put("/documents/{doc_id}/flag")
async def toggle_flag(doc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    flagged = data.get("flagged", True)
    reason = data.get("reason", "")
    await db.wp_documents.update_one({"document_id": doc_id}, {
        "$set": {"flagged": flagged, "flag_reason": reason, "flagged_by": user["user_id"], "flagged_at": datetime.now(timezone.utc).isoformat()}
    })
    await wp_audit(user["user_id"], user["name"], "flag_document" if flagged else "unflag_document", "document", doc_id, {"reason": reason})
    return {"message": f"Document {'flagged' if flagged else 'unflagged'}"}


# ═══════════════════════════════════════════
# TASK MANAGEMENT
# ═══════════════════════════════════════════

@router.post("/tasks")
async def create_task(data: dict = Body(...), user: dict = Depends(get_current_user)):
    task = {
        "task_id": gen_id("wpt_"), "title": data.get("title", ""),
        "description": data.get("description", ""),
        "document_id": data.get("document_id", ""), "folder_id": data.get("folder_id", ""),
        "assigned_to": data.get("assigned_to", ""), "assigned_to_name": data.get("assigned_to_name", ""),
        "assigned_by": user["user_id"], "assigned_by_name": user["name"],
        "due_date": data.get("due_date", ""), "priority": data.get("priority", "medium"),
        "status": "todo", "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.wp_tasks.insert_one(task)

    if task["assigned_to"] and task["assigned_to"] != user["user_id"]:
        await send_notification(db, task["assigned_to"], {
            "type": "wp_task_assigned", "title": f"Task assigned: {task['title']}",
            "message": f"{user['name']} assigned you a task{' (due ' + task['due_date'] + ')' if task['due_date'] else ''}",
            "reference_type": "wp_task", "reference_id": task["task_id"], "action_url": "/working-paper",
        })

    await wp_audit(user["user_id"], user["name"], "create_task", "task", task["task_id"], {"title": task["title"]})
    return {k: v for k, v in task.items() if k != "_id"}


@router.get("/tasks")
async def list_tasks(status: str = None, assigned_to: str = None, document_id: str = None,
                     folder_id: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    if assigned_to:
        query["assigned_to"] = assigned_to
    if document_id:
        query["document_id"] = document_id
    if folder_id:
        query["folder_id"] = folder_id

    is_admin = user.get("role") in ADMIN_ROLES
    if not is_admin and not assigned_to and not document_id:
        query["$or"] = [{"assigned_to": user["user_id"]}, {"assigned_by": user["user_id"]}]

    tasks = await db.wp_tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return tasks


@router.get("/tasks/board")
async def task_board(user: dict = Depends(get_current_user)):
    is_admin = user.get("role") in ADMIN_ROLES
    query = {} if is_admin else {"$or": [{"assigned_to": user["user_id"]}, {"assigned_by": user["user_id"]}]}
    tasks = await db.wp_tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)

    board = {"todo": [], "in_progress": [], "review": [], "completed": []}
    for t in tasks:
        s = t.get("status", "todo")
        if s in board:
            board[s].append(t)
    return board


@router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    safe = {k: v for k, v in data.items() if k in ("title", "description", "status", "priority", "due_date", "assigned_to", "assigned_to_name")}
    safe["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.wp_tasks.update_one({"task_id": task_id}, {"$set": safe})

    if "status" in safe:
        task = await db.wp_tasks.find_one({"task_id": task_id}, {"_id": 0, "assigned_by": 1, "title": 1})
        if task and task.get("assigned_by") and task["assigned_by"] != user["user_id"]:
            await send_notification(db, task["assigned_by"], {
                "type": "wp_task_update", "title": f"Task updated: {task.get('title', '')}",
                "message": f"{user['name']} moved task to {safe['status']}",
                "reference_type": "wp_task", "reference_id": task_id, "action_url": "/working-paper",
            })

    await wp_audit(user["user_id"], user["name"], "update_task", "task", task_id, safe)
    return {"message": "Task updated"}


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    await db.wp_tasks.delete_one({"task_id": task_id})
    return {"message": "Task deleted"}


# ═══════════════════════════════════════════
# EXTERNAL SHARING
# ═══════════════════════════════════════════

@router.post("/documents/{doc_id}/share")
async def create_share_link(doc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    doc = await db.wp_documents.find_one({"document_id": doc_id}, {"_id": 0, "title": 1, "file_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    token = secrets.token_urlsafe(32)
    password = data.get("password", "")
    expires_hours = data.get("expires_hours", 168)  # 7 days default

    link = {
        "link_id": gen_id("wsl_"), "document_id": doc_id, "token": token,
        "password_hash": hashlib.sha256(password.encode()).hexdigest() if password else "",
        "permissions": data.get("permissions", ["view"]),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=expires_hours)).isoformat(),
        "created_by": user["user_id"], "created_by_name": user["name"],
        "access_count": 0, "max_access": data.get("max_access", 0),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.wp_share_links.insert_one(link)
    await wp_audit(user["user_id"], user["name"], "create_share_link", "document", doc_id, {"expires_hours": expires_hours})
    return {"link_id": link["link_id"], "token": token, "expires_at": link["expires_at"]}


@router.get("/shared/{token}")
async def access_shared_document(token: str, password: str = ""):
    link = await db.wp_share_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    if link["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=410, detail="Share link expired")

    if link.get("max_access") and link["access_count"] >= link["max_access"]:
        raise HTTPException(status_code=410, detail="Maximum access count reached")

    if link.get("password_hash"):
        if not password or hashlib.sha256(password.encode()).hexdigest() != link["password_hash"]:
            raise HTTPException(status_code=403, detail="Incorrect password")

    doc = await db.wp_documents.find_one({"document_id": link["document_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.wp_share_links.update_one({"link_id": link["link_id"]}, {"$inc": {"access_count": 1}})
    return {"document": doc, "permissions": link["permissions"]}


@router.get("/documents/{doc_id}/share-links")
async def list_share_links(doc_id: str, user: dict = Depends(get_current_user)):
    links = await db.wp_share_links.find({"document_id": doc_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return links


@router.delete("/share-links/{link_id}")
async def revoke_share_link(link_id: str, user: dict = Depends(get_current_user)):
    await db.wp_share_links.delete_one({"link_id": link_id})
    return {"message": "Share link revoked"}


# ═══════════════════════════════════════════
# ADVANCED SEARCH
# ═══════════════════════════════════════════

@router.get("/search/advanced")
async def advanced_search(
    q: str = "", department: str = None, author_id: str = None,
    status: str = None, file_type: str = None, tag: str = None,
    date_from: str = None, date_to: str = None,
    sort_by: str = "updated_at", sort_order: str = "desc",
    user: dict = Depends(get_current_user)
):
    query = {}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
    if department:
        query["department"] = department
    if author_id:
        query["author_id"] = author_id
    if status:
        query["status"] = status
    if file_type:
        query["file_type"] = file_type
    if tag:
        query["tags"] = tag
    if date_from:
        query.setdefault("created_at", {})["$gte"] = date_from
    if date_to:
        query.setdefault("created_at", {})["$lte"] = date_to

    direction = -1 if sort_order == "desc" else 1
    docs = await db.wp_documents.find(query, {"_id": 0}).sort(sort_by, direction).to_list(100)

    folder_query = {}
    if q:
        folder_query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"description": {"$regex": q, "$options": "i"}}]
    if department:
        folder_query["department"] = department
    folders = await db.wp_folders.find(folder_query, {"_id": 0}).to_list(30) if q or department else []

    return {"documents": docs, "folders": folders, "total_docs": len(docs), "total_folders": len(folders)}


# ═══════════════════════════════════════════
# PREMIUM DASHBOARD
# ═══════════════════════════════════════════

@router.get("/dashboard/premium")
async def premium_dashboard(user: dict = Depends(get_current_user)):
    import asyncio
    uid = user["user_id"]
    is_admin = user.get("role") in ADMIN_ROLES
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()

    tasks_q = {"$or": [{"assigned_to": uid}, {"assigned_by": uid}]}
    if is_admin:
        tasks_q = {}

    results = await asyncio.gather(
        db.wp_folders.count_documents({"archived": {"$ne": True}}),
        db.wp_documents.count_documents({}),
        db.wp_documents.count_documents({"status": "under_review"}),
        db.wp_documents.count_documents({"status": "approved"}),
        db.wp_documents.count_documents({"status": "published"}),
        db.wp_documents.count_documents({"status": "archived"}),
        db.wp_tasks.count_documents({**tasks_q, "status": "todo"}),
        db.wp_tasks.count_documents({**tasks_q, "status": "in_progress"}),
        db.wp_tasks.count_documents({**tasks_q, "status": "completed"}),
        db.wp_audit.count_documents({"timestamp": {"$gte": today}}),
        db.wp_documents.find({}, {"_id": 0}).sort("updated_at", -1).to_list(8),
        db.wp_audit.find({}, {"_id": 0}).sort("timestamp", -1).to_list(15),
        db.wp_tasks.find({**tasks_q, "status": {"$in": ["todo", "in_progress"]}}, {"_id": 0}).sort("due_date", 1).to_list(10),
        db.wp_documents.count_documents({"updated_at": {"$gte": week_ago}}),
        db.wp_share_links.count_documents({}),
        db.wp_discussions.count_documents({"created_at": {"$gte": today}}),
        # Status breakdown for chart
        db.wp_documents.aggregate([{"$group": {"_id": "$status", "count": {"$sum": 1}}}]).to_list(10),
        # Department breakdown
        db.wp_documents.aggregate([{"$group": {"_id": "$department", "count": {"$sum": 1}}}]).to_list(20),
    )

    return {
        "total_folders": results[0], "total_documents": results[1],
        "pending_approval": results[2], "approved": results[3],
        "published": results[4], "archived": results[5],
        "tasks_todo": results[6], "tasks_in_progress": results[7], "tasks_completed": results[8],
        "today_activity": results[9], "recent_documents": results[10],
        "recent_activity": results[11], "upcoming_tasks": results[12],
        "edited_this_week": results[13], "active_share_links": results[14],
        "discussions_today": results[15],
        "status_breakdown": [{"status": r["_id"] or "unknown", "count": r["count"]} for r in results[16]],
        "department_breakdown": [{"department": r["_id"] or "Unassigned", "count": r["count"]} for r in results[17]],
        "is_admin": is_admin,
    }



# ═══════════════════════════════════════════
# DIGITAL SIGNATURES
# ═══════════════════════════════════════════

@router.post("/documents/{doc_id}/sign")
async def sign_document(doc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    doc = await db.wp_documents.find_one({"document_id": doc_id}, {"_id": 0, "title": 1, "locked": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("locked"):
        raise HTTPException(status_code=400, detail="Document is already locked (previously signed)")

    now = datetime.now(timezone.utc).isoformat()
    sig_hash = hashlib.sha256(f"{user['user_id']}:{doc_id}:{now}".encode()).hexdigest()

    signature = {
        "sig_id": gen_id("wsg_"), "document_id": doc_id,
        "signer_id": user["user_id"], "signer_name": user["name"],
        "signer_role": user.get("role", ""),
        "reason": data.get("reason", "Reviewed and approved"),
        "designation": data.get("designation", user.get("role", "")),
        "signature_type": data.get("signature_type", "text"),
        "signature_image": data.get("signature_image", ""),
        "signature_font": data.get("font", ""),
        "sig_hash": sig_hash,
        "ip_address": data.get("ip", ""),
        "signed_at": now,
    }
    await db.wp_signatures.insert_one(signature)
    # Lock the document after signing
    await db.wp_documents.update_one({"document_id": doc_id}, {
        "$push": {"signatures": {
            "signer_name": user["name"], "signer_role": user.get("role", ""),
            "reason": signature["reason"], "sig_hash": sig_hash[:12],
            "signature_type": signature["signature_type"],
            "signed_at": now
        }},
        "$set": {"updated_at": now, "locked": True, "locked_at": now, "locked_by": user["name"],
                 "locked_reason": f"Signed by {user['name']}"}
    })
    await wp_audit(user["user_id"], user["name"], "sign_document", "document", doc_id,
                   {"reason": signature["reason"], "locked": True})

    # Notify document author
    full_doc = await db.wp_documents.find_one({"document_id": doc_id}, {"_id": 0, "author_id": 1, "title": 1})
    if full_doc and full_doc.get("author_id") and full_doc["author_id"] != user["user_id"]:
        await send_notification(db, full_doc["author_id"], {
            "type": "wp_document_signed", "title": f"Document signed & locked: {full_doc.get('title', '')}",
            "message": f"{user['name']} ({user.get('role', '')}) signed and locked your document",
            "reference_type": "wp_document", "reference_id": doc_id, "action_url": "/working-paper",
        })

    return {"message": "Document signed and locked", "sig_id": signature["sig_id"], "sig_hash": sig_hash[:12], "locked": True}


@router.get("/documents/{doc_id}/signatures")
async def get_signatures(doc_id: str, user: dict = Depends(get_current_user)):
    sigs = await db.wp_signatures.find({"document_id": doc_id}, {"_id": 0}).sort("signed_at", -1).to_list(50)
    return sigs


@router.post("/documents/{doc_id}/verify-signature")
async def verify_signature(doc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    sig_hash = data.get("sig_hash", "")
    sig = await db.wp_signatures.find_one({"document_id": doc_id, "sig_hash": {"$regex": f"^{sig_hash}"}}, {"_id": 0})
    if not sig:
        return {"valid": False, "message": "Signature not found"}
    return {"valid": True, "signer": sig["signer_name"], "role": sig["signer_role"], "signed_at": sig["signed_at"]}


# ═══════════════════════════════════════════
# WATERMARKING
# ═══════════════════════════════════════════

WATERMARK_TYPES = ["CONFIDENTIAL", "DRAFT", "APPROVED", "INTERNAL", "FOR REVIEW", "FINAL", ""]

@router.put("/documents/{doc_id}/watermark")
async def set_watermark(doc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    watermark = data.get("watermark", "")
    if watermark and watermark not in WATERMARK_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid watermark. Use: {WATERMARK_TYPES}")
    await db.wp_documents.update_one({"document_id": doc_id}, {
        "$set": {"watermark": watermark, "watermark_set_by": user["name"], "watermark_set_at": datetime.now(timezone.utc).isoformat()}
    })
    await wp_audit(user["user_id"], user["name"], "set_watermark", "document", doc_id, {"watermark": watermark})
    return {"message": f"Watermark {'set to ' + watermark if watermark else 'removed'}"}


# ═══════════════════════════════════════════
# DOCUMENT EXPIRY
# ═══════════════════════════════════════════

@router.put("/documents/{doc_id}/expiry")
async def set_expiry(doc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    expires_at = data.get("expires_at", "")
    reminder_days = data.get("reminder_days", 7)
    auto_archive = data.get("auto_archive", True)

    update = {
        "expires_at": expires_at,
        "expiry_reminder_days": reminder_days,
        "expiry_auto_archive": auto_archive,
        "expiry_set_by": user["name"],
    }
    if not expires_at:
        update = {"expires_at": "", "expiry_reminder_days": 0, "expiry_auto_archive": False, "expiry_set_by": ""}
    await db.wp_documents.update_one({"document_id": doc_id}, {"$set": update})
    await wp_audit(user["user_id"], user["name"], "set_expiry", "document", doc_id, {"expires_at": expires_at})
    return {"message": f"Expiry {'set to ' + expires_at if expires_at else 'removed'}"}


@router.get("/expiring-documents")
async def get_expiring_documents(days: int = 30, user: dict = Depends(get_current_user)):
    cutoff = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    now = datetime.now(timezone.utc).isoformat()
    docs = await db.wp_documents.find(
        {"expires_at": {"$ne": "", "$lte": cutoff, "$gt": ""}},
        {"_id": 0}
    ).sort("expires_at", 1).to_list(100)

    expired = [d for d in docs if d.get("expires_at", "") <= now]
    expiring_soon = [d for d in docs if d.get("expires_at", "") > now]
    return {"expired": expired, "expiring_soon": expiring_soon, "total": len(docs)}


@router.post("/process-expired")
async def process_expired_documents(user: dict = Depends(require_roles(*ADMIN_ROLES))):
    now = datetime.now(timezone.utc).isoformat()
    expired = await db.wp_documents.find(
        {"expires_at": {"$ne": "", "$lte": now}, "expiry_auto_archive": True, "status": {"$ne": "archived"}},
        {"_id": 0, "document_id": 1, "title": 1, "author_id": 1}
    ).to_list(200)

    count = 0
    for doc in expired:
        await db.wp_documents.update_one({"document_id": doc["document_id"]}, {"$set": {"status": "archived", "archived_reason": "auto_expired"}})
        count += 1
        # Notify author of auto-archive
        if doc.get("author_id"):
            await send_notification(db, doc["author_id"], {
                "type": "wp_document_expired", "title": f"Document expired: {doc.get('title', '')}",
                "message": "This document has been automatically archived due to expiry",
                "reference_type": "wp_document", "reference_id": doc["document_id"], "action_url": "/working-paper",
            })

    await wp_audit(user["user_id"], user["name"], "process_expired", "system", "bulk", {"archived_count": count})
    return {"message": f"Archived {count} expired documents", "count": count}


# ═══════════════════════════════════════════
# NOTIFICATION AGGREGATION FOR WP
# ═══════════════════════════════════════════

@router.get("/notifications")
async def get_wp_notifications(user: dict = Depends(get_current_user)):
    """Get all working paper related notifications for current user."""
    wp_types = ["wp_task_assigned", "wp_approval_request", "wp_approval_completed",
                "wp_approval_rejected", "wp_mention", "wp_document_signed", "wp_document_expired"]
    notifs = await db.notifications.find(
        {"user_id": user["user_id"], "type": {"$in": wp_types}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return notifs
