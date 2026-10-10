import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Star, Target, Eye, BookOpen, Heart, Globe, Zap, Shield,
  Award, TrendingUp, Users, Lightbulb, CheckCircle, ArrowRight
} from "lucide-react";
import PublicLayout from "./layout/PublicLayout";
import LazyImage from "./components/LazyImage";

const WATCHWORDS = [
  { letter: "R", word: "Respect" },
  { letter: "I", word: "Integrity" },
  { letter: "G", word: "Gratitude" },
  { letter: "H", word: "Holistic" },
  { letter: "T", word: "Thoughtful" },
  { letter: "W", word: "Willing" },
  { letter: "A", word: "Articulate" },
  { letter: "Y", word: "Yourself" },
];

const CORE_VALUES = [
  { label: "Excellence", icon: Star, color: "#f8d904" },
  { label: "Discipline", icon: Shield, color: "#044875" },
  { label: "Integrity", icon: CheckCircle, color: "#6BCB77" },
  { label: "Respect", icon: Heart, color: "#FF6B6B" },
  { label: "Innovation", icon: Lightbulb, color: "#FFD93D" },
  { label: "Leadership", icon: TrendingUp, color: "#044875" },
  { label: "Accountability", icon: Target, color: "#c1e5e6" },
  { label: "Inclusivity", icon: Users, color: "#f8d904" },
  { label: "Emotional Wellbeing", icon: Heart, color: "#FF6B6B" },
  { label: "Holistic Development", icon: Globe, color: "#6BCB77" },
  { label: "Entrepreneurship", icon: Zap, color: "#FFD93D" },
  { label: "Global Readiness", icon: Globe, color: "#044875" },
];

const WHY_RIGHTWAY = [
  {
    title: "Elite Without Being Elitist",
    desc: "A premium educational experience grounded in philanthropy, discipline, and genuine care for students and families.",
    color: "#044875",
  },
  {
    title: "Exceptional Learning Outcomes",
    desc: "Students consistently perform at high academic levels within a balanced and supportive learning environment.",
    color: "#f8d904",
  },
  {
    title: "Technology-Driven Education",
    desc: "Interactive classrooms, digital learning systems, STEM integration, robotics exposure, and data-informed instruction.",
    color: "#6BCB77",
  },
  {
    title: "Hands-On & Experiential Learning",
    desc: "Students learn through exploration, experimentation, collaboration, creativity, and real-world engagement.",
    color: "#FF6B6B",
  },
  {
    title: "Reduced Homework. Greater Understanding.",
    desc: "Rightway intentionally minimises excessive homework, focusing instead on meaningful classroom learning. Home time is family time.",
    color: "#FFD93D",
  },
  {
    title: "Financial Literacy & Investment Education",
    desc: "Through the Seven Figure Kids Club, students are introduced to entrepreneurship, budgeting, investing, and wealth-building from an early age.",
    color: "#c1e5e6",
  },
  {
    title: "Small Class Environments",
    desc: "Smaller classes allow for individualised attention, stronger student-teacher relationships, and personalised support.",
    color: "#044875",
  },
  {
    title: "Safe & Structured Environment",
    desc: "A strong anti-bullying philosophy, high behavioural expectations, and close supervision create a safe, nurturing culture.",
    color: "#f8d904",
  },
  {
    title: "Flexible Secondary School Pathways",
    desc: "Families may pursue traditional SEA placement or transition into private secondary education with partner institutions.",
    color: "#6BCB77",
  },
  {
    title: "Holistic Child Development",
    desc: "Education extends beyond academics to include leadership, entrepreneurship, emotional intelligence, creativity, and annual international trips.",
    color: "#FF6B6B",
  },
];

