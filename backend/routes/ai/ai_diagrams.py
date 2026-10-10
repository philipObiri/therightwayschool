"""AI Diagram Generation — generates educational diagrams using GPT Image 1."""
import os, uuid, logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from dotenv import load_dotenv
load_dotenv()

from auth import get_current_user
from storage import put_object, get_object
from services.ai_service import generate_image

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai-diagrams", tags=["AI Diagrams"])

SUBJECT_PROMPTS = {
    "mathematics": "Create a clean, accurate mathematical diagram. Use precise labeling, gridlines where appropriate, and standard mathematical notation. White background, high contrast.",
    "economics": "Create a clean, labeled economics diagram with properly labeled axes, curves, and equilibrium points. Use standard economic notation. White background.",
    "chemistry": "Create a detailed, accurate chemistry diagram. Use standard chemical notation, proper molecular structures, and clear labels. White background.",
    "biology": "Create a detailed, scientifically accurate biology diagram with clear labels, annotations, and proper biological structures. White background.",
    "physics": "Create an accurate physics diagram with proper force vectors, measurements, labels, and standard physics notation. White background.",
    "geography": "Create a clear, labeled geography diagram with proper geographic features, legends, and annotations. White background.",
    "ict": "Create a clear technical diagram with proper flowchart symbols, network diagrams, or system architecture as appropriate. White background.",
    "general": "Create a clear, educational diagram with proper labels and annotations. White background, high contrast, suitable for a school textbook.",
}


def get_subject_context(subject: str) -> str:
    subject_lower = (subject or "").lower()
    for key, prompt in SUBJECT_PROMPTS.items():
        if key in subject_lower:
            return prompt
    return SUBJECT_PROMPTS["general"]


@router.post("/generate")
async def generate_diagram(data: dict, user: dict = Depends(get_current_user)):
    prompt = data.get("prompt", "").strip()
    subject = data.get("subject", "general")
    context = data.get("context", "")

    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
    subject_hint = get_subject_context(subject)
    full_prompt = f"{subject_hint}\n\nDiagram request: {prompt}"
    if context:
        full_prompt += f"\n\nAdditional context: {context}"

    try:
        image_bytes = await generate_image(full_prompt)
        file_id = f"diagram_{uuid.uuid4().hex[:10]}"
        path = f"diagrams/{file_id}.png"

        put_object(path, image_bytes, "image/png")

        return {
            "file_id": file_id,
            "prompt": prompt,
            "subject": subject,
        }

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Diagram generation failed: {error_msg}")
        if "budget" in error_msg.lower() or "exceeded" in error_msg.lower():
            raise HTTPException(status_code=402, detail="AI budget exceeded. Please go to Profile → Universal Key → Add Balance to top up your Emergent LLM Key.")
        raise HTTPException(status_code=500, detail=f"Generation failed: {error_msg}")


@router.get("/image/{file_id}")
async def serve_diagram(file_id: str):
    """Serve a generated diagram image (public endpoint for embedding in content)."""
    path = f"diagrams/{file_id}.png"
    try:
        data, content_type = get_object(path)
        return Response(content=data, media_type=content_type or "image/png")
    except Exception:
        raise HTTPException(status_code=404, detail="Diagram not found")
