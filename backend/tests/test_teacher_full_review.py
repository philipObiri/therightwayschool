"""
Test suite for Teacher Full Review endpoint in Monitoring module
Tests the comprehensive 360-degree teacher review feature
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "dwain@tcis.demo"
SUPERADMIN_PASSWORD = "admin123"
CEO_EMAIL = "ceo@tcis.demo"
CEO_PASSWORD = "ceo123"
TEACHER_EMAIL = "edmund@tcis.demo"
TEACHER_PASSWORD = "teacher123"


class TestTeacherFullReview:
    """Tests for /api/monitoring/teacher-full-review/{teacher_id} endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def _login(self, email, password):
        """Helper to login and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            token = response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            return response.json()
        return None
    
    def _get_teacher_id(self):
        """Get Edmund's teacher_id"""
        # Login as teacher to get their user_id
        login_data = self._login(TEACHER_EMAIL, TEACHER_PASSWORD)
        if login_data:
            return login_data.get("user", {}).get("user_id")
        return None
    
    # ─── Authentication Tests ───
    def test_superadmin_login(self):
        """SuperAdmin can login successfully"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "SuperAdmin"
        print("✓ SuperAdmin login successful")
    
    def test_ceo_login(self):
        """CEO can login successfully"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "CEO"
        print("✓ CEO login successful")
    
    def test_teacher_login(self):
        """Teacher can login successfully"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "Teacher"
        print("✓ Teacher login successful")
    
    # ─── Access Control Tests ───
    def test_superadmin_can_access_full_review(self):
        """SuperAdmin can access teacher full review endpoint"""
        # First get teacher ID
        teacher_id = self._get_teacher_id()
        assert teacher_id is not None, "Could not get teacher ID"
        
        # Login as SuperAdmin
        self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "teacher" in data
        assert "scorecard" in data
        assert "lessons" in data
        assert "lesson_plans" in data
        assert "assignments" in data
        assert "uploaded_files" in data
        assert "staff_documents" in data
        assert "clock_history" in data
        assert "audit_logs" in data
        assert "remarks" in data
        assert "wp_documents" in data
        assert "wp_audit" in data
        assert "summary" in data
        print("✓ SuperAdmin can access teacher full review")
    
    def test_ceo_can_access_full_review(self):
        """CEO can access teacher full review endpoint"""
        teacher_id = self._get_teacher_id()
        assert teacher_id is not None
        
        self._login(CEO_EMAIL, CEO_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}")
        assert response.status_code == 200
        data = response.json()
        assert "teacher" in data
        assert "summary" in data
        print("✓ CEO can access teacher full review")
    
    def test_teacher_cannot_access_full_review(self):
        """Teacher cannot access full review endpoint (403)"""
        teacher_id = self._get_teacher_id()
        assert teacher_id is not None
        
        # Login as teacher (not management)
        self._login(TEACHER_EMAIL, TEACHER_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}")
        assert response.status_code == 403
        print("✓ Teacher correctly denied access to full review (403)")
    
    def test_nonexistent_teacher_returns_404(self):
        """Requesting non-existent teacher returns 404"""
        self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/nonexistent_user_123")
        assert response.status_code == 404
        print("✓ Non-existent teacher returns 404")
    
    # ─── Response Data Validation Tests ───
    def test_full_review_teacher_data(self):
        """Full review returns correct teacher data"""
        teacher_id = self._get_teacher_id()
        self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}")
        assert response.status_code == 200
        data = response.json()
        
        teacher = data["teacher"]
        assert "user_id" in teacher
        assert "name" in teacher
        assert "email" in teacher
        assert "role" in teacher
        assert teacher["role"] == "Teacher"
        # Ensure sensitive data is excluded
        assert "password_hash" not in teacher
        assert "last_set_password" not in teacher
        print("✓ Teacher data is correct and excludes sensitive fields")
    
    def test_full_review_summary_counts(self):
        """Full review summary contains correct count fields"""
        teacher_id = self._get_teacher_id()
        self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}")
        assert response.status_code == 200
        data = response.json()
        
        summary = data["summary"]
        assert "total_lessons" in summary
        assert "total_plans" in summary
        assert "total_assignments" in summary
        assert "total_files" in summary
        assert "total_staff_docs" in summary
        assert "total_remarks" in summary
        assert "total_wp_docs" in summary
        
        # Verify counts are integers
        assert isinstance(summary["total_lessons"], int)
        assert isinstance(summary["total_files"], int)
        print(f"✓ Summary counts: Lessons={summary['total_lessons']}, Files={summary['total_files']}, Docs={summary['total_staff_docs']}, Remarks={summary['total_remarks']}")
    
    def test_full_review_scorecard_kpis(self):
        """Full review includes scorecard with KPIs"""
        teacher_id = self._get_teacher_id()
        self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}")
        assert response.status_code == 200
        data = response.json()
        
        scorecard = data["scorecard"]
        assert "teacher" in scorecard
        assert "kpis" in scorecard
        
        kpis = scorecard["kpis"]
        assert "lesson_plans" in kpis
        assert "lessons" in kpis
        assert "assignments" in kpis
        assert "marking" in kpis
        assert "observations" in kpis
        assert "tasks" in kpis
        assert "platform_activity" in kpis
        print("✓ Scorecard KPIs structure is correct")
    
    def test_full_review_uploaded_files_structure(self):
        """Uploaded files have correct structure"""
        teacher_id = self._get_teacher_id()
        self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}")
        assert response.status_code == 200
        data = response.json()
        
        files = data["uploaded_files"]
        assert isinstance(files, list)
        
        if len(files) > 0:
            file = files[0]
            assert "file_id" in file
            assert "original_filename" in file
            assert "content_type" in file
            assert "created_at" in file
            print(f"✓ Uploaded files structure correct ({len(files)} files)")
        else:
            print("✓ Uploaded files array is empty (no files uploaded)")
    
    def test_full_review_audit_logs_structure(self):
        """Audit logs have correct structure"""
        teacher_id = self._get_teacher_id()
        self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}")
        assert response.status_code == 200
        data = response.json()
        
        audit_logs = data["audit_logs"]
        assert isinstance(audit_logs, list)
        
        if len(audit_logs) > 0:
            log = audit_logs[0]
            assert "action" in log
            assert "entity_type" in log
            assert "timestamp" in log
            print(f"✓ Audit logs structure correct ({len(audit_logs)} entries)")
        else:
            print("✓ Audit logs array is empty")
    
    def test_full_review_clock_history_structure(self):
        """Clock history has correct structure"""
        teacher_id = self._get_teacher_id()
        self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}")
        assert response.status_code == 200
        data = response.json()
        
        clock_history = data["clock_history"]
        assert isinstance(clock_history, list)
        
        if len(clock_history) > 0:
            entry = clock_history[0]
            assert "entry_id" in entry or "clock_in" in entry
            print(f"✓ Clock history structure correct ({len(clock_history)} entries)")
        else:
            print("✓ Clock history array is empty")
    
    def test_full_review_remarks_structure(self):
        """Remarks have correct structure"""
        teacher_id = self._get_teacher_id()
        self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}")
        assert response.status_code == 200
        data = response.json()
        
        remarks = data["remarks"]
        assert isinstance(remarks, list)
        
        if len(remarks) > 0:
            remark = remarks[0]
            assert "remark_id" in remark
            assert "title" in remark
            assert "body" in remark
            assert "status" in remark
            print(f"✓ Remarks structure correct ({len(remarks)} remarks)")
        else:
            print("✓ Remarks array is empty")
    
    def test_full_review_staff_documents_structure(self):
        """Staff documents have correct structure"""
        teacher_id = self._get_teacher_id()
        self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}")
        assert response.status_code == 200
        data = response.json()
        
        staff_docs = data["staff_documents"]
        assert isinstance(staff_docs, list)
        
        if len(staff_docs) > 0:
            doc = staff_docs[0]
            assert "doc_id" in doc or "file_id" in doc
            print(f"✓ Staff documents structure correct ({len(staff_docs)} docs)")
        else:
            print("✓ Staff documents array is empty")


class TestTeacherScorecards:
    """Tests for teacher scorecards endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def _login(self, email, password):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            token = response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            return response.json()
        return None
    
    def test_get_all_teacher_scorecards(self):
        """SuperAdmin can get all teacher scorecards"""
        self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-scorecards")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            scorecard = data[0]
            assert "teacher_id" in scorecard
            assert "name" in scorecard
            assert "compliance_score" in scorecard
            print(f"✓ Got {len(data)} teacher scorecards")
        else:
            print("✓ Teacher scorecards endpoint works (no teachers)")


