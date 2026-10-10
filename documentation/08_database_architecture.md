# Database Architecture

**Last Updated**: 2026-05-23

---

## Decision: Hybrid MongoDB + PostgreSQL

| Service | Database | Reason |
|---------|----------|--------|
| FastAPI (school management) | MongoDB | 70+ existing collections, 679+ endpoints — no migration |
| Django REST (CMS) | PostgreSQL | Django ORM native support, relational CMS data |

---

## MongoDB (School Management)

### Connection
```python
# backend/database.py
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGODB_URL = os.environ["MONGODB_URL"]         # mongodb://localhost:27017
DATABASE_NAME = os.environ["DATABASE_NAME"]     # rightway

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DATABASE_NAME]
```

### Key Collections (70+)

**Authentication & Users**
- `users` — all staff, students, parents, admins, community members
- `user_sessions` — JWT sessions (TTL index: 7 days)

**Academic**
- `classes` — class definitions (Year 1, Year 2, etc.)
- `subjects` — subject registry
- `timetable_v2` — timetable entries
- `lessons` — lesson content (LMS)
- `assignments` — student assignments
- `submissions` — assignment submissions
- `attendance` — daily attendance records
- `gradebook` — scores and grades
- `schemes` — scheme of work documents
- `quizzes` / `quiz_attempts` — quiz data
- `lectures` — lecture content

**Finance**
- `invoices_v2` — student fee invoices (active version)
- `payments_v2` — payment records (active version)
- `allocations` — payment-to-invoice allocations
- `credit_notes` — refunds/discounts/scholarships
- `student_accounts` — running balance per student
- `ledger_accounts` — GL chart of accounts
- `journal_entries` — double-entry journal

**HR & Staff**
- `clock_entries` — staff clock-in/out records
- `leave_requests` — staff leave applications
- `cpd_courses` — professional development
- `observations` — lesson observations/monitoring

**Student Support**
- `admissions` — admission pipeline records
- `boarding_students` — boarding house records
- `sick_bay_records` — health/medical records
- `visitor_logs` — receptionist visitor management
- `behaviour_records` — conduct incidents

**Communication**
- `chat_rooms` — messaging rooms
- `chat_messages` — individual messages
- `notifications` — push notification records
- `push_subscriptions` — Web Push device subscriptions
- `announcements` — school-wide announcements

**Website CMS**
- `website_settings` — global site settings
- `hero_slides` — homepage slideshow
- `programs` — school programs (Nursery, KG, Primary)
- `curriculum_areas` — curriculum subjects
- `activities` — extracurricular activities
- `gallery` — photo gallery items
- `testimonials` — parent testimonials
- `blog_posts` — blog/news articles
- `events` — school events/calendar
- `admissions_steps` — admissions process steps
- `faqs` — frequently asked questions
- `website_members` — community signups (pending/approved)

**Audit & Logging**
- `audit_logs` — all system events
- `finance_audit` — finance-specific audit trail
- `wp_audit` — working paper changes

### Multi-Tenancy

Every document in every collection must include `school_id`:
```python
# Pattern for all inserts
await db.students.insert_one({
    "school_id": current_user["school_id"],   # ← ALWAYS present
    "name": ...,
    "class_id": ...,
    ...
})

# Pattern for all queries
students = await db.students.find({
    "school_id": current_user["school_id"],   # ← ALWAYS filter by school
    ...
}).to_list(None)
```

### Required Indexes

Create on startup in `server.py`:
```python
@app.on_event("startup")
async def create_indexes():
    # TTL: auto-expire sessions after 7 days
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)

    # Compound indexes for school_id + common filters
    await db.users.create_index([("school_id", 1), ("email", 1)], unique=True)
    await db.students.create_index([("school_id", 1), ("class_id", 1)])
    await db.attendance.create_index([("school_id", 1), ("class_id", 1), ("date", -1)])
    await db.invoices_v2.create_index([("school_id", 1), ("student_id", 1), ("status", 1)])
    await db.chat_messages.create_index([("room_id", 1), ("created_at", -1)])
    await db.audit_logs.create_index([("school_id", 1), ("created_at", -1)])

    # Website CMS indexes
    await db.blog_posts.create_index([("slug", 1)], unique=True)
    await db.blog_posts.create_index([("status", 1), ("published_at", -1)])
    await db.events.create_index([("date", 1), ("is_active", 1)])
    await db.testimonials.create_index([("status", 1)])
```

### Self-Hosted vs MongoDB Atlas

