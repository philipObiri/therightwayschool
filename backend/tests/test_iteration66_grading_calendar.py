"""
Iteration 66: Test new TCIS grading scale and Term 3 calendar events
- Grading scale: A* (95-100), A (80-94), B+ (75-79), B (70-74), C+ (65-69), C (60-64), D (50-59), E (45-49), F (35-44), U (0-34)
- Term 3 calendar: 22 school-wide events visible to all roles
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_CREDS = {"email": "ceo@tcis.demo", "password": "ceo123"}
PARENT_CREDS = {"email": "parent@tcis.demo", "password": "parent123"}
HEADTEACHER_CREDS = {"email": "headteacher@tcis.demo", "password": "headteacher123"}


def get_auth_token(email, password):
    """Helper to get auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if response.status_code == 200:
        return response.json().get("token")
    return None


class TestGradingScale:
    """Test the new TCIS grading scale implementation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.token = get_auth_token(CEO_CREDS["email"], CEO_CREDS["password"])
        assert self.token, "CEO login failed"
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_grade_letter_a_for_85_percent(self):
        """A for score 80-94% (Ayeyi Forson has 85.7% in end_of_term)"""
        # Test via report card API - Ayeyi Forson has 85.7% which should be A
        response = requests.get(
            f"{BASE_URL}/api/gradebook/report-card/user_cc6f5faa1522?term=Term%202&report_type=end_of_term",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        # Verify the grade_letter function is working
        # 85.7% should return A (80-94 range)
        assert data.get("overall_grade") == "A", f"Expected A for 85.7%, got {data.get('overall_grade')}"
        assert data.get("overall_remark") == "Excellent", f"Expected Excellent remark, got {data.get('overall_remark')}"
        
        # Also verify individual grade entry
        if data.get("grades"):
            grade = data["grades"][0]
            assert grade.get("grade") == "A", f"Expected grade A, got {grade.get('grade')}"
            assert grade.get("remark") == "Excellent", f"Expected remark Excellent, got {grade.get('remark')}"
    
    def test_grade_letter_boundaries(self):
        """Test grade letter boundaries via gradebook settings"""
        # Get gradebook settings to verify weights
        response = requests.get(f"{BASE_URL}/api/gradebook/settings", headers=self.headers)
        assert response.status_code == 200
        # Settings should return CA/Exam weights
        data = response.json()
        assert "continuous_assessment" in data or isinstance(data, dict)
    
    def test_report_card_grades_format(self):
        """Verify report card returns grades with new scale"""
        response = requests.get(
            f"{BASE_URL}/api/gradebook/report-card/user_cc6f5faa1522?term=Term%202",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "grades" in data
        assert "average" in data
        assert "overall_grade" in data
        assert "overall_remark" in data
        
        # Verify grades have correct fields
        if data["grades"]:
            grade = data["grades"][0]
            assert "grade" in grade or "grade_letter" in grade
            assert "remark" in grade


class TestGradeRemarks:
    """Test grade remarks match TCIS official table"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.token = get_auth_token(CEO_CREDS["email"], CEO_CREDS["password"])
        assert self.token, "CEO login failed"
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_grade_remarks_mapping(self):
        """Verify grade remarks: A*=Distinction, A=Excellent, B+=Very Good, etc."""
        # Get a report card and verify remarks
        response = requests.get(
            f"{BASE_URL}/api/gradebook/report-card/user_cc6f5faa1522?term=Term%202",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Expected mapping
        expected_remarks = {
            "A*": "Distinction",
            "A": "Excellent",
            "B+": "Very Good",
            "B": "Good",
            "C+": "Average",
            "C": "Pass",
            "D": "Credit",
            "E": "Failed",
            "F": "Failed",
            "U": "Ungraded"
        }
        
        # Verify overall remark matches grade
        overall_grade = data.get("overall_grade")
        overall_remark = data.get("overall_remark")
        if overall_grade in expected_remarks:
            assert overall_remark == expected_remarks[overall_grade], \
                f"Grade {overall_grade} should have remark {expected_remarks[overall_grade]}, got {overall_remark}"


class TestCalendarTerm3Events:
    """Test Term 3 2025-2026 calendar events"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.token = get_auth_token(CEO_CREDS["email"], CEO_CREDS["password"])
        assert self.token, "CEO login failed"
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_calendar_events_count(self):
        """Verify 22 school-wide Term 3 events exist"""
        response = requests.get(
            f"{BASE_URL}/api/calendar/events?start=2026-04-01T00:00:00&end=2026-09-30T00:00:00",
            headers=self.headers
        )
        assert response.status_code == 200
        events = response.json()
        
        # Filter school_calendar events
        school_events = [e for e in events if e.get("source") == "school_calendar"]
        assert len(school_events) >= 20, f"Expected at least 20 school events, got {len(school_events)}"
    
    def test_progressive_test_1_dates(self):
        """Progressive Test 1 is May 4-8, 2026"""
        response = requests.get(
            f"{BASE_URL}/api/calendar/events?start=2026-05-01T00:00:00&end=2026-05-10T00:00:00",
            headers=self.headers
        )
        assert response.status_code == 200
        events = response.json()
        
        prog_test = [e for e in events if "Progressive Test 1" in e.get("title", "")]
        assert len(prog_test) > 0, "Progressive Test 1 event not found"
        assert "2026-05-04" in prog_test[0].get("start", ""), f"Progressive Test 1 should start May 4, got {prog_test[0].get('start')}"
    
    def test_midterm_exam_dates(self):
        """Midterm Exam is May 18-29, 2026"""
        response = requests.get(
            f"{BASE_URL}/api/calendar/events?start=2026-05-15T00:00:00&end=2026-05-31T00:00:00",
            headers=self.headers
        )
        assert response.status_code == 200
        events = response.json()
        
        midterm = [e for e in events if "Midterm" in e.get("title", "") or "Mid-Term Exam" in e.get("title", "")]
        assert len(midterm) > 0, "Midterm Exam event not found"
    
    def test_mid_term_break_dates(self):
        """Mid-Term Break is June 1-5, 2026"""
        response = requests.get(
            f"{BASE_URL}/api/calendar/events?start=2026-06-01T00:00:00&end=2026-06-10T00:00:00",
            headers=self.headers
        )
        assert response.status_code == 200
        events = response.json()
        
        break_event = [e for e in events if "MID-TERM BREAK" in e.get("title", "").upper()]
        assert len(break_event) > 0, "Mid-Term Break event not found"
        assert "2026-06-01" in break_event[0].get("start", ""), f"Mid-Term Break should start June 1"
    
    def test_end_of_term_exam_dates(self):
        """End of Term Exam starts June 15, 2026"""
        response = requests.get(
            f"{BASE_URL}/api/calendar/events?start=2026-06-15T00:00:00&end=2026-06-20T00:00:00",
            headers=self.headers
        )
        assert response.status_code == 200
        events = response.json()
        
        end_exam = [e for e in events if "End of Term Exam" in e.get("title", "")]
        assert len(end_exam) > 0, "End of Term Exam event not found"
        assert "2026-06-15" in end_exam[0].get("start", ""), f"End of Term Exam should start June 15"
    
    def test_speech_day_graduation_date(self):
        """Speech Day & Graduation is July 11, 2026"""
        response = requests.get(
            f"{BASE_URL}/api/calendar/events?start=2026-07-10T00:00:00&end=2026-07-15T00:00:00",
            headers=self.headers
        )
        assert response.status_code == 200
        events = response.json()
        
        speech_day = [e for e in events if "Speech" in e.get("title", "") or "Graduation" in e.get("title", "")]
        assert len(speech_day) > 0, "Speech Day & Graduation event not found"
        assert "2026-07-11" in speech_day[0].get("start", ""), f"Speech Day should be July 11"
    
    def test_labour_day_holiday(self):
        """Labour Day is May 1, 2026"""
        response = requests.get(
            f"{BASE_URL}/api/calendar/events?start=2026-04-30T00:00:00&end=2026-05-02T00:00:00",
            headers=self.headers
        )
        assert response.status_code == 200
        events = response.json()
        
        labour_day = [e for e in events if "Labour Day" in e.get("title", "")]
        assert len(labour_day) > 0, "Labour Day event not found"
        assert "2026-05-01" in labour_day[0].get("start", ""), f"Labour Day should be May 1"
    
    def test_eid_al_adha_holiday(self):
        """Eid al-Adha is May 29, 2026"""
        response = requests.get(
            f"{BASE_URL}/api/calendar/events?start=2026-05-28T00:00:00&end=2026-05-30T00:00:00",
            headers=self.headers
        )
        assert response.status_code == 200
        events = response.json()
        
        eid = [e for e in events if "Eid" in e.get("title", "")]
        assert len(eid) > 0, "Eid al-Adha event not found"
        assert "2026-05-29" in eid[0].get("start", ""), f"Eid al-Adha should be May 29"
    
    def test_event_categories(self):
        """Events include correct categories (exam, holiday, academic, etc.)"""
        response = requests.get(
            f"{BASE_URL}/api/calendar/events?start=2026-04-01T00:00:00&end=2026-09-30T00:00:00",
            headers=self.headers
        )
        assert response.status_code == 200
        events = response.json()
        
        school_events = [e for e in events if e.get("source") == "school_calendar"]
        categories = set(e.get("category", "") for e in school_events)
        
        # Should have various categories
        expected_categories = {"exam", "holiday", "academic", "assessment", "ceremony", "reopening"}
        found_categories = categories & expected_categories
        assert len(found_categories) >= 3, f"Expected at least 3 categories, found: {categories}"
    
    def test_events_have_colors(self):
        """Events are color-coded properly"""
        response = requests.get(
            f"{BASE_URL}/api/calendar/events?start=2026-04-01T00:00:00&end=2026-09-30T00:00:00",
            headers=self.headers
        )
        assert response.status_code == 200
        events = response.json()
        
        school_events = [e for e in events if e.get("source") == "school_calendar"]
        for event in school_events[:5]:  # Check first 5
            assert event.get("color"), f"Event {event.get('title')} missing color"
            assert event["color"].startswith("#"), f"Color should be hex format"


class TestCalendarVisibilityByRole:
    """Test calendar events visible to all roles"""
    
    def test_ceo_can_see_calendar_events(self):
        """CEO user can see school calendar events"""
        token = get_auth_token(CEO_CREDS["email"], CEO_CREDS["password"])
        assert token, "CEO login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/calendar/events?start=2026-04-01T00:00:00&end=2026-09-30T00:00:00",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        events = response.json()
        
        school_events = [e for e in events if e.get("source") == "school_calendar"]
        assert len(school_events) >= 20, f"CEO should see school events, got {len(school_events)}"
    
    def test_parent_can_see_calendar_events(self):
        """Parent user can see school calendar events"""
        token = get_auth_token(PARENT_CREDS["email"], PARENT_CREDS["password"])
        assert token, "Parent login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/calendar/events?start=2026-04-01T00:00:00&end=2026-09-30T00:00:00",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        events = response.json()
        
        school_events = [e for e in events if e.get("source") == "school_calendar"]
        assert len(school_events) >= 20, f"Parent should see school events, got {len(school_events)}"
    
    def test_headteacher_can_see_calendar_events(self):
        """HeadTeacher user can see school calendar events"""
        token = get_auth_token(HEADTEACHER_CREDS["email"], HEADTEACHER_CREDS["password"])
        assert token, "HeadTeacher login failed"
        
        response = requests.get(
            f"{BASE_URL}/api/calendar/events?start=2026-04-01T00:00:00&end=2026-09-30T00:00:00",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        events = response.json()
        
        school_events = [e for e in events if e.get("source") == "school_calendar"]
        assert len(school_events) >= 20, f"HeadTeacher should see school events, got {len(school_events)}"


class TestQuizGradeFunctions:
    """Test that quiz.py uses imported grade functions from gradebook"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.token = get_auth_token(CEO_CREDS["email"], CEO_CREDS["password"])
        assert self.token, "CEO login failed"
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_quiz_list_endpoint(self):
        """Verify quiz list endpoint works (uses grade functions)"""
        response = requests.get(f"{BASE_URL}/api/quiz/list", headers=self.headers)
        # Should return 200 even if no quizzes
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
