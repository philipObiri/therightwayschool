"""
Iteration 69: Test Parent Concerns & Booster Lessons Management
Tests all CRUD operations for concerns and lessons, search endpoints, and class-based queries.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "dwain@tcis.demo"
ADMIN_PASSWORD = "admin123"
CEO_EMAIL = "ceo@tcis.demo"
CEO_PASSWORD = "ceo123"
TEACHER_EMAIL = "emmanuel@tcis.demo"
TEACHER_PASSWORD = "teacher123"

# Test class ID for class-based queries
TEST_CLASS_ID = "cls_89e85348b7fd"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def ceo_token():
    """Get CEO authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CEO_EMAIL,
        "password": CEO_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"CEO authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def teacher_token():
    """Get teacher authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Teacher authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestAuthentication:
    """Test authentication for different roles"""
    
    def test_admin_login(self, api_client):
        """Admin can login successfully"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data.get("user", {}).get("role") in ["Admin", "SuperAdmin"]
        print(f"Admin login successful: {data.get('user', {}).get('name')} - Role: {data.get('user', {}).get('role')}")
    
    def test_ceo_login(self, api_client):
        """CEO can login successfully"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data.get("user", {}).get("role") in ["CEO", "SuperAdmin"]
        print(f"CEO login successful: {data.get('user', {}).get('name')}")
    
    def test_teacher_login(self, api_client):
        """Teacher can login successfully"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print(f"Teacher login successful: {data.get('user', {}).get('name')} - Role: {data.get('user', {}).get('role')}")