| | Self-Hosted (VPS) | MongoDB Atlas |
|--|------------------|---------------|
| Cost | Free | $57+/month (M10) |
| Backups | Manual script | Automatic, PITR |
| Scaling | Manual | Auto-scale |
| Monitoring | Manual | Built-in dashboard |
| Recommended when | 1-2 campuses | 3+ campuses |

**Current recommendation**: Self-hosted on VPS with daily cron backup.  
**Migrate to Atlas** when expanding to 3+ campuses or 1000+ users.

---

## PostgreSQL (Django CMS)

### Connection
```python
# cms/settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'rightway_cms'),
        'USER': os.environ.get('DB_USER', 'rightway_cms_user'),
        'PASSWORD': os.environ['DB_PASSWORD'],
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}
```

### Django CMS Models

The CMS uses Django ORM models (PostgreSQL tables):

```python
# cms/models.py

class SiteSettings(models.Model):
    school_name = models.CharField(max_length=200)
    tagline = models.CharField(max_length=300, blank=True)
    phone = models.CharField(max_length=30)
    whatsapp = models.CharField(max_length=30)
    email = models.EmailField()
    address = models.TextField()
    google_maps_url = models.URLField(blank=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    facebook_url = models.URLField(blank=True)
    instagram_url = models.URLField(blank=True)
    founded_year = models.IntegerField(default=2020)
    total_students = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Site Settings"

class HeroSlide(models.Model):
    headline = models.CharField(max_length=200)
    subheadline = models.CharField(max_length=300, blank=True)
    cta_primary_text = models.CharField(max_length=100)
    cta_primary_link = models.CharField(max_length=200)
    image = models.ImageField(upload_to='hero/')
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

class Program(models.Model):
    name = models.CharField(max_length=100)
    age_range = models.CharField(max_length=100)
    description = models.TextField()
    color = models.CharField(max_length=7)   # hex color
    icon = models.CharField(max_length=50)   # icon name
    image = models.ImageField(upload_to='programs/', null=True, blank=True)
    features = models.JSONField(default=list)
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

class BlogPost(models.Model):
    STATUS_CHOICES = [('draft', 'Draft'), ('published', 'Published')]
    title = models.CharField(max_length=300)
    slug = models.SlugField(unique=True)
    category = models.CharField(max_length=100)
    body = models.TextField()    # rich HTML
    excerpt = models.TextField(blank=True)
    featured_image = models.ImageField(upload_to='blog/', null=True, blank=True)
    author_name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    is_featured = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Event(models.Model):
    CATEGORY_CHOICES = [
        ('Academic', 'Academic'), ('Holiday', 'Holiday'),
        ('Cultural', 'Cultural'), ('Staff Development', 'Staff Development'),
        ('Admissions', 'Admissions'),
    ]
    title = models.CharField(max_length=300)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    date = models.DateField()
    time = models.CharField(max_length=50, blank=True)
    location = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

class Testimonial(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')]
    parent_name = models.CharField(max_length=200)
    child_name = models.CharField(max_length=200, blank=True)
    rating = models.IntegerField(default=5)
    review = models.TextField()
    photo = models.ImageField(upload_to='testimonials/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    submitted_at = models.DateTimeField(auto_now_add=True)

class FAQ(models.Model):
    question = models.CharField(max_length=500)
    answer = models.TextField()
    category = models.CharField(max_length=100, default='General')
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
```

### Django Admin Configuration

```python
# cms/admin.py
from django.contrib import admin
from .models import *

@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ['school_name', 'phone', 'email', 'updated_at']

@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'status', 'is_featured', 'published_at']
    list_filter = ['status', 'category', 'is_featured']
    search_fields = ['title', 'body']
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'published_at'

@admin.register(Testimonial)
class TestimonialAdmin(admin.ModelAdmin):
    list_display = ['parent_name', 'rating', 'status', 'submitted_at']
    list_filter = ['status', 'rating']
    actions = ['approve_testimonials', 'reject_testimonials']

    def approve_testimonials(self, request, queryset):
        queryset.update(status='approved')
    approve_testimonials.short_description = "Approve selected testimonials"

    def reject_testimonials(self, request, queryset):
        queryset.update(status='rejected')
    reject_testimonials.short_description = "Reject selected testimonials"
```

---

## Redis (Cache & Sessions)

```python
# FastAPI Redis integration
import redis.asyncio as redis
import os

redis_client = redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"))

# Usage examples:
await redis_client.setex(f"session:{user_id}", 86400, token)        # cache session 24h
await redis_client.setex(f"ai_cache:{hash(prompt)}", 3600, result)  # cache AI result 1h
await redis_client.incr(f"rate:{ip}:{endpoint}")                     # rate limiting counter
```
