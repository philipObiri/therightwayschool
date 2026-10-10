from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, Query, Header, Request
from database import db
from models import gen_id
from auth import get_current_user
from storage import put_object, get_object, BLOCKED_EXTENSIONS, MAX_FILE_SIZE, APP_NAME, validate_mime
from datetime import datetime, timezone
import jwt, os
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/files", tags=["files"])

JWT_SECRET = os.environ.get("JWT_SECRET", "super-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"

async def _get_user_from_token_or_header(request: Request, token: str = None):
    """Get user from query param token or Authorization header."""
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("user_id")
            if user_id:
                user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
                if user:
                    return user
        except Exception:
            pass
    return await get_current_user(request)


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    # Validate extension
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type .{ext} is not allowed")

    # Read file data
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    # MIME type validation via magic bytes
    if not validate_mime(data, file.filename):
        raise HTTPException(status_code=400, detail="File content does not match its extension")

    # Upload to object storage
    file_id = str(uuid.uuid4())
    storage_path = f"{APP_NAME}/mail/{user['user_id']}/{file_id}.{ext}"

    try:
        result = put_object(storage_path, data, file.content_type or "application/octet-stream")
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="File upload failed")

    # Store reference in DB
    file_doc = {
        "file_id": file_id,
        "storage_path": result.get("path", storage_path),
        "original_filename": file.filename,
        "content_type": file.content_type or "application/octet-stream",
        "size_bytes": len(data),
        "owner_user_id": user["user_id"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.file_assets.insert_one(file_doc)

    return {
        "file_id": file_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "size_bytes": len(data),
        "storage_path": result.get("path", storage_path)
    }


@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    request: Request,
    token: str = Query(None),
    inline: bool = Query(False),
):
    user = await _get_user_from_token_or_header(request, token)
    record = await db.file_assets.find_one(
        {"file_id": file_id, "is_deleted": False}, {"_id": 0}
    )
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        data, content_type = get_object(record["storage_path"])
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise HTTPException(status_code=500, detail="File download failed")

    ct = record.get("content_type", content_type)
    disposition = "inline" if (inline or ct.startswith("image/") or ct == "application/pdf") else "attachment"
    return Response(
        content=data,
        media_type=ct,
        headers={
            "Content-Disposition": f'{disposition}; filename="{record["original_filename"]}"'
        }
    )


@router.get("/{file_id}/preview")
async def preview_file(
    file_id: str,
    request: Request,
    token: str = Query(None),
):
    user = await _get_user_from_token_or_header(request, token)
    record = await db.file_assets.find_one(
        {"file_id": file_id, "is_deleted": False}, {"_id": 0}
    )
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        data, content_type = get_object(record["storage_path"])
    except Exception as e:
        raise HTTPException(status_code=500, detail="Preview failed")

    return Response(
        content=data,
        media_type=record.get("content_type", content_type),
        headers={
            "Content-Disposition": "inline",
            "Access-Control-Allow-Origin": "*",
            "X-Content-Type-Options": "nosniff",
        }
    )
