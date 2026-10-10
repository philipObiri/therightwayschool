"""
Tests for Boarding and Admissions Modules - Iteration 10
Testing:
- Boarding: dashboard, students list, check-in/out, incidents, leave, dorms
- Admissions: dashboard, applications CRUD, status changes, enrollment
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Get auth tokens for testing"""
    
    def test_ceo_login(self):
        """CEO login to get token for boarding/admissions access"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@tcis.demo",
            "password": "ceo123"
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "CEO"
        pytest.ceo_token = data["token"]
        pytest.ceo_user = data["user"]
        print(f"CEO login successful: {data['user']['name']}")
    
    def test_admin_login(self):
        """Admin login to get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tcis.demo",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        pytest.admin_token = data["token"]
        print(f"Admin login successful: {data['user']['name']}")


class TestBoardingModule:
    """Tests for Boarding Officer module APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Ensure we have CEO token"""
        if not hasattr(pytest, 'ceo_token'):
            pytest.skip("CEO token not available")
        self.headers = {"Authorization": f"Bearer {pytest.ceo_token}"}
    
    def test_boarding_dashboard(self):
        """Test boarding dashboard returns stats"""
        response = requests.get(f"{BASE_URL}/api/boarding/dashboard", headers=self.headers)
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Verify expected fields
        assert "total_boarding" in data, "Missing total_boarding field"
        assert "checked_in_today" in data, "Missing checked_in_today field"
        assert "pending_leave" in data, "Missing pending_leave field"
        assert "open_incidents" in data, "Missing open_incidents field"
        assert "total_dorms" in data, "Missing total_dorms field"
        
        # Verify types
        assert isinstance(data["total_boarding"], int)
        assert isinstance(data["checked_in_today"], int)
        
        print(f"Boarding Dashboard: total_boarding={data['total_boarding']}, checked_in={data['checked_in_today']}, pending_leave={data['pending_leave']}, open_incidents={data['open_incidents']}")
    
    def test_boarding_students_list(self):
        """Test boarding students list returns students with class_name"""
        response = requests.get(f"{BASE_URL}/api/boarding/students", headers=self.headers)
        assert response.status_code == 200, f"Students list failed: {response.text}"
        students = response.json()
        
        assert isinstance(students, list), "Expected list of students"
        print(f"Total boarding students: {len(students)}")
        
        # Verify at least some students have class_name populated
        if students:
            # Check first student structure
            s = students[0]
            assert "user_id" in s, "Missing user_id"
            assert "name" in s, "Missing name"
            assert "class_name" in s, "Missing class_name field"
            
            # Count students with class_name
            with_class = sum(1 for s in students if s.get("class_name"))
            print(f"Students with class_name: {with_class}/{len(students)}")
        
        pytest.boarding_students = students
    
    def test_bulk_checkin(self):
        """Test bulk check-in functionality"""
        if not hasattr(pytest, 'boarding_students') or not pytest.boarding_students:
            pytest.skip("No boarding students available")
        
        # Select first 3 students for check-in
        student_ids = [s["user_id"] for s in pytest.boarding_students[:3]]
        
        response = requests.post(
            f"{BASE_URL}/api/boarding/checkin/bulk",
            headers=self.headers,
            json={"student_ids": student_ids, "type": "check_in", "notes": "Test bulk check-in"}
        )
        assert response.status_code == 200, f"Bulk check-in failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "3 students" in data["message"]
        print(f"Bulk check-in result: {data['message']}")
    
    def test_get_checkins_today(self):
        """Test listing today's check-ins"""
        response = requests.get(f"{BASE_URL}/api/boarding/checkins", headers=self.headers)
        assert response.status_code == 200, f"Checkins list failed: {response.text}"
        checkins = response.json()
        
        assert isinstance(checkins, list), "Expected list of checkins"
        print(f"Today's check-ins: {len(checkins)}")
        
        if checkins:
            # Verify structure
            c = checkins[0]
            assert "checkin_id" in c
            assert "student_id" in c
            assert "type" in c
            assert "student_name" in c
    
    def test_create_incident(self):
        """Test creating boarding incident"""
        if not hasattr(pytest, 'boarding_students') or not pytest.boarding_students:
            pytest.skip("No boarding students available")
        
        incident_data = {
            "student_id": pytest.boarding_students[0]["user_id"],
            "title": "TEST_Incident_Health_Check",
            "category": "health",
            "severity": "low",
            "description": "Routine health check test incident"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/boarding/incidents",
            headers=self.headers,
            json=incident_data
        )
        assert response.status_code == 200, f"Create incident failed: {response.text}"
        data = response.json()
        
        assert "incident_id" in data
        assert data["title"] == incident_data["title"]
        assert data["category"] == "health"
        assert data["severity"] == "low"
        assert data["status"] == "open"
        
        pytest.test_incident_id = data["incident_id"]
        print(f"Created incident: {data['incident_id']}")
    
    def test_list_incidents(self):
        """Test listing boarding incidents"""
        response = requests.get(f"{BASE_URL}/api/boarding/incidents", headers=self.headers)
        assert response.status_code == 200, f"List incidents failed: {response.text}"
        incidents = response.json()
        
        assert isinstance(incidents, list), "Expected list of incidents"
        print(f"Total incidents: {len(incidents)}")
        
        # Verify our test incident is in the list
        if hasattr(pytest, 'test_incident_id'):
            found = any(i["incident_id"] == pytest.test_incident_id for i in incidents)
            assert found, "Created incident not found in list"
    
    def test_resolve_incident(self):
        """Test resolving an incident"""
        if not hasattr(pytest, 'test_incident_id'):
            pytest.skip("No test incident available")
        
        response = requests.put(
            f"{BASE_URL}/api/boarding/incidents/{pytest.test_incident_id}",
            headers=self.headers,
            json={"status": "resolved", "resolution": "Test resolved"}
        )
        assert response.status_code == 200, f"Resolve incident failed: {response.text}"
        print(f"Incident resolved: {pytest.test_incident_id}")
    
    def test_create_dorm(self):
        """Test creating a dorm"""
        dorm_data = {
            "name": "TEST_Block_X",
            "capacity": 30,
            "gender": "boys",
            "floor": "2nd Floor"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/boarding/dorms",
            headers=self.headers,
            json=dorm_data
        )
        assert response.status_code == 200, f"Create dorm failed: {response.text}"
        data = response.json()
        
        assert "dorm_id" in data
        assert data["name"] == dorm_data["name"]
        assert data["capacity"] == 30
        assert data["gender"] == "boys"
        
        pytest.test_dorm_id = data["dorm_id"]
        print(f"Created dorm: {data['dorm_id']} ({data['name']})")
    
    def test_list_dorms(self):
        """Test listing dorms"""
        response = requests.get(f"{BASE_URL}/api/boarding/dorms", headers=self.headers)
        assert response.status_code == 200, f"List dorms failed: {response.text}"
        dorms = response.json()
        
        assert isinstance(dorms, list), "Expected list of dorms"
        print(f"Total dorms: {len(dorms)}")
        
        if dorms:
            d = dorms[0]
            assert "dorm_id" in d
            assert "name" in d
            assert "capacity" in d
            assert "occupancy" in d
    
    def test_create_leave_request(self):
        """Test creating leave request"""
        if not hasattr(pytest, 'boarding_students') or not pytest.boarding_students:
            pytest.skip("No boarding students available")
        
        leave_data = {
            "student_id": pytest.boarding_students[0]["user_id"],
            "start_date": "2026-02-01",
            "end_date": "2026-02-03",
            "reason": "TEST_Family event"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/boarding/leave",
            headers=self.headers,
            json=leave_data
        )
        assert response.status_code == 200, f"Create leave failed: {response.text}"
        data = response.json()
        
        assert "leave_id" in data
        assert data["status"] == "pending"
        
        pytest.test_leave_id = data["leave_id"]
        print(f"Created leave request: {data['leave_id']}")
    
    def test_approve_leave(self):
        """Test approving leave request"""
        if not hasattr(pytest, 'test_leave_id'):
            pytest.skip("No test leave available")
        
        response = requests.put(
            f"{BASE_URL}/api/boarding/leave/{pytest.test_leave_id}/approve",
            headers=self.headers
        )
        assert response.status_code == 200, f"Approve leave failed: {response.text}"
        data = response.json()
        assert data["message"] == "Leave approved"
        print(f"Leave approved: {pytest.test_leave_id}")
    
    def test_list_leaves(self):
        """Test listing leave requests"""
        response = requests.get(f"{BASE_URL}/api/boarding/leave", headers=self.headers)
        assert response.status_code == 200, f"List leaves failed: {response.text}"
        leaves = response.json()
        
        assert isinstance(leaves, list), "Expected list of leaves"
        print(f"Total leave requests: {len(leaves)}")


