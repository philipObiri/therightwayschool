"""
TCIS LMS Phase 3A Feature Tests
- WebRTC Video Meetings (create, get, list, end)
- Voice Note Read Receipts (listen, listeners)
- Recurring Scheduled Messages (daily/weekly/monthly)
- WP Notification System
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_EMAIL = "ceo@tcis.demo"
CEO_PASSWORD = "ceo123"
TEACHER_EMAIL = "edmund@tcis.demo"
TEACHER_PASSWORD = "teacher123"


class TestAuth:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        data = response.json()
        assert "token" in data
        return data["token"]
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        """Get Teacher auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        data = response.json()
        assert "token" in data
        return data["token"]
    
    @pytest.fixture(scope="class")
    def ceo_headers(self, ceo_token):
        return {"Authorization": f"Bearer {ceo_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def teacher_headers(self, teacher_token):
        return {"Authorization": f"Bearer {teacher_token}", "Content-Type": "application/json"}


class TestMeetingsCRUD(TestAuth):
    """WebRTC Video Meetings API Tests"""
    
    created_meeting_id = None
    
    def test_create_meeting(self, ceo_headers):
        """POST /api/meetings/create - creates a meeting with meeting_id, title, status=active"""
        response = requests.post(f"{BASE_URL}/api/meetings/create", 
            headers=ceo_headers,
            json={
                "title": "TEST_Phase3A_Meeting",
                "type": "instant",
                "participant_ids": [],
                "video_enabled": True,
                "audio_enabled": True
            }
        )
        assert response.status_code == 200, f"Create meeting failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "meeting_id" in data, "Response missing meeting_id"
        assert "title" in data, "Response missing title"
        assert "status" in data, "Response missing status"
        assert data["status"] == "active", f"Expected status 'active', got '{data['status']}'"
        assert data["title"] == "TEST_Phase3A_Meeting"
        assert "created_by" in data
        assert "created_at" in data
        assert "settings" in data
        
        # Store for later tests
        TestMeetingsCRUD.created_meeting_id = data["meeting_id"]
        print(f"✓ Created meeting: {data['meeting_id']}")
    
    def test_get_meeting(self, ceo_headers):
        """GET /api/meetings/{meeting_id} - returns meeting details including active_participants"""
        assert TestMeetingsCRUD.created_meeting_id, "No meeting created"
        
        response = requests.get(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}",
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Get meeting failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "meeting_id" in data
        assert "title" in data
        assert "status" in data
        assert "active_participants" in data, "Response missing active_participants"
        assert isinstance(data["active_participants"], list)
        assert data["meeting_id"] == TestMeetingsCRUD.created_meeting_id
        print(f"✓ Got meeting details with {len(data['active_participants'])} active participants")
    
    def test_list_active_meetings(self, ceo_headers):
        """GET /api/meetings/active/list - returns user's active meetings"""
        response = requests.get(
            f"{BASE_URL}/api/meetings/active/list",
            headers=ceo_headers
        )
        assert response.status_code == 200, f"List meetings failed: {response.text}"
        data = response.json()
        
        # Verify response is a list
        assert isinstance(data, list), "Response should be a list"
        
        # Find our test meeting
        test_meeting = next((m for m in data if m.get("meeting_id") == TestMeetingsCRUD.created_meeting_id), None)
        assert test_meeting is not None, "Test meeting not found in active list"
        assert "active_participants" in test_meeting
        print(f"✓ Listed {len(data)} active meetings")
    
    def test_end_meeting(self, ceo_headers):
        """POST /api/meetings/{meeting_id}/end - ends a meeting"""
        assert TestMeetingsCRUD.created_meeting_id, "No meeting created"
        
        response = requests.post(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}/end",
            headers=ceo_headers
        )
        assert response.status_code == 200, f"End meeting failed: {response.text}"
        data = response.json()
        assert "message" in data
        
        # Verify meeting is ended
        get_response = requests.get(
            f"{BASE_URL}/api/meetings/{TestMeetingsCRUD.created_meeting_id}",
            headers=ceo_headers
        )
        assert get_response.status_code == 200
        meeting_data = get_response.json()
        assert meeting_data["status"] == "ended", f"Expected status 'ended', got '{meeting_data['status']}'"
        print(f"✓ Meeting ended successfully")


