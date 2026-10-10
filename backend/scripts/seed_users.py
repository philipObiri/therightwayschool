"""
seed_users.py — Seeds one demo user per role into rightway_db.
Run from the backend/ directory:
    python seed_users.py

DEVELOPMENT ONLY — blocked in production (ENVIRONMENT=production).
"""
import asyncio
import os
import sys
import secrets
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

load_dotenv(Path(__file__).parent.parent / ".env")

# Block accidental execution in production
if os.environ.get("ENVIRONMENT", "development") == "production":
    sys.exit("ERROR: seed_users.py must not be run in production. Set ENVIRONMENT=development to seed.")

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

USERS = [
    {"email": "ceo@rightway.demo",        "password": "ceo123",         "name": "Dr. Margaret Thompson", "role": "CEO",           "phone": "+1-868-100-0001"},
    {"email": "superadmin@rightway.demo",  "password": "superadmin123",  "name": "System SuperAdmin",     "role": "SuperAdmin",    "phone": "+1-868-100-0002"},
    {"email": "principal@rightway.demo",   "password": "principal123",   "name": "Ms. Sandra Clarke",     "role": "Principal",     "phone": "+1-868-100-0003"},
    {"email": "headteacher@rightway.demo", "password": "headteacher123", "name": "Mr. Kevin Joseph",      "role": "HeadTeacher",   "phone": "+1-868-100-0004"},
    {"email": "admin@rightway.demo",       "password": "admin123",       "name": "Mrs. Diane Baptiste",   "role": "Admin",         "phone": "+1-868-100-0005"},
    {"email": "teacher@rightway.demo",     "password": "teacher123",     "name": "Mr. Edmund Charles",    "role": "Teacher",       "phone": "+1-868-100-0006"},
    {"email": "finance@rightway.demo",     "password": "finance123",     "name": "Ms. Patricia Ramsay",   "role": "FinanceOfficer","phone": "+1-868-100-0007"},
    {"email": "hr@rightway.demo",          "password": "hr123",          "name": "Mrs. Gloria Phillip",   "role": "HR_Officer",    "phone": "+1-868-100-0008"},
    {"email": "parent@rightway.demo",      "password": "parent123",      "name": "Mr. David Hernandez",   "role": "Parent",        "phone": "+1-868-100-0009"},
    {"email": "student@rightway.demo",     "password": "student123",     "name": "Ayeyi Forson",          "role": "Student",       "phone": "+1-868-100-0010"},
]


async def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    print(f"\nConnecting to MongoDB at {mongo_url}")
    print(f"Database: {db_name}\n")

    await client.admin.command("ping")
    print("MongoDB connection OK\n")

    created = 0
    skipped = 0

    for acc in USERS:
        existing = await db.users.find_one({"email": acc["email"]})
        if existing:
            print(f"  [skip]    {acc['email']}  ({acc['role']}) — already exists")
            skipped += 1
            continue

        doc = {
            "user_id":                "user_" + secrets.token_hex(8),
            "email":                  acc["email"],
            "password_hash":          hash_password(acc["password"]),
            "name":                   acc["name"],
            "role":                   acc["role"],
            "phone":                  acc["phone"],
            "is_active":              True,
            "picture":                None,
            "token_version":          1,
            "password_change_required": True,   # Force change on first login
        }
        await db.users.insert_one(doc)
        # Do NOT print passwords — see documentation/ACCOUNTS.md for credentials
        print(f"  [created] {acc['email']}  ({acc['role']}) - password change required on first login")
        created += 1

    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)

    client.close()

    print(f"\n{'-'*60}")
    print(f"  Done - {created} created, {skipped} skipped")
    print(f"  Database: {db_name}")
    print(f"{'-'*60}")
    print("\n  All seeded accounts require a password change on first login.")
    print("  See documentation/ACCOUNTS.md for credentials (dev only).")
    print(f"  Login at: http://localhost:3000/login\n")


if __name__ == "__main__":
    asyncio.run(main())
