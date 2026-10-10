from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from database import db, get_active_term
from models import gen_id
from auth import get_current_user
from storage import put_object, get_object, APP_NAME
from ws_manager import send_notification
from services.ai_service import llm_chat_with_file
from fpdf import FPDF
from datetime import datetime, timezone
from routes.academic.gradebook import grade_letter, grade_remark
import os
import json
import uuid
import tempfile
import logging
import io

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/quiz", tags=["quiz"])

MCQ_SYSTEM_PROMPT = """You are an expert exam question creator for a Cambridge International school (IGCSE and A-Level). 
Generate exactly 40 multiple choice questions based on the content of the uploaded PDF document.

MATH & SCIENCE NOTATION: Preserve ALL mathematical and scientific notation exactly as written.
- Use Unicode symbols directly: ², ³, √, π, θ, α, β, Σ, ∫, ∞, ≤, ≥, ≠, ±, ÷, ×, °, Ω, μ, Δ, →, ⇌
- Write subscripts as: H₂O, CO₂, x₁, x₂ (using Unicode subscript characters)
- Write superscripts as: x², m³, 10⁸ (using Unicode superscript characters)  
- Chemical formulas: H₂SO₄, NaOH, Fe₂O₃, CH₃COOH
- Physics: F = ma, E = mc², v² = u² + 2as, PV = nRT
- Never simplify, translate, or replace these symbols with words.

IMPORTANT: Return ONLY valid JSON with no extra text. Use this exact format:
{
  "title": "Quiz title based on the document content",
  "questions": [
    {
      "number": 1,
      "question": "The question text",
      "options": {"A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D"},
      "correct": "A",
      "explanation": "Brief explanation why this is correct"
    }
  ]
}

Make questions progressively harder: questions 1-15 easy, 16-30 medium, 31-40 hard.
Cover all major topics from the document. Each question must have exactly 4 options (A, B, C, D)."""

STRUCTURED_SYSTEM_PROMPT = """You are an expert exam question creator for a Cambridge International school (IGCSE and A-Level).
Generate exactly 15 structured/essay questions based on the content of the uploaded PDF document.

Include a mix of:
- Short answer questions (2-4 marks)
- Explain/Describe questions (4-6 marks)  
- Discuss/Evaluate/Analyse essay questions (8-12 marks)
- Application/Case study questions (6-10 marks)

MATH & SCIENCE NOTATION: Preserve ALL mathematical and scientific notation exactly.
- Use Unicode: ², ³, √, π, θ, α, β, Σ, ∫, ∞, ≤, ≥, ≠, ±, ÷, ×, °, Ω, μ, Δ, →, ⇌
- Subscripts: H₂O, CO₂, x₁  |  Superscripts: x², m³, 10⁸
- Chemical: H₂SO₄, NaOH, Fe₂O₃  |  Physics: F = ma, E = mc², PV = nRT
- Never replace symbols with words.

IMPORTANT: Return ONLY valid JSON with no extra text. Use this exact format:
{
  "title": "Exam title based on the document content",
  "questions": [
    {
      "number": 1,
      "question": "The question text. Use sub-parts (a), (b), (c) where appropriate.",
      "marks": 4,
      "command_word": "Explain",
      "model_answer": "A detailed model answer showing what a full-marks response looks like.",
      "marking_guide": "Key points the examiner should look for, listed clearly."
    }
  ]
}

Total marks should be approximately 100. Cover all major topics from the document.
Use Cambridge command words: Define, State, Describe, Explain, Analyse, Evaluate, Discuss, Compare, Justify, To what extent."""

