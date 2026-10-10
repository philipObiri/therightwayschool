"""
Iteration 51 Backend Tests
Tests for:
- Push Notifications API
- Working Paper Collab API
- PWA manifest and service worker
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        """Get teacher auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("token")
    
    def test_login_teacher(self, teacher_token):
        """Test teacher login"""
        assert teacher_token is not None
        assert len(teacher_token) > 0
        print(f"SUCCESS: Teacher login successful, token length: {len(teacher_token)}")


class TestPushNotifications:
    """Push Notifications API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_notifications(self, auth_headers):
        """Test GET /api/notifications/"""
        response = requests.get(f"{BASE_URL}/api/notifications/", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        assert isinstance(data["notifications"], list)
        print(f"SUCCESS: GET /api/notifications/ - {len(data['notifications'])} notifications, {data['unread_count']} unread")
    
    def test_get_notification_preferences(self, auth_headers):
        """Test GET /api/notifications/preferences"""
        response = requests.get(f"{BASE_URL}/api/notifications/preferences", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "push_enabled" in data
        assert "categories" in data
        print(f"SUCCESS: GET /api/notifications/preferences - push_enabled: {data['push_enabled']}")
    
    def test_subscribe_push(self, auth_headers):
        """Test POST /api/notifications/subscribe"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/subscribe",
            headers=auth_headers,
            json={
                "subscription": {
                    "endpoint": "https://test.example.com/push/test123",
                    "keys": {"p256dh": "test_key", "auth": "test_auth"}
                },
                "user_agent": "Test Agent"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("status") == "subscribed"
        print("SUCCESS: POST /api/notifications/subscribe - subscribed")
    
    def test_subscribe_invalid(self, auth_headers):
        """Test POST /api/notifications/subscribe with invalid data"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/subscribe",
            headers=auth_headers,
            json={"subscription": {}}  # Missing endpoint
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("SUCCESS: POST /api/notifications/subscribe - correctly rejects invalid subscription")


class TestWpCollab:
    """Working Paper Collaboration API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_active_sessions(self, auth_headers):
        """Test GET /api/wp/collab/active-sessions"""
        response = requests.get(f"{BASE_URL}/api/wp/collab/active-sessions", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: GET /api/wp/collab/active-sessions - {len(data)} active sessions")
        
        # Verify session structure if any exist
        if len(data) > 0:
            session = data[0]
            assert "document_id" in session
            assert "editor_count" in session
            assert "editors" in session
            print(f"  - Session: {session['document_id']} with {session['editor_count']} editors")


class TestPWA:
    """PWA manifest and service worker tests"""
    
    def test_manifest_json(self):
        """Test /manifest.json is served correctly"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200, f"Failed: {response.status_code}"
        data = response.json()
        
        # Verify required PWA manifest fields
        assert data.get("name") == "RightWay Workstation"
        assert data.get("short_name") == "TCIS"
        assert data.get("start_url") == "/"
        assert data.get("display") == "standalone"
        assert data.get("theme_color") == "#1B2A4A"
        assert data.get("background_color") == "#1B2A4A"
        assert "icons" in data
        assert len(data["icons"]) >= 1
        print("SUCCESS: /manifest.json - valid PWA manifest")
    
    def test_service_worker(self):
        """Test /sw.js is served correctly"""
        response = requests.get(f"{BASE_URL}/sw.js")
        assert response.status_code == 200, f"Failed: {response.status_code}"
        content = response.text
        
        # Verify service worker content
        assert "CACHE_NAME" in content
        assert "self.addEventListener" in content
        assert "install" in content
        assert "fetch" in content
        assert "push" in content
        print("SUCCESS: /sw.js - valid service worker")


class TestHealthCheck:
    """Basic health check"""
    
    def test_health(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("SUCCESS: /api/health - service is healthy")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

