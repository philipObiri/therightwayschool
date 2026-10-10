"""Populate timetable_v2 with the official TCIS Term 3 2025-2026 timetables extracted from uploaded PDFs."""
import asyncio
from database import db
from models import gen_id

TIMETABLES = {
    "Year 7": [
        ("Monday","08:00","08:40","Mathematics"),("Monday","08:40","09:20","Mathematics"),("Monday","09:20","10:00","French"),("Monday","10:00","10:40","French"),
        ("Monday","11:05","11:45","English Language"),("Monday","11:45","12:25","English Language"),("Monday","13:05","13:45","Information Technology"),("Monday","13:45","14:25","Information Technology"),
        ("Monday","14:25","15:05","Combined Science"),("Monday","15:05","15:45","Combined Science"),
        ("Tuesday","08:00","08:40","English Language"),("Tuesday","08:40","09:20","English Language"),("Tuesday","09:20","10:00","Combined Science"),("Tuesday","10:00","10:40","Combined Science"),
        ("Tuesday","11:05","11:45","French"),("Tuesday","11:45","12:25","French"),("Tuesday","13:05","13:45","Mathematics"),("Tuesday","13:45","14:25","Mathematics"),
        ("Tuesday","14:25","15:05","Literature"),("Tuesday","15:05","15:45","Literature"),
        ("Wednesday","08:00","08:40","Worship"),("Wednesday","08:40","09:20","Worship"),("Wednesday","09:20","10:00","French"),("Wednesday","10:00","10:40","French"),
        ("Wednesday","11:05","11:45","Christian Doctrine"),("Wednesday","11:45","12:25","Christian Doctrine"),("Wednesday","12:25","13:05","Library"),("Wednesday","13:05","13:45","Library"),
        ("Wednesday","14:25","15:05","Physical Education"),("Wednesday","15:05","15:45","Physical Education"),
        ("Thursday","08:00","08:40","Literature"),("Thursday","08:40","09:20","Literature"),("Thursday","09:20","10:00","Arts and Craft"),("Thursday","10:00","10:40","Arts and Craft"),
        ("Thursday","11:05","11:45","Christian Doctrine"),("Thursday","11:45","12:25","Christian Doctrine"),("Thursday","12:25","13:05","English Language"),("Thursday","13:05","13:45","English Language"),
        ("Thursday","14:25","15:05","Information Technology"),("Thursday","15:05","15:45","Information Technology"),
        ("Friday","08:00","08:40","Combined Science"),("Friday","08:40","09:20","Combined Science"),("Friday","09:20","10:00","Mathematics"),("Friday","10:00","10:40","Mathematics"),
        ("Friday","11:05","11:45","Arts and Craft"),("Friday","11:45","12:25","Arts and Craft"),("Friday","12:25","13:05","Christian Doctrine"),("Friday","13:05","13:45","Christian Doctrine"),
        ("Friday","14:25","15:05","Physical Education"),("Friday","15:05","15:45","Physical Education"),
    ],
    "Year 8": [
        ("Monday","08:00","08:40","Combined Science"),("Monday","08:40","09:20","Combined Science"),("Monday","09:20","10:00","Mathematics"),("Monday","10:00","10:40","Mathematics"),
        ("Monday","11:05","11:45","French"),("Monday","11:45","12:25","French"),("Monday","12:25","13:05","Arts and Craft"),("Monday","13:05","13:45","Arts and Craft"),
        ("Monday","13:45","14:25","Christian Doctrine"),("Monday","14:25","15:05","Christian Doctrine"),
        ("Tuesday","08:00","08:40","Christian Doctrine"),("Tuesday","08:40","09:20","Christian Doctrine"),("Tuesday","09:20","10:00","French"),("Tuesday","10:00","10:40","French"),
        ("Tuesday","11:05","11:45","Combined Science"),("Tuesday","11:45","12:25","Combined Science"),("Tuesday","12:25","13:05","English Language"),("Tuesday","13:05","13:45","English Language"),
        ("Tuesday","13:45","14:25","Information Technology"),("Tuesday","14:25","15:05","Information Technology"),
        ("Wednesday","08:00","08:40","Worship"),("Wednesday","08:40","09:20","Worship"),("Wednesday","09:20","10:00","English Language"),("Wednesday","10:00","10:40","English Language"),
        ("Wednesday","11:05","11:45","Combined Science"),("Wednesday","11:45","12:25","Combined Science"),("Wednesday","12:25","13:05","French"),("Wednesday","13:05","13:45","French"),
        ("Wednesday","13:45","14:25","Physical Education"),("Wednesday","14:25","15:05","Physical Education"),
        ("Thursday","08:00","08:40","Mathematics"),("Thursday","08:40","09:20","Mathematics"),("Thursday","09:20","10:00","Literature"),("Thursday","10:00","10:40","Literature"),
        ("Thursday","11:05","11:45","Library"),("Thursday","11:45","12:25","Library"),("Thursday","12:25","13:05","Arts and Craft"),("Thursday","13:05","13:45","Arts and Craft"),
        ("Thursday","13:45","14:25","Christian Doctrine"),("Thursday","14:25","15:05","Christian Doctrine"),
        ("Friday","08:00","08:40","English Language"),("Friday","08:40","09:20","English Language"),("Friday","09:20","10:00","Literature"),("Friday","10:00","10:40","Literature"),
        ("Friday","11:05","11:45","Mathematics"),("Friday","11:45","12:25","Mathematics"),("Friday","12:25","13:05","Information Technology"),("Friday","13:05","13:45","Information Technology"),
        ("Friday","13:45","14:25","Physical Education"),("Friday","14:25","15:05","Physical Education"),
    ],
    "Year 9": [
        ("Monday","08:00","08:40","Information Technology"),("Monday","08:40","09:20","Information Technology"),("Monday","09:20","10:00","Economics"),("Monday","10:00","10:40","Economics"),
        ("Monday","11:05","11:45","Combined Science (Bio)"),("Monday","11:45","12:25","Combined Science (Bio)"),("Monday","12:25","13:05","Christian Doctrine"),("Monday","13:05","13:45","Christian Doctrine"),
        ("Monday","13:45","14:25","French"),("Monday","14:25","15:05","French"),
        ("Tuesday","08:00","08:40","Information Technology"),("Tuesday","08:40","09:20","Information Technology"),("Tuesday","09:20","10:00","Mathematics"),("Tuesday","10:00","10:40","Mathematics"),
        ("Tuesday","11:05","11:45","English Language"),("Tuesday","11:45","12:25","English Language"),("Tuesday","12:25","13:05","Business Studies"),
        ("Tuesday","13:45","14:25","Combined Science (Phy)"),("Tuesday","14:25","15:05","Economics"),("Tuesday","15:05","15:45","Economics"),
        ("Wednesday","08:00","08:40","Worship"),("Wednesday","08:40","09:20","Worship"),("Wednesday","09:20","10:00","Mathematics"),("Wednesday","10:00","10:40","Mathematics"),
        ("Wednesday","11:05","11:45","English Language"),("Wednesday","11:45","12:25","English Language"),("Wednesday","12:25","13:05","Literature"),
        ("Wednesday","13:45","14:25","Literature"),("Wednesday","14:25","15:05","Physical Education"),("Wednesday","15:05","15:45","Physical Education"),
        ("Thursday","08:00","08:40","Accounting"),("Thursday","08:40","09:20","Accounting"),("Thursday","09:20","10:00","Combined Science (Phy)"),("Thursday","10:00","10:40","Combined Science (Phy)"),
        ("Thursday","11:05","11:45","French"),("Thursday","11:45","12:25","French"),("Thursday","12:25","13:05","Christian Doctrine"),
        ("Thursday","13:45","14:25","Christian Doctrine"),("Thursday","14:25","15:05","Arts and Craft"),("Thursday","15:05","15:45","Arts and Craft"),
        ("Friday","08:00","08:40","Business Studies"),("Friday","08:40","09:20","Business Studies"),("Friday","09:20","10:00","Accounting"),("Friday","10:00","10:40","Accounting"),
        ("Friday","11:05","11:45","Combined Science (Chem)"),("Friday","11:45","12:25","Combined Science (Chem)"),("Friday","12:25","13:05","Literature"),
        ("Friday","13:45","14:25","Literature"),("Friday","14:25","15:05","Physical Education"),("Friday","15:05","15:45","Physical Education"),
    ],
    "Year 10": [
        ("Monday","08:00","08:40","Extended Maths"),("Monday","08:40","09:20","Extended Maths"),("Monday","09:20","10:00","Sociology / Add Maths"),("Monday","10:00","10:40","Sociology / Add Maths"),
        ("Monday","11:05","11:45","Physics / Coordinated Science"),("Monday","11:45","12:25","Physics / Coordinated Science"),("Monday","12:25","13:05","Geography / Accounting"),("Monday","13:05","13:45","Geography / Accounting"),
        ("Monday","13:45","14:25","Information Technology"),("Monday","14:25","15:05","Information Technology"),
        ("Tuesday","08:00","08:40","Extended Maths"),("Tuesday","08:40","09:20","Extended Maths"),("Tuesday","09:20","10:00","French Language"),("Tuesday","10:00","10:40","French Language"),
        ("Tuesday","11:05","11:45","English Language"),("Tuesday","11:45","12:25","English Language"),("Tuesday","12:25","13:05","Information Technology"),
        ("Tuesday","13:05","13:45","Literature / Accounting"),("Tuesday","13:45","14:25","Chemistry"),("Tuesday","14:25","15:05","Chemistry"),
        ("Wednesday","08:00","08:40","Worship"),("Wednesday","08:40","09:20","Worship"),("Wednesday","09:20","10:00","Literature / Business"),("Wednesday","10:00","10:40","Information Technology"),
        ("Wednesday","11:05","11:45","Extended Maths"),("Wednesday","11:45","12:25","Sociology / Add Maths"),("Wednesday","12:25","13:05","Sociology / Add Maths"),
        ("Wednesday","13:05","13:45","Economics"),("Wednesday","13:45","14:25","Chemistry"),("Wednesday","14:25","15:05","Chemistry"),
        ("Thursday","08:00","08:40","Biology / Coordinated Science"),("Thursday","08:40","09:20","Biology / Coordinated Science"),("Thursday","09:20","10:00","Information Technology"),("Thursday","10:00","10:40","Literature / Add Maths"),
        ("Thursday","11:05","11:45","English Language"),("Thursday","11:45","12:25","Economics"),("Thursday","12:25","13:05","Geography"),("Thursday","13:05","13:45","Geography"),
        ("Thursday","13:45","14:25","Physics / History / Business"),("Thursday","14:25","15:05","Physics / History / Business"),
        ("Friday","08:00","08:40","Biology / Coordinated Science"),("Friday","08:40","09:20","Biology / Coordinated Science"),("Friday","09:20","10:00","Economics / History"),("Friday","10:00","10:40","Economics / History"),
        ("Friday","11:05","11:45","English Language"),("Friday","11:45","12:25","French Language"),("Friday","12:25","13:05","French Language"),
        ("Friday","13:05","13:45","Business / Literature"),("Friday","13:45","14:25","Club Activity"),("Friday","14:25","15:05","Club Activity"),
    ],
    "Year 11": [
        ("Monday","08:00","08:40","French"),("Monday","08:40","09:20","French"),("Monday","09:20","10:00","Information Technology"),("Monday","10:00","10:40","Information Technology"),
        ("Monday","11:05","11:45","Business Studies"),("Monday","11:45","12:25","Extended Maths"),("Monday","12:25","13:05","Extended Maths"),
        ("Monday","13:05","13:45","English Language"),("Monday","13:45","14:25","Physics / Coordinated Science"),("Monday","14:25","15:05","Physics / Coordinated Science"),
        ("Tuesday","08:00","08:40","French"),("Tuesday","08:40","09:20","French"),("Tuesday","09:20","10:00","Business Studies"),("Tuesday","10:00","10:40","Add Maths / Literature"),
        ("Tuesday","11:05","11:45","Add Maths / Literature"),("Tuesday","11:45","12:25","Biology / History"),("Tuesday","12:25","13:05","Biology / History"),
        ("Tuesday","13:05","13:45","Sociology"),("Tuesday","13:45","14:25","English Language"),("Tuesday","14:25","15:05","Physics / History"),
        ("Wednesday","08:00","08:40","Worship"),("Wednesday","08:40","09:20","Worship"),("Wednesday","09:20","10:00","Chemistry / Coordinated Science"),("Wednesday","10:00","10:40","Chemistry / Coordinated Science"),
        ("Wednesday","11:05","11:45","Literature"),("Wednesday","11:45","12:25","Literature"),("Wednesday","12:25","13:05","Geography / Accounting"),("Wednesday","13:05","13:45","Geography / Accounting"),
        ("Wednesday","13:45","14:25","Information Technology"),("Wednesday","14:25","15:05","Information Technology"),
        ("Thursday","08:00","08:40","Extended Maths"),("Thursday","08:40","09:20","Extended Maths"),("Thursday","09:20","10:00","Economics"),("Thursday","10:00","10:40","Economics"),
        ("Thursday","11:05","11:45","Physics"),("Thursday","11:45","12:25","Accounting / Sociology"),("Thursday","12:25","13:05","English Language"),("Thursday","13:05","13:45","English Language"),
        ("Thursday","13:45","14:25","Business Studies / Chemistry"),("Thursday","14:25","15:05","Business Studies / Chemistry"),
        ("Friday","08:00","08:40","Sociology / Add Maths"),("Friday","08:40","09:20","Sociology / Add Maths"),("Friday","09:20","10:00","Biology / Coordinated Science"),("Friday","10:00","10:40","Biology / Coordinated Science"),
        ("Friday","11:05","11:45","Economics"),("Friday","11:45","12:25","Economics"),("Friday","12:25","13:05","Geography / History"),("Friday","13:05","13:45","Geography / History"),
        ("Friday","13:45","14:25","Club Activity"),("Friday","14:25","15:05","Club Activity"),
    ],
    "Year 12": [
        ("Monday","08:40","09:20","English Language / Chemistry / Accounting"),("Monday","09:20","10:00","English Language / Chemistry / Accounting"),("Monday","10:00","10:40","Biology / Business Studies"),
        ("Monday","11:05","11:45","Chemistry / French / History"),("Monday","11:45","12:25","French / History"),("Monday","12:25","13:05","Physics / History"),
        ("Monday","13:45","14:25","Physics / History"),("Monday","14:25","15:05","Pure Maths 1 / Economics / Literature"),("Monday","15:05","15:45","Pure Maths 1 / Economics"),
        ("Tuesday","08:40","09:20","Physics / Literature / Accounting"),("Tuesday","09:20","10:00","Physics / Literature"),("Tuesday","10:00","10:40","Chemistry / History"),
        ("Tuesday","11:05","11:45","Business Studies / Mechanics"),("Tuesday","11:45","12:25","Business Studies / Mechanics"),("Tuesday","12:25","13:05","Sociology / Statistics"),
        ("Tuesday","13:45","14:25","Statistics / Sociology"),("Tuesday","14:25","15:05","French"),("Tuesday","15:05","15:45","French"),
        ("Wednesday","08:40","09:20","Worship"),("Wednesday","09:20","10:00","Worship"),("Wednesday","10:00","10:40","Pure Maths 3 / English Language"),
        ("Wednesday","11:45","12:25","Biology / Geography / Accounting"),("Wednesday","12:25","13:05","Biology / Geography / Accounting"),
        ("Wednesday","13:05","13:45","Literature / Statistics"),("Wednesday","13:45","14:25","Literature / Statistics"),("Wednesday","14:25","15:05","Economics / French"),("Wednesday","15:05","15:45","Mechanics / Economics / French"),
        ("Thursday","08:40","09:20","Physics / French / History"),("Thursday","09:20","10:00","Physics / French / History"),("Thursday","10:00","10:40","Business Studies"),
        ("Thursday","11:45","12:25","Literature / Information Technology"),("Thursday","12:25","13:05","Literature / Information Technology"),
        ("Thursday","13:05","13:45","Mechanics / Sociology"),("Thursday","13:45","14:25","Mechanics / Sociology"),("Thursday","15:05","15:45","Geography / English / Pure Maths 1"),
        ("Friday","08:40","09:20","Chemistry / History / Geography"),("Friday","09:20","10:00","Chemistry / History / Geography"),("Friday","10:00","10:40","Pure Maths 3 / Sociology"),
        ("Friday","11:45","12:25","Information Technology"),("Friday","12:25","13:05","Information Technology"),
        ("Friday","13:05","13:45","Economics / Biology"),("Friday","13:45","14:25","Economics / Biology"),("Friday","15:05","15:45","Club Activity"),
    ],
    "Year 13": [
        ("Monday","08:00","08:40","Sociology / Physics"),("Monday","08:40","09:20","Sociology / Physics"),("Monday","09:20","10:00","Mechanics / Literature"),("Monday","10:00","10:40","Mechanics / Literature"),
        ("Monday","11:05","11:45","Accounting / Statistics"),("Monday","11:45","12:25","Accounting / Statistics"),("Monday","12:25","13:05","Economics"),
        ("Monday","13:05","13:45","Pure Maths 1"),("Monday","13:45","14:25","Chemistry / Geography"),("Monday","14:25","15:05","Chemistry / Geography"),
        ("Tuesday","08:00","08:40","Pure Maths 3 / English / Business Studies"),("Tuesday","08:40","09:20","Pure Maths 3 / English / Business Studies"),("Tuesday","09:20","10:00","Economics / Biology"),("Tuesday","10:00","10:40","Economics / Biology"),
        ("Tuesday","11:05","11:45","Accounting / Statistics / Literature / Geography"),("Tuesday","11:45","12:25","Accounting / Statistics / Literature / Geography"),("Tuesday","12:25","13:05","Mechanics"),("Tuesday","13:05","13:45","Mechanics"),
        ("Tuesday","13:45","14:25","English"),("Tuesday","14:25","15:05","English"),
        ("Wednesday","08:00","08:40","Worship"),("Wednesday","08:40","09:20","Worship"),("Wednesday","09:20","10:00","Biology / Business Studies"),("Wednesday","10:00","10:40","Biology / Business Studies"),
        ("Wednesday","11:05","11:45","Chemistry / Business Studies"),("Wednesday","11:45","12:25","Chemistry / History"),("Wednesday","12:25","13:05","Information Technology"),("Wednesday","13:05","13:45","ICT / French"),
        ("Wednesday","13:45","14:25","Sociology / Pure Maths 3"),("Wednesday","14:25","15:05","Sociology / Pure Maths 3"),
        ("Thursday","08:00","08:40","Biology / Information Technology"),("Thursday","08:40","09:20","Biology / Literature / Geography"),("Thursday","09:20","10:00","Literature / Geography"),("Thursday","10:00","10:40","Information Technology"),
        ("Thursday","11:05","11:45","Chemistry / Physics / History"),("Thursday","11:45","12:25","Physics / History"),("Thursday","12:25","13:05","Chemistry / French / English / Economics"),("Thursday","13:05","13:45","French / English / History"),
        ("Thursday","13:45","14:25","Sociology"),("Thursday","14:25","15:05","Sociology"),
        ("Friday","08:00","08:40","Information Technology"),("Friday","08:40","09:20","French / Biology / Literature"),("Friday","09:20","10:00","French / Biology / Literature"),("Friday","10:00","10:40","Information Technology"),
        ("Friday","11:05","11:45","Chemistry / History / Business"),("Friday","11:45","12:25","Chemistry / History / Business"),("Friday","12:25","13:05","Physics / English"),("Friday","13:05","13:45","Physics / English"),
        ("Friday","13:45","14:25","Statistics"),("Friday","14:25","15:05","Statistics"),
    ],
}


async def populate_all():
    """Clear old timetable and insert new data from official TCIS Term 3 PDFs."""
    await db.timetable_v2.delete_many({})
    count = 0
    for year_group, entries in TIMETABLES.items():
        for day, start, end, subject in entries:
            await db.timetable_v2.insert_one({
                "entry_id": gen_id("tt_"),
                "year_group": year_group,
                "day": day,
                "start_time": start,
                "end_time": end,
                "subject": subject,
                "teacher": "",
                "room": "",
            })
            count += 1
    return count


if __name__ == "__main__":
    result = asyncio.run(populate_all())
    print(f"Populated {result} timetable entries")
