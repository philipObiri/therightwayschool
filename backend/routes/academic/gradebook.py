from fastapi import APIRouter, Depends, HTTPException, Body, Response
from database import db, get_active_term
from models import gen_id
from auth import get_current_user, require_roles, log_audit
from datetime import datetime, timezone
from routes.working_papers.working_paper import log_activity
from fpdf import FPDF
import io
import os

router = APIRouter(prefix="/api/gradebook", tags=["gradebook"])

DEFAULT_WEIGHTS = {"continuous_assessment": 30, "end_of_term_exam": 70}


async def get_weights():
    settings = await db.gradebook_settings.find_one({"key": "weights"}, {"_id": 0})
    return settings.get("weights", DEFAULT_WEIGHTS) if settings else DEFAULT_WEIGHTS


def calculate_final(ca_score, ca_max, exam_score, exam_max, weights):
    ca_pct = (ca_score / ca_max * 100) if ca_max else 0
    exam_pct = (exam_score / exam_max * 100) if exam_max else 0
    final = (ca_pct * weights["continuous_assessment"] / 100) + (exam_pct * weights["end_of_term_exam"] / 100)
    return round(final, 1)


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


def grade_gpa(letter):
    return {
        "A*": 4.00, "A": 3.67, "B+": 3.33, "B": 3.00,
        "C+": 2.67, "C": 2.33, "D": 2.00, "E": 1.67, "F": 1.00, "U": 0.00
    }.get(letter, 0.00)


# ─── Settings ───
@router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    return await get_weights()


@router.put("/settings")
async def update_settings(data: dict = Body(...), user: dict = Depends(require_roles("Admin", "SuperAdmin"))):
    weights = {"continuous_assessment": data.get("continuous_assessment", 30), "end_of_term_exam": data.get("end_of_term_exam", 70)}
    await db.gradebook_settings.update_one({"key": "weights"}, {"$set": {"key": "weights", "weights": weights}}, upsert=True)
    await log_audit(user["user_id"], user["name"], "update_grade_weights", "gradebook", "", {"weights": weights})
    return weights


