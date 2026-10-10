"""
TCIS Lectures Module - Backend
Comprehensive Cambridge-aligned lecture generation, storage, and management.
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, UploadFile, File, Form
from fastapi.responses import Response
from database import db
from auth import get_current_user, require_roles
from datetime import datetime, timezone
import uuid, os, re, json, base64
import jwt as pyjwt

router = APIRouter(prefix="/api/lectures", tags=["lectures"])

JWT_SECRET = os.environ.get("JWT_SECRET", "default_secret")
MGMT_ROLES = ("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher", "Founder", "HeadOfAcademics")

CAMBRIDGE_STAGES = [
    "Primary", "Lower Secondary", "Upper Secondary", "IGCSE", "AS Level", "A Level"
]

OUTPUT_STYLES = [
    "standard_lecture", "brief_note", "detailed_lecture", "exam_focused",
    "revision_note", "student_handout", "teacher_guide", "interactive_class",
    "simplified_explanation", "advanced_analytical"
]

TONE_OPTIONS = ["formal", "student_friendly", "highly_academic"]
DEPTH_OPTIONS = ["basic", "moderate", "advanced"]
DURATION_OPTIONS = ["short", "standard", "extended"]


async def lecture_audit(user_id, user_name, action, lecture_id, details=""):
    await db.lecture_activity_logs.insert_one({
        "log_id": f"llog_{uuid.uuid4().hex[:12]}",
        "user_id": user_id, "user_name": user_name,
        "action": action, "lecture_id": lecture_id,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


def _clean_html(html: str) -> str:
    if not html:
        return ""
    html = re.sub(r'<!DOCTYPE[^>]*>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<html[^>]*>|</html>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<head>.*?</head>', '', html, flags=re.IGNORECASE | re.DOTALL)
    html = re.sub(r'<body[^>]*>|</body>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.IGNORECASE | re.DOTALL)
    return html.strip()


# ═══════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════

@router.get("/config")
async def get_config(user: dict = Depends(get_current_user)):
    """Return config options for the lecture creation wizard."""
    subjects = await db.subjects.find({}, {"_id": 0, "subject_id": 1, "name": 1}).to_list(100)
    year_groups = sorted(await db.timetable_v2.distinct("year_group"))
    if not year_groups:
        year_groups = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13"]
    return {
        "subjects": subjects,
        "year_groups": year_groups,
        "cambridge_stages": CAMBRIDGE_STAGES,
        "output_styles": OUTPUT_STYLES,
        "tone_options": TONE_OPTIONS,
        "depth_options": DEPTH_OPTIONS,
        "duration_options": DURATION_OPTIONS,
    }


@router.get("/my-lectures")
async def my_lectures(
    user: dict = Depends(get_current_user),
    subject: str = None, year_group: str = None, status: str = None,
    search: str = None,
):
    query = {"teacher_id": user["user_id"]}
    if subject:
        query["subject"] = subject
    if year_group:
        query["year_group"] = year_group
    if status and status != "all":
        query["status"] = status
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"topic": {"$regex": search, "$options": "i"}},
            {"subtopic": {"$regex": search, "$options": "i"}},
        ]
    lectures = await db.lectures.find(query, {"_id": 0, "rich_content": 0}).sort("updated_at", -1).to_list(200)
    return lectures


@router.get("/admin-all")
async def admin_all_lectures(
    user: dict = Depends(require_roles(*MGMT_ROLES)),
    teacher_id: str = None, subject: str = None, year_group: str = None,
    search: str = None, status: str = None,
):
    query = {}
    if teacher_id:
        query["teacher_id"] = teacher_id
    if subject:
        query["subject"] = subject
    if year_group:
        query["year_group"] = year_group
    if status and status != "all":
        query["status"] = status
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"topic": {"$regex": search, "$options": "i"}},
            {"teacher_name": {"$regex": search, "$options": "i"}},
        ]
    lectures = await db.lectures.find(query, {"_id": 0, "rich_content": 0}).sort("updated_at", -1).to_list(500)
    return lectures


@router.get("/admin-stats")
async def admin_stats(user: dict = Depends(require_roles(*MGMT_ROLES))):
    total = await db.lectures.count_documents({})
    published = await db.lectures.count_documents({"status": "published"})
    drafts = await db.lectures.count_documents({"status": "draft"})
    ai_gen = await db.lectures.count_documents({"ai_generated": True})
    uploaded = await db.lectures.count_documents({"source_type": "upload"})

    by_subject = await db.lectures.aggregate([
        {"$group": {"_id": "$subject", "count": {"$sum": 1}}}
    ]).to_list(50)

    by_teacher = await db.lectures.aggregate([
        {"$group": {"_id": {"tid": "$teacher_id", "name": "$teacher_name"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 10}
    ]).to_list(10)

    recent_logs = await db.lecture_activity_logs.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).to_list(20)

    return {
        "total": total, "published": published, "drafts": drafts,
        "ai_generated": ai_gen, "uploaded": uploaded,
        "by_subject": {r["_id"]: r["count"] for r in by_subject if r["_id"]},
        "by_teacher": [{"name": r["_id"]["name"], "teacher_id": r["_id"]["tid"], "count": r["count"]} for r in by_teacher],
        "recent_logs": recent_logs,
    }


@router.get("/activity-logs")
async def get_activity_logs(
    user: dict = Depends(require_roles(*MGMT_ROLES)),
    teacher_id: str = None, limit: int = 50,
):
    query = {}
    if teacher_id:
        query["user_id"] = teacher_id
    logs = await db.lecture_activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs


@router.post("/")
async def create_lecture(data: dict, user: dict = Depends(get_current_user)):
    lecture_id = f"lec_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    lecture = {
        "lecture_id": lecture_id,
        "teacher_id": user["user_id"],
        "teacher_name": user.get("name", ""),
        "title": data.get("title", "Untitled Lecture"),
        "subject": data.get("subject", ""),
        "year_group": data.get("year_group", ""),
        "cambridge_stage": data.get("cambridge_stage", ""),
        "topic": data.get("topic", ""),
        "subtopic": data.get("subtopic", ""),
        "learning_objectives": data.get("learning_objectives", ""),
        "difficulty_level": data.get("difficulty_level", "moderate"),
        "duration": data.get("duration", "standard"),
        "output_style": data.get("output_style", "standard_lecture"),
        "tone": data.get("tone", "formal"),
        "depth": data.get("depth", "moderate"),
        "rich_content": data.get("rich_content", ""),
        "status": "draft",
        "version": 1,
        "ai_generated": False,
        "source_type": "manual",
        "source_file_id": None,
        "term": data.get("term", ""),
        "week": data.get("week", ""),
        "tags": data.get("tags", []),
        "created_at": now,
        "updated_at": now,
    }
    await db.lectures.insert_one(lecture)
    lecture.pop("_id", None)
    await lecture_audit(user["user_id"], user.get("name", ""), "created", lecture_id, f"Created: {lecture['title']}")
    return lecture


@router.get("/{lecture_id}")
async def get_lecture(lecture_id: str, user: dict = Depends(get_current_user)):
    lecture = await db.lectures.find_one({"lecture_id": lecture_id}, {"_id": 0})
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return lecture


@router.put("/{lecture_id}")
async def update_lecture(lecture_id: str, data: dict, user: dict = Depends(get_current_user)):
    lecture = await db.lectures.find_one({"lecture_id": lecture_id})
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    updates = {}
    for field in ["title", "subject", "year_group", "cambridge_stage", "topic", "subtopic",
                  "learning_objectives", "difficulty_level", "duration", "output_style",
                  "tone", "depth", "rich_content", "status", "term", "week", "tags"]:
        if field in data:
            updates[field] = data[field]
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["version"] = lecture.get("version", 1) + 1

    await db.lectures.update_one({"lecture_id": lecture_id}, {"$set": updates})
    await lecture_audit(user["user_id"], user.get("name", ""), "edited", lecture_id, f"Updated fields: {list(updates.keys())}")
    return {"message": "Lecture updated", "version": updates["version"]}


@router.post("/{lecture_id}/duplicate")
async def duplicate_lecture(lecture_id: str, user: dict = Depends(get_current_user)):
    src = await db.lectures.find_one({"lecture_id": lecture_id}, {"_id": 0})
    if not src:
        raise HTTPException(status_code=404, detail="Lecture not found")
    new_id = f"lec_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    src["lecture_id"] = new_id
    src["title"] = f"{src['title']} (Copy)"
    src["status"] = "draft"
    src["version"] = 1
    src["teacher_id"] = user["user_id"]
    src["teacher_name"] = user.get("name", "")
    src["created_at"] = now
    src["updated_at"] = now
    await db.lectures.insert_one(src)
    src.pop("_id", None)
    await lecture_audit(user["user_id"], user.get("name", ""), "duplicated", new_id, f"From {lecture_id}")
    return src


@router.delete("/{lecture_id}")
async def delete_lecture(lecture_id: str, user: dict = Depends(get_current_user)):
    r = await db.lectures.delete_one({"lecture_id": lecture_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lecture not found")
    await lecture_audit(user["user_id"], user.get("name", ""), "deleted", lecture_id)
    return {"message": "Lecture deleted"}


# ═══════════════════════════════════════════
# AI GENERATION
# ═══════════════════════════════════════════

def _build_lecture_system_prompt(data: dict) -> str:
    subject = data.get("subject", "General")
    year_group = data.get("year_group", "")
    stage = data.get("cambridge_stage", "IGCSE")
    topic = data.get("topic", "")
    subtopic = data.get("subtopic", "")
    objectives = data.get("learning_objectives", "")
    difficulty = data.get("difficulty_level", "moderate")
    duration = data.get("duration", "standard")
    output_style = data.get("output_style", "standard_lecture")
    tone = data.get("tone", "formal")
    depth = data.get("depth", "moderate")
    additional = data.get("additional_instructions", "")

    duration_map = {"short": "25-30 min", "standard": "45-60 min", "extended": "75-90 min"}
    dur_text = duration_map.get(duration, "45-60 min")

    return f"""You are a Cambridge curriculum specialist at TCIS school. Generate a {stage} lecture note.

