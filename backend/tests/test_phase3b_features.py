"""
TCIS LMS Phase 3B Feature Tests
Tests for: Calendar Integration, AI-Assisted Search, Knowledge Base
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_CREDENTIALS = {
    "ceo": {"email": "ceo@tcis.demo", "password": "ceo123"},
    "superadmin": {"email": "dwain@tcis.demo", "password": "admin123"},
    "teacher": {"email": "edmund@tcis.demo", "password": "teacher123"},
}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token for CEO user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["ceo"])
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def teacher_token(api_client):
    """Get authentication token for Teacher user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS["teacher"])
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Teacher authentication failed")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestCalendarAPI:
    """Calendar Integration API Tests"""

    def test_get_calendar_events(self, api_client, auth_token):
        """GET /api/calendar/events - returns array of events"""
        response = api_client.get(
            f"{BASE_URL}/api/calendar/events",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of events"
        print(f"Calendar events returned: {len(data)} events")

    def test_get_calendar_events_with_date_range(self, api_client, auth_token):
        """GET /api/calendar/events with start/end params"""
        start = (datetime.now() - timedelta(days=30)).isoformat()
        end = (datetime.now() + timedelta(days=60)).isoformat()
        response = api_client.get(
            f"{BASE_URL}/api/calendar/events",
            params={"start": start, "end": end},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check event structure if any events exist
        if data:
            event = data[0]
            assert "event_id" in event
            assert "title" in event
            assert "start" in event
            assert "type" in event
            print(f"Event types found: {set(e['type'] for e in data)}")

    def test_create_calendar_event(self, api_client, auth_token):
        """POST /api/calendar/events - creates a new custom event"""
        start_time = (datetime.now() + timedelta(days=1)).isoformat()
        end_time = (datetime.now() + timedelta(days=1, hours=2)).isoformat()
        payload = {
            "title": "TEST_Phase3B_Event",
            "description": "Test event for Phase 3B testing",
            "start_time": start_time,
            "end_time": end_time,
            "color": "#2E6CC4",
            "all_day": False
        }
        response = api_client.post(
            f"{BASE_URL}/api/calendar/events",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "event_id" in data
        assert data["title"] == "TEST_Phase3B_Event"
        print(f"Created event: {data['event_id']}")
        return data["event_id"]

    def test_update_calendar_event(self, api_client, auth_token):
        """PUT /api/calendar/events/{event_id} - updates an event"""
        # First create an event
        start_time = (datetime.now() + timedelta(days=2)).isoformat()
        create_response = api_client.post(
            f"{BASE_URL}/api/calendar/events",
            json={"title": "TEST_Update_Event", "start_time": start_time},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        event_id = create_response.json()["event_id"]

        # Update the event
        update_response = api_client.put(
            f"{BASE_URL}/api/calendar/events/{event_id}",
            json={"title": "TEST_Updated_Event", "description": "Updated description"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert update_response.status_code == 200
        print(f"Updated event: {event_id}")

    def test_delete_calendar_event(self, api_client, auth_token):
        """DELETE /api/calendar/events/{event_id} - deletes an event"""
        # First create an event
        start_time = (datetime.now() + timedelta(days=3)).isoformat()
        create_response = api_client.post(
            f"{BASE_URL}/api/calendar/events",
            json={"title": "TEST_Delete_Event", "start_time": start_time},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        event_id = create_response.json()["event_id"]

        # Delete the event
        delete_response = api_client.delete(
            f"{BASE_URL}/api/calendar/events/{event_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert delete_response.status_code == 200
        print(f"Deleted event: {event_id}")


class TestKnowledgeBaseAPI:
    """Knowledge Base API Tests"""

    def test_get_kb_articles(self, api_client, auth_token):
        """GET /api/knowledge-base/articles - returns list of approved articles"""
        response = api_client.get(
            f"{BASE_URL}/api/knowledge-base/articles",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of articles"
        print(f"Knowledge Base articles: {len(data)} articles")
        if data:
            article = data[0]
            assert "article_id" in article
            assert "title" in article
            print(f"First article: {article.get('title', 'N/A')}")

    def test_get_kb_categories(self, api_client, auth_token):
        """GET /api/knowledge-base/categories - returns categories and departments"""
        response = api_client.get(
            f"{BASE_URL}/api/knowledge-base/categories",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "categories" in data
        assert "departments" in data
        assert isinstance(data["categories"], list)
        assert isinstance(data["departments"], list)
        print(f"Categories: {data['categories']}, Departments: {data['departments']}")

    def test_get_kb_stats(self, api_client, auth_token):
        """GET /api/knowledge-base/stats - returns KB statistics"""
        response = api_client.get(
            f"{BASE_URL}/api/knowledge-base/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "total_articles" in data
        assert "total_views" in data
        print(f"KB Stats: {data['total_articles']} articles, {data['total_views']} views")

    def test_search_kb_articles(self, api_client, auth_token):
        """GET /api/knowledge-base/articles with search query"""
        response = api_client.get(
            f"{BASE_URL}/api/knowledge-base/articles",
            params={"q": "test"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Search results for 'test': {len(data)} articles")

    def test_filter_kb_by_category(self, api_client, auth_token):
        """GET /api/knowledge-base/articles with category filter"""
        response = api_client.get(
            f"{BASE_URL}/api/knowledge-base/articles",
            params={"category": "general"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Articles in 'general' category: {len(data)}")


class TestSearchAPI:
    """Search API Tests (Regular + AI-Assisted)"""

    def test_global_search(self, api_client, auth_token):
        """GET /api/search?q=sandra - returns search results"""
        response = api_client.get(
            f"{BASE_URL}/api/search",
            params={"q": "sandra"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "results" in data
        assert isinstance(data["results"], list)
        print(f"Search results for 'sandra': {len(data['results'])} results")
        if data["results"]:
            result = data["results"][0]
            assert "type" in result
            assert "title" in result
            print(f"First result: {result['type']} - {result['title']}")

    def test_global_search_short_query(self, api_client, auth_token):
        """GET /api/search with short query returns empty"""
        response = api_client.get(
            f"{BASE_URL}/api/search",
            params={"q": "a"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["results"] == []

    def test_ai_search(self, api_client, auth_token):
        """GET /api/search/ai?q=sandra - returns AI answer with suggestions"""
        response = api_client.get(
            f"{BASE_URL}/api/search/ai",
            params={"q": "sandra"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30  # AI search may take longer
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "answer" in data
        assert "suggestions" in data
        assert "results" in data
        print(f"AI Answer: {data['answer'][:100]}..." if data['answer'] else "No AI answer")
        print(f"Suggestions: {data['suggestions']}")
        print(f"Results count: {len(data['results'])}")

    def test_ai_search_teacher_query(self, api_client, auth_token):
        """GET /api/search/ai with teacher-related query"""
        response = api_client.get(
            f"{BASE_URL}/api/search/ai",
            params={"q": "who are the teachers"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        print(f"AI Answer for teachers query: {data['answer'][:150]}..." if data['answer'] else "No answer")

    def test_ai_search_short_query(self, api_client, auth_token):
        """GET /api/search/ai with short query returns empty"""
        response = api_client.get(
            f"{BASE_URL}/api/search/ai",
            params={"q": "ab"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["answer"] == ""


class TestCalendarTeacherAccess:
    """Test Calendar access for Teacher role"""

    def test_teacher_can_access_calendar(self, api_client, teacher_token):
        """Teacher should be able to access calendar events"""
        response = api_client.get(
            f"{BASE_URL}/api/calendar/events",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Teacher can access calendar: {len(data)} events")

    def test_teacher_can_create_event(self, api_client, teacher_token):
        """Teacher should be able to create calendar events"""
        start_time = (datetime.now() + timedelta(days=5)).isoformat()
        response = api_client.post(
            f"{BASE_URL}/api/calendar/events",
            json={"title": "TEST_Teacher_Event", "start_time": start_time},
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "event_id" in data
        print(f"Teacher created event: {data['event_id']}")


class TestKnowledgeBaseTeacherAccess:
    """Test Knowledge Base access for Teacher role"""

    def test_teacher_can_access_kb(self, api_client, teacher_token):
        """Teacher should be able to access knowledge base"""
        response = api_client.get(
            f"{BASE_URL}/api/knowledge-base/articles",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Teacher can access KB: {len(data)} articles")

    def test_teacher_can_access_kb_stats(self, api_client, teacher_token):
        """Teacher should be able to access KB stats"""
        response = api_client.get(
            f"{BASE_URL}/api/knowledge-base/stats",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_articles" in data
        print(f"Teacher KB stats access: {data['total_articles']} articles")


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(api_client, auth_token):
    """Cleanup TEST_ prefixed events after tests"""
    yield
    # Cleanup: Get all events and delete TEST_ ones
    try:
        response = api_client.get(
            f"{BASE_URL}/api/calendar/events",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code == 200:
            events = response.json()
            for event in events:
                if event.get("title", "").startswith("TEST_"):
                    api_client.delete(
                        f"{BASE_URL}/api/calendar/events/{event['event_id']}",
                        headers={"Authorization": f"Bearer {auth_token}"}
                    )
                    print(f"Cleaned up event: {event['event_id']}")
    except Exception as e:
        print(f"Cleanup error: {e}")
