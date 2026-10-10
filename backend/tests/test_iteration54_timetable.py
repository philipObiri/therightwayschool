"""
Iteration 54: Timetable Data Testing
Tests for the NEW timetable data populated from uploaded PDFs (Year 7, 8, 9, 11, 12)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTimetableData:
    """Test timetable_v2 data populated from uploaded PDFs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as SuperAdmin to get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dwain@tcis.demo",
            "password": "admin123"
        })
        assert response.status_code == 200, f"SuperAdmin login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_admin_timetable_all_year_groups(self):
        """GET /api/academic/admin-timetable - should return entries for all year groups"""
        response = requests.get(f"{BASE_URL}/api/academic/admin-timetable", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "entries" in data, "Response should have 'entries' field"
        assert "year_groups" in data, "Response should have 'year_groups' field"
        
        # Check year groups include the new ones
        year_groups = data["year_groups"]
        print(f"Year groups found: {year_groups}")
        
        # Should have Year 7, 8, 9, 10, 11, 12, 13
        expected_years = ["Year 7", "Year 8", "Year 9", "Year 11", "Year 12"]
        for year in expected_years:
            assert year in year_groups, f"Missing year group: {year}"
        
        # Total entries should be around 342
        total_entries = len(data["entries"])
        print(f"Total timetable entries: {total_entries}")
        assert total_entries > 200, f"Expected >200 entries, got {total_entries}"
        
    def test_year_7_timetable(self):
        """GET /api/academic/admin-timetable?year_group=Year%207 - should return 50 entries"""
        response = requests.get(f"{BASE_URL}/api/academic/admin-timetable?year_group=Year%207", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        entries = data["entries"]
        print(f"Year 7 entries: {len(entries)}")
        assert len(entries) == 50, f"Expected 50 entries for Year 7, got {len(entries)}"
        
        # Check subjects for Year 7
        subjects = set(e["subject"] for e in entries)
        print(f"Year 7 subjects: {subjects}")
        
        # Year 7 Monday should have MATH, FRENCH, ENGLISH, ICT, COMBINED SCIENCE
        monday_entries = [e for e in entries if e["day"] == "Monday"]
        monday_subjects = set(e["subject"] for e in monday_entries)
        print(f"Year 7 Monday subjects: {monday_subjects}")
        
        expected_monday = ["MATH", "FRENCH", "ENGLISH", "ICT", "COMBINED SCIENCE"]
        for subj in expected_monday:
            assert any(subj in s for s in monday_subjects), f"Year 7 Monday missing: {subj}"
            
    def test_year_8_timetable(self):
        """GET /api/academic/admin-timetable?year_group=Year%208 - should return 50 entries"""
        response = requests.get(f"{BASE_URL}/api/academic/admin-timetable?year_group=Year%208", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        entries = data["entries"]
        print(f"Year 8 entries: {len(entries)}")
        assert len(entries) == 50, f"Expected 50 entries for Year 8, got {len(entries)}"
        
    def test_year_9_timetable(self):
        """GET /api/academic/admin-timetable?year_group=Year%209 - should return 47 entries"""
        response = requests.get(f"{BASE_URL}/api/academic/admin-timetable?year_group=Year%209", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        entries = data["entries"]
        print(f"Year 9 entries: {len(entries)}")
        assert len(entries) == 47, f"Expected 47 entries for Year 9, got {len(entries)}"
        
    def test_year_11_timetable(self):
        """GET /api/academic/admin-timetable?year_group=Year%2011 - should return 49 entries"""
        response = requests.get(f"{BASE_URL}/api/academic/admin-timetable?year_group=Year%2011", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        entries = data["entries"]
        print(f"Year 11 entries: {len(entries)}")
        assert len(entries) == 49, f"Expected 49 entries for Year 11, got {len(entries)}"
        
    def test_year_12_timetable(self):
        """GET /api/academic/admin-timetable?year_group=Year%2012 - should return 50 entries"""
        response = requests.get(f"{BASE_URL}/api/academic/admin-timetable?year_group=Year%2012", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        entries = data["entries"]
        print(f"Year 12 entries: {len(entries)}")
        assert len(entries) == 50, f"Expected 50 entries for Year 12, got {len(entries)}"
        
        # Year 12 should have split subjects like 'ENGLISH LANGUAGE / CHEMISTRY / ACCOUNTING'
        subjects = [e["subject"] for e in entries]
        split_subjects = [s for s in subjects if "/" in s]
        print(f"Year 12 split subjects: {split_subjects[:5]}")
        assert len(split_subjects) > 0, "Year 12 should have split subjects with '/'"


class TestTeacherTimetable:
    """Test my-timetable endpoint for teachers"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as Teacher (Edmund) to get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user = response.json().get("user", {})
        
    def test_teacher_my_timetable(self):
        """GET /api/academic/my-timetable - teacher should get matched timetable entries"""
        response = requests.get(f"{BASE_URL}/api/academic/my-timetable", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "entries" in data, "Response should have 'entries' field"
        entries = data["entries"]
        print(f"Teacher timetable entries: {len(entries)}")
        
        # Edmund teaches ICT - should have ICT entries
        if len(entries) > 0:
            subjects = set(e["subject"] for e in entries)
            print(f"Teacher matched subjects: {subjects}")
            
            # Check if ICT is in the matched subjects
            ict_entries = [e for e in entries if "ICT" in e["subject"].upper()]
            print(f"ICT entries found: {len(ict_entries)}")
            
            # Verify entries have required fields
            for entry in entries[:3]:
                assert "day" in entry, "Entry should have 'day'"
                assert "start_time" in entry, "Entry should have 'start_time'"
                assert "subject" in entry, "Entry should have 'subject'"
                assert "year_group" in entry, "Entry should have 'year_group'"
                print(f"  {entry['day']} {entry['start_time']}: {entry['subject']} ({entry['year_group']})")


class TestHealthCheck:
    """Basic health check"""
    
    def test_health(self):
        """GET /api/health - should return healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("Health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
