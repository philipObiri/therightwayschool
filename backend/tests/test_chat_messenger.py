"""
TCIS Messenger Module - Backend API Tests
Tests for: chat list, contacts, private chats, groups, channels, messages, reactions, pins, stars, forward
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_EMAIL = "ceo@tcis.demo"
CEO_PASSWORD = "ceo123"
ADMIN_EMAIL = "dwain@tcis.demo"
ADMIN_PASSWORD = "admin123"
TEACHER_EMAIL = "edmund@tcis.demo"
TEACHER_PASSWORD = "teacher123"


class TestChatAuth:
    """Authentication and basic access tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        """Get CEO auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL,
            "password": CEO_PASSWORD
        })
        assert response.status_code == 200, f"CEO login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get Admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        """Get Teacher auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        return response.json()["token"]
    
    def test_ceo_login(self, ceo_token):
        """Verify CEO can login"""
        assert ceo_token is not None
        assert len(ceo_token) > 0
        print(f"CEO login successful, token length: {len(ceo_token)}")
    
    def test_admin_login(self, admin_token):
        """Verify Admin can login"""
        assert admin_token is not None
        print(f"Admin login successful")


class TestChatContacts:
    """Contact list tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL, "password": CEO_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_contacts(self, ceo_token):
        """GET /api/chat/contacts - returns list of contacts"""
        response = requests.get(
            f"{BASE_URL}/api/chat/contacts",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "contacts" in data
        assert "online_user_ids" in data
        assert isinstance(data["contacts"], list)
        print(f"Got {len(data['contacts'])} contacts")
        if data["contacts"]:
            contact = data["contacts"][0]
            assert "user_id" in contact
            assert "name" in contact
            assert "role" in contact
    
    def test_contacts_unauthorized(self):
        """Contacts endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/chat/contacts")
        assert response.status_code in [401, 403]


class TestChatList:
    """Chat list tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL, "password": CEO_PASSWORD
        })
        return response.json()["token"]
    
    def test_list_chats(self, ceo_token):
        """GET /api/chat/list - returns user's chats"""
        response = requests.get(
            f"{BASE_URL}/api/chat/list",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"CEO has {len(data)} chats")
        if data:
            chat = data[0]
            assert "chat_id" in chat
            assert "type" in chat
            assert "display_name" in chat
            assert "unread_count" in chat
            print(f"First chat: {chat['display_name']} (type: {chat['type']})")


