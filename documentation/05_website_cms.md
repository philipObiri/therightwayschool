# Public Website & CMS Specification

**Client**: The RightWay Centre of Learning, Trinidad and Tobago  
**Stack**: Next.js 14+ (public website) + FastAPI `/api/website/` (CMS API)  
**Last Updated**: 2026-05-23

---

## Design Reference

Based on Bloomings Plus Montessori (bmplusgh.com) — single-page scrolling with anchor navigation, vibrant section colors, auth modals, animated WhatsApp widget.

---

## Color Palette (Unified — Website + Dashboard)

Both the public website and all internal dashboards use the same bright, school-branded palette. No dark themes.

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#FBF8F3` | All page backgrounds |
| `--primary` | `#2A7A5A` | Buttons, active nav, headings |
| `--accent-gold` | `#F4A261` | Highlights, badges, hover states |
| `--accent-coral` | `#E76F51` | Alerts, secondary CTAs |
| `--highlight` | `#84C4A0` | Tags, success states, section accents |
| `--text` | `#1A1A2E` | All body text |
| `--white` | `#FFFFFF` | Cards, modals |
| `--shadow` | `rgba(42,122,90,0.08)` | Card shadows |

**CSS custom properties** — define in `globals.css` and use everywhere.

---

## Typography

```css
/* Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Manrope:wght@300;400;500;600;700&display=swap');

:root {
  --font-heading: 'Outfit', sans-serif;
  --font-body: 'Manrope', sans-serif;
}
```

---

## Page Structure (Single scrolling page)

| # | Section | ID | CMS Key |
|---|---------|-----|---------|
| 1 | Top Bar | `#topbar` | `site_settings` |
| 2 | Navigation | `#nav` | `navigation` |
| 3 | Hero | `#home` | `hero_slides` |
| 4 | About Us | `#about` | `about` |
| 5 | Programs | `#programs` | `programs` |
| 6 | Why Choose Us | `#why-us` | `usps` |
| 7 | Curriculum | `#curriculum` | `curriculum_areas` |
| 8 | Activities | `#activities` | `activities` |
| 9 | Gallery | `#gallery` | `gallery` |
| 10 | Testimonials | `#testimonials` | `testimonials` |
| 11 | Blog / Resources | `#blog` | `blog_posts` |
| 12 | Events & Calendar | `#events` | `events` |
| 13 | Admissions Process | `#admissions` | `admissions_steps` |
| 14 | FAQ | `#faq` | `faqs` |
| 15 | Contact | `#contact` | `contact_info` |
| 16 | Footer + Map | `#footer` | `footer` |

---

## School Programs (3 tiers)

```json
[
  {
    "name": "Nursery",
    "age_range": "Infant - Pre-school",
    "color": "#84C4A0",
    "icon": "baby",
    "description": "A nurturing foundation for our youngest learners...",
    "features": ["Sensory play", "Language development", "Social skills", "Motor development"]
  },
  {
    "name": "Kindergarten",
    "age_range": "Pre-primary",
    "color": "#F4A261",
    "icon": "pencil",
    "description": "Preparing young minds for the journey of learning...",
    "features": ["Early literacy", "Numeracy", "Creative arts", "Physical education"]
  },
  {
    "name": "Primary & JHS",
    "age_range": "Full academic program",
    "color": "#2A7A5A",
    "icon": "book-open",
    "description": "A complete academic programme with strong foundations...",
    "features": ["Core subjects", "Sciences", "Languages", "Technology", "Sports"]
  }
]
```

---

## WhatsApp Contact Widget

The widget floats in the bottom-right corner and expands on click.

### Behavior
1. Floating button: Green WhatsApp icon with gentle bounce animation
2. Click → slide-up panel with 3 options
3. "Chat on WhatsApp" → opens an inline mini-form
4. Form: Full Name + Message + Math CAPTCHA (e.g. `3 + 5 = ?`)
5. Submit → opens `https://wa.me/+18681234567?text=...` in new tab

### Math CAPTCHA Generator
```javascript
function generateCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { question: `${a} + ${b}`, answer: a + b };
}
```

### WhatsApp URL Builder
```javascript
function buildWhatsAppUrl(phone, name, message) {
  const text = encodeURIComponent(
    `Hello! My name is ${name}.\n\n${message}\n\nSent from RightWay Centre of Learning website.`
  );
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${text}`;
}
```

### Widget Layout
```
[📱 WhatsApp]   ← floating button
     ↓ click
