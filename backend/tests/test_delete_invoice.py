"""
Test DELETE /api/finance/invoices/{invoice_id} endpoint
Tests invoice deletion with payment allocation restoration
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDeleteInvoice:
    """Tests for DELETE /api/finance/invoices/{invoice_id} endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as Finance Officer and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Finance Officer
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        assert login_resp.status_code == 200, f"Finance login failed: {login_resp.text}"
        self.token = login_resp.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get a student for testing
        students_resp = self.session.get(f"{BASE_URL}/api/admin/students")
        assert students_resp.status_code == 200
        students = students_resp.json()
        assert len(students) > 0, "No students found for testing"
        self.test_student = students[0]
        self.student_id = self.test_student["user_id"]
        
    def test_delete_invoice_success(self):
        """Test deleting an invoice successfully"""
        # Create a test invoice
        create_resp = self.session.post(f"{BASE_URL}/api/finance/invoices", json={
            "student_id": self.student_id,
            "term": "Term 3",
            "academic_year": "2025-2026",
            "due_at": "2026-03-31",
            "items": [
                {"name": "TEST_DELETE Tuition", "code": "TUI", "category": "tuition", "amount": 1000},
                {"name": "TEST_DELETE Books", "code": "BKS", "category": "books", "amount": 200}
            ]
        })
        assert create_resp.status_code == 200, f"Create invoice failed: {create_resp.text}"
        invoice = create_resp.json()
        invoice_id = invoice["invoice_id"]
        
        # Delete the invoice
        delete_resp = self.session.delete(f"{BASE_URL}/api/finance/invoices/{invoice_id}")
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
        data = delete_resp.json()
        assert "deleted" in data.get("message", "").lower() or "Invoice" in data.get("message", "")
        
        # Verify invoice no longer exists
        invoices_resp = self.session.get(f"{BASE_URL}/api/finance/invoices?student_id={self.student_id}")
        assert invoices_resp.status_code == 200
        invoices = invoices_resp.json()
        invoice_ids = [inv["invoice_id"] for inv in invoices]
        assert invoice_id not in invoice_ids, "Invoice should be deleted"
        
    def test_delete_invoice_with_payment_restores_unallocated(self):
        """Test that deleting invoice restores unallocated amount on associated payments"""
        # Create invoice
        create_inv_resp = self.session.post(f"{BASE_URL}/api/finance/invoices", json={
            "student_id": self.student_id,
            "term": "Term 3",
            "academic_year": "2025-2026",
            "items": [{"name": "TEST_DELETE_PAY Fee", "code": "TDP", "category": "tuition", "amount": 500}]
        })
        assert create_inv_resp.status_code == 200
        invoice = create_inv_resp.json()
        invoice_id = invoice["invoice_id"]
        
        # Record a payment (auto-allocates)
        pay_resp = self.session.post(f"{BASE_URL}/api/finance/payments", json={
            "student_id": self.student_id,
            "amount": 300,
            "method": "cash",
            "reference": "TEST_DELETE_PAY_REF"
        })
        assert pay_resp.status_code == 200
        payment = pay_resp.json()
        payment_id = payment["payment_id"]
        
        # Verify payment was allocated (unallocated should be 0 or less than 300)
        payments_resp = self.session.get(f"{BASE_URL}/api/finance/payments?student_id={self.student_id}")
        assert payments_resp.status_code == 200
        payments = payments_resp.json()
        test_payment = next((p for p in payments if p["payment_id"] == payment_id), None)
        assert test_payment is not None
        initial_unallocated = test_payment.get("unallocated_amount", 0)
        
        # Delete the invoice
        delete_resp = self.session.delete(f"{BASE_URL}/api/finance/invoices/{invoice_id}")
        assert delete_resp.status_code == 200
        
        # Verify payment's unallocated amount is restored
        payments_resp2 = self.session.get(f"{BASE_URL}/api/finance/payments?student_id={self.student_id}")
        assert payments_resp2.status_code == 200
        payments2 = payments_resp2.json()
        test_payment2 = next((p for p in payments2 if p["payment_id"] == payment_id), None)
        assert test_payment2 is not None
        # After deletion, unallocated should be restored (300 - initial_unallocated should be added back)
        assert test_payment2.get("unallocated_amount", 0) >= initial_unallocated, \
            f"Unallocated should be restored. Was {initial_unallocated}, now {test_payment2.get('unallocated_amount')}"
        
    def test_delete_invoice_recalculates_balance(self):
        """Test that deleting invoice recalculates student balance"""
        # Get initial balance
        profile_resp = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.student_id}")
        assert profile_resp.status_code == 200
        initial_balance = profile_resp.json()["summary"]["balance"]
        
        # Create invoice
        create_resp = self.session.post(f"{BASE_URL}/api/finance/invoices", json={
            "student_id": self.student_id,
            "term": "Term 3",
            "academic_year": "2025-2026",
            "items": [{"name": "TEST_DELETE_BAL Fee", "code": "TDB", "category": "tuition", "amount": 750}]
        })
        assert create_resp.status_code == 200
        invoice = create_resp.json()
        invoice_id = invoice["invoice_id"]
        
        # Verify balance increased
        profile_resp2 = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.student_id}")
        assert profile_resp2.status_code == 200
        balance_after_create = profile_resp2.json()["summary"]["balance"]
        assert balance_after_create >= initial_balance + 750, \
            f"Balance should increase by 750. Was {initial_balance}, now {balance_after_create}"
        
        # Delete invoice
        delete_resp = self.session.delete(f"{BASE_URL}/api/finance/invoices/{invoice_id}")
        assert delete_resp.status_code == 200
        
        # Verify balance decreased back
        profile_resp3 = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.student_id}")
        assert profile_resp3.status_code == 200
        balance_after_delete = profile_resp3.json()["summary"]["balance"]
        # Balance should be close to initial (within 1 GHS tolerance for rounding)
        assert abs(balance_after_delete - initial_balance) < 1, \
            f"Balance should return to ~{initial_balance}. Was {balance_after_create}, now {balance_after_delete}"
        
    def test_delete_invoice_invalid_id_returns_404(self):
        """Test that deleting non-existent invoice returns 404"""
        delete_resp = self.session.delete(f"{BASE_URL}/api/finance/invoices/inv_nonexistent_12345")
        assert delete_resp.status_code == 404, f"Expected 404, got {delete_resp.status_code}"
        
    def test_delete_invoice_teacher_forbidden(self):
        """Test that Teacher role cannot delete invoices (403)"""
        # Login as Teacher
        teacher_session = requests.Session()
        teacher_session.headers.update({"Content-Type": "application/json"})
        login_resp = teacher_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert login_resp.status_code == 200, f"Teacher login failed: {login_resp.text}"
        teacher_token = login_resp.json().get("token")
        teacher_session.headers.update({"Authorization": f"Bearer {teacher_token}"})
        
        # Try to delete an invoice (should fail)
        delete_resp = teacher_session.delete(f"{BASE_URL}/api/finance/invoices/inv_any_id")
        assert delete_resp.status_code == 403, f"Expected 403 for Teacher, got {delete_resp.status_code}"
        
    def test_delete_invoice_removes_line_items(self):
        """Test that deleting invoice also removes its line items"""
        # Create invoice with multiple line items
        create_resp = self.session.post(f"{BASE_URL}/api/finance/invoices", json={
            "student_id": self.student_id,
            "term": "Term 3",
            "academic_year": "2025-2026",
            "items": [
                {"name": "TEST_DELETE_LI Tuition", "code": "TDL1", "category": "tuition", "amount": 1000},
                {"name": "TEST_DELETE_LI Boarding", "code": "TDL2", "category": "boarding", "amount": 500},
                {"name": "TEST_DELETE_LI Transport", "code": "TDL3", "category": "transport", "amount": 200}
            ]
        })
        assert create_resp.status_code == 200
        invoice = create_resp.json()
        invoice_id = invoice["invoice_id"]
        
        # Verify line items exist via student profile
        profile_resp = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.student_id}")
        assert profile_resp.status_code == 200
        invoices = profile_resp.json()["invoices"]
        test_inv = next((inv for inv in invoices if inv["invoice_id"] == invoice_id), None)
        assert test_inv is not None
        assert len(test_inv.get("line_items", [])) == 3, "Should have 3 line items"
        
        # Delete invoice
        delete_resp = self.session.delete(f"{BASE_URL}/api/finance/invoices/{invoice_id}")
        assert delete_resp.status_code == 200
        
        # Verify invoice and line items are gone
        profile_resp2 = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.student_id}")
        assert profile_resp2.status_code == 200
        invoices2 = profile_resp2.json()["invoices"]
        test_inv2 = next((inv for inv in invoices2 if inv["invoice_id"] == invoice_id), None)
        assert test_inv2 is None, "Invoice should be deleted"
        
    def test_delete_invoice_removes_allocations(self):
        """Test that deleting invoice removes associated allocations"""
        # Create invoice
        create_resp = self.session.post(f"{BASE_URL}/api/finance/invoices", json={
            "student_id": self.student_id,
            "term": "Term 3",
            "academic_year": "2025-2026",
            "items": [{"name": "TEST_DELETE_ALLOC Fee", "code": "TDA", "category": "tuition", "amount": 400}]
        })
        assert create_resp.status_code == 200
        invoice = create_resp.json()
        invoice_id = invoice["invoice_id"]
        
        # Record payment to create allocation
        pay_resp = self.session.post(f"{BASE_URL}/api/finance/payments", json={
            "student_id": self.student_id,
            "amount": 200,
            "method": "momo",
            "reference": "TEST_DELETE_ALLOC_REF"
        })
        assert pay_resp.status_code == 200
        
        # Verify allocation exists
        allocs_resp = self.session.get(f"{BASE_URL}/api/finance/allocations?invoice_id={invoice_id}")
        assert allocs_resp.status_code == 200
        allocs = allocs_resp.json()
        assert len(allocs) > 0, "Should have allocations"
        
        # Delete invoice
        delete_resp = self.session.delete(f"{BASE_URL}/api/finance/invoices/{invoice_id}")
        assert delete_resp.status_code == 200
        
        # Verify allocations are removed
        allocs_resp2 = self.session.get(f"{BASE_URL}/api/finance/allocations?invoice_id={invoice_id}")
        assert allocs_resp2.status_code == 200
        allocs2 = allocs_resp2.json()
        assert len(allocs2) == 0, "Allocations should be deleted"