class TestVoiceNoteReadReceipts(TestAuth):
    """Voice Note Read Receipts API Tests"""
    
    test_chat_id = None
    test_message_id = None
    
    @pytest.fixture(scope="class", autouse=True)
    def setup_chat_and_message(self, ceo_headers, teacher_headers):
        """Setup: Get or create a chat and find/create a voice message"""
        # Get CEO's chats
        response = requests.get(f"{BASE_URL}/api/chat/list", headers=ceo_headers)
        if response.status_code == 200:
            chats = response.json()
            if chats and len(chats) > 0:
                TestVoiceNoteReadReceipts.test_chat_id = chats[0]["chat_id"]
                
                # Get messages from this chat
                msg_response = requests.get(
                    f"{BASE_URL}/api/chat/{TestVoiceNoteReadReceipts.test_chat_id}/messages",
                    headers=ceo_headers
                )
                if msg_response.status_code == 200:
                    messages = msg_response.json()
                    # Find any message (voice or text) for testing
                    if messages:
                        TestVoiceNoteReadReceipts.test_message_id = messages[0]["message_id"]
        
        yield
    
    def test_mark_voice_listened(self, teacher_headers):
        """POST /api/chat/messages/{msg_id}/listen - marks voice note as listened"""
        if not TestVoiceNoteReadReceipts.test_message_id:
            pytest.skip("No message available for testing")
        
        response = requests.post(
            f"{BASE_URL}/api/chat/messages/{TestVoiceNoteReadReceipts.test_message_id}/listen",
            headers=teacher_headers
        )
        assert response.status_code == 200, f"Mark listened failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert data["message"] == "Marked as listened"
        print(f"✓ Marked message as listened")
    
    def test_get_voice_listeners(self, ceo_headers):
        """GET /api/chat/messages/{msg_id}/listeners - returns list of listeners"""
        if not TestVoiceNoteReadReceipts.test_message_id:
            pytest.skip("No message available for testing")
        
        response = requests.get(
            f"{BASE_URL}/api/chat/messages/{TestVoiceNoteReadReceipts.test_message_id}/listeners",
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Get listeners failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "listeners" in data, "Response missing 'listeners' key"
        assert isinstance(data["listeners"], list)
        print(f"✓ Got {len(data['listeners'])} listeners for message")


class TestRecurringScheduledMessages(TestAuth):
    """Recurring Scheduled Messages API Tests"""
    
    test_chat_id = None
    scheduled_ids = []
    
    @pytest.fixture(scope="class", autouse=True)
    def setup_chat(self, ceo_headers):
        """Setup: Get a chat for scheduling messages"""
        response = requests.get(f"{BASE_URL}/api/chat/list", headers=ceo_headers)
        if response.status_code == 200:
            chats = response.json()
            if chats and len(chats) > 0:
                TestRecurringScheduledMessages.test_chat_id = chats[0]["chat_id"]
        yield
        
        # Cleanup: Delete test scheduled messages
        for sid in TestRecurringScheduledMessages.scheduled_ids:
            try:
                requests.delete(f"{BASE_URL}/api/chat/scheduled/{sid}", headers=ceo_headers)
            except:
                pass
    
    def test_schedule_message_daily_recurrence(self, ceo_headers):
        """POST /api/chat/{chat_id}/schedule-message with recurrence=daily"""
        if not TestRecurringScheduledMessages.test_chat_id:
            pytest.skip("No chat available for testing")
        
        scheduled_time = (datetime.utcnow() + timedelta(hours=1)).isoformat() + "Z"
        recurrence_end = (datetime.utcnow() + timedelta(days=7)).isoformat() + "Z"
        
        response = requests.post(
            f"{BASE_URL}/api/chat/{TestRecurringScheduledMessages.test_chat_id}/schedule-message",
            headers=ceo_headers,
            json={
                "content": "TEST_Daily_Scheduled_Message",
                "scheduled_for": scheduled_time,
                "recurrence": "daily",
                "recurrence_end": recurrence_end
            }
        )
        assert response.status_code == 200, f"Schedule daily message failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "scheduled_id" in data, "Response missing scheduled_id"
        assert "content" in data
        assert "recurrence" in data
        assert data["recurrence"] == "daily", f"Expected recurrence 'daily', got '{data['recurrence']}'"
        assert "recurrence_end" in data
        assert data["status"] == "pending"
        
        TestRecurringScheduledMessages.scheduled_ids.append(data["scheduled_id"])
        print(f"✓ Created daily recurring scheduled message: {data['scheduled_id']}")
    
    def test_schedule_message_weekly_recurrence(self, ceo_headers):
        """POST /api/chat/{chat_id}/schedule-message with recurrence=weekly"""
        if not TestRecurringScheduledMessages.test_chat_id:
            pytest.skip("No chat available for testing")
        
        scheduled_time = (datetime.utcnow() + timedelta(hours=2)).isoformat() + "Z"
        
        response = requests.post(
            f"{BASE_URL}/api/chat/{TestRecurringScheduledMessages.test_chat_id}/schedule-message",
            headers=ceo_headers,
            json={
                "content": "TEST_Weekly_Scheduled_Message",
                "scheduled_for": scheduled_time,
                "recurrence": "weekly",
                "recurrence_end": ""
            }
        )
        assert response.status_code == 200, f"Schedule weekly message failed: {response.text}"
        data = response.json()
        
        assert data["recurrence"] == "weekly"
        TestRecurringScheduledMessages.scheduled_ids.append(data["scheduled_id"])
        print(f"✓ Created weekly recurring scheduled message: {data['scheduled_id']}")
    
    def test_schedule_message_monthly_recurrence(self, ceo_headers):
        """POST /api/chat/{chat_id}/schedule-message with recurrence=monthly"""
        if not TestRecurringScheduledMessages.test_chat_id:
            pytest.skip("No chat available for testing")
        
        scheduled_time = (datetime.utcnow() + timedelta(hours=3)).isoformat() + "Z"
        
        response = requests.post(
            f"{BASE_URL}/api/chat/{TestRecurringScheduledMessages.test_chat_id}/schedule-message",
            headers=ceo_headers,
            json={
                "content": "TEST_Monthly_Scheduled_Message",
                "scheduled_for": scheduled_time,
                "recurrence": "monthly",
                "recurrence_end": ""
            }
        )
        assert response.status_code == 200, f"Schedule monthly message failed: {response.text}"
        data = response.json()
        
        assert data["recurrence"] == "monthly"
        TestRecurringScheduledMessages.scheduled_ids.append(data["scheduled_id"])
        print(f"✓ Created monthly recurring scheduled message: {data['scheduled_id']}")
    
    def test_schedule_message_no_recurrence(self, ceo_headers):
        """POST /api/chat/{chat_id}/schedule-message with recurrence=none (one-time)"""
        if not TestRecurringScheduledMessages.test_chat_id:
            pytest.skip("No chat available for testing")
        
        scheduled_time = (datetime.utcnow() + timedelta(hours=4)).isoformat() + "Z"
        
        response = requests.post(
            f"{BASE_URL}/api/chat/{TestRecurringScheduledMessages.test_chat_id}/schedule-message",
            headers=ceo_headers,
            json={
                "content": "TEST_OneTime_Scheduled_Message",
                "scheduled_for": scheduled_time,
                "recurrence": "none"
            }
        )
        assert response.status_code == 200, f"Schedule one-time message failed: {response.text}"
        data = response.json()
        
        assert data["recurrence"] == "none"
        TestRecurringScheduledMessages.scheduled_ids.append(data["scheduled_id"])
        print(f"✓ Created one-time scheduled message: {data['scheduled_id']}")
    
    def test_list_scheduled_messages_with_recurrence(self, ceo_headers):
        """GET /api/chat/{chat_id}/scheduled-messages returns scheduled messages with recurrence data"""
        if not TestRecurringScheduledMessages.test_chat_id:
            pytest.skip("No chat available for testing")
        
        response = requests.get(
            f"{BASE_URL}/api/chat/{TestRecurringScheduledMessages.test_chat_id}/scheduled-messages",
            headers=ceo_headers
        )
        assert response.status_code == 200, f"List scheduled messages failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        # Find our test messages
        test_msgs = [m for m in data if m.get("content", "").startswith("TEST_")]
        assert len(test_msgs) >= 1, "No test scheduled messages found"
        
        # Verify recurrence field is present
        for msg in test_msgs:
            assert "recurrence" in msg, f"Message missing recurrence field: {msg}"
            assert "scheduled_for" in msg
            assert "status" in msg
        
        print(f"✓ Listed {len(data)} scheduled messages with recurrence data")
    
    def test_cancel_scheduled_message(self, ceo_headers):
        """DELETE /api/chat/scheduled/{id} cancels scheduled message"""
        if not TestRecurringScheduledMessages.scheduled_ids:
            pytest.skip("No scheduled messages to cancel")
        
        # Cancel the last one
        sid = TestRecurringScheduledMessages.scheduled_ids[-1]
        response = requests.delete(
            f"{BASE_URL}/api/chat/scheduled/{sid}",
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Cancel scheduled message failed: {response.text}"
        data = response.json()
        assert "message" in data
        
        # Remove from cleanup list
        TestRecurringScheduledMessages.scheduled_ids.remove(sid)
        print(f"✓ Cancelled scheduled message: {sid}")


class TestWPNotifications(TestAuth):
    """Working Paper Notification System Tests"""
    
    def test_get_wp_notifications(self, ceo_headers):
        """GET /api/wp-advanced/notifications - returns WP-specific notifications"""
        # Note: The endpoint is /api/wp/notifications based on the route file
        response = requests.get(
            f"{BASE_URL}/api/wp/notifications",
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Get WP notifications failed: {response.text}"
        data = response.json()
        
        # Verify response is a list
        assert isinstance(data, list), "Response should be a list"
        
        # If there are notifications, verify structure
        if data:
            notif = data[0]
            assert "type" in notif, "Notification missing 'type'"
            # WP notification types should be wp_* prefixed
            wp_types = ["wp_task_assigned", "wp_approval_request", "wp_approval_completed",
                       "wp_approval_rejected", "wp_mention", "wp_document_signed", "wp_document_expired"]
            assert notif["type"] in wp_types, f"Unexpected notification type: {notif['type']}"
        
        print(f"✓ Got {len(data)} WP notifications")


class TestMeetingNotFound(TestAuth):
    """Test error handling for meetings"""
    
    def test_get_nonexistent_meeting(self, ceo_headers):
        """GET /api/meetings/{meeting_id} - returns 404 for non-existent meeting"""
        response = requests.get(
            f"{BASE_URL}/api/meetings/nonexistent_meeting_id",
            headers=ceo_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Correctly returns 404 for non-existent meeting")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
