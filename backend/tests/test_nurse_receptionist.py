"""
Test Suite for Nurse (Sick Bay) and Receptionist Modules
Tests: Authentication, Dashboard, CRUD operations, and integrations
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
NURSE_CREDS = {"email": "nurse@tcis.demo", "password": "nurse123"}
RECEPTIONIST_CREDS = {"email": "reception@tcis.demo", "password": "reception123"}
CEO_CREDS = {"email": "ceo@tcis.demo", "password": "ceo123"}


@pytest.fixture(scope="module")
def nurse_token():
    """Get nurse authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=NURSE_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Nurse login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def receptionist_token():
    """Get receptionist authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=RECEPTIONIST_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Receptionist login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def ceo_token():
    """Get CEO authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"CEO login failed: {response.status_code} - {response.text}")


class TestNurseAuthentication:
    """Test Nurse login and role verification"""
    
    def test_nurse_login_success(self):
        """Nurse can login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=NURSE_CREDS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "Nurse"
        print(f"✓ Nurse login successful - User: {data['user']['name']}")
    
    def test_nurse_login_wrong_password(self):
        """Nurse login fails with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nurse@tcis.demo",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestReceptionistAuthentication:
    """Test Receptionist login and role verification"""
    
    def test_receptionist_login_success(self):
        """Receptionist can login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=RECEPTIONIST_CREDS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "Receptionist"
        print(f"✓ Receptionist login successful - User: {data['user']['name']}")
    
    def test_receptionist_login_wrong_password(self):
        """Receptionist login fails with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "reception@tcis.demo",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestNurseDashboard:
    """Test Nurse Dashboard API"""
    
    def test_nurse_dashboard_access(self, nurse_token):
        """Nurse can access sick bay dashboard"""
        headers = {"Authorization": f"Bearer {nurse_token}"}
        response = requests.get(f"{BASE_URL}/api/sick-bay/dashboard", headers=headers)
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        # Verify dashboard stats structure
        assert "active_admissions" in data
        assert "today_admissions" in data
        assert "today_discharged" in data
        assert "total_records" in data
        assert "low_stock_meds" in data
        assert "recent_admissions" in data
        print(f"✓ Nurse dashboard: Active={data['active_admissions']}, Today={data['today_admissions']}, Low Stock={data['low_stock_meds']}")
    
    def test_nurse_dashboard_unauthorized(self):
        """Dashboard requires authentication"""
        response = requests.get(f"{BASE_URL}/api/sick-bay/dashboard")
        assert response.status_code in [401, 403]


