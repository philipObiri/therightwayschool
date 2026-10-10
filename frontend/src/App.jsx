import React from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TermProvider } from './contexts/TermContext';
import { Toaster } from './components/ui/sonner';
import IdleTimer from './components/IdleTimer';

// Layout
import DashboardLayout from './components/layout/DashboardLayout';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import AuthCallback from './pages/auth/AuthCallback';

// Public website pages
import Home from './pages/website/Home';
import About from './pages/website/About';
import Academics from './pages/website/Academics';
import Admissions from './pages/website/Admissions';
import StudentLife from './pages/website/StudentLife';
import Gallery from './pages/website/Gallery';
import Contact from './pages/website/Contact';

// Website admin CMS
import WebsiteManager from './pages/admin/website/WebsiteManager';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentRegistry from './pages/admin/StudentRegistry';
import StaffRegistry from './pages/admin/StaffRegistry';
import FinanceModule from './pages/admin/FinanceModule';
import AuditLogs from './pages/admin/AuditLogs';
import AcademicsPage from './pages/admin/AcademicsPage';
import HRDashboard from './pages/admin/HRDashboard';
import MonitoringModule from './pages/admin/MonitoringModule';
import GradebookPage from './pages/admin/GradebookPage';
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard';
import TimetableManager from './pages/admin/TimetableManager';
import AnnouncementsPage from './pages/admin/AnnouncementsPage';
import AccountingModule from './pages/admin/AccountingModule';
import ProfessionalDev from './pages/admin/ProfessionalDev';
import BehaviourPage from './pages/shared/BehaviourPage';
import BoardingDashboard from './pages/admin/BoardingDashboard';
import AdmissionsDashboard from './pages/admin/AdmissionsDashboard';
import MyClassesPage from './pages/teacher/MyClassesPage';
import TeacherScoreEntry from './pages/teacher/TeacherScoreEntry';
import TeacherAttendance from './pages/teacher/TeacherAttendance';
import LiveTestGenerator from './pages/teacher/LiveTestGenerator';
import TeacherHR from './pages/teacher/TeacherHR';
import MyMonitoring from './pages/teacher/MyMonitoring';
import LessonApprovals from './pages/admin/LessonApprovals';
import ReportCardsPage from './pages/admin/ReportCardsPage';

import TeacherLessonsHub from './pages/teacher/TeacherLessonsHub';

// Teacher pages
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import LessonBuilder from './pages/teacher/LessonBuilder';
import AssignmentsMarking from './pages/teacher/AssignmentsMarking';
import AttendanceEntry from './pages/teacher/AttendanceEntry';

// Student pages
import StudentHome from './pages/student/StudentHome';
import StudentAssignments from './pages/student/StudentAssignments';
import StudentLessons from './pages/student/StudentLessons';
import StudentQuizzes from './pages/student/StudentQuizzes';
import TurboAIPage from './pages/student/TurboAIPage';
import StudentResources from './pages/student/StudentResources';
import StudentNotifications from './pages/student/StudentNotifications';
import StudentCredentials from './pages/admin/StudentCredentials';
import StudentPromotion from './pages/admin/StudentPromotion';
import FinanceStudentFees from './pages/admin/FinanceStudentFees';
import HRStaffDocs from './pages/admin/HRStaffDocs';
import HRCPDPage from './pages/admin/HRCPDPage';
import ParentManagement from './pages/admin/ParentManagement';
import ParentPortal from './pages/parent/ParentPortal';
import ParentAcademics from './pages/parent/ParentAcademics';
import ParentBehaviour from './pages/parent/ParentBehaviour';
import ParentReportCards from './pages/parent/ParentReportCards';
import ParentReception from './pages/parent/ParentReception';

// Nurse pages
import NurseDashboard from './pages/nurse/NurseDashboard';
import SickBayAdmissions from './pages/nurse/SickBayAdmissions';
import MedicalInventory from './pages/nurse/MedicalInventory';
import EmergencyPanel from './pages/nurse/EmergencyPanel';

