from fastapi import APIRouter, Depends, HTTPException
from database import db
from models import MailCreate, gen_id
from auth import get_current_user, log_audit
from datetime import datetime, timezone

router = APIRouter(prefix="/api/mail", tags=["mail"])


@router.get("/inbox")
async def get_inbox(user: dict = Depends(get_current_user)):
    messages = await db.mail_messages.find(
        {"to_user_ids": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    for m in messages:
        sender = await db.users.find_one({"user_id": m.get("from_user_id")}, {"_id": 0})
        m["from_name"] = sender["name"] if sender else ""
        m["is_read"] = user["user_id"] in m.get("read_by", [])
    return messages


@router.get("/sent")
async def get_sent(user: dict = Depends(get_current_user)):
    messages = await db.mail_messages.find(
        {"from_user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    for m in messages:
        to_names = []
        for uid in m.get("to_user_ids", []):
            u = await db.users.find_one({"user_id": uid}, {"_id": 0})
            to_names.append(u["name"] if u else uid)
        m["to_names"] = to_names
    return messages


@router.post("/send")
async def send_mail(data: MailCreate, user: dict = Depends(get_current_user)):
    doc = {
        "message_id": gen_id("mail_"),
        "from_user_id": user["user_id"],
        "to_user_ids": data.to_user_ids,
        "subject": data.subject,
        "body": data.body,
        "attachments": data.attachments,
        "read_by": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.mail_messages.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "send_mail", "mail", doc["message_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/{message_id}")
async def get_message(message_id: str, user: dict = Depends(get_current_user)):
    msg = await db.mail_messages.find_one({"message_id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    sender = await db.users.find_one({"user_id": msg.get("from_user_id")}, {"_id": 0})
    msg["from_name"] = sender["name"] if sender else ""

    to_names = []
    for uid in msg.get("to_user_ids", []):
        u = await db.users.find_one({"user_id": uid}, {"_id": 0})
        to_names.append(u["name"] if u else uid)
    msg["to_names"] = to_names
    return msg


@router.post("/{message_id}/read")
async def mark_as_read(message_id: str, user: dict = Depends(get_current_user)):
    await db.mail_messages.update_one(
        {"message_id": message_id},
        {"$addToSet": {"read_by": user["user_id"]}}
    )
    return {"message": "Marked as read"}


@router.get("/unread/count")
async def unread_count(user: dict = Depends(get_current_user)):
    count = await db.mail_messages.count_documents({
        "to_user_ids": user["user_id"],
        "read_by": {"$ne": user["user_id"]}
    })
    return {"unread": count}
