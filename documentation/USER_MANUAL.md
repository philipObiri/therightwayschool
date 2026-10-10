# User Manual — RightWay Centre of Learning Management Workstation

> **URL (production):** https://learnrightschool.com/login  
> **URL (development):** http://localhost:3000/login

---

## Table of Contents

1. [Logging In](#1-logging-in)
2. [Role Overview](#2-role-overview)
3. [CEO / SuperAdmin](#3-ceo--superadmin)
4. [Principal](#4-principal)
5. [Head Teacher](#5-head-teacher)
6. [Admin](#6-admin)
7. [Teacher](#7-teacher)
8. [Finance Officer](#8-finance-officer)
9. [HR Officer](#9-hr-officer)
10. [Parent](#10-parent)
11. [Student](#11-student)
12. [Seeded Demo Accounts](#12-seeded-demo-accounts)

---

## 1. Logging In

1. Navigate to the login page
2. Enter your **Email** and **Password**
3. Click **Sign in**
4. You are redirected automatically to the dashboard for your role

### Google Login
Click **Continue with Google** to sign in with a Google account. On first login, an account is created automatically with the **Student** role. An admin can change the role from the Users panel.

### Forgot Password
Contact your school administrator to reset your password. Admins can update passwords from **Dashboard → Users → Edit User**.

---

## 2. Role Overview

| Role | Dashboard Route | What They Can Do |
|------|----------------|-----------------|
| CEO / Founder | `/admin/dashboard` | Everything — full system access, final approval authority |
| SuperAdmin | `/admin/dashboard` | System configuration, all modules, user management |
| Principal | `/admin/dashboard` | Academic oversight, approve lessons/schemes, student reports |
| Head Teacher | `/admin/dashboard` | Teaching coordination, approvals, academic schedules |
| Admin | `/admin/dashboard` | Users, admissions, calendar, announcements, general admin |
| Teacher | `/teacher/dashboard` | Lessons, assignments, gradebook, attendance, schemes |
| Finance Officer | `/admin/finance` | Invoices, payments, receipts, financial reports |
| HR Officer | `/admin/hr` | Staff records, CPD, leave, HR reports |
| Parent | `/parent/home` | Child's grades, attendance, invoices, messages |
| Student | `/student/home` | Lessons, assignments, timetable, grades, messages |

---

## 3. CEO / SuperAdmin

**Login:** ceo@rightway.demo / ceo123  
**Login:** superadmin@rightway.demo / superadmin123

### Dashboard Overview
The admin dashboard shows real-time stats: total students, active staff, pending approvals, recent activity.

### User Management
`Dashboard → Users`
- **Create user:** Click **+ Add User**, fill in name, email, role, and temporary password
- **Edit user:** Click the user row → edit fields → Save
- **Deactivate user:** Toggle the Active switch — the user cannot log in but data is preserved
- **Change role:** Edit user → change the Role dropdown → Save

### Approval Workflow
As CEO/Founder you sit at the top of the approval chain:
1. Teachers submit lessons and schemes of work
2. Head of Academics reviews → approves or returns
3. Principal reviews → approves or returns  
4. CEO gives final approval

`Dashboard → Approvals` shows all pending items across the school.

### Finance Overview
`Dashboard → Finance`
- View income summary, outstanding fees, recent transactions
- Generate financial reports (PDF export available)
- Configure fee structures and billing cycles

### Website CMS
`Dashboard → Website`
- Edit hero slides, programmes, testimonials, blog posts, events
- Update school contact info, social media links, Google Maps embed
- Approve parent testimonials before they appear on the public site

### System Settings
`Dashboard → Settings`
- Set the active academic term and year
- Configure SMTP email settings
- Manage announcement banners
- View audit logs for all user actions

---

## 4. Principal

**Login:** principal@rightway.demo / principal123

### Academic Oversight
`Dashboard → Academic`
- View all classes, subjects, and teacher assignments
- Monitor lesson completion rates per class
- Review schemes of work submitted by department heads

### Approvals
`Dashboard → Approvals`
- Review lessons and schemes approved by the Head Teacher
- Approve or return with comments before it proceeds to CEO

### Student Reports
`Dashboard → Students`
- View individual student profiles: grades, attendance, behaviour records
- Generate end-of-term report cards (PDF)

### Announcements
`Dashboard → Announcements`
- Post school-wide announcements visible to all staff, students, and parents
- Schedule announcements for a future date

---

## 5. Head Teacher

**Login:** headteacher@rightway.demo / headteacher123

### Teaching Coordination
`Dashboard → Timetable`
- View the master timetable for all classes and teachers
- Identify clashes or free periods

### Lesson Approvals
`Dashboard → Approvals`
- First reviewer in the chain — lessons submitted by teachers land here
- Approve (passes to Principal) or Return (sends back to teacher with comments)

### CPD Management
`Dashboard → CPD`
- Record continuing professional development sessions for teachers
- Track hours completed per staff member against annual targets

---

## 6. Admin

**Login:** admin@rightway.demo / admin123

### Admissions
`Dashboard → Admissions`
- View and process new student applications submitted via the public website
- Accept or reject applications, send acceptance emails
- Enrol accepted students: creates student account and links to class

### Calendar
`Dashboard → Calendar`
- Create school events, term dates, exam schedules, public holidays
- Events appear in the parent and student portals

### Announcements
`Dashboard → Announcements`
- Post notices targeting specific roles (all staff, all parents, specific class)

### Receptionist Features
`Dashboard → Receptionist`
- Log visitor arrivals and departures
- Record student late arrivals and early departures
- Print visitor passes

### Knowledge Base
`Dashboard → Knowledge Base`
- Manage FAQ articles visible to staff and parents
- Organise by category

---

## 7. Teacher

**Login:** edmund@rightway.demo / teacher123

### Lessons
`Dashboard → Lessons`
- **Create lesson:** Click **+ New Lesson**, select subject/class, add content (text, video URL, or upload PDF)
- **Submit for approval:** Toggle lesson status to "Submitted" — it enters the approval chain
- **Edit draft:** Lessons in Draft status can be freely edited
- Approved lessons are visible to students in their portal

### Assignments
`Dashboard → Assignments`
- Create assignments with title, description, due date, and max score
- Students submit via their portal; submissions appear in your queue
- Grade each submission (0–100), add written feedback
- Grades flow automatically to the gradebook

### Attendance
`Dashboard → Attendance`
- Select a class and date, mark each student: Present / Absent / Late / Excused
- Attendance history is visible to parents and the admin

### Gradebook
`Dashboard → Gradebook`
- View cumulative grades per student across all assignments
- Configure grade weightings (e.g., Coursework 40%, Exam 60%)
- Export grade sheets as CSV or PDF

### Schemes of Work
`Dashboard → Schemes`
- Create term-long teaching plans per subject
- Specify weekly topics, resources, and learning objectives
- Submit for Head Teacher → Principal → CEO approval

### Timetable
`Dashboard → Timetable`
- View your personal teaching schedule for the week
- Click a period to see class details

### Quiz
`Dashboard → Quiz`
- Create MCQ quizzes manually or use AI generation (requires Anthropic API key)
- Set time limits, question shuffling, and attempt limits
- Students take quizzes in their portal; scores are recorded automatically

### Chat
`Dashboard → Messages`
- Direct messages with students, parents, and colleagues
- Create group chats for class or subject groups
- Supports emoji reactions and file attachments

---

## 8. Finance Officer

**Login:** finance@rightway.demo / finance123

### Invoices
`Dashboard → Finance → Invoices`
- **Create invoice:** Select student, add line items (tuition, fees, etc.), set due date
- Invoices are emailed automatically to the linked parent
- View outstanding, paid, and overdue invoices

### Record Payments
`Dashboard → Finance → Payments`
- Record cash or bank transfer payments against an invoice
- Partial payments supported — invoice status updates to "Partial"
- Generate official receipt (PDF) for each payment

### Finance Reports
`Dashboard → Finance → Reports`
- Income summary by month / term / year
- Outstanding debtors report
- Export all reports to PDF

### Petty Cash
`Dashboard → Finance → Petty Cash`
- Log petty cash expenditures with description and receipt reference
- Petty cash balance is reconciled against opening float

### Accounting
`Dashboard → Finance → Accounting`
- Double-entry bookkeeping — chart of accounts, journal entries
- General ledger and trial balance
- All invoice and payment transactions post automatically as journal entries

---

## 9. HR Officer

**Login:** hr@rightway.demo / hr123

### Staff Directory
`Dashboard → HR → Staff`
- View all staff with employment details: department, start date, contract type
- Add or edit staff records

### CPD Tracking
`Dashboard → HR → CPD`
- View CPD hours per teacher against the annual target
- Export CPD completion report

### Leave Management
`Dashboard → HR → Leave`
- Approve or reject leave requests submitted by staff
- View the leave calendar to spot coverage gaps

---

## 10. Parent

**Login:** parent@rightway.demo / parent123

### Child Overview
The parent portal shows a summary for each linked child:
- Current grades per subject
- Recent attendance (present/absent %)
- Outstanding fees

### Grades
`Portal → Grades`
- View grades for each assignment and quiz
- See the overall grade for each subject
- Download end-of-term report card when published by admin

### Attendance
`Portal → Attendance`
- Monthly attendance calendar — green = Present, red = Absent, yellow = Late
- Contact the school if you believe a record is incorrect

### Finance
`Portal → Finance`
- View all outstanding invoices
- Download official receipts for paid invoices
- Pay online via Stripe (if configured by the school)

### Messages
`Portal → Messages`
- Send messages directly to your child's class teacher
- Receive announcements from the school administration

---

## 11. Student

**Login:** student@rightway.demo / student123

### My Lessons
`Portal → Lessons`
- Access all lessons published by your teachers
- Read text content, watch embedded videos, or download PDF materials

### My Assignments
`Portal → Assignments`
- View upcoming and past assignments with due dates
- Submit work: type a response or upload a file (PDF, DOC, image)
- See your grade and teacher feedback once marked

### Timetable
`Portal → Timetable`
- View your weekly class schedule
- Room and teacher details shown for each period

### Grades
`Portal → Grades`
- Track your performance per subject across all assignments

### Quizzes
`Portal → Quizzes`
- Take timed quizzes assigned by your teacher
- Results are shown immediately after submission

### Messages
`Portal → Messages`
- Chat directly with your teachers

---

## 12. Seeded Demo Accounts

Use these accounts to explore every module without setting up real data.

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| CEO | ceo@rightway.demo | ceo123 | Full access, final approver |
| SuperAdmin | superadmin@rightway.demo | superadmin123 | System settings access |
| Principal | principal@rightway.demo | principal123 | Second-stage approver |
| Head Teacher | headteacher@rightway.demo | headteacher123 | First-stage approver |
| Admin | admin@rightway.demo | admin123 | Admissions, calendar, users |
| Teacher | edmund@rightway.demo | teacher123 | All classroom features |
| Finance Officer | finance@rightway.demo | finance123 | Finance & accounting |
| HR Officer | hr@rightway.demo | hr123 | Staff & CPD tracking |
| Parent | parent@rightway.demo | parent123 | Parent portal |
| Student | student@rightway.demo | student123 | Student portal |

> These accounts are created by running `python seed_admin.py` in the backend directory.  
> See [BACKEND_SETUP.md](./BACKEND_SETUP.md) for full setup instructions.
