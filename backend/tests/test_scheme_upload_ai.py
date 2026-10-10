"""
Test Suite for Scheme of Work Upload + AI Processing Features (Iteration 35)
Tests: Upload flow, original_file_id in PUT, AI process file endpoint
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
    """Get teacher auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Teacher login failed: {response.status_code} - {response.text}")

@pytest.fixture
def teacher_client(teacher_token):
    """Session with teacher auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {teacher_token}"
    })
    return session


class TestUploadSchemeFlow:
    """Test upload scheme creation flow"""
    
    def test_upload_scheme_creates_with_file_id(self, teacher_client):
        """POST /api/schemes/upload creates scheme with original_file_id"""
        payload = {
            "title": "TEST_Upload AI Processing Scheme",
            "subject_name": "Physics",
            "subject_id": "subj_physics",
            "year_group": "Year 10",
            "class_name": "10B",
            "department": "Sciences",
            "curriculum": "Cambridge",
            "file_id": "test_uploaded_file_001"
        }
        response = teacher_client.post(f"{BASE_URL}/api/schemes/upload", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify scheme created with file_id
        assert "scheme_id" in data, "Missing scheme_id"
        assert data["original_file_id"] == "test_uploaded_file_001", f"Expected file_id, got {data.get('original_file_id')}"
        assert data["ai_processed"] == False, "ai_processed should be False initially"
        assert data["status"] == "draft", f"Expected draft status, got {data['status']}"
        assert data["title"] == payload["title"]
        assert data["subject_name"] == "Physics"
        print(f"Created uploaded scheme: {data['scheme_id']} with file_id: {data['original_file_id']}")
        return data["scheme_id"]

    def test_upload_scheme_without_file_id(self, teacher_client):
        """POST /api/schemes/upload works without file_id (empty string)"""
        payload = {
            "title": "TEST_Upload No File Scheme",
            "subject_name": "Chemistry"
        }
        response = teacher_client.post(f"{BASE_URL}/api/schemes/upload", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["original_file_id"] == "", "original_file_id should be empty string"
        print(f"Created upload scheme without file: {data['scheme_id']}")


class TestUpdateSchemeWithFileId:
    """Test PUT /api/schemes/{id} accepts original_file_id"""
    
    def test_update_scheme_with_original_file_id(self, teacher_client):
        """PUT /api/schemes/{id} can update original_file_id (Attach File feature)"""
        # First create a scheme from scratch (no file)
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Attach File Test Scheme",
            "subject_name": "Biology"
        })
        assert create_resp.status_code == 200
        scheme_id = create_resp.json()["scheme_id"]
        
        # Verify no file initially
        get_resp = teacher_client.get(f"{BASE_URL}/api/schemes/{scheme_id}")
        assert get_resp.json()["original_file_id"] is None, "Should have no file initially"
        
        # Now update with original_file_id (simulating Attach File)
        update_payload = {
            "original_file_id": "attached_file_002",
            "rich_content": "<p>Some content</p>"
        }
        response = teacher_client.put(f"{BASE_URL}/api/schemes/{scheme_id}", json=update_payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["original_file_id"] == "attached_file_002", f"Expected file_id to be updated, got {data.get('original_file_id')}"
        print(f"Successfully attached file to scheme: {scheme_id}")
        
        # Verify persistence with GET
        verify_resp = teacher_client.get(f"{BASE_URL}/api/schemes/{scheme_id}")
        assert verify_resp.json()["original_file_id"] == "attached_file_002", "File ID should persist"

    def test_update_scheme_preserves_other_fields(self, teacher_client):
        """PUT with original_file_id preserves other fields"""
        # Create scheme
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Preserve Fields Scheme",
            "subject_name": "Art",
            "year_group": "Year 8",
            "department": "Arts"
        })
        scheme_id = create_resp.json()["scheme_id"]
        
        # Update with file_id only
        response = teacher_client.put(f"{BASE_URL}/api/schemes/{scheme_id}", json={
            "original_file_id": "new_file_003"
        })
        assert response.status_code == 200
        
        data = response.json()
        # Verify original fields preserved
        assert data["subject_name"] == "Art", "subject_name should be preserved"
        assert data["year_group"] == "Year 8", "year_group should be preserved"
        assert data["department"] == "Arts", "department should be preserved"
        assert data["original_file_id"] == "new_file_003"
        print("Other fields preserved when updating file_id")


class TestSchemeWithFileState:
    """Test scheme state with file attached"""
    
    def test_scheme_with_file_has_correct_flags(self, teacher_client):
        """Scheme with file has ai_processed=False initially"""
        # Create via upload
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/upload", json={
            "title": "TEST_File State Test",
            "subject_name": "Music",
            "file_id": "state_test_file_004"
        })
        scheme_id = create_resp.json()["scheme_id"]
        
        # Get and verify state
        response = teacher_client.get(f"{BASE_URL}/api/schemes/{scheme_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["original_file_id"] == "state_test_file_004"
        assert data["ai_processed"] == False, "ai_processed should be False before AI processing"
        assert data["ai_version"] is None, "ai_version should be None before AI processing"
        print(f"Scheme {scheme_id} has correct initial file state")


class TestAIProcessFileEndpoint:
    """Test AI process file endpoint structure (not actual AI call)"""
    
    def test_ai_process_file_requires_file(self, teacher_client):
        """POST /api/schemes/{id}/ai-process-file returns 400 if no file"""
        # Create scheme without file
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_No File AI Test",
            "subject_name": "Drama"
        })
        scheme_id = create_resp.json()["scheme_id"]
        
        # Try to process without file
        response = teacher_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/ai-process-file", json={})
        assert response.status_code == 400, f"Expected 400 for no file, got {response.status_code}"
        assert "No file to process" in response.json().get("detail", "")
        print("AI process file correctly rejects scheme without file")


class TestCleanupIteration35:
    """Cleanup test data from iteration 35"""
    
    def test_cleanup_test_schemes(self, teacher_client):
        """Delete all TEST_ prefixed schemes from this iteration"""
        response = teacher_client.get(f"{BASE_URL}/api/schemes/")
        schemes = response.json()
        
        deleted = 0
        for scheme in schemes:
            if scheme.get("title", "").startswith("TEST_"):
                if scheme.get("status") not in ["approved", "published"]:
                    del_resp = teacher_client.delete(f"{BASE_URL}/api/schemes/{scheme['scheme_id']}")
                    if del_resp.status_code == 200:
                        deleted += 1
        
        print(f"Cleaned up {deleted} test schemes from iteration 35")
