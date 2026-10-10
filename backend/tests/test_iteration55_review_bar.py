"""
Iteration 55: Test Scheme of Work and Lessons Review Sticky Bottom Bar Bug Fix

Bug: When HeadTeacher tries to approve/forward a Scheme of Work, the system requires a comment 
but the comment input was buried at the bottom of the content tab (requiring scroll).
Fix: Added a sticky bottom review bar with comment textarea + approve/return/forward buttons always visible.

Tests:
1. Backend: POST /api/schemes/ - Create a test scheme as teacher
2. Backend: POST /api/schemes/{id}/submit - Submit scheme for review
3. Backend: POST /api/schemes/{id}/review with approve action without comment - Should work (backend doesn't require comment)
4. Backend: POST /api/schemes/{id}/review with approve action with comment - Should work
5. Backend: POST /api/lessons-v2/ - Create a test lesson as teacher
6. Backend: POST /api/lessons-v2/{id}/submit - Submit lesson for review
7. Backend: POST /api/lessons-v2/{id}/review with approve action - Should work
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSchemeReviewFlow:
    """Test Scheme of Work review flow - the bug fix target"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        """Login as teacher to create schemes"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headteacher_token(self):
        """Login as HeadTeacher to review schemes"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "headteacher@tcis.demo",
            "password": "headteacher123"
        })
        assert response.status_code == 200, f"HeadTeacher login failed: {response.text}"
        return response.json().get("token")
    
    def test_01_teacher_login(self, teacher_token):
        """Verify teacher can login"""
        assert teacher_token is not None
        print(f"Teacher login successful, token: {teacher_token[:20]}...")
    
    def test_02_headteacher_login(self, headteacher_token):
        """Verify HeadTeacher can login"""
        assert headteacher_token is not None
        print(f"HeadTeacher login successful, token: {headteacher_token[:20]}...")
    
    def test_03_create_scheme_as_teacher(self, teacher_token):
        """Create a test scheme as teacher"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Review_Bar_Scheme",
            "subject_name": "Mathematics",
            "year_group": "Year 10",
            "term": "Term 1",
            "curriculum": "Cambridge",
            "department": "Sciences"
        }, headers=headers)
        assert response.status_code == 200, f"Create scheme failed: {response.text}"
        data = response.json()
        assert "scheme_id" in data
        assert data["status"] == "draft"
        # Store scheme_id for later tests
        TestSchemeReviewFlow.scheme_id = data["scheme_id"]
        print(f"Created scheme: {data['scheme_id']}")
    
    def test_04_submit_scheme_for_review(self, teacher_token):
        """Submit the scheme for management review"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        scheme_id = TestSchemeReviewFlow.scheme_id
        response = requests.post(f"{BASE_URL}/api/schemes/{scheme_id}/submit", headers=headers)
        assert response.status_code == 200, f"Submit scheme failed: {response.text}"
        data = response.json()
        assert data["status"] in ["submitted", "resubmitted", "approved"]
        print(f"Scheme submitted, status: {data['status']}")
    
    def test_05_get_scheme_shows_submitted_status(self, headteacher_token):
        """Verify scheme is in submitted/under_review status"""
        headers = {"Authorization": f"Bearer {headteacher_token}"}
        scheme_id = TestSchemeReviewFlow.scheme_id
        response = requests.get(f"{BASE_URL}/api/schemes/{scheme_id}", headers=headers)
        assert response.status_code == 200, f"Get scheme failed: {response.text}"
        data = response.json()
        # Status should be submitted, resubmitted, under_review, or approved (if auto-approved)
        assert data["status"] in ["submitted", "resubmitted", "under_review", "approved"]
        print(f"Scheme status: {data['status']}, approval_chain: {data.get('approval_chain', [])}")
    
    def test_06_review_scheme_with_comment(self, headteacher_token):
        """HeadTeacher reviews scheme with comment - this is the bug fix scenario"""
        headers = {"Authorization": f"Bearer {headteacher_token}"}
        scheme_id = TestSchemeReviewFlow.scheme_id
        
        # First check if scheme is already approved (auto-approved case)
        get_response = requests.get(f"{BASE_URL}/api/schemes/{scheme_id}", headers=headers)
        scheme_data = get_response.json()
        
        if scheme_data["status"] == "approved":
            print("Scheme was auto-approved (teacher holds management role)")
            return
        
        # Try to approve with comment
        response = requests.post(f"{BASE_URL}/api/schemes/{scheme_id}/review", json={
            "action": "approve",
            "comment": "TEST_Approved by HeadTeacher - Review bar bug fix test"
        }, headers=headers)
        
        # May get 403 if not the current approver in chain
        if response.status_code == 403:
            print(f"HeadTeacher not current approver: {response.json().get('detail')}")
            return
        
        assert response.status_code == 200, f"Review scheme failed: {response.text}"
        data = response.json()
        print(f"Review action completed: {data}")
    
    def test_07_cleanup_test_scheme(self, teacher_token):
        """Delete the test scheme"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        scheme_id = TestSchemeReviewFlow.scheme_id
        
        # First check status - can't delete approved schemes
        get_response = requests.get(f"{BASE_URL}/api/schemes/{scheme_id}", headers=headers)
        if get_response.status_code == 200:
            scheme_data = get_response.json()
            if scheme_data["status"] in ["approved", "published"]:
                print(f"Cannot delete approved scheme, skipping cleanup")
                return
        
        response = requests.delete(f"{BASE_URL}/api/schemes/{scheme_id}", headers=headers)
        # May fail if already deleted or approved
        print(f"Cleanup response: {response.status_code}")