Subject: {subject} | Year: {year_group} | Stage: {stage} | Topic: {topic}{f" | Subtopic: {subtopic}" if subtopic else ""}
Difficulty: {difficulty} | Duration: {dur_text} | Tone: {tone} | Depth: {depth} | Style: {output_style}
{f"Objectives: {objectives}" if objectives else ""}{f"Additional: {additional}" if additional else ""}

Return a JSON object with EXACTLY these keys:
{{
  "title": "Professional lecture title",
  "learning_objectives": "HTML: 3-5 measurable objectives",
  "keywords_definitions": "HTML: 8-12 key terms with definitions using <ul><li>",
  "introduction": "HTML: Topic introduction with real-world relevance",
  "main_content": "HTML: CORE lecture content. This must be the longest section. Include progressive explanations, worked examples, sub-headings (<h3>,<h4>), defined terms in context. For maths/science: show every step. For humanities: develop arguments with evidence.",
  "practice_and_activities": "HTML: 3-5 practice questions, a classroom activity, and homework task",
  "summary": "HTML: Bullet-point recap of all key learning points"
}}

Rules: Use <h3>,<h4>,<p>,<ul>,<ol>,<li>,<table>,<strong>,<em> tags. No <html>/<head>/<body>/<style> tags. Return ONLY valid JSON, no markdown fences."""


@router.post("/ai-generate")
async def ai_generate_lecture(data: dict, user: dict = Depends(get_current_user)):
    """Generate a complete Cambridge-aligned lecture using AI."""
    topic = data.get("topic", "")
    if not topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required")

    system_prompt = _build_lecture_system_prompt(data)

    try:
        from services.ai_service import llm_chat

        subject = data.get("subject", "General")
        year_group = data.get("year_group", "")
        subtopic = data.get("subtopic", "")
        prompt = f"Generate a complete {data.get('output_style', 'standard')} lecture note for {subject} ({year_group}) on the topic '{topic}'"
        if subtopic:
            prompt += f", specifically covering the subtopic '{subtopic}'"
        prompt += ". Produce deep, academically sound, classroom-ready content."

        response = await llm_chat(system_prompt, prompt, provider="openai")
        text = response.strip()
        text = re.sub(r'^```(?:json)?\s*\n?', '', text)
        text = re.sub(r'\n?```\s*$', '', text)
        parsed = json.loads(text)

        # Build combined rich_content HTML
        sections = [
            ("Learning Objectives", parsed.get("learning_objectives", "")),
            ("Keywords & Definitions", parsed.get("keywords_definitions", "")),
            ("Introduction", parsed.get("introduction", "")),
            ("Lecture Content", parsed.get("main_content", "")),
            ("Practice & Activities", parsed.get("practice_and_activities", "")),
            ("Summary", parsed.get("summary", "")),
        ]

        rich_content = ""
        for heading, content in sections:
            if content:
                rich_content += f"<h2>{heading}</h2>\n{_clean_html(content)}\n\n"

        # Now create and save the lecture
        lecture_id = f"lec_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        lecture = {
            "lecture_id": lecture_id,
            "teacher_id": user["user_id"],
            "teacher_name": user.get("name", ""),
            "title": parsed.get("title", f"{topic} - {subject}"),
            "subject": data.get("subject", ""),
            "year_group": data.get("year_group", ""),
            "cambridge_stage": data.get("cambridge_stage", ""),
            "topic": topic,
            "subtopic": subtopic,
            "learning_objectives": parsed.get("learning_objectives", ""),
            "difficulty_level": data.get("difficulty_level", "moderate"),
            "duration": data.get("duration", "standard"),
            "output_style": data.get("output_style", "standard_lecture"),
            "tone": data.get("tone", "formal"),
            "depth": data.get("depth", "moderate"),
            "rich_content": rich_content,
            "sections": {k: v for k, v in parsed.items() if v and k != "title"},
            "status": "draft",
            "version": 1,
            "ai_generated": True,
            "source_type": "ai",
            "term": data.get("term", ""),
            "week": data.get("week", ""),
            "tags": [],
            "created_at": now,
            "updated_at": now,
        }
        await db.lectures.insert_one(lecture)
        lecture.pop("_id", None)
        await lecture_audit(user["user_id"], user.get("name", ""), "ai_generated", lecture_id, f"AI generated: {lecture['title']}")
        return lecture

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid format. Please try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/{lecture_id}/ai-refine")
async def ai_refine_section(lecture_id: str, data: dict, user: dict = Depends(get_current_user)):
    """AI-powered refinement: expand, simplify, add examples, regenerate section, etc."""
    lecture = await db.lectures.find_one({"lecture_id": lecture_id}, {"_id": 0})
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    command = data.get("command", "")
    section_content = data.get("section_content", "")
    if not command.strip():
        raise HTTPException(status_code=400, detail="Command is required")

    try:
        from services.ai_service import llm_chat
        system = f"""You are a Cambridge curriculum specialist editing lecture material for {lecture.get('subject', 'a subject')} ({lecture.get('year_group', '')}, {lecture.get('cambridge_stage', '')}).

