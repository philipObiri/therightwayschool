"""
TCIS Finance Operations — Expenses, Budgets, Procurement, Vendors, Petty Cash, Receipts, Approvals
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from database import db
from models import gen_id
from auth import get_current_user, require_roles
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/finance", tags=["finance-ops"])

FINANCE_ROLES = ("SuperAdmin", "FinanceOfficer", "CEO")
FINANCE_VIEW_ROLES = ("Admin", "SuperAdmin", "FinanceOfficer", "CEO", "HeadTeacher", "Principal")
APPROVAL_ROLES = ("SuperAdmin", "CEO", "Principal", "FinanceOfficer")
ALL_STAFF = ("SuperAdmin", "Admin", "CEO", "Principal", "HeadTeacher", "Teacher",
             "FinanceOfficer", "HRManager", "BoardingOfficer", "Librarian", "ITAdmin")


async def ops_audit(user_id, user_name, action, entity_type, entity_id, details=None):
    await db.finance_audit.insert_one({
        "audit_id": gen_id("faud_"), "user_id": user_id, "user_name": user_name,
        "action": action, "entity_type": entity_type, "entity_id": entity_id,
        "before": {}, "after": details or {}, "reason": "",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


# ═══════════════════════════════════════════
# EXPENSE CATEGORIES
# ═══════════════════════════════════════════

EXPENSE_CATEGORIES = [
    "Salaries & Wages", "Utilities", "Transport", "Teaching Materials",
    "Maintenance", "ICT & Software", "Fuel", "Events", "Repairs",
    "Marketing", "Stationery", "Catering", "Outsourced Services",
    "Insurance", "Rent", "Subscriptions", "Miscellaneous"
]

@router.get("/expense-categories")
async def get_expense_categories(user: dict = Depends(get_current_user)):
    return EXPENSE_CATEGORIES


# ═══════════════════════════════════════════
# EXPENSES
# ═══════════════════════════════════════════

@router.post("/expenses")
async def create_expense(data: dict = Body(...), user: dict = Depends(get_current_user)):
    exp = {
        "expense_id": gen_id("exp_"),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "category": data.get("category", "Miscellaneous"),
        "department": data.get("department", ""),
        "amount": round(float(data.get("amount", 0)), 2),
        "vendor_id": data.get("vendor_id", ""),
        "vendor_name": data.get("vendor_name", ""),
        "receipt_file_id": data.get("receipt_file_id", ""),
        "attachment_ids": data.get("attachment_ids", []),
        "budget_line_id": data.get("budget_line_id", ""),
        "status": "pending",
        "payment_status": "unpaid",
        "payment_method": data.get("payment_method", ""),
        "payment_reference": data.get("payment_reference", ""),
        "raised_by": user["user_id"],
        "raised_by_name": user["name"],
        "reviewed_by": None, "reviewed_at": None, "review_notes": "",
        "approved_by": None, "approved_at": None, "approval_notes": "",
        "paid_by": None, "paid_at": None,
        "rejected_by": None, "rejected_at": None, "rejection_reason": "",
        "expense_date": data.get("expense_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.expenses.insert_one(exp)
    await ops_audit(user["user_id"], user["name"], "create_expense", "expense", exp["expense_id"], {"amount": exp["amount"], "title": exp["title"]})
    return {k: v for k, v in exp.items() if k != "_id"}


@router.get("/expenses")
async def list_expenses(status: str = None, category: str = None, department: str = None, limit: int = 200, user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    if department:
        query["department"] = department
    # Non-finance staff only see their own expenses
    user_role = user.get("role", "")
    if user_role not in FINANCE_VIEW_ROLES:
        query["raised_by"] = user["user_id"]
    expenses = await db.expenses.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return expenses


@router.get("/expenses/{expense_id}")
async def get_expense(expense_id: str, user: dict = Depends(get_current_user)):
    exp = await db.expenses.find_one({"expense_id": expense_id}, {"_id": 0})
    if not exp:
        raise HTTPException(404, "Expense not found")
    return exp


@router.put("/expenses/{expense_id}")
async def update_expense(expense_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    exp = await db.expenses.find_one({"expense_id": expense_id}, {"_id": 0})
    if not exp:
        raise HTTPException(404, "Not found")
    if exp["status"] not in ("pending", "rejected") and user.get("role") not in FINANCE_ROLES:
        raise HTTPException(403, "Cannot edit approved/paid expense")
    safe = {k: v for k, v in data.items() if k in ("title", "description", "category", "department", "amount", "vendor_id", "vendor_name", "receipt_file_id", "attachment_ids", "budget_line_id", "payment_method", "expense_date")}
    if "amount" in safe:
        safe["amount"] = round(float(safe["amount"]), 2)
    safe["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.expenses.update_one({"expense_id": expense_id}, {"$set": safe})
    await ops_audit(user["user_id"], user["name"], "update_expense", "expense", expense_id, safe)
    return {"message": "Updated"}


@router.post("/expenses/{expense_id}/review")
async def review_expense(expense_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    action = data.get("action", "approve")
    now = datetime.now(timezone.utc).isoformat()
    if action == "approve":
        await db.expenses.update_one({"expense_id": expense_id}, {"$set": {
            "status": "reviewed", "reviewed_by": user["user_id"], "reviewed_at": now,
            "review_notes": data.get("notes", ""), "updated_at": now
        }})
    else:
        await db.expenses.update_one({"expense_id": expense_id}, {"$set": {
            "status": "rejected", "rejected_by": user["user_id"], "rejected_at": now,
            "rejection_reason": data.get("notes", ""), "updated_at": now
        }})
    await ops_audit(user["user_id"], user["name"], f"review_expense_{action}", "expense", expense_id)
    return {"message": f"Expense {action}d"}


@router.post("/expenses/{expense_id}/approve")
async def approve_expense(expense_id: str, data: dict = Body({}), user: dict = Depends(require_roles(*APPROVAL_ROLES))):
    now = datetime.now(timezone.utc).isoformat()
    await db.expenses.update_one({"expense_id": expense_id}, {"$set": {
        "status": "approved", "approved_by": user["user_id"], "approved_at": now,
        "approval_notes": data.get("notes", ""), "updated_at": now
    }})
    await ops_audit(user["user_id"], user["name"], "approve_expense", "expense", expense_id)
    return {"message": "Expense approved"}


@router.post("/expenses/{expense_id}/pay")
async def mark_expense_paid(expense_id: str, data: dict = Body({}), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    now = datetime.now(timezone.utc).isoformat()
    await db.expenses.update_one({"expense_id": expense_id}, {"$set": {
        "payment_status": "paid", "paid_by": user["user_id"], "paid_at": now,
        "payment_method": data.get("payment_method", ""),
        "payment_reference": data.get("payment_reference", ""),
        "status": "completed", "updated_at": now
    }})
    await ops_audit(user["user_id"], user["name"], "pay_expense", "expense", expense_id,
                    {"amount": data.get("amount"), "method": data.get("payment_method")})
    return {"message": "Expense marked as paid"}


@router.get("/expenses/summary/stats")
async def expense_summary(month: str = None, user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    query = {}
    if month:
        query["expense_date"] = {"$regex": f"^{month}"}
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}}
    ]
    by_cat = await db.expenses.aggregate(pipeline).to_list(50)
    total = sum(c["total"] for c in by_cat)
    pending = await db.expenses.count_documents({"status": "pending"})
    approved = await db.expenses.count_documents({"status": "approved", "payment_status": "unpaid"})
    return {"by_category": by_cat, "total": round(total, 2), "pending_count": pending, "awaiting_payment": approved}


# ═══════════════════════════════════════════
# RECEIPTS
# ═══════════════════════════════════════════

@router.post("/receipts")
async def generate_receipt(data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    seq = await db.counters.find_one_and_update(
        {"_id": "receipt_number"}, {"$inc": {"seq": 1}},
        upsert=True, return_document=True
    )
    receipt_num = f"RCP-{datetime.now(timezone.utc).strftime('%Y')}-{str(seq['seq']).zfill(5)}"
    receipt = {
        "receipt_id": gen_id("rcp_"),
        "receipt_number": receipt_num,
        "student_id": data.get("student_id", ""),
        "student_name": data.get("student_name", ""),
        "payer_name": data.get("payer_name", ""),
        "amount": round(float(data.get("amount", 0)), 2),
        "payment_method": data.get("payment_method", "cash"),
        "reference_number": data.get("reference_number", ""),
        "payment_id": data.get("payment_id", ""),
        "invoice_id": data.get("invoice_id", ""),
        "category": data.get("category", "School Fees"),
        "remarks": data.get("remarks", ""),
        "received_by": user["user_id"],
        "received_by_name": user["name"],
        "status": "active",
        "voided": False, "void_reason": "", "voided_by": None, "voided_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.receipts.insert_one(receipt)
    await ops_audit(user["user_id"], user["name"], "generate_receipt", "receipt", receipt["receipt_id"],
                    {"receipt_number": receipt_num, "amount": receipt["amount"]})
    return {k: v for k, v in receipt.items() if k != "_id"}


@router.get("/receipts")
async def list_receipts(student_id: str = None, date_from: str = None, date_to: str = None, limit: int = 200, user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    query = {"voided": False}
    if student_id:
        query["student_id"] = student_id
    if date_from:
        query.setdefault("created_at", {})["$gte"] = date_from
    if date_to:
        query.setdefault("created_at", {})["$lte"] = date_to
    receipts = await db.receipts.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return receipts


@router.get("/student-balance/{student_id}")
async def get_student_balance(student_id: str, user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    """Get total billed, total paid, and outstanding balance for a student."""
    invoices = await db.invoices_v2.find(
        {"student_id": student_id, "status": {"$nin": ["cancelled", "draft"]}},
        {"_id": 0, "total_due": 1, "amount_paid": 1}
    ).to_list(200)
    total_billed = sum(inv.get("total_due", 0) for inv in invoices)
    total_paid_on_invoices = sum(inv.get("amount_paid", 0) for inv in invoices)

    # Also get direct payments
    payments = await db.payments_v2.find(
        {"student_id": student_id, "status": {"$ne": "reversed"}},
        {"_id": 0, "amount": 1}
    ).to_list(200)
    total_payments = sum(p.get("amount", 0) for p in payments)

    outstanding = max(0, total_billed - total_paid_on_invoices)
    return {
        "student_id": student_id,
        "total_billed": round(total_billed, 2),
        "total_paid": round(total_payments, 2),
        "outstanding": round(outstanding, 2),
    }



@router.post("/receipts/{receipt_id}/void")
async def void_receipt(receipt_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*APPROVAL_ROLES))):
    now = datetime.now(timezone.utc).isoformat()
    await db.receipts.update_one({"receipt_id": receipt_id}, {"$set": {
        "voided": True, "status": "voided", "void_reason": data.get("reason", ""),
        "voided_by": user["user_id"], "voided_at": now
    }})
    await ops_audit(user["user_id"], user["name"], "void_receipt", "receipt", receipt_id,
                    {"reason": data.get("reason", "")})
    return {"message": "Receipt voided"}


# ═══════════════════════════════════════════
# BUDGETS
# ═══════════════════════════════════════════

@router.post("/budgets")
async def create_budget(data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    budget = {
        "budget_id": gen_id("bud_"),
        "name": data.get("name", ""),
        "period": data.get("period", "annual"),
        "academic_year": data.get("academic_year", "2025-2026"),
        "term": data.get("term", ""),
        "total_amount": round(float(data.get("total_amount", 0)), 2),
        "status": "draft",
        "lines": [],
        "created_by": user["user_id"],
        "created_by_name": user["name"],
        "approved_by": None, "approved_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    for line in data.get("lines", []):
        budget["lines"].append({
            "line_id": gen_id("bl_"),
            "department": line.get("department", ""),
            "category": line.get("category", ""),
            "description": line.get("description", ""),
            "allocated": round(float(line.get("allocated", 0)), 2),
            "spent": 0,
        })
    budget["total_amount"] = sum(l["allocated"] for l in budget["lines"]) or budget["total_amount"]
    await db.budgets.insert_one(budget)
    await ops_audit(user["user_id"], user["name"], "create_budget", "budget", budget["budget_id"])
    return {k: v for k, v in budget.items() if k != "_id"}


@router.get("/budgets")
async def list_budgets(academic_year: str = None, user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    query = {}
    if academic_year:
        query["academic_year"] = academic_year
    budgets = await db.budgets.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return budgets


@router.get("/budgets/{budget_id}")
async def get_budget(budget_id: str, user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    b = await db.budgets.find_one({"budget_id": budget_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    # Calculate actual spending per line from expenses
    for line in b.get("lines", []):
        dept = line.get("department", "")
        cat = line.get("category", "")
        q = {"status": {"$in": ["approved", "completed"]}}
        if dept:
            q["department"] = dept
        if cat:
            q["category"] = cat
        pipeline = [{"$match": q}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
        result = await db.expenses.aggregate(pipeline).to_list(1)
        line["spent"] = round(result[0]["total"], 2) if result else 0
        line["remaining"] = round(line["allocated"] - line["spent"], 2)
        line["utilisation"] = round((line["spent"] / line["allocated"] * 100) if line["allocated"] > 0 else 0, 1)
    total_spent = sum(l["spent"] for l in b.get("lines", []))
    b["total_spent"] = round(total_spent, 2)
    b["total_remaining"] = round(b.get("total_amount", 0) - total_spent, 2)
    return b


@router.put("/budgets/{budget_id}")
async def update_budget(budget_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    safe = {k: v for k, v in data.items() if k in ("name", "period", "term", "lines", "total_amount", "status")}
    if "lines" in safe:
        for line in safe["lines"]:
            if not line.get("line_id"):
                line["line_id"] = gen_id("bl_")
            line["allocated"] = round(float(line.get("allocated", 0)), 2)
            line.setdefault("spent", 0)
        safe["total_amount"] = sum(l["allocated"] for l in safe["lines"])
    safe["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.budgets.update_one({"budget_id": budget_id}, {"$set": safe})
    await ops_audit(user["user_id"], user["name"], "update_budget", "budget", budget_id)
    return {"message": "Updated"}


@router.post("/budgets/{budget_id}/approve")
async def approve_budget(budget_id: str, user: dict = Depends(require_roles("CEO", "SuperAdmin"))):
    now = datetime.now(timezone.utc).isoformat()
    await db.budgets.update_one({"budget_id": budget_id}, {"$set": {
        "status": "approved", "approved_by": user["user_id"], "approved_at": now
    }})
    await ops_audit(user["user_id"], user["name"], "approve_budget", "budget", budget_id)
    return {"message": "Budget approved"}


# ═══════════════════════════════════════════
# VENDORS
# ═══════════════════════════════════════════

@router.post("/vendors")
async def create_vendor(data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    vendor = {
        "vendor_id": gen_id("ven_"),
        "name": data.get("name", ""),
        "contact_person": data.get("contact_person", ""),
        "phone": data.get("phone", ""),
        "email": data.get("email", ""),
        "address": data.get("address", ""),
        "service_category": data.get("service_category", ""),
        "tax_id": data.get("tax_id", ""),
        "bank_details": data.get("bank_details", ""),
        "notes": data.get("notes", ""),
        "status": "active",
        "total_paid": 0,
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.vendors.insert_one(vendor)
    await ops_audit(user["user_id"], user["name"], "create_vendor", "vendor", vendor["vendor_id"])
    return {k: v for k, v in vendor.items() if k != "_id"}


@router.get("/vendors")
async def list_vendors(user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    vendors = await db.vendors.find({"status": {"$ne": "deleted"}}, {"_id": 0}).sort("name", 1).to_list(200)
    return vendors


@router.put("/vendors/{vendor_id}")
async def update_vendor(vendor_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    safe = {k: v for k, v in data.items() if k in ("name", "contact_person", "phone", "email", "address", "service_category", "tax_id", "bank_details", "notes", "status")}
    await db.vendors.update_one({"vendor_id": vendor_id}, {"$set": safe})
    return {"message": "Updated"}


# ═══════════════════════════════════════════
# PROCUREMENT
# ═══════════════════════════════════════════

@router.post("/procurement")
async def create_procurement(data: dict = Body(...), user: dict = Depends(get_current_user)):
    proc = {
        "procurement_id": gen_id("proc_"),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "department": data.get("department", ""),
        "estimated_amount": round(float(data.get("estimated_amount", 0)), 2),
        "vendor_id": data.get("vendor_id", ""),
        "vendor_name": data.get("vendor_name", ""),
        "quotation_file_ids": data.get("quotation_file_ids", []),
        "items": data.get("items", []),
        "urgency": data.get("urgency", "normal"),
        "status": "requested",
        "workflow": [{"step": "requested", "by": user["user_id"], "by_name": user["name"], "at": datetime.now(timezone.utc).isoformat(), "notes": ""}],
        "requested_by": user["user_id"],
        "requested_by_name": user["name"],
        "dept_approved_by": None, "finance_reviewed_by": None,
        "leadership_approved_by": None, "payment_processed_by": None,
        "final_amount": 0,
        "payment_status": "unpaid",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.procurement.insert_one(proc)
    await ops_audit(user["user_id"], user["name"], "create_procurement", "procurement", proc["procurement_id"])
    return {k: v for k, v in proc.items() if k != "_id"}


@router.get("/procurement")
async def list_procurement(status: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    if user.get("role") not in FINANCE_VIEW_ROLES:
        query["requested_by"] = user["user_id"]
    procs = await db.procurement.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return procs


@router.post("/procurement/{proc_id}/advance")
async def advance_procurement(proc_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Advance procurement through workflow stages."""
    proc = await db.procurement.find_one({"procurement_id": proc_id}, {"_id": 0})
    if not proc:
        raise HTTPException(404, "Not found")

    action = data.get("action", "approve")
    notes = data.get("notes", "")
    now = datetime.now(timezone.utc).isoformat()
    current = proc["status"]
    step = {"by": user["user_id"], "by_name": user["name"], "at": now, "notes": notes}

    if action == "reject":
        step["step"] = "rejected"
        await db.procurement.update_one({"procurement_id": proc_id}, {
            "$set": {"status": "rejected", "updated_at": now},
            "$push": {"workflow": step}
        })
        return {"message": "Procurement rejected"}

    transitions = {
        "requested": ("dept_reviewed", "dept_approved_by"),
        "dept_reviewed": ("finance_reviewed", "finance_reviewed_by"),
        "finance_reviewed": ("leadership_approved", "leadership_approved_by"),
        "leadership_approved": ("payment_processed", "payment_processed_by"),
        "payment_processed": ("completed", None),
    }
    if current not in transitions:
        raise HTTPException(400, f"Cannot advance from {current}")

    next_status, approver_field = transitions[current]
    step["step"] = next_status
    update = {"status": next_status, "updated_at": now}
    if approver_field:
        update[approver_field] = user["user_id"]
    if next_status == "payment_processed":
        update["final_amount"] = round(float(data.get("final_amount", proc.get("estimated_amount", 0))), 2)
        update["payment_status"] = "paid"

    await db.procurement.update_one({"procurement_id": proc_id}, {
        "$set": update, "$push": {"workflow": step}
    })
    await ops_audit(user["user_id"], user["name"], f"procurement_{next_status}", "procurement", proc_id)
    return {"message": f"Advanced to {next_status}"}


