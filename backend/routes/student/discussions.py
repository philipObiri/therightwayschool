"""
TCIS Department Discussion Rooms — Auto-created rooms per department for staff collaboration.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from database import db
from models import gen_id
from auth import get_current_user
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/discussions", tags=["discussions"])

STAFF_ROLES = ("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher", "Teacher",
               "FinanceOfficer", "HR_Officer", "BoardingOfficer", "AdmissionsOfficer",
               "Librarian", "ITAdmin", "Counselor", "Nurse", "Founder", "HeadOfAcademics")


async def _ensure_department_room(department: str):
    """Get or create a department discussion room."""
    existing = await db.discussion_rooms.find_one(
        {"department": department, "type": "department"}, {"_id": 0}
    )
    if existing:
        return existing

    room_id = gen_id("dr_")
    now = datetime.now(timezone.utc).isoformat()
    room = {
        "room_id": room_id,
        "department": department,
        "type": "department",
        "name": f"{department} Department",
        "description": f"Discussion room for {department} department staff",
        "created_at": now,
        "updated_at": now,
        "pinned_message_id": None,
    }
    await db.discussion_rooms.insert_one(room)
    room.pop("_id", None)
    return room


@router.get("/rooms")
async def list_rooms(user: dict = Depends(get_current_user)):
    """List all department rooms the user has access to."""
    if user.get("role") not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Staff only")

    # Get all unique departments
    dept_pipeline = [
        {"$match": {"role": {"$nin": ["Student", "Parent"]}, "department": {"$exists": True, "$ne": ""}}},
        {"$group": {"_id": "$department"}},
        {"$sort": {"_id": 1}}
    ]
    departments = await db.users.aggregate(dept_pipeline).to_list(50)
    dept_names = [d["_id"] for d in departments if d["_id"]]

    # Ensure rooms exist for all departments
    rooms = []
    for dept in dept_names:
        room = await _ensure_department_room(dept)
        # Count members and messages
        member_count = await db.users.count_documents({
            "department": dept, "role": {"$nin": ["Student", "Parent"]}
        })
        msg_count = await db.discussion_messages.count_documents({"room_id": room["room_id"]})
        last_msg = await db.discussion_messages.find_one(
            {"room_id": room["room_id"]}, {"_id": 0},
            sort=[("timestamp", -1)]
        )
        rooms.append({
            **room,
            "member_count": member_count,
            "message_count": msg_count,
            "last_message": last_msg,
            "is_member": user.get("department") == dept,
        })

    return {"rooms": rooms}


@router.get("/rooms/{room_id}")
async def get_room(room_id: str, user: dict = Depends(get_current_user)):
    """Get room details with members."""
    room = await db.discussion_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    members = await db.users.find(
        {"department": room["department"], "role": {"$nin": ["Student", "Parent"]}},
        {"_id": 0, "user_id": 1, "name": 1, "role": 1, "email": 1, "department": 1}
    ).sort("name", 1).to_list(200)

    return {"room": room, "members": members}


@router.get("/rooms/{room_id}/messages")
async def get_messages(room_id: str, skip: int = 0, limit: int = 50, user: dict = Depends(get_current_user)):
    """Get messages for a room."""
    room = await db.discussion_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    messages = await db.discussion_messages.find(
        {"room_id": room_id}, {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)

    return {"messages": list(reversed(messages)), "total": await db.discussion_messages.count_documents({"room_id": room_id})}


@router.post("/rooms/{room_id}/messages")
async def send_message(room_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Send a message to a room."""
    room = await db.discussion_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    text = data.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message text required")

    msg_id = gen_id("dm_")
    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "message_id": msg_id,
        "room_id": room_id,
        "sender_id": user["user_id"],
        "sender_name": user.get("name", ""),
        "sender_role": user.get("role", ""),
        "text": text,
        "reply_to": data.get("reply_to"),
        "file_ids": data.get("file_ids", []),
        "reactions": {},
        "edited": False,
        "deleted": False,
        "timestamp": now,
    }
    await db.discussion_messages.insert_one(msg)
    await db.discussion_rooms.update_one({"room_id": room_id}, {"$set": {"updated_at": now}})

    msg.pop("_id", None)
    return msg


@router.put("/messages/{message_id}")
async def edit_message(message_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Edit own message."""
    msg = await db.discussion_messages.find_one({"message_id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg["sender_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Can only edit own messages")

    text = data.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message text required")

    await db.discussion_messages.update_one(
        {"message_id": message_id},
        {"$set": {"text": text, "edited": True, "edited_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message_id": message_id, "text": text, "edited": True}


@router.delete("/messages/{message_id}")
async def delete_message(message_id: str, user: dict = Depends(get_current_user)):
    """Delete own message (or admin can delete any)."""
    msg = await db.discussion_messages.find_one({"message_id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    is_admin = user.get("role") in ("SuperAdmin", "Admin", "CEO")
    if msg["sender_id"] != user["user_id"] and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.discussion_messages.update_one(
        {"message_id": message_id},
        {"$set": {"deleted": True, "text": "This message was deleted", "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message_id": message_id, "deleted": True}


@router.post("/messages/{message_id}/react")
async def react_message(message_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Toggle a reaction on a message."""
    emoji = data.get("emoji", "")
    if not emoji:
        raise HTTPException(status_code=400, detail="Emoji required")

    msg = await db.discussion_messages.find_one({"message_id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    reactions = msg.get("reactions", {})
    user_id = user["user_id"]
    if emoji in reactions:
        if user_id in reactions[emoji]:
            reactions[emoji].remove(user_id)
            if not reactions[emoji]:
                del reactions[emoji]
        else:
            reactions[emoji].append(user_id)
    else:
        reactions[emoji] = [user_id]

    await db.discussion_messages.update_one(
        {"message_id": message_id}, {"$set": {"reactions": reactions}}
    )
    return {"message_id": message_id, "reactions": reactions}
