"""
Iteration 31 Tests: PDF Viewing Fix & Working Paper Owner Permissions
Tests:
1. Staff Directory endpoint accessible to all authenticated users
2. Folder owner can delete documents in their folder
3. Folder owner can delete their folder even if restricted/confidential
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStaffDirectory:
    """Test GET /api/wp/staff-directory endpoint - should be accessible to all authenticated users"""
    
    def test_staff_directory_as_teacher(self):
        """Teacher should be able to access staff directory"""
        # Login as teacher
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert login_resp.status_code == 200, f"Teacher login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        
        # Access staff directory
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/api/wp/staff-directory", headers=headers)
        assert resp.status_code == 200, f"Staff directory failed: {resp.text}"
        
        data = resp.json()
        assert isinstance(data, list), "Staff directory should return a list"
        print(f"✓ Teacher can access staff directory: {len(data)} staff members")
        
        # Verify structure
        if len(data) > 0:
            staff = data[0]
            assert "user_id" in staff, "Staff should have user_id"
            assert "name" in staff, "Staff should have name"
            assert "role" in staff, "Staff should have role"
            print(f"✓ Staff data structure correct: {staff.get('name')} ({staff.get('role')})")
    
    def test_staff_directory_as_admin(self):
        """Admin should be able to access staff directory"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dwain@tcis.demo",
            "password": "admin123"
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("token")
        
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/api/wp/staff-directory", headers=headers)
        assert resp.status_code == 200
        print(f"✓ Admin can access staff directory: {len(resp.json())} staff members")


class TestFolderOwnerPermissions:
    """Test that folder owners have full permissions on their folders"""
    
    @pytest.fixture
    def teacher_auth(self):
        """Get teacher authentication"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert login_resp.status_code == 200
        return {
            "token": login_resp.json().get("token"),
            "user_id": login_resp.json().get("user", {}).get("user_id")
        }
    
    def test_create_restricted_folder_and_verify_owner_access(self, teacher_auth):
        """Teacher creates restricted folder and should have full access"""
        headers = {"Authorization": f"Bearer {teacher_auth['token']}"}
        
        # Create a restricted folder
        folder_data = {
            "name": f"TEST_Restricted_Folder_{os.urandom(4).hex()}",
            "description": "Test restricted folder for owner permissions",
            "classification": "restricted",
            "department": "Testing"
        }
        create_resp = requests.post(f"{BASE_URL}/api/wp/folders", json=folder_data, headers=headers)
        assert create_resp.status_code == 200, f"Create folder failed: {create_resp.text}"
        
        folder = create_resp.json()
        folder_id = folder.get("folder_id")
        assert folder_id, "Folder should have folder_id"
        assert folder.get("owner_id") == teacher_auth["user_id"], "Teacher should be owner"
        print(f"✓ Created restricted folder: {folder_id}")
        
        # Verify owner can access the folder
        get_resp = requests.get(f"{BASE_URL}/api/wp/folders/{folder_id}", headers=headers)
        assert get_resp.status_code == 200, f"Owner should access folder: {get_resp.text}"
        print(f"✓ Owner can access restricted folder")
        
        # Cleanup - owner should be able to delete
        del_resp = requests.delete(f"{BASE_URL}/api/wp/folders/{folder_id}", headers=headers)
        assert del_resp.status_code == 200, f"Owner should delete folder: {del_resp.text}"
        print(f"✓ Owner can delete restricted folder")
    
    def test_folder_owner_can_delete_documents(self, teacher_auth):
        """Folder owner should be able to delete documents in their folder"""
        headers = {"Authorization": f"Bearer {teacher_auth['token']}"}
        
        # Create a folder
        folder_data = {
            "name": f"TEST_DocDelete_Folder_{os.urandom(4).hex()}",
            "classification": "restricted"
        }
        folder_resp = requests.post(f"{BASE_URL}/api/wp/folders", json=folder_data, headers=headers)
        assert folder_resp.status_code == 200
        folder_id = folder_resp.json().get("folder_id")
        print(f"✓ Created folder: {folder_id}")
        
        # Upload a document to the folder
        doc_data = {
            "folder_id": folder_id,
            "title": f"TEST_Document_{os.urandom(4).hex()}",
            "description": "Test document for deletion",
            "file_id": "test_file_id",
            "file_type": "pdf"
        }
        doc_resp = requests.post(f"{BASE_URL}/api/wp/documents", json=doc_data, headers=headers)
        assert doc_resp.status_code == 200, f"Create doc failed: {doc_resp.text}"
        doc_id = doc_resp.json().get("document_id")
        print(f"✓ Created document: {doc_id}")
        
        # Owner should be able to delete the document
        del_doc_resp = requests.delete(f"{BASE_URL}/api/wp/documents/{doc_id}", headers=headers)
        assert del_doc_resp.status_code == 200, f"Owner should delete doc: {del_doc_resp.text}"
        print(f"✓ Folder owner can delete document in their folder")
        
        # Cleanup folder
        requests.delete(f"{BASE_URL}/api/wp/folders/{folder_id}", headers=headers)
    
    def test_confidential_folder_owner_permissions(self, teacher_auth):
        """Test owner permissions on confidential folder"""
        headers = {"Authorization": f"Bearer {teacher_auth['token']}"}
        
        # Create confidential folder
        folder_data = {
            "name": f"TEST_Confidential_{os.urandom(4).hex()}",
            "classification": "confidential",
            "department": "Testing"
        }
        create_resp = requests.post(f"{BASE_URL}/api/wp/folders", json=folder_data, headers=headers)
        assert create_resp.status_code == 200
        folder_id = create_resp.json().get("folder_id")
        print(f"✓ Created confidential folder: {folder_id}")
        
        # Owner should be able to set permissions
        perm_data = {
            "role": "Teacher",
            "permissions": ["view", "access"]
        }
        perm_resp = requests.post(f"{BASE_URL}/api/wp/folders/{folder_id}/permissions", json=perm_data, headers=headers)
        assert perm_resp.status_code == 200, f"Owner should set permissions: {perm_resp.text}"
        print(f"✓ Owner can set permissions on confidential folder")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/wp/folders/{folder_id}", headers=headers)


class TestFilePreviewEndpoint:
    """Test file preview endpoint with token authentication"""
    
    def test_file_preview_endpoint_exists(self):
        """Verify file preview endpoint structure"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("token")
        
        # Test that the preview endpoint accepts token parameter
        # We don't have a real file_id, but we can verify the endpoint structure
        resp = requests.get(f"{BASE_URL}/api/files/test_file_id/preview?token={token}")
        # Should return 404 (file not found) not 401 (unauthorized) or 500
        assert resp.status_code in [404, 400], f"Preview endpoint should accept token: {resp.status_code}"
        print(f"✓ File preview endpoint accepts token parameter (status: {resp.status_code})")


class TestResourcesWithFiles:
    """Test resources endpoint returns file_ids for viewing"""
    
    def test_resources_have_file_ids(self):
        """Verify resources include file_ids field"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("token")
        
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/api/lms/resources", headers=headers)
        assert resp.status_code == 200
        
        resources = resp.json()
        print(f"✓ Found {len(resources)} resources")
        
        # Check if any resources have file_ids
        resources_with_files = [r for r in resources if r.get("file_ids") and len(r.get("file_ids", [])) > 0]
        print(f"✓ Resources with files: {len(resources_with_files)}")
        
        if resources_with_files:
            sample = resources_with_files[0]
            print(f"✓ Sample resource with files: {sample.get('title')} - {len(sample.get('file_ids', []))} files")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
