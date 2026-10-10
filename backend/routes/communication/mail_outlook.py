from fastapi import APIRouter, Depends, HTTPException, Body
from database import db
from models import gen_id
from auth import get_current_user, require_roles, log_audit
from datetime import datetime, timezone
from typing import List, Optional

router = APIRouter(prefix="/api/mail", tags=["mail"])

SYSTEM_FOLDERS = ["Inbox", "Sent", "Drafts", "Archive", "Trash"]
DEFAULT_SHARED = ["Finance Office", "Admissions Office", "Academic Office", "Admin Office", "IT Support"]


async def ensure_folders(user_id: str):
    """Create system folders for a user if they don't exist."""
    existing = await db.mail_folders.find({"user_id": user_id, "system_folder": True}, {"_id": 0}).to_list(20)
    existing_names = {f["name"] for f in existing}
    for name in SYSTEM_FOLDERS:
        if name not in existing_names:
            await db.mail_folders.insert_one({
                "folder_id": gen_id("fld_"), "user_id": user_id,
                "name": name, "system_folder": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })


async def get_folder_id(user_id: str, folder_name: str) -> str:
    folder = await db.mail_folders.find_one(
        {"user_id": user_id, "name": folder_name}, {"_id": 0}
    )
    if folder:
        return folder["folder_id"]
    return ""


async def enrich_message(msg: dict):
    """Add sender/recipient names to message."""
    sender = await db.users.find_one({"user_id": msg.get("from_user_id")}, {"_id": 0, "name": 1, "role": 1, "picture": 1})
    msg["from_name"] = sender["name"] if sender else ""
    msg["from_role"] = sender.get("role", "") if sender else ""
    msg["from_picture"] = sender.get("picture", "") if sender else ""
    to_names = []
    for uid in msg.get("to", []):
        u = await db.users.find_one({"user_id": uid}, {"_id": 0, "name": 1})
        to_names.append(u["name"] if u else uid)
    msg["to_names"] = to_names
    cc_names = []
    for uid in msg.get("cc", []):
        u = await db.users.find_one({"user_id": uid}, {"_id": 0, "name": 1})
        cc_names.append(u["name"] if u else uid)
    msg["cc_names"] = cc_names
    # Attachments
    attachments = []
    for fid in msg.get("attachment_ids", []):
        f = await db.file_assets.find_one({"file_id": fid, "is_deleted": False}, {"_id": 0})
        if f:
            attachments.append({"file_id": f["file_id"], "filename": f["original_filename"],
                                "content_type": f.get("content_type", ""), "size_bytes": f.get("size_bytes", 0)})
    msg["attachments"] = attachments
    return msg


