"""
Test suite for Lessons V2 module - TCIS LMS
Tests: Staff View, Management View, CRUD operations, Submit/Review workflow, Compliance tracking
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/')

# Test credentials
TEACHER_EMAIL = "edmund@tcis.demo"
TEACHER_PASSWORD = "teacher123"
SUPERADMIN_EMAIL = "dwain@tcis.demo"
SUPERADMIN_PASSWORD = "admin123"


class TestLessonsV2Auth:
    """Authentication and basic access tests"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        """Get teacher auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        data = response.json()
        assert "token" in data
        return data["token"]
    
    @pytest.fixture(scope="class")
    def superadmin_token(self):
        """Get superadmin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200, f"SuperAdmin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        return data["token"]
    
    def test_teacher_login(self, teacher_token):
        """Verify teacher can login"""
        assert teacher_token is not None
        assert len(teacher_token) > 0
        print(f"âœ“ Teacher login successful")
    
    def test_superadmin_login(self, superadmin_token):
        """Verify superadmin can login"""
        assert superadmin_token is not None
        assert len(superadmin_token) > 0
        print(f"âœ“ SuperAdmin login successful")


class TestStaffDashboard:
    """Staff View dashboard tests"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL, "password": TEACHER_PASSWORD
        })
        return response.json()["token"]
    
    def test_my_dashboard_returns_stats(self, teacher_token):
        """GET /api/lessons-v2/my-dashboard returns dashboard stats"""
        response = requests.get(
            f"{BASE_URL}/api/lessons-v2/my-dashboard",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Verify all expected fields
        assert "total" in data, "Missing 'total' field"
        assert "term_lessons" in data, "Missing 'term_lessons' field"
        assert "drafts" in data, "Missing 'drafts' field"
        assert "submitted" in data, "Missing 'submitted' field"
        assert "returned" in data, "Missing 'returned' field"
        assert "approved" in data, "Missing 'approved' field"
        assert "active_term" in data, "Missing 'active_term' field"
        
        # Verify types
        assert isinstance(data["total"], int)
        assert isinstance(data["drafts"], int)
        assert isinstance(data["submitted"], int)
        assert isinstance(data["returned"], int)
        assert isinstance(data["approved"], int)
        
        print(f"âœ“ Staff dashboard: Total={data['total']}, Drafts={data['drafts']}, Submitted={data['submitted']}, Approved={data['approved']}")
    
    def test_list_my_lessons(self, teacher_token):
        """GET /api/lessons-v2/ returns teacher's lessons"""
        response = requests.get(
            f"{BASE_URL}/api/lessons-v2/",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"List lessons failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of lessons"
        print(f"âœ“ Teacher has {len(data)} lessons")
        
        # If there are lessons, verify structure
        if len(data) > 0:
            lesson = data[0]
            assert "lesson_id" in lesson
            assert "title" in lesson
            assert "status" in lesson
            assert "teacher_id" in lesson
            print(f"  First lesson: '{lesson['title']}' - Status: {lesson['status']}")


class TestLessonCRUD:
    """Create, Read, Update, Delete lesson tests"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL, "password": TEACHER_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def created_lesson_id(self, teacher_token):
        """Create a test lesson and return its ID"""
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={
                "title": "TEST_Lesson_Pytest_Create",
                "subject_name": "Information Technology",
                "year_group": "Year 7",
                "objectives": "Test objectives for pytest",
                "description": "Test lesson created by pytest",
                "duration_minutes": 45,
                "curriculum": "Cambridge"
            }
        )
        assert response.status_code == 200, f"Create lesson failed: {response.text}"
        data = response.json()
        assert "lesson_id" in data
        return data["lesson_id"]
    
    def test_create_lesson(self, teacher_token, created_lesson_id):
        """POST /api/lessons-v2/ creates a new lesson"""
        assert created_lesson_id is not None
        assert created_lesson_id.startswith("lsn_")
        print(f"âœ“ Created lesson: {created_lesson_id}")
    
    def test_get_lesson_by_id(self, teacher_token, created_lesson_id):
        """GET /api/lessons-v2/{id} returns lesson details"""
        response = requests.get(
            f"{BASE_URL}/api/lessons-v2/{created_lesson_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Get lesson failed: {response.text}"
        data = response.json()
        
        assert data["lesson_id"] == created_lesson_id
        assert data["title"] == "TEST_Lesson_Pytest_Create"
        assert data["status"] == "draft"
        assert "comments" in data
        assert "audit_trail" in data
        print(f"âœ“ Retrieved lesson: {data['title']} - Status: {data['status']}")
    
    def test_update_lesson(self, teacher_token, created_lesson_id):
        """PUT /api/lessons-v2/{id} updates lesson"""
        response = requests.put(
            f"{BASE_URL}/api/lessons-v2/{created_lesson_id}",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={
                "title": "TEST_Lesson_Pytest_Updated",
                "rich_content": "<h2>Updated Content</h2><p>This is updated lesson content.</p>",
                "objectives": "Updated objectives"
            }
        )
        assert response.status_code == 200, f"Update lesson failed: {response.text}"
        data = response.json()
        
        assert data["title"] == "TEST_Lesson_Pytest_Updated"
        assert data["status"] == "in_progress"  # Should change from draft to in_progress
        print(f"âœ“ Updated lesson: {data['title']} - Status: {data['status']}")
    
    def test_verify_update_persisted(self, teacher_token, created_lesson_id):
        """Verify update was persisted in database"""
        response = requests.get(
            f"{BASE_URL}/api/lessons-v2/{created_lesson_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["title"] == "TEST_Lesson_Pytest_Updated"
        assert "Updated Content" in data.get("rich_content", "")
        print(f"âœ“ Update persisted correctly")


class TestSubmitWorkflow:
    """Submit and review workflow tests"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL, "password": TEACHER_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def superadmin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def workflow_lesson_id(self, teacher_token):
        """Create a lesson for workflow testing"""
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={
                "title": "TEST_Workflow_Lesson",
                "subject_name": "Information Technology",
                "year_group": "Year 8",
                "objectives": "Workflow test objectives",
                "rich_content": "<h2>Lesson Content</h2><p>Content for workflow testing.</p>",
                "duration_minutes": 60
            }
        )
        assert response.status_code == 200
        return response.json()["lesson_id"]
    
    def test_submit_lesson(self, teacher_token, workflow_lesson_id):
        """POST /api/lessons-v2/{id}/submit submits lesson to management"""
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/{workflow_lesson_id}/submit",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Submit failed: {response.text}"
        data = response.json()
        
        assert data["status"] == "submitted"
        print(f"âœ“ Lesson submitted successfully")
        
        # Verify status changed
        get_response = requests.get(
            f"{BASE_URL}/api/lessons-v2/{workflow_lesson_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert get_response.json()["status"] == "submitted"
    
    def test_cannot_submit_already_submitted(self, teacher_token, workflow_lesson_id):
        """Cannot submit an already submitted lesson"""
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/{workflow_lesson_id}/submit",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 400, "Should fail for already submitted lesson"
        print(f"âœ“ Correctly rejected re-submission")
    
    def test_management_start_review(self, superadmin_token, workflow_lesson_id):
        """POST /api/lessons-v2/{id}/review with action=start_review"""
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/{workflow_lesson_id}/review",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"action": "start_review"}
        )
        assert response.status_code == 200, f"Start review failed: {response.text}"
        
        # Verify status changed to under_review
        get_response = requests.get(
            f"{BASE_URL}/api/lessons-v2/{workflow_lesson_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert get_response.json()["status"] == "under_review"
        print(f"âœ“ Review started - Status: under_review")
    
    def test_management_return_lesson(self, superadmin_token, workflow_lesson_id):
        """POST /api/lessons-v2/{id}/review with action=return"""
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/{workflow_lesson_id}/review",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "action": "return",
                "comment": "Please add more detail to the activities section."
            }
        )
        assert response.status_code == 200, f"Return failed: {response.text}"
        
        # Verify status changed to returned
        get_response = requests.get(
            f"{BASE_URL}/api/lessons-v2/{workflow_lesson_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert get_response.json()["status"] == "returned"
        print(f"âœ“ Lesson returned with feedback")
    
    def test_resubmit_lesson(self, teacher_token, workflow_lesson_id):
        """Teacher can resubmit a returned lesson"""
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/{workflow_lesson_id}/submit",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Resubmit failed: {response.text}"
        data = response.json()
        
        assert data["status"] == "resubmitted"
        print(f"âœ“ Lesson resubmitted")


class TestManagementDashboard:
    """Management View dashboard tests"""
    
    @pytest.fixture(scope="class")
    def superadmin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL, "password": TEACHER_PASSWORD
        })
        return response.json()["token"]
    
    def test_management_dashboard_returns_stats(self, superadmin_token):
        """GET /api/lessons-v2/management-dashboard returns management stats"""
        response = requests.get(
            f"{BASE_URL}/api/lessons-v2/management-dashboard",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200, f"Management dashboard failed: {response.text}"
        data = response.json()
        
        # Verify all expected fields
        assert "total" in data, "Missing 'total' field"
        assert "pending" in data, "Missing 'pending' field"
        assert "under_review" in data, "Missing 'under_review' field"
        assert "approved" in data, "Missing 'approved' field"
        assert "returned" in data, "Missing 'returned' field"
        assert "overdue_staff" in data, "Missing 'overdue_staff' field"
        assert "active_term" in data, "Missing 'active_term' field"
        
        print(f"âœ“ Management dashboard: Total={data['total']}, Pending={data['pending']}, Approved={data['approved']}")
    
    def test_teacher_cannot_access_management_dashboard(self, teacher_token):
        """Teacher should not access management dashboard"""
        response = requests.get(
            f"{BASE_URL}/api/lessons-v2/management-dashboard",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 403, "Teacher should not access management dashboard"
        print(f"âœ“ Teacher correctly denied management dashboard access")
    
    def test_management_list_all_submitted(self, superadmin_token):
        """Management can list all submitted lessons"""
        response = requests.get(
            f"{BASE_URL}/api/lessons-v2/?status=all_submitted",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200, f"List submitted failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        # All returned lessons should not be drafts
        for lesson in data:
            assert lesson["status"] != "draft", f"Draft lesson in submitted list: {lesson['lesson_id']}"
        
        print(f"âœ“ Management sees {len(data)} submitted lessons")


class TestComplianceTracker:
    """Compliance tracking tests"""
    
    @pytest.fixture(scope="class")
    def superadmin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL, "password": TEACHER_PASSWORD
        })
        return response.json()["token"]
    
    def test_compliance_tracker_returns_data(self, superadmin_token):
        """GET /api/lessons-v2/management/compliance returns compliance data"""
        response = requests.get(
            f"{BASE_URL}/api/lessons-v2/management/compliance",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200, f"Compliance tracker failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        if len(data) > 0:
            teacher = data[0]
            assert "user_id" in teacher
            assert "name" in teacher
            assert "required" in teacher
            assert "submitted" in teacher
            assert "approved" in teacher
            assert "rate" in teacher
            print(f"âœ“ Compliance tracker: {len(data)} teachers tracked")
            print(f"  First teacher: {teacher['name']} - Rate: {teacher['rate']}%")
        else:
            print(f"âœ“ Compliance tracker returned empty list (no teachers with Teacher role)")
    
    def test_teacher_cannot_access_compliance(self, teacher_token):
        """Teacher should not access compliance tracker"""
        response = requests.get(
            f"{BASE_URL}/api/lessons-v2/management/compliance",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 403, "Teacher should not access compliance tracker"
        print(f"âœ“ Teacher correctly denied compliance tracker access")


class TestComments:
    """Comment functionality tests"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL, "password": TEACHER_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def comment_lesson_id(self, teacher_token):
        """Create a lesson for comment testing"""
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={
                "title": "TEST_Comment_Lesson",
                "subject_name": "Information Technology",
                "year_group": "Year 9"
            }
        )
        return response.json()["lesson_id"]
    
    def test_add_comment(self, teacher_token, comment_lesson_id):
        """POST /api/lessons-v2/{id}/comments adds a comment"""
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/{comment_lesson_id}/comments",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={"text": "This is a test comment from pytest"}
        )
        assert response.status_code == 200, f"Add comment failed: {response.text}"
        print(f"âœ“ Comment added successfully")
    
    def test_verify_comment_persisted(self, teacher_token, comment_lesson_id):
        """Verify comment was persisted"""
        response = requests.get(
            f"{BASE_URL}/api/lessons-v2/{comment_lesson_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "comments" in data
        assert len(data["comments"]) > 0
        assert any("test comment from pytest" in c.get("text", "") for c in data["comments"])
        print(f"âœ“ Comment persisted: {len(data['comments'])} comments on lesson")


class TestDeleteLesson:
    """Delete lesson tests"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL, "password": TEACHER_PASSWORD
        })
        return response.json()["token"]
    
    def test_delete_draft_lesson(self, teacher_token):
        """DELETE /api/lessons-v2/{id} deletes a draft lesson"""
        # Create a lesson to delete
        create_response = requests.post(
            f"{BASE_URL}/api/lessons-v2/",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={
                "title": "TEST_Delete_Me",
                "subject_name": "Information Technology",
                "year_group": "Year 7"
            }
        )
        assert create_response.status_code == 200
        lesson_id = create_response.json()["lesson_id"]
        
        # Delete the lesson
        delete_response = requests.delete(
            f"{BASE_URL}/api/lessons-v2/{lesson_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        print(f"âœ“ Lesson deleted successfully")
        
        # Verify it's gone
        get_response = requests.get(
            f"{BASE_URL}/api/lessons-v2/{lesson_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert get_response.status_code == 404, "Deleted lesson should return 404"
        print(f"âœ“ Deleted lesson returns 404")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL, "password": TEACHER_PASSWORD
        })
        return response.json()["token"]
    
    def test_cleanup_test_lessons(self, teacher_token):
        """Delete all TEST_ prefixed lessons"""
        # Get all lessons
        response = requests.get(
            f"{BASE_URL}/api/lessons-v2/",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        if response.status_code != 200:
            print("âœ“ Cleanup skipped - could not list lessons")
            return
        
        lessons = response.json()
        deleted = 0
        for lesson in lessons:
            if lesson.get("title", "").startswith("TEST_"):
                # Only delete if not approved/published
                if lesson.get("status") not in ("approved", "published"):
                    del_response = requests.delete(
                        f"{BASE_URL}/api/lessons-v2/{lesson['lesson_id']}",
                        headers={"Authorization": f"Bearer {teacher_token}"}
                    )
                    if del_response.status_code == 200:
                        deleted += 1
        
        print(f"âœ“ Cleanup: Deleted {deleted} test lessons")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

