"""
seed_demo_data.py — Populates the RightWay demo database with interconnected data
across all user roles for a presentation demo.

All inserted documents are tagged  _demo: True  so they can be safely wiped
by clear_demo_data.py without touching any real data.

Run from the backend/ directory:
    python scripts/seed_demo_data.py

Safe to run multiple times — idempotent (skips if already seeded).
"""
import asyncio
import os
import secrets
import random
from pathlib import Path
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

# ── DB connection ─────────────────────────────────────────────────────────────
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

# ── Helpers ───────────────────────────────────────────────────────────────────
def gen_id(prefix=""):
    return f"{prefix}{secrets.token_hex(8)}"

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def days_ago(n):
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()

def days_from_now(n):
    return (datetime.now(timezone.utc) + timedelta(days=n)).isoformat()

def date_str(n_days_ago):
    """YYYY-MM-DD string n days in the past."""
    return (datetime.now(timezone.utc) - timedelta(days=n_days_ago)).strftime("%Y-%m-%d")

def grade_letter(score):
    if score >= 95: return "A*"
    if score >= 80: return "A"
    if score >= 75: return "B+"
    if score >= 70: return "B"
    if score >= 65: return "C+"
    if score >= 60: return "C"
    if score >= 50: return "D"
    if score >= 45: return "E"
    if score >= 35: return "F"
    return "U"

def grade_remark(letter):
    return {
        "A*": "Distinction", "A": "Excellent", "B+": "Very Good", "B": "Good",
        "C+": "Average", "C": "Pass", "D": "Credit", "E": "Failed", "F": "Failed", "U": "Ungraded"
    }.get(letter, "")

def calc_final(ca, exam, ca_w=30, ex_w=70):
    return round((ca * ca_w / 100) + (exam * ex_w / 100), 1)

def hash_pw(plain):
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

# ── Known demo user IDs (fetched at runtime) ──────────────────────────────────
DEMO_EMAILS = {
    "teacher":     "teacher@rightway.demo",
    "student":     "student@rightway.demo",
    "parent":      "parent@rightway.demo",
    "headteacher": "headteacher@rightway.demo",
    "principal":   "principal@rightway.demo",
    "superadmin":  "superadmin@rightway.demo",
    "admin":       "admin@rightway.demo",
    "finance":     "finance@rightway.demo",
    "hr":          "hr@rightway.demo",
    "ceo":         "ceo@rightway.demo",
}

CLASSMATES = [
    "Marcus Williams", "Kezia Phillip", "Jadon Charles", "Amara Ramdeen",
    "Isaiah Gonzales", "Priya Maharaj", "Elijah Baptiste", "Sasha Mohammed",
    "Nathan Prescott", "Aaliya Ali", "Ethan Peters", "Destiny Roopchand",
    "Joel Sampson", "Simone Lezama", "Tariq Joseph",
]

SCHOOL_DAYS = [d for d in range(21, 0, -1) if datetime.now(timezone.utc).weekday() not in
               [(datetime.now(timezone.utc) - timedelta(days=d)).weekday()
                if (datetime.now(timezone.utc) - timedelta(days=d)).weekday() >= 5 else -1]]
# Simpler: just last 15 weekdays
def last_n_weekdays(n):
    days = []
    d = datetime.now(timezone.utc) - timedelta(days=1)
    while len(days) < n:
        if d.weekday() < 5:
            days.append(d.strftime("%Y-%m-%d"))
        d -= timedelta(days=1)
    return days

SCHOOL_DAY_DATES = last_n_weekdays(15)

TIMETABLE_SLOTS = [
    (1, "08:00", "08:40"), (2, "08:40", "09:20"), (3, "09:20", "10:00"), (4, "10:00", "10:40"),
    (5, "11:05", "11:45"), (6, "11:45", "12:25"), (7, "12:25", "13:05"), (8, "13:05", "13:45"),
]
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


async def get_demo_users():
    users = {}
    for role, email in DEMO_EMAILS.items():
        u = await db.users.find_one({"email": email}, {"_id": 0})
        if u:
            users[role] = u
        else:
            print(f"  [WARN] Demo user not found: {email}")
    return users


async def already_seeded():
    count = await db.subjects.count_documents({"_demo": True})
    return count > 0


# ═══════════════════════════════════════════════════════════════════════════════
# SEED FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

async def seed_app_settings():
    await db.app_settings.update_one(
        {"key": "active_term"},
        {"$set": {"key": "active_term", "value": "Term 1", "academic_year": "2025-2026", "_demo": True}},
        upsert=True
    )
    print("  ✓ app_settings — active term set to Term 1, 2025-2026")


async def seed_subjects():
    SUBJECTS = [
        {"name": "Mathematics",         "code": "MATH7",  "department": "Mathematics"},
        {"name": "English Language",     "code": "ENG7",   "department": "Languages"},
        {"name": "Integrated Science",   "code": "SCI7",   "department": "Science"},
        {"name": "Information Technology","code": "IT7",    "department": "ICT"},
        {"name": "Social Studies",       "code": "SS7",    "department": "Humanities"},
        {"name": "Spanish",              "code": "SPA7",   "department": "Languages"},
        {"name": "Religious Education",  "code": "RE7",    "department": "Humanities"},
        {"name": "Physical Education",   "code": "PE7",    "department": "Sports"},
    ]
    subject_ids = {}
    for s in SUBJECTS:
        existing = await db.subjects.find_one({"code": s["code"]}, {"_id": 0})
        if existing:
            subject_ids[s["name"]] = existing["subject_id"]
            continue
        sid = gen_id("subj_")
        doc = {
            "subject_id": sid, "name": s["name"], "code": s["code"],
            "department": s["department"], "year_groups": ["Year 7"],
            "created_at": now_iso(), "_demo": True,
        }
        await db.subjects.insert_one(doc)
        subject_ids[s["name"]] = sid
    print(f"  ✓ subjects — {len(subject_ids)} subjects ready")
    return subject_ids


