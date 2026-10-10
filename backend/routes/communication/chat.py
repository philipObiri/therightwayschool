"""
TCIS Messenger - Telegram-Style Communication & File Exchange Module
Real-time messaging with WebSocket, file sharing, reactions, groups, channels, audit.
"""
from fastapi import APIRouter, Depends, HTTPException, Body, WebSocket, WebSocketDisconnect
from database import db
from models import gen_id
from auth import get_current_user, require_roles
from ws_manager import manager as notif_manager
from datetime import datetime, timezone
import json
import logging
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])

ADMIN_ROLES = ("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher")


# ═══════════════════════════════════════════
# CHAT WEBSOCKET MANAGER
# ═══════════════════════════════════════════

class ChatWSManager:
    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}
        self.online_users: set[str] = set()

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(user_id, []).append(ws)
        while len(self.connections[user_id]) > 5:
            old = self.connections[user_id].pop(0)
            try:
                await old.close()
            except Exception:
                pass
        was_offline = user_id not in self.online_users
        self.online_users.add(user_id)
        if was_offline:
            await self.broadcast_status(user_id, True)

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.connections:
            self.connections[user_id] = [w for w in self.connections[user_id] if w is not ws]
            if not self.connections[user_id]:
                del self.connections[user_id]
                self.online_users.discard(user_id)
                asyncio.create_task(self.broadcast_status(user_id, False))

    async def send_to_user(self, user_id: str, data: dict):
        if user_id not in self.connections:
            return
        dead = []
        for ws in self.connections[user_id]:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            if user_id in self.connections:
                self.connections[user_id] = [w for w in self.connections[user_id] if w is not ws]
        if user_id in self.connections and not self.connections[user_id]:
            del self.connections[user_id]
            self.online_users.discard(user_id)

    async def broadcast_to_chat(self, chat_id: str, data: dict, exclude_user: str = None):
        participants = await db.chat_participants.find(
            {"chat_id": chat_id}, {"_id": 0, "user_id": 1}
        ).to_list(500)
        for p in participants:
            uid = p["user_id"]
            if uid != exclude_user:
                await self.send_to_user(uid, data)

    async def broadcast_status(self, user_id: str, online: bool):
        chats = await db.chat_participants.find(
            {"user_id": user_id}, {"_id": 0, "chat_id": 1}
        ).to_list(200)
        chat_ids = [c["chat_id"] for c in chats]
        if not chat_ids:
            return
        peers = await db.chat_participants.find(
            {"chat_id": {"$in": chat_ids}, "user_id": {"$ne": user_id}},
            {"_id": 0, "user_id": 1}
        ).to_list(1000)
        notified = set()
        for p in peers:
            uid = p["user_id"]
            if uid not in notified:
                notified.add(uid)
                await self.send_to_user(uid, {
                    "event": "user_status", "user_id": user_id, "online": online
                })


chat_ws = ChatWSManager()


# ═══════════════════════════════════════════
# AUDIT HELPER
# ═══════════════════════════════════════════