ESSAY_SYSTEM_PROMPT = """You are an expert exam question creator for a Cambridge International school (IGCSE and A-Level).
Generate exactly 5 extended essay questions based on the content of the uploaded PDF document.

Each essay should require 300-500 words to answer properly and test deep understanding, critical thinking and analysis.

Include a variety of:
- Argumentative essays ("To what extent...", "Discuss whether...")
- Analytical essays ("Analyse the significance of...", "Evaluate the impact of...")
- Comparative essays ("Compare and contrast...", "Distinguish between...")
- Discursive essays ("Discuss the advantages and disadvantages of...")
- Application essays ("Using examples from the text, explain how...")

MATH & SCIENCE NOTATION: Preserve ALL mathematical and scientific notation exactly.
- Use Unicode: ², ³, √, π, θ, α, β, Σ, ∫, ∞, ≤, ≥, ≠, ±, ÷, ×, °, Ω, μ, Δ, →, ⇌
- Subscripts: H₂O, CO₂  |  Superscripts: x², m³  |  Chemical: H₂SO₄, NaOH
- Never replace symbols with words.

IMPORTANT: Return ONLY valid JSON with no extra text. Use this exact format:
{
  "title": "Essay: [topic based on the document content]",
  "questions": [
    {
      "number": 1,
      "question": "The full essay question with clear instructions on what to cover.",
      "marks": 20,
      "command_word": "Evaluate",
      "essay_guidance": "Guidance on what a strong answer should include: key arguments, examples, structure expectations.",
      "model_answer": "A comprehensive model essay answer demonstrating A-grade quality response.",
      "marking_guide": "Band descriptors: 17-20 marks (Excellent), 13-16 (Good), 9-12 (Satisfactory), 5-8 (Weak), 0-4 (Poor). Key criteria to assess."
    }
  ]
}

Total marks should be 100 (5 essays x 20 marks each). Each question should be challenging and require extended writing."""