// Receptionist pages
import ReceptionistDashboard from './pages/receptionist/ReceptionistDashboard';
import UniformBilling from './pages/receptionist/UniformBilling';
import InventoryManagement from './pages/receptionist/InventoryManagement';
import ProcurementRequests from './pages/receptionist/ProcurementRequests';
import ParentCommunication from './pages/receptionist/ParentCommunication';
import GuestHouseDashboard from './pages/guesthouse/GuestHouseDashboard';
import BoosterConcernsPage from './pages/admin/BoosterConcernsPage';
import BulkUploadPage from './pages/admin/BulkUploadPage';
import TeacherBoosterList from './pages/teacher/TeacherBoosterList';

// Shared pages
import OutlookMail from './pages/shared/OutlookMail';
import ProfilePage from './pages/shared/ProfilePage';
import TasksEnhanced from './pages/shared/TasksEnhanced';
import LiveClasses from './pages/shared/LiveClasses';
import WorkingPaperModule from './pages/shared/WorkingPaperModule';
import SchemeOfWork from './pages/shared/SchemeOfWork';
import DiscussionRooms from './pages/shared/DiscussionRooms';
import TcisMessenger from './pages/shared/TcisMessenger';
import VideoMeeting from './pages/shared/VideoMeeting';
import CalendarPage from './pages/shared/CalendarPage';
import KnowledgeBase from './pages/shared/KnowledgeBase';
import TeacherRemarks from './pages/shared/TeacherRemarks';
import LectureModule from './pages/shared/LectureModule';
import { AppLoader } from './components/AppLoader';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';

// Animated Loading Screen with minimum 5s display
function AnimatedLoader() {
  const [minTimeElapsed, setMinTimeElapsed] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 5000);
    return () => clearTimeout(timer);
  }, []);
  if (!minTimeElapsed) return <AppLoader fullPage />;
  return null;
}

// Protected Route wrapper
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !minTimeElapsed) {
    return <AppLoader fullPage />;
  }

  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const routes = {
      Admin: '/admin/dashboard', SuperAdmin: '/admin/dashboard',
      Teacher: '/teacher/dashboard', Student: '/student/home', Parent: '/parent/home',
      FinanceOfficer: '/admin/finance', HR_Officer: '/admin/hr',
      HeadOfAcademics: '/admin/dashboard',
      Receptionist: '/receptionist/dashboard', Nurse: '/nurse/dashboard',
    };
    return <Navigate to={routes[user.role] || '/login'} />;
  }

  return children;
}

// Redirect based on role
function DashboardRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <AnimatedLoader />;
  if (!user) return <Navigate to="/login" />;
  const routes = {
    Admin: '/admin/dashboard', SuperAdmin: '/admin/dashboard',
    Teacher: '/teacher/dashboard', Student: '/student/home', Parent: '/parent/home',
    FinanceOfficer: '/admin/finance', HR_Officer: '/admin/hr',
    HeadOfAcademics: '/admin/dashboard',
    CEO: '/admin/dashboard', Founder: '/admin/dashboard',
    Principal: '/admin/dashboard', HeadTeacher: '/admin/dashboard',
    BoardingOfficer: '/admin/boarding', AdmissionsOfficer: '/admin/admissions',
    Receptionist: '/receptionist/dashboard', Nurse: '/nurse/dashboard',
  };
  return <Navigate to={routes[user.role] || '/student/home'} />;
}

