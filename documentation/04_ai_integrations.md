# AI Integrations Guide

**Last Updated**: 2026-05-23  
**Models**: Claude Sonnet 4.6 · Gemini 2.0 Flash · GPT-4.1 · DALL-E 3

---

## Overview

The system uses three AI providers, each assigned to specific tasks based on capability and cost:

| Provider | Model | Best For | Est. Cost |
|----------|-------|----------|-----------|
| Anthropic | claude-sonnet-4-6 | Tutoring, reports, tool use, analytics | $3/1M in, $15/1M out |
| Google | gemini-2.0-flash | Quiz gen, schemes, file analysis | Free tier / very cheap |
| OpenAI | gpt-4.1 | Lectures, plagiarism, general text | $2/1M in |
| OpenAI | dall-e-3 | Educational diagram images | $0.04/image |

**Estimated monthly cost at 200-student scale**: $25–50/month

---

## Getting Your API Keys

### 1. Anthropic (Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create account → navigate to **API Keys**
3. Click **Create Key** → copy key (`sk-ant-...`)
4. Set in `.env`: `ANTHROPIC_API_KEY=sk-ant-...`

```python
# Installation
pip install anthropic

# Basic usage (FastAPI)
import anthropic
import os

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=2048,
    system="You are a helpful school tutor for RightWay Centre of Learning.",
    messages=[{"role": "user", "content": student_question}]
)
answer = response.content[0].text
```

### 2. Google Gemini

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with Google → click **Get API Key**
3. **Create API Key in new project**
4. Copy key (`AIza...`)
5. Set in `.env`: `GOOGLE_GENAI_API_KEY=AIza...`

```python
# Installation (already in requirements.txt)
pip install google-generativeai

# Basic usage
import google.generativeai as genai
import os

genai.configure(api_key=os.environ["GOOGLE_GENAI_API_KEY"])
model = genai.GenerativeModel("gemini-2.0-flash")
response = model.generate_content("Explain photosynthesis for a 10-year-old")
print(response.text)
```

### 3. OpenAI

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign in → navigate to **API Keys**
3. **Create new secret key** → copy (`sk-...`)
4. Set in `.env`: `OPENAI_API_KEY=sk-...`
5. **Add billing** (no free tier in production)

```python
# Installation (already in requirements.txt)
pip install openai

# Basic usage
from openai import AsyncOpenAI
import os

client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
response = await client.chat.completions.create(
    model="gpt-4.1",
    messages=[{"role": "user", "content": "Write a lesson plan on fractions"}]
)
print(response.choices[0].message.content)
```

---

## Phase 1 AI Features (All Ship Together)

### Feature 1: TurboAI Student Tutor

**Route**: `POST /api/ai/tutor`  
**Model**: Claude Sonnet 4.6  
**Who uses it**: Students (logged in)

```python
# backend/routes/ai_tutor.py
import anthropic
import os
import logging

logger = logging.getLogger(__name__)
client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

@router.post("/tutor")
async def tutor_chat(data: dict, current_user: dict = Depends(get_current_user)):
    subject = data.get("subject", "General")
    question = data.get("question", "")
    student_name = current_user.get("name", "Student")
    year_group = current_user.get("year_group", "")

    system_prompt = f"""You are TurboAI, a friendly and encouraging school tutor 
    at The RightWay Centre of Learning in Trinidad and Tobago.
    You are helping {student_name}, a student in {year_group}.
    Current subject: {subject}.
    
    - Give clear, age-appropriate explanations
    - Use examples relevant to Caribbean/Trinidadian context where helpful
    - Encourage and motivate, never criticize
    - Break down complex concepts step by step
    - Ask clarifying questions when needed"""

    logger.info(f"TurboAI request - user:{current_user['user_id']} subject:{subject}")

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": question}]
    )

    logger.info(f"TurboAI response - tokens_used:{response.usage.input_tokens + response.usage.output_tokens}")
    return {"answer": response.content[0].text}
```

---

### Feature 2: AI Lesson Plan Assistant

**Route**: `POST /api/ai/lesson-plan`  
**Model**: Claude Sonnet 4.6  
**Who uses it**: Teachers

```python
@router.post("/lesson-plan")
@limiter.limit("20/hour")
async def generate_lesson_plan(request: Request, data: dict, current_user: dict = Depends(require_teacher)):
    topic = data.get("topic", "")
    subject = data.get("subject", "")
    year_group = data.get("year_group", "")
    duration_minutes = data.get("duration_minutes", 45)

    prompt = f"""Generate a complete lesson plan for:
    - Topic: {topic}
    - Subject: {subject}
    - Year Group: {year_group}
    - Duration: {duration_minutes} minutes
    - School: The RightWay Centre of Learning, Trinidad

    Include:
    1. Learning Objectives (3-5 SMART objectives)
    2. Materials Needed
    3. Introduction / Hook Activity (5 min)
    4. Main Teaching Activities (with timing)
    5. Student Practice / Group Work
    6. Assessment / Exit Activity
    7. Homework Assignment
    8. Differentiation (for struggling and advanced students)

    Format as structured markdown."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )
    return {"lesson_plan": response.content[0].text}
```

