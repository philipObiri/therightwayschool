import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Star, ArrowRight, Globe, Trophy, Camera, Utensils,
  Car, Shield, Leaf, Users, Zap, ChevronRight, CheckCircle,
  Waves, Activity, Bot, Music, TrendingUp, Target, Mic,
  Settings, Rocket, Brain, DollarSign
} from "lucide-react";
import PublicLayout from "./layout/PublicLayout";

function FadeInSection({ children, delay = 0, className = "" }) {
  const [visible, setVisible] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.08 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(28px)",
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

const BASE = "/TheRightWay_Images";

function clubAnim(type) {
  const map = {
    bounce: "icon-bounce 0.9s ease-in-out infinite",
    pulse:  "icon-pulse 2s ease-in-out infinite",
    spin:   "icon-spin 3s linear infinite",
    wave:   "icon-wave 1.6s ease-in-out infinite",
    sway:   "icon-sway 2s ease-in-out infinite",
    rise:   "icon-rise 1.8s ease-in-out infinite",
    dash:   "icon-dash 1.1s ease-in-out infinite",
    click:  "icon-click 2.4s ease-in-out infinite",
  };
  return map[type] || "none";
}

const CLUBS = [
  { name: "Swimming",           emoji: "🏊", Icon: Waves,      color: "#3B82F6", anim: "wave"   },
  { name: "Gymnastics",         emoji: "🤸", Icon: Activity,   color: "#FF6B6B", anim: "bounce" },
  { name: "Robotics",           emoji: "🤖", Icon: Bot,        color: "#6366F1", anim: "spin"   },
  { name: "Football",           emoji: "⚽", Icon: Trophy,     color: "#10B981", anim: "bounce" },
  { name: "Chess",              emoji: "♟️", Icon: Brain,      color: "#044875", anim: "pulse"  },
  { name: "Cakes & Cookies",    emoji: "🍪", Icon: Utensils,   color: "#F59E0B", anim: "bounce" },
  { name: "Dance",              emoji: "💃", Icon: Music,      color: "#EC4899", anim: "sway"   },
  { name: "Seven Figure Kids",  emoji: "💰", Icon: TrendingUp, color: "#059669", anim: "rise"   },
  { name: "Cricket",            emoji: "🏏", Icon: Target,     color: "#8B5CF6", anim: "bounce" },
  { name: "Track",              emoji: "🏃", Icon: Zap,        color: "#EF4444", anim: "dash"   },
  { name: "Tennis",             emoji: "🎾", Icon: Activity,   color: "#CA8A04", anim: "bounce" },
  { name: "Photography",        emoji: "📷", Icon: Camera,     color: "#374151", anim: "click"  },
  { name: "Public Speaking",    emoji: "🎤", Icon: Mic,        color: "#7C3AED", anim: "pulse"  },
  { name: "Engineering Club",   emoji: "⚙️", Icon: Settings,   color: "#1E40AF", anim: "spin"   },
  { name: "Nature & Environ.",  emoji: "🌿", Icon: Leaf,       color: "#16A34A", anim: "sway"   },
  { name: "Entrepreneurship",   emoji: "🚀", Icon: Rocket,     color: "#DC2626", anim: "rise"   },
  { name: "Boys to Men",        emoji: "👔", Icon: Shield,     color: "#044875", anim: "pulse"  },
];

const COUNTRIES = [
  {
    name: "Margarita Island",
    country: "Venezuela",
    year: "2024",
    flagCode: "ve",
    bgColor: "#CF142B",
    accent: "#FFD100",
    img: `${BASE}/Gallery/IMG_0701.jpg`,
    desc: "Stunning Caribbean coastlines, culture, and sea adventures on the Island of Pearls.",
  },
  {
    name: "Panama City",
    country: "Panama",
    year: "2025",
    flagCode: "pa",
    bgColor: "#003087",
    accent: "#D21034",
    img: `${BASE}/Gallery/IMG_0628.jpg`,
    desc: "The Panama Canal, city exploration, and a deep dive into engineering marvels of the world.",
  },
  {
    name: "Mexico City",
    country: "Mexico",
    year: "2026",
    flagCode: "mx",
    bgColor: "#006847",
    accent: "#CE1126",
    img: `${BASE}/Gallery/IMG_0577.jpg`,
    desc: "Ancient civilisations, vibrant culture, cuisine, and history in the heart of Latin America.",
  },
];

const UPCOMING = [
  { name: "Amsterdam", country: "Netherlands", flagCode: "nl", bgColor: "#AE1C28", accent: "#FFFFFF", year: "2027" },
  { name: "Berlin", country: "Germany", flagCode: "de", bgColor: "#000000", accent: "#DD0000", year: "2027" },
];

const HOUSES = [
  { name: "Haijun", color: "#FF6B6B", desc: "Spirit & Courage" },
  { name: "Schaffer", color: "#044875", desc: "Wisdom & Purpose" },
  { name: "Ortiz", color: "#6BCB77", desc: "Growth & Harmony" },
  { name: "Flores", color: "#FFD93D", desc: "Joy & Innovation" },
];

const UNSDG_GOALS = [
  { num: 1, label: "No Poverty", color: "#E5243B" },
  { num: 2, label: "Zero Hunger", color: "#DDA63A" },
  { num: 3, label: "Good Health & Wellbeing", color: "#4C9F38" },
  { num: 4, label: "Quality Education", color: "#C5192D" },
];

const EVENTS = [
  { label: "Annual Gala & Graduation", emoji: "🎓" },
  { label: "Sports & Family Day", emoji: "⚽" },
  { label: "Cultural Showcases", emoji: "🎭" },
  { label: "Leadership Events", emoji: "🏆" },
  { label: "Entrepreneurship Activities", emoji: "💼" },
  { label: "SDG-Focused Projects", emoji: "🌍" },
  { label: "School Trips", emoji: "✈️" },
  { label: "Holiday Programmes", emoji: "🎉" },
  { label: "Student Showcases", emoji: "🎨" },
  { label: "Community Engagement Events", emoji: "🤝" },
];

const EXPERIENCE_FEATURES = [
  { label: "Valet-style drop-off & pick-up", icon: Car, color: "#044875" },
  { label: "Individual student cubbies", icon: Shield, color: "#6BCB77" },
  { label: "Technology-integrated classrooms", icon: Zap, color: "#f8d904" },
  { label: "Laptop charging stations", icon: Zap, color: "#FF6B6B" },
  { label: "Small class communities", icon: Users, color: "#c1e5e6" },
  { label: "Safe & supervised campus", icon: Shield, color: "#FFD93D" },
];

// A selection of activities images for the collage grid
const ACTIVITY_PHOTOS = [
  { src: `${BASE}/classroom/technology_with_purpose.jpg`, alt: "Technology and innovation" },
  { src: `${BASE}/clubs/adorable-robotics.jpg`, alt: "Robotics club" },
  { src: `${BASE}/activities/IMG_1817.jpg`, alt: "Sports activity" },
  { src: `${BASE}/activities/IMG_2546.jpg`, alt: "Swimming club" },
  { src: `${BASE}/activities/IMG_1807.jpg`, alt: "Arts and dance" },
  { src: `${BASE}/activities/IMG_1804.jpg`, alt: "Cooking club" },
];

export default function StudentLife() {
  return (
    <PublicLayout>
      <Helmet>
        <title>Student Life | The RightWay Centre of Learning</title>
        <meta name="description" content="Discover vibrant student life at The RightWay Centre — clubs, sports, international travel, the Rightway Café, events, and global exposure opportunities." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://learnrightschool.com/student-life" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="The RightWay Centre of Learning" />
        <meta property="og:title" content="Student Life | The RightWay Centre of Learning" />
        <meta property="og:description" content="Clubs, sports, international travel, the Rightway Café, House system — a vibrant, enriching school life beyond the classroom." />
        <meta property="og:image" content="https://learnrightschool.com/TheRightWay_Images/activities/IMG_1850.jpg" />
        <meta property="og:url" content="https://learnrightschool.com/student-life" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "WebPage",
          "name": "Student Life — The RightWay Centre of Learning",
          "url": "https://learnrightschool.com/student-life",
          "breadcrumb": { "@type": "BreadcrumbList", "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://learnrightschool.com/" },
            { "@type": "ListItem", "position": 2, "name": "Student Life", "item": "https://learnrightschool.com/student-life" }
          ]}
        })}</script>
      </Helmet>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden py-24" style={{ background: "linear-gradient(135deg, #044875 0%, #0a6aac 100%)" }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 30% 70%, #f8d904 0%, transparent 50%), radial-gradient(circle at 80% 20%, #6BCB77 0%, transparent 40%)" }} />
        {[["#FF6B6B", "10%", "5%", 80], ["#f8d904", "75%", "12%", 55], ["#6BCB77", "20%", "85%", 65]].map(([c, l, t, s]) => (
          <div key={c} className="absolute rounded-full opacity-20 pointer-events-none" style={{ width: s, height: s, backgroundColor: c, left: l, top: t }} />
        ))}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-white">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-6 backdrop-blur-sm">
                <Star className="w-3.5 h-3.5 text-[#f8d904]" /> More Than a School Experience
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                Student Life<br />at Rightway 🌟
              </h1>
              <p className="text-lg text-white/80 leading-relaxed mb-8">
                From the moment students arrive each morning, they enter an environment built around comfort, confidence, creativity, leadership, and holistic development.
              </p>
              <div className="flex flex-wrap gap-3">
                {["17+ Clubs", "3 Countries Visited", "Annual Gala", "International Travel"].map((b) => (
                  <span key={b} className="px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-semibold text-white">{b}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {ACTIVITY_PHOTOS.slice(0, 4).map((p, i) => (
                <div key={p.src} className={`rounded-2xl overflow-hidden shadow-xl ${i === 0 ? "row-span-2" : ""}`} style={{ borderTop: `3px solid ${["#FF6B6B","#f8d904","#6BCB77","#c1e5e6"][i]}` }}>
                  <img src={p.src} alt={p.alt} className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── The Rightway Experience ── */}
      <section id="experience" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeInSection>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-0.5 bg-[#044875]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">A Premium Environment</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  The Rightway Experience ✨
                </h2>
                <p className="text-[#374151] leading-relaxed mb-8">
                  Every aspect of student life is intentionally designed to create an environment where students feel confident, comfortable, and excited to learn every single day.
                </p>
                <div className="space-y-3">
                  {EXPERIENCE_FEATURES.map((feat, i) => (
                    <div key={feat.label} className="flex items-center gap-3 group">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: feat.color + "25" }}>
                        <feat.icon className="w-4 h-4" style={{ color: feat.color === "#c1e5e6" ? "#044875" : feat.color }} />
                      </div>
                      <span className="text-sm font-medium text-[#374151]">{feat.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeInSection>
            <FadeInSection delay={150}>
              <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{ borderLeft: "6px solid #044875" }}>
                <img
                  src={`${BASE}/Gallery/IMG_0569.jpg`}
                  alt="RightWay school environment and student experience"
                  className="w-full h-[440px] object-cover hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ── The Rightway Café — Image left, text right ── */}
      <section id="cafe" className="py-20 overflow-hidden" style={{ background: "#FFFBEB" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeInSection>
              <div className="relative">
                <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full opacity-30 pointer-events-none" style={{ backgroundColor: "#f8d904" }} />
                <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{ borderLeft: "6px solid #f8d904" }}>
                  <img
                    src={`${BASE}/events/canteen.jpg`}
                    alt="The Rightway Café — student dining and social experience"
                    className="w-full h-[400px] object-cover hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                </div>
                <div className="absolute -bottom-4 -right-4 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2">
                  <span className="text-2xl">☕</span>
                  <div>
                    <div className="font-extrabold text-sm text-[#1A1A2E]">Rightway Café</div>
                    <div className="text-xs text-[#6B7280]">Freshly prepared daily</div>
                  </div>
                </div>
              </div>
            </FadeInSection>
            <FadeInSection delay={150}>
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-1.5 rounded-full bg-[#f8d904]" />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#bc9908" }}>On Campus</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-5 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  The Rightway Café 🍽️
                </h2>
                <p className="text-[#374151] leading-relaxed mb-7">
                  The Rightway Café is one of the most loved spaces on campus. It reflects the school's commitment to balance, convenience, wellbeing, and creating an enjoyable school culture.
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    "Wide-ranging daily meal options",
                    "Freshly prepared lunches and snacks",
                    "Child-friendly menu selections",
                    "Healthy meal choices",
                    "Fun café experiences",
                    "Social lunchtime environments",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 group">
                      <div className="w-6 h-6 rounded-full bg-[#f8d904] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <CheckCircle className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-sm font-medium text-[#374151]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ── Clubs & Activities — Text left, Photo grid right ── */}
      <section id="clubs" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <FadeInSection>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-0.5 bg-[#FF6B6B]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Extracurricular</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-5 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Clubs & Activities 🎨
                </h2>
                <p className="text-[#374151] leading-relaxed mb-8">
                  With 17+ clubs and activities, every child discovers their strengths. We believe education extends far beyond the classroom — into sports, arts, entrepreneurship, and life skills.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {CLUBS.map((club) => (
                    <div key={club.name}
                      className="group rounded-xl cursor-default hover:-translate-y-1.5 transition-all duration-300 shadow-sm hover:shadow-lg"
                      style={{
                        borderTop: `3px solid ${club.color}`,
                        background: `linear-gradient(135deg, ${club.color}18 0%, ${club.color}32 100%)`,
                      }}>
                      <div className="flex flex-col items-center justify-center gap-1.5 h-24 px-2">
                        <div style={{ animation: clubAnim(club.anim), color: club.color, display: "inline-flex" }}>
                          <club.Icon className="w-8 h-8" strokeWidth={1.8} />
                        </div>
                        <span className="text-[9px] font-bold text-center leading-tight text-[#1A1A2E]">
                          {club.emoji} {club.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeInSection>

            <FadeInSection delay={150}>
              <div className="grid grid-cols-2 gap-3">
                {ACTIVITY_PHOTOS.map((p, i) => (
                  <div key={p.src} className={`rounded-2xl overflow-hidden shadow-lg group ${i === 0 ? "col-span-2" : ""}`}
                    style={{ borderTop: `3px solid ${["#FF6B6B","#f8d904","#6BCB77","#044875","#FFD93D","#c1e5e6"][i]}` }}>
                    <img src={p.src} alt={p.alt} className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      style={{ height: i === 0 ? 200 : 140 }} loading="lazy" />
                  </div>
                ))}
                <div className="col-span-2 bg-gradient-to-r from-[#044875] to-[#0a6aac] rounded-2xl p-5 text-white text-center">
                  <div className="text-3xl font-extrabold text-[#f8d904]" style={{ fontFamily: "Outfit, sans-serif" }}>17+</div>
                  <div className="text-sm font-semibold">Clubs & Activities</div>
                  <div className="text-xs text-white/60 mt-0.5">Something for every child</div>
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ── International Travel — Real flags + alternating images ── */}
      <section id="travel" className="py-20 overflow-hidden" style={{ backgroundColor: "#044875" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-0.5 bg-[#f8d904]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-white/60">Global Exposure</span>
                <div className="w-8 h-0.5 bg-[#f8d904]" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>
                Learning Beyond Borders 🌍
              </h2>
              <p className="text-white/70 max-w-2xl mx-auto">
                Rightway believes some of the most meaningful learning experiences happen beyond the classroom walls — and beyond borders.
              </p>
            </div>
          </FadeInSection>

          {/* Countries visited — alternating image + flag + text */}
          <div className="space-y-10 mb-16">
            {COUNTRIES.map((country, i) => (
              <FadeInSection key={country.name} delay={i * 100}>
                <div className={`grid lg:grid-cols-2 gap-8 items-center ${i % 2 === 1 ? "lg:grid-flow-dense" : ""}`}>
                  {/* Image side */}
                  <div className={`relative rounded-3xl overflow-hidden shadow-2xl ${i % 2 === 1 ? "lg:col-start-2" : ""}`}
                    style={{ borderLeft: i % 2 === 0 ? `5px solid ${country.accent}` : "none", borderRight: i % 2 === 1 ? `5px solid ${country.accent}` : "none" }}>
                    <img src={country.img} alt={`RightWay students in ${country.name}`}
                      className="w-full h-64 object-cover hover:scale-105 transition-transform duration-700" loading="lazy" />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)" }} />
                    <div className="absolute bottom-4 left-4 flex items-center gap-3">
                      <img
                        src={`https://flagcdn.com/w80/${country.flagCode}.png`}
                        alt={`${country.country} flag`}
                        className="w-12 h-8 object-cover rounded shadow-md border border-white/30"
                      />
                      <div>
                        <div className="text-white font-extrabold text-lg" style={{ fontFamily: "Outfit, sans-serif", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{country.name}</div>
                        <div className="text-white/80 text-sm">{country.country}</div>
                      </div>
                    </div>
                  </div>

                  {/* Text side */}
                  <div className={i % 2 === 1 ? "lg:col-start-1 lg:row-start-1" : ""}>
                    <div className="flex items-center gap-3 mb-4">
                      {/* Large flag display */}
                      <div className="w-16 h-12 rounded-xl overflow-hidden shadow-lg border border-white/20">
                        <img
                          src={`https://flagcdn.com/w160/${country.flagCode}.png`}
                          alt={`${country.country} flag`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="text-white font-extrabold text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>{country.name}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/60 text-sm">{country.country}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: country.accent + "60" }}>{country.year}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-white/80 leading-relaxed text-sm mb-4">{country.desc}</p>
                    <div className="flex items-center gap-2 text-[#f8d904] text-xs font-semibold">
                      <Globe className="w-4 h-4" />
                      Visited {country.year}
                    </div>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>

          {/* Upcoming destinations */}
          <FadeInSection delay={200}>
            <div className="bg-white/10 rounded-3xl p-8 border border-white/10 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-[#f8d904] mb-6 text-center uppercase tracking-wider">Coming in 2027 ✈️</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {UPCOMING.map((c) => (
                  <div key={c.name} className="flex items-center gap-5 bg-white/10 rounded-2xl px-6 py-5 hover:bg-white/15 transition-colors">
                    <div className="w-20 h-14 rounded-xl overflow-hidden shadow-lg border border-white/20 flex-shrink-0">
                      <img src={`https://flagcdn.com/w160/${c.flagCode}.png`} alt={`${c.country} flag`} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="text-white font-extrabold text-xl" style={{ fontFamily: "Outfit, sans-serif" }}>{c.name}</div>
                      <div className="text-white/60 text-sm">{c.country}</div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-[#f8d904]/20 text-[#f8d904] border border-[#f8d904]/30">Upcoming {c.year}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-white/60 text-sm text-center mt-6 max-w-lg mx-auto">
                These experiences allow students to engage with different cultures, histories, technologies, and global perspectives while developing independence and confidence.
              </p>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ── School Events — alternating grid ── */}
      <section id="events" className="py-20 overflow-hidden" style={{ background: "#FBF8F3" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeInSection>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-0.5 bg-[#044875]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">School Culture</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Gala, Events &<br />School Culture 🎭
                </h2>
                <p className="text-[#374151] leading-relaxed mb-6">
                  Rightway is known for its vibrant school culture. Throughout the academic year, students participate in events that celebrate creativity, leadership, confidence, and achievement.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {EVENTS.map((event) => (
                    <div key={event.label} className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                      <span className="text-lg">{event.emoji}</span>
                      <span className="text-xs font-semibold text-[#374151] leading-tight">{event.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeInSection>

            <FadeInSection delay={150}>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 rounded-2xl overflow-hidden shadow-xl" style={{ borderTop: "4px solid #f8d904" }}>
                  <img src={`${BASE}/Gallery/IMG_0643.jpg`} alt="RightWay school event" className="w-full h-52 object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
                </div>
                <div className="rounded-2xl overflow-hidden shadow-lg" style={{ borderTop: "4px solid #FF6B6B" }}>
                  <img src={`${BASE}/Gallery/IMG_0637.jpg`} alt="School gala" className="w-full h-36 object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
                </div>
                <div className="rounded-2xl overflow-hidden shadow-lg" style={{ borderTop: "4px solid #6BCB77" }}>
                  <img src={`${BASE}/Gallery/IMG_0633.jpg`} alt="Student showcase" className="w-full h-36 object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
                </div>
                <div className="col-span-2 rounded-2xl overflow-hidden shadow-lg" style={{ borderTop: "4px solid #044875" }}>
                  <img src={`${BASE}/Gallery/IMG_0777.jpg`} alt="Community event"
                    className="w-full h-40 object-cover hover:scale-105 transition-transform duration-500" loading="lazy"
                    onError={(e) => { e.target.src = `${BASE}/Gallery/IMG_0769.jpg`; }} />
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ── Houses & UNSDG ── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            <FadeInSection>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-0.5 bg-[#044875]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Community & Pride</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-[#1A1A2E] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Our Houses 🏠
                </h2>
                <p className="text-[#374151] text-sm leading-relaxed mb-7">
                  Inspired by global leadership and international thinking, our House system fosters team spirit, discipline, healthy competition, and school pride.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {HOUSES.map((h) => (
                    <div key={h.name} className="rounded-2xl p-5 text-center hover:-translate-y-1 transition-all duration-300 cursor-default shadow-sm group"
                      style={{ backgroundColor: h.color + "15", border: `2px solid ${h.color}40` }}>
                      <div className="text-xl font-extrabold mb-1" style={{ fontFamily: "Outfit, sans-serif", color: h.color }}>{h.name}</div>
                      <div className="text-xs text-[#6B7280]">{h.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeInSection>

            <FadeInSection delay={100}>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-0.5 bg-[#044875]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Global Leadership</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-[#1A1A2E] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
                  UN Sustainable Development Goals 🌐
                </h2>
                <p className="text-[#374151] text-sm leading-relaxed mb-7">
                  Rightway actively introduces students to leadership, social responsibility, sustainability, and global citizenship through initiatives aligned with the United Nations SDGs.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {UNSDG_GOALS.map((goal) => (
                    <div key={goal.num} className="rounded-2xl p-4 text-white shadow-sm hover:-translate-y-1 transition-all duration-300"
                      style={{ backgroundColor: goal.color }}>
                      <div className="text-2xl font-extrabold mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>{goal.num}</div>
                      <div className="text-xs font-medium opacity-90">{goal.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16" style={{ backgroundColor: "#044875" }}>
        <div className="max-w-4xl mx-auto px-4 text-center">
          <FadeInSection>
            <div className="text-5xl mb-4">🌟</div>
            <h2 className="text-3xl font-extrabold text-white mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
              School Should Feel Inspiring
            </h2>
            <p className="text-white/70 mb-8 max-w-xl mx-auto">
              Because education should not only prepare students for examinations. It should prepare them for life.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/admissions"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#f8d904] text-[#044875] font-bold rounded-xl hover:bg-[#bc9908] transition-all duration-200 shadow-md hover:-translate-y-0.5">
                Apply Now <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/gallery"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/10 border-2 border-white/40 text-white font-bold rounded-xl hover:bg-white/20 transition-all duration-200">
                View Gallery
              </Link>
            </div>
          </FadeInSection>
        </div>
      </section>
    </PublicLayout>
  );
}
