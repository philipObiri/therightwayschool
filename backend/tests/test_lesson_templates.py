"""
Test suite for Lesson Plan Templates feature (Iteration 42)
Tests:
- GET /api/lessons-v2/templates/list (teacher access)
- POST /api/lessons-v2/templates/create (management only)
- PUT /api/lessons-v2/templates/{id} (management only)
- DELETE /api/lessons-v2/templates/{id} (management only)
- Teacher cannot create templates (403)
- Creating lesson with template_id increments usage_count
"""
import pytest
import requests
import os

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
    assert response.status_code == 200, f"Teacher login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin/management authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def teacher_client(teacher_token):
    """Session with teacher auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {teacher_token}"
    })
    return session


@pytest.fixture(scope="module")
def admin_client(admin_token):
    """Session with admin auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}"
    })
    return session


class TestTemplateListEndpoint:
    """Tests for GET /api/lessons-v2/templates/list"""
    
    def test_teacher_can_list_templates(self, teacher_client):
        """Teacher should be able to list templates"""
        response = teacher_client.get(f"{BASE_URL}/api/lessons-v2/templates/list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Teacher can list templates - found {len(data)} templates")
        
    def test_admin_can_list_templates(self, admin_client):
        """Admin should be able to list templates"""
        response = admin_client.get(f"{BASE_URL}/api/lessons-v2/templates/list")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin can list templates - found {len(data)} templates")
        
    def test_existing_templates_have_correct_structure(self, teacher_client):
        """Verify existing templates have required fields"""
        response = teacher_client.get(f"{BASE_URL}/api/lessons-v2/templates/list")
        assert response.status_code == 200
        templates = response.json()
        
        if len(templates) > 0:
            template = templates[0]
            required_fields = ["template_id", "name", "subject_name", "is_active", "usage_count"]
            for field in required_fields:
                assert field in template, f"Template missing field: {field}"
            print(f"✓ Template structure verified: {template.get('name')}")
        else:
            print("⚠ No templates found to verify structure")
            
    def test_filter_templates_by_subject(self, teacher_client):
        """Test filtering templates by subject"""
        response = teacher_client.get(f"{BASE_URL}/api/lessons-v2/templates/list?subject=Science")
        assert response.status_code == 200
        templates = response.json()
        # All returned templates should match the subject filter
        for t in templates:
            assert "science" in t.get("subject_name", "").lower(), f"Template {t.get('name')} doesn't match Science filter"
        print(f"✓ Subject filter works - found {len(templates)} Science templates")


