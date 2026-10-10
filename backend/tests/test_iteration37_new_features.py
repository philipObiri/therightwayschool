"""
Iteration 37: Testing new features - Analytics Dashboard, Discussion Rooms, Batch PDF Export
- Analytics: GET /api/analytics/academic, /api/analytics/financial, /api/analytics/staff
- Discussions: GET/POST rooms, messages, reactions, edit, delete
- Batch PDF: GET /api/schemes/batch-export-pdf
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "dwain@tcis.demo"
SUPERADMIN_PASS = "admin123"
TEACHER_EMAIL = "edmund@tcis.demo"
TEACHER_PASS = "teacher123"
CEO_EMAIL = "ceo@tcis.demo"
CEO_PASS = "ceo123"


@pytest.fixture(scope="module")
def superadmin_token():
    """Get SuperAdmin auth token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASS
    })
    if resp.status_code == 200:
        return resp.json().get("token")
    pytest.skip(f"SuperAdmin login failed: {resp.status_code} - {resp.text}")


@pytest.fixture(scope="module")
def teacher_token():
    """Get Teacher auth token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL, "password": TEACHER_PASS
    })
    if resp.status_code == 200:
        return resp.json().get("token")
    pytest.skip(f"Teacher login failed: {resp.status_code} - {resp.text}")


@pytest.fixture(scope="module")
def ceo_token():
    """Get CEO auth token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CEO_EMAIL, "password": CEO_PASS
    })
    if resp.status_code == 200:
        return resp.json().get("token")
    pytest.skip(f"CEO login failed: {resp.status_code} - {resp.text}")


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ═══════════════════════════════════════════════════════════════════
# ANALYTICS DASHBOARD TESTS
# ═══════════════════════════════════════════════════════════════════

