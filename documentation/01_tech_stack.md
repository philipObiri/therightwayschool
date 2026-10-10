# Tech Stack Reference

**Last Updated**: 2026-05-23

---

## Backend — FastAPI (School Management System)

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | FastAPI | 0.110.1 | Async ASGI, high performance |
| Server | Uvicorn | 0.25.0 | ASGI server |
| Database | MongoDB | 4.5.0 | via motor async driver 3.3.1 |
| Auth | PyJWT + python-jose | 2.11.0 + 3.5.0 | JWT token auth |
| Password hashing | bcrypt + passlib | 4.1.3 + 1.7.4 | bcrypt hashing |
| Validation | Pydantic | 2.12.5 | Request/response models |
| AI — Claude | anthropic | latest | Student tutor, lesson plans, analytics |
| AI — Gemini | google-generativeai | 0.8.6 | Quiz gen, schemes, search |
| AI — OpenAI | openai | 1.99.9 | Lectures, plagiarism, image gen |
| Payments | Paystack (custom) + stripe | 14.3.0 | Payment processing |
| File storage | aiofiles + WhiteNoise | — | Local VPS filesystem — no cloud storage (see `10_storage_and_static.md`) |
| PDF generation | fpdf2 + weasyprint | 2.8.6 + 68.1 | Finance reports, certificates |
| Word docs | python-docx | 1.2.0 | Report generation |
| Real-time | websockets | 15.0.1 | Chat + notifications |
| Push notifications | pywebpush + py-vapid | 2.3.0 + 1.9.4 | Web Push API |
| Data processing | pandas + openpyxl | 3.0.1 + 3.1.5 | Spreadsheet import/export |
| HTTP client | httpx | 0.28.1 | Async HTTP requests |
| Rate limiting | slowapi | to add | Per-endpoint rate limiting |
| Redis | redis-py | to add | Session cache, rate limiting |
| Email | Mailtrap SMTP | — | Via smtplib / aiosmtplib |
| Testing | pytest | 9.0.2 | 63 test files |

**Scale**: 679+ endpoints across 50 route modules.

---

## Django REST (CMS Service — NEW)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Django 4.x + DRF | REST API for CMS content |
| Database | PostgreSQL | Relational data for CMS |
| Auth | DRF TokenAuth / JWT | Shared auth with FastAPI via JWT |
| Admin panel | Django Admin | Content management UI |
| Email | django-anymail + Mailtrap | Transactional emails |
| Static/Media | WhiteNoise | Static file serving from VPS filesystem |

---

## Frontend — React Dashboard (School Management)

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | React | 19.0.0 | Main dashboard |
| Router | React Router DOM | 7.5.1 | Client-side routing |
| Build tool | craco | — | Create React App override |
| Language | JavaScript (JSX) | — | No TypeScript |
| State | Context API | — | AuthContext, TermContext, SyncContext |
| HTTP | Axios | 1.8.4 | + offline queue (IndexedDB) |
| UI library | Radix UI + shadcn/ui | — | 55 custom components |
| Styling | Tailwind CSS | 3.4.17 | Utility-first CSS |
| Forms | React Hook Form + Zod | 7.56.2 + 3.24.4 | Form validation |
| Charts | Recharts | 3.6.0 | Analytics visualizations |
| Rich text | React Quill | — | Content editing |
| PDFs | jsPDF + autotable | — | Client-side PDF export |
| Notifications | Sonner | 2.0.3 | Toast notifications |
| Date utils | date-fns | 4.1.0 | Date formatting |
| Dark mode | next-themes | 0.4.6 | Theme switching |
| PWA | Service Worker + manifest | — | Offline capable |
| Pages | 127 pages | — | Across 10 role directories |
| Roles | 13+ roles | — | CEO to Nurse to Parent |

---

## Next.js (Public Website — NEW)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14+ | App Router, SSR for SEO |
| Styling | Tailwind CSS | Same config as dashboard |
| Components | shadcn/ui (shared) | Reuse from dashboard |
| HTTP | Axios / fetch | Calls FastAPI website endpoints |
| Fonts | Outfit + Manrope | Google Fonts |
| Maps | Google Maps Embed | School location |
| Analytics | Vercel Analytics (opt) | Page view tracking |

---

## Infrastructure

| Component | Technology | Notes |
|-----------|-----------|-------|
| VPS | Namecheap Ubuntu | Root server |
| Reverse proxy | Nginx | SSL termination, routing |
| Process manager | Supervisor | Auto-restart, logging |
| SSL | Certbot (Let's Encrypt) | Free SSL certificates |
| Cache | Redis | Sessions, rate limiting, AI cache |
| File storage | Local VPS filesystem + WhiteNoise | Media files, generated images (no cloud storage) |
| Database (school) | MongoDB self-hosted | `/data/db` on VPS |
| Database (CMS) | PostgreSQL self-hosted | System PostgreSQL |

---

## AI Models Reference

| Model | Provider | Use Cases | Speed | Cost |
|-------|----------|-----------|-------|------|
| claude-sonnet-4-6 | Anthropic | Tutor, lesson plans, analytics chatbot | Fast | $3/1M in |
| gemini-2.0-flash | Google | Quiz gen, schemes, search | Very fast | Free tier / cheap |
| gpt-4.1 | OpenAI | Lectures, plagiarism analysis | Fast | $2/1M in |
| dall-e-3 | OpenAI | Educational diagram generation | Medium | $0.04/image |

---

## Environment Variables (Full List)

```bash
# ── Server ──────────────────────────────────────────
JWT_SECRET=<64-char random hex — NEVER use default>
CORS_ORIGINS=https://learnrightschool.com,https://www.learnrightschool.com

# ── MongoDB ─────────────────────────────────────────
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=rightway

# ── PostgreSQL (Django CMS) ──────────────────────────
DATABASE_URL=postgresql://rightway:password@localhost:5432/rightway_cms

# ── Redis ────────────────────────────────────────────
REDIS_URL=redis://localhost:6379/0

# ── AI APIs ─────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_GENAI_API_KEY=AIza...

# ── Google OAuth ─────────────────────────────────────
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# ── File Storage (Local VPS — WhiteNoise) ────────────
MEDIA_ROOT=/home/rightway/app/media
MEDIA_URL=/media

# ── Email (Mailtrap) ─────────────────────────────────
MAILTRAP_HOST=live.smtp.mailtrap.io
MAILTRAP_PORT=587
MAILTRAP_USERNAME=...
MAILTRAP_PASSWORD=...
MAILTRAP_FROM=noreply@learnrightschool.com

# ── Payment (Paystack) ───────────────────────────────
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...

# ── Frontend ─────────────────────────────────────────
REACT_APP_BACKEND_URL=https://learnrightschool.com
REACT_APP_GOOGLE_CLIENT_ID=....apps.googleusercontent.com
```

Generate a secure JWT secret with:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
