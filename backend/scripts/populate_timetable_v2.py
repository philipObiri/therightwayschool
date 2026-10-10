"""Add Year 12 and Year 13 timetables, refresh Year 9-11 from re-uploaded PDFs."""
import asyncio, os, uuid
from dotenv import load_dotenv
load_dotenv()
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
db = client[os.environ.get("DB_NAME", "tcis_workstation")]

def gen_id():
    return "tt_" + uuid.uuid4().hex[:12]

SKIP = {"S", "N", "U", "A", "C", "K", "H", "L", "", "BREAKFAST", "WORSHIP", "INSPECTION"}

def parse_entries(year_group, raw_lines):
    entries = []
    for line in raw_lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split("|")
        day = parts[0].strip().capitalize()
        # Fix day capitalization
        for d in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]:
            if day.upper() == d.upper():
                day = d
                break
        
        if len(parts) == 3:
            time_range = parts[1].strip()
            subject = parts[2].strip()
            if "-" in time_range:
                start, end = time_range.split("-", 1)
                start = start.strip()
                end = end.strip()
            else:
                start, end = time_range.strip(), ""
        elif len(parts) == 4:
            start = parts[1].strip()
            end = parts[2].strip()
            subject = parts[3].strip()
        else:
            continue

        # Clean trailing slashes and whitespace
        subject = subject.strip().rstrip("/").strip()
        
        if subject in SKIP or not subject or len(subject) <= 1:
            continue

        entries.append({
            "entry_id": gen_id(),
            "year_group": year_group,
            "day": day,
            "start_time": start,
            "end_time": end,
            "subject": subject,
        })
    return entries

YEAR_9 = """Monday|8:00|8:40|ICT
Monday|8:40|9:20|ICT
Monday|9:20|10:00|ECONOMICS
Monday|10:00|10:40|ECONOMICS
Monday|11:05|11:45|COMBINED SCIENCE (BIO)
Monday|11:45|12:25|COMBINED SCIENCE (BIO)
Monday|12:25|1:05|CHRISTIAN DOCTRINE
Monday|1:05|1:45|CHRISTIAN DOCTRINE
Monday|1:45|2:25|FRENCH
Monday|2:25|3:05|FRENCH
Tuesday|8:00|8:40|ICT
Tuesday|8:40|9:20|ICT
Tuesday|9:20|10:00|MATH
Tuesday|10:00|10:40|MATH
Tuesday|11:05|11:45|ENGLISH
Tuesday|11:45|12:25|ENGLISH
Tuesday|12:25|1:05|BUSINESS
Tuesday|1:45|2:25|LIBRARY
Tuesday|2:25|3:05|ECONOMICS
Tuesday|3:05|3:45|ECONOMICS
Wednesday|8:00|8:40|WORSHIP
Wednesday|8:40|9:20|WORSHIP
Wednesday|9:20|10:00|MATH
Wednesday|10:00|10:40|MATH
Wednesday|11:05|11:45|ENGLISH
Wednesday|11:45|12:25|ENGLISH
Wednesday|12:25|1:05|LITERATURE
Wednesday|1:05|1:45|LITERATURE
Wednesday|2:25|3:05|GLOBAL PERSPECTIVE
Wednesday|3:05|3:45|GLOBAL PERSPECTIVE
Thursday|8:00|8:40|GLOBAL PERSPECTIVE
Thursday|8:40|9:20|GLOBAL PERSPECTIVE
Thursday|9:20|10:00|COMBINED SCIENCE (PHY)
Thursday|10:00|10:40|COMBINED SCIENCE (PHY)
Thursday|11:05|11:45|FRENCH
Thursday|11:45|12:25|FRENCH
Thursday|12:25|1:05|CHRISTIAN DOCTRINE
Thursday|1:05|1:45|CHRISTIAN DOCTRINE
Thursday|1:45|2:25|ARTS AND CRAFT
Thursday|2:25|3:05|ARTS AND CRAFT
Friday|8:00|8:40|BUSINESS STUDIES
Friday|8:40|9:20|BUSINESS STUDIES
Friday|9:20|10:00|ACCOUNTING
Friday|10:00|10:40|ACCOUNTING
Friday|11:05|11:45|COMBINED SCIENCE (CHEM)
Friday|11:45|12:25|COMBINED SCIENCE (CHEM)
Friday|12:25|1:05|LITERATURE
Friday|1:05|1:45|LITERATURE
Friday|1:45|2:25|PE
Friday|2:25|3:05|PE"""

