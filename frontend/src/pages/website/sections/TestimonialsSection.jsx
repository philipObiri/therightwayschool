import React, { useRef, useState, useEffect } from "react";
import { Star } from "lucide-react";
import { TESTIMONIALS } from "../data/placeholder-data";

function useScrollReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

export default function TestimonialsSection({ testimonials: apiTestimonials }) {
  const testimonials = apiTestimonials?.length ? apiTestimonials : TESTIMONIALS;
  const visible = useScrollReveal();

  return (
    <section id="testimonials" className="py-20" style={{ background: "#FBF8F3" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className={`text-center mb-14 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h2 className="text-4xl sm:text-5xl font-extrabold mb-4" style={{ fontFamily: "Outfit, sans-serif", color: "#044875" }}>
            What Parents Say
          </h2>
          <p className="text-[#6B7280] max-w-2xl mx-auto leading-relaxed">
            Hear from our RightWay family about their experiences and why they chose
            quality Montessori education for their children.
          </p>
        </div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className={`relative rounded-2xl p-7 hover:shadow-lg hover:-translate-y-1 transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{
                transitionDelay: `${i * 100}ms`,
                backgroundColor: "#F5F0E8",
              }}
            >
              {/* Large quotation mark */}
              <div className="absolute top-4 right-5 text-6xl font-serif text-[#044875]/10 leading-none select-none">
                "
              </div>

              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-[#f8d904] text-[#f8d904]" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-[#374151] text-sm leading-relaxed mb-6">
                "{t.text}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #044875, #2A7A5A)" }}
                >
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-[#044875] text-sm">{t.name}</div>
                  <div className="text-[#6B7280] text-xs">{t.child}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className={`text-center mt-12 transition-all duration-700 delay-500 ${visible ? "opacity-100" : "opacity-0"}`}>
          <p className="text-[#6B7280] text-sm mb-5">Join hundreds of happy families at The RightWay Centre of Learning.</p>
          <button
            onClick={() => { window.scrollTo({ top: 0, behavior: "instant" }); }}
            className="inline-flex items-center gap-2 px-7 py-3.5 font-bold rounded-xl text-[#044875] text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #f8d904, #bc9908)" }}
          >
            Start Your Application â†’
          </button>
        </div>
      </div>
    </section>
  );
}