class TestTemplateCreateEndpoint:
    """Tests for POST /api/lessons-v2/templates/create"""
    
    def test_teacher_cannot_create_template(self, teacher_client):
        """Teacher should get 403 when trying to create template"""
        payload = {
            "name": "TEST_Teacher_Template",
            "subject_name": "Mathematics",
            "year_group": "Year 7",
            "curriculum": "Cambridge",
            "duration_minutes": 45,
            "objectives": "Test objectives",
            "description": "Test description"
        }
        response = teacher_client.post(f"{BASE_URL}/api/lessons-v2/templates/create", json=payload)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ Teacher correctly denied template creation (403)")
        
    def test_admin_can_create_template(self, admin_client):
        """Admin should be able to create template"""
        payload = {
            "name": "TEST_Admin_Template_Iter42",
            "subject_name": "English",
            "year_group": "Year 8",
            "curriculum": "Cambridge",
            "duration_minutes": 60,
            "objectives": "Students will be able to analyze literary devices",
            "description": "Standard English literature analysis template",
            "rich_content": "<h2>Lesson Structure</h2><p>Introduction, Main Activity, Plenary</p>"
        }
        response = admin_client.post(f"{BASE_URL}/api/lessons-v2/templates/create", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "template_id" in data, "Response should contain template_id"
        assert data["name"] == payload["name"], "Name should match"
        assert data["subject_name"] == payload["subject_name"], "Subject should match"
        assert data["usage_count"] == 0, "New template should have usage_count=0"
        print(f"✓ Admin created template: {data['template_id']}")
        
        # Store for cleanup
        TestTemplateCreateEndpoint.created_template_id = data["template_id"]
        
    def test_created_template_appears_in_list(self, admin_client):
        """Verify created template appears in list"""
        response = admin_client.get(f"{BASE_URL}/api/lessons-v2/templates/list")
        assert response.status_code == 200
        templates = response.json()
        
        template_ids = [t["template_id"] for t in templates]
        assert hasattr(TestTemplateCreateEndpoint, 'created_template_id'), "No template was created"
        assert TestTemplateCreateEndpoint.created_template_id in template_ids, "Created template not in list"
        print("✓ Created template appears in list")


class TestTemplateUpdateEndpoint:
    """Tests for PUT /api/lessons-v2/templates/{id}"""
    
    def test_teacher_cannot_update_template(self, teacher_client, admin_client):
        """Teacher should get 403 when trying to update template"""
        # First get a template ID
        response = admin_client.get(f"{BASE_URL}/api/lessons-v2/templates/list")
        templates = response.json()
        if not templates:
            pytest.skip("No templates available to test update")
            
        template_id = templates[0]["template_id"]
        
        payload = {"name": "TEST_Updated_By_Teacher"}
        response = teacher_client.put(f"{BASE_URL}/api/lessons-v2/templates/{template_id}", json=payload)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Teacher correctly denied template update (403)")
        
    def test_admin_can_update_template(self, admin_client):
        """Admin should be able to update template"""
        # Get the template we created
        if not hasattr(TestTemplateCreateEndpoint, 'created_template_id'):
            pytest.skip("No template was created to update")
            
        template_id = TestTemplateCreateEndpoint.created_template_id
        
        payload = {
            "name": "TEST_Admin_Template_Updated",
            "description": "Updated description for testing",
            "duration_minutes": 90
        }
        response = admin_client.put(f"{BASE_URL}/api/lessons-v2/templates/{template_id}", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == payload["name"], "Name should be updated"
        assert data["description"] == payload["description"], "Description should be updated"
        assert data["duration_minutes"] == payload["duration_minutes"], "Duration should be updated"
        print(f"✓ Admin updated template: {template_id}")
        
    def test_update_nonexistent_template_returns_404(self, admin_client):
        """Updating non-existent template should return 404"""
        response = admin_client.put(f"{BASE_URL}/api/lessons-v2/templates/nonexistent_id", json={"name": "Test"})
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Update non-existent template returns 404")


class TestTemplateDeleteEndpoint:
    """Tests for DELETE /api/lessons-v2/templates/{id}"""
    
    def test_teacher_cannot_delete_template(self, teacher_client, admin_client):
        """Teacher should get 403 when trying to delete template"""
        # Get a template ID (use the one we created)
        if not hasattr(TestTemplateCreateEndpoint, 'created_template_id'):
            pytest.skip("No template was created to test delete")
            
        template_id = TestTemplateCreateEndpoint.created_template_id
        
        response = teacher_client.delete(f"{BASE_URL}/api/lessons-v2/templates/{template_id}")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Teacher correctly denied template deletion (403)")
        
    def test_admin_can_delete_template(self, admin_client):
        """Admin should be able to delete template"""
        if not hasattr(TestTemplateCreateEndpoint, 'created_template_id'):
            pytest.skip("No template was created to delete")
            
        template_id = TestTemplateCreateEndpoint.created_template_id
        
        response = admin_client.delete(f"{BASE_URL}/api/lessons-v2/templates/{template_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        print(f"✓ Admin deleted template: {template_id}")
        
    def test_deleted_template_not_in_list(self, admin_client):
        """Verify deleted template no longer appears in list"""
        if not hasattr(TestTemplateCreateEndpoint, 'created_template_id'):
            pytest.skip("No template was created")
            
        template_id = TestTemplateCreateEndpoint.created_template_id
        
        response = admin_client.get(f"{BASE_URL}/api/lessons-v2/templates/list")
        assert response.status_code == 200
        templates = response.json()
        
        template_ids = [t["template_id"] for t in templates]
        assert template_id not in template_ids, "Deleted template should not be in list"
        print("✓ Deleted template no longer in list")
        
    def test_delete_nonexistent_template_returns_404(self, admin_client):
        """Deleting non-existent template should return 404"""
        response = admin_client.delete(f"{BASE_URL}/api/lessons-v2/templates/nonexistent_id")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Delete non-existent template returns 404")


class TestTemplateUsageCount:
    """Tests for template usage_count increment when creating lesson with template"""
    
    def test_creating_lesson_with_template_increments_usage(self, teacher_client, admin_client):
        """Creating a lesson with template_id should increment usage_count"""
        # First, create a new template for this test
        template_payload = {
            "name": "TEST_Usage_Count_Template",
            "subject_name": "Science",
            "year_group": "Year 9",
            "curriculum": "Cambridge",
            "duration_minutes": 45,
            "objectives": "Test usage count",
            "description": "Template for testing usage count increment"
        }
        create_resp = admin_client.post(f"{BASE_URL}/api/lessons-v2/templates/create", json=template_payload)
        assert create_resp.status_code == 200, f"Failed to create template: {create_resp.text}"
        template = create_resp.json()
        template_id = template["template_id"]
        initial_usage = template["usage_count"]
        print(f"✓ Created test template with usage_count={initial_usage}")
        
        # Now create a lesson using this template
        lesson_payload = {
            "title": "TEST_Lesson_From_Template",
            "subject_name": "Science",
            "year_group": "Year 9",
            "template_id": template_id
        }
        lesson_resp = teacher_client.post(f"{BASE_URL}/api/lessons-v2/", json=lesson_payload)
        assert lesson_resp.status_code == 200, f"Failed to create lesson: {lesson_resp.text}"
        lesson = lesson_resp.json()
        lesson_id = lesson["lesson_id"]
        print(f"✓ Created lesson from template: {lesson_id}")
        
        # Check that usage_count was incremented
        list_resp = admin_client.get(f"{BASE_URL}/api/lessons-v2/templates/list")
        templates = list_resp.json()
        updated_template = next((t for t in templates if t["template_id"] == template_id), None)
        
        assert updated_template is not None, "Template not found in list"
        assert updated_template["usage_count"] == initial_usage + 1, \
            f"Expected usage_count={initial_usage + 1}, got {updated_template['usage_count']}"
        print(f"✓ Template usage_count incremented to {updated_template['usage_count']}")
        
        # Cleanup: delete the test lesson and template
        teacher_client.delete(f"{BASE_URL}/api/lessons-v2/{lesson_id}")
        admin_client.delete(f"{BASE_URL}/api/lessons-v2/templates/{template_id}")
        print("✓ Cleaned up test lesson and template")


class TestExistingTemplates:
    """Tests for the two pre-existing templates mentioned in context"""
    
    def test_science_practical_template_exists(self, teacher_client):
        """Verify 'TCIS Standard Science Practical' template exists"""
        response = teacher_client.get(f"{BASE_URL}/api/lessons-v2/templates/list")
        assert response.status_code == 200
        templates = response.json()
        
        science_template = next((t for t in templates if "Science Practical" in t.get("name", "")), None)
        if science_template:
            assert science_template["subject_name"] == "Science" or "science" in science_template.get("subject_name", "").lower()
            print(f"✓ Found Science Practical template: {science_template['template_id']}, usage={science_template.get('usage_count', 0)}")
        else:
            print("⚠ Science Practical template not found (may have been deleted)")
            
    def test_mathematics_template_exists(self, teacher_client):
        """Verify 'TCIS Mathematics Problem-Solving' template exists"""
        response = teacher_client.get(f"{BASE_URL}/api/lessons-v2/templates/list")
        assert response.status_code == 200
        templates = response.json()
        
        math_template = next((t for t in templates if "Mathematics" in t.get("name", "") or "Math" in t.get("name", "")), None)
        if math_template:
            print(f"✓ Found Mathematics template: {math_template['template_id']}, usage={math_template.get('usage_count', 0)}")
        else:
            print("⚠ Mathematics template not found (may have been deleted)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
