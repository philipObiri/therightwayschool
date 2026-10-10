"""
Timetable Generator for TCIS LMS.
Constraint-satisfaction scheduler that assigns subjects to time slots
while avoiding teacher clashes across year groups.
"""
import os
import random
from fastapi import APIRouter, Depends, HTTPException, Body
from database import db, get_active_term
from models import gen_id
from auth import get_current_user, require_roles
from datetime import datetime, timezone

router = APIRouter(prefix="/api/timetable-generator", tags=["timetable-generator"])

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

# Default time slots for junior (Year 7-9) and senior (Year 10-13)
SLOTS_JUNIOR = [
    ("08:00", "08:40"), ("08:40", "09:20"), ("09:20", "10:00"), ("10:00", "10:40"),
    # Break
    ("11:05", "11:45"), ("11:45", "12:25"), ("12:25", "13:05"), ("13:05", "13:45"),
    # Lunch
    ("14:25", "15:05"), ("15:05", "15:45"),
]

SLOTS_SENIOR = [
    ("08:00", "08:40"), ("08:40", "09:20"), ("09:20", "10:00"), ("10:00", "10:40"),
    ("11:05", "11:45"), ("11:45", "12:25"), ("12:25", "13:05"), ("13:05", "13:45"),
    ("13:45", "14:25"), ("14:25", "15:05"),
]

# Subject config: how many periods per week each subject gets
SUBJECT_PERIODS = {
    # Junior (Year 7-9)
    "junior": {
        "Mathematics": 4, "English Language": 4, "Combined Science": 4,
        "French": 4, "Information Technology": 4, "Literature": 4,
        "Christian Doctrine": 4, "Arts and Craft": 4, "Physical Education": 4,
        "Worship": 2, "Library": 2,
    },
    # Year 9 specializations
    "year9": {
        "Mathematics": 4, "English Language": 4, "Information Technology": 4,
        "French": 4, "Literature": 4, "Christian Doctrine": 4,
        "Combined Science (Bio)": 2, "Combined Science (Phy)": 4, "Combined Science (Chem)": 2,
        "Economics": 4, "Business Studies": 3, "Accounting": 4,
        "Physical Education": 4, "Arts and Craft": 2, "Worship": 2,
    },
    # Senior (Year 10-11): more varied
    "senior": {
        "Extended Maths": 4, "English Language": 4, "Chemistry": 4,
        "Physics / Coordinated Science": 4, "Biology / Coordinated Science": 4,
        "Economics": 4, "French Language": 4, "Information Technology": 4,
        "Business Studies": 2, "Literature": 2, "Sociology / Add Maths": 4,
        "Geography / Accounting": 4, "Worship": 2, "Club Activity": 2,
    },
}


@router.get("/config")
async def get_generator_config(user: dict = Depends(require_roles("Admin", "SuperAdmin", "CEO", "Founder", "Principal", "HeadTeacher"))):
    """Get all teachers, subjects, year groups for the generator UI."""
    teachers = await db.users.find(
        {"role": {"$in": ["Teacher", "HeadTeacher"]}, "teaching_subjects": {"$exists": True, "$ne": []}},
        {"_id": 0, "user_id": 1, "name": 1, "teaching_subjects": 1, "assigned_year_groups": 1}
    ).to_list(100)

    # Also include SuperAdmin/Admin who teach
    admin_teachers = await db.users.find(
        {"role": {"$in": ["SuperAdmin", "Admin"]}, "teaching_subjects": {"$exists": True, "$ne": []}},
        {"_id": 0, "user_id": 1, "name": 1, "teaching_subjects": 1, "assigned_year_groups": 1}
    ).to_list(20)
    teachers.extend(admin_teachers)

    subjects = await db.subjects.find({}, {"_id": 0, "subject_id": 1, "name": 1}).to_list(100)
    year_groups = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13"]

    return {
        "teachers": teachers,
        "subjects": [s["name"] for s in subjects],
        "year_groups": year_groups,
        "days": DAYS,
        "slots_junior": SLOTS_JUNIOR,
        "slots_senior": SLOTS_SENIOR,
    }


