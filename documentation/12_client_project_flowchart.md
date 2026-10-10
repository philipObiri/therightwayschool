# The RightWay Centre of Learning
## Full System Build — 12-Week Delivery Plan
### Client Presentation Document

---

> **Project**: Custom School Management System + Public Website
> **Duration**: 12 Weeks (3 Months) from Contract Signing
> **Delivery Method**: Agile sprints, weekly check-ins, live demo at each milestone
> **Support**: Transparent throughout — you see progress every week

---

## MASTER FLOWCHART

```
WEEK 0
  │
  ▼
╔══════════════════════════════════════════════════════════════╗
║  CONTRACT SIGNED & KICKOFF                                   ║
║  • Requirements sign-off                                     ║
║  • Branding assets collected (logo, colors, photos)          ║
║  • Server provisioned (Ubuntu VPS)                           ║
║  • Domain pointed & SSL certificate issued                   ║
║  • Development environment set up                            ║
╚══════════════════════════════════════════════════════════════╝
  │
  ▼
══════════════════════════════════════════════════════════════
  PHASE 1 — FOUNDATION & SECURITY          (Weeks 1 – 2)
══════════════════════════════════════════════════════════════
  │
  ├──▶ [Week 1]
  │      • Secure login system (email + password)
  │          Every staff member, teacher, student, and parent gets
  │          their own private login. No shared passwords.
  │
  │      • Role-based access control (13 roles)
  │          A teacher only sees their classes. A finance officer
  │          only sees fees. A parent only sees their child.
  │          Everyone gets exactly what they need — nothing more.
  │
  │      • Rate limiting — brute-force protection
  │          The system automatically blocks anyone who tries
  │          to guess passwords repeatedly.
  │
  │      • HTTPS on all endpoints
  │          All data between the school and the system is
  │          encrypted — like online banking.
  │
  ├──▶ [Week 2]
  │      • Database structure finalised
  │          All school data (students, grades, fees, staff)
  │          stored in a structured, searchable database.
  │
  │      • Multi-campus data isolation
  │          If you open a second campus later, each campus
  │          sees only their own data — completely separate.
  │
  │      • Automated daily database backup
  │          Every night, a full copy of all school data is
  │          saved automatically. Nothing is ever lost.
  │
  │      • Error logging & monitoring
  │          The system watches itself. If anything goes wrong,
  │          we are alerted before you even notice.
  │
  │   ✅ MILESTONE 1 — SECURITY REVIEW (End of Week 2)
  │      Client demo: Login, role switching, security report
  │
  ▼
══════════════════════════════════════════════════════════════
  PHASE 2 — CORE ACADEMIC SYSTEM           (Weeks 3 – 5)
══════════════════════════════════════════════════════════════
  │
  ├──▶ [Week 3]
  │      • Student registration & profiles
  │          Each student gets a digital profile: personal details,
  │          enrolment date, class, guardian contacts, medical notes,
  │          and a full academic history — all in one place.
  │
  │      • Staff registry
  │          Every teacher, administrator, HR officer, and support
  │          staff member has a profile with their role, department,
  │          qualifications, and employment record.
  │
  │      • Parent accounts & parent portal
  │          Parents get their own login to see their child's
  │          attendance, grades, and fee balance — in real time,
  │          from any phone or computer.
  │
  │      • Class & subject management
  │          Set up every class (Form 1A, Form 2B, etc.) and
  │          assign subjects and teachers to each. The system
  │          keeps track of who teaches what, to whom, and when.
  │
  │      • Academic term & timetable setup
  │          Configure your school year (terms, holidays, exam
  │          periods). The timetable module generates class
  │          schedules automatically, avoiding clashes.
  │
  ├──▶ [Week 4]
  │      • Lesson Plans & Assignments Module
  │          Teachers create lesson plans directly in the system —
  │          upload documents, write notes, attach resources.
  │          Students see their assignments with due dates and can
  │          submit work digitally. No more lost paper assignments.
  │
  │      • Gradebook
  │          The teacher's digital markbook. Enter marks for
  │          classwork, tests, and exams. The system automatically
  │          calculates each student's final grade using the
  │          school's weighting (e.g. Continuous Assessment 30%
  │          + Final Exam 70%). GPA and letter grades calculated
  │          instantly. No spreadsheets needed.
  │
  │      • Attendance Recording
  │          Teachers take attendance with one tap per student —
  │          daily or per class period. The system flags students
  │          with poor attendance automatically. Parents see
  │          their child's attendance record in their portal.
  │
  │      • Report Cards
  │          At the end of every term, the system generates
  │          professional PDF report cards for every student —
  │          showing all subjects, grades, attendance, and teacher
  │          comments. Print or email directly to parents.
  │
  │      • Student Promotion
  │          At year-end, approve which students move to the next
  │          form. The system updates all records automatically.
  │
  │      • Scheme of Work Editor
  │          Teachers plan their full term's teaching schedule —
  │          week by week, topic by topic — in a structured
  │          digital format. Management can review and approve
  │          schemes for every subject. Replaces the paper-based
  │          scheme of work entirely. An AI assistant can also
  │          review schemes and suggest improvements.
  │
  ├──▶ [Week 5]
  │      • Quiz & Assessment Engine
  │          Teachers create online quizzes and tests — multiple
  │          choice, short answer, or essay. Students complete
  │          them on any device. Results are marked and recorded
  │          in the gradebook automatically.
  │
  │      • Lecture / Video Module
  │          Teachers can host or link video lessons. Students
  │          watch at their own pace. Supports recorded lessons
  │          for students who were absent.
  │
  │      • Student Submissions & File Uploads
  │          Students upload completed assignments (Word docs,
  │          PDFs, images). Teachers download, review, and
  │          return them with marks and feedback — all in the
  │          system. No email chains needed.
  │
  │      • AI Lesson Plan Assistant
  │          A teacher types a topic (e.g. "Fractions — Grade 4")
  │          and the AI instantly drafts a full lesson plan:
  │          objectives, activities, resources, timing, and
  │          assessment ideas. The teacher reviews and saves it.
  │          Saves 30–60 minutes of planning per lesson.
  │
  │   ✅ MILESTONE 2 — ACADEMIC SYSTEM DEMO (End of Week 5)
  │      Client demo: Full academic workflow live
  │      (student enrolled → class → lesson → grade → report card)
  │
  ▼
══════════════════════════════════════════════════════════════
  PHASE 3 — OPERATIONS & COMMUNICATION     (Weeks 6 – 7)
══════════════════════════════════════════════════════════════
  │
  ├──▶ [Week 6]
  │      • Finance Module
  │          Generate invoices for school fees, uniforms, trips,
  │          and any other charges. Record payments. Issue
  │          receipts. Track outstanding balances per student.
  │          Finance officers see everything; parents see only
  │          their own account.
  │
  │      • Stripe Payment Gateway
  │          Parents can pay school fees online — by credit card,
  │          debit card, or bank transfer — directly from their
  │          parent portal. Payment reflects in the system
  │          instantly. No more manual bank confirmation.
  │
  │      • PDF Invoices & Receipts
  │          Every invoice and receipt is auto-generated as a
  │          professional PDF. Download or email to parents
  │          with one click.
  │
  │      • Finance Dashboard & Reports
  │          See total fees collected this term, outstanding
  │          balances, payment history, and financial summaries
  │          — all in one screen. Export to PDF or spreadsheet
  │          for your accountant.
  │
  │      • Payroll Management
  │          Record staff salaries, deductions, and allowances.
  │          Generate payslips and payroll summaries each month.
  │
  ├──▶ [Week 7]
  │      • Internal Messenger
  │          A built-in chat system — like WhatsApp but inside
  │          the school platform. Staff can message each other,
  │          teachers can message parents, group chats for
  │          departments. All communication stays within the
  │          school system — private and logged.
  │
  │      • Announcement Broadcasting
  │          The principal or admin sends a school-wide
  │          announcement and every staff member, teacher,
  │          student, and parent sees it instantly — with a
  │          push notification on their phone or browser.
  │
  │      • HR Module — Clock In/Out & Leave
  │          Staff clock in and out digitally — phone or
  │          computer. The system tracks hours worked and
  │          flags lateness automatically. Leave requests
  │          (sick leave, vacation) are submitted, reviewed,
  │          and approved inside the system. Full audit trail.
  │
  │      • Admissions Pipeline
  │          Manage every applicant from first enquiry to
  │          enrolled student through a clear digital workflow:
  │          Received → Reviewed → Interviewed → Accepted → Enrolled
  │          Nothing falls through the cracks. Each stage is
  │          tracked with notes and documents attached.
  │
  │      • Behaviour & Pastoral Care Tracking
  │          Log incidents, commendations, and pastoral notes
  │          for individual students. Build a clear picture of
  │          each student's conduct over time. Management and
  │          class teachers can both see the record.
  │
  │   ✅ MILESTONE 3 — OPERATIONS DEMO (End of Week 7)
  │      Client demo: Finance, messaging, admissions, HR live
  │
  ▼
══════════════════════════════════════════════════════════════
  PHASE 4 — PUBLIC WEBSITE + CMS           (Weeks 8 – 9)
══════════════════════════════════════════════════════════════
  │
  ├──▶ [Week 8]
  │      • Public Website — Single-page scrolling design
  │          A modern, mobile-friendly website for the school.
  │          Visitors scroll through all sections in one page:
  │          Hero banner → About the school → Programs
  │          (Nursery / KG / Primary) → Gallery → Testimonials
  │          → Events → FAQ → Contact Us.
  │          Designed with your school's branding, logo, colors,
  │          and real photos of your campus and children.
  │
  │      • WhatsApp Floating Widget
  │          A friendly button sits on every page of the website.
  │          Visitors click it to chat on WhatsApp, call the
  │          school, or send an email — right from the website.
  │
  │      • Google Map Embedded
  │          Your exact school location shown on an interactive
  │          map so parents can find you easily.
  │
  │      • Fully Mobile Responsive
  │          The website looks and works perfectly on phones,
  │          tablets, and desktop computers.
  │
  ├──▶ [Week 9]
  │      • CMS Admin Panel (Content Management System)
  │          You control the entire website yourself — no
  │          developer needed for updates. From inside your
  │          admin dashboard, change any text, swap any photo,
  │          add a news article, post an event, or update
  │          contact details. Changes appear on the website
  │          within seconds.
  │
  │      • Blog / News Section
  │          Publish school news, achievements, and updates.
  │          Each article has a title, photo, date, and full
  │          text. Visitors read them on the website. You
  │          write and publish directly from the dashboard.
  │
  │      • Events Calendar
  │          Post upcoming events — term dates, sports day,
  │          prize-giving, parent meetings, cultural events.
  │          Parents see what's coming up at a glance.
  │
  │      • Online Admissions Inquiry Form
  │          Interested parents fill in a form on the website.
  │          Their inquiry automatically appears inside your
  │          admissions pipeline — ready for the admissions
  │          officer to follow up. No emails to check.
  │
  │      • Testimonials Approval Workflow
  │          Parents submit reviews via the website. You review
  │          them in the dashboard and choose which ones to
  │          publish. Only approved testimonials appear on site.
  │
  │   ✅ MILESTONE 4 — WEBSITE LIVE (End of Week 9)
  │      Client demo: Full website + CMS walkthrough
  │      You edit content live on the call
  │
  ▼
══════════════════════════════════════════════════════════════
  PHASE 5 — AI FEATURES                   (Weeks 10 – 11)
══════════════════════════════════════════════════════════════
  │
  ├──▶ [Week 10]
  │      • TurboAI Student Tutor
  │          Every student gets a personal AI tutor available
  │          24 hours a day, 7 days a week. A student stuck on
  │          a Maths problem at 9pm types their question and
  │          gets a clear, step-by-step explanation — tailored
  │          to their subject and grade level. It never gets
  │          tired, never charges extra, and never judges.
  │
  │      • School Analytics Chatbot (Admin)
  │          Instead of building spreadsheets, the principal
  │          or admin types a plain question:
  │          "How many students failed Maths last term?"
  │          "What is the attendance rate for Form 3?"
  │          "Which teacher has the most outstanding schemes?"
  │          The system reads the live school data and answers
  │          instantly. Powerful insight — no IT skills needed.
  │
  ├──▶ [Week 11]
  │      • Public Admissions Chatbot (on website)
  │          A friendly AI assistant sits on the school website
  │          and answers questions from prospective parents
  │          any time of day or night:
  │          "What ages do you accept?"
  │          "What is the school fee?"
  │          "How do I apply?"
  │          When a parent is ready, the chatbot collects their
  │          name and contact and sends the inquiry directly
  │          into your admissions pipeline — automatically.
  │
  │      • AI Usage Dashboard
  │          Admin sees exactly how much each AI feature is
  │          being used and what it costs. Budget caps are in
  │          place so there are never surprise bills.
  │
  │   ✅ MILESTONE 5 — AI FEATURES DEMO (End of Week 11)
  │      Client demo: All 3 AI features live
  │
  ▼
══════════════════════════════════════════════════════════════
  PHASE 6 — TESTING, DEPLOYMENT & HANDOVER  (Week 12)
══════════════════════════════════════════════════════════════
  │
  ├──▶ [Week 12 — Days 1-3]
  │      • Full system testing (every module, every role)
  │          We test every button, every form, every workflow
  │          — as a student, as a teacher, as a parent, as admin.
  │          Nothing ships without being tested.
  │
  │      • Browser & device testing
  │          Tested on Chrome, Safari, Firefox, and mobile
  │          browsers (Android + iPhone).
  │
  │      • Load testing
  │          We simulate 200+ users on the system at once
  │          to confirm it handles a full school day without
  │          slowing down.
  │
  │      • All client feedback from weeks 1-11 implemented
  │          Every note you gave during the weekly demos is
  │          addressed before go-live.
  │
  │      • Final content populated
  │          Real student data, staff profiles, subjects,
  │          and term dates entered and verified.
  │
  ├──▶ [Week 12 — Days 4-5]
  │      • Staff training session
  │          Live walkthrough with your admin team, teachers,
  │          and finance officers. Everyone learns their section
  │          of the system. Questions answered in real time.
  │
  │      • Training video recordings delivered
  │          Every training session is recorded so new staff
  │          can watch and learn independently in the future.
  │
  │      • User manual handed over (PDF)
  │          A written guide covering every feature, with
  │          screenshots — kept simple and jargon-free.
  │
  │      • Full handover of credentials & server access
  │          You receive the server login, database access,
  │          admin credentials, and all documentation.
  │          You own everything.
  │
  │      • 30-day post-launch support begins
  │          We remain on call for 30 days after go-live.
  │          Any issue is fixed within 24 hours — free of charge.
  │
  │   ✅ MILESTONE 6 — SYSTEM GOES LIVE (End of Week 12)
  │
  ▼
╔══════════════════════════════════════════════════════════════╗
║  🎓 SYSTEM LIVE — THE RIGHTWAY CENTRE IS ONLINE              ║
║                                                              ║
║  Students enrolling. Parents paying fees. Teachers           ║
║  planning lessons. The whole school runs from one place.     ║
╚══════════════════════════════════════════════════════════════╝
  │
  ▼
══════════════════════════════════════════════════════════════
  POST-LAUNCH SUPPORT                     (Weeks 13 – 16)
══════════════════════════════════════════════════════════════
  │
  ├── Week 13-14: Daily check-ins, bug fixes within 24 hours
  ├── Week 15-16: Weekly check-ins, performance monitoring
  └── Month 4+:   Ongoing retainer or per-request support
```

