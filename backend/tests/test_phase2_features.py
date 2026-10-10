"""
TCIS LMS Phase 2 Features Test Suite
Tests for:
- Working Paper: Sign, Watermark, Expiry endpoints
- Finance: Payroll and Reports endpoints
- Messenger: Scheduled messages endpoints
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_EMAIL = "ceo@tcis.demo"
CEO_PASSWORD = "ceo123"
FINANCE_EMAIL = "finance@tcis.demo"
FINANCE_PASSWORD = "finance123"


class TestAuth:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def finance_token(self):
        """Get Finance auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": FINANCE_EMAIL,
            "password": FINANCE_PASSWORD
        })
        assert response.status_code == 200, f"Finance login failed: {response.text}"
        return response.json().get("token")
    
    def test_ceo_login(self):
        """Test CEO can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"CEO login successful: {data['user']['name']}")


class TestWorkingPaperPhase2:
    """Working Paper Phase 2: Sign, Watermark, Expiry"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for CEO"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_document(self, auth_headers):
        """Create a test document for Phase 2 tests"""
        # First get a folder
        folders_resp = requests.get(f"{BASE_URL}/api/wp/folders", headers=auth_headers)
        if folders_resp.status_code == 200 and folders_resp.json():
            folder_id = folders_resp.json()[0].get("folder_id")
        else:
            # Create a folder
            folder_resp = requests.post(f"{BASE_URL}/api/wp/folders", headers=auth_headers, json={
                "name": "TEST_Phase2_Folder",
                "description": "Test folder for Phase 2"
            })
            folder_id = folder_resp.json().get("folder_id")
        
        # Create a document
        doc_resp = requests.post(f"{BASE_URL}/api/wp/documents", headers=auth_headers, json={
            "folder_id": folder_id,
            "title": "TEST_Phase2_Document",
            "description": "Test document for Phase 2 features",
            "content": "Test content for signing, watermarking, and expiry"
        })
        assert doc_resp.status_code in [200, 201], f"Failed to create document: {doc_resp.text}"
        doc = doc_resp.json()
        print(f"Created test document: {doc.get('document_id')}")
        yield doc
        
        # Cleanup - delete the document
        requests.delete(f"{BASE_URL}/api/wp/documents/{doc.get('document_id')}", headers=auth_headers)
    
    def test_sign_document(self, auth_headers, test_document):
        """Test POST /api/wp/documents/{doc_id}/sign"""
        doc_id = test_document.get("document_id")
        response = requests.post(f"{BASE_URL}/api/wp/documents/{doc_id}/sign", headers=auth_headers, json={
            "reason": "Reviewed and approved",
            "designation": "CEO"
        })
        assert response.status_code == 200, f"Sign failed: {response.text}"
        data = response.json()
        assert "sig_hash" in data, "Response should contain sig_hash"
        assert "sig_id" in data, "Response should contain sig_id"
        print(f"Document signed successfully: sig_hash={data['sig_hash']}")
    
    def test_get_signatures(self, auth_headers, test_document):
        """Test GET /api/wp/documents/{doc_id}/signatures"""
        doc_id = test_document.get("document_id")
        response = requests.get(f"{BASE_URL}/api/wp/documents/{doc_id}/signatures", headers=auth_headers)
        assert response.status_code == 200, f"Get signatures failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} signatures")
    
    def test_verify_signature(self, auth_headers, test_document):
        """Test POST /api/wp/documents/{doc_id}/verify-signature"""
        doc_id = test_document.get("document_id")
        # First sign the document
        sign_resp = requests.post(f"{BASE_URL}/api/wp/documents/{doc_id}/sign", headers=auth_headers, json={
            "reason": "Verification test",
            "designation": "CEO"
        })
        sig_hash = sign_resp.json().get("sig_hash", "")
        
        # Verify the signature
        response = requests.post(f"{BASE_URL}/api/wp/documents/{doc_id}/verify-signature", headers=auth_headers, json={
            "sig_hash": sig_hash
        })
        assert response.status_code == 200, f"Verify signature failed: {response.text}"
        data = response.json()
        assert data.get("valid") == True, "Signature should be valid"
        print(f"Signature verified: signer={data.get('signer')}")
    
    def test_set_watermark_confidential(self, auth_headers, test_document):
        """Test PUT /api/wp/documents/{doc_id}/watermark - CONFIDENTIAL"""
        doc_id = test_document.get("document_id")
        response = requests.put(f"{BASE_URL}/api/wp/documents/{doc_id}/watermark", headers=auth_headers, json={
            "watermark": "CONFIDENTIAL"
        })
        assert response.status_code == 200, f"Set watermark failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"Watermark set: {data['message']}")
    
    def test_set_watermark_draft(self, auth_headers, test_document):
        """Test PUT /api/wp/documents/{doc_id}/watermark - DRAFT"""
        doc_id = test_document.get("document_id")
        response = requests.put(f"{BASE_URL}/api/wp/documents/{doc_id}/watermark", headers=auth_headers, json={
            "watermark": "DRAFT"
        })
        assert response.status_code == 200
        print("Watermark DRAFT set successfully")
    
    def test_set_watermark_approved(self, auth_headers, test_document):
        """Test PUT /api/wp/documents/{doc_id}/watermark - APPROVED"""
        doc_id = test_document.get("document_id")
        response = requests.put(f"{BASE_URL}/api/wp/documents/{doc_id}/watermark", headers=auth_headers, json={
            "watermark": "APPROVED"
        })
        assert response.status_code == 200
        print("Watermark APPROVED set successfully")
    
    def test_set_watermark_invalid(self, auth_headers, test_document):
        """Test PUT /api/wp/documents/{doc_id}/watermark - Invalid watermark"""
        doc_id = test_document.get("document_id")
        response = requests.put(f"{BASE_URL}/api/wp/documents/{doc_id}/watermark", headers=auth_headers, json={
            "watermark": "INVALID_WATERMARK"
        })
        assert response.status_code == 400, "Invalid watermark should return 400"
        print("Invalid watermark correctly rejected")
    
    def test_remove_watermark(self, auth_headers, test_document):
        """Test PUT /api/wp/documents/{doc_id}/watermark - Remove"""
        doc_id = test_document.get("document_id")
        response = requests.put(f"{BASE_URL}/api/wp/documents/{doc_id}/watermark", headers=auth_headers, json={
            "watermark": ""
        })
        assert response.status_code == 200
        print("Watermark removed successfully")
    
    def test_set_expiry(self, auth_headers, test_document):
        """Test PUT /api/wp/documents/{doc_id}/expiry"""
        doc_id = test_document.get("document_id")
        future_date = (datetime.now() + timedelta(days=30)).isoformat()
        response = requests.put(f"{BASE_URL}/api/wp/documents/{doc_id}/expiry", headers=auth_headers, json={
            "expires_at": future_date,
            "reminder_days": 7,
            "auto_archive": True
        })
        assert response.status_code == 200, f"Set expiry failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"Expiry set: {data['message']}")
    
    def test_remove_expiry(self, auth_headers, test_document):
        """Test PUT /api/wp/documents/{doc_id}/expiry - Remove"""
        doc_id = test_document.get("document_id")
        response = requests.put(f"{BASE_URL}/api/wp/documents/{doc_id}/expiry", headers=auth_headers, json={
            "expires_at": "",
            "reminder_days": 0,
            "auto_archive": False
        })
        assert response.status_code == 200
        print("Expiry removed successfully")
    
    def test_get_expiring_documents(self, auth_headers):
        """Test GET /api/wp/expiring-documents"""
        response = requests.get(f"{BASE_URL}/api/wp/expiring-documents", headers=auth_headers, params={"days": 30})
        assert response.status_code == 200, f"Get expiring docs failed: {response.text}"
        data = response.json()
        assert "expired" in data
        assert "expiring_soon" in data
        assert "total" in data
        print(f"Expiring documents: {data['total']} total")


