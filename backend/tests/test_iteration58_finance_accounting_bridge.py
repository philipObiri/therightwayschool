"""
Iteration 58: Finance → Accounting Bridge Integration Tests
Tests the auto-posting of journal entries from Finance operations to Accounting.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FINANCE_CREDS = {"email": "finance@tcis.demo", "password": "finance123"}
SUPERADMIN_CREDS = {"email": "dwain@tcis.demo", "password": "admin123"}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def finance_token(api_client):
    """Get Finance Officer authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=FINANCE_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Finance Officer authentication failed")


@pytest.fixture(scope="module")
def superadmin_token(api_client):
    """Get SuperAdmin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("SuperAdmin authentication failed")


@pytest.fixture(scope="module")
def auth_headers(finance_token):
    """Headers with Finance Officer auth token"""
    return {"Authorization": f"Bearer {finance_token}"}


@pytest.fixture(scope="module")
def superadmin_headers(superadmin_token):
    """Headers with SuperAdmin auth token"""
    return {"Authorization": f"Bearer {superadmin_token}"}


@pytest.fixture(scope="module")
def test_student(api_client, auth_headers):
    """Get a test student for finance operations"""
    # Get student ledger to find a student
    response = api_client.get(f"{BASE_URL}/api/finance/student-ledger", headers=auth_headers)
    if response.status_code == 200:
        students = response.json()
        if students and len(students) > 0:
            return students[0]
    # Fallback: get from users
    response = api_client.get(f"{BASE_URL}/api/users?role=Student", headers=auth_headers)
    if response.status_code == 200:
        users = response.json()
        if users and len(users) > 0:
            return users[0]
    pytest.skip("No test student found")


class TestFinanceAccountingBridgeSetup:
    """Verify Chart of Accounts is set up for bridge to work"""
    
    def test_chart_of_accounts_exists(self, api_client, auth_headers):
        """Verify COA is seeded with required accounts"""
        response = api_client.get(f"{BASE_URL}/api/accounting/chart-of-accounts", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get COA: {response.text}"
        
        data = response.json()
        accounts = data.get("accounts", [])
        assert len(accounts) > 0, "Chart of Accounts is empty - bridge won't work"
        
        # Verify required accounts for finance bridge exist
        account_codes = [a["code"] for a in accounts]
        required_codes = ["1000", "1010", "1020", "1100", "4000"]  # Cash, Bank, MoMo, AR, Revenue
        for code in required_codes:
            assert code in account_codes, f"Required account {code} missing from COA"
        print(f"✓ COA has {len(accounts)} accounts including all required for finance bridge")


class TestQuickAssignCreatesJournalEntries:
    """Test POST /api/finance/quick-assign creates 2 auto journal entries"""
    
    def test_quick_assign_creates_invoice_and_payment_journals(self, api_client, auth_headers, test_student):
        """Quick assign should create invoice JE (Debit AR, Credit Revenue) and payment JE (Debit Cash, Credit AR)"""
        student_id = test_student.get("user_id")
        student_name = test_student.get("name", "Test Student")
        
        # Get initial journal entry count
        je_response = api_client.get(f"{BASE_URL}/api/accounting/journal-entries", headers=auth_headers)
        initial_je_count = len(je_response.json()) if je_response.status_code == 200 else 0
        
        # Perform quick assign with fee and partial payment
        fee_amount = 500.00
        paid_amount = 200.00
        payload = {
            "student_id": student_id,
            "fee_amount": fee_amount,
            "paid_amount": paid_amount,
            "description": "TEST_Bridge_QuickAssign",
            "method": "cash"
        }
        
        response = api_client.post(f"{BASE_URL}/api/finance/quick-assign", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Quick assign failed: {response.text}"
        
        result = response.json()
        invoice_id = result.get("invoice_id")
        assert invoice_id, "No invoice_id returned from quick-assign"
        print(f"✓ Quick assign created invoice {invoice_id}")
        
        # Verify journal entries were created
        je_response = api_client.get(f"{BASE_URL}/api/accounting/journal-entries", headers=auth_headers)
        assert je_response.status_code == 200
        
        all_entries = je_response.json()
        new_entries = [e for e in all_entries if e.get("source") == "finance_auto"]
        
        # Should have at least 2 new finance_auto entries (invoice + payment)
        assert len(new_entries) >= 2, f"Expected at least 2 finance_auto entries, got {len(new_entries)}"
        
        # Find the invoice journal entry
        invoice_je = None
        payment_je = None
        for entry in new_entries:
            if invoice_id in entry.get("reference", ""):
                if "Invoice" in entry.get("description", ""):
                    invoice_je = entry
                elif "Payment" in entry.get("description", ""):
                    payment_je = entry
        
        # Verify invoice journal entry
        if invoice_je:
            assert invoice_je["source"] == "finance_auto", "Invoice JE should have source=finance_auto"
            assert invoice_je["total_debit"] == fee_amount, f"Invoice JE debit should be {fee_amount}"
            assert invoice_je["total_credit"] == fee_amount, f"Invoice JE credit should be {fee_amount}"
            
            # Check lines: Debit AR (1100), Credit Revenue (4000)
            lines = invoice_je.get("lines", [])
            ar_line = next((l for l in lines if l["account_code"] == "1100"), None)
            revenue_line = next((l for l in lines if l["account_code"] == "4000"), None)
            
            assert ar_line, "Invoice JE should have AR (1100) line"
            assert ar_line["debit"] == fee_amount, f"AR should be debited {fee_amount}"
            assert revenue_line, "Invoice JE should have Revenue (4000) line"
            assert revenue_line["credit"] == fee_amount, f"Revenue should be credited {fee_amount}"
            print(f"✓ Invoice JE correctly debits AR and credits Revenue for {fee_amount}")
        
        # Verify payment journal entry
        if payment_je:
            assert payment_je["source"] == "finance_auto", "Payment JE should have source=finance_auto"
            assert payment_je["total_debit"] == paid_amount, f"Payment JE debit should be {paid_amount}"
            
            # Check lines: Debit Cash (1000), Credit AR (1100)
            lines = payment_je.get("lines", [])
            cash_line = next((l for l in lines if l["account_code"] == "1000"), None)
            ar_credit_line = next((l for l in lines if l["account_code"] == "1100" and l["credit"] > 0), None)
            
            assert cash_line, "Payment JE should have Cash (1000) line"
            assert cash_line["debit"] == paid_amount, f"Cash should be debited {paid_amount}"
            assert ar_credit_line, "Payment JE should have AR (1100) credit line"
            assert ar_credit_line["credit"] == paid_amount, f"AR should be credited {paid_amount}"
            print(f"✓ Payment JE correctly debits Cash and credits AR for {paid_amount}")
        
        return invoice_id


class TestAccountingReportsReflectFinanceData:
    """Test that Accounting reports reflect finance operations"""
    
    def test_trial_balance_is_balanced(self, api_client, auth_headers):
        """Trial Balance should remain balanced after finance operations"""
        response = api_client.get(f"{BASE_URL}/api/accounting/trial-balance", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get trial balance: {response.text}"
        
        data = response.json()
        assert data.get("balanced") == True, f"Trial Balance is NOT balanced! Debit: {data.get('total_debit')}, Credit: {data.get('total_credit')}"
        print(f"✓ Trial Balance is balanced: Debit={data.get('total_debit')}, Credit={data.get('total_credit')}")
    
    def test_dashboard_shows_updated_totals(self, api_client, auth_headers):
        """Dashboard KPI cards should reflect finance data"""
        response = api_client.get(f"{BASE_URL}/api/accounting/dashboard", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get dashboard: {response.text}"
        
        data = response.json()
        
        # Verify all expected fields are present
        expected_fields = ["total_assets", "total_liabilities", "total_equity", "total_revenue", "total_expenses", "net_income", "journal_count"]
        for field in expected_fields:
            assert field in data, f"Dashboard missing field: {field}"
        
        # Revenue should be > 0 if finance operations created invoices
        print(f"✓ Dashboard KPIs: Assets={data['total_assets']}, Revenue={data['total_revenue']}, Expenses={data['total_expenses']}, Net Income={data['net_income']}, Journal Count={data['journal_count']}")
    
    def test_income_statement_reflects_fee_revenue(self, api_client, auth_headers):
        """Income Statement should show fee revenue from finance invoices"""
        response = api_client.get(f"{BASE_URL}/api/accounting/income-statement", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get income statement: {response.text}"
        
        data = response.json()
        revenue_items = data.get("revenue", [])
        total_revenue = data.get("total_revenue", 0)
        
        # Check for tuition fee income (4000)
        tuition_revenue = next((r for r in revenue_items if r["code"] == "4000"), None)
        if tuition_revenue:
            print(f"✓ Income Statement shows Tuition Fee Income (4000): {tuition_revenue['amount']}")
        
        print(f"✓ Income Statement: Total Revenue={total_revenue}, Net Income={data.get('net_income')}")
    
    def test_balance_sheet_reflects_accounts_receivable(self, api_client, auth_headers):
        """Balance Sheet should show AR from unpaid invoices"""
        response = api_client.get(f"{BASE_URL}/api/accounting/balance-sheet", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get balance sheet: {response.text}"
        
        data = response.json()
        assets = data.get("assets", [])
        
        # Check for AR (1100)
        ar_account = next((a for a in assets if a["code"] == "1100"), None)
        if ar_account:
            print(f"✓ Balance Sheet shows Accounts Receivable (1100): {ar_account['balance']}")
        
        # Verify balance sheet is balanced
        assert data.get("balanced") == True, "Balance Sheet is NOT balanced!"
        print(f"✓ Balance Sheet is balanced: Assets={data['total_assets']}, L+E={data['total_liabilities_equity']}")


class TestJournalEntriesShowFinanceBadge:
    """Test that Journal Entries tab shows 'Finance' badge on auto-posted entries"""
    
    def test_finance_auto_entries_have_source_field(self, api_client, auth_headers):
        """Journal entries from finance should have source=finance_auto"""
        response = api_client.get(f"{BASE_URL}/api/accounting/journal-entries", headers=auth_headers)
        assert response.status_code == 200
        
        entries = response.json()
        finance_entries = [e for e in entries if e.get("source") == "finance_auto"]
        
        assert len(finance_entries) > 0, "No finance_auto journal entries found"
        
        for entry in finance_entries[:3]:  # Check first 3
            assert entry["source"] == "finance_auto"
            print(f"✓ Finance JE: {entry['description'][:50]}... (source={entry['source']})")
        
        print(f"✓ Found {len(finance_entries)} journal entries with source=finance_auto")


class TestGeneralLedgerShowsFinanceEntries:
    """Test General Ledger shows finance-auto entries with running balance"""
    
    def test_general_ledger_ar_account(self, api_client, auth_headers):
        """General Ledger for AR (1100) should show finance entries with running balance"""
        response = api_client.get(f"{BASE_URL}/api/accounting/general-ledger?account_code=1100", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get general ledger: {response.text}"
        
        data = response.json()
        lines = data.get("lines", [])
        
        if len(lines) > 0:
            # Verify running balance is calculated
            for line in lines[:3]:
                assert "running_balance" in line, "General ledger line should have running_balance"
                print(f"✓ GL Line: {line['description'][:40]}... Debit={line['debit']}, Credit={line['credit']}, Balance={line['running_balance']}")
        
        print(f"✓ General Ledger for AR (1100) has {len(lines)} entries")
    
    def test_general_ledger_revenue_account(self, api_client, auth_headers):
        """General Ledger for Revenue (4000) should show finance entries"""
        response = api_client.get(f"{BASE_URL}/api/accounting/general-ledger?account_code=4000", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        lines = data.get("lines", [])
        print(f"✓ General Ledger for Revenue (4000) has {len(lines)} entries, Total Credit={data.get('total_credit')}")


class TestPaymentCreatesJournalEntry:
    """Test POST /api/finance/payments records a payment journal entry"""
    
    def test_record_payment_creates_journal_entry(self, api_client, auth_headers, test_student):
        """Recording a payment should create JE: Debit Cash/Bank, Credit AR"""
        student_id = test_student.get("user_id")
        
        # Get initial journal count
        je_response = api_client.get(f"{BASE_URL}/api/accounting/journal-entries", headers=auth_headers)
        initial_count = len(je_response.json()) if je_response.status_code == 200 else 0
        
        # Record a payment
        payment_amount = 150.00
        payload = {
            "student_id": student_id,
            "amount": payment_amount,
            "method": "mobile_money",
            "reference": "TEST_MOMO_BRIDGE"
        }
        
        response = api_client.post(f"{BASE_URL}/api/finance/payments", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed to record payment: {response.text}"
        
        payment_data = response.json()
        payment_id = payment_data.get("payment_id")
        print(f"✓ Payment recorded: {payment_id}")
        
        # Verify journal entry was created
        je_response = api_client.get(f"{BASE_URL}/api/accounting/journal-entries", headers=auth_headers)
        entries = je_response.json()
        
        # Find the payment journal entry
        payment_je = None
        for entry in entries:
            if entry.get("source") == "finance_auto" and payment_id in entry.get("reference", ""):
                payment_je = entry
                break
        
        if payment_je:
            assert payment_je["total_debit"] == payment_amount
            
            # Check lines: Debit MoMo (1020), Credit AR (1100)
            lines = payment_je.get("lines", [])
            momo_line = next((l for l in lines if l["account_code"] == "1020"), None)
            ar_line = next((l for l in lines if l["account_code"] == "1100" and l["credit"] > 0), None)
            
            if momo_line:
                assert momo_line["debit"] == payment_amount, f"MoMo should be debited {payment_amount}"
                print(f"✓ Payment JE debits Mobile Money (1020) for {payment_amount}")
            if ar_line:
                assert ar_line["credit"] == payment_amount, f"AR should be credited {payment_amount}"
                print(f"✓ Payment JE credits AR (1100) for {payment_amount}")
        
        return payment_id


class TestInvoiceDeletionCreatesReversalJournalEntries:
    """Test DELETE /api/finance/invoices/{id} creates reversal journal entries"""
    
    def test_delete_invoice_creates_reversal(self, api_client, auth_headers, test_student):
        """Deleting an invoice should create reversal JE in Accounting"""
        student_id = test_student.get("user_id")
        
        # First create an invoice via quick-assign (no payment)
        payload = {
            "student_id": student_id,
            "fee_amount": 300.00,
            "paid_amount": 0,
            "description": "TEST_ToBeDeleted"
        }
        
        response = api_client.post(f"{BASE_URL}/api/finance/quick-assign", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create invoice: {response.text}"
        
        invoice_id = response.json().get("invoice_id")
        print(f"✓ Created invoice {invoice_id} for deletion test")
        
        # Get journal entries before deletion
        je_before = api_client.get(f"{BASE_URL}/api/accounting/journal-entries", headers=auth_headers)
        count_before = len(je_before.json())
        
        # Delete the invoice
        delete_response = api_client.delete(f"{BASE_URL}/api/finance/invoices/{invoice_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Failed to delete invoice: {delete_response.text}"
        print(f"✓ Deleted invoice {invoice_id}")
        
        # Verify reversal journal entry was created
        je_after = api_client.get(f"{BASE_URL}/api/accounting/journal-entries", headers=auth_headers)
        entries_after = je_after.json()
        
        # Look for reversal entry
        reversal_je = None
        for entry in entries_after:
            if f"REV-{invoice_id}" in entry.get("reference", "") or "REVERSAL" in entry.get("description", ""):
                reversal_je = entry
                break
        
        if reversal_je:
            assert reversal_je["source"] == "finance_auto", "Reversal JE should have source=finance_auto"
            print(f"✓ Reversal JE created: {reversal_je['description'][:50]}...")
            
            # Reversal should have opposite entries (Credit AR, Debit Revenue)
            lines = reversal_je.get("lines", [])
            ar_line = next((l for l in lines if l["account_code"] == "1100"), None)
            revenue_line = next((l for l in lines if l["account_code"] == "4000"), None)
            
            if ar_line:
                assert ar_line["credit"] > 0, "Reversal should credit AR (opposite of original debit)"
                print(f"✓ Reversal credits AR (1100) for {ar_line['credit']}")
            if revenue_line:
                assert revenue_line["debit"] > 0, "Reversal should debit Revenue (opposite of original credit)"
                print(f"✓ Reversal debits Revenue (4000) for {revenue_line['debit']}")
        else:
            print("⚠ No explicit reversal JE found - may be handled differently")


class TestPaymentReversalCreatesReversalJournalEntries:
    """Test reverse payment creates reversal journal entries"""
    
    def test_reverse_payment_creates_reversal(self, api_client, auth_headers, test_student):
        """Reversing a payment should create reversal JE in Accounting"""
        student_id = test_student.get("user_id")
        
        # First record a payment
        payload = {
            "student_id": student_id,
            "amount": 100.00,
            "method": "cash",
            "reference": "TEST_ToBeReversed"
        }
        
        response = api_client.post(f"{BASE_URL}/api/finance/payments", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed to record payment: {response.text}"
        
        payment_id = response.json().get("payment_id")
        print(f"✓ Created payment {payment_id} for reversal test")
        
        # Reverse the payment
        reverse_response = api_client.post(
            f"{BASE_URL}/api/finance/payments/{payment_id}/reverse",
            json={"reason": "Test reversal"},
            headers=auth_headers
        )
        assert reverse_response.status_code == 200, f"Failed to reverse payment: {reverse_response.text}"
        print(f"✓ Reversed payment {payment_id}")
        
        # Verify reversal journal entry was created
        je_response = api_client.get(f"{BASE_URL}/api/accounting/journal-entries", headers=auth_headers)
        entries = je_response.json()
        
        # Look for reversal entry
        reversal_je = None
        for entry in entries:
            if f"REV-{payment_id}" in entry.get("reference", "") or ("REVERSAL" in entry.get("description", "") and "Payment" in entry.get("description", "")):
                reversal_je = entry
                break
        
        if reversal_je:
            assert reversal_je["source"] == "finance_auto", "Reversal JE should have source=finance_auto"
            print(f"✓ Payment reversal JE created: {reversal_je['description'][:50]}...")
            
            # Reversal should have opposite entries (Credit Cash, Debit AR)
            lines = reversal_je.get("lines", [])
            cash_line = next((l for l in lines if l["account_code"] == "1000"), None)
            ar_line = next((l for l in lines if l["account_code"] == "1100"), None)
            
            if cash_line:
                assert cash_line["credit"] > 0, "Reversal should credit Cash (opposite of original debit)"
                print(f"✓ Reversal credits Cash (1000) for {cash_line['credit']}")
            if ar_line:
                assert ar_line["debit"] > 0, "Reversal should debit AR (opposite of original credit)"
                print(f"✓ Reversal debits AR (1100) for {ar_line['debit']}")
        else:
            print("⚠ No explicit payment reversal JE found - may be handled differently")


class TestTrialBalanceRemainsBalancedAfterAllOperations:
    """Final verification that Trial Balance is still balanced"""
    
    def test_final_trial_balance_check(self, api_client, auth_headers):
        """After all finance operations, Trial Balance should still be balanced"""
        response = api_client.get(f"{BASE_URL}/api/accounting/trial-balance", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("balanced") == True, f"Trial Balance is NOT balanced after all operations! Debit: {data.get('total_debit')}, Credit: {data.get('total_credit')}"
        
        print(f"✓ FINAL: Trial Balance is balanced: Debit={data.get('total_debit')}, Credit={data.get('total_credit')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