async def chat_audit(user_id, user_name, action, chat_id="", details=None):
    try:
        await db.chat_audit.insert_one({
            "audit_id": gen_id("ca_"), "user_id": user_id, "user_name": user_name,
            "action": action, "chat_id": chat_id,
            "details": details or {}, "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception:
        pass


# ═══════════════════════════════════════════
# CONTACTS
# ═══════════════════════════════════════════

STAFF_ROLES = ("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher", "Teacher",
               "FinanceOfficer", "HRManager", "BoardingOfficer", "AdmissionsOfficer",
               "Librarian", "ITAdmin", "Counselor", "Nurse")

MANAGEMENT_ROLES = ("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher", "FinanceOfficer")

@router.get("/contacts")
async def get_contacts(user: dict = Depends(get_current_user)):
    query = {"is_active": {"$ne": False}, "user_id": {"$ne": user["user_id"]}}
    user_role = user.get("role", "")
    if user_role == "Parent":
        # Parents can only see and chat with management — not teachers, students, or other parents
        query["role"] = {"$in": list(MANAGEMENT_ROLES)}
    elif user_role == "Student":
        # Students see no one on chat (or restrict as needed)
        query["role"] = {"$in": list(MANAGEMENT_ROLES)}
    elif user_role not in ("Student", "Parent"):
        # Staff can see other staff + parents (for management to reply) but not students
        query["role"] = {"$nin": ["Student"]}
    users = await db.users.find(
        query,
        {"_id": 0, "user_id": 1, "name": 1, "role": 1, "email": 1, "department": 1}
    ).sort("name", 1).to_list(500)
    online = list(chat_ws.online_users)
    for u in users:
        u["online"] = u["user_id"] in chat_ws.online_users
    return {"contacts": users, "online_user_ids": online}


# ═══════════════════════════════════════════
# CREATE CHATS
# ═══════════════════════════════════════════

@router.post("/start-private")
async def start_private_chat(data: dict = Body(...), user: dict = Depends(get_current_user)):
    other_id = data.get("user_id", "")
    if not other_id or other_id == user["user_id"]:
        raise HTTPException(400, "Invalid user")
    other = await db.users.find_one({"user_id": other_id}, {"_id": 0, "name": 1, "user_id": 1, "role": 1})
    if not other:
        raise HTTPException(404, "User not found")

    # Enforce chat restrictions
    user_role = user.get("role", "")
    other_role = other.get("role", "")
    # Parents can only chat with management (not teachers, students, or other parents)
    if user_role == "Parent" and other_role not in MANAGEMENT_ROLES:
        raise HTTPException(403, "Parents can only message school management")
    if other_role == "Parent" and user_role not in MANAGEMENT_ROLES:
        raise HTTPException(403, "Only management can message parents")
    # Students restricted to management only
    if user_role == "Student" and other_role not in MANAGEMENT_ROLES:
        raise HTTPException(403, "Students can only message school management")
    if other_role == "Student" and user_role not in MANAGEMENT_ROLES:
        raise HTTPException(403, "Only management can message students")
    # Teachers cannot chat with parents or students
    if user_role == "Teacher" and other_role in ("Student", "Parent"):
        raise HTTPException(403, "Teachers cannot message students or parents via chat")

    existing = await db.chats.find_one({
        "type": "private",
        "participant_ids": {"$all": [user["user_id"], other_id], "$size": 2}
    }, {"_id": 0})
    if existing:
        return existing

    chat_id = gen_id("ch_")
    now = datetime.now(timezone.utc).isoformat()
    chat = {
        "chat_id": chat_id, "type": "private", "name": "",
        "description": "", "image_file_id": "",
        "participant_ids": [user["user_id"], other_id],
        "created_by": user["user_id"], "created_at": now, "updated_at": now,
        "last_message": None, "last_message_at": now,
        "settings": {}
    }
    await db.chats.insert_one(chat)
    for uid, role in [(user["user_id"], "member"), (other_id, "member")]:
        await db.chat_participants.insert_one({
            "participant_id": gen_id("cp_"), "chat_id": chat_id,
            "user_id": uid, "role": role, "joined_at": now,
            "muted": False, "last_read_at": now
        })
    await chat_audit(user["user_id"], user["name"], "start_private_chat", chat_id, {"with": other["name"]})
    return {k: v for k, v in chat.items() if k != "_id"}


@router.post("/create-group")
async def create_group(data: dict = Body(...), user: dict = Depends(get_current_user)):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(400, "Group name required")
    member_ids = list(set(data.get("member_ids", [])))
    if user["user_id"] not in member_ids:
        member_ids.insert(0, user["user_id"])

    chat_id = gen_id("ch_")
    now = datetime.now(timezone.utc).isoformat()
    chat = {
        "chat_id": chat_id, "type": "group", "name": name,
        "description": data.get("description", ""),
        "image_file_id": data.get("image_file_id", ""),
        "category": data.get("category", "general"),
        "participant_ids": member_ids,
        "created_by": user["user_id"], "created_at": now, "updated_at": now,
        "last_message": None, "last_message_at": now,
        "settings": {"only_admins_post": data.get("only_admins_post", False)}
    }
    await db.chats.insert_one(chat)

    for uid in member_ids:
        role = "admin" if uid == user["user_id"] else "member"
        await db.chat_participants.insert_one({
            "participant_id": gen_id("cp_"), "chat_id": chat_id,
            "user_id": uid, "role": role, "joined_at": now,
            "muted": False, "last_read_at": now
        })

    system_msg = await _send_system_message(chat_id, user, f'{user["name"]} created the group "{name}"')
    await chat_audit(user["user_id"], user["name"], "create_group", chat_id, {"name": name, "members": len(member_ids)})

    for uid in member_ids:
        if uid != user["user_id"]:
            await chat_ws.send_to_user(uid, {"event": "chat_created", "chat": {k: v for k, v in chat.items() if k != "_id"}})

    return {k: v for k, v in chat.items() if k != "_id"}


@router.post("/create-channel")
async def create_channel(data: dict = Body(...), user: dict = Depends(get_current_user)):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(400, "Channel name required")
    member_ids = list(set(data.get("member_ids", [])))
    if user["user_id"] not in member_ids:
        member_ids.insert(0, user["user_id"])

    chat_id = gen_id("ch_")
    now = datetime.now(timezone.utc).isoformat()
    chat = {
        "chat_id": chat_id, "type": "channel", "name": name,
        "description": data.get("description", ""),
        "image_file_id": data.get("image_file_id", ""),
        "category": data.get("category", "announcement"),
        "participant_ids": member_ids,
        "created_by": user["user_id"], "created_at": now, "updated_at": now,
        "last_message": None, "last_message_at": now,
        "settings": {"only_admins_post": True}
    }
    await db.chats.insert_one(chat)

    for uid in member_ids:
        role = "admin" if uid == user["user_id"] else "readonly"
        await db.chat_participants.insert_one({
            "participant_id": gen_id("cp_"), "chat_id": chat_id,
            "user_id": uid, "role": role, "joined_at": now,
            "muted": False, "last_read_at": now
        })

    await _send_system_message(chat_id, user, f'{user["name"]} created the channel "{name}"')
    await chat_audit(user["user_id"], user["name"], "create_channel", chat_id, {"name": name})
    return {k: v for k, v in chat.items() if k != "_id"}


# ═══════════════════════════════════════════
# LIST & GET CHATS
# ═══════════════════════════════════════════

@router.get("/list")
async def list_chats(user: dict = Depends(get_current_user)):
    participations = await db.chat_participants.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(300)
    if not participations:
        return []

    chat_ids = [p["chat_id"] for p in participations]
    part_map = {p["chat_id"]: p for p in participations}

    chats = await db.chats.find(
        {"chat_id": {"$in": chat_ids}}, {"_id": 0}
    ).sort("last_message_at", -1).to_list(300)

    user_ids_needed = set()
    for c in chats:
        if c["type"] == "private":
            for pid in c.get("participant_ids", []):
                if pid != user["user_id"]:
                    user_ids_needed.add(pid)

    user_map = {}
    if user_ids_needed:
        users = await db.users.find(
            {"user_id": {"$in": list(user_ids_needed)}},
            {"_id": 0, "user_id": 1, "name": 1, "role": 1}
        ).to_list(len(user_ids_needed))
        user_map = {u["user_id"]: u for u in users}

    unread_pipeline = [
        {"$match": {"chat_id": {"$in": chat_ids}, "sender_id": {"$ne": user["user_id"]}, "deleted": {"$ne": True}}},
        {"$group": {"_id": "$chat_id", "count": {"$sum": 1}, "latest": {"$max": "$created_at"}}}
    ]
    all_msg_counts = await db.chat_messages.aggregate(unread_pipeline).to_list(300)
    msg_count_map = {m["_id"]: m for m in all_msg_counts}

    result = []
    for c in chats:
        p = part_map.get(c["chat_id"], {})
        last_read = p.get("last_read_at", "")

        total_others = msg_count_map.get(c["chat_id"], {}).get("count", 0)
        if last_read and total_others > 0:
            unread = await db.chat_messages.count_documents({
                "chat_id": c["chat_id"],
                "sender_id": {"$ne": user["user_id"]},
                "deleted": {"$ne": True},
                "created_at": {"$gt": last_read}
            })
        else:
            unread = total_others

        display_name = c.get("name", "")
        other_user = None
        if c["type"] == "private":
            for pid in c.get("participant_ids", []):
                if pid != user["user_id"]:
                    other_user = user_map.get(pid, {})
                    display_name = other_user.get("name", "Unknown")
                    break

        result.append({
            **c,
            "display_name": display_name,
            "other_user": other_user,
            "unread_count": unread,
            "muted": p.get("muted", False),
            "my_role": p.get("role", "member"),
            "last_read_at": last_read,
        })

    return result


@router.get("/{chat_id}")
async def get_chat(chat_id: str, user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"chat_id": chat_id}, {"_id": 0})
    if not chat:
        raise HTTPException(404, "Chat not found")
    part = await db.chat_participants.find_one(
        {"chat_id": chat_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not part:
        raise HTTPException(403, "Not a member")

    members = await db.chat_participants.find({"chat_id": chat_id}, {"_id": 0}).to_list(500)
    member_ids = [m["user_id"] for m in members]
    users = await db.users.find(
        {"user_id": {"$in": member_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "role": 1, "email": 1, "department": 1}
    ).to_list(len(member_ids))
    user_map = {u["user_id"]: u for u in users}

    for m in members:
        u = user_map.get(m["user_id"], {})
        m["name"] = u.get("name", "")
        m["user_role"] = u.get("role", "")
        m["online"] = m["user_id"] in chat_ws.online_users

    pinned = await db.chat_messages.find(
        {"chat_id": chat_id, "pinned": True, "deleted": {"$ne": True}}, {"_id": 0}
    ).sort("pinned_at", -1).to_list(50)

    shared_files = await db.chat_messages.find(
        {"chat_id": chat_id, "message_type": {"$in": ["file", "image"]}, "deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    chat["members"] = members
    chat["pinned_messages"] = pinned
    chat["shared_files"] = shared_files
    chat["my_role"] = part.get("role", "member")
    chat["muted"] = part.get("muted", False)
    return chat


# ═══════════════════════════════════════════
# UPDATE / DELETE CHAT
# ═══════════════════════════════════════════

@router.put("/{chat_id}")
async def update_chat(chat_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    part = await db.chat_participants.find_one(
        {"chat_id": chat_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not part or part.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    safe = {k: v for k, v in data.items() if k in ("name", "description", "image_file_id", "category", "settings")}
    safe["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.chats.update_one({"chat_id": chat_id}, {"$set": safe})
    await chat_ws.broadcast_to_chat(chat_id, {"event": "chat_updated", "chat_id": chat_id, "updates": safe})
    await chat_audit(user["user_id"], user["name"], "update_chat", chat_id, safe)
    return {"message": "Chat updated"}


@router.delete("/{chat_id}")
async def delete_chat(chat_id: str, user: dict = Depends(get_current_user)):
    chat = await db.chats.find_one({"chat_id": chat_id}, {"_id": 0})
    if not chat:
        raise HTTPException(404, "Not found")
    if chat.get("created_by") != user["user_id"] and user.get("role") not in ADMIN_ROLES:
        raise HTTPException(403, "Only creator or admin")
    await chat_ws.broadcast_to_chat(chat_id, {"event": "chat_deleted", "chat_id": chat_id})
    await db.chats.delete_one({"chat_id": chat_id})
    await db.chat_participants.delete_many({"chat_id": chat_id})
    await db.chat_messages.delete_many({"chat_id": chat_id})
    await chat_audit(user["user_id"], user["name"], "delete_chat", chat_id)
    return {"message": "Chat deleted"}


# ═══════════════════════════════════════════
# MEMBERS
# ═══════════════════════════════════════════

@router.post("/{chat_id}/members")
async def add_members(chat_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    part = await db.chat_participants.find_one(
        {"chat_id": chat_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not part or part.get("role") != "admin":
        raise HTTPException(403, "Admin only")

    new_ids = data.get("user_ids", [])
    now = datetime.now(timezone.utc).isoformat()
    chat = await db.chats.find_one({"chat_id": chat_id}, {"_id": 0, "type": 1, "name": 1, "participant_ids": 1})
    added = []
    for uid in new_ids:
        if uid in (chat.get("participant_ids") or []):
            continue
        u = await db.users.find_one({"user_id": uid}, {"_id": 0, "name": 1})
        if not u:
            continue
        default_role = "readonly" if chat.get("type") == "channel" else "member"
        await db.chat_participants.insert_one({
            "participant_id": gen_id("cp_"), "chat_id": chat_id,
            "user_id": uid, "role": default_role, "joined_at": now,
            "muted": False, "last_read_at": now
        })
        await db.chats.update_one({"chat_id": chat_id}, {"$push": {"participant_ids": uid}})
        added.append(u["name"])
        await _send_system_message(chat_id, user, f'{user["name"]} added {u["name"]}')
        await chat_ws.send_to_user(uid, {"event": "added_to_chat", "chat_id": chat_id})

    await chat_audit(user["user_id"], user["name"], "add_members", chat_id, {"added": added})
    return {"message": f"Added {len(added)} members"}


@router.delete("/{chat_id}/members/{target_id}")
async def remove_member(chat_id: str, target_id: str, user: dict = Depends(get_current_user)):
    part = await db.chat_participants.find_one(
        {"chat_id": chat_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    is_self = target_id == user["user_id"]
    if not is_self and (not part or part.get("role") != "admin"):
        raise HTTPException(403, "Admin only or leave yourself")

    target = await db.users.find_one({"user_id": target_id}, {"_id": 0, "name": 1})
    target_name = target["name"] if target else "Unknown"

    await db.chat_participants.delete_one({"chat_id": chat_id, "user_id": target_id})
    await db.chats.update_one({"chat_id": chat_id}, {"$pull": {"participant_ids": target_id}})

    action_text = f'{target_name} left the chat' if is_self else f'{user["name"]} removed {target_name}'
    await _send_system_message(chat_id, user, action_text)
    await chat_ws.send_to_user(target_id, {"event": "removed_from_chat", "chat_id": chat_id})
    await chat_ws.broadcast_to_chat(chat_id, {"event": "member_removed", "chat_id": chat_id, "user_id": target_id})
    await chat_audit(user["user_id"], user["name"], "remove_member", chat_id, {"removed": target_name})
    return {"message": "Member removed"}


@router.put("/{chat_id}/members/{target_id}/role")
async def change_member_role(chat_id: str, target_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    part = await db.chat_participants.find_one(
        {"chat_id": chat_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not part or part.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    new_role = data.get("role", "member")
    if new_role not in ("admin", "member", "readonly"):
        raise HTTPException(400, "Invalid role")
    await db.chat_participants.update_one(
        {"chat_id": chat_id, "user_id": target_id}, {"$set": {"role": new_role}}
    )
    target = await db.users.find_one({"user_id": target_id}, {"_id": 0, "name": 1})
    await _send_system_message(chat_id, user, f'{user["name"]} made {target.get("name", "")} {new_role}')
    await chat_ws.broadcast_to_chat(chat_id, {"event": "member_role_changed", "chat_id": chat_id, "user_id": target_id, "role": new_role})
    return {"message": "Role updated"}


@router.put("/{chat_id}/mute")
async def mute_chat(chat_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    muted = data.get("muted", True)
    await db.chat_participants.update_one(
        {"chat_id": chat_id, "user_id": user["user_id"]}, {"$set": {"muted": muted}}
    )
    return {"message": f"Chat {'muted' if muted else 'unmuted'}"}


# ═══════════════════════════════════════════
# MESSAGES
# ═══════════════════════════════════════════

async def _send_system_message(chat_id, user, text):
    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "message_id": gen_id("msg_"), "chat_id": chat_id,
        "sender_id": "system", "sender_name": "System",
        "content": text, "message_type": "system",
        "reply_to": None, "forwarded_from": None,
        "attachments": [], "reactions": {},
        "edited": False, "edited_at": None,
        "deleted": False, "deleted_at": None,
        "pinned": False, "pinned_by": None, "pinned_at": None,
        "starred_by": [], "created_at": now
    }
    await db.chat_messages.insert_one(msg)
    await db.chats.update_one({"chat_id": chat_id}, {
        "$set": {"last_message": {"content": text, "sender_name": "System", "message_type": "system", "created_at": now}, "last_message_at": now}
    })
    clean = {k: v for k, v in msg.items() if k != "_id"}
    await chat_ws.broadcast_to_chat(chat_id, {"event": "new_message", "message": clean})
    return clean


@router.post("/{chat_id}/messages")
async def send_message(chat_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    part = await db.chat_participants.find_one(
        {"chat_id": chat_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not part:
        raise HTTPException(403, "Not a member")

    chat = await db.chats.find_one({"chat_id": chat_id}, {"_id": 0, "settings": 1, "type": 1})
    if chat and chat.get("settings", {}).get("only_admins_post") and part.get("role") not in ("admin",):
        raise HTTPException(403, "Only admins can post in this chat")
    if part.get("role") == "readonly":
        raise HTTPException(403, "Read-only access")

    content = data.get("content", "").strip()
    attachments = data.get("attachments", [])
    msg_type = data.get("message_type", "text")
    if not content and not attachments:
        raise HTTPException(400, "Empty message")

    if attachments and msg_type not in ("voice",):
        msg_type = "file" if any(a.get("file_type", "") not in ("jpg", "jpeg", "png", "gif", "webp") for a in attachments) else "image"

    reply_to = None
    if data.get("reply_to_id"):
        reply_msg = await db.chat_messages.find_one(
            {"message_id": data["reply_to_id"]}, {"_id": 0, "message_id": 1, "sender_name": 1, "content": 1, "message_type": 1}
        )
        if reply_msg:
            reply_to = {
                "message_id": reply_msg["message_id"],
                "sender_name": reply_msg["sender_name"],
                "content": (reply_msg.get("content", "") or "")[:120],
                "message_type": reply_msg.get("message_type", "text")
            }

    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "message_id": gen_id("msg_"), "chat_id": chat_id,
        "sender_id": user["user_id"], "sender_name": user["name"],
        "content": content, "message_type": msg_type,
        "reply_to": reply_to, "forwarded_from": data.get("forwarded_from"),
        "attachments": attachments, "reactions": {},
        "edited": False, "edited_at": None,
        "deleted": False, "deleted_at": None,
        "pinned": False, "pinned_by": None, "pinned_at": None,
        "starred_by": [], "created_at": now
    }
    await db.chat_messages.insert_one(msg)

    preview = content[:80] if content else (attachments[0].get("filename", "File") if attachments else "")
    await db.chats.update_one({"chat_id": chat_id}, {
        "$set": {
            "last_message": {"content": preview, "sender_name": user["name"], "message_type": msg_type, "created_at": now},
            "last_message_at": now, "updated_at": now
        }
    })

    await db.chat_participants.update_one(
        {"chat_id": chat_id, "user_id": user["user_id"]}, {"$set": {"last_read_at": now}}
    )

    clean = {k: v for k, v in msg.items() if k != "_id"}
    await chat_ws.broadcast_to_chat(chat_id, {"event": "new_message", "message": clean})

    # Send dashboard notification to all other participants (not muted)
    participants = await db.chat_participants.find(
        {"chat_id": chat_id, "user_id": {"$ne": user["user_id"]}, "muted": {"$ne": True}},
        {"_id": 0, "user_id": 1}
    ).to_list(500)
    chat_info = await db.chats.find_one({"chat_id": chat_id}, {"_id": 0, "name": 1, "type": 1})
    from ws_manager import send_notification
    for p in participants:
        notif_title = chat_info.get("name") or user["name"]
        await send_notification(db, p["user_id"], {
            "type": "chat_message", "title": f"New message from {notif_title}",
            "message": preview[:60], "reference_type": "chat", "reference_id": chat_id,
            "action_url": f"/messenger?chat={chat_id}",
        })

    return clean


@router.get("/{chat_id}/messages")
async def get_messages(chat_id: str, before: str = None, limit: int = 50, user: dict = Depends(get_current_user)):
    part = await db.chat_participants.find_one(
        {"chat_id": chat_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not part:
        raise HTTPException(403, "Not a member")

    query = {"chat_id": chat_id, "deleted": {"$ne": True}}
    if before:
        query["created_at"] = {"$lt": before}

    messages = await db.chat_messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    messages.reverse()
    return messages


# ═══════════════════════════════════════════
# EDIT / DELETE / REACT / PIN / STAR / FORWARD
# ═══════════════════════════════════════════

@router.put("/messages/{msg_id}")
async def edit_message(msg_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    msg = await db.chat_messages.find_one({"message_id": msg_id}, {"_id": 0})
    if not msg:
        raise HTTPException(404, "Not found")
    if msg["sender_id"] != user["user_id"]:
        raise HTTPException(403, "Can only edit own messages")
    new_content = data.get("content", "").strip()
    if not new_content:
        raise HTTPException(400, "Empty")
    now = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.update_one({"message_id": msg_id}, {
        "$set": {"content": new_content, "edited": True, "edited_at": now}
    })
    await chat_ws.broadcast_to_chat(msg["chat_id"], {
        "event": "message_edited", "message_id": msg_id, "content": new_content, "edited_at": now
    })
    await chat_audit(user["user_id"], user["name"], "edit_message", msg["chat_id"], {"message_id": msg_id})
    return {"message": "Edited"}


@router.delete("/messages/{msg_id}")
async def delete_message(msg_id: str, user: dict = Depends(get_current_user)):
    msg = await db.chat_messages.find_one({"message_id": msg_id}, {"_id": 0})
    if not msg:
        raise HTTPException(404, "Not found")
    is_own = msg["sender_id"] == user["user_id"]
    is_admin_role = user.get("role") in ADMIN_ROLES
    part = await db.chat_participants.find_one(
        {"chat_id": msg["chat_id"], "user_id": user["user_id"]}, {"_id": 0}
    )
    is_chat_admin = part and part.get("role") == "admin"
    if not is_own and not is_admin_role and not is_chat_admin:
        raise HTTPException(403, "No permission")
    now = datetime.now(timezone.utc).isoformat()
    await db.chat_messages.update_one({"message_id": msg_id}, {
        "$set": {"deleted": True, "deleted_at": now, "content": "", "attachments": []}
    })
    await chat_ws.broadcast_to_chat(msg["chat_id"], {"event": "message_deleted", "message_id": msg_id})
    await chat_audit(user["user_id"], user["name"], "delete_message", msg["chat_id"], {"message_id": msg_id})
    return {"message": "Deleted"}


@router.post("/messages/{msg_id}/react")
async def react_message(msg_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    emoji = data.get("emoji", "")
    if not emoji:
        raise HTTPException(400, "Emoji required")
    msg = await db.chat_messages.find_one({"message_id": msg_id}, {"_id": 0, "reactions": 1, "chat_id": 1})
    if not msg:
        raise HTTPException(404, "Not found")

    reactions = msg.get("reactions", {})
    users_list = reactions.get(emoji, [])
    if user["user_id"] in users_list:
        users_list.remove(user["user_id"])
        if not users_list:
            del reactions[emoji]
        else:
            reactions[emoji] = users_list
    else:
        reactions.setdefault(emoji, []).append(user["user_id"])

    await db.chat_messages.update_one({"message_id": msg_id}, {"$set": {"reactions": reactions}})
    await chat_ws.broadcast_to_chat(msg["chat_id"], {
        "event": "reaction_update", "message_id": msg_id, "reactions": reactions
    })
    return {"reactions": reactions}


@router.post("/messages/{msg_id}/pin")
async def pin_message(msg_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    msg = await db.chat_messages.find_one({"message_id": msg_id}, {"_id": 0, "chat_id": 1, "pinned": 1})
    if not msg:
        raise HTTPException(404, "Not found")
    part = await db.chat_participants.find_one(
        {"chat_id": msg["chat_id"], "user_id": user["user_id"]}, {"_id": 0}
    )
    if not part or part.get("role") not in ("admin",):
        if user.get("role") not in ADMIN_ROLES:
            raise HTTPException(403, "Admin only")

    pin = data.get("pinned", True)
    now = datetime.now(timezone.utc).isoformat()
    update = {"pinned": pin}
    if pin:
        update["pinned_by"] = user["user_id"]
        update["pinned_at"] = now
    await db.chat_messages.update_one({"message_id": msg_id}, {"$set": update})

    action = "pinned" if pin else "unpinned"
    await _send_system_message(msg["chat_id"], user, f'{user["name"]} {action} a message')
    await chat_ws.broadcast_to_chat(msg["chat_id"], {"event": "message_pinned", "message_id": msg_id, "pinned": pin})
    return {"message": f"Message {action}"}


@router.post("/messages/{msg_id}/star")
async def star_message(msg_id: str, user: dict = Depends(get_current_user)):
    msg = await db.chat_messages.find_one({"message_id": msg_id}, {"_id": 0, "starred_by": 1})
    if not msg:
        raise HTTPException(404, "Not found")
    starred = msg.get("starred_by", [])
    if user["user_id"] in starred:
        await db.chat_messages.update_one({"message_id": msg_id}, {"$pull": {"starred_by": user["user_id"]}})
        return {"starred": False}
    else:
        await db.chat_messages.update_one({"message_id": msg_id}, {"$push": {"starred_by": user["user_id"]}})
        return {"starred": True}


@router.post("/messages/{msg_id}/forward")
async def forward_message(msg_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    msg = await db.chat_messages.find_one({"message_id": msg_id}, {"_id": 0})
    if not msg:
        raise HTTPException(404, "Not found")
    target_chat_id = data.get("chat_id", "")
    if not target_chat_id:
        raise HTTPException(400, "Target chat required")
    part = await db.chat_participants.find_one(
        {"chat_id": target_chat_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not part:
        raise HTTPException(403, "Not a member of target chat")

    source_chat = await db.chats.find_one({"chat_id": msg["chat_id"]}, {"_id": 0, "name": 1, "type": 1})
    source_name = source_chat.get("name", "") if source_chat else ""

    now = datetime.now(timezone.utc).isoformat()
    fwd = {
        "message_id": gen_id("msg_"), "chat_id": target_chat_id,
        "sender_id": user["user_id"], "sender_name": user["name"],
        "content": msg.get("content", ""), "message_type": msg.get("message_type", "text"),
        "reply_to": None,
        "forwarded_from": {"sender_name": msg.get("sender_name", ""), "chat_name": source_name},
        "attachments": msg.get("attachments", []), "reactions": {},
        "edited": False, "edited_at": None,
        "deleted": False, "deleted_at": None,
        "pinned": False, "pinned_by": None, "pinned_at": None,
        "starred_by": [], "created_at": now
    }
    await db.chat_messages.insert_one(fwd)
    preview = (msg.get("content", "") or "Forwarded")[:80]
    await db.chats.update_one({"chat_id": target_chat_id}, {
        "$set": {
            "last_message": {"content": preview, "sender_name": user["name"], "message_type": fwd["message_type"], "created_at": now},
            "last_message_at": now
        }
    })
    clean = {k: v for k, v in fwd.items() if k != "_id"}
    await chat_ws.broadcast_to_chat(target_chat_id, {"event": "new_message", "message": clean})
    await chat_audit(user["user_id"], user["name"], "forward_message", target_chat_id, {"from_chat": msg["chat_id"]})
    return clean


# ═══════════════════════════════════════════
# READ RECEIPTS
# ═══════════════════════════════════════════

@router.post("/{chat_id}/read")
async def mark_read(chat_id: str, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    await db.chat_participants.update_one(
        {"chat_id": chat_id, "user_id": user["user_id"]},
        {"$set": {"last_read_at": now}}
    )
    await chat_ws.broadcast_to_chat(chat_id, {
        "event": "read_receipt", "chat_id": chat_id, "user_id": user["user_id"], "read_at": now
    }, exclude_user=user["user_id"])
    return {"message": "Marked as read"}


# ═══════════════════════════════════════════
# SEARCH
# ═══════════════════════════════════════════

@router.get("/search/global")
async def search_global(q: str = "", user: dict = Depends(get_current_user)):
    if not q.strip():
        return {"chats": [], "messages": [], "contacts": []}

    my_chats = await db.chat_participants.find(
        {"user_id": user["user_id"]}, {"_id": 0, "chat_id": 1}
    ).to_list(300)
    my_chat_ids = [c["chat_id"] for c in my_chats]

    chats = await db.chats.find(
        {"chat_id": {"$in": my_chat_ids}, "name": {"$regex": q, "$options": "i"}},
        {"_id": 0}
    ).to_list(20)

    messages = await db.chat_messages.find(
        {"chat_id": {"$in": my_chat_ids}, "content": {"$regex": q, "$options": "i"}, "deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(30)

    contacts = await db.users.find(
        {"name": {"$regex": q, "$options": "i"}, "is_active": {"$ne": False}},
        {"_id": 0, "user_id": 1, "name": 1, "role": 1, "email": 1}
    ).to_list(20)

    return {"chats": chats, "messages": messages, "contacts": contacts}


@router.get("/{chat_id}/search")
async def search_in_chat(chat_id: str, q: str = "", filter_type: str = None, user: dict = Depends(get_current_user)):
    part = await db.chat_participants.find_one(
        {"chat_id": chat_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not part:
        raise HTTPException(403, "Not a member")

    query = {"chat_id": chat_id, "deleted": {"$ne": True}}
    if q:
        query["content"] = {"$regex": q, "$options": "i"}
    if filter_type == "files":
        query["message_type"] = {"$in": ["file", "image"]}
    elif filter_type == "images":
        query["message_type"] = "image"

    results = await db.chat_messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return results


# ═══════════════════════════════════════════
# STARRED MESSAGES
# ═══════════════════════════════════════════

@router.get("/starred/list")
async def starred_messages(user: dict = Depends(get_current_user)):
    messages = await db.chat_messages.find(
        {"starred_by": user["user_id"], "deleted": {"$ne": True}}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return messages


# ═══════════════════════════════════════════
# ONLINE STATUS
# ═══════════════════════════════════════════

@router.get("/online/users")
async def online_users(user: dict = Depends(get_current_user)):
    """Return online users: WebSocket-connected + recently active (last 15 min)."""
    online_ids = set(chat_ws.online_users)

    # Also include users who logged in or made API calls recently (last_active tracking)
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    recently_active = await db.users.find(
        {"last_active": {"$gte": cutoff}, "user_id": {"$ne": user["user_id"]}},
        {"_id": 0, "user_id": 1}
    ).to_list(200)
    for u in recently_active:
        online_ids.add(u["user_id"])

    if not online_ids:
        return []
    users = await db.users.find(
        {"user_id": {"$in": list(online_ids)}},
        {"_id": 0, "user_id": 1, "name": 1, "role": 1, "email": 1, "department": 1, "picture": 1}
    ).sort("name", 1).to_list(100)
    return users


# ═══════════════════════════════════════════
# AUDIT
# ═══════════════════════════════════════════

@router.get("/audit/log")
async def get_audit(chat_id: str = None, limit: int = 100, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    query = {}
    if chat_id:
        query["chat_id"] = chat_id
    logs = await db.chat_audit.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs



# ═══════════════════════════════════════════
# TOTAL UNREAD COUNT (for sidebar badge)
# ═══════════════════════════════════════════

@router.get("/unread/total")
async def total_unread(user: dict = Depends(get_current_user)):
    participations = await db.chat_participants.find(
        {"user_id": user["user_id"]}, {"_id": 0, "chat_id": 1, "last_read_at": 1}
    ).to_list(300)
    if not participations:
        return {"total": 0}

    total = 0
    for p in participations:
        last_read = p.get("last_read_at", "")
        query = {
            "chat_id": p["chat_id"],
            "sender_id": {"$ne": user["user_id"]},
            "deleted": {"$ne": True},
        }
        if last_read:
            query["created_at"] = {"$gt": last_read}
        count = await db.chat_messages.count_documents(query)
        total += count

    return {"total": total}


# ═══════════════════════════════════════════
# VOICE NOTE READ RECEIPTS
# ═══════════════════════════════════════════

@router.post("/messages/{msg_id}/listen")
async def mark_voice_listened(msg_id: str, user: dict = Depends(get_current_user)):
    """Mark a voice note as listened by current user."""
    msg = await db.chat_messages.find_one({"message_id": msg_id}, {"_id": 0, "message_type": 1, "listened_by": 1, "chat_id": 1, "sender_id": 1})
    if not msg:
        raise HTTPException(404, "Message not found")
    listened = msg.get("listened_by", [])
    if user["user_id"] not in listened:
        await db.chat_messages.update_one(
            {"message_id": msg_id},
            {"$addToSet": {"listened_by": user["user_id"]}}
        )
        # Notify sender in real-time
        if msg.get("sender_id") and msg["sender_id"] != user["user_id"]:
            await chat_ws.send_to_user(msg["sender_id"], {
                "event": "voice_listened",
                "message_id": msg_id,
                "listener_id": user["user_id"],
                "listener_name": user["name"],
                "chat_id": msg.get("chat_id", ""),
            })
    return {"message": "Marked as listened"}


@router.get("/messages/{msg_id}/listeners")
async def get_voice_listeners(msg_id: str, user: dict = Depends(get_current_user)):
    msg = await db.chat_messages.find_one({"message_id": msg_id}, {"_id": 0, "listened_by": 1})
    if not msg:
        return {"listeners": []}
    listened_ids = msg.get("listened_by", [])
    if not listened_ids:
        return {"listeners": []}
    users = await db.users.find(
        {"user_id": {"$in": listened_ids}},
        {"_id": 0, "user_id": 1, "name": 1}
    ).to_list(50)
    return {"listeners": users}



# ═══════════════════════════════════════════
# SCHEDULED MESSAGES
# ═══════════════════════════════════════════

@router.post("/{chat_id}/schedule-message")
async def schedule_message(chat_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    content = data.get("content", "").strip()
    scheduled_for = data.get("scheduled_for", "")
    if not content or not scheduled_for:
        raise HTTPException(400, "Content and scheduled_for required")

    participant = await db.chat_participants.find_one({"chat_id": chat_id, "user_id": user["user_id"]})
    if not participant:
        raise HTTPException(403, "Not a member")

    msg = {
        "scheduled_id": gen_id("sch_"),
        "chat_id": chat_id,
        "sender_id": user["user_id"],
        "sender_name": user["name"],
        "content": content,
        "message_type": data.get("message_type", "text"),
        "file_id": data.get("file_id", ""),
        "file_name": data.get("file_name", ""),
        "scheduled_for": scheduled_for,
        "recurrence": data.get("recurrence", "none"),
        "recurrence_end": data.get("recurrence_end", ""),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.scheduled_messages.insert_one(msg)
    return {k: v for k, v in msg.items() if k != "_id"}


@router.get("/{chat_id}/scheduled-messages")
async def list_scheduled(chat_id: str, user: dict = Depends(get_current_user)):
    msgs = await db.scheduled_messages.find(
        {"chat_id": chat_id, "sender_id": user["user_id"], "status": "pending"},
        {"_id": 0}
    ).sort("scheduled_for", 1).to_list(50)
    return msgs


@router.delete("/scheduled/{scheduled_id}")
async def cancel_scheduled(scheduled_id: str, user: dict = Depends(get_current_user)):
    await db.scheduled_messages.delete_one({"scheduled_id": scheduled_id, "sender_id": user["user_id"]})
    return {"message": "Scheduled message cancelled"}


@router.post("/process-scheduled")
async def process_scheduled_messages(user: dict = Depends(get_current_user)):
    """Manually trigger sending of due scheduled messages."""
    now = datetime.now(timezone.utc).isoformat()
    due = await db.scheduled_messages.find(
        {"status": "pending", "scheduled_for": {"$lte": now}},
        {"_id": 0}
    ).to_list(100)

    sent = 0
    for sm in due:
        msg_id = gen_id("msg_")
        msg = {
            "message_id": msg_id, "chat_id": sm["chat_id"],
            "sender_id": sm["sender_id"], "sender_name": sm["sender_name"],
            "content": sm["content"], "message_type": sm.get("message_type", "text"),
            "file_id": sm.get("file_id", ""), "file_name": sm.get("file_name", ""),
            "reply_to": "", "reactions": {}, "read_by": [sm["sender_id"]],
            "pinned": False, "edited": False, "deleted": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.chat_messages.insert_one(msg)
        await db.chat_participants.update_many(
            {"chat_id": sm["chat_id"]},
            {"$set": {"last_message_at": msg["created_at"]}}
        )

        # Handle recurrence
        recurrence = sm.get("recurrence", "none")
        recurrence_end = sm.get("recurrence_end", "")
        if recurrence != "none":
            from dateutil.relativedelta import relativedelta
            current = datetime.fromisoformat(sm["scheduled_for"].replace("Z", "+00:00")) if sm["scheduled_for"].endswith("Z") else datetime.fromisoformat(sm["scheduled_for"])
            if recurrence == "daily":
                next_time = current + timedelta(days=1)
            elif recurrence == "weekly":
                next_time = current + timedelta(weeks=1)
            elif recurrence == "monthly":
                next_time = current + relativedelta(months=1)
            else:
                next_time = None

            should_recur = next_time and (not recurrence_end or next_time.isoformat() <= recurrence_end)
            if should_recur:
                new_scheduled = {
                    "scheduled_id": gen_id("sch_"),
                    "chat_id": sm["chat_id"],
                    "sender_id": sm["sender_id"],
                    "sender_name": sm["sender_name"],
                    "content": sm["content"],
                    "message_type": sm.get("message_type", "text"),
                    "file_id": sm.get("file_id", ""),
                    "file_name": sm.get("file_name", ""),
                    "scheduled_for": next_time.isoformat(),
                    "recurrence": recurrence,
                    "recurrence_end": recurrence_end,
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.scheduled_messages.insert_one(new_scheduled)

        await db.scheduled_messages.update_one(
            {"scheduled_id": sm["scheduled_id"]},
            {"$set": {"status": "sent", "sent_at": msg["created_at"]}}
        )

        # Broadcast via WS
        out = {k: v for k, v in msg.items() if k != "_id"}
        participants = await db.chat_participants.find({"chat_id": sm["chat_id"]}, {"_id": 0, "user_id": 1}).to_list(100)
        for p in participants:
            if p["user_id"] != sm["sender_id"]:
                await chat_ws.send_to_user(p["user_id"], {"event": "new_message", "message": out})
        sent += 1

    return {"message": f"Sent {sent} scheduled messages", "count": sent}
