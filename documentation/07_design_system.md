# Design System — RightWay Centre of Learning

**Status**: Replaces original dark Navy design_guidelines.json  
**Applied to**: Public website + ALL internal dashboards  
**Last Updated**: 2026-05-23

---

## Philosophy

Bright, warm, welcoming, and school-appropriate. Every page — whether a parent is visiting the public website or a teacher is entering grades — should feel like it belongs to the same joyful institution.

**No dark sidebars. No heavy navy. No corporate feel.**

---

## Color Palette

```css
:root {
  /* Core palette */
  --color-primary:      #2A7A5A;  /* Forest green — growth, learning */
  --color-accent-gold:  #F4A261;  /* Warm gold — energy, joy */
  --color-accent-coral: #E76F51;  /* Soft coral — warmth, alerts */
  --color-highlight:    #84C4A0;  /* Sage green — success, tags */

  /* Backgrounds */
  --color-bg:           #FBF8F3;  /* Warm ivory — all page backgrounds */
  --color-bg-section:   #F0F7F4;  /* Light sage — alternating sections */
  --color-white:        #FFFFFF;  /* Cards, modals */

  /* Text */
  --color-text:         #1A1A2E;  /* Deep charcoal — body text */
  --color-text-muted:   #6B7280;  /* Muted — captions, subtitles */
  --color-text-light:   #9CA3AF;  /* Light — placeholders */

  /* UI States */
  --color-success:      #2A7A5A;  /* = primary */
  --color-warning:      #F4A261;  /* = accent-gold */
  --color-error:        #E76F51;  /* = accent-coral */
  --color-info:         #3B82F6;  /* Blue — info messages */

  /* Shadows */
  --shadow-sm:    0 1px 3px rgba(42,122,90,0.06);
  --shadow-md:    0 4px 12px rgba(42,122,90,0.08);
  --shadow-lg:    0 8px 24px rgba(42,122,90,0.12);

  /* Border radius */
  --radius-sm:    0.375rem;  /* 6px */
  --radius-md:    0.75rem;   /* 12px */
  --radius-lg:    1rem;      /* 16px */
  --radius-xl:    1.5rem;    /* 24px */
  --radius-full:  9999px;    /* Pill */
}
```

---

## Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary:    '#2A7A5A',
        gold:       '#F4A261',
        coral:      '#E76F51',
        sage:       '#84C4A0',
        ivory:      '#FBF8F3',
        charcoal:   '#1A1A2E',
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body:    ['Manrope', 'sans-serif'],
      },
      boxShadow: {
        'card':   '0 4px 12px rgba(42,122,90,0.08)',
        'card-hover': '0 8px 24px rgba(42,122,90,0.14)',
      },
    },
  },
};
```

---

## Typography

```css
/* Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Manrope:wght@300;400;500;600;700&display=swap');

h1, h2, h3, h4, h5, h6 { font-family: 'Outfit', sans-serif; color: #1A1A2E; }
body, p, span, input { font-family: 'Manrope', sans-serif; color: #1A1A2E; }

/* Scale */
h1 { font-size: 2.5rem; font-weight: 800; }
h2 { font-size: 2rem;   font-weight: 700; }
h3 { font-size: 1.5rem; font-weight: 600; }
h4 { font-size: 1.25rem; font-weight: 600; }
p  { font-size: 1rem;   line-height: 1.7; }
```

---

## Dashboard Components

### Sidebar
```
┌─────────────────────┐
│ [School Logo]       │  White background
│ RightWay Centre     │  Primary text
│─────────────────────│
│  🏠 Dashboard       │  ← inactive: muted text
│▌ 📚 Academics       │  ← active: green left border + sage bg
│  💰 Finance         │
│  👥 Students        │
│  📊 Analytics       │
│  ⚙️ Settings        │
└─────────────────────┘
```

CSS:
```css
.sidebar { background: #FFFFFF; border-right: 1px solid #E5E7EB; }

.nav-item { 
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.625rem 1rem; border-radius: 0.5rem;
  color: #6B7280; transition: all 0.15s ease;
}
.nav-item:hover { background: #F0F7F4; color: #2A7A5A; }
.nav-item.active { 
  background: #F0F7F4; color: #2A7A5A; font-weight: 600;
  border-left: 3px solid #2A7A5A; 
}
```

### Topbar
```css
.topbar {
  background: #FFFFFF;
  border-bottom: 1px solid #E5E7EB;
  box-shadow: 0 1px 3px rgba(42,122,90,0.06);
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  height: 64px;
}
```

### Stat Cards
```
┌──────────────────────────┐
│ [🟢]   Total Students    │  White card, colored icon circle
│         247              │  Large number in primary color
│  ↑ 12% this term         │  Small green uptrend
└──────────────────────────┘
```

```css
.stat-card {
  background: #FFFFFF;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(42,122,90,0.08);
  border: 1px solid rgba(42,122,90,0.06);
  transition: box-shadow 0.2s ease;
}
.stat-card:hover { box-shadow: 0 8px 24px rgba(42,122,90,0.14); }

.stat-icon {
  width: 48px; height: 48px;
  border-radius: 0.75rem;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.25rem;
}
.stat-icon.green  { background: #F0F7F4; color: #2A7A5A; }
.stat-icon.gold   { background: #FEF3E8; color: #F4A261; }
.stat-icon.coral  { background: #FDF0ED; color: #E76F51; }
.stat-icon.sage   { background: #EAF5F0; color: #84C4A0; }
```

### Tables
```css
.table-container {
  background: #FFFFFF;
  border-radius: 1rem;
  box-shadow: 0 4px 12px rgba(42,122,90,0.08);
  overflow: hidden;
}
.table-header { background: #F0F7F4; color: #2A7A5A; font-weight: 600; font-size: 0.875rem; }
.table-row:hover { background: #F9FBFA; }
.table-row { border-bottom: 1px solid #F3F4F6; }
/* No heavy borders — clean and airy */
```

### Buttons
```css
/* Primary */
.btn-primary {
  background: #2A7A5A; color: #FFFFFF;
  border-radius: 9999px; padding: 0.625rem 1.5rem;
  font-weight: 600; font-family: 'Outfit';
  transition: all 0.2s; border: none;
}
.btn-primary:hover { background: #236B4E; box-shadow: 0 4px 12px rgba(42,122,90,0.3); }

/* Secondary (gold) */
.btn-secondary {
  background: #F4A261; color: #FFFFFF;
  border-radius: 9999px; padding: 0.625rem 1.5rem;
}
.btn-secondary:hover { background: #E8904C; }

/* Outline */
.btn-outline {
  background: transparent; color: #2A7A5A;
  border: 2px solid #2A7A5A; border-radius: 9999px;
}
.btn-outline:hover { background: #F0F7F4; }

/* Danger (coral) */
.btn-danger { background: #E76F51; color: #FFFFFF; }
```

### Badges / Tags
```css
.badge { border-radius: 9999px; padding: 0.25rem 0.75rem; font-size: 0.75rem; font-weight: 600; }
.badge-green  { background: #F0F7F4; color: #2A7A5A; }
.badge-gold   { background: #FEF3E8; color: #D97706; }
.badge-coral  { background: #FDF0ED; color: #E76F51; }
.badge-sage   { background: #EAF5F0; color: #2A7A5A; }
.badge-gray   { background: #F3F4F6; color: #6B7280; }
```

---

## Website Section Colors

Alternating section backgrounds for visual rhythm:

| Section | Background | Heading Color |
|---------|-----------|--------------|
| Hero | Full-width image | White text |
| About | `#FBF8F3` (ivory) | `#2A7A5A` |
| Programs | `#FFFFFF` (white) | `#2A7A5A` |
| Why Choose Us | `#F4A261` (gold) | `#FFFFFF` |
| Curriculum | `#2A7A5A` (green) | `#FFFFFF` |
| Activities | `#E76F51` (coral) | `#FFFFFF` |
| Gallery | `#FBF8F3` (ivory) | `#2A7A5A` |
| Testimonials | `#FFFFFF` (white) | `#2A7A5A` |
| Blog | `#F0F7F4` (light sage) | `#2A7A5A` |
| Events | `#FBF8F3` (ivory) | `#2A7A5A` |
| Admissions | `#2A7A5A` (green) | `#FFFFFF` |
| FAQ | `#FFFFFF` (white) | `#2A7A5A` |
| Contact | `#F0F7F4` (light sage) | `#2A7A5A` |
| Footer | `#1A1A2E` (charcoal) | `#FFFFFF` |

---

## Animations

```css
/* Floating WhatsApp button */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.whatsapp-btn { animation: float 2.5s ease-in-out infinite; }

/* Card hover lift */
.card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
.card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }

/* Fade in on scroll */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in { animation: fadeInUp 0.5s ease forwards; }
```

---

## Responsive Breakpoints (Tailwind)

```
sm:  640px  — mobile landscape
md:  768px  — tablet
lg:  1024px — desktop
xl:  1280px — wide desktop
2xl: 1536px — ultrawide
```

Mobile-first approach throughout.
