import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { ChevronUp } from "lucide-react";
import api from "@/lib/api";

import PublicTopBar from "./layout/PublicTopBar";
import PublicNavbar from "./layout/PublicNavbar";
import PublicFooter from "./layout/PublicFooter";
import HeroSection from "./sections/HeroSection";
import AboutSection from "./sections/AboutSection";
import ProgramsSection from "./sections/ProgramsSection";
import WhyUsSection from "./sections/WhyUsSection";
import CurriculumSection from "./sections/CurriculumSection";
import ActivitiesSection from "./sections/ActivitiesSection";
import GallerySection from "./sections/GallerySection";
import TestimonialsSection from "./sections/TestimonialsSection";
import BlogSection from "./sections/BlogSection";
import EventsSection from "./sections/EventsSection";
import AdmissionsSection from "./sections/AdmissionsSection";
import FaqSection from "./sections/FaqSection";
import ContactSection from "./sections/ContactSection";
import WhatsAppWidget from "./widgets/WhatsAppWidget";
import LoginModal from "./auth/LoginModal";
import SignupModal from "./auth/SignupModal";

const SECTION_IDS = ["home", "about", "programmes", "curriculum", "gallery", "events", "admissions", "contact"];

export default function PublicHome() {
  const [cms, setCms] = useState({});
  const [activeSection, setActiveSection] = useState("home");
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const endpoints = [
      "settings", "hero", "programs", "usps", "curriculum",
      "activities", "gallery", "testimonials", "blog", "events",
      "admissions-steps", "faq",
    ];
    Promise.allSettled(
      endpoints.map((ep) => api.get(`/website/${ep}`).then((r) => ({ key: ep, data: r.data })))
    ).then((results) => {
      const data = {};
      results.forEach((r) => { if (r.status === "fulfilled") data[r.value.key] = r.value.data; });
      setCms(data);
    });
  }, []);

  // Scroll spy — update active nav item as user scrolls
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);

      let current = "home";
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          // Section is considered "active" when its top is within the top 40% of viewport
          if (rect.top <= window.innerHeight * 0.4) {
            current = id;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Nav click — instant jump to section (no scroll animation)
  const handleNavChange = useCallback((id) => {
    if (id === "home") {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      const navbarHeight = 120; // topbar + navbar combined height
      const top = el.getBoundingClientRect().top + window.scrollY - navbarHeight;
      window.scrollTo({ top, behavior: "instant" });
    }
  }, []);

  const settings = cms.settings;
  const schoolName = settings?.name || "The RightWay Centre of Learning";
  const schoolDesc = settings?.meta_description || "Quality Montessori education in Trinidad and Tobago. Nursery, Kindergarten, and Primary programmes where every child thrives.";

  return (
    <>
      <Helmet>
        <title>{schoolName} | learnrightschool.com</title>
        <meta name="description" content={schoolDesc} />
        <meta property="og:title" content={schoolName} />
        <meta property="og:description" content={schoolDesc} />
        <meta property="og:image" content="/kids/young_school_boy_in_class.jpg" />
        <meta property="og:url" content="https://learnrightschool.com" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={schoolName} />
        <meta name="twitter:description" content={schoolDesc} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "School",
          "name": schoolName,
          "url": "https://learnrightschool.com",
          "telephone": settings?.phone || "+1-868-123-4567",
          "email": settings?.email || "info@learnrightschool.com",
          "image": "/kids/young_school_boy_in_class.jpg",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": settings?.address || "123 Education Lane, Port of Spain",
            "addressCountry": "TT",
          },
          "description": schoolDesc,
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-white">
        <PublicTopBar settings={settings} />
        <PublicNavbar
          activeSection={activeSection}
          onNavChange={handleNavChange}
          onLoginClick={() => setLoginOpen(true)}
          onRegisterClick={() => setRegisterOpen(true)}
        />

        <main>
          <section id="home">
            <HeroSection slides={cms.hero} onNavigate={handleNavChange} />
          </section>

          <section id="about">
            <AboutSection content={settings?.about} />
          </section>

          <section id="programmes">
            <ProgramsSection programmes={cms.programs} />
            <WhyUsSection usps={cms.usps} />
          </section>

          <section id="curriculum">
            <CurriculumSection subjects={cms.curriculum} />
            <ActivitiesSection activities={cms.activities} />
          </section>

          <section id="gallery">
            <GallerySection images={cms.gallery} />
            <TestimonialsSection testimonials={cms.testimonials} />
          </section>

          <section id="events">
            <EventsSection events={cms.events} />
            <BlogSection posts={cms.blog} />
          </section>

          <section id="admissions">
            <AdmissionsSection steps={cms["admissions-steps"]} />
            <FaqSection faqs={cms.faq} />
          </section>

          <section id="contact">
            <ContactSection settings={settings} />
          </section>
        </main>

        <PublicFooter settings={settings} onNavChange={handleNavChange} />
        <WhatsAppWidget settings={settings} />

        {/* Scroll to top button */}
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-24 right-6 z-[9990] w-11 h-11 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 hover:scale-110"
            style={{ background: "#044875" }}
            aria-label="Scroll to top"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        )}
      </div>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSwitchToRegister={() => { setLoginOpen(false); setRegisterOpen(true); }}
      />
      <SignupModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSwitchToLogin={() => { setRegisterOpen(false); setLoginOpen(true); }}
      />
    </>
  );
}
