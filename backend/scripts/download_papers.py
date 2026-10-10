"""Download Cambridge past papers from public sources and upload to object storage."""
import requests, os, uuid, time
from storage import put_object, init_storage, APP_NAME
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
init_storage()
client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

# Subject configs: code, name, papers to download, teacher subject keywords
SUBJECTS = [
    {"code": "0580", "name": "IGCSE Mathematics", "slug": "mathematics-0580", "papers": ["21","22","41","42"], "teacher_subjects": ["Mathematics","Extended Mathematics"]},
    {"code": "0606", "name": "IGCSE Additional Mathematics", "slug": "mathematics-additional-0606", "papers": ["11","12","21","22"], "teacher_subjects": ["Additional Mathematics","Extended Mathematics"]},
    {"code": "0610", "name": "IGCSE Biology", "slug": "biology-0610", "papers": ["21","22","41","42"], "teacher_subjects": ["Biology"]},
    {"code": "0620", "name": "IGCSE Chemistry", "slug": "chemistry-0620", "papers": ["21","22","41","42"], "teacher_subjects": ["Chemistry"]},
    {"code": "0625", "name": "IGCSE Physics", "slug": "physics-0625", "papers": ["21","22","41","42"], "teacher_subjects": ["Physics"]},
    {"code": "0654", "name": "IGCSE Co-ordinated Sciences", "slug": "co-ordinated-sciences-double-0654", "papers": ["21","22","41","42"], "teacher_subjects": ["Coordinated Science"]},
    {"code": "0455", "name": "IGCSE Economics", "slug": "economics-0455", "papers": ["11","12","21","22"], "teacher_subjects": ["Economics"]},
    {"code": "0452", "name": "IGCSE Accounting", "slug": "accounting-0452", "papers": ["11","12","21","22"], "teacher_subjects": ["Accounting"]},
    {"code": "0450", "name": "IGCSE Business Studies", "slug": "business-studies-0450", "papers": ["11","12","21","22"], "teacher_subjects": ["Business Studies"]},
    {"code": "0500", "name": "IGCSE English First Language", "slug": "first-language-english-0500", "papers": ["11","12","21","22"], "teacher_subjects": ["English Language"]},
    {"code": "0520", "name": "IGCSE French", "slug": "french-foreign-language-0520", "papers": ["11","12","21","22","41","42"], "teacher_subjects": ["French"]},
    {"code": "0478", "name": "IGCSE Computer Science", "slug": "computer-science-0478", "papers": ["11","12","21","22"], "teacher_subjects": ["ICT"]},
    {"code": "0460", "name": "IGCSE Geography", "slug": "geography-0460", "papers": ["11","12","21","22"], "teacher_subjects": ["Geography"]},
    {"code": "9709", "name": "AS & A Level Mathematics", "slug": "mathematics-9709", "level": "a-level", "papers": ["11","12","31","32","51","52"], "teacher_subjects": ["Mathematics","Extended Mathematics","Additional Mathematics"]},
    {"code": "9700", "name": "AS & A Level Biology", "slug": "biology-9700", "level": "a-level", "papers": ["11","12","21","22"], "teacher_subjects": ["Biology"]},
    {"code": "9701", "name": "AS & A Level Chemistry", "slug": "chemistry-9701", "level": "a-level", "papers": ["11","12","21","22"], "teacher_subjects": ["Chemistry"]},
    {"code": "9702", "name": "AS & A Level Physics", "slug": "physics-9702", "level": "a-level", "papers": ["11","12","21","22"], "teacher_subjects": ["Physics"]},
    {"code": "9708", "name": "AS & A Level Economics", "slug": "economics-9708", "level": "a-level", "papers": ["11","12","21","22"], "teacher_subjects": ["Economics"]},
    {"code": "9706", "name": "AS & A Level Accounting", "slug": "accounting-9706", "level": "a-level", "papers": ["11","12","21","22"], "teacher_subjects": ["Accounting"]},
]

SESSIONS = [("s", "Jun"), ("w", "Nov")]
YEARS = ["24", "23", "22", "21", "20", "19"]

# Base URLs to try
BASES = [
    "https://pastpapers.papacambridge.com/papers/caie/{slug}/{year}/{session}/{code}_{s}{yr}_qp_{paper}.pdf",
]

teachers = list(db.users.find({"role": "Teacher"}, {"_id": 0}))
total_downloaded = 0
subject_counts = {}