@router.post("/generate")
async def generate_timetable(
    data: dict = Body(...),
    user: dict = Depends(require_roles("Admin", "SuperAdmin", "CEO", "Founder", "Principal", "HeadTeacher"))
):
    """
    Generate a clash-free timetable for specified year groups.

    Input: { year_groups: ["Year 7", ...], subject_config: {year_group: {subject: periods_per_week}} }
    """
    target_years = data.get("year_groups", ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13"])

    # Fetch teachers
    all_teachers = await db.users.find(
        {"teaching_subjects": {"$exists": True, "$ne": []}},
        {"_id": 0, "user_id": 1, "name": 1, "teaching_subjects": 1, "assigned_year_groups": 1}
    ).to_list(200)

    # Build teacher-subject-year mapping
    teacher_map = {}  # subject+year → [teacher]
    for t in all_teachers:
        for subj in t.get("teaching_subjects", []):
            for yg in t.get("assigned_year_groups", []):
                if yg in target_years:
                    key = f"{subj}||{yg}"
                    if key not in teacher_map:
                        teacher_map[key] = []
                    teacher_map[key].append({"user_id": t["user_id"], "name": t["name"]})

    # Subject requirements per year group
    custom_config = data.get("subject_config", {})

    results = {}
    all_clashes = []
    # Global teacher schedule: teacher_id → set of (day, slot_idx)
    global_teacher_busy = {}

    for yg in sorted(target_years, key=lambda x: int(x.replace("Year ", ""))):
        year_num = int(yg.replace("Year ", ""))
        is_junior = year_num <= 9
        slots = SLOTS_JUNIOR if is_junior else SLOTS_SENIOR
        total_slots = len(DAYS) * len(slots)

        # Get subject config for this year
        if yg in custom_config:
            subj_periods = custom_config[yg]
        elif yg == "Year 9":
            subj_periods = SUBJECT_PERIODS.get("year9", SUBJECT_PERIODS["junior"])
        elif is_junior:
            subj_periods = SUBJECT_PERIODS["junior"]
        else:
            subj_periods = SUBJECT_PERIODS["senior"]

        # Build assignment list: (subject, teacher_id, teacher_name) repeated for period count
        assignments = []
        unassigned_subjects = []
        for subj, count in subj_periods.items():
            # Find a teacher for this subject + year
            # Try exact match first, then fuzzy match
            teachers_for = teacher_map.get(f"{subj}||{yg}", [])
            if not teachers_for:
                # Fuzzy: try matching partial subject names
                for key, tlist in teacher_map.items():
                    stored_subj, stored_yg = key.split("||")
                    if stored_yg == yg and (
                        stored_subj.lower() in subj.lower() or
                        subj.lower() in stored_subj.lower() or
                        any(w in subj.lower() for w in stored_subj.lower().split())
                    ):
                        teachers_for = tlist
                        break

            if teachers_for:
                teacher = teachers_for[0]  # Primary teacher
                for _ in range(count):
                    assignments.append((subj, teacher["user_id"], teacher["name"]))
            else:
                unassigned_subjects.append({"subject": subj, "periods": count, "reason": "No teacher found"})
                for _ in range(count):
                    assignments.append((subj, None, "TBD"))

        # Shuffle to randomize placement
        random.shuffle(assignments)

        # Schedule: try to place each assignment in a slot avoiding teacher clashes
        grid = {}  # (day, slot_idx) → assignment
        for day in DAYS:
            for si in range(len(slots)):
                grid[(day, si)] = None

        placed = []
        failed = []

        for subj, teacher_id, teacher_name in assignments:
            best_slot = None
            # Try to place in a slot where the teacher isn't busy
            available_slots = [(d, si) for d in DAYS for si in range(len(slots)) if grid[(d, si)] is None]
            random.shuffle(available_slots)

            for d, si in available_slots:
                # Check teacher clash
                if teacher_id and (teacher_id, d, si) in global_teacher_busy.get(teacher_id, set()):
                    continue
                # Try to spread subjects across days (prefer days with fewer of same subject)
                best_slot = (d, si)
                break

            if best_slot:
                d, si = best_slot
                grid[(d, si)] = {"subject": subj, "teacher_id": teacher_id, "teacher_name": teacher_name}
                placed.append({"day": d, "slot": si, "subject": subj, "teacher": teacher_name})
                if teacher_id:
                    if teacher_id not in global_teacher_busy:
                        global_teacher_busy[teacher_id] = set()
                    global_teacher_busy[teacher_id].add((teacher_id, d, si))
            else:
                # Force-place but flag as clash
                for d, si in [(d, si) for d in DAYS for si in range(len(slots)) if grid[(d, si)] is None]:
                    grid[(d, si)] = {"subject": subj, "teacher_id": teacher_id, "teacher_name": teacher_name, "clash": True}
                    all_clashes.append({"year_group": yg, "day": d, "slot": f"{slots[si][0]}-{slots[si][1]}", "subject": subj, "teacher": teacher_name, "reason": "Teacher unavailable at this slot"})
                    placed.append({"day": d, "slot": si, "subject": subj, "teacher": teacher_name, "clash": True})
                    break
                else:
                    failed.append({"subject": subj, "teacher": teacher_name, "reason": "No slots available"})

        # Convert grid to timetable entries
        entries = []
        for d_idx, day in enumerate(DAYS):
            for si in range(len(slots)):
                cell = grid[(day, si)]
                if cell:
                    entries.append({
                        "day": day,
                        "start_time": slots[si][0],
                        "end_time": slots[si][1],
                        "subject": cell["subject"],
                        "teacher_name": cell.get("teacher_name", "TBD"),
                        "teacher_id": cell.get("teacher_id", ""),
                        "clash": cell.get("clash", False),
                    })

        results[yg] = {
            "year_group": yg,
            "entries": entries,
            "total_placed": len(placed),
            "total_slots": total_slots,
            "clashes": [c for c in all_clashes if c["year_group"] == yg],
            "unassigned_subjects": unassigned_subjects,
            "failed_placements": failed,
        }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "year_groups": results,
        "total_clashes": len(all_clashes),
        "clashes": all_clashes,
    }


@router.post("/apply")
async def apply_generated_timetable(
    data: dict = Body(...),
    user: dict = Depends(require_roles("Admin", "SuperAdmin", "CEO", "Founder", "Principal"))
):
    """Save the generated timetable to the database, replacing existing entries for specified year groups."""
    timetable = data.get("timetable", {})
    if not timetable:
        raise HTTPException(400, "No timetable data provided")

    now = datetime.now(timezone.utc).isoformat()
    total = 0

    for yg, yg_data in timetable.items():
        entries = yg_data.get("entries", [])
        if not entries:
            continue
        # Delete existing
        await db.timetable_v2.delete_many({"year_group": yg})
        # Insert new
        for e in entries:
            await db.timetable_v2.insert_one({
                "entry_id": gen_id("tt_"),
                "year_group": yg,
                "day": e["day"],
                "start_time": e["start_time"],
                "end_time": e["end_time"],
                "subject": e["subject"],
                "teacher": e.get("teacher_name", ""),
                "teacher_id": e.get("teacher_id", ""),
                "room": "",
                "generated": True,
                "generated_at": now,
            })
            total += 1

    return {"message": f"Applied timetable: {total} entries across {len(timetable)} year groups", "count": total}