class TestSickBayAdmissions:
    """Test Sick Bay Admissions CRUD"""
    
    def test_list_admissions(self, nurse_token):
        """Nurse can list all admissions"""
        headers = {"Authorization": f"Bearer {nurse_token}"}
        response = requests.get(f"{BASE_URL}/api/sick-bay/admissions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} sick bay admissions")
    
    def test_list_active_admissions(self, nurse_token):
        """Nurse can filter active admissions"""
        headers = {"Authorization": f"Bearer {nurse_token}"}
        response = requests.get(f"{BASE_URL}/api/sick-bay/admissions?status=active", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} active admissions")
    
    def test_search_students(self, nurse_token):
        """Nurse can search students for admission"""
        headers = {"Authorization": f"Bearer {nurse_token}"}
        response = requests.get(f"{BASE_URL}/api/sick-bay/students/search?q=ay", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Student search returned {len(data)} results")


class TestMedicalInventory:
    """Test Medical Inventory CRUD"""
    
    def test_list_medical_inventory(self, nurse_token):
        """Nurse can list medical inventory"""
        headers = {"Authorization": f"Bearer {nurse_token}"}
        response = requests.get(f"{BASE_URL}/api/sick-bay/inventory", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} medical inventory items")
    
    def test_add_medical_item(self, nurse_token):
        """Nurse can add medical inventory item"""
        headers = {"Authorization": f"Bearer {nurse_token}"}
        item_data = {
            "name": "TEST_Paracetamol 500mg",
            "category": "medication",
            "description": "Pain relief tablets",
            "quantity": 100,
            "unit": "tablets",
            "min_threshold": 20,
            "expiry_date": "2027-12-31",
            "supplier": "Test Pharma"
        }
        response = requests.post(f"{BASE_URL}/api/sick-bay/inventory", json=item_data, headers=headers)
        assert response.status_code == 200, f"Add item failed: {response.text}"
        data = response.json()
        assert data["name"] == item_data["name"]
        assert data["quantity"] == item_data["quantity"]
        assert "item_id" in data
        print(f"✓ Added medical item: {data['name']} (ID: {data['item_id']})")
        return data["item_id"]
    
    def test_update_medical_item(self, nurse_token):
        """Nurse can update medical inventory item"""
        headers = {"Authorization": f"Bearer {nurse_token}"}
        # First add an item
        item_data = {
            "name": "TEST_Bandages",
            "category": "first_aid",
            "quantity": 50,
            "unit": "rolls",
            "min_threshold": 10
        }
        add_response = requests.post(f"{BASE_URL}/api/sick-bay/inventory", json=item_data, headers=headers)
        assert add_response.status_code == 200
        item_id = add_response.json()["item_id"]
        
        # Update the item
        update_data = {"quantity_change": -5, "reason": "Used for patient"}
        update_response = requests.put(f"{BASE_URL}/api/sick-bay/inventory/{item_id}", json=update_data, headers=headers)
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["quantity"] == 45  # 50 - 5
        print(f"✓ Updated medical item quantity: {updated['quantity']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/sick-bay/inventory/{item_id}", headers=headers)


class TestEmergencyAlert:
    """Test Emergency Alert functionality"""
    
    def test_send_emergency_alert(self, nurse_token):
        """Nurse can send emergency alert"""
        headers = {"Authorization": f"Bearer {nurse_token}"}
        alert_data = {
            "student_id": "",
            "student_name": "Test Student",
            "description": "TEST EMERGENCY - Please ignore"
        }
        response = requests.post(f"{BASE_URL}/api/sick-bay/emergency", json=alert_data, headers=headers)
        assert response.status_code == 200, f"Emergency alert failed: {response.text}"
        data = response.json()
        assert "alert_id" in data
        assert "message" in data
        print(f"✓ Emergency alert sent: {data['alert_id']}")


class TestReceptionistDashboard:
    """Test Receptionist Dashboard API"""
    
    def test_receptionist_dashboard_access(self, receptionist_token):
        """Receptionist can access dashboard"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/dashboard", headers=headers)
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        # Verify dashboard stats structure
        assert "today_payments" in data
        assert "pending_procurement" in data
        assert "low_stock_count" in data
        assert "total_inventory" in data
        assert "recent_payments" in data
        assert "low_stock_items" in data
        print(f"✓ Receptionist dashboard: Payments={data['today_payments']}, Procurement={data['pending_procurement']}, Low Stock={data['low_stock_count']}")


class TestReceptionistInventory:
    """Test Receptionist Inventory CRUD"""
    
    def test_list_inventory(self, receptionist_token):
        """Receptionist can list inventory"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/inventory", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} inventory items")
    
    def test_add_inventory_item(self, receptionist_token):
        """Receptionist can add inventory item"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        item_data = {
            "name": "TEST_School Shirt (M)",
            "category": "uniforms",
            "description": "Medium size school shirt",
            "quantity": 50,
            "unit_price": 45.00,
            "min_threshold": 10,
            "supplier": "Test Uniforms Ltd"
        }
        response = requests.post(f"{BASE_URL}/api/receptionist/inventory", json=item_data, headers=headers)
        assert response.status_code == 200, f"Add item failed: {response.text}"
        data = response.json()
        assert data["name"] == item_data["name"]
        assert data["quantity"] == item_data["quantity"]
        assert data["unit_price"] == item_data["unit_price"]
        assert "item_id" in data
        print(f"✓ Added inventory item: {data['name']} (ID: {data['item_id']})")
        return data["item_id"]
    
    def test_adjust_inventory_stock(self, receptionist_token):
        """Receptionist can adjust inventory stock"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        # First add an item
        item_data = {
            "name": "TEST_School Trousers",
            "category": "uniforms",
            "quantity": 30,
            "unit_price": 60.00,
            "min_threshold": 5
        }
        add_response = requests.post(f"{BASE_URL}/api/receptionist/inventory", json=item_data, headers=headers)
        assert add_response.status_code == 200
        item_id = add_response.json()["item_id"]
        
        # Adjust stock
        adjust_data = {"quantity_change": 20, "reason": "New stock received"}
        adjust_response = requests.put(f"{BASE_URL}/api/receptionist/inventory/{item_id}", json=adjust_data, headers=headers)
        assert adjust_response.status_code == 200
        updated = adjust_response.json()
        assert updated["quantity"] == 50  # 30 + 20
        print(f"✓ Adjusted inventory stock: {updated['quantity']}")