---

## FEATURE GLOSSARY
### Plain-English Explanation of Every Module

| Feature | What It Does | Who Uses It |
|---------|-------------|-------------|
| **Student Registration** | Creates a full digital profile for each student — personal details, class, guardian contacts, photo, and academic history. All in one place, searchable in seconds. | Admin, Admissions Officers |
| **Staff Registry** | A complete digital record for every staff member — role, department, qualifications, contract, and employment dates. Replaces paper HR files. | HR Officers, Admin |
| **Timetable Generator** | Automatically builds the school's weekly class schedule. Assigns teachers to classes and periods without clashes. Updates instantly if anything changes. | Admin, Head Teacher |
| **Lesson Plans** | Teachers write and store their lesson plans digitally — attach files, notes, and resources. Management can review and give feedback. Replaces paper lesson plan books. | Teachers, Management |
| **Assignments** | Teachers set assignments with deadlines. Students see them in their portal and submit completed work online. Everything is timestamped and tracked. | Teachers, Students |
| **Gradebook** | The digital markbook. Teachers enter marks; the system calculates weighted averages, GPA, and letter grades automatically. No spreadsheets, no manual totalling. | Teachers, Admin |
| **Attendance Recording** | Teachers mark who is present or absent — one tap per student. The system tracks patterns over time and flags students at risk. Parents see their child's record live. | Teachers, Admin, Parents |
| **Report Cards** | Auto-generated at the end of every term. Professional PDF reports showing all subjects, grades, attendance, and teacher comments. Print or email to parents. | Admin, Teachers, Parents |
| **Scheme of Work** | Teachers plan their full term's teaching — topic by topic, week by week — in a structured digital format. Management approves it. The AI can review it and suggest improvements. Replaces paper scheme books. | Teachers, Head of Academics |
| **Quizzes & Assessments** | Teachers build online tests — multiple choice, short answer, essay. Students complete them on any device. Marks feed automatically into the gradebook. | Teachers, Students |
| **Lecture Module** | Teachers upload or link video lessons. Students watch recorded classes at any time — useful for catching up, revision, or distance learning. | Teachers, Students |
| **Admissions Pipeline** | Tracks every applicant from first inquiry to enrolled student through a clear workflow: Received → Reviewed → Interviewed → Accepted → Enrolled. No applications are lost or forgotten. | Admissions Officers, Admin |
| **Finance & Invoicing** | Generates fee invoices, records payments, issues receipts, and tracks outstanding balances — per student. Finance officers see the full picture; parents see only their account. | Finance Officers, Parents |
| **Stripe Payments** | Parents pay school fees online — card or bank transfer — from their phone or computer. Payment reflects instantly. No cash handling, no manual confirmation. | Parents, Finance Officers |
| **Payroll** | Records staff salaries, deductions, and allowances each month. Generates payslips and payroll summary reports for your accountant. | HR Officers, Finance Officers |
| **Internal Messenger** | A private chat system built into the platform — like WhatsApp but only for the school. Staff to staff, teacher to parent, group departments. Keeps all school communication in one secure place. | All Staff, Parents |
| **Announcements** | Admin or principal broadcasts a message to the whole school — or just to a specific group (e.g. only parents, only teachers). Everyone gets an instant notification. | Admin, Principal |
| **HR — Clock In/Out** | Staff clock in and out digitally. The system tracks hours, flags late arrivals, and produces attendance summaries. No punch cards needed. | All Staff, HR Officers |
| **Leave Management** | Staff submit leave requests (sick, vacation, personal) online. Supervisors review and approve or decline. The full leave record is maintained automatically. | All Staff, HR Officers |
| **Behaviour Tracking** | Log conduct incidents and commendations for individual students. Build a clear pastoral record over time. Both class teachers and management can add notes and view history. | Teachers, Management |
| **Public Website** | A professional, mobile-friendly school website. Parents and the public see your programs, gallery, events, news, and contact details. Designed with your brand and photos. | Public, Prospective Parents |
| **CMS (Content Manager)** | You control every word and image on the website — no developer needed. Log into your dashboard, make a change, and it appears on the website in seconds. | Admin, Principal |
| **Online Admissions Form** | Prospective parents fill in an inquiry form on the website. It lands automatically in your admissions pipeline — ready for follow-up. No emails to sort through. | Prospective Parents, Admissions Officers |
| **TurboAI Student Tutor** | An AI tutor available 24/7. Students ask questions on any subject in plain language and get clear, grade-appropriate explanations. Like having a private tutor available at midnight. | Students |
| **AI Lesson Plan Assistant** | Teacher types a topic and grade — the AI instantly writes a full lesson plan with objectives, activities, timing, and resources. Teacher reviews, edits, and saves. Cuts planning time by half. | Teachers |
| **School Analytics Chatbot** | Admin types a plain English question about the school — the AI reads live school data and answers immediately. No reports, no spreadsheets, no waiting. | Admin, Principal, CEO |
| **Admissions Chatbot** | An AI assistant on the school website answers questions from prospective parents 24/7. When a parent is ready to apply, the chatbot captures their details and sends the inquiry into the admissions pipeline automatically. | Prospective Parents |
| **Push Notifications** | The system sends real-time alerts to phones and computers — new messages, assignment deadlines, fee reminders, school announcements. No app download needed. | All Users |
| **Parent Portal** | Parents log in from any device to see their child's grades, attendance, fee balance, assignments, and messages from teachers — all in real time. | Parents |

