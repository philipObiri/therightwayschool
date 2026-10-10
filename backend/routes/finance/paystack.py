"""Paystack payment gateway integration for TCIS LMS."""
import os
import hmac
import hashlib
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Body
from database import db, get_active_term
from models import gen_id
from auth import get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/api/paystack", tags=["paystack"])

PAYSTACK_SECRET_KEY = os.environ.get("PAYSTACK_SECRET_KEY", "")
PAYSTACK_PUBLIC_KEY = os.environ.get("PAYSTACK_PUBLIC_KEY", "")
PAYSTACK_BASE_URL = "https://api.paystack.co"


def paystack_headers():
    return {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }


@router.get("/public-key")
async def get_public_key(user: dict = Depends(get_current_user)):
    """Return the public key for frontend Paystack inline integration."""
    return {"public_key": PAYSTACK_PUBLIC_KEY}


@router.post("/initialize")
async def initialize_payment(data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Initialize a Paystack transaction for fee payment."""
    amount = data.get("amount", 0)
    if amount <= 0:
        raise HTTPException(400, "Amount must be greater than 0")

    student_id = data.get("student_id", "")
    email = data.get("email", user.get("email", ""))
    callback_url = data.get("callback_url", "")

    if not email:
        raise HTTPException(400, "Email is required")

    # Paystack requires a valid email format — use fallback for demo/test accounts
    if email.endswith(".demo") or "." not in email.split("@")[-1]:
        email = f"parent_{user['user_id'][-6:]}@tcis.edu.gh"

    student_name = ""
    if student_id:
        stu = await db.users.find_one({"user_id": student_id}, {"_id": 0, "name": 1})
        student_name = stu.get("name", "") if stu else ""

    reference = f"TCIS_{gen_id('txn_')}"
    amount_pesewas = int(round(amount * 100))

    active_term, active_year = await get_active_term()

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{PAYSTACK_BASE_URL}/transaction/initialize",
            headers=paystack_headers(),
            json={
                "email": email,
                "amount": amount_pesewas,
                "reference": reference,
                "currency": "TTD",
                "callback_url": callback_url,
                "metadata": {
                    "student_id": student_id,
                    "student_name": student_name,
                    "parent_id": user["user_id"],
                    "parent_name": user.get("name", ""),
                    "term": active_term,
                    "academic_year": active_year,
                    "custom_fields": [
                        {"display_name": "Student", "variable_name": "student", "value": student_name},
                        {"display_name": "Term", "variable_name": "term", "value": active_term},
                    ]
                }
            }
        )
        result = response.json()

    if not result.get("status"):
        raise HTTPException(400, result.get("message", "Failed to initialize payment"))

    # Save pending transaction
    txn = {
        "txn_id": gen_id("ptxn_"),
        "reference": result["data"]["reference"],
        "access_code": result["data"].get("access_code", ""),
        "authorization_url": result["data"]["authorization_url"],
        "amount": amount,
        "amount_pesewas": amount_pesewas,
        "currency": "TTD",
        "email": email,
        "student_id": student_id,
        "student_name": student_name,
        "parent_id": user["user_id"],
        "parent_name": user.get("name", ""),
        "status": "pending",
        "term": active_term,
        "academic_year": active_year,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.paystack_transactions.insert_one(txn)

    return {
        "authorization_url": result["data"]["authorization_url"],
        "access_code": result["data"].get("access_code", ""),
        "reference": result["data"]["reference"],
    }


@router.get("/verify/{reference}")
async def verify_payment(reference: str, user: dict = Depends(get_current_user)):
    """Verify a Paystack transaction and record payment if successful."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
            headers=paystack_headers(),
        )
        result = response.json()

    if not result.get("status"):
        raise HTTPException(400, "Verification failed")

    txn_data = result["data"]
    ps_status = txn_data.get("status", "")

    # Update our transaction record
    await db.paystack_transactions.update_one(
        {"reference": reference},
        {"$set": {
            "status": ps_status,
            "paystack_response": {
                "gateway_response": txn_data.get("gateway_response", ""),
                "channel": txn_data.get("channel", ""),
                "ip_address": txn_data.get("ip_address", ""),
                "paid_at": txn_data.get("paid_at", ""),
                "authorization": txn_data.get("authorization", {}),
            },
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    if ps_status == "success":
        # Record as a payment in the finance system
        txn = await db.paystack_transactions.find_one({"reference": reference}, {"_id": 0})
        if txn and txn.get("student_id"):
            await _record_finance_payment(txn)

        return {"status": "success", "message": "Payment verified and recorded", "data": {
            "amount": txn_data.get("amount", 0) / 100,
            "reference": reference,
            "channel": txn_data.get("channel", ""),
            "paid_at": txn_data.get("paid_at", ""),
        }}

    return {"status": "failed", "message": txn_data.get("gateway_response", "Payment failed")}


@router.post("/webhook")
async def paystack_webhook(request: Request):
    """Handle Paystack webhook events."""
    signature = request.headers.get("x-paystack-signature", "")
    body = await request.body()

    # Verify signature
    computed = hmac.new(
        PAYSTACK_SECRET_KEY.encode("utf-8"),
        body,
        hashlib.sha512,
    ).hexdigest()

    if not hmac.compare_digest(computed, signature):
        raise HTTPException(401, "Invalid signature")

    event = await request.json()
    event_type = event.get("event", "")

    if event_type == "charge.success":
        ref = event["data"].get("reference", "")
        txn = await db.paystack_transactions.find_one({"reference": ref}, {"_id": 0})
        if txn and txn.get("status") != "success":
            await db.paystack_transactions.update_one(
                {"reference": ref},
                {"$set": {"status": "success", "webhook_received_at": datetime.now(timezone.utc).isoformat()}}
            )
            if txn.get("student_id"):
                await _record_finance_payment(txn)

    return {"status": "ok"}


@router.get("/transactions")
async def list_transactions(student_id: str = None, user: dict = Depends(get_current_user)):
    """List Paystack transactions for a user or student."""
    query = {}
    if user.get("role") == "Parent":
        query["parent_id"] = user["user_id"]
    elif student_id:
        query["student_id"] = student_id

    txns = await db.paystack_transactions.find(query, {"_id": 0, "paystack_response": 0}).sort("created_at", -1).to_list(100)
    return txns


async def _record_finance_payment(txn: dict):
    """Create a payment record in the finance system from a successful Paystack transaction."""
    # Check if already recorded
    existing = await db.payments_v2.find_one({"reference": txn["reference"]})
    if existing:
        return

    now = datetime.now(timezone.utc).isoformat()
    pay_id = gen_id("pay_")

    doc = {
        "payment_id": pay_id,
        "received_at": now,
        "payment_date": now[:10],
        "method": "card",
        "bank": "Paystack",
        "amount": txn["amount"],
        "reference": txn["reference"],
        "payer_name": txn.get("parent_name", txn.get("student_name", "")),
        "student_id": txn.get("student_id", ""),
        "student_name": txn.get("student_name", ""),
        "status": "matched" if txn.get("student_id") else "unmatched",
        "proof_file_id": "",
        "unallocated_amount": txn["amount"],
        "term": txn.get("term", ""),
        "academic_year": txn.get("academic_year", ""),
        "created_by": txn.get("parent_id", "system"),
        "created_at": now,
        "paystack_reference": txn["reference"],
    }
    await db.payments_v2.insert_one(doc)

    # Auto-allocate to oldest unpaid invoices
    student_id = txn.get("student_id", "")
    amount = txn["amount"]
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
                "allocation_id": alloc_id,
                "payment_id": pay_id, "invoice_id": inv["invoice_id"],
                "amount": alloc_amount, "type": "auto",
                "created_at": now, "created_by": txn.get("parent_id", "system"),
            })
            new_paid = inv.get("amount_paid", 0) + alloc_amount
            new_status = "paid" if new_paid >= inv.get("total_due", 0) else "partial"
            await db.invoices_v2.update_one(
                {"invoice_id": inv["invoice_id"]},
                {"$set": {"amount_paid": new_paid, "status": new_status}}
            )
            remaining -= alloc_amount

        await db.payments_v2.update_one(
            {"payment_id": pay_id},
            {"$set": {
                "unallocated_amount": remaining,
                "status": "allocated" if remaining == 0 else "matched",
            }}
        )