class TestPrivateChat:
    """Private chat creation and messaging tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL, "password": CEO_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_user_id(self, ceo_token):
        """Get admin user ID from contacts"""
        response = requests.get(
            f"{BASE_URL}/api/chat/contacts",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        contacts = response.json()["contacts"]
        for c in contacts:
            if "dwain" in c.get("email", "").lower() or "dwain" in c.get("name", "").lower():
                return c["user_id"]
        # Return first contact if Dwain not found
        return contacts[0]["user_id"] if contacts else None
    
    def test_start_private_chat(self, ceo_token, admin_user_id):
        """POST /api/chat/start-private - creates or returns existing private chat"""
        if not admin_user_id:
            pytest.skip("No contacts available")
        
        response = requests.post(
            f"{BASE_URL}/api/chat/start-private",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={"user_id": admin_user_id}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "chat_id" in data
        assert data["type"] == "private"
        print(f"Private chat created/found: {data['chat_id']}")
        return data["chat_id"]
    
    def test_start_private_invalid_user(self, ceo_token):
        """Cannot start chat with invalid user"""
        response = requests.post(
            f"{BASE_URL}/api/chat/start-private",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={"user_id": "invalid_user_id_12345"}
        )
        assert response.status_code in [400, 404]


class TestGroupChat:
    """Group chat creation and management tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL, "password": CEO_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def member_ids(self, ceo_token):
        """Get some member IDs for group creation"""
        response = requests.get(
            f"{BASE_URL}/api/chat/contacts",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        contacts = response.json()["contacts"]
        return [c["user_id"] for c in contacts[:3]] if len(contacts) >= 3 else [c["user_id"] for c in contacts]
    
    def test_create_group(self, ceo_token, member_ids):
        """POST /api/chat/create-group - creates a new group"""
        if not member_ids:
            pytest.skip("No contacts available")
        
        response = requests.post(
            f"{BASE_URL}/api/chat/create-group",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={
                "name": "TEST_Group_Messenger_Test",
                "description": "Test group for automated testing",
                "member_ids": member_ids,
                "category": "general"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "chat_id" in data
        assert data["type"] == "group"
        assert data["name"] == "TEST_Group_Messenger_Test"
        print(f"Group created: {data['chat_id']}")
        return data["chat_id"]
    
    def test_create_group_no_name(self, ceo_token, member_ids):
        """Group creation requires name"""
        response = requests.post(
            f"{BASE_URL}/api/chat/create-group",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={"name": "", "member_ids": member_ids}
        )
        assert response.status_code == 400


class TestChannelChat:
    """Channel creation tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL, "password": CEO_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def member_ids(self, ceo_token):
        response = requests.get(
            f"{BASE_URL}/api/chat/contacts",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        contacts = response.json()["contacts"]
        return [c["user_id"] for c in contacts[:2]]
    
    def test_create_channel(self, ceo_token, member_ids):
        """POST /api/chat/create-channel - creates a broadcast channel"""
        response = requests.post(
            f"{BASE_URL}/api/chat/create-channel",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={
                "name": "TEST_Channel_Announcements",
                "description": "Test channel for automated testing",
                "member_ids": member_ids,
                "category": "announcement"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "chat_id" in data
        assert data["type"] == "channel"
        assert data["settings"]["only_admins_post"] == True
        print(f"Channel created: {data['chat_id']}")


class TestMessages:
    """Message sending and retrieval tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL, "password": CEO_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def test_chat_id(self, ceo_token):
        """Get or create a test chat"""
        # First try to get existing chats
        response = requests.get(
            f"{BASE_URL}/api/chat/list",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        chats = response.json()
        if chats:
            return chats[0]["chat_id"]
        
        # Create a new group if no chats exist
        contacts_resp = requests.get(
            f"{BASE_URL}/api/chat/contacts",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        contacts = contacts_resp.json()["contacts"]
        if contacts:
            group_resp = requests.post(
                f"{BASE_URL}/api/chat/create-group",
                headers={"Authorization": f"Bearer {ceo_token}"},
                json={"name": "TEST_Message_Test_Group", "member_ids": [contacts[0]["user_id"]]}
            )
            return group_resp.json()["chat_id"]
        return None
    
    def test_send_message(self, ceo_token, test_chat_id):
        """POST /api/chat/{chat_id}/messages - sends a message"""
        if not test_chat_id:
            pytest.skip("No chat available")
        
        response = requests.post(
            f"{BASE_URL}/api/chat/{test_chat_id}/messages",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={"content": "TEST_Message from automated test", "message_type": "text"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "message_id" in data
        assert data["content"] == "TEST_Message from automated test"
        print(f"Message sent: {data['message_id']}")
        return data["message_id"]
    
    def test_get_messages(self, ceo_token, test_chat_id):
        """GET /api/chat/{chat_id}/messages - retrieves messages"""
        if not test_chat_id:
            pytest.skip("No chat available")
        
        response = requests.get(
            f"{BASE_URL}/api/chat/{test_chat_id}/messages",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Got {len(data)} messages")
        if data:
            msg = data[-1]
            assert "message_id" in msg
            assert "content" in msg
            assert "sender_name" in msg
    
    def test_send_empty_message(self, ceo_token, test_chat_id):
        """Cannot send empty message"""
        if not test_chat_id:
            pytest.skip("No chat available")
        
        response = requests.post(
            f"{BASE_URL}/api/chat/{test_chat_id}/messages",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={"content": "", "message_type": "text"}
        )
        assert response.status_code == 400


class TestMessageActions:
    """Message edit, delete, react, pin, star, forward tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL, "password": CEO_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def test_message(self, ceo_token):
        """Create a test message"""
        # Get a chat
        chats_resp = requests.get(
            f"{BASE_URL}/api/chat/list",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        chats = chats_resp.json()
        if not chats:
            pytest.skip("No chats available")
        
        chat_id = chats[0]["chat_id"]
        
        # Send a message
        msg_resp = requests.post(
            f"{BASE_URL}/api/chat/{chat_id}/messages",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={"content": "TEST_Message for actions test", "message_type": "text"}
        )
        msg = msg_resp.json()
        return {"chat_id": chat_id, "message_id": msg["message_id"]}
    
    def test_edit_message(self, ceo_token, test_message):
        """PUT /api/chat/messages/{msg_id} - edits a message"""
        response = requests.put(
            f"{BASE_URL}/api/chat/messages/{test_message['message_id']}",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={"content": "TEST_Message edited content"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print("Message edited successfully")
    
    def test_react_to_message(self, ceo_token, test_message):
        """POST /api/chat/messages/{msg_id}/react - adds reaction"""
        response = requests.post(
            f"{BASE_URL}/api/chat/messages/{test_message['message_id']}/react",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={"emoji": "👍"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "reactions" in data
        print(f"Reaction added: {data['reactions']}")
    
    def test_star_message(self, ceo_token, test_message):
        """POST /api/chat/messages/{msg_id}/star - stars a message"""
        response = requests.post(
            f"{BASE_URL}/api/chat/messages/{test_message['message_id']}/star",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "starred" in data
        print(f"Message starred: {data['starred']}")
    
    def test_pin_message(self, ceo_token, test_message):
        """POST /api/chat/messages/{msg_id}/pin - pins a message"""
        response = requests.post(
            f"{BASE_URL}/api/chat/messages/{test_message['message_id']}/pin",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={"pinned": True}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print("Message pinned successfully")
    
    def test_forward_message(self, ceo_token, test_message):
        """POST /api/chat/messages/{msg_id}/forward - forwards a message"""
        # Get another chat to forward to
        chats_resp = requests.get(
            f"{BASE_URL}/api/chat/list",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        chats = chats_resp.json()
        target_chat = None
        for c in chats:
            if c["chat_id"] != test_message["chat_id"]:
                target_chat = c["chat_id"]
                break
        
        if not target_chat:
            pytest.skip("No other chat to forward to")
        
        response = requests.post(
            f"{BASE_URL}/api/chat/messages/{test_message['message_id']}/forward",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={"chat_id": target_chat}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "forwarded_from" in data
        print(f"Message forwarded to {target_chat}")


class TestChatDetails:
    """Chat detail and member management tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL, "password": CEO_PASSWORD
        })
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def test_chat_id(self, ceo_token):
        chats_resp = requests.get(
            f"{BASE_URL}/api/chat/list",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        chats = chats_resp.json()
        # Find a group chat
        for c in chats:
            if c["type"] == "group":
                return c["chat_id"]
        return chats[0]["chat_id"] if chats else None
    
    def test_get_chat_detail(self, ceo_token, test_chat_id):
        """GET /api/chat/{chat_id} - returns chat details with members"""
        if not test_chat_id:
            pytest.skip("No chat available")
        
        response = requests.get(
            f"{BASE_URL}/api/chat/{test_chat_id}",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "chat_id" in data
        assert "members" in data
        assert "pinned_messages" in data
        assert "shared_files" in data
        assert "my_role" in data
        print(f"Chat detail: {data['name'] or 'Private'}, {len(data['members'])} members")
    
    def test_mark_read(self, ceo_token, test_chat_id):
        """POST /api/chat/{chat_id}/read - marks chat as read"""
        if not test_chat_id:
            pytest.skip("No chat available")
        
        response = requests.post(
            f"{BASE_URL}/api/chat/{test_chat_id}/read",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print("Chat marked as read")
    
    def test_mute_chat(self, ceo_token, test_chat_id):
        """PUT /api/chat/{chat_id}/mute - mutes/unmutes chat"""
        if not test_chat_id:
            pytest.skip("No chat available")
        
        response = requests.put(
            f"{BASE_URL}/api/chat/{test_chat_id}/mute",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={"muted": True}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Unmute
        response = requests.put(
            f"{BASE_URL}/api/chat/{test_chat_id}/mute",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={"muted": False}
        )
        assert response.status_code == 200
        print("Chat mute/unmute working")


class TestSearch:
    """Search functionality tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL, "password": CEO_PASSWORD
        })
        return response.json()["token"]
    
    def test_global_search(self, ceo_token):
        """GET /api/chat/search/global - searches across chats, messages, contacts"""
        response = requests.get(
            f"{BASE_URL}/api/chat/search/global?q=test",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "chats" in data
        assert "messages" in data
        assert "contacts" in data
        print(f"Global search: {len(data['chats'])} chats, {len(data['messages'])} messages, {len(data['contacts'])} contacts")
    
    def test_search_in_chat(self, ceo_token):
        """GET /api/chat/{chat_id}/search - searches within a chat"""
        chats_resp = requests.get(
            f"{BASE_URL}/api/chat/list",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        chats = chats_resp.json()
        if not chats:
            pytest.skip("No chats available")
        
        chat_id = chats[0]["chat_id"]
        response = requests.get(
            f"{BASE_URL}/api/chat/{chat_id}/search?q=test",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"In-chat search: {len(data)} results")


class TestStarredMessages:
    """Starred messages tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL, "password": CEO_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_starred_messages(self, ceo_token):
        """GET /api/chat/starred/list - returns starred messages"""
        response = requests.get(
            f"{BASE_URL}/api/chat/starred/list",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Starred messages: {len(data)}")


class TestOnlineStatus:
    """Online status tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL, "password": CEO_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_online_users(self, ceo_token):
        """GET /api/chat/online/users - returns online user IDs"""
        response = requests.get(
            f"{BASE_URL}/api/chat/online/users",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Online users: {len(data)}")


class TestAudit:
    """Audit log tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL, "password": CEO_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_audit_log(self, ceo_token):
        """GET /api/chat/audit/log - returns audit logs (admin only)"""
        response = requests.get(
            f"{BASE_URL}/api/chat/audit/log",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Audit logs: {len(data)}")


class TestReplyMessages:
    """Reply to message tests"""
    
    @pytest.fixture(scope="class")
    def ceo_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CEO_EMAIL, "password": CEO_PASSWORD
        })
        return response.json()["token"]
    
    def test_send_reply(self, ceo_token):
        """Send a message as a reply to another message"""
        # Get a chat with messages
        chats_resp = requests.get(
            f"{BASE_URL}/api/chat/list",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        chats = chats_resp.json()
        if not chats:
            pytest.skip("No chats available")
        
        chat_id = chats[0]["chat_id"]
        
        # Get messages
        msgs_resp = requests.get(
            f"{BASE_URL}/api/chat/{chat_id}/messages",
            headers={"Authorization": f"Bearer {ceo_token}"}
        )
        messages = msgs_resp.json()
        if not messages:
            # Send a message first
            msg_resp = requests.post(
                f"{BASE_URL}/api/chat/{chat_id}/messages",
                headers={"Authorization": f"Bearer {ceo_token}"},
                json={"content": "TEST_Original message for reply", "message_type": "text"}
            )
            reply_to_id = msg_resp.json()["message_id"]
        else:
            reply_to_id = messages[-1]["message_id"]
        
        # Send reply
        response = requests.post(
            f"{BASE_URL}/api/chat/{chat_id}/messages",
            headers={"Authorization": f"Bearer {ceo_token}"},
            json={
                "content": "TEST_This is a reply message",
                "message_type": "text",
                "reply_to_id": reply_to_id
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["reply_to"] is not None
        assert data["reply_to"]["message_id"] == reply_to_id
        print(f"Reply sent with reply_to: {data['reply_to']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