---

## CALENDAR OVERVIEW

| Week | Phase | Key Deliverable |
|------|-------|-----------------|
| 0 | Kickoff | Server live, domain configured |
| 1 | Security | Secure login & roles working |
| 2 | Security | Full security review ✅ |
| 3 | Academic | Students, staff, classes set up |
| 4 | Academic | Gradebook, attendance, report cards, scheme of work |
| 5 | Academic | Quizzes, lectures, AI lesson plans ✅ |
| 6 | Operations | Finance, invoices, Stripe payments |
| 7 | Operations | Messenger, HR, admissions, behaviour ✅ |
| 8 | Website | Public website live |
| 9 | Website | CMS — you control all content ✅ |
| 10 | AI | TurboAI tutor, school analytics chatbot |
| 11 | AI | Admissions chatbot, final AI testing ✅ |
| 12 | Launch | Testing → Training → Go-Live ✅ |

---

## WHAT YOU WILL HAVE AT GO-LIVE

### For Students
- Personal dashboard with timetable, lessons, and assignments
- AI Tutor available 24/7 for homework help on any subject
- View grades, report cards, and attendance record in real time
- Submit assignments digitally — no printing required

### For Teachers
- Digital lesson planner with AI drafting assistant
- Gradebook with automatic GPA and grade calculation
- Attendance recording — one tap per student, per class
- Internal chat with colleagues and parents
- Scheme of work editor reviewed by management