# ─── Grade Entries ───
@router.post("/entries")
async def record_grade(data: dict = Body(...), user: dict = Depends(require_roles("Admin", "SuperAdmin", "Teacher", "HeadTeacher", "Principal", "HeadOfAcademics"))):
    weights = await get_weights()
    ca_score = data.get("ca_score", 0)
    ca_max = data.get("ca_max", 100)
    exam_score = data.get("exam_score", 0)
    exam_max = data.get("exam_max", 100)
    final = calculate_final(ca_score, ca_max, exam_score, exam_max, weights)
    letter = grade_letter(final)

    entry_id = gen_id("grd_")
    score_type = data.get("score_type", "end_of_term")
    doc = {
        "entry_id": entry_id, "student_id": data.get("student_id"),
        "subject_id": data.get("subject_id"), "term": data.get("term", "Term 1"),
        "academic_year": data.get("academic_year", "2025-2026"),
        "score_type": score_type,
        "ca_score": ca_score, "ca_max": ca_max,
        "exam_score": exam_score, "exam_max": exam_max,
        "final_score": final, "grade_letter": letter,
        "remark": grade_remark(letter),
        "teacher_comment": data.get("teacher_comment", ""),
        "recorded_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # Upsert: update if exists for same student/subject/term/score_type
    existing = await db.gradebook_entries.find_one(
        {"student_id": data.get("student_id"), "subject_id": data.get("subject_id"), "term": data.get("term", "Term 1"), "score_type": score_type},
        {"_id": 0}
    )
    if existing:
        before = {k: v for k, v in existing.items() if k != "_id"}
        await db.gradebook_entries.update_one(
            {"entry_id": existing["entry_id"]},
            {"$set": {**doc, "entry_id": existing["entry_id"]}}
        )
        await log_audit(user["user_id"], user["name"], "update_grade", "gradebook", existing["entry_id"], {"before": before, "after": doc})
        doc["entry_id"] = existing["entry_id"]
    else:
        await db.gradebook_entries.insert_one(doc)
        await log_audit(user["user_id"], user["name"], "record_grade", "gradebook", entry_id)
        await log_activity(user["user_id"], user["name"], "enter_scores", f"Entered scores for {data.get('subject_id','')}", "gradebook", entry_id)

    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/entries")
async def list_entries(
    student_id: str = None, subject_id: str = None, term: str = None,
    class_id: str = None, score_type: str = None, user: dict = Depends(get_current_user)
):
    query = {}
    if student_id: query["student_id"] = student_id
    if subject_id: query["subject_id"] = subject_id
    # Auto-filter by active term
    if term:
        query["term"] = term
    else:
        active_term, _ = await get_active_term()
        query["term"] = active_term
    if score_type: query["score_type"] = score_type
    if class_id:
        students = await db.users.find({"role": "Student", "class_id": class_id}, {"_id": 0, "user_id": 1}).to_list(200)
        query["student_id"] = {"$in": [s["user_id"] for s in students]}
    if user.get("role") == "Student":
        query["student_id"] = user["user_id"]

    entries = await db.gradebook_entries.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)

    # Bulk fetch students and subjects to avoid N+1
    student_ids = list({e.get("student_id") for e in entries if e.get("student_id")})
    subject_ids = list({e.get("subject_id") for e in entries if e.get("subject_id")})
    students_list = await db.users.find({"user_id": {"$in": student_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(student_ids)) if student_ids else []
    subjects_list = await db.subjects.find({"subject_id": {"$in": subject_ids}}, {"_id": 0, "subject_id": 1, "name": 1, "code": 1}).to_list(len(subject_ids)) if subject_ids else []
    student_map = {s["user_id"]: s for s in students_list}
    subject_map = {s["subject_id"]: s for s in subjects_list}

    for e in entries:
        student = student_map.get(e.get("student_id"))
        subject = subject_map.get(e.get("subject_id"))
        e["student_name"] = student["name"] if student else ""
        e["subject_name"] = subject["name"] if subject else ""
        e["subject_code"] = subject.get("code", "") if subject else ""
    return entries


# CA component types that make up the Continuous Assessment
CA_COMPONENTS = ["classwork", "progressive_test_1", "progressive_test_2", "progressive_test_3", "mid_term"]

@router.get("/ca-breakdown")
async def get_ca_breakdown(
    class_id: str, subject_id: str, term: str = None,
    user: dict = Depends(get_current_user)
):
    """Get CA component scores for all students in a class/subject, and auto-calculate CA (30%)."""
    if not term:
        term, _ = await get_active_term()

    # Get all students in the class
    students = await db.users.find(
        {"role": "Student", "class_id": class_id, "is_active": True},
        {"_id": 0, "user_id": 1, "name": 1}
    ).sort("name", 1).to_list(200)
    student_ids = [s["user_id"] for s in students]

    # Get all CA component entries for these students
    entries = await db.gradebook_entries.find(
        {"student_id": {"$in": student_ids}, "subject_id": subject_id, "term": term,
         "score_type": {"$in": CA_COMPONENTS}},
        {"_id": 0, "student_id": 1, "score_type": 1, "ca_score": 1, "exam_score": 1}
    ).to_list(5000)

    # Build breakdown per student
    breakdown = {}
    for e in entries:
        sid = e["student_id"]
        if sid not in breakdown:
            breakdown[sid] = {}
        # Use the raw score (ca_score or exam_score depending on what was entered)
        score = e.get("exam_score") or e.get("ca_score") or 0
        breakdown[sid][e["score_type"]] = score

    # Calculate CA for each student
    result = []
    for s in students:
        sid = s["user_id"]
        components = breakdown.get(sid, {})
        classwork = components.get("classwork", 0)
        prog1 = components.get("progressive_test_1", 0)
        prog2 = components.get("progressive_test_2", 0)
        prog3 = components.get("progressive_test_3", 0)
        midterm = components.get("mid_term", 0)

        # Sum all components
        total_raw = classwork + prog1 + prog2 + prog3 + midterm
        # Calculate 30% CA score (total possible: classwork/100 + 3 progs/100 + midterm/100 = 500)
        # Normalize to 30: (total_raw / max_possible) * 30
        # Average of entered scores, then scale to 30
        entered = [v for v in [classwork, prog1, prog2, prog3, midterm] if v > 0]
        if entered:
            avg_pct = sum(entered) / (len(entered) * 100) * 100  # average percentage
            ca_30 = round(avg_pct * 30 / 100, 1)  # scale to 30
        else:
            ca_30 = 0

        result.append({
            "student_id": sid,
            "student_name": s["name"],
            "classwork": classwork,
            "progressive_1": prog1,
            "progressive_2": prog2,
            "progressive_3": prog3,
            "midterm": midterm,
            "total_raw": total_raw,
            "ca_30": ca_30,
        })

    return result



# ─── Class Gradebook View ───
@router.get("/class/{class_id}")
async def class_gradebook(class_id: str, term: str = "Term 1", user: dict = Depends(get_current_user)):
    students = await db.users.find({"role": "Student", "class_id": class_id}, {"_id": 0, "password_hash": 0}).to_list(200)
    cls = await db.classes.find_one({"class_id": class_id}, {"_id": 0})
    subjects = await db.subjects.find({}, {"_id": 0}).to_list(50)

    gradebook = []
    # Batch fetch all grades for this class/term
    student_ids = [s["user_id"] for s in students]
    all_grades = await db.gradebook_entries.find(
        {"student_id": {"$in": student_ids}, "term": term}, {"_id": 0}
    ).to_list(5000)
    grade_map = {}
    for g in all_grades:
        grade_map[(g["student_id"], g.get("subject_id", ""))] = g

    for s in students:
        row = {"student_id": s["user_id"], "name": s["name"], "subjects": {}}
        for subj in subjects:
            entry = grade_map.get((s["user_id"], subj["subject_id"]))
            if entry:
                row["subjects"][subj["subject_id"]] = {
                    "ca": entry.get("ca_score", 0), "exam": entry.get("exam_score", 0),
                    "final": entry.get("final_score", 0), "grade": entry.get("grade_letter", ""),
                    "entry_id": entry.get("entry_id", "")
                }
        # Calculate average
        scores = [v["final"] for v in row["subjects"].values() if v.get("final")]
        row["average"] = round(sum(scores) / len(scores), 1) if scores else 0
        row["position"] = 0  # Calculated after sorting
        gradebook.append(row)

    gradebook.sort(key=lambda x: -x["average"])
    for i, row in enumerate(gradebook):
        row["position"] = i + 1

    return {
        "class": cls, "term": term,
        "subjects": [{"subject_id": s["subject_id"], "name": s["name"], "code": s.get("code", "")} for s in subjects],
        "students": gradebook
    }


# ─── Report Type Definitions ───
REPORT_TYPES = {
    "end_of_term": {
        "label": "End of Term",
        "score_types": ["end_of_term"],
        "description": "Full academic report with CA and End of Term exam scores"
    },
    "mid_term": {
        "label": "Mid Term",
        "score_types": ["mid_term"],
        "description": "Mid-term examination results"
    },
    "mocks": {
        "label": "Mocks",
        "score_types": ["mock_exam"],
        "description": "Mock examination results"
    },
    "progressives": {
        "label": "Progressives",
        "score_types": ["progressive_test_1", "progressive_test_2", "progressive_test_3"],
        "description": "Progressive test results (Tests 1, 2 & 3)"
    }
}


@router.get("/report-types/{student_id}")
async def get_report_availability(student_id: str, term: str = None, user: dict = Depends(get_current_user)):
    """Check which report types have data for a student in a given term."""
    if not term:
        term, _ = await get_active_term()

    entries = await db.gradebook_entries.find(
        {"student_id": student_id, "term": term},
        {"_id": 0, "score_type": 1, "subject_id": 1}
    ).to_list(500)

    score_types_present = set(e.get("score_type", "") for e in entries)

    result = []
    for key, info in REPORT_TYPES.items():
        has_data = any(st in score_types_present for st in info["score_types"])
        count = len([e for e in entries if e.get("score_type") in info["score_types"]])
        # Count unique subjects
        subjects = set(e.get("subject_id") for e in entries if e.get("score_type") in info["score_types"])
        result.append({
            "type": key,
            "label": info["label"],
            "description": info["description"],
            "has_data": has_data,
            "entry_count": count,
            "subject_count": len(subjects)
        })

    return {"student_id": student_id, "term": term, "report_types": result}


# ─── Report Card ───
@router.get("/report-card/{student_id}")
async def report_card_data(student_id: str, term: str = "Term 1", report_type: str = None, user: dict = Depends(get_current_user)):
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0, "password_hash": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    cls = await db.classes.find_one({"class_id": student.get("class_id")}, {"_id": 0})

    # Build query with optional report_type filter
    query = {"student_id": student_id, "term": term}
    report_label = "Full Academic Report"
    if report_type and report_type in REPORT_TYPES:
        query["score_type"] = {"$in": REPORT_TYPES[report_type]["score_types"]}
        report_label = REPORT_TYPES[report_type]["label"] + " Report"

    entries = await db.gradebook_entries.find(query, {"_id": 0}).to_list(200)

    # Bulk fetch subjects to avoid N+1
    subj_ids = list({e.get("subject_id") for e in entries if e.get("subject_id")})
    subj_list = await db.subjects.find({"subject_id": {"$in": subj_ids}}, {"_id": 0}).to_list(len(subj_ids)) if subj_ids else []
    subj_map = {s["subject_id"]: s for s in subj_list}

    grades = []
    if report_type == "progressives":
        # Group progressive entries by subject
        subj_entries = {}
        for e in entries:
            sid = e.get("subject_id", "")
            if sid not in subj_entries:
                subj_entries[sid] = {}
            subj_entries[sid][e.get("score_type", "")] = e

        for sid, tests in subj_entries.items():
            subj = subj_map.get(sid)
            p1 = tests.get("progressive_test_1", {})
            p2 = tests.get("progressive_test_2", {})
            p3 = tests.get("progressive_test_3", {})
            scores = []
            for p in [p1, p2, p3]:
                s = p.get("exam_score") or p.get("ca_score") or 0
                if s > 0:
                    scores.append(s)
            avg = round(sum(scores) / len(scores), 1) if scores else 0
            letter = grade_letter(avg)
            grades.append({
                "subject": subj["name"] if subj else "",
                "code": subj.get("code", "") if subj else "",
                "progressive_1": p1.get("exam_score") or p1.get("ca_score") or 0,
                "progressive_2": p2.get("exam_score") or p2.get("ca_score") or 0,
                "progressive_3": p3.get("exam_score") or p3.get("ca_score") or 0,
                "average": avg,
                "final_score": avg,
                "grade": letter,
                "remark": grade_remark(letter),
                "comment": ""
            })
    elif report_type in ("mid_term", "mocks"):
        # Simple score per subject
        for e in entries:
            subj = subj_map.get(e.get("subject_id"))
            score = e.get("exam_score") or e.get("ca_score") or 0
            letter = grade_letter(score)
            grades.append({
                "subject": subj["name"] if subj else "",
                "code": subj.get("code", "") if subj else "",
                "score": score,
                "max_score": 100,
                "final_score": score,
                "grade": letter,
                "remark": grade_remark(letter),
                "comment": e.get("teacher_comment", "")
            })
    else:
        # Full report or end_of_term — standard CA + Exam layout
        for e in entries:
            subj = subj_map.get(e.get("subject_id"))
            grades.append({
                "subject": subj["name"] if subj else "", "code": subj.get("code", "") if subj else "",
                "ca_score": e.get("ca_score", 0), "ca_max": e.get("ca_max", 100),
                "exam_score": e.get("exam_score", 0), "exam_max": e.get("exam_max", 100),
                "final_score": e.get("final_score", 0), "grade": e.get("grade_letter", ""),
                "remark": e.get("remark", ""), "comment": e.get("teacher_comment", "")
            })

    scores = [g["final_score"] for g in grades if g.get("final_score")]
    average = round(sum(scores) / len(scores), 1) if scores else 0

    # ─── Class Position Calculation ───
    position = None
    total_in_class = 0
    class_id = student.get("class_id")
    if class_id and average > 0:
        # Get all students in the same class
        classmates = await db.users.find(
            {"role": "Student", "class_id": class_id, "is_active": True},
            {"_id": 0, "user_id": 1}
        ).to_list(200)
        classmate_ids = [c["user_id"] for c in classmates]
        total_in_class = len(classmate_ids)

        # Get all end_of_term grades for classmates in this term
        all_grades = await db.gradebook_entries.find(
            {"student_id": {"$in": classmate_ids}, "term": term, "score_type": "end_of_term"},
            {"_id": 0, "student_id": 1, "final_score": 1}
        ).to_list(5000)

        # If no end_of_term entries, use all entries
        if not all_grades:
            all_grades = await db.gradebook_entries.find(
                {"student_id": {"$in": classmate_ids}, "term": term},
                {"_id": 0, "student_id": 1, "final_score": 1}
            ).to_list(5000)

        # Compute average per student
        student_avgs = {}
        for g in all_grades:
            sid = g["student_id"]
            if sid not in student_avgs:
                student_avgs[sid] = []
            if g.get("final_score"):
                student_avgs[sid].append(g["final_score"])

        rankings = []
        for sid, sc_list in student_avgs.items():
            if sc_list:
                rankings.append({"student_id": sid, "avg": round(sum(sc_list) / len(sc_list), 1)})
        rankings.sort(key=lambda x: -x["avg"])

        for i, r in enumerate(rankings):
            if r["student_id"] == student_id:
                position = i + 1
                break

    # Attendance - use aggregation to avoid scanning all records
    att_data = {"present": 0, "absent": 0, "late": 0, "total": 0}
    att_pipeline = [
        {"$unwind": "$records"},
        {"$match": {"records.student_id": student_id}},
        {"$group": {"_id": "$records.status", "count": {"$sum": 1}}}
    ]
    att_agg = await db.attendance.aggregate(att_pipeline).to_list(10)
    for a in att_agg:
        status = a["_id"] or "present"
        att_data[status] = a["count"]
        att_data["total"] += a["count"]

    # Calculate per-subject GPA and overall GPA
    for g in grades:
        g_letter = g.get("grade", g.get("grade_letter", ""))
        g["gpa"] = grade_gpa(g_letter)

    subject_gpas = [g["gpa"] for g in grades if g.get("gpa") is not None]
    overall_gpa = round(sum(subject_gpas) / len(subject_gpas), 2) if subject_gpas else 0.00

    return {
        "student": student, "class": cls, "term": term,
        "report_type": report_type or "full",
        "report_label": report_label,
        "grades": grades, "average": average,
        "overall_grade": grade_letter(average), "overall_remark": grade_remark(grade_letter(average)),
        "overall_gpa": overall_gpa,
        "position": position, "total_in_class": total_in_class,
        "attendance": att_data,
        "weights": await get_weights()
    }


@router.get("/report-card/{student_id}/pdf")
async def report_card_pdf(student_id: str, term: str = "Term 1", report_type: str = None, user: dict = Depends(get_current_user)):
    data = await report_card_data(student_id, term, report_type, user)
    student = data["student"]
    cls = data.get("class") or {}
    grades = data["grades"]
    rtype = data.get("report_type", "full")
    report_label = data.get("report_label", "Student Academic Report Card")

    # ─── Color constants ───
    NAVY = (27, 42, 74)
    GOLD = (197, 165, 90)
    HEADER_BG = (27, 42, 74)
    LIGHT_BG = (245, 247, 250)
    WHITE = (255, 255, 255)

    pdf = FPDF()
    pdf.add_font("DejaVu", "", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", uni=True)
    pdf.add_font("DejaVu", "B", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", uni=True)
    pdf.add_font("DejaVu", "I", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf", uni=True)
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=12)

    page_w = pdf.w - pdf.l_margin - pdf.r_margin  # usable width

    # ─── HEADER ───
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'main_logo.png')
    if os.path.exists(logo_path):
        pdf.image(logo_path, x=10, y=8, w=25, h=25)
    pdf.set_xy(38, 8)
    pdf.set_font("DejaVu", "B", 16)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 8, "The RightWay Centre of Learning", ln=True)
    pdf.set_x(38)
    pdf.set_font("DejaVu", "I", 8)
    pdf.set_text_color(*GOLD)
    pdf.cell(0, 4, "Where Every Child Thrives, Transforming Hearts", ln=True)
    pdf.set_x(38)
    pdf.set_font("DejaVu", "B", 10)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 6, report_label.upper(), ln=True)
    pdf.ln(4)

    # Gold divider line
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(0.8)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(4)

    # ─── STUDENT INFORMATION BOX ───
    pdf.set_fill_color(*LIGHT_BG)
    box_y = pdf.get_y()
    pdf.rect(pdf.l_margin, box_y, page_w, 24, 'F')
    pdf.set_draw_color(220, 220, 220)
    pdf.rect(pdf.l_margin, box_y, page_w, 24, 'D')

    def info_field(label, value, x, y, lw=28, vw=40):
        pdf.set_xy(x, y)
        pdf.set_font("DejaVu", "B", 7)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(lw, 5, label, align="L")
        pdf.set_font("DejaVu", "", 7)
        pdf.set_text_color(*NAVY)
        pdf.cell(vw, 5, str(value or "-"), align="L")

    lm = pdf.l_margin + 2
    info_field("Full Name:", student.get("name", ""), lm, box_y + 2, 22, 55)
    info_field("Student ID:", student.get("admission_number", ""), lm + 80, box_y + 2, 22, 35)
    info_field("Year Group:", student.get("year_group", ""), lm + 140, box_y + 2, 22, 25)
    info_field("Form Class:", cls.get("name", ""), lm, box_y + 8, 22, 55)
    info_field("Gender:", student.get("gender", "-"), lm + 80, box_y + 8, 22, 35)
    info_field("Academic Year:", "2025-2026", lm + 140, box_y + 8, 28, 25)
    info_field("Term:", term, lm, box_y + 14, 22, 55)
    info_field("House:", student.get("house", "-"), lm + 80, box_y + 14, 22, 35)
    info_field("DOB:", student.get("date_of_birth", "-"), lm + 140, box_y + 14, 22, 25)
    pdf.set_y(box_y + 28)

    # ─── ACADEMIC PERFORMANCE TABLE ───
    pdf.set_font("DejaVu", "B", 9)
    pdf.set_text_color(*WHITE)
    pdf.set_fill_color(*HEADER_BG)

    # Helper for wrapped comment rows
    def table_row(cols, comment_text, comment_width):
        x0 = pdf.l_margin
        y0 = pdf.get_y()
        text = (comment_text or "").strip()
        pdf.set_font("DejaVu", "", 6.5)
        usable_w = comment_width - 1
        words = text.split(' ') if text else []
        lines = 1
        current_line = ""
        for word in words:
            test_line = f"{current_line} {word}".strip()
            if pdf.get_string_width(test_line) > usable_w:
                lines += 1
                current_line = word
            else:
                current_line = test_line
        row_h = max(6, lines * 3.2 + 1)
        pdf.set_font("DejaVu", "", 7)
        cx = x0
        for val, w, align in cols:
            pdf.set_xy(cx, y0)
            pdf.cell(w, row_h, val, border=1, align=align)
            cx += w
        if comment_width > 0:
            pdf.rect(cx, y0, comment_width, row_h)
            pdf.set_xy(cx + 0.5, y0 + 0.3)
            pdf.set_font("DejaVu", "", 6.5)
            pdf.multi_cell(usable_w, 3.2, text or "")
        pdf.set_xy(x0, y0 + row_h)

    if rtype == "progressives":
        headers = [("Subject", 42), ("P1", 18), ("P2", 18), ("P3", 18), ("Avg %", 18), ("Grade", 14), ("GPA", 14), ("Remarks", 48)]
        for h, w in headers:
            pdf.cell(w, 7, h, border=1, fill=True, align="C")
        pdf.ln()
        pdf.set_text_color(0, 0, 0)
        for g in grades:
            cols = [
                (g["subject"][:22], 42, "L"), (str(g.get("progressive_1", "")) or "-", 18, "C"),
                (str(g.get("progressive_2", "")) or "-", 18, "C"), (str(g.get("progressive_3", "")) or "-", 18, "C"),
                (str(g.get("average", 0)), 18, "C"), (g["grade"], 14, "C"), (f"{g.get('gpa', 0):.1f}", 14, "C"),
            ]
            table_row(cols, g.get("remark", ""), 48)
    elif rtype in ("mid_term", "mocks"):
        headers = [("Subject", 48), ("Score", 18), ("Grade", 14), ("GPA", 14), ("Remarks", 50), ("Teacher Comment", 46)]
        for h, w in headers:
            pdf.cell(w, 7, h, border=1, fill=True, align="C")
        pdf.ln()
        pdf.set_text_color(0, 0, 0)
        for g in grades:
            cols = [
                (g["subject"][:25], 48, "L"), (str(g.get("score", 0)), 18, "C"),
                (g["grade"], 14, "C"), (f"{g.get('gpa', 0):.1f}", 14, "C"), (g.get("remark", "")[:25], 50, "C"),
            ]
            table_row(cols, g.get("comment", ""), 46)
    else:
        # Full / End of Term
        headers = [("Subject", 38), ("Class\nScore", 16), ("Exam\nScore", 16), ("Overall\n(%)", 16), ("Grade", 12), ("GPA", 12), ("Effort", 12), ("Remarks", 68)]
        # Header with multi-line
        pdf.set_font("DejaVu", "B", 7)
        y_h = pdf.get_y()
        for h, w in headers:
            x_h = pdf.get_x()
            pdf.rect(x_h, y_h, w, 10)
            pdf.set_fill_color(*HEADER_BG)
            pdf.set_xy(x_h, y_h)
            pdf.cell(w, 10, "", fill=True)
            pdf.set_xy(x_h, y_h + 1)
            pdf.set_text_color(*WHITE)
            lines = h.split("\n")
            for li, line in enumerate(lines):
                pdf.set_xy(x_h, y_h + 1 + li * 4)
                pdf.cell(w, 4, line, align="C")
            pdf.set_xy(x_h + w, y_h)
        pdf.set_y(y_h + 10)
        pdf.set_text_color(0, 0, 0)
        for i, g in enumerate(grades):
            # Alternate row bg
            if i % 2 == 0:
                pdf.set_fill_color(*LIGHT_BG)
            else:
                pdf.set_fill_color(*WHITE)
            cols = [
                (g["subject"][:20], 38, "L"),
                (str(g.get("ca_score", 0)), 16, "C"),
                (str(g.get("exam_score", 0)), 16, "C"),
                (str(g.get("final_score", 0)), 16, "C"),
                (g.get("grade", ""), 12, "C"),
                (f"{g.get('gpa', 0):.1f}", 12, "C"),
                ("-", 12, "C"),
            ]
            table_row(cols, g.get("comment", ""), 68)

    pdf.ln(3)

    # ─── OVERALL SUMMARY BAR ───
    pdf.set_fill_color(*HEADER_BG)
    sum_y = pdf.get_y()
    pdf.rect(pdf.l_margin, sum_y, page_w, 10, 'F')
    pdf.set_font("DejaVu", "B", 8)
    pdf.set_text_color(*WHITE)
    pdf.set_xy(pdf.l_margin + 2, sum_y + 1)
    pdf.cell(45, 8, f"OVERALL AVERAGE: {data['average']}%")
    pdf.cell(30, 8, f"GRADE: {data['overall_grade']}")
    pdf.cell(35, 8, f"GPA: {data.get('overall_gpa', 0):.2f} / 4.00")
    pos = data.get("position")
    total = data.get("total_in_class", 0)
    if pos:
        suffix = "th"
        if pos % 10 == 1 and pos != 11: suffix = "st"
        elif pos % 10 == 2 and pos != 12: suffix = "nd"
        elif pos % 10 == 3 and pos != 13: suffix = "rd"
        pdf.cell(0, 8, f"CLASS POSITION: {pos}{suffix} OUT OF {total}")
    pdf.set_y(sum_y + 14)

    # ─── GRADING KEY (compact) ───
    pdf.set_text_color(*NAVY)
    pdf.set_font("DejaVu", "B", 7)
    pdf.cell(0, 5, "Grading Key", ln=True)
    pdf.set_font("DejaVu", "", 6)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 4, "A* (95-100) Distinction | A (80-94) Excellent | B+ (75-79) Very Good | B (70-74) Good | C+ (65-69) Average | C (60-64) Pass | D (50-59) Credit | E (45-49) Failed | F (35-44) Failed | U (0-34) Ungraded", ln=True)
    pdf.ln(2)

    # ─── ATTENDANCE RECORD ───
    att = data["attendance"]
    pdf.set_text_color(*NAVY)
    pdf.set_font("DejaVu", "B", 8)
    pdf.cell(0, 5, "Attendance Record", ln=True)
    rate = round(att["present"] / att["total"] * 100) if att["total"] else 0
    pdf.set_font("DejaVu", "", 7)
    pdf.set_text_color(0, 0, 0)
    att_data = [
        ("Days Present", str(att["present"])), ("Days Absent", str(att["absent"])),
        ("Late Arrivals", str(att.get("late", 0))), ("Attendance %", f"{rate}%")
    ]
    for label, val in att_data:
        pdf.set_font("DejaVu", "B", 7)
        pdf.cell(25, 5, label + ":", align="L")
        pdf.set_font("DejaVu", "", 7)
        pdf.cell(15, 5, val, align="L")
    pdf.ln(6)

    # ─── REMARKS SECTION ───
    pdf.set_draw_color(*GOLD)
    pdf.set_line_width(0.4)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(3)

    def remark_box(title, content=""):
        pdf.set_font("DejaVu", "B", 7)
        pdf.set_text_color(*NAVY)
        pdf.cell(0, 5, title, ln=True)
        pdf.set_font("DejaVu", "", 7)
        pdf.set_text_color(0, 0, 0)
        pdf.set_fill_color(*LIGHT_BG)
        y0 = pdf.get_y()
        pdf.rect(pdf.l_margin, y0, page_w, 10, 'F')
        pdf.set_draw_color(220, 220, 220)
        pdf.rect(pdf.l_margin, y0, page_w, 10, 'D')
        pdf.set_xy(pdf.l_margin + 2, y0 + 1)
        pdf.multi_cell(page_w - 4, 3.5, content or "")
        pdf.set_y(y0 + 12)

    remark_box("Form Tutor's Remarks")
    remark_box("Head of Year's Remarks")
    remark_box("Principal's Remarks")

    # ─── SIGNATURES ───
    pdf.ln(2)
    pdf.set_font("DejaVu", "", 7)
    pdf.set_text_color(100, 100, 100)
    sig_w = page_w / 3
    pdf.cell(sig_w, 5, "Form Tutor's Signature & Date", align="C")
    pdf.cell(sig_w, 5, "Principal's Signature & Date", align="C")
    pdf.cell(sig_w, 5, "Parent/Guardian's Signature", align="C")
    pdf.ln()
    pdf.cell(sig_w, 8, "______________________", align="C")
    pdf.cell(sig_w, 8, "______________________", align="C")
    pdf.cell(sig_w, 8, "______________________", align="C")
    pdf.ln(6)

    # ─── FOOTER ───
    pdf.set_draw_color(*NAVY)
    pdf.set_line_width(0.3)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(2)
    pdf.set_font("DejaVu", "I", 6)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 4, "This report card is the property of The RightWay Centre of Learning and must be returned when requested.", align="C", ln=True)
    pdf.cell(0, 4, f"Generated: {datetime.now(timezone.utc).strftime('%d %B %Y')}", align="C")

    # Output
    type_suffix = f"_{report_type}" if report_type else ""
    filename = f"ReportCard_{student.get('name', 'Student').replace(' ', '_')}_{term.replace(' ', '_')}{type_suffix}.pdf"
    pdf_bytes = pdf.output()
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

