# Emergent Vendor Removal Guide

**Decision**: Remove `emergentintegrations==0.1.0` package entirely.  
**Replace with**: Direct calls to OpenAI, Google Gemini, and local filesystem (WhiteNoise).  
**Reason**: No vendor lock-in on a closed third-party wrapper. Full code ownership.  
**Last Updated**: 2026-05-23

---

## Files to Modify (13 total)

| # | File | What Changes |
|---|------|-------------|
| 1 | `backend/requirements.txt` | Remove `emergentintegrations==0.1.0` |
| 2 | `backend/storage.py` | Full rewrite → local filesystem + WhiteNoise (see `10_storage_and_static.md`) |
| 3 | `backend/auth.py` | Replace Emergent OAuth proxy → direct Google |
| 4 | `backend/routes/ai_diagrams.py` | Replace image gen → OpenAI DALL-E 3 |
| 5 | `backend/routes/lectures.py` | Replace LlmChat (4 sessions) → AsyncOpenAI |
| 6 | `backend/routes/lessons_v2.py` | Replace LlmChat (10+ sessions) → OpenAI + Gemini |
| 7 | `backend/routes/plagiarism.py` | Replace LlmChat → AsyncOpenAI |
| 8 | `backend/routes/quiz.py` | Replace LlmChat (3 sessions, PDF) → Gemini |
| 9 | `backend/routes/schemes.py` | Replace LlmChat (7 sessions) → Gemini |
| 10 | `backend/routes/search.py` | Replace LlmChat → Gemini |
| 11 | `frontend/src/contexts/AuthContext.js` | Replace OAuth redirect URL |
| 12 | `frontend/plugins/visual-edits/dev-server-setup.js` | Remove emergent CORS entries |
| 13 | `auth_testing.md` | Update URLs |

---

## Replacement Pattern A — OpenAI Text Generation

Used in: `lectures.py`, `lessons_v2.py` (GPT calls), `plagiarism.py`

```python
# ❌ BEFORE (Emergent wrapper)
from emergentintegrations.llm.chat import LlmChat, UserMessage
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

session = LlmChat(
    api_key=EMERGENT_KEY,
    session_id="unique-session-id",
    system_message="You are a helpful teacher."
)
response = await session.chat(UserMessage(text=user_prompt))
result = response.text

# ✅ AFTER (direct OpenAI)
from openai import AsyncOpenAI
import os

client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

response = await client.chat.completions.create(
    model="gpt-4.1",
    messages=[
        {"role": "system", "content": "You are a helpful teacher."},
        {"role": "user", "content": user_prompt}
    ],
    temperature=0.7,
    max_tokens=2048
)
result = response.choices[0].message.content
```

---

## Replacement Pattern B — Google Gemini Text Generation

Used in: `quiz.py`, `schemes.py`, `search.py`, `lessons_v2.py` (Gemini calls)

```python
# ❌ BEFORE (Emergent wrapper)
from emergentintegrations.llm.chat import LlmChat, UserMessage
session = LlmChat(api_key=EMERGENT_KEY, session_id="...", system_message=system)
response = await session.chat(UserMessage(text=prompt))

# ✅ AFTER (direct Gemini)
import google.generativeai as genai
import os

genai.configure(api_key=os.environ["GOOGLE_GENAI_API_KEY"])

model = genai.GenerativeModel(
    model_name="gemini-2.0-flash",
    system_instruction=system_message
)
response = await model.generate_content_async(
    prompt,
    generation_config=genai.GenerationConfig(
        temperature=0.7,
        max_output_tokens=2048
    )
)
result = response.text
```

---

## Replacement Pattern C — Gemini with File Upload (PDF)

Used in: `quiz.py`, `schemes.py` (PDF analysis)

```python
# ❌ BEFORE (Emergent FileContentWithMimeType)
from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
file_content = FileContentWithMimeType(content=pdf_bytes, mime_type="application/pdf")
response = await session.chat(UserMessage(text=prompt, files=[file_content]))

# ✅ AFTER (Gemini Files API)
import google.generativeai as genai
import tempfile, os

genai.configure(api_key=os.environ["GOOGLE_GENAI_API_KEY"])

# Upload the file
with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
    tmp.write(pdf_bytes)
    tmp_path = tmp.name

uploaded_file = genai.upload_file(tmp_path, mime_type="application/pdf")
os.unlink(tmp_path)  # cleanup

model = genai.GenerativeModel("gemini-2.0-flash", system_instruction=system_message)
response = await model.generate_content_async([uploaded_file, prompt])
result = response.text

# Delete uploaded file from Gemini after use
genai.delete_file(uploaded_file.name)
```

---

## Replacement Pattern D — Image Generation

Used in: `ai_diagrams.py`