class TestAdmissionsModule:
    """Tests for Admissions Officer module APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Ensure we have CEO token"""
        if not hasattr(pytest, 'ceo_token'):
            pytest.skip("CEO token not available")
        self.headers = {"Authorization": f"Bearer {pytest.ceo_token}"}
    
    def test_admissions_dashboard(self):
        """Test admissions dashboard returns pipeline stats"""
        response = requests.get(f"{BASE_URL}/api/admissions/dashboard", headers=self.headers)
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        assert "total_applications" in data
        assert "by_stage" in data
        assert "pipeline_stages" in data
        
        # Verify pipeline stages
        expected_stages = ["received", "reviewed", "interviewed", "accepted", "waitlisted", "enrolled", "rejected"]
        assert data["pipeline_stages"] == expected_stages
        
        print(f"Admissions Dashboard: total={data['total_applications']}, by_stage={data['by_stage']}")
    
    def test_documents_checklist(self):
        """Test documents checklist endpoint"""
        response = requests.get(f"{BASE_URL}/api/admissions/documents-checklist", headers=self.headers)
        assert response.status_code == 200, f"Checklist failed: {response.text}"
        data = response.json()
        
        assert "required_documents" in data
        assert isinstance(data["required_documents"], list)
        assert len(data["required_documents"]) == 7
        print(f"Required documents: {data['required_documents']}")
    
    def test_create_application(self):
        """Test creating a new application"""
        timestamp = int(time.time())
        app_data = {
            "student_name": f"TEST_Student_{timestamp}",
            "date_of_birth": "2012-05-15",
            "gender": "Male",
            "applying_for": "Year 7",
            "boarding_status": "boarding",
            "guardian_name": "TEST_Guardian Parent",
            "guardian_phone": "+1234567890",
            "guardian_email": f"test_guardian_{timestamp}@example.com",
            "previous_school": "Test Primary School",
            "notes": "Test application for iteration 10"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admissions/applications",
            headers=self.headers,
            json=app_data
        )
        assert response.status_code == 200, f"Create application failed: {response.text}"
        data = response.json()
        
        assert "application_id" in data
        assert data["student_name"] == app_data["student_name"]
        assert data["status"] == "received"
        assert data["applying_for"] == "Year 7"
        
        pytest.test_app_id = data["application_id"]
        pytest.test_app_name = data["student_name"]
        print(f"Created application: {data['application_id']} for {data['student_name']}")
    
    def test_list_applications(self):
        """Test listing applications"""
        response = requests.get(f"{BASE_URL}/api/admissions/applications", headers=self.headers)
        assert response.status_code == 200, f"List applications failed: {response.text}"
        apps = response.json()
        
        assert isinstance(apps, list), "Expected list of applications"
        print(f"Total applications: {len(apps)}")
        
        # Verify our test app is in the list
        if hasattr(pytest, 'test_app_id'):
            found = any(a["application_id"] == pytest.test_app_id for a in apps)
            assert found, "Created application not found in list"
    
    def test_get_application(self):
        """Test getting specific application"""
        if not hasattr(pytest, 'test_app_id'):
            pytest.skip("No test application available")
        
        response = requests.get(
            f"{BASE_URL}/api/admissions/applications/{pytest.test_app_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get application failed: {response.text}"
        data = response.json()
        
        assert data["application_id"] == pytest.test_app_id
        assert data["status"] == "received"
    
    def test_change_status_to_reviewed(self):
        """Test changing application status to reviewed"""
        if not hasattr(pytest, 'test_app_id'):
            pytest.skip("No test application available")
        
        response = requests.put(
            f"{BASE_URL}/api/admissions/applications/{pytest.test_app_id}/status",
            headers=self.headers,
            json={"status": "reviewed"}
        )
        assert response.status_code == 200, f"Change status failed: {response.text}"
        data = response.json()
        assert "reviewed" in data["message"]
        print(f"Status changed to reviewed")
        
        # Verify status changed
        get_resp = requests.get(
            f"{BASE_URL}/api/admissions/applications/{pytest.test_app_id}",
            headers=self.headers
        )
        assert get_resp.json()["status"] == "reviewed"
    
    def test_change_status_to_interviewed(self):
        """Test changing application status to interviewed"""
        if not hasattr(pytest, 'test_app_id'):
            pytest.skip("No test application available")
        
        response = requests.put(
            f"{BASE_URL}/api/admissions/applications/{pytest.test_app_id}/status",
            headers=self.headers,
            json={"status": "interviewed"}
        )
        assert response.status_code == 200, f"Change status failed: {response.text}"
        print(f"Status changed to interviewed")
    
    def test_change_status_to_accepted(self):
        """Test changing application status to accepted"""
        if not hasattr(pytest, 'test_app_id'):
            pytest.skip("No test application available")
        
        response = requests.put(
            f"{BASE_URL}/api/admissions/applications/{pytest.test_app_id}/status",
            headers=self.headers,
            json={"status": "accepted"}
        )
        assert response.status_code == 200, f"Change status failed: {response.text}"
        print(f"Status changed to accepted")
    
    def test_enroll_student(self):
        """Test enrolling an accepted student - creates student user"""
        if not hasattr(pytest, 'test_app_id'):
            pytest.skip("No test application available")
        
        timestamp = int(time.time())
        response = requests.post(
            f"{BASE_URL}/api/admissions/applications/{pytest.test_app_id}/enroll",
            headers=self.headers,
            json={
                "email": f"test_student_{timestamp}@tcis.student",
                "password": "student123"
            }
        )
        assert response.status_code == 200, f"Enroll failed: {response.text}"
        data = response.json()
        
        assert "user_id" in data
        assert "admission_number" in data
        assert "TCIS" in data["admission_number"]
        
        pytest.enrolled_user_id = data["user_id"]
        pytest.enrolled_adm_num = data["admission_number"]
        print(f"Enrolled student: {data['admission_number']} (user_id: {data['user_id']})")
    
    def test_verify_enrolled_status(self):
        """Verify application status changed to enrolled"""
        if not hasattr(pytest, 'test_app_id'):
            pytest.skip("No test application available")
        
        response = requests.get(
            f"{BASE_URL}/api/admissions/applications/{pytest.test_app_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "enrolled", f"Expected enrolled status, got {data['status']}"
        print(f"Verified: Application status is 'enrolled'")
    
    def test_invalid_status_change(self):
        """Test that invalid status is rejected"""
        if not hasattr(pytest, 'test_app_id'):
            pytest.skip("No test application available")
        
        response = requests.put(
            f"{BASE_URL}/api/admissions/applications/{pytest.test_app_id}/status",
            headers=self.headers,
            json={"status": "invalid_status"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid status"
        print("Invalid status correctly rejected")


class TestRoleAccess:
    """Test role-based access to boarding/admissions endpoints"""
    
    def test_unauthorized_access(self):
        """Test that unauthenticated requests are rejected"""
        # No auth header
        resp = requests.get(f"{BASE_URL}/api/boarding/dashboard")
        assert resp.status_code in [401, 403], "Should reject unauthenticated requests"
        
        resp = requests.get(f"{BASE_URL}/api/admissions/dashboard")
        assert resp.status_code in [401, 403], "Should reject unauthenticated requests"
        print("Unauthenticated requests correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
