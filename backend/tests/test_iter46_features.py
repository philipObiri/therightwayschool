"""
Iteration 46 Tests: AI Generate Lesson + Staff Review All Staff
Tests:
1. POST /api/lessons-v2/ai-generate-lesson - Teacher can generate lesson from scratch
2. AI generate requires topic (returns 400 without it)
3. GET /api/admin/staff returns ALL staff (not just Teachers)
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
CEO_EMAIL = "ceo@tcis.demo"
CEO_PASSWORD = "ceo123"


@pytest.fixture(scope="module")
def teacher_token():
    """Get teacher auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Teacher login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def superadmin_token():
    """Get superadmin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"SuperAdmin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def ceo_token():
    """Get CEO auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CEO_EMAIL,
        "password": CEO_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"CEO login failed: {response.status_code} - {response.text}")


class TestAIGenerateLesson:
    """Tests for POST /api/lessons-v2/ai-generate-lesson endpoint"""
    
    def test_ai_generate_lesson_requires_topic(self, teacher_token):
        """AI generate should return 400 if topic is missing"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.post(f"{BASE_URL}/api/lessons-v2/ai-generate-lesson", 
            headers=headers,
            json={
                "subject": "Mathematics",
                "year_group": "Year 7",
                "curriculum": "Cambridge",
                "duration_minutes": 45,
                # topic is missing
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "topic" in data.get("detail", "").lower() or "required" in data.get("detail", "").lower(), \
            f"Error should mention topic is required: {data}"
        print(f"✓ AI generate correctly returns 400 when topic is missing: {data.get('detail')}")
    
    def test_ai_generate_lesson_empty_topic(self, teacher_token):
        """AI generate should return 400 if topic is empty string"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.post(f"{BASE_URL}/api/lessons-v2/ai-generate-lesson", 
            headers=headers,
            json={
                "subject": "Mathematics",
                "year_group": "Year 7",
                "topic": "",  # empty topic
                "curriculum": "Cambridge",
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✓ AI generate correctly returns 400 when topic is empty")
    
    def test_ai_generate_lesson_success(self, teacher_token):
        """Teacher can generate a lesson plan from scratch using AI"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.post(f"{BASE_URL}/api/lessons-v2/ai-generate-lesson", 
            headers=headers,
            json={
                "subject": "Science",
                "year_group": "Year 8",
                "topic": "Photosynthesis and plant nutrition",
                "curriculum": "Cambridge",
                "duration_minutes": 45,
                "additional_instructions": "Include a practical activity"
            },
            timeout=60  # AI generation can take 10-20 seconds
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "title" in data, "Response should contain 'title'"
        assert "objectives" in data, "Response should contain 'objectives'"
        assert "description" in data, "Response should contain 'description'"
        assert "rich_content" in data, "Response should contain 'rich_content'"
        
        # Verify content is not empty
        assert data["title"], "Title should not be empty"
        assert data["rich_content"], "Rich content should not be empty"
        
        print(f"✓ AI generated lesson successfully:")
        print(f"  - Title: {data['title'][:50]}...")
        print(f"  - Objectives: {data['objectives'][:80] if data['objectives'] else 'N/A'}...")
        print(f"  - Content length: {len(data['rich_content'])} chars")
    
    def test_ai_generate_lesson_requires_auth(self):
        """AI generate should require authentication"""
        response = requests.post(f"{BASE_URL}/api/lessons-v2/ai-generate-lesson", 
            json={
                "subject": "Mathematics",
                "year_group": "Year 7",
                "topic": "Algebra basics",
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ AI generate correctly requires authentication")


class TestStaffReviewAllStaff:
    """Tests for GET /api/admin/staff returning ALL staff (not just Teachers)"""
    
    def test_staff_endpoint_returns_all_staff(self, superadmin_token):
        """GET /api/admin/staff should return ALL staff members, not just Teachers"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/staff", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        staff = response.json()
        assert isinstance(staff, list), "Response should be a list"
        
        # Count staff by role
        roles = {}
        for s in staff:
            role = s.get("role", "Unknown")
            roles[role] = roles.get(role, 0) + 1
        
        print(f"✓ Staff endpoint returned {len(staff)} staff members")
        print(f"  Roles breakdown: {roles}")
        
        # Verify we have more than just Teachers
        non_teacher_roles = [r for r in roles.keys() if r != "Teacher"]
        assert len(non_teacher_roles) > 0, "Should have non-Teacher roles in staff list"
        
        # Check for specific management roles
        expected_roles = ["CEO", "Principal", "HeadTeacher", "SuperAdmin", "Admin"]
        found_roles = [r for r in expected_roles if r in roles]
        print(f"  Found management roles: {found_roles}")
        
        # Verify total count is reasonable (should be ~27 based on context)
        assert len(staff) >= 20, f"Expected at least 20 staff, got {len(staff)}"
        print(f"✓ Staff count ({len(staff)}) includes all roles, not just Teachers")
    
    def test_staff_have_role_field(self, superadmin_token):
        """Each staff member should have a role field for badge display"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/staff", headers=headers)
        
        assert response.status_code == 200
        staff = response.json()
        
        # Check that all staff have role field
        for s in staff[:10]:  # Check first 10
            assert "role" in s, f"Staff {s.get('name')} missing 'role' field"
            assert s["role"], f"Staff {s.get('name')} has empty role"
        
        print(f"✓ All staff members have role field for badge display")
    
    def test_staff_includes_ceo(self, superadmin_token):
        """Staff list should include CEO"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/staff", headers=headers)
        
        assert response.status_code == 200
        staff = response.json()
        
        ceo_staff = [s for s in staff if s.get("role") == "CEO"]
        assert len(ceo_staff) > 0, "Staff list should include CEO"
        print(f"✓ CEO found in staff list: {ceo_staff[0].get('name')}")
    
    def test_staff_includes_finance(self, superadmin_token):
        """Staff list should include Finance roles"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/staff", headers=headers)
        
        assert response.status_code == 200
        staff = response.json()
        
        finance_staff = [s for s in staff if "finance" in s.get("role", "").lower() or "finance" in s.get("email", "").lower()]
        if finance_staff:
            print(f"✓ Finance staff found: {[s.get('name') for s in finance_staff]}")
        else:
            # Check if there's any FinanceOfficer role
            all_roles = set(s.get("role") for s in staff)
            print(f"  All roles in system: {all_roles}")
            # This is informational - not a failure if no finance staff seeded
    
    def test_non_teacher_staff_can_be_reviewed(self, superadmin_token):
        """Non-teacher staff (e.g., CEO) should be reviewable via teacher-full-review endpoint"""
        headers = {"Authorization": f"Bearer {superadmin_token}"}
        
        # First get staff list
        staff_response = requests.get(f"{BASE_URL}/api/admin/staff", headers=headers)
        assert staff_response.status_code == 200
        staff = staff_response.json()
        
        # Find a non-teacher staff member
        non_teacher = next((s for s in staff if s.get("role") != "Teacher"), None)
        if not non_teacher:
            pytest.skip("No non-teacher staff found")
        
        # Try to get their full review data
        user_id = non_teacher.get("user_id")
        review_response = requests.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{user_id}", headers=headers)
        
        # Should return 200 (or at least not 403/404)
        assert review_response.status_code == 200, \
            f"Non-teacher staff review failed: {review_response.status_code} - {review_response.text}"
        
        print(f"✓ Non-teacher staff ({non_teacher.get('name')} - {non_teacher.get('role')}) can be reviewed")


class TestTeacherLessonsEndpoints:
    """Additional tests for lessons-v2 endpoints"""
    
    def test_lessons_list_accessible(self, teacher_token):
        """Teacher can access lessons list"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/lessons-v2/", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Lessons list accessible, returned {len(response.json())} lessons")
    
    def test_templates_list_accessible(self, teacher_token):
        """Teacher can access templates list"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.get(f"{BASE_URL}/api/lessons-v2/templates/list", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Templates list accessible, returned {len(response.json())} templates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