### For Parents
- Real-time view of their child's grades and attendance
- Online fee payment — card or bank transfer (Stripe)
- Direct chat with class teachers
- Instant notifications for school announcements and messages

### For Admin & Finance
- Complete student admissions and registration pipeline
- Invoice generation, payment tracking, and receipts
- Financial reports and payroll summaries (PDF export)
- Full HR records — leave, clock-in/out, staff profiles
- Natural language analytics — ask questions, get answers

### For the Public (Website)
- A professional school website with your real photos and branding
- Online admissions inquiry — goes straight into your system
- 24/7 AI chatbot answers admissions questions automatically
- Events calendar, news/blog, gallery, FAQ section
- You update every word yourself — no developer needed

---

## WEEKLY CHECK-IN STRUCTURE

Every week throughout the project:

```
MONDAY          WEDNESDAY          FRIDAY
   │                 │                │
Review what      Mid-week         Weekly demo
was built        progress         (30 min video
this week        check-in         call with you)
                 (async update    You approve or
                 via WhatsApp     request changes
                 or email)        before next week
```

---

## TRANSPARENCY COMMITMENTS

| What | How |
|------|-----|
| **Progress** | Weekly video demo — you see everything working |
| **Code** | Stored in private GitHub repository — you own it |
| **Server access** | You have full root access to your own server |
| **Data** | Your data, your database — full export anytime |
| **Changes** | Feedback from every demo implemented before next milestone |
| **Pricing** | Fixed price per phase — no surprise invoices |
| **Support** | WhatsApp/email response within 4 business hours |

