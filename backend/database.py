from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=50,
    minPoolSize=5,
    maxIdleTimeMS=30000,
    connectTimeoutMS=5000,
    serverSelectionTimeoutMS=5000,
)
db = client[os.environ['DB_NAME']]


def get_db():
    """FastAPI dependency that returns the database instance."""
    return db


async def get_active_term():
    """Returns (term, academic_year) from app_settings."""
    setting = await db.app_settings.find_one({"key": "active_term"}, {"_id": 0})
    if setting:
        return setting.get("value", "Term 1"), setting.get("academic_year", "2025-2026")
    return "Term 1", "2025-2026"