async def seed_class(users, subject_ids):
    teacher = users["teacher"]
    headteacher = users["headteacher"]

    # Create 15 classmate student users
    classmate_ids = []
    for name in CLASSMATES:
        email = name.lower().replace(" ", ".") + "@student.rightway.demo"
        existing = await db.users.find_one({"email": email}, {"_id": 0})
        if existing:
            classmate_ids.append(existing["user_id"])
            continue
        uid = gen_id("user_")
        doc = {
            "user_id": uid, "name": name, "email": email,
            "password_hash": hash_pw("student123"),
            "role": "Student", "phone": "", "department": "",
            "is_active": True, "token_version": 1,
            "password_change_required": False,
            "year_group": "Year 7", "boarding_status": "day",
            "created_at": now_iso(), "_demo": True,
        }
        await db.users.insert_one(doc)
        classmate_ids.append(uid)

    kayla_id = users["student"]["user_id"]
    all_student_ids = [kayla_id] + classmate_ids

    # Create the class
    existing_class = await db.classes.find_one({"name": "Year 7A", "_demo": True}, {"_id": 0})
    if existing_class:
        class_id = existing_class["class_id"]
    else:
        class_id = gen_id("cls_")
        class_doc = {
            "class_id": class_id, "name": "Year 7A", "year_group": "Year 7",
            "form_teacher_id": headteacher["user_id"],
            "form_teacher_name": headteacher["name"],
            "subject_ids": list(subject_ids.values()),
            "student_ids": all_student_ids,
            "student_count": len(all_student_ids),
            "created_at": now_iso(), "_demo": True,
        }
        await db.classes.insert_one(class_doc)

    # Update demo student user
    await db.users.update_one(
        {"user_id": kayla_id},
        {"$set": {
            "name": "Kayla Joseph",
            "class_id": class_id, "class_name": "Year 7A",
            "year_group": "Year 7",
            "admission_number": "RW-2025-001",
            "date_of_birth": "2013-03-14",
            "boarding_status": "day",
            "subject_ids": list(subject_ids.values()),   # IDs used by /admin/students/{id} endpoint
            "subjects": list(subject_ids.keys()),
            "_demo_updated": True,
        }}
    )

    # Update classmates with class_id + subject_ids
    for uid in classmate_ids:
        await db.users.update_one({"user_id": uid}, {"$set": {
            "class_id": class_id, "class_name": "Year 7A",
            "subject_ids": list(subject_ids.values()),
        }})

    # Update teacher
    await db.users.update_one(
        {"user_id": teacher["user_id"]},
        {"$set": {
            "teaching_subjects": ["Mathematics", "English Language"],
            "assigned_year_groups": ["Year 7"],
            "department": "Junior School",
            "_demo_updated": True,
        }}
    )

    # Update headteacher
    await db.users.update_one(
        {"user_id": headteacher["user_id"]},
        {"$set": {
            "assigned_year_groups": ["Year 7"],
            "department": "Junior School",
            "_demo_updated": True,
        }}
    )

    # Link parent to student
    await db.users.update_one(
        {"user_id": users["parent"]["user_id"]},
        {"$set": {
            "children_ids": [kayla_id],
            "children_names": ["Kayla Joseph"],
            "_demo_updated": True,
        }}
    )

    print(f"  ✓ class — Year 7A created (id: {class_id}), 16 students, users updated")
    return class_id, all_student_ids, classmate_ids


async def seed_timetable(users, class_id, subject_ids):
    teacher = users["teacher"]

    # Check already seeded
    existing = await db.timetable.count_documents({"class_id": class_id, "_demo": True})
    if existing > 0:
        print(f"  ✓ timetable — already seeded ({existing} entries)")
        return

    # Maths: Mon p1, Mon p2, Wed p1, Thu p3
    # English: Tue p1, Tue p2, Thu p1, Fri p2
    # Other subjects fill in remaining slots
    teacher_slots = {
        ("Monday", 1): "Mathematics", ("Monday", 2): "Mathematics",
        ("Wednesday", 1): "Mathematics", ("Thursday", 3): "Mathematics",
        ("Tuesday", 1): "English Language", ("Tuesday", 2): "English Language",
        ("Thursday", 1): "English Language", ("Friday", 2): "English Language",
    }
    other_subjects = ["Integrated Science", "Information Technology", "Social Studies",
                      "Spanish", "Religious Education", "Physical Education"]
    other_idx = 0

    entries = []
    slot_map = {(p, s, e): (p, s, e) for p, s, e in TIMETABLE_SLOTS}

    for day in DAYS:
        for period, start, end in TIMETABLE_SLOTS:
            subj_name = teacher_slots.get((day, period))
            if subj_name:
                tid = teacher["user_id"]
                tname = teacher["name"]
            else:
                subj_name = other_subjects[other_idx % len(other_subjects)]
                other_idx += 1
                tid = users["headteacher"]["user_id"]
                tname = users["headteacher"]["name"]

            sid = subject_ids.get(subj_name, "")
            entries.append({
                "entry_id": gen_id("tt_"),
                "class_id": class_id, "class_name": "Year 7A", "year_group": "Year 7",
                "subject_id": sid, "subject_name": subj_name,
                "teacher_id": tid, "teacher_name": tname,
                "day": day, "period": period,
                "start_time": start, "end_time": end,
                "created_at": now_iso(), "_demo": True,
            })

    await db.timetable.insert_many(entries)
    print(f"  ✓ timetable — {len(entries)} entries created for Year 7A")