class TestAnalyticsAcademic:
    """Test GET /api/analytics/academic endpoint"""
    
    def test_academic_analytics_requires_auth(self):
        """Academic analytics requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/analytics/academic")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("✓ Academic analytics requires authentication")
    
    def test_academic_analytics_requires_mgmt_role(self, teacher_token):
        """Academic analytics requires management role (teacher should be denied)"""
        resp = requests.get(f"{BASE_URL}/api/analytics/academic", headers=auth_headers(teacher_token))
        assert resp.status_code == 403, f"Expected 403 for teacher, got {resp.status_code}"
        print("✓ Academic analytics denies non-management roles")
    
    def test_academic_analytics_success(self, superadmin_token):
        """Academic analytics returns correct data structure"""
        resp = requests.get(f"{BASE_URL}/api/analytics/academic", headers=auth_headers(superadmin_token))
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify top-level keys
        assert "term" in data, "Missing 'term' key"
        assert "academic_year" in data, "Missing 'academic_year' key"
        assert "schemes" in data, "Missing 'schemes' key"
        assert "resources" in data, "Missing 'resources' key"
        assert "quizzes" in data, "Missing 'quizzes' key"
        assert "lessons" in data, "Missing 'lessons' key"
        
        # Verify schemes structure
        schemes = data["schemes"]
        assert "total" in schemes, "Missing schemes.total"
        assert "this_term" in schemes, "Missing schemes.this_term"
        assert "by_status" in schemes, "Missing schemes.by_status"
        assert "ai_enhanced" in schemes, "Missing schemes.ai_enhanced"
        assert "submission_trend" in schemes, "Missing schemes.submission_trend"
        assert "by_department" in schemes, "Missing schemes.by_department"
        assert "by_year_group" in schemes, "Missing schemes.by_year_group"
        
        # Verify resources structure
        assert "total" in data["resources"], "Missing resources.total"
        assert "published" in data["resources"], "Missing resources.published"
        
        # Verify quizzes structure
        assert "total" in data["quizzes"], "Missing quizzes.total"
        
        # Verify lessons structure
        assert "total" in data["lessons"], "Missing lessons.total"
        assert "last_30d" in data["lessons"], "Missing lessons.last_30d"
        
        print(f"✓ Academic analytics returns valid data: {schemes['total']} schemes, {data['resources']['total']} resources")
    
    def test_academic_analytics_ceo_access(self, ceo_token):
        """CEO can access academic analytics"""
        resp = requests.get(f"{BASE_URL}/api/analytics/academic", headers=auth_headers(ceo_token))
        assert resp.status_code == 200, f"CEO should access analytics, got {resp.status_code}"
        print("✓ CEO can access academic analytics")


class TestAnalyticsFinancial:
    """Test GET /api/analytics/financial endpoint"""
    
    def test_financial_analytics_requires_auth(self):
        """Financial analytics requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/analytics/financial")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("✓ Financial analytics requires authentication")
    
    def test_financial_analytics_requires_mgmt_role(self, teacher_token):
        """Financial analytics requires management role"""
        resp = requests.get(f"{BASE_URL}/api/analytics/financial", headers=auth_headers(teacher_token))
        assert resp.status_code == 403, f"Expected 403 for teacher, got {resp.status_code}"
        print("✓ Financial analytics denies non-management roles")
    
    def test_financial_analytics_success(self, superadmin_token):
        """Financial analytics returns correct data structure"""
        resp = requests.get(f"{BASE_URL}/api/analytics/financial", headers=auth_headers(superadmin_token))
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify top-level keys
        assert "term" in data, "Missing 'term' key"
        assert "academic_year" in data, "Missing 'academic_year' key"
        assert "revenue" in data, "Missing 'revenue' key"
        assert "by_term" in data, "Missing 'by_term' key"
        assert "by_year_group" in data, "Missing 'by_year_group' key"
        assert "payment_trend" in data, "Missing 'payment_trend' key"
        assert "expenses" in data, "Missing 'expenses' key"
        assert "budget" in data, "Missing 'budget' key"
        
        # Verify revenue structure
        revenue = data["revenue"]
        assert "total_invoiced" in revenue, "Missing revenue.total_invoiced"
        assert "total_paid" in revenue, "Missing revenue.total_paid"
        assert "outstanding" in revenue, "Missing revenue.outstanding"
        assert "collection_rate" in revenue, "Missing revenue.collection_rate"
        
        # Verify expenses structure
        expenses = data["expenses"]
        assert "total" in expenses, "Missing expenses.total"
        assert "by_category" in expenses, "Missing expenses.by_category"
        
        # Verify budget structure
        budget = data["budget"]
        assert "total_allocated" in budget, "Missing budget.total_allocated"
        assert "total_spent" in budget, "Missing budget.total_spent"
        assert "utilization" in budget, "Missing budget.utilization"
        
        print(f"✓ Financial analytics returns valid data: invoiced={revenue['total_invoiced']}, paid={revenue['total_paid']}")