TASK: {command}

CONTEXT:
- Topic: {lecture.get('topic', '')}
- Subtopic: {lecture.get('subtopic', '')}
- Difficulty: {lecture.get('difficulty_level', 'moderate')}
- Tone: {lecture.get('tone', 'formal')}

RULES:
1. Return ONLY the improved HTML content (no JSON wrapper, no markdown fences)
2. Maintain academic rigour and Cambridge alignment
3. Use proper HTML: <h3>, <h4>, <p>, <ul>, <li>, <ol>, <table>, <strong>, <em>
4. Do NOT include <html>, <head>, <body>, <style> tags
5. Be thorough — never produce shallow content"""

        prompt = f"Here is the current content:\n\n{section_content}\n\nCommand: {command}"
        response = await llm_chat(system, prompt, provider="openai")
        result = response.strip()
        result = re.sub(r'^```(?:html)?\s*\n?', '', result)
        result = re.sub(r'\n?```\s*$', '', result)

        await lecture_audit(user["user_id"], user.get("name", ""), "ai_refined", lecture_id, f"Command: {command[:100]}")
        return {"refined_content": _clean_html(result)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI refinement failed: {str(e)}")


@router.post("/{lecture_id}/ai-generate-component")
async def ai_generate_component(lecture_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Generate a specific component: glossary, homework, quiz, starter, plenary, worksheet, etc."""
    lecture = await db.lectures.find_one({"lecture_id": lecture_id}, {"_id": 0})
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    component = data.get("component", "")
    component_prompts = {
        "glossary": "Generate a comprehensive keyword glossary with precise definitions for all key terms in this lecture.",
        "homework": "Generate a structured homework assignment with clear instructions, 5-8 questions of varying difficulty, and marking guidance.",
        "quiz": "Generate a 10-question quiz covering the lecture content: 5 multiple choice, 3 short answer, 2 extended response.",
        "starter": "Generate a 5-minute starter activity that activates prior knowledge and engages students immediately.",
        "plenary": "Generate a plenary/recap activity that consolidates learning and assesses understanding.",
        "worksheet": "Generate a student worksheet with structured activities, fill-in sections, and practice problems.",
        "differentiation": "Generate differentiation notes: scaffolding for weaker students and extension challenges for stronger students.",
        "exam_questions": "Generate 5 Cambridge-style exam questions with mark schemes and examiner tips.",
        "discussion_points": "Generate 8-10 classroom discussion questions that promote higher-order thinking.",
        "teaching_tips": "Generate practical teaching tips, common misconceptions to address, and suggested classroom strategies.",
    }

    prompt_text = component_prompts.get(component, data.get("custom_prompt", f"Generate {component} content."))

    try:
        from services.ai_service import llm_chat
        system = f"""You are a Cambridge curriculum expert creating supplementary teaching materials.

Subject: {lecture.get('subject', '')} | Year: {lecture.get('year_group', '')} | Stage: {lecture.get('cambridge_stage', '')}
Topic: {lecture.get('topic', '')} | Subtopic: {lecture.get('subtopic', '')}

Lecture summary: {lecture.get('rich_content', '')[:2000]}

Return well-formatted HTML content only. No JSON, no markdown fences. Use <h3>, <h4>, <p>, <ul>, <ol>, <li>, <table>, <strong>."""

        response = await llm_chat(system, prompt_text, provider="openai")
        result = response.strip()
        result = re.sub(r'^```(?:html)?\s*\n?', '', result)
        result = re.sub(r'\n?```\s*$', '', result)

        await lecture_audit(user["user_id"], user.get("name", ""), "component_generated", lecture_id, f"Component: {component}")
        return {"component": component, "content": _clean_html(result)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Component generation failed: {str(e)}")


# ═══════════════════════════════════════════
# UPLOAD-BASED GENERATION
# ═══════════════════════════════════════════

@router.post("/upload-and-generate")
async def upload_and_generate(
    file: UploadFile = File(...),
    subject: str = Form(""),
    year_group: str = Form(""),
    cambridge_stage: str = Form("IGCSE"),
    topic: str = Form(""),
    output_style: str = Form("standard_lecture"),
    tone: str = Form("formal"),
    depth: str = Form("moderate"),
    user: dict = Depends(get_current_user),
):
    """Upload a document and AI generates a structured lecture from it."""
    content_bytes = await file.read()
    text_content = ""

    if file.content_type in ("text/plain",):
        text_content = content_bytes.decode("utf-8", errors="ignore")
    else:
        import base64
        text_content = base64.b64encode(content_bytes).decode()
        text_content = f"[Base64 encoded {file.filename}. Extract and structure the academic content.]"

    # For text-extractable files, try direct decoding
    if file.filename.endswith((".txt", ".md", ".csv")):
        text_content = content_bytes.decode("utf-8", errors="ignore")

    # Store file
    file_id = f"lecfile_{uuid.uuid4().hex[:12]}"
    await db.lecture_files.insert_one({
        "file_id": file_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(content_bytes),
        "uploaded_by": user["user_id"],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    })

    # AI generate from the content
    try:
        from services.ai_service import llm_chat
        system = f"""You are a Cambridge curriculum specialist. A teacher has uploaded teaching material.
Extract the academic content, restructure it into a proper Cambridge-aligned lecture note.

Parameters: Subject: {subject}, Year: {year_group}, Stage: {cambridge_stage}, Style: {output_style}, Tone: {tone}, Depth: {depth}
{f"Topic focus: {topic}" if topic else "Identify the main topic from the content."}

OUTPUT: Return a JSON object with these fields:
{{"title": "...", "topic": "...", "subtopic": "...", "learning_objectives": "...", "rich_content": "<complete structured HTML lecture note with all sections: Introduction, Step-by-Step Explanation, Examples, Activities, Practice, Summary>"}}

Make the content THOROUGH, STRUCTURED, and CLASSROOM-READY. Use proper HTML formatting."""

        response = await llm_chat(system, f"Here is the uploaded content from '{file.filename}':\n\n{text_content[:8000]}", provider="openai")
        text = response.strip()
        text = re.sub(r'^```(?:json)?\s*\n?', '', text)
        text = re.sub(r'\n?```\s*$', '', text)
        parsed = json.loads(text)

        lecture_id = f"lec_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        lecture = {
            "lecture_id": lecture_id,
            "teacher_id": user["user_id"],
            "teacher_name": user.get("name", ""),
            "title": parsed.get("title", f"Lecture from {file.filename}"),
            "subject": subject,
            "year_group": year_group,
            "cambridge_stage": cambridge_stage,
            "topic": parsed.get("topic", topic),
            "subtopic": parsed.get("subtopic", ""),
            "learning_objectives": parsed.get("learning_objectives", ""),
            "difficulty_level": depth,
            "duration": "standard",
            "output_style": output_style,
            "tone": tone,
            "depth": depth,
            "rich_content": _clean_html(parsed.get("rich_content", "")),
            "status": "draft",
            "version": 1,
            "ai_generated": True,
            "source_type": "upload",
            "source_file_id": file_id,
            "source_filename": file.filename,
            "term": "", "week": "", "tags": [],
            "created_at": now, "updated_at": now,
        }
        await db.lectures.insert_one(lecture)
        lecture.pop("_id", None)
        await lecture_audit(user["user_id"], user.get("name", ""), "upload_generated", lecture_id, f"From file: {file.filename}")
        return lecture

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid format from upload. Please try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload generation failed: {str(e)}")


