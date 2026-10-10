from fastapi import APIRouter, Depends, HTTPException, Body
from database import db, get_active_term
from models import gen_id
from auth import get_current_user, require_roles, log_audit
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])

MONITOR_ROLES = ("Admin", "SuperAdmin", "HeadOfAcademics", "HoD", "CEO", "Founder", "Principal", "HeadTeacher")


def compute_activity_scores(lessons_raw, assignments, plans, files, clock_history, audit_logs, wp_docs=None, wp_audit=None):
    """Compute both monthly (30d) and daily activity scores with breakdowns."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    wp_docs = wp_docs or []
    wp_audit = wp_audit or []

    # ── Monthly (30d) counts ──
    lessons_30d = sum(1 for l in lessons_raw if l.get("created_at", "") >= thirty_days_ago)
    assignments_30d = sum(1 for a in assignments if a.get("created_at", "") >= thirty_days_ago)
    files_30d = sum(1 for f in files if f.get("created_at", "") >= thirty_days_ago)
    actions_30d = sum(1 for a in audit_logs if a.get("timestamp", "") >= thirty_days_ago)
    plans_30d = sum(1 for p in plans if p.get("created_at", "") >= thirty_days_ago)
    wp_docs_30d = sum(1 for d in wp_docs if d.get("created_at", "") >= thirty_days_ago)
    wp_actions_30d = sum(1 for a in wp_audit if a.get("timestamp", "") >= thirty_days_ago)

    # ── Daily counts ──
    lessons_today = sum(1 for l in lessons_raw if l.get("created_at", "") >= today_start)
    assignments_today = sum(1 for a in assignments if a.get("created_at", "") >= today_start)
    files_today = sum(1 for f in files if f.get("created_at", "") >= today_start)
    actions_today = sum(1 for a in audit_logs if a.get("timestamp", "") >= today_start)
    plans_today = sum(1 for p in plans if p.get("created_at", "") >= today_start)
    wp_docs_today = sum(1 for d in wp_docs if d.get("created_at", "") >= today_start)
    wp_actions_today = sum(1 for a in wp_audit if a.get("timestamp", "") >= today_start)

    # ── Clock hours ──
    total_clock_hours = 0
    clock_hours_30d = 0
    clock_hours_today = 0
    for c in clock_history:
        if c.get("clock_in") and c.get("clock_out"):
            try:
                cin = datetime.fromisoformat(c["clock_in"].replace("Z", "+00:00")) if isinstance(c["clock_in"], str) else c["clock_in"]
                cout = datetime.fromisoformat(c["clock_out"].replace("Z", "+00:00")) if isinstance(c["clock_out"], str) else c["clock_out"]
                hrs = (cout - cin).total_seconds() / 3600
                total_clock_hours += hrs
                if c.get("clock_in", "") >= thirty_days_ago:
                    clock_hours_30d += hrs
                if c.get("clock_in", "") >= today_start:
                    clock_hours_today += hrs
            except Exception:
                pass

    published_lessons = sum(1 for l in lessons_raw if l.get("published"))
    total_subs = sum(a.get("total_submissions", 0) for a in assignments)
    total_graded = sum(a.get("graded_count", 0) for a in assignments)
    grading_rate = round((total_graded / total_subs * 100) if total_subs > 0 else 0, 1)
    approved_plans = sum(1 for p in plans if p.get("status") == "approved")
    plan_approval_rate = round((approved_plans / len(plans) * 100) if plans else 0, 1)

    # ── Monthly Score (30d) — 9 metrics ──
    # Weights: lessons=15, assign=12, plans=10, files=8, clock=15, grading=8, platform=7, wp_docs=15, wp_actions=10
    m_lesson = min(lessons_30d * 10, 100)
    m_assign = min(assignments_30d * 15, 100)
    m_plan = min(plans_30d * 15, 100)
    m_file = min(files_30d * 5, 100)
    m_clock = min(clock_hours_30d / 160 * 100, 100)
    m_grading = grading_rate
    m_activity = min(actions_30d * 2, 100)
    m_wp_docs = min(wp_docs_30d * 5, 100)       # 20 WP docs in 30d = 100%
    m_wp_actions = min(wp_actions_30d * 3.3, 100) # ~30 WP actions in 30d = 100%

    monthly_score = round(
        m_lesson * 0.15 + m_assign * 0.12 + m_plan * 0.10 +
        m_file * 0.08 + m_clock * 0.15 + m_grading * 0.08 + m_activity * 0.07 +
        m_wp_docs * 0.15 + m_wp_actions * 0.10
    , 1)
    monthly_level = "Excellent" if monthly_score >= 80 else "Good" if monthly_score >= 60 else "Fair" if monthly_score >= 40 else "Needs Improvement" if monthly_score >= 20 else "Inactive"

    # ── Daily Score (8 metrics) ──
    # Weights: lessons=15, assign=12, plans=8, files=8, clock=15, platform=7, wp_docs=20, wp_actions=15
    d_lesson = min(lessons_today * 50, 100)
    d_assign = min(assignments_today * 50, 100)
    d_plan = min(plans_today * 100, 100)
    d_file = min(files_today * 25, 100)
    d_clock = min(clock_hours_today / 8 * 100, 100)
    d_activity = min(actions_today * 10, 100)
    d_wp_docs = min(wp_docs_today * 50, 100)     # 2 WP docs/day = 100%
    d_wp_actions = min(wp_actions_today * 20, 100) # 5 WP actions/day = 100%

    daily_score = round(
        d_lesson * 0.15 + d_assign * 0.12 + d_plan * 0.08 +
        d_file * 0.08 + d_clock * 0.15 + d_activity * 0.07 +
        d_wp_docs * 0.20 + d_wp_actions * 0.15
    , 1)
    daily_level = "Excellent" if daily_score >= 80 else "Good" if daily_score >= 60 else "Fair" if daily_score >= 40 else "Needs Improvement" if daily_score >= 20 else "Inactive"

    monthly_metrics = {
        "overall_score": monthly_score,
        "activity_level": monthly_level,
        "period": "30 days",
        "breakdown": {
            "lessons": {"score": round(m_lesson, 1), "weight": 15, "count_30d": lessons_30d, "total": len(lessons_raw), "published": published_lessons},
            "assignments": {"score": round(m_assign, 1), "weight": 12, "count_30d": assignments_30d, "total": len(assignments)},
            "plans": {"score": round(m_plan, 1), "weight": 10, "count_30d": plans_30d, "total": len(plans), "approved": approved_plans, "approval_rate": plan_approval_rate},
            "files": {"score": round(m_file, 1), "weight": 8, "count_30d": files_30d, "total": len(files)},
            "clock_hours": {"score": round(m_clock, 1), "weight": 15, "hours_30d": round(clock_hours_30d, 1), "total_hours": round(total_clock_hours, 1)},
            "grading": {"score": round(m_grading, 1), "weight": 8, "graded": total_graded, "total_submissions": total_subs, "rate": grading_rate},
            "platform_activity": {"score": round(m_activity, 1), "weight": 7, "actions_30d": actions_30d, "total_logs": len(audit_logs)},
            "wp_documents": {"score": round(m_wp_docs, 1), "weight": 15, "count_30d": wp_docs_30d, "total": len(wp_docs)},
            "wp_actions": {"score": round(m_wp_actions, 1), "weight": 10, "count_30d": wp_actions_30d, "total": len(wp_audit)},
        },
    }

    daily_metrics = {
        "overall_score": daily_score,
        "activity_level": daily_level,
        "period": "today",
        "date": now.strftime("%Y-%m-%d"),
        "breakdown": {
            "lessons": {"score": round(d_lesson, 1), "weight": 15, "count_today": lessons_today, "target": 2},
            "assignments": {"score": round(d_assign, 1), "weight": 12, "count_today": assignments_today, "target": 2},
            "plans": {"score": round(d_plan, 1), "weight": 8, "count_today": plans_today, "target": 1},
            "files": {"score": round(d_file, 1), "weight": 8, "count_today": files_today, "target": 4},
            "clock_hours": {"score": round(d_clock, 1), "weight": 15, "hours_today": round(clock_hours_today, 1), "target": 8},
            "platform_activity": {"score": round(d_activity, 1), "weight": 7, "actions_today": actions_today, "target": 10},
            "wp_documents": {"score": round(d_wp_docs, 1), "weight": 20, "count_today": wp_docs_today, "target": 2},
            "wp_actions": {"score": round(d_wp_actions, 1), "weight": 15, "count_today": wp_actions_today, "target": 5},
        },
    }

    return monthly_metrics, daily_metrics



# ─── Teacher Scorecard KPIs ───
@router.get("/teacher-scorecard/{teacher_id}")
async def teacher_scorecard(teacher_id: str, user: dict = Depends(get_current_user)):
    teacher = await db.users.find_one({"user_id": teacher_id}, {"_id": 0, "password_hash": 0})
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    # Lesson plans
    plans_total = await db.lesson_plans.count_documents({"teacher_id": teacher_id})
    plans_approved = await db.lesson_plans.count_documents({"teacher_id": teacher_id, "status": "approved"})
    plans_pending = await db.lesson_plans.count_documents({"teacher_id": teacher_id, "status": "submitted"})

    # Lessons & resources
    lessons_created = await db.lessons.count_documents({"teacher_id": teacher_id})
    lessons_published = await db.lessons.count_documents({"teacher_id": teacher_id, "published": True})

    # Assignments
    assignments_created = await db.assignments.count_documents({"teacher_id": teacher_id})
    assignments_published = await db.assignments.count_documents({"teacher_id": teacher_id, "published": True})

    # Marking turnaround
    subs = await db.submissions.find({"graded_by": teacher_id, "graded_at": {"$ne": ""}}, {"_id": 0}).to_list(500)
    turnaround_days = []
    for s in subs:
        if s.get("submitted_at") and s.get("graded_at"):
            try:
                sub_dt = datetime.fromisoformat(s["submitted_at"].replace("Z", "+00:00"))
                grade_dt = datetime.fromisoformat(s["graded_at"].replace("Z", "+00:00"))
                turnaround_days.append((grade_dt - sub_dt).total_seconds() / 86400)
            except:
                pass
    avg_turnaround = round(sum(turnaround_days) / len(turnaround_days), 1) if turnaround_days else 0
    total_graded = len(subs)
    ungraded = await db.submissions.count_documents({"graded_by": "", "assignment_id": {"$in": [a["assignment_id"] for a in await db.assignments.find({"teacher_id": teacher_id}, {"_id": 0, "assignment_id": 1}).to_list(200)]}})

    # Attendance taking
    att_records = await db.attendance.count_documents({"teacher_id": teacher_id})

    # Observations
    observations = await db.observations.find({"teacher_id": teacher_id}, {"_id": 0}).to_list(50)
    obs_ratings = [o.get("overall_rating", o.get("rating", 0)) for o in observations if o.get("overall_rating", o.get("rating", 0)) > 0]
    avg_obs_rating = round(sum(obs_ratings) / len(obs_ratings), 1) if obs_ratings else 0

    # Platform activity (lessons + assignments + attendance in last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    recent_lessons = await db.lessons.count_documents({"teacher_id": teacher_id, "created_at": {"$gte": thirty_days_ago}})
    recent_assignments = await db.assignments.count_documents({"teacher_id": teacher_id, "created_at": {"$gte": thirty_days_ago}})

    # Tasks
    tasks_assigned = await db.tasks.count_documents({"assigned_to": teacher_id})
    tasks_completed = await db.tasks.count_documents({"assigned_to": teacher_id, "status": {"$in": ["approved", "closed"]}})

    # Classes taught
    timetable_entries = await db.timetable.find({"teacher_id": teacher_id}, {"_id": 0}).to_list(200)
    class_ids = list({e["class_id"] for e in timetable_entries})
    subject_ids = list({e["subject_id"] for e in timetable_entries})

    return {
        "teacher": teacher,
        "classes_count": len(class_ids),
        "subjects_count": len(subject_ids),
        "kpis": {
            "lesson_plans": {"total": plans_total, "approved": plans_approved, "pending": plans_pending, "rate": round(plans_approved / plans_total * 100) if plans_total else 0},
            "lessons": {"created": lessons_created, "published": lessons_published, "recent_30d": recent_lessons},
            "assignments": {"created": assignments_created, "published": assignments_published, "recent_30d": recent_assignments},
            "marking": {"graded": total_graded, "ungraded": ungraded, "avg_turnaround_days": avg_turnaround, "sla_met": sum(1 for d in turnaround_days if d <= 5), "sla_total": len(turnaround_days)},
            "attendance_records": att_records,
            "observations": {"count": len(observations), "avg_rating": avg_obs_rating, "latest": observations[0] if observations else None},
            "tasks": {"assigned": tasks_assigned, "completed": tasks_completed, "rate": round(tasks_completed / tasks_assigned * 100) if tasks_assigned else 0},
            "platform_activity": {"lessons_30d": recent_lessons, "assignments_30d": recent_assignments},
        },
        "observations": observations[:5],
    }


@router.get("/teacher-scorecards")
async def all_teacher_scorecards(user: dict = Depends(require_roles(*MONITOR_ROLES))):
    teachers = await db.users.find({"role": "Teacher"}, {"_id": 0, "password_hash": 0}).to_list(200)
    scorecards = []
    for t in teachers:
        plans = await db.lesson_plans.count_documents({"teacher_id": t["user_id"]})
        plans_approved = await db.lesson_plans.count_documents({"teacher_id": t["user_id"], "status": "approved"})
        lessons = await db.lessons.count_documents({"teacher_id": t["user_id"]})
        assignments = await db.assignments.count_documents({"teacher_id": t["user_id"]})
        att = await db.attendance.count_documents({"teacher_id": t["user_id"]})
        obs = await db.observations.find({"teacher_id": t["user_id"]}, {"_id": 0, "overall_rating": 1, "rating": 1}).to_list(20)
        obs_avg = round(sum(o.get("overall_rating", o.get("rating", 0)) for o in obs) / len(obs), 1) if obs else 0

        ungraded = 0
        teacher_assignments = await db.assignments.find({"teacher_id": t["user_id"]}, {"_id": 0, "assignment_id": 1}).to_list(100)
        for a in teacher_assignments:
            ungraded += await db.submissions.count_documents({"assignment_id": a["assignment_id"], "grade": None})

        scorecards.append({
            "teacher_id": t["user_id"], "name": t["name"], "department": t.get("department", ""),
            "lesson_plans": plans, "plans_approved": plans_approved,
            "lessons": lessons, "assignments": assignments,
            "attendance_records": att, "obs_rating": obs_avg, "obs_count": len(obs),
            "ungraded": ungraded,
            "compliance_score": min(100, round((
                (min(plans, 10) / 10 * 20) +
                (min(lessons, 5) / 5 * 20) +
                (min(assignments, 3) / 3 * 20) +
                (min(att, 10) / 10 * 20) +
                (obs_avg / 5 * 20 if obs_avg else 0)
            )))
        })
    scorecards.sort(key=lambda x: -x["compliance_score"])
    return scorecards


# ─── Enhanced Observations ───
RUBRIC_DIMENSIONS = [
    "Lesson Structure & Pace", "Clarity of Instruction", "Student Engagement",
    "Differentiation", "Assessment for Learning", "Behaviour Management",
    "Use of Resources/Technology", "Subject Knowledge", "Safeguarding & Professionalism"
]

@router.post("/observations")
async def create_observation(data: dict = Body(...), user: dict = Depends(require_roles(*MONITOR_ROLES))):
    rubric_scores = data.get("rubric_scores", {})
    overall = round(sum(rubric_scores.values()) / len(rubric_scores), 1) if rubric_scores else data.get("rating", 3)

    doc = {
        "observation_id": gen_id("obs_"), "teacher_id": data.get("teacher_id"),
        "observer_id": user["user_id"], "observer_name": user["name"],
        "class_id": data.get("class_id", ""), "subject_id": data.get("subject_id", ""),
        "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "rubric_scores": rubric_scores, "overall_rating": overall,
        "strengths": data.get("strengths", ""), "areas_for_improvement": data.get("areas_for_improvement", ""),
        "recommendations": data.get("recommendations", ""),
        "action_plan": data.get("action_plan", ""),
        "follow_up_date": data.get("follow_up_date", ""),
        "evidence_file_ids": data.get("evidence_file_ids", []),
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.observations.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "create_observation", "monitoring", doc["observation_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/observations")
async def list_observations(teacher_id: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "Teacher":
        query["teacher_id"] = user["user_id"]
    elif teacher_id:
        query["teacher_id"] = teacher_id
    obs = await db.observations.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    for o in obs:
        t = await db.users.find_one({"user_id": o.get("teacher_id")}, {"_id": 0, "name": 1})
        s = await db.subjects.find_one({"subject_id": o.get("subject_id")}, {"_id": 0, "name": 1})
        c = await db.classes.find_one({"class_id": o.get("class_id")}, {"_id": 0, "name": 1})
        o["teacher_name"] = t["name"] if t else ""
        o["subject_name"] = s["name"] if s else ""
        o["class_name"] = c["name"] if c else ""
    return obs


@router.get("/rubric-dimensions")
async def get_rubric_dimensions():
    return RUBRIC_DIMENSIONS


# ─── Lesson Plans ───
@router.post("/lesson-plans")
async def submit_lesson_plan(data: dict = Body(...), user: dict = Depends(get_current_user)):
    doc = {
        "plan_id": gen_id("lp_"), "teacher_id": user["user_id"], "teacher_name": user["name"],
        "subject_id": data.get("subject_id", ""), "class_id": data.get("class_id", ""),
        "week": data.get("week", ""), "topic": data.get("topic", ""),
        "objectives": data.get("objectives", ""), "activities": data.get("activities", ""),
        "resources": data.get("resources", ""), "assessment": data.get("assessment", ""),
        "evidence_file_ids": data.get("evidence_file_ids", []),
        "status": "submitted", "feedback": "", "reviewed_by": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.lesson_plans.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "submit_lesson_plan", "monitoring", doc["plan_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/lesson-plans")
async def list_lesson_plans(teacher_id: str = None, status: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "Teacher":
        query["teacher_id"] = user["user_id"]
    elif teacher_id:
        query["teacher_id"] = teacher_id
    if status:
        query["status"] = status
    # Auto-filter by active term
    active_term, _ = await get_active_term()
    query["term"] = active_term
    plans = await db.lesson_plans.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    for p in plans:
        subj = await db.subjects.find_one({"subject_id": p.get("subject_id")}, {"_id": 0, "name": 1})
        cls = await db.classes.find_one({"class_id": p.get("class_id")}, {"_id": 0, "name": 1})
        p["subject_name"] = subj["name"] if subj else ""
        p["class_name"] = cls["name"] if cls else ""
    return plans


@router.post("/lesson-plans/{plan_id}/review")
async def review_plan(plan_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*MONITOR_ROLES))):
    status = "approved" if data.get("approved", True) else "returned"
    update = {"status": status, "feedback": data.get("feedback", ""), "reviewed_by": user["user_id"]}
    if not data.get("approved") and data.get("resubmit_by"):
        update["resubmit_by"] = data["resubmit_by"]
    await db.lesson_plans.update_one({"plan_id": plan_id}, {"$set": update})
    await log_audit(user["user_id"], user["name"], f"plan_{status}", "monitoring", plan_id)
    return {"message": f"Plan {status}"}


# ─── Lesson Coverage Tracker ───
@router.get("/lesson-coverage")
async def lesson_coverage(teacher_id: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "Teacher":
        query["teacher_id"] = user["user_id"]
    elif teacher_id:
        query["teacher_id"] = teacher_id

    # Planned: timetable entries per week
    tt_query = {"teacher_id": query.get("teacher_id")} if query.get("teacher_id") else {}
    timetable = await db.timetable.find(tt_query, {"_id": 0}).to_list(500)
    planned_per_week = len(timetable) if timetable else 0  # sessions per week

    # Delivered: lessons created
    lesson_query = query.copy()
    lessons = await db.lessons.find(lesson_query, {"_id": 0}).to_list(500)
    delivered = len(lessons)

    # Coverage by subject
    by_subject = {}
    for entry in timetable:
        sid = entry.get("subject_id", "")
        subj = await db.subjects.find_one({"subject_id": sid}, {"_id": 0, "name": 1})
        name = subj["name"] if subj else sid
        if name not in by_subject:
            by_subject[name] = {"planned": 0, "delivered": 0}
        by_subject[name]["planned"] += 1

    for lesson in lessons:
        sid = lesson.get("subject_id", "")
        subj = await db.subjects.find_one({"subject_id": sid}, {"_id": 0, "name": 1})
        name = subj["name"] if subj else sid
        if name in by_subject:
            by_subject[name]["delivered"] += 1

    coverage = []
    for name, data in by_subject.items():
        rate = round(data["delivered"] / data["planned"] * 100) if data["planned"] else 0
        coverage.append({"subject": name, "planned": data["planned"], "delivered": data["delivered"], "rate": min(100, rate)})

    return {
        "planned_sessions_per_week": planned_per_week,
        "total_lessons_delivered": delivered,
        "overall_rate": round(delivered / planned_per_week * 100 / 4) if planned_per_week else 0,  # approx monthly
        "by_subject": coverage
    }


# ─── Marking Monitor ───
@router.get("/marking-monitor")
async def marking_monitor(user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "Teacher":
        query["teacher_id"] = user["user_id"]

    assignments = await db.assignments.find(query, {"_id": 0}).to_list(500)
    monitor_data = []
    for a in assignments:
        total_subs = await db.submissions.count_documents({"assignment_id": a["assignment_id"]})
        graded = await db.submissions.count_documents({"assignment_id": a["assignment_id"], "grade": {"$ne": None}})
        ungraded = total_subs - graded

        subj = await db.subjects.find_one({"subject_id": a.get("subject_id")}, {"_id": 0, "name": 1})
        teacher = await db.users.find_one({"user_id": a.get("teacher_id")}, {"_id": 0, "name": 1})

        # Calculate overdue based on due date + 5 day SLA
        is_overdue = False
        if a.get("due_date") and ungraded > 0:
            try:
                due = datetime.fromisoformat(a["due_date"])
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
                sla_deadline = due + timedelta(days=5)
                is_overdue = datetime.now(timezone.utc) > sla_deadline
            except:
                pass

        monitor_data.append({
            "assignment_id": a["assignment_id"], "title": a["title"],
            "subject_name": subj["name"] if subj else "",
            "teacher_name": teacher["name"] if teacher else "",
            "teacher_id": a.get("teacher_id", ""),
            "due_date": a.get("due_date", ""),
            "total_submissions": total_subs, "graded": graded, "ungraded": ungraded,
            "is_overdue": is_overdue,
            "progress": round(graded / total_subs * 100) if total_subs else 100
        })

    monitor_data.sort(key=lambda x: (-x["ungraded"], x.get("due_date", "")))
    return {
        "assignments": monitor_data,
        "total_ungraded": sum(m["ungraded"] for m in monitor_data),
        "overdue_count": sum(1 for m in monitor_data if m["is_overdue"])
    }


# ─── Student Outcomes ───
@router.get("/student-outcomes")
async def student_outcomes(class_id: str = None, user: dict = Depends(get_current_user)):
    query = {"role": "Student"}
    if class_id:
        query["class_id"] = class_id

    students = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(500)
    outcomes = []

    for s in students:
        # Get submissions and grades
        subs = await db.submissions.find({"student_id": s["user_id"]}, {"_id": 0}).to_list(200)
        grades = [sub["grade"] for sub in subs if sub.get("grade") is not None]
        avg_grade = round(sum(grades) / len(grades), 1) if grades else 0

        # Attendance
        att_present = 0
        att_total = 0
        att_records = await db.attendance.find({}, {"_id": 0, "records": 1}).to_list(500)
        for rec in att_records:
            for r in rec.get("records", []):
                if r.get("student_id") == s["user_id"]:
                    att_total += 1
                    if r.get("status") == "present":
                        att_present += 1
        att_rate = round(att_present / att_total * 100) if att_total else 0

        # Assignment completion
        student_assignments = await db.assignments.find(
            {"class_ids": s.get("class_id"), "published": True}, {"_id": 0, "assignment_id": 1}
        ).to_list(100)
        total_assignments = len(student_assignments)
        submitted = 0
        for a in student_assignments:
            sub = await db.submissions.find_one({"assignment_id": a["assignment_id"], "student_id": s["user_id"]}, {"_id": 0})
            if sub:
                submitted += 1
        completion_rate = round(submitted / total_assignments * 100) if total_assignments else 0

        # Risk flags
        risk_flags = []
        if avg_grade > 0 and avg_grade < 40:
            risk_flags.append("low_grades")
        if att_rate < 80 and att_total > 0:
            risk_flags.append("low_attendance")
        if completion_rate < 50 and total_assignments > 0:
            risk_flags.append("low_completion")

        risk_level = "high" if len(risk_flags) >= 2 else ("medium" if len(risk_flags) == 1 else "low")

        cls = await db.classes.find_one({"class_id": s.get("class_id")}, {"_id": 0, "name": 1})
        outcomes.append({
            "student_id": s["user_id"], "name": s["name"],
            "class_name": cls["name"] if cls else "", "year_group": s.get("year_group", ""),
            "avg_grade": avg_grade, "attendance_rate": att_rate,
            "assignment_completion": completion_rate,
            "total_assignments": total_assignments, "submitted": submitted,
            "risk_level": risk_level, "risk_flags": risk_flags
        })

    outcomes.sort(key=lambda x: ({"high": 0, "medium": 1, "low": 2}.get(x["risk_level"], 3), -x.get("avg_grade", 0)))
    at_risk = [o for o in outcomes if o["risk_level"] in ("high", "medium")]
    return {"students": outcomes, "at_risk_count": len(at_risk), "total": len(outcomes)}


# ─── Alerts ───
@router.get("/alerts")
async def get_alerts(user: dict = Depends(get_current_user)):
    alerts = []

    # Missing lesson plans (teachers with 0 plans this term)
    teachers = await db.users.find({"role": "Teacher"}, {"_id": 0, "user_id": 1, "name": 1}).to_list(100)
    for t in teachers:
        plan_count = await db.lesson_plans.count_documents({"teacher_id": t["user_id"]})
        if plan_count == 0:
            alerts.append({"type": "warning", "category": "lesson_plans", "message": f"{t['name']} has no lesson plans submitted", "teacher_id": t["user_id"], "priority": "medium"})

    # Overdue marking
    marking = await marking_monitor(user=user)
    for m in marking.get("assignments", []):
        if m["is_overdue"] and m["ungraded"] > 0:
            alerts.append({"type": "danger", "category": "marking", "message": f"Marking overdue: {m['title']} ({m['ungraded']} ungraded) - {m['teacher_name']}", "teacher_id": m.get("teacher_id"), "priority": "high"})

    # At-risk students
    outcomes = await student_outcomes(user=user)
    for s in outcomes.get("students", []):
        if s["risk_level"] == "high":
            alerts.append({"type": "danger", "category": "student", "message": f"At-risk student: {s['name']} ({', '.join(s['risk_flags'])})", "student_id": s["student_id"], "priority": "high"})

    # Unmatched payments
    unmatched = await db.payments_v2.count_documents({"status": "unmatched"})
    if unmatched > 0:
        alerts.append({"type": "warning", "category": "finance", "message": f"{unmatched} unmatched payment(s) awaiting allocation", "priority": "medium"})

    # Staff late (from clock entries)
    alerts.sort(key=lambda x: {"high": 0, "medium": 1, "low": 2}.get(x.get("priority", "low"), 3))
    return {"alerts": alerts, "total": len(alerts), "high": sum(1 for a in alerts if a["priority"] == "high"), "medium": sum(1 for a in alerts if a["priority"] == "medium")}


# ─── Executive Dashboard ───
@router.get("/executive-dashboard")
async def executive_dashboard(user: dict = Depends(require_roles(*MONITOR_ROLES, "Admin", "SuperAdmin"))):
    # Academic metrics
    total_students = await db.users.count_documents({"role": "Student"})
    total_teachers = await db.users.count_documents({"role": "Teacher"})
    total_lessons = await db.lessons.count_documents({})
    total_assignments = await db.assignments.count_documents({})

    # Compliance
    teachers = await db.users.find({"role": "Teacher"}, {"_id": 0, "user_id": 1}).to_list(100)
    teachers_with_plans = 0
    for t in teachers:
        if await db.lesson_plans.count_documents({"teacher_id": t["user_id"]}) > 0:
            teachers_with_plans += 1
    plan_compliance = round(teachers_with_plans / len(teachers) * 100) if teachers else 0

    # Marking
    total_subs = await db.submissions.count_documents({})
    graded_subs = await db.submissions.count_documents({"grade": {"$ne": None}})
    marking_rate = round(graded_subs / total_subs * 100) if total_subs else 100

    # Finance
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    inv_v2 = await db.invoices_v2.find({"status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(1000)
    total_invoiced = sum(i.get("total", 0) for i in invoices) + sum(i.get("total_due", 0) for i in inv_v2)
    total_collected = sum(i.get("paid", 0) for i in invoices) + sum(i.get("amount_paid", 0) for i in inv_v2)
    collection_rate = round(total_collected / total_invoiced * 100) if total_invoiced else 0

    # Alerts
    alert_data = await get_alerts(user=user)

    # Observations
    obs = await db.observations.find({}, {"_id": 0, "overall_rating": 1, "rating": 1}).to_list(500)
    avg_obs = round(sum(o.get("overall_rating", o.get("rating", 0)) for o in obs) / len(obs), 1) if obs else 0

    return {
        "academic": {
            "students": total_students, "teachers": total_teachers,
            "lessons": total_lessons, "assignments": total_assignments,
            "plan_compliance": plan_compliance, "marking_rate": marking_rate,
            "avg_observation": avg_obs
        },
        "finance": {
            "total_invoiced": round(total_invoiced, 2), "total_collected": round(total_collected, 2),
            "collection_rate": collection_rate
        },
        "alerts": alert_data,
        "at_risk_students": alert_data.get("alerts", [])[:5]
    }


# ─── KPIs Endpoint (backward compat) ───
@router.get("/kpis")
async def teacher_kpis(teacher_id: str = None, user: dict = Depends(get_current_user)):
    tid = teacher_id or (user["user_id"] if user["role"] == "Teacher" else None)
    if tid:
        scorecard = await teacher_scorecard(tid, user=user)
        return scorecard.get("kpis", {})
    return {}



# ─── Self Review (Teachers see their own data) ───
@router.get("/my-review")
async def my_review(user: dict = Depends(get_current_user)):
    """Teacher sees their own full review: activity metrics, management comments, and all work."""
    teacher_id = user["user_id"]
    teacher = await db.users.find_one({"user_id": teacher_id}, {"_id": 0, "password_hash": 0, "last_set_password": 0})
    if not teacher:
        raise HTTPException(status_code=404, detail="User not found")

    # Reuse the same aggregation logic
    lessons_raw = await db.lessons.find({"teacher_id": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    subj_ids = list({l.get("subject_id") for l in lessons_raw if l.get("subject_id")})
    subj_map = {}
    if subj_ids:
        for s in await db.subjects.find({"subject_id": {"$in": subj_ids}}, {"_id": 0, "subject_id": 1, "name": 1}).to_list(len(subj_ids)):
            subj_map[s["subject_id"]] = s["name"]
    for l in lessons_raw:
        l["subject_name"] = subj_map.get(l.get("subject_id"), "")

    plans = await db.lesson_plans.find({"teacher_id": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for p in plans:
        p["subject_name"] = subj_map.get(p.get("subject_id"), "")
        cls = await db.classes.find_one({"class_id": p.get("class_id")}, {"_id": 0, "name": 1})
        p["class_name"] = cls["name"] if cls else ""

    assignments = await db.assignments.find({"teacher_id": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for a in assignments:
        a["subject_name"] = subj_map.get(a.get("subject_id"), "")
        total = await db.submissions.count_documents({"assignment_id": a["assignment_id"]})
        graded = await db.submissions.count_documents({"assignment_id": a["assignment_id"], "grade": {"$ne": None}})
        a["total_submissions"] = total
        a["graded_count"] = graded

    files = await db.file_assets.find({"owner_user_id": teacher_id, "is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(200)
    staff_docs = await db.staff_documents.find({"user_id": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    clock_history = await db.clock_entries.find({"user_id": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(30)
    audit_logs = await db.audit_logs.find({"user_id": teacher_id}, {"_id": 0}).sort("timestamp", -1).to_list(50)
    remarks = await db.teacher_remarks.find({"author_id": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    wp_docs = await db.wp_documents.find({"uploaded_by": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    wp_audit = await db.wp_audit.find({"user_id": teacher_id}, {"_id": 0}).sort("timestamp", -1).to_list(30)

    mgmt_comments = await db.management_comments.find({"teacher_id": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(100)

    scorecard = await teacher_scorecard(teacher_id, user=user)

    # Activity metrics calculation using shared helper
    activity_metrics, daily_metrics = compute_activity_scores(
        lessons_raw, assignments, plans, files, clock_history, audit_logs, wp_docs, wp_audit
    )

    return {
        "teacher": teacher,
        "scorecard": scorecard,
        "lessons": lessons_raw,
        "lesson_plans": plans,
        "assignments": assignments,
        "uploaded_files": files,
        "staff_documents": staff_docs,
        "clock_history": clock_history,
        "audit_logs": audit_logs,
        "remarks": remarks,
        "wp_documents": wp_docs,
        "wp_audit": wp_audit,
        "management_comments": mgmt_comments,
        "activity_metrics": activity_metrics,
        "daily_metrics": daily_metrics,
        "summary": {
            "total_lessons": len(lessons_raw),
            "total_plans": len(plans),
            "total_assignments": len(assignments),
            "total_files": len(files),
            "total_staff_docs": len(staff_docs),
            "total_remarks": len(remarks),
            "total_wp_docs": len(wp_docs),
        }
    }


# ─── Comprehensive Teacher Review ───
@router.get("/teacher-full-review/{teacher_id}")
async def teacher_full_review(teacher_id: str, user: dict = Depends(require_roles(*MONITOR_ROLES))):
    """Full 360° review: lessons, plans, assignments, files, documents, audit logs, clock history, remarks, WP activity."""
    teacher = await db.users.find_one({"user_id": teacher_id}, {"_id": 0, "password_hash": 0, "last_set_password": 0})
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    # ── Lessons ──
    lessons_raw = await db.lessons.find({"teacher_id": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    subj_ids = list({l.get("subject_id") for l in lessons_raw if l.get("subject_id")})
    subj_map = {}
    if subj_ids:
        for s in await db.subjects.find({"subject_id": {"$in": subj_ids}}, {"_id": 0, "subject_id": 1, "name": 1}).to_list(len(subj_ids)):
            subj_map[s["subject_id"]] = s["name"]
    for l in lessons_raw:
        l["subject_name"] = subj_map.get(l.get("subject_id"), "")

    # ── Lesson Plans ──
    plans = await db.lesson_plans.find({"teacher_id": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for p in plans:
        p["subject_name"] = subj_map.get(p.get("subject_id"), "")
        cls = await db.classes.find_one({"class_id": p.get("class_id")}, {"_id": 0, "name": 1})
        p["class_name"] = cls["name"] if cls else ""

    # ── Assignments ──
    assignments = await db.assignments.find({"teacher_id": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for a in assignments:
        a["subject_name"] = subj_map.get(a.get("subject_id"), "")
        total = await db.submissions.count_documents({"assignment_id": a["assignment_id"]})
        graded = await db.submissions.count_documents({"assignment_id": a["assignment_id"], "grade": {"$ne": None}})
        a["total_submissions"] = total
        a["graded_count"] = graded

    # ── Uploaded Files ──
    files = await db.file_assets.find(
        {"owner_user_id": teacher_id, "is_deleted": False}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    # ── Staff Documents (CVs, certificates) ──
    staff_docs = await db.staff_documents.find({"user_id": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(100)

    # ── Clock-in History (last 30 entries) ──
    clock_history = await db.clock_entries.find({"user_id": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(30)

    # ── Audit Logs (activity trail) ──
    audit_logs = await db.audit_logs.find({"user_id": teacher_id}, {"_id": 0}).sort("timestamp", -1).to_list(50)

    # ── Remarks submitted ──
    remarks = await db.teacher_remarks.find({"author_id": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(50)

    # ── Working Paper activity ──
    wp_docs = await db.wp_documents.find({"uploaded_by": teacher_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    wp_audit = await db.wp_audit.find({"user_id": teacher_id}, {"_id": 0}).sort("timestamp", -1).to_list(30)

    # ── Scorecard KPIs (reuse existing) ──
    scorecard = await teacher_scorecard(teacher_id, user=user)

    # ── Management Comments ──
    mgmt_comments = await db.management_comments.find(
        {"teacher_id": teacher_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    # ── Activity Metrics Calculation using shared helper ──
    activity_metrics, daily_metrics = compute_activity_scores(
        lessons_raw, assignments, plans, files, clock_history, audit_logs, wp_docs, wp_audit
    )

    return {
        "teacher": teacher,
        "scorecard": scorecard,
        "lessons": lessons_raw,
        "lesson_plans": plans,
        "assignments": assignments,
        "uploaded_files": files,
        "staff_documents": staff_docs,
        "clock_history": clock_history,
        "audit_logs": audit_logs,
        "remarks": remarks,
        "wp_documents": wp_docs,
        "wp_audit": wp_audit,
        "management_comments": mgmt_comments,
        "activity_metrics": activity_metrics,
        "daily_metrics": daily_metrics,
        "summary": {
            "total_lessons": len(lessons_raw),
            "total_plans": len(plans),
            "total_assignments": len(assignments),
            "total_files": len(files),
            "total_staff_docs": len(staff_docs),
            "total_remarks": len(remarks),
            "total_wp_docs": len(wp_docs),
        }
    }


# ─── Management Comments CRUD ───
@router.post("/teacher-comments/{teacher_id}")
async def add_management_comment(teacher_id: str, body: dict, user: dict = Depends(require_roles(*MONITOR_ROLES))):
    """Management leaves a comment/note on a teacher's record."""
    import uuid
    from datetime import datetime, timezone
    teacher = await db.users.find_one({"user_id": teacher_id}, {"_id": 0, "user_id": 1})
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    comment = {
        "comment_id": f"mc_{uuid.uuid4().hex[:12]}",
        "teacher_id": teacher_id,
        "author_id": user["user_id"],
        "author_name": user.get("name", user.get("email", "")),
        "author_role": user.get("role", ""),
        "category": body.get("category", "general"),
        "subject": body.get("subject", ""),
        "text": body.get("text", "").strip(),
        "visibility": body.get("visibility", "management"),
        "pinned": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if not comment["text"]:
        raise HTTPException(status_code=400, detail="Comment text required")
    await db.management_comments.insert_one(comment)
    comment.pop("_id", None)
    return comment


@router.delete("/teacher-comments/{comment_id}")
async def delete_management_comment(comment_id: str, user: dict = Depends(require_roles(*MONITOR_ROLES))):
    result = await db.management_comments.delete_one({"comment_id": comment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"status": "deleted"}


@router.patch("/teacher-comments/{comment_id}/pin")
async def pin_management_comment(comment_id: str, user: dict = Depends(require_roles(*MONITOR_ROLES))):
    doc = await db.management_comments.find_one({"comment_id": comment_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Comment not found")
    new_val = not doc.get("pinned", False)
    await db.management_comments.update_one({"comment_id": comment_id}, {"$set": {"pinned": new_val}})
    return {"pinned": new_val}
