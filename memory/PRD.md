# TCIS LMS Workstation - Product Requirements Document

## Original Problem Statement
Build a comprehensive, all-in-one platform for a school named "TCIS" (TCIS LMS Workstation). The system combines Learning Management System (LMS), finance/accounting, staff and teacher monitoring, admin operations, internal email, tasking, assignments, and built-in video meetings.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor AsyncIO) + WeasyPrint (PDF) + FPDF + Emergent LLM Key (AI)
- **Frontend**: React + TailwindCSS + Shadcn UI + PWA Service Worker
- **Auth**: JWT-based multi-role RBAC
- **Real-Time**: WebSockets for notifications + collaborative document editing

## Credentials
See `/app/memory/test_credentials.md`

## Completed Features (Summary)
- Core LMS (Lessons, Schemes, Lectures, Assignments, Score Entry, Gradebook)
- AI Diagram Generator, Working Papers, Finance/Billing, Advanced Accounting
- Communication (Mail, Messenger, Discussions), Admin & HR, PWA & Offline Mode
- Mobile Responsive, Report Cards (Categorized + PDF), Timetable Generator
- Paystack Integration, Student Promotion, Class Position Ranking
- Executive Theme (Navy + Gold), Digital Signatures, Online Users Widget

### Receptionist Module - COMPLETED 2026-04-16
- Dashboard, Admin Dashboard (no fee data), Billing & Items (uniforms, books, stationery, equipment, PE kit, accessories), Inventory, Procurement, Parent Communication with file uploads

### Sick Bay Nurse Module - COMPLETED 2026-04-16
- Dashboard, Student Admissions, Treatment Logging, Medical Inventory, Emergency Alerts, Student Medical History

### TCIS Reception Panel (Parent-facing) - COMPLETED 2026-04-16
- Messages from reception (direct + broadcasts) with file attachment downloads
- Uniform/item bills with itemized breakdown and payment status
- Summary cards (Messages, Bills, Total Billed, Outstanding)

### Almond Guest House Management System (AGHMS) - COMPLETED 2026-04-16
- **30-room hotel management** across 3rd Floor (301-315) and 4th Floor (401-415)
- **Dashboard**: Total rooms, occupied, available, reserved, maintenance, revenue, occupancy rate
- **Interactive Floor Layout**: Color-coded rooms (green=available, red=occupied, amber=reserved, grey=maintenance)
- **Check-in Workflow**: Guest registration (name, phone, email, ID), room assignment, date selection, auto-calculation (nights x rate = total)
- **Pricing Engine**: Default GHS 350/night, adjustable with admin-set min/max thresholds, all price changes logged
- **Payment Processing**: Cash, bank transfer, mobile money. Auto-generated receipts (AGH-XXXXXX format)
- **Check-out System**: Room freed, billing finalized, stay summary logged
- **Analytics (Admin/Founder)**: Revenue by room, monthly trends, average stay, popular rooms, total bookings
- **Audit Logging**: Every action (check-in, payment, checkout, room status, pricing) logged with user + timestamp
- **Access**: Receptionist (sidebar HOSPITALITY), Admin/SuperAdmin/CEO/Founder (sidebar OPERATIONS), Founder (read-only analytics)
- **Backend**: `/api/guesthouse/*` — dashboard, rooms, bookings, payments, checkout, analytics, pricing, audit

### File Upload in Parent Communication - COMPLETED 2026-04-16
- Receptionist can attach files when composing messages to parents
- Parents can download attached files from TCIS Reception panel

### Parent Concerns & Booster Lessons - COMPLETED 2026-04-17
- **Management tab** at `/admin/booster-concerns` for Admin, SuperAdmin, CEO, Founder, Principal, HeadTeacher, HeadOfAcademics
- **Parent Concerns**: Raise, edit, respond, delete concerns about students with searchable student dropdown
  - Categories: academic, behaviour, health, financial, general, other
  - Statuses: open, in_progress, resolved, closed
  - Response thread with status updates, auto-notification to original raiser
- **Booster Lessons**: Book extra classes for weak students with searchable student/teacher dropdowns
  - Assign teacher, select preferred days, set reason and notes
  - Statuses: requested, approved, in_progress, completed, cancelled
  - Auto-notification to assigned teacher and management
