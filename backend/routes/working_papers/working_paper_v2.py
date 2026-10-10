"""
Working Paper Module V2 - Enterprise Document Governance System
Full RBAC, folder hierarchy, version control, workflows, audit trails.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from database import db
from models import gen_id
from auth import get_current_user, require_roles, log_audit
from ws_manager import send_notification
from datetime import datetime, timezone

router = APIRouter(prefix="/api/wp", tags=["working-paper-v2"])

ADMIN_ROLES = ("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher")
ALL_PERMISSIONS = ["view", "access", "upload", "edit", "comment", "approve", "download", "delete", "create_subfolder", "manage_permissions", "manage_settings", "view_audit"]
WORKFLOW_STATES = ["draft", "under_review", "approved", "rejected", "published", "archived"]
CLASSIFICATIONS = ["public", "restricted", "confidential", "approval_controlled"]


async def wp_audit(user_id, user_name, action, entity_type, entity_id, details=None):
    """Immutable audit log — fire and forget to not block response."""
    try:
        db.wp_audit.insert_one({
            "audit_id": gen_id("wpa_"), "user_id": user_id, "user_name": user_name,
            "action": action, "entity_type": entity_type, "entity_id": entity_id,
            "details": details or {}, "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception:
        pass


async def check_folder_permission(user, folder_id, permission):
    """Check if user has a specific permission on a folder."""
    if user.get("role") in ADMIN_ROLES:
        return True
    folder = await db.wp_folders.find_one({"folder_id": folder_id}, {"_id": 0, "owner_id": 1, "classification": 1})
    if not folder:
        return False
    if folder.get("owner_id") == user["user_id"]:
        return True
    if folder.get("classification") == "public" and permission in ("view", "access", "download"):
        return True
    # Single query checking both user_id and role
    perm = await db.wp_permissions.find_one(
        {"folder_id": folder_id, "$or": [{"user_id": user["user_id"]}, {"role": user.get("role", "")}]},
        {"_id": 0, "permissions": 1}
    )
    return perm is not None and permission in perm.get("permissions", [])


async def get_folder_path(folder_id):
    """Get breadcrumb path for a folder."""
    path = []
    current = folder_id
    while current:
        folder = await db.wp_folders.find_one({"folder_id": current}, {"_id": 0, "folder_id": 1, "name": 1, "parent_id": 1})
        if not folder:
            break
        path.insert(0, {"folder_id": folder["folder_id"], "name": folder["name"]})
        current = folder.get("parent_id", "")
    return path



@router.get("/staff-directory")
async def wp_staff_directory(user: dict = Depends(get_current_user)):
    """Lightweight staff directory for permission assignment. Available to all authenticated users."""
    staff = await db.users.find(
        {"role": {"$nin": ["Student", "Parent"]}},
        {"_id": 0, "user_id": 1, "name": 1, "role": 1, "department": 1}
    ).to_list(500)
    return staff



# ═══════════════════════════════════════════
# FOLDERS
# ═══════════════════════════════════════════

@router.get("/folders")
async def list_folders(parent_id: str = "", department: str = None, include_archived: bool = False, user: dict = Depends(get_current_user)):
    query = {"parent_id": parent_id}
    if not include_archived:
        query["archived"] = {"$ne": True}
    if department:
        query["department"] = department

    folders = await db.wp_folders.find(query, {"_id": 0}).sort("name", 1).to_list(200)
    is_admin = user.get("role") in ADMIN_ROLES

    if is_admin:
        visible = folders
    else:
        # Batch check permissions — single query for all folder IDs
        folder_ids = [f["folder_id"] for f in folders]
        user_perms = await db.wp_permissions.find(
            {"folder_id": {"$in": folder_ids}, "$or": [{"user_id": user["user_id"]}, {"role": user.get("role", "")}]},
            {"_id": 0, "folder_id": 1}
        ).to_list(500)
        permitted_ids = {p["folder_id"] for p in user_perms}

        visible = [f for f in folders if f.get("owner_id") == user["user_id"] or f.get("classification") == "public" or f["folder_id"] in permitted_ids]

    # Batch count subfolders/docs/entries
    if visible:
        import asyncio
        vis_ids = [f["folder_id"] for f in visible]
        sub_counts = {}
        doc_counts = {}
        entry_counts = {}
        for fid in vis_ids:
            sub_counts[fid] = 0
            doc_counts[fid] = 0
            entry_counts[fid] = 0

        sub_pipeline = [{"$match": {"parent_id": {"$in": vis_ids}}}, {"$group": {"_id": "$parent_id", "c": {"$sum": 1}}}]
        doc_pipeline = [{"$match": {"folder_id": {"$in": vis_ids}}}, {"$group": {"_id": "$folder_id", "c": {"$sum": 1}}}]
        entry_pipeline = [{"$match": {"folder_id": {"$in": vis_ids}}}, {"$group": {"_id": "$folder_id", "c": {"$sum": 1}}}]

        sub_agg, doc_agg, entry_agg = await asyncio.gather(
            db.wp_folders.aggregate(sub_pipeline).to_list(200),
            db.wp_documents.aggregate(doc_pipeline).to_list(200),
            db.wp_entries.aggregate(entry_pipeline).to_list(200)
        )
        for a in sub_agg:
            sub_counts[a["_id"]] = a["c"]
        for a in doc_agg:
            doc_counts[a["_id"]] = a["c"]
        for a in entry_agg:
            entry_counts[a["_id"]] = a["c"]

        for f in visible:
            f["subfolder_count"] = sub_counts.get(f["folder_id"], 0)
            f["document_count"] = doc_counts.get(f["folder_id"], 0)
            f["entry_count"] = entry_counts.get(f["folder_id"], 0)

    return visible


@router.get("/folders/{folder_id}")
async def get_folder(folder_id: str, user: dict = Depends(get_current_user)):
    folder = await db.wp_folders.find_one({"folder_id": folder_id}, {"_id": 0})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if not await check_folder_permission(user, folder_id, "view"):
        raise HTTPException(status_code=403, detail="No access to this folder")

    # Run all queries concurrently
    import asyncio
    path_task = get_folder_path(folder_id)
    sub_task = db.wp_folders.find({"parent_id": folder_id}, {"_id": 0}).sort("name", 1).to_list(100)
    doc_task = db.wp_documents.find({"folder_id": folder_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    entry_task = db.wp_entries.find({"folder_id": folder_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    perm_task = db.wp_permissions.find({"folder_id": folder_id}, {"_id": 0}).to_list(50)

    path, subs, docs, entries, perms = await asyncio.gather(path_task, sub_task, doc_task, entry_task, perm_task)

    folder["path"] = path
    folder["subfolders"] = subs
    folder["documents"] = docs
    folder["entries"] = entries
    folder["permissions"] = perms

    # Resolve user names in permissions — single bulk query
    perm_user_ids = [p["user_id"] for p in perms if p.get("user_id")]
    if perm_user_ids:
        perm_users = await db.users.find({"user_id": {"$in": perm_user_ids}}, {"_id": 0, "user_id": 1, "name": 1, "role": 1}).to_list(len(perm_user_ids))
        perm_user_map = {u["user_id"]: u for u in perm_users}
        for p in perms:
            if p.get("user_id"):
                u = perm_user_map.get(p["user_id"])
                p["user_name"] = u["name"] if u else ""
                p["user_role"] = u["role"] if u else ""

    return folder


@router.post("/folders")
async def create_folder(data: dict = Body(...), user: dict = Depends(get_current_user)):
    parent_id = data.get("parent_id", "")
    if parent_id:
        if not await check_folder_permission(user, parent_id, "create_subfolder"):
            raise HTTPException(status_code=403, detail="No permission to create subfolders here")

    doc = {
        "folder_id": gen_id("wpf_"),
        "name": data.get("name", ""),
        "description": data.get("description", ""),
        "parent_id": parent_id,
        "owner_id": user["user_id"],
        "owner_name": user["name"],
        "department": data.get("department", user.get("department", "")),
        "classification": data.get("classification", "public"),
        "retention_category": data.get("retention_category", "standard"),
        "workflow_enabled": data.get("workflow_enabled", False),
        "folder_type": data.get("folder_type", "general"),
        "confidentiality_level": data.get("confidentiality_level", data.get("classification", "public")),
        "tags": data.get("tags", []),
        "archived": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.wp_folders.insert_one(doc)

    # Inherit parent permissions
    if parent_id:
        parent_perms = await db.wp_permissions.find({"folder_id": parent_id}, {"_id": 0}).to_list(50)
        for pp in parent_perms:
            await db.wp_permissions.insert_one({
                "perm_id": gen_id("wpp_"), "folder_id": doc["folder_id"],
                "user_id": pp.get("user_id", ""), "role": pp.get("role", ""),
                "permissions": pp.get("permissions", []),
                "inherited": True, "created_at": datetime.now(timezone.utc).isoformat()
            })

    # Set permissions for allowed users (restricted/confidential/approval_controlled)
    allowed_users = data.get("allowed_users", [])
    if doc["classification"] != "public" and allowed_users:
        full_perms = ["view", "access", "upload", "edit", "comment", "download", "create_subfolder"]
        for uid in allowed_users:
            await db.wp_permissions.insert_one({
                "perm_id": gen_id("wpp_"), "folder_id": doc["folder_id"],
                "user_id": uid, "role": "",
                "permissions": full_perms,
                "inherited": False, "created_at": datetime.now(timezone.utc).isoformat()
            })
            # Notify each allowed user
            await send_notification(db, uid, {
                "type": "wp_access_granted",
                "title": f"Access to: {doc['name']}",
                "message": f"{user['name']} granted you access to the {doc['classification']} folder '{doc['name']}'",
                "reference_type": "wp_folder", "reference_id": doc["folder_id"],
                "action_url": "/working-paper",
            })

    await wp_audit(user["user_id"], user["name"], "create_folder", "folder", doc["folder_id"], {"name": doc["name"]})
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/folders/{folder_id}")
async def update_folder(folder_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    if not await check_folder_permission(user, folder_id, "manage_settings"):
        raise HTTPException(status_code=403, detail="No permission")
    safe = {k: v for k, v in data.items() if k in ("name", "description", "classification", "department", "retention_category", "workflow_enabled")}
    safe["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.wp_folders.update_one({"folder_id": folder_id}, {"$set": safe})
    await wp_audit(user["user_id"], user["name"], "update_folder", "folder", folder_id, safe)
    return {"message": "Folder updated"}


@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, user: dict = Depends(get_current_user)):
    folder = await db.wp_folders.find_one({"folder_id": folder_id}, {"_id": 0, "owner_id": 1})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    # Owner or admin can delete
    is_owner = folder.get("owner_id") == user["user_id"]
    is_admin = user.get("role") in ADMIN_ROLES
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="Only the folder creator or admin can delete")
    await db.wp_folders.delete_one({"folder_id": folder_id})
    await db.wp_folders.delete_many({"parent_id": folder_id})
    await db.wp_documents.delete_many({"folder_id": folder_id})
    await db.wp_entries.delete_many({"folder_id": folder_id})
    await db.wp_permissions.delete_many({"folder_id": folder_id})
    await wp_audit(user["user_id"], user["name"], "delete_folder", "folder", folder_id)
    return {"message": "Folder deleted"}


# ═══════════════════════════════════════════
# PERMISSIONS
# ═══════════════════════════════════════════

@router.post("/folders/{folder_id}/permissions")
async def set_permission(folder_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    if not await check_folder_permission(user, folder_id, "manage_permissions"):
        raise HTTPException(status_code=403, detail="No permission")

    target_user = data.get("user_id", "")
    target_role = data.get("role", "")
    perms = data.get("permissions", [])

    query = {"folder_id": folder_id}
    if target_user:
        query["user_id"] = target_user
    elif target_role:
        query["role"] = target_role
    else:
        raise HTTPException(status_code=400, detail="Specify user_id or role")

    existing = await db.wp_permissions.find_one(query, {"_id": 0})
    if existing:
        await db.wp_permissions.update_one({"perm_id": existing["perm_id"]}, {"$set": {"permissions": perms}})
    else:
        await db.wp_permissions.insert_one({
            "perm_id": gen_id("wpp_"), "folder_id": folder_id,
            "user_id": target_user, "role": target_role,
            "permissions": perms, "inherited": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    await wp_audit(user["user_id"], user["name"], "set_permission", "folder", folder_id,
                   {"target_user": target_user, "target_role": target_role, "permissions": perms})

    # Notify target user
    if target_user:
        folder = await db.wp_folders.find_one({"folder_id": folder_id}, {"_id": 0, "name": 1})
        await send_notification(db, target_user, {
            "type": "wp_permission", "title": f"Access granted: {folder.get('name', '')}",
            "message": f"{user['name']} gave you access to folder '{folder.get('name', '')}'",
            "reference_type": "wp_folder", "reference_id": folder_id,
            "action_url": "/working-paper",
        })

    return {"message": "Permission set"}


@router.delete("/folders/{folder_id}/permissions/{perm_id}")
async def remove_permission(folder_id: str, perm_id: str, user: dict = Depends(get_current_user)):
    if not await check_folder_permission(user, folder_id, "manage_permissions"):
        raise HTTPException(status_code=403, detail="No permission")
    await db.wp_permissions.delete_one({"perm_id": perm_id})
    await wp_audit(user["user_id"], user["name"], "remove_permission", "folder", folder_id, {"perm_id": perm_id})
    return {"message": "Permission removed"}


# ═══════════════════════════════════════════
# DOCUMENTS
# ═══════════════════════════════════════════

@router.post("/documents")
async def upload_document(data: dict = Body(...), user: dict = Depends(get_current_user)):
    folder_id = data.get("folder_id", "")
    if folder_id and not await check_folder_permission(user, folder_id, "upload"):
        raise HTTPException(status_code=403, detail="No upload permission")

    doc = {
        "document_id": gen_id("wpd_"),
        "folder_id": folder_id,
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "file_id": data.get("file_id", ""),
        "file_type": data.get("file_type", ""),
        "file_size": data.get("file_size", 0),
        "version": 1,
        "status": "draft",
        "author_id": user["user_id"],
        "author_name": user["name"],
        "department": data.get("department", user.get("department", "")),
        "tags": data.get("tags", []),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.wp_documents.insert_one(doc)

    # Create initial version
    await db.wp_versions.insert_one({
        "version_id": gen_id("wpv_"), "document_id": doc["document_id"],
        "version": 1, "file_id": data.get("file_id", ""),
        "edited_by": user["user_id"], "edited_by_name": user["name"],
        "change_summary": "Initial upload",
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    await wp_audit(user["user_id"], user["name"], "upload_document", "document", doc["document_id"], {"title": doc["title"]})
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.wp_documents.find_one({"document_id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("folder_id") and not await check_folder_permission(user, doc["folder_id"], "access"):
        raise HTTPException(status_code=403, detail="No access")

    doc["versions"] = await db.wp_versions.find({"document_id": doc_id}, {"_id": 0}).sort("version", -1).to_list(50)
    doc["comments"] = await db.wp_comments.find({"entity_type": "document", "entity_id": doc_id}, {"_id": 0}).sort("created_at", 1).to_list(100)

    await wp_audit(user["user_id"], user["name"], "view_document", "document", doc_id)
    return doc


@router.put("/documents/{doc_id}")
async def update_document(doc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    doc = await db.wp_documents.find_one({"document_id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("locked") and user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Document is locked and cannot be edited")
    if doc.get("folder_id") and not await check_folder_permission(user, doc["folder_id"], "edit"):
        raise HTTPException(status_code=403, detail="No edit permission")

    safe = {k: v for k, v in data.items() if k in ("title", "description", "tags", "file_id", "file_type", "file_size")}
    new_version = doc.get("version", 1)

    if data.get("file_id") and data["file_id"] != doc.get("file_id"):
        new_version += 1
        safe["version"] = new_version
        await db.wp_versions.insert_one({
            "version_id": gen_id("wpv_"), "document_id": doc_id,
            "version": new_version, "file_id": data["file_id"],
            "edited_by": user["user_id"], "edited_by_name": user["name"],
            "change_summary": data.get("change_summary", "Updated"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    safe["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.wp_documents.update_one({"document_id": doc_id}, {"$set": safe})
    await wp_audit(user["user_id"], user["name"], "edit_document", "document", doc_id, {"version": new_version})
    return {"message": "Document updated", "version": new_version}


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.wp_documents.find_one({"document_id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    is_doc_author = doc.get("author_id") == user["user_id"]
    is_admin = user.get("role") in ADMIN_ROLES
    # Folder owner can delete any document in their folder
    is_folder_owner = False
    if doc.get("folder_id"):
        folder = await db.wp_folders.find_one({"folder_id": doc["folder_id"]}, {"_id": 0, "owner_id": 1})
        is_folder_owner = folder and folder.get("owner_id") == user["user_id"]
    if not is_doc_author and not is_admin and not is_folder_owner:
        raise HTTPException(status_code=403, detail="Only the uploader, folder owner, or management can delete this document")
    await db.wp_documents.delete_one({"document_id": doc_id})
    await wp_audit(user["user_id"], user["name"], "delete_document", "document", doc_id)
    return {"message": "Document deleted"}


# ═══════════════════════════════════════════
# WORKFLOW & APPROVALS
# ═══════════════════════════════════════════

@router.put("/documents/{doc_id}/status")
async def change_document_status(doc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    new_status = data.get("status", "")
    if new_status not in WORKFLOW_STATES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be: {WORKFLOW_STATES}")

    doc = await db.wp_documents.find_one({"document_id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    if new_status in ("approved", "rejected") and not await check_folder_permission(user, doc.get("folder_id", ""), "approve"):
        raise HTTPException(status_code=403, detail="No approval permission")

    old_status = doc.get("status", "draft")
    await db.wp_documents.update_one({"document_id": doc_id}, {
        "$set": {"status": new_status, "status_changed_by": user["user_id"], "status_changed_at": datetime.now(timezone.utc).isoformat()},
        "$push": {"status_history": {"status": new_status, "by": user["name"], "feedback": data.get("feedback", ""), "at": datetime.now(timezone.utc).isoformat()}}
    })

    # Notify author
    if doc.get("author_id") and doc["author_id"] != user["user_id"]:
        await send_notification(db, doc["author_id"], {
            "type": "wp_status_change", "title": f"Document {new_status}: {doc.get('title', '')}",
            "message": f"{user['name']} changed status to {new_status}. {data.get('feedback', '')}",
            "reference_type": "wp_document", "reference_id": doc_id,
            "action_url": "/working-paper",
        })

    await wp_audit(user["user_id"], user["name"], f"status_{new_status}", "document", doc_id, {"from": old_status, "to": new_status})
    return {"message": f"Status changed to {new_status}"}


# ═══════════════════════════════════════════
# VERSION HISTORY
# ═══════════════════════════════════════════

@router.get("/documents/{doc_id}/versions")
async def get_versions(doc_id: str, user: dict = Depends(get_current_user)):
    versions = await db.wp_versions.find({"document_id": doc_id}, {"_id": 0}).sort("version", -1).to_list(50)
    return versions


@router.post("/documents/{doc_id}/restore/{version}")
async def restore_version(doc_id: str, version: int, user: dict = Depends(get_current_user)):
    ver = await db.wp_versions.find_one({"document_id": doc_id, "version": version}, {"_id": 0})
    if not ver:
        raise HTTPException(status_code=404, detail="Version not found")
    doc = await db.wp_documents.find_one({"document_id": doc_id}, {"_id": 0})
    new_ver = doc.get("version", 1) + 1
    await db.wp_documents.update_one({"document_id": doc_id}, {"$set": {"file_id": ver["file_id"], "version": new_ver, "updated_at": datetime.now(timezone.utc).isoformat()}})
    await db.wp_versions.insert_one({
        "version_id": gen_id("wpv_"), "document_id": doc_id,
        "version": new_ver, "file_id": ver["file_id"],
        "edited_by": user["user_id"], "edited_by_name": user["name"],
        "change_summary": f"Restored from version {version}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    await wp_audit(user["user_id"], user["name"], "restore_version", "document", doc_id, {"restored_version": version})
    return {"message": f"Restored to version {version}", "new_version": new_ver}


# ═══════════════════════════════════════════
# STRUCTURED ENTRIES (notes, minutes, logs)
# ═══════════════════════════════════════════

@router.post("/entries")
async def create_entry(data: dict = Body(...), user: dict = Depends(get_current_user)):
    folder_id = data.get("folder_id", "")
    if folder_id and not await check_folder_permission(user, folder_id, "upload"):
        raise HTTPException(status_code=403, detail="No permission")
    doc = {
        "entry_id": gen_id("wpe_"),
        "folder_id": folder_id,
        "entry_type": data.get("entry_type", "note"),
        "title": data.get("title", ""),
        "content": data.get("content", ""),
        "author_id": user["user_id"],
        "author_name": user["name"],
        "department": data.get("department", user.get("department", "")),
        "status": "draft",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.wp_entries.insert_one(doc)
    await wp_audit(user["user_id"], user["name"], "create_entry", "entry", doc["entry_id"], {"type": doc["entry_type"]})
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/entries/{entry_id}")
async def update_entry(entry_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    safe = {k: v for k, v in data.items() if k in ("title", "content", "status", "entry_type")}
    safe["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.wp_entries.update_one({"entry_id": entry_id}, {"$set": safe})
    await wp_audit(user["user_id"], user["name"], "edit_entry", "entry", entry_id)
    return {"message": "Entry updated"}


@router.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, user: dict = Depends(get_current_user)):
    entry = await db.wp_entries.find_one({"entry_id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    is_owner = entry.get("author_id") == user["user_id"]
    is_admin = user.get("role") in ADMIN_ROLES
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="Only the creator or management can delete this entry")
    await db.wp_entries.delete_one({"entry_id": entry_id})
    await wp_audit(user["user_id"], user["name"], "delete_entry", "entry", entry_id)
    return {"message": "Entry deleted"}


# ═══════════════════════════════════════════
# COMMENTS
# ═══════════════════════════════════════════

@router.post("/comments")
async def add_comment(data: dict = Body(...), user: dict = Depends(get_current_user)):
    doc = {
        "comment_id": gen_id("wpc_"),
        "entity_type": data.get("entity_type", "document"),
        "entity_id": data.get("entity_id", ""),
        "parent_id": data.get("parent_id", ""),
        "author_id": user["user_id"],
        "author_name": user["name"],
        "author_role": user.get("role", ""),
        "text": data.get("text", ""),
        "mentions": data.get("mentions", []),
        "resolved": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.wp_comments.insert_one(doc)

    # Notify mentions
    for uid in doc["mentions"]:
        await send_notification(db, uid, {
            "type": "wp_mention", "title": f"{user['name']} mentioned you",
            "message": f"In a comment: {doc['text'][:80]}",
            "reference_type": doc["entity_type"], "reference_id": doc["entity_id"],
            "action_url": "/working-paper",
        })

    await wp_audit(user["user_id"], user["name"], "add_comment", doc["entity_type"], doc["entity_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/comments/{comment_id}/resolve")
async def resolve_comment(comment_id: str, user: dict = Depends(get_current_user)):
    await db.wp_comments.update_one({"comment_id": comment_id}, {"$set": {"resolved": True, "resolved_by": user["name"]}})
    return {"message": "Comment resolved"}


@router.get("/comments/{entity_type}/{entity_id}")
async def get_comments(entity_type: str, entity_id: str, user: dict = Depends(get_current_user)):
    """Get all comments for a document/entry/folder."""
    comments = await db.wp_comments.find(
        {"entity_type": entity_type, "entity_id": entity_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return comments


# ═══════════════════════════════════════════
# SEARCH
# ═══════════════════════════════════════════

@router.get("/search")
async def search_wp(q: str = "", department: str = None, doc_type: str = None, status: str = None, author: str = None, user: dict = Depends(get_current_user)):
    results = {"folders": [], "documents": [], "entries": []}
    if not q and not department and not doc_type:
        return results

    doc_query = {}
    if q:
        doc_query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
    if department:
        doc_query["department"] = department
    if doc_type:
        doc_query["file_type"] = doc_type
    if status:
        doc_query["status"] = status
    if author:
        doc_query["author_id"] = author

    results["documents"] = await db.wp_documents.find(doc_query, {"_id": 0}).sort("updated_at", -1).to_list(50)

    folder_query = {}
    if q:
        folder_query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"description": {"$regex": q, "$options": "i"}}]
    if department:
        folder_query["department"] = department
    results["folders"] = await db.wp_folders.find(folder_query, {"_id": 0}).to_list(20)

    entry_query = {}
    if q:
        entry_query["$or"] = [{"title": {"$regex": q, "$options": "i"}}, {"content": {"$regex": q, "$options": "i"}}]
    results["entries"] = await db.wp_entries.find(entry_query, {"_id": 0}).to_list(20)

    return results


# ═══════════════════════════════════════════
# AUDIT TRAIL
# ═══════════════════════════════════════════

@router.get("/audit")
async def get_audit(entity_id: str = None, user_id: str = None, action: str = None, limit: int = 100, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    query = {}
    if entity_id:
        query["entity_id"] = entity_id
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    logs = await db.wp_audit.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs


# ═══════════════════════════════════════════
# DASHBOARD & ANALYTICS
# ═══════════════════════════════════════════

@router.get("/dashboard")
async def wp_dashboard(user: dict = Depends(get_current_user)):
    is_admin = user.get("role") in ADMIN_ROLES
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0).isoformat()
    import asyncio

    if is_admin:
        f1, f2, f3, f4, f5, recent = await asyncio.gather(
            db.wp_folders.count_documents({}),
            db.wp_documents.count_documents({}),
            db.wp_entries.count_documents({}),
            db.wp_documents.count_documents({"status": "under_review"}),
            db.wp_audit.count_documents({"timestamp": {"$gte": today}}),
            db.wp_audit.find({}, {"_id": 0}).sort("timestamp", -1).to_list(20),
        )
    else:
        uid = user["user_id"]
        f1, f2, f3, f4, f5, recent = await asyncio.gather(
            db.wp_folders.count_documents({"owner_id": uid}),
            db.wp_documents.count_documents({"author_id": uid}),
            db.wp_entries.count_documents({"author_id": uid}),
            db.wp_documents.count_documents({"author_id": uid, "status": "under_review"}),
            db.wp_audit.count_documents({"user_id": uid, "timestamp": {"$gte": today}}),
            db.wp_audit.find({"user_id": uid}, {"_id": 0}).sort("timestamp", -1).to_list(20),
        )

    return {
        "total_folders": f1, "total_documents": f2,
        "total_entries": f3, "pending_approval": f4,
        "today_activity": f5, "recent_activity": recent,
        "is_admin": is_admin,
    }


# ═══════════════════════════════════════════
# FOLDER TREE (RECURSIVE HIERARCHY)
# ═══════════════════════════════════════════

@router.get("/folder-tree")
async def get_folder_tree(user: dict = Depends(get_current_user)):
    """Get full folder tree for sidebar navigation."""
    is_admin = user.get("role") in ADMIN_ROLES
    all_folders = await db.wp_folders.find(
        {"archived": {"$ne": True}},
        {"_id": 0, "folder_id": 1, "parent_id": 1, "name": 1, "classification": 1, "department": 1, "owner_id": 1}
    ).sort("name", 1).to_list(500)

    if not is_admin:
        folder_ids = [f["folder_id"] for f in all_folders]
        if folder_ids:
            user_perms = await db.wp_permissions.find(
                {"folder_id": {"$in": folder_ids}, "$or": [{"user_id": user["user_id"]}, {"role": user.get("role", "")}]},
                {"_id": 0, "folder_id": 1}
            ).to_list(500)
            permitted_ids = {p["folder_id"] for p in user_perms}
        else:
            permitted_ids = set()
        all_folders = [f for f in all_folders if f["owner_id"] == user["user_id"] or f["classification"] == "public" or f["folder_id"] in permitted_ids]

    by_parent = {}
    for f in all_folders:
        pid = f.get("parent_id", "")
        by_parent.setdefault(pid, []).append(f)

    def build_tree(parent_id, depth=0):
        if depth > 10:
            return []
        return [{**c, "children": build_tree(c["folder_id"], depth + 1)} for c in by_parent.get(parent_id, [])]

    return build_tree("")


# ═══════════════════════════════════════════
# FOLDER MOVE / ARCHIVE / RESTORE
# ═══════════════════════════════════════════

@router.put("/folders/{folder_id}/move")
async def move_folder(folder_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    new_parent_id = data.get("new_parent_id", "")
    if new_parent_id == folder_id:
        raise HTTPException(status_code=400, detail="Cannot move folder into itself")
    folder = await db.wp_folders.find_one({"folder_id": folder_id}, {"_id": 0})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    is_admin = user.get("role") in ADMIN_ROLES
    if not is_admin and folder.get("owner_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="No permission to move this folder")
    old_parent = folder.get("parent_id", "")
    await db.wp_folders.update_one({"folder_id": folder_id}, {"$set": {"parent_id": new_parent_id, "updated_at": datetime.now(timezone.utc).isoformat()}})
    await wp_audit(user["user_id"], user["name"], "move_folder", "folder", folder_id, {"from": old_parent, "to": new_parent_id})
    return {"message": "Folder moved"}


@router.put("/folders/{folder_id}/archive")
async def archive_folder(folder_id: str, user: dict = Depends(get_current_user)):
    folder = await db.wp_folders.find_one({"folder_id": folder_id}, {"_id": 0})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    is_admin = user.get("role") in ADMIN_ROLES
    if not is_admin and folder.get("owner_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="No permission")
    await db.wp_folders.update_one({"folder_id": folder_id}, {"$set": {"archived": True, "archived_at": datetime.now(timezone.utc).isoformat(), "archived_by": user["user_id"]}})
    await wp_audit(user["user_id"], user["name"], "archive_folder", "folder", folder_id)
    return {"message": "Folder archived"}


@router.put("/folders/{folder_id}/restore")
async def restore_folder(folder_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only administrators can restore archived folders")
    await db.wp_folders.update_one({"folder_id": folder_id}, {"$set": {"archived": False}, "$unset": {"archived_at": "", "archived_by": ""}})
    await wp_audit(user["user_id"], user["name"], "restore_folder", "folder", folder_id)
    return {"message": "Folder restored"}


# ═══════════════════════════════════════════
# DOCUMENT MOVE / LOCK
# ═══════════════════════════════════════════

@router.put("/documents/{doc_id}/move")
async def move_document(doc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    doc = await db.wp_documents.find_one({"document_id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    is_admin = user.get("role") in ADMIN_ROLES
    if not is_admin and doc.get("author_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="No permission")
    old_folder = doc.get("folder_id", "")
    await db.wp_documents.update_one({"document_id": doc_id}, {"$set": {"folder_id": data.get("folder_id", ""), "updated_at": datetime.now(timezone.utc).isoformat()}})
    await wp_audit(user["user_id"], user["name"], "move_document", "document", doc_id, {"from": old_folder, "to": data.get("folder_id", "")})
    return {"message": "Document moved"}


@router.put("/documents/{doc_id}/lock")
async def toggle_lock(doc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    if user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only administrators can lock/unlock documents")
    lock = data.get("locked", True)
    update = {"locked": lock, "updated_at": datetime.now(timezone.utc).isoformat()}
    if lock:
        update["locked_by"] = user["user_id"]
        update["locked_at"] = datetime.now(timezone.utc).isoformat()
    await db.wp_documents.update_one({"document_id": doc_id}, {"$set": update})
    await wp_audit(user["user_id"], user["name"], "lock_document" if lock else "unlock_document", "document", doc_id)
    return {"message": f"Document {'locked' if lock else 'unlocked'}"}


# ═══════════════════════════════════════════
# MY FILES / PENDING / RECENT / ARCHIVED
# ═══════════════════════════════════════════

@router.get("/my-documents")
async def my_documents(status: str = None, limit: int = 50, user: dict = Depends(get_current_user)):
    query = {"author_id": user["user_id"]}
    if status:
        query["status"] = status
    return await db.wp_documents.find(query, {"_id": 0}).sort("updated_at", -1).to_list(limit)


@router.get("/pending-approvals")
async def pending_approvals(user: dict = Depends(get_current_user)):
    is_admin = user.get("role") in ADMIN_ROLES
    query = {"status": "under_review"}
    if not is_admin:
        perms = await db.wp_permissions.find(
            {"$or": [{"user_id": user["user_id"]}, {"role": user.get("role", "")}], "permissions": "approve"},
            {"_id": 0, "folder_id": 1}
        ).to_list(100)
        folder_ids = [p["folder_id"] for p in perms]
        query["$or"] = [{"author_id": user["user_id"]}, {"folder_id": {"$in": folder_ids}}]
    return await db.wp_documents.find(query, {"_id": 0}).sort("updated_at", -1).to_list(50)


@router.get("/recent")
async def recent_documents(limit: int = 20, user: dict = Depends(get_current_user)):
    is_admin = user.get("role") in ADMIN_ROLES
    query = {} if is_admin else {"$or": [{"author_id": user["user_id"]}, {"status": {"$in": ["published", "approved"]}}]}
    return await db.wp_documents.find(query, {"_id": 0}).sort("updated_at", -1).to_list(limit)


@router.get("/archived")
async def archived_items(user: dict = Depends(get_current_user)):
    import asyncio
    folders, docs = await asyncio.gather(
        db.wp_folders.find({"archived": True}, {"_id": 0}).sort("archived_at", -1).to_list(50),
        db.wp_documents.find({"status": "archived"}, {"_id": 0}).sort("updated_at", -1).to_list(50),
    )
    return {"folders": folders, "documents": docs}


# ═══════════════════════════════════════════
# ENHANCED STATS
# ═══════════════════════════════════════════

@router.get("/stats")
async def workstation_stats(user: dict = Depends(get_current_user)):
    import asyncio
    is_admin = user.get("role") in ADMIN_ROLES

    if is_admin:
        folders, docs, pending, archived_f, archived_d, recent_docs, recent_audit = await asyncio.gather(
            db.wp_folders.count_documents({"archived": {"$ne": True}}),
            db.wp_documents.count_documents({}),
            db.wp_documents.count_documents({"status": "under_review"}),
            db.wp_folders.count_documents({"archived": True}),
            db.wp_documents.count_documents({"status": "archived"}),
            db.wp_documents.find({}, {"_id": 0}).sort("updated_at", -1).to_list(10),
            db.wp_audit.find({}, {"_id": 0}).sort("timestamp", -1).to_list(15),
        )
    else:
        uid = user["user_id"]
        folders, docs, pending, archived_f, archived_d, recent_docs, recent_audit = await asyncio.gather(
            db.wp_folders.count_documents({"owner_id": uid, "archived": {"$ne": True}}),
            db.wp_documents.count_documents({"author_id": uid}),
            db.wp_documents.count_documents({"status": "under_review", "author_id": uid}),
            db.wp_folders.count_documents({"archived": True, "owner_id": uid}),
            db.wp_documents.count_documents({"status": "archived", "author_id": uid}),
            db.wp_documents.find({"author_id": uid}, {"_id": 0}).sort("updated_at", -1).to_list(10),
            db.wp_audit.find({"user_id": uid}, {"_id": 0}).sort("timestamp", -1).to_list(15),
        )

    return {
        "total_folders": folders, "total_documents": docs,
        "pending_approvals": pending, "archived_folders": archived_f,
        "archived_documents": archived_d, "recent_documents": recent_docs,
        "recent_activity": recent_audit, "is_admin": is_admin,
    }


# ═══════════════════════════════════════════
# SEED DEFAULT INSTITUTIONAL FOLDERS
# ═══════════════════════════════════════════

DEFAULT_INSTITUTIONAL_FOLDERS = [
    {"name": "Academic Affairs", "dept": "Academics", "cls": "public", "desc": "Academic policies, curriculum, and management documents"},
    {"name": "Lesson Plans & Schemes of Work", "dept": "Academics", "cls": "public", "desc": "Teaching plans, schemes, and curriculum documents"},
    {"name": "Assessments & Examinations", "dept": "Academics", "cls": "restricted", "desc": "Exam papers, marking schemes, and assessment records"},
    {"name": "Student Records", "dept": "Administration", "cls": "confidential", "desc": "Student personal data, academic records, and reports"},
    {"name": "Admissions", "dept": "Administration", "cls": "restricted", "desc": "Applications, offers, enrollment records"},
    {"name": "Finance", "dept": "Finance", "cls": "confidential", "desc": "Budgets, invoices, audits, and financial reports"},
    {"name": "Human Resources", "dept": "HR", "cls": "confidential", "desc": "Staff contracts, appraisals, recruitment files"},
    {"name": "Staff Records", "dept": "HR", "cls": "confidential", "desc": "Individual staff files and employment history"},
    {"name": "Policies & Governance", "dept": "Administration", "cls": "public", "desc": "School policies, handbooks, and governance documents"},
    {"name": "Compliance & Regulatory", "dept": "Administration", "cls": "restricted", "desc": "Regulatory records, compliance audits, certifications"},
    {"name": "Timetables", "dept": "Academics", "cls": "public", "desc": "Class timetables, exam schedules, calendars"},
    {"name": "Meetings & Minutes", "dept": "Administration", "cls": "restricted", "desc": "Meeting agendas, minutes, and action items"},
    {"name": "Circulars & Notices", "dept": "Administration", "cls": "public", "desc": "Internal announcements and official notices"},
    {"name": "School Events", "dept": "Administration", "cls": "public", "desc": "Event planning, programmes, and records"},
    {"name": "Procurement & Vendors", "dept": "Finance", "cls": "restricted", "desc": "Purchase orders, vendor contracts, procurement records"},
    {"name": "ICT & Systems", "dept": "ICT", "cls": "restricted", "desc": "IT documentation, system manuals, technical records"},
    {"name": "Marketing & Communications", "dept": "Administration", "cls": "public", "desc": "Branding, newsletters, communication materials"},
    {"name": "Board & Leadership", "dept": "Leadership", "cls": "confidential", "desc": "Board papers, strategic plans, leadership documents"},
    {"name": "Archives", "dept": "Administration", "cls": "restricted", "desc": "Historical and archived institutional documents"},
]


@router.post("/seed-defaults")
async def seed_default_folders(user: dict = Depends(require_roles(*ADMIN_ROLES))):
    created = 0
    for fd in DEFAULT_INSTITUTIONAL_FOLDERS:
        exists = await db.wp_folders.find_one({"name": fd["name"], "parent_id": ""}, {"_id": 0, "folder_id": 1})
        if exists:
            continue
        doc = {
            "folder_id": gen_id("wpf_"), "name": fd["name"], "description": fd["desc"],
            "parent_id": "", "owner_id": user["user_id"], "owner_name": user["name"],
            "department": fd["dept"], "classification": fd["cls"],
            "retention_category": "permanent", "workflow_enabled": fd["cls"] != "public",
            "folder_type": "institutional", "confidentiality_level": fd["cls"],
            "tags": [], "archived": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.wp_folders.insert_one(doc)
        created += 1
    await wp_audit(user["user_id"], user["name"], "seed_defaults", "system", "institutional", {"created": created})
    return {"message": f"Created {created} institutional folders", "created": created}