YEAR_10 = """Monday|8:00|8:40|EXTENDED MATHS
Monday|8:40|9:20|EXTENDED MATHS
Monday|9:20|10:00|SOCIOLOGY/ADD MATHS
Monday|10:00|10:40|SOCIOLOGY/ADD MATHS
Monday|11:05|11:45|PHYSICS/COORDINATED SCIENCE (PHY)
Monday|11:45|12:25|PHYSICS/COORDINATED SCIENCE (PHY)
Monday|12:25|1:05|GEOGRAPHY/ACCOUNTING
Monday|1:45|2:25|GEOGRAPHY/ACCOUNTING
Monday|2:25|3:05|ICT
Monday|3:05|3:45|ICT
Tuesday|8:00|8:40|EXTENDED MATHS
Tuesday|8:40|9:20|EXTENDED MATHS
Tuesday|9:20|10:00|FRENCH LANGUAGE
Tuesday|10:00|10:40|FRENCH LANGUAGE
Tuesday|11:05|11:45|ENGLISH LANGUAGE
Tuesday|11:45|12:25|ENGLISH LANGUAGE
Tuesday|12:25|1:05|ICT
Tuesday|1:05|1:45|LITERATURE/ACCOUNTING
Tuesday|1:45|2:25|CHEMISTRY/ACCOUNTING
Tuesday|2:25|3:05|CHEMISTRY
Wednesday|8:00|8:40|WORSHIP
Wednesday|8:40|9:20|WORSHIP
Wednesday|9:20|10:00|LITERATURE/BUSINESS
Wednesday|10:00|10:40|ICT
Wednesday|11:05|11:45|EXTENDED MATHS
Wednesday|11:45|12:25|SOCIOLOGY/ADD MATHS
Wednesday|12:25|1:05|SOCIOLOGY/ADD MATHS
Wednesday|1:45|2:25|ECONOMICS
Wednesday|2:25|3:05|CHEMISTRY
Wednesday|3:05|3:45|CHEMISTRY
Thursday|8:00|8:40|BIOLOGY/COORDINATED SCIENCE (BIO)
Thursday|8:40|9:20|BIOLOGY/COORDINATED SCIENCE (BIO)
Thursday|9:20|10:00|ICT
Thursday|10:00|10:40|LITERATURE/ADD MATHS
Thursday|11:05|11:45|ENGLISH LANGUAGE
Thursday|11:45|12:25|ECONOMICS
Thursday|12:25|1:05|GEOGRAPHY
Thursday|1:05|1:45|GEOGRAPHY
Thursday|1:45|2:25|PHYSICS/HISTORY/BUSINESS
Thursday|2:25|3:05|PHYSICS/HISTORY/BUSINESS
Friday|8:00|8:40|BIOLOGY/COORDINATED SCIENCE (CHEM)
Friday|8:40|9:20|BIOLOGY/COORDINATED SCIENCE (CHEM)
Friday|9:20|10:00|ECONOMICS/HISTORY
Friday|10:00|10:40|ECONOMICS/HISTORY
Friday|11:05|11:45|ENGLISH LANGUAGE
Friday|11:45|12:25|FRENCH LANGUAGE
Friday|12:25|1:05|FRENCH LANGUAGE
Friday|1:45|2:25|BUSINESS/LITERATURE
Friday|2:25|3:05|CLUB ACTIVITY
Friday|3:05|3:45|CLUB ACTIVITY"""

