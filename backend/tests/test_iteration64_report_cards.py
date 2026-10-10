"""
Iteration 64: Report Cards Feature Tests
Tests for categorized report cards (End of Term, Mid Term, Mocks, Progressives)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestReportCardsFeature:
    """Tests for the categorized report cards feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as CEO
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@tcis.demo",
            "password": "ceo123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Test data - students with known grades
        self.student_with_progressives = "user_cc6f5faa1522"  # Ayeyi Forson - has progressive_test_1 in Term 2
        self.student_with_end_of_term = "user_fee95a806d25"  # Dannii McCaesar - has end_of_term in Term 2
        self.year7_class_id = "cls_89e85348b7fd"
        self.test_term = "Term 2"
    
    # ─── Report Types Endpoint Tests ───
    def test_report_types_endpoint_returns_all_types(self):
        """GET /api/gradebook/report-types/{student_id} returns all 4 report types"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-types/{self.student_with_progressives}",
            params={"term": self.test_term}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "student_id" in data
        assert "term" in data
        assert "report_types" in data
        assert len(data["report_types"]) == 4
        
        type_keys = [rt["type"] for rt in data["report_types"]]
        assert "end_of_term" in type_keys
        assert "mid_term" in type_keys
        assert "mocks" in type_keys
        assert "progressives" in type_keys
    
    def test_report_types_shows_progressives_has_data(self):
        """Report types correctly shows progressives has data for student with progressive_test_1"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-types/{self.student_with_progressives}",
            params={"term": self.test_term}
        )
        assert response.status_code == 200
        data = response.json()
        
        progressives = next((rt for rt in data["report_types"] if rt["type"] == "progressives"), None)
        assert progressives is not None
        assert progressives["has_data"] == True
        assert progressives["entry_count"] >= 1
        assert progressives["subject_count"] >= 1
    
    def test_report_types_shows_end_of_term_has_data(self):
        """Report types correctly shows end_of_term has data for student with end_of_term grade"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-types/{self.student_with_end_of_term}",
            params={"term": self.test_term}
        )
        assert response.status_code == 200
        data = response.json()
        
        end_of_term = next((rt for rt in data["report_types"] if rt["type"] == "end_of_term"), None)
        assert end_of_term is not None
        assert end_of_term["has_data"] == True
        assert end_of_term["entry_count"] >= 1
    
    def test_report_types_shows_no_data_for_empty_types(self):
        """Report types correctly shows has_data=false for types without grades"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-types/{self.student_with_progressives}",
            params={"term": self.test_term}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Student with progressives should NOT have mocks data
        mocks = next((rt for rt in data["report_types"] if rt["type"] == "mocks"), None)
        assert mocks is not None
        assert mocks["has_data"] == False
        assert mocks["entry_count"] == 0
    
    # ─── Report Card Data Endpoint Tests ───
    def test_report_card_progressives_format(self):
        """GET /api/gradebook/report-card/{student_id}?report_type=progressives returns P1/P2/P3 format"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-card/{self.student_with_progressives}",
            params={"term": self.test_term, "report_type": "progressives"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["report_type"] == "progressives"
        assert "Progressives" in data["report_label"]
        assert len(data["grades"]) >= 1
        
        # Check progressive format has P1/P2/P3 columns
        grade = data["grades"][0]
        assert "progressive_1" in grade
        assert "progressive_2" in grade
        assert "progressive_3" in grade
        assert "average" in grade
        assert "grade" in grade
        assert "remark" in grade
    
    def test_report_card_end_of_term_format(self):
        """GET /api/gradebook/report-card/{student_id}?report_type=end_of_term returns CA/Exam/Final format"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-card/{self.student_with_end_of_term}",
            params={"term": self.test_term, "report_type": "end_of_term"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["report_type"] == "end_of_term"
        assert "End of Term" in data["report_label"]
        assert len(data["grades"]) >= 1
        
        # Check end_of_term format has CA/Exam/Final columns
        grade = data["grades"][0]
        assert "ca_score" in grade
        assert "ca_max" in grade
        assert "exam_score" in grade
        assert "exam_max" in grade
        assert "final_score" in grade
        assert "grade" in grade
    
    def test_report_card_full_report_no_type(self):
        """GET /api/gradebook/report-card/{student_id} without report_type returns full report"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-card/{self.student_with_progressives}",
            params={"term": self.test_term}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["report_type"] == "full"
        assert "Full Academic Report" in data["report_label"]
    
    def test_report_card_includes_student_info(self):
        """Report card includes student and class information"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-card/{self.student_with_progressives}",
            params={"term": self.test_term, "report_type": "progressives"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "student" in data
        assert data["student"]["user_id"] == self.student_with_progressives
        assert "name" in data["student"]
        assert "admission_number" in data["student"]
        
        assert "class" in data
        assert "name" in data["class"]
    
    def test_report_card_includes_summary(self):
        """Report card includes average, overall grade, and attendance"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-card/{self.student_with_progressives}",
            params={"term": self.test_term, "report_type": "progressives"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "average" in data
        assert "overall_grade" in data
        assert "overall_remark" in data
        assert "attendance" in data
        assert "present" in data["attendance"]
        assert "absent" in data["attendance"]
    
    # ─── PDF Download Tests ───
    def test_pdf_download_progressives(self):
        """GET /api/gradebook/report-card/{student_id}/pdf?report_type=progressives returns PDF"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-card/{self.student_with_progressives}/pdf",
            params={"term": self.test_term, "report_type": "progressives"}
        )
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
        assert len(response.content) > 1000  # PDF should have substantial content
        
        # Check filename in content-disposition
        content_disp = response.headers.get("content-disposition", "")
        assert "progressives" in content_disp.lower()
    
    def test_pdf_download_end_of_term(self):
        """GET /api/gradebook/report-card/{student_id}/pdf?report_type=end_of_term returns PDF"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-card/{self.student_with_end_of_term}/pdf",
            params={"term": self.test_term, "report_type": "end_of_term"}
        )
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
        assert len(response.content) > 1000
        
        content_disp = response.headers.get("content-disposition", "")
        assert "end_of_term" in content_disp.lower()
    
    def test_pdf_download_full_report(self):
        """GET /api/gradebook/report-card/{student_id}/pdf without report_type returns full PDF"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-card/{self.student_with_progressives}/pdf",
            params={"term": self.test_term}
        )
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
    
    # ─── Class and Student List Tests ───
    def test_get_classes_list(self):
        """GET /api/academic/classes returns list of classes"""
        response = self.session.get(f"{BASE_URL}/api/academic/classes")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Check Year 7 class exists
        year7 = next((c for c in data if c["class_id"] == self.year7_class_id), None)
        assert year7 is not None
        assert year7["name"] == "Year 7"
    
    def test_get_students_by_class(self):
        """GET /api/admin/students?class_id={class_id} returns students in class"""
        response = self.session.get(
            f"{BASE_URL}/api/admin/students",
            params={"class_id": self.year7_class_id}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Check student with progressives is in Year 7
        student = next((s for s in data if s["user_id"] == self.student_with_progressives), None)
        assert student is not None
        assert "name" in student
        assert "admission_number" in student
    
    def test_gradebook_entries_for_student(self):
        """GET /api/gradebook/entries returns grades for student"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/entries",
            params={"student_id": self.student_with_progressives, "term": self.test_term}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Check entry has expected fields
        entry = data[0]
        assert "student_id" in entry
        assert "subject_id" in entry
        assert "score_type" in entry
    
    # ─── Edge Cases ───
    def test_report_types_for_nonexistent_student(self):
        """Report types for non-existent student returns empty types"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-types/nonexistent_user_123",
            params={"term": self.test_term}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should still return structure but all has_data=false
        for rt in data["report_types"]:
            assert rt["has_data"] == False
    
    def test_report_card_for_nonexistent_student(self):
        """Report card for non-existent student returns 404"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-card/nonexistent_user_123",
            params={"term": self.test_term}
        )
        assert response.status_code == 404
    
    def test_report_card_empty_folder(self):
        """Report card for type with no data returns empty grades"""
        response = self.session.get(
            f"{BASE_URL}/api/gradebook/report-card/{self.student_with_progressives}",
            params={"term": self.test_term, "report_type": "mocks"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["report_type"] == "mocks"
        assert data["grades"] == []  # No mocks data for this student