function FadeInSection({ children, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function About() {
  return (
    <PublicLayout>
      <Helmet>
        <title>About Us | The RightWay Centre of Learning</title>
        <meta name="description" content="Learn about The RightWay Centre of Learning — our story, vision, mission, philosophy, and the values that make us one of the most sought-after schools in Trinidad." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://learnrightschool.com/about" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="The RightWay Centre of Learning" />
        <meta property="og:title" content="About Us | The RightWay Centre of Learning" />
        <meta property="og:description" content="Our story, vision, mission, and values — discover what makes RightWay one of the most sought-after schools in Trinidad." />
        <meta property="og:image" content="https://learnrightschool.com/kids/young_school_boy_in_class.jpg" />
        <meta property="og:url" content="https://learnrightschool.com/about" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="About Us | The RightWay Centre of Learning" />
        <meta name="twitter:description" content="Our story, vision, mission, and values — discover what makes RightWay one of Trinidad's most sought-after schools." />
        <meta name="twitter:image" content="https://learnrightschool.com/kids/young_school_boy_in_class.jpg" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "name": "About The RightWay Centre of Learning",
          "url": "https://learnrightschool.com/about",
          "description": "Our story, vision, mission, philosophy, and the values behind The RightWay Centre of Learning.",
          "mainEntity": {
            "@type": "School",
            "name": "The RightWay Centre of Learning",
            "foundingDate": "2018",
            "telephone": "+18682212794",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Lot 26A Phillips Street, Montrose",
              "addressLocality": "Chaguanas",
              "addressCountry": "TT"
            }
          }
        })}</script>
      </Helmet>

      {/* Page Hero */}
      <section className="relative overflow-hidden py-24" style={{ background: "linear-gradient(135deg, #044875 0%, #0a6aac 100%)" }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #f8d904 0%, transparent 50%), radial-gradient(circle at 80% 20%, #c1e5e6 0%, transparent 40%)" }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-6 backdrop-blur-sm">
            <Star className="w-3.5 h-3.5 text-[#f8d904]" />
            Est. 2018 — Central Trinidad
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
            About The RightWay Centre
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-3xl mx-auto leading-relaxed">
            Built on the philosophy that <em>"The only way is the Rightway,"</em> we redefine what modern education looks like in Trinidad and Tobago.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section id="our-story" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <FadeInSection>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-0.5 bg-[#044875]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Our Story</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Founded with a Purpose,<br />Built for Excellence
                </h2>
                <p className="text-[#374151] leading-relaxed mb-5">
                  Founded in 2018, The Rightway Center of Learning and Academic Development Ltd. was established to redefine what modern education could look like in Trinidad and Tobago. Built on the philosophy that <strong>"The only way is the Rightway,"</strong> the institution was created to provide families with a learning environment that is academically rigorous, technologically advanced, values-driven, and intentionally designed around the holistic development of the child.
                </p>
                <p className="text-[#374151] leading-relaxed mb-5">
                  Today, Rightway has evolved into one of the most sought-after private educational institutions in Central Trinidad with intent to offer its services globally, recognised for being <strong>elite without being elitist</strong> and for delivering exceptional academic outcomes within a nurturing, disciplined, and future-focused environment.
                </p>
                <p className="text-[#374151] leading-relaxed">
                  The Rightway curriculum draws inspiration from Finnish, Chinese, European, American, and Canadian educational systems, blending global best practices into a unique learning model that prioritises critical thinking, leadership, creativity, entrepreneurship, and real-world application.
                </p>
              </div>
            </FadeInSection>

            <FadeInSection delay={150}>
              <div className="relative">
                <div className="grid grid-cols-2 gap-3">
                  {/* Portrait image in tall slot — show top so subjects visible */}
                  <div className="rounded-2xl overflow-hidden shadow-lg row-span-2 h-64" style={{ borderTop: "4px solid #044875" }}>
                    <LazyImage src="/TheRightWay_Images/Gallery/IMG_0569.jpg" alt="Students at RightWay" className="hover:scale-105 transition-transform duration-500" objectPosition="top" wrapperClassName="h-full" />
                  </div>
                  {/* Landscape images in small square slots */}
                  <div className="rounded-2xl overflow-hidden shadow-lg h-[124px]" style={{ borderTop: "4px solid #f8d904" }}>
                    <LazyImage src="/TheRightWay_Images/activities/IMG_1912.jpg" alt="Students in activity" className="hover:scale-105 transition-transform duration-500" objectPosition="center" wrapperClassName="h-full" />
                  </div>
                  <div className="rounded-2xl overflow-hidden shadow-lg h-[124px]" style={{ borderTop: "4px solid #6BCB77" }}>
                    <LazyImage src="/TheRightWay_Images/activities/IMG_2501.jpg" alt="Clubs and activities" className="hover:scale-105 transition-transform duration-500" objectPosition="center" wrapperClassName="h-full" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {[
                    { num: "2018", label: "Year Founded" },
                    { num: "17+", label: "Clubs & Activities" },
                    { num: "100+", label: "Students Enrolled" },
                    { num: "3+", label: "Countries Visited" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-[#FBF8F3] rounded-xl p-4 text-center border border-[#E5E7EB] hover:shadow-md transition-all duration-300">
                      <div className="text-2xl font-extrabold text-[#044875] mb-0.5" style={{ fontFamily: "Outfit, sans-serif" }}>{stat.num}</div>
                      <div className="text-xs text-[#6B7280]">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* Vision, Mission, Motto */}
      <section id="vision" className="py-20" style={{ background: "#FBF8F3" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-0.5 bg-[#044875]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Who We Are</span>
                <div className="w-8 h-0.5 bg-[#044875]" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
                Vision, Mission & Philosophy
              </h2>
            </div>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: Eye,
                label: "Our Vision",
                color: "#044875",
                text: "To become one of the most sought-after educational institutions that is elite without being elitist and committed to doing everything the Rightway.",
              },
              {
                icon: Target,
                label: "Our Mission",
                color: "#f8d904",
                text: "To create a transformative learning environment that develops thought leaders, entrepreneurs, innovators, and globally competitive graduates through academic excellence, technology integration, discipline, creativity, and holistic child development.",
              },
              {
                icon: BookOpen,
                label: "Our Motto",
                color: "#6BCB77",
                text: '"The only way is the Rightway."',
              },
            ].map((item, i) => (
              <FadeInSection key={item.label} delay={i * 100}>
                <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 h-full">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ backgroundColor: item.color + "20" }}>
                    <item.icon className="w-6 h-6" style={{ color: item.color }} />
                  </div>
                  <h3 className="text-lg font-bold text-[#1A1A2E] mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>{item.label}</h3>
                  <p className="text-[#374151] leading-relaxed text-sm">{item.text}</p>
                </div>
              </FadeInSection>
            ))}
          </div>

          {/* Philosophy */}
          <FadeInSection delay={200}>
            <div className="grid lg:grid-cols-2 gap-8 bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-[#044875]">
              <div className="p-10">
                <h3 className="text-xl font-bold text-[#1A1A2E] mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Our Philosophy</h3>
                <p className="text-[#374151] leading-relaxed mb-4">
                  Rightway believes that every child has the ability to excel when given the right structure, opportunities, tools, discipline, and support systems.
                </p>
                <p className="text-[#374151] leading-relaxed">
                  The institution is built on the understanding that education should move beyond memorisation and examination preparation to develop confident, emotionally intelligent, technologically competent, financially aware, and globally prepared individuals. At Rightway, learning is intentionally designed to be interactive, experiential, hands-on, innovative, and future-focused while maintaining strong values, discipline, and individualised attention.
                </p>
              </div>
              <div className="relative min-h-[280px]">
                <LazyImage
                  src="/TheRightWay_Images/PRESCHOOL 2026/IMG_8881.jpg"
                  alt="Children learning at RightWay Centre"
                  objectPosition="top"
                  wrapperClassName="absolute inset-0"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(255,255,255,0.1) 0%, transparent 40%)" }} />
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Watchwords */}
      <section id="watchwords" className="py-20" style={{ backgroundColor: "#044875" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-0.5 bg-[#f8d904]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-white/60">The R.I.G.H.T.W.A.Y</span>
                <div className="w-8 h-0.5 bg-[#f8d904]" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
                Our Watchwords
              </h2>
              <p className="text-white/70 mt-3 max-w-xl mx-auto">Every letter of our name stands for a core principle we live by every day.</p>
            </div>
          </FadeInSection>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {WATCHWORDS.map((w, i) => (
              <FadeInSection key={w.letter} delay={i * 60}>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 text-center hover:bg-[#f8d904]/20 transition-all duration-300 border border-white/10">
                  <div className="text-3xl font-extrabold text-[#f8d904] mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>{w.letter}</div>
                  <div className="text-white/80 text-xs font-medium uppercase tracking-wider">{w.word}</div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section id="core-values" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-0.5 bg-[#044875]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">What We Stand For</span>
                <div className="w-8 h-0.5 bg-[#044875]" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
                Our Core Values
              </h2>
              <p className="text-[#6B7280] mt-3 max-w-2xl mx-auto">
                Rightway is committed to developing students who are academically capable, emotionally resilient, technologically prepared, socially responsible, and grounded in strong values.
              </p>
            </div>
          </FadeInSection>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {CORE_VALUES.map((v, i) => (
              <FadeInSection key={v.label} delay={i * 50}>
                <div className="group flex items-center gap-3 bg-[#FBF8F3] rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-transparent hover:border-[#E5E7EB]">
                  <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: v.color + "25" }}>
                    <v.icon className="w-4.5 h-4.5" style={{ color: v.color }} />
                  </div>
                  <span className="text-sm font-semibold text-[#1A1A2E]">{v.label}</span>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Why Rightway */}
      <section id="why-rightway" className="py-20" style={{ background: "#FBF8F3" }}>
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

          <div className="grid md:grid-cols-2 gap-5">
            {WHY_RIGHTWAY.map((item, i) => (
              <FadeInSection key={item.title} delay={i * 60}>
                <div className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: item.color + "20" }}>
                    <CheckCircle className="w-5 h-5" style={{ color: item.color === "#c1e5e6" ? "#044875" : item.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1A1A2E] mb-1.5" style={{ fontFamily: "Outfit, sans-serif" }}>{item.title}</h3>
                    <p className="text-[#6B7280] text-sm leading-relaxed">{item.desc}</p>
                  </div>
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
              Ready to Experience the Rightway Difference?
            </h2>
            <p className="text-[#6B7280] mb-8 max-w-xl mx-auto">
              Spaces are intentionally limited. Begin your child's admissions journey today.
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
                Book a Visit
              </Link>
            </div>
          </FadeInSection>
        </div>
      </section>
    </PublicLayout>
  );
}
