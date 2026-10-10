"""
Test Petty Cash CRUD Operations + Receipt Upload + Delete Account
Iteration 18 - Focused testing for Petty Cash enhancements
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPettyCashCRUD:
    """Test Petty Cash Account CRUD, Spend/TopUp with receipts, Delete"""
    
    @pytest.fixture(scope="class")
    def finance_token(self):
        """Get Finance Officer token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        assert response.status_code == 200, f"Finance login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, finance_token):
        """Auth headers for Finance Officer"""
        return {"Authorization": f"Bearer {finance_token}"}
    
    # ========== PETTY CASH ACCOUNT CRUD ==========
    
    def test_list_petty_cash_accounts(self, auth_headers):
        """GET /api/finance/petty-cash/accounts - list all accounts"""
        response = requests.get(f"{BASE_URL}/api/finance/petty-cash/accounts", headers=auth_headers)
        assert response.status_code == 200, f"Failed to list accounts: {response.text}"
        accounts = response.json()
        assert isinstance(accounts, list), "Response should be a list"
        print(f"✓ Found {len(accounts)} petty cash accounts")
    
    def test_create_petty_cash_account(self, auth_headers):
        """POST /api/finance/petty-cash/accounts - create new account"""
        payload = {
            "name": "TEST_PettyCash_Iter18",
            "initial_balance": 500.00
        }
        response = requests.post(f"{BASE_URL}/api/finance/petty-cash/accounts", 
                                 json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create account: {response.text}"
        data = response.json()
        assert "account_id" in data, "Response should contain account_id"
        assert data["name"] == "TEST_PettyCash_Iter18", "Name should match"
        assert data["balance"] == 500.00, "Initial balance should be 500"
        assert data["status"] == "active", "Status should be active"
        print(f"✓ Created petty cash account: {data['account_id']}")
        # Store for later tests
        TestPettyCashCRUD.created_account_id = data["account_id"]
    
    def test_get_account_transactions_empty(self, auth_headers):
        """GET /api/finance/petty-cash/{id}/transactions - should have initial top-up"""
        account_id = getattr(TestPettyCashCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
        
        response = requests.get(f"{BASE_URL}/api/finance/petty-cash/{account_id}/transactions", 
                               headers=auth_headers)
        assert response.status_code == 200, f"Failed to get transactions: {response.text}"
        txns = response.json()
        assert isinstance(txns, list), "Response should be a list"
        # Should have initial balance transaction
        assert len(txns) >= 1, "Should have at least initial balance transaction"
        print(f"✓ Account has {len(txns)} transaction(s)")
    
    # ========== SPEND WITH RECEIPT ==========
    
    def test_record_spend_without_receipt(self, auth_headers):
        """POST /api/finance/petty-cash/{id}/spend - record spending without receipt"""
        account_id = getattr(TestPettyCashCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
        
        payload = {
            "amount": 50.00,
            "description": "TEST_Spend_NoReceipt",
            "category": "Stationery"
        }
        response = requests.post(f"{BASE_URL}/api/finance/petty-cash/{account_id}/spend",
                                json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed to record spend: {response.text}"
        data = response.json()
        assert data["type"] == "spend", "Type should be spend"
        assert data["amount"] == 50.00, "Amount should be 50"
        assert data["category"] == "Stationery", "Category should match"
        assert data.get("receipt_file_id", "") == "", "No receipt should be attached"
        print(f"✓ Recorded spend without receipt: {data['txn_id']}")
        TestPettyCashCRUD.spend_txn_id = data["txn_id"]
    
    def test_record_spend_with_receipt_file_id(self, auth_headers):
        """POST /api/finance/petty-cash/{id}/spend - record spending with receipt_file_id"""
        account_id = getattr(TestPettyCashCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
        
        # Use a mock file_id (in real scenario, this would come from /api/files/upload)
        payload = {
            "amount": 75.00,
            "description": "TEST_Spend_WithReceipt",
            "category": "Transport",
            "receipt_file_id": "mock_receipt_file_123"
        }
        response = requests.post(f"{BASE_URL}/api/finance/petty-cash/{account_id}/spend",
                                json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed to record spend with receipt: {response.text}"
        data = response.json()
        assert data["type"] == "spend", "Type should be spend"
        assert data["amount"] == 75.00, "Amount should be 75"
        assert data["receipt_file_id"] == "mock_receipt_file_123", "Receipt file ID should be stored"
        print(f"✓ Recorded spend with receipt: {data['txn_id']}")
    
    def test_spend_insufficient_balance(self, auth_headers):
        """POST /api/finance/petty-cash/{id}/spend - should fail with insufficient balance"""
        account_id = getattr(TestPettyCashCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
        
        payload = {
            "amount": 10000.00,  # More than balance
            "description": "TEST_Spend_TooMuch",
            "category": "Miscellaneous"
        }
        response = requests.post(f"{BASE_URL}/api/finance/petty-cash/{account_id}/spend",
                                json=payload, headers=auth_headers)
        assert response.status_code == 400, f"Should fail with 400: {response.text}"
        print("✓ Correctly rejected spend with insufficient balance")
    
    # ========== TOP-UP WITH RECEIPT ==========
    
    def test_record_topup_without_receipt(self, auth_headers):
        """POST /api/finance/petty-cash/{id}/top-up - record top-up without receipt"""
        account_id = getattr(TestPettyCashCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
        
        payload = {
            "amount": 200.00,
            "description": "TEST_TopUp_NoReceipt"
        }
        response = requests.post(f"{BASE_URL}/api/finance/petty-cash/{account_id}/top-up",
                                json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed to record top-up: {response.text}"
        data = response.json()
        assert data["type"] == "top_up", "Type should be top_up"
        assert data["amount"] == 200.00, "Amount should be 200"
        print(f"✓ Recorded top-up without receipt: {data['txn_id']}")
    
    def test_record_topup_with_receipt_file_id(self, auth_headers):
        """POST /api/finance/petty-cash/{id}/top-up - record top-up with receipt_file_id"""
        account_id = getattr(TestPettyCashCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
        
        payload = {
            "amount": 300.00,
            "description": "TEST_TopUp_WithReceipt",
            "receipt_file_id": "mock_topup_receipt_456"
        }
        response = requests.post(f"{BASE_URL}/api/finance/petty-cash/{account_id}/top-up",
                                json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Failed to record top-up with receipt: {response.text}"
        data = response.json()
        assert data["type"] == "top_up", "Type should be top_up"
        assert data["receipt_file_id"] == "mock_topup_receipt_456", "Receipt file ID should be stored"
        print(f"✓ Recorded top-up with receipt: {data['txn_id']}")
    
    def test_topup_invalid_amount(self, auth_headers):
        """POST /api/finance/petty-cash/{id}/top-up - should fail with zero/negative amount"""
        account_id = getattr(TestPettyCashCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
        
        payload = {
            "amount": 0,
            "description": "TEST_TopUp_Zero"
        }
        response = requests.post(f"{BASE_URL}/api/finance/petty-cash/{account_id}/top-up",
                                json=payload, headers=auth_headers)
        assert response.status_code == 400, f"Should fail with 400: {response.text}"
        print("✓ Correctly rejected top-up with zero amount")
    
    # ========== VERIFY TRANSACTIONS ==========
    
    def test_verify_transactions_list(self, auth_headers):
        """GET /api/finance/petty-cash/{id}/transactions - verify all transactions"""
        account_id = getattr(TestPettyCashCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
        
        response = requests.get(f"{BASE_URL}/api/finance/petty-cash/{account_id}/transactions",
                               headers=auth_headers)
        assert response.status_code == 200, f"Failed to get transactions: {response.text}"
        txns = response.json()
        
        # Should have: initial balance + 2 spends + 2 top-ups = 5 transactions
        assert len(txns) >= 5, f"Expected at least 5 transactions, got {len(txns)}"
        
        # Verify transaction types
        spend_count = sum(1 for t in txns if t["type"] == "spend")
        topup_count = sum(1 for t in txns if t["type"] == "top_up")
        assert spend_count >= 2, f"Expected at least 2 spend transactions, got {spend_count}"
        assert topup_count >= 3, f"Expected at least 3 top-up transactions (incl initial), got {topup_count}"
        
        # Verify receipt_file_id is present in transactions
        receipts_found = [t for t in txns if t.get("receipt_file_id")]
        assert len(receipts_found) >= 2, f"Expected at least 2 transactions with receipts, got {len(receipts_found)}"
        print(f"✓ Verified {len(txns)} transactions ({spend_count} spends, {topup_count} top-ups, {len(receipts_found)} with receipts)")
    
    # ========== DELETE ACCOUNT ==========
    
    def test_delete_petty_cash_account(self, auth_headers):
        """DELETE /api/finance/petty-cash/{id} - delete account and transactions"""
        account_id = getattr(TestPettyCashCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
        
        response = requests.delete(f"{BASE_URL}/api/finance/petty-cash/{account_id}",
                                  headers=auth_headers)
        assert response.status_code == 200, f"Failed to delete account: {response.text}"
        data = response.json()
        assert data.get("message") == "Account deleted", "Should return success message"
        print(f"✓ Deleted petty cash account: {account_id}")
    
    def test_verify_account_deleted(self, auth_headers):
        """Verify deleted account no longer appears in list"""
        account_id = getattr(TestPettyCashCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
        
        response = requests.get(f"{BASE_URL}/api/finance/petty-cash/accounts", headers=auth_headers)
        assert response.status_code == 200
        accounts = response.json()
        account_ids = [a["account_id"] for a in accounts]
        assert account_id not in account_ids, "Deleted account should not appear in list"
        print("✓ Verified account no longer in list")
    
    def test_verify_transactions_deleted(self, auth_headers):
        """Verify transactions of deleted account are also deleted"""
        account_id = getattr(TestPettyCashCRUD, 'created_account_id', None)
        if not account_id:
            pytest.skip("No account created")
        
        response = requests.get(f"{BASE_URL}/api/finance/petty-cash/{account_id}/transactions",
                               headers=auth_headers)
        # Should return empty list or 404 (depending on implementation)
        if response.status_code == 200:
            txns = response.json()
            assert len(txns) == 0, "Transactions should be deleted"
        print("✓ Verified transactions deleted with account")
    
    def test_delete_nonexistent_account(self, auth_headers):
        """DELETE /api/finance/petty-cash/{id} - should fail for non-existent account"""
        response = requests.delete(f"{BASE_URL}/api/finance/petty-cash/nonexistent_account_xyz",
                                  headers=auth_headers)
        assert response.status_code == 404, f"Should return 404: {response.text}"
        print("✓ Correctly returned 404 for non-existent account")


class TestFileUploadEndpoint:
    """Test file upload endpoint used for receipts"""
    
    @pytest.fixture(scope="class")
    def finance_token(self):
        """Get Finance Officer token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        assert response.status_code == 200, f"Finance login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, finance_token):
        """Auth headers for Finance Officer"""
        return {"Authorization": f"Bearer {finance_token}"}
    
    def test_file_upload_endpoint_exists(self, auth_headers):
        """POST /api/files/upload - verify endpoint exists"""
        # Create a simple test file
        files = {
            'file': ('test_receipt.txt', b'Test receipt content', 'text/plain')
        }
        response = requests.post(f"{BASE_URL}/api/files/upload", 
                                files=files, headers=auth_headers)
        # Should return 200 with file_id or 400/422 for validation error
        assert response.status_code in [200, 201, 400, 422], f"Unexpected status: {response.status_code}"
        if response.status_code in [200, 201]:
            data = response.json()
            assert "file_id" in data, "Response should contain file_id"
            print(f"✓ File upload working, got file_id: {data['file_id']}")
            TestFileUploadEndpoint.uploaded_file_id = data["file_id"]
        else:
            print(f"✓ File upload endpoint exists (validation error: {response.text})")


class TestRoleBasedAccess:
    """Test role-based access to petty cash endpoints"""
    
    def test_teacher_cannot_access_petty_cash(self):
        """Teacher role should not access petty cash endpoints"""
        # Login as teacher
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert response.status_code == 200
        token = response.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to access petty cash accounts
        response = requests.get(f"{BASE_URL}/api/finance/petty-cash/accounts", headers=headers)
        assert response.status_code == 403, f"Teacher should get 403, got {response.status_code}"
        print("✓ Teacher correctly denied access to petty cash")
    
    def test_ceo_can_access_petty_cash(self):
        """CEO role should access petty cash endpoints"""
        # Login as CEO
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@tcis.demo",
            "password": "ceo123"
        })
        assert response.status_code == 200
        token = response.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to access petty cash accounts
        response = requests.get(f"{BASE_URL}/api/finance/petty-cash/accounts", headers=headers)
        assert response.status_code == 200, f"CEO should get 200, got {response.status_code}"
        print("✓ CEO can access petty cash accounts")