YEAR_11 = """Monday|8:00|8:40|FRENCH
Monday|8:40|9:20|FRENCH
Monday|9:20|10:00|ICT
Monday|10:00|10:40|ICT
Monday|11:05|11:45|BUSINESS STUDIES
Monday|11:45|12:25|EXTENDED MATH
Monday|1:05|1:45|ENGLISH
Monday|1:45|2:25|PHYSICS/COORDINATED SCIENCE (PHY)
Monday|2:25|3:05|PHYSICS/HISTORY
Monday|3:05|3:45|PHYSICS/COORDINATED SCIENCE (PHY)
Tuesday|8:00|8:40|FRENCH
Tuesday|8:40|9:20|FRENCH
Tuesday|9:20|10:00|BUSINESS STUDIES
Tuesday|10:00|10:40|ADD MATH/LITERATURE
Tuesday|11:05|11:45|ADD MATH/LITERATURE
Tuesday|11:45|12:25|BIOLOGY/HISTORY
Tuesday|12:25|1:05|BIOLOGY/HISTORY
Tuesday|1:45|2:25|SOCIOLOGY
Tuesday|2:25|3:05|ENGLISH
Tuesday|3:05|3:45|PHYSICS/COORDINATED SCIENCE (PHY)
Wednesday|8:00|8:40|WORSHIP
Wednesday|8:40|9:20|WORSHIP
Wednesday|9:20|10:00|CHEMISTRY/COORDINATED SCIENCE (CHEM)
Wednesday|10:00|10:40|CHEMISTRY/COORDINATED SCIENCE (CHEM)
Wednesday|11:05|11:45|LITERATURE
Wednesday|11:45|12:25|LITERATURE
Wednesday|12:25|1:05|GEOGRAPHY/ACCOUNTING
Wednesday|1:45|2:25|GEOGRAPHY/ACCOUNTING
Wednesday|2:25|3:05|ICT
Wednesday|3:05|3:45|ICT
Thursday|8:00|8:40|EXTENDED MATHS
Thursday|8:40|9:20|EXTENDED MATHS
Thursday|9:20|10:00|ECONOMICS
Thursday|10:00|10:40|ECONOMICS
Thursday|11:05|11:45|PHYSICS
Thursday|11:45|12:25|ACCOUNTING/SOCIOLOGY
Thursday|12:25|1:05|ENGLISH
Thursday|1:05|1:45|ENGLISH
Thursday|1:45|2:25|BUSINESS STUDIES/CHEMISTRY
Thursday|2:25|3:05|BUSINESS STUDIES/CHEMISTRY
Friday|8:00|8:40|SOCIOLOGY/ADD MATH
Friday|8:40|9:20|SOCIOLOGY/ADD MATH
Friday|9:20|10:00|BIOLOGY/COORDINATED SCIENCE (BIO)
Friday|10:00|10:40|BIOLOGY/COORDINATED SCIENCE (BIO)
Friday|11:05|11:45|ECONOMICS
Friday|11:45|12:25|ECONOMICS
Friday|12:25|1:05|GEOGRAPHY/HISTORY
Friday|1:05|1:45|GEOGRAPHY/HISTORY
Friday|1:45|2:25|CLUB ACTIVITY
Friday|2:25|3:05|CLUB ACTIVITY"""

