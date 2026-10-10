"""One-off fix: populate subject_ids on student demo user accounts."""
import asyncio, os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    # All 8 demo subjects
    subjects = await db.subjects.find({"_demo": True}, {"_id": 0, "subject_id": 1, "name": 1}).to_list(20)
    subject_ids = [s["subject_id"] for s in subjects]
    print(f"Found {len(subjects)} demo subjects: {[s['name'] for s in subjects]}")

    # Update Kayla (demo student account)
    r = await db.users.update_one(
        {"email": "student@rightway.demo"},
        {"$set": {"subject_ids": subject_ids}}
    )
    print(f"Kayla subject_ids updated: matched={r.matched_count}, modified={r.modified_count}")

    # Update 15 classmate accounts too
    classmates = await db.users.find(
        {"_demo": True, "role": "Student"},
        {"_id": 0, "user_id": 1, "name": 1}
    ).to_list(20)
    for cm in classmates:
        await db.users.update_one({"user_id": cm["user_id"]}, {"$set": {"subject_ids": subject_ids}})
    print(f"Updated {len(classmates)} classmates with subject_ids")

    # Verify
    kayla = await db.users.find_one({"email": "student@rightway.demo"}, {"_id": 0, "name": 1, "subject_ids": 1})
    print(f"\nKayla now has {len(kayla.get('subject_ids', []))} subject_ids: {kayla.get('subject_ids')}")
    client.close()

asyncio.run(fix())
