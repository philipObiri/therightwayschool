import requests
import sys
from datetime import datetime
import json
import tempfile
import os

class TCISAPITester:
    def __init__(self, base_url="https://tcis-lms-hub-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.tokens = {}
        self.users = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.test_message_id = None
        self.test_thread_id = None
        self.teacher_user_id = None
        
        # Updated demo accounts for TCIS Nexus
        self.demo_accounts = [
            {"email": "admin@tcis.demo", "password": "admin123", "role": "Admin"},
            {"email": "teacher@tcis.demo", "password": "teacher123", "role": "Teacher"},
            {"email": "student@tcis.demo", "password": "student123", "role": "Student"},
            {"email": "parent@tcis.demo", "password": "parent123", "role": "Parent"},
            {"email": "finance@tcis.demo", "password": "finance123", "role": "FinanceOfficer"},
            {"email": "hr@tcis.demo", "password": "hr123", "role": "HR_Officer"}
        ]

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_role=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Add authorization if required
        if auth_role and auth_role in self.tokens:
            headers['Authorization'] = f'Bearer {self.tokens[auth_role]}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return success, response_data
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic health endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_login(self, email, password, expected_role):
        """Test login and store token"""
        success, response = self.run_test(
            f"Login - {expected_role}", 
            "POST", 
            "auth/login", 
            200,
            data={"email": email, "password": password}
        )
        
        if success and 'token' in response:
            self.tokens[expected_role] = response['token']
            self.users[expected_role] = response.get('user', {})
            print(f"   Token stored for {expected_role}")
            return True
        return False

    def test_auth_me(self, role):
        """Test /auth/me endpoint"""
        return self.run_test(f"Auth Me - {role}", "GET", "auth/me", 200, auth_role=role)

    def test_admin_dashboard(self):
        """Test admin dashboard stats"""
        return self.run_test("Admin Dashboard", "GET", "admin/dashboard", 200, auth_role="Admin")

    def test_admin_students(self):
        """Test admin students endpoint"""
        return self.run_test("Admin Students", "GET", "admin/students", 200, auth_role="Admin")

    def test_admin_staff(self):
        """Test admin staff endpoint"""  
        return self.run_test("Admin Staff", "GET", "admin/staff", 200, auth_role="Admin")

    def test_lms_lessons(self):
        """Test LMS lessons endpoint"""
        return self.run_test("LMS Lessons", "GET", "lms/lessons", 200, auth_role="Admin")

    def test_assignments(self):
        """Test assignments endpoint"""
        return self.run_test("Assignments", "GET", "assignments", 200, auth_role="Admin")

    def test_finance_invoices(self):
        """Test finance invoices endpoint"""
        return self.run_test("Finance Invoices", "GET", "finance/invoices", 200, auth_role="Admin")

    def test_attendance_classes(self):
        """Test attendance classes endpoint"""
        return self.run_test("Attendance Classes", "GET", "attendance/classes", 200, auth_role="Admin")

    def test_mail_inbox(self):
        """Test mail inbox endpoint"""
        return self.run_test("Mail Inbox", "GET", "mail/inbox", 200, auth_role="Admin")

    def test_tasks(self):
        """Test tasks endpoint"""
        return self.run_test("Tasks", "GET", "tasks", 200, auth_role="Admin")

    def test_audit_logs(self):
        """Test audit logs endpoint"""
        return self.run_test("Audit Logs", "GET", "admin/audit-logs", 200, auth_role="Admin")

    # ─── NEW TCIS NEXUS API TESTS ───
    
    def test_global_search(self):
        """Test global search functionality"""
        return self.run_test("Global Search", "GET", "search?q=Yaa", 200, auth_role="Admin")

    def test_hr_dashboard(self):
        """Test HR dashboard stats"""
        return self.run_test("HR Dashboard", "GET", "hr/dashboard", 200, auth_role="Admin")

    def test_hr_clock_status(self):
        """Test HR clock status"""
        return self.run_test("HR Clock Status", "GET", "hr/clock/status", 200, auth_role="Admin")

    def test_monitoring_kpis(self):
        """Test monitoring KPIs"""
        return self.run_test("Monitoring KPIs", "GET", "monitoring/kpis", 200, auth_role="Admin")

    def test_monitoring_lesson_plans(self):
        """Test lesson plans endpoint"""
        return self.run_test("Lesson Plans", "GET", "monitoring/lesson-plans", 200, auth_role="Admin")

    def test_live_sessions_list(self):
        """Test live sessions list"""
        return self.run_test("Live Sessions", "GET", "live/sessions", 200, auth_role="Admin")

    def test_task_analytics(self):
        """Test task analytics"""
        return self.run_test("Task Analytics", "GET", "tasks/analytics/summary", 200, auth_role="Admin")

    def test_create_live_session(self):
        """Test creating a live session"""
        data = {
            "title": "Test Live Session",
            "class_id": "cls_year7a",
            "subject_id": "subj_math",
            "scheduled_at": "2024-08-15T10:00:00Z",
            "duration_minutes": 60,
            "description": "Test session for API testing"
        }
        success, response = self.run_test("Create Live Session", "POST", "live/sessions", 200, data=data, auth_role="Admin")
        if success and 'session_id' in response:
            self.test_session_id = response['session_id']
            print(f"   Created session: {self.test_session_id}")
            return True
        return False

    def test_create_task(self):
        """Test creating a task for timer testing"""
        data = {
            "title": "API Test Task",
            "description": "Task created for testing timer functionality",
            "task_type": "administrative",
            "assigned_to": "",
            "assigned_role": "Admin",
            "department": "IT",
            "priority": "medium",
            "start_date": "2024-08-15",
            "due_date": "2024-08-16",
            "estimated_minutes": 60,
            "acceptance_criteria": "Complete API testing",
            "confidentiality": "normal",
            "tags": ["testing", "api"],
            "checklist": ["Test timer start", "Test timer stop"],
            "approvers": [],
            "sla_hours": 24
        }
        success, response = self.run_test("Create Task", "POST", "tasks", 200, data=data, auth_role="Admin")
        if success and 'task_id' in response:
            self.test_task_id = response['task_id']
            print(f"   Created task: {self.test_task_id}")
            return True
        return False

    def test_task_timer_start(self):
        """Test starting task timer"""
        if hasattr(self, 'test_task_id'):
            return self.run_test("Task Timer Start", "POST", f"tasks/{self.test_task_id}/time/start", 200, auth_role="Admin")
        else:
            print("❌ Skipping timer start - no test task created")
            return False

    def test_task_timer_stop(self):
        """Test stopping task timer"""
        if hasattr(self, 'test_task_id'):
            return self.run_test("Task Timer Stop", "POST", f"tasks/{self.test_task_id}/time/stop", 200, auth_role="Admin")
        else:
            print("❌ Skipping timer stop - no test task created")
            return False

    def test_task_checklist_toggle(self):
        """Test toggling task checklist item"""
        if hasattr(self, 'test_task_id'):
            # First get the task to find checklist item IDs
            success, response = self.run_test("Get Task Details", "GET", f"tasks/{self.test_task_id}", 200, auth_role="Admin")
            if success and 'checklist' in response and response['checklist']:
                item_id = response['checklist'][0]['id']
                return self.run_test("Toggle Checklist", "POST", f"tasks/{self.test_task_id}/checklist/{item_id}/toggle", 200, auth_role="Admin")
        return False

    # ===== MAIL SYSTEM TESTING METHODS =====
    def test_mail_folders(self):
        """Test GET /api/mail/folders"""
        success, response = self.run_test("Mail Folders", "GET", "mail/folders", 200, auth_role="Admin")
        if success:
            folders = response
            print(f"   Found {len(folders)} folders")
            folder_names = [f.get('name') for f in folders]
            required = ['Inbox', 'Sent', 'Drafts', 'Archive', 'Trash']
            for req in required:
                if req in folder_names:
                    print(f"   ✅ {req} folder exists")
                else:
                    print(f"   ❌ Missing {req} folder")
        return success

    def test_mail_contacts(self):
        """Test GET /api/mail/contacts"""
        success, response = self.run_test("Mail Contacts", "GET", "mail/contacts", 200, auth_role="Admin")
        if success:
            contacts = response
            print(f"   Found {len(contacts)} contacts")
            # Store teacher user ID for message sending
            for contact in contacts:
                if contact.get('role') == 'Teacher':
                    self.teacher_user_id = contact.get('user_id')
                    print(f"   Found teacher: {contact.get('name')} ({self.teacher_user_id})")
                    break
        return success

    def test_mail_threads(self):
        """Test GET /api/mail/threads"""
        success, response = self.run_test("Mail Threads", "GET", "mail/threads", 200, auth_role="Admin")
        if success:
            threads = response
            print(f"   Found {len(threads)} threads in Inbox")
        return success

    def test_send_message(self):
        """Test POST /api/mail/messages"""
        if not self.teacher_user_id:
            print("   ⚠️ No teacher user ID available for sending message")
            return False

        data = {
            "to": [self.teacher_user_id],
            "cc": [],
            "bcc": [],
            "subject": f"API Test Message - {datetime.now().strftime('%H:%M:%S')}",
            "body_html": "<p>This is a test message sent via API testing for the Outlook mail system.</p>",
            "body_text": "This is a test message sent via API testing for the Outlook mail system.",
            "importance": "normal",
            "attachment_ids": [],
            "is_draft": False
        }
        success, response = self.run_test("Send Message", "POST", "mail/messages", 200, data=data, auth_role="Admin")
        if success:
            self.test_message_id = response.get('message_id')
            self.test_thread_id = response.get('thread_id')
            print(f"   Message ID: {self.test_message_id}")
            print(f"   Thread ID: {self.test_thread_id}")
        return success

    def test_thread_detail(self):
        """Test GET /api/mail/threads/{id}"""
        if not self.test_thread_id:
            print("   ⚠️ No test thread ID available")
            return False
            
        success, response = self.run_test("Thread Detail", "GET", f"mail/threads/{self.test_thread_id}", 200, auth_role="Admin")
        if success:
            messages = response.get('messages', [])
            print(f"   Thread has {len(messages)} messages")
        return success

    def test_reply_message(self):
        """Test POST /api/mail/messages/{id}/reply"""
        if not self.test_message_id:
            print("   ⚠️ No test message ID available")
            return False
            
        data = {
            "body_html": "<p>This is a reply to the test message.</p>",
            "body_text": "This is a reply to the test message.",
            "reply_all": False
        }
        success, response = self.run_test("Reply Message", "POST", f"mail/messages/{self.test_message_id}/reply", 200, data=data, auth_role="Admin")
        return success

    def test_archive_message(self):
        """Test POST /api/mail/messages/{id}/archive"""
        if not self.test_message_id:
            print("   ⚠️ No test message ID available")
            return False
            
        success, response = self.run_test("Archive Message", "POST", f"mail/messages/{self.test_message_id}/archive", 200, auth_role="Admin")
        return success

    def test_delete_message(self):
        """Test DELETE /api/mail/messages/{id}"""
        if not self.test_message_id:
            print("   ⚠️ No test message ID available") 
            return False
            
        success, response = self.run_test("Delete Message", "DELETE", f"mail/messages/{self.test_message_id}", 200, auth_role="Admin")
        return success

    def test_file_upload(self):
        """Test POST /api/files/upload"""
        try:
            # Create a temporary test file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write("This is a test file for mail attachment testing.")
                temp_file_path = f.name
            
            # Upload the file
            url = f"{self.base_url}/api/files/upload"
            headers = {}
            if "Admin" in self.tokens:
                headers['Authorization'] = f'Bearer {self.tokens["Admin"]}'
            
            self.tests_run += 1
            print(f"\n🔍 Testing File Upload...")
            
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('test.txt', f, 'text/plain')}
                response = requests.post(url, files=files, headers=headers, timeout=10)
            
            # Clean up
            os.unlink(temp_file_path)
            
            if response.status_code == 200:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    result = response.json()
                    print(f"   File ID: {result.get('file_id')}")
                    return True
                except:
                    return True
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                return False
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    # ===== NEW GRADEBOOK API TESTS =====
    def test_gradebook_settings(self):
        """Test GET /api/gradebook/settings"""
        return self.run_test("Gradebook Settings", "GET", "gradebook/settings", 200, auth_role="Admin")

    def test_record_grade(self):
        """Test POST /api/gradebook/entries"""
        data = {
            "student_id": "student_test_01",
            "subject_id": "subj_math",
            "term": "Term 1",
            "ca_score": 75,
            "ca_max": 100,
            "exam_score": 82,
            "exam_max": 100,
            "teacher_comment": "Good progress in mathematics"
        }
        success, response = self.run_test("Record Grade", "POST", "gradebook/entries", 200, data=data, auth_role="Admin")
        if success and 'entry_id' in response:
            self.test_grade_entry_id = response['entry_id']
            final_score = response.get('final_score', 0)
            print(f"   Created grade entry: {self.test_grade_entry_id} (Final: {final_score}%)")
        return success

    def test_list_grade_entries(self):
        """Test GET /api/gradebook/entries"""
        return self.run_test("List Grade Entries", "GET", "gradebook/entries", 200, auth_role="Admin")

    def test_class_gradebook(self):
        """Test GET /api/gradebook/class/{class_id}"""
        class_id = "cls_year7a"  # Using a typical class ID
        success, response = self.run_test("Class Gradebook", "GET", f"gradebook/class/{class_id}", 200, auth_role="Admin")
        if success:
            students_count = len(response.get('students', []))
            subjects_count = len(response.get('subjects', []))
            print(f"   Class gradebook: {students_count} students, {subjects_count} subjects")
        return success

    def test_report_card_data(self):
        """Test GET /api/gradebook/report-card/{student_id}"""
        student_id = "student_test_01"
        success, response = self.run_test("Report Card Data", "GET", f"gradebook/report-card/{student_id}", 200, auth_role="Admin")
        if success:
            average = response.get('average', 0)
            grades_count = len(response.get('grades', []))
            overall_grade = response.get('overall_grade', '')
            print(f"   Report card: {grades_count} subjects, Average: {average}%, Grade: {overall_grade}")
        return success

    def test_report_card_pdf(self):
        """Test GET /api/gradebook/report-card/{student_id}/pdf"""
        student_id = "student_test_01"
        url = f"{self.base_url}/api/gradebook/report-card/{student_id}/pdf"
        headers = {}
        if "Admin" in self.tokens:
            headers['Authorization'] = f'Bearer {self.tokens["Admin"]}'
        
        self.tests_run += 1
        print(f"\n🔍 Testing Report Card PDF...")
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code == 200:
                self.tests_passed += 1
                content_type = response.headers.get('Content-Type', '')
                content_length = len(response.content)
                print(f"✅ Passed - Status: {response.status_code}")
                print(f"   Content-Type: {content_type}, Size: {content_length} bytes")
                return True
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    # ===== CPD & PROFESSIONAL DEVELOPMENT API TESTS =====
    def test_cpd_courses_list(self):
        """Test GET /api/cpd/courses"""
        success, response = self.run_test("CPD Courses List", "GET", "cpd/courses", 200, auth_role="Admin")
        if success:
            courses = response
            print(f"   Found {len(courses)} CPD courses")
        return success

    def test_create_cpd_course(self):
        """Test POST /api/cpd/courses"""
        data = {
            "title": "API Testing CPD Course",
            "description": "Course created during API testing",
            "category": "Technology",
            "duration_hours": 4,
            "provider": "Internal",
            "start_date": "2024-09-01",
            "end_date": "2024-09-02",
            "max_participants": 25
        }
        success, response = self.run_test("Create CPD Course", "POST", "cpd/courses", 200, data=data, auth_role="Admin")
        if success and 'course_id' in response:
            self.test_cpd_course_id = response['course_id']
            print(f"   Created CPD course: {self.test_cpd_course_id}")
        return success

    def test_enrol_cpd_course(self):
        """Test POST /api/cpd/courses/{course_id}/enrol"""
        if not hasattr(self, 'test_cpd_course_id'):
            print("   ⚠️ No CPD course ID available for enrolment")
            return False
        
        success, response = self.run_test("Enrol in CPD", "POST", f"cpd/courses/{self.test_cpd_course_id}/enrol", 200, auth_role="Teacher")
        if success and 'enrolment_id' in response:
            self.test_cpd_enrolment_id = response['enrolment_id']
            print(f"   Enrolment ID: {self.test_cpd_enrolment_id}")
        return success

    def test_my_cpd_courses(self):
        """Test GET /api/cpd/my-courses"""
        return self.run_test("My CPD Courses", "GET", "cpd/my-courses", 200, auth_role="Teacher")

    # ===== PERFORMANCE REVIEWS API TESTS =====
    def test_performance_reviews_list(self):
        """Test GET /api/performance/reviews"""
        success, response = self.run_test("Performance Reviews List", "GET", "performance/reviews", 200, auth_role="Admin")
        if success:
            reviews = response
            print(f"   Found {len(reviews)} performance reviews")
        return success

    def test_create_performance_review(self):
        """Test POST /api/performance/reviews"""
        # Get a teacher ID for the review
        teacher_id = self.users.get("Teacher", {}).get("user_id", "teacher_test_01")
        
        data = {
            "reviewee_id": teacher_id,
            "cycle": "Term 1 2024-2025",
            "targets": [
                {"text": "Complete all lesson plans on time", "status": "pending"},
                {"text": "Improve student engagement", "status": "pending"}
            ],
            "strengths": "Excellent subject knowledge and classroom management",
            "areas_for_development": "Use more technology in lessons",
            "overall_rating": 4,
            "action_items": "Attend EdTech training session"
        }
        success, response = self.run_test("Create Performance Review", "POST", "performance/reviews", 200, data=data, auth_role="Admin")
        if success and 'review_id' in response:
            self.test_review_id = response['review_id']
            rating = response.get('overall_rating', 0)
            print(f"   Created review: {self.test_review_id} (Rating: {rating}/5)")
        return success

    def test_submit_performance_review(self):
        """Test POST /api/performance/reviews/{review_id}/submit"""
        if not hasattr(self, 'test_review_id'):
            print("   ⚠️ No review ID available for submit test")
            return False
        
        return self.run_test("Submit Performance Review", "POST", f"performance/reviews/{self.test_review_id}/submit", 200, auth_role="Admin")

    # ===== ASSESSMENT VAULT API TESTS =====
    def test_assessment_papers_list(self):
        """Test GET /api/assessment/papers"""
        success, response = self.run_test("Assessment Papers List", "GET", "assessment/papers", 200, auth_role="Admin")
        if success:
            papers = response
            print(f"   Found {len(papers)} assessment papers")
        return success

    def test_create_assessment_paper(self):
        """Test POST /api/assessment/papers"""
        data = {
            "title": "Mathematics End of Term Test",
            "subject_id": "subj_math",
            "class_id": "cls_year7a",
            "paper_type": "end_of_term",
            "term": "Term 1",
            "total_marks": 100,
            "duration_minutes": 120,
            "topics_covered": ["Algebra", "Geometry", "Statistics"],
            "difficulty_breakdown": {"easy": 30, "medium": 50, "hard": 20}
        }
        success, response = self.run_test("Create Assessment Paper", "POST", "assessment/papers", 200, data=data, auth_role="Admin")
        if success and 'paper_id' in response:
            self.test_paper_id = response['paper_id']
            moderation_status = response.get('moderation_status', '')
            print(f"   Created paper: {self.test_paper_id} (Status: {moderation_status})")
        return success

    def test_moderate_assessment_paper(self):
        """Test POST /api/assessment/papers/{paper_id}/moderate"""
        if not hasattr(self, 'test_paper_id'):
            print("   ⚠️ No paper ID available for moderation test")
            return False
        
        data = {
            "approved": True,
            "feedback": "Paper meets all assessment standards. Approved for use."
        }
        success, response = self.run_test("Moderate Assessment Paper", "POST", f"assessment/papers/{self.test_paper_id}/moderate", 200, data=data, auth_role="Admin")
        if success:
            message = response.get('message', '')
            print(f"   Moderation result: {message}")
        return success

    def test_paper_access_log(self):
        """Test GET /api/assessment/papers/{paper_id}/access-log"""
        if not hasattr(self, 'test_paper_id'):
            print("   ⚠️ No paper ID available for access log test")
            return False
        
        success, response = self.run_test("Paper Access Log", "GET", f"assessment/papers/{self.test_paper_id}/access-log", 200, auth_role="Admin")
        if success:
            access_log = response
            print(f"   Access log entries: {len(access_log)}")
        return success

    # ===== HOD DIGEST API TEST =====
    def test_hod_weekly_digest(self):
        """Test POST /api/monitoring/hod-digest"""
        success, response = self.run_test("HoD Weekly Digest", "POST", "monitoring/hod-digest", 200, auth_role="Admin")
        if success:
            message = response.get('message', '')
            departments = response.get('departments', 0)
            print(f"   Digest result: {message}, Departments: {departments}")
        return success

    # ===== MONITORING MODULE API TESTS =====
    def test_monitoring_executive_dashboard(self):
        """Test GET /api/monitoring/executive-dashboard"""
        success, response = self.run_test("Executive Dashboard", "GET", "monitoring/executive-dashboard", 200, auth_role="Admin")
        if success:
            # Validate response structure
            academic = response.get('academic', {})
            finance = response.get('finance', {})
            alerts = response.get('alerts', {})
            
            print(f"   Academic: Students={academic.get('students')}, Teachers={academic.get('teachers')}")
            print(f"   Finance: Collection Rate={finance.get('collection_rate')}%")
            print(f"   Alerts: Total={alerts.get('total', 0)}, High Priority={alerts.get('high', 0)}")
        return success

    def test_monitoring_teacher_scorecards(self):
        """Test GET /api/monitoring/teacher-scorecards"""
        success, response = self.run_test("Teacher Scorecards", "GET", "monitoring/teacher-scorecards", 200, auth_role="Admin")
        if success:
            scorecards = response
            print(f"   Found {len(scorecards)} teacher scorecards")
            if scorecards:
                # Store first teacher ID for detailed testing
                self.first_teacher_id = scorecards[0].get('teacher_id')
                print(f"   First teacher: {scorecards[0].get('name')} (Score: {scorecards[0].get('compliance_score')}%)")
        return success

    def test_monitoring_teacher_scorecard_detail(self):
        """Test GET /api/monitoring/teacher-scorecard/{id}"""
        if not hasattr(self, 'first_teacher_id') or not self.first_teacher_id:
            print("   ⚠️ No teacher ID available for detailed scorecard test")
            return False
            
        success, response = self.run_test("Teacher Scorecard Detail", "GET", f"monitoring/teacher-scorecard/{self.first_teacher_id}", 200, auth_role="Admin")
        if success:
            teacher = response.get('teacher', {})
            kpis = response.get('kpis', {})
            print(f"   Teacher: {teacher.get('name')} - Classes: {response.get('classes_count')}")
            print(f"   KPIs: Lessons={kpis.get('lessons', {}).get('created')}, Assignments={kpis.get('assignments', {}).get('created')}")
        return success

    def test_monitoring_observations(self):
        """Test GET /api/monitoring/observations"""
        success, response = self.run_test("Observations List", "GET", "monitoring/observations", 200, auth_role="Admin")
        if success:
            observations = response
            print(f"   Found {len(observations)} observations")
        return success

    def test_monitoring_rubric_dimensions(self):
        """Test GET /api/monitoring/rubric-dimensions"""
        success, response = self.run_test("Rubric Dimensions", "GET", "monitoring/rubric-dimensions", 200, auth_role="Admin")
        if success:
            dimensions = response
            print(f"   Found {len(dimensions)} rubric dimensions")
            if dimensions:
                print(f"   Dimensions: {', '.join(dimensions[:3])}...")
        return success

    def test_monitoring_create_observation(self):
        """Test POST /api/monitoring/observations"""
        if not hasattr(self, 'first_teacher_id') or not self.first_teacher_id:
            print("   ⚠️ No teacher ID available for observation creation")
            return False
            
        data = {
            "teacher_id": self.first_teacher_id,
            "class_id": "cls_test", 
            "subject_id": "subj_test",
            "date": "2024-08-15",
            "rubric_scores": {
                "Lesson Structure & Pace": 4,
                "Clarity of Instruction": 4,
                "Student Engagement": 3,
                "Differentiation": 3,
                "Assessment for Learning": 4,
                "Behaviour Management": 4,
                "Use of Resources/Technology": 3,
                "Subject Knowledge": 5,
                "Safeguarding & Professionalism": 5
            },
            "strengths": "Excellent subject knowledge and clear instruction",
            "areas_for_improvement": "Could improve use of technology",
            "action_plan": "Attend EdTech workshop",
            "recommendations": "Continue with current teaching approach"
        }
        success, response = self.run_test("Create Observation", "POST", "monitoring/observations", 200, data=data, auth_role="Admin")
        if success:
            obs_id = response.get('observation_id')
            rating = response.get('overall_rating')
            print(f"   Created observation: {obs_id} (Rating: {rating}/5)")
        return success

    def test_monitoring_lesson_coverage(self):
        """Test GET /api/monitoring/lesson-coverage"""  
        success, response = self.run_test("Lesson Coverage", "GET", "monitoring/lesson-coverage", 200, auth_role="Admin")
        if success:
            planned = response.get('planned_sessions_per_week')
            delivered = response.get('total_lessons_delivered')
            rate = response.get('overall_rate')
            by_subject = response.get('by_subject', [])
            print(f"   Planned: {planned}/week, Delivered: {delivered}, Rate: {rate}%")
            print(f"   Subjects tracked: {len(by_subject)}")
        return success

    def test_monitoring_marking_monitor(self):
        """Test GET /api/monitoring/marking-monitor"""
        success, response = self.run_test("Marking Monitor", "GET", "monitoring/marking-monitor", 200, auth_role="Admin")
        if success:
            assignments = response.get('assignments', [])
            total_ungraded = response.get('total_ungraded')
            overdue_count = response.get('overdue_count')
            print(f"   Assignments: {len(assignments)}, Ungraded: {total_ungraded}, Overdue: {overdue_count}")
        return success

    def test_monitoring_student_outcomes(self):
        """Test GET /api/monitoring/student-outcomes"""
        success, response = self.run_test("Student Outcomes", "GET", "monitoring/student-outcomes", 200, auth_role="Admin")
        if success:
            students = response.get('students', [])
            at_risk_count = response.get('at_risk_count')
            total = response.get('total')
            print(f"   Students: {total}, At Risk: {at_risk_count}")
            if students:
                high_risk = [s for s in students if s.get('risk_level') == 'high']
                print(f"   High risk students: {len(high_risk)}")
        return success

    def test_monitoring_alerts(self):
        """Test GET /api/monitoring/alerts"""
        success, response = self.run_test("Monitoring Alerts", "GET", "monitoring/alerts", 200, auth_role="Admin")
        if success:
            alerts = response.get('alerts', [])
            total = response.get('total')
            high = response.get('high')
            medium = response.get('medium')
            print(f"   Total Alerts: {total}, High: {high}, Medium: {medium}")
            
            # Show breakdown by category
            categories = {}
            for alert in alerts:
                cat = alert.get('category', 'unknown')
                categories[cat] = categories.get(cat, 0) + 1
            if categories:
                print(f"   Categories: {categories}")
        return success

    def test_monitoring_lesson_plans_list(self):
        """Test GET /api/monitoring/lesson-plans"""
        success, response = self.run_test("Lesson Plans List", "GET", "monitoring/lesson-plans", 200, auth_role="Admin")
        if success:
            plans = response
            print(f"   Found {len(plans)} lesson plans")
            statuses = {}
            for plan in plans:
                status = plan.get('status', 'unknown')
                statuses[status] = statuses.get(status, 0) + 1
            if statuses:
                print(f"   Status breakdown: {statuses}")
        return success

    def test_monitoring_submit_lesson_plan(self):
        """Test POST /api/monitoring/lesson-plans"""
        data = {
            "subject_id": "subj_math",
            "class_id": "cls_year7a", 
            "week": "Week 1",
            "topic": "Introduction to Algebra",
            "objectives": "Students will understand basic algebraic concepts",
            "activities": "Group work, individual exercises, Q&A session",
            "resources": "Textbook, whiteboard, worksheets",
            "assessment": "Quiz at end of lesson"
        }
        success, response = self.run_test("Submit Lesson Plan", "POST", "monitoring/lesson-plans", 200, data=data, auth_role="Teacher")
        if success:
            plan_id = response.get('plan_id')
            status = response.get('status')
            print(f"   Created lesson plan: {plan_id} (Status: {status})")
            self.test_plan_id = plan_id
        return success

    def test_monitoring_review_lesson_plan(self):
        """Test POST /api/monitoring/lesson-plans/{id}/review"""
        if not hasattr(self, 'test_plan_id'):
            print("   ⚠️ No lesson plan ID available for review test")
            return False
            
        data = {
            "approved": True,
            "feedback": "Good lesson plan structure and clear objectives"
        }
        success, response = self.run_test("Review Lesson Plan", "POST", f"monitoring/lesson-plans/{self.test_plan_id}/review", 200, data=data, auth_role="Admin")
        if success:
            message = response.get('message')
            print(f"   Review result: {message}")
        return success

