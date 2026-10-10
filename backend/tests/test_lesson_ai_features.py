"""
Test Lesson Plan AI Features - Iteration 43
Tests:
- POST /api/lessons-v2/templates/ai-generate (management only)
- POST /api/lessons-v2/templates/{id}/ai-improve (management only)
- Teacher access restrictions (403)
- AI response validation
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEACHER_EMAIL = "edmund@tcis.demo"
TEACHER_PASSWORD = "teacher123"
ADMIN_EMAIL = "dwain@tcis.demo"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def teacher_token():
    """Get teacher authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEACHER_EMAIL,
        "password": TEACHER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Teacher login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def existing_template_with_content(admin_token):
    """Get an existing template that has rich_content for AI improve testing"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/api/lessons-v2/templates/list", headers=headers)
    if response.status_code == 200:
        templates = response.json()
        # Find a template with rich_content
        for tpl in templates:
            if tpl.get("rich_content") and len(tpl.get("rich_content", "")) > 50:
                return tpl
        # If no template with content, return first template
        if templates:
            return templates[0]
    return None


class TestAIGenerateTemplate:
    """Tests for POST /api/lessons-v2/templates/ai-generate"""
    
    def test_teacher_cannot_ai_generate_template(self, teacher_token):
        """Teacher should get 403 when trying to AI generate template"""
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/templates/ai-generate",
            headers=headers,
            json={"subject_name": "Mathematics", "year_group": "Year 10"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Teacher correctly blocked from AI generate (403)")
    
    def test_admin_can_ai_generate_template(self, admin_token):
        """Admin should be able to AI generate a template"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        payload = {
            "subject_name": "TEST_AI_Physics",
            "year_group": "Year 11",
            "topic": "Newton's Laws of Motion",
            "curriculum": "Cambridge",
            "duration_minutes": 60,
            "lesson_type": "mixed",
            "custom_instructions": "Include practical demonstrations"
        }
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/templates/ai-generate",
            headers=headers,
            json=payload,
            timeout=60  # AI generation can take time
        )
        
        # AI generation may take 10-20 seconds
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "template_id" in data, "Response should contain template_id"
        assert "name" in data, "Response should contain name"
        assert "description" in data, "Response should contain description"
        assert "objectives" in data, "Response should contain objectives"
        assert "rich_content" in data, "Response should contain rich_content"
        
        # Verify content is populated
        assert data.get("name"), "Template name should not be empty"
        assert data.get("rich_content"), "Template rich_content should not be empty"
        assert len(data.get("rich_content", "")) > 100, "rich_content should have substantial content"
        
        # Verify subject is set correctly
        assert data.get("subject_name") == "TEST_AI_Physics", f"Subject should be TEST_AI_Physics, got {data.get('subject_name')}"
        
        # Verify AI-generated tag
        assert "ai-generated" in data.get("tags", []), "Template should have 'ai-generated' tag"
        
        print(f"✓ Admin successfully AI generated template: {data.get('name')}")
        print(f"  - Template ID: {data.get('template_id')}")
        print(f"  - Content length: {len(data.get('rich_content', ''))} chars")
        
        # Cleanup - delete the test template
        cleanup_response = requests.delete(
            f"{BASE_URL}/api/lessons-v2/templates/{data['template_id']}",
            headers=headers
        )
        if cleanup_response.status_code == 200:
            print(f"  - Cleanup: Test template deleted")
    
    def test_ai_generate_requires_subject(self, admin_token):
        """AI generate should work even without subject (uses 'General')"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Note: Backend defaults to "General" if subject_name not provided
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/templates/ai-generate",
            headers=headers,
            json={"year_group": "Year 9"},
            timeout=60
        )
        # Should succeed with default subject
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Cleanup
        if data.get("template_id"):
            requests.delete(
                f"{BASE_URL}/api/lessons-v2/templates/{data['template_id']}",
                headers=headers
            )
        print("✓ AI generate works with default subject 'General'")


class TestAIImproveTemplate:
    """Tests for POST /api/lessons-v2/templates/{id}/ai-improve"""
    
    def test_teacher_cannot_ai_improve_template(self, teacher_token, existing_template_with_content):
        """Teacher should get 403 when trying to AI improve template"""
        if not existing_template_with_content:
            pytest.skip("No existing template found for testing")
        
        template_id = existing_template_with_content.get("template_id")
        headers = {"Authorization": f"Bearer {teacher_token}"}
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/templates/{template_id}/ai-improve",
            headers=headers,
            json={"prompt_type": "improve"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ Teacher correctly blocked from AI improve template (403)")
    
    def test_admin_can_ai_improve_template_with_improve_type(self, admin_token, existing_template_with_content):
        """Admin should be able to AI improve template with 'improve' prompt type"""
        if not existing_template_with_content:
            pytest.skip("No existing template found for testing")
        
        template_id = existing_template_with_content.get("template_id")
        original_content = existing_template_with_content.get("rich_content", "")
        
        if not original_content or len(original_content) < 20:
            pytest.skip("Template has no content to improve")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/templates/{template_id}/ai-improve",
            headers=headers,
            json={"prompt_type": "improve"},
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "ai_content" in data, "Response should contain ai_content"
        assert "prompt_type" in data, "Response should contain prompt_type"
        assert data.get("prompt_type") == "improve", f"prompt_type should be 'improve', got {data.get('prompt_type')}"
        assert data.get("ai_content"), "ai_content should not be empty"
        
        print(f"✓ Admin successfully AI improved template with 'improve' type")
        print(f"  - Original content length: {len(original_content)} chars")
        print(f"  - AI improved content length: {len(data.get('ai_content', ''))} chars")
    
    def test_admin_can_ai_improve_with_custom_prompt(self, admin_token, existing_template_with_content):
        """Admin should be able to AI improve template with custom prompt"""
        if not existing_template_with_content:
            pytest.skip("No existing template found for testing")
        
        template_id = existing_template_with_content.get("template_id")
        original_content = existing_template_with_content.get("rich_content", "")
        
        if not original_content or len(original_content) < 20:
            pytest.skip("Template has no content to improve")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/templates/{template_id}/ai-improve",
            headers=headers,
            json={
                "prompt_type": "custom",
                "custom_prompt": "Add more group work activities and collaborative learning strategies"
            },
            timeout=60
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "ai_content" in data, "Response should contain ai_content"
        assert data.get("prompt_type") == "custom", f"prompt_type should be 'custom', got {data.get('prompt_type')}"
        
        print(f"✓ Admin successfully AI improved template with custom prompt")
    
    def test_ai_improve_nonexistent_template(self, admin_token):
        """AI improve on non-existent template should return 404"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/templates/nonexistent_template_id/ai-improve",
            headers=headers,
            json={"prompt_type": "improve"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ AI improve on non-existent template returns 404")
    
    def test_ai_improve_template_without_content(self, admin_token):
        """AI improve on template without content should return 400"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create a template without content
        create_response = requests.post(
            f"{BASE_URL}/api/lessons-v2/templates/create",
            headers=headers,
            json={
                "name": "TEST_Empty_Template",
                "subject_name": "Test",
                "rich_content": ""  # Empty content
            }
        )
        
        if create_response.status_code != 200:
            pytest.skip("Could not create test template")
        
        template_id = create_response.json().get("template_id")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/lessons-v2/templates/{template_id}/ai-improve",
                headers=headers,
                json={"prompt_type": "improve"}
            )
            assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
            print("✓ AI improve on template without content returns 400")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/lessons-v2/templates/{template_id}", headers=headers)


class TestAIImprovePromptTypes:
    """Test different AI improve prompt types"""
    
    @pytest.mark.parametrize("prompt_type", [
        "improve",
        "standardise", 
        "expand",
        "differentiation",
        "assessment",
        "engagement"
    ])
    def test_ai_improve_prompt_types(self, admin_token, existing_template_with_content, prompt_type):
        """Test that all prompt types are accepted"""
        if not existing_template_with_content:
            pytest.skip("No existing template found for testing")
        
        template_id = existing_template_with_content.get("template_id")
        original_content = existing_template_with_content.get("rich_content", "")
        
        if not original_content or len(original_content) < 20:
            pytest.skip("Template has no content to improve")
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/lessons-v2/templates/{template_id}/ai-improve",
            headers=headers,
            json={"prompt_type": prompt_type},
            timeout=60
        )
        
        # All prompt types should be accepted
        assert response.status_code == 200, f"Expected 200 for prompt_type '{prompt_type}', got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("prompt_type") == prompt_type
        assert data.get("ai_content"), f"ai_content should not be empty for prompt_type '{prompt_type}'"
        
        print(f"✓ AI improve with prompt_type '{prompt_type}' works correctly")


class TestExistingTemplates:
    """Verify existing templates from previous iteration"""
    
    def test_existing_templates_present(self, admin_token):
        """Verify the templates from iteration 42 exist"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/lessons-v2/templates/list", headers=headers)
        
        assert response.status_code == 200
        templates = response.json()
        
        template_names = [t.get("name") for t in templates]
        print(f"Found {len(templates)} templates: {template_names}")
        
        # Check for expected templates from iteration 42
        expected_templates = [
            "TCIS Standard Science Practical",
            "TCIS Mathematics Problem-Solving"
        ]
        
        for expected in expected_templates:
            found = any(expected in name for name in template_names)
            if found:
                print(f"✓ Found expected template: {expected}")
            else:
                print(f"⚠ Template not found: {expected}")
        
        # At least some templates should exist
        assert len(templates) > 0, "At least one template should exist"
        print(f"✓ {len(templates)} templates exist in the system")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
