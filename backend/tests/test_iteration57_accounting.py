"""
Iteration 57: Advanced Accounting Module Tests
Tests for Chart of Accounts, Journal Entries, General Ledger, Trial Balance,
Income Statement, Balance Sheet, and Bank Reconciliation.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAccountingModule:
    """Accounting Module API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as Finance Officer"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as Finance Officer
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        if login_resp.status_code == 200:
            token = login_resp.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Finance login failed - skipping accounting tests")
    
    # ========== DASHBOARD ==========
    def test_dashboard_endpoint(self):
        """Test GET /api/accounting/dashboard returns financial summary"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/dashboard")
        assert resp.status_code == 200, f"Dashboard failed: {resp.text}"
        data = resp.json()
        # Verify all expected fields
        assert "total_assets" in data
        assert "total_liabilities" in data
        assert "total_equity" in data
        assert "total_revenue" in data
        assert "total_expenses" in data
        assert "net_income" in data
        assert "journal_count" in data
        assert "account_count" in data
        assert "unmatched_bank" in data
        print(f"Dashboard: Assets={data['total_assets']}, Revenue={data['total_revenue']}, Net Income={data['net_income']}")
    
    # ========== CHART OF ACCOUNTS ==========
    def test_chart_of_accounts_list(self):
        """Test GET /api/accounting/chart-of-accounts returns accounts grouped by category"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/chart-of-accounts")
        assert resp.status_code == 200, f"COA list failed: {resp.text}"
        data = resp.json()
        assert "accounts" in data
        assert "totals" in data
        accounts = data["accounts"]
        # Should have 31 seeded accounts
        assert len(accounts) >= 31, f"Expected 31+ accounts, got {len(accounts)}"
        # Verify account structure
        if accounts:
            acct = accounts[0]
            assert "code" in acct
            assert "name" in acct
            assert "type" in acct
            assert "category" in acct
            assert "balance" in acct
        # Verify categories exist
        categories = set(a.get("category", "") for a in accounts)
        expected_cats = {"Current Assets", "Fixed Assets", "Current Liabilities", "Equity", "Revenue", "Operating Expenses"}
        assert expected_cats.issubset(categories), f"Missing categories. Found: {categories}"
        print(f"COA: {len(accounts)} accounts, Categories: {categories}")
    
    def test_chart_of_accounts_search_filter(self):
        """Test that COA search filter works (frontend feature, backend returns all)"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/chart-of-accounts")
        assert resp.status_code == 200
        accounts = resp.json()["accounts"]
        # Verify we can filter by name containing "Cash"
        cash_accounts = [a for a in accounts if "cash" in a["name"].lower()]
        assert len(cash_accounts) >= 1, "Should have at least 1 Cash account"
        print(f"Search filter test: Found {len(cash_accounts)} accounts with 'Cash'")
    
    def test_create_account(self):
        """Test POST /api/accounting/chart-of-accounts creates new account"""
        new_acct = {
            "code": "TEST_9999",
            "name": "TEST Account for Iteration 57",
            "type": "asset",
            "category": "Current Assets"
        }
        resp = self.session.post(f"{BASE_URL}/api/accounting/chart-of-accounts", json=new_acct)
        # May fail if already exists from previous test
        if resp.status_code == 400 and "already exists" in resp.text:
            print("Test account already exists - skipping create")
            return
        assert resp.status_code == 200, f"Create account failed: {resp.text}"
        data = resp.json()
        assert data["code"] == "TEST_9999"
        assert data["name"] == "TEST Account for Iteration 57"
        assert data["type"] == "asset"
        assert "account_id" in data
        print(f"Created account: {data['account_id']}")
    
    def test_deactivate_account(self):
        """Test DELETE /api/accounting/chart-of-accounts/{id} deactivates account"""
        # First get accounts to find our test account
        resp = self.session.get(f"{BASE_URL}/api/accounting/chart-of-accounts")
        accounts = resp.json()["accounts"]
        test_acct = next((a for a in accounts if a["code"] == "TEST_9999"), None)
        if not test_acct:
            # Create it first
            self.session.post(f"{BASE_URL}/api/accounting/chart-of-accounts", json={
                "code": "TEST_9999",
                "name": "TEST Account for Iteration 57",
                "type": "asset",
                "category": "Current Assets"
            })
            resp = self.session.get(f"{BASE_URL}/api/accounting/chart-of-accounts")
            accounts = resp.json()["accounts"]
            test_acct = next((a for a in accounts if a["code"] == "TEST_9999"), None)
        
        if test_acct:
            del_resp = self.session.delete(f"{BASE_URL}/api/accounting/chart-of-accounts/{test_acct['account_id']}")
            assert del_resp.status_code == 200, f"Deactivate failed: {del_resp.text}"
            assert "deactivated" in del_resp.json().get("message", "").lower()
            print(f"Deactivated account: {test_acct['account_id']}")
        else:
            print("No test account to deactivate")
    
    # ========== JOURNAL ENTRIES ==========
    def test_journal_entries_list(self):
        """Test GET /api/accounting/journal-entries returns entries with expandable lines"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/journal-entries")
        assert resp.status_code == 200, f"Journal entries list failed: {resp.text}"
        entries = resp.json()
        assert isinstance(entries, list)
        # Should have at least 1 seeded entry
        assert len(entries) >= 1, f"Expected at least 1 journal entry, got {len(entries)}"
        if entries:
            entry = entries[0]
            assert "entry_id" in entry
            assert "entry_date" in entry
            assert "description" in entry
            assert "lines" in entry
            assert "total_debit" in entry
            assert "total_credit" in entry
            assert "status" in entry
            # Verify lines structure
            if entry["lines"]:
                line = entry["lines"][0]
                assert "account_code" in line
                assert "account_name" in line
                assert "debit" in line
                assert "credit" in line
        print(f"Journal entries: {len(entries)} entries found")
    
    def test_create_journal_entry_balanced(self):
        """Test POST /api/accounting/journal-entries with balanced debits/credits"""
        entry = {
            "description": "TEST Journal Entry - Iteration 57",
            "reference": "TEST-JE-57",
            "entry_date": "2025-01-15",
            "lines": [
                {"account_code": "1000", "debit": 100.00, "credit": 0, "memo": "Cash received"},
                {"account_code": "4000", "debit": 0, "credit": 100.00, "memo": "Tuition income"}
            ]
        }
        resp = self.session.post(f"{BASE_URL}/api/accounting/journal-entries", json=entry)
        assert resp.status_code == 200, f"Create journal entry failed: {resp.text}"
        data = resp.json()
        assert data["description"] == "TEST Journal Entry - Iteration 57"
        assert data["total_debit"] == 100.00
        assert data["total_credit"] == 100.00
        assert data["status"] == "posted"
        assert len(data["lines"]) == 2
        print(f"Created journal entry: {data['entry_id']}")
    
    def test_create_journal_entry_unbalanced_fails(self):
        """Test that unbalanced journal entry is rejected"""
        entry = {
            "description": "Unbalanced Entry",
            "lines": [
                {"account_code": "1000", "debit": 100.00, "credit": 0},
                {"account_code": "4000", "debit": 0, "credit": 50.00}  # Unbalanced!
            ]
        }
        resp = self.session.post(f"{BASE_URL}/api/accounting/journal-entries", json=entry)
        assert resp.status_code == 400, f"Expected 400 for unbalanced entry, got {resp.status_code}"
        assert "debit" in resp.text.lower() or "credit" in resp.text.lower()
        print("Unbalanced entry correctly rejected")
    
    # ========== GENERAL LEDGER ==========
    def test_general_ledger_all_accounts(self):
        """Test GET /api/accounting/general-ledger returns all ledger lines"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/general-ledger")
        assert resp.status_code == 200, f"General ledger failed: {resp.text}"
        data = resp.json()
        assert "lines" in data
        assert "total" in data
        assert "total_debit" in data
        assert "total_credit" in data
        print(f"General ledger: {data['total']} lines, Debit={data['total_debit']}, Credit={data['total_credit']}")
    
    def test_general_ledger_filtered_by_account(self):
        """Test GET /api/accounting/general-ledger?account_code=X shows running balance"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/general-ledger?account_code=1000")
        assert resp.status_code == 200, f"Filtered ledger failed: {resp.text}"
        data = resp.json()
        lines = data["lines"]
        # When filtered by account, should have running_balance
        if lines:
            assert "running_balance" in lines[0], "Filtered ledger should have running_balance"
            print(f"Filtered ledger (1000): {len(lines)} lines, last balance={lines[-1]['running_balance'] if lines else 0}")
        else:
            print("No ledger lines for account 1000")
    
    def test_general_ledger_date_filter(self):
        """Test GET /api/accounting/general-ledger with date range"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/general-ledger?start_date=2025-01-01&end_date=2025-12-31")
        assert resp.status_code == 200, f"Date filtered ledger failed: {resp.text}"
        data = resp.json()
        print(f"Date filtered ledger: {data['total']} lines")
    
    # ========== TRIAL BALANCE ==========
    def test_trial_balance(self):
        """Test GET /api/accounting/trial-balance returns balanced report"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/trial-balance")
        assert resp.status_code == 200, f"Trial balance failed: {resp.text}"
        data = resp.json()
        assert "trial_balance" in data
        assert "total_debit" in data
        assert "total_credit" in data
        assert "balanced" in data
        # Verify structure
        if data["trial_balance"]:
            item = data["trial_balance"][0]
            assert "code" in item
            assert "name" in item
            assert "type" in item
            assert "category" in item
            assert "debit" in item
            assert "credit" in item
        print(f"Trial balance: Debit={data['total_debit']}, Credit={data['total_credit']}, Balanced={data['balanced']}")
    
    def test_trial_balance_with_period(self):
        """Test GET /api/accounting/trial-balance with date range"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/trial-balance?start_date=2025-01-01&end_date=2025-12-31")
        assert resp.status_code == 200, f"Period trial balance failed: {resp.text}"
        data = resp.json()
        assert "period" in data
        print(f"Period trial balance: {data.get('period')}")
    
    # ========== INCOME STATEMENT ==========
    def test_income_statement(self):
        """Test GET /api/accounting/income-statement returns P&L report"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/income-statement")
        assert resp.status_code == 200, f"Income statement failed: {resp.text}"
        data = resp.json()
        assert "revenue" in data
        assert "expenses" in data
        assert "total_revenue" in data
        assert "total_expenses" in data
        assert "net_income" in data
        # Verify revenue structure
        if data["revenue"]:
            rev = data["revenue"][0]
            assert "code" in rev
            assert "name" in rev
            assert "category" in rev
            assert "amount" in rev
        print(f"Income statement: Revenue={data['total_revenue']}, Expenses={data['total_expenses']}, Net Income={data['net_income']}")
    
    def test_income_statement_with_period(self):
        """Test GET /api/accounting/income-statement with date range"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/income-statement?start_date=2025-01-01&end_date=2025-12-31")
        assert resp.status_code == 200, f"Period income statement failed: {resp.text}"
        data = resp.json()
        assert "period" in data
        print(f"Period income statement: {data.get('period')}")
    
    # ========== BALANCE SHEET ==========
    def test_balance_sheet(self):
        """Test GET /api/accounting/balance-sheet returns balanced report"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/balance-sheet")
        assert resp.status_code == 200, f"Balance sheet failed: {resp.text}"
        data = resp.json()
        assert "assets" in data
        assert "liabilities" in data
        assert "equity" in data
        assert "total_assets" in data
        assert "total_liabilities" in data
        assert "total_equity" in data
        assert "net_income" in data
        assert "total_liabilities_equity" in data
        assert "balanced" in data
        # Verify asset structure
        if data["assets"]:
            asset = data["assets"][0]
            assert "code" in asset
            assert "name" in asset
            assert "category" in asset
            assert "balance" in asset
        print(f"Balance sheet: Assets={data['total_assets']}, L+E={data['total_liabilities_equity']}, Balanced={data['balanced']}")
    
    def test_balance_sheet_with_end_date(self):
        """Test GET /api/accounting/balance-sheet with end_date"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/balance-sheet?end_date=2025-12-31")
        assert resp.status_code == 200, f"Period balance sheet failed: {resp.text}"
        data = resp.json()
        assert "period" in data
        print(f"Period balance sheet: {data.get('period')}")
    
    # ========== BANK RECONCILIATION ==========
    def test_bank_transactions_list(self):
        """Test GET /api/accounting/bank-transactions returns transactions"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/bank-transactions")
        assert resp.status_code == 200, f"Bank transactions failed: {resp.text}"
        txns = resp.json()
        assert isinstance(txns, list)
        if txns:
            txn = txns[0]
            assert "txn_id" in txn
            assert "date" in txn
            assert "description" in txn
            assert "amount" in txn
            assert "type" in txn
            assert "matched" in txn
        print(f"Bank transactions: {len(txns)} transactions")
    
    def test_add_bank_transaction(self):
        """Test POST /api/accounting/bank-transactions adds new transaction"""
        txn = {
            "date": "2025-01-15",
            "description": "TEST Bank Deposit - Iteration 57",
            "amount": 500.00,
            "type": "credit",
            "reference": "DEP-TEST-57"
        }
        resp = self.session.post(f"{BASE_URL}/api/accounting/bank-transactions", json=txn)
        assert resp.status_code == 200, f"Add bank transaction failed: {resp.text}"
        data = resp.json()
        assert data["description"] == "TEST Bank Deposit - Iteration 57"
        assert data["amount"] == 500.00
        assert data["type"] == "credit"
        assert data["matched"] == False
        assert "txn_id" in data
        print(f"Added bank transaction: {data['txn_id']}")
    
    def test_reconciliation_summary(self):
        """Test GET /api/accounting/reconciliation-summary returns summary cards"""
        resp = self.session.get(f"{BASE_URL}/api/accounting/reconciliation-summary")
        assert resp.status_code == 200, f"Reconciliation summary failed: {resp.text}"
        data = resp.json()
        assert "bank_balance" in data
        assert "book_balance" in data
        assert "difference" in data
        assert "total_transactions" in data
        assert "matched_count" in data
        assert "unmatched_count" in data
        assert "unmatched_total" in data
        print(f"Reconciliation: Bank={data['bank_balance']}, Book={data['book_balance']}, Diff={data['difference']}, Unmatched={data['unmatched_count']}")
    
    def test_reconcile_bank_transaction(self):
        """Test POST /api/accounting/bank-reconcile/{txn_id} matches to journal entry"""
        # Get unmatched transactions
        txns_resp = self.session.get(f"{BASE_URL}/api/accounting/bank-transactions?unmatched_only=true")
        txns = txns_resp.json()
        unmatched = [t for t in txns if not t.get("matched")]
        
        # Get journal entries
        entries_resp = self.session.get(f"{BASE_URL}/api/accounting/journal-entries")
        entries = entries_resp.json()
        
        if unmatched and entries:
            txn_id = unmatched[0]["txn_id"]
            entry_id = entries[0]["entry_id"]
            resp = self.session.post(f"{BASE_URL}/api/accounting/bank-reconcile/{txn_id}", json={"entry_id": entry_id})
            assert resp.status_code == 200, f"Reconcile failed: {resp.text}"
            assert "reconciled" in resp.json().get("message", "").lower()
            print(f"Reconciled txn {txn_id} with entry {entry_id}")
        else:
            print("No unmatched transactions or entries to reconcile")
    
    def test_reconcile_missing_entry_id_fails(self):
        """Test that reconcile without entry_id fails"""
        resp = self.session.post(f"{BASE_URL}/api/accounting/bank-reconcile/fake_txn_id", json={})
        assert resp.status_code == 400, f"Expected 400 for missing entry_id, got {resp.status_code}"
        print("Missing entry_id correctly rejected")


class TestAccountingAuth:
    """Test authentication requirements for accounting endpoints"""
    
    def test_dashboard_requires_auth(self):
        """Test that dashboard requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/accounting/dashboard")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("Dashboard requires auth - OK")
    
    def test_coa_requires_auth(self):
        """Test that COA requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/accounting/chart-of-accounts")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("COA requires auth - OK")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
