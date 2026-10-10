"""Replace timetable data for Year 7, 8, 9, 11, 12 from uploaded PDFs."""
import asyncio, os, uuid
from dotenv import load_dotenv
load_dotenv()
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
db = client[os.environ.get("DB_NAME", "tcis_workstation")]

def gen_id():
    return "tt_" + uuid.uuid4().hex[:12]

# Single-letter codes are break/lunch periods - skip them
SKIP_SUBJECTS = {"S", "N", "U", "A", "C", "K", "H", "L", "", "BREAKFAST", "INSPECTION"}

YEAR_7 = [
    ("Monday", "8:00", "8:40", "MATH"),
    ("Monday", "8:40", "9:20", "MATH"),
    ("Monday", "9:20", "10:00", "FRENCH"),
    ("Monday", "10:00", "10:40", "FRENCH"),
    ("Monday", "11:05", "11:45", "ENGLISH"),
    ("Monday", "11:45", "12:25", "ENGLISH"),
    ("Monday", "1:05", "1:45", "ICT"),
    ("Monday", "1:45", "2:25", "ICT"),
    ("Monday", "2:25", "3:05", "COMBINED SCIENCE"),
    ("Monday", "3:05", "3:45", "COMBINED SCIENCE"),
    ("Tuesday", "8:00", "8:40", "ENGLISH"),
    ("Tuesday", "8:40", "9:20", "ENGLISH"),
    ("Tuesday", "9:20", "10:00", "COMBINED SCIENCE"),
    ("Tuesday", "10:00", "10:40", "COMBINED SCIENCE"),
    ("Tuesday", "11:05", "11:45", "FRENCH"),
    ("Tuesday", "11:45", "12:25", "FRENCH"),
    ("Tuesday", "12:25", "1:05", "MATH"),
    ("Tuesday", "1:45", "2:25", "MATH"),
    ("Tuesday", "2:25", "3:05", "LITERATURE"),
    ("Tuesday", "3:05", "3:45", "LITERATURE"),
    ("Wednesday", "8:00", "8:40", "WORSHIP"),
    ("Wednesday", "8:40", "9:20", "WORSHIP"),
    ("Wednesday", "9:20", "10:00", "FRENCH"),
    ("Wednesday", "10:00", "10:40", "FRENCH"),
    ("Wednesday", "11:05", "11:45", "CHRISTIAN DOCTRINE"),
    ("Wednesday", "11:45", "12:25", "CHRISTIAN DOCTRINE"),
    ("Wednesday", "12:25", "1:05", "LIBRARY"),
    ("Wednesday", "1:45", "2:25", "LIBRARY"),
    ("Wednesday", "2:25", "3:05", "P.E"),
    ("Wednesday", "3:05", "3:45", "P.E"),
    ("Thursday", "8:00", "8:40", "LITERATURE"),
    ("Thursday", "8:40", "9:20", "LITERATURE"),
    ("Thursday", "9:20", "10:00", "ARTS AND CRAFT"),
    ("Thursday", "10:00", "10:40", "ARTS AND CRAFT"),
    ("Thursday", "11:05", "11:45", "GLOBAL PERSPECTIVE"),
    ("Thursday", "11:45", "12:25", "GLOBAL PERSPECTIVE"),
    ("Thursday", "12:25", "1:05", "ENGLISH"),
    ("Thursday", "1:45", "2:25", "ENGLISH"),
    ("Thursday", "2:25", "3:05", "ICT"),
    ("Thursday", "3:05", "3:45", "ICT"),
    ("Friday", "8:00", "8:40", "COMBINED SCIENCE"),
    ("Friday", "8:40", "9:20", "COMBINED SCIENCE"),
    ("Friday", "9:20", "10:00", "MATHS"),
    ("Friday", "10:00", "10:40", "MATHS"),
    ("Friday", "11:05", "11:45", "ARTS AND CRAFT"),
    ("Friday", "11:45", "12:25", "ARTS AND CRAFT"),
    ("Friday", "12:25", "1:05", "GLOBAL PERSPECTIVE"),
    ("Friday", "1:45", "2:25", "GLOBAL PERSPECTIVE"),
    ("Friday", "2:25", "3:05", "P.E"),
    ("Friday", "3:05", "3:45", "P.E"),
]