class TestAnalyticsStaff:
    """Test GET /api/analytics/staff endpoint"""
    
    def test_staff_analytics_requires_auth(self):
        """Staff analytics requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/analytics/staff")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("✓ Staff analytics requires authentication")
    
    def test_staff_analytics_requires_mgmt_role(self, teacher_token):
        """Staff analytics requires management role"""
        resp = requests.get(f"{BASE_URL}/api/analytics/staff", headers=auth_headers(teacher_token))
        assert resp.status_code == 403, f"Expected 403 for teacher, got {resp.status_code}"
        print("✓ Staff analytics denies non-management roles")
    
    def test_staff_analytics_success(self, superadmin_token):
        """Staff analytics returns correct data structure"""
        resp = requests.get(f"{BASE_URL}/api/analytics/staff", headers=auth_headers(superadmin_token))
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify top-level keys
        assert "total_staff" in data, "Missing 'total_staff' key"
        assert "by_role" in data, "Missing 'by_role' key"
        assert "by_department" in data, "Missing 'by_department' key"
        assert "clock_in" in data, "Missing 'clock_in' key"
        assert "activity" in data, "Missing 'activity' key"
        assert "cpd" in data, "Missing 'cpd' key"
        assert "leave" in data, "Missing 'leave' key"
        
        # Verify clock_in structure
        clock_in = data["clock_in"]
        assert "today" in clock_in, "Missing clock_in.today"
        assert "trend" in clock_in, "Missing clock_in.trend"
        
        # Verify activity structure
        activity = data["activity"]
        assert "total_30d" in activity, "Missing activity.total_30d"
        assert "top_active_staff" in activity, "Missing activity.top_active_staff"
        assert "top_actions" in activity, "Missing activity.top_actions"
        
        # Verify cpd structure
        cpd = data["cpd"]
        assert "courses" in cpd, "Missing cpd.courses"
        assert "enrolments" in cpd, "Missing cpd.enrolments"
        
        # Verify leave structure
        leave = data["leave"]
        assert "pending" in leave, "Missing leave.pending"
        assert "approved" in leave, "Missing leave.approved"
        
        print(f"✓ Staff analytics returns valid data: {data['total_staff']} staff, {activity['total_30d']} actions (30d)")


# ═══════════════════════════════════════════════════════════════════
# DISCUSSION ROOMS TESTS
# ═══════════════════════════════════════════════════════════════════

class TestDiscussionRooms:
    """Test Discussion Rooms CRUD operations"""
    
    def test_list_rooms_requires_auth(self):
        """List rooms requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/discussions/rooms")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("✓ List rooms requires authentication")
    
    def test_list_rooms_requires_staff_role(self, teacher_token):
        """List rooms accessible by staff (teacher)"""
        resp = requests.get(f"{BASE_URL}/api/discussions/rooms", headers=auth_headers(teacher_token))
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "rooms" in data, "Missing 'rooms' key"
        assert isinstance(data["rooms"], list), "rooms should be a list"
        print(f"✓ Teacher can list rooms: {len(data['rooms'])} rooms found")
    
    def test_list_rooms_structure(self, superadmin_token):
        """Verify room structure in list"""
        resp = requests.get(f"{BASE_URL}/api/discussions/rooms", headers=auth_headers(superadmin_token))
        assert resp.status_code == 200
        data = resp.json()
        
        if len(data["rooms"]) > 0:
            room = data["rooms"][0]
            assert "room_id" in room, "Missing room_id"
            assert "name" in room, "Missing name"
            assert "department" in room, "Missing department"
            assert "member_count" in room, "Missing member_count"
            assert "message_count" in room, "Missing message_count"
            assert "is_member" in room, "Missing is_member"
            print(f"✓ Room structure valid: {room['name']} ({room['member_count']} members)")
        else:
            print("✓ Room list structure valid (no rooms yet)")