# ═══════════════════════════════════════════
# PDF EXPORT
# ═══════════════════════════════════════════

@router.get("/{lecture_id}/export-pdf")
async def export_lecture_pdf(
    lecture_id: str, request: Request,
    token: str = Query(None),
    download: int = Query(0),
    variant: str = Query("teacher"),
):
    """Export lecture as PDF. Variants: teacher (full), student (handout), revision (summary)."""
    raw_token = token
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ", 1)[1]
    if not raw_token:
        raise HTTPException(status_code=401, detail="Token required")
    try:
        payload = pyjwt.decode(raw_token, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    lecture = await db.lectures.find_one({"lecture_id": lecture_id}, {"_id": 0})
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    content = lecture.get("rich_content", "<p>No content</p>")

    # For student handout, strip teaching notes
    if variant == "student":
        content = re.sub(r'<h2>Teaching Notes</h2>.*?(?=<h2>|$)', '', content, flags=re.DOTALL)
        content = re.sub(r'<h2>Assessment Points</h2>.*?(?=<h2>|$)', '', content, flags=re.DOTALL)
        variant_label = "Student Handout"
    elif variant == "revision":
        # Keep only summary, keywords, and practice
        sections_to_keep = ["Keywords", "Recap", "Summary", "Practice"]
        filtered = ""
        for section in re.split(r'(<h2>)', content):
            if any(k in section for k in sections_to_keep):
                filtered += section
        content = filtered if filtered else content
        variant_label = "Revision Sheet"
    else:
        variant_label = "Teacher Version"

    now = datetime.now(timezone.utc).strftime("%d %B %Y")

    logo_path = os.path.join(os.path.dirname(__file__), "..", "main_logo.png")
    logo_b64 = ""
    if os.path.exists(logo_path):
        with open(logo_path, "rb") as f:
            logo_b64 = base64.b64encode(f.read()).decode()

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
    @page {{ size: A4; margin: 2cm; }}
    body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10pt; color: #1B2A4A; line-height: 1.6; }}
    .logo-banner {{ text-align: center; margin-bottom: 10px; }}
    .logo-banner img {{ width: 180px; height: auto; }}
    .header {{ border-bottom: 3px solid #1B2A4A; padding-bottom: 12px; margin-bottom: 20px; text-align: center; }}
    .header h1 {{ font-size: 18pt; color: #1B2A4A; margin: 8px 0 4px 0; }}
    .header .meta {{ font-size: 9pt; color: #666; }}
    .header .badge {{ display: inline-block; background: #C5A55A; color: white; font-size: 8pt; padding: 3px 12px; border-radius: 3px; font-weight: bold; margin-top: 6px; }}
    .meta-grid {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 10px 0 20px; background: #f5f7fb; padding: 12px; border-radius: 6px; }}
    .meta-item {{ font-size: 8pt; }}
    .meta-item .label {{ color: #888; text-transform: uppercase; font-size: 7pt; font-weight: bold; }}
    .meta-item .value {{ color: #1B2A4A; font-weight: 600; }}
    h2 {{ color: #1B2A4A; font-size: 14pt; border-bottom: 2px solid #2E6CC4; padding-bottom: 4px; margin-top: 24px; }}
    h3 {{ color: #2E6CC4; font-size: 11pt; margin-top: 16px; }}
    h4 {{ color: #4A5568; font-size: 10pt; margin-top: 12px; }}
    table {{ width: 100%; border-collapse: collapse; margin: 12px 0; }}
    th {{ background: #1B2A4A; color: white; padding: 6px 10px; text-align: left; font-size: 8pt; }}
    td {{ padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 9pt; }}
    tr:nth-child(even) td {{ background: #f9fafb; }}
    ul, ol {{ padding-left: 20px; }}
    li {{ margin-bottom: 4px; }}
    strong {{ color: #1B2A4A; }}
    .footer {{ text-align: center; font-size: 7pt; color: #aaa; margin-top: 30px; border-top: 1px solid #eee; padding-top: 8px; }}
</style></head><body>
    <div class="logo-banner">
        {"<img src='data:image/png;base64," + logo_b64 + "' />" if logo_b64 else ""}
    </div>
    <div class="header">
        <h1>{lecture.get('title', 'Lecture Note')}</h1>
        <div class="meta">RightWay Workstation | {variant_label}</div>
        <span class="badge">{lecture.get('cambridge_stage', 'Cambridge')}</span>
    </div>
    <div class="meta-grid">
        <div class="meta-item"><div class="label">Subject</div><div class="value">{lecture.get('subject', '')}</div></div>
        <div class="meta-item"><div class="label">Year Group</div><div class="value">{lecture.get('year_group', '')}</div></div>
        <div class="meta-item"><div class="label">Topic</div><div class="value">{lecture.get('topic', '')}</div></div>
        <div class="meta-item"><div class="label">Subtopic</div><div class="value">{lecture.get('subtopic', '')}</div></div>
        <div class="meta-item"><div class="label">Teacher</div><div class="value">{lecture.get('teacher_name', '')}</div></div>
        <div class="meta-item"><div class="label">Date</div><div class="value">{now}</div></div>
    </div>
    {content}
    <div class="footer">RightWay Workstation | Confidential Academic Material | {now}</div>
</body></html>"""

    try:
        from weasyprint import HTML as WHTML
        pdf_bytes = WHTML(string=html).write_pdf()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    fname = f"TCIS_Lecture_{lecture.get('subject','').replace(' ','_')}_{lecture.get('topic','').replace(' ','_')[:30]}_{variant}.pdf"
    disposition = "attachment" if download else "inline"
    await lecture_audit(user["user_id"], user.get("name", ""), "pdf_exported", lecture_id, f"Variant: {variant}")
    return Response(content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{fname}"'})