```python
# ❌ BEFORE (Emergent OpenAIImageGeneration wrapper)
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
gen = OpenAIImageGeneration(api_key=EMERGENT_KEY)
result = await gen.generate(prompt=prompt, model="gpt-image-1")
file_id = result.file_id  # Emergent stores to its own object store

# ✅ AFTER (direct OpenAI Images API + S3 storage)
from openai import AsyncOpenAI
import httpx, uuid
from backend.storage import put_object  # our new S3 storage module

client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

response = await client.images.generate(
    model="dall-e-3",
    prompt=prompt,
    size="1024x1024",
    quality="standard",
    n=1
)
image_url = response.data[0].url

# Download and store to S3
async with httpx.AsyncClient() as http:
    img_response = await http.get(image_url)
    img_bytes = img_response.content

file_id = f"diagrams/{uuid.uuid4()}.png"
await put_object(file_id, img_bytes, "image/png")
# Return file_id for retrieval via /api/ai-diagrams/image/{file_id}
```

---

## Replacement Pattern E — AWS S3 Storage

Replaces `storage.py` entirely:

```python
# ✅ NEW backend/storage.py
import boto3
from botocore.exceptions import ClientError
import os
import logging

logger = logging.getLogger(__name__)

BUCKET = os.environ["AWS_S3_BUCKET"]
REGION = os.environ.get("AWS_REGION", "us-east-1")

_s3 = None

def get_s3_client():
    global _s3
    if _s3 is None:
        _s3 = boto3.client(
            "s3",
            region_name=REGION,
            aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        )
    return _s3

async def put_object(file_id: str, data: bytes, mime_type: str = "application/octet-stream") -> str:
    s3 = get_s3_client()
    s3.put_object(
        Bucket=BUCKET,
        Key=file_id,
        Body=data,
        ContentType=mime_type,
    )
    logger.info(f"Stored object: {file_id} ({len(data)} bytes)")
    return file_id

async def get_object(file_id: str) -> bytes:
    s3 = get_s3_client()
    obj = s3.get_object(Bucket=BUCKET, Key=file_id)
    return obj["Body"].read()

def get_presigned_url(file_id: str, expires_in: int = 3600) -> str:
    s3 = get_s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": file_id},
        ExpiresIn=expires_in,
    )

async def delete_object(file_id: str) -> None:
    s3 = get_s3_client()
    s3.delete_object(Bucket=BUCKET, Key=file_id)
    logger.info(f"Deleted object: {file_id}")
```

---

## Replacement Pattern F — Google OAuth (Backend)

Replaces Emergent OAuth proxy in `auth.py:187`:

```python
# ❌ BEFORE (Emergent OAuth proxy)
resp = await client.get(
    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
    params={"session_id": session_id},
    headers={"x-api-key": EMERGENT_KEY}
)
data = resp.json()
email = data.get("email")

# ✅ AFTER (direct Google ID token verification)
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import os

GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]

def verify_google_token(token: str) -> dict:
    """Verify Google ID token and return user info."""
    try:
        payload = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        return {
            "email": payload["email"],
            "name": payload.get("name", ""),
            "picture": payload.get("picture", ""),
            "google_id": payload["sub"],
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")
```

---

## Replacement Pattern G — Google OAuth (Frontend)

Replaces Emergent redirect in `AuthContext.js:64`:

```javascript
// ❌ BEFORE
window.location.href = "https://auth.emergentagent.com/?redirect=...";

// ✅ AFTER (Google OAuth implicit flow with ID token)
const handleGoogleLogin = () => {
  const params = new URLSearchParams({
    client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
    redirect_uri: `${window.location.origin}/auth/callback`,
    response_type: "token id_token",
    scope: "openid email profile",
    nonce: crypto.randomUUID(),
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};

// In /auth/callback page — extract id_token from URL hash
// POST to /api/auth/google with { id_token }
// Backend verifies with google.oauth2.id_token and returns JWT
```

---

## Environment Variables to Replace

```bash
# ❌ REMOVE
EMERGENT_LLM_KEY=...

# ✅ ADD
OPENAI_API_KEY=sk-...
GOOGLE_GENAI_API_KEY=AIza...
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=rightway-storage

# Frontend
REACT_APP_GOOGLE_CLIENT_ID=....apps.googleusercontent.com
```

---

## Completion Checklist

- [ ] Remove `emergentintegrations==0.1.0` from `requirements.txt`
- [ ] Rewrite `storage.py` → S3
- [ ] Fix `auth.py` → direct Google token verification
- [ ] Fix `routes/ai_diagrams.py` → DALL-E 3 + S3
- [ ] Fix `routes/lectures.py` (4 LlmChat sessions) → AsyncOpenAI
- [ ] Fix `routes/lessons_v2.py` (10+ LlmChat sessions) → AsyncOpenAI + Gemini
- [ ] Fix `routes/plagiarism.py` → AsyncOpenAI
- [ ] Fix `routes/quiz.py` (3 sessions, PDF upload) → Gemini Files API
- [ ] Fix `routes/schemes.py` (7 sessions) → Gemini
- [ ] Fix `routes/search.py` → Gemini
- [ ] Fix `frontend/src/contexts/AuthContext.js` → direct Google OAuth
- [ ] Remove emergent domains from CORS config
- [ ] Run full test suite to confirm no regressions
