"""
Test Teacher My Monitoring (My Performance) Feature - Iteration 28
Tests the GET /api/monitoring/my-review endpoint for teacher self-review
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEACHER_EMAIL = "edmund@tcis.demo"
TEACHER_PASSWORD = "teacher123"
SUPERADMIN_EMAIL = "dwain@tcis.demo"
SUPERADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def teacher_token():
    """Get teacher authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    assert response.status_code == 200, f"Teacher login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def superadmin_token():
    """Get superadmin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    assert response.status_code == 200, f"SuperAdmin login failed: {response.text}"
    return response.json().get("token")


class TestMyReviewEndpoint:
    """Tests for GET /api/monitoring/my-review - Teacher sees their own data"""
    
    def test_teacher_can_access_my_review(self, teacher_token):
        """Teacher can access their own monitoring data"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "teacher" in data, "Response should contain teacher info"
        assert "scorecard" in data, "Response should contain scorecard"
        assert "activity_metrics" in data, "Response should contain activity_metrics"
        assert "management_comments" in data, "Response should contain management_comments"
        assert "summary" in data, "Response should contain summary"
        print(f"✓ Teacher can access my-review endpoint")
    
    def test_my_review_returns_teacher_info(self, teacher_token):
        """My-review returns correct teacher information"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        teacher = data.get("teacher", {})
        assert teacher.get("email") == TEACHER_EMAIL, "Should return logged-in teacher's data"
        assert "name" in teacher, "Teacher should have name"
        assert "role" in teacher, "Teacher should have role"
        assert teacher.get("role") == "Teacher", "Role should be Teacher"
        print(f"✓ My-review returns correct teacher info: {teacher.get('name')}")
    
    def test_my_review_contains_activity_metrics(self, teacher_token):
        """My-review contains activity metrics with breakdown"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        metrics = data.get("activity_metrics", {})
        assert "overall_score" in metrics, "Should have overall_score"
        assert "activity_level" in metrics, "Should have activity_level"
        assert "breakdown" in metrics, "Should have breakdown"
        
        breakdown = metrics.get("breakdown", {})
        expected_metrics = ["lessons", "assignments", "plans", "files", "clock_hours", "grading", "platform_activity"]
        for metric in expected_metrics:
            assert metric in breakdown, f"Breakdown should contain {metric}"
        
        print(f"✓ Activity metrics present: score={metrics.get('overall_score')}, level={metrics.get('activity_level')}")
    
    def test_my_review_contains_management_comments(self, teacher_token):
        """My-review contains management comments left about the teacher"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        comments = data.get("management_comments", [])
        assert isinstance(comments, list), "management_comments should be a list"
        
        # Based on iteration_27, Edmund has 2 comments
        if len(comments) > 0:
            comment = comments[0]
            assert "comment_id" in comment, "Comment should have comment_id"
            assert "author_name" in comment, "Comment should have author_name"
            assert "author_role" in comment, "Comment should have author_role"
            assert "category" in comment, "Comment should have category"
            assert "text" in comment, "Comment should have text"
            assert "created_at" in comment, "Comment should have created_at"
        
        print(f"✓ Management comments present: {len(comments)} comments")
    
    def test_my_review_contains_lessons(self, teacher_token):
        """My-review contains teacher's lessons"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        lessons = data.get("lessons", [])
        assert isinstance(lessons, list), "lessons should be a list"
        print(f"✓ Lessons present: {len(lessons)} lessons")
    
    def test_my_review_contains_lesson_plans(self, teacher_token):
        """My-review contains teacher's lesson plans"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        plans = data.get("lesson_plans", [])
        assert isinstance(plans, list), "lesson_plans should be a list"
        print(f"✓ Lesson plans present: {len(plans)} plans")
    
    def test_my_review_contains_assignments(self, teacher_token):
        """My-review contains teacher's assignments"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assignments = data.get("assignments", [])
        assert isinstance(assignments, list), "assignments should be a list"
        print(f"✓ Assignments present: {len(assignments)} assignments")
    
    def test_my_review_contains_uploaded_files(self, teacher_token):
        """My-review contains teacher's uploaded files"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        files = data.get("uploaded_files", [])
        assert isinstance(files, list), "uploaded_files should be a list"
        print(f"✓ Uploaded files present: {len(files)} files")
    
    def test_my_review_contains_staff_documents(self, teacher_token):
        """My-review contains teacher's staff documents"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        docs = data.get("staff_documents", [])
        assert isinstance(docs, list), "staff_documents should be a list"
        print(f"✓ Staff documents present: {len(docs)} docs")
    
    def test_my_review_contains_clock_history(self, teacher_token):
        """My-review contains teacher's clock history"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        clock = data.get("clock_history", [])
        assert isinstance(clock, list), "clock_history should be a list"
        print(f"✓ Clock history present: {len(clock)} entries")
    
    def test_my_review_contains_remarks(self, teacher_token):
        """My-review contains teacher's remarks"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        remarks = data.get("remarks", [])
        assert isinstance(remarks, list), "remarks should be a list"
        print(f"✓ Remarks present: {len(remarks)} remarks")
    
    def test_my_review_contains_summary(self, teacher_token):
        """My-review contains summary with counts"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        expected_fields = ["total_lessons", "total_plans", "total_assignments", "total_files", "total_staff_docs", "total_remarks", "total_wp_docs"]
        for field in expected_fields:
            assert field in summary, f"Summary should contain {field}"
        
        print(f"✓ Summary present: lessons={summary.get('total_lessons')}, files={summary.get('total_files')}")
    
    def test_my_review_contains_scorecard(self, teacher_token):
        """My-review contains scorecard with KPIs"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        scorecard = data.get("scorecard", {})
        assert "kpis" in scorecard, "Scorecard should contain kpis"
        
        kpis = scorecard.get("kpis", {})
        expected_kpis = ["lesson_plans", "lessons", "assignments", "marking", "observations"]
        for kpi in expected_kpis:
            assert kpi in kpis, f"KPIs should contain {kpi}"
        
        print(f"✓ Scorecard KPIs present")


