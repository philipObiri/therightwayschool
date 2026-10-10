import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Star, CheckCircle, FileText, Users, DollarSign, HelpCircle,
  ChevronDown, ArrowRight, Phone, Mail
} from "lucide-react";
import PublicLayout from "./layout/PublicLayout";
import AdmissionsForm from "./components/AdmissionsForm";
import LazyImage from "./components/LazyImage";

function FadeInSection({ children, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

const PROCESS_STEPS = [
  {
    num: 1,
    title: "Inquiry",
    desc: "Contact us directly or complete the admissions inquiry form below.",
    color: "#FF6B6B",
    icon: Phone,
  },
  {
    num: 2,
    title: "School Tour & Consultation",
    desc: "Families are invited to visit the campus and experience the Rightway philosophy first-hand.",
    color: "#FFD93D",
    icon: Users,
  },
  {
    num: 3,
    title: "Admissions Application",
    desc: "Complete the full admissions application and submit all required supporting documents.",
    color: "#6BCB77",
    icon: FileText,
  },
  {
    num: 4,
    title: "Student Assessment",
    desc: "Age-appropriate assessment to determine the child's current academic level and cohort suitability. No prior preparation is needed.",
    color: "#044875",
    icon: Star,
  },
  {
    num: 5,
    title: "Parent Interview",
    desc: "A brief interview to ensure alignment with the school's philosophy, expectations, and culture.",
    color: "#FF6B6B",
    icon: Users,
  },
  {
    num: 6,
    title: "Admissions Decision",
    desc: "Successful applicants receive an official acceptance package and onboarding guidance.",
    color: "#6BCB77",
    icon: CheckCircle,
  },
];

const WHO_WE_SERVE = [
  "Small class environments",
  "Strong academic standards",
  "Technology-integrated learning",
  "Leadership development",
  "Structured discipline",
  "Individualised attention",
  "Holistic child development",
];

const REQUIRED_DOCS = [
  "Birth Certificate (photocopy)",
  "Immunisation / Health Records",
  "Parent or Guardian Identification",
  "2 Passport-Sized Photographs",
  "Previous School Reports",
  "Academic Transcripts (where applicable)",
  "Standardised Test Scores (where applicable)",
];

const FEES = [
  { label: "Registration / Capital Fee", amount: "$1,500", note: "One-time payment" },
  { label: "Tuition — Preschool", amount: "$3,750", note: "Per term" },
  { label: "Tuition — Primary School", amount: "$4,200", note: "Per term" },
  { label: "Technology Fee", amount: "$270", note: "Per term" },
  { label: "Cleaning & Sanitisation", amount: "$250", note: "Per term" },
  { label: "Optional Clubs & Activities", amount: "$700–$900", note: "Per term (approx.)" },
];

const FAQS = [
  {
    q: "Do students receive homework?",
    a: "Rightway intentionally minimises excessive homework and textbook dependency in favour of meaningful classroom engagement and conceptual understanding. We believe home time is family time.",
  },
  {
    q: "Is Rightway focused only on SEA?",
    a: "No. While students are fully prepared for SEA success, families may also pursue alternative secondary educational pathways aligned with the Rightway philosophy, including transition into private secondary education.",
  },
  {
    q: "Is technology integrated into learning?",
    a: "Yes. Technology is meaningfully integrated throughout the educational experience to support engagement, collaboration, creativity, and future readiness — including STEM labs, interactive boards, and digital learning systems.",
  },
  {
    q: "Does Rightway offer extracurricular activities?",
    a: "Yes. Students have access to a variety of clubs and enrichment opportunities including robotics, entrepreneurship, leadership development, swimming, gymnastics, football, chess, dance, photography, and more.",
  },
  {
    q: "What is the student assessment like?",
    a: "Our assessment is age-appropriate and focuses on reading & comprehension, literacy readiness, mathematics fundamentals, communication skills, and classroom engagement. No prior preparation is needed — the assessment is used to determine the child's current level and cohort placement.",
  },
  {
    q: "Are flexible payment arrangements available?",
    a: "Flexible arrangements may be available for qualifying families. Please contact us directly to discuss your situation.",
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#FBF8F3] transition-colors gap-4"
      >
        <span className="font-semibold text-[#1A1A2E] text-sm">{q}</span>
        <ChevronDown className={`w-4 h-4 text-[#6B7280] flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-[#374151] leading-relaxed border-t border-[#E5E7EB] pt-4 bg-[#FBF8F3]">
          {a}
        </div>
      )}
    </div>
  );
}

export default function Admissions() {
  const formRef = useRef(null);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <PublicLayout>
      <Helmet>
        <title>Admissions | The RightWay Centre of Learning</title>
        <meta name="description" content="Begin your Rightway journey. Learn about our admissions process, fees, required documents, and complete your digital application online." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://learnrightschool.com/admissions" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="The RightWay Centre of Learning" />
        <meta property="og:title" content="Apply Now — Admissions | The RightWay Centre of Learning" />
        <meta property="og:description" content="Begin your child's Rightway journey. Complete our online admissions form, review fees, and learn about our 6-step enrolment process." />
        <meta property="og:image" content="https://learnrightschool.com/kids/2149557939.jpg" />
        <meta property="og:url" content="https://learnrightschool.com/admissions" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Apply Now — Admissions | The RightWay Centre of Learning" />
        <meta name="twitter:description" content="Begin your child's Rightway journey. Complete our online admissions form and review our 6-step enrolment process." />
        <meta name="twitter:image" content="https://learnrightschool.com/kids/2149557939.jpg" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "Admissions — The RightWay Centre of Learning",
          "url": "https://learnrightschool.com/admissions",
          "description": "Admissions information and online application form for The RightWay Centre of Learning, Chaguanas, Trinidad.",
          "potentialAction": {
            "@type": "ApplyAction",
            "target": "https://learnrightschool.com/admissions#apply",
            "name": "Apply for Admission"
          },
          "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://learnrightschool.com/" },
              { "@type": "ListItem", "position": 2, "name": "Admissions", "item": "https://learnrightschool.com/admissions" }
            ]
          }
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden py-24" style={{ background: "linear-gradient(135deg, #044875 0%, #0a6aac 100%)" }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 25% 60%, #f8d904 0%, transparent 50%), radial-gradient(circle at 75% 20%, #c1e5e6 0%, transparent 40%)" }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-6 backdrop-blur-sm">
            <Star className="w-3.5 h-3.5 text-[#f8d904]" />
            Spaces Are Limited
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
            Begin Your<br />Rightway Journey
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-3xl mx-auto leading-relaxed mb-10">
            Choosing the right school is one of the most important decisions a family can make. We welcome families who value academic excellence, discipline, technology-driven learning, and holistic child development.
          </p>
          <button
            onClick={scrollToForm}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#f8d904] text-[#044875] font-bold rounded-xl hover:bg-[#bc9908] transition-all duration-200 shadow-lg text-sm"
          >
            Apply Now <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 6-Step Process */}
      <section id="process" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-0.5 bg-[#044875]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Simple & Structured</span>
                <div className="w-8 h-0.5 bg-[#044875]" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
                The Admissions Process
              </h2>
            </div>
          </FadeInSection>

          {/* Step diagram */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PROCESS_STEPS.map((s, i) => (
              <FadeInSection key={s.num} delay={i * 80}>
                <div className="relative bg-[#FBF8F3] rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 border border-transparent hover:border-[#E5E7EB]">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 font-extrabold text-white text-lg"
                      style={{ backgroundColor: s.color, fontFamily: "Outfit, sans-serif" }}>
                      {s.num}
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1A1A2E] mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>{s.title}</h3>
                      <p className="text-[#6B7280] text-sm leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                  {i < PROCESS_STEPS.length - 1 && (
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 hidden lg:flex items-center justify-center z-10">
                      <ArrowRight className="w-5 h-5 text-[#c1e5e6]" />
                    </div>
                  )}
                </div>
              </FadeInSection>
            ))}
          </div>

          <FadeInSection delay={400}>
            <div className="mt-10 text-center">
              <button
                onClick={scrollToForm}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#044875] text-white font-bold rounded-xl hover:bg-[#0a6aac] transition-all duration-200 shadow-md text-sm"
              >
                Start Application <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Who We Serve — alternating image left, text right */}
      <section id="who-we-serve" className="py-20 overflow-hidden" style={{ background: "#FBF8F3" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Image side */}
            <FadeInSection>
              <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{ borderLeft: "6px solid #FF6B6B" }}>
                <div className="aspect-[4/3]">
                  <LazyImage
                    src="/TheRightWay_Images/PRESCHOOL 2026/IMG_8962.jpg"
                    alt="Young children learning at RightWay"
                    className="hover:scale-105 transition-transform duration-700"
                    objectPosition="top"
                    wrapperClassName="h-full"
                  />
                </div>
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(255,107,107,0.15) 0%, transparent 50%)" }} />
                <div className="absolute top-4 right-4 bg-[#FF6B6B] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">Ages 3 – 12+</div>
              </div>
            </FadeInSection>

            {/* Text side */}
            <FadeInSection delay={150}>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-0.5 bg-[#044875]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Is Rightway Right for You?</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-5 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Who We Serve
                </h2>
                <p className="text-[#6B7280] leading-relaxed mb-6">
                  Rightway caters to students between <strong>ages 3 to 12+</strong> within a structured, nurturing, and academically progressive environment. Our institution is best suited for families seeking:
                </p>
                <ul className="space-y-3">
                  {WHO_WE_SERVE.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-[#374151]">
                      <CheckCircle className="w-4 h-4 text-[#6BCB77] flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* Admissions Checklist — alternating text left, image right */}
      <section id="documents" className="py-20 overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Text side */}
            <FadeInSection>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-0.5 bg-[#044875]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">What to Bring</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-5 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Admissions Checklist
                </h2>
                <p className="text-[#6B7280] leading-relaxed mb-6">
                  The following documents are generally required as part of the admissions process:
                </p>
                <ul className="space-y-3 mb-6">
                  {REQUIRED_DOCS.map((doc) => (
                    <li key={doc} className="flex items-center gap-3 text-sm text-[#374151]">
                      <div className="w-5 h-5 rounded border-2 border-[#044875] flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-sm bg-[#044875]" />
                      </div>
                      {doc}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-[#6B7280]">
                  Additional documents may be requested depending on grade level or educational history.
                </p>
              </div>
            </FadeInSection>

            {/* Image side */}
            <FadeInSection delay={150}>
              <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{ borderLeft: "6px solid #6BCB77" }}>
                <div className="aspect-[4/3]">
                  <LazyImage
                    src="/TheRightWay_Images/SEA 2026/IMG_9068.jpg"
                    alt="RightWay students at SEA ceremony"
                    className="hover:scale-105 transition-transform duration-700"
                    objectPosition="top"
                    wrapperClassName="h-full"
                  />
                </div>
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(107,203,119,0.2) 0%, transparent 50%)" }} />
                <div className="absolute top-4 right-4 bg-[#6BCB77] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">Class of 2026</div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* Fees */}
      <section id="fees" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-0.5 bg-[#044875]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Investing in Excellence</span>
                <div className="w-8 h-0.5 bg-[#044875]" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
                Fees & Financial Information
              </h2>
              <p className="text-[#6B7280] mt-3 max-w-2xl mx-auto text-sm">
                Rightway is a fully privately owned institution committed to delivering a premium educational experience through small classes, technology integration, and individualised student support.
              </p>
            </div>
          </FadeInSection>

          <FadeInSection delay={100}>
            <div className="bg-[#FBF8F3] rounded-2xl overflow-hidden border border-[#E5E7EB]">
              <div className="grid grid-cols-3 px-6 py-3 bg-[#044875] text-white text-xs font-bold uppercase tracking-wider">
                <span>Fee Category</span>
                <span className="text-center">Amount (TTD)</span>
                <span className="text-right">Frequency</span>
              </div>
              {FEES.map((fee, i) => (
                <div
                  key={fee.label}
                  className={`grid grid-cols-3 px-6 py-4 items-center border-b border-[#E5E7EB] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-[#FBF8F3]"}`}
                >
                  <span className="text-sm font-medium text-[#1A1A2E]">{fee.label}</span>
                  <span className="text-center font-bold text-[#044875] text-sm">{fee.amount}</span>
                  <span className="text-right text-xs text-[#6B7280]">{fee.note}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#6B7280] mt-4 text-center">
              Flexible payment arrangements may be available for qualifying families. Detailed fee schedules are provided during the admissions process.
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20" style={{ background: "#FBF8F3" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-0.5 bg-[#044875]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Common Questions</span>
                <div className="w-8 h-0.5 bg-[#044875]" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
                Frequently Asked Questions
              </h2>
            </div>
          </FadeInSection>

          <FadeInSection delay={100}>
            <div className="space-y-3">
              {FAQS.map((faq) => (
                <FaqItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Digital Admissions Form */}
      <section ref={formRef} id="apply" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-0.5 bg-[#044875]" />
                <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Apply Online</span>
                <div className="w-8 h-0.5 bg-[#044875]" />
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
                Admissions Application Form
              </h2>
              <p className="text-[#6B7280] mt-3 max-w-xl mx-auto text-sm">
                Please complete each section carefully using accurate information. Fields marked with <span className="text-red-500 font-bold">*</span> are required.
              </p>
            </div>
          </FadeInSection>

          <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-sm p-8">
            <AdmissionsForm />
          </div>

          <div className="mt-8 bg-[#FBF8F3] rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-5 border border-[#E5E7EB]">
            <div className="flex-1">
              <p className="font-bold text-[#1A1A2E] text-sm mb-1">Prefer to apply in person?</p>
              <p className="text-[#6B7280] text-xs">Visit our office at Lot 26A Phillips Street, Montrose, Chaguanas — Monday to Friday, 7 AM to 4 PM</p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <a href="tel:+18684713888"
                className="flex items-center gap-2 px-4 py-2 bg-[#044875] text-white rounded-xl text-xs font-semibold hover:bg-[#0a6aac] transition-colors">
                <Phone className="w-3.5 h-3.5" /> Call Us
              </a>
              <a href="https://wa.me/18684713888"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-colors"
                style={{ backgroundColor: "#25D366" }}>
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
