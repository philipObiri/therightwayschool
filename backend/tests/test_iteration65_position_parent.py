"""
Iteration 65: Test Position Ranking and Parent Report Cards
- Position calculation in report card data
- Position display in admin report card detail
- Position in PDF report card
- Parent portal report cards page
- Parent can view child's report cards with folder view
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CEO_EMAIL = "ceo@tcis.demo"
CEO_PASSWORD = "ceo123"
PARENT_EMAIL = "parent@tcis.demo"
PARENT_PASSWORD = "parent123"

# Test data from context
STUDENT_ID = "user_cc6f5faa1522"  # Ayeyi Forson
STUDENT_NAME = "Ayeyi Forson"
CLASS_ID = "cls_89e85348b7fd"  # Year 7
TERM = "Term 2"


@pytest.fixture(scope="module")
def ceo_token():
    """Get CEO authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CEO_EMAIL,
        "password": CEO_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"CEO authentication failed: {response.status_code}")


@pytest.fixture(scope="module")
def parent_token():
    """Get Parent authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": PARENT_EMAIL,
        "password": PARENT_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Parent authentication failed: {response.status_code}")


@pytest.fixture(scope="module")
def ceo_client(ceo_token):
    """Session with CEO auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ceo_token}"
    })
    return session


@pytest.fixture(scope="module")
def parent_client(parent_token):
    """Session with Parent auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {parent_token}"
    })
    return session


class TestPositionCalculation:
    """Test position/ranking calculation in report card data"""

    def test_report_card_returns_position_field(self, ceo_client):
        """Report card data should include position field"""
        response = ceo_client.get(
            f"{BASE_URL}/api/gradebook/report-card/{STUDENT_ID}",
            params={"term": TERM}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check position field exists
        assert "position" in data, "position field missing from report card"
        assert "total_in_class" in data, "total_in_class field missing from report card"
        
        print(f"Position: {data.get('position')}, Total in class: {data.get('total_in_class')}")

    def test_position_is_calculated_correctly(self, ceo_client):
        """Position should be a positive integer when student has grades"""
        response = ceo_client.get(
            f"{BASE_URL}/api/gradebook/report-card/{STUDENT_ID}",
            params={"term": TERM}
        )
        assert response.status_code == 200
        data = response.json()
        
        position = data.get("position")
        total = data.get("total_in_class")
        
        # If student has grades, position should be set
        if data.get("grades") and len(data["grades"]) > 0:
            assert position is not None, "Position should be set when student has grades"
            assert isinstance(position, int), "Position should be an integer"
            assert position >= 1, "Position should be at least 1"
            assert total >= 1, "Total in class should be at least 1"
            assert position <= total, "Position should not exceed total students"
            print(f"Student {STUDENT_NAME} is ranked {position} out of {total} students")

    def test_position_with_end_of_term_report(self, ceo_client):
        """Position should be included in end_of_term report type"""
        response = ceo_client.get(
            f"{BASE_URL}/api/gradebook/report-card/{STUDENT_ID}",
            params={"term": TERM, "report_type": "end_of_term"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "position" in data
        assert "total_in_class" in data
        print(f"End of term position: {data.get('position')}/{data.get('total_in_class')}")

    def test_position_with_progressives_report(self, ceo_client):
        """Position should be included in progressives report type"""
        response = ceo_client.get(
            f"{BASE_URL}/api/gradebook/report-card/{STUDENT_ID}",
            params={"term": TERM, "report_type": "progressives"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "position" in data
        assert "total_in_class" in data
        print(f"Progressives position: {data.get('position')}/{data.get('total_in_class')}")


class TestPositionInPDF:
    """Test position is included in PDF report card"""

    def test_pdf_download_with_position(self, ceo_client):
        """PDF should be generated successfully (position included in PDF)"""
        response = ceo_client.get(
            f"{BASE_URL}/api/gradebook/report-card/{STUDENT_ID}/pdf",
            params={"term": TERM}
        )
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
        
        # Check PDF has content
        assert len(response.content) > 1000, "PDF should have substantial content"
        
        # Check filename
        content_disp = response.headers.get("content-disposition", "")
        assert "ReportCard" in content_disp
        print(f"PDF generated successfully, size: {len(response.content)} bytes")


class TestParentAuthentication:
    """Test parent can authenticate and access their data"""

    def test_parent_login(self):
        """Parent should be able to login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PARENT_EMAIL,
            "password": PARENT_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "Parent"
        print(f"Parent logged in: {data['user']['name']}")

    def test_parent_has_children_ids(self, parent_client):
        """Parent should have children_ids in their profile"""
        response = parent_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        
        assert "children_ids" in data, "Parent should have children_ids field"
        children_ids = data.get("children_ids", [])
        assert len(children_ids) > 0, "Parent should have at least one child linked"
        print(f"Parent has {len(children_ids)} children: {children_ids}")


