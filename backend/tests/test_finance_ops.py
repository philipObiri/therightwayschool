"""
TCIS Finance Operations API Tests - Iteration 13
Tests for: Expenses, Budgets, Procurement, Vendors, Petty Cash, Receipts, Audit Log, Dashboard
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
FINANCE_USER = {"email": "finance@tcis.demo", "password": "finance123"}
CEO_USER = {"email": "ceo@tcis.demo", "password": "ceo123"}
ADMIN_USER = {"email": "dwain@tcis.demo", "password": "admin123"}


@pytest.fixture(scope="module")
def finance_token():
    """Get finance officer auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=FINANCE_USER)
    if response.status_code == 200:
        return response.json().get("token")  # API returns 'token' not 'access_token'
    pytest.skip("Finance login failed")


@pytest.fixture(scope="module")
def ceo_token():
    """Get CEO auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_USER)
    if response.status_code == 200:
        return response.json().get("token")  # API returns 'token' not 'access_token'
    pytest.skip("CEO login failed")


@pytest.fixture(scope="module")
def admin_token():
    """Get SuperAdmin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
    if response.status_code == 200:
        return response.json().get("token")  # API returns 'token' not 'access_token'
    pytest.skip("Admin login failed")


@pytest.fixture
def finance_client(finance_token):
    """Session with finance auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {finance_token}"
    })
    return session


@pytest.fixture
def ceo_client(ceo_token):
    """Session with CEO auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ceo_token}"
    })
    return session


class TestAuthentication:
    """Test login for finance roles"""
    
    def test_finance_login(self):
        """Finance officer can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=FINANCE_USER)
        assert response.status_code == 200, f"Finance login failed: {response.text}"
        data = response.json()
        assert "token" in data  # API returns 'token' not 'access_token'
        assert data.get("user", {}).get("role") == "FinanceOfficer"
        print(f"✓ Finance login successful: {data.get('user', {}).get('name')}")
    
    def test_ceo_login(self):
        """CEO can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_USER)
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        data = response.json()
        assert "token" in data  # API returns 'token' not 'access_token'
        assert data.get("user", {}).get("role") == "CEO"
        print(f"✓ CEO login successful: {data.get('user', {}).get('name')}")


