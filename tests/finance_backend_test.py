import requests
import sys
from datetime import datetime, timezone
import json

class FinanceAPITester:
    def __init__(self, base_url="https://tcis-lms-hub-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_invoice_id = None
        self.test_payment_id = None
        self.test_credit_id = None
        self.student_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=15)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=15)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=15)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return success, response_data
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text[:300]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login with finance permissions"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@tcis.demo", "password": "admin123"}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   Token obtained for admin user")
            return True
        return False

    def test_finance_dashboard(self):
        """Test GET /api/finance/dashboard"""
        success, response = self.run_test(
            "Finance Dashboard",
            "GET",
            "finance/dashboard",
            200
        )
        if success:
            required_fields = ['total_invoiced', 'total_collected', 'total_outstanding', 'collection_rate']
            for field in required_fields:
                if field in response:
                    print(f"   ✅ {field}: {response[field]}")
                else:
                    print(f"   ❌ Missing field: {field}")
        return success

    def test_get_students(self):
        """Get students for invoice creation"""
        success, response = self.run_test(
            "Get Students",
            "GET",
            "admin/students",
            200
        )
        if success and response:
            self.student_id = response[0].get('user_id') if response else None
            print(f"   Selected student: {self.student_id}")
        return success

    def test_list_invoices(self):
        """Test GET /api/finance/invoices"""
        success, response = self.run_test(
            "List Invoices",
            "GET", 
            "finance/invoices",
            200
        )
        if success:
            print(f"   Found {len(response)} invoices")
        return success

    def test_create_invoice(self):
        """Test POST /api/finance/invoices"""
        if not self.student_id:
            print("   ⚠️ No student ID available for invoice creation")
            return False

        data = {
            "student_id": self.student_id,
            "term": "Term 1",
            "academic_year": "2025-2026",
            "due_at": "2025-09-15T00:00:00Z",
            "items": [
                {
                    "name": "Tuition Fee",
                    "code": "TUI001",
                    "category": "tuition", 
                    "amount": 3500
                },
                {
                    "name": "Boarding Fee",
                    "code": "BRD001",
                    "category": "boarding",
                    "amount": 1200
                }
            ],
            "notes": "API Test Invoice"
        }
        
        success, response = self.run_test(
            "Create Invoice",
            "POST",
            "finance/invoices",
            200,
            data=data
        )
        
        if success and 'invoice_id' in response:
            self.test_invoice_id = response['invoice_id']
            print(f"   Created invoice: {self.test_invoice_id}")
            print(f"   Total due: GHS {response.get('total_due', 0)}")
        return success

    def test_list_payments(self):
        """Test GET /api/finance/payments"""
        success, response = self.run_test(
            "List Payments",
            "GET",
            "finance/payments", 
            200
        )
        if success:
            print(f"   Found {len(response)} payments")
        return success

    def test_record_payment(self):
        """Test POST /api/finance/payments"""
        if not self.student_id:
            print("   ⚠️ No student ID available for payment recording")
            return False

        data = {
            "student_id": self.student_id,
            "amount": 2000,
            "method": "bank_transfer",
            "reference": f"TEST-PAY-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "payer_name": "Test Parent",
            "received_at": datetime.now(timezone.utc).isoformat()
        }
        
        success, response = self.run_test(
            "Record Payment",
            "POST",
            "finance/payments",
            200,
            data=data
        )
        
        if success and 'payment_id' in response:
            self.test_payment_id = response['payment_id']
            print(f"   Created payment: {self.test_payment_id}")
            print(f"   Amount: GHS {response.get('amount', 0)}")
        return success

    def test_auto_allocate_payment(self):
        """Test POST /api/finance/payments/{id}/auto-allocate"""
        if not self.test_payment_id:
            print("   ⚠️ No test payment available for auto-allocation")
            return False

        success, response = self.run_test(
            "Auto-Allocate Payment",
            "POST",
            f"finance/payments/{self.test_payment_id}/auto-allocate",
            200
        )
        
        if success:
            print(f"   Auto-allocation result: {response.get('message', 'Success')}")
        return success

    def test_list_credit_notes(self):
        """Test GET /api/finance/credit-notes"""
        success, response = self.run_test(
            "List Credit Notes",
            "GET",
            "finance/credit-notes",
            200
        )
        if success:
            print(f"   Found {len(response)} credit notes")
        return success

    def test_create_credit_note(self):
        """Test POST /api/finance/credit-notes"""
        if not self.student_id:
            print("   ⚠️ No student ID available for credit note creation")
            return False

        data = {
            "student_id": self.student_id,
            "amount": 150,
            "reason": "Early payment discount - API Test",
            "type": "discount"
        }
        
        success, response = self.run_test(
            "Create Credit Note",
            "POST",
            "finance/credit-notes",
            200,
            data=data
        )
        
        if success and 'credit_id' in response:
            self.test_credit_id = response['credit_id']
            print(f"   Created credit note: {self.test_credit_id}")
        return success

    def test_approve_credit_note(self):
        """Test POST /api/finance/credit-notes/{id}/approve"""
        if not self.test_credit_id:
            print("   ⚠️ No test credit note available for approval")
            return False

        success, response = self.run_test(
            "Approve Credit Note",
            "POST",
            f"finance/credit-notes/{self.test_credit_id}/approve",
            200
        )
        return success

    def test_apply_credit_note(self):
        """Test POST /api/finance/credit-notes/{id}/apply"""
        if not self.test_credit_id:
            print("   ⚠️ No test credit note available for application")
            return False

        success, response = self.run_test(
            "Apply Credit Note",
            "POST", 
            f"finance/credit-notes/{self.test_credit_id}/apply",
            200
        )
        return success

    def test_arrears_report(self):
        """Test GET /api/finance/reports/arrears-ageing"""
        success, response = self.run_test(
            "Arrears Ageing Report",
            "GET",
            "finance/reports/arrears-ageing",
            200
        )
        if success:
            print(f"   Found {len(response)} students with arrears")
            for arrear in response[:3]:  # Show first 3
                print(f"   - {arrear.get('student_name', 'Unknown')}: GHS {arrear.get('arrears', 0)} ({arrear.get('bucket', 'Unknown')})")
        return success

    def test_collections_report(self):
        """Test GET /api/finance/reports/collections"""
        success, response = self.run_test(
            "Collections Report", 
            "GET",
            "finance/reports/collections",
            200
        )
        if success:
            print(f"   Collection rate: {response.get('collection_rate', 0)}%")
            print(f"   Total invoices: {response.get('total_invoices', 0)}")
            print(f"   Total payments: {response.get('total_payments', 0)}")
        return success

    def test_debtors_report(self):
        """Test GET /api/finance/reports/debtors"""
        success, response = self.run_test(
            "Debtors Report",
            "GET", 
            "finance/reports/debtors",
            200
        )
        if success:
            print(f"   Found {len(response)} debtors")
        return success

    def test_fee_structures(self):
        """Test GET /api/finance/fee-structures"""
        success, response = self.run_test(
            "Fee Structures",
            "GET",
            "finance/fee-structures", 
            200
        )
        if success:
            print(f"   Found {len(response)} fee structures")
        return success

    def test_student_account(self):
        """Test GET /api/finance/students/{id}/account"""
        if not self.student_id:
            print("   ⚠️ No student ID available for account lookup")
            return False

        success, response = self.run_test(
            "Student Account Details",
            "GET",
            f"finance/students/{self.student_id}/account",
            200
        )
        if success:
            account = response.get('account', {})
            print(f"   Balance: GHS {account.get('current_balance', 0)}")
            print(f"   Invoices: {len(response.get('invoices', []))}")
            print(f"   Payments: {len(response.get('payments', []))}")
        return success

