# Project Delivery Timeline

**Client**: The RightWay Centre of Learning, Trinidad & Tobago  
**Prepared by**: Development Team  
**Start Date**: Day 1 of signed contract  
**Scale**: ~200 students at launch · Multi-campus SaaS architecture  
**Last Updated**: 2026-05-23

---

## Project Overview

This document outlines the complete delivery plan from project kickoff to go-live. The system being built includes:

- A **School Management Workstation** — for staff, teachers, students, and parents (already developed, being secured and rebranded)
- A **Public Website** — marketing site + online admissions, with all content managed by school admin
- **AI-powered features** — student tutor, lesson planning, analytics, and public chatbot
- A **unified design** across both systems using the school's brand colors and identity

---

## High-Level Timeline

```
╔═══════════════════════════════════════════════════════════════════╗
║               PROJECT DELIVERY — 12 WEEKS                        ║
╠════════════╦══════════════════════════════════╦══════════════════╣
║ PHASE      ║ DELIVERABLE                      ║ DURATION         ║
╠════════════╬══════════════════════════════════╬══════════════════╣
║ Phase 0    ║ Security hardening               ║ Weeks 1–2        ║
║ Phase 1    ║ Infrastructure + vendor cleanup  ║ Week 3           ║
║ Phase 2    ║ Public website + CMS             ║ Weeks 4–7        ║
║ Phase 3    ║ AI features (all 4)              ║ Weeks 8–10       ║
║ Phase 4    ║ Testing + training + go-live     ║ Weeks 11–12      ║
╚════════════╩══════════════════════════════════╩══════════════════╝
```

---

## Detailed Flowchart