class TestStudentSearch:
    """Test student search endpoint"""
    
    def test_search_students_requires_min_2_chars(self, api_client, admin_token):
        """Search requires at least 2 characters"""
        response = api_client.get(
            f"{BASE_URL}/api/booster/students/search?q=a",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data == []  # Should return empty for single char
        print("Student search with 1 char returns empty array")
    
    def test_search_students_with_valid_query(self, api_client, admin_token):
        """Search returns students matching query"""
        response = api_client.get(
            f"{BASE_URL}/api/booster/students/search?q=ay",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Student search 'ay' returned {len(data)} results")
        if data:
            print(f"First result: {data[0].get('name')} - {data[0].get('user_id')}")


class TestTeacherSearch:
    """Test teacher search endpoint"""
    
    def test_search_teachers_requires_min_2_chars(self, api_client, admin_token):
        """Search requires at least 2 characters"""
        response = api_client.get(
            f"{BASE_URL}/api/booster/teachers/search?q=e",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data == []  # Should return empty for single char
        print("Teacher search with 1 char returns empty array")
    
    def test_search_teachers_with_valid_query(self, api_client, admin_token):
        """Search returns teachers matching query"""
        response = api_client.get(
            f"{BASE_URL}/api/booster/teachers/search?q=em",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Teacher search 'em' returned {len(data)} results")
        if data:
            print(f"First result: {data[0].get('name')} - {data[0].get('user_id')}")


class TestParentConcernsCRUD:
    """Test Parent Concerns CRUD operations"""
    
    created_concern_id = None
    
    def test_create_concern(self, api_client, admin_token):
        """Admin can create a parent concern"""
        payload = {
            "student_id": "TEST_student_001",
            "student_name": "TEST Student Alpha",
            "student_year": "Year 7",
            "subject": "TEST Poor Math Performance",
            "category": "academic",
            "description": "Student struggling with algebra concepts",
            "notes": "Parent requested extra support"
        }
        response = api_client.post(
            f"{BASE_URL}/api/booster/concerns",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "concern_id" in data
        assert data["student_name"] == "TEST Student Alpha"
        assert data["category"] == "academic"
        assert data["status"] == "open"
        TestParentConcernsCRUD.created_concern_id = data["concern_id"]
        print(f"Created concern: {data['concern_id']}")
    
    def test_list_concerns(self, api_client, admin_token):
        """Admin can list all concerns"""
        response = api_client.get(
            f"{BASE_URL}/api/booster/concerns",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Listed {len(data)} concerns")
        # Verify our test concern is in the list
        test_concerns = [c for c in data if c.get("concern_id") == TestParentConcernsCRUD.created_concern_id]
        assert len(test_concerns) == 1
        print(f"Found test concern in list")
    
    def test_update_concern(self, api_client, admin_token):
        """Admin can update a concern"""
        assert TestParentConcernsCRUD.created_concern_id is not None
        payload = {
            "subject": "TEST Updated Math Performance Issue",
            "status": "in_progress",
            "notes": "Updated notes - teacher assigned"
        }
        response = api_client.put(
            f"{BASE_URL}/api/booster/concerns/{TestParentConcernsCRUD.created_concern_id}",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Concern updated"
        print(f"Updated concern: {TestParentConcernsCRUD.created_concern_id}")
        
        # Verify update persisted
        response = api_client.get(
            f"{BASE_URL}/api/booster/concerns",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        concerns = response.json()
        updated = next((c for c in concerns if c.get("concern_id") == TestParentConcernsCRUD.created_concern_id), None)
        assert updated is not None
        assert updated["status"] == "in_progress"
        print(f"Verified concern status updated to 'in_progress'")
    
    def test_respond_to_concern(self, api_client, admin_token):
        """Admin can respond to a concern"""
        assert TestParentConcernsCRUD.created_concern_id is not None
        payload = {
            "message": "We have assigned a tutor for extra math support",
            "status": "resolved"
        }
        response = api_client.post(
            f"{BASE_URL}/api/booster/concerns/{TestParentConcernsCRUD.created_concern_id}/respond",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Response added"
        print(f"Added response to concern")
        
        # Verify response was added
        response = api_client.get(
            f"{BASE_URL}/api/booster/concerns",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        concerns = response.json()
        updated = next((c for c in concerns if c.get("concern_id") == TestParentConcernsCRUD.created_concern_id), None)
        assert updated is not None
        assert updated["status"] == "resolved"
        assert len(updated.get("responses", [])) > 0
        print(f"Verified response added and status changed to 'resolved'")
    
    def test_delete_concern(self, api_client, admin_token):
        """Admin can delete a concern"""
        assert TestParentConcernsCRUD.created_concern_id is not None
        response = api_client.delete(
            f"{BASE_URL}/api/booster/concerns/{TestParentConcernsCRUD.created_concern_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Concern deleted"
        print(f"Deleted concern: {TestParentConcernsCRUD.created_concern_id}")
        
        # Verify deletion
        response = api_client.get(
            f"{BASE_URL}/api/booster/concerns",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        concerns = response.json()
        deleted = next((c for c in concerns if c.get("concern_id") == TestParentConcernsCRUD.created_concern_id), None)
        assert deleted is None
        print(f"Verified concern deleted from list")


class TestBoosterLessonsCRUD:
    """Test Booster Lessons CRUD operations"""
    
    created_lesson_id = None
    
    def test_create_booster_lesson(self, api_client, admin_token):
        """Admin can book a booster lesson"""
        payload = {
            "student_id": "TEST_student_002",
            "student_name": "TEST Student Beta",
            "student_year": "Year 8",
            "class_id": TEST_CLASS_ID,
            "subject": "Mathematics",
            "reason": "Needs extra help with fractions",
            "notes": "Parent requested 2 sessions per week",
            "preferred_days": ["Monday", "Wednesday"],
            "teacher_id": "",
            "teacher_name": ""
        }
        response = api_client.post(
            f"{BASE_URL}/api/booster/lessons",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "lesson_id" in data
        assert data["student_name"] == "TEST Student Beta"
        assert data["subject"] == "Mathematics"
        assert data["status"] == "requested"
        assert data["preferred_days"] == ["Monday", "Wednesday"]
        TestBoosterLessonsCRUD.created_lesson_id = data["lesson_id"]
        print(f"Created booster lesson: {data['lesson_id']}")
    
    def test_list_booster_lessons(self, api_client, admin_token):
        """Admin can list all booster lessons"""
        response = api_client.get(
            f"{BASE_URL}/api/booster/lessons",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Listed {len(data)} booster lessons")
        # Verify our test lesson is in the list
        test_lessons = [l for l in data if l.get("lesson_id") == TestBoosterLessonsCRUD.created_lesson_id]
        assert len(test_lessons) == 1
        print(f"Found test lesson in list")
    
    def test_update_booster_lesson(self, api_client, admin_token):
        """Admin can update a booster lesson"""
        assert TestBoosterLessonsCRUD.created_lesson_id is not None
        payload = {
            "status": "approved",
            "teacher_id": "teacher_001",
            "teacher_name": "Mr. Emmanuel",
            "notes": "Approved - sessions start next week"
        }
        response = api_client.put(
            f"{BASE_URL}/api/booster/lessons/{TestBoosterLessonsCRUD.created_lesson_id}",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Booster lesson updated"
        print(f"Updated booster lesson: {TestBoosterLessonsCRUD.created_lesson_id}")
        
        # Verify update persisted
        response = api_client.get(
            f"{BASE_URL}/api/booster/lessons",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        lessons = response.json()
        updated = next((l for l in lessons if l.get("lesson_id") == TestBoosterLessonsCRUD.created_lesson_id), None)
        assert updated is not None
        assert updated["status"] == "approved"
        assert updated["teacher_name"] == "Mr. Emmanuel"
        print(f"Verified lesson status updated to 'approved' with teacher assigned")
    
    def test_get_booster_lessons_by_class(self, api_client, teacher_token):
        """Teacher can get booster lessons for a class"""
        response = api_client.get(
            f"{BASE_URL}/api/booster/lessons/by-class/{TEST_CLASS_ID}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} active booster lessons for class {TEST_CLASS_ID}")
        # Our test lesson should be in the list (status is 'approved' which is active)
        if TestBoosterLessonsCRUD.created_lesson_id:
            test_lessons = [l for l in data if l.get("lesson_id") == TestBoosterLessonsCRUD.created_lesson_id]
            if test_lessons:
                print(f"Test lesson found in class booster list")
    
    def test_delete_booster_lesson(self, api_client, admin_token):
        """Admin can delete a booster lesson"""
        assert TestBoosterLessonsCRUD.created_lesson_id is not None
        response = api_client.delete(
            f"{BASE_URL}/api/booster/lessons/{TestBoosterLessonsCRUD.created_lesson_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Booster lesson deleted"
        print(f"Deleted booster lesson: {TestBoosterLessonsCRUD.created_lesson_id}")
        
        # Verify deletion
        response = api_client.get(
            f"{BASE_URL}/api/booster/lessons",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        lessons = response.json()
        deleted = next((l for l in lessons if l.get("lesson_id") == TestBoosterLessonsCRUD.created_lesson_id), None)
        assert deleted is None
        print(f"Verified booster lesson deleted from list")


class TestConcernsByClass:
    """Test concerns by class endpoint for teachers"""
    
    def test_get_concerns_by_class(self, api_client, teacher_token):
        """Teacher can get concerns for students in a class"""
        response = api_client.get(
            f"{BASE_URL}/api/booster/concerns/by-class/{TEST_CLASS_ID}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} open concerns for class {TEST_CLASS_ID}")


class TestCEOAccess:
    """Test CEO role access to booster endpoints"""
    
    def test_ceo_can_create_concern(self, api_client, ceo_token):
        """CEO can create a parent concern"""
        payload = {
            "student_id": "TEST_ceo_student",
            "student_name": "TEST CEO Student",
            "student_year": "Year 9",
            "subject": "TEST CEO Concern",
            "category": "behaviour",
            "description": "CEO raised concern",
            "notes": ""
        }
        response = api_client.post(
            f"{BASE_URL}/api/booster/concerns",
            json=payload,
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "concern_id" in data
        print(f"CEO created concern: {data['concern_id']}")
        
        # Cleanup
        api_client.delete(
            f"{BASE_URL}/api/booster/concerns/{data['concern_id']}",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        print("Cleaned up CEO test concern")
    
    def test_ceo_can_create_booster_lesson(self, api_client, ceo_token):
        """CEO can book a booster lesson"""
        payload = {
            "student_id": "TEST_ceo_student",
            "student_name": "TEST CEO Student",
            "student_year": "Year 9",
            "class_id": "",
            "subject": "English",
            "reason": "CEO booked lesson",
            "notes": "",
            "preferred_days": ["Friday"],
            "teacher_id": "",
            "teacher_name": ""
        }
        response = api_client.post(
            f"{BASE_URL}/api/booster/lessons",
            json=payload,
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "lesson_id" in data
        print(f"CEO created booster lesson: {data['lesson_id']}")
        
        # Cleanup
        api_client.delete(
            f"{BASE_URL}/api/booster/lessons/{data['lesson_id']}",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        print("Cleaned up CEO test lesson")


class TestErrorHandling:
    """Test error handling for invalid operations"""
    
    def test_delete_nonexistent_concern(self, api_client, admin_token):
        """Deleting non-existent concern returns 404"""
        response = api_client.delete(
            f"{BASE_URL}/api/booster/concerns/nonexistent_id_12345",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
        print("Correctly returned 404 for non-existent concern")
    
    def test_delete_nonexistent_lesson(self, api_client, admin_token):
        """Deleting non-existent lesson returns 404"""
        response = api_client.delete(
            f"{BASE_URL}/api/booster/lessons/nonexistent_id_12345",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
        print("Correctly returned 404 for non-existent lesson")
    
    def test_update_nonexistent_concern(self, api_client, admin_token):
        """Updating non-existent concern returns 404"""
        response = api_client.put(
            f"{BASE_URL}/api/booster/concerns/nonexistent_id_12345",
            json={"status": "closed"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404
        print("Correctly returned 404 for updating non-existent concern")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