class TestExpenses:
    """Expense CRUD and workflow tests"""
    
    def test_list_expenses(self, finance_client):
        """GET /api/finance/expenses - list all expenses"""
        response = finance_client.get(f"{BASE_URL}/api/finance/expenses")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} expenses")
    
    def test_create_expense(self, finance_client):
        """POST /api/finance/expenses - create new expense"""
        payload = {
            "title": "TEST_Office Supplies",
            "description": "Stationery for admin office",
            "category": "Stationery",
            "department": "Administration",
            "amount": 250.00,
            "vendor_name": "Office Mart",
            "expense_date": datetime.now().strftime("%Y-%m-%d")
        }
        response = finance_client.post(f"{BASE_URL}/api/finance/expenses", json=payload)
        assert response.status_code == 200, f"Create expense failed: {response.text}"
        data = response.json()
        assert "expense_id" in data
        assert data["title"] == payload["title"]
        assert data["amount"] == payload["amount"]
        assert data["status"] == "pending"
        print(f"✓ Created expense: {data['expense_id']}")
        return data["expense_id"]
    
    def test_get_expense_detail(self, finance_client):
        """GET /api/finance/expenses/{id} - get expense detail"""
        # First create an expense
        payload = {"title": "TEST_Detail Check", "amount": 100, "category": "Miscellaneous"}
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/expenses", json=payload)
        expense_id = create_resp.json()["expense_id"]
        
        # Get detail
        response = finance_client.get(f"{BASE_URL}/api/finance/expenses/{expense_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["expense_id"] == expense_id
        assert data["title"] == payload["title"]
        print(f"✓ Got expense detail: {expense_id}")
    
    def test_review_expense(self, finance_client):
        """POST /api/finance/expenses/{id}/review - review expense"""
        # Create expense
        payload = {"title": "TEST_Review Test", "amount": 150, "category": "Transport"}
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/expenses", json=payload)
        expense_id = create_resp.json()["expense_id"]
        
        # Review (approve)
        response = finance_client.post(f"{BASE_URL}/api/finance/expenses/{expense_id}/review", 
                                       json={"action": "approve", "notes": "Looks good"})
        assert response.status_code == 200
        
        # Verify status changed
        detail = finance_client.get(f"{BASE_URL}/api/finance/expenses/{expense_id}").json()
        assert detail["status"] == "reviewed"
        print(f"✓ Reviewed expense: {expense_id}")
    
    def test_approve_expense(self, finance_client):
        """POST /api/finance/expenses/{id}/approve - final approve"""
        # Create and review expense
        payload = {"title": "TEST_Approve Test", "amount": 200, "category": "Utilities"}
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/expenses", json=payload)
        expense_id = create_resp.json()["expense_id"]
        finance_client.post(f"{BASE_URL}/api/finance/expenses/{expense_id}/review", json={"action": "approve"})
        
        # Final approve
        response = finance_client.post(f"{BASE_URL}/api/finance/expenses/{expense_id}/approve", json={})
        assert response.status_code == 200
        
        # Verify
        detail = finance_client.get(f"{BASE_URL}/api/finance/expenses/{expense_id}").json()
        assert detail["status"] == "approved"
        print(f"✓ Approved expense: {expense_id}")
    
    def test_pay_expense(self, finance_client):
        """POST /api/finance/expenses/{id}/pay - mark as paid"""
        # Create, review, approve
        payload = {"title": "TEST_Pay Test", "amount": 300, "category": "Maintenance"}
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/expenses", json=payload)
        expense_id = create_resp.json()["expense_id"]
        finance_client.post(f"{BASE_URL}/api/finance/expenses/{expense_id}/review", json={"action": "approve"})
        finance_client.post(f"{BASE_URL}/api/finance/expenses/{expense_id}/approve", json={})
        
        # Mark paid
        response = finance_client.post(f"{BASE_URL}/api/finance/expenses/{expense_id}/pay", 
                                       json={"payment_method": "bank_transfer", "payment_reference": "TXN123"})
        assert response.status_code == 200
        
        # Verify
        detail = finance_client.get(f"{BASE_URL}/api/finance/expenses/{expense_id}").json()
        assert detail["status"] == "completed"
        assert detail["payment_status"] == "paid"
        print(f"✓ Paid expense: {expense_id}")
    
    def test_reject_expense(self, finance_client):
        """POST /api/finance/expenses/{id}/review - reject expense"""
        payload = {"title": "TEST_Reject Test", "amount": 5000, "category": "Events"}
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/expenses", json=payload)
        expense_id = create_resp.json()["expense_id"]
        
        # Reject
        response = finance_client.post(f"{BASE_URL}/api/finance/expenses/{expense_id}/review", 
                                       json={"action": "reject", "notes": "Budget exceeded"})
        assert response.status_code == 200
        
        # Verify
        detail = finance_client.get(f"{BASE_URL}/api/finance/expenses/{expense_id}").json()
        assert detail["status"] == "rejected"
        print(f"✓ Rejected expense: {expense_id}")


class TestBudgets:
    """Budget CRUD and approval tests"""
    
    def test_list_budgets(self, finance_client):
        """GET /api/finance/budgets - list budgets"""
        response = finance_client.get(f"{BASE_URL}/api/finance/budgets")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} budgets")
    
    def test_create_budget_with_lines(self, finance_client):
        """POST /api/finance/budgets - create budget with lines"""
        payload = {
            "name": "TEST_Q1 Operations Budget",
            "period": "term",
            "academic_year": "2025-2026",
            "lines": [
                {"department": "Academics", "category": "Teaching Materials", "description": "Books and supplies", "allocated": 5000},
                {"department": "Administration", "category": "Utilities", "description": "Electricity and water", "allocated": 3000},
                {"department": "ICT", "category": "ICT & Software", "description": "Software licenses", "allocated": 2000}
            ]
        }
        response = finance_client.post(f"{BASE_URL}/api/finance/budgets", json=payload)
        assert response.status_code == 200, f"Create budget failed: {response.text}"
        data = response.json()
        assert "budget_id" in data
        assert data["name"] == payload["name"]
        assert len(data["lines"]) == 3
        assert data["total_amount"] == 10000  # Sum of lines
        assert data["status"] == "draft"
        print(f"✓ Created budget: {data['budget_id']} with {len(data['lines'])} lines, total GHS {data['total_amount']}")
        return data["budget_id"]
    
    def test_get_budget_detail_with_utilisation(self, finance_client):
        """GET /api/finance/budgets/{id} - get budget with utilisation"""
        # Create budget
        payload = {
            "name": "TEST_Utilisation Check",
            "period": "annual",
            "academic_year": "2025-2026",
            "lines": [{"department": "Test", "category": "Miscellaneous", "allocated": 1000}]
        }
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/budgets", json=payload)
        budget_id = create_resp.json()["budget_id"]
        
        # Get detail
        response = finance_client.get(f"{BASE_URL}/api/finance/budgets/{budget_id}")
        assert response.status_code == 200
        data = response.json()
        assert "lines" in data
        assert "total_spent" in data
        assert "total_remaining" in data
        # Each line should have utilisation
        for line in data["lines"]:
            assert "utilisation" in line
            assert "remaining" in line
        print(f"✓ Got budget detail with utilisation: {budget_id}")
    
    def test_approve_budget_ceo(self, ceo_client, finance_client):
        """POST /api/finance/budgets/{id}/approve - CEO approves budget"""
        # Create budget as finance
        payload = {
            "name": "TEST_CEO Approval",
            "period": "annual",
            "academic_year": "2025-2026",
            "lines": [{"department": "Finance", "category": "Salaries & Wages", "allocated": 50000}]
        }
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/budgets", json=payload)
        budget_id = create_resp.json()["budget_id"]
        
        # Approve as CEO
        response = ceo_client.post(f"{BASE_URL}/api/finance/budgets/{budget_id}/approve")
        assert response.status_code == 200
        
        # Verify
        detail = finance_client.get(f"{BASE_URL}/api/finance/budgets/{budget_id}").json()
        assert detail["status"] == "approved"
        print(f"✓ CEO approved budget: {budget_id}")