def main():
    print("=" * 60)
    print("🎓 TCIS NEXUS Backend API Testing")
    print("=" * 60)
    
    tester = TCISAPITester()
    
    # Test 1: Health check
    print("\n📋 Step 1: Health Check")
    tester.test_health_check()
    
    # Test 2: Authentication for all demo accounts
    print("\n📋 Step 2: Authentication Tests (Updated @tcis.demo accounts)")
    for account in tester.demo_accounts:
        tester.test_login(account["email"], account["password"], account["role"])
    
    # Test 3: Auth verification
    print("\n📋 Step 3: Auth Verification")
    for role in ["Admin", "Teacher", "Student", "Parent", "FinanceOfficer", "HR_Officer"]:
        if role in tester.tokens:
            tester.test_auth_me(role)
    
    # Test 4: Admin endpoints (if admin login successful)
    if "Admin" in tester.tokens:
        print("\n📋 Step 4: Admin API Endpoints")
        tester.test_admin_dashboard()
        tester.test_admin_students() 
        tester.test_admin_staff()
        tester.test_audit_logs()
        
        print("\n📋 Step 5: Core Module API Endpoints")
        tester.test_lms_lessons()
        tester.test_assignments()
        tester.test_finance_invoices()
        tester.test_attendance_classes()
        tester.test_mail_inbox()
        tester.test_tasks()
        
        print("\n📋 Step 6: NEW TCIS NEXUS Features")
        # Global search
        tester.test_global_search()
        
        # HR Module
        tester.test_hr_dashboard()
        tester.test_hr_clock_status()
        
        # Teacher Monitoring
        tester.test_monitoring_kpis()
        tester.test_monitoring_lesson_plans()
        
        # Live Classes
        tester.test_live_sessions_list()
        tester.test_create_live_session()
        
        # Enhanced Tasks with Timer
        tester.test_task_analytics()
        tester.test_create_task()
        tester.test_task_timer_start()
        import time
        time.sleep(2)  # Wait 2 seconds for timer
        tester.test_task_timer_stop()
        tester.test_task_checklist_toggle()
        
        # OUTLOOK MAIL SYSTEM TESTING
        print("\n📋 Step 7: Outlook Mail System Testing")
        tester.test_mail_folders()
        tester.test_mail_contacts() 
        tester.test_mail_threads()
        tester.test_file_upload()
        tester.test_send_message()
        if tester.test_message_id:
            tester.test_thread_detail()
            tester.test_reply_message()
            tester.test_archive_message()
            # Note: Not testing delete as last step to preserve message for other tests

        # MONITORING MODULE TESTING
        print("\n📋 Step 8: Monitoring & Quality Assurance Module")
        tester.test_monitoring_executive_dashboard()
        tester.test_monitoring_teacher_scorecards()
        tester.test_monitoring_teacher_scorecard_detail()
        tester.test_monitoring_observations()
        tester.test_monitoring_rubric_dimensions()
        tester.test_monitoring_create_observation()
        tester.test_monitoring_lesson_coverage()
        tester.test_monitoring_marking_monitor()
        tester.test_monitoring_student_outcomes()
        tester.test_monitoring_alerts()
        tester.test_monitoring_lesson_plans_list()
        
        # Test lesson plan submission as teacher (if teacher login successful)
        if "Teacher" in tester.tokens:
            tester.test_monitoring_submit_lesson_plan()
            tester.test_monitoring_review_lesson_plan()

        # NEW 6 FEATURES TESTING - GRADEBOOK & CPD
        print("\n📋 Step 9: NEW GRADEBOOK FEATURES")
        tester.test_gradebook_settings()
        tester.test_record_grade()
        tester.test_list_grade_entries()
        tester.test_class_gradebook()
        tester.test_report_card_data()
        tester.test_report_card_pdf()

        print("\n📋 Step 10: NEW CPD & PROFESSIONAL DEVELOPMENT FEATURES")
        tester.test_cpd_courses_list()
        tester.test_create_cpd_course()
        if "Teacher" in tester.tokens:
            tester.test_enrol_cpd_course()
            tester.test_my_cpd_courses()

        print("\n📋 Step 11: NEW PERFORMANCE REVIEWS FEATURES") 
        tester.test_performance_reviews_list()
        tester.test_create_performance_review()
        tester.test_submit_performance_review()

        print("\n📋 Step 12: NEW ASSESSMENT VAULT FEATURES")
        tester.test_assessment_papers_list()
        tester.test_create_assessment_paper()
        tester.test_moderate_assessment_paper()
        tester.test_paper_access_log()

        print("\n📋 Step 13: NEW HoD DIGEST FEATURES")
        tester.test_hod_weekly_digest()
        
    else:
        print("\n❌ Skipping admin endpoints - Admin login failed")
    
    # Results summary
    print("\n" + "=" * 60)
    print("📊 BACKEND TEST RESULTS")
    print("=" * 60)
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"Success rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("🟢 Backend APIs are working well!")
        return 0
    elif success_rate >= 50:
        print("🟡 Backend APIs have some issues but mostly functional")
        return 1
    else:
        print("🔴 Backend APIs have major issues")
        return 2

if __name__ == "__main__":
    sys.exit(main())