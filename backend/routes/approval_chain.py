"""
Shared hierarchical approval chain for Lessons and Schemes of Work.
Chain: HeadOfAcademics → Principal → CEO → Founder
"""
from datetime import datetime, timezone

APPROVAL_CHAIN = [
    {"step": 1, "role_key": "head_of_academics", "role_matches": ["HeadTeacher", "HeadOfAcademics"], "label": "Head of Academics"},
    {"step": 2, "role_key": "principal", "role_matches": ["Principal"], "label": "Principal"},
    {"step": 3, "role_key": "ceo", "role_matches": ["CEO"], "label": "CEO"},
    {"step": 4, "role_key": "founder", "role_matches": ["Founder"], "label": "Founder"},
]


def get_user_all_roles(user: dict) -> set:
    """Get all roles a user holds (primary + roles array)."""
    roles = set()
    if user.get("role"):
        roles.add(user["role"])
    for r in user.get("roles", []):
        roles.add(r)
    return roles


def can_user_approve_step(user: dict, step: dict, chain: list = None) -> bool:
    """Check if a user can approve a specific step in the chain.
    
    Rules:
    1. User must hold a matching role for this step.
    2. If the user ALSO matches a later pending step, they must wait (prevents CEO
       who also holds HeadOfAcademics from approving at Step 1 instead of Step 3).
    3. User must not have already approved an earlier step in this chain.
    """
    user_roles = get_user_all_roles(user)
    if not (user_roles & set(step["role_matches"])):
        return False

    if chain:
        # Find this step's position in the chain
        step_num = step.get("step", 0)
        for later in chain:
            if later["step"] > step_num and later["status"] == "pending":
                if user_roles & set(later["role_matches"]):
                    return False  # User should wait for their higher step

        # Prevent same person approving multiple steps
        user_id = user.get("user_id")
        for prev in chain:
            if prev["step"] >= step_num:
                break
            if prev.get("user_id") == user_id and prev["status"] in ("approved", "auto_approved"):
                return False

    return True


def build_approval_chain(submitter: dict) -> list:
    """Build a fresh approval chain, auto-skipping steps where the submitter holds the role."""
    now = datetime.now(timezone.utc).isoformat()
    submitter_roles = get_user_all_roles(submitter)
    chain = []
    for step_def in APPROVAL_CHAIN:
        is_self = bool(submitter_roles & set(step_def["role_matches"]))
        chain.append({
            "step": step_def["step"],
            "role_key": step_def["role_key"],
            "label": step_def["label"],
            "role_matches": step_def["role_matches"],
            "status": "auto_approved" if is_self else "pending",
            "user_id": submitter["user_id"] if is_self else None,
            "user_name": submitter.get("name", "") if is_self else None,
            "acted_at": now if is_self else None,
            "comment": "Auto-approved (submitter holds this role)" if is_self else "",
        })
    return chain


def get_current_step_index(chain: list) -> int:
    """Get the index of the first pending step. Returns -1 if all done."""
    for i, step in enumerate(chain):
        if step["status"] == "pending":
            return i
    return -1


def is_chain_complete(chain: list) -> bool:
    """Check if all steps are approved/auto_approved."""
    return all(s["status"] in ("approved", "auto_approved") for s in chain)


def get_current_step_label(chain: list) -> str:
    """Get label like 'With Principal' or 'Fully Approved'."""
    idx = get_current_step_index(chain)
    if idx == -1:
        return "Fully Approved"
    return f"With {chain[idx]['label']}"


def get_user_highest_step(user: dict) -> int:
    """Get the highest approval step this user can act at. Returns 0 if not in chain."""
    user_roles = get_user_all_roles(user)
    highest = 0
    for step_def in APPROVAL_CHAIN:
        if user_roles & set(step_def["role_matches"]):
            highest = max(highest, step_def["step"])
    return highest


def can_user_see_lesson(user: dict, chain: list) -> bool:
    """Check if a management user should see a lesson based on approval chain progress.
    A user only sees a lesson once it reaches their step (or has passed it).
    SuperAdmin/Admin without a chain step see all (oversight role)."""
    if not chain:
        return True  # Legacy lessons without chain are visible to all
    user_step = get_user_highest_step(user)
    if user_step == 0:
        # User not in chain (e.g., plain Admin) — see all for oversight
        return True
    # Find the current pending step
    current = None
    for s in chain:
        if s["status"] == "pending":
            current = s["step"]
            break
    if current is None:
        # Fully approved — visible to everyone
        return True
    # User can see if current step >= their step (it's at or past their level)
    return current >= user_step