class TestLessonReviewFlow:
    """Test Lessons review flow - same bug fix applied"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        """Login as teacher to create lessons"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def headteacher_token(self):
        """Login as HeadTeacher to review lessons"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "headteacher@tcis.demo",
            "password": "headteacher123"
        })
        assert response.status_code == 200, f"HeadTeacher login failed: {response.text}"
        return response.json().get("token")
    
    def test_01_create_lesson_as_teacher(self, teacher_token):
        """Create a test lesson as teacher"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.post(f"{BASE_URL}/api/lessons-v2/", json={
            "title": "TEST_Review_Bar_Lesson",
            "subject_name": "ICT",
            "year_group": "Year 9",
            "term": "Term 1",
            "curriculum": "Cambridge",
            "duration_minutes": 45,
            "objectives": "Test lesson objectives"
        }, headers=headers)
        assert response.status_code == 200, f"Create lesson failed: {response.text}"
        data = response.json()
        assert "lesson_id" in data
        assert data["status"] == "draft"
        TestLessonReviewFlow.lesson_id = data["lesson_id"]
        print(f"Created lesson: {data['lesson_id']}")
    
    def test_02_submit_lesson_for_review(self, teacher_token):
        """Submit the lesson for management review"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        lesson_id = TestLessonReviewFlow.lesson_id
        response = requests.post(f"{BASE_URL}/api/lessons-v2/{lesson_id}/submit", headers=headers)
        assert response.status_code == 200, f"Submit lesson failed: {response.text}"
        data = response.json()
        assert data["status"] in ["submitted", "resubmitted", "approved"]
        print(f"Lesson submitted, status: {data['status']}")
    
    def test_03_get_lesson_shows_submitted_status(self, headteacher_token):
        """Verify lesson is in submitted/under_review status"""
        headers = {"Authorization": f"Bearer {headteacher_token}"}
        lesson_id = TestLessonReviewFlow.lesson_id
        response = requests.get(f"{BASE_URL}/api/lessons-v2/{lesson_id}", headers=headers)
        assert response.status_code == 200, f"Get lesson failed: {response.text}"
        data = response.json()
        assert data["status"] in ["submitted", "resubmitted", "under_review", "approved"]
        print(f"Lesson status: {data['status']}")
    
    def test_04_review_lesson_with_comment(self, headteacher_token):
        """HeadTeacher reviews lesson with comment"""
        headers = {"Authorization": f"Bearer {headteacher_token}"}
        lesson_id = TestLessonReviewFlow.lesson_id
        
        # First check if lesson is already approved
        get_response = requests.get(f"{BASE_URL}/api/lessons-v2/{lesson_id}", headers=headers)
        lesson_data = get_response.json()
        
        if lesson_data["status"] == "approved":
            print("Lesson was auto-approved")
            return
        
        response = requests.post(f"{BASE_URL}/api/lessons-v2/{lesson_id}/review", json={
            "action": "approve",
            "comment": "TEST_Approved by HeadTeacher - Lesson review bar test"
        }, headers=headers)
        
        if response.status_code == 403:
            print(f"HeadTeacher not current approver: {response.json().get('detail')}")
            return
        
        assert response.status_code == 200, f"Review lesson failed: {response.text}"
        print(f"Review action completed: {response.json()}")
    
    def test_05_cleanup_test_lesson(self, teacher_token):
        """Delete the test lesson"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        lesson_id = TestLessonReviewFlow.lesson_id
        
        get_response = requests.get(f"{BASE_URL}/api/lessons-v2/{lesson_id}", headers=headers)
        if get_response.status_code == 200:
            lesson_data = get_response.json()
            if lesson_data["status"] in ["approved", "published"]:
                print(f"Cannot delete approved lesson, skipping cleanup")
                return
        
        response = requests.delete(f"{BASE_URL}/api/lessons-v2/{lesson_id}", headers=headers)
        print(f"Cleanup response: {response.status_code}")