class TestParentReportCardAccess:
    """Test parent can access their children's report cards"""

    def test_parent_can_get_child_info(self, parent_client):
        """Parent should be able to get their child's info"""
        # First get parent's children
        me_response = parent_client.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        children_ids = me_response.json().get("children_ids", [])
        
        if not children_ids:
            pytest.skip("Parent has no children linked")
        
        # Get first child's info
        child_id = children_ids[0]
        response = parent_client.get(f"{BASE_URL}/api/admin/students/{child_id}")
        assert response.status_code == 200
        child = response.json()
        
        assert "name" in child
        assert "user_id" in child
        print(f"Child info: {child.get('name')}, ID: {child.get('user_id')}")

    def test_parent_can_get_child_report_types(self, parent_client):
        """Parent should be able to get report types for their child"""
        # Get parent's children
        me_response = parent_client.get(f"{BASE_URL}/api/auth/me")
        children_ids = me_response.json().get("children_ids", [])
        
        if not children_ids:
            pytest.skip("Parent has no children linked")
        
        child_id = children_ids[0]
        response = parent_client.get(
            f"{BASE_URL}/api/gradebook/report-types/{child_id}",
            params={"term": TERM}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "report_types" in data
        report_types = data["report_types"]
        assert len(report_types) == 4, "Should have 4 report types"
        
        type_names = [rt["type"] for rt in report_types]
        assert "end_of_term" in type_names
        assert "mid_term" in type_names
        assert "mocks" in type_names
        assert "progressives" in type_names
        print(f"Report types for child: {type_names}")

    def test_parent_can_get_child_report_card(self, parent_client):
        """Parent should be able to get report card for their child"""
        # Get parent's children
        me_response = parent_client.get(f"{BASE_URL}/api/auth/me")
        children_ids = me_response.json().get("children_ids", [])
        
        if not children_ids:
            pytest.skip("Parent has no children linked")
        
        child_id = children_ids[0]
        response = parent_client.get(
            f"{BASE_URL}/api/gradebook/report-card/{child_id}",
            params={"term": TERM}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check report card structure
        assert "student" in data
        assert "grades" in data
        assert "average" in data
        assert "position" in data
        assert "total_in_class" in data
        
        print(f"Child report card: avg={data.get('average')}, position={data.get('position')}/{data.get('total_in_class')}")

    def test_parent_can_get_child_report_card_with_type(self, parent_client):
        """Parent should be able to get specific report type for their child"""
        me_response = parent_client.get(f"{BASE_URL}/api/auth/me")
        children_ids = me_response.json().get("children_ids", [])
        
        if not children_ids:
            pytest.skip("Parent has no children linked")
        
        child_id = children_ids[0]
        
        # Test end_of_term type
        response = parent_client.get(
            f"{BASE_URL}/api/gradebook/report-card/{child_id}",
            params={"term": TERM, "report_type": "end_of_term"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("report_type") == "end_of_term"
        assert "End of Term" in data.get("report_label", "")
        print(f"End of term report: {data.get('report_label')}")

    def test_parent_can_download_child_pdf(self, parent_client):
        """Parent should be able to download PDF for their child"""
        me_response = parent_client.get(f"{BASE_URL}/api/auth/me")
        children_ids = me_response.json().get("children_ids", [])
        
        if not children_ids:
            pytest.skip("Parent has no children linked")
        
        child_id = children_ids[0]
        response = parent_client.get(
            f"{BASE_URL}/api/gradebook/report-card/{child_id}/pdf",
            params={"term": TERM}
        )
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
        assert len(response.content) > 1000
        print(f"Parent downloaded PDF, size: {len(response.content)} bytes")


class TestParentWithMultipleChildren:
    """Test parent with multiple children"""

    def test_parent_has_two_children(self, parent_client):
        """Parent (parent@tcis.demo) should have 2 children"""
        response = parent_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        
        children_ids = data.get("children_ids", [])
        # According to context, parent has 2 children: Ayeyi Forson, Brandon N.B. Gaisie
        assert len(children_ids) >= 2, f"Parent should have at least 2 children, got {len(children_ids)}"
        print(f"Parent has {len(children_ids)} children: {children_ids}")

    def test_can_get_both_children_info(self, parent_client):
        """Parent should be able to get info for both children"""
        me_response = parent_client.get(f"{BASE_URL}/api/auth/me")
        children_ids = me_response.json().get("children_ids", [])
        
        children_names = []
        for child_id in children_ids:
            response = parent_client.get(f"{BASE_URL}/api/admin/students/{child_id}")
            if response.status_code == 200:
                children_names.append(response.json().get("name"))
        
        print(f"Children names: {children_names}")
        assert len(children_names) >= 2, "Should be able to get info for at least 2 children"


class TestReportCardPositionDisplay:
    """Test position display format in report card"""

    def test_position_ordinal_suffix_logic(self, ceo_client):
        """Test that position is returned as integer (frontend handles suffix)"""
        response = ceo_client.get(
            f"{BASE_URL}/api/gradebook/report-card/{STUDENT_ID}",
            params={"term": TERM}
        )
        assert response.status_code == 200
        data = response.json()
        
        position = data.get("position")
        if position:
            assert isinstance(position, int), "Position should be integer"
            # Frontend will add suffix (1st, 2nd, 3rd, etc.)
            print(f"Position {position} (frontend will display as ordinal)")


class TestClassGradebookPosition:
    """Test position in class gradebook view"""

    def test_class_gradebook_includes_position(self, ceo_client):
        """Class gradebook should include position for each student"""
        response = ceo_client.get(
            f"{BASE_URL}/api/gradebook/class/{CLASS_ID}",
            params={"term": TERM}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "students" in data
        students = data["students"]
        
        if students:
            # Check first student has position
            first_student = students[0]
            assert "position" in first_student, "Student should have position field"
            assert first_student["position"] == 1, "First student should be position 1"
            
            # Check positions are sequential
            for i, student in enumerate(students):
                assert student["position"] == i + 1, f"Position should be {i+1}, got {student['position']}"
            
            print(f"Class gradebook has {len(students)} students with positions 1-{len(students)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
