"""
Iteration 52: Testing Accounting Module, Finance Module, and Plagiarism API
- Accounting: Chart of Accounts, Journal Entries, Trial Balance, Income Statement, Balance Sheet
- Finance: Dashboard, Payments, Payment Evidence
- Plagiarism: History endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    def test_finance_officer_login(self):
        """Test login with finance officer credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("user", {}).get("role") == "FinanceOfficer", f"Wrong role: {data.get('user', {}).get('role')}"
        print(f"✓ Finance officer login successful, role: {data.get('user', {}).get('role')}")
        return data["token"]


class TestAccountingModule:
    """Accounting module API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        if response.status_code == 200:
            self.token = response.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_seed_coa_endpoint(self):
        """Test POST /api/accounting/seed-coa - should return success or 'already seeded'"""
        response = requests.post(f"{BASE_URL}/api/accounting/seed-coa", headers=self.headers)
        assert response.status_code == 200, f"Seed COA failed: {response.text}"
        data = response.json()
        assert "message" in data, "No message in response"
        # Should either say "Seeded X accounts" or "already has X entries"
        assert "seeded" in data["message"].lower() or "already" in data["message"].lower(), f"Unexpected message: {data['message']}"
        print(f"✓ Seed COA: {data['message']}")
    
    def test_get_chart_of_accounts(self):
        """Test GET /api/accounting/chart-of-accounts - should return accounts list"""
        response = requests.get(f"{BASE_URL}/api/accounting/chart-of-accounts", headers=self.headers)
        assert response.status_code == 200, f"Get COA failed: {response.text}"
        data = response.json()
        assert "accounts" in data, "No accounts in response"
        assert "totals" in data, "No totals in response"
        accounts = data["accounts"]
        assert isinstance(accounts, list), "Accounts should be a list"
        # Should have seeded accounts (31 expected)
        assert len(accounts) >= 20, f"Expected at least 20 accounts, got {len(accounts)}"
        # Verify account structure
        if accounts:
            acct = accounts[0]
            assert "code" in acct, "Account missing code"
            assert "name" in acct, "Account missing name"
            assert "type" in acct, "Account missing type"
        print(f"✓ Chart of Accounts: {len(accounts)} accounts found")
        return accounts
    
    def test_create_journal_entry_balanced(self):
        """Test POST /api/accounting/journal-entries with balanced debit/credit"""
        # First get accounts to use valid codes
        coa_response = requests.get(f"{BASE_URL}/api/accounting/chart-of-accounts", headers=self.headers)
        accounts = coa_response.json().get("accounts", [])
        
        # Find Cash (1000) and Tuition Fee Income (4000)
        cash_code = "1000"
        revenue_code = "4000"
        
        journal_data = {
            "description": "TEST_Tuition fee received from student",
            "reference": "TEST-JE-001",
            "entry_date": "2026-01-10",
            "lines": [
                {"account_code": cash_code, "debit": 500, "credit": 0, "memo": "Cash received"},
                {"account_code": revenue_code, "debit": 0, "credit": 500, "memo": "Tuition income"}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/accounting/journal-entries", 
                                json=journal_data, headers=self.headers)
        assert response.status_code == 200, f"Create journal entry failed: {response.text}"
        data = response.json()
        assert "entry_id" in data, "No entry_id in response"
        assert data.get("total_debit") == 500, f"Wrong total_debit: {data.get('total_debit')}"
        assert data.get("total_credit") == 500, f"Wrong total_credit: {data.get('total_credit')}"
        assert data.get("status") == "posted", f"Wrong status: {data.get('status')}"
        print(f"✓ Journal entry created: {data['entry_id']}, debit={data['total_debit']}, credit={data['total_credit']}")
        return data
    
    def test_create_journal_entry_unbalanced_fails(self):
        """Test POST /api/accounting/journal-entries with unbalanced entry should fail"""
        journal_data = {
            "description": "TEST_Unbalanced entry",
            "lines": [
                {"account_code": "1000", "debit": 500, "credit": 0},
                {"account_code": "4000", "debit": 0, "credit": 300}  # Unbalanced!
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/accounting/journal-entries", 
                                json=journal_data, headers=self.headers)
        assert response.status_code == 400, f"Expected 400 for unbalanced entry, got {response.status_code}"
        print("✓ Unbalanced journal entry correctly rejected")
    
    def test_get_journal_entries(self):
        """Test GET /api/accounting/journal-entries"""
        response = requests.get(f"{BASE_URL}/api/accounting/journal-entries", headers=self.headers)
        assert response.status_code == 200, f"Get journal entries failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Journal entries: {len(data)} entries found")
    
    def test_get_trial_balance(self):
        """Test GET /api/accounting/trial-balance"""
        response = requests.get(f"{BASE_URL}/api/accounting/trial-balance", headers=self.headers)
        assert response.status_code == 200, f"Get trial balance failed: {response.text}"
        data = response.json()
        assert "trial_balance" in data, "No trial_balance in response"
        assert "total_debit" in data, "No total_debit in response"
        assert "total_credit" in data, "No total_credit in response"
        assert "balanced" in data, "No balanced flag in response"
        print(f"✓ Trial Balance: debit={data['total_debit']}, credit={data['total_credit']}, balanced={data['balanced']}")
    
    def test_get_income_statement(self):
        """Test GET /api/accounting/income-statement"""
        response = requests.get(f"{BASE_URL}/api/accounting/income-statement", headers=self.headers)
        assert response.status_code == 200, f"Get income statement failed: {response.text}"
        data = response.json()
        assert "revenue" in data, "No revenue in response"
        assert "expenses" in data, "No expenses in response"
        assert "total_revenue" in data, "No total_revenue in response"
        assert "total_expenses" in data, "No total_expenses in response"
        assert "net_income" in data, "No net_income in response"
        print(f"✓ Income Statement: revenue={data['total_revenue']}, expenses={data['total_expenses']}, net_income={data['net_income']}")
    
    def test_get_balance_sheet(self):
        """Test GET /api/accounting/balance-sheet"""
        response = requests.get(f"{BASE_URL}/api/accounting/balance-sheet", headers=self.headers)
        assert response.status_code == 200, f"Get balance sheet failed: {response.text}"
        data = response.json()
        assert "assets" in data, "No assets in response"
        assert "liabilities" in data, "No liabilities in response"
        assert "equity" in data, "No equity in response"
        assert "total_assets" in data, "No total_assets in response"
        assert "total_liabilities" in data, "No total_liabilities in response"
        assert "balanced" in data, "No balanced flag in response"
        print(f"✓ Balance Sheet: assets={data['total_assets']}, liabilities={data['total_liabilities']}, equity={data['total_equity']}, balanced={data['balanced']}")
    
    def test_get_general_ledger(self):
        """Test GET /api/accounting/general-ledger"""
        response = requests.get(f"{BASE_URL}/api/accounting/general-ledger", headers=self.headers)
        assert response.status_code == 200, f"Get general ledger failed: {response.text}"
        data = response.json()
        assert "lines" in data, "No lines in response"
        assert "total" in data, "No total in response"
        print(f"✓ General Ledger: {data['total']} lines")
    
    def test_get_bank_transactions(self):
        """Test GET /api/accounting/bank-transactions"""
        response = requests.get(f"{BASE_URL}/api/accounting/bank-transactions", headers=self.headers)
        assert response.status_code == 200, f"Get bank transactions failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Bank Transactions: {len(data)} transactions")
    
    def test_get_reconciliation_summary(self):
        """Test GET /api/accounting/reconciliation-summary"""
        response = requests.get(f"{BASE_URL}/api/accounting/reconciliation-summary", headers=self.headers)
        assert response.status_code == 200, f"Get reconciliation summary failed: {response.text}"
        data = response.json()
        assert "bank_balance" in data, "No bank_balance in response"
        assert "book_balance" in data, "No book_balance in response"
        assert "difference" in data, "No difference in response"
        print(f"✓ Reconciliation Summary: bank={data['bank_balance']}, book={data['book_balance']}, diff={data['difference']}")


class TestFinanceModule:
    """Finance module API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        if response.status_code == 200:
            self.token = response.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_finance_dashboard(self):
        """Test GET /api/finance/dashboard"""
        response = requests.get(f"{BASE_URL}/api/finance/dashboard", headers=self.headers)
        assert response.status_code == 200, f"Get dashboard failed: {response.text}"
        data = response.json()
        assert "total_invoiced" in data, "No total_invoiced in response"
        assert "total_collected" in data, "No total_collected in response"
        assert "total_outstanding" in data, "No total_outstanding in response"
        assert "collection_rate" in data, "No collection_rate in response"
        print(f"✓ Finance Dashboard: invoiced={data['total_invoiced']}, collected={data['total_collected']}, outstanding={data['total_outstanding']}")
    
    def test_get_payments(self):
        """Test GET /api/finance/payments"""
        response = requests.get(f"{BASE_URL}/api/finance/payments", headers=self.headers)
        assert response.status_code == 200, f"Get payments failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Payments: {len(data)} payments found")
        return data
    
    def test_get_invoices(self):
        """Test GET /api/finance/invoices"""
        response = requests.get(f"{BASE_URL}/api/finance/invoices", headers=self.headers)
        assert response.status_code == 200, f"Get invoices failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Invoices: {len(data)} invoices found")
    
    def test_get_credit_notes(self):
        """Test GET /api/finance/credit-notes"""
        response = requests.get(f"{BASE_URL}/api/finance/credit-notes", headers=self.headers)
        assert response.status_code == 200, f"Get credit notes failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Credit Notes: {len(data)} notes found")
    
    def test_get_allocations(self):
        """Test GET /api/finance/allocations"""
        response = requests.get(f"{BASE_URL}/api/finance/allocations", headers=self.headers)
        assert response.status_code == 200, f"Get allocations failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Allocations: {len(data)} allocations found")


class TestPlagiarismAPI:
    """Plagiarism check API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        if response.status_code == 200:
            self.token = response.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_plagiarism_history(self):
        """Test GET /api/plagiarism/history"""
        response = requests.get(f"{BASE_URL}/api/plagiarism/history", headers=self.headers)
        assert response.status_code == 200, f"Get plagiarism history failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Plagiarism History: {len(data)} checks found")


class TestHealthCheck:
    """Basic health check"""
    
    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✓ Health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
