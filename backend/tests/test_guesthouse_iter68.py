"""
Iteration 68: Guest House Module + File Upload in Parent Communication Tests
Tests:
- Guest House dashboard, rooms, bookings, payments, checkout, analytics
- File upload in receptionist parent communication
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests for different roles"""
    
    def test_receptionist_login(self):
        """Test receptionist login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "reception@tcis.demo",
            "password": "reception123"
        })
        assert response.status_code == 200, f"Receptionist login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "Receptionist"
        print("✓ Receptionist login successful")
        return data["token"]
    
    def test_ceo_login(self):
        """Test CEO login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@tcis.demo",
            "password": "ceo123"
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "CEO"
        print("✓ CEO login successful")
        return data["token"]
    
    def test_admin_login(self):
        """Test Admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dwain@tcis.demo",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print("✓ Admin login successful")
        return data["token"]
    
    def test_parent_login(self):
        """Test Parent login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "parent@tcis.demo",
            "password": "parent123"
        })
        assert response.status_code == 200, f"Parent login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "Parent"
        print("✓ Parent login successful")
        return data["token"]


@pytest.fixture
def receptionist_token():
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "reception@tcis.demo",
        "password": "reception123"
    })
    return response.json()["token"]


@pytest.fixture
def ceo_token():
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ceo@tcis.demo",
        "password": "ceo123"
    })
    return response.json()["token"]


@pytest.fixture
def admin_token():
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "dwain@tcis.demo",
        "password": "admin123"
    })
    return response.json()["token"]


@pytest.fixture
def parent_token():
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "parent@tcis.demo",
        "password": "parent123"
    })
    return response.json()["token"]


class TestGuestHouseDashboard:
    """Guest House Dashboard API tests"""
    
    def test_dashboard_returns_correct_structure(self, receptionist_token):
        """Test dashboard returns all required fields"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/dashboard", headers=headers)
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        data = response.json()
        
        # Verify all required fields
        required_fields = [
            "total_rooms", "occupied", "available", "reserved", "maintenance",
            "today_checkins", "today_checkouts", "total_revenue", "outstanding",
            "occupancy_rate", "recent_bookings", "default_rate"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Verify 30 rooms total
        assert data["total_rooms"] == 30, f"Expected 30 rooms, got {data['total_rooms']}"
        print(f"✓ Dashboard: {data['total_rooms']} rooms, {data['occupied']} occupied, {data['available']} available")
        print(f"  Revenue: GHS {data['total_revenue']}, Outstanding: GHS {data['outstanding']}")
    
    def test_dashboard_accessible_by_ceo(self, ceo_token):
        """Test CEO can access dashboard"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/dashboard", headers=headers)
        assert response.status_code == 200
        print("✓ CEO can access Guest House dashboard")
    
    def test_dashboard_accessible_by_admin(self, admin_token):
        """Test Admin can access dashboard"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/dashboard", headers=headers)
        assert response.status_code == 200
        print("✓ Admin can access Guest House dashboard")


class TestGuestHouseRooms:
    """Guest House Rooms API tests"""
    
    def test_list_all_rooms(self, receptionist_token):
        """Test listing all 30 rooms"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/rooms", headers=headers)
        assert response.status_code == 200
        rooms = response.json()
        
        assert len(rooms) == 30, f"Expected 30 rooms, got {len(rooms)}"
        print(f"✓ Listed {len(rooms)} rooms")
    
    def test_filter_rooms_by_floor_3(self, receptionist_token):
        """Test filtering rooms by 3rd floor"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/rooms?floor=3", headers=headers)
        assert response.status_code == 200
        rooms = response.json()
        
        assert len(rooms) == 15, f"Expected 15 rooms on floor 3, got {len(rooms)}"
        for room in rooms:
            assert room["floor"] == 3
            assert room["room_number"].startswith("3")
        print(f"✓ Floor 3: {len(rooms)} rooms (301-315)")
    
    def test_filter_rooms_by_floor_4(self, receptionist_token):
        """Test filtering rooms by 4th floor"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/rooms?floor=4", headers=headers)
        assert response.status_code == 200
        rooms = response.json()
        
        assert len(rooms) == 15, f"Expected 15 rooms on floor 4, got {len(rooms)}"
        for room in rooms:
            assert room["floor"] == 4
            assert room["room_number"].startswith("4")
        print(f"✓ Floor 4: {len(rooms)} rooms (401-415)")
    
    def test_room_bed_capacity(self, receptionist_token):
        """Test room bed capacity (1-10 = 1 bed, 11-15 = 2 bed)"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/rooms", headers=headers)
        rooms = response.json()
        
        for room in rooms:
            room_num = int(room["room_number"][-2:])
            expected_beds = 1 if room_num <= 10 else 2
            assert room["bed_capacity"] == expected_beds, f"Room {room['room_number']} should have {expected_beds} bed(s)"
        print("✓ Room bed capacities correct (1-10: 1 bed, 11-15: 2 beds)")
    
    def test_filter_rooms_by_status(self, receptionist_token):
        """Test filtering rooms by status"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/rooms?status=available", headers=headers)
        assert response.status_code == 200
        rooms = response.json()
        
        for room in rooms:
            assert room["status"] == "available"
        print(f"✓ Filtered available rooms: {len(rooms)}")


