"""
Working Paper Advanced Features - Backend API Tests
Tests for: Smart folders, folder templates, tasks, discussions, sharing, approval workflows, advanced search, premium dashboard
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_EMAIL = "ceo@tcis.demo"
CEO_PASSWORD = "ceo123"
TEACHER_EMAIL = "edmund@tcis.demo"
TEACHER_PASSWORD = "teacher123"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def ceo_token(api_client):
    """Get CEO authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": CEO_EMAIL,
        "password": CEO_PASSWORD
    })
    assert response.status_code == 200, f"CEO login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def teacher_token(api_client):
    """Get Teacher authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    assert response.status_code == 200, f"Teacher login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def ceo_client(api_client, ceo_token):
    """Session with CEO auth header"""
    api_client.headers.update({"Authorization": f"Bearer {ceo_token}"})
    return api_client


# ═══════════════════════════════════════════
# PREMIUM DASHBOARD TESTS
# ═══════════════════════════════════════════

class TestPremiumDashboard:
    """Tests for /api/wp/dashboard/premium endpoint"""
    
    def test_premium_dashboard_returns_data(self, ceo_client):
        """GET /api/wp/dashboard/premium returns dashboard data"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/dashboard/premium")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields exist
        assert "total_folders" in data
        assert "total_documents" in data
        assert "pending_approval" in data
        assert "approved" in data
        assert "tasks_todo" in data
        assert "tasks_in_progress" in data
        assert "today_activity" in data
        assert "recent_documents" in data
        assert "recent_activity" in data
        assert "upcoming_tasks" in data
        assert "status_breakdown" in data
        assert "department_breakdown" in data
        assert "is_admin" in data
        
        # CEO should be admin
        assert data["is_admin"] == True
        print(f"Dashboard: {data['total_folders']} folders, {data['total_documents']} docs, {data['pending_approval']} pending")


# ═══════════════════════════════════════════
# SMART FOLDERS TESTS
# ═══════════════════════════════════════════