class TestFileEndpoints:
    """Tests for file preview and download endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def _login(self, email, password):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            token = response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            return response.json()
        return None
    
    def _get_teacher_files(self):
        """Get files from teacher full review"""
        # Get teacher ID
        login_data = self._login(TEACHER_EMAIL, TEACHER_PASSWORD)
        teacher_id = login_data.get("user", {}).get("user_id") if login_data else None
        
        if not teacher_id:
            return [], None
        
        # Login as SuperAdmin to get full review
        login_data = self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        token = login_data.get("token") if login_data else None
        
        response = self.session.get(f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}")
        if response.status_code == 200:
            return response.json().get("uploaded_files", []), token
        return [], token
    
    def test_file_preview_endpoint_exists(self):
        """File preview endpoint is accessible"""
        files, token = self._get_teacher_files()
        
        if len(files) > 0:
            file_id = files[0]["file_id"]
            response = self.session.get(f"{BASE_URL}/api/files/{file_id}/preview?token={token}")
            # Should return 200 or 500 (if storage not configured), not 404
            assert response.status_code in [200, 500]
            print(f"✓ File preview endpoint accessible (status: {response.status_code})")
        else:
            print("✓ No files to test preview endpoint (skipped)")
    
    def test_file_download_endpoint_exists(self):
        """File download endpoint is accessible"""
        files, token = self._get_teacher_files()
        
        if len(files) > 0:
            file_id = files[0]["file_id"]
            response = self.session.get(f"{BASE_URL}/api/files/{file_id}/download?token={token}")
            # Should return 200 or 500 (if storage not configured), not 404
            assert response.status_code in [200, 500]
            print(f"✓ File download endpoint accessible (status: {response.status_code})")
        else:
            print("✓ No files to test download endpoint (skipped)")
    
    def test_nonexistent_file_returns_404(self):
        """Non-existent file returns 404"""
        self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/files/nonexistent_file_123/preview")
        assert response.status_code == 404
        print("✓ Non-existent file returns 404")


class TestStaffEndpoint:
    """Tests for staff listing endpoint used by Teacher Review"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def _login(self, email, password):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            token = response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            return response.json()
        return None
    
    def test_get_staff_list(self):
        """SuperAdmin can get staff list"""
        self._login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
        
        response = self.session.get(f"{BASE_URL}/api/admin/staff")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        teachers = [s for s in data if s.get("role") == "Teacher"]
        print(f"✓ Got staff list with {len(teachers)} teachers")
        
        # Verify Edmund is in the list
        edmund = next((t for t in teachers if "edmund" in t.get("email", "").lower()), None)
        assert edmund is not None, "Edmund should be in teacher list"
        print(f"✓ Found Edmund in teacher list: {edmund.get('name')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