class TestProcurement:
    """Procurement workflow tests"""
    
    def test_list_procurement(self, finance_client):
        """GET /api/finance/procurement - list requests"""
        response = finance_client.get(f"{BASE_URL}/api/finance/procurement")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} procurement requests")
    
    def test_create_procurement(self, finance_client):
        """POST /api/finance/procurement - create request"""
        payload = {
            "title": "TEST_New Computers",
            "description": "10 laptops for ICT lab",
            "department": "ICT",
            "estimated_amount": 25000,
            "vendor_name": "Tech Solutions Ltd",
            "urgency": "normal"
        }
        response = finance_client.post(f"{BASE_URL}/api/finance/procurement", json=payload)
        assert response.status_code == 200, f"Create procurement failed: {response.text}"
        data = response.json()
        assert "procurement_id" in data
        assert data["status"] == "requested"
        assert len(data["workflow"]) == 1
        print(f"✓ Created procurement: {data['procurement_id']}")
        return data["procurement_id"]
    
    def test_advance_procurement_workflow(self, finance_client):
        """POST /api/finance/procurement/{id}/advance - advance through stages"""
        # Create
        payload = {"title": "TEST_Workflow Test", "estimated_amount": 5000, "department": "Admin"}
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/procurement", json=payload)
        proc_id = create_resp.json()["procurement_id"]
        
        # Advance: requested -> dept_reviewed
        resp1 = finance_client.post(f"{BASE_URL}/api/finance/procurement/{proc_id}/advance", 
                                    json={"action": "approve", "notes": "Dept approved"})
        assert resp1.status_code == 200
        
        # Advance: dept_reviewed -> finance_reviewed
        resp2 = finance_client.post(f"{BASE_URL}/api/finance/procurement/{proc_id}/advance", 
                                    json={"action": "approve", "notes": "Finance reviewed"})
        assert resp2.status_code == 200
        
        # Advance: finance_reviewed -> leadership_approved
        resp3 = finance_client.post(f"{BASE_URL}/api/finance/procurement/{proc_id}/advance", 
                                    json={"action": "approve", "notes": "Leadership approved"})
        assert resp3.status_code == 200
        
        # Advance: leadership_approved -> payment_processed
        resp4 = finance_client.post(f"{BASE_URL}/api/finance/procurement/{proc_id}/advance", 
                                    json={"action": "approve", "final_amount": 4800})
        assert resp4.status_code == 200
        
        # Verify final state
        procs = finance_client.get(f"{BASE_URL}/api/finance/procurement").json()
        proc = next((p for p in procs if p["procurement_id"] == proc_id), None)
        assert proc["status"] == "payment_processed"
        assert proc["payment_status"] == "paid"
        print(f"✓ Advanced procurement through all stages: {proc_id}")
    
    def test_reject_procurement(self, finance_client):
        """POST /api/finance/procurement/{id}/advance - reject request"""
        payload = {"title": "TEST_Reject Proc", "estimated_amount": 100000, "department": "Events"}
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/procurement", json=payload)
        proc_id = create_resp.json()["procurement_id"]
        
        # Reject
        response = finance_client.post(f"{BASE_URL}/api/finance/procurement/{proc_id}/advance", 
                                       json={"action": "reject", "notes": "Too expensive"})
        assert response.status_code == 200
        
        # Verify
        procs = finance_client.get(f"{BASE_URL}/api/finance/procurement").json()
        proc = next((p for p in procs if p["procurement_id"] == proc_id), None)
        assert proc["status"] == "rejected"
        print(f"✓ Rejected procurement: {proc_id}")


