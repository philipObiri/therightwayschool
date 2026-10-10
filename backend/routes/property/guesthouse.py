"""The RightWay Centre of Learning Management System - Room management, bookings, payments, analytics."""
from fastapi import APIRouter, Depends, HTTPException, Body
from database import db, get_active_term
from models import gen_id
from auth import get_current_user, require_roles, log_audit
from ws_manager import send_notification
from datetime import datetime, timezone, timedelta
import math

router = APIRouter(prefix="/api/guesthouse", tags=["guesthouse"])

GH_ROLES = ("Receptionist", "Admin", "SuperAdmin", "CEO", "Founder")
ADMIN_ROLES = ("Admin", "SuperAdmin", "CEO", "Founder")
DEFAULT_RATE = 350
MIN_RATE = 100
MAX_RATE = 1500

ROOMS = []
for floor in [2, 3, 4]:
    for i in range(1, 11):
        ROOMS.append({
            "room_number": f"{floor}{i:02d}",
            "floor": floor,
            "bed_capacity": 1,
        })


# ─── SEED ROOMS ───
async def ensure_rooms():
    """Always enforce exactly 30 rooms: 10 per floor (2,3,4). Deduplicates on every call."""
    # Create unique index to prevent duplicates
    try:
        await db.gh_rooms.create_index("room_number", unique=True)
    except Exception:
        pass

    # Count per floor
    floor2 = await db.gh_rooms.count_documents({"floor": 2})
    floor3 = await db.gh_rooms.count_documents({"floor": 3})
    floor4 = await db.gh_rooms.count_documents({"floor": 4})
    total = await db.gh_rooms.count_documents({})

    if floor2 == 10 and floor3 == 10 and floor4 == 10 and total == 30:
        return  # All good

    # Something is wrong - save occupied rooms, wipe, re-seed
    occupied = await db.gh_rooms.find({"status": "occupied"}, {"_id": 0, "room_number": 1, "status": 1, "current_booking_id": 1}).to_list(50)
    occupied_map = {o["room_number"]: o for o in occupied}

    await db.gh_rooms.drop()
    await db.gh_rooms.create_index("room_number", unique=True)

    now = datetime.now(timezone.utc).isoformat()
    for r in ROOMS:
        old = occupied_map.get(r["room_number"])
        await db.gh_rooms.insert_one({
            "room_id": gen_id("rm_"),
            "room_number": r["room_number"],
            "floor": r["floor"],
            "bed_capacity": r["bed_capacity"],
            "status": old["status"] if old else "available",
            "current_booking_id": old.get("current_booking_id") if old else None,
            "created_at": now,
        })


# ─── FORCE RESET ROOMS (for migration) ───
@router.post("/rooms/reset")
async def force_reset_rooms(user: dict = Depends(require_roles(*GH_ROLES))):
    """Force delete all rooms and re-seed with correct 10-per-floor layout."""
    occupied = await db.gh_rooms.find({"status": "occupied"}, {"_id": 0}).to_list(50)
    deleted = await db.gh_rooms.delete_many({})
    now = datetime.now(timezone.utc).isoformat()
    for r in ROOMS:
        old_match = next((o for o in occupied if o["room_number"] == r["room_number"]), None)
        await db.gh_rooms.insert_one({
            "room_id": gen_id("rm_"),
            "room_number": r["room_number"],
            "floor": r["floor"],
            "bed_capacity": r["bed_capacity"],
            "status": old_match["status"] if old_match else "available",
            "current_booking_id": old_match.get("current_booking_id") if old_match else None,
            "created_at": now,
        })
    return {"message": f"Rooms reset. Deleted {deleted.deleted_count} old rooms, created {len(ROOMS)} new rooms (10 per floor, floors 2/3/4)"}



# ─── DASHBOARD ───
@router.get("/dashboard")
async def gh_dashboard(user: dict = Depends(require_roles(*GH_ROLES))):
    await ensure_rooms()
    total = await db.gh_rooms.count_documents({})
    occupied = await db.gh_rooms.count_documents({"status": "occupied"})
    available = await db.gh_rooms.count_documents({"status": "available"})
    reserved = await db.gh_rooms.count_documents({"status": "reserved"})
    maintenance = await db.gh_rooms.count_documents({"status": "maintenance"})

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_checkins = await db.gh_bookings.count_documents({"check_in_date": today, "status": "checked_in"})
    today_checkouts = await db.gh_bookings.count_documents({"actual_checkout": {"$regex": f"^{today}"}})

    # Revenue
    pipeline = [{"$match": {"status": "completed"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    rev = await db.gh_payments.aggregate(pipeline).to_list(1)
    total_revenue = rev[0]["total"] if rev else 0

    pending_pipeline = [{"$match": {"status": {"$in": ["checked_in", "reserved"]}}}, {"$group": {"_id": None, "total": {"$sum": "$outstanding"}}}]
    pend = await db.gh_bookings.aggregate(pending_pipeline).to_list(1)
    outstanding = pend[0]["total"] if pend else 0

    recent_bookings = await db.gh_bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)

    return {
        "total_rooms": total, "occupied": occupied, "available": available,
        "reserved": reserved, "maintenance": maintenance,
        "today_checkins": today_checkins, "today_checkouts": today_checkouts,
        "total_revenue": total_revenue, "outstanding": outstanding,
        "occupancy_rate": round((occupied / total * 100) if total else 0, 1),
        "recent_bookings": recent_bookings,
        "default_rate": DEFAULT_RATE,
    }


# ─── ROOMS ───
@router.get("/rooms")
async def list_rooms(floor: int = None, status: str = None, user: dict = Depends(require_roles(*GH_ROLES))):
    await ensure_rooms()
    query = {}
    if floor:
        query["floor"] = floor
    if status:
        query["status"] = status
    rooms = await db.gh_rooms.find(query, {"_id": 0}).sort("room_number", 1).to_list(50)
    return rooms


@router.put("/rooms/{room_id}/status")
async def update_room_status(room_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*GH_ROLES))):
    new_status = data.get("status")
    if new_status not in ("available", "maintenance", "reserved"):
        raise HTTPException(400, "Invalid status")
    room = await db.gh_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(404, "Room not found")
    if room["status"] == "occupied":
        raise HTTPException(400, "Cannot change status of occupied room. Check out guest first.")
    await db.gh_rooms.update_one({"room_id": room_id}, {"$set": {"status": new_status}})
    await log_audit(user["user_id"], user.get("name", ""), "room_status_change", "gh_room", room_id, {"old": room["status"], "new": new_status})
    return {"message": f"Room {room['room_number']} set to {new_status}"}