async def seed_lessons(users, class_id, subject_ids):
    teacher = users["teacher"]
    existing = await db.lessons_v2.count_documents({"_demo": True})
    if existing > 0:
        print(f"  ✓ lessons — already seeded ({existing} lessons)")
        return

    lessons = [
        {
            "title": "Place Value and Number Systems",
            "subject_name": "Mathematics", "subject_id": subject_ids.get("Mathematics", ""),
            "content_text": (
                "Lesson Objectives:\n"
                "1. Understand the base-10 number system\n"
                "2. Read and write numbers up to one million\n"
                "3. Compare and order whole numbers\n\n"
                "Key Vocabulary: digit, place value, ones, tens, hundreds, thousands, ten-thousands, hundred-thousands\n\n"
                "Starter: Write the value of each digit in 347,892\n\n"
                "Main Activity:\n"
                "- Place Value Chart demonstration\n"
                "- Students complete place value exercises\n"
                "- Partner activity: ordering 6-digit numbers\n\n"
                "Plenary: Exit ticket — write 4 numbers in order from smallest to largest"
            ),
            "description": "Introduction to the base-10 number system and place value for Year 7 students.",
            "term": "Term 1", "academic_year": "2025-2026",
        },
        {
            "title": "Fractions, Decimals and Percentages",
            "subject_name": "Mathematics", "subject_id": subject_ids.get("Mathematics", ""),
            "content_text": (
                "Lesson Objectives:\n"
                "1. Convert between fractions, decimals and percentages\n"
                "2. Compare fractions with different denominators\n"
                "3. Solve real-world problems using fractions\n\n"
                "Key Vocabulary: numerator, denominator, equivalent fractions, simplify, decimal, percentage\n\n"
                "Starter: Quick quiz — what fraction of this shape is shaded?\n\n"
                "Main Activity:\n"
                "- Fraction walls visual aid\n"
                "- Converting: ½ = 0.5 = 50%\n"
                "- Class competition: fraction snap game\n\n"
                "Plenary: Explain in your own words — what does 3/4 mean?"
            ),
            "description": "Understanding and converting between fractions, decimals and percentages.",
            "term": "Term 1", "academic_year": "2025-2026",
        },
        {
            "title": "Writing to Describe — Techniques",
            "subject_name": "English Language", "subject_id": subject_ids.get("English Language", ""),
            "content_text": (
                "Lesson Objectives:\n"
                "1. Identify features of descriptive writing\n"
                "2. Use sensory language and figurative devices\n"
                "3. Craft a descriptive paragraph independently\n\n"
                "Key Techniques: simile, metaphor, personification, sensory detail (sight/sound/smell/touch/taste)\n\n"
                "Starter: Read this passage — how does the writer make you feel like you are there?\n\n"
                "Main Activity:\n"
                "- Annotate a model text for descriptive techniques\n"
                "- Teacher models 'Show don't tell' technique\n"
                "- Students write a descriptive paragraph about their favourite place\n\n"
                "Plenary: Peer review — circle the best descriptive detail in your partner's paragraph"
            ),
            "description": "Using sensory language, simile, metaphor and personification in descriptive writing.",
            "term": "Term 1", "academic_year": "2025-2026",
        },
        {
            "title": "Reading Comprehension Strategies",
            "subject_name": "English Language", "subject_id": subject_ids.get("English Language", ""),
            "content_text": (
                "Lesson Objectives:\n"
                "1. Use PEEE technique (Point, Evidence, Explain, Effect)\n"
                "2. Identify explicit and implicit information in a text\n"
                "3. Respond to inference and deduction questions\n\n"
                "Key Vocabulary: inference, deduction, explicit, implicit, context, evidence\n\n"
                "Starter: 'What is the character feeling?' — read and infer from a short passage\n\n"
                "Main Activity:\n"
                "- Model PEEE response as a class\n"
                "- Students attempt a 4-mark inference question\n"
                "- Discussion: what clues helped you?\n\n"
                "Plenary: Traffic light self-assessment on PEEE technique"
            ),
            "description": "Developing inference, deduction and PEEE response technique for comprehension tasks.",
            "term": "Term 1", "academic_year": "2025-2026",
        },
    ]

    for lesson in lessons:
        doc = {
            "lesson_id": gen_id("les_"),
            "title": lesson["title"],
            "subject_name": lesson["subject_name"],
            "subject_id": lesson["subject_id"],
            "year_group": "Year 7",
            "class_id": class_id, "class_name": "Year 7A",
            "teacher_id": teacher["user_id"],
            "teacher_name": teacher["name"],
            "department": "Junior School",
            "term": lesson["term"],
            "academic_year": lesson["academic_year"],
            "content_text": lesson["content_text"],
            "rich_content": None,
            "file_ids": [],
            "status": "published",
            "published_at": days_ago(random.randint(5, 15)),
            "created_at": days_ago(random.randint(16, 25)),
            "updated_at": now_iso(),
            "description": lesson["description"],
            "_demo": True,
        }
        await db.lessons_v2.insert_one(doc)

    print(f"  ✓ lessons — 4 published lessons created")


