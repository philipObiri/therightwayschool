"""
Test Notification System APIs
Tests for: Student notification dropdown, clickable notifications,
mark as read, mark all read, and notifications page
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNotificationAPIs:
    """Test notification endpoints for all user roles"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
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
    
    # ─── Student Notification Tests ───
    def test_student_login(self):
        """Test student can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ayeyi.forson@tcis.student",
            "password": "student123"
        })
        assert response.status_code == 200, f"Student login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data.get("user", {}).get("role") == "Student"
        print(f"✓ Student login successful - User: {data.get('user', {}).get('name')}")
    
    def test_student_get_notifications(self):
        """Test student can get notifications list"""
        token = self.get_auth_token("ayeyi.forson@tcis.student", "student123")
        assert token, "Failed to get student token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/behaviour/notifications")
        
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        notifications = response.json()
        assert isinstance(notifications, list), "Expected list of notifications"
        print(f"✓ Student has {len(notifications)} notifications")
        
        # Check notification structure if any exist
        if notifications:
            n = notifications[0]
            assert "notif_id" in n, "Missing notif_id"
            assert "title" in n, "Missing title"
            assert "message" in n, "Missing message"
            assert "is_read" in n, "Missing is_read"
            assert "created_at" in n, "Missing created_at"
            print(f"✓ First notification: {n.get('title')} (type: {n.get('type')})")
    
    def test_student_get_unread_count(self):
        """Test student can get unread notification count"""
        token = self.get_auth_token("ayeyi.forson@tcis.student", "student123")
        assert token, "Failed to get student token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/behaviour/notifications/unread-count")
        
        assert response.status_code == 200, f"Get unread count failed: {response.text}"
        data = response.json()
        assert "count" in data, "Missing count in response"
        assert isinstance(data["count"], int), "Count should be integer"
        print(f"✓ Student unread count: {data['count']}")
    
    def test_student_mark_notification_read(self):
        """Test student can mark individual notification as read"""
        token = self.get_auth_token("ayeyi.forson@tcis.student", "student123")
        assert token, "Failed to get student token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # First get notifications
        response = self.session.get(f"{BASE_URL}/api/behaviour/notifications")
        assert response.status_code == 200
        notifications = response.json()
        
        if not notifications:
            pytest.skip("No notifications to mark as read")
        
        notif_id = notifications[0]["notif_id"]
        
        # Mark as read
        response = self.session.post(f"{BASE_URL}/api/behaviour/notifications/{notif_id}/read")
        assert response.status_code == 200, f"Mark read failed: {response.text}"
        data = response.json()
        assert data.get("message") == "Marked as read"
        print(f"✓ Notification {notif_id} marked as read")
    
    def test_student_mark_all_read(self):
        """Test student can mark all notifications as read"""
        token = self.get_auth_token("ayeyi.forson@tcis.student", "student123")
        assert token, "Failed to get student token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Mark all as read
        response = self.session.post(f"{BASE_URL}/api/behaviour/notifications/read-all")
        assert response.status_code == 200, f"Mark all read failed: {response.text}"
        data = response.json()
        assert data.get("message") == "All marked as read"
        print("✓ All notifications marked as read")
        
        # Verify unread count is now 0
        response = self.session.get(f"{BASE_URL}/api/behaviour/notifications/unread-count")
        assert response.status_code == 200
        count = response.json().get("count", -1)
        assert count == 0, f"Expected unread count 0, got {count}"
        print("✓ Verified unread count is now 0")
    
    # ─── Teacher Notification Tests ───
    def test_teacher_login(self):
        """Test teacher can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print(f"✓ Teacher login successful - User: {data.get('user', {}).get('name')}")
    
    def test_teacher_get_notifications(self):
        """Test teacher can get notifications"""
        token = self.get_auth_token("edmund@tcis.demo", "teacher123")
        assert token, "Failed to get teacher token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/behaviour/notifications")
        
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        notifications = response.json()
        assert isinstance(notifications, list)
        print(f"✓ Teacher has {len(notifications)} notifications")
    
    def test_teacher_get_unread_count(self):
        """Test teacher can get unread count"""
        token = self.get_auth_token("edmund@tcis.demo", "teacher123")
        assert token, "Failed to get teacher token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/behaviour/notifications/unread-count")
        
        assert response.status_code == 200, f"Get unread count failed: {response.text}"
        data = response.json()
        assert "count" in data
        print(f"✓ Teacher unread count: {data['count']}")
    
    # ─── Admin Notification Tests ───
    def test_admin_login(self):
        """Test admin can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tcis.demo",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print(f"✓ Admin login successful - User: {data.get('user', {}).get('name')}")
    
    def test_admin_get_notifications(self):
        """Test admin can get notifications"""
        token = self.get_auth_token("admin@tcis.demo", "admin123")
        assert token, "Failed to get admin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/behaviour/notifications")
        
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        notifications = response.json()
        assert isinstance(notifications, list)
        print(f"✓ Admin has {len(notifications)} notifications")
    
    def test_admin_get_unread_count(self):
        """Test admin can get unread count"""
        token = self.get_auth_token("admin@tcis.demo", "admin123")
        assert token, "Failed to get admin token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/behaviour/notifications/unread-count")
        
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✓ Admin unread count: {data['count']}")
    
    # ─── CEO Notification Tests ───
    def test_ceo_login(self):
        """Test CEO can login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ceo@tcis.demo",
            "password": "ceo123"
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print(f"✓ CEO login successful - User: {data.get('user', {}).get('name')}")
    
    def test_ceo_get_notifications(self):
        """Test CEO can get notifications"""
        token = self.get_auth_token("ceo@tcis.demo", "ceo123")
        assert token, "Failed to get CEO token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        response = self.session.get(f"{BASE_URL}/api/behaviour/notifications")
        
        assert response.status_code == 200
        notifications = response.json()
        assert isinstance(notifications, list)
        print(f"✓ CEO has {len(notifications)} notifications")


# Create a test notification for the student to verify navigation
class TestCreateStudentNotification:
    """Create a test notification for student to verify the feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, email, password):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    def test_get_student_id(self):
        """Get the student's user_id for creating notifications"""
        token = self.get_auth_token("ayeyi.forson@tcis.student", "student123")
        assert token, "Failed to get student token"
        
        # Get user info from login response
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ayeyi.forson@tcis.student",
            "password": "student123"
        })
        data = response.json()
        user = data.get("user", {})
        
        print(f"✓ Student user_id: {user.get('user_id')}")
        print(f"✓ Student name: {user.get('name')}")
        print(f"✓ Student role: {user.get('role')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