# ─── PRICING ───
@router.get("/pricing")
async def get_pricing(user: dict = Depends(require_roles(*GH_ROLES))):
    config = await db.gh_config.find_one({"key": "pricing"}, {"_id": 0})
    if not config:
        return {"default_rate": DEFAULT_RATE, "min_rate": MIN_RATE, "max_rate": MAX_RATE}
    return config.get("value", {"default_rate": DEFAULT_RATE, "min_rate": MIN_RATE, "max_rate": MAX_RATE})


@router.put("/pricing")
async def update_pricing(data: dict = Body(...), user: dict = Depends(require_roles(*ADMIN_ROLES))):
    now = datetime.now(timezone.utc).isoformat()
    value = {
        "default_rate": data.get("default_rate", DEFAULT_RATE),
        "min_rate": data.get("min_rate", MIN_RATE),
        "max_rate": data.get("max_rate", MAX_RATE),
    }
    await db.gh_config.update_one({"key": "pricing"}, {"$set": {"key": "pricing", "value": value, "updated_at": now, "updated_by": user["user_id"]}}, upsert=True)
    await log_audit(user["user_id"], user.get("name", ""), "pricing_update", "gh_config", "pricing", value)
    return {"message": "Pricing updated", **value}


# ─── BOOKING / CHECK-IN ───
@router.post("/bookings")
async def create_booking(data: dict = Body(...), user: dict = Depends(require_roles(*GH_ROLES))):
    room_id = data.get("room_id")
    room = await db.gh_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(404, "Room not found")
    if room["status"] == "maintenance":
        raise HTTPException(400, f"Room {room['room_number']} is under maintenance")

    # Get pricing
    config = await db.gh_config.find_one({"key": "pricing"}, {"_id": 0})
    pricing = config.get("value", {}) if config else {}
    min_r = pricing.get("min_rate", MIN_RATE)
    max_r = pricing.get("max_rate", MAX_RATE)

    nightly_rate = float(data.get("nightly_rate", pricing.get("default_rate", DEFAULT_RATE)))
    if nightly_rate < min_r or nightly_rate > max_r:
        raise HTTPException(400, f"Rate must be between TT$ {min_r} and TT$ {max_r}")

    check_in_date = data.get("check_in_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    check_out_date = data.get("check_out_date")
    if not check_out_date:
        raise HTTPException(400, "check_out_date required")

    # Check for date overlap with existing active bookings on this room
    d1 = datetime.strptime(check_in_date, "%Y-%m-%d")
    d2 = datetime.strptime(check_out_date, "%Y-%m-%d")
    existing = await db.gh_bookings.find(
        {"room_id": room_id, "status": "checked_in"},
        {"_id": 0, "check_in_date": 1, "check_out_date": 1, "guest_name": 1}
    ).to_list(50)
    for ex in existing:
        ex_ci = datetime.strptime(ex["check_in_date"], "%Y-%m-%d")
        ex_co = datetime.strptime(ex["check_out_date"], "%Y-%m-%d")
        # Overlap: new check-in before existing check-out AND new check-out after existing check-in
        if d1 < ex_co and d2 > ex_ci:
            raise HTTPException(400, f"Room {room['room_number']} is booked by {ex['guest_name']} from {ex['check_in_date']} to {ex['check_out_date']}. Dates overlap.")

    nights = max(1, (d2 - d1).days)
    total_cost = nightly_rate * nights

    now = datetime.now(timezone.utc).isoformat()
    booking_id = gen_id("bk_")

    doc = {
        "booking_id": booking_id,
        "room_id": room_id,
        "room_number": room["room_number"],
        "floor": room["floor"],
        "guest_name": data.get("guest_name", ""),
        "guest_phone": data.get("guest_phone", ""),
        "guest_email": data.get("guest_email", ""),
        "guest_id_type": data.get("guest_id_type", ""),
        "guest_id_number": data.get("guest_id_number", ""),
        "check_in_date": check_in_date,
        "check_out_date": check_out_date,
        "nights": nights,
        "nightly_rate": nightly_rate,
        "total_cost": total_cost,
        "amount_paid": 0,
        "outstanding": total_cost,
        "stay_type": data.get("stay_type", "bed_only"),
        "status": "checked_in",
        "actual_checkout": None,
        "notes": data.get("notes", ""),
        "comments": data.get("comments", ""),
        "created_by": user["user_id"],
        "created_by_name": user.get("name", ""),
        "created_at": now,
    }
    await db.gh_bookings.insert_one(doc)
    doc.pop("_id", None)

    # Update room status
    await db.gh_rooms.update_one({"room_id": room_id}, {"$set": {"status": "occupied", "current_booking_id": booking_id}})
    await log_audit(user["user_id"], user.get("name", ""), "guest_checkin", "gh_booking", booking_id, {"guest": data.get("guest_name"), "room": room["room_number"], "nights": nights, "total": total_cost})
    return doc


@router.get("/bookings")
async def list_bookings(status: str = None, user: dict = Depends(require_roles(*GH_ROLES))):
    query = {}
    if status:
        query["status"] = status
    bookings = await db.gh_bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return bookings


@router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(require_roles(*GH_ROLES))):
    b = await db.gh_bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    payments = await db.gh_payments.find({"booking_id": booking_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    b["payments"] = payments
    return b


@router.put("/bookings/{booking_id}")
async def edit_booking(booking_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*GH_ROLES))):
    """Edit booking details — guest info, dates, rate, notes, etc."""
    booking = await db.gh_bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")

    updates = {}
    for field in ["guest_name", "guest_phone", "guest_email", "guest_id_type", "guest_id_number",
                   "check_in_date", "check_out_date", "nightly_rate", "stay_type", "notes", "comments"]:
        if field in data:
            updates[field] = data[field]

    # Recalculate nights and total if dates or rate changed
    ci = updates.get("check_in_date", booking.get("check_in_date", ""))
    co = updates.get("check_out_date", booking.get("check_out_date", ""))
    rate = float(updates.get("nightly_rate", booking.get("nightly_rate", 0)))
    if ci and co:
        from datetime import datetime as dt
        try:
            d1 = dt.strptime(ci[:10], "%Y-%m-%d")
            d2 = dt.strptime(co[:10], "%Y-%m-%d")
            nights = max(1, (d2 - d1).days)
            updates["nights"] = nights
            updates["total_cost"] = nights * rate
            updates["outstanding"] = updates["total_cost"] - booking.get("amount_paid", 0)
        except ValueError:
            pass

    if updates.get("nightly_rate") is not None:
        updates["nightly_rate"] = float(updates["nightly_rate"])

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.gh_bookings.update_one({"booking_id": booking_id}, {"$set": updates})
    await log_audit(user["user_id"], user.get("name", ""), "edit_booking", "gh_booking", booking_id, updates)
    return {"message": "Booking updated"}