class TestVendors:
    """Vendor CRUD tests"""
    
    def test_list_vendors(self, finance_client):
        """GET /api/finance/vendors - list vendors"""
        response = finance_client.get(f"{BASE_URL}/api/finance/vendors")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} vendors")
    
    def test_create_vendor(self, finance_client):
        """POST /api/finance/vendors - create vendor"""
        payload = {
            "name": "TEST_ABC Supplies Ltd",
            "contact_person": "John Doe",
            "phone": "+233201234567",
            "email": "john@abcsupplies.com",
            "address": "123 Main Street, Accra",
            "service_category": "Stationery",
            "tax_id": "GH123456789",
            "bank_details": "GCB Bank - 1234567890"
        }
        response = finance_client.post(f"{BASE_URL}/api/finance/vendors", json=payload)
        assert response.status_code == 200, f"Create vendor failed: {response.text}"
        data = response.json()
        assert "vendor_id" in data
        assert data["name"] == payload["name"]
        assert data["status"] == "active"
        print(f"✓ Created vendor: {data['vendor_id']}")
        return data["vendor_id"]
    
    def test_update_vendor(self, finance_client):
        """PUT /api/finance/vendors/{id} - update vendor"""
        # Create
        payload = {"name": "TEST_Update Vendor", "phone": "0201111111"}
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/vendors", json=payload)
        vendor_id = create_resp.json()["vendor_id"]
        
        # Update
        update_payload = {"phone": "0202222222", "email": "updated@vendor.com"}
        response = finance_client.put(f"{BASE_URL}/api/finance/vendors/{vendor_id}", json=update_payload)
        assert response.status_code == 200
        
        # Verify
        vendors = finance_client.get(f"{BASE_URL}/api/finance/vendors").json()
        vendor = next((v for v in vendors if v["vendor_id"] == vendor_id), None)
        assert vendor["phone"] == "0202222222"
        assert vendor["email"] == "updated@vendor.com"
        print(f"✓ Updated vendor: {vendor_id}")


