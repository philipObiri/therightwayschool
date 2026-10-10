import React, { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { useLocation } from "react-router-dom";
import PublicTopBar from "./PublicTopBar";
import PublicNavbar from "./PublicNavbar";
import PublicFooter from "./PublicFooter";
import WhatsAppWidget from "../widgets/WhatsAppWidget";
import LoginModal from "../auth/LoginModal";
import SignupModal from "../auth/SignupModal";

function ScrollToHash() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      const scroll = () => {
        const el = document.getElementById(id);
        if (el) {
          const navbarHeight = 80;
          const top = el.getBoundingClientRect().top + window.scrollY - navbarHeight;
          window.scrollTo({ top, behavior: "instant" });
        }
      };
      // Attempt immediately, then retry once after layout settles
      scroll();
      const t = setTimeout(scroll, 120);
      return () => clearTimeout(t);
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [hash, pathname]);
  return null;
}

export default function PublicLayout({ children, settings }) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Skip navigation for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:bg-[#044875] focus:text-white focus:rounded-lg focus:font-semibold focus:outline-none focus:ring-2 focus:ring-[#f8d904]"
      >
        Skip to main content
      </a>
      <PublicTopBar settings={settings} />
      <PublicNavbar
        onLoginClick={() => setLoginOpen(true)}
        onRegisterClick={() => setRegisterOpen(true)}
        settings={settings}
      />

      <ScrollToHash />
      <main id="main-content" className="flex-1" tabIndex={-1}>{children}</main>

      <PublicFooter settings={settings} />

      {/* WhatsApp floating widget */}
      <WhatsAppWidget settings={settings} />

      {/* Back to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 right-5 z-40 w-10 h-10 rounded-full bg-[#044875] text-white shadow-lg flex items-center justify-center hover:bg-[#f8d904] hover:text-[#044875] transition-all duration-300"
          aria-label="Back to top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <SignupModal open={registerOpen} onClose={() => setRegisterOpen(false)} />
    </div>
  );
}