YEAR_8 = [
    ("Monday", "8:00", "8:40", "COMBINED SCIENCE"),
    ("Monday", "8:40", "9:20", "COMBINED SCIENCE"),
    ("Monday", "9:20", "10:00", "MATH"),
    ("Monday", "10:00", "10:40", "MATH"),
    ("Monday", "11:05", "11:45", "FRENCH"),
    ("Monday", "11:45", "12:25", "FRENCH"),
    ("Monday", "12:25", "1:05", "ARTS AND CRAFT"),
    ("Monday", "1:45", "2:25", "ARTS AND CRAFT"),
    ("Monday", "2:25", "3:05", "GLOBAL PERSPECTIVE"),
    ("Monday", "3:05", "3:45", "GLOBAL PERSPECTIVE"),
    ("Tuesday", "8:00", "8:40", "GLOBAL PERSPECTIVE"),
    ("Tuesday", "8:40", "9:20", "GLOBAL PERSPECTIVE"),
    ("Tuesday", "9:20", "10:00", "FRENCH"),
    ("Tuesday", "10:00", "10:40", "FRENCH"),
    ("Tuesday", "11:05", "11:45", "COMBINED SCIENCE"),
    ("Tuesday", "11:45", "12:25", "COMBINED SCIENCE"),
    ("Tuesday", "12:25", "1:05", "ENGLISH"),
    ("Tuesday", "1:45", "2:25", "ENGLISH"),
    ("Tuesday", "2:25", "3:05", "ICT"),
    ("Tuesday", "3:05", "3:45", "ICT"),
    ("Wednesday", "8:00", "8:40", "WORSHIP"),
    ("Wednesday", "8:40", "9:20", "WORSHIP"),
    ("Wednesday", "9:20", "10:00", "ENGLISH"),
    ("Wednesday", "10:00", "10:40", "ENGLISH"),
    ("Wednesday", "11:05", "11:45", "COMBINED SCIENCE"),
    ("Wednesday", "11:45", "12:25", "COMBINED SCIENCE"),
    ("Wednesday", "12:25", "1:05", "FRENCH"),
    ("Wednesday", "1:45", "2:25", "FRENCH"),
    ("Wednesday", "2:25", "3:05", "PE"),
    ("Wednesday", "3:05", "3:45", "PE"),
    ("Thursday", "8:00", "8:40", "MATH"),
    ("Thursday", "8:40", "9:20", "MATH"),
    ("Thursday", "9:20", "10:00", "LITERATURE"),
    ("Thursday", "10:00", "10:40", "LITERATURE"),
    ("Thursday", "11:05", "11:45", "LIBRARY"),
    ("Thursday", "11:45", "12:25", "LIBRARY"),
    ("Thursday", "12:25", "1:05", "ARTS AND CRAFT"),
    ("Thursday", "1:45", "2:25", "ARTS AND CRAFT"),
    ("Thursday", "2:25", "3:05", "CHRISTIAN DOCTRINE"),
    ("Thursday", "3:05", "3:45", "CHRISTIAN DOCTRINE"),
    ("Friday", "8:00", "8:40", "ENGLISH"),
    ("Friday", "8:40", "9:20", "ENGLISH"),
    ("Friday", "9:20", "10:00", "LITERATURE"),
    ("Friday", "10:00", "10:40", "LITERATURE"),
    ("Friday", "11:05", "11:45", "MATH"),
    ("Friday", "11:45", "12:25", "MATH"),
    ("Friday", "12:25", "1:05", "ICT"),
    ("Friday", "1:45", "2:25", "ICT"),
    ("Friday", "2:25", "3:05", "PE"),
    ("Friday", "3:05", "3:45", "PE"),
]

