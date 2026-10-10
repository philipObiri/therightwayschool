import asyncio, os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    kayla = await db.users.find_one({"email": "student@rightway.demo"}, {"_id": 0, "name": 1, "class_id": 1, "subject_ids": 1})
    n_subj = len(kayla.get("subject_ids", []))
    class_id = kayla.get("class_id", "")
    print(f"Kayla: {kayla['name']} | class_id: {class_id} | subject_ids count: {n_subj}")

    lessons = await db.lessons.find(
        {"published": True, "class_ids": class_id, "_demo": True},
        {"_id": 0, "title": 1, "subject_name": 1}
    ).to_list(20)
    print(f"\nLessons in db.lessons for Year 7A ({len(lessons)}):")
    for l in lessons:
        print(f"  [{l.get('subject_name')}] {l['title']}")

    resources = await db.lms_resources.find(
        {"published": True, "published_class_ids": class_id, "_demo": True},
        {"_id": 0, "title": 1, "resource_type": 1}
    ).to_list(30)
    print(f"\nResources in db.lms_resources for Year 7A ({len(resources)}):")
    for r in resources:
        print(f"  [{r.get('resource_type')}] {r['title']}")

    client.close()

asyncio.run(check())