class TestFinancePayroll:
    """Finance Phase 2: Payroll endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for CEO (has payroll access)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_staff_records(self, auth_headers):
        """Test GET /api/finance/payroll/staff-records"""
        response = requests.get(f"{BASE_URL}/api/finance/payroll/staff-records", headers=auth_headers)
        assert response.status_code == 200, f"Get staff records failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} payroll staff records")
    
    def test_create_staff_record(self, auth_headers):
        """Test POST /api/finance/payroll/staff-records"""
        # Get a staff member
        staff_resp = requests.get(f"{BASE_URL}/api/admin/staff", headers=auth_headers)
        if staff_resp.status_code == 200 and staff_resp.json():
            staff = staff_resp.json()[0]
            staff_id = staff.get("user_id")
            staff_name = staff.get("name")
        else:
            pytest.skip("No staff available for payroll test")
        
        response = requests.post(f"{BASE_URL}/api/finance/payroll/staff-records", headers=auth_headers, json={
            "staff_id": f"TEST_{staff_id}",
            "staff_name": f"TEST_{staff_name}",
            "department": "Administration",
            "role": "Test Role",
            "basic_salary": 5000,
            "housing_allowance": 500,
            "transport_allowance": 300,
            "other_allowance": 200,
            "tax_deduction": 500,
            "pension_deduction": 250,
            "other_deduction": 50,
            "bank_name": "Test Bank",
            "account_number": "1234567890"
        })
        # May fail if record already exists
        if response.status_code in [200, 201]:
            data = response.json()
            assert "record_id" in data
            print(f"Created payroll record: {data.get('record_id')}")
        else:
            print(f"Payroll record creation returned {response.status_code}: {response.text}")
    
    def test_get_payroll_runs(self, auth_headers):
        """Test GET /api/finance/payroll/runs"""
        response = requests.get(f"{BASE_URL}/api/finance/payroll/runs", headers=auth_headers)
        assert response.status_code == 200, f"Get payroll runs failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} payroll runs")


class TestFinanceReports:
    """Finance Phase 2: Reports endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for CEO"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_financial_summary(self, auth_headers):
        """Test GET /api/finance/reports/financial-summary"""
        response = requests.get(f"{BASE_URL}/api/finance/reports/financial-summary", headers=auth_headers)
        assert response.status_code == 200, f"Financial summary failed: {response.text}"
        data = response.json()
        assert "all_time_invoiced" in data
        assert "all_time_collected" in data
        assert "all_time_expenses" in data
        assert "month_income" in data
        assert "month_expenses" in data
        assert "monthly_payroll" in data
        assert "total_staff_on_payroll" in data
        print(f"Financial summary: invoiced={data['all_time_invoiced']}, collected={data['all_time_collected']}")
    
    def test_income_expense_report(self, auth_headers):
        """Test GET /api/finance/reports/income-expense"""
        response = requests.get(f"{BASE_URL}/api/finance/reports/income-expense", headers=auth_headers, params={"period": "month"})
        assert response.status_code == 200, f"Income-expense report failed: {response.text}"
        data = response.json()
        assert "period" in data
        assert "total_income" in data
        assert "total_expenses" in data
        assert "net_position" in data
        assert "income_by_method" in data
        assert "expenses_by_category" in data
        print(f"Income-expense report: income={data['total_income']}, expenses={data['total_expenses']}, net={data['net_position']}")
    
    def test_department_summary(self, auth_headers):
        """Test GET /api/finance/reports/department-summary"""
        response = requests.get(f"{BASE_URL}/api/finance/reports/department-summary", headers=auth_headers)
        assert response.status_code == 200, f"Department summary failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Department summary: {len(data)} departments")


