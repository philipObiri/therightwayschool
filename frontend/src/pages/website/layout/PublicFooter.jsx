import React from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Facebook, Instagram, Youtube } from "lucide-react";
import { SCHOOL_INFO } from "../data/placeholder-data";

const QUICK_LINKS = [
  { label: "About Us", path: "/about" },
  { label: "Academics", path: "/academics" },
  { label: "Student Life", path: "/student-life" },
  { label: "Gallery", path: "/gallery" },
];

const SUPPORT_LINKS = [
  { label: "Admissions", path: "/admissions" },
  { label: "Contact Us", path: "/contact" },
  { label: "Staff Login", path: "/login" },
];

export default function PublicFooter({ settings }) {
  const info = settings || SCHOOL_INFO;

  return (
    <footer style={{ backgroundColor: "#044875" }} className="text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-6">

        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">

          {/* Brand + contact */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <img src="/main_logo.png" alt="RightWay Learning Centre" className="h-14 w-auto object-contain bg-white rounded-xl p-1.5" />
              <div>
                <div className="font-extrabold text-base leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  The RightWay Centre of Learning
                </div>
              </div>
            </div>
            <p className="text-white/65 text-sm leading-relaxed mb-5">
              At The RightWay Centre of Learning, we believe every child deserves a nurturing, inspiring environment to learn and grow. Montessori excellence in Trinidad & Tobago since {info.established}.
            </p>
            <ul className="space-y-2.5 text-sm text-white/75">
              {info.phone && (
                <li className="flex items-center gap-2.5">
                  <Phone className="w-3.5 h-3.5 text-[#f8d904] flex-shrink-0" />
                  <a href={`tel:${info.phone}`} className="hover:text-white transition-colors">{info.phone}</a>
                </li>
              )}
              {info.email && (
                <li className="flex items-center gap-2.5">
                  <Mail className="w-3.5 h-3.5 text-[#f8d904] flex-shrink-0" />
                  <a href={`mailto:${info.email}`} className="hover:text-white transition-colors">{info.email}</a>
                </li>
              )}
              {info.address && (
                <li className="flex items-start gap-2.5">
                  <MapPin className="w-3.5 h-3.5 text-[#f8d904] flex-shrink-0 mt-0.5" />
                  <span>{info.address}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-[#c1e5e6] mb-5">Quick Links</h4>
            <ul className="space-y-2.5">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <Link to={link.path} className="text-white/65 text-sm hover:text-[#f8d904] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-[#c1e5e6] mb-5">Support</h4>
            <ul className="space-y-2.5">
              {SUPPORT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link to={link.path} className="text-white/65 text-sm hover:text-[#f8d904] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Follow Us */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-[#c1e5e6] mb-5">Follow Us</h4>
            <ul className="space-y-3">
              {info.facebook && (
                <li>
                  <a href={info.facebook} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-white/65 text-sm hover:text-[#f8d904] transition-colors">
                    <Facebook className="w-4 h-4" />
                    <span>@rightwayttschool</span>
                  </a>
                </li>
              )}
              {info.instagram && (
                <li>
                  <a href={info.instagram} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-white/65 text-sm hover:text-[#f8d904] transition-colors">
                    <Instagram className="w-4 h-4" />
                    <span>@rightwayttschool</span>
                  </a>
                </li>
              )}
              {info.youtube && (
                <li>
                  <a href={info.youtube} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-white/65 text-sm hover:text-[#f8d904] transition-colors">
                    <Youtube className="w-4 h-4" />
                    <span>RightWay Learning Centre</span>
                  </a>
                </li>
              )}
              <li className="text-white/65 text-sm">learnrightschool.com</li>
            </ul>
          </div>
        </div>

        {/* Visit Us — Google Maps embed (always shown) */}
        <div className="mb-8">
          <h4 className="text-sm font-bold uppercase tracking-wider text-[#c1e5e6] mb-5 text-center">Visit Us</h4>
          <div className="rounded-2xl overflow-hidden border border-white/10" style={{ height: 300 }}>
            <iframe
              src={info.mapEmbed || "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d122995.54357423077!2d-61.56900775!3d10.6572105!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8c360592e7c51441%3A0x8c99f5882bf0a956!2sPort%20of%20Spain%2C%20Trinidad!5e0!3m2!1sen!2stt!4v1716499200000!5m2!1sen!2stt"}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="The RightWay Centre of Learning location"
            />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <span>{info.address}</span>
        </div>
        <div className="text-center mt-3 text-xs text-white/40">
          © {new Date().getFullYear()} The RightWay Centre of Learning. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
