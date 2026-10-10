from fastapi import APIRouter, Depends, HTTPException
from database import db
from models import InvoiceCreate, PaymentCreate, gen_id
from auth import get_current_user, require_roles, log_audit
from datetime import datetime, timezone

router = APIRouter(prefix="/api/finance", tags=["finance"])


@router.get("/invoices")
async def list_invoices(
    student_id: str = None,
    status: str = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if student_id:
        query["student_id"] = student_id
    if status:
        query["status"] = status

    # Parents/students can only see their own
    if user.get("role") == "Student":
        query["student_id"] = user["user_id"]
    elif user.get("role") == "Parent":
        children = await db.users.find(
            {"role": "Student", "guardian_ids": user["user_id"]},
            {"_id": 0, "user_id": 1}
        ).to_list(100)
        child_ids = [c["user_id"] for c in children]
        query["student_id"] = {"$in": child_ids}

    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for inv in invoices:
        student = await db.users.find_one({"user_id": inv.get("student_id")}, {"_id": 0})
        inv["student_name"] = student["name"] if student else ""
    return invoices


@router.post("/invoices")
async def create_invoice(
    data: InvoiceCreate,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "FinanceOfficer"))
):
    total = sum(item.amount for item in data.items)
    doc = {
        "invoice_id": gen_id("inv_"),
        "student_id": data.student_id,
        "term": data.term,
        "academic_year": data.academic_year,
        "items": [item.model_dump() for item in data.items],
        "total": total,
        "paid": 0,
        "balance": total,
        "status": "pending",
        "due_date": data.due_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.invoices.insert_one(doc)
    await log_audit(user["user_id"], user["name"], "create_invoice", "invoice", doc["invoice_id"],
                    {"amount": total})
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    student = await db.users.find_one({"user_id": inv.get("student_id")}, {"_id": 0})
    inv["student_name"] = student["name"] if student else ""

    payments = await db.payments.find({"invoice_id": invoice_id}, {"_id": 0}).to_list(100)
    inv["payments"] = payments
    return inv


@router.post("/payments")
async def record_payment(
    data: PaymentCreate,
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "FinanceOfficer"))
):
    invoice = await db.invoices.find_one({"invoice_id": data.invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    doc = {
        "payment_id": gen_id("pay_"),
        "invoice_id": data.invoice_id,
        "student_id": invoice["student_id"],
        "amount": data.amount,
        "method": data.method,
        "reference": data.reference,
        "recorded_by": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payments.insert_one(doc)

    # Update invoice
    new_paid = invoice["paid"] + data.amount
    new_balance = invoice["total"] - new_paid
    new_status = "paid" if new_balance <= 0 else ("partial" if new_paid > 0 else "pending")
    await db.invoices.update_one(
        {"invoice_id": data.invoice_id},
        {"$set": {"paid": new_paid, "balance": max(0, new_balance), "status": new_status}}
    )

    await log_audit(user["user_id"], user["name"], "record_payment", "payment", doc["payment_id"],
                    {"amount": data.amount, "method": data.method})
    return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/payments")
async def list_payments(
    student_id: str = None,
    invoice_id: str = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if student_id:
        query["student_id"] = student_id
    if invoice_id:
        query["invoice_id"] = invoice_id

    payments = await db.payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for p in payments:
        student = await db.users.find_one({"user_id": p.get("student_id")}, {"_id": 0})
        recorder = await db.users.find_one({"user_id": p.get("recorded_by")}, {"_id": 0})
        p["student_name"] = student["name"] if student else ""
        p["recorded_by_name"] = recorder["name"] if recorder else ""
    return payments


@router.get("/statements/{student_id}")
async def get_student_statement(student_id: str, user: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({"student_id": student_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    payments = await db.payments.find({"student_id": student_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0})

    total_invoiced = sum(i["total"] for i in invoices)
    total_paid = sum(p["amount"] for p in payments)

    return {
        "student_id": student_id,
        "student_name": student["name"] if student else "",
        "total_invoiced": total_invoiced,
        "total_paid": total_paid,
        "balance": total_invoiced - total_paid,
        "invoices": invoices,
        "payments": payments
    }


@router.get("/dashboard")
async def finance_dashboard(
    user: dict = Depends(require_roles("SuperAdmin", "Admin", "FinanceOfficer"))
):
    total_invoiced = 0
    total_collected = 0
    total_outstanding = 0

    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    for inv in invoices:
        total_invoiced += inv.get("total", 0)
        total_collected += inv.get("paid", 0)
        total_outstanding += inv.get("balance", 0)

    # Status breakdown
    pending = await db.invoices.count_documents({"status": "pending"})
    partial = await db.invoices.count_documents({"status": "partial"})
    paid = await db.invoices.count_documents({"status": "paid"})

    recent_payments = await db.payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    for p in recent_payments:
        student = await db.users.find_one({"user_id": p.get("student_id")}, {"_id": 0})
        p["student_name"] = student["name"] if student else ""

    return {
        "total_invoiced": total_invoiced,
        "total_collected": total_collected,
        "total_outstanding": total_outstanding,
        "invoice_counts": {"pending": pending, "partial": partial, "paid": paid},
        "recent_payments": recent_payments
    }
