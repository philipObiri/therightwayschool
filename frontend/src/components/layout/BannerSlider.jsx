import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SLIDES = [
  '/campus-slide-1.jpg',
  '/campus-slide-2.jpg',
  '/campus-slide-3.jpg',
  '/campus-slide-4.jpg',
  '/campus-slide-5.jpg',
];

export default function BannerSlider() {
  const [current, setCurrent] = useState(() => Math.floor(Math.random() * SLIDES.length));
  const [fade, setFade] = useState(true);

  const goTo = useCallback((idx) => {
    setFade(false);
    setTimeout(() => { setCurrent(idx); setFade(true); }, 300);
  }, []);

  const next = useCallback(() => goTo((current + 1) % SLIDES.length), [current, goTo]);
  const prev = useCallback(() => goTo((current - 1 + SLIDES.length) % SLIDES.length), [current, goTo]);

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden group" style={{ height: '220px' }} data-testid="banner-slider">
      <img
        src={SLIDES[current]}
        alt={`RightWay Campus ${current + 1}`}
        className="w-full h-full object-cover transition-opacity duration-500 ease-in-out"
        style={{ opacity: fade ? 1 : 0 }}
        draggable={false}
      />
      {/* Gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

      {/* Nav arrows */}
      <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm" data-testid="slider-prev">
        <ChevronLeft className="w-4 h-4 text-[#1B2A4A]" />
      </button>
      <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm" data-testid="slider-next">
        <ChevronRight className="w-4 h-4 text-[#1B2A4A]" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {SLIDES.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} className={`w-2 h-2 rounded-full transition-all duration-300 ${i === current ? 'bg-white w-5' : 'bg-white/50 hover:bg-white/70'}`} data-testid={`slider-dot-${i}`} />
        ))}
      </div>
    </div>
  );
}