---

### Feature 3: School Analytics Chatbot

**Route**: `POST /api/ai/analytics-chat`  
**Model**: Claude Sonnet 4.6 with tool use  
**Who uses it**: Admin, CEO, Principal

```python
# The key here is Claude uses "tools" to query live school data
tools = [
    {
        "name": "query_school_data",
        "description": "Query school database for statistics and reports",
        "input_schema": {
            "type": "object",
            "properties": {
                "query_type": {
                    "type": "string",
                    "enum": ["attendance", "grades", "finance", "hr", "admissions"]
                },
                "filters": {"type": "object"}
            },
            "required": ["query_type"]
        }
    }
]

@router.post("/analytics-chat")
async def analytics_chat(data: dict, current_user: dict = Depends(require_admin)):
    question = data.get("question", "")

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        tools=tools,
        system="You are a school analytics assistant. Use tools to fetch live data.",
        messages=[{"role": "user", "content": question}]
    )

    # If Claude calls a tool, execute it and continue conversation
    if response.stop_reason == "tool_use":
        tool_results = await execute_tool_calls(response.content, current_user)
        # Continue conversation with tool results
        final_response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            tools=tools,
            messages=[
                {"role": "user", "content": question},
                {"role": "assistant", "content": response.content},
                {"role": "user", "content": tool_results}
            ]
        )
        return {"answer": final_response.content[0].text}

    return {"answer": response.content[0].text}
```

---

### Feature 4: Public Admissions Chatbot

**Route**: `POST /api/website/chat` (public, no auth)  
**Model**: Claude Sonnet 4.6  
**Who uses it**: Prospective parents on website

```python
@router.post("/website/chat")
@limiter.limit("10/hour")
async def admissions_chatbot(request: Request, data: dict):
    message = data.get("message", "")

    # Load school info from CMS settings
    settings = await db.website_settings.find_one({})
    school_info = settings or {}

    system_prompt = f"""You are the admissions assistant for {school_info.get('school_name', 'The RightWay Centre of Learning')} 
    located in Trinidad and Tobago.
    
    You help prospective parents learn about:
    - Programs: Nursery, Kindergarten, Primary/JHS
    - Admissions process (4 steps: Schedule Tour → Apply → Interview → Enroll)
    - Curriculum and activities
    - School fees and payment options
    - Contact information: {school_info.get('phone', '')}
    
    Be warm, welcoming, and professional.
    Always encourage parents to schedule a school tour.
    If asked about specific fees, direct them to contact the admissions office.
    Do NOT make up information you don't have — say 'please contact us directly'."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=system_prompt,
        messages=[{"role": "user", "content": message}]
    )
    return {"reply": response.content[0].text}
```

---

## AI Safety & Cost Controls

### Rate Limiting Per Feature

```python
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

# Apply to all AI endpoints:
@limiter.limit("20/hour")   # TurboAI tutor
@limiter.limit("10/hour")   # Lesson plan generator
@limiter.limit("30/hour")   # Analytics chatbot (admin only)
@limiter.limit("10/hour")   # Public admissions chatbot (per IP)
```

### AI Usage Logging

All AI calls should log to `ai_usage.log`:
```python
import logging
import time

ai_logger = logging.getLogger("ai_usage")

def log_ai_call(feature: str, model: str, user_id: str, input_tokens: int, output_tokens: int, duration_ms: float):
    ai_logger.info(
        f"feature={feature} model={model} user={user_id} "
        f"in_tokens={input_tokens} out_tokens={output_tokens} "
        f"duration_ms={duration_ms:.0f}"
    )
```

Configure in `server.py`:
```python
import logging
from logging.handlers import RotatingFileHandler

ai_handler = RotatingFileHandler("/var/log/rightway/ai_usage.log", maxBytes=10_000_000, backupCount=5)
ai_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
logging.getLogger("ai_usage").addHandler(ai_handler)
```

---

## Existing AI Features (Already Built — Remove Emergent, Keep Logic)

| Feature | File | Model | Status |
|---------|------|-------|--------|
| AI Diagrams | `routes/ai_diagrams.py` | DALL-E 3 | Replace Emergent → OpenAI |
| Lesson AI | `routes/lessons_v2.py` | GPT-4.1 + Gemini | Replace Emergent |
| Scheme Analysis | `routes/schemes.py` | Gemini 2.0 Flash | Replace Emergent |
| Quiz Generation | `routes/quiz.py` | Gemini 2.0 Flash | Replace Emergent |
| Plagiarism | `routes/plagiarism.py` | GPT-4.1 | Replace Emergent |
| Smart Search | `routes/search.py` | Gemini 2.0 Flash | Replace Emergent |
| Lecture Gen | `routes/lectures.py` | GPT-4.1 | Replace Emergent |
