import React, { useState, useEffect } from "react";
import { X, Phone, Mail, Send, MessageCircle } from "lucide-react";
import { SCHOOL_INFO } from "../data/placeholder-data";

function genCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: a + b };
}

export default function WhatsAppWidget({ settings }) {
  const info = settings || SCHOOL_INFO;
  const phone = info.whatsapp || info.phone?.replace(/\D/g, "") || "18681234567";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [captcha, setCaptcha] = useState(genCaptcha);
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaError, setCaptchaError] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) {
      setSubmitted(false);
      setCaptchaError(false);
      setCaptchaInput("");
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (parseInt(captchaInput) !== captcha.answer) {
      setCaptchaError(true);
      setCaptcha(genCaptcha());
      setCaptchaInput("");
      return;
    }
    const text = encodeURIComponent(`Hello! My name is ${form.name}.\n${form.message}\n\nEmail: ${form.email}\nPhone: ${form.phone}`);
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
    setSubmitted(true);
    setForm({ name: "", email: "", phone: "", message: "" });
    setCaptchaInput("");
    setCaptcha(genCaptcha());
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-[9997]" style={{ animation: "float 2.5s ease-in-out infinite" }}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Chat on WhatsApp"
          className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-95"
          style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
        >
          {open ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          )}
        </button>
      </div>

      {/* Slide-up panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[9996] w-[340px] max-w-[calc(100vw-48px)] rounded-2xl shadow-2xl overflow-hidden"
          style={{ animation: "fadeInUp 0.3s ease-out" }}
        >
          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3" style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div>
              <div className="text-white font-bold text-sm">RightWay Learning Centre</div>
              <div className="text-white/80 text-xs">Usually replies within minutes</div>
            </div>
          </div>

          {/* Body */}
          <div className="bg-white">
            {/* Quick actions */}
            <div className="flex border-b border-[#E5E7EB]">
              <a
                href={`tel:${info.phone}`}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold text-[#044875] hover:bg-[#c1e5e6]/20 transition-colors border-r border-[#E5E7EB]"
              >
                <Phone className="w-3.5 h-3.5" /> Call Us
              </a>
              <a
                href={`mailto:${info.email}`}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold text-[#044875] hover:bg-[#c1e5e6]/20 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" /> Email Us
              </a>
            </div>

            {submitted ? (
              <div className="px-5 py-8 text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="w-7 h-7 text-green-600" />
                </div>
                <p className="text-[#044875] font-bold text-sm mb-1">WhatsApp opened!</p>
                <p className="text-[#6B7280] text-xs">Your message is ready to send. We'll reply shortly.</p>
                <button
                  onClick={() => { setSubmitted(false); setCaptcha(genCaptcha()); }}
                  className="mt-4 text-xs underline" style={{ color: "#044875" }}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-3">
                <p className="text-xs text-[#6B7280] mb-3">Fill in the form below to start a WhatsApp conversation with us.</p>

                <input
                  type="text" placeholder="Full Name *" required
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs focus:outline-none focus:border-[#044875]"
                />
                <input
                  type="email" placeholder="Email Address *" required
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs focus:outline-none focus:border-[#044875]"
                />
                <input
                  type="tel" placeholder="Phone Number *" required
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs focus:outline-none focus:border-[#044875]"
                />
                <textarea
                  rows={3} placeholder="Your message *" required
                  value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs resize-none focus:outline-none focus:border-[#044875]"
                />

                {/* Math CAPTCHA */}
                <div className="rounded-xl p-3" style={{ background: "#FBF8F3" }}>
                  <p className="text-xs text-[#374151] mb-2 font-medium">
                    Quick check: What is <strong>{captcha.a} + {captcha.b}</strong>?
                  </p>
                  <input
                    type="number" placeholder="Your answer" required
                    value={captchaInput}
                    onChange={(e) => { setCaptchaInput(e.target.value); setCaptchaError(false); }}
                    className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none ${
                      captchaError ? "border-red-400 bg-red-50" : "border-[#E5E7EB] focus:border-[#044875]"
                    }`}
                  />
                  {captchaError && (
                    <p className="text-red-500 text-[10px] mt-1">Incorrect. Try again.</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-xs font-bold transition-all duration-200 hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
                >
                  <Send className="w-3.5 h-3.5" />
                  Send via WhatsApp
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
