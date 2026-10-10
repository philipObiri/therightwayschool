"""
Download Cambridge past papers from papacambridge.com and store in object storage.
"""
import asyncio, os, uuid, requests, logging
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from storage import put_object, init_storage, APP_NAME

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = AsyncIOMotorClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
db = client[os.environ.get('DB_NAME', 'test_database')]
init_storage()

BASE = "https://pastpapers.papacambridge.com/directories/CAIE/CAIE-pastpapers/upload"

# Map subject codes to downloadable paper filenames
PAPERS = {
    "0500": ["0500_s24_qp_12.pdf","0500_s24_qp_22.pdf","0500_w23_qp_12.pdf","0500_w23_qp_22.pdf","0500_s23_qp_12.pdf","0500_s24_ms_12.pdf","0500_s24_ms_22.pdf","0500_s23_qp_22.pdf","0500_w22_qp_12.pdf","0500_s22_qp_22.pdf"],
    "0580": ["0580_s24_qp_22.pdf","0580_s24_qp_42.pdf","0580_w23_qp_22.pdf","0580_w23_qp_42.pdf","0580_s23_qp_22.pdf","0580_s24_ms_22.pdf","0580_s24_ms_42.pdf","0580_s22_qp_42.pdf","0580_w22_qp_22.pdf","0580_s23_qp_42.pdf"],
    "0610": ["0610_s24_qp_22.pdf","0610_s24_qp_42.pdf","0610_s24_qp_62.pdf","0610_w23_qp_22.pdf","0610_w23_qp_42.pdf","0610_s24_ms_22.pdf","0610_s24_ms_42.pdf","0610_s23_qp_22.pdf","0610_s22_qp_42.pdf","0610_w22_qp_22.pdf"],
    "0620": ["0620_s24_qp_22.pdf","0620_s24_qp_42.pdf","0620_w23_qp_22.pdf","0620_w23_qp_42.pdf","0620_s24_qp_62.pdf","0620_s24_ms_22.pdf","0620_s24_ms_42.pdf","0620_s23_qp_22.pdf","0620_s22_qp_42.pdf","0620_w22_qp_22.pdf"],
    "0625": ["0625_s24_qp_22.pdf","0625_s24_qp_42.pdf","0625_s24_qp_62.pdf","0625_w23_qp_22.pdf","0625_w23_qp_42.pdf","0625_s24_ms_22.pdf","0625_s24_ms_42.pdf","0625_s23_qp_22.pdf","0625_s22_qp_42.pdf","0625_w22_qp_22.pdf"],
    "0455": ["0455_s24_qp_12.pdf","0455_s24_qp_22.pdf","0455_w23_qp_12.pdf","0455_w23_qp_22.pdf","0455_s23_qp_12.pdf","0455_s24_ms_12.pdf","0455_s24_ms_22.pdf","0455_s22_qp_22.pdf","0455_w22_qp_12.pdf","0455_s23_qp_22.pdf"],
    "0450": ["0450_s24_qp_12.pdf","0450_s24_qp_22.pdf","0450_w23_qp_12.pdf","0450_w23_qp_22.pdf","0450_s23_qp_12.pdf","0450_s24_ms_12.pdf","0450_s24_ms_22.pdf","0450_s22_qp_12.pdf","0450_w22_qp_22.pdf","0450_s23_qp_22.pdf"],
    "0452": ["0452_s24_qp_12.pdf","0452_s24_qp_22.pdf","0452_w23_qp_12.pdf","0452_w23_qp_22.pdf","0452_s23_qp_12.pdf","0452_s24_ms_12.pdf","0452_s24_ms_22.pdf","0452_s22_qp_12.pdf","0452_w22_qp_22.pdf","0452_s23_qp_22.pdf"],
    "0417": ["0417_s24_qp_12.pdf","0417_w23_qp_12.pdf","0417_s23_qp_12.pdf","0417_s24_ms_12.pdf","0417_w22_qp_12.pdf","0417_s22_qp_12.pdf","0417_w23_ms_12.pdf","0417_s21_qp_12.pdf","0417_w21_qp_12.pdf","0417_s24_qp_11.pdf"],
    "0520": ["0520_s24_qp_22.pdf","0520_s24_qp_42.pdf","0520_w23_qp_22.pdf","0520_w23_qp_42.pdf","0520_s23_qp_22.pdf","0520_s24_ms_22.pdf","0520_s22_qp_22.pdf","0520_s22_qp_42.pdf","0520_w22_qp_22.pdf","0520_s23_qp_42.pdf"],
    "0460": ["0460_s24_qp_12.pdf","0460_s24_qp_22.pdf","0460_w23_qp_12.pdf","0460_w23_qp_22.pdf","0460_s23_qp_12.pdf","0460_s24_ms_12.pdf","0460_s22_qp_22.pdf","0460_w22_qp_12.pdf","0460_s23_qp_22.pdf","0460_s21_qp_12.pdf"],
    "0495": ["0495_s24_qp_12.pdf","0495_s24_qp_22.pdf","0495_w23_qp_12.pdf","0495_w23_qp_22.pdf","0495_s23_qp_12.pdf","0495_s24_ms_12.pdf","0495_s22_qp_12.pdf","0495_s22_qp_22.pdf","0495_w22_qp_12.pdf","0495_w22_qp_22.pdf"],
    "0457": ["0457_s24_qp_12.pdf","0457_s24_qp_22.pdf","0457_w23_qp_12.pdf","0457_w23_qp_22.pdf","0457_s23_qp_12.pdf","0457_s24_ms_12.pdf","0457_s22_qp_12.pdf","0457_s22_qp_22.pdf","0457_w22_qp_12.pdf","0457_w22_qp_22.pdf"],
}

