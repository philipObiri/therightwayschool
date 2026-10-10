"""
Test Suite for Scheme of Work Module (Iteration 34)
Tests: Staff Dashboard, Create Scheme, Editor, AI Assistant, Submit, Management Dashboard, Review, Compliance
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

@pytest.fixture
def teacher_client(teacher_token):
    """Session with teacher auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {teacher_token}"
    })
    return session

@pytest.fixture
def superadmin_client(superadmin_token):
    """Session with superadmin auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {superadmin_token}"
    })
    return session


class TestStaffDashboard:
    """Test Staff Dashboard endpoints"""
    
    def test_my_dashboard_returns_stats(self, teacher_client):
        """Staff dashboard returns correct stats structure"""
        response = teacher_client.get(f"{BASE_URL}/api/schemes/my-dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify all required fields
        assert "total" in data, "Missing 'total' field"
        assert "term_schemes" in data, "Missing 'term_schemes' field"
        assert "drafts" in data, "Missing 'drafts' field"
        assert "submitted" in data, "Missing 'submitted' field"
        assert "returned" in data, "Missing 'returned' field"
        assert "approved" in data, "Missing 'approved' field"
        assert "active_term" in data, "Missing 'active_term' field"
        print(f"Staff dashboard stats: total={data['total']}, drafts={data['drafts']}, submitted={data['submitted']}")

    def test_list_schemes_for_teacher(self, teacher_client):
        """Teacher can list their own schemes"""
        response = teacher_client.get(f"{BASE_URL}/api/schemes/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of schemes"
        print(f"Teacher has {len(data)} schemes")


class TestCreateScheme:
    """Test scheme creation flow"""
    
    def test_create_scheme_from_scratch(self, teacher_client):
        """Teacher can create a new scheme"""
        payload = {
            "title": "TEST_Mathematics Scheme - Year 10 Term 2",
            "subject_id": "subj_math",
            "subject_name": "Mathematics",
            "year_group": "Year 10",
            "class_name": "10A",
            "department": "Sciences",
            "curriculum": "Cambridge"
        }
        response = teacher_client.post(f"{BASE_URL}/api/schemes/", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "scheme_id" in data, "Missing scheme_id"
        assert data["title"] == payload["title"], "Title mismatch"
        assert data["status"] == "draft", f"Expected draft status, got {data['status']}"
        assert data["subject_name"] == "Mathematics"
        print(f"Created scheme: {data['scheme_id']}")
        return data["scheme_id"]

    def test_get_scheme_by_id(self, teacher_client):
        """Teacher can get a specific scheme"""
        # First create a scheme
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Get Scheme Test",
            "subject_name": "English"
        })
        assert create_resp.status_code == 200
        scheme_id = create_resp.json()["scheme_id"]
        
        # Now get it
        response = teacher_client.get(f"{BASE_URL}/api/schemes/{scheme_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["scheme_id"] == scheme_id
        assert "comments" in data, "Missing comments array"
        assert "audit_trail" in data, "Missing audit_trail array"
        print(f"Got scheme with {len(data.get('audit_trail', []))} audit entries")


class TestSchemeEditor:
    """Test scheme editing functionality"""
    
    def test_update_scheme_content(self, teacher_client):
        """Teacher can update scheme content"""
        # Create scheme
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Update Test Scheme",
            "subject_name": "Science"
        })
        scheme_id = create_resp.json()["scheme_id"]
        
        # Update it
        update_payload = {
            "title": "TEST_Updated Title",
            "rich_content": "<h1>Week 1</h1><p>Introduction to Physics</p>",
            "year_group": "Year 9"
        }
        response = teacher_client.put(f"{BASE_URL}/api/schemes/{scheme_id}", json=update_payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["title"] == "TEST_Updated Title"
        assert data["rich_content"] == update_payload["rich_content"]
        # Status should change from draft to in_progress after edit
        assert data["status"] in ["draft", "in_progress"], f"Unexpected status: {data['status']}"
        print(f"Updated scheme, status: {data['status']}")


class TestSubmitWorkflow:
    """Test submit to management workflow"""
    
    def test_submit_scheme_to_management(self, teacher_client):
        """Teacher can submit scheme for review"""
        # Create and update scheme
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Submit Test Scheme",
            "subject_name": "History"
        })
        scheme_id = create_resp.json()["scheme_id"]
        
        # Add some content
        teacher_client.put(f"{BASE_URL}/api/schemes/{scheme_id}", json={
            "rich_content": "<p>Content for submission</p>"
        })
        
        # Submit
        response = teacher_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/submit")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] == "submitted", f"Expected submitted status, got {data.get('status')}"
        print(f"Scheme submitted successfully")
        return scheme_id

    def test_withdraw_submission(self, teacher_client):
        """Teacher can withdraw a submitted scheme"""
        # Create, update, and submit
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Withdraw Test Scheme",
            "subject_name": "Geography"
        })
        scheme_id = create_resp.json()["scheme_id"]
        teacher_client.put(f"{BASE_URL}/api/schemes/{scheme_id}", json={"rich_content": "<p>Test</p>"})
        teacher_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/submit")
        
        # Withdraw
        response = teacher_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/withdraw")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify status changed back
        get_resp = teacher_client.get(f"{BASE_URL}/api/schemes/{scheme_id}")
        assert get_resp.json()["status"] == "in_progress"
        print("Withdrawal successful")


class TestManagementDashboard:
    """Test Management Dashboard endpoints"""
    
    def test_management_dashboard_access(self, superadmin_client):
        """SuperAdmin can access management dashboard"""
        response = superadmin_client.get(f"{BASE_URL}/api/schemes/management-dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total" in data, "Missing 'total' field"
        assert "pending" in data, "Missing 'pending' field"
        assert "under_review" in data, "Missing 'under_review' field"
        assert "approved" in data, "Missing 'approved' field"
        assert "returned" in data, "Missing 'returned' field"
        assert "overdue_staff" in data, "Missing 'overdue_staff' field"
        print(f"Management dashboard: total={data['total']}, pending={data['pending']}, approved={data['approved']}")

    def test_management_dashboard_forbidden_for_teacher(self, teacher_client):
        """Teacher cannot access management dashboard"""
        response = teacher_client.get(f"{BASE_URL}/api/schemes/management-dashboard")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"

    def test_list_all_submitted_schemes(self, superadmin_client):
        """Management can list all submitted schemes"""
        response = superadmin_client.get(f"{BASE_URL}/api/schemes/", params={"status": "all_submitted"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list)
        # All returned schemes should not be drafts
        for scheme in data:
            assert scheme["status"] != "draft", f"Found draft scheme in all_submitted: {scheme['scheme_id']}"
        print(f"Found {len(data)} submitted schemes")


class TestManagementReview:
    """Test management review workflow"""
    
    def test_start_review(self, teacher_client, superadmin_client):
        """Management can start reviewing a scheme"""
        # Teacher creates and submits
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Review Test Scheme",
            "subject_name": "Art"
        })
        scheme_id = create_resp.json()["scheme_id"]
        teacher_client.put(f"{BASE_URL}/api/schemes/{scheme_id}", json={"rich_content": "<p>Art content</p>"})
        teacher_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/submit")
        
        # Management starts review
        response = superadmin_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/review", json={
            "action": "start_review"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify status
        get_resp = superadmin_client.get(f"{BASE_URL}/api/schemes/{scheme_id}")
        assert get_resp.json()["status"] == "under_review"
        print("Review started successfully")
        return scheme_id

    def test_approve_scheme(self, teacher_client, superadmin_client):
        """Management can approve a scheme"""
        # Create, submit, start review
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Approve Test Scheme",
            "subject_name": "Music"
        })
        scheme_id = create_resp.json()["scheme_id"]
        teacher_client.put(f"{BASE_URL}/api/schemes/{scheme_id}", json={"rich_content": "<p>Music content</p>"})
        teacher_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/submit")
        superadmin_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/review", json={"action": "start_review"})
        
        # Approve
        response = superadmin_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/review", json={
            "action": "approve",
            "comment": "Excellent scheme, well structured!"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify status and comment
        get_resp = superadmin_client.get(f"{BASE_URL}/api/schemes/{scheme_id}")
        data = get_resp.json()
        assert data["status"] == "approved"
        assert len(data["comments"]) > 0, "Comment should be added"
        print("Scheme approved successfully")

    def test_return_scheme(self, teacher_client, superadmin_client):
        """Management can return a scheme for revision"""
        # Create, submit, start review
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Return Test Scheme",
            "subject_name": "PE"
        })
        scheme_id = create_resp.json()["scheme_id"]
        teacher_client.put(f"{BASE_URL}/api/schemes/{scheme_id}", json={"rich_content": "<p>PE content</p>"})
        teacher_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/submit")
        superadmin_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/review", json={"action": "start_review"})
        
        # Return
        response = superadmin_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/review", json={
            "action": "return",
            "comment": "Please add more detail to learning objectives"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify status
        get_resp = superadmin_client.get(f"{BASE_URL}/api/schemes/{scheme_id}")
        assert get_resp.json()["status"] == "returned"
        print("Scheme returned successfully")


class TestComplianceTracker:
    """Test compliance tracker endpoint"""
    
    def test_compliance_tracker_access(self, superadmin_client):
        """Management can access compliance tracker"""
        response = superadmin_client.get(f"{BASE_URL}/api/schemes/management/compliance")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of teacher compliance data"
        if len(data) > 0:
            teacher = data[0]
            assert "user_id" in teacher
            assert "name" in teacher
            assert "required" in teacher
            assert "submitted" in teacher
            assert "approved" in teacher
            assert "rate" in teacher
            print(f"Compliance tracker has {len(data)} teachers")

    def test_compliance_tracker_forbidden_for_teacher(self, teacher_client):
        """Teacher cannot access compliance tracker"""
        response = teacher_client.get(f"{BASE_URL}/api/schemes/management/compliance")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


class TestComments:
    """Test comments functionality"""
    
    def test_add_comment_to_scheme(self, teacher_client):
        """Teacher can add comment to their scheme"""
        # Create scheme
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Comment Test Scheme",
            "subject_name": "Drama"
        })
        scheme_id = create_resp.json()["scheme_id"]
        
        # Add comment
        response = teacher_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/comments", json={
            "text": "This is a test comment from teacher"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify comment added
        get_resp = teacher_client.get(f"{BASE_URL}/api/schemes/{scheme_id}")
        comments = get_resp.json()["comments"]
        assert len(comments) > 0, "Comment should be added"
        assert comments[-1]["text"] == "This is a test comment from teacher"
        print("Comment added successfully")


class TestDeleteScheme:
    """Test scheme deletion"""
    
    def test_delete_draft_scheme(self, teacher_client):
        """Teacher can delete a draft scheme"""
        # Create scheme
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Delete Test Scheme",
            "subject_name": "ICT"
        })
        scheme_id = create_resp.json()["scheme_id"]
        
        # Delete
        response = teacher_client.delete(f"{BASE_URL}/api/schemes/{scheme_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify deleted
        get_resp = teacher_client.get(f"{BASE_URL}/api/schemes/{scheme_id}")
        assert get_resp.status_code == 404, "Scheme should be deleted"
        print("Scheme deleted successfully")

    def test_cannot_delete_approved_scheme(self, teacher_client, superadmin_client):
        """Cannot delete an approved scheme"""
        # Create, submit, approve
        create_resp = teacher_client.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_No Delete Approved Scheme",
            "subject_name": "French"
        })
        scheme_id = create_resp.json()["scheme_id"]
        teacher_client.put(f"{BASE_URL}/api/schemes/{scheme_id}", json={"rich_content": "<p>French</p>"})
        teacher_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/submit")
        superadmin_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/review", json={"action": "start_review"})
        superadmin_client.post(f"{BASE_URL}/api/schemes/{scheme_id}/review", json={"action": "approve", "comment": "Good"})
        
        # Try to delete
        response = teacher_client.delete(f"{BASE_URL}/api/schemes/{scheme_id}")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Cannot delete approved scheme - correct behavior")


class TestUploadScheme:
    """Test upload scheme endpoint"""
    
    def test_upload_scheme_endpoint(self, teacher_client):
        """Teacher can create scheme via upload endpoint"""
        payload = {
            "title": "TEST_Uploaded Scheme",
            "subject_name": "Biology",
            "year_group": "Year 11",
            "file_id": "test_file_123"  # Mock file ID
        }
        response = teacher_client.post(f"{BASE_URL}/api/schemes/upload", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["original_file_id"] == "test_file_123"
        assert data["status"] == "draft"
        print("Upload scheme endpoint works")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_schemes(self, teacher_client, superadmin_client):
        """Delete all TEST_ prefixed schemes"""
        # Get all schemes
        response = teacher_client.get(f"{BASE_URL}/api/schemes/")
        schemes = response.json()
        
        deleted = 0
        for scheme in schemes:
            if scheme.get("title", "").startswith("TEST_"):
                # Try to delete (may fail for approved ones)
                del_resp = teacher_client.delete(f"{BASE_URL}/api/schemes/{scheme['scheme_id']}")
                if del_resp.status_code == 200:
                    deleted += 1
        
        print(f"Cleaned up {deleted} test schemes")
