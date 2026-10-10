"""
Populate timetable_v2 with REAL TCIS 2025/2026 timetable data from uploaded PDFs.
Year 7, 8, 9, 10, 11
"""
import asyncio, os, uuid
from dotenv import load_dotenv
load_dotenv()
from motor.motor_asyncio import AsyncIOMotorClient

client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
db = client[os.environ.get("DB_NAME", "tcis_workstation")]

def gen_id():
    return "tt_" + uuid.uuid4().hex[:12]

# Skip single-letter break entries and empty subjects
SKIP = {"S", "N", "U", "A", "C", "K", "H", "L", "", "BREAKFAST", "WORSHIP"}

def parse_entries(year_group, raw_lines):
    entries = []
    for line in raw_lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split("|")
        if len(parts) == 3:
            # DAY|START-END|SUBJECT
            day = parts[0].strip()
            time_range = parts[1].strip()
            subject = parts[2].strip()
            if "-" in time_range:
                start, end = time_range.split("-", 1)
            else:
                start, end = time_range, ""
        elif len(parts) == 4:
            # DAY|START|END|SUBJECT
            day = parts[0].strip()
            start = parts[1].strip()
            end = parts[2].strip()
            subject = parts[3].strip()
        else:
            continue

        # Clean up
        start = start.strip()
        end = end.strip()
        subject = subject.strip()
        day = day.capitalize()

        # Fix day names
        day_map = {"Monday": "Monday", "Tuesday": "Tuesday", "Wednesday": "Wednesday", "Thursday": "Thursday", "Friday": "Friday"}
        if day.upper() in [d.upper() for d in day_map]:
            for k in day_map:
                if day.upper() == k.upper():
                    day = k
                    break

        # Skip breaks and empty
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


YEAR_7 = """Monday|8:00|8:40|MATH
Monday|8:40|9:20|MATH
Monday|9:20|10:00|FRENCH
Monday|10:00|10:40|FRENCH
Monday|11:05|11:45|ENGLISH
Monday|11:45|12:25|ENGLISH
Monday|12:25|1:05|ICT
Monday|1:45|2:25|ICT
Monday|2:25|3:05|COMBINED SCIENCE
Monday|3:05|3:45|COMBINED SCIENCE
Tuesday|8:00|8:40|ENGLISH
Tuesday|8:40|9:20|ENGLISH
Tuesday|9:20|10:00|COMBINED SCIENCE
Tuesday|10:00|10:40|COMBINED SCIENCE
Tuesday|11:05|11:45|FRENCH
Tuesday|11:45|12:25|FRENCH
Tuesday|12:25|1:05|MATH
Tuesday|1:45|2:25|MATH
Tuesday|2:25|3:05|LITERATURE
Tuesday|3:05|3:45|LITERATURE
Wednesday|8:00|8:40|WORSHIP
Wednesday|8:40|9:20|WORSHIP
Wednesday|9:20|10:00|FRENCH
Wednesday|10:00|10:40|FRENCH
Wednesday|11:05|11:45|CHRISTIAN DOCTRINE
Wednesday|11:45|12:25|CHRISTIAN DOCTRINE
Wednesday|12:25|1:05|LIBRARY
Wednesday|1:45|2:25|LIBRARY
Wednesday|2:25|3:05|P.E
Wednesday|3:05|3:45|P.E
Thursday|8:00|8:40|LITERATURE
Thursday|8:40|9:20|LITERATURE
Thursday|9:20|10:00|ARTS AND CRAFT
Thursday|10:00|10:40|ARTS AND CRAFT
Thursday|11:05|11:45|GLOBAL PERSPECTIVE
Thursday|11:45|12:25|GLOBAL PERSPECTIVE
Thursday|12:25|1:05|ENGLISH
Thursday|1:45|2:25|ENGLISH
Thursday|2:25|3:05|ICT
Thursday|3:05|3:45|ICT
Friday|8:00|8:40|COMBINED SCIENCE
Friday|8:40|9:20|COMBINED SCIENCE
Friday|9:20|10:00|MATHS
Friday|10:00|10:40|MATHS
Friday|11:05|11:45|ARTS AND CRAFT
Friday|11:45|12:25|ARTS AND CRAFT
Friday|12:25|1:05|GLOBAL PERSPECTIVE
Friday|1:45|2:25|GLOBAL PERSPECTIVE
Friday|2:25|3:05|P.E
Friday|3:05|3:45|P.E"""

