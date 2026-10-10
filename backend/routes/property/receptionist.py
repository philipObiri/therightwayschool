"""Receptionist Module — Inventory, procurement, uniform billing, parent communications."""
from fastapi import APIRouter, Depends, HTTPException, Body, Request
from database import db, get_active_term
from models import gen_id
from auth import get_current_user, require_roles
from ws_manager import send_notification
from datetime import datetime, timezone

router = APIRouter(prefix="/api/receptionist", tags=["receptionist"])

RECEPTIONIST_ROLES = ("Receptionist", "Admin", "SuperAdmin", "CEO", "Founder")
MGMT_ROLES = ("Admin", "SuperAdmin", "CEO", "Founder", "Principal")


@router.get("/dashboard")
async def receptionist_dashboard(user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    """Dashboard: today's stats, pending items, alerts."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    today_payments = await db.payments_v2.count_documents({"created_at": {"$regex": f"^{today}"}})
    pending_procurement = await db.procurement_requests.count_documents({"status": "pending"})
    low_stock = await db.receptionist_inventory.count_documents({"$expr": {"$lte": ["$quantity", "$min_threshold"]}})
    total_inventory = await db.receptionist_inventory.count_documents({})
    unread_chats = 0  # Placeholder

    recent_payments = await db.payments_v2.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)

    low_stock_items = await db.receptionist_inventory.find(
        {"$expr": {"$lte": ["$quantity", "$min_threshold"]}},
        {"_id": 0}
    ).to_list(10)

    return {
        "today_payments": today_payments,
        "pending_procurement": pending_procurement,
        "low_stock_count": low_stock,
        "total_inventory": total_inventory,
        "unread_chats": unread_chats,
        "recent_payments": recent_payments,
        "low_stock_items": low_stock_items,
    }


# ─── INVENTORY ───
@router.get("/inventory")
async def list_inventory(category: str = None, user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    query = {}
    if category:
        query["category"] = category
    items = await db.receptionist_inventory.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    return items


@router.post("/inventory")
async def add_inventory_item(data: dict = Body(...), user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    now = datetime.now(timezone.utc).isoformat()
    item_id = gen_id("inv_")
    doc = {
        "item_id": item_id,
        "name": data.get("name", ""),
        "category": data.get("category", "uniforms"),
        "description": data.get("description", ""),
        "quantity": data.get("quantity", 0),
        "unit_price": data.get("unit_price", 0),
        "min_threshold": data.get("min_threshold", 5),
        "supplier": data.get("supplier", ""),
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now,
        "movement_log": [{"type": "initial", "quantity": data.get("quantity", 0), "at": now, "by": user.get("name", "")}],
    }
    await db.receptionist_inventory.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/inventory/{item_id}")
async def update_inventory(item_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    item = await db.receptionist_inventory.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Item not found")

    now = datetime.now(timezone.utc).isoformat()
    updates = {}
    for field in ["name", "category", "description", "unit_price", "min_threshold", "supplier"]:
        if field in data:
            updates[field] = data[field]

    # Stock adjustment
    if "quantity_change" in data:
        change = int(data["quantity_change"])
        new_qty = max(0, item.get("quantity", 0) + change)
        updates["quantity"] = new_qty
        log_entry = {"type": "adjustment", "change": change, "new_qty": new_qty, "at": now, "by": user.get("name", ""), "reason": data.get("reason", "")}
        await db.receptionist_inventory.update_one(
            {"item_id": item_id}, {"$push": {"movement_log": log_entry}}
        )

    if "quantity" in data and "quantity_change" not in data:
        updates["quantity"] = data["quantity"]

    updates["updated_at"] = now
    await db.receptionist_inventory.update_one({"item_id": item_id}, {"$set": updates})
    updated = await db.receptionist_inventory.find_one({"item_id": item_id}, {"_id": 0})
    return updated


# ─── PROCUREMENT ───
@router.get("/procurement")
async def list_procurement(status: str = None, user: dict = Depends(require_roles(*RECEPTIONIST_ROLES, *MGMT_ROLES))):
    query = {}
    if status:
        query["status"] = status
    reqs = await db.procurement_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return reqs


@router.post("/procurement")
async def create_procurement(data: dict = Body(...), user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    now = datetime.now(timezone.utc).isoformat()
    req_id = gen_id("proc_")
    doc = {
        "request_id": req_id,
        "title": data.get("title", ""),
        "items": data.get("items", []),
        "total_cost": data.get("total_cost", 0),
        "category": data.get("category", "general"),
        "urgency": data.get("urgency", "normal"),
        "supplier": data.get("supplier", ""),
        "notes": data.get("notes", ""),
        "status": "pending",
        "requested_by": user["user_id"],
        "requested_by_name": user.get("name", ""),
        "created_at": now,
        "updated_at": now,
        "approved_by": None,
        "approved_at": None,
    }
    await db.procurement_requests.insert_one(doc)
    doc.pop("_id", None)

    # Notify admin
    admins = await db.users.find({"role": {"$in": list(MGMT_ROLES)}}, {"_id": 0, "user_id": 1}).to_list(10)
    for a in admins:
        await send_notification(db, a["user_id"], {
            "type": "procurement_request",
            "title": "New Procurement Request",
            "message": f"{user.get('name', '')} submitted a procurement request: {data.get('title', '')} (TT$ {data.get('total_cost', 0)})",
            "reference_type": "procurement", "reference_id": req_id,
        })
    return doc


@router.put("/procurement/{request_id}/review")
async def review_procurement(request_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*MGMT_ROLES))):
    req = await db.procurement_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Request not found")

    action = data.get("action", "approve")
    now = datetime.now(timezone.utc).isoformat()
    updates = {
        "status": "approved" if action == "approve" else "rejected",
        "approved_by": user["user_id"],
        "approved_by_name": user.get("name", ""),
        "approved_at": now,
        "review_notes": data.get("notes", ""),
        "updated_at": now,
    }
    await db.procurement_requests.update_one({"request_id": request_id}, {"$set": updates})

    # Notify requester
    await send_notification(db, req["requested_by"], {
        "type": "procurement_review",
        "title": f"Procurement {updates['status'].title()}",
        "message": f"Your request '{req['title']}' has been {updates['status']} by {user.get('name', '')}.",
        "reference_type": "procurement", "reference_id": request_id,
    })
    return {"message": f"Procurement {updates['status']}"}


# ─── UNIFORM BILLING ───
@router.post("/uniform-invoice")


@router.put("/procurement/{request_id}")
async def edit_procurement(request_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*RECEPTIONIST_ROLES, *MGMT_ROLES))):
    """Edit a procurement request — title, items, category, urgency, supplier, notes."""
    req = await db.procurement_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Request not found")

    updates = {}
    for field in ["title", "items", "category", "urgency", "supplier", "notes", "total_cost"]:
        if field in data:
            updates[field] = data[field]

    if "items" in updates:
        updates["total_cost"] = sum(i.get("qty", 0) * i.get("unit_price", 0) for i in updates["items"])

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.procurement_requests.update_one({"request_id": request_id}, {"$set": updates})
    return {"message": "Procurement request updated"}


async def create_uniform_invoice(data: dict = Body(...), user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    """Create a uniform invoice linked to student/parent, synced with accounts."""
    student_id = data.get("student_id")
    if not student_id:
        raise HTTPException(400, "student_id required")

    student = await db.users.find_one({"user_id": student_id}, {"_id": 0, "name": 1, "year_group": 1})
    if not student:
        raise HTTPException(404, "Student not found")

    items = data.get("items", [])
    if not items:
        raise HTTPException(400, "At least one item required")

    # Verify stock availability
    for item in items:
        inv = await db.receptionist_inventory.find_one({"item_id": item.get("item_id")}, {"_id": 0})
        if inv and inv.get("quantity", 0) < item.get("quantity", 1):
            raise HTTPException(400, f"Insufficient stock for {inv.get('name', 'item')} (Available: {inv.get('quantity', 0)})")

    total = sum(i.get("unit_price", 0) * i.get("quantity", 1) for i in items)
    active_term, active_year = await get_active_term()
    now = datetime.now(timezone.utc).isoformat()
    invoice_id = gen_id("uinv_")

    doc = {
        "invoice_id": invoice_id,
        "type": data.get("invoice_type", "uniform"),
        "student_id": student_id,
        "student_name": student.get("name", ""),
        "student_year": student.get("year_group", ""),
        "student_status": data.get("student_status", ""),
        "items": items,
        "total_due": total,
        "amount_paid": 0,
        "balance": total,
        "status": "issued",
        "term": active_term,
        "academic_year": active_year,
        "issued_at": now,
        "issued_by": user["user_id"],
        "issued_by_name": user.get("name", ""),
        "payments": [],
    }
    # Also create in invoices_v2 for accounts sync
    await db.invoices_v2.insert_one({**doc})
    doc.pop("_id", None)

    # Deduct stock
    for item in items:
        if item.get("item_id"):
            qty = item.get("quantity", 1)
            await db.receptionist_inventory.update_one(
                {"item_id": item["item_id"]},
                {"$inc": {"quantity": -qty}, "$push": {"movement_log": {
                    "type": "sold", "change": -qty, "at": now,
                    "by": user.get("name", ""), "reason": f"Uniform invoice {invoice_id}"
                }}}
            )

    return doc


# ─── PARENT COMMUNICATION ───
@router.get("/parents/search")
async def search_parents(q: str = "", user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    """Search parents by name or phone."""
    if not q or len(q) < 2:
        return []
    query = {
        "role": "Parent",
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    }
    parents = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(20)
    return parents


@router.get("/students/search")
async def search_students_r(q: str = "", user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    if not q or len(q) < 2:
        return []
    query = {
        "role": "Student",
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"admission_number": {"$regex": q, "$options": "i"}},
        ]
    }
    students = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(20)
    return students


@router.post("/message")
async def send_parent_message(data: dict = Body(...), user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    """Send a message to specific parent(s) or broadcast."""
    now = datetime.now(timezone.utc).isoformat()
    msg_id = gen_id("rmsg_")
    recipient_ids = data.get("recipient_ids", [])
    is_broadcast = data.get("broadcast", False)

    if is_broadcast:
        parents = await db.users.find({"role": "Parent"}, {"_id": 0, "user_id": 1}).to_list(1000)
        recipient_ids = [p["user_id"] for p in parents]

    if not recipient_ids:
        raise HTTPException(400, "No recipients specified")

    doc = {
        "message_id": msg_id,
        "subject": data.get("subject", ""),
        "body": data.get("body", ""),
        "type": "broadcast" if is_broadcast else "direct",
        "recipient_ids": recipient_ids,
        "attachments": data.get("attachments", []),
        "sent_by": user["user_id"],
        "sent_by_name": user.get("name", ""),
        "sent_at": now,
        "read_by": [],
    }
    await db.receptionist_messages.insert_one(doc)
    doc.pop("_id", None)

    for pid in recipient_ids:
        await send_notification(db, pid, {
            "type": "reception_message",
            "title": data.get("subject", "Message from Reception"),
            "message": data.get("body", "")[:150],
            "reference_type": "reception_message", "reference_id": msg_id,
        })

    return doc


@router.get("/messages")
async def list_messages(user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    messages = await db.receptionist_messages.find({}, {"_id": 0}).sort("sent_at", -1).to_list(100)
    return messages


# ─── ALL INVOICES LIST ───
@router.get("/uniform-items")
async def list_uniform_items(user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    items = await db.receptionist_inventory.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return items


@router.get("/uniform-invoices")
async def list_uniform_invoices(invoice_type: str = None, user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    query = {"type": {"$in": ["uniform", "feeding"]}}
    if invoice_type:
        query = {"type": invoice_type}
    invoices = await db.invoices_v2.find(query, {"_id": 0}).sort("issued_at", -1).to_list(500)
    return invoices


@router.delete("/uniform-invoices/{invoice_id}")
async def delete_uniform_invoice(invoice_id: str, user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    """Delete a uniform or feeding invoice entirely."""
    result = await db.invoices_v2.delete_one({"invoice_id": invoice_id, "type": {"$in": ["uniform", "feeding"]}})
    if result.deleted_count == 0:
        raise HTTPException(404, "Invoice not found")
    return {"message": "Invoice deleted"}




# ─── FEEDING FEE INVOICE ───
@router.post("/feeding-invoice")
async def create_feeding_invoice(data: dict = Body(...), user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    student_id = data.get("student_id")
    if not student_id:
        raise HTTPException(400, "student_id required")
    student = await db.users.find_one({"user_id": student_id}, {"_id": 0, "name": 1, "year_group": 1, "boarding_status": 1})
    if not student:
        raise HTTPException(404, "Student not found")

    weeks = data.get("weeks", [])
    daily_rate = float(data.get("daily_rate", 35))
    days_per_week = int(data.get("days_per_week", 5))
    weekly_total = daily_rate * days_per_week
    total = weekly_total * len(weeks)

    active_term, active_year = await get_active_term()
    now = datetime.now(timezone.utc).isoformat()
    invoice_id = gen_id("finv_")

    doc = {
        "invoice_id": invoice_id,
        "type": "feeding",
        "student_id": student_id,
        "student_name": student.get("name", ""),
        "student_year": student.get("year_group", ""),
        "student_status": data.get("student_status", "Day Student"),
        "daily_rate": daily_rate,
        "days_per_week": days_per_week,
        "weeks": weeks,
        "total_due": total,
        "amount_paid": 0,
        "balance": total,
        "status": "issued",
        "term": active_term,
        "academic_year": active_year,
        "issued_at": now,
        "issued_by": user["user_id"],
        "issued_by_name": user.get("name", ""),
        "payments": [],
    }
    await db.invoices_v2.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/feeding-invoice/{invoice_id}")
async def edit_feeding_invoice(invoice_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    """Edit a feeding invoice — update weeks (exclude midterms/holidays), daily rate, etc."""
    inv = await db.invoices_v2.find_one({"invoice_id": invoice_id, "type": "feeding"}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Feeding invoice not found")

    updates = {}
    if "weeks" in data:
        updates["weeks"] = data["weeks"]
    if "daily_rate" in data:
        updates["daily_rate"] = float(data["daily_rate"])
    if "days_per_week" in data:
        updates["days_per_week"] = int(data["days_per_week"])
    if "excluded_weeks" in data:
        updates["excluded_weeks"] = data["excluded_weeks"]

    # Recalculate total
    daily_rate = updates.get("daily_rate", inv.get("daily_rate", 35))
    days_per_week = updates.get("days_per_week", inv.get("days_per_week", 5))
    weeks = updates.get("weeks", inv.get("weeks", []))
    excluded = set(updates.get("excluded_weeks", inv.get("excluded_weeks", [])))
    active_weeks = [w for w in weeks if w.get("week") not in excluded and w.get("label") not in excluded]
    total = daily_rate * days_per_week * len(active_weeks)

    updates["total_due"] = total
    updates["balance"] = total - inv.get("amount_paid", 0)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.invoices_v2.update_one({"invoice_id": invoice_id}, {"$set": updates})
    return {"message": "Feeding invoice updated", "new_total": total}




# ─── RECORD PAYMENT AGAINST INVOICE ───
@router.post("/invoice-payment")
async def record_invoice_payment(data: dict = Body(...), user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    invoice_id = data.get("invoice_id")
    inv = await db.invoices_v2.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")

    amount = float(data.get("amount", 0))
    if amount <= 0:
        raise HTTPException(400, "Amount must be positive")

    now = datetime.now(timezone.utc).isoformat()
    payment = {
        "payment_id": gen_id("ipay_"),
        "amount": amount,
        "date": data.get("date", now[:10]),
        "reference_id": data.get("reference_id", ""),
        "sender_name": data.get("sender_name", ""),
        "method": data.get("method", "cash"),
        "proof_file_id": data.get("proof_file_id", ""),
        "breakdown_items": data.get("breakdown_items", []),
        "notes": data.get("notes", ""),
        "recorded_by": user.get("name", ""),
        "recorded_at": now,
    }

    new_paid = inv.get("amount_paid", 0) + amount
    new_balance = max(0, inv.get("total_due", 0) - new_paid)
    new_status = "paid" if new_balance <= 0 else "partial"

    await db.invoices_v2.update_one(
        {"invoice_id": invoice_id},
        {"$push": {"payments": payment}, "$set": {"amount_paid": new_paid, "balance": new_balance, "status": new_status}}
    )
    return {"message": "Payment recorded", "new_balance": new_balance, "payment": payment}



@router.put("/invoice-payment/{invoice_id}/{payment_id}")
async def edit_invoice_payment(invoice_id: str, payment_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    """Edit a payment record on an invoice (amount, date, method, breakdown, etc.)."""
    inv = await db.invoices_v2.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")

    payments = inv.get("payments", [])
    idx = next((i for i, p in enumerate(payments) if p.get("payment_id") == payment_id), None)
    if idx is None:
        raise HTTPException(404, "Payment not found on this invoice")

    # Update allowed fields
    for field in ["amount", "date", "reference_id", "sender_name", "method", "proof_file_id", "breakdown_items", "notes"]:
        if field in data:
            payments[idx][field] = float(data[field]) if field == "amount" else data[field]

    new_total_paid = sum(p.get("amount", 0) for p in payments)
    new_balance = max(0, inv.get("total_due", 0) - new_total_paid)
    new_status = "paid" if new_balance <= 0 else ("partial" if new_total_paid > 0 else "issued")

    await db.invoices_v2.update_one(
        {"invoice_id": invoice_id},
        {"$set": {"payments": payments, "amount_paid": new_total_paid, "balance": new_balance, "status": new_status}}
    )
    return {"message": "Payment updated", "new_balance": new_balance}


@router.delete("/invoice-payment/{invoice_id}/{payment_id}")
async def delete_invoice_payment(invoice_id: str, payment_id: str, user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    """Delete a payment record from an invoice and recalculate balance."""
    inv = await db.invoices_v2.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")

    payments = inv.get("payments", [])
    new_payments = [p for p in payments if p.get("payment_id") != payment_id]
    if len(new_payments) == len(payments):
        raise HTTPException(404, "Payment not found on this invoice")

    new_total_paid = sum(p.get("amount", 0) for p in new_payments)
    new_balance = max(0, inv.get("total_due", 0) - new_total_paid)
    new_status = "paid" if new_balance <= 0 else ("partial" if new_total_paid > 0 else "issued")

    await db.invoices_v2.update_one(
        {"invoice_id": invoice_id},
        {"$set": {"payments": new_payments, "amount_paid": new_total_paid, "balance": new_balance, "status": new_status}}
    )
    return {"message": "Payment deleted", "new_balance": new_balance}



# ─── TAILORS' PAYMENTS RECORD ───
@router.get("/tailor-payments")
async def list_tailor_payments(user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    payments = await db.tailor_payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return payments


@router.post("/tailor-payments")
async def record_tailor_payment(data: dict = Body(...), user: dict = Depends(require_roles(*RECEPTIONIST_ROLES))):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "payment_id": gen_id("tp_"),
        "student_name": data.get("student_name", ""),
        "tailor_type": data.get("tailor_type", "tailor"),
        "breakdown": data.get("breakdown", ""),
        "amount": float(data.get("amount", 0)),
        "payment_date": data.get("payment_date", now[:10]),
        "recorded_by": user.get("name", ""),
        "created_at": now,
    }
    await db.tailor_payments.insert_one(doc)
    doc.pop("_id", None)
    return doc



# ─── PARENT-FACING ENDPOINTS ───
@router.get("/parent/messages")
async def parent_messages(user: dict = Depends(get_current_user)):
    """Get all reception messages sent to this parent (direct + broadcasts)."""
    if user.get("role") not in ("Parent", "Admin", "SuperAdmin", "CEO"):
        raise HTTPException(403, "Parents only")
    uid = user["user_id"]
    messages = await db.receptionist_messages.find(
        {"$or": [{"recipient_ids": uid}, {"type": "broadcast"}]},
        {"_id": 0}
    ).sort("sent_at", -1).to_list(100)
    return messages


@router.get("/parent/bills")
async def parent_bills(user: dict = Depends(get_current_user)):
    """Get uniform/item bills for this parent's children."""
    if user.get("role") not in ("Parent", "Admin", "SuperAdmin", "CEO"):
        raise HTTPException(403, "Parents only")
    child_ids = user.get("children_ids", [])
    if not child_ids:
        return []
    bills = await db.invoices_v2.find(
        {"type": "uniform", "student_id": {"$in": child_ids}},
        {"_id": 0}
    ).sort("issued_at", -1).to_list(100)
    return bills


@router.get("/parent/updates")
async def parent_reception_updates(user: dict = Depends(get_current_user)):
    """Combined feed: recent messages + bills for parent dashboard."""
    if user.get("role") not in ("Parent", "Admin", "SuperAdmin", "CEO"):
        raise HTTPException(403, "Parents only")
    uid = user["user_id"]
    child_ids = user.get("children_ids", [])

    messages = await db.receptionist_messages.find(
        {"$or": [{"recipient_ids": uid}, {"type": "broadcast"}]},
        {"_id": 0}
    ).sort("sent_at", -1).to_list(20)

    bills = []
    if child_ids:
        bills = await db.invoices_v2.find(
            {"type": {"$in": ["uniform", "feeding"]}, "student_id": {"$in": child_ids}},
            {"_id": 0}
        ).sort("issued_at", -1).to_list(50)

    msg_count = len(messages)
    bill_count = len(bills)
    total_billed = sum(b.get("total_due", 0) for b in bills)
    total_paid = sum(b.get("amount_paid", 0) for b in bills)

    return {
        "message_count": msg_count,
        "bill_count": bill_count,
        "total_billed": total_billed,
        "total_paid": total_paid,
        "outstanding": total_billed - total_paid,
        "messages": messages,
        "bills": bills,
    }


# ─── PARENT PAYMENT SUBMISSION ───
@router.post("/parent/pay")
async def parent_submit_payment(data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Parent records a payment (MoMo/Bank) against a bill."""
    if user.get("role") not in ("Parent", "Admin", "SuperAdmin", "CEO"):
        raise HTTPException(403, "Parents only")
    invoice_id = data.get("invoice_id")
    inv = await db.invoices_v2.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")

    amount = float(data.get("amount", 0))
    if amount <= 0:
        raise HTTPException(400, "Amount must be positive")

    now = datetime.now(timezone.utc).isoformat()
    payment = {
        "payment_id": gen_id("ppay_"),
        "amount": amount,
        "date": data.get("date", now[:10]),
        "reference_id": data.get("reference_id", ""),
        "sender_name": data.get("sender_name", user.get("name", "")),
        "method": data.get("method", "momo"),
        "proof_file_id": data.get("proof_file_id", ""),
        "recorded_by": user.get("name", ""),
        "recorded_at": now,
        "source": "parent_portal",
    }

    new_paid = inv.get("amount_paid", 0) + amount
    new_balance = max(0, inv.get("total_due", 0) - new_paid)
    new_status = "paid" if new_balance <= 0 else "partial"

    await db.invoices_v2.update_one(
        {"invoice_id": invoice_id},
        {"$push": {"payments": payment}, "$set": {"amount_paid": new_paid, "balance": new_balance, "status": new_status}}
    )

    # Notify receptionist
    admins = await db.users.find({"role": {"$in": ["Receptionist", "Admin", "SuperAdmin"]}}, {"_id": 0, "user_id": 1}).to_list(20)
    for a in admins:
        await send_notification(db, a["user_id"], {
            "type": "parent_payment",
            "title": f"Payment from {user.get('name', 'Parent')}",
            "message": f"TT$ {amount} via {data.get('method', 'momo')} for {inv.get('student_name', '')}",
            "reference_type": "invoice_payment", "reference_id": invoice_id,
        })

    return {"message": "Payment submitted", "new_balance": new_balance}


# ─── PDF INVOICE ───
@router.get("/parent/invoice/{invoice_id}/pdf")
async def generate_invoice_pdf(invoice_id: str, request: Request, token: str = None):
    """Generate a printable PDF invoice matching TCIS letterhead."""
    # Auth: accept token from query param OR Authorization header
    auth_token = token
    if not auth_token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            auth_token = auth_header.split(" ")[1]
    if not auth_token:
        raise HTTPException(401, "Not authenticated")
    import jwt
    import os
    try:
        jwt.decode(auth_token, os.environ.get("JWT_SECRET"), algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "Invalid token")

    inv = await db.invoices_v2.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")

    from fpdf import FPDF
    import io

    import os as _os
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Logo
    _logo = _os.path.join(_os.path.dirname(__file__), "..", "main_logo.png")
    if _os.path.exists(_logo):
        pdf.image(_logo, x=85, y=8, w=40, h=40)
        pdf.ln(42)
    else:
        pdf.ln(5)

    # Header
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 8, "The RightWay Centre of Learning", ln=True, align="C")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, "Where Every Child Thrives  |  learnrightschool.com", ln=True, align="C")
    pdf.ln(5)

    # Invoice title
    inv_type = inv.get("type", "uniform").upper()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, f"{inv_type}S INVOICE", ln=True, align="C")
    pdf.ln(3)

    # Student info
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(50, 7, "Name of Student:", border=0)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, inv.get("student_name", ""), ln=True)
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(50, 7, "Year:", border=0)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(40, 7, str(inv.get("student_year", "")), border=0)
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(30, 7, "Status:", border=0)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, inv.get("student_status", ""), ln=True)
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(50, 7, "Term:", border=0)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(40, 7, f"{inv.get('term', '')} {inv.get('academic_year', '')}", border=0)
    pdf.set_font("Helvetica", "", 11)
    pdf.cell(30, 7, "Date:", border=0)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, inv.get("issued_at", "")[:10] if inv.get("issued_at") else "", ln=True)
    pdf.ln(5)

    # Items table header
    pdf.set_fill_color(27, 42, 74)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(15, 8, "NO.", border=1, align="C", fill=True)
    pdf.cell(120, 8, "ITEMS", border=1, fill=True)
    pdf.cell(55, 8, "Amount (TT$)", border=1, align="R", fill=True)
    pdf.ln()

    # Items
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 10)
    items = inv.get("items", [])
    for i, item in enumerate(items):
        name = item.get("name", item.get("description", ""))
        qty = item.get("quantity", 1)
        price = item.get("unit_price", 0)
        total_item = qty * price
        desc = f"{name}"
        if qty > 1:
            desc += f" (x{qty} @ TT$ {price:,.2f})"
        pdf.cell(15, 7, str(i + 1), border=1, align="C")
        pdf.cell(120, 7, desc, border=1)
        pdf.cell(55, 7, f"TT$ {total_item:,.2f}", border=1, align="R")
        pdf.ln()

    # Total
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(135, 9, "TOTAL", border=1, align="R")
    pdf.cell(55, 9, f"TT$ {inv.get('total_due', 0):,.2f}", border=1, align="R")
    pdf.ln(5)

    # Payment status
    paid = inv.get("amount_paid", 0)
    balance = inv.get("balance", inv.get("total_due", 0) - paid)
    if paid > 0:
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(135, 7, "Amount Paid:", border=0, align="R")
        pdf.cell(55, 7, f"TT$ {paid:,.2f}", border=0, align="R")
        pdf.ln()
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(135, 7, "Balance:", border=0, align="R")
        pdf.set_text_color(220, 38, 38) if balance > 0 else pdf.set_text_color(22, 163, 74)
        pdf.cell(55, 7, f"TT$ {balance:,.2f}", border=0, align="R")
        pdf.set_text_color(0, 0, 0)
        pdf.ln()
    pdf.ln(8)

    # Payment details
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "PAYMENT DETAILS", ln=True)
    pdf.set_draw_color(197, 165, 90)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "MOMO DETAILS", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, "School's Merchant Number (MTN): 727799", ln=True)
    pdf.cell(0, 6, "Name: The RightWay Centre of Learning", ln=True)
    pdf.cell(0, 6, "Other Networks: 0593227076 - Olivia Titi-Ofei", ln=True)
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "BANK DETAILS", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, "Uniform Account: 3220001035433", ln=True)
    pdf.cell(0, 6, "Bank: GT BANK", ln=True)
    pdf.cell(0, 6, "Name of Depositor: WARD'S NAME", ln=True)

    # Output
    from fastapi.responses import Response
    pdf_bytes = pdf.output()
    return Response(content=bytes(pdf_bytes), media_type="application/pdf", headers={
        "Content-Disposition": f'inline; filename="TCIS_Invoice_{invoice_id}.pdf"'
    })