YEAR_12 = """Monday|8:40|9:20|ENGLISH LANGUAGE/CHEMISTRY/ACCOUNTING
Monday|9:20|10:00|ENGLISH LANGUAGE/CHEMISTRY/ACCOUNTING
Monday|10:00|10:40|BIOLOGY/BUSINESS STUDIES
Monday|11:05|11:45|CHEMISTRY/FRENCH LANGUAGE/HISTORY
Monday|11:45|12:25|FRENCH LANGUAGE/HISTORY
Monday|12:25|1:05|PHYSICS/HISTORY
Monday|1:45|2:25|PHYSICS/HISTORY
Monday|2:25|3:05|PURE MATHS 1/ECONOMICS/LITERATURE
Monday|3:05|3:45|PURE MATHS 1/ECONOMICS
Tuesday|8:00|8:40|PHYSICS/LITERATURE/ACCOUNTING
Tuesday|8:40|9:20|PHYSICS/LITERATURE
Tuesday|9:20|10:00|CHEMISTRY/HISTORY
Tuesday|10:00|10:40|INFORMATION TECHNOLOGY
Tuesday|11:05|11:45|BUSINESS STUDIES/MECHANICS
Tuesday|11:45|12:25|BUSINESS STUDIES/MECHANICS
Tuesday|12:25|1:05|SOCIOLOGY/STATISTICS
Tuesday|1:45|2:25|STATISTICS/SOCIOLOGY
Tuesday|2:25|3:05|FRENCH
Tuesday|3:05|3:45|FRENCH
Wednesday|9:20|10:00|WORSHIP
Wednesday|10:00|10:40|PURE MATHS 3/ENGLISH LANGUAGE
Wednesday|11:05|11:45|BIOLOGY/GEOGRAPHY/ACCOUNTING
Wednesday|11:45|12:25|BIOLOGY/GEOGRAPHY/ACCOUNTING
Wednesday|12:25|1:05|LITERATURE/STATISTICS
Wednesday|1:45|2:25|LITERATURE/STATISTICS
Wednesday|2:25|3:05|ECONOMICS/FRENCH
Wednesday|3:05|3:45|MECHANICS/ECONOMICS/FRENCH
Thursday|8:00|8:40|PHYSICS/FRENCH LANGUAGE/HISTORY
Thursday|8:40|9:20|PHYSICS/FRENCH LANGUAGE/HISTORY
Thursday|9:20|10:00|BUSINESS STUDIES
Thursday|10:00|10:40|BUSINESS STUDIES
Thursday|11:05|11:45|LITERATURE/INFORMATION TECHNOLOGY
Thursday|11:45|12:25|LITERATURE/INFORMATION TECHNOLOGY
Thursday|12:25|1:05|MECHANICS/SOCIOLOGY
Thursday|1:45|2:25|MECHANICS/SOCIOLOGY
Thursday|2:25|3:05|GEOGRAPHY/ENGLISH LANGUAGE/PURE MATHS 1
Thursday|3:05|3:45|GEOGRAPHY/ENGLISH LANGUAGE/PURE MATHS 1
Friday|8:00|8:40|CHEMISTRY/HISTORY/GEOGRAPHY
Friday|8:40|9:20|CHEMISTRY/HISTORY/GEOGRAPHY
Friday|9:20|10:00|PURE MATHS 3/SOCIOLOGY
Friday|10:00|10:40|PURE MATHS 3/SOCIOLOGY
Friday|11:05|11:45|INFORMATION TECHNOLOGY
Friday|11:45|12:25|INFORMATION TECHNOLOGY
Friday|12:25|1:05|ECONOMICS/BIOLOGY
Friday|1:45|2:25|CLUB ACTIVITY
Friday|2:25|3:05|CLUB ACTIVITY"""