class TestProcurementRequests:
    """Test Procurement Requests CRUD"""
    
    def test_list_procurement_requests(self, receptionist_token):
        """Receptionist can list procurement requests"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/procurement", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} procurement requests")
    
    def test_create_procurement_request(self, receptionist_token):
        """Receptionist can create procurement request"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        request_data = {
            "title": "TEST_Term 3 Uniform Restock",
            "items": [
                {"name": "School Shirts (M)", "qty": 50, "unit_price": 45.00},
                {"name": "School Trousers (M)", "qty": 30, "unit_price": 60.00}
            ],
            "total_cost": 4050.00,
            "category": "uniforms",
            "urgency": "normal",
            "supplier": "Test Uniforms Ltd",
            "notes": "Test procurement request"
        }
        response = requests.post(f"{BASE_URL}/api/receptionist/procurement", json=request_data, headers=headers)
        assert response.status_code == 200, f"Create procurement failed: {response.text}"
        data = response.json()
        assert data["title"] == request_data["title"]
        assert data["status"] == "pending"
        assert "request_id" in data
        print(f"✓ Created procurement request: {data['title']} (ID: {data['request_id']})")
    
    def test_filter_pending_procurement(self, receptionist_token):
        """Receptionist can filter pending procurement requests"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/procurement?status=pending", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for req in data:
            assert req["status"] == "pending"
        print(f"✓ Filtered {len(data)} pending procurement requests")


class TestParentCommunication:
    """Test Parent Communication functionality"""
    
    def test_search_parents(self, receptionist_token):
        """Receptionist can search parents"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/parents/search?q=na", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Parent search returned {len(data)} results")
    
    def test_list_messages(self, receptionist_token):
        """Receptionist can list sent messages"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/messages", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} messages")


class TestUniformBilling:
    """Test Uniform Billing functionality"""
    
    def test_list_uniform_items(self, receptionist_token):
        """Receptionist can list uniform items"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/uniform-items", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} uniform items")
    
    def test_list_uniform_invoices(self, receptionist_token):
        """Receptionist can list uniform invoices"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/uniform-invoices", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} uniform invoices")
    
    def test_search_students_for_billing(self, receptionist_token):
        """Receptionist can search students for billing"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/students/search?q=ay", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Student search for billing returned {len(data)} results")


class TestAdminDashboardAccess:
    """Test Admin Dashboard access for Receptionist (without fee data)"""
    
    def test_receptionist_can_access_admin_dashboard(self, receptionist_token):
        """Receptionist can access admin dashboard API"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        assert response.status_code == 200, f"Admin dashboard access failed: {response.text}"
        data = response.json()
        # Verify basic stats are present
        assert "total_students" in data
        assert "total_teachers" in data
        assert "total_classes" in data
        print(f"✓ Receptionist can access admin dashboard: Students={data['total_students']}, Teachers={data['total_teachers']}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_inventory(self, nurse_token, receptionist_token):
        """Remove TEST_ prefixed items"""
        # Cleanup medical inventory
        nurse_headers = {"Authorization": f"Bearer {nurse_token}"}
        med_response = requests.get(f"{BASE_URL}/api/sick-bay/inventory", headers=nurse_headers)
        if med_response.status_code == 200:
            for item in med_response.json():
                if item.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/sick-bay/inventory/{item['item_id']}", headers=nurse_headers)
        
        # Cleanup receptionist inventory
        rec_headers = {"Authorization": f"Bearer {receptionist_token}"}
        inv_response = requests.get(f"{BASE_URL}/api/receptionist/inventory", headers=rec_headers)
        if inv_response.status_code == 200:
            for item in inv_response.json():
                if item.get("name", "").startswith("TEST_"):
                    # Note: No delete endpoint for receptionist inventory, so we skip
                    pass
        
        print("✓ Cleanup completed")