YEAR_9 = [
    ("Monday", "8:40", "9:20", "ICT"),
    ("Monday", "9:20", "10:00", "ICT"),
    ("Monday", "10:00", "10:40", "ECONOMICS"),
    ("Monday", "10:40", "11:05", "ECONOMICS"),
    ("Monday", "11:05", "11:45", "COMBINED SCIENCE (BIO)"),
    ("Monday", "11:45", "12:25", "COMBINED SCIENCE (BIO)"),
    ("Monday", "12:25", "1:05", "CHRISTIAN DOCTRINE"),
    ("Monday", "1:05", "1:45", "CHRISTIAN DOCTRINE"),
    ("Monday", "1:45", "2:25", "FRENCH"),
    ("Monday", "2:25", "3:05", "FRENCH"),
    ("Tuesday", "8:40", "9:20", "ICT"),
    ("Tuesday", "9:20", "10:00", "ICT"),
    ("Tuesday", "10:00", "10:40", "MATH"),
    ("Tuesday", "10:40", "11:05", "MATH"),
    ("Tuesday", "11:05", "11:45", "ENGLISH"),
    ("Tuesday", "11:45", "12:25", "ENGLISH"),
    ("Tuesday", "12:25", "1:05", "BUSINESS"),
    ("Tuesday", "1:45", "2:25", "LIBRARY"),
    ("Tuesday", "2:25", "3:05", "ECONOMICS"),
    ("Tuesday", "3:05", "3:45", "ECONOMICS"),
    ("Wednesday", "8:00", "8:40", "WORSHIP"),
    ("Wednesday", "8:40", "9:20", "WORSHIP"),
    ("Wednesday", "9:20", "10:00", "MATH"),
    ("Wednesday", "10:00", "10:40", "MATH"),
    ("Wednesday", "11:05", "11:45", "ENGLISH"),
    ("Wednesday", "11:45", "12:25", "ENGLISH"),
    ("Wednesday", "12:25", "1:05", "LITERATURE"),
    ("Thursday", "8:00", "8:40", "GLOBAL PERSPECTIVE"),
    ("Thursday", "8:40", "9:20", "GLOBAL PERSPECTIVE"),
    ("Thursday", "9:20", "10:00", "COMBINED SCIENCE (PHY)"),
    ("Thursday", "10:00", "10:40", "COMBINED SCIENCE (PHY)"),
    ("Thursday", "11:05", "11:45", "FRENCH"),
    ("Thursday", "11:45", "12:25", "FRENCH"),
    ("Thursday", "12:25", "1:05", "CHRISTIAN DOCTRINE"),
    ("Thursday", "1:45", "2:25", "CHRISTIAN DOCTRINE"),
    ("Thursday", "2:25", "3:05", "ARTS AND CRAFT"),
    ("Thursday", "3:05", "3:45", "ARTS AND CRAFT"),
    ("Friday", "8:00", "8:40", "BUSINESS STUDIES"),
    ("Friday", "8:40", "9:20", "BUSINESS STUDIES"),
    ("Friday", "9:20", "10:00", "ACCOUNTING"),
    ("Friday", "10:00", "10:40", "ACCOUNTING"),
    ("Friday", "11:05", "11:45", "COMBINED SCIENCE (CHEM)"),
    ("Friday", "11:45", "12:25", "COMBINED SCIENCE (CHEM)"),
    ("Friday", "12:25", "1:05", "LITERATURE"),
    ("Friday", "1:45", "2:25", "LITERATURE"),
    ("Friday", "2:25", "3:05", "PE"),
    ("Friday", "3:05", "3:45", "PE"),
]

