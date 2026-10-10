"""
TCIS PDF Endpoints Test Suite
Tests all PDF generation endpoints with both ?token= query param and Bearer header authentication.
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


@pytest.fixture(scope="module")
def teacher_token():
    """Get teacher auth token."""
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEACHER_EMAIL, "password": TEACHER_PASSWORD})
    if r.status_code == 200:
        return r.json().get("token")
    pytest.skip(f"Teacher login failed: {r.status_code} - {r.text}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token."""
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code == 200:
        return r.json().get("token")
    pytest.skip(f"Admin login failed: {r.status_code} - {r.text}")


@pytest.fixture(scope="module")
def finance_token():
    """Get finance auth token."""
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": FINANCE_EMAIL, "password": FINANCE_PASSWORD})
    if r.status_code == 200:
        return r.json().get("token")
    pytest.skip(f"Finance login failed: {r.status_code} - {r.text}")


@pytest.fixture(scope="module")
def test_lecture_id(teacher_token):
    """Get or create a test lecture for PDF export."""
    headers = {"Authorization": f"Bearer {teacher_token}"}
    # Try to get existing lectures
    r = requests.get(f"{BASE_URL}/api/lectures/my-lectures", headers=headers)
    if r.status_code == 200 and r.json():
        return r.json()[0]["lecture_id"]
    # Create a test lecture
    r = requests.post(f"{BASE_URL}/api/lectures/", headers=headers, json={
        "title": "TEST_PDF_Lecture",
        "subject": "Mathematics",
        "year_group": "Year 10",
        "topic": "Algebra",
        "rich_content": "<h2>Test Content</h2><p>This is test content for PDF generation.</p>"
    })
    if r.status_code in (200, 201):
        return r.json()["lecture_id"]
    pytest.skip("Could not get or create test lecture")


@pytest.fixture(scope="module")
def test_lesson_id(teacher_token):
    """Get or create a test lesson for PDF export."""
    headers = {"Authorization": f"Bearer {teacher_token}"}
    r = requests.get(f"{BASE_URL}/api/lessons-v2/", headers=headers)
    if r.status_code == 200 and r.json():
        return r.json()[0]["lesson_id"]
    # Create a test lesson
    r = requests.post(f"{BASE_URL}/api/lessons-v2/", headers=headers, json={
        "title": "TEST_PDF_Lesson",
        "subject_name": "Mathematics",
        "year_group": "Year 10",
        "rich_content": "<h2>Test Lesson</h2><p>Test content.</p>"
    })
    if r.status_code in (200, 201):
        return r.json()["lesson_id"]
    pytest.skip("Could not get or create test lesson")


@pytest.fixture(scope="module")
def test_scheme_id(teacher_token):
    """Get or create a test scheme for PDF export."""
    headers = {"Authorization": f"Bearer {teacher_token}"}
    r = requests.get(f"{BASE_URL}/api/schemes/", headers=headers)
    if r.status_code == 200 and r.json():
        return r.json()[0]["scheme_id"]
    # Create a test scheme
    r = requests.post(f"{BASE_URL}/api/schemes/", headers=headers, json={
        "title": "TEST_PDF_Scheme",
        "subject_name": "Mathematics",
        "year_group": "Year 10",
        "rich_content": "<h2>Test Scheme</h2><p>Test content.</p>"
    })
    if r.status_code in (200, 201):
        return r.json()["scheme_id"]
    pytest.skip("Could not get or create test scheme")


@pytest.fixture(scope="module")
def test_invoice_id(finance_token):
    """Get a test invoice for PDF export."""
    headers = {"Authorization": f"Bearer {finance_token}"}
    r = requests.get(f"{BASE_URL}/api/finance/invoices", headers=headers)
    if r.status_code == 200 and r.json():
        return r.json()[0]["invoice_id"]
    pytest.skip("No invoices found for PDF testing")