┌─────────────────────┐
│  Get in Touch       │
│  ─────────────────  │
│  [💬 Chat WhatsApp] │  ← opens mini-form
│  [📞 Call Us]       │  ← tel: link
│  [✉️ Email Us]      │  ← mailto: link
└─────────────────────┘
```

All contact details (phone, email, WhatsApp number) are editable from the CMS.

---

## Auth Modals

### Login Modal
Triggered by "Login" button in navbar — overlays the hero section.

```
┌────────────────────────────────┐
│     [School Logo]              │
│     Welcome Back!              │
│  Sign in to manage content     │
│                                │
│  Email Address                 │
│  [____________________]        │
│                                │
│  Password            [👁]      │
│  [____________________]        │
│                    Forgot?     │
│                                │
│  [        Sign In        ]     │
│                                │
│  Don't have an account? Sign Up│
└────────────────────────────────┘
```

### Signup Modal
Triggered by "Sign Up" button — same overlay style.

```
┌────────────────────────────────┐
│     [School Logo]              │
│     Join Our Community         │
│  Create an account             │
│                                │
│  Full Name                     │
│  [____________________]        │
│                                │
│  Email Address                 │
│  [____________________]        │
│                                │
│  Password                      │
│  [____________________]        │
│                                │
│  [    Create Account     ]     │
│                                │
│  Already have an account? Login│
│                                │
│  ┌──────────────────────────┐  │
│  │ ⚠ Admin review required  │  │
│  │ before access is granted │  │
│  └──────────────────────────┘  │
└────────────────────────────────┘
```

### Registration Flow
1. User fills signup form → POST `/api/website/register`
2. Account created: `{ status: 'pending', role: 'Community', registration_source: 'website' }`
3. Confirmation email sent (Mailtrap): "Thank you! Your account is under review."
4. Admin sees new member in Dashboard → Website Members tab
5. Admin clicks Approve → user status changes to `'active'`
6. Approval email sent to user: "Your account has been approved!"
7. User can now log in

---

## CMS Content Types (MongoDB Collections)

### `website_settings`
```json
{
  "school_name": "The RightWay Centre of Learning",
  "tagline": "Where Every Child Thrives",
  "phone": "+1-868-XXX-XXXX",
  "whatsapp": "+18681234567",
  "email": "info@learnrightschool.com",
  "address": "..., Trinidad",
  "google_maps_url": "https://maps.google.com/?q=...",
  "lat": 10.65,
  "lng": -61.52,
  "facebook_url": "",
  "instagram_url": "",
  "twitter_url": "",
  "youtube_url": "",
  "business_hours": "Mon-Fri: 7:00 AM - 5:00 PM",
  "founded_year": 2020,
  "total_students": 200,
  "total_teachers": 20
}
```

### `hero_slides`
```json
{
  "headline": "Where Every Child Thrives",
  "subheadline": "Quality Education in Trinidad and Tobago",
  "cta_primary_text": "Schedule a Tour",
  "cta_primary_link": "#admissions",
  "cta_secondary_text": "Learn More",
  "cta_secondary_link": "#about",
  "image_url": "/media/hero/slide1.jpg",
  "order": 1,
  "is_active": true
}
```

### `programs` (Nursery, KG, Primary)
```json
{
  "name": "Nursery",
  "age_range": "Infant - Pre-school",
  "description": "...",
  "color": "#84C4A0",
  "icon": "baby",
  "image_url": "/media/...",
  "features": ["Feature 1", "Feature 2"],
  "order": 1,
  "is_active": true
}
```

### `blog_posts`
```json
{
  "title": "Why Early Education Matters",
  "slug": "why-early-education-matters",
  "category": "Learning",
  "body": "<rich text html>",
  "excerpt": "Short summary...",
  "featured_image_url": "/media/blog/...",
  "author_name": "RightWay Team",
  "published_at": "2026-05-23T10:00:00Z",
  "status": "published",  // draft | published
  "is_featured": true
}
```

### `events`
```json
{
  "title": "New Term Begins",
  "category": "Academic",  // Academic | Holiday | Cultural | Staff Development
  "date": "2026-09-01",
  "time": "8:00 AM",
  "location": "Main Campus",
  "description": "...",
  "campus": "all",
  "is_active": true
}
```

### `testimonials`
```json
{
  "parent_name": "Mrs. Johnson",
  "child_name": "Jamie",
  "rating": 5,
  "review": "The RightWay Centre has transformed our child...",
  "photo_url": "s3://...",
  "status": "approved",  // pending | approved | rejected
  "submitted_at": "2026-05-20T12:00:00Z"
}
```

### `faqs`
```json
{
  "question": "What are your school hours?",
  "answer": "We operate Monday to Friday, 7:00 AM to 5:00 PM...",
  "category": "General",
  "order": 1,
  "is_active": true
}
```

---

## FastAPI CMS Routes (`backend/routes/website.py`)

```python
# Site settings
GET  /api/website/settings
PUT  /api/website/settings          (admin only)