async def seed_assignments(users, class_id, subject_ids):
    teacher = users["teacher"]
    existing = await db.assignments.count_documents({"_demo": True})
    if existing > 0:
        print(f"  ✓ assignments — already seeded ({existing})")
        return

    kayla_id = users["student"]["user_id"]
    classmate_ids = [u["user_id"] async for u in db.users.find(
        {"class_id": class_id, "_demo": True, "role": "Student"}, {"_id": 0, "user_id": 1}
    )]

    assignments = [
        {
            "title": "Number Systems Worksheet",
            "subject": "Mathematics", "subject_id": subject_ids.get("Mathematics", ""),
            "description": "Complete exercises 1–20 from the Place Value worksheet. Show all working.",
            "due_date": days_from_now(3),
            "instructions": "Write the value of each underlined digit. Then order the numbers from smallest to largest.",
            "max_score": 20,
        },
        {
            "title": "Fractions Problem Set",
            "subject": "Mathematics", "subject_id": subject_ids.get("Mathematics", ""),
            "description": "Solve the 10 fraction problems. Convert all answers to their simplest form.",
            "due_date": days_ago(2),  # overdue
            "instructions": "Show full working for each question. Final answers must be simplified.",
            "max_score": 40,
        },
        {
            "title": "Descriptive Paragraph Draft",
            "subject": "English Language", "subject_id": subject_ids.get("English Language", ""),
            "description": "Write a descriptive paragraph (150–200 words) about a place that is special to you.",
            "due_date": days_from_now(5),
            "instructions": "Use at least two descriptive techniques (simile, metaphor, personification, or sensory language). Underline each technique used.",
            "max_score": 20,
        },
        {
            "title": "Comprehension Exercise",
            "subject": "English Language", "subject_id": subject_ids.get("English Language", ""),
            "description": "Read the passage 'The Market at Sunrise' and answer all comprehension questions.",
            "due_date": days_ago(5),  # already submitted
            "instructions": "Answer in full sentences. Use evidence from the text to support your answers.",
            "max_score": 30,
        },
    ]

    asgn_ids = {}
    for a in assignments:
        aid = gen_id("asgn_")
        doc = {
            "assignment_id": aid,
            "title": a["title"],
            "subject": a["subject"],
            "subject_id": a["subject_id"],
            "subject_name": a["subject"],
            "description": a["description"],
            "instructions": a["instructions"],
            "due_date": a["due_date"],
            "max_score": a["max_score"],
            "class_ids": [class_id],
            "year_group": "Year 7",
            "teacher_id": teacher["user_id"],
            "teacher_name": teacher["name"],
            "term": "Term 1",
            "academic_year": "2025-2026",
            "published": True,
            "published_at": days_ago(random.randint(3, 10)),
            "created_at": days_ago(random.randint(11, 20)),
            "_demo": True,
        }
        await db.assignments.insert_one(doc)
        asgn_ids[a["title"]] = aid

    # Kayla's submissions
    kayla_subs = [
        {
            "assignment_id": asgn_ids["Comprehension Exercise"],
            "student_id": kayla_id,
            "student_name": "Kayla Joseph",
            "content": "The passage describes the busy market through vivid sensory detail. In the first paragraph, the writer uses the simile 'like a river of colour' to describe the stalls, which shows how bright and lively the scene is. The writer makes the reader feel excited and immersed in the atmosphere.",
            "grade": 23,
            "feedback": "Well done Kayla! Your use of evidence is strong and your explanation is clear. Try to extend your analysis with more specific language choices next time. Grade: 23/30 (76%)",
            "submitted_at": days_ago(3),
        },
        {
            "assignment_id": asgn_ids["Fractions Problem Set"],
            "student_id": kayla_id,
            "student_name": "Kayla Joseph",
            "content": "Q1: 3/8. Q2: 5/6. Q3: 7/12. Q4: 2/5. Q5: 11/15. Q6: 1/4. Q7: 9/10. Q8: 3/7. Q9: 4/9. Q10: 5/8",
            "grade": 33,
            "feedback": "Good effort on the fractions. Questions 4, 7 and 9 are correct with full working shown. Remember to always simplify your final answers. Grade: 33/40 (82%)",
            "submitted_at": days_ago(1),
        },
    ]
    for sub in kayla_subs:
        sub["submission_id"] = gen_id("sub_")
        sub["class_id"] = class_id
        sub["term"] = "Term 1"
        sub["academic_year"] = "2025-2026"
        sub["created_at"] = sub["submitted_at"]
        sub["_demo"] = True
        await db.submissions.insert_one(sub)

    # 5 classmates each submit "Comprehension Exercise"
    for i, uid in enumerate(classmate_ids[:5]):
        u = await db.users.find_one({"user_id": uid}, {"_id": 0, "name": 1})
        score = random.randint(15, 28)
        sub = {
            "submission_id": gen_id("sub_"),
            "assignment_id": asgn_ids["Comprehension Exercise"],
            "student_id": uid,
            "student_name": u["name"] if u else "Student",
            "content": "Response to the comprehension passage.",
            "grade": score,
            "feedback": f"Score: {score}/30",
            "submitted_at": days_ago(random.randint(2, 5)),
            "class_id": class_id,
            "term": "Term 1", "academic_year": "2025-2026",
            "created_at": days_ago(random.randint(2, 5)),
            "_demo": True,
        }
        await db.submissions.insert_one(sub)

    print(f"  ✓ assignments — 4 assignments + 7 submissions created")
    return asgn_ids


