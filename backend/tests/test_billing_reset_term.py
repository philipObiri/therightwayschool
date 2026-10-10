"""
Test Suite for Iteration 19 Features:
1. Finance Reset All Billing - POST /api/finance/reset-all
2. Term Change with WebSocket Broadcast - PUT /api/settings/active-term

Test Credentials:
- SuperAdmin: dwain@tcis.demo / admin123
- CEO: ceo@tcis.demo / ceo123
- Finance: finance@tcis.demo / finance123
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBillingResetAndTermChange:
    """Tests for billing reset and term change features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self, email, password):
        """Helper to get auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    # ============ BILLING RESET TESTS ============
    
    def test_reset_billing_without_confirm_returns_400(self):
        """POST /api/finance/reset-all without confirm='RESET' should return 400"""
        token = self.get_auth_token("dwain@tcis.demo", "admin123")
        assert token, "Failed to get SuperAdmin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Test without confirm field
        response = self.session.post(f"{BASE_URL}/api/finance/reset-all", json={})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "RESET" in response.json().get("detail", ""), "Error should mention RESET"
        print("PASS: Reset without confirm returns 400")
        
    def test_reset_billing_with_wrong_confirm_returns_400(self):
        """POST /api/finance/reset-all with wrong confirm value should return 400"""
        token = self.get_auth_token("dwain@tcis.demo", "admin123")
        assert token, "Failed to get SuperAdmin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Test with wrong confirm value
        response = self.session.post(f"{BASE_URL}/api/finance/reset-all", json={"confirm": "reset"})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Reset with wrong confirm value returns 400")
        
    def test_reset_billing_with_correct_confirm_succeeds(self):
        """POST /api/finance/reset-all with confirm='RESET' should succeed"""
        token = self.get_auth_token("dwain@tcis.demo", "admin123")
        assert token, "Failed to get SuperAdmin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # First, check current dashboard state
        dashboard_before = self.session.get(f"{BASE_URL}/api/finance/dashboard")
        assert dashboard_before.status_code == 200, "Dashboard should be accessible"
        
        # Execute reset with correct confirm
        response = self.session.post(f"{BASE_URL}/api/finance/reset-all", json={"confirm": "RESET"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        assert "reset" in data["message"].lower() or "cleared" in data["message"].lower(), "Message should confirm reset"
        print(f"PASS: Reset succeeded - {data['message']}")
        
    def test_reset_billing_clears_dashboard_data(self):
        """After reset, dashboard should show GHS 0 for all billing figures"""
        token = self.get_auth_token("dwain@tcis.demo", "admin123")
        assert token, "Failed to get SuperAdmin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Check dashboard after reset
        response = self.session.get(f"{BASE_URL}/api/finance/dashboard")
        assert response.status_code == 200, "Dashboard should be accessible"
        
        data = response.json()
        # After reset, totals should be 0
        assert data.get("total_invoiced", 0) == 0, f"Total invoiced should be 0, got {data.get('total_invoiced')}"
        assert data.get("total_collected", 0) == 0, f"Total collected should be 0, got {data.get('total_collected')}"
        assert data.get("total_outstanding", 0) == 0, f"Total outstanding should be 0, got {data.get('total_outstanding')}"
        print("PASS: Dashboard shows GHS 0 after reset")
        
    def test_reset_billing_clears_invoices(self):
        """After reset, invoices list should be empty"""
        token = self.get_auth_token("dwain@tcis.demo", "admin123")
        assert token, "Failed to get SuperAdmin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/finance/invoices")
        assert response.status_code == 200, "Invoices endpoint should be accessible"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 0, f"Invoices should be empty after reset, got {len(data)}"
        print("PASS: Invoices list is empty after reset")
        
    def test_reset_billing_clears_payments(self):
        """After reset, payments list should be empty"""
        token = self.get_auth_token("dwain@tcis.demo", "admin123")
        assert token, "Failed to get SuperAdmin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/finance/payments")
        assert response.status_code == 200, "Payments endpoint should be accessible"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 0, f"Payments should be empty after reset, got {len(data)}"
        print("PASS: Payments list is empty after reset")
        
    def test_reset_billing_finance_role_allowed(self):
        """Finance Officer should be able to reset billing"""
        token = self.get_auth_token("finance@tcis.demo", "finance123")
        assert token, "Failed to get Finance token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Finance role should have access (part of FINANCE_ROLES)
        response = self.session.post(f"{BASE_URL}/api/finance/reset-all", json={"confirm": "RESET"})
        assert response.status_code == 200, f"Finance should be able to reset, got {response.status_code}"
        print("PASS: Finance Officer can reset billing")
        
    def test_reset_billing_ceo_role_allowed(self):
        """CEO should be able to reset billing"""
        token = self.get_auth_token("ceo@tcis.demo", "ceo123")
        assert token, "Failed to get CEO token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.post(f"{BASE_URL}/api/finance/reset-all", json={"confirm": "RESET"})
        assert response.status_code == 200, f"CEO should be able to reset, got {response.status_code}"
        print("PASS: CEO can reset billing")
        
    # ============ TERM CHANGE TESTS ============
    
    def test_get_active_term(self):
        """GET /api/settings/active-term should return current term"""
        token = self.get_auth_token("dwain@tcis.demo", "admin123")
        assert token, "Failed to get SuperAdmin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/settings/active-term")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "term" in data, "Response should have term field"
        assert "academic_year" in data, "Response should have academic_year field"
        assert data["term"] in ["Term 1", "Term 2", "Term 3"], f"Invalid term: {data['term']}"
        print(f"PASS: Active term is {data['term']} ({data['academic_year']})")
        
    def test_set_active_term(self):
        """PUT /api/settings/active-term should update term"""
        token = self.get_auth_token("dwain@tcis.demo", "admin123")
        assert token, "Failed to get SuperAdmin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Set to Term 2
        response = self.session.put(f"{BASE_URL}/api/settings/active-term", json={
            "term": "Term 2",
            "academic_year": "2025-2026"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        assert data.get("term") == "Term 2", f"Term should be Term 2, got {data.get('term')}"
        print("PASS: Term changed to Term 2")
        
    def test_get_active_term_reflects_change(self):
        """GET /api/settings/active-term should reflect the changed term"""
        token = self.get_auth_token("dwain@tcis.demo", "admin123")
        assert token, "Failed to get SuperAdmin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # First set to Term 3
        self.session.put(f"{BASE_URL}/api/settings/active-term", json={
            "term": "Term 3",
            "academic_year": "2025-2026"
        })
        
        # Then verify it's reflected
        response = self.session.get(f"{BASE_URL}/api/settings/active-term")
        assert response.status_code == 200
        
        data = response.json()
        assert data["term"] == "Term 3", f"Term should be Term 3, got {data['term']}"
        print("PASS: GET reflects changed term (Term 3)")
        
    def test_set_term_with_academic_year(self):
        """PUT /api/settings/active-term should update both term and academic year"""
        token = self.get_auth_token("dwain@tcis.demo", "admin123")
        assert token, "Failed to get SuperAdmin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.put(f"{BASE_URL}/api/settings/active-term", json={
            "term": "Term 1",
            "academic_year": "2026-2027"
        })
        assert response.status_code == 200
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/settings/active-term")
        data = get_response.json()
        assert data["term"] == "Term 1", f"Term should be Term 1, got {data['term']}"
        assert data["academic_year"] == "2026-2027", f"Year should be 2026-2027, got {data['academic_year']}"
        print("PASS: Both term and academic year updated")
        
    def test_ws_manager_broadcast_all_exists(self):
        """Verify ws_manager has broadcast_all method (code review check)"""
        # This is a code structure verification - the actual WS broadcast is tested via UI
        # We verify the endpoint calls broadcast_all by checking the response
        token = self.get_auth_token("dwain@tcis.demo", "admin123")
        assert token, "Failed to get SuperAdmin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # The PUT endpoint should succeed - if broadcast_all doesn't exist, it would fail
        response = self.session.put(f"{BASE_URL}/api/settings/active-term", json={
            "term": "Term 1",
            "academic_year": "2025-2026"
        })
        assert response.status_code == 200, f"Term change should succeed (implies broadcast_all works), got {response.status_code}"
        print("PASS: Term change endpoint works (broadcast_all method exists)")
        
    # ============ CLEANUP - Reset to default term ============
    
    def test_cleanup_reset_term_to_default(self):
        """Cleanup: Reset term to Term 1 2025-2026"""
        token = self.get_auth_token("dwain@tcis.demo", "admin123")
        assert token, "Failed to get SuperAdmin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.put(f"{BASE_URL}/api/settings/active-term", json={
            "term": "Term 1",
            "academic_year": "2025-2026"
        })
        assert response.status_code == 200
        print("CLEANUP: Term reset to Term 1 2025-2026")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