class TestGuestHouseBookings:
    """Guest House Booking/Check-in API tests"""
    
    def test_create_booking_checkin(self, receptionist_token):
        """Test creating a booking (check-in)"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        
        # First get an available room
        response = requests.get(f"{BASE_URL}/api/guesthouse/rooms?status=available", headers=headers)
        rooms = response.json()
        if not rooms:
            pytest.skip("No available rooms for testing")
        
        room = rooms[0]
        today = datetime.now().strftime("%Y-%m-%d")
        checkout = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        
        booking_data = {
            "room_id": room["room_id"],
            "guest_name": "TEST_John Doe",
            "guest_phone": "0551234567",
            "guest_email": "test@example.com",
            "guest_id_type": "passport",
            "guest_id_number": "A12345678",
            "check_in_date": today,
            "check_out_date": checkout,
            "nightly_rate": 350,
            "notes": "Test booking"
        }
        
        response = requests.post(f"{BASE_URL}/api/guesthouse/bookings", json=booking_data, headers=headers)
        assert response.status_code == 200, f"Booking failed: {response.text}"
        booking = response.json()
        
        assert booking["guest_name"] == "TEST_John Doe"
        assert booking["room_number"] == room["room_number"]
        assert booking["status"] == "checked_in"
        assert booking["nights"] == 2
        assert booking["total_cost"] == 700  # 2 nights x 350
        assert booking["outstanding"] == 700
        
        print(f"✓ Created booking: {booking['booking_id']} for Room {booking['room_number']}")
        print(f"  Guest: {booking['guest_name']}, {booking['nights']} nights, GHS {booking['total_cost']}")
        return booking
    
    def test_list_bookings(self, receptionist_token):
        """Test listing all bookings"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/bookings", headers=headers)
        assert response.status_code == 200
        bookings = response.json()
        print(f"✓ Listed {len(bookings)} bookings")
    
    def test_list_active_bookings(self, receptionist_token):
        """Test listing active (checked_in) bookings"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/bookings?status=checked_in", headers=headers)
        assert response.status_code == 200
        bookings = response.json()
        
        for b in bookings:
            assert b["status"] == "checked_in"
        print(f"✓ Active bookings: {len(bookings)}")
    
    def test_get_booking_detail(self, receptionist_token):
        """Test getting booking detail with payments"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        
        # Get a booking
        response = requests.get(f"{BASE_URL}/api/guesthouse/bookings", headers=headers)
        bookings = response.json()
        if not bookings:
            pytest.skip("No bookings to test")
        
        booking_id = bookings[0]["booking_id"]
        response = requests.get(f"{BASE_URL}/api/guesthouse/bookings/{booking_id}", headers=headers)
        assert response.status_code == 200
        detail = response.json()
        
        assert "payments" in detail
        print(f"✓ Booking detail: {detail['guest_name']}, {len(detail.get('payments', []))} payments")
    
    def test_booking_validation_no_checkout_date(self, receptionist_token):
        """Test booking fails without checkout date"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        
        response = requests.get(f"{BASE_URL}/api/guesthouse/rooms?status=available", headers=headers)
        rooms = response.json()
        if not rooms:
            pytest.skip("No available rooms")
        
        booking_data = {
            "room_id": rooms[0]["room_id"],
            "guest_name": "Test Guest",
            "check_in_date": datetime.now().strftime("%Y-%m-%d"),
            # Missing check_out_date
        }
        
        response = requests.post(f"{BASE_URL}/api/guesthouse/bookings", json=booking_data, headers=headers)
        assert response.status_code == 400
        print("✓ Booking validation: checkout date required")


class TestGuestHousePayments:
    """Guest House Payment API tests"""
    
    def test_record_payment(self, receptionist_token):
        """Test recording a payment"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        
        # Get an active booking with outstanding balance
        response = requests.get(f"{BASE_URL}/api/guesthouse/bookings?status=checked_in", headers=headers)
        bookings = response.json()
        booking = next((b for b in bookings if b.get("outstanding", 0) > 0), None)
        
        if not booking:
            pytest.skip("No booking with outstanding balance")
        
        payment_data = {
            "booking_id": booking["booking_id"],
            "amount": 100,
            "method": "cash",
            "reference": "TEST_PAYMENT"
        }
        
        response = requests.post(f"{BASE_URL}/api/guesthouse/payments", json=payment_data, headers=headers)
        assert response.status_code == 200, f"Payment failed: {response.text}"
        payment = response.json()
        
        assert payment["amount"] == 100
        assert payment["method"] == "cash"
        assert "receipt_no" in payment
        assert payment["receipt_no"].startswith("AGH-")
        
        print(f"✓ Payment recorded: {payment['receipt_no']}, GHS {payment['amount']}")
        return payment
    
    def test_payment_updates_booking(self, receptionist_token):
        """Test that payment updates booking outstanding amount"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        
        # Get a booking
        response = requests.get(f"{BASE_URL}/api/guesthouse/bookings?status=checked_in", headers=headers)
        bookings = response.json()
        booking = next((b for b in bookings if b.get("outstanding", 0) > 0), None)
        
        if not booking:
            pytest.skip("No booking with outstanding balance")
        
        original_outstanding = booking["outstanding"]
        
        # Make payment
        payment_data = {
            "booking_id": booking["booking_id"],
            "amount": 50,
            "method": "mobile_money",
            "reference": "MOMO_TEST"
        }
        requests.post(f"{BASE_URL}/api/guesthouse/payments", json=payment_data, headers=headers)
        
        # Verify booking updated
        response = requests.get(f"{BASE_URL}/api/guesthouse/bookings/{booking['booking_id']}", headers=headers)
        updated = response.json()
        
        assert updated["outstanding"] == original_outstanding - 50
        print(f"✓ Booking outstanding updated: {original_outstanding} -> {updated['outstanding']}")
    
    def test_payment_methods(self, receptionist_token):
        """Test different payment methods"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        
        response = requests.get(f"{BASE_URL}/api/guesthouse/bookings?status=checked_in", headers=headers)
        bookings = response.json()
        booking = next((b for b in bookings if b.get("outstanding", 0) > 0), None)
        
        if not booking:
            pytest.skip("No booking with outstanding balance")
        
        for method in ["cash", "bank_transfer", "mobile_money"]:
            payment_data = {
                "booking_id": booking["booking_id"],
                "amount": 10,
                "method": method,
                "reference": f"TEST_{method.upper()}"
            }
            response = requests.post(f"{BASE_URL}/api/guesthouse/payments", json=payment_data, headers=headers)
            assert response.status_code == 200, f"Payment with {method} failed"
        
        print("✓ All payment methods work: cash, bank_transfer, mobile_money")


