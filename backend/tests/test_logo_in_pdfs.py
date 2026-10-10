"""
Test TCIS Logo in PDF Generation Endpoints
Iteration 49: Verify new TCIS logo is embedded in all PDF documents
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEACHER_EMAIL = "edmund@tcis.demo"
TEACHER_PASSWORD = "teacher123"
ADMIN_EMAIL = "dwain@tcis.demo"
ADMIN_PASSWORD = "admin123"
FINANCE_EMAIL = "finance@tcis.demo"
FINANCE_PASSWORD = "finance123"

# Test data IDs from previous iterations
INVOICE_ID = "inv_86c6a3e17222"
SCHEME_ID_WITH_CONTENT = "sow_eca45f1203d9"
SCHEME_ID_EMPTY = "sow_0e38a1c8db5a"


@pytest.fixture(scope="module")
def teacher_token():
    """Get teacher auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Teacher login failed: {response.status_code}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin login failed: {response.status_code}")


@pytest.fixture(scope="module")
def finance_token():
    """Get finance auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": FINANCE_EMAIL,
        "password": FINANCE_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Finance login failed: {response.status_code}")


@pytest.fixture(scope="module")
def lecture_id(teacher_token):
    """Get a lecture ID for testing"""
    response = requests.get(
        f"{BASE_URL}/api/lectures/my-lectures",
        headers={"Authorization": f"Bearer {teacher_token}"}
    )
    if response.status_code == 200:
        lectures = response.json()
        if lectures:
            return lectures[0].get("lecture_id")
    pytest.skip("No lectures found for testing")


@pytest.fixture(scope="module")
def lesson_id(teacher_token):
    """Get a lesson ID for testing"""
    response = requests.get(
        f"{BASE_URL}/api/lessons-v2/my-lessons",
        headers={"Authorization": f"Bearer {teacher_token}"}
    )
    if response.status_code == 200:
        lessons = response.json()
        if lessons:
            return lessons[0].get("lesson_id")
    pytest.skip("No lessons found for testing")


@pytest.fixture(scope="module")
def student_id(admin_token):
    """Get a student ID for report card testing"""
    response = requests.get(
        f"{BASE_URL}/api/admin/students",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if response.status_code == 200:
        students = response.json()
        if students:
            return students[0].get("user_id")
    pytest.skip("No students found for testing")


class TestLecturePDFsWithLogo:
    """Test Lecture PDF endpoints - logo should be embedded"""
    
    def test_lecture_pdf_teacher_variant(self, teacher_token, lecture_id):
        """Lecture PDF (teacher variant) should return valid PDF > 120KB"""
        response = requests.get(
            f"{BASE_URL}/api/lectures/{lecture_id}/export-pdf?token={teacher_token}&variant=teacher"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Lecture PDF (teacher) size: {pdf_size / 1024:.1f} KB")
        assert pdf_size > 120000, f"PDF too small ({pdf_size} bytes), logo may not be embedded"
    
    def test_lecture_pdf_student_variant(self, teacher_token, lecture_id):
        """Lecture PDF (student variant) should return valid PDF > 120KB"""
        response = requests.get(
            f"{BASE_URL}/api/lectures/{lecture_id}/export-pdf?token={teacher_token}&variant=student"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Lecture PDF (student) size: {pdf_size / 1024:.1f} KB")
        assert pdf_size > 120000, f"PDF too small ({pdf_size} bytes), logo may not be embedded"
    
    def test_lecture_pdf_revision_variant(self, teacher_token, lecture_id):
        """Lecture PDF (revision variant) should return valid PDF > 120KB"""
        response = requests.get(
            f"{BASE_URL}/api/lectures/{lecture_id}/export-pdf?token={teacher_token}&variant=revision"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Lecture PDF (revision) size: {pdf_size / 1024:.1f} KB")
        assert pdf_size > 120000, f"PDF too small ({pdf_size} bytes), logo may not be embedded"


class TestLessonPDFWithLogo:
    """Test Lesson PDF endpoint - logo width changed from 70px to 180px"""
    
    def test_lesson_pdf_with_logo(self, teacher_token, lesson_id):
        """Lesson PDF should return valid PDF > 120KB"""
        response = requests.get(
            f"{BASE_URL}/api/lessons-v2/{lesson_id}/export-pdf?token={teacher_token}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Lesson PDF size: {pdf_size / 1024:.1f} KB")
        assert pdf_size > 120000, f"PDF too small ({pdf_size} bytes), logo may not be embedded"


class TestSchemePDFWithLogo:
    """Test Scheme of Work PDF endpoint - logo width changed from 80px to 180px"""
    
    def test_scheme_pdf_with_content(self, teacher_token):
        """Scheme PDF (with content) should return valid PDF > 120KB"""
        response = requests.get(
            f"{BASE_URL}/api/schemes/{SCHEME_ID_WITH_CONTENT}/export-pdf?token={teacher_token}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Scheme PDF (with content) size: {pdf_size / 1024:.1f} KB")
        assert pdf_size > 120000, f"PDF too small ({pdf_size} bytes), logo may not be embedded"
    
    def test_scheme_pdf_empty_content(self, teacher_token):
        """Scheme PDF (empty content) should still return valid PDF"""
        response = requests.get(
            f"{BASE_URL}/api/schemes/{SCHEME_ID_EMPTY}/export-pdf?token={teacher_token}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Scheme PDF (empty content) size: {pdf_size / 1024:.1f} KB")
        # Empty scheme may be smaller but should still have logo
        assert pdf_size > 50000, f"PDF too small ({pdf_size} bytes)"


class TestFinancePDFsWithLogo:
    """Test Finance PDF endpoints - logo w=50 in bill and reconciliation"""
    
    def test_finance_bill_pdf(self, finance_token):
        """Finance Bill PDF should return valid PDF > 120KB"""
        response = requests.get(
            f"{BASE_URL}/api/finance/bill/{INVOICE_ID}/pdf?token={finance_token}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Finance Bill PDF size: {pdf_size / 1024:.1f} KB")
        assert pdf_size > 120000, f"PDF too small ({pdf_size} bytes), logo may not be embedded"
    
    def test_whole_school_finance_pdf(self, finance_token):
        """Whole School Finance PDF should return valid PDF > 120KB"""
        response = requests.get(
            f"{BASE_URL}/api/finance/report/whole-school-pdf?token={finance_token}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Whole School Finance PDF size: {pdf_size / 1024:.1f} KB")
        assert pdf_size > 120000, f"PDF too small ({pdf_size} bytes), logo may not be embedded"
    
    def test_reconciliation_pdf(self, finance_token):
        """Reconciliation PDF should return valid PDF > 120KB"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reconciliation/pdf?token={finance_token}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Reconciliation PDF size: {pdf_size / 1024:.1f} KB")
        assert pdf_size > 120000, f"PDF too small ({pdf_size} bytes), logo may not be embedded"


