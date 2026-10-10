"""
Download PDFs from URLs and upload to object storage, linking to resources.
"""
import asyncio
import os
import uuid
import requests
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from storage import put_object, init_storage, APP_NAME

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
db = client[os.environ.get('DB_NAME', 'test_database')]

init_storage()

async def download_and_store():
    # Get all resources that have a URL but no file_ids
    resources = await db.lms_resources.find(
        {"url": {"$ne": "", "$exists": True}, "file_ids": {"$size": 0}},
        {"_id": 0, "resource_id": 1, "title": 1, "url": 1, "teacher_id": 1}
    ).to_list(2000)

    logger.info(f"Found {len(resources)} resources with URLs to download")

    downloaded = 0
    failed = 0
    skipped = 0

    for i, res in enumerate(resources):
        url = res.get("url", "").strip()
        if not url:
            skipped += 1
            continue

        try:
            # Download PDF
            resp = requests.get(url, timeout=30, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            if resp.status_code != 200:
                logger.warning(f"  [{i+1}] HTTP {resp.status_code} for {res['title'][:50]}")
                failed += 1
                continue

            data = resp.content
            if len(data) < 500:
                logger.warning(f"  [{i+1}] Too small ({len(data)}b) for {res['title'][:50]}")
                failed += 1
                continue

            content_type = resp.headers.get("Content-Type", "application/pdf")
            if "pdf" not in content_type and "octet" not in content_type:
                logger.warning(f"  [{i+1}] Not PDF ({content_type}) for {res['title'][:50]}")
                failed += 1
                continue

            # Upload to object storage
            file_id = str(uuid.uuid4())
            safe_title = "".join(c for c in res["title"][:40] if c.isalnum() or c in " _-").strip().replace(" ", "_")
            storage_path = f"{APP_NAME}/resources/{res['teacher_id']}/{file_id}_{safe_title}.pdf"

            put_object(storage_path, data, "application/pdf")

            # Save file asset record
            await db.file_assets.insert_one({
                "file_id": file_id,
                "storage_path": storage_path,
                "original_filename": f"{safe_title}.pdf",
                "content_type": "application/pdf",
                "size_bytes": len(data),
                "owner_user_id": res["teacher_id"],
                "is_deleted": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })

            # Update resource with file_id
            await db.lms_resources.update_one(
                {"resource_id": res["resource_id"]},
                {"$set": {"file_ids": [file_id], "url": ""}}
            )

            downloaded += 1
            if downloaded % 10 == 0:
                logger.info(f"  Progress: {downloaded} downloaded, {failed} failed, {skipped} skipped ({i+1}/{len(resources)})")

        except Exception as e:
            logger.warning(f"  [{i+1}] Error for {res['title'][:40]}: {e}")
            failed += 1

    logger.info(f"\nDone! Downloaded: {downloaded}, Failed: {failed}, Skipped (no URL): {skipped}")
    total = await db.lms_resources.count_documents({"file_ids": {"$ne": []}})
    logger.info(f"Total resources with files: {total}")

asyncio.run(download_and_store())