for subj in SUBJECTS:
    count = 0
    target = 30
    code = subj["code"]
    name = subj["name"]
    slug = subj["slug"]
    papers = subj["papers"]
    level = subj.get("level", "igcse")
    
    print(f"\n=== {name} ({code}) ===")
    
    for yr in YEARS:
        if count >= target:
            break
        year_full = f"20{yr}"
        for sess_code, sess_name in SESSIONS:
            if count >= target:
                break
            for paper in papers:
                if count >= target:
                    break
                filename = f"{code}_{sess_code}{yr}_qp_{paper}.pdf"
                title = f"{name} {sess_name} {year_full} Paper {paper[0]} v{paper[1]}"
                
                # Check if already exists
                if db.file_assets.find_one({"original_filename": filename}):
                    count += 1
                    continue
                
                # Try downloading from papacambridge
                if level == "a-level":
                    url = f"https://pastpapers.papacambridge.com/papers/caie/as-and-a-level-{slug}/{year_full}/{sess_name}/{filename}"
                else:
                    url = f"https://pastpapers.papacambridge.com/papers/caie/igcse-{slug}/{year_full}/{sess_name}/{filename}"
                
                try:
                    resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
                    if resp.status_code == 200 and resp.content[:5] == b'%PDF-' and len(resp.content) > 3000:
                        file_id = str(uuid.uuid4())
                        path = f"{APP_NAME}/pastpapers/{code}/{file_id}_{filename}"
                        put_object(path, resp.content, "application/pdf")
                        db.file_assets.insert_one({
                            "file_id": file_id, "storage_path": path,
                            "original_filename": filename, "content_type": "application/pdf",
                            "size_bytes": len(resp.content), "owner_user_id": "system",
                            "is_deleted": False, "past_paper_subject": code,
                            "past_paper_title": title,
                            "created_at": "2026-02-27T00:00:00+00:00"
                        })
                        count += 1
                        total_downloaded += 1
                        print(f"  [{count}/{target}] {filename} ({len(resp.content)//1024}KB)")
                    else:
                        pass  # Silent skip
                except:
                    pass
                
                # Also try mark scheme
                if count < target:
                    ms_filename = filename.replace("_qp_", "_ms_")
                    ms_title = title.replace("Paper", "Mark Scheme Paper")
                    if db.file_assets.find_one({"original_filename": ms_filename}):
                        count += 1
                        continue
                    ms_url = url.replace("_qp_", "_ms_")
                    try:
                        resp = requests.get(ms_url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
                        if resp.status_code == 200 and resp.content[:5] == b'%PDF-' and len(resp.content) > 1000:
                            file_id = str(uuid.uuid4())
                            path = f"{APP_NAME}/pastpapers/{code}/{file_id}_{ms_filename}"
                            put_object(path, resp.content, "application/pdf")
                            db.file_assets.insert_one({
                                "file_id": file_id, "storage_path": path,
                                "original_filename": ms_filename, "content_type": "application/pdf",
                                "size_bytes": len(resp.content), "owner_user_id": "system",
                                "is_deleted": False, "past_paper_subject": code,
                                "past_paper_title": ms_title,
                                "created_at": "2026-02-27T00:00:00+00:00"
                            })
                            count += 1
                            total_downloaded += 1
                            print(f"  [{count}/{target}] {ms_filename} ({len(resp.content)//1024}KB)")
                    except:
                        pass
    
    subject_counts[name] = count
    print(f"  Total for {name}: {count}")
    
    # Link to teachers
    paper_files = list(db.file_assets.find({"past_paper_subject": code}, {"_id": 0, "file_id": 1, "past_paper_title": 1}))
    for t in teachers:
        if not any(s in t.get("teaching_subjects", []) for s in subj["teacher_subjects"]):
            continue
        for pf in paper_files:
            existing = db.lms_resources.find_one({"teacher_id": t["user_id"], "file_ids": pf["file_id"]})
            if not existing:
                db.lms_resources.insert_one({
                    "resource_id": f"res_{uuid.uuid4().hex[:12]}",
                    "title": pf["past_paper_title"],
                    "description": f"Cambridge {name} past paper - viewable in app",
                    "resource_type": "past_paper", "subject_id": "", "class_id": "",
                    "term": "", "file_ids": [pf["file_id"]], "content_url": "", "content_text": "",
                    "teacher_id": t["user_id"], "created_at": "2026-02-27T00:00:00+00:00"
                })

print(f"\n{'='*50}")
print(f"TOTAL DOWNLOADED: {total_downloaded}")
print(f"\nPer subject:")
for name, count in subject_counts.items():
    print(f"  {name}: {count}")

client.close()
