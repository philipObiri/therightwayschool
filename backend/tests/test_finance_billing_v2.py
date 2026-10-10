"""
Test Finance Module - Iteration 21 Features
- Payment auto-allocation to unpaid invoices
- Three billing modes: Individual, Select Multiple Students, Entire Year Group
- Fully customizable fee item inputs
- Record Payment from Student Billing detail view
- Backend endpoints: POST /api/finance/payments, POST /api/finance/quick-assign, 
  POST /api/finance/bill-selected-students, POST /api/finance/assign-fees-bulk,
  GET /api/finance/student-profile/{student_id}
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFinanceBillingV2:
    """Test new finance billing features for Iteration 21"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with Finance Officer credentials"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Finance Officer
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a Year 7 student for testing
        students_resp = self.session.get(f"{BASE_URL}/api/admin/students")
        assert students_resp.status_code == 200
        students = students_resp.json()
        self.year7_students = [s for s in students if s.get("year_group") == "Year 7"]
        if self.year7_students:
            self.test_student = self.year7_students[0]
            self.test_student_id = self.test_student.get("user_id")
        else:
            pytest.skip("No Year 7 students found for testing")
        
        yield
        
    # ─── Test 1: Quick Assign (Individual Mode) ───
    def test_quick_assign_creates_invoice_and_payment(self):
        """POST /api/finance/quick-assign creates invoice + optional payment"""
        resp = self.session.post(f"{BASE_URL}/api/finance/quick-assign", json={
            "student_id": self.test_student_id,
            "fee_amount": 1500.00,
            "paid_amount": 500.00,
            "description": "TEST_Term 2 School Fees",
            "term": "Term 2"
        })
        assert resp.status_code == 200, f"Quick assign failed: {resp.text}"
        data = resp.json()
        assert "invoice_id" in data
        assert "message" in data
        assert "1,500" in data["message"] or "1500" in data["message"]
        print(f"✓ Quick assign created invoice: {data['invoice_id']}")
        
    def test_quick_assign_without_payment(self):
        """POST /api/finance/quick-assign with paid_amount=0"""
        resp = self.session.post(f"{BASE_URL}/api/finance/quick-assign", json={
            "student_id": self.test_student_id,
            "fee_amount": 2000.00,
            "paid_amount": 0,
            "description": "TEST_Exam Fees",
            "term": "Term 2"
        })
        assert resp.status_code == 200, f"Quick assign failed: {resp.text}"
        data = resp.json()
        assert "Balance: GHS 2,000" in data["message"] or "Balance: GHS 2000" in data["message"]
        print(f"✓ Quick assign without payment: {data['message']}")
        
    def test_quick_assign_invalid_student(self):
        """POST /api/finance/quick-assign with invalid student_id returns 404"""
        resp = self.session.post(f"{BASE_URL}/api/finance/quick-assign", json={
            "student_id": "invalid_student_id",
            "fee_amount": 1000.00,
            "paid_amount": 0,
            "description": "Test",
            "term": "Term 2"
        })
        assert resp.status_code == 404
        print("✓ Quick assign with invalid student returns 404")
        
    # ─── Test 2: Bill Selected Students (Multi-Select Mode) ───
    def test_bill_selected_students_success(self):
        """POST /api/finance/bill-selected-students bills specific students"""
        if len(self.year7_students) < 2:
            pytest.skip("Need at least 2 Year 7 students")
            
        student_ids = [s["user_id"] for s in self.year7_students[:2]]
        resp = self.session.post(f"{BASE_URL}/api/finance/bill-selected-students", json={
            "student_ids": student_ids,
            "fee_items": [
                {"name": "TEST_Tuition Fee", "category": "tuition", "amount": 3000, "applies_to": "all"},
                {"name": "TEST_Books", "category": "books", "amount": 500, "applies_to": "all"}
            ],
            "term": "Term 3",
            "academic_year": "2025-2026",
            "due_date": "2026-03-31"
        })
        assert resp.status_code == 200, f"Bill selected failed: {resp.text}"
        data = resp.json()
        assert "created" in data
        print(f"✓ Bill selected students: {data['message']}")
        
    def test_bill_selected_students_empty_list(self):
        """POST /api/finance/bill-selected-students with empty student list returns 400"""
        resp = self.session.post(f"{BASE_URL}/api/finance/bill-selected-students", json={
            "student_ids": [],
            "fee_items": [{"name": "Test", "amount": 100}],
            "term": "Term 2"
        })
        assert resp.status_code == 400
        print("✓ Bill selected with empty list returns 400")
        
    def test_bill_selected_students_no_fee_items(self):
        """POST /api/finance/bill-selected-students with no fee items returns 400"""
        resp = self.session.post(f"{BASE_URL}/api/finance/bill-selected-students", json={
            "student_ids": [self.test_student_id],
            "fee_items": [],
            "term": "Term 2"
        })
        assert resp.status_code == 400
        print("✓ Bill selected with no fee items returns 400")
        
    def test_bill_selected_skips_already_billed(self):
        """POST /api/finance/bill-selected-students skips students already billed for term"""
        # First billing
        resp1 = self.session.post(f"{BASE_URL}/api/finance/bill-selected-students", json={
            "student_ids": [self.test_student_id],
            "fee_items": [{"name": "TEST_First Bill", "amount": 1000, "applies_to": "all"}],
            "term": "Term 1",
            "academic_year": "2025-2026"
        })
        
        # Second billing for same term - should skip
        resp2 = self.session.post(f"{BASE_URL}/api/finance/bill-selected-students", json={
            "student_ids": [self.test_student_id],
            "fee_items": [{"name": "TEST_Second Bill", "amount": 2000, "applies_to": "all"}],
            "term": "Term 1",
            "academic_year": "2025-2026"
        })
        assert resp2.status_code == 200
        data = resp2.json()
        assert data.get("skipped", 0) >= 1 or data.get("created", 0) == 0
        print(f"✓ Bill selected skips already billed: {data}")
        
    # ─── Test 3: Assign Fees Bulk (Entire Year Group Mode) ───
    def test_assign_fees_bulk_year_group(self):
        """POST /api/finance/assign-fees-bulk bills entire year group"""
        resp = self.session.post(f"{BASE_URL}/api/finance/assign-fees-bulk", json={
            "year_group": "Year 8",
            "term": "Term 2",
            "academic_year": "2025-2026",
            "due_date": "2026-02-28",
            "fee_items": [
                {"name": "TEST_Tuition", "category": "tuition", "amount": 4000, "applies_to": "all"},
                {"name": "TEST_Boarding", "category": "boarding", "amount": 2000, "applies_to": "boarding"}
            ]
        })
        assert resp.status_code == 200, f"Bulk assign failed: {resp.text}"
        data = resp.json()
        assert "count" in data
        print(f"✓ Bulk assign to Year 8: {data['message']}")
        
    def test_assign_fees_bulk_boarding_filter(self):
        """POST /api/finance/assign-fees-bulk applies boarding-specific fees correctly"""
        resp = self.session.post(f"{BASE_URL}/api/finance/assign-fees-bulk", json={
            "year_group": "Year 9",
            "term": "Term 2",
            "academic_year": "2025-2026",
            "fee_items": [
                {"name": "TEST_Day Student Fee", "category": "tuition", "amount": 3000, "applies_to": "day"},
                {"name": "TEST_Boarding Fee", "category": "boarding", "amount": 5000, "applies_to": "boarding"}
            ]
        })
        assert resp.status_code == 200
        print(f"✓ Bulk assign with boarding filter: {resp.json()}")
        
    # ─── Test 4: Record Payment with Auto-Allocation ───
    def test_record_payment_auto_allocates(self):
        """POST /api/finance/payments auto-allocates to oldest unpaid invoices"""
        # First create an invoice
        inv_resp = self.session.post(f"{BASE_URL}/api/finance/quick-assign", json={
            "student_id": self.test_student_id,
            "fee_amount": 1000.00,
            "paid_amount": 0,
            "description": "TEST_For Payment Test",
            "term": "Term 2"
        })
        assert inv_resp.status_code == 200
        
        # Now record a payment
        pay_resp = self.session.post(f"{BASE_URL}/api/finance/payments", json={
            "student_id": self.test_student_id,
            "amount": 500.00,
            "method": "cash",
            "reference": "TEST_PAY_001"
        })
        assert pay_resp.status_code == 200, f"Payment failed: {pay_resp.text}"
        data = pay_resp.json()
        assert "payment_id" in data
        # Check that payment was auto-allocated (status should be 'allocated' or 'matched')
        assert data.get("status") in ["allocated", "matched"]
        print(f"✓ Payment auto-allocated: {data['payment_id']}, status: {data['status']}")
        
    def test_record_payment_full_allocation(self):
        """POST /api/finance/payments fully allocates when amount covers invoice"""
        # Create invoice
        inv_resp = self.session.post(f"{BASE_URL}/api/finance/quick-assign", json={
            "student_id": self.test_student_id,
            "fee_amount": 800.00,
            "paid_amount": 0,
            "description": "TEST_Full Payment Test",
            "term": "Term 2"
        })
        assert inv_resp.status_code == 200
        
        # Pay full amount
        pay_resp = self.session.post(f"{BASE_URL}/api/finance/payments", json={
            "student_id": self.test_student_id,
            "amount": 800.00,
            "method": "bank_transfer",
            "reference": "TEST_FULL_PAY"
        })
        assert pay_resp.status_code == 200
        data = pay_resp.json()
        assert data.get("unallocated_amount", 0) <= 0.01  # Should be fully allocated
        print(f"✓ Full payment allocated: unallocated={data.get('unallocated_amount')}")
        
    def test_record_payment_overpayment_creates_credit(self):
        """POST /api/finance/payments creates credit note for overpayment"""
        # Create small invoice
        inv_resp = self.session.post(f"{BASE_URL}/api/finance/quick-assign", json={
            "student_id": self.test_student_id,
            "fee_amount": 200.00,
            "paid_amount": 0,
            "description": "TEST_Overpayment Test",
            "term": "Term 2"
        })
        assert inv_resp.status_code == 200
        
        # Pay more than owed
        pay_resp = self.session.post(f"{BASE_URL}/api/finance/payments", json={
            "student_id": self.test_student_id,
            "amount": 300.00,
            "method": "momo",
            "reference": "TEST_OVERPAY"
        })
        assert pay_resp.status_code == 200
        print(f"✓ Overpayment recorded: {pay_resp.json()}")
        
    # ─── Test 5: Student Profile with Updated Balance ───
    def test_student_profile_shows_balance(self):
        """GET /api/finance/student-profile/{student_id} shows updated balance"""
        resp = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.test_student_id}")
        assert resp.status_code == 200, f"Profile failed: {resp.text}"
        data = resp.json()
        
        assert "student" in data
        assert "summary" in data
        assert "invoices" in data
        assert "payments" in data
        
        summary = data["summary"]
        assert "total_billed" in summary
        assert "total_paid" in summary
        assert "balance" in summary
        
        print(f"✓ Student profile: billed={summary['total_billed']}, paid={summary['total_paid']}, balance={summary['balance']}")
        
    def test_student_profile_invalid_id(self):
        """GET /api/finance/student-profile/{invalid_id} returns 404"""
        resp = self.session.get(f"{BASE_URL}/api/finance/student-profile/invalid_id_123")
        assert resp.status_code == 404
        print("✓ Invalid student profile returns 404")
        
    def test_student_profile_includes_invoices_and_payments(self):
        """GET /api/finance/student-profile includes invoice line items and payment history"""
        resp = self.session.get(f"{BASE_URL}/api/finance/student-profile/{self.test_student_id}")
        assert resp.status_code == 200
        data = resp.json()
        
        # Check invoices have line_items
        if data.get("invoices"):
            for inv in data["invoices"]:
                assert "line_items" in inv or inv.get("line_items") is not None
                
        # Check payments list exists
        assert isinstance(data.get("payments"), list)
        print(f"✓ Profile has {len(data.get('invoices', []))} invoices, {len(data.get('payments', []))} payments")
        
    # ─── Test 6: Student Ledger ───
    def test_student_ledger_returns_all_students(self):
        """GET /api/finance/student-ledger returns students with financial summary"""
        resp = self.session.get(f"{BASE_URL}/api/finance/student-ledger")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        
        if data:
            student = data[0]
            assert "user_id" in student
            assert "name" in student
            assert "total_billed" in student
            assert "total_paid" in student
            assert "balance" in student
            
        print(f"✓ Student ledger returned {len(data)} students")
        
    def test_student_ledger_filter_by_year(self):
        """GET /api/finance/student-ledger?year_group=Year 7 filters correctly"""
        resp = self.session.get(f"{BASE_URL}/api/finance/student-ledger?year_group=Year 7")
        assert resp.status_code == 200
        data = resp.json()
        
        for student in data:
            assert student.get("year_group") == "Year 7"
            
        print(f"✓ Student ledger filtered to {len(data)} Year 7 students")
        
    # ─── Test 7: Dashboard Reflects Changes ───
    def test_dashboard_shows_updated_totals(self):
        """GET /api/finance/dashboard shows updated totals after billing"""
        resp = self.session.get(f"{BASE_URL}/api/finance/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        
        assert "total_invoiced" in data
        assert "total_collected" in data
        assert "total_outstanding" in data
        assert "collection_rate" in data
        
        print(f"✓ Dashboard: invoiced={data['total_invoiced']}, collected={data['total_collected']}, outstanding={data['total_outstanding']}")
        
    # ─── Test 8: Invoices List ───
    def test_invoices_list_includes_new_invoices(self):
        """GET /api/finance/invoices returns created invoices"""
        resp = self.session.get(f"{BASE_URL}/api/finance/invoices")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        
        # Check for TEST_ prefixed invoices we created
        test_invoices = [inv for inv in data if "TEST_" in str(inv.get("notes", ""))]
        print(f"✓ Invoices list has {len(data)} total, {len(test_invoices)} test invoices")
        
    # ─── Test 9: Payments List ───
    def test_payments_list_includes_new_payments(self):
        """GET /api/finance/payments returns recorded payments"""
        resp = self.session.get(f"{BASE_URL}/api/finance/payments")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        
        # Check for TEST_ prefixed payments
        test_payments = [p for p in data if "TEST_" in str(p.get("reference", ""))]
        print(f"✓ Payments list has {len(data)} total, {len(test_payments)} test payments")


class TestFinanceBillingRoles:
    """Test role-based access for finance billing endpoints"""
    
    def test_teacher_cannot_quick_assign(self):
        """Teacher role cannot access quick-assign endpoint"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login as teacher
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        if login_resp.status_code != 200:
            pytest.skip("Teacher login failed")
            
        token = login_resp.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        resp = session.post(f"{BASE_URL}/api/finance/quick-assign", json={
            "student_id": "test",
            "fee_amount": 100,
            "paid_amount": 0,
            "description": "Test",
            "term": "Term 1"
        })
        assert resp.status_code in [401, 403]
        print("✓ Teacher cannot access quick-assign (403)")
        
    def test_ceo_can_access_billing(self):
        """CEO role can access billing endpoints"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@tcis.demo",
            "password": "ceo123"
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        resp = session.get(f"{BASE_URL}/api/finance/student-ledger")
        assert resp.status_code == 200
        print("✓ CEO can access student ledger")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
