"""
TCIS Video Meetings — WebRTC Signaling & Meeting Management
Supports 1-on-1 and group video/audio calls with screen sharing.
"""
from fastapi import APIRouter, Depends, HTTPException, Body, WebSocket, WebSocketDisconnect
from database import db
from models import gen_id
from auth import get_current_user
from ws_manager import send_notification
from datetime import datetime, timezone
import json
import logging
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/meetings", tags=["meetings"])


# ═══════════════════════════════════════════
# MEETING ROOM MANAGER
# ═══════════════════════════════════════════

class MeetingSignaling:
    def __init__(self):
        self.rooms: dict[str, dict[str, WebSocket]] = {}

    async def join(self, room_id: str, user_id: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(room_id, {})
        existing_peers = list(self.rooms[room_id].keys())
        self.rooms[room_id][user_id] = ws
        # Notify new user of existing peers
        await ws.send_text(json.dumps({"type": "room_peers", "peers": existing_peers}))
        # Notify existing peers of new user
        for pid, peer_ws in self.rooms[room_id].items():
            if pid != user_id:
                try:
                    await peer_ws.send_text(json.dumps({"type": "peer_joined", "peer_id": user_id}))
                except Exception:
                    pass

    def disconnect(self, room_id: str, user_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].pop(user_id, None)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def broadcast_leave(self, room_id: str, user_id: str):
        if room_id not in self.rooms:
            return
        for pid, ws in self.rooms[room_id].items():
            if pid != user_id:
                try:
                    await ws.send_text(json.dumps({"type": "peer_left", "peer_id": user_id}))
                except Exception:
                    pass

    async def relay(self, room_id: str, from_id: str, to_id: str, data: dict):
        if room_id not in self.rooms:
            return
        ws = self.rooms[room_id].get(to_id)
        if ws:
            try:
                await ws.send_text(json.dumps({**data, "from": from_id}))
            except Exception:
                pass

    def get_participants(self, room_id: str) -> list:
        return list(self.rooms.get(room_id, {}).keys())


signaling = MeetingSignaling()


# ═══════════════════════════════════════════
# MEETING CRUD
# ═══════════════════════════════════════════

@router.post("/create")
async def create_meeting(data: dict = Body(...), user: dict = Depends(get_current_user)):
    meeting_id = gen_id("meet_")
    now = datetime.now(timezone.utc).isoformat()
    meeting = {
        "meeting_id": meeting_id,
        "title": data.get("title", f"{user['name']}'s Meeting"),
        "type": data.get("type", "instant"),
        "created_by": user["user_id"],
        "created_by_name": user["name"],
        "participant_ids": data.get("participant_ids", []),
        "chat_id": data.get("chat_id", ""),
        "status": "active",
        "started_at": now,
        "ended_at": None,
        "settings": {
            "video_enabled": data.get("video_enabled", True),
            "audio_enabled": data.get("audio_enabled", True),
            "screen_share_enabled": True,
            "max_participants": data.get("max_participants", 12),
        },
        "created_at": now,
    }
    await db.meetings.insert_one(meeting)

    # Notify invited participants
    for pid in meeting["participant_ids"]:
        if pid != user["user_id"]:
            await send_notification(db, pid, {
                "type": "meeting_invite",
                "title": "Video Call",
                "message": f"{user['name']} is calling you",
                "reference_type": "meeting",
                "reference_id": meeting_id,
                "action_url": f"/meeting/{meeting_id}",
            })

    return {k: v for k, v in meeting.items() if k != "_id"}


@router.get("/{meeting_id}")
async def get_meeting(meeting_id: str, user: dict = Depends(get_current_user)):
    m = await db.meetings.find_one({"meeting_id": meeting_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Meeting not found")
    m["active_participants"] = signaling.get_participants(meeting_id)
    return m


@router.post("/{meeting_id}/end")
async def end_meeting(meeting_id: str, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    await db.meetings.update_one(
        {"meeting_id": meeting_id},
        {"$set": {"status": "ended", "ended_at": now}}
    )
    return {"message": "Meeting ended"}


@router.get("/active/list")
async def list_active_meetings(user: dict = Depends(get_current_user)):
    meetings = await db.meetings.find(
        {"status": "active", "$or": [
            {"created_by": user["user_id"]},
            {"participant_ids": user["user_id"]}
        ]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    for m in meetings:
        m["active_participants"] = signaling.get_participants(m["meeting_id"])
    return meetings


# ═══════════════════════════════════════════
# WEBRTC SIGNALING WEBSOCKET
# ═══════════════════════════════════════════

@router.websocket("/ws/{meeting_id}")
async def meeting_websocket(ws: WebSocket, meeting_id: str):
    token = ws.query_params.get("token", "")
    from ws_manager import manager
    user_id = manager.authenticate(token)
    if not user_id:
        await ws.close(code=4001)
        return

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1, "name": 1, "role": 1})
    if not user:
        await ws.close(code=4001)
        return

    await signaling.join(meeting_id, user_id, ws)
    logger.info(f"Meeting WS: {user['name']} joined {meeting_id}")

    try:
        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type", "")

            if msg_type in ("offer", "answer", "ice_candidate"):
                to_id = data.get("to")
                if to_id:
                    await signaling.relay(meeting_id, user_id, to_id, data)
            elif msg_type == "toggle_media":
                for pid, peer_ws in signaling.rooms.get(meeting_id, {}).items():
                    if pid != user_id:
                        try:
                            await peer_ws.send_text(json.dumps({
                                "type": "media_toggle",
                                "from": user_id,
                                "media": data.get("media"),
                                "enabled": data.get("enabled"),
                            }))
                        except Exception:
                            pass
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Meeting WS error: {e}")
    finally:
        signaling.disconnect(meeting_id, user_id)
        await signaling.broadcast_leave(meeting_id, user_id)
        logger.info(f"Meeting WS: {user_id} left {meeting_id}")
