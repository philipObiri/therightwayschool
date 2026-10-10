import React, { useEffect, useRef, useState } from "react";
import { STATS } from "../data/placeholder-data";

function useScrollReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

function AnimatedCounter({ target, suffix, visible }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const duration = 1800;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [visible, target]);
  return <span>{count}{suffix}</span>;
}

export default function AboutSection({ content }) {
  const visible = useScrollReveal();

  return (
    <section id="about" className="py-20" style={{ background: "#FBF8F3" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          {/* Images */}
          <div className={`relative transition-all duration-700 ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}>
            <div className="grid grid-cols-2 gap-4">
              <img src="/kids/2149068381.jpg" alt="Students learning" className="rounded-2xl shadow-lg w-full h-64 object-cover" />
              <img src="/kids/2148764069.jpg" alt="Classroom activity" className="rounded-2xl shadow-lg w-full h-64 object-cover mt-8" />
            </div>
            <div className="absolute -bottom-4 -right-4 text-white px-5 py-3 rounded-xl shadow-xl" style={{ background: "#044875" }}>
              <div className="text-2xl font-extrabold" style={{ fontFamily: "Outfit, sans-serif" }}>Est. 2018</div>
              <div className="text-[#c1e5e6] text-xs uppercase tracking-wider">Years of Excellence</div>
            </div>
          </div>

          {/* Text */}
          <div className={`transition-all duration-700 delay-200 ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#044875" }}>
              <div className="w-8 h-0.5" style={{ background: "#044875" }} />
              About Us
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1A1A2E] leading-tight mb-5" style={{ fontFamily: "Outfit, sans-serif" }}>
              {content?.heading || "Nurturing Bright Minds in the Heart of Trinidad"}
            </h2>
            <p className="text-[#6B7280] leading-relaxed mb-4">
              {content?.paragraph1 || "Founded in 2018, The RightWay Centre of Learning was built on a simple belief: that every child deserves a high-quality, personalised education in a safe and nurturing environment. We blend the best of Montessori philosophy with the Trinidad & Tobago national curriculum to create learners who are curious, confident, and capable."}
            </p>
            <p className="text-[#6B7280] leading-relaxed mb-8">
              {content?.paragraph2 || "Our team of qualified, passionate educators works alongside families to ensure that each child's unique potential is discovered and developed. We believe that education is a partnership â€” and parents are our most important collaborators."}
            </p>

            {/* Mission pill */}
            <div className="rounded-xl px-5 py-4 mb-8 border-l-4" style={{ background: "#c1e5e6", borderColor: "#044875" }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#044875" }}>Our Mission</div>
              <p className="text-[#1A1A2E] text-sm leading-relaxed">
                {content?.mission || "To provide a joyful, inclusive, and academically excellent learning environment where every child in Trinidad and Tobago thrives."}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((stat, i) => (
            <div key={i}
              className={`text-center bg-white rounded-2xl shadow-sm p-6 border border-[#E5E7EB] transition-all duration-700 hover:shadow-md ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${i * 100 + 300}ms` }}>
              <div className="text-4xl font-extrabold mb-1" style={{ fontFamily: "Outfit, sans-serif", color: "#044875" }}>
                <AnimatedCounter target={stat.value} suffix={stat.suffix} visible={visible} />
              </div>
              <div className="text-sm text-[#6B7280] font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}





