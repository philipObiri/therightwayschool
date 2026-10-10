"""
Test Suite for Iteration 9: 
- CEO/SuperAdmin subject & class allocation to teachers
- Finance module role-based access (Admin=read-only, Finance/SuperAdmin/CEO=full access)
- Logo watermark (frontend test)
- Success tick animation (frontend test)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLoginCredentials:
    """Test login for different roles"""
    
    def test_ceo_login(self):
        """CEO login: ceo@tcis.demo / ceo123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@tcis.demo",
            "password": "ceo123"
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "CEO"
        print(f"CEO login successful: {data['user']['name']}")
        
    def test_admin_login(self):
        """Admin login: admin@tcis.demo / admin123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tcis.demo",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "Admin"
        print(f"Admin login successful: {data['user']['name']}")
        
    def test_finance_login(self):
        """Finance login: finance@tcis.demo / finance123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        assert response.status_code == 200, f"Finance login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "FinanceOfficer"
        print(f"Finance login successful: {data['user']['name']}")
        
    def test_teacher_login(self):
        """Teacher login: edmund@tcis.demo / teacher123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "Teacher"
        print(f"Teacher login successful: {data['user']['name']}")


@pytest.fixture
def ceo_token():
    """Get CEO auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ceo@tcis.demo",
        "password": "ceo123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("CEO login failed")
    
@pytest.fixture
def admin_token():
    """Get Admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@tcis.demo",
        "password": "admin123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin login failed")
    
@pytest.fixture
def finance_token():
    """Get Finance auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "finance@tcis.demo",
        "password": "finance123"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Finance login failed")


class TestFinanceRolePermissions:
    """Test Finance module role-based access control"""
    
    def test_admin_can_view_invoices(self, admin_token):
        """Admin should be able to GET /api/finance/invoices (read-only view)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/finance/invoices", headers=headers)
        assert response.status_code == 200, f"Admin GET invoices failed: {response.text}"
        print(f"Admin can view invoices: {len(response.json())} invoices returned")
        
    def test_admin_can_view_payments(self, admin_token):
        """Admin should be able to GET /api/finance/payments (read-only view)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/finance/payments", headers=headers)
        assert response.status_code == 200, f"Admin GET payments failed: {response.text}"
        print(f"Admin can view payments: {len(response.json())} payments returned")
        
    def test_admin_can_view_dashboard(self, admin_token):
        """Admin should be able to GET /api/finance/dashboard"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/finance/dashboard", headers=headers)
        assert response.status_code == 200, f"Admin GET dashboard failed: {response.text}"
        print(f"Admin can view finance dashboard")
        
    def test_admin_cannot_create_invoice(self, admin_token):
        """Admin should NOT be able to POST /api/finance/invoices (returns 403)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/finance/invoices", headers=headers, json={
            "student_id": "test_student",
            "term": "Term 2",
            "items": [{"name": "Test Fee", "amount": 100}]
        })
        assert response.status_code == 403, f"Admin POST invoices should return 403, got {response.status_code}"
        print(f"Admin correctly blocked from creating invoices (403)")
        
    def test_admin_cannot_record_payment(self, admin_token):
        """Admin should NOT be able to POST /api/finance/payments (returns 403)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/finance/payments", headers=headers, json={
            "student_id": "test_student",
            "amount": 500,
            "method": "cash"
        })
        assert response.status_code == 403, f"Admin POST payments should return 403, got {response.status_code}"
        print(f"Admin correctly blocked from recording payments (403)")
        
    def test_finance_can_create_invoice(self, finance_token):
        """Finance Officer should be able to POST /api/finance/invoices"""
        headers = {"Authorization": f"Bearer {finance_token}"}
        # First get a student to use
        students_resp = requests.get(f"{BASE_URL}/api/admin/students", headers=headers)
        if students_resp.status_code == 200 and students_resp.json():
            student_id = students_resp.json()[0].get("user_id")
            response = requests.post(f"{BASE_URL}/api/finance/invoices", headers=headers, json={
                "student_id": student_id,
                "term": "Term 2",
                "academic_year": "2025-2026",
                "items": [{"name": "TEST_Finance_Fee", "code": "TFF", "category": "other", "amount": 100}]
            })
            assert response.status_code == 200, f"Finance POST invoices failed: {response.text}"
            print(f"Finance Officer can create invoices")
        else:
            print("No students found, skipping invoice creation test")
            
    def test_ceo_can_create_invoice(self, ceo_token):
        """CEO should be able to POST /api/finance/invoices"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        students_resp = requests.get(f"{BASE_URL}/api/admin/students", headers=headers)
        if students_resp.status_code == 200 and students_resp.json():
            student_id = students_resp.json()[0].get("user_id")
            response = requests.post(f"{BASE_URL}/api/finance/invoices", headers=headers, json={
                "student_id": student_id,
                "term": "Term 2",
                "academic_year": "2025-2026",
                "items": [{"name": "TEST_CEO_Fee", "code": "TCF", "category": "other", "amount": 150}]
            })
            assert response.status_code == 200, f"CEO POST invoices failed: {response.text}"
            print(f"CEO can create invoices")
        else:
            print("No students found, skipping CEO invoice creation test")
            
    def test_admin_can_view_reports_arrears(self, admin_token):
        """Admin should be able to GET /api/finance/reports/arrears-ageing (part of FINANCE_VIEW_ROLES)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/finance/reports/arrears-ageing", headers=headers)
        assert response.status_code == 200, f"Admin GET arrears report failed: {response.text}"
        print(f"Admin can view arrears report")
        
    def test_admin_can_view_reports_collections(self, admin_token):
        """Admin should be able to GET /api/finance/reports/collections"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/finance/reports/collections", headers=headers)
        assert response.status_code == 200, f"Admin GET collections report failed: {response.text}"
        print(f"Admin can view collections report")


