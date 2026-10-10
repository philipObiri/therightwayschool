"""
TCIS Calendar — Aggregates events from meetings, WP tasks, finance deadlines, assignments.
Supports creating custom events and viewing events by date range.
"""
from fastapi import APIRouter, Depends, Body, HTTPException
from database import db
from models import gen_id
from auth import get_current_user
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("/events")
async def get_events(start: str = "", end: str = "", user: dict = Depends(get_current_user)):
    """Get all events for a date range, aggregated from multiple sources."""
    if not start:
        start = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    if not end:
        end = (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()

    events = []
    uid = user["user_id"]

    # 1. School-wide calendar events (visible to ALL users)
    school_events = await db.calendar_events.find(
        {"school_wide": True, "start_time": {"$gte": start, "$lte": end}},
        {"_id": 0}
    ).to_list(500)
    for e in school_events:
        events.append({
            "event_id": e["event_id"], "title": e["title"], "description": e.get("description", ""),
            "start": e["start_time"], "end": e.get("end_time", e["start_time"]),
            "type": e.get("event_type", "school"), "color": e.get("color", "#1B2A4A"),
            "category": e.get("category", ""),
            "source": "school_calendar", "editable": user.get("role") in ("Admin", "SuperAdmin", "CEO"),
        })

    # 2. Custom personal calendar events
    custom = await db.calendar_events.find(
        {"school_wide": {"$ne": True}, "$or": [{"created_by": uid}, {"attendees": uid}], "start_time": {"$gte": start, "$lte": end}},
        {"_id": 0}
    ).to_list(200)
    for e in custom:
        events.append({
            "event_id": e["event_id"], "title": e["title"], "description": e.get("description", ""),
            "start": e["start_time"], "end": e.get("end_time", e["start_time"]),
            "type": "custom", "color": e.get("color", "#2E6CC4"),
            "source": "calendar", "editable": e["created_by"] == uid,
        })

    # 2. Meetings
    meetings = await db.meetings.find(
        {"$or": [{"created_by": uid}, {"participant_ids": uid}],
         "started_at": {"$gte": start, "$lte": end}},
        {"_id": 0}
    ).to_list(100)
    for m in meetings:
        events.append({
            "event_id": m["meeting_id"], "title": m.get("title", "Meeting"),
            "description": f"Created by {m.get('created_by_name', '')}",
            "start": m["started_at"], "end": m.get("ended_at", m["started_at"]),
            "type": "meeting", "color": "#ef4444", "source": "meetings", "editable": False,
        })

    # 3. WP Tasks assigned to user
    wp_tasks = await db.wp_tasks.find(
        {"assigned_to": uid, "due_date": {"$ne": "", "$gte": start, "$lte": end}},
        {"_id": 0}
    ).to_list(100)
    for t in wp_tasks:
        events.append({
            "event_id": t["task_id"], "title": t.get("title", "WP Task"),
            "description": t.get("description", ""),
            "start": t["due_date"], "end": t["due_date"],
            "type": "wp_task", "color": "#f59e0b", "source": "working_paper", "editable": False,
        })

    # 4. Document expiry dates
    expiring = await db.wp_documents.find(
        {"expires_at": {"$ne": "", "$gte": start, "$lte": end},
         "$or": [{"author_id": uid}, {"allowed_users": uid}]},
        {"_id": 0, "document_id": 1, "title": 1, "expires_at": 1}
    ).to_list(50)
    for d in expiring:
        events.append({
            "event_id": d["document_id"], "title": f"Expires: {d.get('title', 'Document')}",
            "description": "Document expiry deadline",
            "start": d["expires_at"], "end": d["expires_at"],
            "type": "doc_expiry", "color": "#dc2626", "source": "working_paper", "editable": False,
        })

    # 5. Finance payroll periods
    if user.get("role") in ("Admin", "SuperAdmin", "FinanceOfficer", "CEO", "Founder"):
        payroll_runs = await db.finance_payroll_runs.find(
            {"period_start": {"$gte": start, "$lte": end}},
            {"_id": 0}
        ).to_list(50)
        for p in payroll_runs:
            events.append({
                "event_id": p.get("run_id", ""), "title": f"Payroll: {p.get('month', '')}/{p.get('year', '')}",
                "description": f"Status: {p.get('status', 'pending')}",
                "start": p.get("period_start", ""), "end": p.get("period_end", ""),
                "type": "payroll", "color": "#10b981", "source": "finance", "editable": False,
            })

    events.sort(key=lambda x: x.get("start", ""))
    return events


@router.post("/events")
async def create_event(data: dict = Body(...), user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    event = {
        "event_id": gen_id("evt_"),
        "title": data.get("title", "New Event"),
        "description": data.get("description", ""),
        "start_time": data.get("start_time", now),
        "end_time": data.get("end_time", ""),
        "all_day": data.get("all_day", False),
        "color": data.get("color", "#2E6CC4"),
        "attendees": data.get("attendees", []),
        "reminders": data.get("reminders", []),
        "recurrence": data.get("recurrence", "none"),
        "created_by": user["user_id"],
        "created_by_name": user["name"],
        "created_at": now,
    }
    await db.calendar_events.insert_one(event)
    return {k: v for k, v in event.items() if k != "_id"}


@router.put("/events/{event_id}")
async def update_event(event_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    evt = await db.calendar_events.find_one({"event_id": event_id}, {"_id": 0, "created_by": 1})
    if not evt:
        raise HTTPException(404, "Event not found")
    if evt["created_by"] != user["user_id"]:
        raise HTTPException(403, "Not your event")
    update = {}
    for field in ("title", "description", "start_time", "end_time", "all_day", "color", "attendees", "reminders"):
        if field in data:
            update[field] = data[field]
    if update:
        await db.calendar_events.update_one({"event_id": event_id}, {"$set": update})
    return {"message": "Event updated"}


@router.delete("/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(get_current_user)):
    evt = await db.calendar_events.find_one({"event_id": event_id}, {"_id": 0, "created_by": 1})
    if not evt:
        raise HTTPException(404, "Event not found")
    if evt["created_by"] != user["user_id"]:
        raise HTTPException(403, "Not your event")
    await db.calendar_events.delete_one({"event_id": event_id})
    return {"message": "Event deleted"}



@router.post("/seed-term3")
async def seed_term3_calendar(user: dict = Depends(get_current_user)):
    """Seed Term 3 2025-2026 academic calendar events."""
    if user.get("role") not in ("Admin", "SuperAdmin", "CEO", "Founder", "Principal"):
        raise HTTPException(403, "Admin only")

    # Check if already seeded
    existing = await db.calendar_events.count_documents({"school_wide": True, "academic_term": "Term 3 2025-2026"})
    if existing > 0:
        return {"message": f"Already seeded ({existing} events exist)", "count": existing}

    events = [
        {"title": "Boarders Arrive", "start": "2026-04-19", "end": "2026-04-19", "category": "reopening", "color": "#1B2A4A", "desc": "Boarders report between 2:00pm - 5:00pm"},
        {"title": "Lessons Begin", "start": "2026-04-20", "end": "2026-04-24", "category": "academic", "color": "#2E6CC4", "desc": "Term 3 lessons commence"},
        {"title": "Lessons Continue", "start": "2026-04-27", "end": "2026-05-01", "category": "academic", "color": "#2E6CC4", "desc": ""},
        {"title": "Progressive Test 1", "start": "2026-05-04", "end": "2026-05-08", "category": "assessment", "color": "#C5A55A", "desc": "Year 11 & 13 exam candidates are exempted"},
        {"title": "Lessons Continue", "start": "2026-05-11", "end": "2026-05-15", "category": "academic", "color": "#2E6CC4", "desc": "Continuing students"},
        {"title": "Founders Math & Science Quiz", "start": "2026-05-15", "end": "2026-05-15", "category": "competition", "color": "#059669", "desc": "Annual inter-class competition"},
        {"title": "1st Parental Visit", "start": "2026-05-17", "end": "2026-05-17", "category": "parent_event", "color": "#7C3AED", "desc": "Parents visit day"},
        {"title": "Midterm Exam Begins", "start": "2026-05-18", "end": "2026-05-22", "category": "exam", "color": "#DC2626", "desc": "Midterm examinations"},
        {"title": "Mid-Term Exam Continues", "start": "2026-05-25", "end": "2026-05-29", "category": "exam", "color": "#DC2626", "desc": "Midterm examinations continue"},
        {"title": "AU Day Celebration", "start": "2026-05-28", "end": "2026-05-28", "category": "celebration", "color": "#059669", "desc": "Details in newsletter"},
        {"title": "Labour Day (Public Holiday)", "start": "2026-05-01", "end": "2026-05-01", "category": "holiday", "color": "#F59E0B", "desc": "Public Holiday — No school"},
        {"title": "Eid al-Adha (Public Holiday)", "start": "2026-05-29", "end": "2026-05-29", "category": "holiday", "color": "#F59E0B", "desc": "Public Holiday"},
        {"title": "MID-TERM BREAK", "start": "2026-06-01", "end": "2026-06-05", "category": "holiday", "color": "#F59E0B", "desc": "Mid-term break — no school"},
        {"title": "Revision Week", "start": "2026-06-08", "end": "2026-06-12", "category": "academic", "color": "#2E6CC4", "desc": "Revision and preparation for End of Term exams"},
        {"title": "End of Term Exam Begins", "start": "2026-06-15", "end": "2026-06-19", "category": "exam", "color": "#DC2626", "desc": "End of Term examinations"},
        {"title": "End of Term Exam Continues", "start": "2026-06-22", "end": "2026-06-26", "category": "exam", "color": "#DC2626", "desc": "End of Term examinations continue"},
        {"title": "Speech Day & Graduation Rehearsals", "start": "2026-06-29", "end": "2026-07-03", "category": "event", "color": "#7C3AED", "desc": "Rehearsals for speech and prize giving day"},
        {"title": "End of Term Exam (Final)", "start": "2026-07-06", "end": "2026-07-10", "category": "exam", "color": "#DC2626", "desc": "Final End of Term examinations"},
        {"title": "Speech & Prize Giving Day / Graduation", "start": "2026-07-11", "end": "2026-07-11", "category": "ceremony", "color": "#C5A55A", "desc": "Annual speech and prize giving day & graduation ceremony"},
        {"title": "School Closes — Vacation Begins", "start": "2026-07-11", "end": "2026-07-11", "category": "closing", "color": "#1B2A4A", "desc": "Boarders and day students depart for vacation"},
        {"title": "Boarders Arrive (Next Year)", "start": "2026-09-13", "end": "2026-09-13", "category": "reopening", "color": "#1B2A4A", "desc": "New academic year — boarders report"},
        {"title": "Classes Begin (Next Year)", "start": "2026-09-14", "end": "2026-09-14", "category": "academic", "color": "#2E6CC4", "desc": "New academic year classes commence"},
    ]

    now = datetime.now(timezone.utc).isoformat()
    count = 0
    for e in events:
        doc = {
            "event_id": gen_id("evt_"),
            "title": e["title"],
            "description": e["desc"],
            "start_time": f"{e['start']}T08:00:00+00:00",
            "end_time": f"{e['end']}T17:00:00+00:00",
            "all_day": True,
            "color": e["color"],
            "category": e["category"],
            "event_type": "school",
            "school_wide": True,
            "academic_term": "Term 3 2025-2026",
            "attendees": [],
            "created_by": user["user_id"],
            "created_by_name": user["name"],
            "created_at": now,
        }
        await db.calendar_events.insert_one(doc)
        count += 1

    return {"message": f"Seeded {count} Term 3 events", "count": count}
