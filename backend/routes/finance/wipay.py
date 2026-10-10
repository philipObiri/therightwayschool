"""
WiPay Caribbean Payment Gateway Integration
============================================
Handles TTD online payments for school fees via WiPay's Hosted Payment Page.

Flow:
  1. POST /api/wipay/initiate  → backend calls WiPay API → returns redirect_url
  2. Frontend redirects parent browser to redirect_url (WiPay HPP)
  3. Parent enters card on WiPay's secure server (3-D Secure)
  4. WiPay POSTs callback to /api/wipay/callback  (server-to-server)
  5. WiPay redirects browser to /api/wipay/return (GET)
  6. Backend verifies MD5 hash → marks invoice paid → emails receipt
"""

import hashlib
import os
import httpx
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from database import db
from auth import get_current_user, log_audit
from models import gen_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/wipay", tags=["WiPay Payments"])

# ── Config ────────────────────────────────────────────────────────────────────

WIPAY_DEVELOPER_ID  = os.environ.get("WIPAY_DEVELOPER_ID", "1")
WIPAY_MERCHANT_KEY  = os.environ.get("WIPAY_MERCHANT_KEY", "123")
WIPAY_BASE_URL      = os.environ.get("WIPAY_BASE_URL", "https://wipaycaribbean.com/api/v1.4")
WIPAY_RETURN_URL    = os.environ.get("WIPAY_RETURN_URL", "http://localhost:8000/api/wipay/return")
WIPAY_CALLBACK_URL  = os.environ.get("WIPAY_CALLBACK_URL", "http://localhost:8000/api/wipay/callback")
WIPAY_SANDBOX       = os.environ.get("WIPAY_SANDBOX", "true").lower() == "true"
FRONTEND_URL        = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")[0].strip()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _verify_hash(fields: list[str], received_hash: str) -> bool:
    """
    WiPay hash verification: MD5 of all mandatory response fields
    concatenated in order, with merchant key appended.
    """
    raw = "".join(str(f) for f in fields) + WIPAY_MERCHANT_KEY
    computed = hashlib.md5(raw.encode()).hexdigest()
    return computed == received_hash


def _format_amount(amount: float) -> str:
    """Format to 2 decimal places as string for WiPay API."""
    return f"{amount:.2f}"


async def _send_payment_confirmation(invoice_id: str, amount: float, order_id: str):
    """Send email receipt to parent after successful payment."""
    try:
        invoice = await db.invoices_v2.find_one({"invoice_id": invoice_id})
        if not invoice:
            return
        student = await db.students.find_one({"student_id": invoice.get("student_id")})
        parent_email = invoice.get("parent_email") or (
            student.get("parent_email") if student else None
        )
        if not parent_email:
            return

        email_log = os.environ.get("EMAIL_LOG_FILE", "./email.log")
        msg = (
            f"\n[{datetime.now()}] WIPAY PAYMENT RECEIPT\n"
            f"  Order:   {order_id}\n"
            f"  Invoice: {invoice_id}\n"
            f"  Amount:  TT$ {amount:,.2f}\n"
            f"  To:      {parent_email}\n"
            f"  Status:  PAID\n"
        )
        with open(email_log, "a") as f:
            f.write(msg)
        logger.info("Payment confirmation logged for %s", parent_email)
    except Exception as exc:
        logger.warning("Email confirmation failed: %s", exc)


# ── Schemas ───────────────────────────────────────────────────────────────────

class InitiatePaymentRequest(BaseModel):
    invoice_id: str
    customer_name: str
    customer_email: str
    customer_phone: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/initiate")