@pytest.fixture(scope="module")
def test_student_id(admin_token):
    """Get a test student for report card PDF."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    r = requests.get(f"{BASE_URL}/api/admin/students", headers=headers)
    if r.status_code == 200 and r.json():
        return r.json()[0]["user_id"]
    pytest.skip("No students found for PDF testing")


# ═══════════════════════════════════════════
# LECTURE PDF TESTS
# ═══════════════════════════════════════════

class TestLecturePDF:
    """Test lecture PDF export endpoints."""

    def test_lecture_pdf_with_token_query_param_teacher_variant(self, teacher_token, test_lecture_id):
        """GET /api/lectures/{id}/export-pdf?token=X&variant=teacher returns valid PDF."""
        url = f"{BASE_URL}/api/lectures/{test_lecture_id}/export-pdf?token={teacher_token}&variant=teacher"
        r = requests.get(url)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        assert len(r.content) > 100, "PDF content too small"
        print(f"✓ Lecture PDF (teacher variant) with ?token= returned {len(r.content)} bytes")

    def test_lecture_pdf_with_token_query_param_student_variant(self, teacher_token, test_lecture_id):
        """GET /api/lectures/{id}/export-pdf?token=X&variant=student returns valid PDF."""
        url = f"{BASE_URL}/api/lectures/{test_lecture_id}/export-pdf?token={teacher_token}&variant=student"
        r = requests.get(url)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Lecture PDF (student variant) with ?token= returned {len(r.content)} bytes")

    def test_lecture_pdf_with_token_query_param_revision_variant(self, teacher_token, test_lecture_id):
        """GET /api/lectures/{id}/export-pdf?token=X&variant=revision returns valid PDF."""
        url = f"{BASE_URL}/api/lectures/{test_lecture_id}/export-pdf?token={teacher_token}&variant=revision"
        r = requests.get(url)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Lecture PDF (revision variant) with ?token= returned {len(r.content)} bytes")

    def test_lecture_pdf_with_bearer_header(self, teacher_token, test_lecture_id):
        """GET /api/lectures/{id}/export-pdf with Bearer header returns valid PDF."""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        url = f"{BASE_URL}/api/lectures/{test_lecture_id}/export-pdf?variant=teacher"
        r = requests.get(url, headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Lecture PDF with Bearer header returned {len(r.content)} bytes")

    def test_lecture_pdf_without_auth_returns_401(self, test_lecture_id):
        """GET /api/lectures/{id}/export-pdf without auth returns 401."""
        url = f"{BASE_URL}/api/lectures/{test_lecture_id}/export-pdf"
        r = requests.get(url)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        print("✓ Lecture PDF without auth correctly returns 401")


# ═══════════════════════════════════════════
# LESSON PDF TESTS
# ═══════════════════════════════════════════

class TestLessonPDF:
    """Test lesson PDF export endpoints."""

    def test_lesson_pdf_with_token_query_param(self, teacher_token, test_lesson_id):
        """GET /api/lessons-v2/{id}/export-pdf?token=X returns valid PDF."""
        url = f"{BASE_URL}/api/lessons-v2/{test_lesson_id}/export-pdf?token={teacher_token}"
        r = requests.get(url)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Lesson PDF with ?token= returned {len(r.content)} bytes")

    def test_lesson_pdf_with_bearer_header(self, teacher_token, test_lesson_id):
        """GET /api/lessons-v2/{id}/export-pdf with Bearer header returns valid PDF."""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        url = f"{BASE_URL}/api/lessons-v2/{test_lesson_id}/export-pdf"
        r = requests.get(url, headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Lesson PDF with Bearer header returned {len(r.content)} bytes")


# ═══════════════════════════════════════════
# SCHEME PDF TESTS
# ═══════════════════════════════════════════

class TestSchemePDF:
    """Test scheme of work PDF export endpoints."""

    def test_scheme_pdf_with_token_query_param(self, teacher_token, test_scheme_id):
        """GET /api/schemes/{id}/export-pdf?token=X returns valid PDF."""
        url = f"{BASE_URL}/api/schemes/{test_scheme_id}/export-pdf?token={teacher_token}"
        r = requests.get(url)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Scheme PDF with ?token= returned {len(r.content)} bytes")

    def test_scheme_pdf_with_bearer_header(self, teacher_token, test_scheme_id):
        """GET /api/schemes/{id}/export-pdf with Bearer header returns valid PDF."""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        url = f"{BASE_URL}/api/schemes/{test_scheme_id}/export-pdf"
        r = requests.get(url, headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Scheme PDF with Bearer header returned {len(r.content)} bytes")

    def test_scheme_pdf_empty_content_shows_placeholder(self, teacher_token):
        """GET /api/schemes/{id}/export-pdf for empty scheme shows placeholder."""
        # Try to find the empty scheme mentioned in the test request
        headers = {"Authorization": f"Bearer {teacher_token}"}
        r = requests.get(f"{BASE_URL}/api/schemes/", headers=headers)
        if r.status_code == 200:
            schemes = r.json()
            empty_scheme = next((s for s in schemes if not s.get("rich_content")), None)
            if empty_scheme:
                url = f"{BASE_URL}/api/schemes/{empty_scheme['scheme_id']}/export-pdf?token={teacher_token}"
                r = requests.get(url)
                assert r.status_code == 200, f"Expected 200 for empty scheme, got {r.status_code}"
                assert r.headers.get("content-type") == "application/pdf"
                print(f"✓ Empty scheme PDF returned {len(r.content)} bytes with placeholder")
            else:
                print("⚠ No empty scheme found to test placeholder")
        else:
            print("⚠ Could not fetch schemes to test empty content")


# ═══════════════════════════════════════════
# FINANCE PDF TESTS
# ═══════════════════════════════════════════

class TestFinancePDF:
    """Test finance PDF export endpoints."""

    def test_bill_pdf_with_token_query_param(self, finance_token, test_invoice_id):
        """GET /api/finance/bill/{id}/pdf?token=X returns valid PDF."""
        url = f"{BASE_URL}/api/finance/bill/{test_invoice_id}/pdf?token={finance_token}"
        r = requests.get(url)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Finance Bill PDF with ?token= returned {len(r.content)} bytes")

    def test_bill_pdf_with_bearer_header(self, finance_token, test_invoice_id):
        """GET /api/finance/bill/{id}/pdf with Bearer header returns valid PDF."""
        headers = {"Authorization": f"Bearer {finance_token}"}
        url = f"{BASE_URL}/api/finance/bill/{test_invoice_id}/pdf"
        r = requests.get(url, headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Finance Bill PDF with Bearer header returned {len(r.content)} bytes")

    def test_whole_school_pdf_with_token_query_param(self, finance_token):
        """GET /api/finance/report/whole-school-pdf?token=X returns valid PDF."""
        url = f"{BASE_URL}/api/finance/report/whole-school-pdf?token={finance_token}"
        r = requests.get(url)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Whole School Finance PDF with ?token= returned {len(r.content)} bytes")

    def test_whole_school_pdf_with_bearer_header(self, finance_token):
        """GET /api/finance/report/whole-school-pdf with Bearer header returns valid PDF."""
        headers = {"Authorization": f"Bearer {finance_token}"}
        url = f"{BASE_URL}/api/finance/report/whole-school-pdf"
        r = requests.get(url, headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Whole School Finance PDF with Bearer header returned {len(r.content)} bytes")

    def test_reconciliation_pdf_with_token_query_param(self, finance_token):
        """GET /api/finance/reconciliation/pdf?token=X returns valid PDF."""
        url = f"{BASE_URL}/api/finance/reconciliation/pdf?token={finance_token}&year_group=Year%207"
        r = requests.get(url)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Reconciliation PDF with ?token= returned {len(r.content)} bytes")

    def test_reconciliation_pdf_with_bearer_header(self, finance_token):
        """GET /api/finance/reconciliation/pdf with Bearer header returns valid PDF."""
        headers = {"Authorization": f"Bearer {finance_token}"}
        url = f"{BASE_URL}/api/finance/reconciliation/pdf?year_group=Year%207"
        r = requests.get(url, headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Reconciliation PDF with Bearer header returned {len(r.content)} bytes")


# ═══════════════════════════════════════════
# FINANCE REPORTS PDF TESTS
# ═══════════════════════════════════════════

class TestFinanceReportsPDF:
    """Test finance reports PDF endpoints."""

    def test_overview_pdf_with_bearer_header(self, finance_token):
        """GET /api/finance/reports/pdf/overview returns valid PDF."""
        headers = {"Authorization": f"Bearer {finance_token}"}
        url = f"{BASE_URL}/api/finance/reports/pdf/overview"
        r = requests.get(url, headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Finance Overview PDF returned {len(r.content)} bytes")

    def test_income_expense_pdf_with_bearer_header(self, finance_token):
        """GET /api/finance/reports/pdf/income-expense returns valid PDF."""
        headers = {"Authorization": f"Bearer {finance_token}"}
        url = f"{BASE_URL}/api/finance/reports/pdf/income-expense"
        r = requests.get(url, headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Finance Income-Expense PDF returned {len(r.content)} bytes")

    def test_department_pdf_with_bearer_header(self, finance_token):
        """GET /api/finance/reports/pdf/department returns valid PDF."""
        headers = {"Authorization": f"Bearer {finance_token}"}
        url = f"{BASE_URL}/api/finance/reports/pdf/department"
        r = requests.get(url, headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Finance Department PDF returned {len(r.content)} bytes")

    def test_outstanding_pdf_with_bearer_header(self, finance_token):
        """GET /api/finance/reports/pdf/outstanding returns valid PDF."""
        headers = {"Authorization": f"Bearer {finance_token}"}
        url = f"{BASE_URL}/api/finance/reports/pdf/outstanding"
        r = requests.get(url, headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Finance Outstanding PDF returned {len(r.content)} bytes")


# ═══════════════════════════════════════════
# GRADEBOOK REPORT CARD PDF TESTS
# ═══════════════════════════════════════════

class TestGradebookPDF:
    """Test gradebook report card PDF endpoints."""

    def test_report_card_pdf_with_token_query_param(self, admin_token, test_student_id):
        """GET /api/gradebook/report-card/{student_id}/pdf?token=X returns valid PDF."""
        url = f"{BASE_URL}/api/gradebook/report-card/{test_student_id}/pdf?token={admin_token}&term=Term%201"
        r = requests.get(url)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Report Card PDF with ?token= returned {len(r.content)} bytes")

    def test_report_card_pdf_with_bearer_header(self, admin_token, test_student_id):
        """GET /api/gradebook/report-card/{student_id}/pdf with Bearer header returns valid PDF."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        url = f"{BASE_URL}/api/gradebook/report-card/{test_student_id}/pdf?term=Term%201"
        r = requests.get(url, headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert r.headers.get("content-type") == "application/pdf"
        print(f"✓ Report Card PDF with Bearer header returned {len(r.content)} bytes")


# ═══════════════════════════════════════════
# FRONTEND URL VERIFICATION
# ═══════════════════════════════════════════

class TestFrontendPDFURLs:
    """Verify frontend uses correct ?token= format for PDF URLs."""

    def test_gradebook_page_uses_token_not_auth(self):
        """Verify GradebookPage.jsx uses ?token= (not ?auth=) for PDF URLs."""
        with open("/app/frontend/src/pages/admin/GradebookPage.jsx", "r") as f:
            content = f.read()
        
        # Check that it uses token= not auth=
        assert "?token=" in content or "&token=" in content, "GradebookPage should use ?token= for PDF URLs"
        assert "?auth=" not in content, "GradebookPage should NOT use ?auth= for PDF URLs"
        print("✓ GradebookPage.jsx uses ?token= for PDF URLs")

    def test_lecture_module_uses_token_for_pdf(self):
        """Verify LectureModule.jsx uses ?token= for PDF URLs."""
        with open("/app/frontend/src/pages/shared/LectureModule.jsx", "r") as f:
            content = f.read()
        
        # Check that it uses token= for PDF URLs
        assert "token=" in content, "LectureModule should use token= for PDF URLs"
        print("✓ LectureModule.jsx uses token= for PDF URLs")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