async def seed_gradebook(users, subject_ids):
    kayla_id = users["student"]["user_id"]
    teacher_id = users["teacher"]["user_id"]
    admin_id = users["admin"]["user_id"]
    existing = await db.gradebook_entries.count_documents({"student_id": kayla_id, "_demo": True})
    if existing > 0:
        print(f"  ✓ gradebook — already seeded ({existing} entries)")
        return

    GRADES = [
        {"name": "Mathematics",         "ca": 68, "exam": 74},
        {"name": "English Language",     "ca": 75, "exam": 79},
        {"name": "Integrated Science",   "ca": 61, "exam": 65},
        {"name": "Information Technology","ca": 82, "exam": 86},
        {"name": "Social Studies",       "ca": 70, "exam": 72},
        {"name": "Spanish",              "ca": 55, "exam": 58},
        {"name": "Religious Education",  "ca": 88, "exam": 91},
        {"name": "Physical Education",   "ca": 90, "exam": 90},
    ]

    for g in GRADES:
        sid = subject_ids.get(g["name"], "")
        final = calc_final(g["ca"], g["exam"])
        letter = grade_letter(final)
        recorder = teacher_id if g["name"] in ("Mathematics", "English Language") else admin_id
        doc = {
            "entry_id": gen_id("grd_"),
            "student_id": kayla_id,
            "subject_id": sid, "subject_name": g["name"],
            "term": "Term 1", "academic_year": "2025-2026",
            "score_type": "end_of_term",
            "ca_score": g["ca"], "ca_max": 100,
            "exam_score": g["exam"], "exam_max": 100,
            "final_score": final,
            "grade_letter": letter,
            "remark": grade_remark(letter),
            "teacher_comment": _grade_comment(g["name"], letter),
            "recorded_by": recorder,
            "created_at": days_ago(random.randint(1, 7)),
            "_demo": True,
        }
        await db.gradebook_entries.insert_one(doc)

    # CA component entries for Maths and English (classwork + progressive tests)
    for subj in ["Mathematics", "English Language"]:
        sid = subject_ids.get(subj, "")
        components = [
            ("classwork", 78, 80),
            ("progressive_test_1", 65, 70),
            ("progressive_test_2", 72, 80),
        ]
        for comp, score, max_s in components:
            pct = score / max_s * 100
            letter = grade_letter(pct)
            doc = {
                "entry_id": gen_id("grd_"),
                "student_id": kayla_id,
                "subject_id": sid, "subject_name": subj,
                "term": "Term 1", "academic_year": "2025-2026",
                "score_type": comp,
                "ca_score": score, "ca_max": max_s,
                "exam_score": 0, "exam_max": 0,
                "final_score": round(pct, 1),
                "grade_letter": letter,
                "remark": grade_remark(letter),
                "teacher_comment": "",
                "recorded_by": teacher_id,
                "created_at": days_ago(random.randint(7, 14)),
                "_demo": True,
            }
            await db.gradebook_entries.insert_one(doc)

    print(f"  ✓ gradebook — {len(GRADES)} subject grades + CA components for Kayla Joseph")


def _grade_comment(subject, letter):
    comments = {
        "A": f"Excellent performance in {subject}. Keep up the outstanding work!",
        "B+": f"Very good work in {subject}. A little more practice will take you to the top.",
        "B": f"Good effort in {subject}. Focus on exam technique to improve further.",
        "C+": f"Satisfactory performance in {subject}. Please see me for extra support.",
        "D": f"Below expectations in {subject}. Additional practice is strongly recommended.",
    }
    return comments.get(letter, f"Recorded for {subject}, Term 1.")


async def seed_attendance(users, class_id):
    kayla_id = users["student"]["user_id"]
    teacher_id = users["teacher"]["user_id"]

    existing = await db.attendance.count_documents({"class_id": class_id, "_demo": True})
    if existing > 0:
        print(f"  ✓ attendance — already seeded ({existing} records)")
        return

    all_students = [u async for u in db.users.find(
        {"class_id": class_id, "role": "Student"}, {"_id": 0, "user_id": 1, "name": 1}
    )]

    kayla_absent_date = SCHOOL_DAY_DATES[6]   # 1 absent
    kayla_late_date = SCHOOL_DAY_DATES[10]    # 1 late

    for i, date_str in enumerate(SCHOOL_DAY_DATES):
        records = []
        for s in all_students:
            if s["user_id"] == kayla_id:
                if date_str == kayla_absent_date:
                    status = "absent"
                    note = "Excused — medical appointment"
                elif date_str == kayla_late_date:
                    status = "late"
                    note = "Arrived 09:15"
                else:
                    status = "present"
                    note = ""
            else:
                rand = random.random()
                if rand < 0.03:
                    status = "absent"
                    note = ""
                elif rand < 0.07:
                    status = "late"
                    note = ""
                else:
                    status = "present"
                    note = ""
            records.append({
                "student_id": s["user_id"],
                "student_name": s["name"],
                "status": status,
                "note": note,
            })

        doc = {
            "record_id": gen_id("att_"),
            "class_id": class_id, "class_name": "Year 7A",
            "date": date_str,
            "period": 1,
            "teacher_id": teacher_id,
            "teacher_name": users["teacher"]["name"],
            "records": records,
            "created_at": now_iso(),
            "_demo": True,
        }
        await db.attendance.insert_one(doc)

    print(f"  ✓ attendance — {len(SCHOOL_DAY_DATES)} days recorded for Year 7A (16 students)")