SUBJECT_CODES = {
    "English Language": "0500", "Mathematics": "0580", "Extended Mathematics": "0580",
    "Additional Mathematics": "0580", "Pure Mathematics 1": "0580", "Pure Mathematics 2": "0580",
    "Probability and Statistics": "0580", "Biology": "0610", "Coordinated Science": "0610",
    "Chemistry": "0620", "Physics": "0625", "Economics": "0455", "Business Studies": "0450",
    "Accounting": "0452", "Information Technology": "0417", "French": "0520",
    "Geography": "0460", "Sociology": "0495", "Global Perspectives": "0457",
    "literature": "0500", "Art and Design": None,
}

PAPER_NAMES = {
    "qp": "Question Paper", "ms": "Mark Scheme",
    "s24": "May/Jun 2024", "w23": "Oct/Nov 2023", "s23": "May/Jun 2023",
    "w22": "Oct/Nov 2022", "s22": "May/Jun 2022", "s21": "May/Jun 2021", "w21": "Oct/Nov 2021",
    "m23": "Feb/Mar 2023",
}

def friendly_name(filename, subject_name):
    parts = filename.replace(".pdf", "").split("_")
    session = PAPER_NAMES.get(parts[1], parts[1])
    ptype = PAPER_NAMES.get(parts[2], parts[2])
    paper_num = parts[3] if len(parts) > 3 else ""
    return f"{subject_name} {ptype} P{paper_num} {session}"


async def run():
    # First clear resources that have URLs (from previous populate) and replace with downloaded files
    resources_with_urls = await db.lms_resources.find(
        {"url": {"$ne": "", "$exists": True, "$ne": None}, "file_ids": {"$size": 0}, "resource_type": "past_paper"},
        {"_id": 0, "resource_id": 1, "title": 1, "url": 1, "teacher_id": 1, "subject_name": 1}
    ).to_list(2000)
    
    logger.info(f"Found {len(resources_with_urls)} past paper resources to download")
    
    downloaded = 0
    failed = 0
    
    # Group by subject code to avoid duplicate downloads
    code_cache = {}  # filename -> (file_id, size)
    
    for i, res in enumerate(resources_with_urls):
        subj = res.get("subject_name", "")
        code = SUBJECT_CODES.get(subj)
        if not code or code not in PAPERS:
            failed += 1
            continue
        
        # Find matching paper filename from the URL
        url = res.get("url", "")
        filename = url.split("/")[-1] if url else ""
        
        if not filename or not filename.endswith(".pdf"):
            failed += 1
            continue
        
        # Check cache
        if filename in code_cache:
            file_id = code_cache[filename]
            await db.lms_resources.update_one(
                {"resource_id": res["resource_id"]},
                {"$set": {"file_ids": [file_id], "url": ""}}
            )
            downloaded += 1
            continue
        
        # Download from papacambridge
        dl_url = f"{BASE}/{filename}"
        try:
            resp = requests.get(dl_url, timeout=20, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            if resp.status_code != 200 or len(resp.content) < 500:
                logger.warning(f"  [{i+1}] Failed {resp.status_code} - {filename}")
                failed += 1
                continue
            
            data = resp.content
            file_id = str(uuid.uuid4())
            storage_path = f"{APP_NAME}/resources/{res['teacher_id']}/{file_id}_{filename}"
            
            put_object(storage_path, data, "application/pdf")
            
            await db.file_assets.insert_one({
                "file_id": file_id, "storage_path": storage_path,
                "original_filename": filename, "content_type": "application/pdf",
                "size_bytes": len(data), "owner_user_id": res["teacher_id"],
                "is_deleted": False, "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            await db.lms_resources.update_one(
                {"resource_id": res["resource_id"]},
                {"$set": {"file_ids": [file_id], "url": ""}}
            )
            
            code_cache[filename] = file_id
            downloaded += 1
            
            if downloaded % 5 == 0:
                logger.info(f"  Progress: {downloaded}/{len(resources_with_urls)} downloaded")
                
        except Exception as e:
            logger.warning(f"  [{i+1}] Error: {e}")
            failed += 1
    
    logger.info(f"\nDone! Downloaded: {downloaded}, Failed: {failed}")
    total_with_files = await db.lms_resources.count_documents({"file_ids": {"$ne": []}})
    logger.info(f"Total resources with PDF files: {total_with_files}")

asyncio.run(run())