# Hero slides
GET  /api/website/hero
POST /api/website/hero              (admin only)
PUT  /api/website/hero/{id}         (admin only)
DELETE /api/website/hero/{id}       (admin only)

# Programs
GET  /api/website/programs
POST /api/website/programs          (admin only)
PUT  /api/website/programs/{id}     (admin only)
DELETE /api/website/programs/{id}   (admin only)

# Blog
GET  /api/website/blog              (published only, public)
GET  /api/website/blog/{slug}       (public)
GET  /api/website/blog/admin/all    (admin: all statuses)
POST /api/website/blog              (admin only)
PUT  /api/website/blog/{id}         (admin only)
DELETE /api/website/blog/{id}       (admin only)

# Events
GET  /api/website/events            (public)
POST /api/website/events            (admin only)
PUT  /api/website/events/{id}       (admin only)
DELETE /api/website/events/{id}     (admin only)

# Gallery
GET  /api/website/gallery           (public)
POST /api/website/gallery/upload    (admin only, multipart)
DELETE /api/website/gallery/{id}    (admin only)

# Testimonials
GET  /api/website/testimonials      (approved only, public)
POST /api/website/testimonials      (authenticated users)
GET  /api/website/testimonials/pending  (admin only)
PUT  /api/website/testimonials/{id}/approve  (admin only)
PUT  /api/website/testimonials/{id}/reject   (admin only)

# FAQ
GET  /api/website/faq               (public)
POST /api/website/faq               (admin only)
PUT  /api/website/faq/{id}          (admin only)
DELETE /api/website/faq/{id}        (admin only)

# Community auth
POST /api/website/register          (public, rate limited)
GET  /api/website/members           (admin only)
POST /api/website/members/{id}/approve  (admin only)
POST /api/website/members/{id}/reject   (admin only)

# Admissions chatbot
POST /api/website/chat              (public, rate limited 10/hour)
```

---

## AI Image Prompts (Trinidad & Tobago)

Use with Midjourney, DALL-E 3, or Ideogram for school photos:

1. `"Joyful Caribbean children aged 4-6, diverse multiracial including Afro-Caribbean and Indo-Trinidadian, colorful bright classroom, warm tropical light, photorealistic"`
2. `"Mixed-race Caribbean children aged 6-10 doing science experiments at school, bright modern classroom, Trinidad, photorealistic"`
3. `"Caribbean toddlers aged 1-3 playing with educational toys in a cheerful nursery, caring teacher, warm inviting environment, photorealistic"`
4. `"Diverse Trinidadian primary school children aged 8-12, school uniforms, art and crafts outdoors, lush tropical background, photorealistic"`
5. `"Caribbean Afro-Trinidadian baby 6-18 months in bright nursery, colorful blocks, nurturing teacher, photorealistic"`
6. `"Multiracial Caribbean kindergarteners 3-5 learning the alphabet, colorful classroom, smiling, photorealistic"`
7. `"Diverse Trinidadian children 8-12 in uniforms, group study in bright classroom, photorealistic"`
8. `"Caribbean children diverse backgrounds playing outdoors, lush tropical school compound, Trinidad, joyful, photorealistic"`
9. `"Afro-Caribbean and Indo-Trinidadian children aged 5-10 at school cultural day, colorful Caribbean attire, photorealistic"`
10. `"Happy Trinidadian parent dropping off smiling child at school entrance, warm tropical morning, photorealistic"`