---

## WHAT WE NEED FROM YOU

To hit the 12-week deadline we need these delivered on time:

| Item | Needed By |
|------|-----------|
| School logo (PNG or SVG) | Week 0 |
| Brand colors (if specific) | Week 0 |
| School photos (campus, children, teachers) | Week 1 |
| Staff list (names, roles, emails) | Week 2 |
| Subject list & class structure | Week 2 |
| Stripe account details | Week 5 |
| Domain name & registrar access | Week 7 |
| Website text (About Us, Mission, Programs) | Week 7 |
| Testimonials from parents (if available) | Week 8 |
| Approval of each milestone demo | Within 48 hours of demo |

---

## RISK & MITIGATION

| Risk | How We Handle It |
|------|-----------------|
| Content delivered late | System built with placeholder content; real content swapped in at the end |
| Change requests mid-project | Minor changes absorbed; major scope additions = timeline + cost review |
| Server downtime | Automatic restart via Supervisor; we are alerted before you notice |
| AI cost overrun | Daily budget caps on every AI feature; admin dashboard shows live usage |
| Data loss | Daily automated backups with tested restore procedure |

---

## AFTER LAUNCH — WHAT'S NEXT

The system is built to grow with you:

- **Year 1**: Add more campuses (one system, multiple schools)
- **Year 1**: Mobile app (iOS + Android) using the same backend
- **Year 2**: Advanced analytics and predictive attendance reporting
- **Year 2**: Online live class booking and video lesson delivery
- **Ongoing**: New features added each term as the school grows

---

*Document prepared by: Philip Obiri — Full-Stack Developer*
*Project: The RightWay Centre of Learning — School Management System*
*Date: May 2026*
