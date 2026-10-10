import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Award } from "lucide-react";
import { HERO_SLIDES } from "../data/placeholder-data";

export default function HeroSection({ slides: apiSlides, onNavigate }) {
  const slides = apiSlides?.length ? apiSlides : HERO_SLIDES;
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => { setVisible(true); }, []);

  useEffect(() => {
    const t = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length);
  const next = () => setCurrent((c) => (c + 1) % slides.length);
  const slide = slides[current];

  const handleCta = (href) => {
    if (!onNavigate) return;
    const map = { "#programmes": "programmes", "#admissions": "admissions", "#about": "about", "#contact": "contact", "#curriculum": "curriculum", "#gallery": "gallery" };
    const id = map[href];
    if (id) { onNavigate(id); window.scrollTo({ top: 0, behavior: "instant" }); }
  };

  return (
    <section id="home" className="relative h-screen min-h-[600px] max-h-[900px] overflow-hidden">
      {/* Background images */}
      {slides.map((s, i) => (
        <div
          key={i}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
          style={{ backgroundImage: `url('${s.image}')`, opacity: i === current ? 1 : 0 }}
          aria-hidden={i !== current}
        />
      ))}

      {/* Gradient overlay â€” navy to transparent */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#044875]/90 via-[#044875]/65 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#044875]/40 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-10 h-full flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className={`max-w-2xl transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[#f8d904]/20 backdrop-blur-sm border border-[#f8d904]/40 text-[#f8d904] text-xs font-bold px-4 py-2 rounded-full mb-6 uppercase tracking-widest">
              <Award className="w-3.5 h-3.5" />
              Trinidad & Tobago's Premier Learning Centre
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-5"
              style={{ fontFamily: "Outfit, sans-serif", textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}
            >
              {slide.heading}
            </h1>
            <p className="text-lg sm:text-xl text-white/85 leading-relaxed mb-8 max-w-xl">
              {slide.subheading}
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleCta(slide.cta1.href)}
                className="px-7 py-3.5 bg-[#f8d904] text-[#044875] font-bold rounded-xl hover:bg-[#bc9908] hover:text-white transition-all duration-200 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 text-sm"
              >
                {slide.cta1.label}
              </button>
              <button
                onClick={() => handleCta(slide.cta2.href)}
                className="px-7 py-3.5 bg-white/15 backdrop-blur-sm text-white font-semibold rounded-xl border-2 border-white/50 hover:bg-white/25 transition-all duration-200 text-sm"
              >
                {slide.cta2.label}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Arrows */}
      <button onClick={prev} aria-label="Previous"
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm text-white flex items-center justify-center hover:bg-[#f8d904] hover:text-[#044875] transition-all duration-200">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button onClick={next} aria-label="Next"
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm text-white flex items-center justify-center hover:bg-[#f8d904] hover:text-[#044875] transition-all duration-200">
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)} aria-label={`Slide ${i + 1}`}
            className={`rounded-full transition-all duration-300 ${i === current ? "bg-[#f8d904] w-7 h-2.5" : "bg-white/40 w-2.5 h-2.5"}`}
          />
        ))}
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 right-8 z-20 hidden md:flex flex-col items-center gap-1 text-white/50">
        <span className="text-[10px] uppercase tracking-widest">Explore</span>
        <div className="w-px h-10 bg-white/20 relative overflow-hidden">
          <div className="absolute top-0 w-full bg-[#f8d904]/70 h-1/3" style={{ animation: "scrollCue 1.5s ease-in-out infinite" }} />
        </div>
      </div>
    </section>
  );
}