# ═══════════════════════════════════════════
# PETTY CASH
# ═══════════════════════════════════════════

@router.post("/petty-cash/accounts")
async def create_petty_cash_account(data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    acc = {
        "account_id": gen_id("pca_"),
        "name": data.get("name", "Main Petty Cash"),
        "custodian_id": data.get("custodian_id", user["user_id"]),
        "custodian_name": data.get("custodian_name", user["name"]),
        "balance": round(float(data.get("initial_balance", 0)), 2),
        "status": "active",
        "created_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.petty_cash_accounts.insert_one(acc)
    if acc["balance"] > 0:
        await db.petty_cash_transactions.insert_one({
            "txn_id": gen_id("pctx_"), "account_id": acc["account_id"],
            "type": "top_up", "amount": acc["balance"],
            "description": "Initial balance", "receipt_file_id": "",
            "created_by": user["user_id"], "created_by_name": user["name"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    await ops_audit(user["user_id"], user["name"], "create_petty_cash", "petty_cash", acc["account_id"])
    return {k: v for k, v in acc.items() if k != "_id"}


@router.get("/petty-cash/accounts")
async def list_petty_cash_accounts(user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    accounts = await db.petty_cash_accounts.find({"status": "active"}, {"_id": 0}).to_list(20)
    return accounts


@router.post("/petty-cash/{account_id}/top-up")
async def petty_cash_top_up(account_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    amount = round(float(data.get("amount", 0)), 2)
    if amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    await db.petty_cash_accounts.update_one({"account_id": account_id}, {"$inc": {"balance": amount}})
    txn = {
        "txn_id": gen_id("pctx_"), "account_id": account_id,
        "type": "top_up", "amount": amount,
        "description": data.get("description", "Top up"),
        "receipt_file_id": data.get("receipt_file_id", ""),
        "created_by": user["user_id"], "created_by_name": user["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.petty_cash_transactions.insert_one(txn)
    await ops_audit(user["user_id"], user["name"], "petty_cash_top_up", "petty_cash", account_id, {"amount": amount})
    return {k: v for k, v in txn.items() if k != "_id"}


@router.post("/petty-cash/{account_id}/spend")
async def petty_cash_spend(account_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    amount = round(float(data.get("amount", 0)), 2)
    if amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    acc = await db.petty_cash_accounts.find_one({"account_id": account_id}, {"_id": 0})
    if not acc:
        raise HTTPException(404, "Account not found")
    if acc["balance"] < amount:
        raise HTTPException(400, f"Insufficient balance (TT$ {acc['balance']})")
    await db.petty_cash_accounts.update_one({"account_id": account_id}, {"$inc": {"balance": -amount}})
    txn = {
        "txn_id": gen_id("pctx_"), "account_id": account_id,
        "type": "spend", "amount": amount,
        "description": data.get("description", ""),
        "category": data.get("category", ""),
        "receipt_file_id": data.get("receipt_file_id", ""),
        "created_by": user["user_id"], "created_by_name": user["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.petty_cash_transactions.insert_one(txn)
    await ops_audit(user["user_id"], user["name"], "petty_cash_spend", "petty_cash", account_id, {"amount": amount, "desc": txn["description"]})
    return {k: v for k, v in txn.items() if k != "_id"}


@router.get("/petty-cash/{account_id}/transactions")
async def petty_cash_transactions(account_id: str, user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    txns = await db.petty_cash_transactions.find({"account_id": account_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return txns


@router.delete("/petty-cash/{account_id}")
async def delete_petty_cash_account(account_id: str, user: dict = Depends(require_roles(*FINANCE_ROLES))):
    acc = await db.petty_cash_accounts.find_one({"account_id": account_id}, {"_id": 0})
    if not acc:
        raise HTTPException(404, "Account not found")
    await db.petty_cash_accounts.delete_one({"account_id": account_id})
    await db.petty_cash_transactions.delete_many({"account_id": account_id})
    await ops_audit(user["user_id"], user["name"], "delete_petty_cash", "petty_cash", account_id)
    return {"message": "Account deleted"}


# ═══════════════════════════════════════════
# APPROVAL QUEUE
# ═══════════════════════════════════════════

@router.get("/approvals/pending")
async def pending_approvals(user: dict = Depends(require_roles(*APPROVAL_ROLES))):
    expenses = await db.expenses.find({"status": {"$in": ["pending", "reviewed"]}}, {"_id": 0}).sort("created_at", -1).to_list(100)
    procurement = await db.procurement.find({"status": {"$nin": ["completed", "rejected"]}}, {"_id": 0}).sort("created_at", -1).to_list(100)
    budgets = await db.budgets.find({"status": "draft"}, {"_id": 0}).to_list(20)
    return {
        "expenses": expenses,
        "procurement": procurement,
        "budgets": budgets,
        "total": len(expenses) + len(procurement) + len(budgets)
    }


# ═══════════════════════════════════════════
# ENHANCED DASHBOARD STATS
# ═══════════════════════════════════════════

@router.get("/dashboard/extended")
async def extended_dashboard(user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    now = datetime.now(timezone.utc)
    month_prefix = now.strftime("%Y-%m")

    # Expenses this month
    exp_pipeline = [
        {"$match": {"expense_date": {"$regex": f"^{month_prefix}"}}},
        {"$group": {"_id": "$status", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    exp_stats = await db.expenses.aggregate(exp_pipeline).to_list(10)
    total_expenses_month = sum(e["total"] for e in exp_stats)
    pending_expenses = sum(e["count"] for e in exp_stats if e["_id"] in ("pending", "reviewed"))

    # Petty cash
    pc_accounts = await db.petty_cash_accounts.find({"status": "active"}, {"_id": 0}).to_list(10)
    petty_cash_balance = sum(a.get("balance", 0) for a in pc_accounts)

    # Pending approvals
    pending_exp = await db.expenses.count_documents({"status": {"$in": ["pending", "reviewed"]}})
    pending_proc = await db.procurement.count_documents({"status": {"$nin": ["completed", "rejected"]}})
    pending_budgets = await db.budgets.count_documents({"status": "draft"})

    # Vendors
    vendor_count = await db.vendors.count_documents({"status": {"$ne": "deleted"}})

    # Procurement this month
    proc_total = await db.procurement.count_documents({"created_at": {"$regex": f"^{month_prefix}"}})

    # Receipts today
    today = now.strftime("%Y-%m-%d")
    receipts_today = await db.receipts.count_documents({"created_at": {"$regex": f"^{today}"}, "voided": False})
    receipt_pipeline = [
        {"$match": {"created_at": {"$regex": f"^{today}"}, "voided": False}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    receipt_sum = await db.receipts.aggregate(receipt_pipeline).to_list(1)
    receipts_total_today = receipt_sum[0]["total"] if receipt_sum else 0

    # Expense by category this month
    cat_pipeline = [
        {"$match": {"expense_date": {"$regex": f"^{month_prefix}"}, "status": {"$in": ["approved", "completed"]}}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}}
    ]
    expense_by_cat = await db.expenses.aggregate(cat_pipeline).to_list(20)

    return {
        "total_expenses_month": round(total_expenses_month, 2),
        "pending_expenses": pending_expenses,
        "petty_cash_balance": round(petty_cash_balance, 2),
        "pending_approvals": pending_exp + pending_proc + pending_budgets,
        "pending_expense_approvals": pending_exp,
        "pending_procurement": pending_proc,
        "pending_budget_approvals": pending_budgets,
        "vendor_count": vendor_count,
        "procurement_this_month": proc_total,
        "receipts_today": receipts_today,
        "receipts_total_today": round(receipts_total_today, 2),
        "expense_by_category": expense_by_cat,
    }



# ═══════════════════════════════════════════
# AUDIT LOG
# ═══════════════════════════════════════════

@router.get("/audit-log")
async def get_audit_log(limit: int = 500, user: dict = Depends(require_roles(*APPROVAL_ROLES))):
    logs = await db.finance_audit.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs



# ═══════════════════════════════════════════
# PAYROLL SUPPORT
# ═══════════════════════════════════════════

@router.post("/payroll/staff-records")
async def create_staff_salary(data: dict = Body(...), user: dict = Depends(require_roles(*APPROVAL_ROLES))):
    record = {
        "record_id": gen_id("psr_"), "staff_id": data.get("staff_id", ""),
        "staff_name": data.get("staff_name", ""), "department": data.get("department", ""),
        "role": data.get("role", ""), "basic_salary": float(data.get("basic_salary", 0)),
        "housing_allowance": float(data.get("housing_allowance", 0)),
        "transport_allowance": float(data.get("transport_allowance", 0)),
        "other_allowance": float(data.get("other_allowance", 0)),
        "tax_deduction": float(data.get("tax_deduction", 0)),
        "pension_deduction": float(data.get("pension_deduction", 0)),
        "other_deduction": float(data.get("other_deduction", 0)),
        "bank_name": data.get("bank_name", ""), "account_number": data.get("account_number", ""),
        "status": "active",
        "created_by": user["user_id"], "created_by_name": user["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    gross = record["basic_salary"] + record["housing_allowance"] + record["transport_allowance"] + record["other_allowance"]
    deductions = record["tax_deduction"] + record["pension_deduction"] + record["other_deduction"]
    record["gross_salary"] = gross
    record["total_deductions"] = deductions
    record["net_salary"] = gross - deductions

    await db.payroll_records.insert_one(record)
    await log_audit(user, "create_staff_salary", "payroll", record["record_id"], record)
    return {k: v for k, v in record.items() if k != "_id"}


@router.get("/payroll/staff-records")
async def list_staff_salaries(user: dict = Depends(require_roles(*APPROVAL_ROLES))):
    records = await db.payroll_records.find({"status": "active"}, {"_id": 0}).sort("staff_name", 1).to_list(500)
    return records


@router.put("/payroll/staff-records/{record_id}")
async def update_staff_salary(record_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*APPROVAL_ROLES))):
    safe = {k: v for k, v in data.items() if k in (
        "basic_salary", "housing_allowance", "transport_allowance", "other_allowance",
        "tax_deduction", "pension_deduction", "other_deduction", "bank_name", "account_number", "department", "role"
    )}
    for k in ("basic_salary", "housing_allowance", "transport_allowance", "other_allowance", "tax_deduction", "pension_deduction", "other_deduction"):
        if k in safe:
            safe[k] = float(safe[k])

    gross = sum(safe.get(k, 0) for k in ("basic_salary", "housing_allowance", "transport_allowance", "other_allowance"))
    deductions = sum(safe.get(k, 0) for k in ("tax_deduction", "pension_deduction", "other_deduction"))

    # Merge with existing if partial update
    if gross == 0 or deductions == 0:
        existing = await db.payroll_records.find_one({"record_id": record_id}, {"_id": 0})
        if existing:
            for k in ("basic_salary", "housing_allowance", "transport_allowance", "other_allowance", "tax_deduction", "pension_deduction", "other_deduction"):
                if k not in safe:
                    safe[k] = existing.get(k, 0)
            gross = sum(safe.get(k, 0) for k in ("basic_salary", "housing_allowance", "transport_allowance", "other_allowance"))
            deductions = sum(safe.get(k, 0) for k in ("tax_deduction", "pension_deduction", "other_deduction"))

    safe["gross_salary"] = gross
    safe["total_deductions"] = deductions
    safe["net_salary"] = gross - deductions
    safe["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.payroll_records.update_one({"record_id": record_id}, {"$set": safe})
    return {"message": "Salary record updated"}


@router.post("/payroll/generate")
async def generate_payroll(data: dict = Body(...), user: dict = Depends(require_roles(*APPROVAL_ROLES))):
    month = data.get("month", "")
    year = data.get("year", "")
    if not month or not year:
        raise HTTPException(400, "Month and year required")

    existing = await db.payroll_runs.find_one({"month": month, "year": year}, {"_id": 0})
    if existing:
        raise HTTPException(400, f"Payroll for {month}/{year} already exists")

    records = await db.payroll_records.find({"status": "active"}, {"_id": 0}).to_list(500)
    if not records:
        raise HTTPException(400, "No active salary records")

    stubs = []
    total_gross = 0
    total_net = 0
    total_deductions = 0
    for r in records:
        stub = {
            "stub_id": gen_id("pst_"), "staff_id": r["staff_id"], "staff_name": r["staff_name"],
            "department": r.get("department", ""), "role": r.get("role", ""),
            "basic_salary": r["basic_salary"], "housing_allowance": r["housing_allowance"],
            "transport_allowance": r["transport_allowance"], "other_allowance": r["other_allowance"],
            "gross_salary": r["gross_salary"],
            "tax_deduction": r["tax_deduction"], "pension_deduction": r["pension_deduction"],
            "other_deduction": r["other_deduction"], "total_deductions": r["total_deductions"],
            "net_salary": r["net_salary"],
            "bank_name": r.get("bank_name", ""), "account_number": r.get("account_number", ""),
        }
        stubs.append(stub)
        total_gross += r["gross_salary"]
        total_net += r["net_salary"]
        total_deductions += r["total_deductions"]

    run = {
        "run_id": gen_id("prl_"), "month": month, "year": year,
        "staff_count": len(stubs), "total_gross": total_gross,
        "total_deductions": total_deductions, "total_net": total_net,
        "stubs": stubs, "status": "draft",
        "generated_by": user["user_id"], "generated_by_name": user["name"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payroll_runs.insert_one(run)
    await log_audit(user, "generate_payroll", "payroll", run["run_id"], {"month": month, "year": year, "staff": len(stubs)})
    return {k: v for k, v in run.items() if k != "_id"}


@router.get("/payroll/runs")
async def list_payroll_runs(user: dict = Depends(require_roles(*APPROVAL_ROLES))):
    runs = await db.payroll_runs.find({}, {"_id": 0, "stubs": 0}).sort("generated_at", -1).to_list(100)
    return runs


@router.get("/payroll/runs/{run_id}")
async def get_payroll_run(run_id: str, user: dict = Depends(require_roles(*APPROVAL_ROLES))):
    run = await db.payroll_runs.find_one({"run_id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(404, "Payroll run not found")
    return run


@router.put("/payroll/runs/{run_id}/approve")
async def approve_payroll(run_id: str, user: dict = Depends(require_roles("CEO", "SuperAdmin", "Principal"))):
    await db.payroll_runs.update_one({"run_id": run_id}, {
        "$set": {"status": "approved", "approved_by": user["name"], "approved_at": datetime.now(timezone.utc).isoformat()}
    })
    await log_audit(user, "approve_payroll", "payroll", run_id, {})
    return {"message": "Payroll approved"}


# ═══════════════════════════════════════════
# ADVANCED REPORTING
# ═══════════════════════════════════════════

@router.get("/reports/income-expense")
async def income_expense_report(period: str = "month", user: dict = Depends(require_roles(*APPROVAL_ROLES))):
    now = datetime.now(timezone.utc)
    if period == "month":
        start = now.replace(day=1).isoformat()
    elif period == "term":
        start = (now - timedelta(days=90)).isoformat()
    elif period == "year":
        start = now.replace(month=1, day=1).isoformat()
    else:
        start = (now - timedelta(days=30)).isoformat()

    import asyncio
    income_pipeline = [
        {"$match": {"created_at": {"$gte": start}}},
        {"$group": {"_id": "$method", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    expense_pipeline = [
        {"$match": {"created_at": {"$gte": start}, "status": {"$ne": "rejected"}}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]

    income_data, expense_data, total_invoiced, total_paid = await asyncio.gather(
        db.payments_v2.aggregate(income_pipeline).to_list(20),
        db.expenses.aggregate(expense_pipeline).to_list(30),
        db.invoices_v2.aggregate([{"$match": {"created_at": {"$gte": start}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1),
        db.payments_v2.aggregate([{"$match": {"created_at": {"$gte": start}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1),
    )

    total_income = total_paid[0]["total"] if total_paid else 0
    total_expenses = sum(e["total"] for e in expense_data)

    return {
        "period": period, "start_date": start,
        "income_by_method": [{"method": r["_id"] or "Unknown", "total": r["total"], "count": r["count"]} for r in income_data],
        "expenses_by_category": [{"category": r["_id"] or "Other", "total": r["total"], "count": r["count"]} for r in expense_data],
        "total_invoiced": total_invoiced[0]["total"] if total_invoiced else 0,
        "total_income": total_income, "total_expenses": total_expenses,
        "net_position": total_income - total_expenses,
    }


@router.get("/reports/department-summary")
async def department_summary(user: dict = Depends(require_roles(*APPROVAL_ROLES))):
    import asyncio
    expense_pipeline = [
        {"$match": {"status": {"$ne": "rejected"}}},
        {"$group": {"_id": "$department", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    budget_pipeline = [
        {"$unwind": "$lines"},
        {"$group": {"_id": "$lines.department", "allocated": {"$sum": "$lines.allocated"}, "spent": {"$sum": "$lines.spent"}}}
    ]
    payroll_pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$department", "total_monthly": {"$sum": "$net_salary"}, "staff_count": {"$sum": 1}}}
    ]

    expenses, budgets, payroll = await asyncio.gather(
        db.expenses.aggregate(expense_pipeline).to_list(30),
        db.budgets.aggregate(budget_pipeline).to_list(30),
        db.payroll_records.aggregate(payroll_pipeline).to_list(30),
    )

    dept_map = {}
    for e in expenses:
        d = e["_id"] or "Unassigned"
        dept_map.setdefault(d, {"department": d, "expenses": 0, "budget_allocated": 0, "budget_spent": 0, "payroll_monthly": 0, "staff_count": 0})
        dept_map[d]["expenses"] = e["total"]
    for b in budgets:
        d = b["_id"] or "Unassigned"
        dept_map.setdefault(d, {"department": d, "expenses": 0, "budget_allocated": 0, "budget_spent": 0, "payroll_monthly": 0, "staff_count": 0})
        dept_map[d]["budget_allocated"] = b["allocated"]
        dept_map[d]["budget_spent"] = b["spent"]
    for p in payroll:
        d = p["_id"] or "Unassigned"
        dept_map.setdefault(d, {"department": d, "expenses": 0, "budget_allocated": 0, "budget_spent": 0, "payroll_monthly": 0, "staff_count": 0})
        dept_map[d]["payroll_monthly"] = p["total_monthly"]
        dept_map[d]["staff_count"] = p["staff_count"]

    return sorted(dept_map.values(), key=lambda x: x["expenses"], reverse=True)


@router.get("/reports/financial-summary")
async def financial_summary(user: dict = Depends(require_roles(*APPROVAL_ROLES))):
    import asyncio
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).isoformat()

    results = await asyncio.gather(
        db.invoices_v2.aggregate([{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1),
        db.payments_v2.aggregate([{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1),
        db.expenses.aggregate([{"$match": {"status": {"$ne": "rejected"}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1),
        db.payments_v2.aggregate([{"$match": {"created_at": {"$gte": month_start}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1),
        db.expenses.aggregate([{"$match": {"created_at": {"$gte": month_start}, "status": {"$ne": "rejected"}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1),
        db.payroll_records.aggregate([{"$match": {"status": "active"}}, {"$group": {"_id": None, "total": {"$sum": "$net_salary"}, "count": {"$sum": 1}}}]).to_list(1),
        db.petty_cash_accounts.aggregate([{"$group": {"_id": None, "total": {"$sum": "$balance"}}}]).to_list(1),
        db.vendors.count_documents({"status": "active"}),
        db.payroll_runs.count_documents({}),
    )

    return {
        "all_time_invoiced": results[0][0]["total"] if results[0] else 0,
        "all_time_collected": results[1][0]["total"] if results[1] else 0,
        "all_time_expenses": results[2][0]["total"] if results[2] else 0,
        "month_income": results[3][0]["total"] if results[3] else 0,
        "month_expenses": results[4][0]["total"] if results[4] else 0,
        "monthly_payroll": results[5][0]["total"] if results[5] else 0,
        "total_staff_on_payroll": results[5][0]["count"] if results[5] else 0,
        "petty_cash_balance": results[6][0]["total"] if results[6] else 0,
        "active_vendors": results[7],
        "payroll_runs": results[8],
    }

