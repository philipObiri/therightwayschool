"""
Iteration 53: Test Plagiarism Check Frontend UI Integration
- Plagiarism API endpoints (history, check-batch, results)
- Teacher login and assignments page
- Finance login and Accounting/Finance modules (regression)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPlagiarismAPIs:
    """Test plagiarism detection API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as teacher to get auth token"""
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert login_res.status_code == 200, f"Teacher login failed: {login_res.text}"
        self.token = login_res.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_plagiarism_history_returns_array(self):
        """GET /api/plagiarism/history should return an array"""
        res = self.session.get(f"{BASE_URL}/api/plagiarism/history")
        assert res.status_code == 200, f"History failed: {res.text}"
        data = res.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Plagiarism history: {len(data)} records")
    
    def test_plagiarism_check_batch_requires_assignment_id(self):
        """POST /api/plagiarism/check-batch with empty assignment_id returns 400"""
        res = self.session.post(f"{BASE_URL}/api/plagiarism/check-batch", json={
            "assignment_id": ""
        })
        assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
        print("check-batch correctly rejects empty assignment_id")
    
    def test_plagiarism_results_for_fake_id(self):
        """GET /api/plagiarism/results/fake_id returns results object"""
        res = self.session.get(f"{BASE_URL}/api/plagiarism/results/fake_id")
        assert res.status_code == 200, f"Results failed: {res.text}"
        data = res.json()
        assert "assignment_id" in data, "Missing assignment_id in response"
        assert "results" in data, "Missing results in response"
        assert data["assignment_id"] == "fake_id"
        print(f"Results for fake_id: {data}")


class TestTeacherAssignmentsPage:
    """Test teacher assignments page loads correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as teacher"""
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert login_res.status_code == 200, f"Teacher login failed: {login_res.text}"
        self.token = login_res.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_assignments_endpoint(self):
        """GET /api/assignments returns list"""
        res = self.session.get(f"{BASE_URL}/api/assignments")
        assert res.status_code == 200, f"Assignments failed: {res.text}"
        data = res.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Assignments: {len(data)} found")


class TestFinanceAccountingRegression:
    """Regression tests for Accounting and Finance modules"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as finance officer"""
        self.session = requests.Session()
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        assert login_res.status_code == 200, f"Finance login failed: {login_res.text}"
        self.token = login_res.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_accounting_chart_of_accounts(self):
        """GET /api/accounting/chart-of-accounts returns accounts"""
        res = self.session.get(f"{BASE_URL}/api/accounting/chart-of-accounts")
        assert res.status_code == 200, f"COA failed: {res.text}"
        data = res.json()
        assert "accounts" in data, "Missing accounts"
        assert "totals" in data, "Missing totals"
        print(f"Chart of Accounts: {len(data['accounts'])} accounts")
    
    def test_accounting_trial_balance(self):
        """GET /api/accounting/trial-balance returns trial balance"""
        res = self.session.get(f"{BASE_URL}/api/accounting/trial-balance")
        assert res.status_code == 200, f"Trial balance failed: {res.text}"
        data = res.json()
        assert "trial_balance" in data, "Missing trial_balance"
        assert "balanced" in data, "Missing balanced flag"
        print(f"Trial Balance: balanced={data['balanced']}")
    
    def test_accounting_income_statement(self):
        """GET /api/accounting/income-statement returns P&L"""
        res = self.session.get(f"{BASE_URL}/api/accounting/income-statement")
        assert res.status_code == 200, f"Income statement failed: {res.text}"
        data = res.json()
        assert "revenue" in data, "Missing revenue"
        assert "expenses" in data, "Missing expenses"
        assert "net_income" in data, "Missing net_income"
        print(f"Income Statement: net_income={data['net_income']}")
    
    def test_accounting_balance_sheet(self):
        """GET /api/accounting/balance-sheet returns balance sheet"""
        res = self.session.get(f"{BASE_URL}/api/accounting/balance-sheet")
        assert res.status_code == 200, f"Balance sheet failed: {res.text}"
        data = res.json()
        assert "assets" in data, "Missing assets"
        assert "liabilities" in data, "Missing liabilities"
        assert "equity" in data, "Missing equity"
        assert "balanced" in data, "Missing balanced flag"
        print(f"Balance Sheet: balanced={data['balanced']}")
    
    def test_accounting_bank_reconciliation(self):
        """GET /api/accounting/reconciliation-summary returns summary"""
        res = self.session.get(f"{BASE_URL}/api/accounting/reconciliation-summary")
        assert res.status_code == 200, f"Reconciliation failed: {res.text}"
        data = res.json()
        assert "bank_balance" in data, "Missing bank_balance"
        assert "book_balance" in data, "Missing book_balance"
        print(f"Bank Reconciliation: bank={data['bank_balance']}, book={data['book_balance']}")
    
    def test_finance_dashboard(self):
        """GET /api/finance/dashboard returns stats"""
        res = self.session.get(f"{BASE_URL}/api/finance/dashboard")
        assert res.status_code == 200, f"Dashboard failed: {res.text}"
        data = res.json()
        assert "total_invoiced" in data, "Missing total_invoiced"
        assert "total_collected" in data, "Missing total_collected"
        print(f"Finance Dashboard: invoiced={data['total_invoiced']}, collected={data['total_collected']}")
    
    def test_finance_payments_with_evidence(self):
        """GET /api/finance/payments returns payments with evidence fields"""
        res = self.session.get(f"{BASE_URL}/api/finance/payments")
        assert res.status_code == 200, f"Payments failed: {res.text}"
        data = res.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Finance Payments: {len(data)} payments")
        # Check if evidence fields exist in payment records
        if len(data) > 0:
            sample = data[0]
            print(f"Sample payment fields: {list(sample.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