class TestSubjectClassAllocation:
    """Test CEO/SuperAdmin ability to allocate subjects and classes to teachers"""
    
    def test_get_subjects_list(self, ceo_token):
        """CEO can get list of all subjects"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        response = requests.get(f"{BASE_URL}/api/academic/subjects", headers=headers)
        assert response.status_code == 200, f"GET subjects failed: {response.text}"
        subjects = response.json()
        print(f"Found {len(subjects)} subjects available for allocation")
        return subjects
        
    def test_get_classes_list(self, ceo_token):
        """CEO can get list of all classes/year groups"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        response = requests.get(f"{BASE_URL}/api/academic/classes", headers=headers)
        assert response.status_code == 200, f"GET classes failed: {response.text}"
        classes = response.json()
        print(f"Found {len(classes)} classes/year groups available for allocation")
        return classes
        
    def test_get_teacher_profile(self, ceo_token):
        """CEO can get teacher profile with current allocations"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        # Get staff list first
        staff_resp = requests.get(f"{BASE_URL}/api/admin/staff", headers=headers)
        assert staff_resp.status_code == 200, f"GET staff failed: {staff_resp.text}"
        staff = staff_resp.json()
        
        # Find Edmund Ansah (teacher)
        teacher = next((s for s in staff if 'edmund' in s.get('email', '').lower()), None)
        if teacher:
            print(f"Teacher found: {teacher.get('name')}")
            print(f"  Current teaching_subjects: {teacher.get('teaching_subjects', [])}")
            print(f"  Current assigned_year_groups: {teacher.get('assigned_year_groups', [])}")
            return teacher
        else:
            print("Edmund teacher not found")
            return None
            
    def test_ceo_can_update_teacher_subjects(self, ceo_token):
        """CEO can update teacher's teaching_subjects field"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        
        # Get staff list
        staff_resp = requests.get(f"{BASE_URL}/api/admin/staff", headers=headers)
        staff = staff_resp.json()
        teacher = next((s for s in staff if 'edmund' in s.get('email', '').lower()), None)
        
        if not teacher:
            pytest.skip("Teacher Edmund not found")
            
        user_id = teacher.get('user_id')
        original_subjects = teacher.get('teaching_subjects', [])
        
        # Update to include Mathematics
        new_subjects = list(set(original_subjects + ['Mathematics']))
        response = requests.put(f"{BASE_URL}/api/auth/users/{user_id}", headers=headers, json={
            "teaching_subjects": new_subjects
        })
        assert response.status_code == 200, f"Update teaching_subjects failed: {response.text}"
        
        # Verify update persisted
        staff_resp2 = requests.get(f"{BASE_URL}/api/admin/staff", headers=headers)
        updated_teacher = next((s for s in staff_resp2.json() if s.get('user_id') == user_id), None)
        assert 'Mathematics' in updated_teacher.get('teaching_subjects', []), "Subject update did not persist"
        
        print(f"CEO successfully updated teacher subjects: {updated_teacher.get('teaching_subjects')}")
        
        # Restore original
        requests.put(f"{BASE_URL}/api/auth/users/{user_id}", headers=headers, json={
            "teaching_subjects": original_subjects
        })
        
    def test_ceo_can_update_teacher_year_groups(self, ceo_token):
        """CEO can update teacher's assigned_year_groups field"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        
        # Get staff list
        staff_resp = requests.get(f"{BASE_URL}/api/admin/staff", headers=headers)
        staff = staff_resp.json()
        teacher = next((s for s in staff if 'edmund' in s.get('email', '').lower()), None)
        
        if not teacher:
            pytest.skip("Teacher Edmund not found")
            
        user_id = teacher.get('user_id')
        original_groups = teacher.get('assigned_year_groups', [])
        
        # Update to include Year 10
        new_groups = list(set(original_groups + ['Year 10']))
        response = requests.put(f"{BASE_URL}/api/auth/users/{user_id}", headers=headers, json={
            "assigned_year_groups": new_groups
        })
        assert response.status_code == 200, f"Update assigned_year_groups failed: {response.text}"
        
        # Verify update persisted
        staff_resp2 = requests.get(f"{BASE_URL}/api/admin/staff", headers=headers)
        updated_teacher = next((s for s in staff_resp2.json() if s.get('user_id') == user_id), None)
        assert 'Year 10' in updated_teacher.get('assigned_year_groups', []), "Year group update did not persist"
        
        print(f"CEO successfully updated teacher year groups: {updated_teacher.get('assigned_year_groups')}")
        
        # Restore original
        requests.put(f"{BASE_URL}/api/auth/users/{user_id}", headers=headers, json={
            "assigned_year_groups": original_groups
        })


class TestStaffRegistry:
    """Test staff registry endpoints"""
    
    def test_ceo_can_access_staff_list(self, ceo_token):
        """CEO can access /api/admin/staff"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/staff", headers=headers)
        assert response.status_code == 200, f"GET staff failed: {response.text}"
        print(f"CEO can access staff list: {len(response.json())} staff members")
        
    def test_admin_can_access_staff_list(self, admin_token):
        """Admin can access /api/admin/staff"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/staff", headers=headers)
        assert response.status_code == 200, f"GET staff failed: {response.text}"
        print(f"Admin can access staff list: {len(response.json())} staff members")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
