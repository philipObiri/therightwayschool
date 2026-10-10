"""
Test Parent Payment Bug Fix - Iteration 24
Bug: Parent role was blocked from (1) viewing child's finance profile (student-profile endpoint), 
and (2) submitting payments (record_payment endpoint). Both endpoints only allowed FINANCE_ROLES.
Fix: Added Parent role access with guard — parents can only view/pay for their own children.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARENT_EMAIL = "parent@tcis.demo"
PARENT_PASSWORD = "parent123"
FINANCE_EMAIL = "finance@tcis.demo"
FINANCE_PASSWORD = "finance123"
TEACHER_EMAIL = "edmund@tcis.demo"
TEACHER_PASSWORD = "teacher123"

# Parent's children (from database)
PARENT_CHILD_1 = "user_cc6f5faa1522"  # Ayeyi Forson
PARENT_CHILD_2 = "user_9bf4c71a8000"  # Brandon N.B. Gaisie
NON_CHILD_STUDENT = "user_a1b2c3d4e5f6"  # A student NOT linked to parent


class TestParentPaymentFix:
    """Test Parent role can view child finance profile and submit payments"""
    
    @pytest.fixture(scope="class")
    def parent_token(self):
        """Get Parent authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        assert response.status_code == 200, f"Parent login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def finance_token(self):
        """Get Finance Officer authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": FINANCE_EMAIL,
            "password": FINANCE_PASSWORD
        })
        assert response.status_code == 200, f"Finance login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        """Get Teacher authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        return response.json().get("token")
    
    # ─── Student Profile Endpoint Tests ───
    
    def test_parent_can_view_own_child_profile(self, parent_token):
        """Parent can view finance profile of their own child"""
        response = requests.get(
            f"{BASE_URL}/api/finance/student-profile/{PARENT_CHILD_1}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "student" in data, "Response should contain student info"
        assert "summary" in data, "Response should contain summary"
        assert "invoices" in data, "Response should contain invoices"
        assert "payments" in data, "Response should contain payments"
        print(f"✓ Parent can view child {PARENT_CHILD_1} finance profile")
    
    def test_parent_can_view_second_child_profile(self, parent_token):
        """Parent can view finance profile of their second child"""
        response = requests.get(
            f"{BASE_URL}/api/finance/student-profile/{PARENT_CHILD_2}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "student" in data
        print(f"✓ Parent can view child {PARENT_CHILD_2} finance profile")
    
    def test_parent_cannot_view_non_child_profile(self, parent_token):
        """Parent cannot view finance profile of a student who is not their child"""
        # First, find a student that is NOT the parent's child
        response = requests.get(
            f"{BASE_URL}/api/admin/students",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        # This might fail if parent can't access admin endpoint, so we'll use a known non-child ID
        
        # Try to access a non-existent or non-child student
        response = requests.get(
            f"{BASE_URL}/api/finance/student-profile/{NON_CHILD_STUDENT}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        # Should return 403 (forbidden) or 404 (not found)
        assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}: {response.text}"
        print(f"✓ Parent correctly blocked from viewing non-child profile (status: {response.status_code})")
    
    def test_finance_can_view_any_student_profile(self, finance_token):
        """Finance Officer can view any student's finance profile"""
        response = requests.get(
            f"{BASE_URL}/api/finance/student-profile/{PARENT_CHILD_1}",
            headers={"Authorization": f"Bearer {finance_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Finance Officer can view any student profile")
    
    # ─── Payment Submission Tests ───
    
    def test_parent_can_submit_payment_for_own_child(self, parent_token):
        """Parent can submit payment for their own child"""
        response = requests.post(
            f"{BASE_URL}/api/finance/payments",
            headers={"Authorization": f"Bearer {parent_token}"},
            json={
                "student_id": PARENT_CHILD_1,
                "amount": 100.00,
                "method": "momo",
                "reference": "TEST_PARENT_PAYMENT_001",
                "payer_name": "Nana Amoah Sr."
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "payment_id" in data, "Response should contain payment_id"
        assert data.get("amount") == 100.00, "Amount should match"
        assert data.get("student_id") == PARENT_CHILD_1, "Student ID should match"
        print(f"✓ Parent successfully submitted payment for child: {data.get('payment_id')}")
        return data.get("payment_id")
    
    def test_parent_can_submit_payment_for_second_child(self, parent_token):
        """Parent can submit payment for their second child"""
        response = requests.post(
            f"{BASE_URL}/api/finance/payments",
            headers={"Authorization": f"Bearer {parent_token}"},
            json={
                "student_id": PARENT_CHILD_2,
                "amount": 50.00,
                "method": "bank_transfer",
                "reference": "TEST_PARENT_PAYMENT_002",
                "payer_name": "Nana Amoah Sr."
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "payment_id" in data
        print(f"✓ Parent successfully submitted payment for second child: {data.get('payment_id')}")
    
    def test_parent_cannot_submit_payment_for_non_child(self, parent_token):
        """Parent cannot submit payment for a student who is not their child"""
        response = requests.post(
            f"{BASE_URL}/api/finance/payments",
            headers={"Authorization": f"Bearer {parent_token}"},
            json={
                "student_id": NON_CHILD_STUDENT,
                "amount": 100.00,
                "method": "momo",
                "reference": "TEST_SHOULD_FAIL",
                "payer_name": "Nana Amoah Sr."
            }
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Parent correctly blocked from submitting payment for non-child (403)")
    
    def test_finance_can_still_submit_payment(self, finance_token):
        """Finance Officer can still submit payments (regression check)"""
        response = requests.post(
            f"{BASE_URL}/api/finance/payments",
            headers={"Authorization": f"Bearer {finance_token}"},
            json={
                "student_id": PARENT_CHILD_1,
                "amount": 200.00,
                "method": "cash",
                "reference": "TEST_FINANCE_PAYMENT_001",
                "payer_name": "Finance Office"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "payment_id" in data
        print(f"✓ Finance Officer can still submit payments (regression OK): {data.get('payment_id')}")
    
    def test_teacher_cannot_submit_payment(self, teacher_token):
        """Teacher cannot submit payments (should be blocked)"""
        response = requests.post(
            f"{BASE_URL}/api/finance/payments",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={
                "student_id": PARENT_CHILD_1,
                "amount": 100.00,
                "method": "momo",
                "reference": "TEST_TEACHER_SHOULD_FAIL"
            }
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Teacher correctly blocked from submitting payments (403)")
    
    # ─── Verify Payment Appears in Profile ───
    
    def test_parent_payment_appears_in_child_profile(self, parent_token):
        """Verify parent's payment appears in child's finance profile"""
        # First submit a payment
        pay_response = requests.post(
            f"{BASE_URL}/api/finance/payments",
            headers={"Authorization": f"Bearer {parent_token}"},
            json={
                "student_id": PARENT_CHILD_1,
                "amount": 75.00,
                "method": "momo",
                "reference": "TEST_VERIFY_PAYMENT_003",
                "payer_name": "Nana Amoah Sr."
            }
        )
        assert pay_response.status_code == 200
        payment_id = pay_response.json().get("payment_id")
        
        # Now fetch the profile and verify payment is there
        profile_response = requests.get(
            f"{BASE_URL}/api/finance/student-profile/{PARENT_CHILD_1}",
            headers={"Authorization": f"Bearer {parent_token}"}
        )
        assert profile_response.status_code == 200
        data = profile_response.json()
        payments = data.get("payments", [])
        payment_ids = [p.get("payment_id") for p in payments]
        assert payment_id in payment_ids, f"Payment {payment_id} should appear in profile"
        print(f"✓ Parent's payment {payment_id} appears in child's finance profile")


class TestParentLoginAndAccess:
    """Test Parent can login and access parent portal"""
    
    def test_parent_login(self):
        """Parent can login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        assert response.status_code == 200, f"Parent login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert data.get("user", {}).get("role") == "Parent", "User role should be Parent"
        assert "children_ids" in data.get("user", {}), "User should have children_ids"
        children = data.get("user", {}).get("children_ids", [])
        assert PARENT_CHILD_1 in children, f"Child {PARENT_CHILD_1} should be in children_ids"
        assert PARENT_CHILD_2 in children, f"Child {PARENT_CHILD_2} should be in children_ids"
        print(f"✓ Parent login successful, children_ids: {children}")
    
    def test_parent_can_access_me_endpoint(self):
        """Parent can access /api/auth/me endpoint"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        token = login_response.json().get("token")
        
        # Access /me endpoint
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("role") == "Parent"
        print("✓ Parent can access /api/auth/me endpoint")


# Cleanup fixture to remove test payments
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_payments():
    """Cleanup test payments after all tests complete"""
    yield
    # After tests, cleanup TEST_ prefixed payments
    try:
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": FINANCE_EMAIL,
            "password": FINANCE_PASSWORD
        })
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            # Get all payments and delete TEST_ ones
            payments_response = requests.get(
                f"{BASE_URL}/api/finance/payments",
                headers={"Authorization": f"Bearer {token}"}
            )
            if payments_response.status_code == 200:
                for payment in payments_response.json():
                    ref = payment.get("reference", "")
                    if ref.startswith("TEST_"):
                        # Reverse the payment
                        requests.post(
                            f"{BASE_URL}/api/finance/payments/{payment['payment_id']}/reverse",
                            headers={"Authorization": f"Bearer {token}"},
                            json={"reason": "Test cleanup"}
                        )
                        print(f"Cleaned up test payment: {payment['payment_id']}")
    except Exception as e:
        print(f"Cleanup warning: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
