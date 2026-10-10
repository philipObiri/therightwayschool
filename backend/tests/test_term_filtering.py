"""
Test Term Filtering - All data should be filtered by active term
Term data distribution:
- Term 1: 1 invoice
- Term 2: 57 invoices + 24 payments + 2 quizzes + 1 remark (ACTIVE)
- Term 3: 2 invoices

Working Paper data should NOT be filtered by term.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTermFiltering:
    """Test that all endpoints auto-filter by active term"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as SuperAdmin and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dwain@tcis.demo",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_get_active_term(self):
        """GET /api/settings/active-term returns current active term"""
        resp = requests.get(f"{BASE_URL}/api/settings/active-term", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "term" in data
        assert "academic_year" in data
        print(f"Active term: {data['term']} ({data['academic_year']})")
        
    def test_set_active_term_to_term2(self):
        """PUT /api/settings/active-term changes active term to Term 2"""
        resp = requests.put(f"{BASE_URL}/api/settings/active-term", 
                           json={"term": "Term 2", "academic_year": "2025-2026"},
                           headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["term"] == "Term 2"
        print("Set active term to Term 2")
        
    # ─── Finance Invoices ───
    def test_invoices_term2_count(self):
        """GET /api/finance/invoices returns 57 invoices for Term 2"""
        # Ensure Term 2 is active
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/finance/invoices", headers=self.headers)
        assert resp.status_code == 200
        invoices = resp.json()
        print(f"Term 2 invoices count: {len(invoices)}")
        assert len(invoices) == 57, f"Expected 57 invoices for Term 2, got {len(invoices)}"
        # Verify all invoices have term = Term 2
        for inv in invoices:
            assert inv.get("term") == "Term 2", f"Invoice {inv.get('invoice_id')} has term {inv.get('term')}"
            
    def test_invoices_term1_count(self):
        """GET /api/finance/invoices returns 1 invoice for Term 1"""
        # Switch to Term 1
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 1", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/finance/invoices", headers=self.headers)
        assert resp.status_code == 200
        invoices = resp.json()
        print(f"Term 1 invoices count: {len(invoices)}")
        assert len(invoices) == 1, f"Expected 1 invoice for Term 1, got {len(invoices)}"
        
        # Switch back to Term 2
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
    def test_invoices_term3_count(self):
        """GET /api/finance/invoices returns 2 invoices for Term 3"""
        # Switch to Term 3
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 3", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/finance/invoices", headers=self.headers)
        assert resp.status_code == 200
        invoices = resp.json()
        print(f"Term 3 invoices count: {len(invoices)}")
        assert len(invoices) == 2, f"Expected 2 invoices for Term 3, got {len(invoices)}"
        
        # Switch back to Term 2
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
    # ─── Finance Payments ───
    def test_payments_term2_count(self):
        """GET /api/finance/payments returns payments for Term 2 (at least 24)"""
        # Ensure Term 2 is active
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/finance/payments", headers=self.headers)
        assert resp.status_code == 200
        payments = resp.json()
        print(f"Term 2 payments count: {len(payments)}")
        # At least 24 payments (may have more from test runs)
        assert len(payments) >= 24, f"Expected at least 24 payments for Term 2, got {len(payments)}"
        # Verify all payments have term = Term 2
        for pay in payments:
            assert pay.get("term") == "Term 2", f"Payment {pay.get('payment_id')} has term {pay.get('term')}"
        
    def test_payments_term1_count(self):
        """GET /api/finance/payments returns 0 payments for Term 1"""
        # Switch to Term 1
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 1", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/finance/payments", headers=self.headers)
        assert resp.status_code == 200
        payments = resp.json()
        print(f"Term 1 payments count: {len(payments)}")
        # Term 1 should have 0 payments based on context
        assert len(payments) == 0, f"Expected 0 payments for Term 1, got {len(payments)}"
        
        # Switch back to Term 2
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
    # ─── Finance Dashboard ───
    def test_finance_dashboard_term_scoped(self):
        """GET /api/finance/dashboard returns term-scoped totals"""
        # Ensure Term 2 is active
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/finance/dashboard", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_invoiced" in data
        assert "total_collected" in data
        assert "active_term" in data
        assert data["active_term"] == "Term 2"
        print(f"Dashboard: invoiced={data['total_invoiced']}, collected={data['total_collected']}")
        
    # ─── Student Ledger ───
    def test_student_ledger_term_scoped(self):
        """GET /api/finance/student-ledger returns term-scoped balances"""
        # Ensure Term 2 is active
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/finance/student-ledger", headers=self.headers)
        assert resp.status_code == 200
        students = resp.json()
        assert isinstance(students, list)
        print(f"Student ledger returned {len(students)} students")
        
    # ─── LMS Lessons ───
    def test_lessons_term_filtered(self):
        """GET /api/lms/lessons auto-filters by active term"""
        # Ensure Term 2 is active
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/lms/lessons", headers=self.headers)
        assert resp.status_code == 200
        lessons = resp.json()
        print(f"Term 2 lessons count: {len(lessons)}")
        # Verify all lessons have term = Term 2
        for lesson in lessons:
            assert lesson.get("term") == "Term 2", f"Lesson {lesson.get('lesson_id')} has term {lesson.get('term')}"
            
    # ─── Quizzes ───
    def test_quizzes_term2_count(self):
        """GET /api/quiz/list returns 2 quizzes for Term 2"""
        # Ensure Term 2 is active
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/quiz/list", headers=self.headers)
        assert resp.status_code == 200
        quizzes = resp.json()
        print(f"Term 2 quizzes count: {len(quizzes)}")
        assert len(quizzes) == 2, f"Expected 2 quizzes for Term 2, got {len(quizzes)}"
        
    def test_quizzes_term1_count(self):
        """GET /api/quiz/list returns 0 quizzes for Term 1"""
        # Switch to Term 1
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 1", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/quiz/list", headers=self.headers)
        assert resp.status_code == 200
        quizzes = resp.json()
        print(f"Term 1 quizzes count: {len(quizzes)}")
        assert len(quizzes) == 0, f"Expected 0 quizzes for Term 1, got {len(quizzes)}"
        
        # Switch back to Term 2
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
    # ─── Remarks ───
    def test_remarks_term_filtered(self):
        """GET /api/remarks/ auto-filters by active term"""
        # Ensure Term 2 is active
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/remarks/", headers=self.headers)
        assert resp.status_code == 200
        remarks = resp.json()
        print(f"Term 2 remarks count: {len(remarks)}")
        # Verify all remarks have term = Term 2
        for remark in remarks:
            assert remark.get("term") == "Term 2", f"Remark {remark.get('remark_id')} has term {remark.get('term')}"
            
    def test_remarks_term1_count(self):
        """GET /api/remarks/ returns 0 remarks for Term 1"""
        # Switch to Term 1
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 1", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/remarks/", headers=self.headers)
        assert resp.status_code == 200
        remarks = resp.json()
        print(f"Term 1 remarks count: {len(remarks)}")
        # Term 1 should have 0 remarks based on context
        assert len(remarks) == 0, f"Expected 0 remarks for Term 1, got {len(remarks)}"
        
        # Switch back to Term 2
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
    # ─── Gradebook Entries ───
    def test_gradebook_entries_term_filtered(self):
        """GET /api/gradebook/entries auto-filters by active term"""
        # Ensure Term 2 is active
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/gradebook/entries", headers=self.headers)
        assert resp.status_code == 200
        entries = resp.json()
        print(f"Term 2 gradebook entries count: {len(entries)}")
        # Verify all entries have term = Term 2
        for entry in entries:
            assert entry.get("term") == "Term 2", f"Entry {entry.get('entry_id')} has term {entry.get('term')}"
            
    # ─── Assignments ───
    def test_assignments_term_filtered(self):
        """GET /api/assignments auto-filters by active term"""
        # Ensure Term 2 is active
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp = requests.get(f"{BASE_URL}/api/assignments", headers=self.headers)
        assert resp.status_code == 200
        assignments = resp.json()
        print(f"Term 2 assignments count: {len(assignments)}")
        # Verify all assignments have term = Term 2
        for asgn in assignments:
            assert asgn.get("term") == "Term 2", f"Assignment {asgn.get('assignment_id')} has term {asgn.get('term')}"


