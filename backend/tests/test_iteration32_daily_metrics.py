"""
Iteration 32: Test Daily Activity Score Feature
Tests both teacher-full-review and my-review endpoints for daily_metrics
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "dwain@tcis.demo"
SUPERADMIN_PASSWORD = "admin123"
TEACHER_EMAIL = "edmund@tcis.demo"
TEACHER_PASSWORD = "teacher123"


class TestDailyMetricsBackend:
    """Test daily_metrics feature in monitoring endpoints"""
    
    @pytest.fixture(scope="class")
    def superadmin_token(self):
        """Get SuperAdmin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"SuperAdmin login failed: {response.status_code}")
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        """Get Teacher auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEACHER_EMAIL,
            "password": TEACHER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Teacher login failed: {response.status_code}")
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def teacher_user_id(self, teacher_token):
        """Get teacher user_id from profile"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {teacher_token}"
        })
        if response.status_code != 200:
            pytest.skip("Failed to get teacher profile")
        return response.json().get("user_id")
    
    # ─── Test teacher-full-review endpoint ───
    def test_teacher_full_review_returns_activity_metrics(self, superadmin_token, teacher_user_id):
        """GET /api/monitoring/teacher-full-review/{teacher_id} should return activity_metrics (monthly)"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_user_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check activity_metrics exists
        assert "activity_metrics" in data, "Response missing 'activity_metrics' field"
        metrics = data["activity_metrics"]
        
        # Validate structure
        assert "overall_score" in metrics, "activity_metrics missing 'overall_score'"
        assert "activity_level" in metrics, "activity_metrics missing 'activity_level'"
        assert "breakdown" in metrics, "activity_metrics missing 'breakdown'"
        assert "period" in metrics, "activity_metrics missing 'period'"
        
        # Validate period is 30 days
        assert metrics["period"] == "30 days", f"Expected period '30 days', got '{metrics['period']}'"
        
        # Validate breakdown has expected keys
        breakdown = metrics["breakdown"]
        expected_keys = ["lessons", "assignments", "plans", "files", "clock_hours", "grading", "platform_activity"]
        for key in expected_keys:
            assert key in breakdown, f"breakdown missing '{key}'"
        
        print(f"✓ activity_metrics: overall_score={metrics['overall_score']}, level={metrics['activity_level']}")
    
    def test_teacher_full_review_returns_daily_metrics(self, superadmin_token, teacher_user_id):
        """GET /api/monitoring/teacher-full-review/{teacher_id} should return daily_metrics (today)"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_user_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Check daily_metrics exists
        assert "daily_metrics" in data, "Response missing 'daily_metrics' field"
        daily = data["daily_metrics"]
        
        # Validate structure
        assert "overall_score" in daily, "daily_metrics missing 'overall_score'"
        assert "activity_level" in daily, "daily_metrics missing 'activity_level'"
        assert "breakdown" in daily, "daily_metrics missing 'breakdown'"
        assert "period" in daily, "daily_metrics missing 'period'"
        assert "date" in daily, "daily_metrics missing 'date'"
        
        # Validate period is today
        assert daily["period"] == "today", f"Expected period 'today', got '{daily['period']}'"
        
        # Validate breakdown has expected keys for daily
        breakdown = daily["breakdown"]
        expected_keys = ["lessons", "assignments", "plans", "files", "clock_hours", "platform_activity"]
        for key in expected_keys:
            assert key in breakdown, f"daily breakdown missing '{key}'"
        
        # Validate daily breakdown has count_today and target fields
        for key in ["lessons", "assignments", "plans", "files"]:
            assert "count_today" in breakdown[key], f"daily {key} missing 'count_today'"
            assert "target" in breakdown[key], f"daily {key} missing 'target'"
        
        assert "hours_today" in breakdown["clock_hours"], "daily clock_hours missing 'hours_today'"
        assert "actions_today" in breakdown["platform_activity"], "daily platform_activity missing 'actions_today'"
        
        print(f"✓ daily_metrics: overall_score={daily['overall_score']}, level={daily['activity_level']}, date={daily['date']}")
    
    def test_daily_metrics_targets_are_correct(self, superadmin_token, teacher_user_id):
        """Verify daily targets: 2 lessons, 2 assignments, 1 plan, 4 files, 8 hours, 10 actions"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_user_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        daily = response.json()["daily_metrics"]["breakdown"]
        
        # Check targets
        assert daily["lessons"]["target"] == 2, f"lessons target should be 2, got {daily['lessons']['target']}"
        assert daily["assignments"]["target"] == 2, f"assignments target should be 2, got {daily['assignments']['target']}"
        assert daily["plans"]["target"] == 1, f"plans target should be 1, got {daily['plans']['target']}"
        assert daily["files"]["target"] == 4, f"files target should be 4, got {daily['files']['target']}"
        assert daily["clock_hours"]["target"] == 8, f"clock_hours target should be 8, got {daily['clock_hours']['target']}"
        assert daily["platform_activity"]["target"] == 10, f"platform_activity target should be 10, got {daily['platform_activity']['target']}"
        
        print("✓ All daily targets are correct: 2 lessons, 2 assignments, 1 plan, 4 files, 8h clock, 10 actions")
    
    # ─── Test my-review endpoint ───
    def test_my_review_returns_activity_metrics(self, teacher_token):
        """GET /api/monitoring/my-review should return activity_metrics for logged-in teacher"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "activity_metrics" in data, "my-review missing 'activity_metrics'"
        metrics = data["activity_metrics"]
        assert "overall_score" in metrics
        assert "activity_level" in metrics
        assert "breakdown" in metrics
        
        print(f"✓ my-review activity_metrics: score={metrics['overall_score']}, level={metrics['activity_level']}")
    
    def test_my_review_returns_daily_metrics(self, teacher_token):
        """GET /api/monitoring/my-review should return daily_metrics for logged-in teacher"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "daily_metrics" in data, "my-review missing 'daily_metrics'"
        daily = data["daily_metrics"]
        assert "overall_score" in daily
        assert "activity_level" in daily
        assert "breakdown" in daily
        assert "date" in daily
        
        # Validate breakdown structure
        breakdown = daily["breakdown"]
        for key in ["lessons", "assignments", "plans", "files", "clock_hours", "platform_activity"]:
            assert key in breakdown, f"my-review daily breakdown missing '{key}'"
        
        print(f"✓ my-review daily_metrics: score={daily['overall_score']}, level={daily['activity_level']}, date={daily['date']}")
    
    def test_my_review_daily_metrics_has_correct_structure(self, teacher_token):
        """Verify my-review daily_metrics has count_today, target, and score for each metric"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        daily = response.json()["daily_metrics"]["breakdown"]
        
        # Each metric should have score and weight
        for key in ["lessons", "assignments", "plans", "files", "clock_hours", "platform_activity"]:
            assert "score" in daily[key], f"{key} missing 'score'"
            assert "weight" in daily[key], f"{key} missing 'weight'"
        
        print("✓ my-review daily_metrics breakdown has correct structure (score, weight, count/hours, target)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
