import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Star, CheckCircle, Globe, Zap, Users,
  BookOpen, Heart, Shield, DollarSign, Trophy, Sparkles, Music, Leaf
} from "lucide-react";
import PublicLayout from "./layout/PublicLayout";
import HeroSection from "./sections/HeroSection";
import LazyImage from "./components/LazyImage";
import api from "@/lib/api";

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
      transform: visible ? "translateY(0)" : "translateY(32px)",
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

function FloatingBadge({ emoji, title, subtitle, style }) {
  return (
    <div className="absolute bg-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 z-10 border border-gray-100" style={style}>
      <span className="text-3xl">{emoji}</span>
      <div>
        <div className="font-extrabold text-sm text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>{title}</div>
        <div className="text-xs text-[#6B7280]">{subtitle}</div>
      </div>
    </div>
  );
}

function Dot({ color, size = 16, style }) {
  return <div className="absolute rounded-full opacity-30 pointer-events-none" style={{ width: size, height: size, backgroundColor: color, ...style }} />;
}

const WHY_HIGHLIGHTS = [
  { title: "Elite Without Elitist", desc: "Premium education grounded in philanthropy and genuine care.", icon: Star, color: "#f8d904" },
  { title: "Small Class Environments", desc: "Individualised attention, stronger student-teacher relationships.", icon: Users, color: "#6BCB77" },
  { title: "Technology-Driven", desc: "STEM, robotics, interactive classrooms, and digital learning.", icon: Zap, color: "#044875" },
  { title: "Financial Literacy", desc: "Seven Figure Kids Club — entrepreneurship from an early age.", icon: DollarSign, color: "#FF6B6B" },
  { title: "Reduced Homework", desc: "Home time is family time. Deep classroom understanding first.", icon: Heart, color: "#FFD93D" },
  { title: "Safe & Structured", desc: "Anti-bullying culture, high behavioural standards, and close supervision.", icon: Shield, color: "#c1e5e6" },
];

const PROGRAMMES = [
  { title: "Early Childhood", subtitle: "Ages 3–5", desc: "Literacy readiness, numeracy, emotional intelligence, and early technology exposure in a nurturing environment.", color: "#FF6B6B", icon: Heart },
  { title: "Primary Programme", subtitle: "Ages 5–12", desc: "Strong academics balanced with holistic development from Preschool through Standard Five.", color: "#044875", icon: BookOpen },
  { title: "SEA & Secondary Pathways", subtitle: "Standard 3–5", desc: "Progressive mastery with flexible secondary pathways — not just SEA, but life-ready education.", color: "#6BCB77", icon: Globe },
];

const STATS = [
  { num: "2018", label: "Year Founded" },
  { num: "17+", label: "Clubs & Activities" },
  { num: "3+", label: "Countries Visited" },
  { num: "100%", label: "Commitment to Excellence" },
];

const GALLERY_PREVIEW = [
  { src: "/TheRightWay_Images/Gallery/IMG_0551.jpg", alt: "Students in class", span: "col-span-1 row-span-2" },
  { src: "/TheRightWay_Images/PRESCHOOL 2026/IMG_8877.jpg", alt: "Preschool learning", span: "col-span-2 row-span-1" },
  { src: "/TheRightWay_Images/SEA 2026/IMG_9025.jpg", alt: "SEA celebration", span: "col-span-1 row-span-1" },
  { src: "/TheRightWay_Images/activities/IMG_1850.jpg", alt: "Students in activity", span: "col-span-1 row-span-1" },
  { src: "/TheRightWay_Images/Gallery/IMG_0628.jpg", alt: "School event", span: "col-span-2 row-span-1" },
  { src: "/TheRightWay_Images/activities/IMG_3864.jpg", alt: "Clubs and activities", span: "col-span-1 row-span-1" },
];

