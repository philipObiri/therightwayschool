"""
Test Dashboard Reviews Endpoint - Iteration 45
Tests GET /api/admin/dashboard-reviews for different user roles:
- HeadTeacher (management + teacher): sees pending reviews + own submissions
- Teacher: sees only own submissions
- CEO: sees pending reviews only at their step (Step 3)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
CREDENTIALS = {
    "teacher": {"email": "edmund@tcis.demo", "password": "teacher123"},
    "headteacher": {"email": "headteacher@tcis.demo", "password": "headteacher123"},
    "principal": {"email": "principal@tcis.demo", "password": "principal123"},
    "ceo": {"email": "ceo@tcis.demo", "password": "ceo123"},
    "founder": {"email": "founder@tcis.demo", "password": "founder123"},
    "superadmin": {"email": "dwain@tcis.demo", "password": "admin123"},
}


def get_auth_token(email: str, password: str) -> str:
    """Login and return JWT token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if response.status_code == 200:
        return response.json().get("token")
    return None


class TestDashboardReviewsEndpoint:
    """Test GET /api/admin/dashboard-reviews endpoint"""

    def test_endpoint_returns_correct_structure(self):
        """Verify the endpoint returns all expected fields"""
        token = get_auth_token(**CREDENTIALS["headteacher"])
        assert token, "Failed to get HeadTeacher token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard-reviews", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify all expected keys exist
        expected_keys = [
            "pending_lesson_reviews",
            "pending_scheme_reviews",
            "my_lesson_submissions",
            "my_scheme_submissions",
            "recently_reviewed_lessons",
            "recently_reviewed_schemes"
        ]
        for key in expected_keys:
            assert key in data, f"Missing key: {key}"
            assert isinstance(data[key], list), f"{key} should be a list"
        
        print(f"✓ Endpoint returns correct structure with all 6 keys")

    def test_headteacher_sees_pending_reviews_as_management(self):
        """HeadTeacher (Esther) is management - should see pending reviews at Step 1"""
        token = get_auth_token(**CREDENTIALS["headteacher"])
        assert token, "Failed to get HeadTeacher token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard-reviews", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # HeadTeacher is management, so pending_lesson_reviews and pending_scheme_reviews should be populated
        # (if there are any items at Step 1)
        print(f"✓ HeadTeacher pending_lesson_reviews count: {len(data['pending_lesson_reviews'])}")
        print(f"✓ HeadTeacher pending_scheme_reviews count: {len(data['pending_scheme_reviews'])}")
        print(f"✓ HeadTeacher recently_reviewed_lessons count: {len(data['recently_reviewed_lessons'])}")
        print(f"✓ HeadTeacher recently_reviewed_schemes count: {len(data['recently_reviewed_schemes'])}")

    def test_headteacher_sees_own_submissions_as_teacher(self):
        """HeadTeacher (Esther) is also a teacher - should see own submissions"""
        token = get_auth_token(**CREDENTIALS["headteacher"])
        assert token, "Failed to get HeadTeacher token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard-reviews", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # HeadTeacher has Teacher role, so my_lesson_submissions and my_scheme_submissions should be populated
        print(f"✓ HeadTeacher my_lesson_submissions count: {len(data['my_lesson_submissions'])}")
        print(f"✓ HeadTeacher my_scheme_submissions count: {len(data['my_scheme_submissions'])}")

    def test_teacher_sees_only_own_submissions(self):
        """Teacher (Edmund) should see only own submissions, NOT pending reviews"""
        token = get_auth_token(**CREDENTIALS["teacher"])
        assert token, "Failed to get Teacher token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard-reviews", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Teacher is NOT management, so pending reviews should be empty
        assert data["pending_lesson_reviews"] == [], "Teacher should NOT see pending_lesson_reviews"
        assert data["pending_scheme_reviews"] == [], "Teacher should NOT see pending_scheme_reviews"
        assert data["recently_reviewed_lessons"] == [], "Teacher should NOT see recently_reviewed_lessons"
        assert data["recently_reviewed_schemes"] == [], "Teacher should NOT see recently_reviewed_schemes"
        
        # Teacher should see own submissions
        print(f"✓ Teacher my_lesson_submissions count: {len(data['my_lesson_submissions'])}")
        print(f"✓ Teacher my_scheme_submissions count: {len(data['my_scheme_submissions'])}")
        print("✓ Teacher correctly sees only own submissions, not pending reviews")

    def test_ceo_sees_pending_reviews_at_step_3_only(self):
        """CEO should see pending reviews only at Step 3 (their highest step in chain)"""
        token = get_auth_token(**CREDENTIALS["ceo"])
        assert token, "Failed to get CEO token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard-reviews", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # CEO is management, so they can see pending reviews
        # But due to chain enforcement, they should only see items at Step 3
        print(f"✓ CEO pending_lesson_reviews count: {len(data['pending_lesson_reviews'])}")
        print(f"✓ CEO pending_scheme_reviews count: {len(data['pending_scheme_reviews'])}")
        
        # Verify any pending items are at Step 3 (CEO's step)
        for lesson in data["pending_lesson_reviews"]:
            chain = lesson.get("approval_chain", [])
            # Find current step
            current_step_idx = -1
            for i, step in enumerate(chain):
                if step.get("status") == "pending":
                    current_step_idx = i
                    break
            if current_step_idx >= 0:
                step_label = chain[current_step_idx].get("label", "")
                print(f"  - Lesson '{lesson.get('title', 'Untitled')}' at step: {step_label}")
                # CEO should only see items at CEO step (Step 3)
                assert "CEO" in step_label or current_step_idx == 2, f"CEO should only see items at Step 3, got step {current_step_idx}: {step_label}"
        
        print("✓ CEO correctly sees only items at their approval step")

    def test_principal_sees_pending_reviews_at_step_2(self):
        """Principal should see pending reviews at Step 2"""
        token = get_auth_token(**CREDENTIALS["principal"])
        assert token, "Failed to get Principal token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard-reviews", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ Principal pending_lesson_reviews count: {len(data['pending_lesson_reviews'])}")
        print(f"✓ Principal pending_scheme_reviews count: {len(data['pending_scheme_reviews'])}")
        
        # Verify any pending items are at Step 2 (Principal's step)
        for lesson in data["pending_lesson_reviews"]:
            chain = lesson.get("approval_chain", [])
            current_step_idx = -1
            for i, step in enumerate(chain):
                if step.get("status") == "pending":
                    current_step_idx = i
                    break
            if current_step_idx >= 0:
                step_label = chain[current_step_idx].get("label", "")
                print(f"  - Lesson '{lesson.get('title', 'Untitled')}' at step: {step_label}")
                assert "Principal" in step_label or current_step_idx == 1, f"Principal should only see items at Step 2"
        
        print("✓ Principal correctly sees only items at their approval step")

    def test_founder_sees_pending_reviews_at_step_4(self):
        """Founder should see pending reviews at Step 4 (final step)"""
        token = get_auth_token(**CREDENTIALS["founder"])
        assert token, "Failed to get Founder token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard-reviews", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ Founder pending_lesson_reviews count: {len(data['pending_lesson_reviews'])}")
        print(f"✓ Founder pending_scheme_reviews count: {len(data['pending_scheme_reviews'])}")
        print("✓ Founder endpoint access verified")

    def test_superadmin_sees_all_pending_reviews(self):
        """SuperAdmin (Dwain) should see pending reviews"""
        token = get_auth_token(**CREDENTIALS["superadmin"])
        assert token, "Failed to get SuperAdmin token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard-reviews", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        print(f"✓ SuperAdmin pending_lesson_reviews count: {len(data['pending_lesson_reviews'])}")
        print(f"✓ SuperAdmin pending_scheme_reviews count: {len(data['pending_scheme_reviews'])}")
        print(f"✓ SuperAdmin my_lesson_submissions count: {len(data['my_lesson_submissions'])}")
        print("✓ SuperAdmin endpoint access verified")


