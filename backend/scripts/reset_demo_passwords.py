"""
reset_demo_passwords.py — Reset all demo account passwords to documented values.
Run from the backend/ directory:
    python scripts/reset_demo_passwords.py

DEVELOPMENT ONLY.
"""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

load_dotenv(Path(__file__).parent.parent / ".env")

if os.environ.get("ENVIRONMENT", "development") == "production":
    sys.exit("ERROR: Must not be run in production.")

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

USERS = [
    {"email": "ceo@rightway.demo",        "password": "ceo123"},
    {"email": "superadmin@rightway.demo",  "password": "superadmin123"},
    {"email": "principal@rightway.demo",   "password": "principal123"},
    {"email": "headteacher@rightway.demo", "password": "headteacher123"},
    {"email": "admin@rightway.demo",       "password": "admin123"},
    {"email": "teacher@rightway.demo",     "password": "teacher123"},
    {"email": "finance@rightway.demo",     "password": "finance123"},
    {"email": "hr@rightway.demo",          "password": "hr123"},
    {"email": "parent@rightway.demo",      "password": "parent123"},
    {"email": "student@rightway.demo",     "password": "student123"},
]

async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    await client.admin.command("ping")
    print(f"\nResetting passwords in database: {os.environ['DB_NAME']}\n")

    for acc in USERS:
        result = await db.users.update_one(
            {"email": acc["email"]},
            {"$set": {
                "password_hash": hash_password(acc["password"]),
                "token_version": 1,
                "password_change_required": False,
                "is_active": True,
            }}
        )
        if result.matched_count:
            print(f"  [reset]  {acc['email']}")
        else:
            print(f"  [miss]   {acc['email']} — not found in DB")

    client.close()
    print("\nAll demo passwords reset successfully.\n")

if __name__ == "__main__":
    asyncio.run(main())