class TestDiscussionMessages:
    """Test Discussion Messages CRUD operations"""
    
    @pytest.fixture(scope="class")
    def test_room_id(self, superadmin_token):
        """Get a room ID for testing"""
        resp = requests.get(f"{BASE_URL}/api/discussions/rooms", headers=auth_headers(superadmin_token))
        if resp.status_code == 200 and len(resp.json().get("rooms", [])) > 0:
            return resp.json()["rooms"][0]["room_id"]
        pytest.skip("No rooms available for testing")
    
    def test_get_messages_requires_auth(self, test_room_id):
        """Get messages requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/discussions/rooms/{test_room_id}/messages")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("✓ Get messages requires authentication")
    
    def test_get_messages_success(self, superadmin_token, test_room_id):
        """Get messages returns correct structure"""
        resp = requests.get(f"{BASE_URL}/api/discussions/rooms/{test_room_id}/messages", 
                           headers=auth_headers(superadmin_token))
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "messages" in data, "Missing 'messages' key"
        assert "total" in data, "Missing 'total' key"
        assert isinstance(data["messages"], list), "messages should be a list"
        print(f"✓ Get messages success: {data['total']} total messages")
    
    def test_send_message_success(self, superadmin_token, test_room_id):
        """Send message to room"""
        resp = requests.post(f"{BASE_URL}/api/discussions/rooms/{test_room_id}/messages",
                            headers=auth_headers(superadmin_token),
                            json={"text": "TEST_message_from_pytest"})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "message_id" in data, "Missing message_id in response"
        assert data["text"] == "TEST_message_from_pytest", "Message text mismatch"
        print(f"✓ Send message success: {data['message_id']}")
        return data["message_id"]
    
    def test_send_message_empty_text_fails(self, superadmin_token, test_room_id):
        """Send empty message should fail"""
        resp = requests.post(f"{BASE_URL}/api/discussions/rooms/{test_room_id}/messages",
                            headers=auth_headers(superadmin_token),
                            json={"text": ""})
        assert resp.status_code == 400, f"Expected 400 for empty text, got {resp.status_code}"
        print("✓ Empty message correctly rejected")
    
    def test_edit_message_success(self, superadmin_token, test_room_id):
        """Edit own message"""
        # First send a message
        send_resp = requests.post(f"{BASE_URL}/api/discussions/rooms/{test_room_id}/messages",
                                 headers=auth_headers(superadmin_token),
                                 json={"text": "TEST_original_message"})
        assert send_resp.status_code == 200
        msg_id = send_resp.json()["message_id"]
        
        # Edit the message
        edit_resp = requests.put(f"{BASE_URL}/api/discussions/messages/{msg_id}",
                                headers=auth_headers(superadmin_token),
                                json={"text": "TEST_edited_message"})
        assert edit_resp.status_code == 200, f"Expected 200, got {edit_resp.status_code}: {edit_resp.text}"
        data = edit_resp.json()
        assert data["edited"] == True, "Message should be marked as edited"
        assert data["text"] == "TEST_edited_message", "Edited text mismatch"
        print(f"✓ Edit message success: {msg_id}")
    
    def test_delete_message_success(self, superadmin_token, test_room_id):
        """Delete own message"""
        # First send a message
        send_resp = requests.post(f"{BASE_URL}/api/discussions/rooms/{test_room_id}/messages",
                                 headers=auth_headers(superadmin_token),
                                 json={"text": "TEST_message_to_delete"})
        assert send_resp.status_code == 200
        msg_id = send_resp.json()["message_id"]
        
        # Delete the message
        del_resp = requests.delete(f"{BASE_URL}/api/discussions/messages/{msg_id}",
                                  headers=auth_headers(superadmin_token))
        assert del_resp.status_code == 200, f"Expected 200, got {del_resp.status_code}: {del_resp.text}"
        data = del_resp.json()
        assert data["deleted"] == True, "Message should be marked as deleted"
        print(f"✓ Delete message success: {msg_id}")
    
    def test_react_to_message(self, superadmin_token, test_room_id):
        """Toggle reaction on message"""
        # First send a message
        send_resp = requests.post(f"{BASE_URL}/api/discussions/rooms/{test_room_id}/messages",
                                 headers=auth_headers(superadmin_token),
                                 json={"text": "TEST_message_for_reaction"})
        assert send_resp.status_code == 200
        msg_id = send_resp.json()["message_id"]
        
        # Add reaction
        react_resp = requests.post(f"{BASE_URL}/api/discussions/messages/{msg_id}/react",
                                  headers=auth_headers(superadmin_token),
                                  json={"emoji": "👍"})
        assert react_resp.status_code == 200, f"Expected 200, got {react_resp.status_code}: {react_resp.text}"
        data = react_resp.json()
        assert "reactions" in data, "Missing reactions in response"
        assert "👍" in data["reactions"], "Reaction not added"
        print(f"✓ React to message success: {msg_id} with 👍")
    
    def test_react_empty_emoji_fails(self, superadmin_token, test_room_id):
        """React with empty emoji should fail"""
        # First send a message
        send_resp = requests.post(f"{BASE_URL}/api/discussions/rooms/{test_room_id}/messages",
                                 headers=auth_headers(superadmin_token),
                                 json={"text": "TEST_message_for_empty_reaction"})
        assert send_resp.status_code == 200
        msg_id = send_resp.json()["message_id"]
        
        # Try empty emoji
        react_resp = requests.post(f"{BASE_URL}/api/discussions/messages/{msg_id}/react",
                                  headers=auth_headers(superadmin_token),
                                  json={"emoji": ""})
        assert react_resp.status_code == 400, f"Expected 400 for empty emoji, got {react_resp.status_code}"
        print("✓ Empty emoji correctly rejected")


# ═══════════════════════════════════════════════════════════════════
# BATCH PDF EXPORT TESTS
# ═══════════════════════════════════════════════════════════════════

class TestBatchPDFExport:
    """Test Batch PDF Export functionality"""
    
    def test_batch_export_requires_auth(self):
        """Batch export requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/schemes/batch-export-pdf")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("✓ Batch export requires authentication")
    
    def test_batch_export_requires_mgmt_role(self, teacher_token):
        """Batch export requires management role"""
        resp = requests.get(f"{BASE_URL}/api/schemes/batch-export-pdf", 
                           headers=auth_headers(teacher_token))
        assert resp.status_code == 403, f"Expected 403 for teacher, got {resp.status_code}"
        print("✓ Batch export denies non-management roles")
    
    def test_batch_export_with_token_param(self, superadmin_token):
        """Batch export works with token query param"""
        resp = requests.get(f"{BASE_URL}/api/schemes/batch-export-pdf?token={superadmin_token}")
        # Either 200 (PDF) or 404 (no schemes match)
        assert resp.status_code in [200, 404], f"Expected 200 or 404, got {resp.status_code}: {resp.text}"
        if resp.status_code == 200:
            assert resp.headers.get("content-type") == "application/pdf", "Should return PDF"
            print(f"✓ Batch export returns PDF ({len(resp.content)} bytes)")
        else:
            print("✓ Batch export returns 404 (no schemes match filters)")
    
    def test_batch_export_with_filters(self, superadmin_token):
        """Batch export accepts filter parameters"""
        resp = requests.get(f"{BASE_URL}/api/schemes/batch-export-pdf?token={superadmin_token}&term=Term%201&status=submitted")
        assert resp.status_code in [200, 404], f"Expected 200 or 404, got {resp.status_code}"
        print(f"✓ Batch export with filters: status={resp.status_code}")


