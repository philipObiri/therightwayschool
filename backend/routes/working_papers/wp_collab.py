"""
Real-Time Collaborative Editing for Working Papers
WebSocket-based presence + content sync via operational messages.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Body
from database import db
from models import gen_id
from auth import get_current_user
from ws_manager import manager as notif_manager
from datetime import datetime, timezone
import json
import logging
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/wp/collab", tags=["wp-collab"])

# ─── In-Memory Collaboration State ────────────────────────────────────
class CollabSession:
    """Tracks active editors on a single document."""
    def __init__(self, document_id):
        self.document_id = document_id
        self.connections: dict[str, dict] = {}  # user_id -> { ws, name, role, cursor, color }
        self.content = None  # latest content snapshot
        self.version = 0

    async def add_user(self, user_id, user_name, role, ws):
        colors = ["#2E6CC4", "#16A34A", "#DC2626", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"]
        color = colors[len(self.connections) % len(colors)]
        self.connections[user_id] = {"ws": ws, "name": user_name, "role": role, "cursor": 0, "color": color}
        await self.broadcast_presence()

    async def remove_user(self, user_id):
        if user_id in self.connections:
            del self.connections[user_id]
        await self.broadcast_presence()

    async def broadcast_presence(self):
        users = [
            {"user_id": uid, "name": c["name"], "role": c["role"], "cursor": c["cursor"], "color": c["color"]}
            for uid, c in self.connections.items()
        ]
        msg = json.dumps({"type": "presence", "users": users})
        dead = []
        for uid, c in self.connections.items():
            try:
                await c["ws"].send_text(msg)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.connections.pop(uid, None)

    async def broadcast_content(self, from_user_id, content, version):
        self.content = content
        self.version = version
        msg = json.dumps({"type": "content_update", "content": content, "version": version, "from_user": from_user_id})
        dead = []
        for uid, c in self.connections.items():
            if uid == from_user_id:
                continue
            try:
                await c["ws"].send_text(msg)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.connections.pop(uid, None)

    async def broadcast_cursor(self, from_user_id, cursor_pos):
        if from_user_id in self.connections:
            self.connections[from_user_id]["cursor"] = cursor_pos
        msg = json.dumps({"type": "cursor_update", "user_id": from_user_id, "cursor": cursor_pos})
        dead = []
        for uid, c in self.connections.items():
            if uid == from_user_id:
                continue
            try:
                await c["ws"].send_text(msg)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.connections.pop(uid, None)


# Global sessions store
_sessions: dict[str, CollabSession] = {}

def get_session(document_id: str) -> CollabSession:
    if document_id not in _sessions:
        _sessions[document_id] = CollabSession(document_id)
    return _sessions[document_id]

def cleanup_session(document_id: str):
    session = _sessions.get(document_id)
    if session and len(session.connections) == 0:
        del _sessions[document_id]


# ─── REST Endpoints ───────────────────────────────────────────────────

@router.get("/active-editors/{document_id}")
async def get_active_editors(document_id: str, user=Depends(get_current_user)):
    """Get list of users currently editing a document."""
    session = _sessions.get(document_id)
    if not session:
        return {"editors": [], "count": 0}
    editors = [
        {"user_id": uid, "name": c["name"], "role": c["role"], "color": c["color"]}
        for uid, c in session.connections.items()
    ]
    return {"editors": editors, "count": len(editors)}


@router.get("/active-sessions")
async def get_active_sessions(user=Depends(get_current_user)):
    """Get all active collab sessions (admin only)."""
    sessions = []
    for doc_id, session in _sessions.items():
        if len(session.connections) > 0:
            sessions.append({
                "document_id": doc_id,
                "editor_count": len(session.connections),
                "editors": [{"user_id": uid, "name": c["name"]} for uid, c in session.connections.items()],
                "version": session.version,
            })
    return sessions


@router.post("/save/{document_id}")
async def save_document_content(document_id: str, body: dict = Body(...), user=Depends(get_current_user)):
    """Persist the collaborative edits to MongoDB."""
    content = body.get("content", "")
    doc = await db.wp_documents.find_one({"document_id": document_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")

    now = datetime.now(timezone.utc).isoformat()
    old_version = doc.get("version", 1)
    new_version = old_version + 1

    await db.wp_documents.update_one(
        {"document_id": document_id},
        {"$set": {
            "content": content,
            "version": new_version,
            "updated_at": now,
            "last_edited_by": user["user_id"],
            "last_edited_by_name": user.get("name", ""),
        }}
    )

    # Add to version history
    await db.wp_document_versions.insert_one({
        "version_id": gen_id("wpv_"),
        "document_id": document_id,
        "version": new_version,
        "content": content,
        "edited_by": user["user_id"],
        "edited_by_name": user.get("name", ""),
        "saved_at": now,
    })

    # Broadcast save confirmation to all editors
    session = _sessions.get(document_id)
    if session:
        msg = json.dumps({"type": "saved", "version": new_version, "saved_by": user.get("name", "")})
        for uid, c in session.connections.items():
            try:
                await c["ws"].send_text(msg)
            except Exception:
                pass

    return {"version": new_version, "saved_at": now}


@router.get("/versions/{document_id}")
async def get_version_history(document_id: str, user=Depends(get_current_user)):
    """Get version history for a document."""
    versions = await db.wp_document_versions.find(
        {"document_id": document_id}, {"_id": 0}
    ).sort("version", -1).limit(20).to_list(20)
    return versions


# ─── WebSocket Endpoint ───────────────────────────────────────────────

@router.websocket("/ws/{document_id}")
async def collab_websocket(websocket: WebSocket, document_id: str):
    """WebSocket endpoint for real-time collaborative editing."""
    # Authenticate via query param
    token = websocket.query_params.get("token", "")
    user_id = notif_manager.authenticate(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # Fetch user info
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1, "name": 1, "role": 1})
    if not user:
        await websocket.close(code=4001, reason="User not found")
        return

    # Verify document exists
    doc = await db.wp_documents.find_one({"document_id": document_id}, {"_id": 0, "document_id": 1, "content": 1, "version": 1, "title": 1})
    if not doc:
        await websocket.close(code=4004, reason="Document not found")
        return

    await websocket.accept()
    session = get_session(document_id)

    # Initialize session content if empty
    if session.content is None:
        session.content = doc.get("content", "")
        session.version = doc.get("version", 1)

    await session.add_user(user_id, user.get("name", ""), user.get("role", ""), websocket)

    # Send initial state to new user
    try:
        await websocket.send_text(json.dumps({
            "type": "init",
            "content": session.content,
            "version": session.version,
            "document_title": doc.get("title", ""),
        }))
    except Exception:
        session.remove_user(user_id)
        cleanup_session(document_id)
        return

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type", "")

            if msg_type == "content_update":
                content = data.get("content", "")
                session.version += 1
                await session.broadcast_content(user_id, content, session.version)

            elif msg_type == "cursor_update":
                cursor_pos = data.get("cursor", 0)
                await session.broadcast_cursor(user_id, cursor_pos)

            elif msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Collab WS error for {user_id} on {document_id}: {e}")
    finally:
        await session.remove_user(user_id)
        cleanup_session(document_id)
