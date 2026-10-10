"""
Test Teacher Remarks API endpoints
- Teachers can create, view, reply to, and delete their own remarks
- Management (SuperAdmin, CEO, HeadTeacher, Admin, Principal, Founder) can view all remarks, respond, and update status
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEACHER_EMAIL = "edmund@tcis.demo"
TEACHER_PASSWORD = "teacher123"
SUPERADMIN_EMAIL = "dwain@tcis.demo"
SUPERADMIN_PASSWORD = "admin123"
CEO_EMAIL = "ceo@tcis.demo"
CEO_PASSWORD = "ceo123"


class TestRemarksAPI:
    """Test Teacher Remarks CRUD operations"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        """Get teacher auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def superadmin_token(self):
        """Get superadmin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200, f"SuperAdmin login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture
    def teacher_headers(self, teacher_token):
        return {"Authorization": f"Bearer {teacher_token}", "Content-Type": "application/json"}
    
    @pytest.fixture
    def superadmin_headers(self, superadmin_token):
        return {"Authorization": f"Bearer {superadmin_token}", "Content-Type": "application/json"}
    
    @pytest.fixture
    def ceo_headers(self, ceo_token):
        return {"Authorization": f"Bearer {ceo_token}", "Content-Type": "application/json"}
    
    # ─── Test 1: Teacher can create a remark ───────────────────────────────
    def test_teacher_create_remark(self, teacher_headers):
        """Teacher can create a new remark"""
        unique_id = uuid.uuid4().hex[:8]
        payload = {
            "title": f"TEST_Remark_{unique_id}",
            "body": "This is a test remark for testing purposes",
            "category": "class_remark",
            "priority": "normal",
            "subject": "Mathematics",
            "year_group": "Year 10"
        }
        response = requests.post(f"{BASE_URL}/api/remarks/", json=payload, headers=teacher_headers)
        assert response.status_code == 200, f"Create remark failed: {response.text}"
        
        data = response.json()
        assert "remark_id" in data
        assert data["title"] == payload["title"]
        assert data["body"] == payload["body"]
        assert data["category"] == "class_remark"
        assert data["status"] == "open"
        assert data["priority"] == "normal"
        assert data["subject"] == "Mathematics"
        assert data["year_group"] == "Year 10"
        assert "author_name" in data
        assert "created_at" in data
        
        # Store remark_id for later tests
        TestRemarksAPI.created_remark_id = data["remark_id"]
        print(f"Created remark: {data['remark_id']}")
    
    # ─── Test 2: Teacher can list their own remarks ────────────────────────
    def test_teacher_list_remarks(self, teacher_headers):
        """Teacher can list their own remarks"""
        response = requests.get(f"{BASE_URL}/api/remarks/", headers=teacher_headers)
        assert response.status_code == 200, f"List remarks failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        # Should contain the remark we just created
        remark_ids = [r["remark_id"] for r in data]
        assert TestRemarksAPI.created_remark_id in remark_ids, "Created remark not found in list"
        print(f"Teacher sees {len(data)} remarks")
    
    # ─── Test 3: Teacher can filter remarks by category ────────────────────
    def test_teacher_filter_by_category(self, teacher_headers):
        """Teacher can filter remarks by category"""
        response = requests.get(f"{BASE_URL}/api/remarks/?category=class_remark", headers=teacher_headers)
        assert response.status_code == 200, f"Filter by category failed: {response.text}"
        
        data = response.json()
        for remark in data:
            assert remark["category"] == "class_remark"
        print(f"Filtered by category: {len(data)} remarks")
    
    # ─── Test 4: Teacher can filter remarks by status ──────────────────────
    def test_teacher_filter_by_status(self, teacher_headers):
        """Teacher can filter remarks by status"""
        response = requests.get(f"{BASE_URL}/api/remarks/?status=open", headers=teacher_headers)
        assert response.status_code == 200, f"Filter by status failed: {response.text}"
        
        data = response.json()
        for remark in data:
            assert remark["status"] == "open"
        print(f"Filtered by status: {len(data)} remarks")
    
    # ─── Test 5: SuperAdmin can see ALL remarks ────────────────────────────
    def test_superadmin_sees_all_remarks(self, superadmin_headers):
        """SuperAdmin can see all remarks from all teachers"""
        response = requests.get(f"{BASE_URL}/api/remarks/", headers=superadmin_headers)
        assert response.status_code == 200, f"SuperAdmin list remarks failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        # Should contain the remark created by teacher
        remark_ids = [r["remark_id"] for r in data]
        assert TestRemarksAPI.created_remark_id in remark_ids, "SuperAdmin should see teacher's remark"
        print(f"SuperAdmin sees {len(data)} remarks (all teachers)")
    
    # ─── Test 6: SuperAdmin can get stats ──────────────────────────────────
    def test_superadmin_get_stats(self, superadmin_headers):
        """SuperAdmin can get remark statistics"""
        response = requests.get(f"{BASE_URL}/api/remarks/stats", headers=superadmin_headers)
        assert response.status_code == 200, f"Get stats failed: {response.text}"
        
        data = response.json()
        assert "total" in data
        assert "open" in data
        assert "in_progress" in data
        assert "resolved" in data
        assert "by_category" in data
        assert data["total"] >= 1  # At least the one we created
        print(f"Stats: total={data['total']}, open={data['open']}, in_progress={data['in_progress']}, resolved={data['resolved']}")
    
    # ─── Test 7: Teacher cannot get stats (management only) ────────────────
    def test_teacher_cannot_get_stats(self, teacher_headers):
        """Teacher cannot access stats endpoint (management only)"""
        response = requests.get(f"{BASE_URL}/api/remarks/stats", headers=teacher_headers)
        assert response.status_code == 403, f"Teacher should not access stats: {response.status_code}"
        print("Teacher correctly blocked from stats endpoint")
    
    # ─── Test 8: Teacher can reply to their own remark ─────────────────────
    def test_teacher_reply_to_own_remark(self, teacher_headers):
        """Teacher can reply to their own remark"""
        payload = {"text": "This is a follow-up from the teacher"}
        response = requests.post(
            f"{BASE_URL}/api/remarks/{TestRemarksAPI.created_remark_id}/respond",
            json=payload,
            headers=teacher_headers
        )
        assert response.status_code == 200, f"Teacher reply failed: {response.text}"
        
        data = response.json()
        assert "response" in data
        assert data["response"]["text"] == payload["text"]
        print(f"Teacher replied to remark: {data['response']['response_id']}")
    
    # ─── Test 9: SuperAdmin can respond to any remark ──────────────────────
    def test_superadmin_respond_to_remark(self, superadmin_headers):
        """SuperAdmin can respond to any remark"""
        payload = {"text": "Management response to this remark"}
        response = requests.post(
            f"{BASE_URL}/api/remarks/{TestRemarksAPI.created_remark_id}/respond",
            json=payload,
            headers=superadmin_headers
        )
        assert response.status_code == 200, f"SuperAdmin respond failed: {response.text}"
        
        data = response.json()
        assert "response" in data
        assert data["response"]["text"] == payload["text"]
        print(f"SuperAdmin responded: {data['response']['response_id']}")
    
    # ─── Test 10: SuperAdmin can update status ─────────────────────────────
    def test_superadmin_update_status(self, superadmin_headers):
        """SuperAdmin can update remark status"""
        for status in ["acknowledged", "in_progress", "resolved"]:
            payload = {"status": status}
            response = requests.patch(
                f"{BASE_URL}/api/remarks/{TestRemarksAPI.created_remark_id}/status",
                json=payload,
                headers=superadmin_headers
            )
            assert response.status_code == 200, f"Update status to {status} failed: {response.text}"
            print(f"Status updated to: {status}")
    
    # ─── Test 11: Teacher cannot update status ─────────────────────────────
    def test_teacher_cannot_update_status(self, teacher_headers):
        """Teacher cannot update remark status (management only)"""
        payload = {"status": "closed"}
        response = requests.patch(
            f"{BASE_URL}/api/remarks/{TestRemarksAPI.created_remark_id}/status",
            json=payload,
            headers=teacher_headers
        )
        assert response.status_code == 403, f"Teacher should not update status: {response.status_code}"
        print("Teacher correctly blocked from updating status")
    
    # ─── Test 12: CEO can also see all remarks and respond ─────────────────
    def test_ceo_can_see_and_respond(self, ceo_headers):
        """CEO (management role) can see all remarks and respond"""
        # List remarks
        response = requests.get(f"{BASE_URL}/api/remarks/", headers=ceo_headers)
        assert response.status_code == 200, f"CEO list remarks failed: {response.text}"
        
        data = response.json()
        remark_ids = [r["remark_id"] for r in data]
        assert TestRemarksAPI.created_remark_id in remark_ids, "CEO should see teacher's remark"
        
        # Respond to remark
        payload = {"text": "CEO response to this remark"}
        response = requests.post(
            f"{BASE_URL}/api/remarks/{TestRemarksAPI.created_remark_id}/respond",
            json=payload,
            headers=ceo_headers
        )
        assert response.status_code == 200, f"CEO respond failed: {response.text}"
        print("CEO can see all remarks and respond")
    
    # ─── Test 13: CEO can get stats ────────────────────────────────────────
    def test_ceo_can_get_stats(self, ceo_headers):
        """CEO can access stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/remarks/stats", headers=ceo_headers)
        assert response.status_code == 200, f"CEO stats failed: {response.text}"
        print("CEO can access stats")
    
    # ─── Test 14: Create remark validation ─────────────────────────────────
    def test_create_remark_validation(self, teacher_headers):
        """Create remark requires title and body"""
        # Missing title
        payload = {"body": "Test body only"}
        response = requests.post(f"{BASE_URL}/api/remarks/", json=payload, headers=teacher_headers)
        assert response.status_code == 400, f"Should fail without title: {response.status_code}"
        
        # Missing body
        payload = {"title": "Test title only"}
        response = requests.post(f"{BASE_URL}/api/remarks/", json=payload, headers=teacher_headers)
        assert response.status_code == 400, f"Should fail without body: {response.status_code}"
        print("Validation works correctly")
    
    # ─── Test 15: Invalid status update ────────────────────────────────────
    def test_invalid_status_update(self, superadmin_headers):
        """Invalid status value should be rejected"""
        payload = {"status": "invalid_status"}
        response = requests.patch(
            f"{BASE_URL}/api/remarks/{TestRemarksAPI.created_remark_id}/status",
            json=payload,
            headers=superadmin_headers
        )
        assert response.status_code == 400, f"Should reject invalid status: {response.status_code}"
        print("Invalid status correctly rejected")
    
    # ─── Test 16: Teacher can delete their own remark ──────────────────────
    def test_teacher_delete_own_remark(self, teacher_headers):
        """Teacher can delete their own remark"""
        # First create a new remark to delete
        unique_id = uuid.uuid4().hex[:8]
        payload = {
            "title": f"TEST_ToDelete_{unique_id}",
            "body": "This remark will be deleted",
            "category": "general"
        }
        response = requests.post(f"{BASE_URL}/api/remarks/", json=payload, headers=teacher_headers)
        assert response.status_code == 200
        remark_id = response.json()["remark_id"]
        
        # Now delete it
        response = requests.delete(f"{BASE_URL}/api/remarks/{remark_id}", headers=teacher_headers)
        assert response.status_code == 200, f"Delete failed: {response.text}"
        
        # Verify it's gone
        response = requests.get(f"{BASE_URL}/api/remarks/", headers=teacher_headers)
        remark_ids = [r["remark_id"] for r in response.json()]
        assert remark_id not in remark_ids, "Deleted remark should not appear in list"
        print("Teacher successfully deleted their own remark")
    
    # ─── Test 17: SuperAdmin can delete any remark ─────────────────────────
    def test_superadmin_delete_any_remark(self, teacher_headers, superadmin_headers):
        """SuperAdmin can delete any remark"""
        # Teacher creates a remark
        unique_id = uuid.uuid4().hex[:8]
        payload = {
            "title": f"TEST_AdminDelete_{unique_id}",
            "body": "This remark will be deleted by admin",
            "category": "general"
        }
        response = requests.post(f"{BASE_URL}/api/remarks/", json=payload, headers=teacher_headers)
        assert response.status_code == 200
        remark_id = response.json()["remark_id"]
        
        # SuperAdmin deletes it
        response = requests.delete(f"{BASE_URL}/api/remarks/{remark_id}", headers=superadmin_headers)
        assert response.status_code == 200, f"SuperAdmin delete failed: {response.text}"
        print("SuperAdmin successfully deleted teacher's remark")
    
    # ─── Test 18: Delete non-existent remark ───────────────────────────────
    def test_delete_nonexistent_remark(self, teacher_headers):
        """Deleting non-existent remark returns 404"""
        response = requests.delete(f"{BASE_URL}/api/remarks/rmk_nonexistent123", headers=teacher_headers)
        assert response.status_code == 404, f"Should return 404: {response.status_code}"
        print("Non-existent remark correctly returns 404")
    
    # ─── Cleanup: Delete the test remark ───────────────────────────────────
    def test_cleanup_test_remark(self, superadmin_headers):
        """Cleanup: Delete the main test remark"""
        if hasattr(TestRemarksAPI, 'created_remark_id'):
            response = requests.delete(
                f"{BASE_URL}/api/remarks/{TestRemarksAPI.created_remark_id}",
                headers=superadmin_headers
            )
            # May already be deleted or not exist
            print(f"Cleanup: Deleted test remark {TestRemarksAPI.created_remark_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