class TestEditFeesStillWorks:
    """Verify edit fees functionality still works (replace by editing)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as Finance Officer"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        students_resp = self.session.get(f"{BASE_URL}/api/admin/students")
        assert students_resp.status_code == 200
        students = students_resp.json()
        self.test_student = students[0]
        self.student_id = self.test_student["user_id"]
        
    def test_assign_term_fees_creates_invoice(self):
        """Test assign-term-fees endpoint creates invoice (for replace functionality)"""
        resp = self.session.post(f"{BASE_URL}/api/finance/student/{self.student_id}/assign-term-fees", json={
            "term": "Term 3",
            "academic_year": "2025-2026",
            "due_date": "2026-04-15",
            "fee_items": [
                {"name": "TEST_EDIT Tuition", "category": "tuition", "amount": 2000},
                {"name": "TEST_EDIT Activity", "category": "activity", "amount": 300}
            ]
        })
        assert resp.status_code == 200, f"Assign term fees failed: {resp.text}"
        data = resp.json()
        assert "invoice_id" in data
        assert data.get("action") in ["created", "updated"]
        
    def test_assign_term_fees_updates_existing(self):
        """Test assign-term-fees updates existing invoice (replace functionality)"""
        # Create initial invoice
        resp1 = self.session.post(f"{BASE_URL}/api/finance/student/{self.student_id}/assign-term-fees", json={
            "term": "Term 3",
            "academic_year": "2025-2026",
            "fee_items": [{"name": "TEST_EDIT_UPD Initial", "category": "tuition", "amount": 1000}]
        })
        assert resp1.status_code == 200
        invoice_id = resp1.json()["invoice_id"]
        
        # Update with new fees (replace)
        resp2 = self.session.post(f"{BASE_URL}/api/finance/student/{self.student_id}/assign-term-fees", json={
            "term": "Term 3",
            "academic_year": "2025-2026",
            "fee_items": [
                {"name": "TEST_EDIT_UPD Replaced Tuition", "category": "tuition", "amount": 1500},
                {"name": "TEST_EDIT_UPD New Fee", "category": "other", "amount": 250}
            ]
        })
        assert resp2.status_code == 200
        data = resp2.json()
        assert data.get("action") == "updated", "Should update existing invoice"
        assert data["invoice_id"] == invoice_id, "Should be same invoice"
        
        # Verify new fees
        profile_resp = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.student_id}")
        assert profile_resp.status_code == 200
        invoices = profile_resp.json()["invoices"]
        test_inv = next((inv for inv in invoices if inv["invoice_id"] == invoice_id), None)
        assert test_inv is not None
        assert test_inv["total_due"] == 1750, f"Total should be 1750, got {test_inv['total_due']}"
        assert len(test_inv.get("line_items", [])) == 2, "Should have 2 line items"