class TestFinanceReportsPDFsWithLogo:
    """Test Finance Reports PDF endpoints - TcisPDF header logo w=50"""
    
    def test_finance_report_overview_pdf(self, finance_token):
        """Finance Report Overview PDF should return valid PDF"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/overview",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Finance Report Overview PDF size: {pdf_size / 1024:.1f} KB")
        assert pdf_size > 50000, f"PDF too small ({pdf_size} bytes)"
    
    def test_finance_report_income_expense_pdf(self, finance_token):
        """Finance Report Income/Expense PDF should return valid PDF"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/income-expense",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Finance Report Income/Expense PDF size: {pdf_size / 1024:.1f} KB")
        assert pdf_size > 50000, f"PDF too small ({pdf_size} bytes)"
    
    def test_finance_report_department_pdf(self, finance_token):
        """Finance Report Department PDF should return valid PDF"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/department",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Finance Report Department PDF size: {pdf_size / 1024:.1f} KB")
        assert pdf_size > 50000, f"PDF too small ({pdf_size} bytes)"
    
    def test_finance_report_outstanding_pdf(self, finance_token):
        """Finance Report Outstanding PDF should return valid PDF"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/outstanding",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Finance Report Outstanding PDF size: {pdf_size / 1024:.1f} KB")
        assert pdf_size > 50000, f"PDF too small ({pdf_size} bytes)"


class TestGradebookReportCardPDFWithLogo:
    """Test Gradebook Report Card PDF - logo w=50"""
    
    def test_report_card_pdf(self, admin_token, student_id):
        """Report Card PDF should return valid PDF > 120KB"""
        response = requests.get(
            f"{BASE_URL}/api/gradebook/report-card/{student_id}/pdf?token={admin_token}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert response.headers.get("content-type") == "application/pdf"
        pdf_size = len(response.content)
        print(f"Report Card PDF size: {pdf_size / 1024:.1f} KB")
        assert pdf_size > 120000, f"PDF too small ({pdf_size} bytes), logo may not be embedded"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
