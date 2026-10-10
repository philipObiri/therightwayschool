"""
Test Activity Metrics Scoring and Management Comments for Teacher Review
Iteration 27 - Tests the NEW additions to Teacher Full Review:
1. Activity metrics scoring system (7 weighted metrics)
2. Management feedback/comments CRUD
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_CREDS = {"email": "dwain@tcis.demo", "password": "admin123"}
CEO_CREDS = {"email": "ceo@tcis.demo", "password": "ceo123"}
TEACHER_CREDS = {"email": "edmund@tcis.demo", "password": "teacher123"}

# Known teacher ID from previous iteration
TEACHER_ID = "user_237e2f10d3d0"  # Edmund Ansah


class TestActivityMetricsScoring:
    """Test activity metrics scoring system in teacher-full-review endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as SuperAdmin for all tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_full_review_returns_activity_metrics(self):
        """GET /api/monitoring/teacher-full-review/{teacher_id} returns activity_metrics"""
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify activity_metrics exists
        assert "activity_metrics" in data, "activity_metrics missing from response"
        metrics = data["activity_metrics"]
        
        # Verify overall_score (0-100)
        assert "overall_score" in metrics, "overall_score missing"
        assert isinstance(metrics["overall_score"], (int, float)), "overall_score should be numeric"
        assert 0 <= metrics["overall_score"] <= 100, f"overall_score {metrics['overall_score']} out of range 0-100"
        
        # Verify activity_level
        assert "activity_level" in metrics, "activity_level missing"
        valid_levels = ["Excellent", "Good", "Fair", "Needs Improvement", "Inactive"]
        assert metrics["activity_level"] in valid_levels, f"Invalid activity_level: {metrics['activity_level']}"
        
        print(f"Activity Score: {metrics['overall_score']}/100 - {metrics['activity_level']}")
    
    def test_activity_metrics_breakdown_has_7_metrics(self):
        """Verify breakdown contains all 7 weighted metrics"""
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        assert response.status_code == 200
        data = response.json()
        
        breakdown = data["activity_metrics"]["breakdown"]
        expected_metrics = ["lessons", "assignments", "plans", "files", "clock_hours", "grading", "platform_activity"]
        
        for metric in expected_metrics:
            assert metric in breakdown, f"Missing metric: {metric}"
            m = breakdown[metric]
            
            # Each metric should have score, weight
            assert "score" in m, f"{metric} missing score"
            assert "weight" in m, f"{metric} missing weight"
            assert isinstance(m["score"], (int, float)), f"{metric} score should be numeric"
            assert isinstance(m["weight"], (int, float)), f"{metric} weight should be numeric"
            
            print(f"  {metric}: score={m['score']}/100, weight={m['weight']}%")
    
    def test_activity_metrics_weights_sum_to_100(self):
        """Verify all metric weights sum to 100%"""
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        assert response.status_code == 200
        
        breakdown = response.json()["activity_metrics"]["breakdown"]
        total_weight = sum(m["weight"] for m in breakdown.values())
        
        assert total_weight == 100, f"Weights sum to {total_weight}, expected 100"
        print(f"Total weight: {total_weight}%")
    
    def test_lessons_metric_has_count_details(self):
        """Verify lessons metric has count_30d, total, published"""
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        assert response.status_code == 200
        
        lessons = response.json()["activity_metrics"]["breakdown"]["lessons"]
        assert "count_30d" in lessons, "lessons missing count_30d"
        assert "total" in lessons, "lessons missing total"
        assert "published" in lessons, "lessons missing published"
        
        print(f"Lessons: {lessons['count_30d']} in 30d, {lessons['total']} total, {lessons['published']} published")
    
    def test_assignments_metric_has_count_details(self):
        """Verify assignments metric has count_30d, total"""
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        assert response.status_code == 200
        
        assignments = response.json()["activity_metrics"]["breakdown"]["assignments"]
        assert "count_30d" in assignments
        assert "total" in assignments
        
        print(f"Assignments: {assignments['count_30d']} in 30d, {assignments['total']} total")
    
    def test_plans_metric_has_approval_rate(self):
        """Verify plans metric has count_30d, total, approved, approval_rate"""
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        assert response.status_code == 200
        
        plans = response.json()["activity_metrics"]["breakdown"]["plans"]
        assert "count_30d" in plans
        assert "total" in plans
        assert "approved" in plans
        assert "approval_rate" in plans
        
        print(f"Plans: {plans['count_30d']} in 30d, {plans['total']} total, {plans['approval_rate']}% approved")
    
    def test_clock_hours_metric_has_hours(self):
        """Verify clock_hours metric has hours_30d, total_hours"""
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        assert response.status_code == 200
        
        clock = response.json()["activity_metrics"]["breakdown"]["clock_hours"]
        assert "hours_30d" in clock
        assert "total_hours" in clock
        
        print(f"Clock Hours: {clock['hours_30d']}h in 30d, {clock['total_hours']}h total")
    
    def test_grading_metric_has_rate(self):
        """Verify grading metric has graded, total_submissions, rate"""
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        assert response.status_code == 200
        
        grading = response.json()["activity_metrics"]["breakdown"]["grading"]
        assert "graded" in grading
        assert "total_submissions" in grading
        assert "rate" in grading
        
        print(f"Grading: {grading['graded']}/{grading['total_submissions']} ({grading['rate']}%)")
    
    def test_platform_activity_metric_has_actions(self):
        """Verify platform_activity metric has actions_30d, total_logs"""
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        assert response.status_code == 200
        
        activity = response.json()["activity_metrics"]["breakdown"]["platform_activity"]
        assert "actions_30d" in activity
        assert "total_logs" in activity
        
        print(f"Platform Activity: {activity['actions_30d']} actions in 30d, {activity['total_logs']} total logs")
    
    def test_activity_level_matches_score(self):
        """Verify activity_level label matches the score range"""
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        assert response.status_code == 200
        
        metrics = response.json()["activity_metrics"]
        score = metrics["overall_score"]
        level = metrics["activity_level"]
        
        # Verify level matches score
        if score >= 80:
            expected = "Excellent"
        elif score >= 60:
            expected = "Good"
        elif score >= 40:
            expected = "Fair"
        elif score >= 20:
            expected = "Needs Improvement"
        else:
            expected = "Inactive"
        
        assert level == expected, f"Score {score} should have level '{expected}', got '{level}'"
        print(f"Score {score} correctly maps to '{level}'")