YEAR_13 = """Monday|8:00|8:40|SOCIOLOGY/PHYSICS
Monday|8:40|9:20|SOCIOLOGY/PHYSICS
Monday|9:20|10:00|MECHANICS/LITERATURE
Monday|10:00|10:40|MECHANICS/LITERATURE
Monday|11:05|11:45|ACCOUNTING/STATISTICS
Monday|11:45|12:25|ACCOUNTING/STATISTICS
Monday|12:25|1:05|ECONOMICS
Monday|1:05|1:45|PURE MATHS 1
Monday|1:45|2:25|CHEMISTRY/GEOGRAPHY
Monday|2:25|3:05|CHEMISTRY/GEOGRAPHY
Tuesday|8:00|8:40|PURE MATHS 3/ENGLISH/BUSINESS STUDIES
Tuesday|8:40|9:20|PURE MATHS 3/ENGLISH/BUSINESS STUDIES
Tuesday|9:20|10:00|ECONOMICS/BIOLOGY
Tuesday|10:00|10:40|ECONOMICS/BIOLOGY
Tuesday|11:05|11:45|ACCOUNTING/STATISTICS/LITERATURE/GEOGRAPHY
Tuesday|11:45|12:25|ACCOUNTING/STATISTICS/LITERATURE/GEOGRAPHY
Tuesday|12:25|1:05|MECHANICS
Tuesday|1:05|1:45|MECHANICS
Tuesday|1:45|2:25|ENGLISH
Tuesday|2:25|3:05|ENGLISH
Wednesday|8:00|8:40|WORSHIP
Wednesday|8:40|9:20|WORSHIP
Wednesday|9:20|10:00|BIOLOGY/BUSINESS STUDIES
Wednesday|10:00|10:40|BIOLOGY/BUSINESS STUDIES
Wednesday|11:05|11:45|CHEMISTRY/HISTORY
Wednesday|11:45|12:25|ICT
Wednesday|12:25|1:05|ICT/FRENCH LANGUAGE
Wednesday|1:05|1:45|SOCIOLOGY/PURE MATHS 3
Wednesday|1:45|2:25|SOCIOLOGY/PURE MATHS 3
Wednesday|2:25|3:05|CHEMISTRY/FRENCH/ENGLISH/ECONOMICS
Thursday|8:00|8:40|BIOLOGY/ICT
Thursday|8:40|9:20|BIOLOGY/LITERATURE/GEOGRAPHY
Thursday|9:20|10:00|LITERATURE/GEOGRAPHY
Thursday|10:00|10:40|ICT
Thursday|11:05|11:45|PHYSICS/HISTORY
Thursday|11:45|12:25|PHYSICS/HISTORY
Thursday|12:25|1:05|CHEMISTRY/FRENCH/ENGLISH/ECONOMICS
Thursday|1:05|1:45|SOCIOLOGY
Thursday|1:45|2:25|SOCIOLOGY
Thursday|2:25|3:05|PHYSICS/ENGLISH
Friday|8:00|8:40|ICT
Friday|8:40|9:20|FRENCH/BIOLOGY/LITERATURE
Friday|9:20|10:00|FRENCH/BIOLOGY/LITERATURE
Friday|10:00|10:40|ICT
Friday|11:05|11:45|CHEMISTRY/HISTORY/BUSINESS
Friday|11:45|12:25|CHEMISTRY/HISTORY/BUSINESS
Friday|12:25|1:05|PHYSICS/ENGLISH
Friday|1:05|1:45|PHYSICS/ENGLISH
Friday|1:45|2:25|STATISTICS
Friday|2:25|3:05|STATISTICS"""


async def populate_all():
    """Callable from server startup to seed timetable data."""
    for yg in ["Year 9", "Year 10", "Year 11", "Year 12", "Year 13"]:
        await db.timetable_v2.delete_many({"year_group": yg})

    all_entries = []
    for yg_name, raw in [
        ("Year 9", YEAR_9), ("Year 10", YEAR_10), ("Year 11", YEAR_11),
        ("Year 12", YEAR_12), ("Year 13", YEAR_13),
    ]:
        entries = parse_entries(yg_name, raw.strip().split("\n"))
        entries = [e for e in entries if e["subject"] not in SKIP]
        all_entries.extend(entries)

    if all_entries:
        await db.timetable_v2.insert_many(all_entries)
    return len(all_entries)


async def main():
    # Delete Year 9-13 and reinsert
    count = await populate_all()
    print(f"Total new entries: {count}")

    # Verify all
    total = await db.timetable_v2.count_documents({})
    print(f"\nTotal in DB: {total}")
    for yg in ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13"]:
        c = await db.timetable_v2.count_documents({"year_group": yg})
        print(f"  {yg}: {c}")

if __name__ == "__main__":
    asyncio.run(main())