- **Teacher Integration**: "Support" button in My Classes page shows booster lessons and parent concerns for each class
- **Backend**: `/api/booster/*` — full CRUD for concerns and lessons, by-class endpoints for teachers, student/teacher search
- **Sidebar**: "Concerns & Boosters" link under OPERATIONS section for management roles

### Teacher Booster Students Tab - COMPLETED 2026-04-17
- Dedicated `/teacher/booster` page showing all booster students assigned to the teacher
- Summary cards: Active, Completed, Total Assigned, Unique Students
- Student cards with subject, preferred days, reason, notes, and booking info
- Sidebar link "Booster Students" under TEACHING section for all Teacher roles

### Access Restrictions (Parent/Student) - COMPLETED 2026-04-17
- Parents & Students cannot see Knowledge Base (removed from sidebar + route restricted)
- Parents & Students do not see Emergency Alert popups or Teacher Announcements
- Parents still receive medical notifications for their linked child via push notifications
- Medical alerts from Sick Bay auto-notify parents of affected students

### Push Notification Bell Tones - COMPLETED 2026-04-17
- All system notifications trigger push notifications (messages, lesson approvals, booster assignments, etc.)
- Push notifications play alarm bell tones via Web Audio API
- Emergency notifications: urgent alternating alarm (880/660 Hz square waves)
- Standard notifications: pleasant bell chime (C6-G5-C6 sine tones)
- Sound plays both on push (via service worker message to client) and WebSocket (in-app)

### Scheme of Work Upload Restriction - COMPLETED 2026-04-17
- Only management roles can create/upload Scheme of Work (Admin, SuperAdmin, CEO, Founder, Principal, HeadTeacher, HeadOfAcademics)
- Teachers can view all schemes but Create New / Upload buttons are hidden
- Backend enforces restriction with `require_roles` decorator on POST /api/schemes/