class TestTermCreation:
    """Test that new records are created with active term tag"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as SuperAdmin and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dwain@tcis.demo",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Ensure Term 2 is active
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
    def test_create_invoice_with_active_term(self):
        """POST /api/finance/invoices creates invoice with active term tag"""
        # Get a student ID first
        students_resp = requests.get(f"{BASE_URL}/api/admin/users?role=Student&limit=1", headers=self.headers)
        if students_resp.status_code != 200 or not students_resp.json():
            pytest.skip("No students found")
        student_id = students_resp.json()[0]["user_id"]
        
        resp = requests.post(f"{BASE_URL}/api/finance/invoices", 
                            json={
                                "student_id": student_id,
                                "items": [{"name": "TEST_Term_Fee", "amount": 100}],
                                "status": "draft"
                            },
                            headers=self.headers)
        assert resp.status_code == 200
        invoice = resp.json()
        assert invoice.get("term") == "Term 2", f"Invoice created with term {invoice.get('term')}"
        print(f"Created invoice {invoice.get('invoice_id')} with term {invoice.get('term')}")
        
        # Cleanup - delete the test invoice
        requests.delete(f"{BASE_URL}/api/finance/invoices/{invoice['invoice_id']}", headers=self.headers)
        
    def test_create_payment_with_active_term(self):
        """POST /api/finance/payments creates payment with active term tag"""
        resp = requests.post(f"{BASE_URL}/api/finance/payments", 
                            json={
                                "amount": 50,
                                "method": "cash",
                                "payer_name": "TEST_Term_Payment"
                            },
                            headers=self.headers)
        assert resp.status_code == 200
        payment = resp.json()
        assert payment.get("term") == "Term 2", f"Payment created with term {payment.get('term')}"
        print(f"Created payment {payment.get('payment_id')} with term {payment.get('term')}")
        
    def test_create_remark_with_active_term(self):
        """POST /api/remarks/ creates remark with active term tag"""
        resp = requests.post(f"{BASE_URL}/api/remarks/", 
                            json={
                                "title": "TEST_Term_Remark",
                                "body": "This is a test remark for term filtering",
                                "category": "general"
                            },
                            headers=self.headers)
        assert resp.status_code == 200
        remark = resp.json()
        assert remark.get("term") == "Term 2", f"Remark created with term {remark.get('term')}"
        print(f"Created remark {remark.get('remark_id')} with term {remark.get('term')}")
        
        # Cleanup - delete the test remark
        requests.delete(f"{BASE_URL}/api/remarks/{remark['remark_id']}", headers=self.headers)


class TestWorkingPaperNotTermFiltered:
    """Test that Working Paper data is NOT filtered by term"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as SuperAdmin and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dwain@tcis.demo",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_working_paper_folders_persist_across_terms(self):
        """Working Paper folders should persist across term changes"""
        # Get folders in Term 2
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp_term2 = requests.get(f"{BASE_URL}/api/working-paper/folders", headers=self.headers)
        assert resp_term2.status_code == 200
        folders_term2 = resp_term2.json()
        print(f"Term 2 WP folders count: {len(folders_term2)}")
        
        # Switch to Term 1 and get folders
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 1", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp_term1 = requests.get(f"{BASE_URL}/api/working-paper/folders", headers=self.headers)
        assert resp_term1.status_code == 200
        folders_term1 = resp_term1.json()
        print(f"Term 1 WP folders count: {len(folders_term1)}")
        
        # Folders should be the same regardless of term
        assert len(folders_term1) == len(folders_term2), "Working Paper folders should persist across terms"
        
        # Switch back to Term 2
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
    def test_working_paper_smart_folders_persist_across_terms(self):
        """Working Paper smart folders should persist across term changes"""
        # Get smart folder counts in Term 2
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp_term2 = requests.get(f"{BASE_URL}/api/wp/smart-folders/my_documents", headers=self.headers)
        assert resp_term2.status_code == 200
        data_term2 = resp_term2.json()
        count_term2 = data_term2.get("count", 0)
        print(f"Term 2 WP my_documents count: {count_term2}")
        
        # Switch to Term 1 and get counts
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 1", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        resp_term1 = requests.get(f"{BASE_URL}/api/wp/smart-folders/my_documents", headers=self.headers)
        assert resp_term1.status_code == 200
        data_term1 = resp_term1.json()
        count_term1 = data_term1.get("count", 0)
        print(f"Term 1 WP my_documents count: {count_term1}")
        
        # Counts should be the same regardless of term (WP is not term-filtered)
        assert count_term1 == count_term2, "Working Paper documents should persist across terms"
        
        # Switch back to Term 2
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)


