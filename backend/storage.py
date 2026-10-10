"""
File storage service — local filesystem with optional S3/MinIO backend.

Environment variables:
  STORAGE_BACKEND  — "local" (default) | "s3"
  STORAGE_DIR      — local root directory for files (default: ./uploads)

  For S3/MinIO backend:
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, AWS_S3_ENDPOINT_URL
"""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')

logger = logging.getLogger(__name__)

STORAGE_BACKEND = os.environ.get("STORAGE_BACKEND", "local").lower()
STORAGE_DIR = Path(os.environ.get("STORAGE_DIR", Path(__file__).parent / "uploads"))
APP_NAME = "rightway"

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "txt": "text/plain", "csv": "text/csv", "mp3": "audio/mpeg",
    "mp4": "video/mp4", "m4a": "audio/mp4",
}

BLOCKED_EXTENSIONS = {
    "exe", "dmg", "bat", "cmd", "sh", "ps1", "vbs", "msi", "jar", "py", "rb",
    "pl", "cgi", "phtml", "php", "php3", "php4", "php5", "phps", "asp", "aspx",
    "zip", "tar", "gz", "rar", "7z",
    "so", "dll", "dylib", "com",
}

ALLOWED_MIME_PREFIXES = {
    b"%PDF": "application/pdf",
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
    b"GIF8": "image/gif",
    b"PK\x03\x04": "application/zip-based",
    b"\xd0\xcf\x11\xe0": "application/msoffice",
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def validate_mime(data: bytes, filename: str) -> bool:
    """Return True if file magic bytes are consistent with an allowed type."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in {"docx", "xlsx", "pptx", "odt", "ods"}:
        return data[:4] == b"PK\x03\x04"
    for magic in ALLOWED_MIME_PREFIXES:
        if data[:len(magic)] == magic:
            return True
    return True


# ── Local filesystem backend ─────────────────────────────────────────────────

def _local_put(path: str, data: bytes, content_type: str) -> dict:
    dest = STORAGE_DIR / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    logger.debug("Stored %s (%d bytes)", path, len(data))
    return {"path": path, "size": len(data), "content_type": content_type}


def _local_get(path: str):
    dest = STORAGE_DIR / path
    if not dest.exists():
        raise FileNotFoundError(f"Object not found: {path}")
    ext = dest.suffix.lstrip(".")
    content_type = MIME_TYPES.get(ext, "application/octet-stream")
    return dest.read_bytes(), content_type


def _local_delete(path: str) -> None:
    dest = STORAGE_DIR / path
    if dest.exists():
        dest.unlink()


# ── S3 / MinIO backend ───────────────────────────────────────────────────────

def _s3_client():
    import boto3
    kwargs = {
        "aws_access_key_id": os.environ["AWS_ACCESS_KEY_ID"],
        "aws_secret_access_key": os.environ["AWS_SECRET_ACCESS_KEY"],
    }
    endpoint = os.environ.get("AWS_S3_ENDPOINT_URL")
    if endpoint:
        kwargs["endpoint_url"] = endpoint
    return boto3.client("s3", **kwargs)


def _s3_put(path: str, data: bytes, content_type: str) -> dict:
    bucket = os.environ["AWS_S3_BUCKET"]
    _s3_client().put_object(Bucket=bucket, Key=path, Body=data, ContentType=content_type)
    return {"path": path, "size": len(data), "content_type": content_type}


def _s3_get(path: str):
    bucket = os.environ["AWS_S3_BUCKET"]
    resp = _s3_client().get_object(Bucket=bucket, Key=path)
    return resp["Body"].read(), resp["ContentType"]


def _s3_delete(path: str) -> None:
    bucket = os.environ["AWS_S3_BUCKET"]
    _s3_client().delete_object(Bucket=bucket, Key=path)


# ── Public API ───────────────────────────────────────────────────────────────

def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Store a file at the given path. Returns metadata dict."""
    if STORAGE_BACKEND == "s3":
        return _s3_put(path, data, content_type)
    return _local_put(path, data, content_type)


def get_object(path: str):
    """Retrieve a stored file. Returns (bytes, content_type)."""
    if STORAGE_BACKEND == "s3":
        return _s3_get(path)
    return _local_get(path)


def delete_object(path: str) -> None:
    """Delete a stored file."""
    if STORAGE_BACKEND == "s3":
        _s3_delete(path)
    else:
        _local_delete(path)
