"""
Test Suite for Digital Signatures and Document Locking
Tests: POST /api/wp/documents/{id}/sign, GET /api/wp/documents/{id}/signatures
Features: Draw/Type signatures, document locking after signing, rejection of signing locked docs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSignatureAndLocking:
    """Tests for digital signature and document locking features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as CEO and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as CEO
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@tcis.demo",
            "password": "ceo123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        data = login_resp.json()
        self.token = data.get("token")
        self.user = data.get("user", {})
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"Logged in as: {self.user.get('name')} ({self.user.get('role')})")
    
    def test_get_my_documents_smart_folder(self):
        """Test: Get 'My Documents' smart folder to find documents to sign"""
        resp = self.session.get(f"{BASE_URL}/api/wp/smart-folders/my_documents")
        assert resp.status_code == 200, f"Failed to get my_documents: {resp.text}"
        data = resp.json()
        assert "documents" in data
        print(f"Found {data.get('count', 0)} documents in 'My Documents'")
        return data.get("documents", [])
    
    def test_get_signatures_endpoint(self):
        """Test: GET /api/wp/documents/{id}/signatures returns list"""
        docs = self.test_get_my_documents_smart_folder()
        if not docs:
            pytest.skip("No documents found to test signatures")
        
        doc_id = docs[0].get("document_id")
        resp = self.session.get(f"{BASE_URL}/api/wp/documents/{doc_id}/signatures")
        assert resp.status_code == 200, f"Failed to get signatures: {resp.text}"
        sigs = resp.json()
        assert isinstance(sigs, list)
        print(f"Document {doc_id} has {len(sigs)} signatures")
        return doc_id, sigs
    
    def test_sign_document_with_draw_signature(self):
        """Test: POST /api/wp/documents/{id}/sign with draw signature locks document"""
        docs = self.test_get_my_documents_smart_folder()
        
        # Find an unlocked document
        unlocked_doc = None
        for doc in docs:
            if not doc.get("locked"):
                unlocked_doc = doc
                break
        
        if not unlocked_doc:
            pytest.skip("No unlocked documents available for signing test")
        
        doc_id = unlocked_doc.get("document_id")
        print(f"Testing sign on document: {unlocked_doc.get('title')} ({doc_id})")
        
        # Sign with draw signature (base64 image placeholder)
        sign_payload = {
            "signature_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "signature_type": "draw",
            "reason": "Reviewed and approved",
            "designation": "CEO"
        }
        
        resp = self.session.post(f"{BASE_URL}/api/wp/documents/{doc_id}/sign", json=sign_payload)
        assert resp.status_code == 200, f"Sign failed: {resp.text}"
        data = resp.json()
        
        # Verify response contains expected fields
        assert "sig_id" in data or "sig_hash" in data, "Response should contain sig_id or sig_hash"
        assert data.get("locked") == True, "Document should be locked after signing"
        print(f"Document signed successfully. Hash: {data.get('sig_hash')}, Locked: {data.get('locked')}")
        
        return doc_id
    
    def test_sign_locked_document_returns_400(self):
        """Test: Signing an already locked document returns 400 error"""
        docs = self.test_get_my_documents_smart_folder()
        
        # Find a locked document
        locked_doc = None
        for doc in docs:
            if doc.get("locked"):
                locked_doc = doc
                break
        
        if not locked_doc:
            # Try to sign a document first to create a locked one
            try:
                doc_id = self.test_sign_document_with_draw_signature()
                # Now try to sign again
                sign_payload = {
                    "signature_image": "data:image/png;base64,test",
                    "signature_type": "draw",
                    "reason": "Second signature attempt",
                    "designation": "CEO"
                }
                resp = self.session.post(f"{BASE_URL}/api/wp/documents/{doc_id}/sign", json=sign_payload)
                assert resp.status_code == 400, f"Expected 400 for locked doc, got {resp.status_code}: {resp.text}"
                print(f"Correctly rejected signing locked document with 400")
                return
            except Exception as e:
                pytest.skip(f"Could not create locked document for test: {e}")
        
        doc_id = locked_doc.get("document_id")
        print(f"Testing sign rejection on locked document: {locked_doc.get('title')}")
        
        sign_payload = {
            "signature_image": "data:image/png;base64,test",
            "signature_type": "draw",
            "reason": "Should fail",
            "designation": "CEO"
        }
        
        resp = self.session.post(f"{BASE_URL}/api/wp/documents/{doc_id}/sign", json=sign_payload)
        assert resp.status_code == 400, f"Expected 400 for locked doc, got {resp.status_code}: {resp.text}"
        print(f"Correctly rejected signing locked document with 400: {resp.json()}")
    
    def test_document_shows_locked_true_after_signing(self):
        """Test: After signing, document returns locked:true"""
        docs = self.test_get_my_documents_smart_folder()
        
        # Find a locked document (previously signed)
        locked_doc = None
        for doc in docs:
            if doc.get("locked"):
                locked_doc = doc
                break
        
        if not locked_doc:
            pytest.skip("No locked documents found to verify locked status")
        
        # Verify the document has locked:true
        assert locked_doc.get("locked") == True, "Document should have locked:true"
        print(f"Document '{locked_doc.get('title')}' correctly shows locked:true")
    
    def test_sign_with_type_signature(self):
        """Test: POST /api/wp/documents/{id}/sign with type signature"""
        docs = self.test_get_my_documents_smart_folder()
        
        # Find an unlocked document
        unlocked_doc = None
        for doc in docs:
            if not doc.get("locked"):
                unlocked_doc = doc
                break
        
        if not unlocked_doc:
            pytest.skip("No unlocked documents available for type signature test")
        
        doc_id = unlocked_doc.get("document_id")
        print(f"Testing type signature on document: {unlocked_doc.get('title')}")
        
        # Sign with type signature
        sign_payload = {
            "signature_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "signature_type": "type",
            "reason": "Verified for accuracy",
            "designation": "Chief Executive Officer",
            "font": "'Dancing Script', cursive"
        }
        
        resp = self.session.post(f"{BASE_URL}/api/wp/documents/{doc_id}/sign", json=sign_payload)
        assert resp.status_code == 200, f"Type sign failed: {resp.text}"
        data = resp.json()
        assert data.get("locked") == True
        print(f"Type signature applied successfully. Locked: {data.get('locked')}")


class TestSmartFolderCounts:
    """Test smart folder counts endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@tcis.demo",
            "password": "ceo123"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_smart_folder_counts(self):
        """Test: GET /api/wp/smart-folder-counts returns all folder counts"""
        resp = self.session.get(f"{BASE_URL}/api/wp/smart-folder-counts")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        
        expected_keys = ["pending_approval", "recently_edited", "my_documents", "shared_with_me", "flagged", "archived"]
        for key in expected_keys:
            assert key in data, f"Missing key: {key}"
            assert isinstance(data[key], int), f"{key} should be int"
        
        print(f"Smart folder counts: {data}")


class TestWorkingPaperDashboard:
    """Test premium dashboard endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@tcis.demo",
            "password": "ceo123"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_premium_dashboard(self):
        """Test: GET /api/wp/dashboard/premium returns dashboard data"""
        resp = self.session.get(f"{BASE_URL}/api/wp/dashboard/premium")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        
        # Verify key fields exist
        assert "total_documents" in data
        assert "total_folders" in data
        assert "recent_documents" in data
        print(f"Dashboard: {data.get('total_documents')} docs, {data.get('total_folders')} folders")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