class TestSmartFolders:
    """Tests for smart folder endpoints"""
    
    def test_smart_folder_counts(self, ceo_client):
        """GET /api/wp/smart-folder-counts returns count object"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/smart-folder-counts")
        assert response.status_code == 200
        
        data = response.json()
        assert "pending_approval" in data
        assert "recently_edited" in data
        assert "my_documents" in data
        assert "shared_with_me" in data
        assert "flagged" in data
        assert "archived" in data
        print(f"Smart folder counts: {data}")
    
    def test_smart_folder_pending_approval(self, ceo_client):
        """GET /api/wp/smart-folders/pending_approval returns documents"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/smart-folders/pending_approval")
        assert response.status_code == 200
        
        data = response.json()
        assert "name" in data
        assert "documents" in data
        assert "count" in data
        assert data["name"] == "Pending Approval"
        print(f"Pending approval: {data['count']} documents")
    
    def test_smart_folder_my_documents(self, ceo_client):
        """GET /api/wp/smart-folders/my_documents returns user's documents"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/smart-folders/my_documents")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "My Documents"
        assert isinstance(data["documents"], list)
    
    def test_smart_folder_recently_edited(self, ceo_client):
        """GET /api/wp/smart-folders/recently_edited returns recent docs"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/smart-folders/recently_edited")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Recently Edited"
    
    def test_smart_folder_shared_with_me(self, ceo_client):
        """GET /api/wp/smart-folders/shared_with_me returns shared docs"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/smart-folders/shared_with_me")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Shared With Me"
    
    def test_smart_folder_flagged(self, ceo_client):
        """GET /api/wp/smart-folders/flagged returns flagged docs"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/smart-folders/flagged")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Flagged Documents"
    
    def test_smart_folder_archived(self, ceo_client):
        """GET /api/wp/smart-folders/archived returns archived docs"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/smart-folders/archived")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Archived"


# ═══════════════════════════════════════════
# FOLDER TEMPLATES TESTS
# ═══════════════════════════════════════════

class TestFolderTemplates:
    """Tests for folder template endpoints"""
    
    def test_list_folder_templates(self, ceo_client):
        """GET /api/wp/folder-templates returns 8 templates"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/folder-templates")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 8, f"Expected 8 templates, got {len(data)}"
        
        # Verify template structure
        template_keys = [t["key"] for t in data]
        expected_keys = ["lesson_planning", "finance", "hr_records", "admissions", 
                        "board_meeting", "department", "project", "compliance"]
        for key in expected_keys:
            assert key in template_keys, f"Missing template: {key}"
        
        # Verify template has required fields
        for t in data:
            assert "key" in t
            assert "name" in t
            assert "description" in t
            assert "classification" in t
            assert "subfolders" in t
            assert isinstance(t["subfolders"], list)
        
        print(f"Found {len(data)} templates: {template_keys}")
    
    def test_create_from_template(self, ceo_client):
        """POST /api/wp/create-from-template creates folder + subfolders"""
        response = ceo_client.post(f"{BASE_URL}/api/wp/create-from-template", json={
            "template_key": "project",
            "name": "TEST_Project_Workspace",
            "department": "Testing"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "folder_id" in data
        assert "message" in data
        assert "4 subfolders" in data["message"]  # Project template has 4 subfolders
        
        folder_id = data["folder_id"]
        print(f"Created folder from template: {folder_id}")
        
        # Verify folder was created with subfolders
        folder_response = ceo_client.get(f"{BASE_URL}/api/wp/folders/{folder_id}")
        assert folder_response.status_code == 200
        folder_data = folder_response.json()
        assert folder_data["name"] == "TEST_Project_Workspace"
        assert len(folder_data["subfolders"]) == 4
        
        # Cleanup - delete the test folder
        ceo_client.delete(f"{BASE_URL}/api/wp/folders/{folder_id}")


# ═══════════════════════════════════════════
# TASK MANAGEMENT TESTS
# ═══════════════════════════════════════════

class TestTaskManagement:
    """Tests for task management endpoints"""
    
    def test_create_task(self, ceo_client):
        """POST /api/wp/tasks creates task"""
        response = ceo_client.post(f"{BASE_URL}/api/wp/tasks", json={
            "title": "TEST_Review Document",
            "description": "Review the quarterly report",
            "priority": "high",
            "due_date": "2026-04-15"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "task_id" in data
        assert data["title"] == "TEST_Review Document"
        assert data["priority"] == "high"
        assert data["status"] == "todo"
        
        task_id = data["task_id"]
        print(f"Created task: {task_id}")
        
        # Cleanup
        ceo_client.delete(f"{BASE_URL}/api/wp/tasks/{task_id}")
    
    def test_get_task_board(self, ceo_client):
        """GET /api/wp/tasks/board returns board with 4 columns"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/tasks/board")
        assert response.status_code == 200
        
        data = response.json()
        assert "todo" in data
        assert "in_progress" in data
        assert "review" in data
        assert "completed" in data
        
        assert isinstance(data["todo"], list)
        assert isinstance(data["in_progress"], list)
        assert isinstance(data["review"], list)
        assert isinstance(data["completed"], list)
        
        total = len(data["todo"]) + len(data["in_progress"]) + len(data["review"]) + len(data["completed"])
        print(f"Task board: {total} total tasks")
    
    def test_update_task_status(self, ceo_client):
        """PUT /api/wp/tasks/{id} updates task status"""
        # Create a task first
        create_response = ceo_client.post(f"{BASE_URL}/api/wp/tasks", json={
            "title": "TEST_Status Update Task",
            "priority": "medium"
        })
        task_id = create_response.json()["task_id"]
        
        # Update status
        update_response = ceo_client.put(f"{BASE_URL}/api/wp/tasks/{task_id}", json={
            "status": "in_progress"
        })
        assert update_response.status_code == 200
        
        # Verify in board
        board_response = ceo_client.get(f"{BASE_URL}/api/wp/tasks/board")
        board = board_response.json()
        in_progress_ids = [t["task_id"] for t in board["in_progress"]]
        assert task_id in in_progress_ids
        
        # Cleanup
        ceo_client.delete(f"{BASE_URL}/api/wp/tasks/{task_id}")


# ═══════════════════════════════════════════
# DOCUMENT DISCUSSIONS TESTS
# ═══════════════════════════════════════════

class TestDocumentDiscussions:
    """Tests for document discussion endpoints"""
    
    @pytest.fixture
    def test_document(self, ceo_client):
        """Create a test document for discussion tests"""
        # First create a folder
        folder_response = ceo_client.post(f"{BASE_URL}/api/wp/folders", json={
            "name": "TEST_Discussion_Folder",
            "classification": "public"
        })
        folder_id = folder_response.json()["folder_id"]
        
        # Create document
        doc_response = ceo_client.post(f"{BASE_URL}/api/wp/documents", json={
            "title": "TEST_Discussion_Document",
            "folder_id": folder_id
        })
        doc_id = doc_response.json()["document_id"]
        
        yield {"doc_id": doc_id, "folder_id": folder_id}
        
        # Cleanup
        ceo_client.delete(f"{BASE_URL}/api/wp/documents/{doc_id}")
        ceo_client.delete(f"{BASE_URL}/api/wp/folders/{folder_id}")
    
    def test_add_discussion_message(self, ceo_client, test_document):
        """POST /api/wp/documents/{id}/discussions creates discussion msg"""
        doc_id = test_document["doc_id"]
        
        response = ceo_client.post(f"{BASE_URL}/api/wp/documents/{doc_id}/discussions", json={
            "content": "This is a test discussion message",
            "type": "comment"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "msg_id" in data
        assert data["content"] == "This is a test discussion message"
        assert data["document_id"] == doc_id
        print(f"Created discussion message: {data['msg_id']}")
    
    def test_get_discussions(self, ceo_client, test_document):
        """GET /api/wp/documents/{id}/discussions returns messages"""
        doc_id = test_document["doc_id"]
        
        # Add a message first
        ceo_client.post(f"{BASE_URL}/api/wp/documents/{doc_id}/discussions", json={
            "content": "Test message for retrieval"
        })
        
        response = ceo_client.get(f"{BASE_URL}/api/wp/documents/{doc_id}/discussions")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1


# ═══════════════════════════════════════════
# DOCUMENT TIMELINE TESTS
# ═══════════════════════════════════════════

class TestDocumentTimeline:
    """Tests for document timeline endpoint"""
    
    def test_get_timeline(self, ceo_client):
        """GET /api/wp/documents/{id}/timeline returns activity timeline"""
        # Get an existing document
        folders_response = ceo_client.get(f"{BASE_URL}/api/wp/folders")
        folders = folders_response.json()
        
        if folders:
            folder_response = ceo_client.get(f"{BASE_URL}/api/wp/folders/{folders[0]['folder_id']}")
            folder_data = folder_response.json()
            
            if folder_data.get("documents"):
                doc_id = folder_data["documents"][0]["document_id"]
                
                response = ceo_client.get(f"{BASE_URL}/api/wp/documents/{doc_id}/timeline")
                assert response.status_code == 200
                
                data = response.json()
                assert isinstance(data, list)
                
                # Verify timeline entry structure if any exist
                if data:
                    entry = data[0]
                    assert "type" in entry
                    assert "action" in entry
                    assert "user" in entry
                    assert "timestamp" in entry
                
                print(f"Timeline has {len(data)} entries")
                return
        
        pytest.skip("No documents available for timeline test")


# ═══════════════════════════════════════════
# DOCUMENT SHARING TESTS
# ═══════════════════════════════════════════

class TestDocumentSharing:
    """Tests for document sharing endpoints"""
    
    @pytest.fixture
    def test_document(self, ceo_client):
        """Create a test document for sharing tests"""
        folder_response = ceo_client.post(f"{BASE_URL}/api/wp/folders", json={
            "name": "TEST_Sharing_Folder",
            "classification": "public"
        })
        folder_id = folder_response.json()["folder_id"]
        
        doc_response = ceo_client.post(f"{BASE_URL}/api/wp/documents", json={
            "title": "TEST_Sharing_Document",
            "folder_id": folder_id
        })
        doc_id = doc_response.json()["document_id"]
        
        yield {"doc_id": doc_id, "folder_id": folder_id}
        
        # Cleanup
        ceo_client.delete(f"{BASE_URL}/api/wp/documents/{doc_id}")
        ceo_client.delete(f"{BASE_URL}/api/wp/folders/{folder_id}")
    
    def test_create_share_link(self, ceo_client, test_document):
        """POST /api/wp/documents/{id}/share creates share link"""
        doc_id = test_document["doc_id"]
        
        response = ceo_client.post(f"{BASE_URL}/api/wp/documents/{doc_id}/share", json={
            "password": "test123",
            "expires_hours": 24,
            "permissions": ["view"]
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "link_id" in data
        assert "token" in data
        assert "expires_at" in data
        
        print(f"Created share link: {data['link_id']}")
    
    def test_list_share_links(self, ceo_client, test_document):
        """GET /api/wp/documents/{id}/share-links returns links"""
        doc_id = test_document["doc_id"]
        
        # Create a share link first
        ceo_client.post(f"{BASE_URL}/api/wp/documents/{doc_id}/share", json={
            "expires_hours": 72
        })
        
        response = ceo_client.get(f"{BASE_URL}/api/wp/documents/{doc_id}/share-links")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1


# ═══════════════════════════════════════════
# ADVANCED SEARCH TESTS
# ═══════════════════════════════════════════

class TestAdvancedSearch:
    """Tests for advanced search endpoint"""
    
    def test_advanced_search_basic(self, ceo_client):
        """GET /api/wp/search/advanced returns filtered results"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/search/advanced", params={
            "q": "test"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "documents" in data
        assert "folders" in data
        assert "total_docs" in data
        assert "total_folders" in data
        
        print(f"Search results: {data['total_docs']} docs, {data['total_folders']} folders")
    
    def test_advanced_search_with_filters(self, ceo_client):
        """GET /api/wp/search/advanced with multiple filters"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/search/advanced", params={
            "department": "Administration",
            "status": "draft"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["documents"], list)
    
    def test_advanced_search_by_file_type(self, ceo_client):
        """GET /api/wp/search/advanced by file type"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/search/advanced", params={
            "file_type": "pdf"
        })
        assert response.status_code == 200
        
        data = response.json()
        # All returned docs should be PDF
        for doc in data["documents"]:
            if doc.get("file_type"):
                assert doc["file_type"].lower() == "pdf"


# ═══════════════════════════════════════════
# APPROVAL WORKFLOW TESTS
# ═══════════════════════════════════════════

class TestApprovalWorkflow:
    """Tests for multi-stage approval workflow"""
    
    @pytest.fixture
    def test_document(self, ceo_client):
        """Create a test document for approval tests"""
        folder_response = ceo_client.post(f"{BASE_URL}/api/wp/folders", json={
            "name": "TEST_Approval_Folder",
            "classification": "public"
        })
        folder_id = folder_response.json()["folder_id"]
        
        doc_response = ceo_client.post(f"{BASE_URL}/api/wp/documents", json={
            "title": "TEST_Approval_Document",
            "folder_id": folder_id
        })
        doc_id = doc_response.json()["document_id"]
        
        yield {"doc_id": doc_id, "folder_id": folder_id}
        
        # Cleanup
        ceo_client.delete(f"{BASE_URL}/api/wp/documents/{doc_id}")
        ceo_client.delete(f"{BASE_URL}/api/wp/folders/{folder_id}")
    
    def test_create_approval_chain(self, ceo_client, test_document):
        """POST /api/wp/documents/{id}/approval-chain creates workflow"""
        doc_id = test_document["doc_id"]
        
        # Get staff for reviewers
        staff_response = ceo_client.get(f"{BASE_URL}/api/admin/staff")
        staff = staff_response.json()
        
        if len(staff) < 2:
            pytest.skip("Not enough staff for approval chain test")
        
        response = ceo_client.post(f"{BASE_URL}/api/wp/documents/{doc_id}/approval-chain", json={
            "steps": [
                {"user_id": staff[0]["user_id"], "role_label": "First Review", "user_name": staff[0]["name"]},
                {"user_id": staff[1]["user_id"], "role_label": "Final Approval", "user_name": staff[1]["name"]}
            ]
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "chain_id" in data
        assert len(data["steps"]) == 2
        assert data["status"] == "in_progress"
        assert data["current_step"] == 1
        
        print(f"Created approval chain: {data['chain_id']}")
    
    def test_get_approval_chain(self, ceo_client, test_document):
        """GET /api/wp/documents/{id}/approval-chain returns chain"""
        doc_id = test_document["doc_id"]
        
        # Create chain first
        staff_response = ceo_client.get(f"{BASE_URL}/api/admin/staff")
        staff = staff_response.json()
        
        if staff:
            ceo_client.post(f"{BASE_URL}/api/wp/documents/{doc_id}/approval-chain", json={
                "steps": [{"user_id": staff[0]["user_id"], "role_label": "Review"}]
            })
        
        response = ceo_client.get(f"{BASE_URL}/api/wp/documents/{doc_id}/approval-chain")
        assert response.status_code == 200


# ═══════════════════════════════════════════
# EXISTING WP V2 ENDPOINTS TESTS
# ═══════════════════════════════════════════

class TestWpV2Endpoints:
    """Tests for existing WP v2 endpoints (folders, documents, entries)"""
    
    def test_list_folders(self, ceo_client):
        """GET /api/wp/folders returns folder list"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/folders")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} root folders")
    
    def test_get_folder_tree(self, ceo_client):
        """GET /api/wp/folder-tree returns hierarchical tree"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/folder-tree")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify tree structure
        if data:
            node = data[0]
            assert "folder_id" in node
            assert "name" in node
            assert "children" in node
        
        print(f"Folder tree has {len(data)} root nodes")
    
    def test_create_folder(self, ceo_client):
        """POST /api/wp/folders creates folder"""
        response = ceo_client.post(f"{BASE_URL}/api/wp/folders", json={
            "name": "TEST_New_Folder",
            "description": "Test folder",
            "classification": "public",
            "department": "Testing"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "folder_id" in data
        assert data["name"] == "TEST_New_Folder"
        
        # Cleanup
        ceo_client.delete(f"{BASE_URL}/api/wp/folders/{data['folder_id']}")
    
    def test_get_folder_details(self, ceo_client):
        """GET /api/wp/folders/{id} returns folder with contents"""
        # Get first folder
        folders_response = ceo_client.get(f"{BASE_URL}/api/wp/folders")
        folders = folders_response.json()
        
        if not folders:
            pytest.skip("No folders available")
        
        folder_id = folders[0]["folder_id"]
        response = ceo_client.get(f"{BASE_URL}/api/wp/folders/{folder_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "folder_id" in data
        assert "name" in data
        assert "path" in data
        assert "subfolders" in data
        assert "documents" in data
        assert "entries" in data
    
    def test_wp_dashboard(self, ceo_client):
        """GET /api/wp/dashboard returns basic dashboard"""
        response = ceo_client.get(f"{BASE_URL}/api/wp/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_folders" in data
        assert "total_documents" in data


# ═══════════════════════════════════════════
# CLEANUP
# ═══════════════════════════════════════════

@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(ceo_client):
    """Cleanup TEST_ prefixed data after all tests"""
    yield
    
    # Cleanup tasks
    try:
        board = ceo_client.get(f"{BASE_URL}/api/wp/tasks/board").json()
        for col in ["todo", "in_progress", "review", "completed"]:
            for task in board.get(col, []):
                if task.get("title", "").startswith("TEST_"):
                    ceo_client.delete(f"{BASE_URL}/api/wp/tasks/{task['task_id']}")
    except:
        pass
    
    # Cleanup folders
    try:
        folders = ceo_client.get(f"{BASE_URL}/api/wp/folders").json()
        for folder in folders:
            if folder.get("name", "").startswith("TEST_"):
                ceo_client.delete(f"{BASE_URL}/api/wp/folders/{folder['folder_id']}")
    except:
        pass