async def initiate_payment(body: InitiatePaymentRequest, request: Request):
    """
    Create a WiPay payment session for an invoice.
    Returns a redirect_url to send the parent to WiPay's Hosted Payment Page.
    """
    user = await get_current_user(request)

    # Fetch invoice
    invoice = await db.invoices_v2.find_one({"invoice_id": body.invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Invoice is already paid")

    amount = float(invoice.get("total_due") or invoice.get("amount_due") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invoice amount must be greater than zero")

    # Generate unique order_id
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    order_id = f"RW-{body.invoice_id[-8:]}-{ts}"

    # Store pending payment record
    payment_record = {
        "wipay_payment_id": gen_id("wpay"),
        "order_id":         order_id,
        "invoice_id":       body.invoice_id,
        "amount":           amount,
        "currency":         "TTD",
        "status":           "pending",
        "customer_name":    body.customer_name,
        "customer_email":   body.customer_email,
        "customer_phone":   body.customer_phone,
        "initiated_by":     user["user_id"],
        "created_at":       datetime.now(timezone.utc).isoformat(),
    }
    await db.wipay_payments.insert_one(payment_record)

    # Call WiPay API
    payload = {
        "developer_id": WIPAY_DEVELOPER_ID,
        "total":        _format_amount(amount),
        "phone":        body.customer_phone,
        "email":        body.customer_email,
        "name":         body.customer_name,
        "order_id":     order_id,
        "return_url":   WIPAY_RETURN_URL,
        "currency":     "TTD",
        "sandbox":      "1" if WIPAY_SANDBOX else "0",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{WIPAY_BASE_URL}/transactions/create", data=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        logger.error("WiPay API error: %s", exc)
        raise HTTPException(status_code=502, detail="WiPay payment gateway unavailable. Please try again.")

    redirect_url = data.get("url") or data.get("redirect_url")
    if not redirect_url:
        logger.error("WiPay response missing redirect URL: %s", data)
        raise HTTPException(status_code=502, detail="WiPay did not return a payment URL.")

    # Update record with WiPay's transaction reference
    await db.wipay_payments.update_one(
        {"order_id": order_id},
        {"$set": {"wipay_ref": data.get("transaction_id", ""), "redirect_url": redirect_url}}
    )

    await log_audit(user["user_id"], "initiate_wipay_payment", "invoice", body.invoice_id)

    return {
        "order_id":     order_id,
        "redirect_url": redirect_url,
        "amount":       amount,
        "currency":     "TTD",
        "sandbox":      WIPAY_SANDBOX,
    }


@router.post("/callback")
async def payment_callback(request: Request):
    """
    WiPay server-to-server callback.
    Verifies the MD5 hash and marks the invoice as paid on success.
    Always returns 200 so WiPay doesn't retry.
    """
    try:
        form = await request.form()
        data = dict(form)
    except Exception:
        data = {}

    order_id       = data.get("order_id", "")
    status         = data.get("status", "")
    received_hash  = data.get("hash", "")
    transaction_id = data.get("transaction_id", "")
    amount_str     = data.get("total", "0")

    logger.info("WiPay callback received: order=%s status=%s", order_id, status)

    # Find pending payment record
    record = await db.wipay_payments.find_one({"order_id": order_id})
    if not record:
        logger.warning("WiPay callback: unknown order_id %s", order_id)
        return {"received": True}

    # Verify MD5 hash
    # Fields order per WiPay docs: transaction_id, order_id, total, status
    hash_valid = _verify_hash(
        [transaction_id, order_id, amount_str, status],
        received_hash,
    )

    if not hash_valid:
        logger.error("WiPay callback: HASH MISMATCH for order %s — possible fraud", order_id)
        await db.wipay_payments.update_one(
            {"order_id": order_id},
            {"$set": {"status": "hash_mismatch", "raw_callback": data}}
        )
        return {"received": True}

    if status.lower() == "success":
        amount = float(amount_str or record.get("amount", 0))
        invoice_id = record["invoice_id"]

        # Mark invoice paid
        await db.invoices_v2.update_one(
            {"invoice_id": invoice_id},
            {"$set": {
                "status":        "paid",
                "paid_at":       datetime.now(timezone.utc).isoformat(),
                "payment_method": "wipay",
            }}
        )

        # Insert payment record
        payment_doc = {
            "payment_id":     gen_id("pay"),
            "invoice_id":     invoice_id,
            "amount":         amount,
            "currency":       "TTD",
            "method":         "wipay",
            "wipay_order_id": order_id,
            "transaction_id": transaction_id,
            "status":         "completed",
            "paid_at":        datetime.now(timezone.utc).isoformat(),
        }
        await db.payments.insert_one(payment_doc)

        # Update wipay_payments record
        await db.wipay_payments.update_one(
            {"order_id": order_id},
            {"$set": {
                "status":         "completed",
                "transaction_id": transaction_id,
                "completed_at":   datetime.now(timezone.utc).isoformat(),
                "raw_callback":   data,
            }}
        )

        # Send email receipt
        await _send_payment_confirmation(invoice_id, amount, order_id)
        logger.info("WiPay payment SUCCESS: order=%s invoice=%s amount=TT$ %.2f", order_id, invoice_id, amount)

    else:
        # Payment failed or cancelled
        await db.wipay_payments.update_one(
            {"order_id": order_id},
            {"$set": {
                "status":       "failed",
                "fail_reason":  status,
                "raw_callback": data,
                "failed_at":    datetime.now(timezone.utc).isoformat(),
            }}
        )
        logger.warning("WiPay payment FAILED: order=%s status=%s", order_id, status)

    return {"received": True}


@router.get("/return")
async def payment_return(request: Request):
    """
    Browser return URL — WiPay redirects the parent back here after payment.
    We redirect to the frontend payment-status page.
    """
    params    = dict(request.query_params)
    order_id  = params.get("order_id", "")
    status    = params.get("status", "unknown")

    redirect_to = f"{FRONTEND_URL}/dashboard/payment-status?order_id={order_id}&status={status}"
    return RedirectResponse(url=redirect_to, status_code=302)


@router.get("/status/{order_id}")
async def get_payment_status(order_id: str, request: Request):
    """
    Query the status of a WiPay payment by order_id.
    Used by the frontend payment-status page to show the result.
    """
    await get_current_user(request)

    record = await db.wipay_payments.find_one({"order_id": order_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Payment record not found")

    return {
        "order_id":       record.get("order_id"),
        "invoice_id":     record.get("invoice_id"),
        "amount":         record.get("amount"),
        "currency":       "TTD",
        "status":         record.get("status"),
        "transaction_id": record.get("transaction_id"),
        "completed_at":   record.get("completed_at"),
        "sandbox":        WIPAY_SANDBOX,
    }


@router.get("/payments")
async def list_wipay_payments(request: Request, limit: int = 50, skip: int = 0):
    """
    Admin: list all WiPay payment records (newest first).
    """
    user = await get_current_user(request)
    if user["role"] not in ["Admin", "SuperAdmin", "CEO", "Founder", "Principal", "FinanceOfficer"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    payments = await db.wipay_payments.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.wipay_payments.count_documents({})
    return {"payments": payments, "total": total}
