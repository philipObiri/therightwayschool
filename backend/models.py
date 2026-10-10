from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


def gen_id(prefix=""):
    return f"{prefix}{uuid.uuid4().hex[:12]}"


# ─── Auth Models ───
class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str = "Student"
    phone: str = ""
    department: str = ""

class UserLogin(BaseModel):
    email: str
    password: str

class SessionExchange(BaseModel):
    session_id: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    role: str
    picture: str = ""
    phone: str = ""
    department: str = ""
    is_active: bool = True
    created_at: str = ""

class TokenResponse(BaseModel):
    token: str
    user: UserResponse


class AuthResponse(BaseModel):
    """Login/register response — token is in the httpOnly cookie, not the body."""
    user: UserResponse


# ─── Academic Models ───
class SubjectCreate(BaseModel):
    name: str
    code: str
    department: str = ""
    year_groups: List[str] = []

class SubjectResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    subject_id: str
    name: str
    code: str
    department: str = ""
    year_groups: List[str] = []

class ClassCreate(BaseModel):
    name: str
    year_group: str
    form_teacher_id: str = ""
    subject_ids: List[str] = []

class ClassResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    class_id: str
    name: str
    year_group: str
    form_teacher_id: str = ""
    subject_ids: List[str] = []
    student_count: int = 0

class TimetableEntryCreate(BaseModel):
    class_id: str
    subject_id: str
    teacher_id: str
    day: str
    period: int
    start_time: str
    end_time: str

class TimetableEntryResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    entry_id: str
    class_id: str
    subject_id: str
    teacher_id: str
    day: str
    period: int
    start_time: str
    end_time: str
    subject_name: str = ""
    teacher_name: str = ""
    class_name: str = ""


# ─── Student Models ───
class StudentCreate(BaseModel):
    name: str
    email: str
    admission_number: str = ""
    class_id: str = ""
    year_group: str = ""
    boarding_status: str = "day"
    date_of_birth: str = ""
    guardian_ids: List[str] = []
    phone: str = ""

class StudentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    student_id: str = ""
    name: str
    email: str
    admission_number: str = ""
    class_id: str = ""
    class_name: str = ""
    year_group: str = ""
    boarding_status: str = "day"
    date_of_birth: str = ""
    is_active: bool = True


# ─── LMS Models ───
class LessonCreate(BaseModel):
    title: str
    description: str = ""
    subject_id: str
    class_ids: List[str] = []
    lesson_type: str = "text"  # video, pdf, text, link, live_session
    content_url: str = ""
    content_text: str = ""
    thumbnail_url: str = ""
    tags: List[str] = []
    published: bool = False

class LessonResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lesson_id: str
    title: str
    description: str = ""
    subject_id: str
    subject_name: str = ""
    class_ids: List[str] = []
    teacher_id: str
    teacher_name: str = ""
    lesson_type: str = "text"
    content_url: str = ""
    content_text: str = ""
    thumbnail_url: str = ""
    tags: List[str] = []
    published: bool = False
    created_at: str = ""


# ─── Assignment Models ───
class AssignmentCreate(BaseModel):
    title: str
    description: str = ""
    subject_id: str
    class_ids: List[str] = []
    due_date: str = ""
    max_score: int = 100
    attachments: List[str] = []
    published: bool = False

class AssignmentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    assignment_id: str
    title: str
    description: str = ""
    subject_id: str
    subject_name: str = ""
    class_ids: List[str] = []
    teacher_id: str
    teacher_name: str = ""
    due_date: str = ""
    max_score: int = 100
    attachments: List[str] = []
    published: bool = False
    submission_count: int = 0
    created_at: str = ""

class SubmissionCreate(BaseModel):
    content: str = ""
    file_url: str = ""

class SubmissionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    submission_id: str
    assignment_id: str
    student_id: str
    student_name: str = ""
    content: str = ""
    file_url: str = ""
    submitted_at: str = ""
    grade: Optional[float] = None
    feedback: str = ""
    graded_by: str = ""
    graded_at: str = ""

class GradeSubmission(BaseModel):
    grade: float
    feedback: str = ""


# ─── Attendance Models ───
class AttendanceRecord(BaseModel):
    student_id: str
    status: str = "present"  # present, absent, late
    note: str = ""

class AttendanceCreate(BaseModel):
    class_id: str
    date: str
    period: str = "1"
    records: List[AttendanceRecord] = []

class AttendanceResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    record_id: str
    class_id: str
    class_name: str = ""
    date: str
    period: str = "1"
    teacher_id: str
    teacher_name: str = ""
    records: List[Dict] = []
    created_at: str = ""


# ─── Finance Models ───
class InvoiceItem(BaseModel):
    description: str
    amount: float

class InvoiceCreate(BaseModel):
    student_id: str
    term: str = ""
    academic_year: str = ""
    items: List[InvoiceItem] = []
    due_date: str = ""

class InvoiceResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    invoice_id: str
    student_id: str
    student_name: str = ""
    term: str = ""
    academic_year: str = ""
    items: List[Dict] = []
    total: float = 0
    paid: float = 0
    balance: float = 0
    status: str = "pending"
    due_date: str = ""
    created_at: str = ""

