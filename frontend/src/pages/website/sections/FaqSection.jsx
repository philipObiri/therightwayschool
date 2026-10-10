import React, { useRef, useState, useEffect } from "react";
import { ChevronDown, HelpCircle, MessageCircle } from "lucide-react";
import { FAQS } from "../data/placeholder-data";

function useScrollReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

export default function FaqSection({ faqs: apiFaqs }) {
  const faqs = apiFaqs?.length ? apiFaqs : FAQS;
  const [openIndex, setOpenIndex] = useState(null);
  const visible = useScrollReveal();

  const toggle = (i) => setOpenIndex(openIndex === i ? null : i);

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-14 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#044875" }}>
            <div className="w-8 h-0.5" style={{ background: "#044875" }} />
            FAQ
            <div className="w-8 h-0.5" style={{ background: "#044875" }} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
            Common Questions
          </h2>
          <p className="text-[#6B7280] mt-3 text-sm">
            Can't find your answer?{" "}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "instant" })}
              className="font-semibold hover:underline inline-flex items-center gap-1"
              style={{ color: "#044875" }}
            >
              <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} /> Contact us directly.
            </button>
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className={`rounded-2xl border transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
              style={{
                transitionDelay: `${i * 80}ms`,
                borderColor: openIndex === i ? "#044875" : "#E5E7EB",
                boxShadow: openIndex === i ? "0 4px 20px rgba(4,72,117,0.1)" : "none",
              }}
            >
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center gap-4 p-5 text-left"
                aria-expanded={openIndex === i}
              >
                <div
                  className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center transition-colors duration-300"
                  style={{ background: openIndex === i ? "#044875" : "#c1e5e6" }}
                >
                  <HelpCircle
                    className="w-4 h-4 transition-colors duration-300"
                    style={{ color: openIndex === i ? "white" : "#044875" }}
                    strokeWidth={1.5}
                  />
                </div>
                <span className="flex-1 font-semibold text-[#1A1A2E] text-sm leading-snug">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${openIndex === i ? "rotate-180" : ""}`}
                  style={{ color: "#044875" }}
                  strokeWidth={1.5}
                />
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${openIndex === i ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="px-5 pb-5 pl-[4.25rem] text-[#6B7280] text-sm leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}




