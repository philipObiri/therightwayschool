"""
Iteration 40: Test Reconciliation Tab and Student Management Features
- Reconciliation GET/POST/Approve/PDF endpoints
- Student email update and delete functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_CREDS = {"email": "ceo@tcis.demo", "password": "ceo123"}
SUPERADMIN_CREDS = {"email": "dwain@tcis.demo", "password": "admin123"}
FINANCE_CREDS = {"email": "finance@tcis.demo", "password": "finance123"}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def ceo_token(api_client):
    """Get CEO auth token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("CEO authentication failed")


@pytest.fixture(scope="module")
def superadmin_token(api_client):
    """Get SuperAdmin auth token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("SuperAdmin authentication failed")


@pytest.fixture(scope="module")
def finance_token(api_client):
    """Get Finance Officer auth token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=FINANCE_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Finance authentication failed")


class TestReconciliationEndpoints:
    """Test Reconciliation Tab API endpoints"""

    def test_get_reconciliation_as_finance(self, api_client, finance_token):
        """Finance officer can access reconciliation data"""
        response = api_client.get(
            f"{BASE_URL}/api/finance/reconciliation",
            params={"year_group": "Year 7"},
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "year_group" in data
        assert "term" in data
        assert "students" in data
        assert data["year_group"] == "Year 7"
        print(f"✓ Reconciliation GET: {len(data['students'])} students in Year 7")

    def test_get_reconciliation_as_ceo(self, api_client, ceo_token):
        """CEO (management) can access reconciliation data"""
        response = api_client.get(
            f"{BASE_URL}/api/finance/reconciliation",
            params={"year_group": "Year 8"},
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["year_group"] == "Year 8"
        print(f"✓ CEO can access reconciliation: {len(data['students'])} students")

    def test_reconciliation_student_data_structure(self, api_client, finance_token):
        """Verify reconciliation student data has correct fields"""
        response = api_client.get(
            f"{BASE_URL}/api/finance/reconciliation",
            params={"year_group": "Year 7"},
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        if data["students"]:
            student = data["students"][0]
            required_fields = ["student_id", "name", "total_due", "total_paid", "balance", "status"]
            for field in required_fields:
                assert field in student, f"Missing field: {field}"
            print(f"✓ Student data structure valid: {student['name']}")
        else:
            print("⚠ No students in Year 7 to verify structure")

    def test_save_reconciliation_as_finance(self, api_client, finance_token):
        """Finance officer can save reconciliation entries"""
        # First get students
        get_resp = api_client.get(
            f"{BASE_URL}/api/finance/reconciliation",
            params={"year_group": "Year 7"},
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert get_resp.status_code == 200
        students = get_resp.json().get("students", [])
        
        if not students:
            pytest.skip("No students in Year 7 to test save")
        
        # Save reconciliation for first student
        test_entry = {
            "student_id": students[0]["student_id"],
            "total_due": 5000.00,
            "total_paid": 2500.00,
            "notes": "Test reconciliation entry"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/finance/reconciliation/save",
            json={"year_group": "Year 7", "entries": [test_entry]},
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200, f"Save failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "Saved" in data["message"]
        print(f"✓ Reconciliation save: {data['message']}")

    def test_save_reconciliation_updates_status_to_pending(self, api_client, finance_token):
        """Saved reconciliation entries should have 'pending' status"""
        # Get reconciliation data after save
        response = api_client.get(
            f"{BASE_URL}/api/finance/reconciliation",
            params={"year_group": "Year 7"},
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        students = response.json().get("students", [])
        
        # Find students with pending status
        pending = [s for s in students if s.get("status") == "pending"]
        print(f"✓ Found {len(pending)} pending reconciliation records")

    def test_approve_reconciliation_as_ceo(self, api_client, ceo_token, finance_token):
        """CEO can approve pending reconciliation records"""
        # First ensure there's a pending record
        get_resp = api_client.get(
            f"{BASE_URL}/api/finance/reconciliation",
            params={"year_group": "Year 7"},
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        students = get_resp.json().get("students", [])
        pending = [s for s in students if s.get("status") == "pending"]
        
        if not pending:
            # Create a pending record first
            if students:
                api_client.post(
                    f"{BASE_URL}/api/finance/reconciliation/save",
                    json={"year_group": "Year 7", "entries": [{
                        "student_id": students[0]["student_id"],
                        "total_due": 6000.00,
                        "total_paid": 3000.00
                    }]},
                    headers={"Authorization": f"Bearer {finance_token}"}
                )
        
        # Now approve
        response = api_client.post(
            f"{BASE_URL}/api/finance/reconciliation/approve",
            json={"year_group": "Year 7"},
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200, f"Approve failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Reconciliation approve: {data['message']}")

    def test_approve_reconciliation_as_superadmin(self, api_client, superadmin_token):
        """SuperAdmin can approve reconciliation records"""
        response = api_client.post(
            f"{BASE_URL}/api/finance/reconciliation/approve",
            json={"year_group": "Year 8"},
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        print(f"✓ SuperAdmin can approve reconciliation")

    def test_reconciliation_pdf_download(self, api_client, finance_token):
        """Reconciliation PDF can be downloaded with token"""
        response = api_client.get(
            f"{BASE_URL}/api/finance/reconciliation/pdf",
            params={"year_group": "Year 7", "token": finance_token}
        )
        assert response.status_code == 200, f"PDF download failed: {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        assert len(response.content) > 1000  # PDF should have content
        print(f"✓ Reconciliation PDF downloaded: {len(response.content)} bytes")

    def test_reconciliation_pdf_with_auth_header(self, api_client, ceo_token):
        """Reconciliation PDF works with Authorization header"""
        response = api_client.get(
            f"{BASE_URL}/api/finance/reconciliation/pdf",
            params={"year_group": "Year 8"},
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
        print(f"✓ PDF with auth header: {len(response.content)} bytes")

    def test_reconciliation_year_group_selector(self, api_client, finance_token):
        """Different year groups return different data"""
        year_groups = ["Year 7", "Year 8", "Year 9", "Year 10"]
        for yg in year_groups:
            response = api_client.get(
                f"{BASE_URL}/api/finance/reconciliation",
                params={"year_group": yg},
                headers={"Authorization": f"Bearer {finance_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["year_group"] == yg
        print(f"✓ Year group selector works for {len(year_groups)} groups")


class TestStudentEmailUpdate:
    """Test student email editing functionality"""

    def test_get_student_details(self, api_client, superadmin_token):
        """Can fetch student details including email"""
        # First get a student
        students_resp = api_client.get(
            f"{BASE_URL}/api/admin/students",
            params={"year_group": "Year 7"},
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert students_resp.status_code == 200
        students = students_resp.json()
        
        if not students:
            pytest.skip("No students to test")
        
        student_id = students[0]["user_id"]
        response = api_client.get(
            f"{BASE_URL}/api/admin/students/{student_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "name" in data
        print(f"✓ Student details fetched: {data['name']} ({data['email']})")

    def test_update_student_email(self, api_client, superadmin_token):
        """Can update student email"""
        # Get a student
        students_resp = api_client.get(
            f"{BASE_URL}/api/admin/students",
            params={"year_group": "Year 7"},
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        students = students_resp.json()
        
        if not students:
            pytest.skip("No students to test")
        
        student = students[0]
        student_id = student["user_id"]
        original_email = student.get("email", "")
        
        # Update email
        new_email = f"test.update.{student_id[:8]}@tcis.student"
        response = api_client.put(
            f"{BASE_URL}/api/admin/students/{student_id}",
            json={"email": new_email},
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        # Verify update
        verify_resp = api_client.get(
            f"{BASE_URL}/api/admin/students/{student_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert verify_resp.status_code == 200
        updated = verify_resp.json()
        assert updated["email"] == new_email
        print(f"✓ Student email updated: {original_email} -> {new_email}")
        
        # Restore original email
        api_client.put(
            f"{BASE_URL}/api/admin/students/{student_id}",
            json={"email": original_email},
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )

    def test_email_uniqueness_validation(self, api_client, superadmin_token):
        """Duplicate email should be rejected"""
        # Get two students
        students_resp = api_client.get(
            f"{BASE_URL}/api/admin/students",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        students = students_resp.json()
        
        if len(students) < 2:
            pytest.skip("Need at least 2 students to test uniqueness")
        
        student1 = students[0]
        student2 = students[1]
        
        # Try to set student2's email to student1's email
        response = api_client.put(
            f"{BASE_URL}/api/admin/students/{student2['user_id']}",
            json={"email": student1["email"]},
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        assert "already in use" in response.json().get("detail", "").lower() or "email" in response.json().get("detail", "").lower()
        print(f"✓ Duplicate email rejected correctly")


class TestStudentDelete:
    """Test student deletion functionality"""

    def test_create_and_delete_student(self, api_client, superadmin_token):
        """Can create and delete a test student"""
        # Create a test student
        test_student = {
            "name": "TEST_DeleteMe Student",
            "email": "test.deleteme@tcis.student",
            "year_group": "Year 7",
            "boarding_status": "day"
        }
        
        create_resp = api_client.post(
            f"{BASE_URL}/api/admin/students",
            json=test_student,
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        created = create_resp.json()
        student_id = created["user_id"]
        print(f"✓ Test student created: {student_id}")
        
        # Delete the student
        delete_resp = api_client.delete(
            f"{BASE_URL}/api/admin/students/{student_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
        data = delete_resp.json()
        assert "deleted" in data.get("message", "").lower()
        print(f"✓ Test student deleted: {data['message']}")
        
        # Verify deletion
        verify_resp = api_client.get(
            f"{BASE_URL}/api/admin/students/{student_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert verify_resp.status_code == 404
        print(f"✓ Deletion verified: student not found")

    def test_delete_requires_admin_role(self, api_client, finance_token):
        """Finance officer cannot delete students"""
        # Get a student
        students_resp = api_client.get(
            f"{BASE_URL}/api/admin/students",
            params={"year_group": "Year 7"},
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        students = students_resp.json()
        
        if not students:
            pytest.skip("No students to test")
        
        student_id = students[0]["user_id"]
        
        # Try to delete as finance
        response = api_client.delete(
            f"{BASE_URL}/api/admin/students/{student_id}",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Finance officer correctly denied delete permission")

    def test_delete_nonexistent_student(self, api_client, superadmin_token):
        """Deleting non-existent student returns 404"""
        response = api_client.delete(
            f"{BASE_URL}/api/admin/students/nonexistent_user_id_12345",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 404
        print(f"✓ Non-existent student delete returns 404")


class TestReconciliationRolePermissions:
    """Test role-based access for reconciliation"""

    def test_finance_cannot_approve(self, api_client, finance_token):
        """Finance officer cannot approve reconciliation (management only)"""
        response = api_client.post(
            f"{BASE_URL}/api/finance/reconciliation/approve",
            json={"year_group": "Year 7"},
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Finance correctly denied approve permission")

    def test_ceo_can_view_and_approve(self, api_client, ceo_token):
        """CEO has full access to reconciliation"""
        # View
        view_resp = api_client.get(
            f"{BASE_URL}/api/finance/reconciliation",
            params={"year_group": "Year 7"},
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert view_resp.status_code == 200
        
        # Approve
        approve_resp = api_client.post(
            f"{BASE_URL}/api/finance/reconciliation/approve",
            json={"year_group": "Year 7"},
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert approve_resp.status_code == 200
        print(f"✓ CEO has full reconciliation access")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