class TestMessengerScheduledMessages:
    """Messenger Phase 2: Scheduled messages endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for CEO"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_chat(self, auth_headers):
        """Get or create a test chat"""
        # Get existing chats
        chats_resp = requests.get(f"{BASE_URL}/api/chat/chats", headers=auth_headers)
        if chats_resp.status_code == 200 and chats_resp.json():
            chat = chats_resp.json()[0]
            print(f"Using existing chat: {chat.get('chat_id')}")
            return chat
        
        # Create a new private chat
        contacts_resp = requests.get(f"{BASE_URL}/api/chat/contacts", headers=auth_headers)
        if contacts_resp.status_code == 200 and contacts_resp.json():
            contact = contacts_resp.json()[0]
            create_resp = requests.post(f"{BASE_URL}/api/chat/private", headers=auth_headers, json={
                "user_id": contact.get("user_id")
            })
            if create_resp.status_code in [200, 201]:
                return create_resp.json()
        
        pytest.skip("No chat available for scheduled message test")
    
    def test_schedule_message(self, auth_headers, test_chat):
        """Test POST /api/chat/{chat_id}/schedule-message"""
        chat_id = test_chat.get("chat_id")
        future_time = (datetime.now() + timedelta(hours=1)).isoformat()
        
        response = requests.post(f"{BASE_URL}/api/chat/{chat_id}/schedule-message", headers=auth_headers, json={
            "content": "TEST_Scheduled message for testing",
            "scheduled_for": future_time
        })
        assert response.status_code == 200, f"Schedule message failed: {response.text}"
        data = response.json()
        assert "scheduled_id" in data
        assert data.get("status") == "pending"
        print(f"Scheduled message created: {data.get('scheduled_id')}")
        return data
    
    def test_list_scheduled_messages(self, auth_headers, test_chat):
        """Test GET /api/chat/{chat_id}/scheduled-messages"""
        chat_id = test_chat.get("chat_id")
        response = requests.get(f"{BASE_URL}/api/chat/{chat_id}/scheduled-messages", headers=auth_headers)
        assert response.status_code == 200, f"List scheduled messages failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} scheduled messages")
    
    def test_cancel_scheduled_message(self, auth_headers, test_chat):
        """Test DELETE /api/chat/scheduled/{scheduled_id}"""
        chat_id = test_chat.get("chat_id")
        
        # First create a scheduled message
        future_time = (datetime.now() + timedelta(hours=2)).isoformat()
        create_resp = requests.post(f"{BASE_URL}/api/chat/{chat_id}/schedule-message", headers=auth_headers, json={
            "content": "TEST_Message to cancel",
            "scheduled_for": future_time
        })
        
        if create_resp.status_code == 200:
            scheduled_id = create_resp.json().get("scheduled_id")
            
            # Cancel it
            response = requests.delete(f"{BASE_URL}/api/chat/scheduled/{scheduled_id}", headers=auth_headers)
            assert response.status_code == 200, f"Cancel scheduled message failed: {response.text}"
            print(f"Cancelled scheduled message: {scheduled_id}")
        else:
            pytest.skip("Could not create scheduled message to cancel")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
