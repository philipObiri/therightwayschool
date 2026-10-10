# RightWay Centre of Learning — Master Project Plan

**Client**: The RightWay Centre of Learning, Trinidad and Tobago, Caribbean  
**Developer**: Remote (Ghana)  
**Last Updated**: 2026-05-23  
**Status**: Active Development

---

## Project Overview

A full-featured school management SaaS platform for The RightWay Centre of Learning in Trinidad and Tobago. The system covers academics, finance, HR, admissions, communication, and AI-powered features. It is being hardened for production deployment and extended with a public-facing website + CMS.

**Current scale**: ~200 students, 1 campus  
**Target scale**: Multi-campus, multi-city, multi-country SaaS

---

## System Architecture

```
[Public Website — Next.js]
        ↓
[Nginx Reverse Proxy]
        ↓
[FastAPI Backend :8000]  ←→  [MongoDB :27017]
[Django CMS API :8001]   ←→  [PostgreSQL :5432]
        ↓
     [Redis :6379]
```

See `06_deployment_architecture.md` for full VPS setup.

---

## Implementation Phases

### Phase 0 — Security Hardening ⚠️ BEFORE ANY DEPLOYMENT
**Duration**: 2 weeks  
**Priority**: BLOCKING — nothing ships until this is done

- [ ] Remove JWT secret fallback (`'default_secret'`)
- [ ] Remove all hardcoded passwords from `auth.py` and `server.py`
- [ ] Delete `GET /api/auth/fix-passwords` endpoint
- [ ] Add `slowapi` rate limiting (login: 5/min, AI: 30/min)
- [ ] Fix CORS from `*` to whitelist
- [ ] Enforce password policy: 8+ chars, uppercase, number, symbol
- [ ] Add MongoDB TTL index on `user_sessions`
- [ ] Add Pydantic models to routes using `.get()` dict access
- [ ] Move WebSocket tokens from query params to headers
- [ ] Fix regex date injection in `admissions.py`
- [ ] Add CSP + security headers middleware

See `02_security_hardening.md` for full details.

### Phase 1 — Emergent Vendor Removal
**Duration**: 1 week  
**Priority**: HIGH — remove all third-party LLM wrapper dependency

- [ ] Remove `emergentintegrations==0.1.0` from `requirements.txt`
- [ ] Rewrite `storage.py` → local filesystem + WhiteNoise (see `10_storage_and_static.md`)
- [ ] Replace Emergent OAuth proxy → direct Google OAuth
- [ ] Replace all `LlmChat` calls → direct OpenAI / Gemini SDK
- [ ] Update frontend `AuthContext.js` Google OAuth flow
- [ ] Remove `emergentagent.com` from CORS allowlist

See `03_emergent_removal.md` for full details and code patterns.

### Phase 2 — Public Website + CMS Backend
**Duration**: 3 weeks

- [ ] Create `backend/routes/website.py` (14 CMS endpoint groups)
- [ ] Build Next.js public website (single-page, anchor nav)
- [ ] Build CMS admin panel at `/admin/website` in existing dashboard
- [ ] Implement WhatsApp + Call + Email contact widget
- [ ] Implement auth modals (Login + Signup with `status: pending`)
- [ ] Wire all sections to live CMS API

See `05_website_cms.md` for full specification.

### Phase 3 — AI Features Integration
**Duration**: 4 weeks

- [ ] TurboAI Student Tutor (Claude Sonnet)
- [ ] AI Lesson Plan Assistant (Claude Sonnet)
- [ ] School Analytics Chatbot (Claude + tool use)
- [ ] Public Admissions Chatbot (Claude)
- [ ] Rate limiting + budget controls per feature
- [ ] AI usage logging (`ai_usage.log`)

See `04_ai_integrations.md` for full details.

### Phase 4 — Production Hardening
**Duration**: 2 weeks

- [ ] Docker + docker-compose for local dev
- [ ] Supervisor config for all services
- [ ] Nginx config with SSL (Certbot)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Load testing
- [ ] Monitoring + alerting
- [ ] MongoDB backup strategy

See `06_deployment_architecture.md` for full details.

---

## Key Decisions Log

| Decision | Choice | Reason |
|----------|--------|--------|
| Backend framework | Keep FastAPI | 679+ endpoints — rewrite too costly |
| CMS backend | New Django REST service | Developer knows Django deeply |
| Public website | Next.js (separate app) | SSR for SEO |
| Database | MongoDB (school) + PostgreSQL (CMS) | Hybrid — no migration cost |
| Multi-tenancy | Shared DB, `school_id` on all records | Standard SaaS pattern |
| Auth backend (website) | Existing FastAPI | Avoid duplicate auth systems |
| LLM vendor | Direct APIs (no Emergent wrapper) | No vendor lock-in |
| Email | Mailtrap (prod), log to file (dev) | Clean separation |
| Dashboard colors | Unified bright palette | School branding, no dark theme |

---

## Directory Structure

```
Trinidad/
├── backend/                  FastAPI school management system
│   ├── routes/               50+ route modules (679+ endpoints)
│   ├── tests/                63 test files
│   ├── middleware/           NEW: security, rate limiting, headers
│   ├── server.py             App entry point
│   ├── auth.py               Authentication
│   ├── database.py           MongoDB connection
│   ├── models.py             Pydantic models
│   ├── storage.py            File storage (local VPS filesystem)
│   └── ws_manager.py         WebSocket manager
├── frontend/                 React 19 school dashboard (127 pages)
│   └── src/
│       ├── pages/            Role-based pages
│       ├── components/       55 shadcn/ui components
│       └── contexts/         Auth, Term, Sync contexts
├── documentation/            ← YOU ARE HERE
├── scripts/                  Utility scripts (migrations, seeds)
├── tests/                    Root-level test files
└── .env.example              Environment variable template
```

---

## Contact & Resources

- **Backend API base**: `http://localhost:8000/api`
- **Frontend**: `http://localhost:3000`
- **Django CMS**: `http://localhost:8001/cms/api`
- **MongoDB**: `mongodb://localhost:27017/rightway`
- **PostgreSQL**: `postgresql://localhost:5432/rightway_cms`