YEAR_8 = """Monday|8:00|8:40|COMBINED SCIENCE
Monday|8:40|9:20|COMBINED SCIENCE
Monday|9:20|10:00|MATH
Monday|10:00|10:40|MATH
Monday|11:05|11:45|FRENCH
Monday|11:45|12:25|FRENCH
Monday|12:25|1:05|ARTS AND CRAFT
Monday|1:05|1:45|ARTS AND CRAFT
Monday|2:25|3:05|GLOBAL PERSPECTIVE
Monday|3:05|3:45|GLOBAL PERSPECTIVE
Tuesday|8:00|8:40|GLOBAL PERSPECTIVE
Tuesday|8:40|9:20|GLOBAL PERSPECTIVE
Tuesday|9:20|10:00|FRENCH
Tuesday|10:00|10:40|FRENCH
Tuesday|11:05|11:45|COMBINED SCIENCE
Tuesday|11:45|12:25|COMBINED SCIENCE
Tuesday|12:25|1:05|ENGLISH
Tuesday|1:45|2:25|ENGLISH
Tuesday|2:25|3:05|ICT
Tuesday|3:05|3:45|ICT
Wednesday|8:00|8:40|WORSHIP
Wednesday|8:40|9:20|WORSHIP
Wednesday|9:20|10:00|ENGLISH
Wednesday|10:00|10:40|ENGLISH
Wednesday|11:05|11:45|COMBINED SCIENCE
Wednesday|11:45|12:25|COMBINED SCIENCE
Wednesday|12:25|1:05|FRENCH
Wednesday|1:45|2:25|FRENCH
Wednesday|2:25|3:05|PE
Wednesday|3:05|3:45|PE
Thursday|8:00|8:40|MATH
Thursday|8:40|9:20|MATH
Thursday|9:20|10:00|LITERATURE
Thursday|10:00|10:40|LITERATURE
Thursday|11:05|11:45|LIBRARY
Thursday|11:45|12:25|LIBRARY
Thursday|12:25|1:05|ARTS AND CRAFT
Thursday|1:05|1:45|ARTS AND CRAFT
Thursday|2:25|3:05|CHRISTIAN DOCTRINE
Thursday|3:05|3:45|CHRISTIAN DOCTRINE
Friday|8:00|8:40|ENGLISH
Friday|8:40|9:20|ENGLISH
Friday|9:20|10:00|LITERATURE
Friday|10:00|10:40|LITERATURE
Friday|11:05|11:45|MATH
Friday|11:45|12:25|MATH
Friday|12:25|1:05|ICT
Friday|1:45|2:25|ICT
Friday|2:25|3:05|PE
Friday|3:05|3:45|PE"""

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
Monday|1:05|1:45|GEOGRAPHY/ACCOUNTING
Monday|1:45|2:25|ICT
Monday|2:25|3:05|ICT
Tuesday|8:00|8:40|EXTENDED MATHS
Tuesday|8:40|9:20|EXTENDED MATHS
Tuesday|9:20|10:00|FRENCH LANGUAGE
Tuesday|10:00|10:40|FRENCH LANGUAGE
Tuesday|11:05|11:45|ENGLISH LANGUAGE
Tuesday|11:45|12:25|ENGLISH LANGUAGE
Tuesday|12:25|1:05|ICT
Tuesday|1:05|1:45|ICT
Tuesday|1:45|2:25|LITERATURE/ACCOUNTING
Tuesday|2:25|3:05|CHEMISTRY/ACCOUNTING
Tuesday|3:05|3:45|CHEMISTRY
Wednesday|8:00|8:40|WORSHIP
Wednesday|8:40|9:20|WORSHIP
Wednesday|9:20|10:00|LITERATURE/BUSINESS
Wednesday|10:00|10:40|ICT
Wednesday|11:05|11:45|EXTENDED MATHS
Wednesday|11:45|12:25|SOCIOLOGY/ADD MATHS
Wednesday|12:25|1:05|SOCIOLOGY/ADD MATHS
Wednesday|1:05|1:45|ECONOMICS
Wednesday|1:45|2:25|CHEMISTRY
Wednesday|2:25|3:05|CHEMISTRY
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
Friday|11:05|11:45|ENGLISH
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
Tuesday|3:05|3:45|PHYSICS/HISTORY
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
Thursday|11:05|11:45|ACCOUNTING/PHYSICS
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


async def main():
    all_entries = []
    for yg_name, raw in [
        ("Year 7", YEAR_7), ("Year 8", YEAR_8), ("Year 9", YEAR_9),
        ("Year 10", YEAR_10), ("Year 11", YEAR_11),
    ]:
        entries = parse_entries(yg_name, raw.strip().split("\n"))
        # Filter out WORSHIP
        entries = [e for e in entries if e["subject"] not in SKIP]
        all_entries.extend(entries)
        print(f"  {yg_name}: {len(entries)} periods")

    print(f"\nTotal entries to insert: {len(all_entries)}")

    # Clear existing timetable data
    old_count = await db.timetable_v2.count_documents({})
    await db.timetable_v2.delete_many({})
    print(f"Cleared {old_count} old entries")

    # Insert new data
    if all_entries:
        await db.timetable_v2.insert_many(all_entries)
    
    # Verify
    new_count = await db.timetable_v2.count_documents({})
    print(f"Inserted {new_count} new entries")
    
    # Show summary per year group
    for yg in ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11"]:
        c = await db.timetable_v2.count_documents({"year_group": yg})
        print(f"  {yg}: {c} entries")

asyncio.run(main())
