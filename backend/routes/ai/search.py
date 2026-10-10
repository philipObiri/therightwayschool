from fastapi import APIRouter, Depends, HTTPException
from database import db
from models import gen_id
from auth import get_current_user, require_roles, log_audit
from datetime import datetime, timezone
import os
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
async def global_search(q: str = "", user: dict = Depends(get_current_user)):
    if not q or len(q) < 2:
        return {"results": []}

    results = []
    regex = {"$regex": q, "$options": "i"}

    # Search students
    students = await db.users.find(
        {"role": "Student", "$or": [{"name": regex}, {"email": regex}, {"admission_number": regex}]},
        {"_id": 0, "password_hash": 0}
    ).to_list(10)
    for s in students:
        results.append({"type": "student", "id": s["user_id"], "title": s["name"],
                        "subtitle": s.get("email", ""), "meta": s.get("admission_number", "")})

    # Search staff
    if user.get("role") in ("Admin", "SuperAdmin", "HR_Officer", "CEO", "Founder", "Principal", "HeadTeacher"):
        staff = await db.users.find(
            {"role": {"$nin": ["Student", "Parent"]}, "$or": [{"name": regex}, {"email": regex}]},
            {"_id": 0, "password_hash": 0}
        ).to_list(10)
        for s in staff:
            results.append({"type": "staff", "id": s["user_id"], "title": s["name"],
                            "subtitle": s.get("role", ""), "meta": s.get("department", "")})

    # Search classes
    classes = await db.classes.find({"$or": [{"name": regex}, {"year_group": regex}]}, {"_id": 0}).to_list(10)
    for c in classes:
        results.append({"type": "class", "id": c["class_id"], "title": c["name"],
                        "subtitle": c.get("year_group", ""), "meta": ""})

    # Search subjects
    subjects = await db.subjects.find({"$or": [{"name": regex}, {"code": regex}]}, {"_id": 0}).to_list(10)
    for s in subjects:
        results.append({"type": "subject", "id": s["subject_id"], "title": s["name"],
                        "subtitle": s.get("code", ""), "meta": s.get("department", "")})

    # Search invoices
    if user.get("role") in ("Admin", "SuperAdmin", "FinanceOfficer", "CEO"):
        inv_students = await db.users.find({"role": "Student", "name": regex}, {"_id": 0, "user_id": 1}).to_list(50)
        sids = [s["user_id"] for s in inv_students]
        if sids:
            invoices = await db.invoices.find({"student_id": {"$in": sids}}, {"_id": 0}).to_list(10)
            for inv in invoices:
                student = await db.users.find_one({"user_id": inv["student_id"]}, {"_id": 0, "name": 1})
                results.append({"type": "invoice", "id": inv["invoice_id"],
                                "title": f"Invoice - {student['name'] if student else ''}",
                                "subtitle": f"GHS {inv.get('total', 0)}", "meta": inv.get("status", "")})

    # Search tasks
    tasks = await db.tasks.find({"$or": [{"title": regex}, {"description": regex}]}, {"_id": 0}).to_list(10)
    for t in tasks:
        results.append({"type": "task", "id": t["task_id"], "title": t["title"],
                        "subtitle": t.get("status", ""), "meta": t.get("priority", "")})

    # Search lessons
    lessons = await db.lessons.find({"$or": [{"title": regex}, {"description": regex}]}, {"_id": 0}).to_list(10)
    for l in lessons:
        results.append({"type": "lesson", "id": l["lesson_id"], "title": l["title"],
                        "subtitle": l.get("lesson_type", ""), "meta": ""})

    # Search WP documents (Knowledge Base)
    wp_docs = await db.wp_documents.find({"$or": [{"title": regex}, {"description": regex}]}, {"_id": 0}).to_list(10)
    for d in wp_docs:
        results.append({"type": "document", "id": d["document_id"], "title": d.get("title", ""),
                        "subtitle": d.get("status", ""), "meta": d.get("classification", "")})

    # Search chat messages
    msgs = await db.chat_messages.find(
        {"content": regex, "deleted": False},
        {"_id": 0, "message_id": 1, "content": 1, "sender_name": 1, "chat_id": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(5)
    for m in msgs:
        results.append({"type": "message", "id": m["message_id"], "title": m.get("content", "")[:80],
                        "subtitle": f"from {m.get('sender_name', '')}", "meta": m.get("chat_id", "")})

    return {"results": results[:40], "total": len(results)}


@router.get("/ai")
async def ai_search(q: str = "", user: dict = Depends(get_current_user)):
    """AI-assisted search using Gemini to understand natural language queries and return smart results."""
    if not q or len(q) < 3:
        return {"answer": "", "results": [], "suggestions": []}

    # First do normal search
    regex = {"$regex": q, "$options": "i"}
    context_items = []

    # Gather context from DB
    students = await db.users.find({"role": "Student", "name": regex}, {"_id": 0, "name": 1, "email": 1, "year_group": 1}).to_list(5)
    for s in students:
        context_items.append(f"Student: {s['name']} ({s.get('email', '')}, Year {s.get('year_group', '')})")

    staff = await db.users.find({"role": {"$nin": ["Student", "Parent"]}, "$or": [{"name": regex}, {"role": regex}]}, {"_id": 0, "name": 1, "role": 1, "department": 1}).to_list(5)
    for s in staff:
        context_items.append(f"Staff: {s['name']} - {s.get('role', '')} ({s.get('department', '')})")

    docs = await db.wp_documents.find({"$or": [{"title": regex}, {"description": regex}]}, {"_id": 0, "title": 1, "status": 1, "classification": 1}).to_list(5)
    for d in docs:
        context_items.append(f"Document: {d.get('title', '')} [{d.get('status', '')}] ({d.get('classification', '')})")

    tasks = await db.tasks.find({"$or": [{"title": regex}, {"description": regex}]}, {"_id": 0, "title": 1, "status": 1}).to_list(5)
    for t in tasks:
        context_items.append(f"Task: {t.get('title', '')} [{t.get('status', '')}]")

    # Call Gemini for AI summary
    answer = ""
    suggestions = []
    try:
        from services.ai_service import llm_chat
        import json
        context_str = "\n".join(context_items[:15]) if context_items else "No matching records found in database."
        prompt = f"User query: \"{q}\"\n\nDatabase context:\n{context_str}\n\nRespond with JSON only: {{\"answer\": \"...\", \"suggestions\": [\"...\", \"...\"]}}"
        response = await llm_chat(
            system_message="You are a helpful school management assistant for TCIS. Answer the user's search query based on the provided database context. Be concise (2-3 sentences max). If no relevant results found, suggest what they might be looking for. Also provide 2-3 follow-up search suggestions. Return ONLY valid JSON.",
            user_message=prompt,
            provider="gemini",
        )
        try:
            text = response.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            parsed = json.loads(text)
            answer = parsed.get("answer", "")
            suggestions = parsed.get("suggestions", [])
        except Exception:
            answer = response.strip()[:200]
    except Exception as e:
        logger.warning(f"AI search fallback: {e}")
        answer = f"Found {len(context_items)} results matching '{q}'"

    # Return structured results too
    normal_results = await global_search(q, user)

    return {
        "answer": answer,
        "suggestions": suggestions[:3],
        "results": normal_results.get("results", [])[:20],
        "total": normal_results.get("total", 0),
    }
