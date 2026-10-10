import asyncio, os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    users = await db.users.find(
        {"email": {"$regex": "rightway.demo"}},
        {"_id": 0, "user_id": 1, "email": 1, "name": 1, "role": 1}
    ).to_list(20)
    for u in users:
        print(u)
    client.close()

asyncio.run(main())