class PaymentCreate(BaseModel):
    invoice_id: str
    amount: float
    method: str = "cash"  # cash, bank, momo, card
    reference: str = ""

class PaymentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    payment_id: str
    invoice_id: str
    student_id: str
    student_name: str = ""
    amount: float
    method: str = "cash"
    reference: str = ""
    recorded_by: str = ""
    recorded_by_name: str = ""
    created_at: str = ""


# ─── Mail Models ───
class MailCreate(BaseModel):
    to_user_ids: List[str]
    subject: str
    body: str
    attachments: List[str] = []

class MailResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    message_id: str
    from_user_id: str
    from_name: str = ""
    to_user_ids: List[str] = []
    to_names: List[str] = []
    subject: str
    body: str
    attachments: List[str] = []
    read_by: List[str] = []
    created_at: str = ""


# ─── Task Models ───
class TaskCreate(BaseModel):
    title: str
    description: str = ""
    assigned_to: str
    priority: str = "medium"  # low, medium, high
    due_date: str = ""

class TaskUpdate(BaseModel):
    status: str  # todo, in_progress, submitted, approved
    comment: str = ""

class TaskResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    task_id: str
    title: str
    description: str = ""
    assigned_to: str
    assigned_to_name: str = ""
    assigned_by: str
    assigned_by_name: str = ""
    priority: str = "medium"
    status: str = "todo"
    due_date: str = ""
    comments: List[Dict] = []
    created_at: str = ""


# ─── Audit Log ───
class AuditLogResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str
    user_id: str
    user_name: str = ""
    action: str
    entity_type: str
    entity_id: str = ""
    details: Dict = {}
    timestamp: str = ""


# ─── Dashboard Stats ───
class DashboardStats(BaseModel):
    total_students: int = 0
    total_teachers: int = 0
    total_staff: int = 0
    total_classes: int = 0
    total_subjects: int = 0
    total_lessons: int = 0
    total_assignments: int = 0
    total_invoices: int = 0
    total_payments: float = 0
    outstanding_fees: float = 0
    attendance_rate: float = 0
    recent_activities: List[Dict] = []


# ─── Enhanced Task Models ───
class TaskCreateEnhanced(BaseModel):
    title: str
    description: str = ""
    task_type: str = "Operations"  # Academic, Finance, HR, Operations, IT, Student Support
    assigned_to: str = ""
    assigned_role: str = ""
    department: str = ""
    priority: str = "medium"  # low, medium, high, critical
    due_date: str = ""
    start_date: str = ""
    estimated_minutes: int = 0
    acceptance_criteria: str = ""
    confidentiality: str = "public"  # public, restricted, leadership
    tags: List[str] = []
    checklist: List[str] = []
    approvers: List[str] = []
    sla_hours: int = 0

class TaskTimeAction(BaseModel):
    action: str  # start, pause, resume, stop

class TaskTimeManual(BaseModel):
    duration_minutes: int
    reason: str = ""

class TaskSubmitAction(BaseModel):
    comment: str = ""
    evidence: List[str] = []

class TaskApproveAction(BaseModel):
    approved: bool = True
    feedback: str = ""
    quality_rating: int = 0  # 1-5
    timeliness_rating: int = 0  # 1-5


# ─── HR Models ───
class ClockAction(BaseModel):
    action: str  # clock_in, clock_out
    method: str = "manual"  # manual, qr, pin

class LeaveRequestCreate(BaseModel):
    leave_type: str = "annual"  # annual, sick, personal, maternity, other
    start_date: str
    end_date: str
    reason: str = ""

class LeaveApproval(BaseModel):
    approved: bool
    comment: str = ""


# ─── Teacher Monitoring Models ───
class LessonPlanCreate(BaseModel):
    subject_id: str
    class_id: str
    week: str
    topic: str
    objectives: str = ""
    activities: str = ""
    resources: str = ""
    assessment: str = ""

class ObservationCreate(BaseModel):
    teacher_id: str
    class_id: str
    subject_id: str
    date: str
    strengths: str = ""
    areas_for_improvement: str = ""
    rating: int = 3  # 1-5
    recommendations: str = ""


# ─── Finance Ledger Models ───
class LedgerAccountCreate(BaseModel):
    name: str
    code: str
    account_type: str = "income"  # income, expense, asset, liability, equity
    description: str = ""

class JournalEntryCreate(BaseModel):
    date: str
    description: str
    debit_account: str
    credit_account: str
    amount: float
    reference: str = ""


# ─── Live Classes ───
class LiveSessionCreate(BaseModel):
    title: str
    class_id: str = ""
    subject_id: str = ""
    scheduled_at: str = ""
    duration_minutes: int = 45
    description: str = ""

class AnnouncementCreate(BaseModel):
    title: str
    body: str
    target: str = "all"  # all, staff, students, year_group, department
    target_id: str = ""
    priority: str = "normal"  # normal, important, urgent