@router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str, user: dict = Depends(require_roles(*GH_ROLES))):
    """Delete a booking and free the room."""
    booking = await db.gh_bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")

    # Free the room if it was occupied by this booking
    room_id = booking.get("room_id")
    if room_id:
        room = await db.gh_rooms.find_one({"room_id": room_id}, {"_id": 0})
        if room and room.get("current_booking_id") == booking_id:
            await db.gh_rooms.update_one({"room_id": room_id}, {"$set": {"status": "available", "current_booking_id": None}})

    # Delete associated payments
    await db.gh_payments.delete_many({"booking_id": booking_id})
    await db.gh_bookings.delete_one({"booking_id": booking_id})
    await log_audit(user["user_id"], user.get("name", ""), "delete_booking", "gh_booking", booking_id,
                    {"guest": booking.get("guest_name"), "room": booking.get("room_number")})
    return {"message": f"Booking for {booking.get('guest_name', '')} deleted"}




# ─── PAYMENTS ───
@router.post("/payments")
async def record_payment(data: dict = Body(...), user: dict = Depends(require_roles(*GH_ROLES))):
    booking_id = data.get("booking_id")
    booking = await db.gh_bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")

    amount = float(data.get("amount", 0))
    if amount <= 0:
        raise HTTPException(400, "Amount must be positive")

    now = datetime.now(timezone.utc).isoformat()
    payment_id = gen_id("ghp_")
    receipt_no = f"AGH-{payment_id[-6:].upper()}"

    doc = {
        "payment_id": payment_id,
        "receipt_no": receipt_no,
        "booking_id": booking_id,
        "room_number": booking["room_number"],
        "guest_name": booking["guest_name"],
        "amount": amount,
        "method": data.get("method", "cash"),
        "reference": data.get("reference", ""),
        "status": "completed",
        "recorded_by": user["user_id"],
        "recorded_by_name": user.get("name", ""),
        "created_at": now,
    }
    await db.gh_payments.insert_one(doc)
    doc.pop("_id", None)

    # Update booking
    new_paid = booking.get("amount_paid", 0) + amount
    new_outstanding = max(0, booking.get("total_cost", 0) - new_paid)
    await db.gh_bookings.update_one({"booking_id": booking_id}, {"$set": {"amount_paid": new_paid, "outstanding": new_outstanding}})

    await log_audit(user["user_id"], user.get("name", ""), "payment_recorded", "gh_payment", payment_id, {"booking": booking_id, "amount": amount, "method": data.get("method", "cash")})
    return doc


