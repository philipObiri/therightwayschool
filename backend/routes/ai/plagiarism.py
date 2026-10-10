"""
AI-Powered Plagiarism Check
Compares assignment submissions against each other using GPT-4.1.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from database import db
from models import gen_id
from auth import get_current_user
from datetime import datetime, timezone
import os
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plagiarism", tags=["plagiarism"])


async def run_plagiarism_check(text1: str, text2: str, student1_name: str, student2_name: str) -> dict:
    """Use GPT-4.1 to compare two texts for plagiarism."""
    from services.ai_service import llm_chat

    system = """You are an academic plagiarism detection expert. Compare two student submissions and analyze them for plagiarism.
Return a JSON object with these exact fields:
{
  "similarity_score": <number 0-100>,
  "verdict": "<clean|low_similarity|moderate_similarity|high_similarity|plagiarized>",
  "summary": "<brief 1-2 sentence summary>",
  "matching_passages": [{"text1_excerpt": "...", "text2_excerpt": "...", "similarity": "high/medium/low"}],
  "recommendation": "<brief recommendation for teacher>"
}
Only return valid JSON, nothing else."""

    prompt = f"""Compare these two student submissions for plagiarism:

--- SUBMISSION 1 ({student1_name}) ---
{text1[:3000]}

--- SUBMISSION 2 ({student2_name}) ---
{text2[:3000]}

Analyze for:
1. Direct text copying (word-for-word matches)
2. Paraphrased content (same ideas reworded)
3. Structural similarity (same organization/flow)
4. Shared unique phrases or errors

Return ONLY valid JSON."""

    response = await llm_chat(system, prompt, provider="openai")

    try:
        # Try to parse JSON from response
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        result = json.loads(cleaned)
        return result
    except json.JSONDecodeError:
        return {
            "similarity_score": 0,
            "verdict": "error",
            "summary": "Could not parse AI response",
            "matching_passages": [],
            "recommendation": "Manual review recommended"
        }


@router.post("/check")
async def check_plagiarism(data: dict = Body(...), user=Depends(get_current_user)):
    """Run plagiarism check on two specific submissions."""
    submission_id_1 = data.get("submission_id_1", "")
    submission_id_2 = data.get("submission_id_2", "")

    if not submission_id_1 or not submission_id_2:
        raise HTTPException(400, "Two submission IDs required")

    sub1 = await db.assignment_submissions.find_one({"submission_id": submission_id_1}, {"_id": 0})
    sub2 = await db.assignment_submissions.find_one({"submission_id": submission_id_2}, {"_id": 0})

    if not sub1 or not sub2:
        raise HTTPException(404, "One or both submissions not found")

    text1 = sub1.get("content", "") or sub1.get("answer_text", "") or ""
    text2 = sub2.get("content", "") or sub2.get("answer_text", "") or ""

    if len(text1) < 20 or len(text2) < 20:
        raise HTTPException(400, "Submissions too short for meaningful comparison")

    s1_name = sub1.get("student_name", "Student 1")
    s2_name = sub2.get("student_name", "Student 2")

    result = await run_plagiarism_check(text1, text2, s1_name, s2_name)

    now = datetime.now(timezone.utc).isoformat()
    check_record = {
        "check_id": gen_id("plag_"),
        "submission_id_1": submission_id_1,
        "submission_id_2": submission_id_2,
        "student_1_name": s1_name,
        "student_2_name": s2_name,
        "assignment_id": sub1.get("assignment_id", ""),
        "similarity_score": result.get("similarity_score", 0),
        "verdict": result.get("verdict", "unknown"),
        "summary": result.get("summary", ""),
        "matching_passages": result.get("matching_passages", []),
        "recommendation": result.get("recommendation", ""),
        "checked_by": user["user_id"],
        "checked_by_name": user.get("name", ""),
        "created_at": now,
    }

    await db.plagiarism_checks.insert_one({**check_record, "_id": None})

    return check_record


@router.post("/check-batch")
async def check_plagiarism_batch(data: dict = Body(...), user=Depends(get_current_user)):
    """Run plagiarism check across all submissions for an assignment."""
    assignment_id = data.get("assignment_id", "")
    if not assignment_id:
        raise HTTPException(400, "assignment_id required")

    submissions = await db.assignment_submissions.find(
        {"assignment_id": assignment_id, "$or": [
            {"content": {"$exists": True, "$ne": ""}},
            {"answer_text": {"$exists": True, "$ne": ""}}
        ]},
        {"_id": 0}
    ).to_list(100)

    if len(submissions) < 2:
        raise HTTPException(400, "Need at least 2 submissions to check")

    results = []
    now = datetime.now(timezone.utc).isoformat()

    # Compare each pair (limit to first 15 submissions to avoid timeout)
    subs_to_check = submissions[:15]
    for i in range(len(subs_to_check)):
        for j in range(i + 1, len(subs_to_check)):
            s1 = subs_to_check[i]
            s2 = subs_to_check[j]
            text1 = s1.get("content", "") or s1.get("answer_text", "")
            text2 = s2.get("content", "") or s2.get("answer_text", "")

            if len(text1) < 20 or len(text2) < 20:
                continue

            try:
                result = await run_plagiarism_check(
                    text1, text2,
                    s1.get("student_name", "Student"),
                    s2.get("student_name", "Student")
                )

                check_record = {
                    "check_id": gen_id("plag_"),
                    "submission_id_1": s1.get("submission_id", ""),
                    "submission_id_2": s2.get("submission_id", ""),
                    "student_1_name": s1.get("student_name", ""),
                    "student_2_name": s2.get("student_name", ""),
                    "assignment_id": assignment_id,
                    "similarity_score": result.get("similarity_score", 0),
                    "verdict": result.get("verdict", "unknown"),
                    "summary": result.get("summary", ""),
                    "matching_passages": result.get("matching_passages", []),
                    "recommendation": result.get("recommendation", ""),
                    "checked_by": user["user_id"],
                    "checked_by_name": user.get("name", ""),
                    "created_at": now,
                }
                await db.plagiarism_checks.insert_one({**check_record, "_id": None})
                results.append(check_record)
            except Exception as e:
                logger.error(f"Plagiarism check error: {e}")
                continue

    return {
        "assignment_id": assignment_id,
        "total_comparisons": len(results),
        "flagged": len([r for r in results if r["similarity_score"] >= 40]),
        "results": sorted(results, key=lambda x: x["similarity_score"], reverse=True),
    }


@router.get("/results/{assignment_id}")
async def get_plagiarism_results(assignment_id: str, user=Depends(get_current_user)):
    """Get existing plagiarism check results for an assignment."""
    results = await db.plagiarism_checks.find(
        {"assignment_id": assignment_id}, {"_id": 0}
    ).sort("similarity_score", -1).to_list(200)

    return {
        "assignment_id": assignment_id,
        "total_checks": len(results),
        "flagged": len([r for r in results if r["similarity_score"] >= 40]),
        "results": results,
    }


@router.get("/history")
async def get_plagiarism_history(user=Depends(get_current_user), limit: int = 50):
    """Get recent plagiarism check history."""
    results = await db.plagiarism_checks.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return results
