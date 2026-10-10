"""Push notification subscription management."""
from fastapi import APIRouter, Depends, HTTPException, Body
from database import db
from auth import get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/api/notifications", tags=["push"])


@router.post("/subscribe")
async def subscribe_push(data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Register a push subscription for the current user's device."""
    subscription = data.get("subscription")
    if not subscription or not subscription.get("endpoint"):
        raise HTTPException(400, "Invalid subscription")

    now = datetime.now(timezone.utc).isoformat()
    endpoint = subscription["endpoint"]

    # Upsert: same endpoint = same device
    await db.push_subscriptions.update_one(
        {"subscription.endpoint": endpoint},
        {"$set": {
            "user_id": user["user_id"],
            "user_name": user.get("name", ""),
            "role": user.get("role", ""),
            "subscription": subscription,
            "user_agent": data.get("user_agent", ""),
            "updated_at": now,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"status": "subscribed"}


@router.delete("/unsubscribe")
async def unsubscribe_push(data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Remove a push subscription."""
    endpoint = data.get("endpoint")
    if endpoint:
        await db.push_subscriptions.delete_one({"subscription.endpoint": endpoint})
    return {"status": "unsubscribed"}


@router.get("/push-status")
async def push_status(user: dict = Depends(get_current_user)):
    """Check if user has any active push subscriptions."""
    count = await db.push_subscriptions.count_documents({"user_id": user["user_id"]})
    return {"subscribed": count > 0, "device_count": count}