export default function Home() {
  const navigate = useNavigate();
  const [heroSlides, setHeroSlides] = useState([]);

  useEffect(() => {
    api.get("/website/hero").then((r) => setHeroSlides(r.data)).catch(() => {});
  }, []);

  const handleHeroNavigate = (id) => {
    const map = {
      programmes: "/academics", admissions: "/admissions",
      about: "/about", contact: "/contact", curriculum: "/academics", gallery: "/gallery",
    };
    navigate(map[id] || "/");
  };

  return (
    <PublicLayout>
      <Helmet>
        <title>The RightWay Centre of Learning | Trinidad & Tobago</title>
        <meta name="description" content="The RightWay Centre of Learning — Trinidad's premier private school offering elite education from Preschool to Standard Five. Technology-driven, values-based, globally inspired." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://learnrightschool.com/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="The RightWay Centre of Learning" />
        <meta property="og:title" content="The RightWay Centre of Learning | Trinidad & Tobago" />
        <meta property="og:description" content="Trinidad's premier private school — elite education from Preschool to Standard Five. Technology-driven, values-based, globally inspired." />
        <meta property="og:image" content="https://learnrightschool.com/TheRightWay_Images/PRESCHOOL 2026/IMG_8877.jpg" />
        <meta property="og:url" content="https://learnrightschool.com/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="The RightWay Centre of Learning | Trinidad & Tobago" />
        <meta name="twitter:description" content="Trinidad's premier private school — elite education from Preschool to Standard Five." />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "School",
          "name": "The RightWay Centre of Learning", "url": "https://learnrightschool.com",
          "telephone": "+18682212794", "email": "therightwaycloud@gmail.com", "foundingDate": "2018",
          "address": { "@type": "PostalAddress", "streetAddress": "Lot 26A Phillips Street, Montrose", "addressLocality": "Chaguanas", "addressCountry": "TT" },
          "sameAs": ["https://facebook.com/rightwayttschool", "https://instagram.com/rightwayttschool"]
        })}</script>
      </Helmet>

      {/* ── Hero ── */}
      <HeroSection slides={heroSlides} onNavigate={handleHeroNavigate} />

      {/* ── Stats strip ── */}
      <section aria-label="School highlights" style={{ backgroundColor: "#044875" }} className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-extrabold text-[#f8d904]" style={{ fontFamily: "Outfit, sans-serif" }}>{s.num}</div>
                <div className="text-xs text-white/60 mt-0.5 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About teaser ── */}
      <section id="about" aria-label="About RightWay" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeInSection>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-0.5 bg-[#044875]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Est. 2018 — Central Trinidad</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Elite Without<br />Being Elitist
                </h2>
                <p className="text-[#374151] leading-relaxed mb-5">
                  Founded on the philosophy that <strong>"The only way is the Rightway,"</strong> The Rightway Center of Learning was built to deliver a premium, technology-driven, globally inspired education to the families of Trinidad and Tobago.
                </p>
                <p className="text-[#374151] leading-relaxed mb-8">
                  Drawing from Finnish, Chinese, European, American, and Canadian educational systems, our students develop as confident thinkers, future leaders, and globally prepared learners.
                </p>
                <Link to="/about" className="inline-flex items-center gap-2 text-[#044875] font-bold hover:text-[#0a6aac] transition-colors group">
                  Learn More About Us
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </FadeInSection>

            <FadeInSection delay={150}>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { letter: "R", word: "Respect", color: "#044875" },
                  { letter: "I", word: "Integrity", color: "#f8d904" },
                  { letter: "G", word: "Gratitude", color: "#6BCB77" },
                  { letter: "H", word: "Holistic", color: "#FF6B6B" },
                  { letter: "T", word: "Thoughtful", color: "#FFD93D" },
                  { letter: "W", word: "Willing", color: "#c1e5e6" },
                  { letter: "A", word: "Articulate", color: "#044875" },
                  { letter: "Y", word: "Yourself", color: "#f8d904" },
                ].map((w) => (
                  <div key={w.letter}
                    className="rounded-xl p-4 flex items-center gap-3 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-default"
                    style={{ backgroundColor: w.color + "15", border: `2px solid ${w.color}40` }}>
                    <span className="text-2xl font-extrabold" style={{ fontFamily: "Outfit, sans-serif", color: w.color }}>{w.letter}</span>
                    <span className="text-sm font-semibold text-[#374151]">{w.word}</span>
                  </div>
                ))}
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ── Why Rightway cards ── */}
      <section id="why-rightway" aria-label="Why choose RightWay" className="py-20" style={{ background: "#FBF8F3" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-0.5 bg-[#044875]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">The Difference</span>
                <div className="w-8 h-0.5 bg-[#044875]" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
                Why Choose Rightway?
              </h2>
            </div>
          </FadeInSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {WHY_HIGHLIGHTS.map((item, i) => (
              <FadeInSection key={item.title} delay={i * 70}>
                <div className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-500 h-full">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: item.color + "20" }}>
                    <item.icon className="w-5 h-5" style={{ color: item.color === "#c1e5e6" ? "#044875" : item.color }} />
                  </div>
                  <h3 className="font-bold text-[#1A1A2E] mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>{item.title}</h3>
                  <p className="text-[#6B7280] text-sm leading-relaxed">{item.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
          <FadeInSection delay={400}>
            <div className="mt-10 text-center">
              <Link to="/about" className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#044875] text-[#044875] font-bold rounded-xl hover:bg-[#044875] hover:text-white transition-all duration-200 text-sm">
                See All 10 Reasons <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ── Programmes overview cards ── */}
      <section id="programmes" aria-label="Our programmes" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-0.5 bg-[#044875]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Our Programmes</span>
                <div className="w-8 h-0.5 bg-[#044875]" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
                Education Designed for the Future
              </h2>
            </div>
          </FadeInSection>
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {PROGRAMMES.map((prog, i) => (
              <FadeInSection key={prog.title} delay={i * 100}>
                <div className="group bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-500 overflow-hidden border border-[#E5E7EB] h-full"
                  style={{ borderTop: `4px solid ${prog.color}` }}>
                  <div className="p-7">
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: prog.color + "20" }}>
                        <prog.icon className="w-5 h-5" style={{ color: prog.color }} />
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: prog.color + "20", color: prog.color }}>
                        {prog.subtitle}
                      </span>
                    </div>
                    <h3 className="text-lg font-extrabold text-[#1A1A2E] mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>{prog.title}</h3>
                    <p className="text-[#6B7280] text-sm leading-relaxed">{prog.desc}</p>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
          <FadeInSection delay={300}>
            <div className="text-center">
              <Link to="/academics" className="inline-flex items-center gap-2 px-6 py-3 bg-[#044875] text-white font-bold rounded-xl hover:bg-[#0a6aac] transition-all text-sm shadow-md">
                Explore Academics <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ═══ ALTERNATING SECTION 1: Early Childhood — Image LEFT, Text RIGHT ═══ */}
      <section aria-label="Early Childhood programme" className="py-20 overflow-hidden" style={{ background: "#FFF5F5" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Image side */}
            <FadeInSection>
              <div className="relative">
                <Dot color="#FF6B6B" size={120} style={{ top: -30, left: -30 }} />
                <Dot color="#FFD93D" size={60} style={{ bottom: 40, left: -20 }} />
                <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{ borderLeft: "6px solid #FF6B6B", height: "420px" }}>
                  <LazyImage
                    src="/TheRightWay_Images/PRESCHOOL 2026/IMG_8877.jpg"
                    alt="Young children engaged in early childhood learning at RightWay"
                    className="hover:scale-105 transition-transform duration-700"
                    objectPosition="top"
                    wrapperClassName="h-full"
                  />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(255,107,107,0.15) 0%, transparent 60%)" }} />
                </div>
                <FloatingBadge emoji="🌱" title="Ages 3 – 5" subtitle="Early Childhood" style={{ bottom: -18, right: -10, whiteSpace: "nowrap" }} />
                <div className="absolute top-6 right-6 bg-[#FF6B6B] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  Nursery & Kindergarten
                </div>
              </div>
            </FadeInSection>

            {/* Text side */}
            <FadeInSection delay={150}>
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-1.5 rounded-full bg-[#FF6B6B]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[#FF6B6B]">Little Learners</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-5 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Little Minds,<br />Big Dreams ✨
                </h2>
                <p className="text-[#6B7280] leading-relaxed mb-7">
                  Our Early Childhood programme is a magical place where curiosity is celebrated, creativity blooms, and every child discovers the joy of learning. We combine Montessori principles with play-based exploration to build confident, happy learners.
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    { text: "Sensory Play & Exploration", color: "#FF6B6B" },
                    { text: "Phonics & Early Reading", color: "#FF6B6B" },
                    { text: "Numeracy & Problem Solving", color: "#FF6B6B" },
                    { text: "Music, Art & Creative Expression", color: "#FF6B6B" },
                    { text: "Technology Exposure from Day One", color: "#FF6B6B" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3 group">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110" style={{ backgroundColor: item.color }}>
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-[#374151]">{item.text}</span>
                    </div>
                  ))}
                </div>
                <Link to="/academics"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 shadow-md hover:-translate-y-0.5"
                  style={{ backgroundColor: "#FF6B6B", color: "white" }}>
                  Explore Early Childhood <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ═══ ALTERNATING SECTION 2: Activities & Clubs — Text LEFT, Image RIGHT ═══ */}
      <section aria-label="Clubs and activities" className="py-20 overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Text side */}
            <FadeInSection>
              <div className="lg:order-1">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-1.5 rounded-full bg-[#f8d904]" />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#bc9908" }}>Beyond the Classroom</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-5 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Learn, Play,<br />& Discover 🎨
                </h2>
                <p className="text-[#6B7280] leading-relaxed mb-7">
                  With 17+ clubs and activities, there's something for every child at RightWay. We believe learning happens everywhere — from the swimming pool to the robotics lab, from the art studio to the football field.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {[
                    { emoji: "🤖", label: "Robotics & STEM" },
                    { emoji: "🏊", label: "Swimming" },
                    { emoji: "⚽", label: "Football" },
                    { emoji: "💰", label: "Seven Figure Kids" },
                    { emoji: "📷", label: "Photography" },
                    { emoji: "🎭", label: "Drama Club" },
                    { emoji: "♟️", label: "Chess" },
                    { emoji: "🎵", label: "Music & Steel Pan" },
                  ].map((c) => (
                    <div key={c.label}
                      className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border-2 border-[#f8d904]/40 bg-[#FFFBEB] hover:border-[#f8d904] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
                      <span className="text-lg">{c.emoji}</span>
                      <span className="text-xs font-semibold text-[#374151]">{c.label}</span>
                    </div>
                  ))}
                </div>
                <Link to="/student-life"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-[#044875] transition-all duration-200 shadow-md hover:-translate-y-0.5 border-2 border-[#f8d904]"
                  style={{ backgroundColor: "#f8d904" }}>
                  Explore Student Life <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeInSection>

            {/* Image collage side */}
            <FadeInSection delay={150} className="lg:order-2">
              <div className="relative">
                <Dot color="#f8d904" size={100} style={{ top: -20, right: -20 }} />
                <Dot color="#6BCB77" size={50} style={{ bottom: 30, right: -10 }} />
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { src: "/TheRightWay_Images/activities/IMG_1853.jpg", alt: "Students in activity", border: "#f8d904" },
                    { src: "/TheRightWay_Images/activities/IMG_3871.jpg", alt: "Club activity", border: "#FF6B6B" },
                    { src: "/TheRightWay_Images/activities/IMG_4213.jpg", alt: "Students playing", border: "#6BCB77" },
                    { src: "/TheRightWay_Images/activities/IMG_2378.jpg", alt: "School activities", border: "#044875" },
                  ].map((img) => (
                    <div key={img.src} className="rounded-2xl overflow-hidden shadow-lg" style={{ borderTop: `4px solid ${img.border}` }}>
                      {/* aspect-[4/3] = natural landscape ratio — no cropping */}
                      <div className="aspect-[4/3]">
                        <LazyImage src={img.src} alt={img.alt} className="hover:scale-105 transition-transform duration-500" objectPosition="center" wrapperClassName="h-full" />
                      </div>
                    </div>
                  ))}
                </div>
                <FloatingBadge emoji="🏆" title="17+ Clubs" subtitle="Something for everyone" style={{ bottom: -16, left: -12, whiteSpace: "nowrap" }} />
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ═══ ALTERNATING SECTION 3: Academic Excellence — Image LEFT, Text RIGHT ═══ */}
      <section aria-label="Academic excellence and SEA" className="py-20 overflow-hidden" style={{ background: "#F0FFF4" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Image side */}
            <FadeInSection>
              <div className="relative">
                <Dot color="#6BCB77" size={110} style={{ top: -25, left: -25 }} />
                <Dot color="#044875" size={55} style={{ bottom: 50, left: -15 }} />
                <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{ borderLeft: "6px solid #6BCB77", height: "420px" }}>
                  <LazyImage
                    src="/TheRightWay_Images/SEA 2026/IMG_9025.jpg"
                    alt="RightWay students celebrating SEA exam success"
                    className="hover:scale-105 transition-transform duration-700"
                    objectPosition="top"
                    wrapperClassName="h-full"
                  />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(107,203,119,0.15) 0%, transparent 60%)" }} />
                </div>
                <FloatingBadge emoji="🎓" title="SEA 2026" subtitle="Celebrating our graduates" style={{ bottom: -18, right: -10, whiteSpace: "nowrap" }} />
                <div className="absolute top-6 right-6 bg-[#6BCB77] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  100% Excellence
                </div>
              </div>
            </FadeInSection>

            {/* Text side */}
            <FadeInSection delay={150}>
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-1.5 rounded-full bg-[#6BCB77]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[#6BCB77]">Academic Excellence</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-5 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Building Tomorrow's<br />Leaders Today 🏆
                </h2>
                <p className="text-[#6B7280] leading-relaxed mb-7">
                  Our rigorous, nationally aligned curriculum — enriched with Montessori methods, technology integration, and real-world projects — prepares students for SEA and beyond. But we go further: we prepare them for life.
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    { text: "SEA-aligned curriculum from Standard 1", color: "#6BCB77" },
                    { text: "STEM, Robotics & Financial Literacy", color: "#6BCB77" },
                    { text: "Technology in every classroom", color: "#6BCB77" },
                    { text: "International curriculum influences", color: "#6BCB77" },
                    { text: "Reduced homework — deeper learning", color: "#6BCB77" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3 group">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110" style={{ backgroundColor: item.color }}>
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-[#374151]">{item.text}</span>
                    </div>
                  ))}
                </div>
                <Link to="/academics"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 shadow-md hover:-translate-y-0.5"
                  style={{ backgroundColor: "#6BCB77" }}>
                  Explore Academics <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ═══ ALTERNATING SECTION 4: Student Life — Text LEFT, Image RIGHT ═══ */}
      <section aria-label="Student life and global exposure" className="py-20 overflow-hidden" style={{ backgroundColor: "#044875" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Text side */}
            <FadeInSection>
              <div className="text-white">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-1.5 rounded-full bg-[#f8d904]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[#f8d904]/80">A World of Experiences</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold mb-5 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Education Without<br />Borders 🌍
                </h2>
                <p className="text-white/75 leading-relaxed mb-6">
                  Our students have visited Margarita, Panama, and Mexico — with European tours planned for 2027. From international travel to gala events, the Rightway Café to House competitions, every day is an adventure.
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    { emoji: "✈️", text: "International Travel Programme" },
                    { emoji: "🍽️", text: "The Rightway Café — real-world economics" },
                    { emoji: "🏠", text: "House System — community & team spirit" },
                    { emoji: "🎪", text: "Annual Gala & Cultural Events" },
                    { emoji: "🌐", text: "UN Sustainable Development Goals curriculum" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3">
                      <span className="text-xl">{item.emoji}</span>
                      <span className="text-sm font-medium text-white/85">{item.text}</span>
                    </div>
                  ))}
                </div>
                <Link to="/student-life"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#f8d904] text-[#044875] font-bold rounded-xl hover:bg-[#bc9908] transition-all duration-200 text-sm shadow-lg hover:-translate-y-0.5">
                  Explore Student Life <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeInSection>

            {/* Image side */}
            <FadeInSection delay={150}>
              <div className="relative">
                <div className="rounded-3xl overflow-hidden shadow-2xl" style={{ borderLeft: "6px solid #f8d904", height: "420px" }}>
                  <LazyImage
                    src="/TheRightWay_Images/activities/IMG_4107.jpg"
                    alt="RightWay students at a school event or international trip"
                    className="hover:scale-105 transition-transform duration-700"
                    objectPosition="center"
                    wrapperClassName="h-full"
                  />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(4,72,117,0.3) 0%, transparent 50%)" }} />
                </div>
                <FloatingBadge emoji="🌎" title="3+ Countries" subtitle="And growing each year" style={{ bottom: -18, right: -10, whiteSpace: "nowrap" }} />
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ── Gallery Preview with real images ── */}
      <section id="gallery" aria-label="Photo gallery preview" className="py-20" style={{ background: "#FBF8F3" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-0.5 bg-[#044875]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Visual Tour</span>
                <div className="w-8 h-0.5 bg-[#044875]" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
                Life at Rightway 📸
              </h2>
              <p className="text-[#6B7280] mt-3 max-w-xl mx-auto text-sm">
                Real moments from our school community — in the classroom, on the field, around the world.
              </p>
            </div>
          </FadeInSection>

          {/* Gallery preview grid — aspect-ratio driven so no image crops */}
          <FadeInSection delay={100}>
            <div className="grid grid-cols-3 gap-3">
              {/* Left col — tall portrait spanning 2 rows */}
              <div className="row-span-2 rounded-2xl overflow-hidden shadow-lg">
                {/* aspect-[3/4] matches portrait 4000×6000 ratio */}
                <div className="aspect-[3/4]">
                  <LazyImage src="/TheRightWay_Images/Gallery/IMG_0620.jpg" alt="RightWay school life" className="hover:scale-105 transition-transform duration-500" objectPosition="top" wrapperClassName="h-full" />
                </div>
              </div>
              {/* Top-right wide landscape — aspect-[16/9] */}
              <div className="col-span-2 rounded-2xl overflow-hidden shadow-lg">
                <div className="aspect-[16/9]">
                  <LazyImage src="/TheRightWay_Images/Gallery/IMG_0702.jpg" alt="Students in activity" className="hover:scale-105 transition-transform duration-500" objectPosition="center" wrapperClassName="h-full" />
                </div>
              </div>
              {/* Bottom-right two landscape squares side by side */}
              <div className="rounded-2xl overflow-hidden shadow-lg">
                <div className="aspect-[4/3]">
                  <LazyImage src="/TheRightWay_Images/activities/IMG_1804.jpg" alt="Students playing" className="hover:scale-105 transition-transform duration-500" objectPosition="center" wrapperClassName="h-full" />
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-lg">
                <div className="aspect-[4/3]">
                  <LazyImage src="/TheRightWay_Images/activities/IMG_3997.jpg" alt="School activities" className="hover:scale-105 transition-transform duration-500" objectPosition="center" wrapperClassName="h-full" />
                </div>
              </div>
            </div>
          </FadeInSection>

          <FadeInSection delay={300}>
            <div className="mt-8 text-center">
              <Link to="/gallery"
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#044875] text-[#044875] font-bold rounded-xl hover:bg-[#044875] hover:text-white transition-all duration-200 text-sm">
                View Full Gallery <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ── Admissions CTA ── */}
      <section id="admissions" aria-label="Admissions call to action" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="rounded-3xl overflow-hidden" style={{ background: "linear-gradient(135deg, #044875 0%, #0a6aac 100%)" }}>
              <div className="px-10 py-14 text-center relative">
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #f8d904 0%, transparent 50%), radial-gradient(circle at 80% 30%, #c1e5e6 0%, transparent 40%)" }} />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-medium mb-6 text-white backdrop-blur-sm">
                    <Star className="w-3 h-3 text-[#f8d904]" /> Spaces Are Limited
                  </div>
                  <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                    Ready to Begin the Rightway Journey?
                  </h2>
                  <p className="text-white/75 max-w-xl mx-auto mb-8 text-sm leading-relaxed">
                    Rightway maintains intentionally small class environments. We encourage interested families to begin the admissions process early to secure their child's place.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link to="/admissions"
                      className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#f8d904] text-[#044875] font-bold rounded-xl hover:bg-[#bc9908] transition-all duration-200 shadow-lg text-sm hover:-translate-y-0.5">
                      Apply Now <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link to="/contact"
                      className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/10 border-2 border-white/40 text-white font-bold rounded-xl hover:bg-white/20 transition-all duration-200 text-sm">
                      Book a Visit
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>
    </PublicLayout>
  );
}