async def seed_announcements(users):
    existing = await db.announcements.count_documents({"_demo": True})
    if existing > 0:
        print(f"  ✓ announcements — already seeded")
        return

    sender_id = users["superadmin"]["user_id"]
    sender_name = users["principal"]["name"]

    announcements = [
        {
            "title": "Term 1 Examination Week — November 10–14, 2025",
            "body": (
                "Dear Parents, Students and Staff,\n\n"
                "Please be advised that Term 1 end-of-term examinations will be held from "
                "Monday 10th November to Friday 14th November 2025. "
                "Students are expected to arrive no later than 7:50 AM each day.\n\n"
                "Examination timetables have been shared via the student portal. "
                "Please ensure all students are adequately prepared.\n\n"
                "God bless,\nMs. Sandra Clarke\nPrincipal"
            ),
            "target": "all", "duration_days": 21,
        },
        {
            "title": "Parent-Teacher Conference — Wednesday, October 22nd",
            "body": (
                "Dear Parents and Guardians,\n\n"
                "You are cordially invited to our Term 1 Parent-Teacher Conference on "
                "Wednesday 22nd October 2025, from 1:00 PM – 5:00 PM.\n\n"
                "This is an excellent opportunity to discuss your child's academic progress, "
                "behaviour and overall well-being with their teachers.\n\n"
                "Please book your appointment slot via the Parent Portal or contact the school office.\n\n"
                "We look forward to seeing you,\nThe RightWay Centre of Learning"
            ),
            "target": "parents", "duration_days": 14,
        },
        {
            "title": "Science Fair Registration Now Open!",
            "body": (
                "Attention all students!\n\n"
                "Registration for the Term 1 Science Fair is now open. "
                "Students from Year 7 to Year 11 are invited to submit a project proposal.\n\n"
                "Topics can include Biology, Chemistry, Physics, Environmental Science or Technology.\n\n"
                "Deadline for proposals: Friday 31st October 2025.\n"
                "Submit your proposal to your Science teacher or via the Student Portal.\n\n"
                "Prizes for 1st, 2nd and 3rd place!\n\nGood luck!"
            ),
            "target": "students", "duration_days": 10,
        },
    ]

    now = datetime.now(timezone.utc)
    for a in announcements:
        doc = {
            "announcement_id": gen_id("ann_"),
            "title": a["title"],
            "body": a["body"],
            "target": a["target"],
            "target_ids": [],
            "created_by": sender_id,
            "sender_name": sender_name,
            "sender_role": "Principal",
            "is_active": True,
            "duration_days": a["duration_days"],
            "expires_at": (now + timedelta(days=a["duration_days"])).isoformat(),
            "created_at": days_ago(random.randint(1, 5)),
            "read_by": [],
            "_demo": True,
        }
        await db.announcements.insert_one(doc)

    print(f"  ✓ announcements — 3 active announcements created")


async def seed_finance(users):
    kayla_id = users["student"]["user_id"]
    finance_id = users["finance"]["user_id"]

    existing = await db.invoices_v2.count_documents({"student_id": kayla_id, "_demo": True})
    if existing > 0:
        print(f"  ✓ finance — already seeded")
        return

    invoice_id = gen_id("inv_")
    line_items = [
        {"item_id": gen_id("li_"), "name": "Tuition Fee", "code": "TUI", "category": "tuition", "amount": 6000.00},
        {"item_id": gen_id("li_"), "name": "Extracurricular Activities", "code": "EXT", "category": "activities", "amount": 400.00},
        {"item_id": gen_id("li_"), "name": "Library & Resource Fee", "code": "LIB", "category": "resources", "amount": 200.00},
    ]
    total = sum(li["amount"] for li in line_items)
    amount_paid = 4000.00
    outstanding = total - amount_paid

    invoice = {
        "invoice_id": invoice_id,
        "student_id": kayla_id,
        "student_name": "Kayla Joseph",
        "term": "Term 1",
        "academic_year": "2025-2026",
        "total_due": total,
        "amount_paid": amount_paid,
        "status": "partial",
        "due_at": days_ago(-14),  # due in 14 days
        "issued_at": days_ago(25),
        "currency": "TTD",
        "created_by": finance_id,
        "notes": "Term 1 Fee Statement — The RightWay Centre of Learning",
        "created_at": days_ago(25),
        "_demo": True,
    }
    await db.invoices_v2.insert_one(invoice)

    for li in line_items:
        li["invoice_id"] = invoice_id
        li["student_id"] = kayla_id
        li["created_at"] = days_ago(25)
        li["_demo"] = True
        await db.invoice_line_items.insert_one(li)

    # Payment allocation
    alloc = {
        "allocation_id": gen_id("alloc_"),
        "invoice_id": invoice_id,
        "student_id": kayla_id,
        "student_name": "Kayla Joseph",
        "allocated_amount": amount_paid,
        "payment_method": "bank_transfer",
        "payment_reference": "TT-20250905-001",
        "payment_date": "2025-09-05",
        "recorded_by": finance_id,
        "notes": "Initial Term 1 payment",
        "created_at": days_ago(20),
        "_demo": True,
    }
    await db.allocations.insert_one(alloc)

    # Student account summary
    await db.student_accounts.update_one(
        {"student_id": kayla_id},
        {"$set": {
            "student_id": kayla_id,
            "student_name": "Kayla Joseph",
            "current_balance": round(outstanding, 2),
            "credit_balance": 0,
            "arrears_balance": round(outstanding, 2),
            "total_invoiced": round(total, 2),
            "total_paid": round(amount_paid, 2),
            "total_credits": 0,
            "currency": "TTD",
            "updated_at": now_iso(),
            "_demo": True,
        }},
        upsert=True
    )

    print(f"  ✓ finance — Invoice TTD {total:,.2f}, paid TTD {amount_paid:,.2f}, outstanding TTD {outstanding:,.2f}")