class TestStudentBillingProfile:
    """Test student billing profile returns term-scoped data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as SuperAdmin and get token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dwain@tcis.demo",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_student_profile_term_scoped(self):
        """GET /api/finance/student-profile/{student_id} returns term-scoped invoices and payments"""
        # Ensure Term 2 is active
        requests.put(f"{BASE_URL}/api/settings/active-term", 
                    json={"term": "Term 2", "academic_year": "2025-2026"},
                    headers=self.headers)
        
        # Get a student ID first
        students_resp = requests.get(f"{BASE_URL}/api/admin/users?role=Student&limit=1", headers=self.headers)
        if students_resp.status_code != 200 or not students_resp.json():
            pytest.skip("No students found")
        student_id = students_resp.json()[0]["user_id"]
        
        resp = requests.get(f"{BASE_URL}/api/finance/student-profile/{student_id}", headers=self.headers)
        assert resp.status_code == 200
        profile = resp.json()
        
        # Verify invoices are term-scoped
        invoices = profile.get("invoices", [])
        for inv in invoices:
            assert inv.get("term") == "Term 2", f"Invoice {inv.get('invoice_id')} has term {inv.get('term')}"
            
        # Verify payments are term-scoped
        payments = profile.get("payments", [])
        for pay in payments:
            assert pay.get("term") == "Term 2", f"Payment {pay.get('payment_id')} has term {pay.get('term')}"
            
        print(f"Student profile: {len(invoices)} invoices, {len(payments)} payments for Term 2")


class TestCleanup:
    """Ensure Term 2 is active after all tests"""
    
    def test_restore_term2(self):
        """Restore active term to Term 2"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dwain@tcis.demo",
            "password": "admin123"
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        resp = requests.put(f"{BASE_URL}/api/settings/active-term", 
                           json={"term": "Term 2", "academic_year": "2025-2026"},
                           headers=headers)
        assert resp.status_code == 200
        print("Restored active term to Term 2")