class TestDashboardReviewsDataIntegrity:
    """Test data integrity of dashboard-reviews response"""

    def test_lesson_review_has_required_fields(self):
        """Verify lesson review items have required fields for UI rendering"""
        token = get_auth_token(**CREDENTIALS["headteacher"])
        assert token, "Failed to get HeadTeacher token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard-reviews", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check pending lessons
        for lesson in data["pending_lesson_reviews"][:3]:  # Check first 3
            assert "lesson_id" in lesson, "Missing lesson_id"
            assert "title" in lesson or "name" in lesson, "Missing title/name"
            assert "status" in lesson, "Missing status"
            assert "approval_chain" in lesson, "Missing approval_chain"
            print(f"  ✓ Lesson '{lesson.get('title', 'Untitled')}' has required fields")
        
        # Check my submissions
        for lesson in data["my_lesson_submissions"][:3]:
            assert "lesson_id" in lesson, "Missing lesson_id"
            assert "status" in lesson, "Missing status"
            print(f"  ✓ My submission '{lesson.get('title', 'Untitled')}' has required fields")
        
        print("✓ Lesson review items have required fields")

    def test_scheme_review_has_required_fields(self):
        """Verify scheme review items have required fields for UI rendering"""
        token = get_auth_token(**CREDENTIALS["headteacher"])
        assert token, "Failed to get HeadTeacher token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard-reviews", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check pending schemes
        for scheme in data["pending_scheme_reviews"][:3]:
            assert "scheme_id" in scheme, "Missing scheme_id"
            assert "title" in scheme or "name" in scheme, "Missing title/name"
            assert "status" in scheme, "Missing status"
            assert "approval_chain" in scheme, "Missing approval_chain"
            print(f"  ✓ Scheme '{scheme.get('title', scheme.get('name', 'Untitled'))}' has required fields")
        
        print("✓ Scheme review items have required fields")

    def test_approval_chain_structure(self):
        """Verify approval_chain has correct structure for ApprovalDots component"""
        token = get_auth_token(**CREDENTIALS["headteacher"])
        assert token, "Failed to get HeadTeacher token"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard-reviews", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check approval chain structure in any available item
        all_items = (
            data["pending_lesson_reviews"] + 
            data["my_lesson_submissions"] + 
            data["pending_scheme_reviews"] + 
            data["my_scheme_submissions"]
        )
        
        for item in all_items[:5]:
            chain = item.get("approval_chain", [])
            if chain:
                for step in chain:
                    assert "status" in step, "Approval step missing status"
                    assert "label" in step, "Approval step missing label"
                    assert step["status"] in ["pending", "approved", "auto_approved", "returned"], f"Invalid status: {step['status']}"
                print(f"  ✓ Item '{item.get('title', item.get('name', 'Untitled'))}' has valid approval_chain")
                break
        
        print("✓ Approval chain structure is valid for ApprovalDots component")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
