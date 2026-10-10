from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File, Query, Request
from database import db, get_active_term
from models import gen_id
from auth import get_current_user, require_roles, log_audit
from datetime import datetime, timezone
from routes.finance.accounting_bridge import post_invoice_journal, post_payment_journal, reverse_finance_journal, clear_all_finance_journals
import os
import csv
import io

router = APIRouter(prefix="/api/finance", tags=["finance"])

FINANCE_ROLES = ("SuperAdmin", "FinanceOfficer", "CEO", "Founder", "Admin", "Accounts")
FINANCE_VIEW_ROLES = ("Admin", "SuperAdmin", "FinanceOfficer", "CEO")


async def finance_audit(user_id, user_name, action, entity_type, entity_id, before=None, after=None, reason=""):
    await db.finance_audit.insert_one({
        "audit_id": gen_id("faud_"), "user_id": user_id, "user_name": user_name,
        "action": action, "entity_type": entity_type, "entity_id": entity_id,
        "before": before or {}, "after": after or {}, "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    await log_audit(user_id, user_name, action, entity_type, entity_id, {"reason": reason})


async def recalc_student_balance(student_id):
    """Recalculate student account balance from invoices, allocations, and credits."""
    invoices = await db.invoices_v2.find(
        {"student_id": student_id, "status": {"$ne": "cancelled"}}, {"_id": 0}
    ).to_list(500)
    total_invoiced = sum(i.get("total_due", 0) for i in invoices)

    allocations = await db.allocations.find({"student_id": student_id}, {"_id": 0}).to_list(1000)
    total_allocated = sum(a.get("allocated_amount", 0) for a in allocations)

    credits = await db.credit_notes.find(
        {"student_id": student_id, "status": "applied"}, {"_id": 0}
    ).to_list(500)
    total_credits = sum(c.get("amount", 0) for c in credits)

    balance = total_invoiced - total_allocated - total_credits
    credit_balance = max(0, -balance)
    arrears = max(0, balance)

    await db.student_accounts.update_one(
        {"student_id": student_id},
        {"$set": {
            "student_id": student_id, "current_balance": round(balance, 2),
            "credit_balance": round(credit_balance, 2), "arrears_balance": round(arrears, 2),
            "total_invoiced": round(total_invoiced, 2), "total_paid": round(total_allocated, 2),
            "total_credits": round(total_credits, 2),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )

    # Update invoice statuses
    for inv in invoices:
        inv_allocs = [a for a in allocations if a.get("invoice_id") == inv["invoice_id"]]
        inv_credits = [c for c in credits if c.get("invoice_id") == inv["invoice_id"]]
        paid = sum(a["allocated_amount"] for a in inv_allocs) + sum(c["amount"] for c in inv_credits)
        if paid >= inv["total_due"]:
            new_status = "paid"
        elif paid > 0:
            new_status = "partial"
        elif inv["status"] != "draft":
            due = inv.get("due_at", "")
            if due and due < datetime.now(timezone.utc).isoformat():
                new_status = "overdue"
            else:
                new_status = "issued"
        else:
            new_status = inv["status"]
        await db.invoices_v2.update_one({"invoice_id": inv["invoice_id"]}, {"$set": {"status": new_status, "amount_paid": round(paid, 2)}})

        # Update line items
        for li in await db.invoice_line_items.find({"invoice_id": inv["invoice_id"]}, {"_id": 0}).to_list(50):
            li_allocs = [a for a in inv_allocs if a.get("line_item_id") == li["item_id"]]
            li_paid = sum(a["allocated_amount"] for a in li_allocs)
            await db.invoice_line_items.update_one(
                {"item_id": li["item_id"]},
                {"$set": {"amount_paid": round(li_paid, 2), "amount_outstanding": round(li["amount"] - li_paid, 2)}}
            )

    return {"balance": round(balance, 2), "credit": round(credit_balance, 2), "arrears": round(arrears, 2)}



@router.get("/overview-drilldown")
async def overview_drilldown(filter_type: str = "collected", user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES, "HeadTeacher", "Principal", "Founder"))):
    """Drill down into overview stats: collected, outstanding, invoiced."""
    active_term, _ = await get_active_term()
    invoices = await db.invoices_v2.find(
        {"term": active_term, "status": {"$ne": "cancelled"}},
        {"_id": 0, "invoice_id": 1, "student_id": 1, "total_due": 1, "amount_paid": 1, "status": 1}
    ).to_list(5000)

    student_ids = list({inv["student_id"] for inv in invoices if inv.get("student_id")})
    students = await db.users.find(
        {"user_id": {"$in": student_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "year_group": 1, "boarding_status": 1}
    ).to_list(len(student_ids))
    student_map = {s["user_id"]: s for s in students}

    agg = {}
    for inv in invoices:
        sid = inv["student_id"]
        if sid not in agg:
            s = student_map.get(sid, {})
            agg[sid] = {"student_id": sid, "name": s.get("name", "Unknown"), "year_group": s.get("year_group", ""), "total_due": 0, "total_paid": 0}
        agg[sid]["total_due"] += inv.get("total_due", 0)
        agg[sid]["total_paid"] += inv.get("amount_paid", 0)

    rows = []
    for r in agg.values():
        r["balance"] = round(r["total_due"] - r["total_paid"], 2)
        r["total_due"] = round(r["total_due"], 2)
        r["total_paid"] = round(r["total_paid"], 2)
        if filter_type == "collected" and r["total_paid"] > 0:
            rows.append(r)
        elif filter_type == "outstanding" and r["balance"] > 0:
            rows.append(r)
        elif filter_type == "invoiced":
            rows.append(r)

    rows.sort(key=lambda x: x["name"])
    return {"filter": filter_type, "term": active_term, "students": rows, "count": len(rows)}


# ─── Fee Structure ───
@router.get("/fee-structures")
async def list_fee_structures(user: dict = Depends(get_current_user)):
    structures = await db.fee_structures.find({}, {"_id": 0}).to_list(100)
    return structures


@router.post("/fee-structures")
async def create_fee_structure(data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    doc = {
        "structure_id": gen_id("fs_"), "name": data.get("name", ""),
        "year_group": data.get("year_group", ""), "term": data.get("term", ""),
        "boarding_status": data.get("boarding_status", "all"),
        "items": data.get("items", []),
        "total": sum(i.get("amount", 0) for i in data.get("items", [])),
        "academic_year": data.get("academic_year", "2025-2026"),
        "created_by": user["user_id"], "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.fee_structures.insert_one(doc)
    await finance_audit(user["user_id"], user["name"], "create_fee_structure", "fee_structure", doc["structure_id"])
    return {k: v for k, v in doc.items() if k != "_id"}


# ─── Invoices ───
@router.get("/invoices")
async def list_invoices(
    student_id: str = None, term: str = None, status: str = None,
    year_group: str = None, limit: int = 200,
    user: dict = Depends(get_current_user)
):
    query = {}
    if student_id:
        query["student_id"] = student_id
    # Auto-filter by active term if no term specified
    if term:
        query["term"] = term
    else:
        active_term, _ = await get_active_term()
        query["term"] = active_term
    if status:
        query["status"] = status
    if user.get("role") == "Student":
        query["student_id"] = user["user_id"]
    elif user.get("role") == "Parent":
        children = await db.users.find({"role": "Student", "guardian_ids": user["user_id"]}, {"_id": 0, "user_id": 1}).to_list(20)
        query["student_id"] = {"$in": [c["user_id"] for c in children]} if children else "none"

    invoices = await db.invoices_v2.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)

    # Bulk fetch students and line items to avoid N+1
    student_ids = list({inv.get("student_id") for inv in invoices if inv.get("student_id")})
    invoice_ids = [inv["invoice_id"] for inv in invoices]
    students_list = await db.users.find({"user_id": {"$in": student_ids}}, {"_id": 0, "user_id": 1, "name": 1, "class_id": 1, "year_group": 1}).to_list(len(student_ids)) if student_ids else []
    all_line_items = await db.invoice_line_items.find({"invoice_id": {"$in": invoice_ids}}, {"_id": 0}).to_list(5000) if invoice_ids else []
    student_map = {s["user_id"]: s for s in students_list}
    li_map = {}
    for li in all_line_items:
        li_map.setdefault(li["invoice_id"], []).append(li)

    for inv in invoices:
        student = student_map.get(inv.get("student_id"))
        inv["student_name"] = student["name"] if student else ""
        inv["year_group"] = student.get("year_group", "") if student else ""
        inv["line_items"] = li_map.get(inv["invoice_id"], [])
    return invoices


@router.post("/invoices")
async def create_invoice(data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    now = datetime.now(timezone.utc).isoformat()
    inv_num = f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{gen_id('')[:6].upper()}"
    items = data.get("items", [])
    subtotal = sum(i.get("amount", 0) for i in items)
    discount = data.get("discount_total", 0)
    penalty = data.get("penalty_total", 0)
    total = subtotal - discount + penalty

    inv_id = gen_id("inv_")
    active_term, active_year = await get_active_term()
    doc = {
        "invoice_id": inv_id, "invoice_number": inv_num,
        "student_id": data.get("student_id", ""),
        "term": data.get("term", "") or active_term, "academic_year": data.get("academic_year", "") or active_year,
        "status": data.get("status", "issued"),
        "issued_at": now, "due_at": data.get("due_at", ""),
        "subtotal": round(subtotal, 2), "discount_total": round(discount, 2),
        "penalty_total": round(penalty, 2), "total_due": round(total, 2),
        "amount_paid": 0, "notes": data.get("notes", ""),
        "created_by": user["user_id"], "created_at": now
    }
    await db.invoices_v2.insert_one(doc)

    for i, item in enumerate(items):
        li = {
            "item_id": gen_id("li_"), "invoice_id": inv_id,
            "fee_item_code": item.get("code", f"FEE{i+1}"),
            "fee_item_name": item.get("name", item.get("description", "")),
            "category": item.get("category", "tuition"),
            "amount": round(item.get("amount", 0), 2),
            "amount_paid": 0, "amount_outstanding": round(item.get("amount", 0), 2)
        }
        await db.invoice_line_items.insert_one(li)

    await recalc_student_balance(data.get("student_id", ""))
    await finance_audit(user["user_id"], user["name"], "create_invoice", "invoice", inv_id, after={"total": total})
    # Auto-post to Accounting
    await post_invoice_journal(
        student_name=(await db.users.find_one({"user_id": data.get("student_id", "")}, {"_id": 0, "name": 1}) or {}).get("name", ""),
        amount=total, description=f"Invoice {inv_num}", invoice_id=inv_id,
        user_id=user["user_id"], user_name=user.get("name", ""),
    )
    return {k: v for k, v in doc.items() if k != "_id"}


@router.post("/invoices/bulk-generate")
async def bulk_generate_invoices(data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    structure_id = data.get("structure_id", "")
    term = data.get("term", "Term 1")
    academic_year = data.get("academic_year", "2025-2026")

    structure = await db.fee_structures.find_one({"structure_id": structure_id}, {"_id": 0})
    if not structure:
        raise HTTPException(status_code=404, detail="Fee structure not found")

    query = {"role": "Student"}
    if structure.get("year_group"):
        query["year_group"] = structure["year_group"]
    if structure.get("boarding_status") and structure["boarding_status"] != "all":
        query["boarding_status"] = structure["boarding_status"]

    students = await db.users.find(query, {"_id": 0}).to_list(500)
    created = 0
    for student in students:
        existing = await db.invoices_v2.find_one(
            {"student_id": student["user_id"], "term": term, "academic_year": academic_year, "status": {"$ne": "cancelled"}}, {"_id": 0}
        )
        if existing:
            continue
        await create_invoice(data={
            "student_id": student["user_id"], "term": term, "academic_year": academic_year,
            "items": structure.get("items", []), "due_at": data.get("due_at", ""),
            "status": "issued"
        }, user=user)
        created += 1
    return {"message": f"Generated {created} invoices", "count": created}


@router.patch("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    before = await db.invoices_v2.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not before:
        raise HTTPException(status_code=404, detail="Invoice not found")
    safe = {k: v for k, v in data.items() if k in ("status", "due_at", "notes", "penalty_total", "discount_total")}
    if safe:
        await db.invoices_v2.update_one({"invoice_id": invoice_id}, {"$set": safe})
        if before.get("student_id"):
            await recalc_student_balance(before["student_id"])
        await finance_audit(user["user_id"], user["name"], "update_invoice", "invoice", invoice_id, before=before, after=safe)
    return {"message": "Updated"}


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(require_roles(*FINANCE_ROLES))):
    """Delete an invoice and its line items. Refunds any allocations back to unallocated payments."""
    inv = await db.invoices_v2.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")

    student_id = inv.get("student_id", "")

    # Undo allocations tied to this invoice — restore unallocated amounts on payments
    allocs = await db.allocations.find({"invoice_id": invoice_id}, {"_id": 0}).to_list(500)
    for alloc in allocs:
        pay_id = alloc.get("payment_id")
        alloc_amt = alloc.get("allocated_amount", 0)
        if pay_id and alloc_amt > 0:
            await db.payments_v2.update_one(
                {"payment_id": pay_id},
                {"$inc": {"unallocated_amount": alloc_amt}, "$set": {"status": "matched"}}
            )

    # Delete allocations, line items, and the invoice
    await db.allocations.delete_many({"invoice_id": invoice_id})
    await db.invoice_line_items.delete_many({"invoice_id": invoice_id})
    await db.invoices_v2.delete_one({"invoice_id": invoice_id})

    # Recalc student balance
    if student_id:
        await recalc_student_balance(student_id)

    await finance_audit(user["user_id"], user["name"], "delete_invoice", "invoice", invoice_id,
                        before={"total_due": inv.get("total_due", 0), "student_id": student_id})
    # Reverse in Accounting
    await reverse_finance_journal(invoice_id, user["user_id"], user.get("name", ""))
    return {"message": f"Invoice {inv.get('invoice_number', invoice_id)} deleted"}


# ─── Payments ───
@router.get("/payments")
async def list_payments(status: str = None, student_id: str = None, term: str = None, limit: int = 200, user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    if student_id:
        query["student_id"] = student_id
    # Auto-filter by active term
    if term:
        query["term"] = term
    else:
        active_term, _ = await get_active_term()
        query["term"] = active_term
    payments = await db.payments_v2.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)

    # Bulk fetch students and recorders to avoid N+1
    all_user_ids = list({p.get("student_id") for p in payments if p.get("student_id")} | {p.get("created_by") for p in payments if p.get("created_by")})
    users_list = await db.users.find({"user_id": {"$in": all_user_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(all_user_ids)) if all_user_ids else []
    user_map = {u["user_id"]: u for u in users_list}

    for p in payments:
        if p.get("student_id"):
            student = user_map.get(p["student_id"])
            p["student_name"] = student["name"] if student else ""
        else:
            p["student_name"] = p.get("payer_name", "Unknown")
        recorder = user_map.get(p.get("created_by"))
        p["recorded_by_name"] = recorder["name"] if recorder else ""
    return payments


@router.post("/payments")
async def record_payment(data: dict = Body(...), user: dict = Depends(get_current_user)):
    # Parents can submit payments only for their own children
    student_id = data.get("student_id", "")
    if user["role"] == "Parent":
        parent = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "children_ids": 1})
        if not parent or student_id not in (parent.get("children_ids") or []):
            raise HTTPException(403, "You can only submit payments for your own children")
    elif user["role"] not in FINANCE_ROLES and user["role"] not in FINANCE_VIEW_ROLES:
        raise HTTPException(403, "Insufficient permissions")
    now = datetime.now(timezone.utc).isoformat()
    pay_id = gen_id("pay_")
    student_id = data.get("student_id", "")
    amount = round(data.get("amount", 0), 2)
    student_name = ""
    if student_id:
        stu = await db.users.find_one({"user_id": student_id}, {"_id": 0, "name": 1})
        student_name = stu.get("name", "") if stu else data.get("payer_name", "")

    active_term, active_year = await get_active_term()
    doc = {
        "payment_id": pay_id, "received_at": data.get("received_at", now),
        "payment_date": data.get("payment_date", now[:10]),
        "method": data.get("method", "cash"), "bank": data.get("bank", ""),
        "amount": amount,
        "reference": data.get("reference", ""), "payer_name": student_name or data.get("payer_name", ""),
        "student_id": student_id, "student_name": student_name,
        "status": "matched" if student_id else "unmatched",
        "proof_file_id": data.get("proof_file_id", ""),
        "evidence_files": [
            {"file_id": fid, "attached_at": now, "attached_by": user["user_id"], "attached_by_name": user.get("name", "")}
            for fid in data.get("evidence_file_ids", []) if fid
        ],
        "unallocated_amount": amount,
        "term": active_term, "academic_year": active_year,
        "created_by": user["user_id"], "created_at": now
    }
    await db.payments_v2.insert_one(doc)
    await finance_audit(user["user_id"], user["name"], "record_payment", "payment", pay_id, after={"amount": amount, "method": doc["method"]})
    # Auto-post to Accounting
    await post_payment_journal(
        student_name=student_name or doc.get("payer_name", ""),
        amount=amount, method=doc["method"], payment_id=pay_id,
        user_id=user["user_id"], user_name=user.get("name", ""),
    )

    # Auto-allocate to oldest unpaid invoices if student is specified
    if student_id and amount > 0:
        invoices = await db.invoices_v2.find(
            {"student_id": student_id, "status": {"$in": ["issued", "partial", "overdue"]}},
            {"_id": 0}
        ).sort("issued_at", 1).to_list(100)

        remaining = amount
        for inv in invoices:
            if remaining <= 0:
                break
            owed = inv.get("total_due", 0) - inv.get("amount_paid", 0)
            if owed <= 0:
                continue
            alloc_amount = min(remaining, owed)
            alloc_id = gen_id("alloc_")
            await db.allocations.insert_one({
                "allocation_id": alloc_id, "payment_id": pay_id,
                "student_id": student_id, "invoice_id": inv["invoice_id"],
                "line_item_id": "", "allocated_amount": round(alloc_amount, 2),
                "allocation_type": "auto", "notes": "Auto-allocated on payment",
                "term": active_term, "academic_year": active_year,
                "allocated_by": user["user_id"], "allocated_at": now
            })
            remaining = round(remaining - alloc_amount, 2)

        new_unallocated = max(0, remaining)
        new_status = "allocated" if new_unallocated <= 0.01 else "matched"
        await db.payments_v2.update_one(
            {"payment_id": pay_id},
            {"$set": {"unallocated_amount": new_unallocated, "status": new_status}}
        )
        doc["unallocated_amount"] = new_unallocated
        doc["status"] = new_status

        # Handle overpayment -> credit
        if remaining < -0.01:
            await db.credit_notes.insert_one({
                "credit_id": gen_id("cr_"), "student_id": student_id,
                "invoice_id": "", "amount": round(abs(remaining), 2),
                "reason": "Overpayment credit", "type": "overpayment_credit",
                "created_by": user["user_id"], "created_at": now, "status": "applied"
            })

        await recalc_student_balance(student_id)

    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/payments/{payment_id}")
async def update_payment(payment_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    """Edit a payment's details (reference, method, payer_name, amount, notes)."""
    payment = await db.payments_v2.find_one({"payment_id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    allowed_fields = {"reference", "method", "bank", "payer_name", "amount", "notes", "receipt_number", "payment_date"}
    updates = {}
    for field in allowed_fields:
        if field in data:
            updates[field] = data[field]

    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    # If amount changed, recalculate unallocated
    if "amount" in updates:
        new_amount = float(updates["amount"])
        allocated = payment.get("allocated_amount", 0) or 0
        updates["unallocated_amount"] = new_amount - allocated

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updates["updated_by"] = user["user_id"]

    await db.payments_v2.update_one({"payment_id": payment_id}, {"$set": updates})
    await finance_audit(user["user_id"], user["name"], "edit_payment", "payment", payment_id, before=payment, after=updates)

    updated = await db.payments_v2.find_one({"payment_id": payment_id}, {"_id": 0})
    return updated



@router.post("/payments/{payment_id}/match-student")
async def match_student(payment_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    payment = await db.payments_v2.find_one({"payment_id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    student_id = data.get("student_id", "")
    await db.payments_v2.update_one({"payment_id": payment_id}, {"$set": {"student_id": student_id, "status": "matched"}})
    await finance_audit(user["user_id"], user["name"], "match_payment", "payment", payment_id, after={"student_id": student_id})
    return {"message": "Payment matched to student"}


@router.post("/payments/{payment_id}/allocate")
async def allocate_payment(payment_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    payment = await db.payments_v2.find_one({"payment_id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    allocations_data = data.get("allocations", [])
    total_allocating = sum(a.get("amount", 0) for a in allocations_data)
    if total_allocating > payment.get("unallocated_amount", 0) + 0.01:
        raise HTTPException(status_code=400, detail="Cannot allocate more than unallocated payment amount")

    now = datetime.now(timezone.utc).isoformat()
    student_id = payment.get("student_id") or data.get("student_id", "")

    for alloc in allocations_data:
        alloc_id = gen_id("alloc_")
        doc = {
            "allocation_id": alloc_id, "payment_id": payment_id,
            "student_id": student_id,
            "invoice_id": alloc.get("invoice_id", ""),
            "line_item_id": alloc.get("line_item_id", ""),
            "allocated_amount": round(alloc.get("amount", 0), 2),
            "allocation_type": alloc.get("type", "invoice_level"),
            "notes": alloc.get("notes", ""),
            "allocated_by": user["user_id"], "allocated_at": now
        }
        await db.allocations.insert_one(doc)

    new_unallocated = round(payment.get("unallocated_amount", 0) - total_allocating, 2)
    new_status = "allocated" if new_unallocated <= 0.01 else "matched"
    await db.payments_v2.update_one(
        {"payment_id": payment_id},
        {"$set": {"unallocated_amount": max(0, new_unallocated), "status": new_status, "student_id": student_id}}
    )

    # Handle overpayment -> credit
    if new_unallocated < -0.01:
        await db.credit_notes.insert_one({
            "credit_id": gen_id("cr_"), "student_id": student_id,
            "invoice_id": "", "amount": round(abs(new_unallocated), 2),
            "reason": "Overpayment credit", "type": "overpayment_credit",
            "created_by": user["user_id"], "created_at": now, "status": "applied"
        })

    await recalc_student_balance(student_id)
    await finance_audit(user["user_id"], user["name"], "allocate_payment", "allocation", payment_id, after={"total_allocated": total_allocating, "allocations": len(allocations_data)})
    return {"message": f"Allocated TT$ {total_allocating}", "unallocated": max(0, new_unallocated)}


@router.post("/payments/{payment_id}/auto-allocate")
async def auto_allocate(payment_id: str, user: dict = Depends(require_roles(*FINANCE_ROLES))):
    """Auto-allocate payment to oldest invoices first."""
    payment = await db.payments_v2.find_one({"payment_id": payment_id}, {"_id": 0})
    if not payment or not payment.get("student_id"):
        raise HTTPException(status_code=400, detail="Payment must be matched to a student first")

    remaining = payment.get("unallocated_amount", 0)
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="No unallocated amount")

    invoices = await db.invoices_v2.find(
        {"student_id": payment["student_id"], "status": {"$in": ["issued", "partial", "overdue"]}}, {"_id": 0}
    ).sort("issued_at", 1).to_list(100)

    allocs = []
    for inv in invoices:
        if remaining <= 0:
            break
        outstanding = inv["total_due"] - inv.get("amount_paid", 0)
        if outstanding <= 0:
            continue
        amount = min(remaining, outstanding)
        allocs.append({"invoice_id": inv["invoice_id"], "amount": amount, "type": "invoice_level"})
        remaining -= amount

    if allocs:
        return await allocate_payment(payment_id, data={"allocations": allocs}, user=user)
    return {"message": "No outstanding invoices to allocate to"}


@router.post("/payments/{payment_id}/reverse")
async def reverse_payment(payment_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    payment = await db.payments_v2.find_one({"payment_id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    await db.allocations.delete_many({"payment_id": payment_id})
    await db.payments_v2.update_one(
        {"payment_id": payment_id},
        {"$set": {"status": "reversed", "unallocated_amount": 0}}
    )
    if payment.get("student_id"):
        await recalc_student_balance(payment["student_id"])
    await finance_audit(user["user_id"], user["name"], "reverse_payment", "payment", payment_id, reason=data.get("reason", ""))
    # Reverse in Accounting
    await reverse_finance_journal(payment_id, user["user_id"], user.get("name", ""))
    return {"message": "Payment reversed"}



@router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, user: dict = Depends(require_roles(*FINANCE_ROLES))):
    """Permanently delete a payment record, undo allocations, recalc balances."""
    payment = await db.payments_v2.find_one({"payment_id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    student_id = payment.get("student_id", "")

    # Undo allocations — restore unallocated amounts on invoices
    allocs = await db.allocations.find({"payment_id": payment_id}, {"_id": 0}).to_list(500)
    for alloc in allocs:
        inv_id = alloc.get("invoice_id")
        alloc_amt = alloc.get("allocated_amount", 0)
        if inv_id and alloc_amt > 0:
            inv = await db.invoices_v2.find_one({"invoice_id": inv_id}, {"_id": 0})
            if inv:
                new_paid = max(0, (inv.get("amount_paid", 0) or 0) - alloc_amt)
                new_status = "issued" if new_paid == 0 else "partial"
                await db.invoices_v2.update_one(
                    {"invoice_id": inv_id},
                    {"$set": {"amount_paid": new_paid, "status": new_status}}
                )

    await db.allocations.delete_many({"payment_id": payment_id})
    await db.payments_v2.delete_one({"payment_id": payment_id})

    if student_id:
        await recalc_student_balance(student_id)

    await finance_audit(user["user_id"], user["name"], "delete_payment", "payment", payment_id,
                        before={"amount": payment.get("amount", 0), "student_id": student_id})
    await reverse_finance_journal(payment_id, user["user_id"], user.get("name", ""))
    return {"message": f"Payment {payment.get('receipt_number', payment_id)} deleted"}



@router.post("/payments/import-csv")
async def import_bank_csv(file: UploadFile = File(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode('utf-8')))
    imported = 0
    for row in reader:
        amount = float(row.get("amount", row.get("Amount", 0)))
        if amount <= 0:
            continue
        doc = {
            "payment_id": gen_id("pay_"), "received_at": row.get("date", row.get("Date", datetime.now(timezone.utc).isoformat())),
            "method": "bank_transfer", "amount": round(amount, 2),
            "reference": row.get("reference", row.get("Reference", "")),
            "payer_name": row.get("payer", row.get("Payer", row.get("description", ""))),
            "student_id": "", "status": "unmatched", "proof_file_id": "",
            "unallocated_amount": round(amount, 2),
            "created_by": user["user_id"], "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payments_v2.insert_one(doc)
        imported += 1
    await finance_audit(user["user_id"], user["name"], "import_csv", "payment", "", after={"count": imported})
    return {"message": f"Imported {imported} payments", "count": imported}


@router.post("/payments/{payment_id}/attach-evidence")
async def attach_evidence(payment_id: str, data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Attach proof file (bank slip, MoMo screenshot) to a payment."""
    payment = await db.payments_v2.find_one({"payment_id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(404, "Payment not found")
    file_id = data.get("file_id", "")
    if not file_id:
        raise HTTPException(400, "file_id required")

    # Verify file exists
    file_doc = await db.file_assets.find_one({"file_id": file_id}, {"_id": 0})
    if not file_doc:
        raise HTTPException(404, "File not found")

    now = datetime.now(timezone.utc).isoformat()

    # Support multiple evidence files
    evidence_files = payment.get("evidence_files", [])
    if payment.get("proof_file_id") and payment["proof_file_id"] not in [e.get("file_id") for e in evidence_files]:
        evidence_files.append({"file_id": payment["proof_file_id"], "attached_at": payment.get("created_at", now), "attached_by": payment.get("created_by", "")})

    evidence_files.append({
        "file_id": file_id,
        "filename": file_doc.get("original_filename", ""),
        "content_type": file_doc.get("content_type", ""),
        "attached_at": now,
        "attached_by": user["user_id"],
        "attached_by_name": user.get("name", ""),
    })

    await db.payments_v2.update_one(
        {"payment_id": payment_id},
        {"$set": {
            "proof_file_id": file_id,
            "evidence_files": evidence_files,
            "evidence_status": "provided",
            "evidence_updated_at": now,
        }}
    )

    await finance_audit(user["user_id"], user["name"], "attach_evidence", "payment", payment_id, after={"file_id": file_id})
    return {"message": "Evidence attached", "evidence_count": len(evidence_files)}


@router.post("/payments/{payment_id}/request-evidence")
async def request_evidence(payment_id: str, data: dict = Body(default={}), user: dict = Depends(get_current_user)):
    """Request evidence for a payment — sends alert to finance officers."""
    payment = await db.payments_v2.find_one({"payment_id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(404, "Payment not found")

    now = datetime.now(timezone.utc).isoformat()
    reason = data.get("reason", "Payment evidence required for verification")

    await db.payments_v2.update_one(
        {"payment_id": payment_id},
        {"$set": {
            "evidence_status": "requested",
            "evidence_requested_at": now,
            "evidence_requested_by": user["user_id"],
            "evidence_requested_by_name": user.get("name", ""),
            "evidence_request_reason": reason,
        }}
    )

    # Notify all finance officers
    finance_users = await db.users.find(
        {"role": {"$in": ["FinanceOfficer", "SuperAdmin", "CEO"]}},
        {"_id": 0, "user_id": 1, "name": 1}
    ).to_list(50)

    for fu in finance_users:
        await db.notifications.insert_one({
            "notif_id": gen_id("notif_"),
            "user_id": fu["user_id"],
            "type": "finance",
            "title": "Evidence Requested",
            "message": f"{user.get('name', '')} requested evidence for payment {payment_id} (TT$ {payment.get('amount', 0):,.2f}). Reason: {reason}",
            "action_url": "/admin/finance",
            "is_read": False,
            "created_at": now,
        })

    await finance_audit(user["user_id"], user["name"], "request_evidence", "payment", payment_id, after={"reason": reason})
    return {"message": "Evidence request sent to finance team"}


@router.get("/payments/{payment_id}/evidence")
async def get_payment_evidence(payment_id: str, user: dict = Depends(get_current_user)):
    """Get all evidence files for a payment."""
    payment = await db.payments_v2.find_one({"payment_id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(404, "Payment not found")

    evidence_files = payment.get("evidence_files", [])
    # Include legacy proof_file_id if present and not already in list
    if payment.get("proof_file_id") and not evidence_files:
        file_doc = await db.file_assets.find_one({"file_id": payment["proof_file_id"]}, {"_id": 0})
        if file_doc:
            evidence_files = [{
                "file_id": payment["proof_file_id"],
                "filename": file_doc.get("original_filename", ""),
                "content_type": file_doc.get("content_type", ""),
                "attached_at": payment.get("created_at", ""),
            }]

    return {
        "payment_id": payment_id,
        "evidence_files": evidence_files,
        "evidence_status": payment.get("evidence_status", "none"),
        "evidence_requested_at": payment.get("evidence_requested_at"),
        "evidence_requested_by_name": payment.get("evidence_requested_by_name"),
        "evidence_request_reason": payment.get("evidence_request_reason"),
    }


# ─── Allocations ───
@router.get("/allocations")
async def list_allocations(student_id: str = None, invoice_id: str = None, payment_id: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if student_id:
        query["student_id"] = student_id
    if invoice_id:
        query["invoice_id"] = invoice_id
    if payment_id:
        query["payment_id"] = payment_id
    allocs = await db.allocations.find(query, {"_id": 0}).sort("allocated_at", -1).to_list(500)

    # Bulk fetch allocators to avoid N+1
    allocator_ids = list({a.get("allocated_by") for a in allocs if a.get("allocated_by")})
    allocators_list = await db.users.find({"user_id": {"$in": allocator_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(allocator_ids)) if allocator_ids else []
    allocator_map = {u["user_id"]: u for u in allocators_list}

    for a in allocs:
        allocator = allocator_map.get(a.get("allocated_by"))
        a["allocated_by_name"] = allocator["name"] if allocator else ""
    return allocs


# ─── Credit Notes ───
@router.get("/credit-notes")
async def list_credit_notes(student_id: str = None, status: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if student_id:
        query["student_id"] = student_id
    if status:
        query["status"] = status
    notes = await db.credit_notes.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)

    # Bulk fetch students to avoid N+1
    note_student_ids = list({n.get("student_id") for n in notes if n.get("student_id")})
    note_students = await db.users.find({"user_id": {"$in": note_student_ids}}, {"_id": 0, "user_id": 1, "name": 1}).to_list(len(note_student_ids)) if note_student_ids else []
    note_student_map = {s["user_id"]: s for s in note_students}

    for n in notes:
        student = note_student_map.get(n.get("student_id"))
        n["student_name"] = student["name"] if student else ""
    return notes


@router.post("/credit-notes")
async def create_credit_note(data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    doc = {
        "credit_id": gen_id("cr_"), "student_id": data.get("student_id", ""),
        "invoice_id": data.get("invoice_id", ""), "amount": round(data.get("amount", 0), 2),
        "reason": data.get("reason", ""), "type": data.get("type", "discount"),
        "created_by": user["user_id"], "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending"
    }
    await db.credit_notes.insert_one(doc)
    await finance_audit(user["user_id"], user["name"], "create_credit_note", "credit_note", doc["credit_id"], after={"amount": doc["amount"], "type": doc["type"]})
    return {k: v for k, v in doc.items() if k != "_id"}


@router.post("/credit-notes/{credit_id}/approve")
async def approve_credit(credit_id: str, user: dict = Depends(require_roles(*FINANCE_ROLES))):
    await db.credit_notes.update_one({"credit_id": credit_id}, {"$set": {"status": "approved"}})
    await finance_audit(user["user_id"], user["name"], "approve_credit", "credit_note", credit_id)
    return {"message": "Credit note approved"}


@router.post("/credit-notes/{credit_id}/apply")
async def apply_credit(credit_id: str, user: dict = Depends(require_roles(*FINANCE_ROLES))):
    credit = await db.credit_notes.find_one({"credit_id": credit_id}, {"_id": 0})
    if not credit:
        raise HTTPException(status_code=404, detail="Not found")
    await db.credit_notes.update_one({"credit_id": credit_id}, {"$set": {"status": "applied"}})
    if credit.get("student_id"):
        await recalc_student_balance(credit["student_id"])
    await finance_audit(user["user_id"], user["name"], "apply_credit", "credit_note", credit_id)
    return {"message": "Credit applied"}


@router.post("/credit-notes/{credit_id}/reverse")
async def reverse_credit(credit_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    credit = await db.credit_notes.find_one({"credit_id": credit_id}, {"_id": 0})
    if not credit:
        raise HTTPException(status_code=404, detail="Not found")
    await db.credit_notes.update_one({"credit_id": credit_id}, {"$set": {"status": "reversed"}})
    if credit.get("student_id"):
        await recalc_student_balance(credit["student_id"])
    await finance_audit(user["user_id"], user["name"], "reverse_credit", "credit_note", credit_id, reason=data.get("reason", ""))
    return {"message": "Credit reversed"}


# ─── Student Accounts ───
@router.get("/students/{student_id}/account")
async def get_student_account(student_id: str, user: dict = Depends(get_current_user)):
    account = await db.student_accounts.find_one({"student_id": student_id}, {"_id": 0})
    if not account:
        await recalc_student_balance(student_id)
        account = await db.student_accounts.find_one({"student_id": student_id}, {"_id": 0})
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0, "password_hash": 0})
    invoices = await db.invoices_v2.find({"student_id": student_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    payments = await db.payments_v2.find({"student_id": student_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    allocs = await db.allocations.find({"student_id": student_id}, {"_id": 0}).to_list(500)
    credits = await db.credit_notes.find({"student_id": student_id}, {"_id": 0}).to_list(100)
    audit = await db.finance_audit.find(
        {"$or": [{"entity_id": student_id}, {"entity_id": {"$in": [i["invoice_id"] for i in invoices]}}]}, {"_id": 0}
    ).sort("timestamp", -1).to_list(50)

    return {
        "student": student, "account": account or {},
        "invoices": invoices, "payments": payments,
        "allocations": allocs, "credits": credits, "audit": audit
    }


@router.get("/students/{student_id}/statement")
async def get_statement(student_id: str, term: str = None, user: dict = Depends(get_current_user)):
    query = {"student_id": student_id}
    if term:
        query["term"] = term
    invoices = await db.invoices_v2.find(query, {"_id": 0}).sort("created_at", 1).to_list(100)
    payments = await db.payments_v2.find({"student_id": student_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0, "name": 1})
    account = await db.student_accounts.find_one({"student_id": student_id}, {"_id": 0})

    entries = []
    for inv in invoices:
        entries.append({"date": inv["issued_at"], "type": "invoice", "description": f"Invoice {inv['invoice_number']} - {inv['term']}", "debit": inv["total_due"], "credit": 0})
    for pay in payments:
        entries.append({"date": pay["created_at"], "type": "payment", "description": f"Payment ({pay['method']}) Ref: {pay.get('reference', '')}", "debit": 0, "credit": pay["amount"]})
    entries.sort(key=lambda x: x["date"])

    running = 0
    for e in entries:
        running += e["debit"] - e["credit"]
        e["balance"] = round(running, 2)

    return {
        "student_name": student["name"] if student else "",
        "account": account or {}, "entries": entries,
        "total_debit": sum(e["debit"] for e in entries),
        "total_credit": sum(e["credit"] for e in entries),
        "closing_balance": round(running, 2)
    }


# ─── Reports ───
@router.get("/reports/arrears-ageing")
async def arrears_ageing(user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    accounts = await db.student_accounts.find({"arrears_balance": {"$gt": 0}}, {"_id": 0}).to_list(500)
    result = []
    for acc in accounts:
        student = await db.users.find_one({"user_id": acc["student_id"]}, {"_id": 0, "name": 1, "class_id": 1, "year_group": 1})
        if not student:
            continue
        cls = await db.classes.find_one({"class_id": student.get("class_id")}, {"_id": 0, "name": 1}) if student.get("class_id") else None
        oldest_inv = await db.invoices_v2.find_one(
            {"student_id": acc["student_id"], "status": {"$in": ["issued", "partial", "overdue"]}},
            {"_id": 0, "issued_at": 1}
        )
        days = 0
        if oldest_inv and oldest_inv.get("issued_at"):
            issued = datetime.fromisoformat(oldest_inv["issued_at"].replace("Z", "+00:00")) if isinstance(oldest_inv["issued_at"], str) else oldest_inv["issued_at"]
            if issued.tzinfo is None:
                issued = issued.replace(tzinfo=timezone.utc)
            days = (datetime.now(timezone.utc) - issued).days

        bucket = "0-30" if days <= 30 else "31-60" if days <= 60 else "61-90" if days <= 90 else "90+"
        result.append({
            "student_id": acc["student_id"], "student_name": student["name"],
            "class_name": cls["name"] if cls else "", "year_group": student.get("year_group", ""),
            "arrears": acc["arrears_balance"], "days_outstanding": days, "bucket": bucket
        })
    result.sort(key=lambda x: -x["arrears"])
    return result


@router.get("/reports/collections")
async def collections_report(term: str = None, user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    inv_query = {"status": {"$ne": "cancelled"}}
    if term:
        inv_query["term"] = term
    invoices = await db.invoices_v2.find(inv_query, {"_id": 0}).to_list(1000)
    total_invoiced = sum(i.get("total_due", 0) for i in invoices)
    total_paid = sum(i.get("amount_paid", 0) for i in invoices)
    total_outstanding = total_invoiced - total_paid

    by_status = {}
    for inv in invoices:
        s = inv.get("status", "unknown")
        by_status[s] = by_status.get(s, 0) + 1

    payments = await db.payments_v2.find({"status": {"$ne": "reversed"}}, {"_id": 0}).to_list(1000)
    by_method = {}
    for p in payments:
        m = p.get("method", "other")
        by_method[m] = by_method.get(m, 0) + p.get("amount", 0)

    return {
        "total_invoiced": round(total_invoiced, 2), "total_collected": round(total_paid, 2),
        "total_outstanding": round(total_outstanding, 2),
        "collection_rate": round(total_paid / total_invoiced * 100, 1) if total_invoiced else 0,
        "invoice_counts": by_status, "by_payment_method": {k: round(v, 2) for k, v in by_method.items()},
        "total_invoices": len(invoices), "total_payments": len(payments)
    }


@router.get("/reports/debtors")
async def debtors_list(user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    accounts = await db.student_accounts.find({"arrears_balance": {"$gt": 0}}, {"_id": 0}).sort("arrears_balance", -1).to_list(200)
    result = []
    for acc in accounts:
        student = await db.users.find_one({"user_id": acc["student_id"]}, {"_id": 0, "name": 1, "year_group": 1})
        if student:
            result.append({"student_id": acc["student_id"], "name": student["name"], "year_group": student.get("year_group", ""), "arrears": acc["arrears_balance"], "total_invoiced": acc.get("total_invoiced", 0), "total_paid": acc.get("total_paid", 0)})
    return result


@router.get("/reports/income-expense")
async def income_expense_report(period: str = "month", user: dict = Depends(get_current_user)):
    """Income vs Expense breakdown for a given period."""
    now = datetime.now(timezone.utc)
    if period == "month":
        start = now.replace(day=1).strftime("%Y-%m-%d")
    elif period == "term":
        from datetime import timedelta
        start = (now - timedelta(days=120)).strftime("%Y-%m-%d")
    else:
        start = f"{now.year}-01-01"

    payments = await db.payments_v2.find(
        {"status": {"$ne": "reversed"}, "created_at": {"$gte": start}}, {"_id": 0}
    ).to_list(5000)
    total_income = sum(p.get("amount", 0) for p in payments)
    by_method = {}
    for p in payments:
        m = p.get("method", "other")
        by_method[m] = by_method.get(m, 0) + p.get("amount", 0)
    income_by_method = [{"method": k, "total": round(v, 2)} for k, v in by_method.items()]

    total_expenses = 0
    by_category = {}
    expense_entries = await db.journal_entries.find({"entry_date": {"$gte": start}}, {"_id": 0}).to_list(5000)
    for entry in expense_entries:
        for line in entry.get("lines", []):
            if line.get("account_type") == "expense" and line.get("debit", 0) > 0:
                total_expenses += line["debit"]
                cat = line.get("account_name", "Other")
                by_category[cat] = by_category.get(cat, 0) + line["debit"]
    expenses_by_category = [{"category": k, "total": round(v, 2)} for k, v in by_category.items()]

    return {
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "net_position": round(total_income - total_expenses, 2),
        "income_by_method": income_by_method,
        "expenses_by_category": expenses_by_category,
        "period": period,
    }


@router.get("/reports/financial-summary")
async def financial_summary(user: dict = Depends(get_current_user)):
    """Overall financial health summary."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).strftime("%Y-%m-%d")

    all_invoices = await db.invoices_v2.find({"status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(10000)
    all_payments = await db.payments_v2.find({"status": {"$ne": "reversed"}}, {"_id": 0}).to_list(10000)
    all_time_invoiced = sum(i.get("total_due", 0) for i in all_invoices)
    all_time_collected = sum(p.get("amount", 0) for p in all_payments)
    month_payments = [p for p in all_payments if (p.get("created_at") or "")[:10] >= month_start]
    month_income = sum(p.get("amount", 0) for p in month_payments)

    all_time_expenses = 0
    month_expenses = 0
    all_entries = await db.journal_entries.find({}, {"_id": 0, "lines": 1, "entry_date": 1}).to_list(10000)
    for entry in all_entries:
        for line in entry.get("lines", []):
            if line.get("account_type") == "expense" and line.get("debit", 0) > 0:
                all_time_expenses += line["debit"]
                if (entry.get("entry_date") or "") >= month_start:
                    month_expenses += line["debit"]

    staff_count = await db.users.count_documents({"role": {"$nin": ["Student"]}})
    return {
        "all_time_invoiced": round(all_time_invoiced, 2),
        "all_time_collected": round(all_time_collected, 2),
        "all_time_expenses": round(all_time_expenses, 2),
        "month_income": round(month_income, 2),
        "month_expenses": round(month_expenses, 2),
        "monthly_payroll": 0,
        "petty_cash_balance": 0,
        "total_staff_on_payroll": staff_count,
    }


@router.get("/reports/department-summary")
async def department_summary(user: dict = Depends(get_current_user)):
    """Staff grouped by department with basic financial info."""
    staff = await db.users.find(
        {"role": {"$nin": ["Student"]}, "is_active": {"$ne": False}},
        {"_id": 0, "department": 1}
    ).to_list(500)
    departments = {}
    for s in staff:
        dept = s.get("department") or "General"
        if dept not in departments:
            departments[dept] = {"department": dept, "staff_count": 0, "expenses": 0, "budget_allocated": 0, "budget_spent": 0, "payroll_monthly": 0}
        departments[dept]["staff_count"] += 1
    return list(departments.values())


@router.get("/reports/pdf/{report_type}")
async def generate_report_pdf(report_type: str, request: Request, token: str = Query(None), period: str = Query("month")):
    """Generate PDF for any finance report type."""
    from fastapi.responses import Response
    import jwt as pyjwt

    auth_header = request.headers.get("authorization", "")
    raw_token = token
    if auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ", 1)[1]
    if raw_token:
        try:
            payload = pyjwt.decode(raw_token, os.environ.get("JWT_SECRET", "tcis-secret-key-change-in-production"), algorithms=["HS256"])
            user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        except Exception:
            raise HTTPException(401, "Invalid token")
    else:
        raise HTTPException(401, "Not authenticated")
    if not user:
        raise HTTPException(401, "Not authenticated")

    try:
        from weasyprint import HTML
    except ImportError:
        raise HTTPException(500, "PDF generation requires weasyprint")

    now = datetime.now(timezone.utc)
    generated = now.strftime("%d %B %Y, %H:%M UTC")

    import base64 as b64
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'main_logo.png')
    logo_b64 = ""
    if os.path.exists(logo_path):
        with open(logo_path, "rb") as f:
            logo_b64 = b64.b64encode(f.read()).decode()
    logo_html = f'<img src="data:image/png;base64,{logo_b64}" style="width:120px" />' if logo_b64 else ""

    base_style = """
        @page { size: A4; margin: 1.5cm; }
        body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #1B2A4A; }
        .header { text-align: center; margin-bottom: 20px; }
        .header img { margin-bottom: 8px; }
        .header h1 { font-size: 18pt; margin: 4px 0; }
        .header p { font-size: 9pt; color: #666; margin: 2px 0; }
        .cards { display: flex; gap: 12px; margin-bottom: 20px; }
        .card { background: #f5f7fb; border-radius: 6px; padding: 12px 16px; flex: 1; text-align: center; }
        .card .label { font-size: 8pt; color: #888; text-transform: uppercase; }
        .card .value { font-size: 16pt; font-weight: bold; }
        .green { color: #16A34A; } .red { color: #DC2626; } .blue { color: #2E6CC4; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { background: #1B2A4A; color: white; padding: 8px; text-align: left; font-size: 9pt; }
        th.num { text-align: right; }
        td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 9pt; }
        td.num { text-align: right; font-family: monospace; }
        .section-title { font-size: 12pt; font-weight: bold; color: #1B2A4A; margin: 18px 0 8px 0; border-bottom: 2px solid #2E6CC4; padding-bottom: 4px; }
        .total-row td { font-weight: bold; border-top: 2px solid #1B2A4A; background: #f5f7fb; }
        .footer { text-align: center; font-size: 7pt; color: #aaa; margin-top: 20px; }
    """

    if report_type == "overview":
        all_invoices = await db.invoices_v2.find({"status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(10000)
        all_payments = await db.payments_v2.find({"status": {"$ne": "reversed"}}, {"_id": 0}).to_list(10000)
        total_inv = sum(i.get("total_due", 0) for i in all_invoices)
        total_col = sum(p.get("amount", 0) for p in all_payments)
        total_out = total_inv - total_col
        rate = round(total_col / total_inv * 100, 1) if total_inv > 0 else 0

        students = await db.users.find({"role": "Student"}, {"_id": 0, "user_id": 1, "name": 1, "year_group": 1}).to_list(2000)
        inv_by_student = {}
        for inv in all_invoices:
            sid = inv.get("student_id")
            if sid not in inv_by_student:
                inv_by_student[sid] = {"invoiced": 0, "paid": 0}
            inv_by_student[sid]["invoiced"] += inv.get("total_due", 0)
            inv_by_student[sid]["paid"] += inv.get("amount_paid", 0)

        rows = ""
        for i, s in enumerate(sorted(students, key=lambda x: inv_by_student.get(x["user_id"], {}).get("invoiced", 0) - inv_by_student.get(x["user_id"], {}).get("paid", 0), reverse=True)):
            sid = s["user_id"]
            data = inv_by_student.get(sid, {"invoiced": 0, "paid": 0})
            out = data["invoiced"] - data["paid"]
            status = "Fully Paid" if out <= 0 and data["invoiced"] > 0 else "Partial" if data["paid"] > 0 else "Unpaid" if data["invoiced"] > 0 else "No Invoice"
            sc = "green" if status == "Fully Paid" else "red" if "Unpaid" in status else "blue"
            rows += f'<tr><td>{i+1}</td><td>{s.get("name","")}</td><td>{s.get("year_group","")}</td><td class="num">TT$ {data["invoiced"]:,.2f}</td><td class="num">TT$ {data["paid"]:,.2f}</td><td class="num {"red" if out > 0 else ""}">TT$ {out:,.2f}</td><td class="{sc}">{status}</td></tr>'

        body = f"""
        <div class="cards">
            <div class="card"><div class="label">Total Invoiced</div><div class="value blue">TT$ {total_inv:,.2f}</div></div>
            <div class="card"><div class="label">Collected</div><div class="value green">TT$ {total_col:,.2f}</div></div>
            <div class="card"><div class="label">Outstanding</div><div class="value red">TT$ {total_out:,.2f}</div></div>
            <div class="card"><div class="label">Collection Rate</div><div class="value blue">{rate}%</div></div>
        </div>
        <table><thead><tr><th>#</th><th>Student</th><th>Year</th><th class="num">Invoiced</th><th class="num">Paid</th><th class="num">Outstanding</th><th>Status</th></tr></thead><tbody>{rows}</tbody></table>
        """
        title = "Financial Overview Report"

    elif report_type == "income-expense":
        month_start = now.replace(day=1).strftime("%Y-%m-%d")
        if period == "term":
            from datetime import timedelta
            start = (now - timedelta(days=120)).strftime("%Y-%m-%d")
        elif period == "year":
            start = f"{now.year}-01-01"
        else:
            start = month_start

        payments = await db.payments_v2.find({"status": {"$ne": "reversed"}, "created_at": {"$gte": start}}, {"_id": 0}).to_list(5000)
        total_income = sum(p.get("amount", 0) for p in payments)
        by_method = {}
        for p in payments:
            m = p.get("method", "other")
            by_method[m] = by_method.get(m, 0) + p.get("amount", 0)

        total_expenses = 0
        by_cat = {}
        entries = await db.journal_entries.find({"entry_date": {"$gte": start}}, {"_id": 0}).to_list(5000)
        for entry in entries:
            for line in entry.get("lines", []):
                if line.get("account_type") == "expense" and line.get("debit", 0) > 0:
                    total_expenses += line["debit"]
                    cat = line.get("account_name", "Other")
                    by_cat[cat] = by_cat.get(cat, 0) + line["debit"]

        inc_rows = "".join(f'<tr><td>{m}</td><td class="num">TT$ {t:,.2f}</td></tr>' for m, t in by_method.items())
        exp_rows = "".join(f'<tr><td>{c}</td><td class="num">TT$ {t:,.2f}</td></tr>' for c, t in by_cat.items())

        body = f"""
        <div class="cards">
            <div class="card"><div class="label">Total Income</div><div class="value green">TT$ {total_income:,.2f}</div></div>
            <div class="card"><div class="label">Total Expenses</div><div class="value red">TT$ {total_expenses:,.2f}</div></div>
            <div class="card"><div class="label">Net Position</div><div class="value {'green' if total_income >= total_expenses else 'red'}">TT$ {total_income - total_expenses:,.2f}</div></div>
        </div>
        <div class="section-title">Income by Payment Method</div>
        <table><thead><tr><th>Method</th><th class="num">Amount</th></tr></thead><tbody>{inc_rows if inc_rows else '<tr><td colspan="2" style="text-align:center;color:#999">No income data</td></tr>'}</tbody>
        <tfoot><tr class="total-row"><td>Total Income</td><td class="num">TT$ {total_income:,.2f}</td></tr></tfoot></table>
        <div class="section-title">Expenses by Category</div>
        <table><thead><tr><th>Category</th><th class="num">Amount</th></tr></thead><tbody>{exp_rows if exp_rows else '<tr><td colspan="2" style="text-align:center;color:#999">No expense data</td></tr>'}</tbody>
        <tfoot><tr class="total-row"><td>Total Expenses</td><td class="num">TT$ {total_expenses:,.2f}</td></tr></tfoot></table>
        """
        title = f"Income & Expense Report ({period.title()})"

    elif report_type == "department":
        staff = await db.users.find({"role": {"$nin": ["Student"]}, "is_active": {"$ne": False}}, {"_id": 0, "department": 1, "name": 1, "role": 1}).to_list(500)
        depts = {}
        for s in staff:
            d = s.get("department") or "General"
            if d not in depts:
                depts[d] = []
            depts[d].append(s)

        rows = ""
        for dept, members in sorted(depts.items()):
            rows += f'<tr style="background:#f0f4fa;"><td colspan="3"><strong>{dept}</strong> — {len(members)} staff</td></tr>'
            for m in members:
                rows += f'<tr><td style="padding-left:20px">{m.get("name","")}</td><td>{m.get("role","")}</td><td></td></tr>'

        body = f"""
        <div class="cards"><div class="card"><div class="label">Total Staff</div><div class="value blue">{len(staff)}</div></div><div class="card"><div class="label">Departments</div><div class="value">{len(depts)}</div></div></div>
        <table><thead><tr><th>Name</th><th>Role</th><th>Notes</th></tr></thead><tbody>{rows}</tbody></table>
        """
        title = "Department Summary Report"

    elif report_type == "outstanding":
        students = await db.users.find({"role": "Student"}, {"_id": 0, "user_id": 1, "name": 1, "year_group": 1}).to_list(2000)
        invoices = await db.invoices_v2.find({"status": {"$ne": "cancelled"}}, {"_id": 0}).to_list(10000)
        inv_by_student = {}
        for inv in invoices:
            sid = inv.get("student_id")
            if sid not in inv_by_student:
                inv_by_student[sid] = {"invoiced": 0, "paid": 0}
            inv_by_student[sid]["invoiced"] += inv.get("total_due", 0)
            inv_by_student[sid]["paid"] += inv.get("amount_paid", 0)

        owing = []
        for s in students:
            data = inv_by_student.get(s["user_id"], {"invoiced": 0, "paid": 0})
            out = data["invoiced"] - data["paid"]
            if out > 0:
                owing.append({**s, **data, "outstanding": out})
        owing.sort(key=lambda x: x["outstanding"], reverse=True)

        total_out = sum(o["outstanding"] for o in owing)
        rows = "".join(f'<tr><td>{i+1}</td><td>{o.get("name","")}</td><td>{o.get("year_group","")}</td><td class="num">TT$ {o["invoiced"]:,.2f}</td><td class="num">TT$ {o["paid"]:,.2f}</td><td class="num red" style="font-weight:bold">TT$ {o["outstanding"]:,.2f}</td></tr>' for i, o in enumerate(owing))

        body = f"""
        <div class="cards"><div class="card"><div class="label">Students Owing</div><div class="value red">{len(owing)}</div></div><div class="card"><div class="label">Total Outstanding</div><div class="value red">TT$ {total_out:,.2f}</div></div></div>
        <table><thead><tr><th>#</th><th>Student</th><th>Year</th><th class="num">Invoiced</th><th class="num">Paid</th><th class="num">Outstanding</th></tr></thead><tbody>{rows}</tbody>
        <tfoot><tr class="total-row"><td colspan="5">Total Outstanding</td><td class="num">TT$ {total_out:,.2f}</td></tr></tfoot></table>
        """
        title = "Outstanding Fees Report"

    else:
        raise HTTPException(400, f"Unknown report type: {report_type}")

    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{base_style}</style></head><body>
    <div class="header">{logo_html}<h1>TCIS - {title}</h1><p>Generated: {generated}</p></div>
    {body}
    <div class="footer">RightWay Workstation | Confidential Finance Report</div>
    </body></html>"""

    pdf_bytes = HTML(string=html).write_pdf()
    fname = f"TCIS_{report_type.replace('-','_').title()}_{now.strftime('%Y%m%d')}.pdf"
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{fname}"'})



# ─── Finance Dashboard ───
@router.get("/dashboard")
async def finance_dashboard(user: dict = Depends(get_current_user)):
    active_term, _ = await get_active_term()
    term_filter = {"term": active_term, "status": {"$ne": "cancelled"}}
    inv_count = await db.invoices_v2.count_documents(term_filter)
    if inv_count == 0:
        return {
            "total_invoiced": 0, "total_collected": 0,
            "total_outstanding": 0,
            "invoice_counts": {"pending": 0, "partial": 0, "paid": 0},
            "recent_payments": [], "unmatched_payments": 0,
            "collection_rate": 0, "active_term": active_term
        }

    invoices = await db.invoices_v2.find(term_filter, {"_id": 0}).to_list(1000)
    total_invoiced = sum(i.get("total_due", 0) for i in invoices)
    total_collected = sum(i.get("amount_paid", 0) for i in invoices)
    total_outstanding = total_invoiced - total_collected
    by_status = {}
    for i in invoices:
        s = i.get("status", "unknown")
        by_status[s] = by_status.get(s, 0) + 1

    unmatched = await db.payments_v2.count_documents({"status": "unmatched", "term": active_term})
    recent = await db.payments_v2.find({"term": active_term}, {"_id": 0}).sort("created_at", -1).to_list(10)
    for p in recent:
        student = await db.users.find_one({"user_id": p.get("student_id")}, {"_id": 0, "name": 1})
        p["student_name"] = student["name"] if student else p.get("payer_name", "")

    return {
        "total_invoiced": round(total_invoiced, 2), "total_collected": round(total_collected, 2),
        "total_outstanding": round(total_outstanding, 2),
        "invoice_counts": by_status, "recent_payments": recent,
        "unmatched_payments": unmatched,
        "collection_rate": round(total_collected / total_invoiced * 100, 1) if total_invoiced else 0,
        "active_term": active_term
    }


# ─── Finance Audit Trail ───
@router.get("/audit-trail")
async def get_finance_audit(entity_type: str = None, limit: int = 100, user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    logs = await db.finance_audit.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs


# ─── Student Finance Profiles (All Students) ───
@router.get("/student-ledger")
async def student_ledger(year_group: str = None, user: dict = Depends(get_current_user)):
    """Get all students with their financial summary."""
    query = {"role": "Student"}
    if year_group and year_group != "All":
        query["year_group"] = year_group
    students = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(500)

    for s in students:
        cls = await db.classes.find_one({"class_id": s.get("class_id")}, {"_id": 0, "name": 1})
        s["class_name"] = cls["name"] if cls else ""
        # Financial summary - filtered by active term
        active_term, _ = await get_active_term()
        invoices = await db.invoices_v2.find({"student_id": s["user_id"], "status": {"$ne": "cancelled"}, "term": active_term}, {"_id": 0}).to_list(50)
        total_billed = sum(i.get("total_due", 0) for i in invoices)
        total_paid = sum(i.get("amount_paid", 0) for i in invoices)
        s["total_billed"] = round(total_billed, 2)
        s["total_paid"] = round(total_paid, 2)
        s["balance"] = round(total_billed - total_paid, 2)
        s["invoice_count"] = len(invoices)
    return students


@router.get("/student-profile/{student_id}")
async def student_finance_profile(student_id: str, user: dict = Depends(get_current_user)):
    """Detailed financial profile for a specific student."""
    # Parents can only view their own children's profiles
    if user["role"] == "Parent":
        parent = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "children_ids": 1})
        if not parent or student_id not in (parent.get("children_ids") or []):
            raise HTTPException(403, "You can only view your own children's billing")

    student = await db.users.find_one({"user_id": student_id}, {"_id": 0, "password_hash": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    cls = await db.classes.find_one({"class_id": student.get("class_id")}, {"_id": 0, "name": 1})
    student["class_name"] = cls["name"] if cls else ""

    active_term, _ = await get_active_term()
    invoices = await db.invoices_v2.find({"student_id": student_id, "status": {"$ne": "cancelled"}, "term": active_term}, {"_id": 0}).to_list(50)
    for inv in invoices:
        inv["line_items"] = await db.invoice_line_items.find({"invoice_id": inv["invoice_id"]}, {"_id": 0}).to_list(20)

    payments = await db.payments_v2.find({"student_id": student_id, "term": active_term}, {"_id": 0}).sort("created_at", -1).to_list(100)
    allocations = await db.allocations.find({"student_id": student_id, "term": active_term}, {"_id": 0}).to_list(200)
    credits = await db.credit_notes.find({"student_id": student_id}, {"_id": 0}).to_list(50)

    total_billed = sum(i.get("total_due", 0) for i in invoices)
    total_paid = sum(i.get("amount_paid", 0) for i in invoices)

    return {
        "student": student,
        "invoices": invoices,
        "payments": payments,
        "allocations": allocations,
        "credits": credits,
        "summary": {
            "total_billed": round(total_billed, 2),
            "total_paid": round(total_paid, 2),
            "balance": round(total_billed - total_paid, 2),
        }
    }


# ─── Bill PDF Generation ───
@router.get("/bill/{invoice_id}/pdf")
async def generate_bill_pdf(invoice_id: str, user: dict = Depends(get_current_user)):
    from fpdf import FPDF

    inv = await db.invoices_v2.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    student = await db.users.find_one({"user_id": inv.get("student_id")}, {"_id": 0})
    cls = await db.classes.find_one({"class_id": student.get("class_id")}, {"_id": 0, "name": 1}) if student else None
    line_items = await db.invoice_line_items.find({"invoice_id": invoice_id}, {"_id": 0}).to_list(20)

    pdf = FPDF()
    pdf.add_font("DejaVu", "", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", uni=True)
    pdf.add_font("DejaVu", "B", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", uni=True)
    pdf.add_font("DejaVu", "I", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf", uni=True)
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Logo + Header
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'main_logo.png')
    if not os.path.exists(logo_path):
        logo_path = os.path.join(os.path.dirname(__file__), '..', 'main_logo.png')
    if os.path.exists(logo_path):
        pdf.image(logo_path, x=75, y=8, w=50, h=50)
    pdf.set_y(60)
    pdf.set_font("DejaVu", "B", 18)
    pdf.cell(0, 10, "The RightWay Centre of Learning", ln=True, align="C")
    pdf.set_font("DejaVu", "I", 9)
    pdf.set_text_color(197, 165, 90)
    pdf.cell(0, 5, "Where Every Child Thrives, Transforming Hearts", ln=True, align="C")
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("DejaVu", "B", 14)
    pdf.cell(0, 10, "STUDENT FEE INVOICE", ln=True, align="C")
    pdf.ln(5)

    # Invoice details
    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(40, 7, "Invoice No:")
    pdf.set_font("DejaVu", "", 10)
    pdf.cell(60, 7, inv.get("invoice_number", ""))
    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(30, 7, "Date:")
    pdf.set_font("DejaVu", "", 10)
    pdf.cell(0, 7, inv.get("issued_at", "")[:10], ln=True)

    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(40, 7, "Student:")
    pdf.set_font("DejaVu", "", 10)
    pdf.cell(60, 7, student.get("name", "") if student else "")
    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(30, 7, "ADM No:")
    pdf.set_font("DejaVu", "", 10)
    pdf.cell(0, 7, student.get("admission_number", "") if student else "", ln=True)

    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(40, 7, "Class:")
    pdf.set_font("DejaVu", "", 10)
    pdf.cell(60, 7, cls.get("name", "") if cls else "")
    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(30, 7, "Term:")
    pdf.set_font("DejaVu", "", 10)
    pdf.cell(0, 7, f"{inv.get('term', '')} {inv.get('academic_year', '')}", ln=True)

    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(40, 7, "Status:")
    pdf.set_font("DejaVu", "", 10)
    pdf.cell(60, 7, inv.get("status", "").upper())
    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(30, 7, "Due Date:")
    pdf.set_font("DejaVu", "", 10)
    pdf.cell(0, 7, inv.get("due_at", "")[:10], ln=True)
    pdf.ln(5)

    # Line items table
    pdf.set_font("DejaVu", "B", 9)
    pdf.set_fill_color(27, 42, 74)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(15, 8, "#", border=1, fill=True, align="C")
    pdf.cell(80, 8, "Fee Item", border=1, fill=True)
    pdf.cell(30, 8, "Category", border=1, fill=True, align="C")
    pdf.cell(30, 8, "Amount (TT$)", border=1, fill=True, align="C")
    pdf.cell(30, 8, "Paid (GHS)", border=1, fill=True, align="C")
    pdf.ln()
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("DejaVu", "", 9)

    for i, li in enumerate(line_items):
        pdf.cell(15, 7, str(i+1), border=1, align="C")
        pdf.cell(80, 7, li.get("fee_item_name", ""), border=1)
        pdf.cell(30, 7, li.get("category", ""), border=1, align="C")
        pdf.cell(30, 7, f"{li.get('amount', 0):,.2f}", border=1, align="C")
        pdf.cell(30, 7, f"{li.get('amount_paid', 0):,.2f}", border=1, align="C")
        pdf.ln()

    # If no line items, show from invoice items
    if not line_items and inv.get("items"):
        for i, item in enumerate(inv["items"]):
            pdf.cell(15, 7, str(i+1), border=1, align="C")
            pdf.cell(80, 7, item.get("description", ""), border=1)
            pdf.cell(30, 7, "", border=1, align="C")
            pdf.cell(30, 7, f"{item.get('amount', 0):,.2f}", border=1, align="C")
            pdf.cell(30, 7, "", border=1, align="C")
            pdf.ln()

    pdf.ln(3)

    # Totals
    pdf.set_font("DejaVu", "B", 10)
    pdf.cell(125, 8, "Total Fee:", border=1, align="R")
    pdf.cell(60, 8, f"TT$ {inv.get('total_due', 0):,.2f}", border=1, align="C")
    pdf.ln()
    pdf.cell(125, 8, "Amount Paid:", border=1, align="R")
    pdf.set_text_color(22, 163, 74)
    pdf.cell(60, 8, f"TT$ {inv.get('amount_paid', 0):,.2f}", border=1, align="C")
    pdf.ln()
    pdf.set_text_color(220, 38, 38)
    pdf.cell(125, 8, "Balance Owing:", border=1, align="R")
    balance = inv.get("total_due", 0) - inv.get("amount_paid", 0)
    pdf.cell(60, 8, f"TT$ {balance:,.2f}", border=1, align="C")
    pdf.ln()
    pdf.set_text_color(0, 0, 0)

    pdf.ln(10)
    pdf.set_font("DejaVu", "", 8)
    pdf.cell(90, 6, "Authorized Signature: ___________________")
    pdf.cell(0, 6, f"Date: {datetime.now(timezone.utc).strftime('%d/%m/%Y')}", ln=True)
    pdf.ln(3)
    pdf.set_font("DejaVu", "I", 7)
    pdf.cell(0, 5, "This is a computer-generated invoice. Please contact the Finance Office for any queries.", ln=True, align="C")

    from fastapi.responses import Response
    pdf_bytes = pdf.output()
    filename = f"TCIS_Invoice_{inv.get('invoice_number', invoice_id)}_{student.get('name', '').replace(' ', '_')}.pdf"
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ─── Fee Template for Bulk Assignment ───
@router.post("/assign-fees-bulk")
async def assign_fees_bulk(data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    """Assign fees to all students in a year group with boarding/day distinction."""
    year_group = data.get("year_group", "")
    term = data.get("term", "Term 1")
    academic_year = data.get("academic_year", "2025-2026")
    due_date = data.get("due_date", "")
    fee_items = data.get("fee_items", [])  # [{name, category, amount, applies_to: "all"|"boarding"|"day"}]

    students = await db.users.find({"role": "Student", "year_group": year_group}, {"_id": 0}).to_list(200)
    created = 0

    for student in students:
        # Check if already has invoice for this term
        existing = await db.invoices_v2.find_one(
            {"student_id": student["user_id"], "term": term, "academic_year": academic_year, "status": {"$ne": "cancelled"}}, {"_id": 0}
        )
        if existing:
            continue

        # Filter fee items by boarding status
        boarding = student.get("boarding_status", "day")
        applicable_items = []
        for fi in fee_items:
            applies = fi.get("applies_to", "all")
            if applies == "all" or applies == boarding:
                applicable_items.append(fi)

        if not applicable_items:
            continue

        subtotal = sum(fi.get("amount", 0) for fi in applicable_items)
        inv_id = gen_id("inv_")
        inv_num = f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{gen_id('')[:6].upper()}"

        await db.invoices_v2.insert_one({
            "invoice_id": inv_id, "invoice_number": inv_num,
            "student_id": student["user_id"],
            "term": term, "academic_year": academic_year,
            "status": "issued", "issued_at": datetime.now(timezone.utc).isoformat(),
            "due_at": due_date, "subtotal": round(subtotal, 2),
            "discount_total": 0, "penalty_total": 0,
            "total_due": round(subtotal, 2), "amount_paid": 0,
            "notes": "", "created_by": user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        for fi in applicable_items:
            await db.invoice_line_items.insert_one({
                "item_id": gen_id("li_"), "invoice_id": inv_id,
                "fee_item_code": fi.get("code", ""),
                "fee_item_name": fi.get("name", ""),
                "category": fi.get("category", "tuition"),
                "amount": round(fi.get("amount", 0), 2),
                "amount_paid": 0,
                "amount_outstanding": round(fi.get("amount", 0), 2)
            })

        await recalc_student_balance(student["user_id"])
        # Auto-post to Accounting
        await post_invoice_journal(
            student_name=student.get("name", ""), amount=subtotal,
            description=f"Bulk fees {year_group}", invoice_id=inv_id,
            user_id=user["user_id"], user_name=user.get("name", ""),
        )
        created += 1

    await finance_audit(user["user_id"], user["name"], "assign_fees_bulk", "invoice", "", after={"year_group": year_group, "count": created})
    return {"message": f"Fees assigned to {created} students in {year_group}", "count": created}


@router.post("/reset-all")
async def reset_all_billing(data: dict = Body({}), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    """Reset all billing data - clear invoices, payments, allocations. Start fresh."""
    confirm = data.get("confirm", "")
    if confirm != "RESET":
        raise HTTPException(status_code=400, detail="Type RESET to confirm")

    inv_count = await db.invoices_v2.count_documents({})
    pay_count = await db.payments_v2.count_documents({})

    await db.invoices_v2.delete_many({})
    await db.invoice_line_items.delete_many({})
    await db.payments_v2.delete_many({})
    await db.allocations.delete_many({})
    await db.credit_notes.delete_many({})

    # Reset all student balances
    await db.users.update_many({"role": "Student"}, {"$set": {"balance": 0, "total_fees": 0, "total_paid": 0}})

    # Clear all finance-auto journal entries in Accounting
    await clear_all_finance_journals()

    await finance_audit(user["user_id"], user["name"], "reset_all_billing", "system", "",
                        after={"invoices_deleted": inv_count, "payments_deleted": pay_count})
    return {"message": f"Billing reset complete. Cleared {inv_count} invoices and {pay_count} payments."}


@router.post("/quick-assign")
async def quick_assign_fee(data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    """Quickly assign a fee amount to a student and optionally record payment."""
    student_id = data.get("student_id", "")
    fee_amount = data.get("fee_amount", 0)
    paid_amount = data.get("paid_amount", 0)
    fee_description = data.get("description", "School Fees")
    active_term, active_year = await get_active_term()
    term = data.get("term", "") or active_term

    student = await db.users.find_one({"user_id": student_id}, {"_id": 0, "name": 1})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    now = datetime.now(timezone.utc)

    # Create invoice
    inv_id = gen_id("inv_")
    inv_num = f"INV-{now.strftime('%Y%m%d')}-{inv_id[-6:].upper()}"
    await db.invoices_v2.insert_one({
        "invoice_id": inv_id, "invoice_number": inv_num,
        "student_id": student_id, "term": term, "academic_year": active_year,
        "status": "issued", "issued_at": now.isoformat(), "due_at": "",
        "subtotal": fee_amount, "discount_total": 0, "penalty_total": 0,
        "total_due": fee_amount, "amount_paid": 0,
        "notes": fee_description, "created_by": user["user_id"],
        "created_at": now.isoformat()
    })
    await db.invoice_line_items.insert_one({
        "item_id": gen_id("li_"), "invoice_id": inv_id,
        "fee_item_code": "FEES", "fee_item_name": fee_description,
        "category": "tuition", "amount": fee_amount,
        "amount_paid": 0, "amount_outstanding": fee_amount
    })

    # Record payment and auto-allocate if any
    if paid_amount > 0:
        pay_id = gen_id("pay_")
        await db.payments_v2.insert_one({
            "payment_id": pay_id, "student_id": student_id,
            "amount": paid_amount, "method": data.get("method", "cash"), "status": "allocated",
            "reference": f"QA-{pay_id[-6:]}", "payer_name": student["name"],
            "student_name": student["name"], "unallocated_amount": 0,
            "term": term, "academic_year": active_year,
            "created_by": user["user_id"], "created_at": now.isoformat()
        })
        alloc_amount = min(paid_amount, fee_amount)
        await db.allocations.insert_one({
            "allocation_id": gen_id("alloc_"), "payment_id": pay_id,
            "student_id": student_id, "invoice_id": inv_id,
            "line_item_id": "", "allocated_amount": round(alloc_amount, 2),
            "allocation_type": "auto", "notes": "Quick assign",
            "term": term, "academic_year": active_year,
            "allocated_by": user["user_id"], "allocated_at": now.isoformat()
        })

    await recalc_student_balance(student_id)
    balance = fee_amount - paid_amount
    # Auto-post to Accounting
    await post_invoice_journal(
        student_name=student["name"], amount=fee_amount,
        description=fee_description, invoice_id=inv_id,
        user_id=user["user_id"], user_name=user.get("name", ""),
    )
    if paid_amount > 0:
        await post_payment_journal(
            student_name=student["name"], amount=paid_amount,
            method=data.get("method", "cash"), payment_id=pay_id,
            user_id=user["user_id"], user_name=user.get("name", ""),
        )
    return {"message": f"Fee TT$ {fee_amount:,.2f} assigned. Paid: TT$ {paid_amount:,.2f}. Balance: TT$ {balance:,.2f}", "invoice_id": inv_id}


@router.post("/bill-selected-students")
async def bill_selected_students(data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    """Bill selected students with custom fee items. Supports individual or multi-student billing."""
    student_ids = data.get("student_ids", [])
    fee_items = data.get("fee_items", [])
    active_term, active_year = await get_active_term()
    term = data.get("term", "") or active_term
    academic_year = data.get("academic_year", "") or active_year
    due_date = data.get("due_date", "")

    if not student_ids or not fee_items:
        raise HTTPException(400, "Select students and add fee items")

    created = 0
    skipped = 0
    now = datetime.now(timezone.utc)

    for sid in student_ids:
        student = await db.users.find_one({"user_id": sid}, {"_id": 0, "user_id": 1, "name": 1, "boarding_status": 1})
        if not student:
            continue

        existing = await db.invoices_v2.find_one(
            {"student_id": sid, "term": term, "academic_year": academic_year, "status": {"$ne": "cancelled"}}, {"_id": 0}
        )
        if existing:
            skipped += 1
            continue

        boarding = student.get("boarding_status", "day")
        applicable = [fi for fi in fee_items if fi.get("applies_to", "all") in ("all", boarding)]
        if not applicable:
            continue

        subtotal = round(sum(fi.get("amount", 0) for fi in applicable), 2)
        inv_id = gen_id("inv_")
        inv_num = f"INV-{now.strftime('%Y%m%d')}-{gen_id('')[:6].upper()}"

        await db.invoices_v2.insert_one({
            "invoice_id": inv_id, "invoice_number": inv_num,
            "student_id": sid, "term": term, "academic_year": academic_year,
            "status": "issued", "issued_at": now.isoformat(),
            "due_at": due_date, "subtotal": subtotal,
            "discount_total": 0, "penalty_total": 0,
            "total_due": subtotal, "amount_paid": 0,
            "notes": f"Billed {len(applicable)} items",
            "created_by": user["user_id"], "created_at": now.isoformat()
        })

        for fi in applicable:
            await db.invoice_line_items.insert_one({
                "item_id": gen_id("li_"), "invoice_id": inv_id,
                "fee_item_code": fi.get("code", ""), "fee_item_name": fi.get("name", ""),
                "category": fi.get("category", "tuition"),
                "amount": round(fi.get("amount", 0), 2),
                "amount_paid": 0, "amount_outstanding": round(fi.get("amount", 0), 2)
            })

        await recalc_student_balance(sid)
        # Auto-post to Accounting
        await post_invoice_journal(
            student_name=student.get("name", ""), amount=subtotal,
            description=f"Bill {len(applicable)} items", invoice_id=inv_id,
            user_id=user["user_id"], user_name=user.get("name", ""),
        )
        created += 1

    await finance_audit(user["user_id"], user["name"], "bill_selected", "invoice", "",
                        after={"student_count": len(student_ids), "created": created, "skipped": skipped})
    return {"message": f"Billed {created} students. {skipped} skipped (already billed this term).", "created": created, "skipped": skipped}


@router.post("/student/{student_id}/assign-term-fees")
async def assign_student_term_fees(student_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    """Assign or replace term fees for a specific student with custom line items."""
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0, "name": 1})
    if not student:
        raise HTTPException(404, "Student not found")

    term = data.get("term", "Term 1")
    academic_year = data.get("academic_year", "2025-2026")
    due_date = data.get("due_date", "")
    fee_items = data.get("fee_items", [])

    if not fee_items:
        raise HTTPException(400, "Add at least one fee item")

    now = datetime.now(timezone.utc)

    # Check for existing invoice this term
    existing = await db.invoices_v2.find_one(
        {"student_id": student_id, "term": term, "academic_year": academic_year, "status": {"$ne": "cancelled"}},
        {"_id": 0}
    )

    if existing:
        # Update existing invoice: remove old line items, add new ones
        inv_id = existing["invoice_id"]
        old_total = existing.get("total_due", 0)
        old_paid = existing.get("amount_paid", 0)

        # Delete old line items
        await db.invoice_line_items.delete_many({"invoice_id": inv_id})

        # Create new line items
        subtotal = 0
        for fi in fee_items:
            amt = round(float(fi.get("amount", 0)), 2)
            if amt <= 0:
                continue
            subtotal += amt
            await db.invoice_line_items.insert_one({
                "item_id": gen_id("li_"), "invoice_id": inv_id,
                "fee_item_code": fi.get("code", ""), "fee_item_name": fi.get("name", ""),
                "category": fi.get("category", "tuition"),
                "amount": amt, "amount_paid": 0, "amount_outstanding": amt
            })

        subtotal = round(subtotal, 2)
        new_status = "paid" if old_paid >= subtotal else ("partial" if old_paid > 0 else "issued")
        await db.invoices_v2.update_one({"invoice_id": inv_id}, {"$set": {
            "subtotal": subtotal, "total_due": subtotal, "amount_paid": old_paid,
            "status": new_status, "due_at": due_date or existing.get("due_at", ""),
            "notes": f"Updated {len(fee_items)} items", "updated_at": now.isoformat()
        }})

        await recalc_student_balance(student_id)
        return {"message": f"Updated {term} fees for {student['name']}. New total: TT$ {subtotal:,.2f}", "invoice_id": inv_id, "action": "updated"}
    else:
        # Create new invoice
        subtotal = round(sum(float(fi.get("amount", 0)) for fi in fee_items), 2)
        inv_id = gen_id("inv_")
        inv_num = f"INV-{now.strftime('%Y%m%d')}-{gen_id('')[:6].upper()}"

        await db.invoices_v2.insert_one({
            "invoice_id": inv_id, "invoice_number": inv_num,
            "student_id": student_id, "term": term, "academic_year": academic_year,
            "status": "issued", "issued_at": now.isoformat(), "due_at": due_date,
            "subtotal": subtotal, "discount_total": 0, "penalty_total": 0,
            "total_due": subtotal, "amount_paid": 0,
            "notes": f"{len(fee_items)} fee items", "created_by": user["user_id"],
            "created_at": now.isoformat()
        })

        for fi in fee_items:
            amt = round(float(fi.get("amount", 0)), 2)
            if amt <= 0:
                continue
            await db.invoice_line_items.insert_one({
                "item_id": gen_id("li_"), "invoice_id": inv_id,
                "fee_item_code": fi.get("code", ""), "fee_item_name": fi.get("name", ""),
                "category": fi.get("category", "tuition"),
                "amount": amt, "amount_paid": 0, "amount_outstanding": amt
            })

        await recalc_student_balance(student_id)
        # Auto-post to Accounting
        await post_invoice_journal(
            student_name=student["name"], amount=subtotal,
            description=f"Term fees {term}", invoice_id=inv_id,
            user_id=user["user_id"], user_name=user.get("name", ""),
        )
        return {"message": f"Assigned {term} fees for {student['name']}. Total: TT$ {subtotal:,.2f}", "invoice_id": inv_id, "action": "created"}



# ═══════════════════════════════════════════
# FEE TEMPLATES (Termly Billing)
# ═══════════════════════════════════════════

@router.post("/fee-templates")
async def create_fee_template(data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    """Create a reusable fee template for a year group / term."""
    tmpl = {
        "template_id": gen_id("ftpl_"),
        "name": data.get("name", ""),
        "year_group": data.get("year_group", ""),
        "term": data.get("term", ""),
        "academic_year": data.get("academic_year", "2025-2026"),
        "fee_items": data.get("fee_items", []),
        "total_day": sum(fi.get("amount", 0) for fi in data.get("fee_items", []) if fi.get("applies_to", "all") in ("all", "day")),
        "total_boarding": sum(fi.get("amount", 0) for fi in data.get("fee_items", []) if fi.get("applies_to", "all") in ("all", "boarding")),
        "created_by": user["user_id"],
        "created_by_name": user["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.fee_templates.insert_one(tmpl)
    await finance_audit(user["user_id"], user["name"], "create_fee_template", "template", tmpl["template_id"])
    return {k: v for k, v in tmpl.items() if k != "_id"}


@router.get("/fee-templates")
async def list_fee_templates(year_group: str = None, term: str = None, user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    query = {}
    if year_group:
        query["year_group"] = year_group
    if term:
        query["term"] = term
    templates = await db.fee_templates.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return templates


@router.put("/fee-templates/{template_id}")
async def update_fee_template(template_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    safe = {k: v for k, v in data.items() if k in ("name", "year_group", "term", "academic_year", "fee_items")}
    if "fee_items" in safe:
        safe["total_day"] = sum(fi.get("amount", 0) for fi in safe["fee_items"] if fi.get("applies_to", "all") in ("all", "day"))
        safe["total_boarding"] = sum(fi.get("amount", 0) for fi in safe["fee_items"] if fi.get("applies_to", "all") in ("all", "boarding"))
    safe["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.fee_templates.update_one({"template_id": template_id}, {"$set": safe})
    return {"message": "Template updated"}


@router.delete("/fee-templates/{template_id}")
async def delete_fee_template(template_id: str, user: dict = Depends(require_roles(*FINANCE_ROLES))):
    await db.fee_templates.delete_one({"template_id": template_id})
    return {"message": "Template deleted"}


@router.post("/fee-templates/{template_id}/apply")
async def apply_fee_template(template_id: str, data: dict = Body({}), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    """Apply a saved fee template to generate invoices for all students in the target year group."""
    tmpl = await db.fee_templates.find_one({"template_id": template_id}, {"_id": 0})
    if not tmpl:
        raise HTTPException(404, "Template not found")

    year_group = data.get("year_group", tmpl.get("year_group", ""))
    term = data.get("term", tmpl.get("term", "Term 1"))
    academic_year = data.get("academic_year", tmpl.get("academic_year", "2025-2026"))
    due_date = data.get("due_date", "")
    fee_items = tmpl.get("fee_items", [])

    students = await db.users.find({"role": "Student", "year_group": year_group}, {"_id": 0}).to_list(500)
    created = 0
    skipped = 0

    for student in students:
        existing = await db.invoices_v2.find_one(
            {"student_id": student["user_id"], "term": term, "academic_year": academic_year, "status": {"$ne": "cancelled"}}, {"_id": 0}
        )
        if existing:
            skipped += 1
            continue

        boarding = student.get("boarding_status", "day")
        applicable_items = [fi for fi in fee_items if fi.get("applies_to", "all") in ("all", boarding)]
        if not applicable_items:
            continue

        subtotal = sum(fi.get("amount", 0) for fi in applicable_items)
        inv_id = gen_id("inv_")
        inv_num = f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{gen_id('')[:6].upper()}"

        await db.invoices_v2.insert_one({
            "invoice_id": inv_id, "invoice_number": inv_num,
            "student_id": student["user_id"],
            "term": term, "academic_year": academic_year,
            "status": "issued", "issued_at": datetime.now(timezone.utc).isoformat(),
            "due_at": due_date, "subtotal": round(subtotal, 2),
            "discount_total": 0, "penalty_total": 0,
            "total_due": round(subtotal, 2), "amount_paid": 0,
            "notes": f"Auto-generated from template: {tmpl.get('name', '')}",
            "created_by": user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        for fi in applicable_items:
            await db.invoice_line_items.insert_one({
                "item_id": gen_id("li_"), "invoice_id": inv_id,
                "fee_item_code": fi.get("code", ""),
                "fee_item_name": fi.get("name", ""),
                "category": fi.get("category", "tuition"),
                "amount": round(fi.get("amount", 0), 2),
                "amount_paid": 0,
                "amount_outstanding": round(fi.get("amount", 0), 2)
            })

        await recalc_student_balance(student["user_id"])
        created += 1

    await finance_audit(user["user_id"], user["name"], "apply_fee_template", "template", template_id,
                        after={"created": created, "skipped": skipped, "year_group": year_group, "term": term})
    return {"message": f"Template applied: {created} invoices created, {skipped} skipped (already billed)", "created": created, "skipped": skipped}


# ═══════════════════════════════════════════
# OUTSTANDING BALANCES REPORT
# ═══════════════════════════════════════════

@router.get("/outstanding-report")
async def outstanding_report(term: str = None, year_group: str = None, user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    """Get outstanding balances with optional term and year group filter."""
    inv_query = {"status": {"$nin": ["cancelled", "paid"]}}
    if term:
        inv_query["term"] = term

    invoices = await db.invoices_v2.find(inv_query, {"_id": 0}).to_list(2000)
    if not invoices:
        return {"students": [], "total_outstanding": 0, "total_invoiced": 0, "total_paid": 0}

    student_ids = list(set(i["student_id"] for i in invoices))
    stu_query = {"user_id": {"$in": student_ids}}
    if year_group:
        stu_query["year_group"] = year_group
    students = await db.users.find(stu_query, {"_id": 0, "user_id": 1, "name": 1, "year_group": 1, "boarding_status": 1}).to_list(len(student_ids))
    stu_map = {s["user_id"]: s for s in students}

    accounts = await db.student_accounts.find({"student_id": {"$in": student_ids}}, {"_id": 0}).to_list(len(student_ids))
    acc_map = {a["student_id"]: a for a in accounts}

    result = []
    total_outstanding = 0
    total_invoiced = 0
    total_paid = 0
    for sid in student_ids:
        s = stu_map.get(sid)
        if not s:
            continue
        acc = acc_map.get(sid, {})
        stu_invoices = [i for i in invoices if i["student_id"] == sid]
        owed = sum(i.get("total_due", 0) - i.get("amount_paid", 0) for i in stu_invoices)
        inv_total = sum(i.get("total_due", 0) for i in stu_invoices)
        paid_total = sum(i.get("amount_paid", 0) for i in stu_invoices)
        if owed <= 0:
            continue
        total_outstanding += owed
        total_invoiced += inv_total
        total_paid += paid_total
        result.append({
            "student_id": sid, "name": s.get("name", ""),
            "year_group": s.get("year_group", ""), "boarding_status": s.get("boarding_status", "day"),
            "total_invoiced": round(inv_total, 2), "total_paid": round(paid_total, 2),
            "outstanding": round(owed, 2),
            "invoices": len(stu_invoices),
        })

    result.sort(key=lambda x: x["outstanding"], reverse=True)
    return {
        "students": result, "total_outstanding": round(total_outstanding, 2),
        "total_invoiced": round(total_invoiced, 2), "total_paid": round(total_paid, 2),
        "count": len(result),
    }


# ═══════════════════════════════════════════
# TERM BILLING SUMMARY
# ═══════════════════════════════════════════

@router.get("/term-summary")
async def term_billing_summary(term: str = None, academic_year: str = None, user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES))):
    """Get billing summary grouped by year group for a specific term."""
    query = {"status": {"$ne": "cancelled"}}
    if term:
        query["term"] = term
    if academic_year:
        query["academic_year"] = academic_year

    invoices = await db.invoices_v2.find(query, {"_id": 0}).to_list(5000)
    if not invoices:
        return {"year_groups": [], "totals": {"invoiced": 0, "paid": 0, "outstanding": 0}}

    student_ids = list(set(i["student_id"] for i in invoices))
    students = await db.users.find(
        {"user_id": {"$in": student_ids}},
        {"_id": 0, "user_id": 1, "year_group": 1, "boarding_status": 1}
    ).to_list(len(student_ids))
    stu_map = {s["user_id"]: s for s in students}

    yg_data = {}
    for inv in invoices:
        s = stu_map.get(inv["student_id"], {})
        yg = s.get("year_group", "Unknown")
        if yg not in yg_data:
            yg_data[yg] = {"year_group": yg, "students": set(), "invoiced": 0, "paid": 0, "boarding_count": 0, "day_count": 0}
        yg_data[yg]["students"].add(inv["student_id"])
        yg_data[yg]["invoiced"] += inv.get("total_due", 0)
        yg_data[yg]["paid"] += inv.get("amount_paid", 0)
        if s.get("boarding_status") == "boarding":
            yg_data[yg]["boarding_count"] += 1
        else:
            yg_data[yg]["day_count"] += 1

    result = []
    for yg, d in sorted(yg_data.items()):
        result.append({
            "year_group": yg, "student_count": len(d["students"]),
            "boarding_count": d["boarding_count"], "day_count": d["day_count"],
            "invoiced": round(d["invoiced"], 2), "paid": round(d["paid"], 2),
            "outstanding": round(d["invoiced"] - d["paid"], 2),
            "collection_rate": round((d["paid"] / d["invoiced"] * 100) if d["invoiced"] > 0 else 0, 1),
        })

    total_inv = sum(r["invoiced"] for r in result)
    total_paid = sum(r["paid"] for r in result)
    return {
        "year_groups": result,
        "totals": {"invoiced": round(total_inv, 2), "paid": round(total_paid, 2), "outstanding": round(total_inv - total_paid, 2)},
    }


# ─── Reconciliation Table (Management Approval) ───

MANAGEMENT_ROLES = ("SuperAdmin", "Founder", "CEO")

@router.get("/reconciliation")
async def get_reconciliation(year_group: str = "Year 7", user: dict = Depends(require_roles(*FINANCE_VIEW_ROLES, *MANAGEMENT_ROLES))):
    """Get reconciliation table: student name, paid, owed per year group."""
    active_term, _ = await get_active_term()
    students = await db.users.find(
        {"role": "Student", "year_group": year_group},
        {"_id": 0, "user_id": 1, "name": 1, "admission_number": 1, "boarding_status": 1}
    ).sort("name", 1).to_list(500)

    rows = []
    for s in students:
        sid = s["user_id"]
        invoices = await db.invoices_v2.find(
            {"student_id": sid, "term": active_term, "status": {"$ne": "cancelled"}},
            {"_id": 0, "total_due": 1, "amount_paid": 1}
        ).to_list(50)
        total_due = sum(i.get("total_due", 0) for i in invoices)
        total_paid = sum(i.get("amount_paid", 0) for i in invoices)

        # Check for manual reconciliation override
        recon = await db.reconciliation.find_one(
            {"student_id": sid, "term": active_term, "year_group": year_group}, {"_id": 0}
        )

        rows.append({
            "student_id": sid,
            "name": s["name"],
            "admission_number": s.get("admission_number", ""),
            "boarding_status": s.get("boarding_status", "day"),
            "total_due": recon["total_due"] if recon else round(total_due, 2),
            "total_paid": recon["total_paid"] if recon else round(total_paid, 2),
            "balance": round((recon["total_due"] if recon else total_due) - (recon["total_paid"] if recon else total_paid), 2),
            "recon_id": recon.get("recon_id") if recon else None,
            "status": recon.get("status", "pending") if recon else "auto",
            "notes": recon.get("notes", "") if recon else "",
        })

    return {"year_group": year_group, "term": active_term, "students": rows}


@router.post("/reconciliation/save")
async def save_reconciliation(data: dict = Body(...), user: dict = Depends(require_roles(*FINANCE_ROLES))):
    """Finance saves reconciliation entries for a year group."""
    year_group = data.get("year_group", "")
    entries = data.get("entries", [])
    active_term, _ = await get_active_term()
    saved = 0

    for entry in entries:
        sid = entry.get("student_id")
        if not sid:
            continue
        total_due = float(entry.get("total_due", 0))
        total_paid = float(entry.get("total_paid", 0))
        notes = entry.get("notes", "")

        existing = await db.reconciliation.find_one(
            {"student_id": sid, "term": active_term, "year_group": year_group}, {"_id": 0}
        )
        if existing:
            await db.reconciliation.update_one(
                {"recon_id": existing["recon_id"]},
                {"$set": {
                    "total_due": total_due, "total_paid": total_paid,
                    "notes": notes, "status": "pending",
                    "updated_by": user["user_id"], "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            await db.reconciliation.insert_one({
                "recon_id": gen_id("recon_"), "student_id": sid,
                "year_group": year_group, "term": active_term,
                "total_due": total_due, "total_paid": total_paid,
                "notes": notes, "status": "pending",
                "created_by": user["user_id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": user["user_id"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
        saved += 1

    await finance_audit(user["user_id"], user["name"], "save_reconciliation", "reconciliation", year_group, after={"entries": saved})
    return {"message": f"Saved {saved} reconciliation entries for {year_group}"}


@router.post("/reconciliation/approve")
async def approve_reconciliation(data: dict = Body(...), user: dict = Depends(require_roles(*MANAGEMENT_ROLES))):
    """Management approves reconciliation entries for a year group."""
    year_group = data.get("year_group", "")
    active_term, _ = await get_active_term()

    result = await db.reconciliation.update_many(
        {"year_group": year_group, "term": active_term, "status": {"$in": ["pending", "auto"]}},
        {"$set": {
            "status": "approved",
            "approved_by": user["user_id"],
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    await finance_audit(user["user_id"], user["name"], "approve_reconciliation", "reconciliation", year_group, after={"approved": result.modified_count})
    return {"message": f"Approved {result.modified_count} records for {year_group}"}


@router.post("/reconciliation/approve-one")
async def approve_one_reconciliation(data: dict = Body(...), user: dict = Depends(require_roles(*MANAGEMENT_ROLES))):
    """Management marks a single student's reconciliation as seen."""
    student_id = data.get("student_id")
    year_group = data.get("year_group", "")
    active_term, _ = await get_active_term()

    existing = await db.reconciliation.find_one(
        {"student_id": student_id, "year_group": year_group, "term": active_term}, {"_id": 0}
    )
    now = datetime.now(timezone.utc).isoformat()
    if existing:
        await db.reconciliation.update_one(
            {"recon_id": existing["recon_id"]},
            {"$set": {"status": "approved", "approved_by": user["user_id"], "approved_at": now}}
        )
    else:
        total_due = float(data.get("total_due", 0))
        total_paid = float(data.get("total_paid", 0))
        await db.reconciliation.insert_one({
            "recon_id": gen_id("recon_"), "student_id": student_id,
            "year_group": year_group, "term": active_term,
            "total_due": total_due, "total_paid": total_paid,
            "notes": "", "status": "approved",
            "created_by": user["user_id"], "created_at": now,
            "updated_by": user["user_id"], "updated_at": now,
            "approved_by": user["user_id"], "approved_at": now,
        })
    return {"message": "Marked as seen"}



@router.delete("/reconciliation/{student_id}")
async def delete_reconciliation_record(student_id: str, year_group: str = "Year 7", user: dict = Depends(require_roles(*FINANCE_ROLES))):
    """Delete a manual reconciliation override, reverting to auto-calculated values."""
    active_term, _ = await get_active_term()
    result = await db.reconciliation.delete_one(
        {"student_id": student_id, "term": active_term, "year_group": year_group}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reconciliation record not found")
    await finance_audit(user["user_id"], user["name"], "delete_reconciliation", "reconciliation", student_id,
                        after={"year_group": year_group})
    return {"message": "Reconciliation record deleted — reverted to auto-calculated"}



@router.get("/reconciliation/pdf")
async def reconciliation_pdf(year_group: str = "Year 7", token: str = None, request: Request = None):
    """Download reconciliation table as branded PDF."""
    from fpdf import FPDF
    from fastapi.responses import Response
    import os, jwt

    # Auth: try Authorization header first, then token query param
    user = None
    auth_header = request.headers.get("authorization", "") if request else ""
    raw_token = token
    if auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ", 1)[1]
    if raw_token:
        try:
            payload = jwt.decode(raw_token, os.environ.get("JWT_SECRET", "tcis-secret-key-change-in-production"), algorithms=["HS256"])
            user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    active_term, _ = await get_active_term()
    students = await db.users.find(
        {"role": "Student", "year_group": year_group},
        {"_id": 0, "user_id": 1, "name": 1, "admission_number": 1, "boarding_status": 1}
    ).sort("name", 1).to_list(500)

    rows = []
    for s in students:
        sid = s["user_id"]
        invoices = await db.invoices_v2.find(
            {"student_id": sid, "term": active_term, "status": {"$ne": "cancelled"}},
            {"_id": 0, "total_due": 1, "amount_paid": 1}
        ).to_list(50)
        total_due = sum(i.get("total_due", 0) for i in invoices)
        total_paid = sum(i.get("amount_paid", 0) for i in invoices)

        recon = await db.reconciliation.find_one(
            {"student_id": sid, "term": active_term, "year_group": year_group}, {"_id": 0}
        )
        due = recon["total_due"] if recon else round(total_due, 2)
        paid = recon["total_paid"] if recon else round(total_paid, 2)
        rows.append({
            "name": s["name"],
            "adm": s.get("admission_number", ""),
            "boarding": s.get("boarding_status", "day"),
            "due": due, "paid": paid, "balance": round(due - paid, 2),
            "status": recon.get("status", "auto") if recon else "auto",
        })

    pdf = FPDF()
    pdf.add_font("DejaVu", "", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", uni=True)
    pdf.add_font("DejaVu", "B", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", uni=True)
    pdf.add_font("DejaVu", "I", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf", uni=True)
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Logo
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'main_logo.png')
    if not os.path.exists(logo_path):
        logo_path = os.path.join(os.path.dirname(__file__), '..', 'main_logo.png')
    if os.path.exists(logo_path):
        pdf.image(logo_path, x=75, y=6, w=50, h=50)

    pdf.set_y(58)
    pdf.set_font("DejaVu", "B", 16)
    pdf.set_text_color(27, 42, 74)
    pdf.cell(0, 8, "The RightWay Centre of Learning", ln=True, align="C")
    pdf.set_font("DejaVu", "I", 8)
    pdf.set_text_color(197, 165, 90)
    pdf.cell(0, 5, "Where Every Child Thrives, Transforming Hearts", ln=True, align="C")
    pdf.ln(3)
    pdf.set_font("DejaVu", "B", 13)
    pdf.set_text_color(46, 108, 196)
    pdf.cell(0, 8, f"Fee Reconciliation - {year_group}", ln=True, align="C")
    pdf.set_font("DejaVu", "", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 5, f"{active_term} | Generated {datetime.now(timezone.utc).strftime('%d %b %Y, %H:%M')}", ln=True, align="C")
    pdf.set_draw_color(46, 108, 196)
    pdf.set_line_width(0.5)
    pdf.line(10, pdf.get_y() + 2, 200, pdf.get_y() + 2)
    pdf.ln(6)

    # Table header
    cols = [("#", 8), ("Student Name", 48), ("ADM No.", 22), ("Type", 18), ("Total Due (GHS)", 30), ("Total Paid (GHS)", 30), ("Balance (GHS)", 28)]
    pdf.set_font("DejaVu", "B", 7)
    pdf.set_fill_color(27, 42, 74)
    pdf.set_text_color(255, 255, 255)
    for label, w in cols:
        pdf.cell(w, 7, label, border=1, fill=True, align="C")
    pdf.ln()

    pdf.set_text_color(0, 0, 0)
    grand_due = grand_paid = 0
    for i, r in enumerate(rows):
        pdf.set_font("DejaVu", "", 7)
        if i % 2 == 1:
            pdf.set_fill_color(248, 250, 252)
        else:
            pdf.set_fill_color(255, 255, 255)
        pdf.cell(8, 6, str(i + 1), border=1, fill=True, align="C")
        pdf.cell(48, 6, r["name"][:28], border=1, fill=True)
        pdf.cell(22, 6, r["adm"][:12], border=1, fill=True, align="C")
        pdf.cell(18, 6, r["boarding"].capitalize()[:6], border=1, fill=True, align="C")
        pdf.cell(30, 6, f"{r['due']:,.2f}", border=1, fill=True, align="R")
        pdf.cell(30, 6, f"{r['paid']:,.2f}", border=1, fill=True, align="R")
        bal_color = (220, 38, 38) if r["balance"] > 0 else (22, 163, 74)
        pdf.set_text_color(*bal_color)
        pdf.cell(28, 6, f"{r['balance']:,.2f}", border=1, fill=True, align="R")
        pdf.set_text_color(0, 0, 0)
        pdf.ln()
        grand_due += r["due"]
        grand_paid += r["paid"]

    # Totals row
    pdf.set_font("DejaVu", "B", 7)
    pdf.set_fill_color(240, 244, 248)
    pdf.cell(96, 7, f"TOTAL ({len(rows)} students)", border=1, fill=True, align="R")
    pdf.cell(30, 7, f"{grand_due:,.2f}", border=1, fill=True, align="R")
    pdf.cell(30, 7, f"{grand_paid:,.2f}", border=1, fill=True, align="R")
    bal = grand_due - grand_paid
    pdf.set_text_color(220, 38, 38) if bal > 0 else pdf.set_text_color(22, 163, 74)
    pdf.cell(28, 7, f"{bal:,.2f}", border=1, fill=True, align="R")
    pdf.set_text_color(0, 0, 0)
    pdf.ln()

    # Signatures
    pdf.ln(15)
    pdf.set_font("DejaVu", "", 9)
    pdf.cell(90, 6, "Prepared by (Finance): ___________________")
    pdf.cell(0, 6, "Approved by (Management): ___________________", ln=True)
    pdf.ln(3)
    pdf.set_font("DejaVu", "I", 7)
    pdf.cell(0, 5, "This document is generated by RightWay Workstation for reconciliation purposes.", ln=True, align="C")

    pdf_bytes = pdf.output()
    fname = f"TCIS_Reconciliation_{year_group.replace(' ', '_')}_{active_term.replace(' ', '_')}.pdf"
    return Response(
        content=bytes(pdf_bytes), media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{fname}"'}
    )


# ═══════════════════════════════════════════
# WHOLE-SCHOOL FINANCE REPORT (PDF DOWNLOAD)
# ═══════════════════════════════════════════

@router.get("/report/whole-school-pdf")
async def whole_school_finance_report(
    request: Request,
    token: str = Query(None),
    download: int = Query(0),
    year_group: str = Query(None),
):
    """Generate a PDF breakdown of who has paid and who hasn't across the whole school."""
    from fastapi.responses import Response
    import jwt

    # Auth: try Authorization header first, then token query param
    user = None
    auth_header = request.headers.get("authorization", "") if request else ""
    raw_token = token
    if auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ", 1)[1]
    if raw_token:
        try:
            payload = jwt.decode(raw_token, os.environ.get("JWT_SECRET", "tcis-secret-key-change-in-production"), algorithms=["HS256"])
            user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    active_term, _ = await get_active_term()

    # Get ALL students
    stu_query = {"role": "Student"}
    if year_group:
        stu_query["year_group"] = year_group
    all_students = await db.users.find(
        stu_query, {"_id": 0, "user_id": 1, "name": 1, "year_group": 1, "boarding_status": 1}
    ).to_list(2000)

    # Get all invoices
    inv_query = {"status": {"$nin": ["cancelled"]}}
    invoices = await db.invoices_v2.find(inv_query, {"_id": 0}).to_list(5000)
    inv_by_student = {}
    for inv in invoices:
        sid = inv.get("student_id")
        if sid not in inv_by_student:
            inv_by_student[sid] = []
        inv_by_student[sid].append(inv)

    # Get accounts
    student_ids = [s["user_id"] for s in all_students]
    accounts = await db.student_accounts.find({"student_id": {"$in": student_ids}}, {"_id": 0}).to_list(len(student_ids))
    acc_map = {a["student_id"]: a for a in accounts}

    # Build report data grouped by year group
    year_groups = {}
    total_invoiced = 0
    total_paid = 0
    total_outstanding = 0
    fully_paid_count = 0
    partial_count = 0
    unpaid_count = 0

    for stu in all_students:
        sid = stu["user_id"]
        yg = stu.get("year_group", "Unknown")
        if yg not in year_groups:
            year_groups[yg] = {"students": [], "invoiced": 0, "paid": 0, "outstanding": 0}

        stu_invs = inv_by_student.get(sid, [])
        invoiced = sum(i.get("total_due", 0) for i in stu_invs)
        paid = sum(i.get("amount_paid", 0) for i in stu_invs)
        outstanding = invoiced - paid

        status_label = "No Invoice"
        if invoiced > 0:
            if outstanding <= 0:
                status_label = "Fully Paid"
                fully_paid_count += 1
            elif paid > 0:
                status_label = "Partial"
                partial_count += 1
            else:
                status_label = "Unpaid"
                unpaid_count += 1

        year_groups[yg]["students"].append({
            "name": stu.get("name", ""),
            "boarding": stu.get("boarding_status", "day"),
            "invoiced": round(invoiced, 2),
            "paid": round(paid, 2),
            "outstanding": round(outstanding, 2),
            "status": status_label,
        })
        year_groups[yg]["invoiced"] += invoiced
        year_groups[yg]["paid"] += paid
        year_groups[yg]["outstanding"] += outstanding
        total_invoiced += invoiced
        total_paid += paid
        total_outstanding += outstanding

    # Sort each year group's students by outstanding (descending)
    for yg in year_groups:
        year_groups[yg]["students"].sort(key=lambda x: x["outstanding"], reverse=True)

    # Generate PDF using WeasyPrint
    try:
        from weasyprint import HTML
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation requires weasyprint")

    now = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")
    filter_label = year_group if year_group else "All Year Groups"

    # Build HTML
    rows_html = ""
    for yg_name in sorted(year_groups.keys(), key=lambda x: x.replace("Year ", "")):
        yg_data = year_groups[yg_name]
        rows_html += f"""
        <tr class="yg-header">
            <td colspan="6"><strong>{yg_name}</strong> — {len(yg_data['students'])} students | 
            Invoiced: TT$ {yg_data['invoiced']:,.2f} | Paid: TT$ {yg_data['paid']:,.2f} | 
            Outstanding: TT$ {yg_data['outstanding']:,.2f}</td>
        </tr>"""
        for s in yg_data["students"]:
            status_class = "paid" if s["status"] == "Fully Paid" else "partial" if s["status"] == "Partial" else "unpaid" if s["status"] == "Unpaid" else "none"
            rows_html += f"""
        <tr class="student-row">
            <td>{s['name']}</td>
            <td>{s['boarding'].title()}</td>
            <td class="num">TT$ {s['invoiced']:,.2f}</td>
            <td class="num">TT$ {s['paid']:,.2f}</td>
            <td class="num {'outstanding' if s['outstanding'] > 0 else ''}">TT$ {s['outstanding']:,.2f}</td>
            <td class="status {status_class}">{s['status']}</td>
        </tr>"""

    # Load logo for PDF
    import base64 as b64
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'main_logo.png')
    logo_b64 = ""
    if os.path.exists(logo_path):
        with open(logo_path, "rb") as f:
            logo_b64 = b64.b64encode(f.read()).decode()

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
    @page {{ size: A4 landscape; margin: 1.5cm; }}
    body {{ font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #1B2A4A; }}
    .logo-banner {{ text-align: center; margin-bottom: 6px; }}
    .logo-banner img {{ width: 140px; height: auto; }}
    .header {{ text-align: center; margin-bottom: 15px; }}
    .header h1 {{ font-size: 18pt; color: #1B2A4A; margin: 4px 0 0 0; }}
    .header p {{ font-size: 9pt; color: #666; margin: 3px 0; }}
    .summary {{ display: flex; gap: 20px; margin-bottom: 15px; }}
    .summary-box {{ background: #f5f7fb; border-radius: 6px; padding: 10px 16px; flex: 1; text-align: center; }}
    .summary-box .label {{ font-size: 7pt; color: #888; text-transform: uppercase; }}
    .summary-box .value {{ font-size: 14pt; font-weight: bold; }}
    .summary-box .value.green {{ color: #16A34A; }}
    .summary-box .value.red {{ color: #DC2626; }}
    .summary-box .value.blue {{ color: #2E6CC4; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
    th {{ background: #1B2A4A; color: white; padding: 6px 8px; text-align: left; font-size: 8pt; }}
    th.num {{ text-align: right; }}
    td {{ padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 8pt; }}
    td.num {{ text-align: right; font-family: monospace; }}
    .yg-header td {{ background: #f0f4fa; font-size: 8pt; padding: 6px 8px; border-bottom: 2px solid #2E6CC4; }}
    .student-row:hover td {{ background: #fafbfd; }}
    .outstanding {{ color: #DC2626; font-weight: bold; }}
    .status {{ font-size: 7pt; font-weight: bold; text-align: center; border-radius: 3px; padding: 2px 6px; }}
    .paid {{ background: #dcfce7; color: #16A34A; }}
    .partial {{ background: #fef3c7; color: #d97706; }}
    .unpaid {{ background: #fee2e2; color: #DC2626; }}
    .none {{ background: #f1f5f9; color: #94a3b8; }}
    .footer {{ text-align: center; font-size: 7pt; color: #aaa; margin-top: 15px; }}
</style></head><body>
    <div class="logo-banner">
        {"<img src='data:image/png;base64," + logo_b64 + "' />" if logo_b64 else ""}
    </div>
    <div class="header">
        <h1>TCIS Finance Report</h1>
        <p>Whole School Fee Collection Breakdown | {filter_label} | Generated: {now}</p>
    </div>
    <div class="summary">
        <div class="summary-box"><div class="label">Total Students</div><div class="value blue">{len(all_students)}</div></div>
        <div class="summary-box"><div class="label">Total Invoiced</div><div class="value">TT$ {total_invoiced:,.2f}</div></div>
        <div class="summary-box"><div class="label">Total Collected</div><div class="value green">TT$ {total_paid:,.2f}</div></div>
        <div class="summary-box"><div class="label">Total Outstanding</div><div class="value red">TT$ {total_outstanding:,.2f}</div></div>
        <div class="summary-box"><div class="label">Fully Paid</div><div class="value green">{fully_paid_count}</div></div>
        <div class="summary-box"><div class="label">Partial</div><div class="value" style="color:#d97706">{partial_count}</div></div>
        <div class="summary-box"><div class="label">Unpaid</div><div class="value red">{unpaid_count}</div></div>
    </div>
    <table>
        <thead><tr>
            <th>Student Name</th><th>Boarding</th>
            <th class="num">Invoiced</th><th class="num">Paid</th>
            <th class="num">Outstanding</th><th>Status</th>
        </tr></thead>
        <tbody>{rows_html}</tbody>
    </table>
    <div class="footer">RightWay Workstation | Confidential Finance Report | Page 1</div>
</body></html>"""

    pdf_bytes = HTML(string=html).write_pdf()
    fname = f"TCIS_Finance_Report_{filter_label.replace(' ', '_')}_{active_term.replace(' ', '_')}.pdf"
    disposition = "attachment" if download else "inline"
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{fname}"'}
    )