# ─── Threads ───
@router.get("/threads")
async def list_threads(
    folder: str = "Inbox", q: str = None, unread: bool = None,
    has_attachments: bool = None, importance: str = None,
    category: str = None, limit: int = 50,
    user: dict = Depends(get_current_user)
):
    await ensure_folders(user["user_id"])
    folder_doc = await db.mail_folders.find_one(
        {"user_id": user["user_id"], "name": folder}, {"_id": 0}
    )
    if not folder_doc:
        return []

    # Get message IDs in this folder
    folder_map_query = {"user_id": user["user_id"], "folder_id": folder_doc["folder_id"]}
    if unread:
        folder_map_query["is_read"] = False
    maps = await db.mail_folder_map.find(folder_map_query, {"_id": 0}).to_list(1000)
    thread_ids = list({m["thread_id"] for m in maps})

    if not thread_ids:
        return []

    # Get threads
    thread_query = {"thread_id": {"$in": thread_ids}}
    if q:
        thread_query["$or"] = [
            {"subject": {"$regex": q, "$options": "i"}},
            {"thread_id": {"$in": thread_ids}}
        ]
    threads = await db.mail_threads.find(thread_query, {"_id": 0}).sort("last_message_at", -1).to_list(limit)

    # Enrich threads with last message preview and read status
    for t in threads:
        last_msg = await db.mail_messages_v2.find(
            {"thread_id": t["thread_id"]}, {"_id": 0}
        ).sort("created_at", -1).to_list(1)
        if last_msg:
            msg = last_msg[0]
            await enrich_message(msg)
            t["last_message"] = msg
            t["snippet"] = (msg.get("body_text") or "")[:100]
        else:
            t["last_message"] = None
            t["snippet"] = ""

        # Read status for this user
        user_map = next((m for m in maps if m["thread_id"] == t["thread_id"]), None)
        t["is_read"] = user_map.get("is_read", True) if user_map else True
        t["is_flagged"] = user_map.get("is_flagged", False) if user_map else False
        t["is_pinned"] = user_map.get("is_pinned", False) if user_map else False
        t["categories"] = user_map.get("category_tags", []) if user_map else []

        # Count messages in thread
        t["message_count"] = await db.mail_messages_v2.count_documents({"thread_id": t["thread_id"]})

        # Has attachments
        t["has_attachments"] = await db.mail_messages_v2.count_documents(
            {"thread_id": t["thread_id"], "attachment_ids": {"$ne": []}}
        ) > 0

    if has_attachments:
        threads = [t for t in threads if t.get("has_attachments")]
    if importance:
        threads = [t for t in threads if t.get("last_message", {}).get("importance") == importance]

    # Search in message bodies
    if q:
        body_matches = await db.mail_messages_v2.find(
            {"thread_id": {"$in": thread_ids}, "body_text": {"$regex": q, "$options": "i"}},
            {"_id": 0, "thread_id": 1}
        ).to_list(100)
        body_thread_ids = {m["thread_id"] for m in body_matches}
        subj_thread_ids = {t["thread_id"] for t in threads}
        all_ids = subj_thread_ids | body_thread_ids
        threads = [t for t in threads if t["thread_id"] in all_ids]

    return threads


