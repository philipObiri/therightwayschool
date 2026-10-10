"""
Iteration 33: Test Working Paper (WP) metrics in Activity Score
- Tests that wp_documents and wp_actions are included in both monthly and daily breakdowns
- Verifies weight totals sum to 100%
- Tests both teacher-full-review (management view) and my-review (teacher self-view) endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestWPMetricsBackend:
    """Test Working Paper metrics in Activity Score"""
    
    @pytest.fixture(scope="class")
    def superadmin_token(self):
        """Login as SuperAdmin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dwain@tcis.demo",
            "password": "admin123"
        })
        assert response.status_code == 200, f"SuperAdmin login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def teacher_token(self):
        """Login as Teacher"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "edmund@tcis.demo",
            "password": "teacher123"
        })
        assert response.status_code == 200, f"Teacher login failed: {response.text}"
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def teacher_id(self, teacher_token):
        """Get teacher user_id"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {teacher_token}"
        })
        assert response.status_code == 200
        return response.json().get("user_id")
    
    def test_teacher_full_review_has_9_monthly_metrics(self, superadmin_token, teacher_id):
        """Test that teacher-full-review returns 9 monthly metrics including WP"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check activity_metrics exists
        assert "activity_metrics" in data, "activity_metrics missing from response"
        activity_metrics = data["activity_metrics"]
        
        # Check breakdown exists
        assert "breakdown" in activity_metrics, "breakdown missing from activity_metrics"
        breakdown = activity_metrics["breakdown"]
        
        # Verify 9 metrics exist
        expected_metrics = ["lessons", "assignments", "plans", "files", "clock_hours", 
                          "grading", "platform_activity", "wp_documents", "wp_actions"]
        for metric in expected_metrics:
            assert metric in breakdown, f"Monthly metric '{metric}' missing from breakdown"
        
        assert len(breakdown) == 9, f"Expected 9 monthly metrics, got {len(breakdown)}"
        print(f"✓ Monthly breakdown has 9 metrics: {list(breakdown.keys())}")
    
    def test_teacher_full_review_has_8_daily_metrics(self, superadmin_token, teacher_id):
        """Test that teacher-full-review returns 8 daily metrics including WP"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check daily_metrics exists
        assert "daily_metrics" in data, "daily_metrics missing from response"
        daily_metrics = data["daily_metrics"]
        
        # Check breakdown exists
        assert "breakdown" in daily_metrics, "breakdown missing from daily_metrics"
        breakdown = daily_metrics["breakdown"]
        
        # Verify 8 metrics exist (no grading in daily)
        expected_metrics = ["lessons", "assignments", "plans", "files", "clock_hours", 
                          "platform_activity", "wp_documents", "wp_actions"]
        for metric in expected_metrics:
            assert metric in breakdown, f"Daily metric '{metric}' missing from breakdown"
        
        assert len(breakdown) == 8, f"Expected 8 daily metrics, got {len(breakdown)}"
        print(f"✓ Daily breakdown has 8 metrics: {list(breakdown.keys())}")
    
    def test_monthly_weights_sum_to_100(self, superadmin_token, teacher_id):
        """Test that monthly weights sum to 100%"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        breakdown = data["activity_metrics"]["breakdown"]
        total_weight = sum(m.get("weight", 0) for m in breakdown.values())
        
        # Expected: 15+12+10+8+15+8+7+15+10 = 100
        assert total_weight == 100, f"Monthly weights sum to {total_weight}, expected 100"
        
        # Verify individual weights
        expected_weights = {
            "lessons": 15, "assignments": 12, "plans": 10, "files": 8,
            "clock_hours": 15, "grading": 8, "platform_activity": 7,
            "wp_documents": 15, "wp_actions": 10
        }
        for metric, expected in expected_weights.items():
            actual = breakdown[metric].get("weight", 0)
            assert actual == expected, f"Monthly {metric} weight is {actual}, expected {expected}"
        
        print(f"✓ Monthly weights sum to 100: {total_weight}")
    
    def test_daily_weights_sum_to_100(self, superadmin_token, teacher_id):
        """Test that daily weights sum to 100%"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        breakdown = data["daily_metrics"]["breakdown"]
        total_weight = sum(m.get("weight", 0) for m in breakdown.values())
        
        # Expected: 15+12+8+8+15+7+20+15 = 100
        assert total_weight == 100, f"Daily weights sum to {total_weight}, expected 100"
        
        # Verify individual weights
        expected_weights = {
            "lessons": 15, "assignments": 12, "plans": 8, "files": 8,
            "clock_hours": 15, "platform_activity": 7,
            "wp_documents": 20, "wp_actions": 15
        }
        for metric, expected in expected_weights.items():
            actual = breakdown[metric].get("weight", 0)
            assert actual == expected, f"Daily {metric} weight is {actual}, expected {expected}"
        
        print(f"✓ Daily weights sum to 100: {total_weight}")
    
    def test_wp_documents_metric_structure(self, superadmin_token, teacher_id):
        """Test wp_documents metric has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Monthly wp_documents
        monthly_wp = data["activity_metrics"]["breakdown"]["wp_documents"]
        assert "score" in monthly_wp, "Monthly wp_documents missing 'score'"
        assert "weight" in monthly_wp, "Monthly wp_documents missing 'weight'"
        assert "count_30d" in monthly_wp, "Monthly wp_documents missing 'count_30d'"
        assert "total" in monthly_wp, "Monthly wp_documents missing 'total'"
        assert monthly_wp["weight"] == 15, f"Monthly wp_documents weight is {monthly_wp['weight']}, expected 15"
        
        # Daily wp_documents
        daily_wp = data["daily_metrics"]["breakdown"]["wp_documents"]
        assert "score" in daily_wp, "Daily wp_documents missing 'score'"
        assert "weight" in daily_wp, "Daily wp_documents missing 'weight'"
        assert "count_today" in daily_wp, "Daily wp_documents missing 'count_today'"
        assert "target" in daily_wp, "Daily wp_documents missing 'target'"
        assert daily_wp["weight"] == 20, f"Daily wp_documents weight is {daily_wp['weight']}, expected 20"
        assert daily_wp["target"] == 2, f"Daily wp_documents target is {daily_wp['target']}, expected 2"
        
        print(f"✓ wp_documents structure correct - Monthly: {monthly_wp}, Daily: {daily_wp}")
    
    def test_wp_actions_metric_structure(self, superadmin_token, teacher_id):
        """Test wp_actions metric has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/teacher-full-review/{teacher_id}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Monthly wp_actions
        monthly_wp = data["activity_metrics"]["breakdown"]["wp_actions"]
        assert "score" in monthly_wp, "Monthly wp_actions missing 'score'"
        assert "weight" in monthly_wp, "Monthly wp_actions missing 'weight'"
        assert "count_30d" in monthly_wp, "Monthly wp_actions missing 'count_30d'"
        assert "total" in monthly_wp, "Monthly wp_actions missing 'total'"
        assert monthly_wp["weight"] == 10, f"Monthly wp_actions weight is {monthly_wp['weight']}, expected 10"
        
        # Daily wp_actions
        daily_wp = data["daily_metrics"]["breakdown"]["wp_actions"]
        assert "score" in daily_wp, "Daily wp_actions missing 'score'"
        assert "weight" in daily_wp, "Daily wp_actions missing 'weight'"
        assert "count_today" in daily_wp, "Daily wp_actions missing 'count_today'"
        assert "target" in daily_wp, "Daily wp_actions missing 'target'"
        assert daily_wp["weight"] == 15, f"Daily wp_actions weight is {daily_wp['weight']}, expected 15"
        assert daily_wp["target"] == 5, f"Daily wp_actions target is {daily_wp['target']}, expected 5"
        
        print(f"✓ wp_actions structure correct - Monthly: {monthly_wp}, Daily: {daily_wp}")
    
    def test_my_review_has_wp_metrics(self, teacher_token):
        """Test that my-review endpoint also returns WP metrics"""
        response = requests.get(
            f"{BASE_URL}/api/monitoring/my-review",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check monthly metrics
        assert "activity_metrics" in data, "activity_metrics missing"
        monthly_breakdown = data["activity_metrics"]["breakdown"]
        assert "wp_documents" in monthly_breakdown, "wp_documents missing from monthly"
        assert "wp_actions" in monthly_breakdown, "wp_actions missing from monthly"
        
        # Check daily metrics
        assert "daily_metrics" in data, "daily_metrics missing"
        daily_breakdown = data["daily_metrics"]["breakdown"]
        assert "wp_documents" in daily_breakdown, "wp_documents missing from daily"
        assert "wp_actions" in daily_breakdown, "wp_actions missing from daily"
        
        # Verify weights
        monthly_total = sum(m.get("weight", 0) for m in monthly_breakdown.values())
        daily_total = sum(m.get("weight", 0) for m in daily_breakdown.values())
        
        assert monthly_total == 100, f"my-review monthly weights sum to {monthly_total}"
        assert daily_total == 100, f"my-review daily weights sum to {daily_total}"
        
        print(f"✓ my-review has WP metrics - Monthly: {len(monthly_breakdown)} metrics, Daily: {len(daily_breakdown)} metrics")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