def main():
    print("=" * 70)
    print("💰 TCIS NEXUS - Finance Module Backend API Testing")
    print("=" * 70)
    
    tester = FinanceAPITester()
    
    # Test 1: Authentication
    print("\n📋 Step 1: Authentication")
    if not tester.test_admin_login():
        print("❌ Admin login failed - cannot continue with finance tests")
        return 1
    
    # Test 2: Dashboard
    print("\n📋 Step 2: Finance Dashboard")
    tester.test_finance_dashboard()
    
    # Test 3: Setup - Get students
    print("\n📋 Step 3: Setup - Get Students")
    tester.test_get_students()
    
    # Test 4: Invoices
    print("\n📋 Step 4: Invoices Management")
    tester.test_list_invoices()
    tester.test_create_invoice()
    
    # Test 5: Payments
    print("\n📋 Step 5: Payments Management")
    tester.test_list_payments()
    tester.test_record_payment()
    tester.test_auto_allocate_payment()
    
    # Test 6: Credit Notes
    print("\n📋 Step 6: Credit Notes Management")
    tester.test_list_credit_notes()
    tester.test_create_credit_note()
    tester.test_approve_credit_note()
    tester.test_apply_credit_note()
    
    # Test 7: Reports
    print("\n📋 Step 7: Financial Reports")
    tester.test_arrears_report()
    tester.test_collections_report()
    tester.test_debtors_report()
    
    # Test 8: Additional Features
    print("\n📋 Step 8: Additional Features")
    tester.test_fee_structures()
    tester.test_student_account()
    
    # Results summary
    print("\n" + "=" * 70)
    print("📊 FINANCE MODULE BACKEND TEST RESULTS")
    print("=" * 70)
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"Success rate: {success_rate:.1f}%")
    
    if success_rate >= 85:
        print("🟢 Finance APIs are working excellently!")
        return 0
    elif success_rate >= 70:
        print("🟡 Finance APIs are mostly working with minor issues")
        return 1
    else:
        print("🔴 Finance APIs have significant issues")
        return 2

if __name__ == "__main__":
    sys.exit(main())