```
╔═══════════════════════════════════════════════════════╗
║  CONTRACT SIGNED / PROJECT KICKOFF                    ║
║  Day 1 — Requirements confirmed, repo access granted  ║
╚═══════════════════╤═══════════════════════════════════╝
                    │
                    ▼
┌───────────────────────────────────────────────────────────┐
│  PHASE 0 — SECURITY HARDENING           Weeks 1–2 (10d)  │
│  "Making the existing system production-safe"             │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ▸ Remove hardcoded passwords & default secrets           │
│  ▸ Add login rate limiting (brute-force protection)       │
│  ▸ Fix CORS: restrict to school domain only              │
│  ▸ Enforce strong password policy                         │
│  ▸ Add session expiry (auto-logout after 7 days)          │
│  ▸ Add security headers (CSP, X-Frame-Options)           │
│  ▸ Input validation across all API endpoints              │
│  ▸ Security audit & review                                │
│                                                           │
│  ✅ MILESTONE: Backend is production-safe                 │
│  📦 Deliverable: Security report + hardened codebase      │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────┐
│  PHASE 1 — VENDOR CLEANUP + INFRASTRUCTURE  Week 3 (5d)  │
│  "Removing all third-party lock-in, setting up servers"   │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ▸ Replace all Emergent LLM calls → direct AI APIs       │
│  ▸ Replace file storage → local VPS filesystem            │
│  ▸ Set up Ubuntu VPS (Nginx + Supervisor + SSL)           │
│  ▸ Configure MongoDB, PostgreSQL, Redis                   │
│  ▸ Set up all environment variables + .env               │
│  ▸ Configure automatic daily backups                      │
│  ▸ Deploy staging URL for client review                   │
│                                                           │
│  ✅ MILESTONE: Clean codebase running on live server      │
│  📦 Deliverable: Staging URL (dev.learnrightschool.com)      │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────┐
│  PHASE 2 — PUBLIC WEBSITE + CMS        Weeks 4–7 (20d)   │
│  "Building the school's public face and content system"   │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  WEEK 4 — Website Structure & Design (5d)                │
│  ├── Next.js 14 project setup (SSR for Google SEO)       │
│  ├── Design system: green/gold/ivory palette              │
│  ├── Navigation + Hero section (animated slideshow)       │
│  ├── About Us + School Programs (3 tiers) sections        │
│  └── WhatsApp floating widget (animated, chat form)       │
│                                                           │
│  WEEK 5 — Content Sections (5d)                          │
│  ├── Gallery, Testimonials, Blog/News                     │
│  ├── Events & Calendar, Admissions Process                │
│  ├── FAQ (accordion), Contact + Google Map                │
│  └── Footer + social links                                │
│                                                           │
│  WEEK 6 — Auth Modals + CMS Backend (5d)                 │
│  ├── Login modal + Signup modal (overlaid on hero)        │
│  ├── Community registration flow (pending → approved)     │
│  ├── All CMS API routes (/api/website/*)                  │
│  └── MongoDB CMS collections (all content types)          │
│                                                           │
│  WEEK 7 — CMS Admin Panel + Integration (5d)             │
│  ├── Admin panel: Website Manager tab in workstation      │
│  ├── CRUD for: blog, events, gallery, FAQ, programs       │
│  ├── Testimonials approval workflow                        │
│  ├── Website connected to live API data                   │
│  └── SEO: meta tags, Open Graph, sitemap.xml              │
│                                                           │
│  ✅ MILESTONE: Public website live + admin can edit it    │
│  📦 Deliverable: www.learnrightschool.com (staging)          │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────┐
│  PHASE 3 — AI FEATURES                Weeks 8–10 (15d)   │
│  "Adding intelligent automation to the school system"     │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  WEEK 8 — Student + Teacher AI (5d)                      │
│  ├── TurboAI Student Tutor (Claude Sonnet)                │
│  │   Per-subject Q&A, Caribbean context, homework help    │
│  └── AI Lesson Plan Assistant (Claude)                    │
│      Topic in → full structured lesson plan out           │
│                                                           │
│  WEEK 9 — Admin + Website AI (5d)                        │
│  ├── School Analytics Chatbot (Claude + live data)        │
│  │   "How many students were absent last week?" → answer  │
│  └── Public Admissions Chatbot (on website)               │
│      24/7 automated answers for prospective parents       │
│                                                           │
│  WEEK 10 — AI Safety + Cost Controls (5d)                │
│  ├── Rate limiting (per user, per hour)                   │
│  ├── Usage logging + cost tracking (ai_usage.log)         │
│  ├── Redis caching for repeat queries                      │
│  └── AI admin dashboard (usage, errors, costs)            │
│                                                           │
│  ✅ MILESTONE: All 4 AI features live and monitored       │
│  📦 Deliverable: AI demo session with client              │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────┐
│  PHASE 4 — TESTING + TRAINING + GO-LIVE  Weeks 11–12     │
│  "Ensuring everything works before opening to the school" │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  WEEK 11 — Testing Sprint (5d)                           │
│  ├── Full walkthrough: all 13 user roles                  │
│  ├── Finance: invoice → payment → receipt end-to-end      │
│  ├── Admissions pipeline: inquiry → enrolled               │
│  ├── Security: CORS, auth bypass, rate limit checks       │
│  ├── Performance: 100 concurrent users, page speed        │
│  └── Bug fix sprint                                        │
│                                                           │
│  WEEK 12 — Go-Live (5d)                                  │
│  ├── Day 1: DNS cutover → production VPS                  │
│  │          SSL certificates activated                     │
│  │          All services verified                          │
│  ├── Day 2: Staff admin onboarding (CEO, Principal)       │
│  ├── Day 3: Teacher onboarding + student data import      │
│  ├── Day 4: 48-hour live monitoring window                │
│  └── Day 5: Handover documentation + support guide        │
│                                                           │
│  🚀 MILESTONE: SYSTEM IS LIVE AT learnrightschool.com        │
│  📦 Deliverable: Full handover + 30-day support included  │
└───────────────────────────────────────────────────────────┘
```

---

## Calendar View