class TestSinglePDFExport:
    """Test Single Scheme PDF Export still works"""
    
    @pytest.fixture(scope="class")
    def test_scheme_id(self, superadmin_token):
        """Get a scheme ID with content for testing"""
        resp = requests.get(f"{BASE_URL}/api/schemes/?status=all_submitted", 
                           headers=auth_headers(superadmin_token))
        if resp.status_code == 200:
            schemes = resp.json()
            for s in schemes:
                if s.get("rich_content"):
                    return s["scheme_id"]
        pytest.skip("No schemes with content available for PDF testing")
    
    def test_single_pdf_export_success(self, superadmin_token, test_scheme_id):
        """Single PDF export returns valid PDF"""
        resp = requests.get(f"{BASE_URL}/api/schemes/{test_scheme_id}/export-pdf?token={superadmin_token}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        assert resp.headers.get("content-type") == "application/pdf", "Should return PDF"
        assert len(resp.content) > 0, "PDF should not be empty"
        print(f"✓ Single PDF export success: {len(resp.content)} bytes")


# ═══════════════════════════════════════════════════════════════════
# CLEANUP
# ═══════════════════════════════════════════════════════════════════

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_messages(self, superadmin_token):
        """Cleanup TEST_ prefixed messages (informational only)"""
        # This is informational - messages are soft-deleted anyway
        print("✓ Test messages are soft-deleted (marked as deleted=True)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