@router.post("/generate-from-pdf")
async def generate_quiz_from_pdf(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Upload a PDF and AI generates questions from it. Supports MCQ and structured types."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    data = await file.read()
    if len(data) < 100:
        raise HTTPException(status_code=400, detail="File too small")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(data)
    tmp.flush()
    tmp_path = tmp.name
    tmp.close()

    try:
        file_id = str(uuid.uuid4())
        storage_path = f"{APP_NAME}/quizzes/{user['user_id']}/{file_id}.pdf"
        put_object(storage_path, data, "application/pdf")

        await db.file_assets.insert_one({
            "file_id": file_id, "storage_path": storage_path,
            "original_filename": file.filename, "content_type": "application/pdf",
            "size_bytes": len(data), "owner_user_id": user["user_id"],
            "is_deleted": False, "created_at": datetime.now(timezone.utc).isoformat()
        })

        # Retry up to 2 times on transient failures
        response = None
        for attempt in range(3):
            try:
                response = await llm_chat_with_file(
                    system_message=MCQ_SYSTEM_PROMPT,
                    user_message="Generate exactly 40 multiple choice questions from this document. Return ONLY valid JSON.",
                    file_path=tmp_path,
                    mime_type="application/pdf",
                )
                break
            except Exception as retry_err:
                logger.warning(f"MCQ generation attempt {attempt + 1} failed: {retry_err}")
                if attempt == 2:
                    raise
                import asyncio
                await asyncio.sleep(2)

        # Parse the response
        response_text = response.strip()
        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1] if "\n" in response_text else response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        quiz_data = json.loads(response_text.strip())

        # Store quiz in DB
        quiz_id = gen_id("quiz_")
        quiz_doc = {
            "quiz_id": quiz_id,
            "title": quiz_data.get("title", f"Quiz from {file.filename}"),
            "quiz_type": "mcq",
            "source_file_id": file_id,
            "source_filename": file.filename,
            "questions": quiz_data.get("questions", []),
            "question_count": len(quiz_data.get("questions", [])),
            "created_by": user["user_id"],
            "created_by_name": user["name"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.quizzes.insert_one(quiz_doc)

        return {
            "quiz_id": quiz_id,
            "title": quiz_doc["title"],
            "quiz_type": "mcq",
            "question_count": quiz_doc["question_count"],
            "questions": quiz_doc["questions"],
            "source_filename": file.filename
        }

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response: {e}")
        raise HTTPException(status_code=500, detail="AI generated invalid quiz format. Please try again.")
    except Exception as e:
        logger.error(f"Quiz generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")
    finally:
        os.unlink(tmp_path)


@router.post("/generate-structured")
async def generate_structured_from_pdf(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Upload a PDF and AI generates structured/essay questions from it."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    data = await file.read()
    if len(data) < 100:
        raise HTTPException(status_code=400, detail="File too small")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(data)
    tmp.flush()
    tmp_path = tmp.name
    tmp.close()

    try:
        file_id = str(uuid.uuid4())
        storage_path = f"{APP_NAME}/quizzes/{user['user_id']}/{file_id}.pdf"
        put_object(storage_path, data, "application/pdf")

        await db.file_assets.insert_one({
            "file_id": file_id, "storage_path": storage_path,
            "original_filename": file.filename, "content_type": "application/pdf",
            "size_bytes": len(data), "owner_user_id": user["user_id"],
            "is_deleted": False, "created_at": datetime.now(timezone.utc).isoformat()
        })

        # Retry up to 2 times on transient failures
        response = None
        for attempt in range(3):
            try:
                response = await llm_chat_with_file(
                    system_message=STRUCTURED_SYSTEM_PROMPT,
                    user_message="Generate exactly 15 structured/essay questions from this document. Return ONLY valid JSON.",
                    file_path=tmp_path,
                    mime_type="application/pdf",
                )
                break
            except Exception as retry_err:
                logger.warning(f"Structured generation attempt {attempt + 1} failed: {retry_err}")
                if attempt == 2:
                    raise
                import asyncio
                await asyncio.sleep(2)

        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1] if "\n" in response_text else response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        quiz_data = json.loads(response_text.strip())

        quiz_id = gen_id("quiz_")
        total_marks = sum(q.get("marks", 0) for q in quiz_data.get("questions", []))
        quiz_doc = {
            "quiz_id": quiz_id,
            "title": quiz_data.get("title", f"Structured Exam from {file.filename}"),
            "quiz_type": "structured",
            "source_file_id": file_id,
            "source_filename": file.filename,
            "questions": quiz_data.get("questions", []),
            "question_count": len(quiz_data.get("questions", [])),
            "total_marks": total_marks,
            "created_by": user["user_id"],
            "created_by_name": user["name"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.quizzes.insert_one(quiz_doc)

        return {
            "quiz_id": quiz_id,
            "title": quiz_doc["title"],
            "quiz_type": "structured",
            "question_count": quiz_doc["question_count"],
            "total_marks": total_marks,
            "questions": quiz_doc["questions"],
            "source_filename": file.filename
        }
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response: {e}")
        raise HTTPException(status_code=500, detail="AI generated invalid format. Please try again.")
    except Exception as e:
        logger.error(f"Structured question generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
    finally:
        os.unlink(tmp_path)


@router.post("/generate-essay")
async def generate_essay_from_pdf(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Upload a PDF and AI generates essay questions from it."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    data = await file.read()
    if len(data) < 100:
        raise HTTPException(status_code=400, detail="File too small")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(data)
    tmp.flush()
    tmp_path = tmp.name
    tmp.close()

    try:
        file_id = str(uuid.uuid4())
        storage_path = f"{APP_NAME}/quizzes/{user['user_id']}/{file_id}.pdf"
        put_object(storage_path, data, "application/pdf")

        await db.file_assets.insert_one({
            "file_id": file_id, "storage_path": storage_path,
            "original_filename": file.filename, "content_type": "application/pdf",
            "size_bytes": len(data), "owner_user_id": user["user_id"],
            "is_deleted": False, "created_at": datetime.now(timezone.utc).isoformat()
        })

        response = None
        for attempt in range(3):
            try:
                response = await llm_chat_with_file(
                    system_message=ESSAY_SYSTEM_PROMPT,
                    user_message="Generate exactly 5 extended essay questions from this document. Return ONLY valid JSON.",
                    file_path=tmp_path,
                    mime_type="application/pdf",
                )
                break
            except Exception as retry_err:
                logger.warning(f"Essay generation attempt {attempt + 1} failed: {retry_err}")
                if attempt == 2:
                    raise
                import asyncio
                await asyncio.sleep(2)

        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1] if "\n" in response_text else response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            if response_text.startswith("json"):
                response_text = response_text[4:]

        quiz_data = json.loads(response_text.strip())

        quiz_id = gen_id("quiz_")
        total_marks = sum(q.get("marks", 0) for q in quiz_data.get("questions", []))
        quiz_doc = {
            "quiz_id": quiz_id,
            "title": quiz_data.get("title", f"Essay Exam from {file.filename}"),
            "quiz_type": "essay",
            "source_file_id": file_id,
            "source_filename": file.filename,
            "questions": quiz_data.get("questions", []),
            "question_count": len(quiz_data.get("questions", [])),
            "total_marks": total_marks,
            "created_by": user["user_id"],
            "created_by_name": user["name"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.quizzes.insert_one(quiz_doc)

        return {
            "quiz_id": quiz_id,
            "title": quiz_doc["title"],
            "quiz_type": "essay",
            "question_count": quiz_doc["question_count"],
            "total_marks": total_marks,
            "questions": quiz_doc["questions"],
            "source_filename": file.filename
        }
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response: {e}")
        raise HTTPException(status_code=500, detail="AI generated invalid format. Please try again.")
    except Exception as e:
        logger.error(f"Essay question generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
    finally:
        os.unlink(tmp_path)


@router.get("/list")
async def list_quizzes(user: dict = Depends(get_current_user)):
    query = {}
    if user.get("role") == "Teacher":
        query["created_by"] = user["user_id"]
    # Auto-filter by active term
    active_term, _ = await get_active_term()
    query["term"] = active_term
    quizzes = await db.quizzes.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return quizzes


@router.get("/{quiz_id}")
async def get_quiz(quiz_id: str, user: dict = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@router.get("/{quiz_id}/pdf")
async def download_quiz_pdf(quiz_id: str, include_answers: bool = True, user: dict = Depends(get_current_user)):
    """Generate a PDF copy of the quiz (MCQ or structured)."""
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    quiz_type = quiz.get("quiz_type", "mcq")
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    # Register Unicode font for math symbols and scientific notation
    FONT_DIR = "/usr/share/fonts/truetype/dejavu/"
    pdf.add_font("DejaVu", "", FONT_DIR + "DejaVuSans.ttf", uni=True)
    pdf.add_font("DejaVu", "B", FONT_DIR + "DejaVuSans-Bold.ttf", uni=True)
    pdf.add_font("DejaVuMono", "", FONT_DIR + "DejaVuSansMono.ttf", uni=True)
    pdf.add_page()

    # Logo
    import os as _os
    logo_path = _os.path.join(_os.path.dirname(__file__), '..', 'main_logo.png')
    if _os.path.exists(logo_path):
        pdf.image(logo_path, x=75, y=8, w=50, h=50)
    pdf.set_y(60)

    # Header
    pdf.set_font("DejaVu", "B", 16)
    pdf.cell(0, 10, "The RightWay Centre of Learning", ln=True, align="C")
    pdf.set_font("DejaVu", "I", 9)
    pdf.set_text_color(197, 165, 90)
    pdf.cell(0, 5, "Where Every Child Thrives, Transforming Hearts", ln=True, align="C")
    pdf.set_text_color(100, 100, 100)
    pdf.set_font("DejaVu", "", 10)
    subtitle = "AI-Generated Essay Questions" if quiz_type == "essay" else "AI-Generated Structured Questions" if quiz_type == "structured" else "AI-Generated Multiple Choice Questions"
    pdf.cell(0, 6, subtitle, ln=True, align="C")
    pdf.ln(4)

    pdf.set_text_color(27, 42, 74)
    pdf.set_font("DejaVu", "B", 14)
    title_text = quiz.get("title", "Untitled Quiz")
    pdf.multi_cell(0, 8, title_text)
    pdf.set_font("DejaVu", "", 9)
    pdf.set_text_color(120, 120, 120)
    marks_info = f"  |  Total Marks: {quiz.get('total_marks', '')}" if quiz_type in ("structured", "essay") else ""
    pdf.cell(0, 5, f"{quiz.get('question_count', 0)} Questions{marks_info}  |  Source: {quiz.get('source_filename', 'N/A')}  |  Generated: {quiz.get('created_at', '')[:10]}", ln=True)
    pdf.ln(2)
    pdf.set_draw_color(46, 108, 196)
    pdf.set_line_width(0.5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)

    if not include_answers:
        pdf.set_font("DejaVu", "", 10)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 7, "Name: ___________________________________    Class: ______________    Date: ______________", ln=True)
        pdf.ln(4)

    questions = quiz.get("questions", [])

    if quiz_type in ("structured", "essay"):
        for q in questions:
            if pdf.get_y() > 230:
                pdf.add_page()
            pdf.set_font("DejaVu", "B", 10)
            pdf.set_text_color(46, 108, 196)
            q_num = str(q.get("number", ""))
            marks = q.get("marks", 0)
            pdf.cell(0, 6, f"Question {q_num}    [{marks} marks]", ln=True)
            pdf.set_text_color(27, 42, 74)
            pdf.set_font("DejaVu", "", 10)
            q_text = q.get("question", "")
            pdf.multi_cell(0, 6, q_text)

            if not include_answers:
                pdf.ln(2)
                lines = max(4, marks * 2)
                for _ in range(lines):
                    pdf.cell(0, 5, "___________________________________________________________________________", ln=True)
                pdf.ln(3)
            else:
                if q.get("essay_guidance"):
                    pdf.ln(1)
                    pdf.set_font("DejaVu", "B", 9)
                    pdf.set_text_color(80, 80, 80)
                    pdf.cell(0, 5, "Essay Guidance:", ln=True)
                    pdf.set_font("DejaVu", "", 9)
                    pdf.set_text_color(60, 60, 60)
                    eg = q["essay_guidance"]
                    pdf.multi_cell(0, 5, eg)
                if q.get("model_answer"):
                    pdf.ln(1)
                    pdf.set_font("DejaVu", "B", 9)
                    pdf.set_text_color(22, 163, 74)
                    pdf.cell(0, 5, "Model Answer:", ln=True)
                    pdf.set_font("DejaVu", "", 9)
                    pdf.set_text_color(40, 40, 40)
                    ans = q["model_answer"]
                    pdf.multi_cell(0, 5, ans)
                if q.get("marking_guide"):
                    pdf.ln(1)
                    pdf.set_font("DejaVu", "B", 9)
                    pdf.set_text_color(46, 108, 196)
                    pdf.cell(0, 5, "Marking Guide:", ln=True)
                    pdf.set_font("DejaVu", "", 8)
                    pdf.set_text_color(100, 100, 100)
                    guide = q["marking_guide"]
                    pdf.multi_cell(0, 4, guide)
                pdf.ln(4)
    else:
        # MCQ rendering
        for q in questions:
            if pdf.get_y() > 250:
                pdf.add_page()
            pdf.set_font("DejaVu", "B", 10)
            pdf.set_text_color(46, 108, 196)
            q_num = str(q.get("number", ""))
            pdf.cell(8, 6, f"{q_num}.")
            pdf.set_text_color(27, 42, 74)
            pdf.set_font("DejaVu", "", 10)
            q_text = q.get("question", "")
            pdf.multi_cell(0, 6, q_text)
            pdf.ln(1)
            options = q.get("options", {})
            correct = q.get("correct", "")
            for key in ["A", "B", "C", "D"]:
                opt_text = options.get(key, "")
                if include_answers and key == correct:
                    pdf.set_font("DejaVu", "B", 9)
                    pdf.set_text_color(22, 163, 74)
                    pdf.cell(12, 5, "")
                    pdf.cell(0, 5, f"  {key}.  {opt_text}  [CORRECT]", ln=True)
                else:
                    pdf.set_font("DejaVu", "", 9)
                    pdf.set_text_color(60, 60, 60)
                    pdf.cell(12, 5, "")
                    pdf.cell(0, 5, f"  {key}.  {opt_text}", ln=True)
            if include_answers and q.get("explanation"):
                pdf.set_font("DejaVu", "I", 8)
                pdf.set_text_color(140, 140, 140)
                pdf.cell(12, 5, "")
                exp_text = q["explanation"]
                pdf.multi_cell(0, 4, f"Explanation: {exp_text}")
            pdf.ln(3)

        if include_answers:
            pdf.add_page()
            pdf.set_font("DejaVu", "B", 14)
            pdf.set_text_color(27, 42, 74)
            pdf.cell(0, 10, "Answer Key", ln=True)
            pdf.set_draw_color(46, 108, 196)
            pdf.line(10, pdf.get_y(), 200, pdf.get_y())
            pdf.ln(4)
            pdf.set_font("DejaVu", "", 10)
            pdf.set_text_color(0, 0, 0)
            col = 0
            for q in questions:
                num = q.get("number", "")
                ans = q.get("correct", "")
                pdf.cell(30, 6, f"Q{num}: {ans}")
                col += 1
                if col >= 6:
                    pdf.ln()
                    col = 0
            if col > 0:
                pdf.ln()

    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)
    safe_title = "".join(c for c in quiz.get("title", "quiz")[:40] if c.isalnum() or c in " _-").strip().replace(" ", "_")
    suffix = "with_answers" if include_answers else "student_copy"
    filename = f"{safe_title}_{suffix}.pdf"
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.put("/{quiz_id}")
async def update_quiz(quiz_id: str, data: dict = None, user: dict = Depends(get_current_user)):
    """Edit quiz title and questions before publishing."""
    update = {}
    if data.get("title"): update["title"] = data["title"]
    if data.get("questions"): update["questions"] = data["questions"]; update["question_count"] = len(data["questions"])
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.quizzes.update_one({"quiz_id": quiz_id}, {"$set": update})
    return {"message": "Quiz updated"}


@router.delete("/{quiz_id}")
async def delete_quiz(quiz_id: str, user: dict = Depends(get_current_user)):
    """Delete a quiz entirely."""
    await db.quizzes.delete_one({"quiz_id": quiz_id})
    await db.quiz_submissions.delete_many({"quiz_id": quiz_id})
    return {"message": "Quiz deleted"}


@router.post("/{quiz_id}/hide")
async def hide_quiz(quiz_id: str, user: dict = Depends(get_current_user)):
    """Hide quiz from students without deleting."""
    await db.quizzes.update_one({"quiz_id": quiz_id}, {"$set": {"published": False, "class_ids": []}})
    return {"message": "Quiz hidden from students"}


@router.post("/{quiz_id}/publish")
async def publish_quiz(quiz_id: str, data: dict = None, user: dict = Depends(get_current_user)):
    """Publish quiz to specific classes so students can take it."""
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    class_ids = data.get("class_ids", [])
    score_type = data.get("score_type", "quiz")
    max_score = data.get("max_score", 100)

    await db.quizzes.update_one({"quiz_id": quiz_id}, {"$set": {
        "published": True, "class_ids": class_ids,
        "score_type": score_type, "max_score": max_score,
        "published_at": datetime.now(timezone.utc).isoformat()
    }})

    # Notify students
    for cid in class_ids:
        students = await db.users.find({"role": "Student", "class_id": cid}, {"_id": 0, "user_id": 1}).to_list(200)
        for s in students:
            await send_notification(db, s["user_id"], {
                "type": "new_quiz", "title": f"New Quiz: {quiz['title']}",
                "message": f"{user['name']} published a quiz. Take it now!",
                "reference_type": "quiz", "reference_id": quiz_id,
                "action_url": "/student/quizzes",
            })

    return {"message": f"Quiz published to {len(class_ids)} class(es)"}


@router.post("/{quiz_id}/publish-staff")
async def publish_quiz_to_staff(quiz_id: str, user: dict = Depends(get_current_user)):
    """Publish quiz as a CPD test for all staff."""
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    await db.quizzes.update_one({"quiz_id": quiz_id}, {"$set": {
        "published_to_staff": True,
        "staff_published_at": datetime.now(timezone.utc).isoformat()
    }})

    # Notify all staff
    staff = await db.users.find({"role": {"$in": ["Teacher", "HeadTeacher", "Principal", "Admin", "HR_Officer", "HeadOfAcademics"]}}, {"_id": 0, "user_id": 1}).to_list(100)
    for s in staff:
        await send_notification(db, s["user_id"], {
            "type": "cpd_test", "title": f"CPD Test: {quiz['title']}",
            "message": f"{user['name']} published a CPD test. Complete it to earn CPD credit.",
            "reference_type": "quiz", "reference_id": quiz_id,
            "action_url": "/admin/cpd",
        })

    return {"message": f"Quiz published as CPD test to {len(staff)} staff members"}


@router.get("/staff/cpd-tests")
async def staff_cpd_tests(user: dict = Depends(get_current_user)):
    """Get quizzes published as CPD tests for staff."""
    quizzes = await db.quizzes.find(
        {"published_to_staff": True}, {"_id": 0}
    ).sort("staff_published_at", -1).to_list(50)

    for q in quizzes:
        sub = await db.quiz_submissions.find_one(
            {"quiz_id": q["quiz_id"], "student_id": user["user_id"]}, {"_id": 0}
        )
        q["my_submission"] = sub

    return quizzes


@router.get("/student/available")
async def student_available_quizzes(user: dict = Depends(get_current_user)):
    """Get quizzes published to the student's class."""
    class_id = user.get("class_id", "")
    quizzes = await db.quizzes.find(
        {"published": True, "class_ids": class_id}, {"_id": 0}
    ).sort("published_at", -1).to_list(50)

    for q in quizzes:
        # Check if student already submitted
        sub = await db.quiz_submissions.find_one(
            {"quiz_id": q["quiz_id"], "student_id": user["user_id"]}, {"_id": 0}
        )
        q["my_submission"] = sub
        # Strip correct answers if not submitted
        if not sub:
            for question in q.get("questions", []):
                question.pop("correct", None)
                question.pop("explanation", None)
    return quizzes


@router.post("/{quiz_id}/submit")
async def submit_quiz(quiz_id: str, data: dict = None, user: dict = Depends(get_current_user)):
    """Student submits quiz answers - auto-marked on the spot."""
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Check if already submitted
    existing = await db.quiz_submissions.find_one({"quiz_id": quiz_id, "student_id": user["user_id"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Already submitted this quiz")

    answers = data.get("answers", {})  # {question_number: "A"/"B"/"C"/"D"}
    questions = quiz.get("questions", [])

    # Auto-mark
    correct_count = 0
    results = []
    for q in questions:
        student_answer = answers.get(str(q["number"]), "")
        is_correct = student_answer == q.get("correct", "")
        if is_correct:
            correct_count += 1
        results.append({
            "number": q["number"], "student_answer": student_answer,
            "correct_answer": q.get("correct", ""), "is_correct": is_correct
        })

    max_score = quiz.get("max_score", 100)
    score = round(correct_count / len(questions) * max_score, 1) if questions else 0
    percentage = round(correct_count / len(questions) * 100, 1) if questions else 0

    sub_doc = {
        "submission_id": gen_id("qsub_"), "quiz_id": quiz_id,
        "student_id": user["user_id"], "student_name": user["name"],
        "answers": answers, "results": results,
        "correct_count": correct_count, "total_questions": len(questions),
        "score": score, "max_score": max_score, "percentage": percentage,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    await db.quiz_submissions.insert_one(sub_doc)

    # Auto-record in gradebook under the quiz's score_type (e.g. classwork)
    score_type = quiz.get("score_type", "classwork")
    subject_id = ""
    if quiz.get("created_by"):
        teacher = await db.users.find_one({"user_id": quiz["created_by"]}, {"_id": 0, "teaching_subjects": 1})
        if teacher and teacher.get("teaching_subjects"):
            subj = await db.subjects.find_one({"name": teacher["teaching_subjects"][0]}, {"_id": 0, "subject_id": 1})
            if subj:
                subject_id = subj["subject_id"]

    if subject_id:
        # Get active term from settings
        term_setting = await db.app_settings.find_one({"key": "active_term"}, {"_id": 0})
        active_term = term_setting.get("value", "Term 1") if term_setting else "Term 1"
        # Calculate CA-equivalent score (score out of 30)
        ca_equiv = round(percentage / 100 * 30, 1)
        grade_entry = {
            "entry_id": gen_id("grd_"),
            "student_id": user["user_id"],
            "subject_id": subject_id,
            "term": active_term,
            "academic_year": "2025-2026",
            "score_type": score_type,
            "ca_score": ca_equiv,
            "ca_max": 30,
            "exam_score": 0,
            "exam_max": 70,
            "final_score": round(ca_equiv / 30 * 30, 1),
            "grade_letter": grade_letter(percentage),
            "remark": grade_remark(grade_letter(percentage)),
            "teacher_comment": f"AI Quiz: {quiz.get('title', '')} - {correct_count}/{len(questions)} correct",
            "recorded_by": quiz.get("created_by", "system"),
            "source": "ai_quiz",
            "quiz_id": quiz_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        # Upsert: don't overwrite if already exists for this quiz
        existing_grade = await db.gradebook_entries.find_one(
            {"student_id": user["user_id"], "quiz_id": quiz_id}, {"_id": 0}
        )
        if not existing_grade:
            await db.gradebook_entries.insert_one(grade_entry)

    return {
        "submission_id": sub_doc["submission_id"],
        "correct_count": correct_count, "total_questions": len(questions),
        "score": score, "max_score": max_score, "percentage": percentage,
        "results": results
    }


@router.get("/{quiz_id}/submissions")
async def quiz_submissions(quiz_id: str, user: dict = Depends(get_current_user)):
    """Get all student submissions for a quiz."""
    subs = await db.quiz_submissions.find({"quiz_id": quiz_id}, {"_id": 0}).sort("submitted_at", -1).to_list(500)
    return subs
