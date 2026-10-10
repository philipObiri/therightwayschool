"""
Test Hierarchical Approval Chain for Lessons and Schemes of Work
Chain: HeadOfAcademics (Step 1) -> Principal (Step 2) -> CEO (Step 3) -> Founder (Step 4)

CRITICAL BUG FIXED: CEO holds HeadOfAcademics role but must wait for Step 3 (their highest step)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/')

# Test credentials from test_credentials.md
CREDENTIALS = {
    "teacher": {"email": "edmund@tcis.demo", "password": "teacher123"},
    "headteacher": {"email": "headteacher@tcis.demo", "password": "headteacher123"},  # Step 1
    "principal": {"email": "principal@tcis.demo", "password": "principal123"},  # Step 2
    "ceo": {"email": "ceo@tcis.demo", "password": "ceo123"},  # Step 3
    "founder": {"email": "founder@tcis.demo", "password": "founder123"},  # Step 4
    "admin": {"email": "dwain@tcis.demo", "password": "admin123"},
}


def get_token(role: str) -> str:
    """Get auth token for a specific role"""
    creds = CREDENTIALS[role]
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
    assert resp.status_code == 200, f"Login failed for {role}: {resp.text}"
    return resp.json()["token"]


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestLessonApprovalChain:
    """Test hierarchical approval chain for Lessons V2"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get tokens for all roles"""
        self.teacher_token = get_token("teacher")
        self.headteacher_token = get_token("headteacher")
        self.principal_token = get_token("principal")
        self.ceo_token = get_token("ceo")
        self.founder_token = get_token("founder")
        self.lesson_id = None
        yield
        # Cleanup: delete test lesson if created
        if self.lesson_id:
            try:
                requests.delete(f"{BASE_URL}/api/lessons-v2/{self.lesson_id}", 
                               headers=auth_header(self.teacher_token))
            except:
                pass
    
    def test_01_teacher_creates_lesson(self):
        """Teacher creates a lesson"""
        resp = requests.post(f"{BASE_URL}/api/lessons-v2/", 
                            json={
                                "title": "TEST_ApprovalChain_Lesson",
                                "subject_name": "Mathematics",
                                "year_group": "Year 10",
                                "objectives": "Test approval chain flow",
                                "description": "Testing hierarchical approval",
                            },
                            headers=auth_header(self.teacher_token))
        assert resp.status_code == 200, f"Create failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "draft"
        self.lesson_id = data["lesson_id"]
        print(f"âœ“ Teacher created lesson: {self.lesson_id}")
        return self.lesson_id
    
    def test_02_teacher_submits_lesson(self):
        """Teacher submits lesson - should create approval chain"""
        lesson_id = self.test_01_teacher_creates_lesson()
        
        resp = requests.post(f"{BASE_URL}/api/lessons-v2/{lesson_id}/submit",
                            headers=auth_header(self.teacher_token))
        assert resp.status_code == 200, f"Submit failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "submitted"
        assert "With Head of Academics" in data["current_approver"]
        print(f"âœ“ Lesson submitted, current approver: {data['current_approver']}")
        
        # Verify lesson has approval_chain
        lesson = requests.get(f"{BASE_URL}/api/lessons-v2/{lesson_id}",
                             headers=auth_header(self.teacher_token)).json()
        assert "approval_chain" in lesson
        assert len(lesson["approval_chain"]) == 4
        assert lesson["approval_chain"][0]["step"] == 1
        assert lesson["approval_chain"][0]["status"] == "pending"
        print(f"âœ“ Approval chain created with 4 steps")
        return lesson_id
    
    def test_03_headteacher_sees_pending_review(self):
        """HeadTeacher (Step 1) sees the lesson in my-pending-reviews"""
        lesson_id = self.test_02_teacher_submits_lesson()
        
        resp = requests.get(f"{BASE_URL}/api/lessons-v2/my-pending-reviews",
                           headers=auth_header(self.headteacher_token))
        assert resp.status_code == 200, f"Failed: {resp.text}"
        pending = resp.json()
        lesson_ids = [l["lesson_id"] for l in pending]
        assert lesson_id in lesson_ids, "HeadTeacher should see submitted lesson"
        print(f"âœ“ HeadTeacher sees lesson in pending reviews")
        return lesson_id
    
    def test_04_ceo_cannot_see_at_step1(self):
        """CEO should NOT see lesson at Step 1 (even though CEO holds HeadOfAcademics role)"""
        lesson_id = self.test_02_teacher_submits_lesson()
        
        resp = requests.get(f"{BASE_URL}/api/lessons-v2/my-pending-reviews",
                           headers=auth_header(self.ceo_token))
        assert resp.status_code == 200, f"Failed: {resp.text}"
        pending = resp.json()
        lesson_ids = [l["lesson_id"] for l in pending]
        assert lesson_id not in lesson_ids, "CEO should NOT see lesson at Step 1"
        print(f"âœ“ CEO correctly does NOT see lesson at Step 1")
        return lesson_id
    
    def test_05_ceo_cannot_approve_at_step1(self):
        """CEO cannot approve at Step 1 - should get 403"""
        lesson_id = self.test_02_teacher_submits_lesson()
        
        resp = requests.post(f"{BASE_URL}/api/lessons-v2/{lesson_id}/review",
                            json={"action": "approve", "comment": "CEO trying to approve at Step 1"},
                            headers=auth_header(self.ceo_token))
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        assert "Head of Academics" in resp.json().get("detail", "")
        print(f"âœ“ CEO correctly blocked from approving at Step 1")
        return lesson_id
    
    def test_06_headteacher_approves_step1(self):
        """HeadTeacher approves at Step 1 - moves to Principal"""
        lesson_id = self.test_02_teacher_submits_lesson()
        
        resp = requests.post(f"{BASE_URL}/api/lessons-v2/{lesson_id}/review",
                            json={"action": "approve", "comment": "Step 1 approved by HeadTeacher"},
                            headers=auth_header(self.headteacher_token))
        assert resp.status_code == 200, f"Approve failed: {resp.text}"
        
        # Verify lesson moved to Step 2
        lesson = requests.get(f"{BASE_URL}/api/lessons-v2/{lesson_id}",
                             headers=auth_header(self.teacher_token)).json()
        assert lesson["status"] == "under_review"
        assert lesson["approval_chain"][0]["status"] == "approved"
        assert lesson["approval_chain"][1]["status"] == "pending"
        assert "Principal" in lesson["current_approver_label"]
        print(f"âœ“ HeadTeacher approved Step 1, now with Principal")
        return lesson_id
    
    def test_07_ceo_still_cannot_approve_at_step2(self):
        """CEO still cannot approve at Step 2"""
        lesson_id = self.test_06_headteacher_approves_step1()
        
        resp = requests.post(f"{BASE_URL}/api/lessons-v2/{lesson_id}/review",
                            json={"action": "approve", "comment": "CEO trying at Step 2"},
                            headers=auth_header(self.ceo_token))
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print(f"âœ“ CEO correctly blocked from approving at Step 2")
        return lesson_id
    
    def test_08_principal_approves_step2(self):
        """Principal approves at Step 2 - moves to CEO"""
        lesson_id = self.test_06_headteacher_approves_step1()
        
        resp = requests.post(f"{BASE_URL}/api/lessons-v2/{lesson_id}/review",
                            json={"action": "approve", "comment": "Step 2 approved by Principal"},
                            headers=auth_header(self.principal_token))
        assert resp.status_code == 200, f"Approve failed: {resp.text}"
        
        # Verify lesson moved to Step 3
        lesson = requests.get(f"{BASE_URL}/api/lessons-v2/{lesson_id}",
                             headers=auth_header(self.teacher_token)).json()
        assert lesson["approval_chain"][1]["status"] == "approved"
        assert lesson["approval_chain"][2]["status"] == "pending"
        assert "CEO" in lesson["current_approver_label"]
        print(f"âœ“ Principal approved Step 2, now with CEO")
        return lesson_id
    
    def test_09_ceo_can_now_approve_at_step3(self):
        """CEO can now approve at Step 3"""
        lesson_id = self.test_08_principal_approves_step2()
        
        # CEO should now see it in pending reviews
        resp = requests.get(f"{BASE_URL}/api/lessons-v2/my-pending-reviews",
                           headers=auth_header(self.ceo_token))
        assert resp.status_code == 200
        pending = resp.json()
        lesson_ids = [l["lesson_id"] for l in pending]
        assert lesson_id in lesson_ids, "CEO should now see lesson at Step 3"
        print(f"âœ“ CEO now sees lesson in pending reviews at Step 3")
        
        # CEO approves
        resp = requests.post(f"{BASE_URL}/api/lessons-v2/{lesson_id}/review",
                            json={"action": "approve", "comment": "Step 3 approved by CEO"},
                            headers=auth_header(self.ceo_token))
        assert resp.status_code == 200, f"Approve failed: {resp.text}"
        
        # Verify lesson moved to Step 4
        lesson = requests.get(f"{BASE_URL}/api/lessons-v2/{lesson_id}",
                             headers=auth_header(self.teacher_token)).json()
        assert lesson["approval_chain"][2]["status"] == "approved"
        assert lesson["approval_chain"][3]["status"] == "pending"
        assert "Founder" in lesson["current_approver_label"]
        print(f"âœ“ CEO approved Step 3, now with Founder")
        return lesson_id
    
    def test_10_founder_final_approval(self):
        """Founder gives final approval at Step 4 - lesson becomes approved"""
        lesson_id = self.test_09_ceo_can_now_approve_at_step3()
        
        resp = requests.post(f"{BASE_URL}/api/lessons-v2/{lesson_id}/review",
                            json={"action": "approve", "comment": "Final approval by Founder"},
                            headers=auth_header(self.founder_token))
        assert resp.status_code == 200, f"Approve failed: {resp.text}"
        
        # Verify lesson is fully approved
        lesson = requests.get(f"{BASE_URL}/api/lessons-v2/{lesson_id}",
                             headers=auth_header(self.teacher_token)).json()
        assert lesson["status"] == "approved"
        assert all(s["status"] in ("approved", "auto_approved") for s in lesson["approval_chain"])
        assert "Fully Approved" in lesson["current_approver_label"]
        print(f"âœ“ Founder gave final approval - lesson is APPROVED")
        return lesson_id
    
    def test_11_headteacher_returns_lesson(self):
        """HeadTeacher can return a lesson at Step 1"""
        lesson_id = self.test_02_teacher_submits_lesson()
        
        resp = requests.post(f"{BASE_URL}/api/lessons-v2/{lesson_id}/review",
                            json={"action": "return", "comment": "Please revise objectives"},
                            headers=auth_header(self.headteacher_token))
        assert resp.status_code == 200, f"Return failed: {resp.text}"
        
        # Verify lesson is returned
        lesson = requests.get(f"{BASE_URL}/api/lessons-v2/{lesson_id}",
                             headers=auth_header(self.teacher_token)).json()
        assert lesson["status"] == "returned"
        assert lesson["approval_chain"][0]["status"] == "returned"
        assert "Returned by Head of Academics" in lesson["current_approver_label"]
        print(f"âœ“ HeadTeacher returned lesson - teacher sees 'returned' status")
        return lesson_id