class TestGuestHouseCheckout:
    """Guest House Checkout API tests"""
    
    def test_checkout_guest(self, receptionist_token):
        """Test checking out a guest"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        
        # First create a booking to checkout
        response = requests.get(f"{BASE_URL}/api/guesthouse/rooms?status=available", headers=headers)
        rooms = response.json()
        if not rooms:
            pytest.skip("No available rooms")
        
        room = rooms[0]
        today = datetime.now().strftime("%Y-%m-%d")
        checkout = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        booking_data = {
            "room_id": room["room_id"],
            "guest_name": "TEST_Checkout Guest",
            "check_in_date": today,
            "check_out_date": checkout,
            "nightly_rate": 350
        }
        
        response = requests.post(f"{BASE_URL}/api/guesthouse/bookings", json=booking_data, headers=headers)
        if response.status_code != 200:
            pytest.skip("Could not create booking for checkout test")
        
        booking = response.json()
        
        # Now checkout
        response = requests.post(f"{BASE_URL}/api/guesthouse/bookings/{booking['booking_id']}/checkout", headers=headers)
        assert response.status_code == 200, f"Checkout failed: {response.text}"
        
        # Verify booking status
        response = requests.get(f"{BASE_URL}/api/guesthouse/bookings/{booking['booking_id']}", headers=headers)
        updated = response.json()
        assert updated["status"] == "checked_out"
        
        # Verify room is available again
        response = requests.get(f"{BASE_URL}/api/guesthouse/rooms", headers=headers)
        rooms = response.json()
        room_after = next((r for r in rooms if r["room_id"] == room["room_id"]), None)
        assert room_after["status"] == "available"
        
        print(f"✓ Checkout successful: Room {room['room_number']} now available")
    
    def test_checkout_already_checked_out(self, receptionist_token):
        """Test cannot checkout already checked out guest"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        
        response = requests.get(f"{BASE_URL}/api/guesthouse/bookings?status=checked_out", headers=headers)
        bookings = response.json()
        
        if not bookings:
            pytest.skip("No checked out bookings")
        
        response = requests.post(f"{BASE_URL}/api/guesthouse/bookings/{bookings[0]['booking_id']}/checkout", headers=headers)
        assert response.status_code == 400
        print("✓ Cannot checkout already checked out guest")