class TestTeacherCannotModifyComments:
    """Tests that teacher cannot create/delete/pin management comments"""
    
    def test_teacher_cannot_post_comment(self, teacher_token):
        """Teacher cannot post management comments (403)"""
        # First get teacher's own ID
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        teacher_id = me_response.json().get("user_id")
        
        response = requests.post(
            f"{BASE_URL}/api/monitoring/teacher-comments/{teacher_id}",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={"text": "Test comment from teacher", "category": "general"}
        )
        assert response.status_code == 403, f"Teacher should not be able to post comments: {response.status_code}"
        print(f"✓ Teacher cannot post management comments (403)")
    
    def test_teacher_cannot_delete_comment(self, teacher_token):
        """Teacher cannot delete management comments (403)"""
        response = requests.delete(
            f"{BASE_URL}/api/monitoring/teacher-comments/mc_test123",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        # Should be 403 (forbidden) not 404 (not found)
        assert response.status_code == 403, f"Teacher should not be able to delete comments: {response.status_code}"
        print(f"✓ Teacher cannot delete management comments (403)")
    
    def test_teacher_cannot_pin_comment(self, teacher_token):
        """Teacher cannot pin management comments (403)"""
        response = requests.patch(
            f"{BASE_URL}/api/monitoring/teacher-comments/mc_test123/pin",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 403, f"Teacher should not be able to pin comments: {response.status_code}"
        print(f"✓ Teacher cannot pin management comments (403)")


class TestAdminMonitoringStillWorks:
    """Tests that admin monitoring at /admin/monitoring still works"""
    
    def test_superadmin_can_access_executive_dashboard(self, superadmin_token):
        """SuperAdmin can access executive dashboard"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/executive-dashboard",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "academic" in data, "Should have academic data"
        assert "finance" in data, "Should have finance data"
        print(f"✓ SuperAdmin can access executive dashboard")
    
    def test_superadmin_can_access_teacher_scorecards(self, superadmin_token):
        """SuperAdmin can access teacher scorecards"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/teacher-scorecards",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return list of scorecards"
        print(f"✓ SuperAdmin can access teacher scorecards: {len(data)} teachers")
    
    def test_superadmin_can_access_teacher_full_review(self, superadmin_token, teacher_token):
        """SuperAdmin can access full teacher review"""
        # Get teacher ID
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        teacher_id = me_response.json().get("user_id")
        
        response = requests.get(
            f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "teacher" in data, "Should have teacher data"
        assert "activity_metrics" in data, "Should have activity_metrics"
        assert "management_comments" in data, "Should have management_comments"
        print(f"✓ SuperAdmin can access teacher full review")
    
    def test_superadmin_can_post_comment(self, superadmin_token, teacher_token):
        """SuperAdmin can post management comments"""
        # Get teacher ID
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        teacher_id = me_response.json().get("user_id")
        
        response = requests.post(
            f"{BASE_URL}/api/monitoring/teacher-comments/{teacher_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"text": "Test comment from SuperAdmin for iteration 28", "category": "performance"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "comment_id" in data, "Should return comment_id"
        print(f"✓ SuperAdmin can post management comments: {data.get('comment_id')}")
        
        # Clean up - delete the test comment
        requests.delete(
            f"{BASE_URL}/api/monitoring/teacher-comments/{data.get('comment_id')}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )


class TestMyReviewDataIntegrity:
    """Tests that my-review returns correct data for the logged-in teacher"""
    
    def test_my_review_returns_own_data_only(self, teacher_token):
        """My-review returns only the logged-in teacher's data"""
        # Get teacher info
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        teacher_id = me_response.json().get("user_id")
        
        # Get my-review data
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify teacher ID matches
        assert data.get("teacher", {}).get("user_id") == teacher_id, "Should return own data"
        print(f"✓ My-review returns own data only: {teacher_id}")
    
    def test_unauthenticated_cannot_access_my_review(self):
        """Unauthenticated user cannot access my-review"""
        response = requests.get(f"{BASE_URL}/api/monitoring/my-review")
        assert response.status_code in [401, 403], f"Should be unauthorized: {response.status_code}"
        print(f"✓ Unauthenticated cannot access my-review")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
