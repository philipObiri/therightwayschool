"""
Public-facing website CMS API — /api/website/*

Collections:
  website_settings, website_hero, website_programs, website_usps,
  website_curriculum, website_activities, website_gallery,
  website_testimonials, website_blog, website_events,
  website_faq, website_admissions_steps, website_registrations
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from bson import ObjectId
from datetime import datetime, timezone
import os, logging, time
from auth import get_current_user
from database import get_db

router = APIRouter(tags=["website"])
logger = logging.getLogger(__name__)

# ── helpers ───────────────────────────────────────────────────────────────────

def _id(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

def _ids(docs):
    return [_id(d) for d in docs]

def admin_only(user=Depends(get_current_user)):
    if user.get("role") not in ("Admin", "SuperAdmin", "CEO", "Principal", "Founder"):
        raise HTTPException(403, "Admins only")
    return user

# Simple per-IP rate limiter (5 reqs / 60 s)
_RATE = {}
def _rate_limit(request: Request, limit=5, window=60):
    ip = request.client.host
    now = time.time()
    bucket = _RATE.setdefault(ip, [])
    _RATE[ip] = [t for t in bucket if now - t < window]
    if len(_RATE[ip]) >= limit:
        raise HTTPException(429, "Too many requests")
    _RATE[ip].append(now)


# ── SETTINGS ──────────────────────────────────────────────────────────────────

@router.get("/website/settings")
async def get_settings(db=Depends(get_db)):
    doc = await db.website_settings.find_one({}) or {}
    return _id(doc)

@router.put("/website/settings")
async def update_settings(payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload.pop("id", None)
    payload.pop("_id", None)
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.website_settings.replace_one({}, payload, upsert=True)
    return {"ok": True}


# ── HERO SLIDES ───────────────────────────────────────────────────────────────

@router.get("/website/hero")
async def get_hero(db=Depends(get_db)):
    return _ids(await db.website_hero.find({}).sort("order", 1).to_list(20))

@router.post("/website/hero")
async def create_hero(payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.website_hero.insert_one(payload)
    return {"id": str(res.inserted_id)}

@router.put("/website/hero/{item_id}")
async def update_hero(item_id: str, payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload.pop("id", None); payload.pop("_id", None)
    await db.website_hero.update_one({"_id": ObjectId(item_id)}, {"$set": payload})
    return {"ok": True}

@router.delete("/website/hero/{item_id}")
async def delete_hero(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    await db.website_hero.delete_one({"_id": ObjectId(item_id)})
    return {"ok": True}


# ── PROGRAMS ──────────────────────────────────────────────────────────────────

@router.get("/website/programs")
async def get_programs(db=Depends(get_db)):
    return _ids(await db.website_programs.find({}).sort("order", 1).to_list(20))

@router.post("/website/programs")
async def create_program(payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.website_programs.insert_one(payload)
    return {"id": str(res.inserted_id)}

@router.put("/website/programs/{item_id}")
async def update_program(item_id: str, payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload.pop("id", None); payload.pop("_id", None)
    await db.website_programs.update_one({"_id": ObjectId(item_id)}, {"$set": payload})
    return {"ok": True}

@router.delete("/website/programs/{item_id}")
async def delete_program(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    await db.website_programs.delete_one({"_id": ObjectId(item_id)})
    return {"ok": True}


# ── USPs ──────────────────────────────────────────────────────────────────────

@router.get("/website/usps")
async def get_usps(db=Depends(get_db)):
    return _ids(await db.website_usps.find({}).sort("order", 1).to_list(20))

@router.post("/website/usps")
async def create_usp(payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.website_usps.insert_one(payload)
    return {"id": str(res.inserted_id)}

@router.put("/website/usps/{item_id}")
async def update_usp(item_id: str, payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload.pop("id", None); payload.pop("_id", None)
    await db.website_usps.update_one({"_id": ObjectId(item_id)}, {"$set": payload})
    return {"ok": True}

@router.delete("/website/usps/{item_id}")
async def delete_usp(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    await db.website_usps.delete_one({"_id": ObjectId(item_id)})
    return {"ok": True}


# ── CURRICULUM ────────────────────────────────────────────────────────────────

@router.get("/website/curriculum")
async def get_curriculum(db=Depends(get_db)):
    return _ids(await db.website_curriculum.find({}).sort("order", 1).to_list(30))

@router.post("/website/curriculum")
async def create_curriculum(payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.website_curriculum.insert_one(payload)
    return {"id": str(res.inserted_id)}

@router.put("/website/curriculum/{item_id}")
async def update_curriculum(item_id: str, payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload.pop("id", None); payload.pop("_id", None)
    await db.website_curriculum.update_one({"_id": ObjectId(item_id)}, {"$set": payload})
    return {"ok": True}

@router.delete("/website/curriculum/{item_id}")
async def delete_curriculum(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    await db.website_curriculum.delete_one({"_id": ObjectId(item_id)})
    return {"ok": True}


# ── ACTIVITIES ────────────────────────────────────────────────────────────────

@router.get("/website/activities")
async def get_activities(db=Depends(get_db)):
    return _ids(await db.website_activities.find({}).sort("order", 1).to_list(30))

@router.post("/website/activities")
async def create_activity(payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.website_activities.insert_one(payload)
    return {"id": str(res.inserted_id)}

@router.put("/website/activities/{item_id}")
async def update_activity(item_id: str, payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload.pop("id", None); payload.pop("_id", None)
    await db.website_activities.update_one({"_id": ObjectId(item_id)}, {"$set": payload})
    return {"ok": True}

@router.delete("/website/activities/{item_id}")
async def delete_activity(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    await db.website_activities.delete_one({"_id": ObjectId(item_id)})
    return {"ok": True}


# ── GALLERY ───────────────────────────────────────────────────────────────────

@router.get("/website/gallery")
async def get_gallery(db=Depends(get_db)):
    return _ids(await db.website_gallery.find({}).sort("order", 1).to_list(50))

@router.post("/website/gallery")
async def create_gallery(payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.website_gallery.insert_one(payload)
    return {"id": str(res.inserted_id)}

@router.put("/website/gallery/{item_id}")
async def update_gallery(item_id: str, payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload.pop("id", None); payload.pop("_id", None)
    await db.website_gallery.update_one({"_id": ObjectId(item_id)}, {"$set": payload})
    return {"ok": True}

@router.delete("/website/gallery/{item_id}")
async def delete_gallery(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    await db.website_gallery.delete_one({"_id": ObjectId(item_id)})
    return {"ok": True}


# ── TESTIMONIALS ──────────────────────────────────────────────────────────────

@router.get("/website/testimonials")
async def get_testimonials(db=Depends(get_db)):
    return _ids(await db.website_testimonials.find({"status": "approved"}).sort("created_at", -1).to_list(20))

@router.post("/website/testimonials")
async def submit_testimonial(payload: dict, request: Request, db=Depends(get_db)):
    _rate_limit(request)
    payload["status"] = "pending"
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.website_testimonials.insert_one(payload)
    return {"id": str(res.inserted_id), "message": "Thank you! Your review is pending approval."}

@router.get("/website/testimonials/pending")
async def get_pending_testimonials(db=Depends(get_db), user=Depends(admin_only)):
    return _ids(await db.website_testimonials.find({"status": "pending"}).sort("created_at", -1).to_list(50))

@router.put("/website/testimonials/{item_id}/approve")
async def approve_testimonial(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    await db.website_testimonials.update_one({"_id": ObjectId(item_id)}, {"$set": {"status": "approved"}})
    return {"ok": True}

@router.put("/website/testimonials/{item_id}/reject")
async def reject_testimonial(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    await db.website_testimonials.update_one({"_id": ObjectId(item_id)}, {"$set": {"status": "rejected"}})
    return {"ok": True}


# ── BLOG ──────────────────────────────────────────────────────────────────────

@router.get("/website/blog")
async def get_blog(db=Depends(get_db)):
    return _ids(await db.website_blog.find({"published": True}).sort("date", -1).to_list(20))

@router.get("/website/blog/{slug}")
async def get_blog_post(slug: str, db=Depends(get_db)):
    doc = await db.website_blog.find_one({"slug": slug, "published": True})
    if not doc:
        raise HTTPException(404, "Post not found")
    return _id(doc)

@router.post("/website/blog")
async def create_blog(payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    payload.setdefault("published", False)
    res = await db.website_blog.insert_one(payload)
    return {"id": str(res.inserted_id)}

@router.put("/website/blog/{item_id}")
async def update_blog(item_id: str, payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload.pop("id", None); payload.pop("_id", None)
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.website_blog.update_one({"_id": ObjectId(item_id)}, {"$set": payload})
    return {"ok": True}

@router.delete("/website/blog/{item_id}")
async def delete_blog(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    await db.website_blog.delete_one({"_id": ObjectId(item_id)})
    return {"ok": True}


# ── EVENTS ────────────────────────────────────────────────────────────────────

@router.get("/website/events")
async def get_events(db=Depends(get_db)):
    return _ids(await db.website_events.find({}).sort("date", 1).to_list(20))

@router.post("/website/events")
async def create_event(payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.website_events.insert_one(payload)
    return {"id": str(res.inserted_id)}

@router.put("/website/events/{item_id}")
async def update_event(item_id: str, payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload.pop("id", None); payload.pop("_id", None)
    await db.website_events.update_one({"_id": ObjectId(item_id)}, {"$set": payload})
    return {"ok": True}

@router.delete("/website/events/{item_id}")
async def delete_event(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    await db.website_events.delete_one({"_id": ObjectId(item_id)})
    return {"ok": True}


# ── FAQ ───────────────────────────────────────────────────────────────────────

@router.get("/website/faq")
async def get_faq(db=Depends(get_db)):
    return _ids(await db.website_faq.find({}).sort("order", 1).to_list(30))

@router.post("/website/faq")
async def create_faq(payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.website_faq.insert_one(payload)
    return {"id": str(res.inserted_id)}

@router.put("/website/faq/{item_id}")
async def update_faq(item_id: str, payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload.pop("id", None); payload.pop("_id", None)
    await db.website_faq.update_one({"_id": ObjectId(item_id)}, {"$set": payload})
    return {"ok": True}

@router.delete("/website/faq/{item_id}")
async def delete_faq(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    await db.website_faq.delete_one({"_id": ObjectId(item_id)})
    return {"ok": True}


# ── ADMISSIONS STEPS ──────────────────────────────────────────────────────────

@router.get("/website/admissions-steps")
async def get_admissions_steps(db=Depends(get_db)):
    return _ids(await db.website_admissions_steps.find({}).sort("step", 1).to_list(10))

@router.post("/website/admissions-steps")
async def create_admissions_step(payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    res = await db.website_admissions_steps.insert_one(payload)
    return {"id": str(res.inserted_id)}

@router.put("/website/admissions-steps/{item_id}")
async def update_admissions_step(item_id: str, payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload.pop("id", None); payload.pop("_id", None)
    await db.website_admissions_steps.update_one({"_id": ObjectId(item_id)}, {"$set": payload})
    return {"ok": True}

@router.delete("/website/admissions-steps/{item_id}")
async def delete_admissions_step(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    await db.website_admissions_steps.delete_one({"_id": ObjectId(item_id)})
    return {"ok": True}


# ── CONTACT FORM ──────────────────────────────────────────────────────────────

@router.post("/website/contact")
async def submit_contact(payload: dict, request: Request, db=Depends(get_db)):
    _rate_limit(request, limit=3, window=60)
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    payload["status"] = "new"
    await db.website_contacts.insert_one(payload)
    return {"ok": True, "message": "Message received"}

@router.get("/website/contacts")
async def get_contacts(db=Depends(get_db), user=Depends(admin_only)):
    return _ids(await db.website_contacts.find({}).sort("created_at", -1).to_list(100))


# ── PUBLIC REGISTRATION ───────────────────────────────────────────────────────

@router.post("/website/register")
async def public_register(payload: dict, request: Request, db=Depends(get_db)):
    _rate_limit(request, limit=5, window=60)
    email = payload.get("email", "").lower().strip()
    if not email:
        raise HTTPException(400, "Email is required")
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(409, "An account with this email already exists")
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    await db.website_registrations.insert_one({
        "full_name": payload.get("full_name", ""),
        "email": email,
        "password_hash": pwd_ctx.hash(payload.get("password", "")),
        "role": payload.get("role", "Parent"),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True, "message": "Registration received. Your account is pending admin approval."}

@router.get("/website/registrations")
async def get_registrations(db=Depends(get_db), user=Depends(admin_only)):
    return _ids(await db.website_registrations.find({}).sort("created_at", -1).to_list(100))


# ── ADMISSIONS APPLICATIONS ───────────────────────────────────────────────────

@router.post("/website/admissions-applications")
async def submit_application(payload: dict, request: Request, db=Depends(get_db)):
    _rate_limit(request, limit=3, window=300)
    payload["status"] = "pending"
    payload["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.website_admissions_applications.insert_one(payload)
    ref = f"RW-{str(res.inserted_id)[-6:].upper()}"
    return {"id": str(res.inserted_id), "reference": ref}

@router.get("/website/admissions-applications")
async def get_applications(db=Depends(get_db), user=Depends(admin_only)):
    return _ids(await db.website_admissions_applications.find({}).sort("created_at", -1).to_list(200))

@router.get("/website/admissions-applications/{item_id}")
async def get_application(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    doc = await db.website_admissions_applications.find_one({"_id": ObjectId(item_id)})
    if not doc:
        raise HTTPException(404, "Application not found")
    return _id(doc)

@router.put("/website/admissions-applications/{item_id}")
async def update_application(item_id: str, payload: dict, db=Depends(get_db), user=Depends(admin_only)):
    payload.pop("id", None); payload.pop("_id", None)
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.website_admissions_applications.update_one({"_id": ObjectId(item_id)}, {"$set": payload})
    return {"ok": True}

@router.post("/website/registrations/{item_id}/approve")
async def approve_registration(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    reg = await db.website_registrations.find_one({"_id": ObjectId(item_id)})
    if not reg:
        raise HTTPException(404, "Registration not found")
    await db.users.insert_one({
        "full_name": reg["full_name"],
        "email": reg["email"],
        "password_hash": reg["password_hash"],
        "role": reg.get("role", "Parent"),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.website_registrations.update_one({"_id": ObjectId(item_id)}, {"$set": {"status": "approved"}})
    return {"ok": True}

@router.post("/website/registrations/{item_id}/reject")
async def reject_registration(item_id: str, db=Depends(get_db), user=Depends(admin_only)):
    await db.website_registrations.update_one({"_id": ObjectId(item_id)}, {"$set": {"status": "rejected"}})
    return {"ok": True}