function AppRouter() {
  const location = useLocation();

  // Check URL fragment for session_id - must be synchronous
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public website routes */}
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/academics" element={<Academics />} />
      <Route path="/admissions" element={<Admissions />} />
      <Route path="/student-life" element={<StudentLife />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardRedirect />} />

      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['Admin', 'SuperAdmin', 'FinanceOfficer', 'HR_Officer', 'HeadOfAcademics', 'CEO', 'Founder', 'Principal', 'HeadTeacher', 'BoardingOfficer', 'AdmissionsOfficer', 'Teacher', 'Receptionist', 'Nurse']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="students" element={<StudentRegistry />} />
        <Route path="parents" element={<ParentManagement />} />
        <Route path="staff" element={<StaffRegistry />} />
        <Route path="academics" element={<AcademicsPage />} />
        <Route path="finance" element={<FinanceModule />} />
        <Route path="accounting" element={<AccountingModule />} />
        <Route path="hr" element={<HRDashboard />} />
        <Route path="monitoring" element={<MonitoringModule />} />
        <Route path="lessons" element={<TeacherLessonsHub />} />
        <Route path="assignments" element={<AssignmentsMarking />} />
        <Route path="attendance" element={<AttendanceEntry />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="gradebook" element={<GradebookPage />} />
        <Route path="analytics" element={<AnalyticsDashboard />} />
        <Route path="timetable" element={<TimetableManager />} />
        <Route path="cpd" element={<ProfessionalDev />} />
        <Route path="behaviour" element={<BehaviourPage />} />
        <Route path="lesson-approvals" element={<LessonApprovals />} />
        <Route path="report-cards" element={<ReportCardsPage />} />
        <Route path="student-credentials" element={<StudentCredentials />} />
        <Route path="student-promotion" element={<StudentPromotion />} />
        <Route path="scores" element={<TeacherScoreEntry />} />
        <Route path="ai-test" element={<LiveTestGenerator />} />
        <Route path="boarding" element={<BoardingDashboard />} />
        <Route path="admissions" element={<AdmissionsDashboard />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="booster-concerns" element={<BoosterConcernsPage />} />
        <Route path="bulk-upload" element={<BulkUploadPage />} />
        <Route path="settings" element={<AdminDashboard />} />
        <Route path="website" element={<WebsiteManager />} />
      </Route>

      {/* Teacher routes */}
      <Route path="/teacher" element={
        <ProtectedRoute allowedRoles={['Teacher', 'Admin', 'SuperAdmin', 'HeadTeacher', 'HeadOfAcademics', 'Principal', 'CEO', 'Founder']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<TeacherDashboard />} />
        <Route path="classes" element={<MyClassesPage />} />
        <Route path="booster" element={<TeacherBoosterList />} />
        <Route path="scores" element={<TeacherScoreEntry />} />
        <Route path="behaviour" element={<BehaviourPage />} />
        <Route path="lessons" element={<TeacherLessonsHub />} />
        <Route path="assignments" element={<AssignmentsMarking />} />
        <Route path="live-test" element={<LiveTestGenerator />} />
        <Route path="gradebook" element={<GradebookPage />} />
        <Route path="attendance" element={<TeacherAttendance />} />
        <Route path="monitoring" element={<MyMonitoring />} />
        <Route path="hr" element={<TeacherHR />} />
      </Route>
      <Route path="/student" element={
        <ProtectedRoute allowedRoles={['Student', 'Admin', 'SuperAdmin']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="home" element={<StudentHome />} />
        <Route path="subjects" element={<StudentLessons />} />
        <Route path="lessons" element={<StudentLessons />} />
        <Route path="resources" element={<StudentResources />} />
        <Route path="notifications" element={<StudentNotifications />} />
        <Route path="assignments" element={<StudentAssignments />} />
        <Route path="quizzes" element={<StudentQuizzes />} />
        <Route path="turbo-ai" element={<TurboAIPage />} />
        <Route path="grades" element={<StudentAssignments />} />
        <Route path="attendance" element={<StudentHome />} />
      </Route>

      {/* Parent routes */}
      <Route path="/parent" element={
        <ProtectedRoute allowedRoles={['Parent', 'Admin', 'SuperAdmin']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="home" element={<ParentPortal />} />
        <Route path="academics" element={<ParentAcademics />} />
        <Route path="behaviour" element={<ParentBehaviour />} />
        <Route path="report-cards" element={<ParentReportCards />} />
        <Route path="reception" element={<ParentReception />} />
        <Route path="fees" element={<ParentPortal />} />
        <Route path="reports" element={<ParentReportCards />} />
        <Route path="attendance" element={<ParentPortal />} />
      </Route>

      {/* Nurse routes */}
      <Route path="/nurse" element={
        <ProtectedRoute allowedRoles={['Nurse', 'Admin', 'SuperAdmin', 'CEO']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<NurseDashboard />} />
        <Route path="admissions" element={<SickBayAdmissions />} />
        <Route path="inventory" element={<MedicalInventory />} />
        <Route path="emergency" element={<EmergencyPanel />} />
      </Route>

      {/* Receptionist routes */}
      <Route path="/receptionist" element={
        <ProtectedRoute allowedRoles={['Receptionist', 'Admin', 'SuperAdmin', 'CEO', 'Founder']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<ReceptionistDashboard />} />
        <Route path="billing" element={<UniformBilling />} />
        <Route path="inventory" element={<InventoryManagement />} />
        <Route path="procurement" element={<ProcurementRequests />} />
        <Route path="messages" element={<ParentCommunication />} />
        <Route path="guesthouse" element={<GuestHouseDashboard />} />
      </Route>

      {/* Shared routes */}
      <Route path="/mail" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<OutlookMail />} />
      </Route>
      <Route path="/profile" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<ProfilePage />} />
      </Route>
      <Route path="/tasks" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<TasksEnhanced />} />
      </Route>
      <Route path="/live" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<LiveClasses />} />
      </Route>
      <Route path="/working-paper" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<WorkingPaperModule />} />
      </Route>
      <Route path="/scheme-of-work" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<SchemeOfWork />} />
      </Route>
      <Route path="/discussions" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<DiscussionRooms />} />
      </Route>
      <Route path="/messenger" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<TcisMessenger />} />
      </Route>
      <Route path="/calendar" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<CalendarPage />} />
      </Route>
      <Route path="/knowledge-base" element={
        <ProtectedRoute allowedRoles={['Admin', 'SuperAdmin', 'CEO', 'Founder', 'Principal', 'HeadTeacher', 'HeadOfAcademics', 'Teacher', 'FinanceOfficer', 'HR_Officer', 'BoardingOfficer', 'AdmissionsOfficer', 'Receptionist', 'Nurse']}><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<KnowledgeBase />} />
      </Route>
      <Route path="/remarks" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<TeacherRemarks />} />
      </Route>
      <Route path="/lectures" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<LectureModule />} />
      </Route>
      <Route path="/finance" element={
        <ProtectedRoute allowedRoles={['FinanceOfficer', 'Admin', 'SuperAdmin', 'CEO']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="students" element={<FinanceStudentFees />} />
      </Route>
      <Route path="/hr" element={
        <ProtectedRoute allowedRoles={['HR_Officer', 'Admin', 'SuperAdmin', 'CEO']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="staff-docs" element={<HRStaffDocs />} />
        <Route path="cpd" element={<HRCPDPage />} />
        <Route path="ai-test" element={<LiveTestGenerator />} />
      </Route>

      <Route path="/guesthouse" element={
        <ProtectedRoute allowedRoles={['Receptionist', 'Admin', 'SuperAdmin', 'CEO', 'Founder']}>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<GuestHouseDashboard />} />
      </Route>

      {/* Video Meeting (standalone full-screen) */}
      <Route path="/meeting/:meetingId" element={<ProtectedRoute><VideoMeeting /></ProtectedRoute>} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

import SuccessTick from './components/ui/SuccessTick';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { SyncProvider } from './contexts/SyncContext';
import { OfflineStatusBar } from './components/OfflineStatusBar';

/** Only render dashboard-only components when a user is logged in */
function AuthenticatedExtras() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <IdleTimer />
      <OfflineStatusBar />
    </>
  );
}

function App() {
  return (
    <HelmetProvider>
    <BrowserRouter>
      <AuthProvider>
        <TermProvider>
          <SyncProvider>
            <AppRouter />
            <AuthenticatedExtras />
            <Toaster position="top-right" />
            <SuccessTick />
            {/* PWAInstallPrompt moved to LoginPage */}
            <PWAUpdatePrompt />
          </SyncProvider>
        </TermProvider>
      </AuthProvider>
    </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