# ─── CHECK-OUT ───
@router.post("/bookings/{booking_id}/checkout")
async def checkout(booking_id: str, data: dict = Body(default={}), user: dict = Depends(require_roles(*GH_ROLES))):
    booking = await db.gh_bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking["status"] != "checked_in":
        raise HTTPException(400, "Guest is not checked in")

    now = datetime.now(timezone.utc).isoformat()
    await db.gh_bookings.update_one({"booking_id": booking_id}, {"$set": {
        "status": "checked_out",
        "actual_checkout": now,
        "checkout_notes": data.get("notes", ""),
    }})

    # Free up room
    await db.gh_rooms.update_one({"room_id": booking["room_id"]}, {"$set": {"status": "available", "current_booking_id": None}})
    await log_audit(user["user_id"], user.get("name", ""), "guest_checkout", "gh_booking", booking_id, {"guest": booking["guest_name"], "room": booking["room_number"]})
    return {"message": f"Guest {booking['guest_name']} checked out from Room {booking['room_number']}"}


# ─── UPDATE BOOKING NOTES ───
@router.put("/bookings/{booking_id}/notes")
async def update_booking_notes(booking_id: str, data: dict = Body(...), user: dict = Depends(require_roles(*GH_ROLES))):
    updates = {}
    if "notes" in data:
        updates["notes"] = data["notes"]
    if "comments" in data:
        updates["comments"] = data["comments"]
    if not updates:
        return {"message": "Nothing to update"}
    await db.gh_bookings.update_one({"booking_id": booking_id}, {"$set": updates})
    return {"message": "Notes updated"}


# ─── EXPENSES (MoMo charges, misc) ───
@router.get("/expenses")
async def list_expenses(user: dict = Depends(require_roles(*GH_ROLES))):
    expenses = await db.gh_expenses.find({}, {"_id": 0}).sort("date", -1).to_list(500)
    return expenses


