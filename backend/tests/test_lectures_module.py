"""
Test suite for TCIS Lectures Module
Tests: CRUD operations, config, admin endpoints, duplicate, PDF export
Skips: AI generation endpoints (GPT-5 takes 30-60 seconds)
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
    if response.status_code != 200:
        pytest.skip(f"Teacher login failed: {response.text}")
    return response.json().get("token")


@pytest.fixture(scope="module")
def superadmin_token():
    """Get superadmin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"SuperAdmin login failed: {response.text}")
    return response.json().get("token")


@pytest.fixture(scope="module")
def ceo_token():
    """Get CEO auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CEO_EMAIL,
        "password": CEO_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"CEO login failed: {response.text}")
    return response.json().get("token")


class TestLecturesConfig:
    """Test GET /api/lectures/config endpoint"""
    
    def test_config_returns_all_options(self, teacher_token):
        """Config endpoint returns subjects, year_groups, styles, tones, etc."""
        response = requests.get(
            f"{BASE_URL}/api/lectures/config",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Config failed: {response.text}"
        data = response.json()
        
        # Verify all expected keys
        assert "subjects" in data, "Missing subjects in config"
        assert "year_groups" in data, "Missing year_groups in config"
        assert "cambridge_stages" in data, "Missing cambridge_stages in config"
        assert "output_styles" in data, "Missing output_styles in config"
        assert "tone_options" in data, "Missing tone_options in config"
        assert "depth_options" in data, "Missing depth_options in config"
        assert "duration_options" in data, "Missing duration_options in config"
        
        # Verify some expected values
        assert len(data["cambridge_stages"]) >= 6, "Should have at least 6 Cambridge stages"
        assert "standard_lecture" in data["output_styles"], "Missing standard_lecture style"
        assert "formal" in data["tone_options"], "Missing formal tone"
        print(f"Config returned: {len(data['subjects'])} subjects, {len(data['year_groups'])} year groups")


class TestLecturesCRUD:
    """Test CRUD operations for lectures"""
    
    def test_create_lecture_manual(self, teacher_token):
        """POST /api/lectures/ creates a lecture"""
        payload = {
            "title": "TEST_Lecture_Algebra_Basics",
            "subject": "Mathematics",
            "year_group": "Year 10",
            "cambridge_stage": "IGCSE",
            "topic": "Algebra",
            "subtopic": "Linear Equations",
            "learning_objectives": "Understand linear equations",
            "rich_content": "<h2>Introduction</h2><p>This is a test lecture.</p>"
        }
        response = requests.post(
            f"{BASE_URL}/api/lectures/",
            json=payload,
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "lecture_id" in data, "Missing lecture_id"
        assert data["title"] == payload["title"], "Title mismatch"
        assert data["subject"] == payload["subject"], "Subject mismatch"
        assert data["status"] == "draft", "New lecture should be draft"
        assert data["ai_generated"] == False, "Manual lecture should not be AI generated"
        assert data["source_type"] == "manual", "Source type should be manual"
        
        # Store for later tests
        pytest.lecture_id = data["lecture_id"]
        print(f"Created lecture: {data['lecture_id']}")
    
    def test_get_my_lectures(self, teacher_token):
        """GET /api/lectures/my-lectures returns teacher's lectures"""
        response = requests.get(
            f"{BASE_URL}/api/lectures/my-lectures",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Get my-lectures failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        # Should have at least the lecture we just created
        lecture_ids = [l["lecture_id"] for l in data]
        assert hasattr(pytest, 'lecture_id') and pytest.lecture_id in lecture_ids, "Created lecture not in my-lectures"
        print(f"Found {len(data)} lectures for teacher")
    
    def test_get_lecture_by_id(self, teacher_token):
        """GET /api/lectures/{lecture_id} returns full lecture details"""
        if not hasattr(pytest, 'lecture_id'):
            pytest.skip("No lecture_id from previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/lectures/{pytest.lecture_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Get lecture failed: {response.text}"
        data = response.json()
        
        assert data["lecture_id"] == pytest.lecture_id
        assert "rich_content" in data, "Full details should include rich_content"
        assert data["title"] == "TEST_Lecture_Algebra_Basics"
        print(f"Retrieved lecture: {data['title']}")
    
    def test_update_lecture(self, teacher_token):
        """PUT /api/lectures/{lecture_id} updates lecture"""
        if not hasattr(pytest, 'lecture_id'):
            pytest.skip("No lecture_id from previous test")
        
        update_payload = {
            "title": "TEST_Lecture_Algebra_Updated",
            "subtopic": "Quadratic Equations",
            "rich_content": "<h2>Updated Content</h2><p>New content here.</p>"
        }
        response = requests.put(
            f"{BASE_URL}/api/lectures/{pytest.lecture_id}",
            json=update_payload,
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        
        assert "message" in data, "Should return success message"
        assert data["version"] == 2, "Version should increment to 2"
        
        # Verify update persisted
        get_response = requests.get(
            f"{BASE_URL}/api/lectures/{pytest.lecture_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        updated = get_response.json()
        assert updated["title"] == "TEST_Lecture_Algebra_Updated", "Title not updated"
        assert updated["subtopic"] == "Quadratic Equations", "Subtopic not updated"
        print(f"Updated lecture to version {data['version']}")
    
    def test_duplicate_lecture(self, teacher_token):
        """POST /api/lectures/{lecture_id}/duplicate creates a copy"""
        if not hasattr(pytest, 'lecture_id'):
            pytest.skip("No lecture_id from previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/lectures/{pytest.lecture_id}/duplicate",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Duplicate failed: {response.text}"
        data = response.json()
        
        assert data["lecture_id"] != pytest.lecture_id, "Duplicate should have new ID"
        assert "(Copy)" in data["title"], "Duplicate title should contain (Copy)"
        assert data["status"] == "draft", "Duplicate should be draft"
        assert data["version"] == 1, "Duplicate should start at version 1"
        
        # Store for cleanup
        pytest.duplicate_id = data["lecture_id"]
        print(f"Duplicated lecture: {data['lecture_id']}")
    
    def test_get_lecture_not_found(self, teacher_token):
        """GET /api/lectures/{invalid_id} returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/lectures/lec_nonexistent123",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 404, f"Should return 404, got {response.status_code}"


class TestLecturesAdmin:
    """Test admin endpoints (require management roles)"""
    
    def test_admin_all_lectures(self, superadmin_token):
        """GET /api/lectures/admin-all returns all lectures (SuperAdmin)"""
        response = requests.get(
            f"{BASE_URL}/api/lectures/admin-all",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200, f"Admin-all failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        print(f"Admin sees {len(data)} total lectures")
    
    def test_admin_all_lectures_ceo(self, ceo_token):
        """GET /api/lectures/admin-all accessible by CEO"""
        response = requests.get(
            f"{BASE_URL}/api/lectures/admin-all",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200, f"CEO admin-all failed: {response.text}"
    
    def test_admin_all_forbidden_for_teacher(self, teacher_token):
        """GET /api/lectures/admin-all forbidden for regular teacher"""
        response = requests.get(
            f"{BASE_URL}/api/lectures/admin-all",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        # Should be 403 Forbidden
        assert response.status_code == 403, f"Should be 403 for teacher, got {response.status_code}"
    
    def test_admin_stats(self, superadmin_token):
        """GET /api/lectures/admin-stats returns overview stats"""
        response = requests.get(
            f"{BASE_URL}/api/lectures/admin-stats",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200, f"Admin-stats failed: {response.text}"
        data = response.json()
        
        # Verify stats structure
        assert "total" in data, "Missing total count"
        assert "published" in data, "Missing published count"
        assert "drafts" in data, "Missing drafts count"
        assert "ai_generated" in data, "Missing ai_generated count"
        assert "by_subject" in data, "Missing by_subject breakdown"
        assert "by_teacher" in data, "Missing by_teacher breakdown"
        assert "recent_logs" in data, "Missing recent_logs"
        
        print(f"Stats: {data['total']} total, {data['published']} published, {data['drafts']} drafts")
    
    def test_activity_logs(self, superadmin_token):
        """GET /api/lectures/activity-logs returns audit logs"""
        response = requests.get(
            f"{BASE_URL}/api/lectures/activity-logs",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200, f"Activity-logs failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Should return a list"
        if len(data) > 0:
            log = data[0]
            assert "user_name" in log, "Log should have user_name"
            assert "action" in log, "Log should have action"
            assert "timestamp" in log, "Log should have timestamp"
        print(f"Found {len(data)} activity logs")


class TestLecturesPDFExport:
    """Test PDF export endpoint"""
    
    def test_pdf_export_teacher_variant(self, teacher_token):
        """GET /api/lectures/{id}/export-pdf?token=X&variant=teacher returns PDF"""
        if not hasattr(pytest, 'lecture_id'):
            pytest.skip("No lecture_id from previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/lectures/{pytest.lecture_id}/export-pdf",
            params={"token": teacher_token, "variant": "teacher"}
        )
        assert response.status_code == 200, f"PDF export failed: {response.text}"
        assert response.headers.get("content-type") == "application/pdf", "Should return PDF"
        assert len(response.content) > 0, "PDF should have content"
        print(f"PDF export successful: {len(response.content)} bytes")
    
    def test_pdf_export_student_variant(self, teacher_token):
        """GET /api/lectures/{id}/export-pdf?variant=student returns student handout"""
        if not hasattr(pytest, 'lecture_id'):
            pytest.skip("No lecture_id from previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/lectures/{pytest.lecture_id}/export-pdf",
            params={"token": teacher_token, "variant": "student"}
        )
        assert response.status_code == 200, f"Student PDF failed: {response.text}"
        assert response.headers.get("content-type") == "application/pdf"
    
    def test_pdf_export_revision_variant(self, teacher_token):
        """GET /api/lectures/{id}/export-pdf?variant=revision returns revision sheet"""
        if not hasattr(pytest, 'lecture_id'):
            pytest.skip("No lecture_id from previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/lectures/{pytest.lecture_id}/export-pdf",
            params={"token": teacher_token, "variant": "revision"}
        )
        assert response.status_code == 200, f"Revision PDF failed: {response.text}"
        assert response.headers.get("content-type") == "application/pdf"
    
    def test_pdf_export_requires_token(self):
        """PDF export requires token"""
        if not hasattr(pytest, 'lecture_id'):
            pytest.skip("No lecture_id from previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/lectures/{pytest.lecture_id}/export-pdf"
        )
        assert response.status_code == 401, f"Should require token, got {response.status_code}"


class TestLecturesFiltering:
    """Test filtering on my-lectures endpoint"""
    
    def test_filter_by_subject(self, teacher_token):
        """Filter lectures by subject"""
        response = requests.get(
            f"{BASE_URL}/api/lectures/my-lectures",
            params={"subject": "Mathematics"},
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        for lec in data:
            assert lec["subject"] == "Mathematics", f"Filter failed: {lec['subject']}"
    
    def test_filter_by_status(self, teacher_token):
        """Filter lectures by status"""
        response = requests.get(
            f"{BASE_URL}/api/lectures/my-lectures",
            params={"status": "draft"},
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        for lec in data:
            assert lec["status"] == "draft", f"Filter failed: {lec['status']}"
    
    def test_search_lectures(self, teacher_token):
        """Search lectures by title/topic"""
        response = requests.get(
            f"{BASE_URL}/api/lectures/my-lectures",
            params={"search": "Algebra"},
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should find our test lecture
        assert len(data) >= 1, "Should find at least one lecture with 'Algebra'"


class TestLecturesCleanup:
    """Cleanup test data"""
    
    def test_delete_lecture(self, teacher_token):
        """DELETE /api/lectures/{lecture_id} deletes lecture"""
        if not hasattr(pytest, 'lecture_id'):
            pytest.skip("No lecture_id to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/lectures/{pytest.lecture_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Delete failed: {response.text}"
        
        # Verify deletion
        get_response = requests.get(
            f"{BASE_URL}/api/lectures/{pytest.lecture_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert get_response.status_code == 404, "Deleted lecture should return 404"
        print(f"Deleted lecture: {pytest.lecture_id}")
    
    def test_delete_duplicate(self, teacher_token):
        """Delete the duplicated lecture"""
        if not hasattr(pytest, 'duplicate_id'):
            pytest.skip("No duplicate_id to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/lectures/{pytest.duplicate_id}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Delete duplicate failed: {response.text}"
        print(f"Deleted duplicate: {pytest.duplicate_id}")
