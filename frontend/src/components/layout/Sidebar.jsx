import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import api from '../../lib/api';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList,
  Calendar, DollarSign, Mail, ListTodo, Shield, Settings, ChevronLeft,
  ChevronRight, X, BookMarked, FileText, UserCheck, BarChart3, Home,
  Video, Briefcase, Eye, Megaphone, Clock, Award, AlertTriangle, CheckCircle, Zap, FolderOpen, BellRing,
  BedDouble, UserPlus, FileStack, MessageSquare, PenSquare, TrendingUp, MessagesSquare, CalendarClock, Presentation,
  ArrowUpCircle, Building, HeartHandshake, UploadCloud, Globe
} from 'lucide-react';

const navConfig = {
  Admin: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Analytics', icon: TrendingUp, path: '/admin/analytics' },
    { label: 'Students', icon: GraduationCap, path: '/admin/students' },
    { label: 'Parents', icon: Users, path: '/admin/parents' },
    { label: 'Staff', icon: Users, path: '/admin/staff' },
    { label: 'Academics', icon: BookMarked, path: '/admin/academics' },
    { label: 'Timetable', icon: CalendarClock, path: '/admin/timetable' },
    { label: 'Finance', icon: DollarSign, path: '/admin/finance' },
    { label: 'Accounting', icon: BookMarked, path: '/admin/accounting' },
    { label: 'HR & Staff', icon: Briefcase, path: '/admin/hr' },
    { label: 'Monitoring', icon: Eye, path: '/admin/monitoring' },
    { label: 'Lessons', icon: BookOpen, path: '/admin/lessons' },
    { label: 'Assignments', icon: ClipboardList, path: '/admin/assignments' },
    { label: 'Attendance', icon: UserCheck, path: '/admin/attendance' },
    { label: 'Live Classes', icon: Video, path: '/live' },
    { label: 'Workstation', icon: FileStack, path: '/working-paper' },
    { label: 'Scheme of Work', icon: PenSquare, path: '/scheme-of-work' },
    { label: 'Lectures', icon: Presentation, path: '/lectures' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Discussions', icon: MessagesSquare, path: '/discussions' },
    { label: 'Tasks', icon: ListTodo, path: '/tasks' },
    { label: 'Gradebook', icon: BarChart3, path: '/admin/gradebook' },
    { label: 'Score Entry', icon: BarChart3, path: '/admin/scores' },
    { label: 'Report Cards', icon: FileText, path: '/admin/report-cards' },
    { label: 'CPD & Reviews', icon: Award, path: '/admin/cpd' },
    { label: 'Boarding', icon: BedDouble, path: '/admin/boarding' },
    { label: 'Admissions', icon: UserPlus, path: '/admin/admissions' },
    { label: 'Bulk Upload', icon: UploadCloud, path: '/admin/bulk-upload' },
    { label: 'Promotion', icon: ArrowUpCircle, path: '/admin/student-promotion' },
    { label: 'Almond Guest House', icon: Building, path: '/guesthouse' },
    { label: 'Concerns & Boosters', icon: HeartHandshake, path: '/admin/booster-concerns' },
    { label: 'Remarks', icon: Megaphone, path: '/remarks' },
    { label: 'Website', icon: Globe, path: '/admin/website' },
    { label: 'Audit Logs', icon: Shield, path: '/admin/audit-logs' },
  ],
  SuperAdmin: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Analytics', icon: TrendingUp, path: '/admin/analytics' },
    { label: 'Students', icon: GraduationCap, path: '/admin/students' },
    { label: 'Parents', icon: Users, path: '/admin/parents' },
    { label: 'Staff', icon: Users, path: '/admin/staff' },
    { label: 'Academics', icon: BookMarked, path: '/admin/academics' },
    { label: 'Timetable', icon: CalendarClock, path: '/admin/timetable' },
    { label: 'Finance', icon: DollarSign, path: '/admin/finance' },
    { label: 'HR & Staff', icon: Briefcase, path: '/admin/hr' },
    { label: 'Accounting', icon: BookMarked, path: '/admin/accounting' },
    { label: 'Monitoring', icon: Eye, path: '/admin/monitoring' },
    { label: 'Lessons', icon: BookOpen, path: '/admin/lessons' },
    { label: 'Assignments', icon: ClipboardList, path: '/admin/assignments' },
    { label: 'Attendance', icon: UserCheck, path: '/admin/attendance' },
    { label: 'Live Classes', icon: Video, path: '/live' },
    { label: 'Workstation', icon: FileStack, path: '/working-paper' },
    { label: 'Scheme of Work', icon: PenSquare, path: '/scheme-of-work' },
    { label: 'Lectures', icon: Presentation, path: '/lectures' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Discussions', icon: MessagesSquare, path: '/discussions' },
    { label: 'Tasks', icon: ListTodo, path: '/tasks' },
    { label: 'Gradebook', icon: BarChart3, path: '/admin/gradebook' },
    { label: 'Report Cards', icon: FileText, path: '/admin/report-cards' },
    { label: 'CPD & Reviews', icon: Award, path: '/admin/cpd' },
    { label: 'AI Test Gen', icon: Zap, path: '/admin/ai-test' },
    { label: 'Boarding', icon: BedDouble, path: '/admin/boarding' },
    { label: 'Admissions', icon: UserPlus, path: '/admin/admissions' },
    { label: 'Bulk Upload', icon: UploadCloud, path: '/admin/bulk-upload' },
    { label: 'Promotion', icon: ArrowUpCircle, path: '/admin/student-promotion' },
    { label: 'Announcements', icon: BellRing, path: '/admin/announcements' },
    { label: 'Almond Guest House', icon: Building, path: '/guesthouse' },
    { label: 'Reception Billing', icon: ClipboardList, path: '/receptionist/billing' },
    { label: 'Reception Messages', icon: MessageSquare, path: '/receptionist/messages' },
    { label: 'Reception Inventory', icon: FolderOpen, path: '/receptionist/inventory' },
    { label: 'Concerns & Boosters', icon: HeartHandshake, path: '/admin/booster-concerns' },
    { label: 'Remarks', icon: Megaphone, path: '/remarks' },
    { label: 'Website', icon: Globe, path: '/admin/website' },
    { label: 'Audit Logs', icon: Shield, path: '/admin/audit-logs' },
  ],
  CEO: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Analytics', icon: TrendingUp, path: '/admin/analytics' },
    { label: 'Lesson Approvals', icon: CheckCircle, path: '/admin/lesson-approvals' },
    { label: 'Report Cards', icon: FileText, path: '/admin/report-cards' },
    { label: 'Student Logins', icon: Shield, path: '/admin/student-credentials' },
    { label: 'Behaviour', icon: AlertTriangle, path: '/admin/behaviour' },
    { label: 'Students', icon: GraduationCap, path: '/admin/students' },
    { label: 'Parents', icon: Users, path: '/admin/parents' },
    { label: 'Staff', icon: Users, path: '/admin/staff' },
    { label: 'Academics', icon: BookMarked, path: '/admin/academics' },
    { label: 'Timetable', icon: CalendarClock, path: '/admin/timetable' },
    { label: 'Finance', icon: DollarSign, path: '/admin/finance' },
    { label: 'Accounting', icon: BookMarked, path: '/admin/accounting' },
    { label: 'HR & Staff', icon: Briefcase, path: '/admin/hr' },
    { label: 'Monitoring', icon: Eye, path: '/admin/monitoring' },
    { label: 'Lessons', icon: BookOpen, path: '/admin/lessons' },
    { label: 'Assignments', icon: ClipboardList, path: '/admin/assignments' },
    { label: 'Attendance', icon: UserCheck, path: '/admin/attendance' },
    { label: 'Live Classes', icon: Video, path: '/live' },
    { label: 'Workstation', icon: FileStack, path: '/working-paper' },
    { label: 'Scheme of Work', icon: PenSquare, path: '/scheme-of-work' },
    { label: 'Lectures', icon: Presentation, path: '/lectures' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Discussions', icon: MessagesSquare, path: '/discussions' },
    { label: 'Tasks', icon: ListTodo, path: '/tasks' },
    { label: 'Gradebook', icon: BarChart3, path: '/admin/gradebook' },
    { label: 'Score Entry', icon: BarChart3, path: '/admin/scores' },
    { label: 'Report Cards', icon: FileText, path: '/admin/report-cards' },
    { label: 'CPD & Reviews', icon: Award, path: '/admin/cpd' },
    { label: 'AI Test Gen', icon: Zap, path: '/admin/ai-test' },
    { label: 'Boarding', icon: BedDouble, path: '/admin/boarding' },
    { label: 'Admissions', icon: UserPlus, path: '/admin/admissions' },
    { label: 'Almond Guest House', icon: Building, path: '/guesthouse' },
    { label: 'Reception Billing', icon: ClipboardList, path: '/receptionist/billing' },
    { label: 'Reception Messages', icon: MessageSquare, path: '/receptionist/messages' },
    { label: 'Reception Inventory', icon: FolderOpen, path: '/receptionist/inventory' },
    { label: 'Concerns & Boosters', icon: HeartHandshake, path: '/admin/booster-concerns' },
    { label: 'Remarks', icon: Megaphone, path: '/remarks' },
    { label: 'Website', icon: Globe, path: '/admin/website' },
    { label: 'Audit Logs', icon: Shield, path: '/admin/audit-logs' },
  ],
  Founder: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Analytics', icon: TrendingUp, path: '/admin/analytics' },
    { label: 'Students', icon: GraduationCap, path: '/admin/students' },
    { label: 'Parents', icon: Users, path: '/admin/parents' },
    { label: 'Staff', icon: Users, path: '/admin/staff' },
    { label: 'Finance', icon: DollarSign, path: '/admin/finance' },
    { label: 'Accounting', icon: BookMarked, path: '/admin/accounting' },
    { label: 'Monitoring', icon: Eye, path: '/admin/monitoring' },
    { label: 'AI Test Gen', icon: Zap, path: '/admin/ai-test' },
    { label: 'Almond Guest House', icon: Building, path: '/guesthouse' },
    { label: 'Reception Billing', icon: ClipboardList, path: '/receptionist/billing' },
    { label: 'Reception Messages', icon: MessageSquare, path: '/receptionist/messages' },
    { label: 'Reception Inventory', icon: FolderOpen, path: '/receptionist/inventory' },
    { label: 'Concerns & Boosters', icon: HeartHandshake, path: '/admin/booster-concerns' },
    { label: 'Remarks', icon: Megaphone, path: '/remarks' },
    { label: 'Workstation', icon: FileStack, path: '/working-paper' },
    { label: 'Scheme of Work', icon: PenSquare, path: '/scheme-of-work' },
    { label: 'Lectures', icon: Presentation, path: '/lectures' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Discussions', icon: MessagesSquare, path: '/discussions' },
  ],
  Principal: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Lesson Approvals', icon: CheckCircle, path: '/admin/lesson-approvals' },
    { label: 'Report Cards', icon: FileText, path: '/admin/report-cards' },
    { label: 'Students', icon: GraduationCap, path: '/admin/students' },
    { label: 'Parents', icon: Users, path: '/admin/parents' },
    { label: 'Staff', icon: Users, path: '/admin/staff' },
    { label: 'Academics', icon: BookMarked, path: '/admin/academics' },
    { label: 'Monitoring', icon: Eye, path: '/admin/monitoring' },
    { label: 'AI Test Gen', icon: Zap, path: '/admin/ai-test' },
    { label: 'Announcements', icon: BellRing, path: '/admin/announcements' },
    { label: 'Concerns & Boosters', icon: HeartHandshake, path: '/admin/booster-concerns' },
    { label: 'Remarks', icon: Megaphone, path: '/remarks' },
    { label: 'Workstation', icon: FileStack, path: '/working-paper' },
    { label: 'Scheme of Work', icon: PenSquare, path: '/scheme-of-work' },
    { label: 'Lectures', icon: Presentation, path: '/lectures' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Discussions', icon: MessagesSquare, path: '/discussions' },
    { label: 'Tasks', icon: ListTodo, path: '/tasks' },
  ],
  HeadTeacher: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Lesson Approvals', icon: CheckCircle, path: '/admin/lesson-approvals' },
    { label: 'Report Cards', icon: FileText, path: '/admin/report-cards' },
    { label: 'Students', icon: GraduationCap, path: '/admin/students' },
    { label: 'Academics', icon: BookMarked, path: '/admin/academics' },
    { label: 'My Classes', icon: Users, path: '/teacher/classes' },
    { label: 'Score Entry', icon: BarChart3, path: '/teacher/scores' },
    { label: 'Lessons', icon: BookOpen, path: '/teacher/lessons' },
    { label: 'Scheme of Work', icon: PenSquare, path: '/scheme-of-work' },
    { label: 'Lectures', icon: Presentation, path: '/lectures' },
    { label: 'Assignments', icon: ClipboardList, path: '/teacher/assignments' },
    { label: 'Attendance', icon: UserCheck, path: '/teacher/attendance' },
    { label: 'Monitoring', icon: Eye, path: '/admin/monitoring' },
    { label: 'AI Test Gen', icon: Zap, path: '/admin/ai-test' },
    { label: 'Gradebook', icon: BarChart3, path: '/admin/gradebook' },
    { label: 'CPD Training', icon: Award, path: '/admin/cpd' },
    { label: 'Concerns & Boosters', icon: HeartHandshake, path: '/admin/booster-concerns' },
    { label: 'Remarks', icon: Megaphone, path: '/remarks' },
    { label: 'Workstation', icon: FileStack, path: '/working-paper' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Discussions', icon: MessagesSquare, path: '/discussions' },
    { label: 'Tasks', icon: ListTodo, path: '/tasks' },
  ],
  Teacher: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/teacher/dashboard' },
    { label: 'My Classes', icon: Users, path: '/teacher/classes' },
    { label: 'Booster Students', icon: BookOpen, path: '/teacher/booster' },
    { label: 'Score Entry', icon: BarChart3, path: '/teacher/scores' },
    { label: 'Lessons', icon: BookOpen, path: '/teacher/lessons' },
    { label: 'Scheme of Work', icon: PenSquare, path: '/scheme-of-work' },
    { label: 'Lectures', icon: Presentation, path: '/lectures' },
    { label: 'Assignments', icon: ClipboardList, path: '/teacher/assignments' },
    { label: 'AI Test Gen', icon: Zap, path: '/teacher/live-test' },
    { label: 'Attendance', icon: UserCheck, path: '/teacher/attendance' },
    { label: 'CPD Training', icon: Award, path: '/admin/cpd' },
    { label: 'My Performance', icon: Eye, path: '/teacher/monitoring' },
    { label: 'HR & Leave', icon: Briefcase, path: '/teacher/hr' },
    { label: 'Remarks', icon: Megaphone, path: '/remarks' },
    { label: 'Live Classes', icon: Video, path: '/live' },
    { label: 'Workstation', icon: FileStack, path: '/working-paper' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Discussions', icon: MessagesSquare, path: '/discussions' },
    { label: 'Tasks', icon: ListTodo, path: '/tasks' },
  ],
  FinanceOfficer: [
    { label: 'Finance Dashboard', icon: LayoutDashboard, path: '/admin/finance' },
    { label: 'Student Fees', icon: GraduationCap, path: '/finance/students' },
    { label: 'Accounting', icon: BookMarked, path: '/admin/accounting' },
    { label: 'Workstation', icon: FileStack, path: '/working-paper' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Tasks', icon: ListTodo, path: '/tasks' },
  ],
  HR_Officer: [
    { label: 'HR Dashboard', icon: Briefcase, path: '/admin/hr' },
    { label: 'Staff Documents', icon: Users, path: '/hr/staff-docs' },
    { label: 'CPD & Training', icon: Award, path: '/hr/cpd' },
    { label: 'AI Test Gen', icon: Zap, path: '/hr/ai-test' },
    { label: 'Workstation', icon: FileStack, path: '/working-paper' },
    { label: 'Scheme of Work', icon: PenSquare, path: '/scheme-of-work' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Tasks', icon: ListTodo, path: '/tasks' },
  ],
  HeadOfAcademics: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Monitoring', icon: Eye, path: '/admin/monitoring' },
    { label: 'Academics', icon: BookMarked, path: '/admin/academics' },
    { label: 'Timetable', icon: CalendarClock, path: '/admin/timetable' },
    { label: 'Lessons', icon: BookOpen, path: '/admin/lessons' },
    { label: 'Scheme of Work', icon: PenSquare, path: '/scheme-of-work' },
    { label: 'Lectures', icon: Presentation, path: '/lectures' },
    { label: 'Assignments', icon: ClipboardList, path: '/admin/assignments' },
    { label: 'Score Entry', icon: BarChart3, path: '/admin/scores' },
    { label: 'Report Cards', icon: FileText, path: '/admin/report-cards' },
    { label: 'Gradebook', icon: BarChart3, path: '/admin/gradebook' },
    { label: 'Live Classes', icon: Video, path: '/live' },
    { label: 'Workstation', icon: FileStack, path: '/working-paper' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Tasks', icon: ListTodo, path: '/tasks' },
  ],
  Student: [
    { label: 'Home', icon: Home, path: '/student/home' },
    { label: 'Subjects', icon: BookMarked, path: '/student/subjects' },
    { label: 'Lessons', icon: BookOpen, path: '/student/lessons' },
    { label: 'Resources', icon: FolderOpen, path: '/student/resources' },
    { label: 'Assignments', icon: ClipboardList, path: '/student/assignments' },
    { label: 'Quizzes', icon: Zap, path: '/student/quizzes' },
    { label: 'Turbo AI', icon: Zap, path: '/student/turbo-ai' },
    { label: 'Grades', icon: BarChart3, path: '/student/grades' },
    { label: 'Attendance', icon: Calendar, path: '/student/attendance' },
    { label: 'Notifications', icon: Megaphone, path: '/student/notifications' },
    { label: 'Live Classes', icon: Video, path: '/live' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
  ],
  Parent: [
    { label: 'My Ward', icon: Home, path: '/parent/home' },
    { label: 'Academics', icon: BookMarked, path: '/parent/academics' },
    { label: 'Report Cards', icon: FileText, path: '/parent/report-cards' },
    { label: 'School Reception', icon: BellRing, path: '/parent/reception' },
    { label: 'Fees & Payments', icon: DollarSign, path: '/parent/fees' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
  ],
  BoardingOfficer: [
    { label: 'Boarding', icon: BedDouble, path: '/admin/boarding' },
    { label: 'Students', icon: GraduationCap, path: '/admin/students' },
    { label: 'Attendance', icon: UserCheck, path: '/admin/attendance' },
    { label: 'Workstation', icon: FileStack, path: '/working-paper' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Tasks', icon: ListTodo, path: '/tasks' },
  ],
  AdmissionsOfficer: [
    { label: 'Admissions', icon: UserPlus, path: '/admin/admissions' },
    { label: 'Bulk Upload', icon: UploadCloud, path: '/admin/bulk-upload' },
    { label: 'Students', icon: GraduationCap, path: '/admin/students' },
    { label: 'Parents', icon: Users, path: '/admin/parents' },
    { label: 'Workstation', icon: FileStack, path: '/working-paper' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Tasks', icon: ListTodo, path: '/tasks' },
  ],
  Receptionist: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/receptionist/dashboard' },
    { label: 'Admin Overview', icon: BarChart3, path: '/admin/dashboard' },
    { label: 'Billing & Items', icon: ClipboardList, path: '/receptionist/billing' },
    { label: 'Inventory', icon: FolderOpen, path: '/receptionist/inventory' },
    { label: 'Procurement', icon: FileText, path: '/receptionist/procurement' },
    { label: 'Parent Messages', icon: MessageSquare, path: '/receptionist/messages' },
    { label: 'Almond Guest House', icon: Building, path: '/receptionist/guesthouse' },
    { label: 'Students', icon: GraduationCap, path: '/admin/students' },
    { label: 'Parents', icon: Users, path: '/admin/parents' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Tasks', icon: ListTodo, path: '/tasks' },
  ],
  Nurse: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/nurse/dashboard' },
    { label: 'Admissions', icon: UserCheck, path: '/nurse/admissions' },
    { label: 'Medical Inventory', icon: FolderOpen, path: '/nurse/inventory' },
    { label: 'Emergency', icon: AlertTriangle, path: '/nurse/emergency' },
    { label: 'Mail', icon: Mail, path: '/mail' },
    { label: 'Messenger', icon: MessageSquare, path: '/messenger' },
    { label: 'Tasks', icon: ListTodo, path: '/tasks' },
  ],
};

// Section grouping map for premium sidebar
const sectionGroups = {
  'Overview': ['Dashboard', 'Analytics'],
  'People': ['Students', 'Parents', 'Staff', 'Student Logins', 'Admissions', 'Bulk Upload', 'Promotion'],
  'Academics': ['Academics', 'Timetable', 'Lessons', 'Lesson Approvals', 'Scheme of Work', 'Lectures', 'Assignments', 'Attendance', 'Live Classes', 'Gradebook', 'Report Cards', 'Score Entry'],
  'Finance': ['Finance', 'Accounting'],
  'Operations': ['HR & Staff', 'Monitoring', 'CPD & Reviews', 'Boarding', 'Behaviour', 'Remarks', 'Announcements', 'Almond Guest House', 'Concerns & Boosters', 'Reception Billing', 'Reception Messages', 'Reception Inventory'],
  'Workspace': ['Workstation', 'Tasks', 'Mail', 'Messenger', 'Discussions'],
  'System': ['Audit Logs', 'Calendar', 'Knowledge Base'],
};

// Student sections
const studentSections = {
  'Home': ['Dashboard'],
  'Learning': ['My Classes', 'Assignments', 'Quizzes', 'Resources', 'Lessons', 'Timetable', 'Live Classes'],
  'Communication': ['Notifications', 'Messenger', 'Discussions'],
  'AI Tools': ['TurboAI'],
};

// Teacher sections
const teacherSections = {
  'Home': ['Dashboard'],
  'Teaching': ['My Classes', 'Booster Students', 'Lessons', 'Scheme of Work', 'Lectures', 'Assignments', 'Score Entry', 'Attendance', 'Live Classes'],
  'Management': ['Workstation', 'Tasks', 'Behaviour', 'Monitoring', 'HR & Staff'],
  'Communication': ['Mail', 'Messenger', 'Discussions', 'Remarks'],
  'Reports': ['Gradebook', 'Report Cards', 'Knowledge Base'],
};

// Receptionist sections
const receptionistSections = {
  'Home': ['Dashboard', 'Admin Overview'],
  'Operations': ['Billing & Items', 'Inventory', 'Procurement'],
  'Communication': ['Parent Messages', 'Mail', 'Messenger'],
  'Hospitality': ['Almond Guest House'],
  'People': ['Students', 'Parents'],
  'Workspace': ['Tasks'],
};

// Nurse sections
const nurseSections = {
  'Home': ['Dashboard'],
  'Sick Bay': ['Admissions', 'Medical Inventory', 'Emergency'],
  'Communication': ['Mail', 'Messenger'],
  'Workspace': ['Tasks'],
};

function getSectionsForRole(role) {
  if (role === 'Student') return studentSections;
  if (role === 'Teacher') return teacherSections;
  if (role === 'Receptionist') return receptionistSections;
  if (role === 'Nurse') return nurseSections;
  return sectionGroups;
}

export default function Sidebar({ collapsed, onToggle, onClose, role, user }) {
  const location = useLocation();
  const [messengerUnread, setMessengerUnread] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const r = await api.get('/chat/unread/total');
        setMessengerUnread(r.data.total || 0);
      } catch (err) { console.error("Error:", err); }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  // Merge nav items from primary role + additional roles
  const primaryItems = navConfig[role] || navConfig.Student;
  const additionalRoles = user?.roles || [];
  
  let mergedItems = [...primaryItems];
  const existingPaths = new Set(primaryItems.map(i => i.path));
  
  for (const extraRole of additionalRoles) {
    const extraItems = navConfig[extraRole] || [];
    for (const item of extraItems) {
      if (!existingPaths.has(item.path)) {
        mergedItems.push(item);
        existingPaths.add(item.path);
      }
    }
  }

  // Add shared items (Calendar, Knowledge Base) for staff only (not Parents/Students)
  const isStaff = !['Parent', 'Student'].includes(role);
  const sharedItems = isStaff ? [
    { label: 'Calendar', icon: Calendar, path: '/calendar' },
    { label: 'Knowledge Base', icon: BookOpen, path: '/knowledge-base' },
  ] : [
    { label: 'Calendar', icon: Calendar, path: '/calendar' },
  ];
  for (const item of sharedItems) {
    if (!existingPaths.has(item.path)) {
      mergedItems.push(item);
      existingPaths.add(item.path);
    }
  }
  
  const items = mergedItems;
  const sections = getSectionsForRole(role);
  
  // Build grouped items
  const groupedItems = [];
  const usedPaths = new Set();
  
  for (const [sectionName, labels] of Object.entries(sections)) {
    const sectionItems = [];
    for (const label of labels) {
      const item = items.find(i => i.label === label);
      if (item && !usedPaths.has(item.path)) {
        sectionItems.push(item);
        usedPaths.add(item.path);
      }
    }
    if (sectionItems.length > 0) {
      groupedItems.push({ section: sectionName, items: sectionItems });
    }
  }
  // Add remaining ungrouped items
  const remaining = items.filter(i => !usedPaths.has(i.path));
  if (remaining.length > 0) {
    groupedItems.push({ section: 'More', items: remaining });
  }

  return (
    <div
      className={`flex flex-col h-full bg-[#141F36] ${collapsed ? 'sidebar-collapsed' : ''}`}
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.06]">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <img src="/main_logo.png" alt="RightWay Centre" className="w-10 h-10 rounded-lg flex-shrink-0 object-contain" />
            <div>
              <span className="text-[#1A1A2E] font-semibold text-sm tracking-tight block" style={{ fontFamily: 'Outfit, sans-serif' }}>RightWay Centre</span>
              <span className="text-[#6B7280] text-[9px] font-medium tracking-wider uppercase">Workstation</span>
            </div>
          </div>
        )}
        {collapsed && (
          <img src="/main_logo.png" alt="RightWay Centre" className="w-9 h-9 rounded-lg mx-auto object-contain" />
        )}
        <button onClick={onClose} className="lg:hidden text-white/40 hover:text-white transition-colors" data-testid="sidebar-close-btn">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav items grouped by section */}
      <nav className="flex-1 py-3 overflow-y-auto sidebar-nav">
        {groupedItems.map(({ section, items: sectionItems }) => (
          <div key={section} className="mb-1">
            {!collapsed && (
              <div className="px-6 pt-5 pb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A55A]/50">{section}</span>
              </div>
            )}
            {collapsed && <div className="pt-3" />}
            {sectionItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path ||
                (item.path !== '/mail' && item.path !== '/tasks' && location.pathname.startsWith(item.path));

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`group mx-2.5 px-3 py-2 rounded-lg flex items-center gap-3 text-[13px] transition-all duration-200 ${
                    isActive
                      ? 'text-white bg-gradient-to-r from-[#2E6CC4]/20 to-transparent border-l-2 border-[#C5A55A] shadow-[inset_4px_0_12px_rgba(197,165,90,0.1)]'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border-l-2 border-transparent'
                  }`}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-[#C5A55A]' : ''}`} />
                  {!collapsed && <span className={isActive ? 'font-medium' : 'font-normal'}>{item.label}</span>}
                  {item.label === 'Messenger' && messengerUnread > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {messengerUnread > 99 ? '99+' : messengerUnread}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden lg:flex px-3 py-4 border-t border-white/[0.06]">
        <button
          onClick={onToggle}
          className="mx-2.5 px-3 py-2 rounded-lg flex items-center gap-3 text-[13px] text-slate-400 hover:text-white hover:bg-white/[0.04] transition-all duration-200 w-full"
          data-testid="sidebar-toggle-btn"
        >
          {collapsed ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronLeft className="w-[18px] h-[18px]" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );
}