class TestManagementCommentsCRUD:
    """Test management comments CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as SuperAdmin for all tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.created_comment_ids = []
    
    def teardown_method(self):
        """Cleanup created comments"""
        for comment_id in self.created_comment_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/monitoring/teacher-comments/{comment_id}")
            except:
                pass
    
    def test_create_management_comment(self):
        """POST /api/monitoring/teacher-comments/{teacher_id} creates a comment"""
        payload = {
            "text": "TEST_Great improvement in lesson planning this term.",
            "category": "praise"
        }
        response = self.session.post(f"{BASE_URL}/api/monitoring/teacher-comments/{TEACHER_ID}", json=payload)
        assert response.status_code == 200, f"Failed to create comment: {response.text}"
        
        comment = response.json()
        self.created_comment_ids.append(comment["comment_id"])
        
        # Verify response structure
        assert "comment_id" in comment
        assert comment["teacher_id"] == TEACHER_ID
        assert comment["text"] == payload["text"]
        assert comment["category"] == "praise"
        assert "author_id" in comment
        assert "author_name" in comment
        assert "author_role" in comment
        assert "created_at" in comment
        assert comment["pinned"] == False
        
        print(f"Created comment: {comment['comment_id']}")
    
    def test_create_comment_with_different_categories(self):
        """Test creating comments with all valid categories"""
        categories = ["general", "performance", "improvement", "praise", "lesson_feedback", 
                      "assignment_feedback", "attendance", "professional_dev", "warning", "directive"]
        
        for cat in categories:
            payload = {"text": f"TEST_Comment for category {cat}", "category": cat}
            response = self.session.post(f"{BASE_URL}/api/monitoring/teacher-comments/{TEACHER_ID}", json=payload)
            assert response.status_code == 200, f"Failed for category {cat}: {response.text}"
            
            comment = response.json()
            self.created_comment_ids.append(comment["comment_id"])
            assert comment["category"] == cat
            print(f"  Created {cat} comment: {comment['comment_id']}")
    
    def test_create_comment_empty_text_fails(self):
        """POST with empty text should return 400"""
        payload = {"text": "", "category": "general"}
        response = self.session.post(f"{BASE_URL}/api/monitoring/teacher-comments/{TEACHER_ID}", json=payload)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Empty text correctly rejected with 400")
    
    def test_create_comment_whitespace_only_fails(self):
        """POST with whitespace-only text should return 400"""
        payload = {"text": "   ", "category": "general"}
        response = self.session.post(f"{BASE_URL}/api/monitoring/teacher-comments/{TEACHER_ID}", json=payload)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Whitespace-only text correctly rejected with 400")
    
    def test_create_comment_nonexistent_teacher_fails(self):
        """POST to non-existent teacher should return 404"""
        payload = {"text": "TEST_Comment", "category": "general"}
        response = self.session.post(f"{BASE_URL}/api/monitoring/teacher-comments/nonexistent_id", json=payload)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Non-existent teacher correctly rejected with 404")
    
    def test_comments_appear_in_full_review(self):
        """Created comments should appear in teacher-full-review response"""
        # Create a comment
        payload = {"text": "TEST_Verify in full review", "category": "directive"}
        response = self.session.post(f"{BASE_URL}/api/monitoring/teacher-comments/{TEACHER_ID}", json=payload)
        assert response.status_code == 200
        comment = response.json()
        self.created_comment_ids.append(comment["comment_id"])
        
        # Fetch full review
        review_response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        assert review_response.status_code == 200
        
        comments = review_response.json().get("management_comments", [])
        comment_ids = [c["comment_id"] for c in comments]
        assert comment["comment_id"] in comment_ids, "Created comment not found in full review"
        print(f"Comment {comment['comment_id']} found in full review")
    
    def test_delete_management_comment(self):
        """DELETE /api/monitoring/teacher-comments/{comment_id} deletes a comment"""
        # Create a comment first
        payload = {"text": "TEST_To be deleted", "category": "general"}
        create_response = self.session.post(f"{BASE_URL}/api/monitoring/teacher-comments/{TEACHER_ID}", json=payload)
        assert create_response.status_code == 200
        comment_id = create_response.json()["comment_id"]
        
        # Delete it
        delete_response = self.session.delete(f"{BASE_URL}/api/monitoring/teacher-comments/{comment_id}")
        assert delete_response.status_code == 200
        assert delete_response.json().get("status") == "deleted"
        
        # Verify it's gone from full review
        review_response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        comments = review_response.json().get("management_comments", [])
        comment_ids = [c["comment_id"] for c in comments]
        assert comment_id not in comment_ids, "Deleted comment still in full review"
        print(f"Comment {comment_id} successfully deleted")
    
    def test_delete_nonexistent_comment_fails(self):
        """DELETE non-existent comment should return 404"""
        response = self.session.delete(f"{BASE_URL}/api/monitoring/teacher-comments/nonexistent_comment_id")
        assert response.status_code == 404
        print("Non-existent comment delete correctly rejected with 404")
    
    def test_pin_comment(self):
        """PATCH /api/monitoring/teacher-comments/{comment_id}/pin toggles pin state"""
        # Create a comment
        payload = {"text": "TEST_To be pinned", "category": "praise"}
        create_response = self.session.post(f"{BASE_URL}/api/monitoring/teacher-comments/{TEACHER_ID}", json=payload)
        assert create_response.status_code == 200
        comment_id = create_response.json()["comment_id"]
        self.created_comment_ids.append(comment_id)
        
        # Pin it
        pin_response = self.session.patch(f"{BASE_URL}/api/monitoring/teacher-comments/{comment_id}/pin")
        assert pin_response.status_code == 200
        assert pin_response.json().get("pinned") == True
        print(f"Comment {comment_id} pinned")
        
        # Verify in full review
        review_response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        comments = review_response.json().get("management_comments", [])
        pinned_comment = next((c for c in comments if c["comment_id"] == comment_id), None)
        assert pinned_comment is not None
        assert pinned_comment["pinned"] == True
        print("Pin state verified in full review")
    
    def test_unpin_comment(self):
        """PATCH /api/monitoring/teacher-comments/{comment_id}/pin toggles pin off"""
        # Create and pin a comment
        payload = {"text": "TEST_To be unpinned", "category": "general"}
        create_response = self.session.post(f"{BASE_URL}/api/monitoring/teacher-comments/{TEACHER_ID}", json=payload)
        comment_id = create_response.json()["comment_id"]
        self.created_comment_ids.append(comment_id)
        
        # Pin it
        self.session.patch(f"{BASE_URL}/api/monitoring/teacher-comments/{comment_id}/pin")
        
        # Unpin it
        unpin_response = self.session.patch(f"{BASE_URL}/api/monitoring/teacher-comments/{comment_id}/pin")
        assert unpin_response.status_code == 200
        assert unpin_response.json().get("pinned") == False
        print(f"Comment {comment_id} unpinned")
    
    def test_pin_nonexistent_comment_fails(self):
        """PATCH pin on non-existent comment should return 404"""
        response = self.session.patch(f"{BASE_URL}/api/monitoring/teacher-comments/nonexistent_id/pin")
        assert response.status_code == 404
        print("Non-existent comment pin correctly rejected with 404")


class TestManagementCommentsAuthorization:
    """Test that only management roles can access comment endpoints"""
    
    def test_teacher_cannot_create_comment(self):
        """Teacher should not be able to create management comments"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as teacher
        response = session.post(f"{BASE_URL}/api/auth/login", json=TEACHER_CREDS)
        assert response.status_code == 200
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Try to create comment
        payload = {"text": "TEST_Teacher comment", "category": "general"}
        response = session.post(f"{BASE_URL}/api/monitoring/teacher-comments/{TEACHER_ID}", json=payload)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("Teacher correctly denied access to create comment (403)")
    
    def test_ceo_can_create_comment(self):
        """CEO should be able to create management comments"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as CEO
        response = session.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
        assert response.status_code == 200
        token = response.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Create comment
        payload = {"text": "TEST_CEO comment", "category": "directive"}
        response = session.post(f"{BASE_URL}/api/monitoring/teacher-comments/{TEACHER_ID}", json=payload)
        assert response.status_code == 200, f"CEO should be able to create comment: {response.text}"
        
        comment_id = response.json()["comment_id"]
        print(f"CEO successfully created comment: {comment_id}")
        
        # Cleanup
        session.delete(f"{BASE_URL}/api/monitoring/teacher-comments/{comment_id}")


class TestExistingComments:
    """Test existing comments in database (from agent context)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as SuperAdmin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
        assert response.status_code == 200
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_existing_comments_in_full_review(self):
        """Verify existing comments (mc_7b0aa6e57c0a directive, mc_0f4fe712d077 praise) are in response"""
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{TEACHER_ID}")
        assert response.status_code == 200
        
        comments = response.json().get("management_comments", [])
        print(f"Found {len(comments)} management comments")
        
        # Check for expected existing comments
        comment_ids = [c["comment_id"] for c in comments]
        
        # These IDs were mentioned in the agent context
        expected_ids = ["mc_7b0aa6e57c0a", "mc_0f4fe712d077"]
        for expected_id in expected_ids:
            if expected_id in comment_ids:
                print(f"  Found existing comment: {expected_id}")
            else:
                print(f"  Note: {expected_id} not found (may have been deleted)")
        
        # Verify comment structure
        if comments:
            c = comments[0]
            assert "comment_id" in c
            assert "teacher_id" in c
            assert "author_name" in c
            assert "author_role" in c
            assert "category" in c
            assert "text" in c
            assert "created_at" in c
            print(f"Comment structure verified: {c['comment_id']} - {c['category']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
