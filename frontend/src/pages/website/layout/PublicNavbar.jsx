import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Home", path: "/" },
  { label: "About Us", path: "/about" },
  { label: "Academics", path: "/academics" },
  { label: "Admissions", path: "/admissions" },
  { label: "Student Life", path: "/student-life" },
  { label: "Gallery", path: "/gallery" },
  { label: "Contact", path: "/contact" },
];

export default function PublicNavbar({ onLoginClick, onRegisterClick }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <nav aria-label="Main navigation" className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-white shadow-lg" : "bg-white shadow-sm"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 flex-shrink-0">
            <img src="/main_logo.png" alt="The RightWay Centre of Learning" className="h-10 w-auto object-contain" />
            <div className="hidden sm:block text-left">
              <div className="text-[#044875] font-bold text-sm leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                The RightWay Centre
              </div>
              <div className="text-[#6B7280] text-[10px] uppercase tracking-wider">of Learning</div>
            </div>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-0.5" role="list">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                role="listitem"
                aria-current={isActive(link.path) ? "page" : undefined}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(link.path)
                    ? "text-[#044875] bg-[#c1e5e6]/40 font-semibold"
                    : "text-[#374151] hover:text-[#044875] hover:bg-[#c1e5e6]/20"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={onLoginClick}
              className="px-4 py-2 text-sm font-semibold text-[#044875] border-2 border-[#044875] rounded-xl hover:bg-[#044875] hover:text-white transition-all duration-200"
            >
              Login
            </button>
            <Link
              to="/admissions"
              className="px-4 py-2 text-sm font-semibold text-[#044875] bg-[#f8d904] rounded-xl hover:bg-[#bc9908] transition-all duration-200 shadow-sm"
            >
              Apply Now
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 rounded-lg text-[#044875] hover:bg-[#c1e5e6]/20 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div id="mobile-nav" className="lg:hidden bg-white border-t border-gray-100 shadow-xl" role="dialog" aria-label="Mobile navigation menu">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                aria-current={isActive(link.path) ? "page" : undefined}
                className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive(link.path)
                    ? "text-[#044875] bg-[#c1e5e6]/30 font-semibold"
                    : "text-[#374151] hover:text-[#044875] hover:bg-[#c1e5e6]/20"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-3 border-t border-gray-100 mt-2">
              <button
                onClick={() => { setMobileOpen(false); onLoginClick?.(); }}
                className="flex-1 py-2.5 text-sm font-semibold text-[#044875] border-2 border-[#044875] rounded-xl hover:bg-[#044875] hover:text-white transition-all"
              >
                Login
              </button>
              <Link
                to="/admissions"
                className="flex-1 py-2.5 text-sm font-semibold text-center text-[#044875] bg-[#f8d904] rounded-xl hover:bg-[#bc9908] transition-all"
              >
                Apply Now
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