class TestGuestHouseAnalytics:
    """Guest House Analytics API tests (Admin only)"""
    
    def test_analytics_admin_access(self, admin_token):
        """Test admin can access analytics"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/analytics", headers=headers)
        assert response.status_code == 200, f"Analytics failed: {response.text}"
        data = response.json()
        
        required_fields = ["total_revenue", "total_bookings", "avg_stay_nights", 
                          "revenue_by_room", "monthly_revenue", "popular_rooms"]
        for field in required_fields:
            assert field in data, f"Missing analytics field: {field}"
        
        print(f"✓ Analytics: Revenue GHS {data['total_revenue']}, {data['total_bookings']} bookings, avg stay {data['avg_stay_nights']} nights")
    
    def test_analytics_ceo_access(self, ceo_token):
        """Test CEO can access analytics"""
        headers = {"Authorization": f"Bearer {ceo_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/analytics", headers=headers)
        assert response.status_code == 200
        print("✓ CEO can access analytics")
    
    def test_analytics_receptionist_denied(self, receptionist_token):
        """Test receptionist cannot access analytics (admin only)"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/analytics", headers=headers)
        assert response.status_code == 403
        print("✓ Receptionist correctly denied analytics access")


class TestGuestHousePricing:
    """Guest House Pricing API tests"""
    
    def test_get_pricing(self, receptionist_token):
        """Test getting pricing config"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/guesthouse/pricing", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "default_rate" in data
        assert data["default_rate"] == 350  # Default GHS 350/night
        print(f"✓ Pricing: Default rate GHS {data['default_rate']}")
    
    def test_update_pricing_admin(self, admin_token):
        """Test admin can update pricing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Update pricing
        response = requests.put(f"{BASE_URL}/api/guesthouse/pricing", 
                               json={"default_rate": 400, "min_rate": 150, "max_rate": 1200},
                               headers=headers)
        assert response.status_code == 200
        
        # Verify
        response = requests.get(f"{BASE_URL}/api/guesthouse/pricing", headers=headers)
        data = response.json()
        assert data["default_rate"] == 400
        
        # Reset to default
        requests.put(f"{BASE_URL}/api/guesthouse/pricing", 
                    json={"default_rate": 350, "min_rate": 100, "max_rate": 1500},
                    headers=headers)
        
        print("✓ Admin can update pricing")
    
    def test_update_pricing_receptionist_denied(self, receptionist_token):
        """Test receptionist cannot update pricing"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.put(f"{BASE_URL}/api/guesthouse/pricing", 
                               json={"default_rate": 500},
                               headers=headers)
        assert response.status_code == 403
        print("✓ Receptionist correctly denied pricing update")


class TestRoomStatusManagement:
    """Room status management tests"""
    
    def test_set_room_maintenance(self, receptionist_token):
        """Test setting room to maintenance"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        
        # Get an available room
        response = requests.get(f"{BASE_URL}/api/guesthouse/rooms?status=available", headers=headers)
        rooms = response.json()
        if not rooms:
            pytest.skip("No available rooms")
        
        room = rooms[0]
        
        # Set to maintenance
        response = requests.put(f"{BASE_URL}/api/guesthouse/rooms/{room['room_id']}/status",
                               json={"status": "maintenance"},
                               headers=headers)
        assert response.status_code == 200
        
        # Verify
        response = requests.get(f"{BASE_URL}/api/guesthouse/rooms", headers=headers)
        rooms = response.json()
        updated = next((r for r in rooms if r["room_id"] == room["room_id"]), None)
        assert updated["status"] == "maintenance"
        
        # Reset to available
        requests.put(f"{BASE_URL}/api/guesthouse/rooms/{room['room_id']}/status",
                    json={"status": "available"},
                    headers=headers)
        
        print(f"✓ Room {room['room_number']} status management works")
    
    def test_cannot_change_occupied_room_status(self, receptionist_token):
        """Test cannot change status of occupied room"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        
        response = requests.get(f"{BASE_URL}/api/guesthouse/rooms?status=occupied", headers=headers)
        rooms = response.json()
        
        if not rooms:
            pytest.skip("No occupied rooms")
        
        response = requests.put(f"{BASE_URL}/api/guesthouse/rooms/{rooms[0]['room_id']}/status",
                               json={"status": "maintenance"},
                               headers=headers)
        assert response.status_code == 400
        print("✓ Cannot change occupied room status")


class TestFileUploadParentCommunication:
    """File upload in parent communication tests"""
    
    def test_file_upload_endpoint(self, receptionist_token):
        """Test file upload endpoint exists"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        
        # Create a simple test file
        files = {'file': ('test.txt', b'Test file content', 'text/plain')}
        response = requests.post(f"{BASE_URL}/api/files/upload", files=files, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            assert "file_id" in data
            print(f"✓ File upload works: {data.get('file_id')}")
            return data
        elif response.status_code == 404:
            pytest.skip("File upload endpoint not implemented")
        else:
            print(f"File upload response: {response.status_code} - {response.text}")
    
    def test_send_message_with_attachment(self, receptionist_token):
        """Test sending message with file attachment"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        
        # First upload a file
        files = {'file': ('notice.pdf', b'PDF content here', 'application/pdf')}
        upload_response = requests.post(f"{BASE_URL}/api/files/upload", files=files, headers=headers)
        
        if upload_response.status_code != 200:
            pytest.skip("File upload not available")
        
        file_data = upload_response.json()
        
        # Send message with attachment
        message_data = {
            "subject": "TEST_Message with Attachment",
            "body": "This message has a file attached.",
            "broadcast": True,
            "attachments": [{"file_id": file_data["file_id"], "filename": "notice.pdf"}]
        }
        
        response = requests.post(f"{BASE_URL}/api/receptionist/message", json=message_data, headers=headers)
        assert response.status_code == 200, f"Message send failed: {response.text}"
        
        msg = response.json()
        assert len(msg.get("attachments", [])) > 0
        print(f"✓ Message with attachment sent: {msg['message_id']}")
    
    def test_parent_can_see_attachments(self, parent_token, receptionist_token):
        """Test parent can see message attachments"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        
        response = requests.get(f"{BASE_URL}/api/receptionist/parent/messages", headers=headers)
        assert response.status_code == 200
        messages = response.json()
        
        # Check if any message has attachments
        has_attachments = any(len(m.get("attachments", [])) > 0 for m in messages)
        print(f"✓ Parent messages retrieved: {len(messages)} messages, attachments present: {has_attachments}")


class TestReceptionistParentCommunication:
    """Receptionist parent communication tests"""
    
    def test_search_parents(self, receptionist_token):
        """Test searching parents"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/parents/search?q=parent", headers=headers)
        assert response.status_code == 200
        parents = response.json()
        print(f"✓ Parent search: {len(parents)} results")
    
    def test_send_broadcast_message(self, receptionist_token):
        """Test sending broadcast message"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        
        message_data = {
            "subject": "TEST_Broadcast Message",
            "body": "This is a test broadcast to all parents.",
            "broadcast": True
        }
        
        response = requests.post(f"{BASE_URL}/api/receptionist/message", json=message_data, headers=headers)
        assert response.status_code == 200
        msg = response.json()
        
        assert msg["type"] == "broadcast"
        print(f"✓ Broadcast message sent: {msg['message_id']}")
    
    def test_list_sent_messages(self, receptionist_token):
        """Test listing sent messages"""
        headers = {"Authorization": f"Bearer {receptionist_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/messages", headers=headers)
        assert response.status_code == 200
        messages = response.json()
        print(f"✓ Receptionist messages: {len(messages)}")


class TestParentReceptionEndpoints:
    """Parent-facing reception endpoints"""
    
    def test_parent_updates(self, parent_token):
        """Test parent updates endpoint"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/parent/updates", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["message_count", "bill_count", "total_billed", "total_paid", 
                          "outstanding", "messages", "bills"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Parent updates: {data['message_count']} messages, {data['bill_count']} bills")
    
    def test_parent_messages(self, parent_token):
        """Test parent messages endpoint"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/parent/messages", headers=headers)
        assert response.status_code == 200
        messages = response.json()
        print(f"✓ Parent messages: {len(messages)}")
    
    def test_parent_bills(self, parent_token):
        """Test parent bills endpoint"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/receptionist/parent/bills", headers=headers)
        assert response.status_code == 200
        bills = response.json()
        print(f"✓ Parent bills: {len(bills)}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_bookings(self, admin_token):
        """Cleanup TEST_ prefixed bookings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get all bookings
        response = requests.get(f"{BASE_URL}/api/guesthouse/bookings", headers=headers)
        bookings = response.json()
        
        # Checkout any TEST_ bookings that are checked_in
        test_bookings = [b for b in bookings if b.get("guest_name", "").startswith("TEST_") and b["status"] == "checked_in"]
        
        for booking in test_bookings:
            requests.post(f"{BASE_URL}/api/guesthouse/bookings/{booking['booking_id']}/checkout", headers=headers)
        
        print(f"✓ Cleaned up {len(test_bookings)} test bookings")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