YEAR_11 = [
    ("Monday", "8:00", "8:40", "FRENCH"),
    ("Monday", "8:40", "9:20", "FRENCH"),
    ("Monday", "9:20", "10:00", "ICT"),
    ("Monday", "10:00", "10:40", "ICT"),
    ("Monday", "11:05", "11:45", "BUSINESS STUDIES"),
    ("Monday", "11:45", "12:25", "EXTENDED MATH"),
    ("Monday", "1:05", "1:45", "ENGLISH"),
    ("Monday", "1:45", "2:25", "PHYSICS / COORDINATED SCIENCE (PHY)"),
    ("Monday", "2:25", "3:05", "PHYSICS / COORDINATED SCIENCE (PHY)"),
    ("Tuesday", "8:00", "8:40", "FRENCH"),
    ("Tuesday", "8:40", "9:20", "FRENCH"),
    ("Tuesday", "9:20", "10:00", "BUSINESS STUDIES"),
    ("Tuesday", "10:00", "10:40", "ADD MATH / LITERATURE"),
    ("Tuesday", "11:05", "11:45", "ADD MATH / LITERATURE"),
    ("Tuesday", "11:45", "12:25", "BIOLOGY / HISTORY"),
    ("Tuesday", "12:25", "1:05", "BIOLOGY / HISTORY"),
    ("Tuesday", "1:45", "2:25", "SOCIOLOGY"),
    ("Tuesday", "2:25", "3:05", "ENGLISH"),
    ("Tuesday", "3:05", "3:45", "PHYSICS / HISTORY"),
    ("Wednesday", "8:00", "8:40", "WORSHIP"),
    ("Wednesday", "8:40", "9:20", "WORSHIP"),
    ("Wednesday", "9:20", "10:00", "CHEMISTRY / COORDINATED SCIENCE (CHEM)"),
    ("Wednesday", "10:00", "10:40", "CHEMISTRY / COORDINATED SCIENCE (CHEM)"),
    ("Wednesday", "11:05", "11:45", "LITERATURE"),
    ("Wednesday", "11:45", "12:25", "LITERATURE"),
    ("Wednesday", "12:25", "1:05", "GEOGRAPHY / ACCOUNTING"),
    ("Wednesday", "1:45", "2:25", "GEOGRAPHY / ACCOUNTING"),
    ("Wednesday", "2:25", "3:05", "ICT"),
    ("Wednesday", "3:05", "3:45", "ICT"),
    ("Thursday", "8:00", "8:40", "EXTENDED MATHS"),
    ("Thursday", "8:40", "9:20", "EXTENDED MATHS"),
    ("Thursday", "9:20", "10:00", "ECONOMICS"),
    ("Thursday", "10:00", "10:40", "ECONOMICS"),
    ("Thursday", "11:05", "11:45", "PHYSICS"),
    ("Thursday", "11:45", "12:25", "ACCOUNTING / SOCIOLOGY"),
    ("Thursday", "12:25", "1:05", "ENGLISH"),
    ("Thursday", "1:05", "1:45", "ENGLISH"),
    ("Thursday", "1:45", "2:25", "BUSINESS STUDIES / CHEMISTRY"),
    ("Thursday", "2:25", "3:05", "BUSINESS STUDIES / CHEMISTRY"),
    ("Friday", "8:00", "8:40", "SOCIOLOGY / ADD MATH"),
    ("Friday", "8:40", "9:20", "SOCIOLOGY / ADD MATH"),
    ("Friday", "9:20", "10:00", "BIOLOGY / COORDINATED SCIENCE (BIO)"),
    ("Friday", "10:00", "10:40", "BIOLOGY / COORDINATED SCIENCE (BIO)"),
    ("Friday", "11:05", "11:45", "ECONOMICS"),
    ("Friday", "11:45", "12:25", "ECONOMICS"),
    ("Friday", "1:05", "1:45", "GEOGRAPHY / HISTORY"),
    ("Friday", "1:45", "2:25", "GEOGRAPHY / HISTORY"),
    ("Friday", "2:25", "3:05", "CLUB ACTIVITY"),
    ("Friday", "3:05", "3:45", "CLUB ACTIVITY"),
]