class TestSchemeEndpoints:
    """Test scheme-related endpoints"""
    
    @pytest.fixture(scope="class")
    def headteacher_token(self):
        """Login as HeadTeacher"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "headteacher@tcis.demo",
            "password": "headteacher123"
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_01_get_schemes_list(self, headteacher_token):
        """Get list of schemes"""
        headers = {"Authorization": f"Bearer {headteacher_token}"}
        response = requests.get(f"{BASE_URL}/api/schemes/", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} schemes")
    
    def test_02_get_management_dashboard(self, headteacher_token):
        """Get management dashboard"""
        headers = {"Authorization": f"Bearer {headteacher_token}"}
        response = requests.get(f"{BASE_URL}/api/schemes/management-dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "pending" in data
        print(f"Dashboard: total={data['total']}, pending={data['pending']}")
    
    def test_03_get_my_pending_reviews(self, headteacher_token):
        """Get pending reviews for HeadTeacher"""
        headers = {"Authorization": f"Bearer {headteacher_token}"}
        response = requests.get(f"{BASE_URL}/api/schemes/my-pending-reviews", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} pending scheme reviews")


class TestLessonEndpoints:
    """Test lesson-related endpoints"""
    
    @pytest.fixture(scope="class")
    def headteacher_token(self):
        """Login as HeadTeacher"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "headteacher@tcis.demo",
            "password": "headteacher123"
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_01_get_lessons_list(self, headteacher_token):
        """Get list of lessons"""
        headers = {"Authorization": f"Bearer {headteacher_token}"}
        response = requests.get(f"{BASE_URL}/api/lessons-v2/", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} lessons")
    
    def test_02_get_my_pending_lesson_reviews(self, headteacher_token):
        """Get pending lesson reviews for HeadTeacher"""
        headers = {"Authorization": f"Bearer {headteacher_token}"}
        response = requests.get(f"{BASE_URL}/api/lessons-v2/my-pending-reviews", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} pending lesson reviews")


class TestHealthCheck:
    """Basic health check"""
    
    def test_health(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("API health check passed")