class TestSchemeApprovalChain:
    """Test hierarchical approval chain for Schemes of Work"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get tokens for all roles"""
        self.teacher_token = get_token("teacher")
        self.headteacher_token = get_token("headteacher")
        self.principal_token = get_token("principal")
        self.ceo_token = get_token("ceo")
        self.founder_token = get_token("founder")
        self.scheme_id = None
        yield
        # Cleanup
        if self.scheme_id:
            try:
                requests.delete(f"{BASE_URL}/api/schemes/{self.scheme_id}", 
                               headers=auth_header(self.teacher_token))
            except:
                pass
    
    def test_01_scheme_create_submit_approve_flow(self):
        """Full approval chain flow for Scheme of Work"""
        # Create scheme
        resp = requests.post(f"{BASE_URL}/api/schemes/", 
                            json={
                                "title": "TEST_ApprovalChain_Scheme",
                                "subject_name": "Science",
                                "year_group": "Year 9",
                            },
                            headers=auth_header(self.teacher_token))
        assert resp.status_code == 200, f"Create failed: {resp.text}"
        self.scheme_id = resp.json()["scheme_id"]
        print(f"âœ“ Teacher created scheme: {self.scheme_id}")
        
        # Submit
        resp = requests.post(f"{BASE_URL}/api/schemes/{self.scheme_id}/submit",
                            headers=auth_header(self.teacher_token))
        assert resp.status_code == 200, f"Submit failed: {resp.text}"
        assert "With Head of Academics" in resp.json()["current_approver"]
        print(f"âœ“ Scheme submitted")
        
        # CEO cannot approve at Step 1
        resp = requests.post(f"{BASE_URL}/api/schemes/{self.scheme_id}/review",
                            json={"action": "approve", "comment": "CEO at Step 1"},
                            headers=auth_header(self.ceo_token))
        assert resp.status_code == 403, f"Expected 403: {resp.text}"
        print(f"âœ“ CEO blocked at Step 1")
        
        # HeadTeacher approves Step 1
        resp = requests.post(f"{BASE_URL}/api/schemes/{self.scheme_id}/review",
                            json={"action": "approve", "comment": "Step 1"},
                            headers=auth_header(self.headteacher_token))
        assert resp.status_code == 200
        print(f"âœ“ HeadTeacher approved Step 1")
        
        # Principal approves Step 2
        resp = requests.post(f"{BASE_URL}/api/schemes/{self.scheme_id}/review",
                            json={"action": "approve", "comment": "Step 2"},
                            headers=auth_header(self.principal_token))
        assert resp.status_code == 200
        print(f"âœ“ Principal approved Step 2")
        
        # CEO approves Step 3
        resp = requests.post(f"{BASE_URL}/api/schemes/{self.scheme_id}/review",
                            json={"action": "approve", "comment": "Step 3"},
                            headers=auth_header(self.ceo_token))
        assert resp.status_code == 200
        print(f"âœ“ CEO approved Step 3")
        
        # Founder final approval
        resp = requests.post(f"{BASE_URL}/api/schemes/{self.scheme_id}/review",
                            json={"action": "approve", "comment": "Final"},
                            headers=auth_header(self.founder_token))
        assert resp.status_code == 200
        
        # Verify fully approved
        scheme = requests.get(f"{BASE_URL}/api/schemes/{self.scheme_id}",
                             headers=auth_header(self.teacher_token)).json()
        assert scheme["status"] == "approved"
        print(f"âœ“ Scheme fully approved through 4-step chain")
    
    def test_02_scheme_my_pending_reviews(self):
        """Test my-pending-reviews endpoint for schemes"""
        # Create and submit
        resp = requests.post(f"{BASE_URL}/api/schemes/", 
                            json={"title": "TEST_PendingReview_Scheme", "subject_name": "History"},
                            headers=auth_header(self.teacher_token))
        self.scheme_id = resp.json()["scheme_id"]
        
        requests.post(f"{BASE_URL}/api/schemes/{self.scheme_id}/submit",
                     headers=auth_header(self.teacher_token))
        
        # HeadTeacher should see it
        resp = requests.get(f"{BASE_URL}/api/schemes/my-pending-reviews",
                           headers=auth_header(self.headteacher_token))
        assert resp.status_code == 200
        scheme_ids = [s["scheme_id"] for s in resp.json()]
        assert self.scheme_id in scheme_ids
        print(f"âœ“ HeadTeacher sees scheme in my-pending-reviews")
        
        # CEO should NOT see it at Step 1
        resp = requests.get(f"{BASE_URL}/api/schemes/my-pending-reviews",
                           headers=auth_header(self.ceo_token))
        assert resp.status_code == 200
        scheme_ids = [s["scheme_id"] for s in resp.json()]
        assert self.scheme_id not in scheme_ids
        print(f"âœ“ CEO does NOT see scheme at Step 1")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