YEAR_12 = [
    ("Monday", "8:40", "9:20", "ENGLISH LANGUAGE / CHEMISTRY / ACCOUNTING"),
    ("Monday", "9:20", "10:00", "ENGLISH LANGUAGE / CHEMISTRY / ACCOUNTING"),
    ("Monday", "10:00", "10:40", "BIOLOGY / BUSINESS STUDIES"),
    ("Monday", "10:40", "11:05", "BIOLOGY / BUSINESS STUDIES"),
    ("Monday", "11:05", "11:45", "CHEMISTRY / FRENCH LANGUAGE / HISTORY"),
    ("Monday", "11:45", "12:25", "FRENCH LANGUAGE / HISTORY"),
    ("Monday", "12:25", "1:05", "PHYSICS / HISTORY"),
    ("Monday", "1:45", "2:25", "PHYSICS / HISTORY"),
    ("Monday", "2:25", "3:05", "PURE MATHS 1 / ECONOMICS / LITERATURE"),
    ("Monday", "3:05", "3:45", "PURE MATHS 1 / ECONOMICS"),
    ("Tuesday", "8:00", "8:40", "PHYSICS / LITERATURE / ACCOUNTING"),
    ("Tuesday", "8:40", "9:20", "PHYSICS / LITERATURE"),
    ("Tuesday", "9:20", "10:00", "CHEMISTRY / HISTORY"),
    ("Tuesday", "10:00", "10:40", "INFORMATION TECHNOLOGY"),
    ("Tuesday", "11:05", "11:45", "BUSINESS STUDIES / MECHANICS"),
    ("Tuesday", "11:45", "12:25", "BUSINESS STUDIES / MECHANICS"),
    ("Tuesday", "12:25", "1:05", "SOCIOLOGY / STATISTICS"),
    ("Tuesday", "1:45", "2:25", "STATISTICS / SOCIOLOGY"),
    ("Tuesday", "2:25", "3:05", "FRENCH"),
    ("Tuesday", "3:05", "3:45", "FRENCH"),
    ("Wednesday", "8:40", "9:20", "WORSHIP"),
    ("Wednesday", "9:20", "10:00", "WORSHIP"),
    ("Wednesday", "10:00", "10:40", "PURE MATHS 3 / ENGLISH LANGUAGE"),
    ("Wednesday", "10:40", "11:05", "PURE MATHS 3 / ENGLISH LANGUAGE"),
    ("Wednesday", "11:05", "11:45", "BIOLOGY / GEOGRAPHY / ACCOUNTING"),
    ("Wednesday", "11:45", "12:25", "BIOLOGY / GEOGRAPHY / ACCOUNTING"),
    ("Wednesday", "12:25", "1:05", "LITERATURE / STATISTICS"),
    ("Wednesday", "1:45", "2:25", "LITERATURE / STATISTICS"),
    ("Wednesday", "2:25", "3:05", "ECONOMICS / FRENCH"),
    ("Wednesday", "3:05", "3:45", "MECHANICS / ECONOMICS / FRENCH"),
    ("Thursday", "8:00", "8:40", "PHYSICS / FRENCH LANGUAGE / HISTORY"),
    ("Thursday", "8:40", "9:20", "PHYSICS / FRENCH LANGUAGE / HISTORY"),
    ("Thursday", "9:20", "10:00", "BUSINESS STUDIES"),
    ("Thursday", "10:00", "10:40", "BUSINESS STUDIES"),
    ("Thursday", "11:05", "11:45", "LITERATURE / INFORMATION TECHNOLOGY"),
    ("Thursday", "11:45", "12:25", "LITERATURE / INFORMATION TECHNOLOGY"),
    ("Thursday", "12:25", "1:05", "MECHANICS"),
    ("Thursday", "1:45", "2:25", "MECHANICS / SOCIOLOGY"),
    ("Thursday", "2:25", "3:05", "GEOGRAPHY / ENGLISH LANGUAGE / PURE MATHS 1"),
    ("Thursday", "3:05", "3:45", "GEOGRAPHY / ENGLISH LANGUAGE / PURE MATHS 1"),
    ("Friday", "8:00", "8:40", "CHEMISTRY / HISTORY / GEOGRAPHY"),
    ("Friday", "8:40", "9:20", "CHEMISTRY / HISTORY / GEOGRAPHY"),
    ("Friday", "9:20", "10:00", "PURE MATHS 3 / SOCIOLOGY"),
    ("Friday", "10:00", "10:40", "PURE MATHS 3 / SOCIOLOGY"),
    ("Friday", "11:05", "11:45", "INFORMATION TECHNOLOGY"),
    ("Friday", "11:45", "12:25", "INFORMATION TECHNOLOGY"),
    ("Friday", "12:25", "1:05", "ECONOMICS / BIOLOGY"),
    ("Friday", "1:45", "2:25", "ECONOMICS / BIOLOGY"),
    ("Friday", "2:25", "3:05", "CLUB ACTIVITY"),
    ("Friday", "3:05", "3:45", "CLUB ACTIVITY"),
]


async def populate_all():
    year_data = {
        "Year 7": YEAR_7,
        "Year 8": YEAR_8,
        "Year 9": YEAR_9,
        "Year 11": YEAR_11,
        "Year 12": YEAR_12,
    }

    total_deleted = 0
    total_inserted = 0

    for year_group, entries_data in year_data.items():
        # Delete existing entries for this year group
        result = await db.timetable_v2.delete_many({"year_group": year_group})
        total_deleted += result.deleted_count
        print(f"  Deleted {result.deleted_count} old entries for {year_group}")

        # Insert new entries
        docs = []
        for day, start, end, subject in entries_data:
            subject = subject.strip()
            if subject in SKIP_SUBJECTS or len(subject) <= 1:
                continue
            docs.append({
                "entry_id": gen_id(),
                "year_group": year_group,
                "day": day,
                "start_time": start,
                "end_time": end,
                "subject": subject,
            })

        if docs:
            await db.timetable_v2.insert_many(docs)
        total_inserted += len(docs)
        print(f"  Inserted {len(docs)} new entries for {year_group}")

    print(f"\nTotal: Deleted {total_deleted}, Inserted {total_inserted}")
    return total_inserted


if __name__ == "__main__":
    asyncio.run(populate_all())
