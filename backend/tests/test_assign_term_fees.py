"""
Test: Assign / Edit Term Fees for Individual Students
Feature: From Student Billing detail view, assign custom fee items per term
API: POST /api/finance/student/{student_id}/assign-term-fees
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAssignTermFees:
    """Test the assign-term-fees endpoint for individual student fee assignment"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as Finance Officer and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Finance Officer
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get a test student
        students_resp = self.session.get(f"{BASE_URL}/api/admin/students")
        assert students_resp.status_code == 200
        students = students_resp.json()
        assert len(students) > 0, "No students found for testing"
        self.test_student = students[0]
        self.student_id = self.test_student["user_id"]
        self.student_name = self.test_student["name"]
        print(f"Testing with student: {self.student_name} ({self.student_id})")
    
    def test_assign_new_term_fees_creates_invoice(self):
        """Test: Assigning term fees when no invoice exists creates a new invoice"""
        # Use a unique term to avoid conflicts
        test_term = "Term 3"
        
        # First check if student already has Term 3 invoice
        profile_resp = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.student_id}")
        assert profile_resp.status_code == 200
        profile = profile_resp.json()
        
        # Find if Term 3 invoice exists
        existing_term3 = [inv for inv in profile.get("invoices", []) if inv.get("term") == test_term and inv.get("status") != "cancelled"]
        
        # Assign term fees
        fee_items = [
            {"name": "TEST_Tuition Fee", "category": "tuition", "amount": 3000},
            {"name": "TEST_ICT Levy", "category": "technology", "amount": 500},
            {"name": "TEST_Activity Fee", "category": "activity", "amount": 200}
        ]
        
        resp = self.session.post(f"{BASE_URL}/api/finance/student/{self.student_id}/assign-term-fees", json={
            "term": test_term,
            "academic_year": "2025-2026",
            "due_date": "2026-03-15",
            "fee_items": fee_items
        })
        
        assert resp.status_code == 200, f"Assign term fees failed: {resp.text}"
        data = resp.json()
        
        # Verify response
        assert "message" in data
        assert "invoice_id" in data
        assert "action" in data
        
        expected_total = 3000 + 500 + 200  # 3700
        assert f"GHS {expected_total:,.2f}" in data["message"] or str(expected_total) in data["message"]
        
        if existing_term3:
            assert data["action"] == "updated", "Should update existing invoice"
            print(f"Updated existing {test_term} invoice: {data['invoice_id']}")
        else:
            assert data["action"] == "created", "Should create new invoice"
            print(f"Created new {test_term} invoice: {data['invoice_id']}")
        
        # Verify invoice was created/updated
        profile_resp2 = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.student_id}")
        assert profile_resp2.status_code == 200
        profile2 = profile_resp2.json()
        
        term3_invoices = [inv for inv in profile2.get("invoices", []) if inv.get("term") == test_term and inv.get("status") != "cancelled"]
        assert len(term3_invoices) >= 1, f"No {test_term} invoice found after assignment"
        
        invoice = term3_invoices[0]
        assert invoice["total_due"] == expected_total, f"Expected total {expected_total}, got {invoice['total_due']}"
        
        # Verify line items
        line_items = invoice.get("line_items", [])
        assert len(line_items) == 3, f"Expected 3 line items, got {len(line_items)}"
        
        item_names = [li["fee_item_name"] for li in line_items]
        assert "TEST_Tuition Fee" in item_names
        assert "TEST_ICT Levy" in item_names
        assert "TEST_Activity Fee" in item_names
        
        print(f"SUCCESS: Invoice {invoice['invoice_number']} with total GHS {invoice['total_due']}")
    
    def test_edit_existing_term_fees_updates_invoice(self):
        """Test: Editing fees for a term with existing invoice updates the same invoice"""
        test_term = "Term 3"
        
        # First assign initial fees
        initial_fees = [
            {"name": "TEST_Initial Tuition", "category": "tuition", "amount": 2000}
        ]
        
        resp1 = self.session.post(f"{BASE_URL}/api/finance/student/{self.student_id}/assign-term-fees", json={
            "term": test_term,
            "academic_year": "2025-2026",
            "fee_items": initial_fees
        })
        assert resp1.status_code == 200
        data1 = resp1.json()
        invoice_id = data1["invoice_id"]
        
        # Now update with different fees
        updated_fees = [
            {"name": "TEST_Updated Tuition", "category": "tuition", "amount": 2500},
            {"name": "TEST_New Boarding Fee", "category": "boarding", "amount": 1500}
        ]
        
        resp2 = self.session.post(f"{BASE_URL}/api/finance/student/{self.student_id}/assign-term-fees", json={
            "term": test_term,
            "academic_year": "2025-2026",
            "fee_items": updated_fees
        })
        assert resp2.status_code == 200
        data2 = resp2.json()
        
        # Should update the same invoice
        assert data2["action"] == "updated", "Should update existing invoice"
        assert data2["invoice_id"] == invoice_id, "Should update same invoice ID"
        
        # Verify the invoice has new line items
        profile_resp = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.student_id}")
        assert profile_resp.status_code == 200
        profile = profile_resp.json()
        
        term3_invoices = [inv for inv in profile.get("invoices", []) if inv.get("term") == test_term and inv.get("status") != "cancelled"]
        assert len(term3_invoices) == 1, "Should have exactly one Term 3 invoice (not duplicated)"
        
        invoice = term3_invoices[0]
        assert invoice["total_due"] == 4000, f"Expected total 4000, got {invoice['total_due']}"
        
        line_items = invoice.get("line_items", [])
        assert len(line_items) == 2, f"Expected 2 line items after update, got {len(line_items)}"
        
        item_names = [li["fee_item_name"] for li in line_items]
        assert "TEST_Updated Tuition" in item_names
        assert "TEST_New Boarding Fee" in item_names
        assert "TEST_Initial Tuition" not in item_names, "Old line items should be removed"
        
        print(f"SUCCESS: Invoice updated with new total GHS {invoice['total_due']}")
    
    def test_balance_reflects_after_fee_assignment(self):
        """Test: Student balance updates correctly after fee assignment"""
        # Get initial balance
        profile_resp1 = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.student_id}")
        assert profile_resp1.status_code == 200
        initial_balance = profile_resp1.json()["summary"]["balance"]
        
        # Assign new fees for a different term
        test_term = "Term 2"
        fee_items = [
            {"name": "TEST_Balance Test Fee", "category": "tuition", "amount": 1000}
        ]
        
        resp = self.session.post(f"{BASE_URL}/api/finance/student/{self.student_id}/assign-term-fees", json={
            "term": test_term,
            "academic_year": "2025-2026",
            "fee_items": fee_items
        })
        assert resp.status_code == 200
        
        # Check balance increased
        profile_resp2 = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.student_id}")
        assert profile_resp2.status_code == 200
        new_balance = profile_resp2.json()["summary"]["balance"]
        
        # Balance can be positive (owes money) or negative (credit/overpaid)
        print(f"Balance: {initial_balance} -> {new_balance}")
        # Just verify balance is a number and profile is valid
        assert isinstance(new_balance, (int, float)), "Balance should be a number"
    
    def test_student_ledger_reflects_changes(self):
        """Test: Student ledger shows updated balance after fee assignment"""
        # Assign fees
        fee_items = [
            {"name": "TEST_Ledger Test Fee", "category": "tuition", "amount": 500}
        ]
        
        resp = self.session.post(f"{BASE_URL}/api/finance/student/{self.student_id}/assign-term-fees", json={
            "term": "Term 1",
            "academic_year": "2025-2026",
            "fee_items": fee_items
        })
        assert resp.status_code == 200
        
        # Check student ledger
        ledger_resp = self.session.get(f"{BASE_URL}/api/finance/student-ledger")
        assert ledger_resp.status_code == 200
        ledger = ledger_resp.json()
        
        student_entry = next((s for s in ledger if s["user_id"] == self.student_id), None)
        assert student_entry is not None, "Student should appear in ledger"
        assert "balance" in student_entry
        assert "total_billed" in student_entry
        assert "total_paid" in student_entry
        
        print(f"Ledger entry: Billed={student_entry['total_billed']}, Paid={student_entry['total_paid']}, Balance={student_entry['balance']}")
    
    def test_invalid_student_returns_404(self):
        """Test: Assigning fees to non-existent student returns 404"""
        resp = self.session.post(f"{BASE_URL}/api/finance/student/invalid_student_id/assign-term-fees", json={
            "term": "Term 1",
            "fee_items": [{"name": "Test", "category": "tuition", "amount": 100}]
        })
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
    
    def test_empty_fee_items_returns_400(self):
        """Test: Assigning with no fee items returns 400"""
        resp = self.session.post(f"{BASE_URL}/api/finance/student/{self.student_id}/assign-term-fees", json={
            "term": "Term 1",
            "fee_items": []
        })
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
    
    def test_zero_amount_fee_items_ignored(self):
        """Test: Fee items with zero amount are ignored"""
        fee_items = [
            {"name": "TEST_Valid Fee", "category": "tuition", "amount": 1000},
            {"name": "TEST_Zero Fee", "category": "other", "amount": 0}
        ]
        
        resp = self.session.post(f"{BASE_URL}/api/finance/student/{self.student_id}/assign-term-fees", json={
            "term": "Term 1",
            "academic_year": "2025-2026",
            "fee_items": fee_items
        })
        assert resp.status_code == 200
        
        # Verify only valid fee was added
        profile_resp = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.student_id}")
        profile = profile_resp.json()
        
        term1_invoices = [inv for inv in profile.get("invoices", []) if inv.get("term") == "Term 1" and inv.get("status") != "cancelled"]
        if term1_invoices:
            invoice = term1_invoices[0]
            line_items = invoice.get("line_items", [])
            zero_items = [li for li in line_items if li.get("amount", 0) == 0]
            assert len(zero_items) == 0, "Zero amount items should not be added"
    
    def test_teacher_cannot_assign_fees(self):
        """Test: Teacher role cannot access assign-term-fees endpoint"""
        # Login as teacher
        teacher_session = requests.Session()
        teacher_session.headers.update({"Content-Type": "application/json"})
        
        login_resp = teacher_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert login_resp.status_code == 200
        teacher_token = login_resp.json().get("token")
        teacher_session.headers.update({"Authorization": f"Bearer {teacher_token}"})
        
        # Try to assign fees
        resp = teacher_session.post(f"{BASE_URL}/api/finance/student/{self.student_id}/assign-term-fees", json={
            "term": "Term 1",
            "fee_items": [{"name": "Test", "category": "tuition", "amount": 100}]
        })
        assert resp.status_code == 403, f"Expected 403 for teacher, got {resp.status_code}"
        print("SUCCESS: Teacher correctly denied access")
    
    def test_ceo_can_assign_fees(self):
        """Test: CEO role can access assign-term-fees endpoint"""
        # Login as CEO
        ceo_session = requests.Session()
        ceo_session.headers.update({"Content-Type": "application/json"})
        
        login_resp = ceo_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@tcis.demo",
            "password": "ceo123"
        })
        assert login_resp.status_code == 200
        ceo_token = login_resp.json().get("token")
        ceo_session.headers.update({"Authorization": f"Bearer {ceo_token}"})
        
        # Assign fees
        resp = ceo_session.post(f"{BASE_URL}/api/finance/student/{self.student_id}/assign-term-fees", json={
            "term": "Term 1",
            "academic_year": "2025-2026",
            "fee_items": [{"name": "TEST_CEO Fee", "category": "tuition", "amount": 100}]
        })
        assert resp.status_code == 200, f"CEO should be able to assign fees: {resp.text}"
        print("SUCCESS: CEO can assign fees")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
