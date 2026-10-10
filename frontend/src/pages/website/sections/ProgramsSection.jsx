import React, { useRef, useState, useEffect } from "react";
import { CheckCircle2, Sprout, Flower2, BookOpenCheck, ArrowRight } from "lucide-react";
import { PROGRAMMES } from "../data/placeholder-data";

function useScrollReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

const PROG_ICONS = [Sprout, Flower2, BookOpenCheck];
const PROG_COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77"];

export default function ProgramsSection({ programmes: apiProgrammes }) {
  const programmes = apiProgrammes?.length ? apiProgrammes : PROGRAMMES;
  const visible = useScrollReveal();

  return (
    <section id="programmes" className="py-20 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-14 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#044875" }}>
            <div className="w-8 h-0.5" style={{ background: "#044875" }} />
            Our Programmes
            <div className="w-8 h-0.5" style={{ background: "#044875" }} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
            Learning Pathways for Every Stage
          </h2>
          <p className="text-[#6B7280] mt-3 max-w-xl mx-auto text-sm">
            From first steps to secondary readiness â€” our three programmes grow with your child.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {programmes.map((prog, i) => {
            const Icon = PROG_ICONS[i % PROG_ICONS.length];
            const color = PROG_COLORS[i % PROG_COLORS.length];
            const isLight = color === "#c1e5e6" || color === "#f8d904";
            return (
              <div
                key={prog.id}
                className={`group rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                {/* Image */}
                <div className="relative h-52 overflow-hidden">
                  <img
                    src={prog.image}
                    alt={prog.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0" style={{ background: `${color}88` }} />
                  <div className="absolute top-4 left-4 w-12 h-12 rounded-xl bg-white/25 backdrop-blur-sm flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
                  </div>
                  <div className="absolute bottom-4 right-4 bg-white/95 rounded-lg px-3 py-1.5 shadow-md">
                    <span className="text-xs font-bold text-[#044875]">{prog.ageRange}</span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6" style={{ borderTop: `4px solid ${color}` }}>
                  <h3 className="text-xl font-extrabold mb-2" style={{ fontFamily: "Outfit, sans-serif", color: "#044875" }}>
                    {prog.name}
                  </h3>
                  <p className="text-[#6B7280] text-sm leading-relaxed mb-5">{prog.description}</p>
                  <ul className="space-y-2 mb-6">
                    {prog.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-[#374151]">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color }} strokeWidth={1.5} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md group"
                    style={{ background: color, color: isLight ? "#044875" : "white" }}
                  >
                    Enquire Now
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}