class TestPettyCash:
    """Petty cash account and transaction tests"""
    
    def test_list_petty_cash_accounts(self, finance_client):
        """GET /api/finance/petty-cash/accounts - list accounts"""
        response = finance_client.get(f"{BASE_URL}/api/finance/petty-cash/accounts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} petty cash accounts")
    
    def test_create_petty_cash_account(self, finance_client):
        """POST /api/finance/petty-cash/accounts - create account"""
        payload = {
            "name": "TEST_Admin Petty Cash",
            "initial_balance": 1000
        }
        response = finance_client.post(f"{BASE_URL}/api/finance/petty-cash/accounts", json=payload)
        assert response.status_code == 200, f"Create PC account failed: {response.text}"
        data = response.json()
        assert "account_id" in data
        assert data["name"] == payload["name"]
        assert data["balance"] == 1000
        print(f"✓ Created petty cash account: {data['account_id']} with GHS {data['balance']}")
        return data["account_id"]
    
    def test_top_up_petty_cash(self, finance_client):
        """POST /api/finance/petty-cash/{id}/top-up - add funds"""
        # Create account
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/petty-cash/accounts", 
                                          json={"name": "TEST_TopUp Account", "initial_balance": 500})
        account_id = create_resp.json()["account_id"]
        
        # Top up
        response = finance_client.post(f"{BASE_URL}/api/finance/petty-cash/{account_id}/top-up", 
                                       json={"amount": 300, "description": "Monthly replenishment"})
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "top_up"
        assert data["amount"] == 300
        
        # Verify balance
        accounts = finance_client.get(f"{BASE_URL}/api/finance/petty-cash/accounts").json()
        account = next((a for a in accounts if a["account_id"] == account_id), None)
        assert account["balance"] == 800  # 500 + 300
        print(f"✓ Topped up petty cash: {account_id}, new balance GHS {account['balance']}")
    
    def test_spend_petty_cash(self, finance_client):
        """POST /api/finance/petty-cash/{id}/spend - record spending"""
        # Create account with balance
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/petty-cash/accounts", 
                                          json={"name": "TEST_Spend Account", "initial_balance": 500})
        account_id = create_resp.json()["account_id"]
        
        # Spend
        response = finance_client.post(f"{BASE_URL}/api/finance/petty-cash/{account_id}/spend", 
                                       json={"amount": 150, "description": "Taxi fare", "category": "Transport"})
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "spend"
        assert data["amount"] == 150
        
        # Verify balance
        accounts = finance_client.get(f"{BASE_URL}/api/finance/petty-cash/accounts").json()
        account = next((a for a in accounts if a["account_id"] == account_id), None)
        assert account["balance"] == 350  # 500 - 150
        print(f"✓ Spent from petty cash: {account_id}, remaining GHS {account['balance']}")
    
    def test_spend_insufficient_balance(self, finance_client):
        """POST /api/finance/petty-cash/{id}/spend - fail on insufficient balance"""
        # Create account with small balance
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/petty-cash/accounts", 
                                          json={"name": "TEST_Low Balance", "initial_balance": 100})
        account_id = create_resp.json()["account_id"]
        
        # Try to spend more than balance
        response = finance_client.post(f"{BASE_URL}/api/finance/petty-cash/{account_id}/spend", 
                                       json={"amount": 500, "description": "Too much"})
        assert response.status_code == 400
        print(f"✓ Correctly rejected overspend on petty cash: {account_id}")
    
    def test_get_petty_cash_transactions(self, finance_client):
        """GET /api/finance/petty-cash/{id}/transactions - list transactions"""
        # Create account and do some transactions
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/petty-cash/accounts", 
                                          json={"name": "TEST_Txn List", "initial_balance": 1000})
        account_id = create_resp.json()["account_id"]
        finance_client.post(f"{BASE_URL}/api/finance/petty-cash/{account_id}/spend", 
                           json={"amount": 50, "description": "Test spend"})
        
        # Get transactions
        response = finance_client.get(f"{BASE_URL}/api/finance/petty-cash/{account_id}/transactions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2  # Initial balance + spend
        print(f"✓ Listed {len(data)} transactions for account: {account_id}")


class TestReceipts:
    """Receipt generation and management tests"""
    
    def test_list_receipts(self, finance_client):
        """GET /api/finance/receipts - list receipts"""
        response = finance_client.get(f"{BASE_URL}/api/finance/receipts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} receipts")
    
    def test_generate_receipt(self, finance_client):
        """POST /api/finance/receipts - generate receipt"""
        payload = {
            "payer_name": "TEST_Parent Name",
            "amount": 5000,
            "payment_method": "cash",
            "category": "School Fees",
            "remarks": "Term 2 partial payment"
        }
        response = finance_client.post(f"{BASE_URL}/api/finance/receipts", json=payload)
        assert response.status_code == 200, f"Generate receipt failed: {response.text}"
        data = response.json()
        assert "receipt_id" in data
        assert "receipt_number" in data
        assert data["receipt_number"].startswith("RCP-")
        assert data["amount"] == 5000
        assert data["status"] == "active"
        assert data["voided"] == False
        print(f"✓ Generated receipt: {data['receipt_number']}")
        return data["receipt_id"]
    
    def test_void_receipt(self, finance_client):
        """POST /api/finance/receipts/{id}/void - void receipt"""
        # Generate receipt
        create_resp = finance_client.post(f"{BASE_URL}/api/finance/receipts", 
                                          json={"payer_name": "TEST_Void Test", "amount": 100, "payment_method": "cash"})
        receipt_id = create_resp.json()["receipt_id"]
        
        # Void
        response = finance_client.post(f"{BASE_URL}/api/finance/receipts/{receipt_id}/void", 
                                       json={"reason": "Duplicate entry"})
        assert response.status_code == 200
        
        # Verify - voided receipts should not appear in list (voided=False filter)
        receipts = finance_client.get(f"{BASE_URL}/api/finance/receipts").json()
        voided = [r for r in receipts if r["receipt_id"] == receipt_id]
        assert len(voided) == 0  # Should be filtered out
        print(f"✓ Voided receipt: {receipt_id}")


class TestAuditLog:
    """Audit log tests"""
    
    def test_get_audit_log(self, finance_client):
        """GET /api/finance/audit-log - get audit entries"""
        response = finance_client.get(f"{BASE_URL}/api/finance/audit-log")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have entries from our tests
        if len(data) > 0:
            entry = data[0]
            assert "audit_id" in entry
            assert "user_name" in entry
            assert "action" in entry
            assert "entity_type" in entry
            assert "timestamp" in entry
        print(f"✓ Got {len(data)} audit log entries")


class TestDashboard:
    """Dashboard and stats tests"""
    
    def test_extended_dashboard(self, finance_client):
        """GET /api/finance/dashboard/extended - get extended stats"""
        response = finance_client.get(f"{BASE_URL}/api/finance/dashboard/extended")
        assert response.status_code == 200
        data = response.json()
        # Check expected fields
        assert "total_expenses_month" in data
        assert "pending_approvals" in data
        assert "petty_cash_balance" in data
        assert "vendor_count" in data
        assert "receipts_today" in data
        assert "expense_by_category" in data
        print(f"✓ Extended dashboard: expenses={data['total_expenses_month']}, pending={data['pending_approvals']}, petty_cash={data['petty_cash_balance']}")
    
    def test_pending_approvals(self, finance_client):
        """GET /api/finance/approvals/pending - get pending items"""
        response = finance_client.get(f"{BASE_URL}/api/finance/approvals/pending")
        assert response.status_code == 200
        data = response.json()
        assert "expenses" in data
        assert "procurement" in data
        assert "budgets" in data
        assert "total" in data
        print(f"✓ Pending approvals: {data['total']} total (expenses={len(data['expenses'])}, procurement={len(data['procurement'])}, budgets={len(data['budgets'])})")
    
    def test_expense_summary(self, finance_client):
        """GET /api/finance/expenses/summary/stats - expense summary"""
        response = finance_client.get(f"{BASE_URL}/api/finance/expenses/summary/stats")
        assert response.status_code == 200
        data = response.json()
        assert "by_category" in data
        assert "total" in data
        assert "pending_count" in data
        print(f"✓ Expense summary: total={data['total']}, pending={data['pending_count']}")


class TestExpenseCategories:
    """Expense categories endpoint test"""
    
    def test_get_expense_categories(self, finance_client):
        """GET /api/finance/expense-categories - get categories"""
        response = finance_client.get(f"{BASE_URL}/api/finance/expense-categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "Salaries & Wages" in data
        assert "Utilities" in data
        print(f"✓ Got {len(data)} expense categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
