"""
clear_demo_data.py — Safely wipes ALL demo data inserted by seed_demo_data.py.

Only deletes documents tagged  _demo: True  — will NEVER touch real data.
Also reverts the field changes made to the 10 demo user accounts.

Run from the backend/ directory:
    python scripts/clear_demo_data.py
"""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

# Collections that may contain _demo: True documents
DEMO_COLLECTIONS = [
    "subjects",
    "classes",
    "timetable",
    "lessons",          # student LMS (seeded by _fix_lessons_resources.py)
    "lessons_v2",       # teacher lessons hub
    "lms_resources",    # student resources (worksheets, syllabi, past papers)
    "assignments",
    "submissions",
    "gradebook_entries",
    "attendance",
    "announcements",
    "invoices_v2",
    "invoice_line_items",
    "allocations",
    "student_accounts",
    "clock_entries",
    "behaviour_incidents",
    "quizzes",
    "quiz_attempts",
    "app_settings",
]

# Fields added to the 10 core demo user accounts (not deleted — only unset)
DEMO_USER_FIELDS = [
    "class_id", "class_name", "year_group", "admission_number",
    "date_of_birth", "boarding_status", "subjects",
    "teaching_subjects", "assigned_year_groups", "department",
    "children_ids", "children_names",
    "_demo_updated",
]

DEMO_EMAILS = [
    "teacher@rightway.demo",
    "student@rightway.demo",
    "parent@rightway.demo",
    "headteacher@rightway.demo",
    "principal@rightway.demo",
    "superadmin@rightway.demo",
    "admin@rightway.demo",
    "finance@rightway.demo",
    "hr@rightway.demo",
    "ceo@rightway.demo",
]


async def clear_collections():
    total_deleted = 0
    for col_name in DEMO_COLLECTIONS:
        col = db[col_name]
        result = await col.delete_many({"_demo": True})
        if result.deleted_count > 0:
            print(f"  ✓ {col_name:<25} — deleted {result.deleted_count} demo documents")
            total_deleted += result.deleted_count
        else:
            print(f"  · {col_name:<25} — nothing to delete")
    return total_deleted


async def revert_demo_users():
    """Unset fields that were added to demo accounts, restore Kayla → original name."""
    unset_payload = {f: "" for f in DEMO_USER_FIELDS}

    updated = 0
    for email in DEMO_EMAILS:
        result = await db.users.update_one(
            {"email": email, "_demo_updated": True},
            {"$unset": unset_payload}
        )
        if result.modified_count:
            updated += 1

    # Restore student demo account name to the original placeholder name
    await db.users.update_one(
        {"email": "student@rightway.demo"},
        {"$set": {"name": "Demo Student"}}
    )

    print(f"  ✓ demo user accounts — reverted {updated} accounts, student name reset")


async def delete_classmate_users():
    """Delete the 15 Trinidad-named classmate user accounts (tagged _demo: True)."""
    result = await db.users.delete_many({"_demo": True, "role": "Student"})
    if result.deleted_count:
        print(f"  ✓ classmate users — deleted {result.deleted_count} demo student accounts")
    else:
        print("  · classmate users — none found")


async def main():
    print("\n🗑️  Clearing demo data from RightWay database...\n")

    print("── Collections ──────────────────────────────────────────")
    total = await clear_collections()

    print("\n── Demo user accounts ───────────────────────────────────")
    await delete_classmate_users()
    await revert_demo_users()

    print(f"\n✅  Done. {total} demo documents deleted, user accounts reverted.")
    print("   The 10 demo user logins still exist and are fully usable.\n")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