@router.get("/threads/{thread_id}")
async def get_thread(thread_id: str, user: dict = Depends(get_current_user)):
    thread = await db.mail_threads.find_one({"thread_id": thread_id}, {"_id": 0})
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    messages = await db.mail_messages_v2.find(
        {"thread_id": thread_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)

    for msg in messages:
        await enrich_message(msg)

    thread["messages"] = messages

    # Mark as read
    await db.mail_folder_map.update_many(
        {"user_id": user["user_id"], "thread_id": thread_id},
        {"$set": {"is_read": True}}
    )
    return thread


# ─── Send / Compose ───
@router.post("/messages")
async def send_message(
    data: dict = Body(...),
    user: dict = Depends(get_current_user)
):
    to_ids = data.get("to", [])
    cc_ids = data.get("cc", [])
    bcc_ids = data.get("bcc", [])
    subject = data.get("subject", "(No Subject)")
    body_html = data.get("body_html", "")
    body_text = data.get("body_text", body_html.replace("<br>", "\n").replace("</p>", "\n"))
    importance = data.get("importance", "normal")
    categories = data.get("categories", [])
    confidentiality = data.get("confidentiality", "public_internal")
    attachment_ids = data.get("attachment_ids", [])
    thread_id = data.get("thread_id")
    is_draft = data.get("is_draft", False)

    if not to_ids and not is_draft:
        raise HTTPException(status_code=400, detail="At least one recipient required")

    now = datetime.now(timezone.utc).isoformat()

    # Create or use existing thread
    if not thread_id:
        thread_id = gen_id("thr_")
        all_participants = list(set([user["user_id"]] + to_ids + cc_ids))
        await db.mail_threads.insert_one({
            "thread_id": thread_id, "subject": subject,
            "participants": all_participants,
            "created_by": user["user_id"],
            "confidentiality": confidentiality,
            "created_at": now, "updated_at": now,
            "last_message_at": now
        })
    else:
        await db.mail_threads.update_one(
            {"thread_id": thread_id},
            {"$set": {"last_message_at": now, "updated_at": now},
             "$addToSet": {"participants": {"$each": to_ids + cc_ids}}}
        )

    # Create message
    message_id = gen_id("msg_")
    msg_doc = {
        "message_id": message_id, "thread_id": thread_id,
        "from_user_id": user["user_id"],
        "to": to_ids, "cc": cc_ids, "bcc": bcc_ids,
        "subject": subject,
        "body_html": body_html, "body_text": body_text,
        "importance": importance,
        "attachment_ids": attachment_ids,
        "is_draft": is_draft,
        "reply_to_message_id": data.get("reply_to_message_id", ""),
        "created_at": now,
        "sent_at": now if not is_draft else ""
    }
    await db.mail_messages_v2.insert_one(msg_doc)

    if not is_draft:
        # Put in sender's Sent folder
        sent_folder = await get_folder_id(user["user_id"], "Sent")
        if sent_folder:
            await db.mail_folder_map.insert_one({
                "map_id": gen_id("map_"), "user_id": user["user_id"],
                "message_id": message_id, "thread_id": thread_id,
                "folder_id": sent_folder, "is_read": True,
                "is_pinned": False, "is_flagged": False,
                "category_tags": categories, "archived_at": None
            })

        # Put in recipients' Inbox
        all_recipients = list(set(to_ids + cc_ids + bcc_ids))
        for rid in all_recipients:
            await ensure_folders(rid)
            inbox_folder = await get_folder_id(rid, "Inbox")
            if inbox_folder:
                # Check if thread already has a folder map for this user
                existing = await db.mail_folder_map.find_one(
                    {"user_id": rid, "thread_id": thread_id}, {"_id": 0}
                )
                if existing:
                    await db.mail_folder_map.update_one(
                        {"map_id": existing["map_id"]},
                        {"$set": {"is_read": False}}
                    )
                else:
                    await db.mail_folder_map.insert_one({
                        "map_id": gen_id("map_"), "user_id": rid,
                        "message_id": message_id, "thread_id": thread_id,
                        "folder_id": inbox_folder, "is_read": False,
                        "is_pinned": False, "is_flagged": False,
                        "category_tags": [], "archived_at": None
                    })

        await log_audit(user["user_id"], user["name"], "send_mail", "mail", message_id)
    else:
        # Draft folder
        drafts_folder = await get_folder_id(user["user_id"], "Drafts")
        if drafts_folder:
            await db.mail_folder_map.insert_one({
                "map_id": gen_id("map_"), "user_id": user["user_id"],
                "message_id": message_id, "thread_id": thread_id,
                "folder_id": drafts_folder, "is_read": True,
                "is_pinned": False, "is_flagged": False,
                "category_tags": [], "archived_at": None
            })

    return {k: v for k, v in msg_doc.items() if k != "_id"}


# ─── Reply / Forward ───
@router.post("/messages/{message_id}/reply")
async def reply_message(
    message_id: str, data: dict = Body(...),
    user: dict = Depends(get_current_user)
):
    original = await db.mail_messages_v2.find_one({"message_id": message_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Message not found")

    reply_all = data.get("reply_all", False)
    to_ids = [original["from_user_id"]]
    cc_ids = []
    if reply_all:
        to_ids = list(set([original["from_user_id"]] + original.get("to", [])) - {user["user_id"]})
        cc_ids = [uid for uid in original.get("cc", []) if uid != user["user_id"]]

    return await send_message(
        data={
            "to": to_ids, "cc": cc_ids, "bcc": [],
            "subject": f"Re: {original.get('subject', '')}".replace("Re: Re: ", "Re: "),
            "body_html": data.get("body_html", ""),
            "body_text": data.get("body_text", ""),
            "importance": data.get("importance", "normal"),
            "attachment_ids": data.get("attachment_ids", []),
            "thread_id": original["thread_id"],
            "reply_to_message_id": message_id,
        },
        user=user
    )


@router.post("/messages/{message_id}/forward")
async def forward_message(
    message_id: str, data: dict = Body(...),
    user: dict = Depends(get_current_user)
):
    original = await db.mail_messages_v2.find_one({"message_id": message_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Message not found")

    return await send_message(
        data={
            "to": data.get("to", []), "cc": data.get("cc", []), "bcc": [],
            "subject": f"Fwd: {original.get('subject', '')}".replace("Fwd: Fwd: ", "Fwd: "),
            "body_html": data.get("body_html", "") + f'<hr><p><em>Forwarded message from {original.get("from_user_id")}</em></p>' + original.get("body_html", ""),
            "body_text": data.get("body_text", ""),
            "importance": data.get("importance", "normal"),
            "attachment_ids": data.get("attachment_ids", []) + original.get("attachment_ids", []),
        },
        user=user
    )


# ─── Message Actions ───
@router.post("/messages/{message_id}/read")
async def mark_read(message_id: str, user: dict = Depends(get_current_user)):
    msg = await db.mail_messages_v2.find_one({"message_id": message_id}, {"_id": 0, "thread_id": 1})
    if msg:
        await db.mail_folder_map.update_many(
            {"user_id": user["user_id"], "thread_id": msg["thread_id"]},
            {"$set": {"is_read": True}}
        )
    return {"message": "Marked as read"}


@router.post("/messages/{message_id}/unread")
async def mark_unread(message_id: str, user: dict = Depends(get_current_user)):
    msg = await db.mail_messages_v2.find_one({"message_id": message_id}, {"_id": 0, "thread_id": 1})
    if msg:
        await db.mail_folder_map.update_many(
            {"user_id": user["user_id"], "thread_id": msg["thread_id"]},
            {"$set": {"is_read": False}}
        )
    return {"message": "Marked as unread"}


@router.post("/messages/{message_id}/flag")
async def toggle_flag(message_id: str, user: dict = Depends(get_current_user)):
    msg = await db.mail_messages_v2.find_one({"message_id": message_id}, {"_id": 0, "thread_id": 1})
    if msg:
        current = await db.mail_folder_map.find_one(
            {"user_id": user["user_id"], "thread_id": msg["thread_id"]}, {"_id": 0}
        )
        new_flag = not (current.get("is_flagged", False) if current else False)
        await db.mail_folder_map.update_many(
            {"user_id": user["user_id"], "thread_id": msg["thread_id"]},
            {"$set": {"is_flagged": new_flag}}
        )
    return {"message": "Flag toggled"}


@router.post("/messages/{message_id}/archive")
async def archive_message(message_id: str, user: dict = Depends(get_current_user)):
    msg = await db.mail_messages_v2.find_one({"message_id": message_id}, {"_id": 0, "thread_id": 1})
    if msg:
        archive_folder = await get_folder_id(user["user_id"], "Archive")
        await db.mail_folder_map.update_many(
            {"user_id": user["user_id"], "thread_id": msg["thread_id"]},
            {"$set": {"folder_id": archive_folder, "archived_at": datetime.now(timezone.utc).isoformat()}}
        )
    return {"message": "Archived"}


@router.post("/messages/{message_id}/move")
async def move_message(message_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    folder_name = data.get("folder", "Inbox")
    msg = await db.mail_messages_v2.find_one({"message_id": message_id}, {"_id": 0, "thread_id": 1})
    if msg:
        folder_doc = await db.mail_folders.find_one(
            {"user_id": user["user_id"], "name": folder_name}, {"_id": 0}
        )
        if folder_doc:
            await db.mail_folder_map.update_many(
                {"user_id": user["user_id"], "thread_id": msg["thread_id"]},
                {"$set": {"folder_id": folder_doc["folder_id"]}}
            )
    return {"message": f"Moved to {folder_name}"}


@router.delete("/messages/{message_id}")
async def delete_message(message_id: str, user: dict = Depends(get_current_user)):
    msg = await db.mail_messages_v2.find_one({"message_id": message_id}, {"_id": 0, "thread_id": 1})
    if msg:
        trash_folder = await get_folder_id(user["user_id"], "Trash")
        await db.mail_folder_map.update_many(
            {"user_id": user["user_id"], "thread_id": msg["thread_id"]},
            {"$set": {"folder_id": trash_folder}}
        )
    return {"message": "Moved to Trash"}


# ─── Folders ───
@router.get("/folders")
async def list_folders(user: dict = Depends(get_current_user)):
    await ensure_folders(user["user_id"])
    folders = await db.mail_folders.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(50)
    for f in folders:
        f["unread_count"] = await db.mail_folder_map.count_documents({
            "user_id": user["user_id"], "folder_id": f["folder_id"], "is_read": False
        })
    return folders


@router.post("/folders")
async def create_folder(data: dict = Body(...), user: dict = Depends(get_current_user)):
    name = data.get("name", "New Folder")
    doc = {
        "folder_id": gen_id("fld_"), "user_id": user["user_id"],
        "name": name, "system_folder": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.mail_folders.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, user: dict = Depends(get_current_user)):
    folder = await db.mail_folders.find_one({"folder_id": folder_id}, {"_id": 0})
    if not folder or folder.get("system_folder"):
        raise HTTPException(status_code=400, detail="Cannot delete system folder")
    # Move messages to Inbox
    inbox_id = await get_folder_id(user["user_id"], "Inbox")
    await db.mail_folder_map.update_many(
        {"user_id": user["user_id"], "folder_id": folder_id},
        {"$set": {"folder_id": inbox_id}}
    )
    await db.mail_folders.delete_one({"folder_id": folder_id})
    return {"message": "Folder deleted"}


# ─── Shared Mailboxes ───
@router.get("/shared-mailboxes")
async def list_shared_mailboxes(user: dict = Depends(get_current_user)):
    mailboxes = await db.mail_shared_mailboxes.find({}, {"_id": 0}).to_list(50)
    return mailboxes


@router.post("/shared-mailboxes")
async def create_shared_mailbox(
    data: dict = Body(...),
    user: dict = Depends(require_roles("Admin", "SuperAdmin"))
):
    doc = {
        "mailbox_id": gen_id("smb_"), "name": data.get("name", ""),
        "members": data.get("members", []),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.mail_shared_mailboxes.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


# ─── User List for Recipients ───
@router.get("/contacts")
async def list_contacts(q: str = "", user: dict = Depends(get_current_user)):
    query = {"role": {"$nin": ["Student", "Parent"]}}  # Only staff, teachers, and management
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"role": {"$regex": q, "$options": "i"}},
            {"department": {"$regex": q, "$options": "i"}},
        ]
        # Remove the role filter for search to work properly
        query = {"$and": [
            {"role": {"$nin": ["Student", "Parent"]}},
            {"$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"email": {"$regex": q, "$options": "i"}},
                {"role": {"$regex": q, "$options": "i"}},
                {"department": {"$regex": q, "$options": "i"}},
            ]}
        ]}
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("role", 1).to_list(200)
    return [{"user_id": u["user_id"], "name": u["name"], "email": u["email"], "role": u.get("role", ""), "department": u.get("department", "")} for u in users]


# ─── Stats ───
@router.get("/stats")
async def mail_stats(user: dict = Depends(get_current_user)):
    await ensure_folders(user["user_id"])
    folders = await db.mail_folders.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(20)
    stats = {}
    for f in folders:
        total = await db.mail_folder_map.count_documents({"user_id": user["user_id"], "folder_id": f["folder_id"]})
        unread = await db.mail_folder_map.count_documents({"user_id": user["user_id"], "folder_id": f["folder_id"], "is_read": False})
        stats[f["name"]] = {"total": total, "unread": unread}
    return stats