async def seed_clock_entries(users):
    staff = [users["teacher"], users["headteacher"], users["hr"]]
    existing = await db.clock_entries.count_documents({"_demo": True})
    if existing > 0:
        print(f"  ✓ clock_entries — already seeded ({existing})")
        return

    clock_patterns = {
        users["teacher"]["user_id"]:     ("07:45", "16:00"),
        users["headteacher"]["user_id"]: ("07:30", "16:30"),
        users["hr"]["user_id"]:          ("08:00", "17:00"),
    }

    for date_str in SCHOOL_DAY_DATES:
        for person in staff:
            uid = person["user_id"]
            cin_time, cout_time = clock_patterns[uid]
            base_date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            cin_h, cin_m = map(int, cin_time.split(":"))
            cout_h, cout_m = map(int, cout_time.split(":"))
            # Small random variation ±5 mins
            cin_dt = base_date.replace(hour=cin_h, minute=cin_m) + timedelta(minutes=random.randint(-5, 5))
            cout_dt = base_date.replace(hour=cout_h, minute=cout_m) + timedelta(minutes=random.randint(-5, 10))

            doc = {
                "entry_id": gen_id("clk_"),
                "user_id": uid,
                "user_name": person["name"],
                "clock_in": cin_dt.isoformat(),
                "clock_out": cout_dt.isoformat(),
                "method": "manual",
                "created_at": cin_dt.isoformat(),
                "_demo": True,
            }
            await db.clock_entries.insert_one(doc)

    print(f"  ✓ clock_entries — {len(SCHOOL_DAY_DATES) * len(staff)} entries for 3 staff over {len(SCHOOL_DAY_DATES)} days")


async def seed_behaviour(users, class_id):
    kayla_id = users["student"]["user_id"]
    teacher_id = users["teacher"]["user_id"]

    existing = await db.behaviour_incidents.count_documents({"student_id": kayla_id, "_demo": True})
    if existing > 0:
        print(f"  ✓ behaviour — already seeded")
        return

    doc = {
        "incident_id": gen_id("beh_"),
        "student_id": kayla_id,
        "student_name": "Kayla Joseph",
        "class_id": class_id,
        "class_name": "Year 7A",
        "year_group": "Year 7",
        "reported_by": teacher_id,
        "reporter_name": users["teacher"]["name"],
        "incident_type": "minor",
        "category": "Classroom Disruption",
        "description": "Student was talking during independent work time and distracted nearby classmates. "
                       "Verbal warning given. Student apologised and returned to task promptly.",
        "action_taken": "Verbal warning. Reminder of classroom expectations given.",
        "date": date_str(5),
        "status": "resolved",
        "resolved_at": date_str(5),
        "resolved_by": teacher_id,
        "resolution_note": "Student settled well for remainder of lesson. No further issues.",
        "academic_year": "2025-2026",
        "term": "Term 1",
        "created_at": days_ago(5),
        "_demo": True,
    }
    await db.behaviour_incidents.insert_one(doc)
    print(f"  ✓ behaviour — 1 minor incident (resolved) for Kayla Joseph")


