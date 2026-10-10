"""
AI Service — direct SDK calls for The RightWay Centre of Learning.

Providers:
  - openai  → AsyncOpenAI (gpt-4.1 default)
  - gemini  → google-genai (gemini-2.0-flash default)

Required env vars (set whichever providers you use):
  OPENAI_API_KEY   — for OpenAI text generation and image generation
  GEMINI_API_KEY   — for Gemini text generation and PDF/image processing
"""
import os
import base64
import logging

logger = logging.getLogger(__name__)

_OPENAI_KEY = lambda: os.environ.get("OPENAI_API_KEY", "")
_GEMINI_KEY = lambda: os.environ.get("GEMINI_API_KEY", "")


def _strip_markdown_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n", 1)
        text = lines[1] if len(lines) > 1 else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        if text.startswith("json"):
            text = text[4:]
    return text.strip()


async def llm_chat(
    system_message: str,
    user_message: str,
    provider: str = "openai",
    model: str = None,
) -> str:
    """Send a text-only prompt to the specified LLM provider. Returns the response string."""
    if provider == "gemini":
        return await _gemini_chat(system_message, user_message, model or "gemini-2.0-flash")
    return await _openai_chat(system_message, user_message, model or "gpt-4.1")


async def llm_chat_with_file(
    system_message: str,
    user_message: str,
    file_path: str,
    mime_type: str,
    provider: str = "gemini",
    model: str = "gemini-2.0-flash",
) -> str:
    """Send a prompt with an attached file (PDF or image) to Gemini. Returns the response string."""
    return await _gemini_chat_with_file(system_message, user_message, file_path, mime_type, model)


async def generate_image(prompt: str, model: str = "gpt-image-1") -> bytes:
    """Generate an image using OpenAI image generation. Returns raw image bytes."""
    return await _openai_generate_image(prompt, model)


# ── OpenAI ──────────────────────────────────────────────────────────────────

async def _openai_chat(system_message: str, user_message: str, model: str) -> str:
    from openai import AsyncOpenAI

    api_key = _OPENAI_KEY()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    client = AsyncOpenAI(api_key=api_key)
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
    )
    return response.choices[0].message.content or ""


async def _openai_generate_image(prompt: str, model: str) -> bytes:
    from openai import AsyncOpenAI

    api_key = _OPENAI_KEY()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    client = AsyncOpenAI(api_key=api_key)
    response = await client.images.generate(
        model=model,
        prompt=prompt,
        n=1,
        size="1024x1024",
        response_format="b64_json",
    )
    return base64.b64decode(response.data[0].b64_json)


# ── Gemini ───────────────────────────────────────────────────────────────────

async def _gemini_chat(system_message: str, user_message: str, model: str) -> str:
    from google import genai
    from google.genai import types

    api_key = _GEMINI_KEY()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    client = genai.Client(api_key=api_key)
    response = await client.aio.models.generate_content(
        model=model,
        contents=user_message,
        config=types.GenerateContentConfig(
            system_instruction=system_message,
        ),
    )
    return response.text or ""


async def _gemini_chat_with_file(
    system_message: str,
    user_message: str,
    file_path: str,
    mime_type: str,
    model: str,
) -> str:
    from google import genai
    from google.genai import types

    api_key = _GEMINI_KEY()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    client = genai.Client(api_key=api_key)
    response = await client.aio.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
            types.Part.from_text(text=user_message),
        ],
        config=types.GenerateContentConfig(
            system_instruction=system_message,
        ),
    )
    return response.text or ""
