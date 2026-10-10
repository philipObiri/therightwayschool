# Storage & Static Files — WhiteNoise + Local Filesystem

**Decision**: No AWS S3 or cloud storage.  
**Approach**: Local VPS filesystem for all uploads. WhiteNoise serves static files for Django. FastAPI serves uploads via `StaticFiles` mount.  
**When to revisit**: Upgrade to S3/CloudFlare R2 when scaling to 3+ campuses or 1000+ users.

**Last Updated**: 2026-05-23

---

## Architecture

```
VPS Filesystem
├── /home/rightway/app/media/          FastAPI uploads (all user-uploaded files)
│   ├── profile_photos/
│   ├── assignments/
│   ├── schemes/
│   ├── quiz_pdfs/
│   ├── gallery/
│   ├── blog/
│   ├── hero/
│   ├── programs/
│   └── ai_diagrams/
│
├── /home/rightway/app/cms/staticfiles/ Django collected static files (served by WhiteNoise)
└── /home/rightway/app/cms/media/      Django CMS uploads (served by WhiteNoise)
```

Nginx handles large file uploads — `client_max_body_size 50M` is already set in the Nginx config.

---

## FastAPI — File Storage (`backend/storage.py`)

Rewrite from Emergent object store to local filesystem + FileResponse:

```python
import os
import uuid
import aiofiles
from pathlib import Path
from fastapi import UploadFile, HTTPException
from fastapi.responses import FileResponse

MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", "/home/rightway/app/media"))
MEDIA_URL = os.environ.get("MEDIA_URL", "/media")   # URL prefix served by FastAPI StaticFiles

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_DOCUMENT_TYPES = {"application/pdf", "application/msword",
                          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


async def save_upload(file: UploadFile, folder: str, allowed_types: set = None) -> str:
    """
    Save an uploaded file to MEDIA_ROOT/folder. Returns the relative path from MEDIA_ROOT.
    Validates MIME type and size. Returns URL-safe relative path.
    """
    if allowed_types and file.content_type not in allowed_types:
        raise HTTPException(400, f"File type '{file.content_type}' not allowed")

    # Read and check size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large (max 50MB)")

    ext = Path(file.filename).suffix.lower() if file.filename else ""
    filename = f"{uuid.uuid4().hex}{ext}"

    dest_dir = MEDIA_ROOT / folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / filename

    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(contents)

    return f"{folder}/{filename}"   # relative path stored in DB


def get_media_url(relative_path: str) -> str:
    """Convert a stored relative path to a public URL."""
    if not relative_path:
        return ""
    return f"{MEDIA_URL}/{relative_path}"


def delete_file(relative_path: str) -> bool:
    """Delete a file from local storage. Returns True if deleted."""
    if not relative_path:
        return False
    abs_path = MEDIA_ROOT / relative_path
    try:
        abs_path.unlink(missing_ok=True)
        return True
    except Exception:
        return False


async def save_bytes(data: bytes, folder: str, extension: str) -> str:
    """Save raw bytes (e.g., AI-generated images, PDF exports) to a folder."""
    filename = f"{uuid.uuid4().hex}{extension}"
    dest_dir = MEDIA_ROOT / folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / filename

    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(data)

    return f"{folder}/{filename}"
```

### Mount Media Directory in FastAPI (`backend/server.py`)

```python
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os

MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", "/home/rightway/app/media"))
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

# Serve all uploaded files at /media/...
app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")
```

This means a file saved as `"gallery/abc123.jpg"` is publicly accessible at:
`https://learnrightschool.com/media/gallery/abc123.jpg`

---

## FastAPI Upload Route Examples

### Profile Photo Upload

```python
from fastapi import APIRouter, UploadFile, File, Depends
from backend.storage import save_upload, get_media_url, delete_file, ALLOWED_IMAGE_TYPES

@router.post("/users/{user_id}/photo")
async def upload_profile_photo(
    user_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    relative_path = await save_upload(file, folder="profile_photos", allowed_types=ALLOWED_IMAGE_TYPES)

    # Delete old photo
    old_path = current_user.get("photo")
    if old_path:
        delete_file(old_path)

    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"photo": relative_path, "photo_url": get_media_url(relative_path)}}
    )
    return {"photo_url": get_media_url(relative_path)}
```

### AI Diagram — Save Generated Image

