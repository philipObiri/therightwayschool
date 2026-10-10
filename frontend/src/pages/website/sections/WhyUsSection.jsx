import React, { useRef, useState, useEffect } from "react";
import { GraduationCap, Leaf, ShieldCheck, BarChart3, HandHeart, Trophy } from "lucide-react";

function useScrollReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

const DEFAULT_USPS = [
  { title: "Qualified Educators", description: "All our teachers hold Ministry-recognised qualifications and undergo continuous professional development." },
  { title: "Montessori Approach", description: "Child-led learning that respects each child's pace, building independence and intrinsic motivation." },
  { title: "Safe Environment", description: "CCTV-monitored premises, secure entry, and trained staff ensuring every child is always protected." },
  { title: "Real-Time Progress Reports", description: "Parents receive regular updates through our digital portal — never out of the loop." },
  { title: "Community-Centred", description: "We partner with families, believing parents are the first and most important teachers." },
  { title: "Proven Results", description: "Consistent SEA placement success and a track record of nurturing well-rounded young citizens." },
];

const USP_ICONS = [GraduationCap, Leaf, ShieldCheck, BarChart3, HandHeart, Trophy];

export default function WhyUsSection({ usps: apiUsps }) {
  const usps = (apiUsps?.length ? apiUsps : DEFAULT_USPS).map((u, i) => ({
    ...u,
    Icon: USP_ICONS[i % USP_ICONS.length],
  }));
  const visible = useScrollReveal();

  return (
    <section id="why-us" className="py-20 overflow-hidden" style={{ background: "#f8d904" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-14 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#044875" }}>
            <div className="w-8 h-0.5 bg-[#044875]" />
            Why Choose Us
            <div className="w-8 h-0.5 bg-[#044875]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ fontFamily: "Outfit, sans-serif", color: "#044875" }}>
            The RightWay Difference
          </h2>
          <p className="mt-3 max-w-xl mx-auto text-sm font-medium" style={{ color: "#04487599" }}>
            More than a school — a community of passionate educators and empowered families.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {usps.map((item, i) => {
            const Icon = item.Icon || GraduationCap;
            return (
              <div
                key={i}
                className={`group bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-2 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300" style={{ background: "#044875" }}>
                  <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "Outfit, sans-serif", color: "#044875" }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-[#555]">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}


