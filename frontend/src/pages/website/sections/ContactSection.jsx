import React, { useRef, useState, useEffect } from "react";
import { Phone, Mail, MapPin, Send, Clock } from "lucide-react";
import { SCHOOL_INFO } from "../data/placeholder-data";
import api from "@/lib/api";

function useScrollReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

export default function ContactSection({ settings }) {
  const info = settings || SCHOOL_INFO;
  const visible = useScrollReveal();
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus({ type: "error", text: "Please fill in all required fields." });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/website/contact", form);
      setStatus({ type: "success", text: "Thank you! We'll be in touch within one business day." });
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch {
      setStatus({ type: "error", text: "Could not send your message. Please try calling us directly." });
    } finally {
      setSubmitting(false);
    }
  };

  const CONTACT_CARDS = [
    { icon: Phone, label: "Call Us", value: info.phone, href: `tel:${info.phone}`, color: "#044875" },
    { icon: Mail, label: "Email Us", value: info.email, href: `mailto:${info.email}`, color: "#2A7A5A" },
    { icon: MapPin, label: "Visit Us", value: info.address, href: `https://maps.google.com/?q=${encodeURIComponent(info.address || "")}`, color: "#bc9908" },
    { icon: Clock, label: "Office Hours", value: "Monâ€“Fri: 7:00 AM â€“ 4:00 PM", href: null, color: "#c1e5e6" },
  ];

  return (
    <section id="contact" className="py-20" style={{ background: "#F0FDF4" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-14 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#044875" }}>
            <div className="w-8 h-0.5" style={{ background: "#044875" }} />
            Contact Us
            <div className="w-8 h-0.5" style={{ background: "#044875" }} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
            We'd Love to Hear From You
          </h2>
          <p className="text-[#6B7280] mt-3 max-w-xl mx-auto">
            Have questions? Ready to book a visit? Drop us a message and we'll get back to you promptly.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* Contact cards */}
          <div className={`grid sm:grid-cols-2 gap-4 content-start transition-all duration-700 ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}>
            {CONTACT_CARDS.map(({ icon: Icon, label, value, href, color }) => {
              const El = href ? "a" : "div";
              return (
                <El
                  key={label}
                  href={href || undefined}
                  target={label === "Visit Us" ? "_blank" : undefined}
                  rel={label === "Visit Us" ? "noopener noreferrer" : undefined}
                  className="flex items-start gap-4 bg-white rounded-2xl p-5 shadow-sm border border-[#E5E7EB] hover:shadow-md transition-all duration-300"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color }}>
                    <Icon className="w-5 h-5" style={{ color: color === "#c1e5e6" ? "#044875" : "white" }} />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#6B7280" }}>{label}</div>
                    <div className="text-[#1A1A2E] font-medium text-sm leading-snug">{value}</div>
                  </div>
                </El>
              );
            })}
          </div>

          {/* Inquiry form */}
          <div className={`bg-white rounded-2xl p-8 shadow-sm border border-[#E5E7EB] transition-all duration-700 delay-200 ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
            <h3 className="text-lg font-bold text-[#1A1A2E] mb-6" style={{ fontFamily: "Outfit, sans-serif" }}>
              Send Us a Message
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#044875" }}>Full Name *</label>
                  <input
                    type="text" placeholder="Your full name" required
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:border-[#044875] transition-colors"
                    style={{ "--tw-ring-color": "rgba(4,72,117,0.2)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#044875" }}>Email *</label>
                  <input
                    type="email" placeholder="your@email.com" required
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:border-[#044875] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#044875" }}>Phone Number</label>
                <input
                  type="tel" placeholder="+1 (868) 000-0000"
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:border-[#044875] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#044875" }}>Message *</label>
                <textarea
                  rows={4} placeholder="Tell us about your child and any questions you have..."
                  required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm resize-none focus:outline-none focus:ring-2 focus:border-[#044875] transition-colors"
                />
              </div>

              {status && (
                <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                  status.type === "success"
                    ? "text-[#044875] border border-[#c1e5e6]"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`} style={status.type === "success" ? { background: "#c1e5e6" } : {}}>
                  {status.text}
                </div>
              )}

              <button
                type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[#044875] text-sm transition-all duration-200 disabled:opacity-60 hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #f8d904, #bc9908)" }}
              >
                <Send className="w-4 h-4" />
                {submitting ? "Sendingâ€¦" : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}