```python
# In backend/routes/ai_diagrams.py
import httpx
from backend.storage import save_bytes, get_media_url

async def generate_and_save_diagram(prompt: str, school_id: str) -> dict:
    response = await openai_client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1024x1024",
        quality="standard",
        n=1
    )
    image_url = response.data[0].url

    # Download the image from OpenAI's temporary URL
    async with httpx.AsyncClient() as client:
        img_response = await client.get(image_url)
        img_bytes = img_response.content

    # Save to local VPS storage
    relative_path = await save_bytes(img_bytes, folder="ai_diagrams", extension=".png")

    return {
        "image_url": get_media_url(relative_path),
        "path": relative_path
    }
```

### Gallery Upload

```python
@router.post("/api/website/gallery/upload")
async def upload_gallery_image(
    file: UploadFile = File(...),
    category: str = "General",
    caption: str = "",
    current_user: dict = Depends(require_admin)
):
    relative_path = await save_upload(
        file, folder="gallery", allowed_types=ALLOWED_IMAGE_TYPES
    )
    doc = {
        "school_id": current_user["school_id"],
        "image_url": get_media_url(relative_path),
        "image_path": relative_path,
        "category": category,
        "caption": caption,
        "created_at": datetime.utcnow()
    }
    result = await db.gallery.insert_one(doc)
    return {"id": str(result.inserted_id), **doc}
```

---

## Django CMS — WhiteNoise Setup

### Installation

```bash
pip install whitenoise
```

### `cms/settings.py`

```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Static files
STATIC_URL = "/cms/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Media files (user uploads through Django admin)
MEDIA_URL = "/cms/media/"
MEDIA_ROOT = BASE_DIR / "media"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",   # ← must be second, right after SecurityMiddleware
    # ... rest of middleware
]
```

### `cms/urls.py`

```python
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("cms/admin/", admin.site.urls),
    path("cms/api/", include("cms.urls_api")),
]

# Serve media files in development (WhiteNoise handles production static)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

### Collect Static Files (Run Before Production Start)

```bash
cd /home/rightway/app/cms
python manage.py collectstatic --noinput
```

---

## Nginx Media Configuration

WhiteNoise serves Django static files through Django/Gunicorn. For FastAPI's `/media/` route, Nginx can optionally serve files directly from disk for better performance:

```nginx
# Optional: serve FastAPI media directly from Nginx (bypasses Python entirely)
location /media/ {
    alias /home/rightway/app/media/;
    expires 30d;
    add_header Cache-Control "public, immutable";
    add_header X-Content-Type-Options nosniff;
}
```

> If you add this Nginx block, remove the `app.mount("/media", ...)` line from FastAPI to avoid duplicate serving.

---

## Environment Variables

```bash
# .env (production)
MEDIA_ROOT=/home/rightway/app/media
MEDIA_URL=/media

# .env.local (development — use relative path for convenience)
MEDIA_ROOT=./media
MEDIA_URL=http://localhost:8000/media
```

---

## VPS Directory Setup

Run once on initial server setup:

```bash
# Create media directory with correct ownership
sudo mkdir -p /home/rightway/app/media/{profile_photos,assignments,schemes,quiz_pdfs,gallery,blog,hero,programs,ai_diagrams,testimonials}
sudo chown -R rightway:rightway /home/rightway/app/media

# Django CMS media/static
sudo mkdir -p /home/rightway/app/cms/media
sudo mkdir -p /home/rightway/app/cms/staticfiles
sudo chown -R rightway:rightway /home/rightway/app/cms/media
sudo chown -R rightway:rightway /home/rightway/app/cms/staticfiles
```

---

## Backup — Include Media in MongoDB Backup Script

Update `/home/rightway/scripts/backup_mongo.sh` to also back up media:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/rightway/backups"
DB_NAME="rightway"

# MongoDB backup
mongodump --db $DB_NAME --out "$BACKUP_DIR/mongo_$DATE"
tar -czf "$BACKUP_DIR/mongo_$DATE.tar.gz" "$BACKUP_DIR/mongo_$DATE"
rm -rf "$BACKUP_DIR/mongo_$DATE"

# Media files backup (incremental with rsync)
rsync -a --delete /home/rightway/app/media/ "$BACKUP_DIR/media_latest/"
tar -czf "$BACKUP_DIR/media_$DATE.tar.gz" "$BACKUP_DIR/media_latest/"

# Keep only last 7 days for both
find $BACKUP_DIR -name "mongo_*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "media_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

---

## When to Migrate to Cloud Storage

Upgrade to Cloudflare R2 or AWS S3 when:
- Total media storage exceeds 20GB on VPS
- Adding a second VPS / load balancing (shared filesystem needed)
- Expanding to 3+ campuses with separate file namespaces
- CDN delivery needed for gallery images served globally

The `storage.py` abstraction means migration is a one-file change — just replace the local filesystem read/write with S3 put/get calls. All routes stay the same.
