"""
TCIS Analytics Dashboard — Academic, Financial, Staff analytics endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from database import db, get_active_term
from auth import get_current_user
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

MGMT_ROLES = ("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher", "Founder", "HeadOfAcademics")


def _require_mgmt(user):
    roles = user.get("roles", [user.get("role", "")])
    if not any(r in roles for r in MGMT_ROLES):
        raise HTTPException(status_code=403, detail="Management only")


@router.get("/academic")
async def academic_analytics(user: dict = Depends(get_current_user)):
    _require_mgmt(user)
    active_term, academic_year = await get_active_term()
    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()

    # Schemes
    total_schemes = await db.schemes.count_documents({})
    schemes_this_term = await db.schemes.count_documents({"term": active_term})
    schemes_by_status = {}
    for st in ["draft", "in_progress", "submitted", "under_review", "approved", "returned", "published"]:
        schemes_by_status[st] = await db.schemes.count_documents({"status": st})
    ai_enhanced = await db.schemes.count_documents({"ai_processed": True})

    # Scheme submissions over time (last 30 days)
    scheme_pipeline = [
        {"$match": {"submitted_at": {"$ne": None}}},
        {"$addFields": {"sub_date": {"$substr": ["$submitted_at", 0, 10]}}},
        {"$group": {"_id": "$sub_date", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
        {"$limit": 30}
    ]
    submission_trend = await db.schemes.aggregate(scheme_pipeline).to_list(30)

    # Department breakdown
    dept_pipeline = [
        {"$match": {"department": {"$ne": ""}}},
        {"$group": {"_id": "$department", "total": {"$sum": 1},
                    "submitted": {"$sum": {"$cond": [{"$in": ["$status", ["submitted", "under_review", "approved", "published"]]}, 1, 0]}},
                    "approved": {"$sum": {"$cond": [{"$eq": ["$status", "approved"]}, 1, 0]}}}},
        {"$sort": {"total": -1}}
    ]
    by_department = await db.schemes.aggregate(dept_pipeline).to_list(50)

    # Resources
    total_resources = await db.lms_resources.count_documents({})
    published_resources = await db.lms_resources.count_documents({"published": True})

    # Quizzes
    total_quizzes = await db.quizzes.count_documents({})

    # Lessons
    total_lessons = await db.timetable_v2.count_documents({})
    lessons_30d = await db.timetable_v2.count_documents({"created_at": {"$gte": thirty_days_ago}})

    # Gradebook
    gradebook_entries = await db.gradebook_entries.count_documents({})

    # Year group distribution of schemes
    yg_pipeline = [
        {"$match": {"year_group": {"$ne": ""}}},
        {"$group": {"_id": "$year_group", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    by_year_group = await db.schemes.aggregate(yg_pipeline).to_list(20)

    return {
        "term": active_term, "academic_year": academic_year,
        "schemes": {
            "total": total_schemes, "this_term": schemes_this_term,
            "by_status": schemes_by_status, "ai_enhanced": ai_enhanced,
            "submission_trend": [{"date": s["_id"], "count": s["count"]} for s in submission_trend],
            "by_department": [{"department": d["_id"], "total": d["total"], "submitted": d["submitted"], "approved": d["approved"]} for d in by_department],
            "by_year_group": [{"year_group": y["_id"], "count": y["count"]} for y in by_year_group],
        },
        "resources": {"total": total_resources, "published": published_resources},
        "quizzes": {"total": total_quizzes},
        "lessons": {"total": total_lessons, "last_30d": lessons_30d},
        "gradebook_entries": gradebook_entries,
    }


@router.get("/financial")
async def financial_analytics(user: dict = Depends(get_current_user)):
    _require_mgmt(user)
    active_term, academic_year = await get_active_term()

    # Invoice totals
    inv_pipeline = [
        {"$match": {"status": {"$ne": "cancelled"}}},
        {"$group": {
            "_id": None,
            "total_invoiced": {"$sum": "$total_due"},
            "count": {"$sum": 1},
        }}
    ]
    inv_agg = await db.invoices_v2.aggregate(inv_pipeline).to_list(1)
    inv_data = inv_agg[0] if inv_agg else {"total_invoiced": 0, "count": 0}

    # Payments total
    pay_pipeline = [
        {"$group": {"_id": None, "total_paid": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    pay_agg = await db.payments_v2.aggregate(pay_pipeline).to_list(1)
    pay_data = pay_agg[0] if pay_agg else {"total_paid": 0, "count": 0}

    # Outstanding = invoiced - paid
    total_invoiced = inv_data.get("total_invoiced", 0)
    total_paid = pay_data.get("total_paid", 0)
    outstanding = max(0, total_invoiced - total_paid)

    # Collection rate
    collection_rate = round((total_paid / total_invoiced * 100) if total_invoiced > 0 else 0, 1)

    # Invoices by term
    inv_by_term = await db.invoices_v2.aggregate([
        {"$match": {"status": {"$ne": "cancelled"}}},
        {"$group": {"_id": "$term", "amount": {"$sum": "$total_due"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]).to_list(10)

    # Outstanding by year group
    outstanding_pipeline = [
        {"$match": {"status": {"$ne": "cancelled"}}},
        {"$group": {"_id": "$year_group", "invoiced": {"$sum": "$total_due"}, "count": {"$sum": 1}}},
        {"$sort": {"invoiced": -1}}
    ]
    by_year_group = await db.invoices_v2.aggregate(outstanding_pipeline).to_list(20)

    # Payment trend (by date)
    pay_trend = await db.payments_v2.aggregate([
        {"$addFields": {"pay_date": {"$substr": [{"$ifNull": ["$created_at", "$paid_at"]}, 0, 10]}}},
        {"$group": {"_id": "$pay_date", "amount": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
        {"$limit": 30}
    ]).to_list(30)

    # Expenses
    exp_pipeline = [
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}}
    ]
    expenses_by_cat = await db.expenses.aggregate(exp_pipeline).to_list(20)
    total_expenses = sum(e["total"] for e in expenses_by_cat)

    # Budget summary
    budget_pipeline = [
        {"$group": {"_id": None, "total_budget": {"$sum": "$allocated"}, "total_spent": {"$sum": "$spent"}}}
    ]
    budget_agg = await db.budgets.aggregate(budget_pipeline).to_list(1)
    budget_data = budget_agg[0] if budget_agg else {"total_budget": 0, "total_spent": 0}

    return {
        "term": active_term, "academic_year": academic_year,
        "revenue": {
            "total_invoiced": round(total_invoiced, 2),
            "total_paid": round(total_paid, 2),
            "outstanding": round(outstanding, 2),
            "collection_rate": collection_rate,
            "invoice_count": inv_data.get("count", 0),
            "payment_count": pay_data.get("count", 0),
        },
        "by_term": [{"term": t["_id"], "amount": round(t["amount"], 2), "count": t["count"]} for t in inv_by_term],
        "by_year_group": [{"year_group": y["_id"] or "Unknown", "invoiced": round(y["invoiced"], 2), "count": y["count"]} for y in by_year_group],
        "payment_trend": [{"date": p["_id"], "amount": round(p["amount"], 2), "count": p["count"]} for p in reversed(pay_trend)],
        "expenses": {
            "total": round(total_expenses, 2),
            "by_category": [{"category": e["_id"] or "Uncategorized", "total": round(e["total"], 2), "count": e["count"]} for e in expenses_by_cat],
        },
        "budget": {
            "total_allocated": round(budget_data.get("total_budget", 0), 2),
            "total_spent": round(budget_data.get("total_spent", 0), 2),
            "utilization": round((budget_data.get("total_spent", 0) / budget_data.get("total_budget", 1)) * 100, 1) if budget_data.get("total_budget", 0) > 0 else 0,
        },
    }


@router.get("/staff")
async def staff_analytics(user: dict = Depends(get_current_user)):
    _require_mgmt(user)
    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    # Staff counts by role
    role_pipeline = [
        {"$match": {"role": {"$nin": ["Student", "Parent"]}}},
        {"$group": {"_id": "$role", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_role = await db.users.aggregate(role_pipeline).to_list(20)
    total_staff = sum(r["count"] for r in by_role)

    # Department breakdown
    dept_pipeline = [
        {"$match": {"role": {"$nin": ["Student", "Parent"]}, "department": {"$ne": ""}}},
        {"$group": {"_id": "$department", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_department = await db.users.aggregate(dept_pipeline).to_list(30)

    # Clock-in stats today
    clocked_in_today = await db.clock_entries.count_documents({"clock_in": {"$gte": today_start}})

    # Clock-in trend (last 30 days)
    clock_pipeline = [
        {"$match": {"clock_in": {"$gte": thirty_days_ago}}},
        {"$addFields": {"clock_date": {"$substr": ["$clock_in", 0, 10]}}},
        {"$group": {"_id": "$clock_date", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    clock_trend = await db.clock_entries.aggregate(clock_pipeline).to_list(30)

    # Activity (audit logs last 30 days by user)
    activity_pipeline = [
        {"$match": {"timestamp": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": "$user_name", "actions": {"$sum": 1}}},
        {"$sort": {"actions": -1}},
        {"$limit": 15}
    ]
    top_active = await db.audit_logs.aggregate(activity_pipeline).to_list(15)

    # Audit actions by type
    action_pipeline = [
        {"$match": {"timestamp": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_actions = await db.audit_logs.aggregate(action_pipeline).to_list(10)

    total_audit_30d = await db.audit_logs.count_documents({"timestamp": {"$gte": thirty_days_ago}})

    # CPD courses & enrolments
    cpd_courses = await db.cpd_courses.count_documents({})
    cpd_enrolments = await db.cpd_enrolments.count_documents({})

    # Leave requests
    leave_pending = await db.leave_requests.count_documents({"status": "pending"})
    leave_approved = await db.leave_requests.count_documents({"status": "approved"})

    return {
        "total_staff": total_staff,
        "by_role": [{"role": r["_id"], "count": r["count"]} for r in by_role],
        "by_department": [{"department": d["_id"], "count": d["count"]} for d in by_department],
        "clock_in": {
            "today": clocked_in_today,
            "trend": [{"date": c["_id"], "count": c["count"]} for c in clock_trend],
        },
        "activity": {
            "total_30d": total_audit_30d,
            "top_active_staff": [{"name": a["_id"] or "System", "actions": a["actions"]} for a in top_active],
            "top_actions": [{"action": a["_id"], "count": a["count"]} for a in top_actions],
        },
        "cpd": {"courses": cpd_courses, "enrolments": cpd_enrolments},
        "leave": {"pending": leave_pending, "approved": leave_approved},
    }