async def seed_quizzes(users, class_id, subject_ids):
    teacher_id = users["teacher"]["user_id"]
    kayla_id = users["student"]["user_id"]

    existing = await db.quizzes.count_documents({"_demo": True})
    if existing > 0:
        print(f"  ✓ quizzes — already seeded")
        return

    maths_quiz_id = gen_id("quiz_")
    english_quiz_id = gen_id("quiz_")

    quizzes = [
        {
            "quiz_id": maths_quiz_id,
            "title": "Number Systems Quiz",
            "subject": "Mathematics",
            "subject_id": subject_ids.get("Mathematics", ""),
            "year_group": "Year 7",
            "class_ids": [class_id],
            "questions": [
                {"number": 1, "question": "What is the value of the digit 4 in the number 347,892?", "options": {"A": "4", "B": "40,000", "C": "4,000", "D": "400"}, "correct": "B", "explanation": "The digit 4 is in the ten-thousands place, so its value is 40,000."},
                {"number": 2, "question": "Which number is largest?", "options": {"A": "98,765", "B": "987,65", "C": "9,876", "D": "987,650"}, "correct": "D", "explanation": "987,650 has 6 digits and the highest value."},
                {"number": 3, "question": "Round 47,381 to the nearest thousand.", "options": {"A": "47,000", "B": "48,000", "C": "47,400", "D": "50,000"}, "correct": "A", "explanation": "The hundreds digit is 3 (< 5), so we round down to 47,000."},
                {"number": 4, "question": "In 526,419 — what digit is in the hundreds place?", "options": {"A": "5", "B": "4", "C": "1", "D": "9"}, "correct": "B", "explanation": "526,419: 5=hundred-thousands, 2=ten-thousands, 6=thousands, 4=hundreds, 1=tens, 9=ones."},
                {"number": 5, "question": "What is 6 × 10,000 + 3 × 1,000 + 5 × 100 + 2 × 10 + 1?", "options": {"A": "63,521", "B": "6,3521", "C": "63,251", "D": "63,512"}, "correct": "A", "explanation": "60,000 + 3,000 + 500 + 20 + 1 = 63,521"},
            ],
        },
        {
            "quiz_id": english_quiz_id,
            "title": "English Vocabulary Quiz",
            "subject": "English Language",
            "subject_id": subject_ids.get("English Language", ""),
            "year_group": "Year 7",
            "class_ids": [class_id],
            "questions": [
                {"number": 1, "question": "Which sentence contains a simile?", "options": {"A": "The sun smiled down on us.", "B": "She ran as fast as a cheetah.", "C": "The angry clouds rolled in.", "D": "His heart sank."}, "correct": "B", "explanation": "A simile uses 'like' or 'as' to compare — 'as fast as a cheetah' is a simile."},
                {"number": 2, "question": "What does the word 'vivid' mean?", "options": {"A": "Dull and boring", "B": "Very bright or detailed", "C": "Very quiet", "D": "Old-fashioned"}, "correct": "B", "explanation": "'Vivid' means producing strong, clear images — bright and lifelike."},
                {"number": 3, "question": "Which technique gives human qualities to a non-human thing?", "options": {"A": "Metaphor", "B": "Alliteration", "C": "Personification", "D": "Onomatopoeia"}, "correct": "C", "explanation": "Personification gives human characteristics to objects or ideas."},
                {"number": 4, "question": "What is a synonym for 'enormous'?", "options": {"A": "Tiny", "B": "Gigantic", "C": "Average", "D": "Quiet"}, "correct": "B", "explanation": "'Gigantic' and 'enormous' both mean extremely large."},
                {"number": 5, "question": "Which word best describes information stated directly in a text?", "options": {"A": "Implicit", "B": "Inferred", "C": "Explicit", "D": "Ambiguous"}, "correct": "C", "explanation": "'Explicit' information is stated directly and clearly in the text."},
            ],
        },
    ]

    for q in quizzes:
        q.update({
            "teacher_id": teacher_id,
            "teacher_name": users["teacher"]["name"],
            "term": "Term 1",
            "academic_year": "2025-2026",
            "time_limit_minutes": 15,
            "published": True,
            "published_at": days_ago(7),
            "created_at": days_ago(10),
            "_demo": True,
        })
        await db.quizzes.insert_one(q)

    # Kayla completed the Maths quiz (4/5)
    attempt = {
        "attempt_id": gen_id("qattempt_"),
        "quiz_id": maths_quiz_id,
        "student_id": kayla_id,
        "student_name": "Kayla Joseph",
        "answers": {"1": "B", "2": "D", "3": "A", "4": "B", "5": "A"},  # Q2 wrong, Q5 wrong
        "score": 3,
        "total": 5,
        "percentage": 60.0,
        "grade_letter": "C",
        "submitted_at": days_ago(4),
        "time_taken_seconds": 420,
        "class_id": class_id,
        "_demo": True,
    }
    # Actually let's make Q5 wrong (answer D instead of A) - score 4/5
    attempt["answers"] = {"1": "B", "2": "D", "3": "A", "4": "B", "5": "A"}
    attempt["score"] = 4
    attempt["percentage"] = 80.0
    attempt["grade_letter"] = "A"
    await db.quiz_attempts.insert_one(attempt)

    print(f"  ✓ quizzes — 2 published quizzes (Maths completed by Kayla, English pending)")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

async def main():
    print(f"\n{'='*60}")
    print(f"  RightWay Demo Data Seeder")
    print(f"  Database: {os.environ['DB_NAME']}")
    print(f"{'='*60}\n")

    if await already_seeded():
        print("  [SKIP] Demo data already seeded. Run clear_demo_data.py first to re-seed.\n")
        client.close()
        return

    print("Fetching demo user accounts...")
    users = await get_demo_users()
    if len(users) < 8:
        print(f"  [ERROR] Only {len(users)}/10 demo users found. Run seed_users.py first.\n")
        client.close()
        return

    print(f"  ✓ All {len(users)} demo users found\n")
    print("Seeding collections...\n")

    await seed_app_settings()
    subject_ids = await seed_subjects()
    class_id, all_student_ids, classmate_ids = await seed_class(users, subject_ids)
    await seed_timetable(users, class_id, subject_ids)
    await seed_lessons(users, class_id, subject_ids)
    await seed_assignments(users, class_id, subject_ids)
    await seed_gradebook(users, subject_ids)
    await seed_attendance(users, class_id)
    await seed_announcements(users)
    await seed_finance(users)
    await seed_clock_entries(users)
    await seed_behaviour(users, class_id)
    await seed_quizzes(users, class_id, subject_ids)

    print(f"\n{'='*60}")
    print(f"  SEED COMPLETE")
    print(f"{'='*60}")
    print(f"""
  Demo Logins:
  ┌─────────────────────────────────────────────────────┐
  │  CEO / Admin   ceo@rightway.demo       / ceo123      │
  │  Teacher       teacher@rightway.demo   / teacher123  │
  │  HeadTeacher   headteacher@rightway.demo / headteacher123 │
  │  Student       student@rightway.demo   / student123  │
  │  Parent        parent@rightway.demo    / parent123   │
  │  Finance       finance@rightway.demo   / finance123  │
  │  HR            hr@rightway.demo        / hr123       │
  └─────────────────────────────────────────────────────┘

  To clear demo data:
      python scripts/clear_demo_data.py
""")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
