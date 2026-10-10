from fastapi import WebSocket, WebSocketDisconnect
from jose import jwt, JWTError
import os
import json
import logging

logger = logging.getLogger(__name__)

JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret')
JWT_ALGORITHM = "HS256"


class NotificationManager:
    """Manages WebSocket connections for real-time notifications."""

    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.connections.setdefault(user_id, []).append(websocket)
        # Limit to 3 connections per user, close oldest
        while len(self.connections[user_id]) > 3:
            old = self.connections[user_id].pop(0)
            try:
                await old.close()
            except Exception:
                pass
        logger.info(f"WS connected: {user_id} (total: {len(self.connections[user_id])})")

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.connections:
            self.connections[user_id] = [ws for ws in self.connections[user_id] if ws is not websocket]
            if not self.connections[user_id]:
                del self.connections[user_id]
        logger.info(f"WS disconnected: {user_id}")

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
            self.connections[user_id] = [w for w in self.connections.get(user_id, []) if w is not ws]
        if user_id in self.connections and not self.connections[user_id]:
            del self.connections[user_id]

    async def broadcast_all(self, data: dict):
        """Send a message to ALL connected users."""
        dead_users = []
        for user_id, ws_list in list(self.connections.items()):
            dead = []
            for ws in ws_list:
                try:
                    await ws.send_text(json.dumps(data))
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.connections[user_id] = [w for w in self.connections.get(user_id, []) if w is not ws]
            if user_id in self.connections and not self.connections[user_id]:
                dead_users.append(user_id)
        for uid in dead_users:
            del self.connections[uid]

    def authenticate(self, token: str) -> str | None:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return payload.get("user_id")
        except JWTError:
            return None


manager = NotificationManager()


async def send_notification(db, user_id: str, notif_data: dict):
    """Insert notification into DB, push via WebSocket, and send web push."""
    from models import gen_id
    from datetime import datetime, timezone

    notif = {
        "notif_id": gen_id("ntf_"),
        "user_id": user_id,
        "type": notif_data.get("type", "general"),
        "title": notif_data.get("title", ""),
        "message": notif_data.get("message", ""),
        "reference_type": notif_data.get("reference_type", ""),
        "reference_id": notif_data.get("reference_id", ""),
        "is_read": False,
        "action_url": notif_data.get("action_url", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notif)
    notif_payload = {k: v for k, v in notif.items() if k != "_id"}
    # WebSocket (in-app, instant)
    await manager.send_to_user(user_id, {"event": "new_notification", "data": notif_payload})
    # Web Push (device push - works when app is closed/locked)
    await _send_web_push(db, user_id, notif_data)
    return notif_payload


async def send_push_to_all(db, notif_data: dict):
    """Send web push notification to ALL subscribed users (for announcements/emergencies)."""
    subs = await db.push_subscriptions.find({}, {"_id": 0}).to_list(5000)
    for sub in subs:
        await _fire_push(sub.get("subscription"), notif_data)
    # Also broadcast via WebSocket
    await manager.broadcast_all({"event": "new_notification", "data": notif_data})


async def _send_web_push(db, user_id: str, notif_data: dict):
    """Send web push to all devices for a specific user."""
    subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(10)
    for sub in subs:
        await _fire_push(sub.get("subscription"), notif_data)


async def _fire_push(subscription: dict, notif_data: dict):
    """Actually send the web push via pywebpush."""
    if not subscription or not subscription.get("endpoint"):
        return
    try:
        from pywebpush import webpush, WebPushException
        import json
        vapid_private = os.environ.get("VAPID_PRIVATE_KEY", "")
        vapid_claims = {"sub": f"mailto:{os.environ.get('VAPID_CLAIMS_EMAIL', 'admin@tcis.edu.gh')}"}
        payload = json.dumps({
            "title": notif_data.get("title", "TCIS"),
            "body": notif_data.get("message", ""),
            "tag": notif_data.get("type", "general"),
            "url": notif_data.get("action_url", "/"),
        })
        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=vapid_private,
            vapid_claims=vapid_claims,
        )
    except Exception as e:
        logger.debug(f"Web push failed: {e}")