@router.post("/expenses")
async def add_expense(data: dict = Body(...), user: dict = Depends(require_roles(*GH_ROLES))):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "expense_id": gen_id("ghe_"),
        "description": data.get("description", ""),
        "category": data.get("category", "momo_charges"),
        "amount": float(data.get("amount", 0)),
        "date": data.get("date", now[:10]),
        "notes": data.get("notes", ""),
        "recorded_by": user.get("name", ""),
        "created_at": now,
    }
    await db.gh_expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user: dict = Depends(require_roles(*GH_ROLES))):
    result = await db.gh_expenses.delete_one({"expense_id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Expense not found")
    return {"message": "Expense deleted"}


# ─── ANALYTICS (Admin/Founder) ───
@router.get("/analytics")
async def gh_analytics(user: dict = Depends(require_roles(*ADMIN_ROLES))):
    # Revenue per room
    rev_pipe = [{"$match": {"status": "completed"}}, {"$group": {"_id": "$room_number", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}]
    rev_by_room = await db.gh_payments.aggregate(rev_pipe).to_list(50)

    # Average stay
    stay_pipe = [{"$match": {"status": "checked_out"}}, {"$group": {"_id": None, "avg_nights": {"$avg": "$nights"}, "total_bookings": {"$sum": 1}}}]
    stay = await db.gh_bookings.aggregate(stay_pipe).to_list(1)
    avg_stay = round(stay[0]["avg_nights"], 1) if stay else 0
    total_bookings = stay[0]["total_bookings"] if stay else 0

    # Monthly revenue (last 6 months)
    monthly_pipe = [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": {"$substr": ["$created_at", 0, 7]}, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}}, {"$limit": 6}
    ]
    monthly = await db.gh_payments.aggregate(monthly_pipe).to_list(6)

    # Most popular rooms
    pop_pipe = [{"$group": {"_id": "$room_number", "bookings": {"$sum": 1}}}, {"$sort": {"bookings": -1}}, {"$limit": 10}]
    popular = await db.gh_bookings.aggregate(pop_pipe).to_list(10)

    # Total revenue
    all_rev = await db.gh_payments.aggregate([{"$match": {"status": "completed"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
    total_revenue = all_rev[0]["total"] if all_rev else 0

    return {
        "total_revenue": total_revenue,
        "total_bookings": total_bookings,
        "avg_stay_nights": avg_stay,
        "revenue_by_room": rev_by_room,
        "monthly_revenue": monthly,
        "popular_rooms": popular,
    }


# ─── AUDIT LOG ───
@router.get("/audit")
async def gh_audit_log(user: dict = Depends(require_roles(*ADMIN_ROLES))):
    logs = await db.audit_logs.find(
        {"entity_type": {"$regex": "^gh_"}},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(100)
    return logs



# ─── ACCOUNTS BREAKDOWN ───
@router.get("/accounts")
async def accounts_breakdown(date_from: str = None, date_to: str = None, user: dict = Depends(require_roles(*GH_ROLES))):
    """Full accounts breakdown: all bookings with payments, filterable by date range."""
    query = {}
    if date_from:
        query["check_in_date"] = {"$gte": date_from}
    if date_to:
        query.setdefault("check_in_date", {})
        if isinstance(query["check_in_date"], dict):
            query["check_in_date"]["$lte"] = date_to
        else:
            query["check_in_date"] = {"$gte": query["check_in_date"], "$lte": date_to}

    bookings = await db.gh_bookings.find(query, {"_id": 0}).sort("check_in_date", -1).to_list(500)

    # Attach payments to each booking
    booking_ids = [b["booking_id"] for b in bookings]
    all_payments = await db.gh_payments.find({"booking_id": {"$in": booking_ids}}, {"_id": 0}).to_list(2000)
    pay_map = {}
    for p in all_payments:
        pay_map.setdefault(p["booking_id"], []).append(p)
    for b in bookings:
        b["payments"] = pay_map.get(b["booking_id"], [])

    total_billed = sum(b.get("total_cost", 0) for b in bookings)
    total_paid = sum(b.get("amount_paid", 0) for b in bookings)
    total_outstanding = sum(b.get("outstanding", 0) for b in bookings)

    # Also fetch expenses
    expenses = await db.gh_expenses.find({}, {"_id": 0}).sort("date", -1).to_list(500)
    total_expenses = sum(e.get("amount", 0) for e in expenses)

    return {
        "bookings": bookings,
        "expenses": expenses,
        "summary": {
            "total_bookings": len(bookings),
            "total_billed": total_billed,
            "total_paid": total_paid,
            "total_outstanding": total_outstanding,
            "total_expenses": total_expenses,
            "net_revenue": total_paid - total_expenses,
        }
    }



# ─── PDF REPORTS ───
from fastapi import Request, Query
from fastapi.responses import Response
import jwt, os

def _verify_token(request: Request, token: str = None):
    auth_token = token
    if not auth_token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            auth_token = auth_header.split(" ")[1]
    if not auth_token:
        raise HTTPException(401, "Not authenticated")
    try:
        jwt.decode(auth_token, os.environ.get("JWT_SECRET"), algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "Invalid token")


def _pdf_header(pdf):
    import os as _os
    _logo = _os.path.join(_os.path.dirname(__file__), "..", "main_logo.png")
    if _os.path.exists(_logo):
        pdf.image(_logo, x=85, y=8, w=40, h=40)
        pdf.ln(42)
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "The RightWay Centre of Learning", ln=True, align="C")
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, "Where Every Child Thrives  |  learnrightschool.com", ln=True, align="C")
    pdf.set_draw_color(4, 72, 117)
    pdf.set_line_width(0.5)
    pdf.line(10, pdf.get_y() + 2, 200, pdf.get_y() + 2)
    pdf.ln(6)


@router.get("/reports/daily-occupancy")
async def daily_occupancy_report(date: str = None, request: Request = None, token: str = Query(None)):
    _verify_token(request, token)
    from fpdf import FPDF
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    rooms = await db.gh_rooms.find({}, {"_id": 0}).sort("room_number", 1).to_list(50)
    bookings = await db.gh_bookings.find(
        {"check_in_date": {"$lte": target}, "$or": [{"actual_checkout": None}, {"actual_checkout": {"$gte": target}}], "status": {"$in": ["checked_in", "checked_out"]}},
        {"_id": 0}
    ).to_list(200)
    booking_map = {}
    for b in bookings:
        if b.get("check_in_date", "") <= target and (not b.get("actual_checkout") or b["actual_checkout"][:10] >= target):
            booking_map[b["room_id"]] = b

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    _pdf_header(pdf)

    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, f"Daily Occupancy Report - {target}", ln=True, align="C")
    pdf.ln(4)

    occupied = sum(1 for r in rooms if r["room_id"] in booking_map)
    avail = len(rooms) - occupied
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(60, 7, f"Total Rooms: {len(rooms)}", border=0)
    pdf.cell(60, 7, f"Occupied: {occupied}", border=0)
    pdf.cell(60, 7, f"Available: {avail}", border=0)
    pdf.ln()
    pdf.cell(60, 7, f"Occupancy Rate: {round(occupied/len(rooms)*100,1) if rooms else 0}%", border=0)
    pdf.ln(8)

    for floor in [2, 3, 4]:
        floor_rooms = [r for r in rooms if r["floor"] == floor]
        pdf.set_font("Helvetica", "B", 11)
        floor_label = "2nd" if floor == 2 else "3rd" if floor == 3 else "4th"
        pdf.cell(0, 7, f"{floor_label} Floor", ln=True)

        pdf.set_fill_color(27, 42, 74)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(20, 7, "Room", border=1, fill=True, align="C")
        pdf.cell(20, 7, "Status", border=1, fill=True, align="C")
        pdf.cell(50, 7, "Guest", border=1, fill=True)
        pdf.cell(30, 7, "Check-in", border=1, fill=True, align="C")
        pdf.cell(30, 7, "Check-out", border=1, fill=True, align="C")
        pdf.cell(20, 7, "Nights", border=1, fill=True, align="C")
        pdf.cell(20, 7, "Type", border=1, fill=True, align="C")
        pdf.ln()
        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Helvetica", "", 9)

        for r in floor_rooms:
            bk = booking_map.get(r["room_id"])
            status = "Occupied" if bk else r["status"].title()
            if status == "Occupied":
                pdf.set_fill_color(254, 226, 226)
            elif status == "Available":
                pdf.set_fill_color(220, 252, 231)
            else:
                pdf.set_fill_color(241, 245, 249)
            pdf.cell(20, 6, r["room_number"], border=1, align="C", fill=True)
            pdf.cell(20, 6, status, border=1, align="C", fill=True)
            pdf.cell(50, 6, (bk or {}).get("guest_name", "-"), border=1, fill=True)
            pdf.cell(30, 6, (bk or {}).get("check_in_date", "-"), border=1, align="C", fill=True)
            pdf.cell(30, 6, (bk or {}).get("check_out_date", "-"), border=1, align="C", fill=True)
            pdf.cell(20, 6, str((bk or {}).get("nights", "-")), border=1, align="C", fill=True)
            stay = (bk or {}).get("stay_type", "-")
            pdf.cell(20, 6, "B&B" if stay == "bed_and_breakfast" else "Bed" if stay == "bed_only" else "-", border=1, align="C", fill=True)
            pdf.ln()
        pdf.ln(4)

    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 5, f"Generated {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC')}", ln=True, align="R")
    return Response(content=bytes(pdf.output()), media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="AGH_Occupancy_{target}.pdf"'})


@router.get("/reports/daily-revenue")
async def daily_revenue_report(date: str = None, request: Request = None, token: str = Query(None)):
    _verify_token(request, token)
    from fpdf import FPDF
    target = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    payments = await db.gh_payments.find({"created_at": {"$regex": f"^{target}"}}, {"_id": 0}).sort("created_at", 1).to_list(200)
    expenses = await db.gh_expenses.find({"date": target}, {"_id": 0}).sort("created_at", 1).to_list(200)

    total_income = sum(p.get("amount", 0) for p in payments)
    total_expense = sum(e.get("amount", 0) for e in expenses)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    _pdf_header(pdf)

    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, f"Daily Revenue Report - {target}", ln=True, align="C")
    pdf.ln(4)

    # Summary
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(63, 8, f"Total Income: TT$ {total_income:,.2f}", border=1, align="C")
    pdf.cell(63, 8, f"Total Expenses: TT$ {total_expense:,.2f}", border=1, align="C")
    net = total_income - total_expense
    pdf.cell(64, 8, f"Net: TT$ {net:,.2f}", border=1, align="C")
    pdf.ln(10)

    # Payments table
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "Payments Received", ln=True)
    pdf.set_fill_color(27, 42, 74)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(30, 7, "Receipt", border=1, fill=True)
    pdf.cell(40, 7, "Guest", border=1, fill=True)
    pdf.cell(20, 7, "Room", border=1, fill=True, align="C")
    pdf.cell(30, 7, "Amount (TT$)", border=1, fill=True, align="R")
    pdf.cell(25, 7, "Method", border=1, fill=True, align="C")
    pdf.cell(45, 7, "Reference", border=1, fill=True)
    pdf.ln()
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 9)

    if not payments:
        pdf.cell(190, 7, "No payments recorded", border=1, align="C")
        pdf.ln()
    for p in payments:
        pdf.cell(30, 6, p.get("receipt_no", "-"), border=1)
        pdf.cell(40, 6, p.get("guest_name", "-"), border=1)
        pdf.cell(20, 6, p.get("room_number", "-"), border=1, align="C")
        pdf.cell(30, 6, f"{p.get('amount', 0):,.2f}", border=1, align="R")
        m = p.get("method", "")
        pdf.cell(25, 6, "MoMo" if m == "mobile_money" else "Bank" if m == "bank_transfer" else m.title(), border=1, align="C")
        pdf.cell(45, 6, p.get("reference", "-")[:20], border=1)
        pdf.ln()
    pdf.ln(6)

    # Expenses table
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "Expenses & Charges", ln=True)
    pdf.set_fill_color(180, 120, 30)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(60, 7, "Description", border=1, fill=True)
    pdf.cell(35, 7, "Category", border=1, fill=True, align="C")
    pdf.cell(35, 7, "Amount (TT$)", border=1, fill=True, align="R")
    pdf.cell(60, 7, "Notes", border=1, fill=True)
    pdf.ln()
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 9)

    if not expenses:
        pdf.cell(190, 7, "No expenses recorded", border=1, align="C")
        pdf.ln()
    for e in expenses:
        pdf.cell(60, 6, e.get("description", "-"), border=1)
        pdf.cell(35, 6, e.get("category", "-").replace("_", " ").title(), border=1, align="C")
        pdf.cell(35, 6, f"{e.get('amount', 0):,.2f}", border=1, align="R")
        pdf.cell(60, 6, e.get("notes", "-")[:25], border=1)
        pdf.ln()

    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 5, f"Generated {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC')}", ln=True, align="R")
    return Response(content=bytes(pdf.output()), media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="AGH_Revenue_{target}.pdf"'})


@router.get("/reports/monthly-summary")
async def monthly_summary_report(month: str = None, request: Request = None, token: str = Query(None)):
    _verify_token(request, token)
    from fpdf import FPDF
    target_month = month or datetime.now(timezone.utc).strftime("%Y-%m")

    bookings = await db.gh_bookings.find({"check_in_date": {"$regex": f"^{target_month}"}}, {"_id": 0}).sort("check_in_date", 1).to_list(500)
    payments = await db.gh_payments.find({"created_at": {"$regex": f"^{target_month}"}}, {"_id": 0}).to_list(1000)
    expenses = await db.gh_expenses.find({"date": {"$regex": f"^{target_month}"}}, {"_id": 0}).to_list(500)

    total_bookings = len(bookings)
    total_billed = sum(b.get("total_cost", 0) for b in bookings)
    total_paid = sum(p.get("amount", 0) for p in payments)
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    total_nights = sum(b.get("nights", 0) for b in bookings)
    avg_stay = round(total_nights / total_bookings, 1) if total_bookings else 0
    checked_out = [b for b in bookings if b.get("status") == "checked_out"]
    outstanding = sum(b.get("outstanding", 0) for b in bookings)

    # Revenue by room
    room_rev = {}
    for p in payments:
        rn = p.get("room_number", "?")
        room_rev[rn] = room_rev.get(rn, 0) + p.get("amount", 0)

    # Revenue by method
    method_rev = {}
    for p in payments:
        m = p.get("method", "other")
        method_rev[m] = method_rev.get(m, 0) + p.get("amount", 0)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    _pdf_header(pdf)

    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, f"Monthly Performance Summary - {target_month}", ln=True, align="C")
    pdf.ln(6)

    # KPIs
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(241, 245, 249)
    kpis = [
        ("Total Bookings", str(total_bookings)),
        ("Total Nights", str(total_nights)),
        ("Avg Stay", f"{avg_stay} nights"),
        ("Total Billed", f"TT$ {total_billed:,.2f}"),
        ("Total Collected", f"TT$ {total_paid:,.2f}"),
        ("Outstanding", f"TT$ {outstanding:,.2f}"),
        ("Expenses", f"TT$ {total_expenses:,.2f}"),
        ("Net Revenue", f"TT$ {total_paid - total_expenses:,.2f}"),
    ]
    for i, (label, val) in enumerate(kpis):
        pdf.cell(47, 12, f"{label}\n{val}", border=1, align="C", fill=True)
        if (i + 1) % 4 == 0:
            pdf.ln()
    pdf.ln(8)

    # All bookings table
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "All Bookings", ln=True)
    pdf.set_fill_color(27, 42, 74)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 8)
    cols = [("Guest", 40), ("Room", 15), ("In", 22), ("Out", 22), ("Nts", 12), ("Type", 15), ("Rate", 18), ("Total", 22), ("Paid", 22), ("Owed", 22)]
    for label, w in cols:
        pdf.cell(w, 7, label, border=1, fill=True, align="C")
    pdf.ln()
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 8)

    for b in bookings:
        pdf.cell(40, 5.5, b.get("guest_name", "-")[:18], border=1)
        pdf.cell(15, 5.5, b.get("room_number", ""), border=1, align="C")
        pdf.cell(22, 5.5, b.get("check_in_date", ""), border=1, align="C")
        pdf.cell(22, 5.5, b.get("check_out_date", ""), border=1, align="C")
        pdf.cell(12, 5.5, str(b.get("nights", 0)), border=1, align="C")
        st = b.get("stay_type", "")
        pdf.cell(15, 5.5, "B&B" if st == "bed_and_breakfast" else "Bed", border=1, align="C")
        pdf.cell(18, 5.5, f"{b.get('nightly_rate', 0):,.0f}", border=1, align="R")
        pdf.cell(22, 5.5, f"{b.get('total_cost', 0):,.0f}", border=1, align="R")
        pdf.cell(22, 5.5, f"{b.get('amount_paid', 0):,.0f}", border=1, align="R")
        pdf.cell(22, 5.5, f"{b.get('outstanding', 0):,.0f}", border=1, align="R")
        pdf.ln()
    pdf.ln(6)

    # Revenue by room
    if room_rev:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 7, "Revenue by Room", ln=True)
        pdf.set_font("Helvetica", "", 9)
        for rn, amt in sorted(room_rev.items()):
            pdf.cell(30, 6, f"Room {rn}", border=1)
            pdf.cell(40, 6, f"TT$ {amt:,.2f}", border=1, align="R")
            pdf.ln()
        pdf.ln(4)

    # Revenue by method
    if method_rev:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 7, "Revenue by Payment Method", ln=True)
        pdf.set_font("Helvetica", "", 9)
        for m, amt in sorted(method_rev.items()):
            label = "MoMo" if m == "mobile_money" else "Bank" if m == "bank_transfer" else m.title()
            pdf.cell(30, 6, label, border=1)
            pdf.cell(40, 6, f"TT$ {amt:,.2f}", border=1, align="R")
            pdf.ln()
        pdf.ln(4)

    # Expenses
    if expenses:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 7, "Expenses", ln=True)
        pdf.set_font("Helvetica", "", 9)
        for e in expenses:
            pdf.cell(60, 6, e.get("description", ""), border=1)
            pdf.cell(30, 6, e.get("category", "").replace("_", " ").title(), border=1)
            pdf.cell(30, 6, f"TT$ {e.get('amount', 0):,.2f}", border=1, align="R")
            pdf.cell(30, 6, e.get("date", ""), border=1, align="C")
            pdf.ln()

    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 5, f"Generated {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC')}", ln=True, align="R")
    return Response(content=bytes(pdf.output()), media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="AGH_Monthly_{target_month}.pdf"'})


@router.get("/reports/accounts-pdf")
async def accounts_pdf(date_from: str = None, date_to: str = None, request: Request = None, token: str = Query(None)):
    """Accounts breakdown as a printable PDF."""
    _verify_token(request, token)
    from fpdf import FPDF

    query = {}
    if date_from:
        query["check_in_date"] = {"$gte": date_from}
    if date_to:
        query.setdefault("check_in_date", {})
        if isinstance(query.get("check_in_date"), dict):
            query["check_in_date"]["$lte"] = date_to
        else:
            query["check_in_date"] = {"$gte": query["check_in_date"], "$lte": date_to}

    bookings = await db.gh_bookings.find(query, {"_id": 0}).sort("check_in_date", -1).to_list(500)
    all_payments = await db.gh_payments.find({"booking_id": {"$in": [b["booking_id"] for b in bookings]}}, {"_id": 0}).to_list(2000)
    pay_map = {}
    for p in all_payments:
        pay_map.setdefault(p["booking_id"], []).append(p)
    expenses = await db.gh_expenses.find({}, {"_id": 0}).sort("date", -1).to_list(500)

    total_billed = sum(b.get("total_cost", 0) for b in bookings)
    total_paid = sum(b.get("amount_paid", 0) for b in bookings)
    total_outstanding = sum(b.get("outstanding", 0) for b in bookings)
    total_expenses = sum(e.get("amount", 0) for e in expenses)

    pdf = FPDF()
    pdf.add_page("L")
    pdf.set_auto_page_break(auto=True, margin=15)
    _pdf_header(pdf)

    period = f"{date_from or 'All'} to {date_to or 'Present'}"
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, f"Accounts Breakdown - {period}", ln=True, align="C")
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(55, 8, f"Bookings: {len(bookings)}", border=1, align="C")
    pdf.cell(55, 8, f"Billed: TT$ {total_billed:,.2f}", border=1, align="C")
    pdf.cell(55, 8, f"Paid: TT$ {total_paid:,.2f}", border=1, align="C")
    pdf.cell(55, 8, f"Outstanding: TT$ {total_outstanding:,.2f}", border=1, align="C")
    pdf.cell(57, 8, f"Net: TT$ {total_paid - total_expenses:,.2f}", border=1, align="C")
    pdf.ln(10)

    pdf.set_fill_color(27, 42, 74)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 8)
    hcols = [("Guest", 35), ("Room", 13), ("In", 20), ("Out", 20), ("Nts", 10), ("Type", 14), ("Rate", 16), ("Total", 20), ("Paid", 20), ("Method", 22), ("Owed", 20), ("Status", 18), ("Notes", 49)]
    for label, w in hcols:
        pdf.cell(w, 7, label, border=1, fill=True, align="C")
    pdf.ln()
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 7.5)

    for b in bookings:
        methods = list(set(p.get("method", "") for p in pay_map.get(b["booking_id"], [])))
        method_str = ", ".join("MoMo" if m == "mobile_money" else "Bank" if m == "bank_transfer" else m.title() for m in methods if m) or "-"
        st = b.get("stay_type", "")
        pdf.cell(35, 5.5, b.get("guest_name", "")[:16], border=1)
        pdf.cell(13, 5.5, b.get("room_number", ""), border=1, align="C")
        pdf.cell(20, 5.5, b.get("check_in_date", ""), border=1, align="C")
        pdf.cell(20, 5.5, b.get("check_out_date", ""), border=1, align="C")
        pdf.cell(10, 5.5, str(b.get("nights", 0)), border=1, align="C")
        pdf.cell(14, 5.5, "B&B" if st == "bed_and_breakfast" else "Bed", border=1, align="C")
        pdf.cell(16, 5.5, f"{b.get('nightly_rate', 0):,.0f}", border=1, align="R")
        pdf.cell(20, 5.5, f"{b.get('total_cost', 0):,.0f}", border=1, align="R")
        pdf.cell(20, 5.5, f"{b.get('amount_paid', 0):,.0f}", border=1, align="R")
        pdf.cell(22, 5.5, method_str[:12], border=1, align="C")
        pdf.cell(20, 5.5, f"{b.get('outstanding', 0):,.0f}", border=1, align="R")
        pdf.cell(18, 5.5, b.get("status", "").replace("_", " ").title()[:10], border=1, align="C")
        pdf.cell(49, 5.5, (b.get("comments") or b.get("notes") or "-")[:25], border=1)
        pdf.ln()

    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 5, f"Generated {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC')}", ln=True, align="R")
    clean_period = period.replace(" ", "")
    return Response(content=bytes(pdf.output()), media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="AGH_Accounts_{clean_period}.pdf"'})

