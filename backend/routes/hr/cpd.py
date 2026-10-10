from fastapi import APIRouter, Depends, HTTPException, Body
from database import db
from models import gen_id
from auth import get_current_user, require_roles, log_audit
from ws_manager import send_notification
from datetime import datetime, timezone

router = APIRouter(prefix="/api", tags=["cpd", "performance", "assessment"])

# ─── CPD Courses ───
@router.get("/cpd/courses")
async def list_cpd_courses(user: dict = Depends(get_current_user)):
    courses = await db.cpd_courses.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for c in courses:
        c["enrolled_count"] = await db.cpd_enrolments.count_documents({"course_id": c["course_id"]})
        if user:
            enrolment = await db.cpd_enrolments.find_one({"course_id": c["course_id"], "user_id": user["user_id"]}, {"_id": 0})
            c["my_enrolment"] = enrolment
    return courses


@router.post("/cpd/courses")
async def create_cpd_course(data: dict = Body(...), user: dict = Depends(require_roles("Admin", "SuperAdmin", "HeadOfAcademics", "HR_Officer"))):
    doc = {
        "course_id": gen_id("cpd_"), "title": data.get("title", ""),
        "description": data.get("description", ""),
        "category": data.get("category", "General"),
        "duration_hours": data.get("duration_hours", 2),
        "provider": data.get("provider", "Internal"),
        "start_date": data.get("start_date", ""),
        "end_date": data.get("end_date", ""),
        "max_participants": data.get("max_participants", 50),
        "status": "open",
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.cpd_courses.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.post("/cpd/courses/{course_id}/enrol")
async def enrol_cpd(course_id: str, user: dict = Depends(get_current_user)):
    existing = await db.cpd_enrolments.find_one({"course_id": course_id, "user_id": user["user_id"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Already enrolled")
    doc = {
        "enrolment_id": gen_id("cen_"), "course_id": course_id,
        "user_id": user["user_id"], "user_name": user["name"],
        "status": "enrolled", "completed_at": "",
        "certificate_id": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.cpd_enrolments.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.post("/cpd/courses/{course_id}/complete")
async def complete_cpd(course_id: str, data: dict = Body({}), user: dict = Depends(get_current_user)):
    user_id = data.get("user_id", user["user_id"])
    cert_id = gen_id("cert_")
    await db.cpd_enrolments.update_one(
        {"course_id": course_id, "user_id": user_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat(), "certificate_id": cert_id}}
    )
    return {"message": "Course completed", "certificate_id": cert_id}


@router.get("/cpd/certificate/{course_id}/{user_id}/pdf")
async def generate_certificate_pdf(course_id: str, user_id: str, user: dict = Depends(get_current_user)):
    """Generate a beautiful CPD completion certificate PDF."""
    from fpdf import FPDF
    from fastapi.responses import Response
    import os

    course = await db.cpd_courses.find_one({"course_id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    enrolment = await db.cpd_enrolments.find_one(
        {"course_id": course_id, "user_id": user_id, "status": "completed"}, {"_id": 0}
    )
    if not enrolment:
        raise HTTPException(status_code=400, detail="Course not completed")

    staff = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="User not found")

    cert_id = enrolment.get("certificate_id", "N/A")
    completed_date = enrolment.get("completed_at", "")[:10] if enrolment.get("completed_at") else datetime.now(timezone.utc).strftime("%Y-%m-%d")

    pdf = FPDF(orientation='L', format='A4')
    pdf.add_font("DejaVu", "", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", uni=True)
    pdf.add_font("DejaVu", "B", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", uni=True)
    pdf.add_font("DejaVu", "I", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf", uni=True)
    pdf.add_page()
    pdf.set_auto_page_break(auto=False)
    w, h = 297, 210  # A4 landscape

    # Gold border
    pdf.set_draw_color(197, 165, 90)
    pdf.set_line_width(3)
    pdf.rect(8, 8, w - 16, h - 16)
    pdf.set_line_width(1)
    pdf.rect(12, 12, w - 24, h - 24)

    # Inner decorative corners
    pdf.set_draw_color(46, 108, 196)
    pdf.set_line_width(0.5)
    pdf.rect(16, 16, w - 32, h - 32)

    # Logo
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'main_logo.png')
    if not os.path.exists(logo_path):
        logo_path = os.path.join(os.path.dirname(__file__), '..', 'main_logo.png')
    if os.path.exists(logo_path):
        pdf.image(logo_path, x=(w - 60) / 2, y=18, w=60, h=60)

    # School name
    pdf.set_y(60)
    pdf.set_font("DejaVu", "B", 14)
    pdf.set_text_color(27, 42, 74)
    pdf.cell(0, 8, "The RightWay Centre of Learning", ln=True, align="C")
    pdf.set_font("DejaVu", "I", 9)
    pdf.set_text_color(197, 165, 90)
    pdf.cell(0, 5, "Where Every Child Thrives, Transforming Hearts", ln=True, align="C")

    # Certificate title
    pdf.ln(8)
    pdf.set_font("DejaVu", "B", 28)
    pdf.set_text_color(27, 42, 74)
    pdf.cell(0, 14, "CERTIFICATE OF COMPLETION", ln=True, align="C")

    # Gold line
    pdf.set_draw_color(197, 165, 90)
    pdf.set_line_width(1.5)
    pdf.line(80, pdf.get_y() + 2, w - 80, pdf.get_y() + 2)
    pdf.ln(8)

    # "This is to certify that"
    pdf.set_font("DejaVu", "", 12)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 7, "This is to certify that", ln=True, align="C")

    # Name
    pdf.ln(3)
    pdf.set_font("DejaVu", "B", 24)
    pdf.set_text_color(46, 108, 196)
    pdf.cell(0, 14, staff.get("name", ""), ln=True, align="C")

    # Gold line under name
    pdf.set_draw_color(197, 165, 90)
    pdf.set_line_width(0.8)
    pdf.line(90, pdf.get_y(), w - 90, pdf.get_y())
    pdf.ln(5)

    # "has successfully completed"
    pdf.set_font("DejaVu", "", 12)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 7, "has successfully completed the professional development course", ln=True, align="C")

    # Course name
    pdf.ln(2)
    pdf.set_font("DejaVu", "B", 18)
    pdf.set_text_color(27, 42, 74)
    pdf.cell(0, 10, f'"{course.get("title", "")}"', ln=True, align="C")

    # Duration and category
    pdf.set_font("DejaVu", "", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, f'Category: {course.get("category", "General")}  |  Duration: {course.get("duration_hours", 0)} hours  |  Completed: {completed_date}', ln=True, align="C")

    # Certificate ID
    pdf.ln(3)
    pdf.set_font("DejaVu", "", 8)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 5, f"Certificate ID: {cert_id}", ln=True, align="C")

    # Signatures
    pdf.ln(8)
    pdf.set_font("DejaVu", "", 9)
    pdf.set_text_color(80, 80, 80)
    sig_y = pdf.get_y()
    pdf.set_x(40)
    pdf.cell(80, 5, "____________________________", align="C")
    pdf.set_x(w - 120)
    pdf.cell(80, 5, "____________________________", align="C")
    pdf.ln()
    pdf.set_font("DejaVu", "B", 9)
    pdf.set_x(40)
    pdf.cell(80, 5, "Head of School", align="C")
    pdf.set_x(w - 120)
    pdf.cell(80, 5, "HR Department", align="C")

    pdf_bytes = pdf.output()
    filename = f"TCIS_Certificate_{staff.get('name', '').replace(' ', '_')}_{course.get('title', '').replace(' ', '_')[:30]}.pdf"
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/cpd/my-courses")
async def my_cpd(user: dict = Depends(get_current_user)):
    enrolments = await db.cpd_enrolments.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    for e in enrolments:
        course = await db.cpd_courses.find_one({"course_id": e["course_id"]}, {"_id": 0})
        e["course"] = course
    return enrolments


# ─── Performance Reviews ───
@router.get("/performance/reviews")
async def list_reviews(user_id: str = None, cycle: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] in ("Teacher",):
        query["$or"] = [{"reviewee_id": user["user_id"]}, {"reviewer_id": user["user_id"]}]
    elif user_id:
        query["reviewee_id"] = user_id
    if cycle:
        query["cycle"] = cycle
    reviews = await db.performance_reviews.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    for r in reviews:
        reviewee = await db.users.find_one({"user_id": r.get("reviewee_id")}, {"_id": 0, "name": 1, "role": 1})
        reviewer = await db.users.find_one({"user_id": r.get("reviewer_id")}, {"_id": 0, "name": 1})
        r["reviewee_name"] = reviewee["name"] if reviewee else ""
        r["reviewee_role"] = reviewee.get("role", "") if reviewee else ""
        r["reviewer_name"] = reviewer["name"] if reviewer else ""
    return reviews


@router.post("/performance/reviews")
async def create_review(data: dict = Body(...), user: dict = Depends(require_roles("Admin", "SuperAdmin", "HeadOfAcademics", "HoD", "HR_Officer"))):
    doc = {
        "review_id": gen_id("rev_"), "reviewee_id": data.get("reviewee_id"),
        "reviewer_id": user["user_id"], "cycle": data.get("cycle", "Term 1 2025-2026"),
        "targets": data.get("targets", []),
        "strengths": data.get("strengths", ""),
        "areas_for_development": data.get("areas_for_development", ""),
        "overall_rating": data.get("overall_rating", 3),
        "milestones": data.get("milestones", []),
        "action_items": data.get("action_items", ""),
        "reviewee_comments": "",
        "status": "draft",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.performance_reviews.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "create_review", "performance", doc["review_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.post("/performance/reviews/{review_id}/submit")
async def submit_review(review_id: str, user: dict = Depends(get_current_user)):
    await db.performance_reviews.update_one({"review_id": review_id}, {"$set": {"status": "submitted"}})
    return {"message": "Review submitted"}


@router.post("/performance/reviews/{review_id}/acknowledge")
async def acknowledge_review(review_id: str, data: dict = Body({}), user: dict = Depends(get_current_user)):
    await db.performance_reviews.update_one(
        {"review_id": review_id},
        {"$set": {"status": "acknowledged", "reviewee_comments": data.get("comments", "")}}
    )
    return {"message": "Review acknowledged"}


@router.post("/performance/reviews/{review_id}/approve")
async def approve_review(review_id: str, user: dict = Depends(require_roles("Admin", "SuperAdmin"))):
    await db.performance_reviews.update_one({"review_id": review_id}, {"$set": {"status": "approved"}})
    return {"message": "Review approved"}


# ─── Assessment Vault ───
@router.get("/assessment/papers")
async def list_papers(subject_id: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if subject_id:
        query["subject_id"] = subject_id
    papers = await db.assessment_papers.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    for p in papers:
        subj = await db.subjects.find_one({"subject_id": p.get("subject_id")}, {"_id": 0, "name": 1})
        creator = await db.users.find_one({"user_id": p.get("created_by")}, {"_id": 0, "name": 1})
        p["subject_name"] = subj["name"] if subj else ""
        p["creator_name"] = creator["name"] if creator else ""
    return papers


@router.post("/assessment/papers")
async def create_paper(data: dict = Body(...), user: dict = Depends(require_roles("Admin", "SuperAdmin", "Teacher", "HeadTeacher", "Principal", "HeadOfAcademics", "HoD"))):
    doc = {
        "paper_id": gen_id("pap_"), "title": data.get("title", ""),
        "subject_id": data.get("subject_id", ""),
        "class_id": data.get("class_id", ""),
        "paper_type": data.get("paper_type", "end_of_term"),
        "term": data.get("term", "Term 1"),
        "total_marks": data.get("total_marks", 100),
        "duration_minutes": data.get("duration_minutes", 120),
        "topics_covered": data.get("topics_covered", []),
        "difficulty_breakdown": data.get("difficulty_breakdown", {"easy": 30, "medium": 50, "hard": 20}),
        "file_ids": data.get("file_ids", []),
        "moderation_status": "pending",
        "moderator_id": "", "moderator_feedback": "",
        "access_log": [{"user_id": user["user_id"], "action": "created", "timestamp": datetime.now(timezone.utc).isoformat()}],
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.assessment_papers.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "create_paper", "assessment", doc["paper_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.post("/assessment/papers/{paper_id}/moderate")
async def moderate_paper(paper_id: str, data: dict = Body(...), user: dict = Depends(require_roles("Admin", "SuperAdmin", "HeadOfAcademics", "HoD"))):
    status = "approved" if data.get("approved", True) else "revision_needed"
    update = {
        "moderation_status": status, "moderator_id": user["user_id"],
        "moderator_feedback": data.get("feedback", "")
    }
    await db.assessment_papers.update_one(
        {"paper_id": paper_id},
        {"$set": update, "$push": {"access_log": {"user_id": user["user_id"], "action": f"moderated_{status}", "timestamp": datetime.now(timezone.utc).isoformat()}}}
    )
    await log_audit(user["user_id"], user["name"], f"moderate_paper_{status}", "assessment", paper_id)
    return {"message": f"Paper {status}"}


@router.get("/assessment/papers/{paper_id}/access-log")
async def paper_access_log(paper_id: str, user: dict = Depends(require_roles("Admin", "SuperAdmin", "HeadOfAcademics"))):
    paper = await db.assessment_papers.find_one({"paper_id": paper_id}, {"_id": 0})
    if not paper:
        raise HTTPException(status_code=404, detail="Not found")
    # Log access
    await db.assessment_papers.update_one(
        {"paper_id": paper_id},
        {"$push": {"access_log": {"user_id": user["user_id"], "action": "viewed_log", "timestamp": datetime.now(timezone.utc).isoformat()}}}
    )
    return paper.get("access_log", [])


# ─── HoD Weekly Digest ───
@router.post("/monitoring/hod-digest")
async def generate_hod_digest(user: dict = Depends(require_roles("Admin", "SuperAdmin", "HeadOfAcademics", "HoD"))):
    """Generate and send weekly compliance digest to HoDs via internal mail."""
    teachers = await db.users.find({"role": "Teacher"}, {"_id": 0, "user_id": 1, "name": 1, "department": 1}).to_list(100)

    # Build digest content
    departments = {}
    for t in teachers:
        dept = t.get("department", "General")
        if dept not in departments:
            departments[dept] = []
        plans = await db.lesson_plans.count_documents({"teacher_id": t["user_id"]})
        lessons = await db.lessons.count_documents({"teacher_id": t["user_id"]})
        att = await db.attendance.count_documents({"teacher_id": t["user_id"]})

        teacher_assgns = await db.assignments.find({"teacher_id": t["user_id"]}, {"_id": 0, "assignment_id": 1}).to_list(100)
        ungraded = 0
        for a in teacher_assgns:
            ungraded += await db.submissions.count_documents({"assignment_id": a["assignment_id"], "grade": None})

        departments[dept].append({
            "name": t["name"], "plans": plans, "lessons": lessons,
            "attendance": att, "ungraded": ungraded
        })

    # Generate HTML body
    body_parts = [f"<h2>Weekly Compliance Digest - {datetime.now(timezone.utc).strftime('%d %B %Y')}</h2>"]
    for dept, members in departments.items():
        body_parts.append(f"<h3>{dept} Department</h3><table border='1' cellpadding='5' style='border-collapse:collapse;'><tr><th>Teacher</th><th>Plans</th><th>Lessons</th><th>Attendance</th><th>Ungraded</th></tr>")
        for m in members:
            flag = " ⚠" if m["ungraded"] > 0 or m["plans"] == 0 else ""
            body_parts.append(f"<tr><td>{m['name']}{flag}</td><td>{m['plans']}</td><td>{m['lessons']}</td><td>{m['attendance']}</td><td>{m['ungraded']}</td></tr>")
        body_parts.append("</table>")

    body_html = "\n".join(body_parts)

    # Find HoDs and academic leaders
    hod_users = await db.users.find(
        {"role": {"$in": ["HoD", "HeadOfAcademics", "Admin"]}}, {"_id": 0, "user_id": 1}
    ).to_list(20)
    recipient_ids = [u["user_id"] for u in hod_users]

    if recipient_ids:
        # Send via internal mail
        from routes.communication.mail_outlook import ensure_folders, get_folder_id
        now = datetime.now(timezone.utc).isoformat()
        thread_id = gen_id("thr_")
        message_id = gen_id("msg_")

        await db.mail_threads.insert_one({
            "thread_id": thread_id, "subject": f"Weekly Compliance Digest - {datetime.now(timezone.utc).strftime('%d %b %Y')}",
            "participants": [user["user_id"]] + recipient_ids,
            "created_by": user["user_id"], "confidentiality": "restricted",
            "created_at": now, "updated_at": now, "last_message_at": now
        })
        await db.mail_messages_v2.insert_one({
            "message_id": message_id, "thread_id": thread_id,
            "from_user_id": user["user_id"], "to": recipient_ids, "cc": [], "bcc": [],
            "subject": f"Weekly Compliance Digest - {datetime.now(timezone.utc).strftime('%d %b %Y')}",
            "body_html": body_html, "body_text": "",
            "importance": "high", "attachment_ids": [],
            "is_draft": False, "reply_to_message_id": "",
            "created_at": now, "sent_at": now
        })

        for rid in recipient_ids:
            await ensure_folders(rid)
            inbox_folder = await get_folder_id(rid, "Inbox")
            if inbox_folder:
                await db.mail_folder_map.insert_one({
                    "map_id": gen_id("map_"), "user_id": rid,
                    "message_id": message_id, "thread_id": thread_id,
                    "folder_id": inbox_folder, "is_read": False,
                    "is_pinned": False, "is_flagged": False,
                    "category_tags": ["digest"], "archived_at": None
                })

    await log_audit(user["user_id"], user["name"], "generate_digest", "monitoring", "", {"recipients": len(recipient_ids)})
    return {"message": f"Digest sent to {len(recipient_ids)} recipients", "departments": len(departments)}



# ─── CPD Reading Materials ───
@router.get("/cpd/materials")
async def list_materials(user: dict = Depends(get_current_user)):
    query = {}
    if user.get("role") not in ("Admin", "SuperAdmin", "CEO", "HeadOfAcademics", "HR_Officer"):
        query["published"] = True
    materials = await db.cpd_materials.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return materials


@router.post("/cpd/materials")
async def create_material(data: dict = Body(...), user: dict = Depends(require_roles("Admin", "SuperAdmin", "CEO", "HeadOfAcademics", "HR_Officer"))):
    doc = {
        "material_id": gen_id("cpdm_"),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "category": data.get("category", "General"),
        "file_ids": data.get("file_ids", []),
        "published": False,
        "created_by": user["user_id"],
        "created_by_name": user["name"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.cpd_materials.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.post("/cpd/materials/{material_id}/publish")
async def publish_material(material_id: str, user: dict = Depends(require_roles("Admin", "SuperAdmin", "CEO", "HeadOfAcademics", "HR_Officer"))):
    await db.cpd_materials.update_one({"material_id": material_id}, {"$set": {"published": True, "published_at": datetime.now(timezone.utc).isoformat()}})
    # Notify all staff
    staff = await db.users.find({"role": {"$in": ["Teacher", "Admin", "HeadTeacher", "Principal", "HR_Officer", "FinanceOfficer", "HeadOfAcademics"]}}, {"_id": 0, "user_id": 1}).to_list(100)
    mat = await db.cpd_materials.find_one({"material_id": material_id}, {"_id": 0})
    for s in staff:
        await send_notification(db, s["user_id"], {
            "type": "cpd_material", "title": f"New CPD Material: {mat.get('title', '')}",
            "message": f"{user['name']} published a new reading material for professional development.",
            "reference_type": "cpd_material", "reference_id": material_id,
            "action_url": "/admin/cpd",
        })
    return {"message": "Material published to all staff"}


@router.delete("/cpd/materials/{material_id}")
async def delete_material(material_id: str, user: dict = Depends(require_roles("Admin", "SuperAdmin", "CEO"))):
    await db.cpd_materials.delete_one({"material_id": material_id})
    return {"message": "Material deleted"}


# ─── Promotion Checker ───
PROMOTION_CRITERIA = {
    "Teacher": {"min_courses": 3, "min_test_score": 70, "title": "Senior Teacher"},
    "Senior Teacher": {"min_courses": 5, "min_test_score": 75, "title": "Lead Teacher"},
    "Lead Teacher": {"min_courses": 8, "min_test_score": 80, "title": "Head of Department"},
}

@router.get("/cpd/promotion-check")
async def promotion_checker(user: dict = Depends(get_current_user)):
    """Check promotion eligibility for all staff or specific user."""
    is_admin = user.get("role") in ("Admin", "SuperAdmin", "CEO", "HeadOfAcademics", "HR_Officer")

    if is_admin:
        staff = await db.users.find({"role": {"$in": ["Teacher"]}}, {"_id": 0, "password_hash": 0}).to_list(200)
    else:
        staff = [await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})]

    results = []
    for s in staff:
        if not s:
            continue
        uid = s["user_id"]
        # Count completed courses
        completed = await db.cpd_enrolments.count_documents({"user_id": uid, "status": "completed"})
        # Get test scores from quizzes
        submissions = await db.quiz_submissions.find({"student_id": uid}, {"_id": 0, "percentage": 1}).to_list(100)
        avg_score = round(sum(sub.get("percentage", 0) for sub in submissions) / max(len(submissions), 1), 1) if submissions else 0
        # Get review rating
        reviews = await db.performance_reviews.find({"reviewee_id": uid, "status": "approved"}, {"_id": 0, "rating": 1}).to_list(10)
        avg_rating = round(sum(r.get("rating", 0) for r in reviews) / max(len(reviews), 1), 1) if reviews else 0

        current_level = s.get("promotion_level", "Teacher")
        criteria = PROMOTION_CRITERIA.get(current_level, PROMOTION_CRITERIA["Teacher"])
        eligible = completed >= criteria["min_courses"] and avg_score >= criteria["min_test_score"]

        results.append({
            "user_id": uid, "name": s["name"], "email": s.get("email", ""),
            "current_level": current_level,
            "completed_courses": completed,
            "avg_test_score": avg_score,
            "avg_review_rating": avg_rating,
            "tests_taken": len(submissions),
            "reviews_count": len(reviews),
            "next_level": criteria["title"],
            "required_courses": criteria["min_courses"],
            "required_score": criteria["min_test_score"],
            "eligible": eligible,
        })

    return results