```
       WEEK 1         WEEK 2         WEEK 3         WEEK 4
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ SECURITY     │ │ SECURITY     │ │ VENDOR       │ │ WEBSITE      │
│ JWT / Pwd    │ │ Headers/CSP  │ │ CLEANUP      │ │ STRUCTURE    │
│ CORS / Rate  │ │ Validation   │ │ VPS Setup    │ │ Hero/Nav     │
│ Limits       │ │ Audit review │ │ Staging URL  │ │ Programs     │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

       WEEK 5         WEEK 6         WEEK 7         WEEK 8
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ WEBSITE      │ │ AUTH +       │ │ CMS ADMIN    │ │ AI           │
│ CONTENT      │ │ CMS BACKEND  │ │ PANEL        │ │ Tutor +      │
│ Gallery/Blog │ │ Login/Signup │ │ Admin CRUD   │ │ Lesson Plans │
│ Events/FAQ   │ │ API routes   │ │ SEO + Launch │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

       WEEK 9         WEEK 10        WEEK 11        WEEK 12
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ AI           │ │ AI SAFETY    │ │ TESTING      │ │  🚀 GO-LIVE  │
│ Analytics +  │ │ Rate limits  │ │ All roles    │ │ DNS Cutover  │
│ Admissions   │ │ Cost ctrl    │ │ Security     │ │ Onboarding   │
│ Chatbot      │ │ Dashboard    │ │ Bug fixes    │ │ Handover     │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

---

## What the Client Sees at Each Stage

| Week | What's Available | URL |
|------|-----------------|-----|
| Week 3 | Management system on staging server | `dev.learnrightschool.com` |
| Week 7 | Public website live on staging | `staging.learnrightschool.com` |
| Week 10 | AI features added, full demo session | `staging.learnrightschool.com` |
| Week 12 | **Everything goes live on production** | `learnrightschool.com` |

---

## Project Scope Breakdown

### System 1 — School Management Workstation (Existing, enhanced)
All of the following are **already built** and being hardened, rebranded, and secured:

| Module | Status |
|--------|--------|
| Student & Staff Registry | Built |
| Academics (lessons, assignments, grading) | Built |
| Attendance | Built |
| Finance (invoices, payments, reports) | Built |
| HR & Payroll | Built |
| Timetable | Built |
| Admissions pipeline | Built |
| Boarding, Sick Bay, Reception | Built |
| Communication (chat, mail, announcements) | Built |
| AI diagrams, lesson AI, quiz AI | Built (rewired) |
| Reports & analytics | Built |
| PWA (installable as app) | Built |

### System 2 — Public Website + CMS (New build)
All of the following are **new development** in Phase 2:

| Feature | Notes |
|---------|-------|
| Single-page scrolling website (16 sections) | Next.js 14 + SEO |
| All content editable from admin workstation | CMS backend |
| WhatsApp floating chat widget | Animated, custom |
| Login/Signup modals | Community registration |
| Blog/News with categories | Full CRUD |
| Events calendar | Full CRUD |
| Gallery with albums | Upload from admin |
| Testimonials with approval flow | Admin approves |
| FAQ accordion | Full CRUD |
| Google Map embed | CMS-configurable |

### System 3 — AI Features (New in Phase 3)

| Feature | Who Uses It |
|---------|-------------|
| TurboAI Student Tutor | Students (logged in) |
| AI Lesson Plan Generator | Teachers |
| School Analytics Chatbot | Admin/CEO/Principal |
| Public Admissions Chatbot | Parents on website |

---

## What Is NOT Included (Available in Phase 2 — Post-Launch)

| Feature | Est. Timeline |
|---------|--------------|
| Mobile app (React Native) | Month 4–5 |
| Parent self-service fee payment portal | Month 4 |
| Second campus/school onboarding | Month 5–6 |
| Full SaaS multi-tenant white-labelling | Year 2 |
| Cloudflare R2 / S3 storage upgrade | When media > 20GB |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Client delays providing school content (photos, text) | High | Medium | Placeholder content used at launch; CMS means no developer needed to update later |
| DNS/SSL issues at go-live | Low | High | Set up 7 days early on staging |
| AI cost overrun | Low | Medium | Rate limiting + Redis cache + cost monitoring dashboard |
| VPS runs out of disk space (media) | Low | Medium | Disk alert at 70% + media backup cron |
| Staff slow to adopt system | Medium | Medium | Video walkthroughs + onboarding session + dedicated support window |
| MongoDB data loss | Very low | Critical | Daily automated backup — tested every 2 weeks |

---

## Post-Launch Support (Included — 30 Days)

During the first 30 days after go-live:
- Bug fixes within 24 hours
- Staff questions via WhatsApp/email support
- One additional training session if needed
- Performance monitoring alerts

---

## Definition of Done

The system is considered delivered when every item below is checked:

```
Security
  ☐ No hardcoded secrets or default passwords
  ☐ Login is rate-limited (5 attempts per minute)
  ☐ CORS restricted to learnrightschool.com only
  ☐ HTTPS on all endpoints
  ☐ Sessions expire automatically

Infrastructure
  ☐ All 3 services running (Management, CMS API, Website)
  ☐ MongoDB + PostgreSQL + Redis running and healthy
  ☐ Daily backup cron active and tested
  ☐ Log files rotating correctly

Management System
  ☐ All 13 user roles can log in successfully
  ☐ Finance: create invoice → record payment → download receipt
  ☐ Attendance: mark class → generate report
  ☐ AI tutor: student question → response in < 5 seconds

Public Website
  ☐ All 16 sections visible and correctly styled
  ☐ Admin can edit any section from the workstation
  ☐ WhatsApp widget opens chat correctly
  ☐ Login/Signup modals work + pending approval flow works
  ☐ Website loads in under 2.5 seconds on mobile

Go-Live
  ☐ DNS pointing to production VPS
  ☐ SSL certificate valid and auto-renewing
  ☐ Health check: GET /api/health returns 200
  ☐ Staff have completed onboarding session
  ☐ Student data imported via bulk upload
```
