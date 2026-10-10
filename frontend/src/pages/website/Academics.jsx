import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  BookOpen, Cpu, DollarSign, Users, Star, ArrowRight, CheckCircle,
  Lightbulb, FlaskConical, Rocket, Brain, Globe, Heart
} from "lucide-react";
import PublicLayout from "./layout/PublicLayout";
import LazyImage from "./components/LazyImage";

function FadeInSection({ children, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.12 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(28px)",
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

const PHILOSOPHY_POINTS = [
  "Hands-on engagement",
  "Tactile learning",
  "Technology integration",
  "STEM exposure",
  "Collaboration",
  "Project-based learning",
  "Critical thinking",
  "Real-world application",
];

const PROGRAMMES = [
  {
    title: "Early Childhood Programme",
    subtitle: "Building Strong Foundations",
    badge: "Ages 3–5",
    color: "#FF6B6B",
    icon: Heart,
    image: "/TheRightWay_Images/PRESCHOOL 2026/IMG_8898.jpg",
    description: "Our Early Childhood Programme creates a safe, nurturing, fun and stimulating environment where young learners develop the foundations for lifelong learning.",
    points: [
      "Literacy readiness",
      "Numeracy skills",
      "Communication confidence",
      "Emotional intelligence",
      "Creativity",
      "Social development",
      "Early technology exposure",
    ],
  },
  {
    title: "Primary Programme",
    subtitle: "Academic Excellence with Balance",
    badge: "Ages 5–12",
    color: "#044875",
    icon: BookOpen,
    image: "/TheRightWay_Images/activities/IMG_3909.jpg",
    description: "The Rightway Primary Programme combines strong academics with holistic child development, progressively building students from Preschool through Standard Five.",
    points: [
      "Literacy & Communication",
      "Mathematics",
      "Science & STEM",
      "Leadership Development",
      "Financial Awareness",
      "Research Skills",
      "Technology Integration",
      "Creative Expression",
    ],
  },
  {
    title: "SEA & Secondary Pathways",
    subtitle: "More Than SEA Preparation",
    badge: "Standard 3–5",
    color: "#6BCB77",
    icon: Rocket,
    image: "/TheRightWay_Images/SEA 2026/IMG_9057.jpg",
    description: "Rightway prepares students for success beyond examinations with progressive mastery and flexible educational pathways tailored to each family.",
    points: [
      "Progressive mastery",
      "Examination confidence",
      "Emotional wellbeing",
      "Reduced pressure",
      "Individualised support",
      "Traditional SEA placement",
      "Private secondary pathways",
    ],
  },
];

const TECH_ITEMS = [
  "Interactive digital learning",
  "STEM education",
  "Robotics exposure",
  "Multimedia instruction",
  "Research & presentation skills",
  "Technology-assisted learning",
];

const SEVEN_FIGURE_ITEMS = [
  "Budgeting",
  "Saving",
  "Entrepreneurship",
  "Leadership",
  "Investing concepts",
  "Public speaking",
  "Financial responsibility",
];

export default function Academics() {
  return (
    <PublicLayout>
      <Helmet>
        <title>Academics | The RightWay Centre of Learning</title>
        <meta name="description" content="Explore our academic programmes — Early Childhood, Primary, SEA preparation, STEM, Financial Literacy, and holistic development at The RightWay Centre of Learning." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://learnrightschool.com/academics" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="The RightWay Centre of Learning" />
        <meta property="og:title" content="Academics | The RightWay Centre of Learning" />
        <meta property="og:description" content="Early Childhood, Primary, SEA preparation, STEM, Financial Literacy, and holistic development — a world-class curriculum in Trinidad." />
        <meta property="og:image" content="https://learnrightschool.com/kids/2149068381.jpg" />
        <meta property="og:url" content="https://learnrightschool.com/academics" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Academics | The RightWay Centre of Learning" />
        <meta name="twitter:description" content="Early Childhood, Primary, SEA preparation, STEM, and Financial Literacy at The RightWay Centre." />
        <meta name="twitter:image" content="https://learnrightschool.com/kids/2149068381.jpg" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "Academics — The RightWay Centre of Learning",
          "url": "https://learnrightschool.com/academics",
          "description": "Academic programmes at The RightWay Centre of Learning — Early Childhood through Standard Five, STEM, Financial Literacy, and SEA preparation.",
          "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://learnrightschool.com/" },
              { "@type": "ListItem", "position": 2, "name": "Academics", "item": "https://learnrightschool.com/academics" }
            ]
          }
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden py-24" style={{ background: "linear-gradient(135deg, #044875 0%, #0a6aac 100%)" }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 70% 30%, #f8d904 0%, transparent 50%), radial-gradient(circle at 20% 80%, #c1e5e6 0%, transparent 40%)" }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-6 backdrop-blur-sm">
            <Star className="w-3.5 h-3.5 text-[#f8d904]" />
            Education Designed for the Future
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
            Academics at Rightway
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-3xl mx-auto leading-relaxed">
            Education that goes beyond examinations. Our students become confident thinkers, effective communicators, future leaders, and globally prepared learners.
          </p>
        </div>
      </section>

      {/* Academic Philosophy */}
      <section id="philosophy" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeInSection>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-0.5 bg-[#044875]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Our Approach</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Learning the Rightway
                </h2>
                <p className="text-[#374151] leading-relaxed mb-6">
                  Rightway intentionally moves beyond outdated educational models built around excessive memorisation, overloaded textbooks, and unnecessary homework. We believe children learn best when they actively participate, explore, create, and apply concepts meaningfully.
                </p>
                <p className="text-[#374151] leading-relaxed mb-8">
                  Our classrooms are designed to foster curiosity, confidence, leadership, discipline, and independent thinking.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {PHILOSOPHY_POINTS.map((p) => (
                    <div key={p} className="flex items-center gap-2 text-sm text-[#374151]">
                      <CheckCircle className="w-4 h-4 text-[#6BCB77] flex-shrink-0" />
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            </FadeInSection>

            <FadeInSection delay={150}>
              <div className="rounded-3xl overflow-hidden shadow-2xl relative h-72">
                <LazyImage
                  src="/TheRightWay_Images/activities/IMG_4051.jpg"
                  alt="Students engaged in interactive classroom learning"
                  objectPosition="center"
                  wrapperClassName="h-full"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(4,72,117,0.85) 0%, rgba(4,72,117,0.2) 60%, transparent 100%)" }} />
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <h3 className="text-xl font-extrabold text-white mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
                    Global-Inspired Curriculum
                  </h3>
                  <p className="text-white/80 text-sm leading-relaxed mb-4">
                    Drawing from Finnish, Chinese, European, American, and Canadian educational systems — blended into one powerful model.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Finnish", "Chinese", "European", "American", "Canadian"].map(c => (
                      <span key={c} className="px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold backdrop-blur-sm">{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* Programmes */}
      <section id="programmes" className="py-20" style={{ background: "#FBF8F3" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-0.5 bg-[#044875]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Our Programmes</span>
                <div className="w-8 h-0.5 bg-[#044875]" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
                A Journey from Preschool to Standard Five
              </h2>
            </div>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-6">
            {PROGRAMMES.map((prog, i) => (
              <FadeInSection key={prog.title} delay={i * 100}>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-500 h-full flex flex-col"
                  style={{ borderTop: `4px solid ${prog.color}` }}>
                  {prog.image && (
                    <div className="relative overflow-hidden">
                      {/* aspect-[4/3] — natural landscape ratio so no side cropping */}
                      <div className="aspect-[4/3]">
                        <LazyImage
                          src={prog.image}
                          alt={prog.title}
                          className="hover:scale-105 transition-transform duration-500"
                          objectPosition={prog.image.includes("PRESCHOOL") || prog.image.includes("SEA") ? "top" : "center"}
                          objectFit="cover"
                          wrapperClassName="h-full"
                        />
                      </div>
                      <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to top, ${prog.color}30 0%, transparent 60%)` }} />
                      <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold shadow-md"
                        style={{ backgroundColor: prog.color, color: "white" }}>
                        {prog.badge}
                      </span>
                    </div>
                  )}
                  <div className="p-8 flex-1">
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: prog.color + "20" }}>
                        <prog.icon className="w-6 h-6" style={{ color: prog.color }} />
                      </div>
                      {!prog.image && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: prog.color + "20", color: prog.color }}>
                          {prog.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-extrabold text-[#1A1A2E] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>{prog.title}</h3>
                    <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-4">{prog.subtitle}</p>
                    <p className="text-[#374151] text-sm leading-relaxed mb-5">{prog.description}</p>
                    <ul className="space-y-2">
                      {prog.points.map((p) => (
                        <li key={p} className="flex items-center gap-2 text-sm text-[#374151]">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: prog.color }} />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Technology & Innovation */}
      <section id="technology" className="py-20" style={{ backgroundColor: "#044875" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeInSection>
              <div className="text-white">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-0.5 bg-[#f8d904]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/60">Future Ready</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Technology with Purpose
                </h2>
                <p className="text-white/80 leading-relaxed mb-6">
                  Technology is intentionally integrated into the Rightway learning experience to enhance engagement, creativity, collaboration, and future readiness.
                </p>
                <p className="text-white/80 leading-relaxed mb-8">
                  Our goal is to prepare students for the future world they will inherit while maintaining strong interpersonal skills, discipline, and critical thinking abilities.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {TECH_ITEMS.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-white/80">
                      <Cpu className="w-4 h-4 text-[#f8d904] flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </FadeInSection>

            <FadeInSection delay={150}>
              <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[380px]">
                <LazyImage
                  src="/TheRightWay_Images/activities/IMG_4004.jpg"
                  alt="Students using technology at RightWay"
                  objectPosition="center"
                  wrapperClassName="h-full"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(4,40,80,0.85) 0%, rgba(4,40,80,0.2) 55%, transparent 100%)" }} />
                <div className="absolute bottom-0 left-0 right-0 p-6 grid grid-cols-2 gap-3">
                  {[
                    { label: "Smart Boards", icon: Cpu, color: "#f8d904" },
                    { label: "STEM Labs", icon: FlaskConical, color: "#6BCB77" },
                    { label: "Robotics", icon: Rocket, color: "#FF6B6B" },
                    { label: "Digital Collaboration", icon: Globe, color: "#c1e5e6" },
                  ].map((item) => (
                    <div key={item.label} className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-3 border border-white/20">
                      <item.icon className="w-5 h-5 flex-shrink-0" style={{ color: item.color }} />
                      <span className="text-white text-sm font-semibold">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* Seven Figure Kids Club */}
      <section id="financial-literacy" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeInSection>
              <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[360px]">
                <LazyImage
                  src="/TheRightWay_Images/activities/IMG_3913.jpg"
                  alt="Students learning financial literacy at the Seven Figure Kids Club"
                  objectPosition="center"
                  wrapperClassName="h-full"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(4,72,117,0.9) 0%, rgba(4,72,117,0.3) 50%, transparent 80%)" }} />
                <div className="absolute top-4 left-4 bg-[#f8d904] text-[#044875] text-2xl font-extrabold w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ fontFamily: "Outfit, sans-serif" }}>7</div>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="text-white font-extrabold text-lg mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Seven Figure Kids Club</div>
                  <div className="grid grid-cols-2 gap-2">
                    {SEVEN_FIGURE_ITEMS.map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs text-white/90 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
                        <DollarSign className="w-3.5 h-3.5 text-[#f8d904] flex-shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeInSection>

            <FadeInSection delay={150}>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-0.5 bg-[#044875]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Financial Literacy</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Developing Future Leaders
                </h2>
                <p className="text-[#374151] leading-relaxed mb-5">
                  Rightway is among the few primary institutions intentionally exposing students to entrepreneurship, financial awareness, leadership, and investment concepts from an early age.
                </p>
                <p className="text-[#374151] leading-relaxed">
                  We believe financial intelligence is a critical life skill and should be developed intentionally from childhood — creating the next generation of business leaders and financially responsible citizens.
                </p>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* Student Support */}
      <section className="py-20" style={{ background: "#FBF8F3" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-0.5 bg-[#044875]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Support System</span>
                <div className="w-8 h-0.5 bg-[#044875]" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
                Small Classes. Individualised Attention.
              </h2>
              <p className="text-[#6B7280] mt-3 max-w-2xl mx-auto">
                Rightway maintains small class environments and strong supervision systems designed to support both academic excellence and emotional wellbeing.
              </p>
            </div>
          </FadeInSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { label: "Individualised support", color: "#044875" },
              { label: "Student confidence", color: "#f8d904" },
              { label: "Emotional safety", color: "#6BCB77" },
              { label: "Structured discipline", color: "#FF6B6B" },
              { label: "Parent partnership", color: "#FFD93D" },
              { label: "Respectful culture", color: "#c1e5e6" },
              { label: "Positive behaviour development", color: "#044875" },
              { label: "Holistic development", color: "#f8d904" },
            ].map((item, i) => (
              <FadeInSection key={item.label} delay={i * 50}>
                <div className="bg-white rounded-2xl p-5 text-center shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 border border-transparent hover:border-[#E5E7EB]">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium text-[#1A1A2E]">{item.label}</span>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <FadeInSection>
            <h2 className="text-3xl font-extrabold text-[#1A1A2E] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
              Ready to Begin the Academic Journey?
            </h2>
            <p className="text-[#6B7280] mb-8 max-w-xl mx-auto">
              Explore our admissions process and secure your child's place in one of Trinidad's most innovative learning environments.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/admissions"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#f8d904] text-[#044875] font-bold rounded-xl hover:bg-[#bc9908] transition-all duration-200 shadow-md"
              >
                Apply Now <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 border-2 border-[#044875] text-[#044875] font-bold rounded-xl hover:bg-[#044875] hover:text-white transition-all duration-200"
              >
                Book a School Tour
              </Link>
            </div>
          </FadeInSection>
        </div>
      </section>
    </PublicLayout>
  );
}
