"""
Test Finance Fee Templates and Term Billing APIs
Tests: POST/GET fee-templates, apply template, term-summary, outstanding-report
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFinanceTemplatesAndBilling:
    """Finance Fee Templates and Term Billing endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as finance user"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as finance user
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "finance@tcis.demo",
            "password": "finance123"
        })
        assert login_resp.status_code == 200, f"Finance login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.user = login_resp.json().get("user", {})
        print(f"Logged in as: {self.user.get('name')} ({self.user.get('role')})")
    
    # ─── Fee Templates Tests ───
    
    def test_get_fee_templates_list(self):
        """GET /api/finance/fee-templates - returns templates list"""
        resp = self.session.get(f"{BASE_URL}/api/finance/fee-templates")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} fee templates")
        
        # Check if existing template exists (Year 10 Term 1)
        if len(data) > 0:
            template = data[0]
            assert "template_id" in template, "Template should have template_id"
            assert "name" in template, "Template should have name"
            assert "year_group" in template, "Template should have year_group"
            assert "term" in template, "Template should have term"
            assert "fee_items" in template, "Template should have fee_items"
            print(f"First template: {template.get('name')} - {template.get('year_group')} {template.get('term')}")
            print(f"  Day total: GHS {template.get('total_day', 0)}, Boarding total: GHS {template.get('total_boarding', 0)}")
    
    def test_create_fee_template(self):
        """POST /api/finance/fee-templates - creates template successfully"""
        payload = {
            "name": "TEST_Year 8 Term 2 Fees 2025-2026",
            "year_group": "Year 8",
            "term": "Term 2",
            "academic_year": "2025-2026",
            "fee_items": [
                {"name": "Tuition Fee", "category": "tuition", "amount": 5000, "applies_to": "all"},
                {"name": "Boarding Fee", "category": "boarding", "amount": 3000, "applies_to": "boarding"},
                {"name": "Technology Fee", "category": "technology", "amount": 500, "applies_to": "all"}
            ]
        }
        resp = self.session.post(f"{BASE_URL}/api/finance/fee-templates", json=payload)
        assert resp.status_code == 200, f"Failed to create template: {resp.text}"
        
        data = resp.json()
        assert "template_id" in data, "Response should have template_id"
        assert data["name"] == payload["name"], "Name should match"
        assert data["year_group"] == payload["year_group"], "Year group should match"
        assert data["term"] == payload["term"], "Term should match"
        assert len(data.get("fee_items", [])) == 3, "Should have 3 fee items"
        
        # Verify totals calculated correctly
        # Day: 5000 + 500 = 5500 (all items except boarding-only)
        # Boarding: 5000 + 3000 + 500 = 8500 (all items)
        assert data.get("total_day") == 5500, f"Day total should be 5500, got {data.get('total_day')}"
        assert data.get("total_boarding") == 8500, f"Boarding total should be 8500, got {data.get('total_boarding')}"
        
        print(f"Created template: {data['template_id']}")
        print(f"  Day total: GHS {data.get('total_day')}, Boarding total: GHS {data.get('total_boarding')}")
        
        # Store for cleanup
        self.created_template_id = data["template_id"]
        
        # Verify it appears in list
        list_resp = self.session.get(f"{BASE_URL}/api/finance/fee-templates")
        templates = list_resp.json()
        found = any(t["template_id"] == data["template_id"] for t in templates)
        assert found, "Created template should appear in list"
        
        # Cleanup - delete the test template
        del_resp = self.session.delete(f"{BASE_URL}/api/finance/fee-templates/{data['template_id']}")
        assert del_resp.status_code == 200, f"Failed to delete template: {del_resp.text}"
        print(f"Cleaned up test template")
    
    def test_apply_fee_template(self):
        """POST /api/finance/fee-templates/{id}/apply - generates invoices"""
        # First get existing templates
        resp = self.session.get(f"{BASE_URL}/api/finance/fee-templates")
        templates = resp.json()
        
        if len(templates) == 0:
            pytest.skip("No templates to apply")
        
        template = templates[0]
        template_id = template["template_id"]
        
        # Apply template (may create 0 invoices if already applied)
        apply_resp = self.session.post(f"{BASE_URL}/api/finance/fee-templates/{template_id}/apply", json={
            "due_date": "2026-03-31"
        })
        assert apply_resp.status_code == 200, f"Failed to apply template: {apply_resp.text}"
        
        data = apply_resp.json()
        assert "message" in data, "Response should have message"
        assert "created" in data, "Response should have created count"
        assert "skipped" in data, "Response should have skipped count"
        
        print(f"Applied template '{template['name']}': {data['created']} invoices created, {data['skipped']} skipped")
    
    def test_apply_nonexistent_template(self):
        """POST /api/finance/fee-templates/{id}/apply - returns 404 for invalid template"""
        resp = self.session.post(f"{BASE_URL}/api/finance/fee-templates/invalid_template_id/apply", json={})
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
    
    # ─── Term Summary Tests ───
    
    def test_get_term_summary(self):
        """GET /api/finance/term-summary - returns billing summary"""
        resp = self.session.get(f"{BASE_URL}/api/finance/term-summary?term=Term 1&academic_year=2025-2026")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        
        data = resp.json()
        assert "year_groups" in data, "Response should have year_groups"
        assert "totals" in data, "Response should have totals"
        
        totals = data["totals"]
        assert "invoiced" in totals, "Totals should have invoiced"
        assert "paid" in totals, "Totals should have paid"
        assert "outstanding" in totals, "Totals should have outstanding"
        
        print(f"Term Summary - Term 1 2025-2026:")
        print(f"  Total Invoiced: GHS {totals.get('invoiced', 0)}")
        print(f"  Total Paid: GHS {totals.get('paid', 0)}")
        print(f"  Outstanding: GHS {totals.get('outstanding', 0)}")
        print(f"  Year groups with data: {len(data.get('year_groups', []))}")
        
        # Check year group breakdown structure
        for yg in data.get("year_groups", [])[:3]:
            assert "year_group" in yg, "Year group entry should have year_group"
            assert "student_count" in yg, "Year group entry should have student_count"
            assert "invoiced" in yg, "Year group entry should have invoiced"
            assert "paid" in yg, "Year group entry should have paid"
            assert "outstanding" in yg, "Year group entry should have outstanding"
            assert "collection_rate" in yg, "Year group entry should have collection_rate"
            print(f"  {yg['year_group']}: {yg['student_count']} students, GHS {yg['invoiced']} invoiced, {yg['collection_rate']}% collected")
    
    def test_get_term_summary_no_filters(self):
        """GET /api/finance/term-summary - works without filters"""
        resp = self.session.get(f"{BASE_URL}/api/finance/term-summary")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert "year_groups" in data
        assert "totals" in data
        print(f"Term Summary (all): {len(data.get('year_groups', []))} year groups")
    
    # ─── Outstanding Report Tests ───
    
    def test_get_outstanding_report(self):
        """GET /api/finance/outstanding-report - returns outstanding balances"""
        resp = self.session.get(f"{BASE_URL}/api/finance/outstanding-report")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        
        data = resp.json()
        assert "students" in data, "Response should have students"
        assert "total_outstanding" in data, "Response should have total_outstanding"
        assert "total_invoiced" in data, "Response should have total_invoiced"
        assert "total_paid" in data, "Response should have total_paid"
        
        print(f"Outstanding Report:")
        print(f"  Students with balance: {data.get('count', len(data.get('students', [])))}")
        print(f"  Total Outstanding: GHS {data.get('total_outstanding', 0)}")
        print(f"  Total Invoiced: GHS {data.get('total_invoiced', 0)}")
        print(f"  Total Paid: GHS {data.get('total_paid', 0)}")
        
        # Check student entry structure
        for student in data.get("students", [])[:3]:
            assert "student_id" in student, "Student entry should have student_id"
            assert "name" in student, "Student entry should have name"
            assert "outstanding" in student, "Student entry should have outstanding"
            print(f"  {student['name']} ({student.get('year_group', 'N/A')}): GHS {student['outstanding']} outstanding")
    
    def test_get_outstanding_report_with_filters(self):
        """GET /api/finance/outstanding-report - works with term and year_group filters"""
        resp = self.session.get(f"{BASE_URL}/api/finance/outstanding-report?term=Term 1&year_group=Year 10")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        
        data = resp.json()
        assert "students" in data
        print(f"Outstanding Report (Term 1, Year 10): {len(data.get('students', []))} students")
    
    # ─── Finance Dashboard Tests ───
    
    def test_finance_dashboard(self):
        """GET /api/finance/dashboard - returns dashboard data"""
        resp = self.session.get(f"{BASE_URL}/api/finance/dashboard")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        
        data = resp.json()
        assert "total_invoiced" in data, "Dashboard should have total_invoiced"
        assert "total_collected" in data, "Dashboard should have total_collected"
        assert "total_outstanding" in data, "Dashboard should have total_outstanding"
        assert "collection_rate" in data, "Dashboard should have collection_rate"
        
        print(f"Finance Dashboard:")
        print(f"  Total Invoiced: GHS {data.get('total_invoiced', 0)}")
        print(f"  Total Collected: GHS {data.get('total_collected', 0)}")
        print(f"  Total Outstanding: GHS {data.get('total_outstanding', 0)}")
        print(f"  Collection Rate: {data.get('collection_rate', 0)}%")
    
    # ─── Existing Finance Endpoints Tests ───
    
    def test_get_invoices(self):
        """GET /api/finance/invoices - returns invoices list"""
        resp = self.session.get(f"{BASE_URL}/api/finance/invoices")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} invoices")
    
    def test_get_payments(self):
        """GET /api/finance/payments - returns payments list"""
        resp = self.session.get(f"{BASE_URL}/api/finance/payments")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} payments")
    
    def test_get_student_ledger(self):
        """GET /api/finance/student-ledger - returns student financial summaries"""
        resp = self.session.get(f"{BASE_URL}/api/finance/student-ledger")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} students in ledger")


class TestFinanceAccessControl:
    """Test finance access with different roles"""
    
    def test_ceo_can_access_finance(self):
        """CEO should have access to finance endpoints"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@tcis.demo",
            "password": "ceo123"
        })
        assert login_resp.status_code == 200, f"CEO login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Test access to fee templates
        resp = session.get(f"{BASE_URL}/api/finance/fee-templates")
        assert resp.status_code == 200, f"CEO should access fee-templates: {resp.text}"
        print("CEO can access fee-templates: OK")
        
        # Test access to term summary
        resp = session.get(f"{BASE_URL}/api/finance/term-summary")
        assert resp.status_code == 200, f"CEO should access term-summary: {resp.text}"
        print("CEO can access term-summary: OK")
    
    def test_superadmin_can_access_finance(self):
        """SuperAdmin should have access to finance endpoints"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dwain@tcis.demo",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"SuperAdmin login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Test access to outstanding report
        resp = session.get(f"{BASE_URL}/api/finance/outstanding-report")
        assert resp.status_code == 200, f"SuperAdmin should access outstanding-report: {resp.text}"
        print("SuperAdmin can access outstanding-report: OK")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
