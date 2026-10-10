"""
Test Finance PDF Report Generation Endpoints
Tests: /api/finance/reports/pdf/overview, income-expense, department, outstanding
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FINANCE_EMAIL = "finance@tcis.demo"
FINANCE_PASSWORD = "finance123"
CEO_EMAIL = "ceo@tcis.demo"
CEO_PASSWORD = "ceo123"


@pytest.fixture(scope="module")
def finance_token():
    """Get Finance Officer auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": FINANCE_EMAIL,
        "password": FINANCE_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Finance login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def ceo_token():
    """Get CEO auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CEO_EMAIL,
        "password": CEO_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"CEO login failed: {response.status_code} - {response.text}")


class TestPdfOverview:
    """Tests for /api/finance/reports/pdf/overview endpoint"""
    
    def test_overview_pdf_returns_200(self, finance_token):
        """GET /api/finance/reports/pdf/overview returns 200 with PDF"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/overview",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
    def test_overview_pdf_content_type(self, finance_token):
        """PDF response has correct content-type"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/overview",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        assert "application/pdf" in response.headers.get("content-type", "")
        
    def test_overview_pdf_has_content_disposition(self, finance_token):
        """PDF response has Content-Disposition header with filename"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/overview",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        disposition = response.headers.get("content-disposition", "")
        assert "attachment" in disposition
        assert "filename" in disposition
        assert "TCIS_Financial_Overview" in disposition
        
    def test_overview_pdf_has_content(self, finance_token):
        """PDF response has actual content (not empty)"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/overview",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        assert len(response.content) > 1000, f"PDF too small: {len(response.content)} bytes"
        # Check PDF magic bytes
        assert response.content[:4] == b'%PDF', "Response is not a valid PDF"


class TestPdfIncomeExpense:
    """Tests for /api/finance/reports/pdf/income-expense endpoint"""
    
    def test_income_expense_pdf_month(self, finance_token):
        """GET /api/finance/reports/pdf/income-expense?period=month returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/income-expense",
            params={"period": "month"},
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        assert "application/pdf" in response.headers.get("content-type", "")
        assert response.content[:4] == b'%PDF'
        
    def test_income_expense_pdf_term(self, finance_token):
        """GET /api/finance/reports/pdf/income-expense?period=term returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/income-expense",
            params={"period": "term"},
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        assert "application/pdf" in response.headers.get("content-type", "")
        
    def test_income_expense_pdf_year(self, finance_token):
        """GET /api/finance/reports/pdf/income-expense?period=year returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/income-expense",
            params={"period": "year"},
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        assert "application/pdf" in response.headers.get("content-type", "")
        
    def test_income_expense_pdf_default_period(self, finance_token):
        """GET /api/finance/reports/pdf/income-expense without period defaults to month"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/income-expense",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        assert "application/pdf" in response.headers.get("content-type", "")
        
    def test_income_expense_pdf_has_content_disposition(self, finance_token):
        """Income/Expense PDF has proper filename in Content-Disposition"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/income-expense",
            params={"period": "month"},
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        disposition = response.headers.get("content-disposition", "")
        assert "TCIS_Income_Expense" in disposition


class TestPdfDepartment:
    """Tests for /api/finance/reports/pdf/department endpoint"""
    
    def test_department_pdf_returns_200(self, finance_token):
        """GET /api/finance/reports/pdf/department returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/department",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        
    def test_department_pdf_content_type(self, finance_token):
        """Department PDF has correct content-type"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/department",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        assert "application/pdf" in response.headers.get("content-type", "")
        
    def test_department_pdf_has_content_disposition(self, finance_token):
        """Department PDF has proper filename"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/department",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        disposition = response.headers.get("content-disposition", "")
        assert "TCIS_Department_Summary" in disposition
        
    def test_department_pdf_is_valid(self, finance_token):
        """Department PDF is a valid PDF file"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/department",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        assert response.content[:4] == b'%PDF'


class TestPdfOutstanding:
    """Tests for /api/finance/reports/pdf/outstanding endpoint"""
    
    def test_outstanding_pdf_returns_200(self, finance_token):
        """GET /api/finance/reports/pdf/outstanding returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/outstanding",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        
    def test_outstanding_pdf_content_type(self, finance_token):
        """Outstanding PDF has correct content-type"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/outstanding",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        assert "application/pdf" in response.headers.get("content-type", "")
        
    def test_outstanding_pdf_has_content_disposition(self, finance_token):
        """Outstanding PDF has proper filename"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/outstanding",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        disposition = response.headers.get("content-disposition", "")
        assert "TCIS_Outstanding_Fees" in disposition
        
    def test_outstanding_pdf_is_valid(self, finance_token):
        """Outstanding PDF is a valid PDF file"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/outstanding",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200
        assert response.content[:4] == b'%PDF'


class TestPdfAuthorization:
    """Tests for PDF endpoint authorization"""
    
    def test_overview_unauthorized_no_token(self):
        """GET /api/finance/reports/pdf/overview without token returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/finance/reports/pdf/overview")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
    def test_income_expense_unauthorized_no_token(self):
        """GET /api/finance/reports/pdf/income-expense without token returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/finance/reports/pdf/income-expense")
        assert response.status_code in [401, 403]
        
    def test_department_unauthorized_no_token(self):
        """GET /api/finance/reports/pdf/department without token returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/finance/reports/pdf/department")
        assert response.status_code in [401, 403]
        
    def test_outstanding_unauthorized_no_token(self):
        """GET /api/finance/reports/pdf/outstanding without token returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/finance/reports/pdf/outstanding")
        assert response.status_code in [401, 403]
        
    def test_ceo_can_access_overview(self, ceo_token):
        """CEO role can access PDF overview endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/overview",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
        
    def test_ceo_can_access_outstanding(self, ceo_token):
        """CEO role can access PDF outstanding endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/finance/reports/pdf/outstanding",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200