### Bulk Account Upload - COMPLETED 2026-04-20
- Upload Excel (.xlsx/.xls) or Word (.docx with tables) files to auto-create Student + Parent accounts
- Auto-detects columns (name, year, gender, DOB, admission #, boarding, parent name/phone/email, address) via regex patterns
- Preview step shows column mapping, total rows, and full data table before creation
- Create step skips duplicates (by case-insensitive name), updates existing parents with new children, auto-generates parent emails when missing
- Default passwords: students=student123, parents=parent123 (stored in last_set_password so Student/Parent Logins tracker reveals them)
- Backend: `/api/bulk-upload/preview` & `/api/bulk-upload/create-accounts` (management roles only)
- Frontend: `/admin/bulk-upload` route, sidebar "Bulk Upload" under People section (Admin, SuperAdmin, CEO, AdmissionsOfficer)
- Tested: 11/11 backend pytest pass, full UI flow verified (iteration_71.json)

### seed_parents.py Bug Fix - COMPLETED 2026-04-20
- Fixed wrong password field name (was `"password"`, now `"password_hash"`); seeded parents can now log in
- Added `last_set_password` so Super Admin Parent Logins tracker shows the plain password

### Parent Account Multi-Select & Bulk Delete - COMPLETED 2026-04-20
- Added `DELETE /api/auth/users/{user_id}` (single) and `POST /api/auth/users/bulk-delete` (batch) — management roles only, self-delete blocked, audit-logged
- Manage tab in Parent Management now has per-row checkboxes + select-all header checkbox
- Floating "N selected" action bar appears with Clear + red Delete button (confirm dialog)
- Per-row trash icon for single deletes (confirm dialog)
- Tested: single + bulk delete via curl (3 parents), self-delete prevention (400), UI checkboxes functional on 44 parents

### Bulk Upload Templates - COMPLETED 2026-04-20
- Added `GET /api/bulk-upload/template?fmt=xlsx|docx` endpoint (no auth) — returns a pre-formatted file with the exact headers the parser auto-detects + 3 example rows + instructions sheet (xlsx) or Notes section (docx)
- 12 columns: Student Name, Year Group, Gender, Date of Birth, Admission Number, Boarding Status, Parent Name, Parent Phone, Parent Email, Second Parent Phone, Second Parent Email, Address
- UI: "Excel Template" + "Word Template" download buttons in the top-right of `/admin/bulk-upload`
- Improved `parent_phone2`/`parent_email2` regex so "Second Parent Phone/Email" columns now auto-map correctly
- Round-trip verified: download → upload → all 12 columns detected, 3 rows parsed correctly for both formats

### Parent Portal — Subject Teacher Display - COMPLETED 2026-04-20
- Parent → Academics → clicking a subject now shows a highlighted "Subject Teacher" card with teacher name, department, and email
- Uses existing `GET /api/academic/child-subject-detail` endpoint (already returns teacher object)
- Verified end-to-end: parent sheilarthur26@gmail.com → Jaleesa Arthur → English Language → Esther Asroh (Leadership Department)

### Mobile Messenger Input Fix - COMPLETED 2026-04-20
- Issue: the "Type a message" input bar was hidden below the mobile viewport because `h-[calc(100vh-80px)]` uses static vh that doesn't shrink for the mobile browser URL bar or the software keyboard
- Fix: switched to `h-[calc(100dvh-140px)]` on mobile (`md:h-[calc(100vh-80px)]` preserved on desktop) — dvh (dynamic viewport height) resizes when the mobile browser chrome/keyboard appears
- Verified on 390×844 viewport: input-area bounding box y:728 height:57 fits within 844px viewport ✓

### Booster Lesson Teacher Assignment Fix - COMPLETED 2026-04-20
- Issue: the "Assign Teacher" search in Booster Lessons couldn't find management users (Esther Asroh, Kevin Titi-Ofei, Mrs. Danielle Cann, Emmanuel Godzo) because `/api/booster/teachers/search` only matched `role: "Teacher"`.
- Fix: query now matches `Teacher | HeadTeacher | HeadOfAcademics | Principal | CEO | Founder | Admin | SuperAdmin` as either primary `role` or inside the `roles` array.
- Verified: all four management users appear in search; regular teachers still appear; UI dropdown shows "Esther Asroh (Leadership)".

### Booster Lessons — In-Tile Comments & Progress Updates - COMPLETED 2026-04-20
- Backend: new `POST /api/booster/lessons/{id}/comment` lets the assigned teacher + management + any Teacher post threaded comments (appended to `lesson.comments[]`). Auto-notifies the opposite side + all management.
- Backend: `PUT /api/booster/lessons/{id}` now allows the **assigned teacher** to update their own lesson's `status`, `notes`, `preferred_days` (progress-type fields). Teachers cannot reassign. Management retains full edit.
- Frontend: new shared `BoosterLessonDetailDialog` used by both Admin page (`/admin/booster-concerns`) and Teacher page (`/teacher/booster`):
  - Student + subject + teacher summary header
  - "Update Progress" section (status dropdown + "How it's going" internal notes + Save)
  - Threaded comments UI (own messages right-aligned blue, others grey)
  - Composer with Send button (Enter to send; Shift+Enter newline)
- Admin table now has a chat icon with comment-count badge; Teacher cards are now clickable and show "N comments" tally.
- Tested end-to-end: admin comments posted, teacher (Edmund Ansah) posts comment, teacher saves progress (status→in_progress + note "Week 3: visible improvement..."); teacher reassign attempt correctly blocked (400). UI verified via screenshot.

### Global Dropdown Sweep - COMPLETED 2026-04-20
- **Shadcn Select (62 usages)**: bumped SelectContent from `z-50` → `z-[100]` (no more clipping inside Dialogs); Trigger now 40px tall with branded hover/focus; SelectItems now show TCIS blue check + blue hover tint.
- **Native `<select>` (13 usages)**: added global CSS rules that replace browser chrome with a branded chevron SVG, consistent rounded border, TCIS blue focus ring, 44px mobile touch target. One CSS change harmonises every plain `<select>` across Receptionist / Nurse / Finance / Guest House / Booster / Bulk Upload pages.
- **Backend sort**:
  - `/api/academic/classes` → sorted by year-group number (Year 7 → Year 13) then class name
  - `/api/auth/users` → alphabetical by name
  - `/api/admin/students` → alphabetical by name
  - This auto-fixes dozens of dropdowns that listed classes/teachers/students in random insertion order.

## Backlog
- P1: Encrypt localStorage data (security audit item)
- P1: Break down complex backend functions (my_timetable, get_general_ledger)
- P1: Termly billing automation
- P1: Seed production DB with 42 parent accounts after deployment (or use Bulk Upload UI)
- P2: Calendar integration for workflow deadlines
- P2: Guest House online booking portal, payment gateway, email/SMS confirmations
- P2: Guest House PDF reports (daily occupancy, revenue, monthly summary)
- P3: WebRTC Video Meetings, Discussion rooms
