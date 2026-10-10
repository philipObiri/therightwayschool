"""
Iteration 38: Admin Timetable Drag-and-Drop Rescheduling Tests
Tests for:
- GET /api/academic/admin-timetable (with/without year_group filter)
- PUT /api/academic/timetable/{entry_id}/reschedule (move entry to new day/time)
- PUT /api/academic/timetable/{entry_id}/swap (swap two entries)
- Role-based access control (403 for non-admin users)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
SUPERADMIN_CREDS = {"email": "dwain@tcis.demo", "password": "admin123"}
TEACHER_CREDS = {"email": "edmund@tcis.demo", "password": "teacher123"}


@pytest.fixture(scope="module")
def superadmin_token():
    """Get SuperAdmin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPERADMIN_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"SuperAdmin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def teacher_token():
    """Get Teacher auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=TEACHER_CREDS)
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Teacher login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def superadmin_client(superadmin_token):
    """Session with SuperAdmin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {superadmin_token}"
    })
    return session


@pytest.fixture(scope="module")
def teacher_client(teacher_token):
    """Session with Teacher auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {teacher_token}"
    })
    return session


class TestAdminTimetableEndpoint:
    """Tests for GET /api/academic/admin-timetable"""

    def test_admin_timetable_requires_auth(self):
        """Unauthenticated request should return 401/403"""
        response = requests.get(f"{BASE_URL}/api/academic/admin-timetable")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Admin timetable requires authentication")

    def test_teacher_cannot_access_admin_timetable(self, teacher_client):
        """Teacher role should get 403 on admin-timetable endpoint"""
        response = teacher_client.get(f"{BASE_URL}/api/academic/admin-timetable")
        assert response.status_code == 403, f"Expected 403 for teacher, got {response.status_code}"
        print("✓ Teacher gets 403 on admin-timetable endpoint")

    def test_admin_timetable_without_year_group(self, superadmin_client):
        """GET without year_group returns all entries and year_groups list"""
        response = superadmin_client.get(f"{BASE_URL}/api/academic/admin-timetable")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "entries" in data, "Response should contain 'entries'"
        assert "year_groups" in data, "Response should contain 'year_groups'"
        assert isinstance(data["entries"], list), "entries should be a list"
        assert isinstance(data["year_groups"], list), "year_groups should be a list"
        
        # Should have multiple year groups (Year 7-13)
        assert len(data["year_groups"]) >= 1, "Should have at least 1 year group"
        print(f"✓ Admin timetable returns {len(data['entries'])} entries, {len(data['year_groups'])} year groups")

    def test_admin_timetable_with_year_group_filter(self, superadmin_client):
        """GET with year_group=Year+10 returns filtered entries"""
        response = superadmin_client.get(f"{BASE_URL}/api/academic/admin-timetable?year_group=Year+10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "entries" in data, "Response should contain 'entries'"
        
        # All entries should be for Year 10
        for entry in data["entries"]:
            assert entry.get("year_group") == "Year 10", f"Entry should be Year 10, got {entry.get('year_group')}"
        
        print(f"✓ Year 10 filter returns {len(data['entries'])} entries")

    def test_admin_timetable_entry_structure(self, superadmin_client):
        """Verify timetable entry has required fields"""
        response = superadmin_client.get(f"{BASE_URL}/api/academic/admin-timetable?year_group=Year+10")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["entries"]) > 0:
            entry = data["entries"][0]
            required_fields = ["entry_id", "year_group", "day", "start_time", "end_time", "subject"]
            for field in required_fields:
                assert field in entry, f"Entry should have '{field}' field"
            print(f"✓ Entry structure verified: {list(entry.keys())}")
        else:
            pytest.skip("No entries to verify structure")


class TestRescheduleEndpoint:
    """Tests for PUT /api/academic/timetable/{entry_id}/reschedule"""

    @pytest.fixture(scope="class")
    def test_entry(self, superadmin_client):
        """Get a test entry to reschedule"""
        response = superadmin_client.get(f"{BASE_URL}/api/academic/admin-timetable?year_group=Year+10")
        if response.status_code == 200 and len(response.json().get("entries", [])) > 0:
            return response.json()["entries"][0]
        pytest.skip("No entries available for reschedule test")

    def test_reschedule_requires_auth(self):
        """Unauthenticated request should return 401/403"""
        response = requests.put(
            f"{BASE_URL}/api/academic/timetable/test_entry/reschedule",
            json={"day": "Monday", "start_time": "9:00"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Reschedule requires authentication")

    def test_teacher_cannot_reschedule(self, teacher_client):
        """Teacher role should get 403 on reschedule endpoint"""
        response = teacher_client.put(
            f"{BASE_URL}/api/academic/timetable/test_entry/reschedule",
            json={"day": "Monday", "start_time": "9:00"}
        )
        assert response.status_code == 403, f"Expected 403 for teacher, got {response.status_code}"
        print("✓ Teacher gets 403 on reschedule endpoint")

    def test_reschedule_validates_day(self, superadmin_client, test_entry):
        """Reschedule should reject invalid day"""
        response = superadmin_client.put(
            f"{BASE_URL}/api/academic/timetable/{test_entry['entry_id']}/reschedule",
            json={"day": "InvalidDay", "start_time": "9:00"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid day, got {response.status_code}"
        print("✓ Reschedule rejects invalid day")

    def test_reschedule_requires_day_and_time(self, superadmin_client, test_entry):
        """Reschedule should require day and start_time"""
        response = superadmin_client.put(
            f"{BASE_URL}/api/academic/timetable/{test_entry['entry_id']}/reschedule",
            json={}
        )
        assert response.status_code == 400, f"Expected 400 for missing fields, got {response.status_code}"
        print("✓ Reschedule requires day and start_time")

    def test_reschedule_entry_success(self, superadmin_client, test_entry):
        """Successfully reschedule an entry to a new day/time"""
        original_day = test_entry["day"]
        original_start = test_entry["start_time"]
        original_end = test_entry["end_time"]
        
        # Move to a different day
        new_day = "Friday" if original_day != "Friday" else "Monday"
        
        response = superadmin_client.put(
            f"{BASE_URL}/api/academic/timetable/{test_entry['entry_id']}/reschedule",
            json={"day": new_day, "start_time": original_start, "end_time": original_end}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        updated = response.json()
        assert updated["day"] == new_day, f"Day should be {new_day}, got {updated['day']}"
        print(f"✓ Entry rescheduled from {original_day} to {new_day}")
        
        # Restore original
        restore_response = superadmin_client.put(
            f"{BASE_URL}/api/academic/timetable/{test_entry['entry_id']}/reschedule",
            json={"day": original_day, "start_time": original_start, "end_time": original_end}
        )
        assert restore_response.status_code == 200, "Failed to restore entry"
        print(f"✓ Entry restored to {original_day}")

    def test_reschedule_nonexistent_entry(self, superadmin_client):
        """Reschedule nonexistent entry should return 404"""
        response = superadmin_client.put(
            f"{BASE_URL}/api/academic/timetable/nonexistent_entry_id/reschedule",
            json={"day": "Monday", "start_time": "9:00"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Reschedule nonexistent entry returns 404")


class TestSwapEndpoint:
    """Tests for PUT /api/academic/timetable/{entry_id}/swap"""

    @pytest.fixture(scope="class")
    def test_entries(self, superadmin_client):
        """Get two test entries to swap"""
        response = superadmin_client.get(f"{BASE_URL}/api/academic/admin-timetable?year_group=Year+10")
        if response.status_code == 200:
            entries = response.json().get("entries", [])
            if len(entries) >= 2:
                return entries[0], entries[1]
        pytest.skip("Need at least 2 entries for swap test")

    def test_swap_requires_auth(self):
        """Unauthenticated request should return 401/403"""
        response = requests.put(
            f"{BASE_URL}/api/academic/timetable/test_entry/swap",
            json={"target_entry_id": "other_entry"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Swap requires authentication")

    def test_teacher_cannot_swap(self, teacher_client):
        """Teacher role should get 403 on swap endpoint"""
        response = teacher_client.put(
            f"{BASE_URL}/api/academic/timetable/test_entry/swap",
            json={"target_entry_id": "other_entry"}
        )
        assert response.status_code == 403, f"Expected 403 for teacher, got {response.status_code}"
        print("✓ Teacher gets 403 on swap endpoint")

    def test_swap_requires_target_entry_id(self, superadmin_client, test_entries):
        """Swap should require target_entry_id"""
        entry_a, _ = test_entries
        response = superadmin_client.put(
            f"{BASE_URL}/api/academic/timetable/{entry_a['entry_id']}/swap",
            json={}
        )
        assert response.status_code == 400, f"Expected 400 for missing target_entry_id, got {response.status_code}"
        print("✓ Swap requires target_entry_id")

    def test_swap_entries_success(self, superadmin_client, test_entries):
        """Successfully swap two entries"""
        entry_a, entry_b = test_entries
        
        original_a_day = entry_a["day"]
        original_a_start = entry_a["start_time"]
        original_a_end = entry_a["end_time"]
        original_b_day = entry_b["day"]
        original_b_start = entry_b["start_time"]
        original_b_end = entry_b["end_time"]
        
        # Swap entries
        response = superadmin_client.put(
            f"{BASE_URL}/api/academic/timetable/{entry_a['entry_id']}/swap",
            json={"target_entry_id": entry_b["entry_id"]}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "message" in result, "Response should contain message"
        assert result["message"] == "Swapped", f"Expected 'Swapped', got {result['message']}"
        print(f"✓ Swapped {entry_a['subject']} with {entry_b['subject']}")
        
        # Verify swap by fetching entries again
        verify_response = superadmin_client.get(f"{BASE_URL}/api/academic/admin-timetable?year_group=Year+10")
        assert verify_response.status_code == 200
        
        entries = verify_response.json()["entries"]
        updated_a = next((e for e in entries if e["entry_id"] == entry_a["entry_id"]), None)
        updated_b = next((e for e in entries if e["entry_id"] == entry_b["entry_id"]), None)
        
        if updated_a and updated_b:
            # Entry A should now have B's original day/time
            assert updated_a["day"] == original_b_day, f"Entry A day should be {original_b_day}"
            assert updated_a["start_time"] == original_b_start, f"Entry A start_time should be {original_b_start}"
            # Entry B should now have A's original day/time
            assert updated_b["day"] == original_a_day, f"Entry B day should be {original_a_day}"
            assert updated_b["start_time"] == original_a_start, f"Entry B start_time should be {original_a_start}"
            print("✓ Swap verified - entries have exchanged day/time")
        
        # Restore original positions by swapping back
        restore_response = superadmin_client.put(
            f"{BASE_URL}/api/academic/timetable/{entry_a['entry_id']}/swap",
            json={"target_entry_id": entry_b["entry_id"]}
        )
        assert restore_response.status_code == 200, "Failed to restore entries"
        print("✓ Entries restored to original positions")

    def test_swap_nonexistent_entry(self, superadmin_client, test_entries):
        """Swap with nonexistent entry should return 404"""
        entry_a, _ = test_entries
        response = superadmin_client.put(
            f"{BASE_URL}/api/academic/timetable/{entry_a['entry_id']}/swap",
            json={"target_entry_id": "nonexistent_entry_id"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Swap with nonexistent target returns 404")


class TestMyTimetableEndpoint:
    """Tests for GET /api/academic/my-timetable (teacher's personalized timetable)"""

    def test_my_timetable_requires_auth(self):
        """Unauthenticated request should return 401/403"""
        response = requests.get(f"{BASE_URL}/api/academic/my-timetable")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ My timetable requires authentication")

    def test_teacher_can_access_my_timetable(self, teacher_client):
        """Teacher should be able to access their personalized timetable"""
        response = teacher_client.get(f"{BASE_URL}/api/academic/my-timetable")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "entries" in data, "Response should contain 'entries'"
        assert isinstance(data["entries"], list), "entries should be a list"
        print(f"✓ Teacher can access my-timetable with {len(data['entries'])} entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
