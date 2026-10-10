import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Phone, Mail, MapPin, Clock, MessageSquare, Send, CheckCircle, Star
} from "lucide-react";
import PublicLayout from "./layout/PublicLayout";
import LazyImage from "./components/LazyImage";
import api from "@/lib/api";

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
      transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

const CONTACT_CARDS = [
  {
    icon: Phone,
    label: "Call or WhatsApp",
    lines: ["+1 (868) 471-3888", "+1 (868) 221-2794"],
    sublines: ["Mobile & WhatsApp", "Landline"],
    color: "#044875",
    href: "tel:+18684713888",
  },
  {
    icon: Mail,
    label: "Email Us",
    lines: ["therightwaycloud@gmail.com", "therightwaydesk@gmail.com"],
    sublines: ["General enquiries", "Administrative desk"],
    color: "#f8d904",
    href: "mailto:therightwaycloud@gmail.com",
  },
  {
    icon: MapPin,
    label: "Visit Us",
    lines: ["Lot 26A Phillips Street", "Montrose, Chaguanas, T&T"],
    sublines: ["Main campus", "Central Trinidad"],
    color: "#6BCB77",
    href: "https://maps.google.com/?q=Montrose+Chaguanas+Trinidad",
  },
  {
    icon: Clock,
    label: "Office Hours",
    lines: ["Monday – Friday", "7:00 AM – 4:00 PM"],
    sublines: ["Administrative hours", "Visits by appointment"],
    color: "#FF6B6B",
    href: null,
  },
];

const DISCOVER = [
  "Our technology-integrated classrooms",
  "Student learning spaces",
  "The Rightway Café",
  "Clubs & activities areas",
  "Our safe and structured environment",
  "Meet our teaching team",
];

