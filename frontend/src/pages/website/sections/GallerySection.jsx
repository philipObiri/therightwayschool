import React, { useRef, useState, useEffect } from "react";
import { X, ZoomIn } from "lucide-react";
import { GALLERY_IMAGES } from "../data/placeholder-data";

function useScrollReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

const FILTERS = ["All", "Learning Activities", "Activities", "Facilities"];

export default function GallerySection({ images: apiImages }) {
  const raw = apiImages?.length ? apiImages : GALLERY_IMAGES;
  const [filter, setFilter] = useState("All");
  const [lightbox, setLightbox] = useState(null);
  const visible = useScrollReveal();

  const images = filter === "All" ? raw : raw.filter((img) => img.category === filter);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <section id="gallery" className="py-20" style={{ background: "#F0FFFE" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className={`text-center mb-10 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h2 className="text-4xl sm:text-5xl font-extrabold mb-3" style={{ fontFamily: "Outfit, sans-serif", color: "#044875" }}>
            Photo Gallery
          </h2>
          <p className="text-[#6B7280] max-w-xl mx-auto">
            Take a visual tour of our beautiful campus, classrooms, and happy learners.
          </p>
        </div>

        {/* Filter pills */}
        <div className={`flex flex-wrap justify-center gap-3 mb-10 transition-all duration-700 delay-150 ${visible ? "opacity-100" : "opacity-0"}`}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
                filter === f
                  ? "bg-[#2A7A5A] text-white border-[#2A7A5A] shadow-md"
                  : "bg-white text-[#374151] border-[#E5E7EB] hover:border-[#2A7A5A] hover:text-[#2A7A5A]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* 3-column even grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {images.map((img, i) => (
            <div
              key={i}
              className={`relative rounded-2xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl transition-all duration-500 aspect-[4/3] ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
              style={{ transitionDelay: `${i * 60}ms` }}
              onClick={() => setLightbox(img)}
            >
              <img
                src={img.src}
                alt={img.alt}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-[#044875]/0 group-hover:bg-[#044875]/40 transition-all duration-300 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100">
                  <ZoomIn className="w-5 h-5 text-white" />
                </div>
              </div>
              {img.category && (
                <div className="absolute top-3 left-3 bg-white/90 text-[#044875] text-xs font-bold px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {img.category}
                </div>
              )}
            </div>
          ))}
        </div>

        {images.length === 0 && (
          <p className="text-center text-[#6B7280] mt-10">No photos in this category yet.</p>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/30 transition-colors border border-white/20"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            className="max-h-[85vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox.alt && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-[#044875]/80 px-5 py-2 rounded-full backdrop-blur-sm">
              {lightbox.alt}
            </div>
          )}
        </div>
      )}
    </section>
  );
}





