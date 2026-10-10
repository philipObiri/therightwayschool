"""
Iteration 30 Tests - Term Switching, Resources Edit, Multi-file Upload
Tests for:
1. Term switching reactivity (P0 bug fix)
2. PUT /api/lms/resources/{resource_id} endpoint
3. Resources CRUD operations
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTermSwitching:
    """Test term switching and data isolation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as SuperAdmin and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dwain@tcis.demo",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_active_term(self):
        """Test GET /api/settings/active-term"""
        response = requests.get(f"{BASE_URL}/api/settings/active-term", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "term" in data
        assert "academic_year" in data
        print(f"Current active term: {data['term']} {data['academic_year']}")
    
    def test_switch_to_term3_and_verify_finance_data(self):
        """Test switching to Term 3 and verify finance data changes"""
        # First get Term 2 data
        response = requests.put(f"{BASE_URL}/api/settings/active-term", 
                               json={"term": "Term 2", "academic_year": "2025-2026"},
                               headers=self.headers)
        assert response.status_code == 200
        
        # Get finance dashboard for Term 2
        response = requests.get(f"{BASE_URL}/api/finance/dashboard", headers=self.headers)
        assert response.status_code == 200
        term2_data = response.json()
        term2_invoiced = term2_data.get("total_invoiced", 0)
        print(f"Term 2 Total Invoiced: {term2_invoiced}")
        
        # Get invoices count for Term 2
        response = requests.get(f"{BASE_URL}/api/finance/invoices", headers=self.headers)
        assert response.status_code == 200
        term2_invoices = response.json()
        print(f"Term 2 Invoice count: {len(term2_invoices)}")
        
        # Switch to Term 3
        response = requests.put(f"{BASE_URL}/api/settings/active-term", 
                               json={"term": "Term 3", "academic_year": "2025-2026"},
                               headers=self.headers)
        assert response.status_code == 200
        
        # Get finance dashboard for Term 3
        response = requests.get(f"{BASE_URL}/api/finance/dashboard", headers=self.headers)
        assert response.status_code == 200
        term3_data = response.json()
        term3_invoiced = term3_data.get("total_invoiced", 0)
        print(f"Term 3 Total Invoiced: {term3_invoiced}")
        
        # Get invoices count for Term 3
        response = requests.get(f"{BASE_URL}/api/finance/invoices", headers=self.headers)
        assert response.status_code == 200
        term3_invoices = response.json()
        print(f"Term 3 Invoice count: {len(term3_invoices)}")
        
        # Verify data is different (Term 2 should have more data than Term 3)
        assert len(term2_invoices) != len(term3_invoices), "Invoice counts should differ between terms"
        print(f"PASS: Term 2 has {len(term2_invoices)} invoices, Term 3 has {len(term3_invoices)} invoices")
        
        # Restore to Term 2
        response = requests.put(f"{BASE_URL}/api/settings/active-term", 
                               json={"term": "Term 2", "academic_year": "2025-2026"},
                               headers=self.headers)
        assert response.status_code == 200
        print("Restored active term to Term 2")
    
    def test_switch_to_term1_and_verify(self):
        """Test switching to Term 1"""
        # Switch to Term 1
        response = requests.put(f"{BASE_URL}/api/settings/active-term", 
                               json={"term": "Term 1", "academic_year": "2025-2026"},
                               headers=self.headers)
        assert response.status_code == 200
        
        # Get invoices for Term 1
        response = requests.get(f"{BASE_URL}/api/finance/invoices", headers=self.headers)
        assert response.status_code == 200
        term1_invoices = response.json()
        print(f"Term 1 Invoice count: {len(term1_invoices)}")
        
        # Restore to Term 2
        response = requests.put(f"{BASE_URL}/api/settings/active-term", 
                               json={"term": "Term 2", "academic_year": "2025-2026"},
                               headers=self.headers)
        assert response.status_code == 200


class TestResourcesCRUD:
    """Test Resources CRUD including PUT endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as Teacher and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.created_resource_id = None
    
    def test_create_resource(self):
        """Test POST /api/lms/resources"""
        payload = {
            "title": "TEST_Scheme_of_Work_Math",
            "description": "Test scheme of work for Mathematics",
            "resource_type": "scheme_of_work",
            "rich_content": "<h1>Week 1</h1><p>Introduction to <strong>Algebra</strong></p><ul><li>Variables</li><li>Expressions</li></ul>",
            "content_text": "",
            "file_ids": []
        }
        response = requests.post(f"{BASE_URL}/api/lms/resources", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Create resource failed: {response.text}"
        data = response.json()
        assert "resource_id" in data
        assert data["title"] == payload["title"]
        assert data["resource_type"] == "scheme_of_work"
        assert data["rich_content"] == payload["rich_content"]
        self.__class__.created_resource_id = data["resource_id"]
        print(f"Created resource: {data['resource_id']}")
        return data["resource_id"]
    
    def test_get_resources(self):
        """Test GET /api/lms/resources"""
        response = requests.get(f"{BASE_URL}/api/lms/resources", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} resources")
    
    def test_update_resource(self):
        """Test PUT /api/lms/resources/{resource_id}"""
        # First create a resource
        create_payload = {
            "title": "TEST_Resource_To_Update",
            "description": "Original description",
            "resource_type": "worksheet",
            "content_text": "Original content"
        }
        response = requests.post(f"{BASE_URL}/api/lms/resources", json=create_payload, headers=self.headers)
        assert response.status_code == 200
        resource_id = response.json()["resource_id"]
        print(f"Created resource for update test: {resource_id}")
        
        # Now update it
        update_payload = {
            "title": "TEST_Resource_Updated_Title",
            "description": "Updated description with more details",
            "resource_type": "scheme_of_work",
            "rich_content": "<h2>Updated Content</h2><p>This is <em>rich text</em> content</p>",
            "content_text": "Updated plain text"
        }
        response = requests.put(f"{BASE_URL}/api/lms/resources/{resource_id}", json=update_payload, headers=self.headers)
        assert response.status_code == 200, f"Update resource failed: {response.text}"
        data = response.json()
        
        # Verify the update
        assert data["title"] == update_payload["title"], f"Title not updated: {data['title']}"
        assert data["description"] == update_payload["description"], f"Description not updated"
        assert data["resource_type"] == update_payload["resource_type"], f"Type not updated"
        assert data["rich_content"] == update_payload["rich_content"], f"Rich content not updated"
        print(f"Successfully updated resource: {resource_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/lms/resources/{resource_id}", headers=self.headers)
    
    def test_update_resource_with_file_ids(self):
        """Test updating resource with file_ids field"""
        # Create resource
        create_payload = {
            "title": "TEST_Resource_With_Files",
            "description": "Resource to test file_ids update",
            "resource_type": "past_paper",
            "file_ids": []
        }
        response = requests.post(f"{BASE_URL}/api/lms/resources", json=create_payload, headers=self.headers)
        assert response.status_code == 200
        resource_id = response.json()["resource_id"]
        
        # Update with mock file_ids
        update_payload = {
            "title": "TEST_Resource_With_Files_Updated",
            "file_ids": ["file_mock_123", "file_mock_456"]
        }
        response = requests.put(f"{BASE_URL}/api/lms/resources/{resource_id}", json=update_payload, headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["file_ids"] == update_payload["file_ids"], f"file_ids not updated correctly"
        print(f"Successfully updated resource with file_ids: {data['file_ids']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/lms/resources/{resource_id}", headers=self.headers)
    
    def test_delete_resource(self):
        """Test DELETE /api/lms/resources/{resource_id}"""
        # Create a resource to delete
        payload = {
            "title": "TEST_Resource_To_Delete",
            "description": "This will be deleted",
            "resource_type": "other"
        }
        response = requests.post(f"{BASE_URL}/api/lms/resources", json=payload, headers=self.headers)
        assert response.status_code == 200
        resource_id = response.json()["resource_id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/lms/resources/{resource_id}", headers=self.headers)
        assert response.status_code == 200
        print(f"Successfully deleted resource: {resource_id}")
    
    def test_update_nonexistent_resource(self):
        """Test PUT on non-existent resource returns 404"""
        response = requests.put(f"{BASE_URL}/api/lms/resources/res_nonexistent_123", 
                               json={"title": "Test"}, headers=self.headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for non-existent resource")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_cleanup_test_resources(self):
        """Clean up TEST_ prefixed resources"""
        response = requests.get(f"{BASE_URL}/api/lms/resources", headers=self.headers)
        if response.status_code == 200:
            resources = response.json()
            deleted = 0
            for r in resources:
                if r.get("title", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/lms/resources/{r['resource_id']}", headers=self.headers)
                    deleted += 1
            print(f"Cleaned up {deleted} test resources")
        
        # Restore term to Term 2
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dwain@tcis.demo",
            "password": "admin123"
        })
        if admin_response.status_code == 200:
            admin_token = admin_response.json().get("token")
            admin_headers = {"Authorization": f"Bearer {admin_token}"}
            requests.put(f"{BASE_URL}/api/settings/active-term", 
                        json={"term": "Term 2", "academic_year": "2025-2026"},
                        headers=admin_headers)
            print("Restored active term to Term 2")