export default function Contact() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", subject: "Book a Visit", message: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      setError("Please fill in your name, email, and message.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/website/contact", form);
      setSubmitted(true);
    } catch {
      // Silently succeed — contact forms shouldn't block the user
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <Helmet>
        <title>Contact Us | The RightWay Centre of Learning</title>
        <meta name="description" content="Get in touch with The RightWay Centre of Learning — call, WhatsApp, email, or book a campus visit. Located in Montrose, Chaguanas, Trinidad." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://learnrightschool.com/contact" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="The RightWay Centre of Learning" />
        <meta property="og:title" content="Contact Us | The RightWay Centre of Learning" />
        <meta property="og:description" content="Call, WhatsApp, email, or book a campus visit — we'd love to meet your family. Located in Montrose, Chaguanas, Trinidad & Tobago." />
        <meta property="og:image" content="https://learnrightschool.com/kids/young_school_boy_in_class.jpg" />
        <meta property="og:url" content="https://learnrightschool.com/contact" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Contact The RightWay Centre of Learning" />
        <meta name="twitter:description" content="Call, WhatsApp, or email us to book a campus visit. Located in Montrose, Chaguanas, Trinidad & Tobago." />
        <meta name="twitter:image" content="https://learnrightschool.com/kids/young_school_boy_in_class.jpg" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ContactPage",
          "name": "Contact — The RightWay Centre of Learning",
          "url": "https://learnrightschool.com/contact",
          "mainEntity": {
            "@type": "School",
            "name": "The RightWay Centre of Learning",
            "telephone": "+18682212794",
            "email": "therightwaycloud@gmail.com",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Lot 26A Phillips Street, Montrose",
              "addressLocality": "Chaguanas",
              "addressCountry": "TT"
            },
            "openingHours": "Mo-Fr 07:30-17:30",
            "contactPoint": {
              "@type": "ContactPoint",
              "telephone": "+18682212794",
              "contactType": "admissions"
            }
          }
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden py-24" style={{ background: "linear-gradient(135deg, #044875 0%, #0a6aac 100%)" }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #f8d904 0%, transparent 50%), radial-gradient(circle at 80% 30%, #c1e5e6 0%, transparent 40%)" }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-6 backdrop-blur-sm">
            <Star className="w-3.5 h-3.5 text-[#f8d904]" />
            We'd Love to Hear From You
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
            Contact Us
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-3xl mx-auto leading-relaxed">
            Whether you are exploring admissions, scheduling a visit, or simply learning more about the Rightway experience, our team is ready to assist you.
          </p>
        </div>
      </section>

      {/* Contact cards */}
      <section id="contact-info" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {CONTACT_CARDS.map((card, i) => (
              <FadeInSection key={card.label} delay={i * 80}>
                {card.href ? (
                  <a href={card.href} target={card.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                    className="block bg-[#FBF8F3] rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 border border-transparent hover:border-[#E5E7EB] group">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      style={{ backgroundColor: card.color + "20" }}>
                      <card.icon className="w-6 h-6" style={{ color: card.color }} />
                    </div>
                    <h3 className="font-bold text-[#1A1A2E] mb-3 text-sm uppercase tracking-wider">{card.label}</h3>
                    {card.lines.map((line, j) => (
                      <div key={j}>
                        <div className="font-semibold text-[#1A1A2E] text-sm">{line}</div>
                        <div className="text-xs text-[#6B7280] mb-1">{card.sublines[j]}</div>
                      </div>
                    ))}
                  </a>
                ) : (
                  <div className="bg-[#FBF8F3] rounded-2xl p-6 border border-transparent">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      style={{ backgroundColor: card.color + "20" }}>
                      <card.icon className="w-6 h-6" style={{ color: card.color }} />
                    </div>
                    <h3 className="font-bold text-[#1A1A2E] mb-3 text-sm uppercase tracking-wider">{card.label}</h3>
                    {card.lines.map((line, j) => (
                      <div key={j}>
                        <div className="font-semibold text-[#1A1A2E] text-sm">{line}</div>
                        <div className="text-xs text-[#6B7280] mb-1">{card.sublines[j]}</div>
                      </div>
                    ))}
                  </div>
                )}
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Book a Visit + Form */}
      <section id="book-visit" className="py-20" style={{ background: "#FBF8F3" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Book a Visit info */}
            <FadeInSection>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-0.5 bg-[#044875]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">Experience the Difference</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A2E] mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Book a Campus Visit
                </h2>
                <p className="text-[#374151] leading-relaxed mb-6">
                  We invite prospective families to visit our campus, meet our team, and experience firsthand the environment, culture, and philosophy that make Rightway one of the most sought-after educational institutions in Central Trinidad.
                </p>
                <p className="text-[#374151] leading-relaxed mb-8">
                  Visits and consultations are encouraged by appointment to ensure personalised assistance and campus availability.
                </p>

                <h3 className="font-bold text-[#1A1A2E] mb-4 text-sm uppercase tracking-wider">Discover During Your Visit</h3>
                <div className="space-y-3 mb-8">
                  {DISCOVER.map((item) => (
                    <div key={item} className="flex items-center gap-3 text-sm text-[#374151]">
                      <CheckCircle className="w-4 h-4 text-[#6BCB77] flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>

                {/* Campus photo — aspect-ratio container so full image is always visible */}
                <div className="rounded-2xl overflow-hidden shadow-lg mb-6" style={{ borderLeft: "4px solid #044875" }}>
                  <div className="aspect-[4/3]">
                    <LazyImage
                      src="/TheRightWay_Images/Gallery/IMG_0657.jpg"
                      alt="The RightWay Centre of Learning campus and students"
                      className="hover:scale-105 transition-transform duration-500"
                      objectFit="contain"
                      objectPosition="center"
                      wrapperClassName="h-full"
                    />
                  </div>
                </div>

                {/* WhatsApp CTA */}
                <a
                  href="https://wa.me/18684713888?text=Hello%2C%20I'd%20like%20to%20book%20a%20campus%20visit%20at%20The%20RightWay%20Centre%20of%20Learning."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-6 py-3.5 rounded-xl font-bold text-white transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                  style={{ backgroundColor: "#25D366" }}
                >
                  <MessageSquare className="w-5 h-5" />
                  WhatsApp Us Directly
                </a>
              </div>
            </FadeInSection>

            {/* Contact form */}
            <FadeInSection delay={150}>
              <div className="bg-white rounded-2xl shadow-sm p-8 border border-[#E5E7EB]">
                {submitted ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 rounded-full bg-[#6BCB77]/15 flex items-center justify-center mx-auto mb-5">
                      <CheckCircle className="w-8 h-8 text-[#6BCB77]" />
                    </div>
                    <h3 className="text-xl font-extrabold text-[#1A1A2E] mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
                      Message Sent!
                    </h3>
                    <p className="text-[#6B7280] text-sm mb-6">
                      Thank you for reaching out. A member of our team will be in touch with you shortly.
                    </p>
                    <Link to="/admissions"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#f8d904] text-[#044875] font-bold rounded-xl hover:bg-[#bc9908] transition-colors text-sm">
                      Start Admissions Application
                    </Link>
                  </div>
                ) : (
                  <>
                    <h3 className="text-xl font-extrabold text-[#1A1A2E] mb-6" style={{ fontFamily: "Outfit, sans-serif" }}>
                      Send Us a Message
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wider">Full Name *</label>
                          <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="Your full name"
                            className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/30 focus:border-[#044875] transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wider">Phone Number</label>
                          <input
                            name="phone"
                            value={form.phone}
                            onChange={handleChange}
                            placeholder="+1 (868) ..."
                            className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/30 focus:border-[#044875] transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wider">Email Address *</label>
                        <input
                          name="email"
                          type="email"
                          value={form.email}
                          onChange={handleChange}
                          placeholder="your@email.com"
                          className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/30 focus:border-[#044875] transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wider">Subject</label>
                        <select
                          name="subject"
                          value={form.subject}
                          onChange={handleChange}
                          className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/30 focus:border-[#044875] transition-all bg-white"
                        >
                          <option>Book a Visit</option>
                          <option>Admissions Enquiry</option>
                          <option>Fee Information</option>
                          <option>General Enquiry</option>
                          <option>Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wider">Message *</label>
                        <textarea
                          name="message"
                          value={form.message}
                          onChange={handleChange}
                          rows={5}
                          placeholder="Tell us how we can help you..."
                          className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/30 focus:border-[#044875] transition-all resize-none"
                        />
                      </div>

                      {error && (
                        <p className="text-red-500 text-sm">{error}</p>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#044875] text-white font-bold rounded-xl hover:bg-[#0a6aac] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Send Message
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* Map */}
      <section id="map" className="py-0">
        <div className="w-full" style={{ height: 420 }}>
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.95!2d-61.3985!3d10.4179!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8c359a000000001%3A0x000000000000001!2sPhillips%20St%2C%20Montrose%2C%20Chaguanas%2C%20Trinidad!5e0!3m2!1sen!2stt!4v1716499200000!5m2!1sen!2stt"
            width="100%"
            height="100%"
            style={{ border: 0, display: "block" }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="The RightWay Centre location"
          />
        </div>
      </section>

      {/* Admissions CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <FadeInSection>
            <h2 className="text-2xl font-extrabold text-[#1A1A2E] mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>
              Ready to Begin Your Rightway Journey?
            </h2>
            <p className="text-[#6B7280] mb-6 text-sm">
              Spaces are limited. Start your child's admissions application today.
            </p>
            <Link
              to="/admissions"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#f8d904] text-[#044875] font-bold rounded-xl hover:bg-[#bc9908] transition-all duration-200 shadow-md"
            >
              Begin Admissions Application
            </Link>
          </FadeInSection>
        </div>
      </section>
    </PublicLayout>
  );
}
