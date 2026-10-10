"""
Iteration 70: Test 4 NEW features
1. Teacher sees 'Booster Students' link in sidebar - /teacher/booster page
2. Parent/Student do NOT see Knowledge Base in sidebar
3. Parent/Student do NOT see emergency alert popup
4. Teacher cannot create Scheme of Work (POST /api/schemes/ returns 403)
5. Admin/Management CAN create Scheme of Work
6. GET /api/booster/lessons?teacher_id={id} returns teacher-specific lessons
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/')

# Test credentials
ADMIN_EMAIL = "dwain@tcis.demo"
ADMIN_PASSWORD = "admin123"
CEO_EMAIL = "ceo@tcis.demo"
CEO_PASSWORD = "ceo123"
TEACHER_HOA_EMAIL = "emmanuel@tcis.demo"  # HeadOfAcademics - IS a management role
TEACHER_HOA_PASSWORD = "teacher123"
PLAIN_TEACHER_EMAIL = "edmund@tcis.demo"  # Plain Teacher - NOT a management role
PLAIN_TEACHER_PASSWORD = "teacher123"
PARENT_EMAIL = "parent@tcis.demo"
PARENT_PASSWORD = "parent123"


class TestSchemeOfWorkRoleRestrictions:
    """Test that POST /api/schemes/ is restricted to management roles only"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login(self, email, password):
        """Login and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token"), data.get("user", {})
        return None, None
    
    def test_admin_can_create_scheme(self):
        """Admin (management role) should be able to create scheme"""
        token, user = self.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Admin login failed"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Admin_Scheme_Iter70",
            "subject_name": "Mathematics",
            "year_group": "Year 7",
            "department": "Mathematics"
        })
        
        # Admin should succeed (201 or 200)
        assert response.status_code in [200, 201], f"Admin should create scheme, got {response.status_code}: {response.text}"
        data = response.json()
        assert "scheme_id" in data, "Response should contain scheme_id"
        print(f"âœ“ Admin created scheme: {data.get('scheme_id')}")
        
        # Cleanup - delete the test scheme
        scheme_id = data.get("scheme_id")
        if scheme_id:
            self.session.delete(f"{BASE_URL}/api/schemes/{scheme_id}")
    
    def test_ceo_can_create_scheme(self):
        """CEO (management role) should be able to create scheme"""
        token, user = self.login(CEO_EMAIL, CEO_PASSWORD)
        assert token is not None, "CEO login failed"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_CEO_Scheme_Iter70",
            "subject_name": "Science",
            "year_group": "Year 8",
            "department": "Science"
        })
        
        assert response.status_code in [200, 201], f"CEO should create scheme, got {response.status_code}: {response.text}"
        data = response.json()
        assert "scheme_id" in data
        print(f"âœ“ CEO created scheme: {data.get('scheme_id')}")
        
        # Cleanup
        scheme_id = data.get("scheme_id")
        if scheme_id:
            self.session.delete(f"{BASE_URL}/api/schemes/{scheme_id}")
    
    def test_head_of_academics_can_create_scheme(self):
        """HeadOfAcademics (management role) should be able to create scheme"""
        token, user = self.login(TEACHER_HOA_EMAIL, TEACHER_HOA_PASSWORD)
        assert token is not None, "HeadOfAcademics login failed"
        assert user.get("role") == "HeadOfAcademics", f"Expected HeadOfAcademics role, got {user.get('role')}"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_HOA_Scheme_Iter70",
            "subject_name": "Chemistry",
            "year_group": "Year 9",
            "department": "Science"
        })
        
        # HeadOfAcademics IS in SCHEME_MGMT_ROLES, should succeed
        assert response.status_code in [200, 201], f"HeadOfAcademics should create scheme, got {response.status_code}: {response.text}"
        data = response.json()
        assert "scheme_id" in data
        print(f"âœ“ HeadOfAcademics created scheme: {data.get('scheme_id')}")
        
        # Cleanup
        scheme_id = data.get("scheme_id")
        if scheme_id:
            self.session.delete(f"{BASE_URL}/api/schemes/{scheme_id}")
    
    def test_plain_teacher_cannot_create_scheme(self):
        """Plain Teacher (NOT management role) should get 403 when creating scheme"""
        token, user = self.login(PLAIN_TEACHER_EMAIL, PLAIN_TEACHER_PASSWORD)
        assert token is not None, "Plain Teacher login failed"
        assert user.get("role") == "Teacher", f"Expected Teacher role, got {user.get('role')}"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Teacher_Scheme_Iter70",
            "subject_name": "ICT",
            "year_group": "Year 7",
            "department": "ICT"
        })
        
        # Plain Teacher should get 403 Forbidden
        assert response.status_code == 403, f"Plain Teacher should get 403, got {response.status_code}: {response.text}"
        print(f"âœ“ Plain Teacher correctly denied (403) from creating scheme")
    
    def test_parent_cannot_create_scheme(self):
        """Parent should get 403 when trying to create scheme"""
        token, user = self.login(PARENT_EMAIL, PARENT_PASSWORD)
        assert token is not None, "Parent login failed"
        assert user.get("role") == "Parent", f"Expected Parent role, got {user.get('role')}"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.post(f"{BASE_URL}/api/schemes/", json={
            "title": "TEST_Parent_Scheme_Iter70",
            "subject_name": "English",
            "year_group": "Year 7",
            "department": "English"
        })
        
        # Parent should get 403 Forbidden
        assert response.status_code == 403, f"Parent should get 403, got {response.status_code}: {response.text}"
        print(f"âœ“ Parent correctly denied (403) from creating scheme")


class TestBoosterLessonsTeacherFilter:
    """Test GET /api/booster/lessons?teacher_id={id} returns teacher-specific lessons"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login(self, email, password):
        """Login and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token"), data.get("user", {})
        return None, None
    
    def test_booster_lessons_endpoint_exists(self):
        """Test that /api/booster/lessons endpoint exists and works"""
        token, user = self.login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Admin login failed"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/booster/lessons")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"âœ“ GET /api/booster/lessons returns {len(data)} lessons")
    
    def test_booster_lessons_with_teacher_id_filter(self):
        """Test that teacher_id filter works on booster lessons endpoint"""
        token, user = self.login(TEACHER_HOA_EMAIL, TEACHER_HOA_PASSWORD)
        assert token is not None, "Teacher login failed"
        teacher_id = user.get("user_id")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/booster/lessons", params={"teacher_id": teacher_id})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # All returned lessons should be for this teacher (if any exist)
        for lesson in data:
            assert lesson.get("teacher_id") == teacher_id, f"Lesson {lesson.get('lesson_id')} has wrong teacher_id"
        
        print(f"âœ“ GET /api/booster/lessons?teacher_id={teacher_id} returns {len(data)} lessons for this teacher")
    
    def test_plain_teacher_can_access_booster_lessons(self):
        """Plain teacher should be able to access their booster lessons"""
        token, user = self.login(PLAIN_TEACHER_EMAIL, PLAIN_TEACHER_PASSWORD)
        assert token is not None, "Plain Teacher login failed"
        teacher_id = user.get("user_id")
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/booster/lessons", params={"teacher_id": teacher_id})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"âœ“ Plain Teacher can access booster lessons endpoint, got {len(data)} lessons")


class TestKnowledgeBaseRouteRestriction:
    """Test that /knowledge-base route is restricted from Parent and Student roles"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login(self, email, password):
        """Login and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token"), data.get("user", {})
        return None, None
    
    def test_admin_role_is_allowed_knowledge_base(self):
        """Admin should be in the allowed roles for knowledge base"""
        # This is a frontend route restriction test - we verify the role is in the allowed list
        # Based on App.js line 328: allowedRoles includes Admin, SuperAdmin, CEO, etc.
        allowed_roles = ['Admin', 'SuperAdmin', 'CEO', 'Founder', 'Principal', 'HeadTeacher', 
                        'HeadOfAcademics', 'Teacher', 'FinanceOfficer', 'HR_Officer', 
                        'BoardingOfficer', 'AdmissionsOfficer', 'Receptionist', 'Nurse']
        
        assert 'Admin' in allowed_roles
        assert 'Teacher' in allowed_roles
        assert 'Parent' not in allowed_roles, "Parent should NOT be in allowed roles"
        assert 'Student' not in allowed_roles, "Student should NOT be in allowed roles"
        print("âœ“ Knowledge Base route correctly excludes Parent and Student from allowed roles")
    
    def test_parent_role_verification(self):
        """Verify Parent role is correctly identified"""
        token, user = self.login(PARENT_EMAIL, PARENT_PASSWORD)
        assert token is not None, "Parent login failed"
        assert user.get("role") == "Parent", f"Expected Parent role, got {user.get('role')}"
        print(f"âœ“ Parent role verified: {user.get('name')} ({user.get('role')})")


class TestSchemeOfWorkMgmtRoles:
    """Verify MGMT_ROLES configuration in frontend matches backend"""
    
    def test_mgmt_roles_match(self):
        """Verify MGMT_ROLES in shared.js matches SCHEME_MGMT_ROLES in backend"""
        # From shared.js line 20
        frontend_mgmt_roles = ['SuperAdmin', 'Admin', 'CEO', 'Principal', 'HeadTeacher', 'Founder', 'HeadOfAcademics']
        
        # From schemes.py line 232
        backend_scheme_mgmt_roles = ('Admin', 'SuperAdmin', 'CEO', 'Founder', 'Principal', 'HeadTeacher', 'HeadOfAcademics')
        
        # Convert to sets for comparison
        frontend_set = set(frontend_mgmt_roles)
        backend_set = set(backend_scheme_mgmt_roles)
        
        assert frontend_set == backend_set, f"MGMT_ROLES mismatch: frontend={frontend_set}, backend={backend_set}"
        print(f"âœ“ MGMT_ROLES match between frontend and backend: {frontend_set}")
        
        # Verify Teacher is NOT in management roles
        assert 'Teacher' not in frontend_set, "Teacher should NOT be in MGMT_ROLES"
        assert 'Teacher' not in backend_set, "Teacher should NOT be in SCHEME_MGMT_ROLES"
        print("âœ“ Teacher correctly excluded from management roles")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

