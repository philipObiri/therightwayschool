import React, { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Search, Filter } from "lucide-react";
import PublicLayout from "./layout/PublicLayout";
import api from "@/lib/api";

// ─── Skeleton-aware gallery image ────────────────────────────────────────────
// Uses an aspect-ratio wrapper so the skeleton takes up the right space
// while the real image loads invisibly, then fades in.

const ASPECT_PAIRS = [
  [5, 6],   // portrait-ish
  [4, 5],   // portrait
  [1, 1],   // square
  [3, 2],   // landscape
];

function GalleryImg({ src, alt, color, aspectPair, categoryLabel, onOpen }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [num, den] = aspectPair;

  if (errored) return null;

  return (
    <div
      className="break-inside-avoid mb-3 group relative rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
      style={{ borderTop: `3px solid ${color}` }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`View photo: ${alt}`}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
    >
      {/* Aspect-ratio container — drives height for both skeleton and image */}
      <div style={{ position: "relative", aspectRatio: `${num} / ${den}` }}>

        {/* Shimmer skeleton — fills container until image is ready */}
        {!loaded && (
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, #e8e8e8 0%, #f5f5f5 40%, #e8e8e8 80%)",
              backgroundSize: "200% 100%",
              animation: "skeleton-shimmer 1.4s ease-in-out infinite",
            }}
          />
        )}

        {/* Real image — loads invisibly then fades in */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.5s ease" }}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />

        {/* Hover overlay — only shown once image is visible */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%)" }}
        >
          <div className="flex items-center gap-1.5">
            <ZoomIn className="w-4 h-4 text-white" />
            <span className="text-white text-xs font-semibold truncate">{categoryLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Static real images organised by category ───────────────────────────────

const BASE = "/TheRightWay_Images";

const STATIC_ALBUMS = [
  {
    id: "preschool",
    label: "Preschool Life",
    emoji: "🌱",
    color: "#FF6B6B",
    images: [
      { src: `${BASE}/PRESCHOOL 2026/IMG_8834.jpg`, alt: "Preschool activity 1" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8844.jpg`, alt: "Preschool activity 2" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8848.jpg`, alt: "Preschool classroom" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8856.jpg`, alt: "Young learners" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8862.jpg`, alt: "Preschool fun" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8868.jpg`, alt: "Early childhood" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8877.jpg`, alt: "Nursery learning" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8881.jpg`, alt: "Preschool play" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8886.jpg`, alt: "Children in class" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8888.jpg`, alt: "Early literacy" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8897.jpg`, alt: "Preschool story time" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8898.jpg`, alt: "Kindergarten activity" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8908.jpg`, alt: "Preschool art" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8912.jpg`, alt: "Young students" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8921.jpg`, alt: "Preschool group" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8926.jpg`, alt: "Early years" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8927.jpg`, alt: "Preschool moment" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8937.jpg`, alt: "Children learning" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8943.jpg`, alt: "Preschool play 2" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8949.jpg`, alt: "Classroom activity" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8953.jpg`, alt: "Young learners 2" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8959.jpg`, alt: "Preschool 2026" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8962.jpg`, alt: "Early childhood 2" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8963.jpg`, alt: "Nursery 2026" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8975.jpg`, alt: "Preschool group 2" },
      { src: `${BASE}/PRESCHOOL 2026/IMG_8976.jpg`, alt: "Preschool final" },
    ],
  },
  {
    id: "sea",
    label: "SEA 2026",
    emoji: "🎓",
    color: "#6BCB77",
    images: [
      { src: `${BASE}/SEA 2026/IMG_9022.jpg`, alt: "SEA graduation" },
      { src: `${BASE}/SEA 2026/IMG_9025.jpg`, alt: "SEA 2026 celebration" },
      { src: `${BASE}/SEA 2026/IMG_9026.jpg`, alt: "SEA students" },
      { src: `${BASE}/SEA 2026/IMG_9035.jpg`, alt: "SEA exam day" },
      { src: `${BASE}/SEA 2026/IMG_9038.jpg`, alt: "SEA morning" },
      { src: `${BASE}/SEA 2026/IMG_9039.jpg`, alt: "SEA preparation" },
      { src: `${BASE}/SEA 2026/IMG_9047.jpg`, alt: "SEA class" },
      { src: `${BASE}/SEA 2026/IMG_9050.jpg`, alt: "SEA cohort" },
      { src: `${BASE}/SEA 2026/IMG_9053.jpg`, alt: "SEA group" },
      { src: `${BASE}/SEA 2026/IMG_9055.jpg`, alt: "SEA together" },
      { src: `${BASE}/SEA 2026/IMG_9057.jpg`, alt: "SEA students 2" },
      { src: `${BASE}/SEA 2026/IMG_9066.jpg`, alt: "SEA event" },
      { src: `${BASE}/SEA 2026/IMG_9068.jpg`, alt: "SEA moment" },
      { src: `${BASE}/SEA 2026/IMG_9076.jpg`, alt: "SEA photos" },
      { src: `${BASE}/SEA 2026/IMG_9079.jpg`, alt: "SEA final" },
      { src: `${BASE}/SEA 2026/IMG_9083.jpg`, alt: "SEA ceremony" },
      { src: `${BASE}/SEA 2026/IMG_9092.jpg`, alt: "SEA pride" },
      { src: `${BASE}/SEA 2026/IMG_9094.jpg`, alt: "SEA memories" },
      { src: `${BASE}/SEA 2026/IMG_9098.jpg`, alt: "SEA 2026 final" },
    ],
  },
  {
    id: "activities",
    label: "Clubs & Activities",
    emoji: "🎨",
    color: "#f8d904",
    images: [
      { src: `${BASE}/activities/IMG_1792.jpg`, alt: "Club activity" },
      { src: `${BASE}/activities/IMG_1794.jpg`, alt: "Student activity" },
      { src: `${BASE}/activities/IMG_1795.jpg`, alt: "Activities" },
      { src: `${BASE}/activities/IMG_1804.jpg`, alt: "Club event" },
      { src: `${BASE}/activities/IMG_1805.jpg`, alt: "Sports activity" },
      { src: `${BASE}/activities/IMG_1807.jpg`, alt: "Arts activity" },
      { src: `${BASE}/activities/IMG_1817.jpg`, alt: "Club fun" },
      { src: `${BASE}/activities/IMG_1819.jpg`, alt: "Student clubs" },
      { src: `${BASE}/activities/IMG_1821.jpg`, alt: "After school" },
      { src: `${BASE}/activities/IMG_1850.jpg`, alt: "Activity day" },
      { src: `${BASE}/activities/IMG_1853.jpg`, alt: "Club showcase" },
      { src: `${BASE}/activities/IMG_1854.jpg`, alt: "Student life" },
      { src: `${BASE}/activities/IMG_1881.jpg`, alt: "Activities 2" },
      { src: `${BASE}/activities/IMG_1902.jpg`, alt: "Club moment" },
      { src: `${BASE}/activities/IMG_1912.jpg`, alt: "Activities 3" },
      { src: `${BASE}/activities/IMG_2342.jpg`, alt: "Group activity" },
      { src: `${BASE}/activities/IMG_2378.jpg`, alt: "Fun activities" },
      { src: `${BASE}/activities/IMG_2415.jpg`, alt: "Club sports" },
      { src: `${BASE}/activities/IMG_2501.jpg`, alt: "After school fun" },
      { src: `${BASE}/activities/IMG_2532.jpg`, alt: "Activities group" },
      { src: `${BASE}/activities/IMG_2546.jpg`, alt: "Club day" },
      { src: `${BASE}/activities/IMG_3864.jpg`, alt: "Club 2" },
      { src: `${BASE}/activities/IMG_3871.jpg`, alt: "Activities 4" },
      { src: `${BASE}/activities/IMG_3899.jpg`, alt: "Student clubs 2" },
      { src: `${BASE}/activities/IMG_3909.jpg`, alt: "Activities 5" },
      { src: `${BASE}/activities/IMG_3913.jpg`, alt: "Fun clubs" },
      { src: `${BASE}/activities/IMG_3961.jpg`, alt: "Activities 6" },
      { src: `${BASE}/activities/IMG_3997.jpg`, alt: "Club life" },
      { src: `${BASE}/activities/IMG_4004.jpg`, alt: "Activities 7" },
      { src: `${BASE}/activities/IMG_4006.jpg`, alt: "Activities 8" },
      { src: `${BASE}/activities/IMG_4035.jpg`, alt: "Club highlights" },
      { src: `${BASE}/activities/IMG_4051.jpg`, alt: "Activities 9" },
      { src: `${BASE}/activities/IMG_4107.jpg`, alt: "Activities 10" },
      { src: `${BASE}/activities/IMG_4161.jpg`, alt: "Activities 11" },
      { src: `${BASE}/activities/IMG_4213.jpg`, alt: "Activities 12" },
      { src: `${BASE}/activities/IMG_4403.jpg`, alt: "Activities final" },
    ],
  },
  {
    id: "gallery",
    label: "School Events",
    emoji: "🌟",
    color: "#044875",
    images: [
      { src: `${BASE}/Gallery/IMG_0551.jpg`, alt: "School event" },
      { src: `${BASE}/Gallery/IMG_0569.jpg`, alt: "Campus life" },
      { src: `${BASE}/Gallery/IMG_0571.jpg`, alt: "School moment" },
      { src: `${BASE}/Gallery/IMG_0577.jpg`, alt: "Students together" },
      { src: `${BASE}/Gallery/IMG_0586.jpg`, alt: "School community" },
      { src: `${BASE}/Gallery/IMG_0601.jpg`, alt: "Events 1" },
      { src: `${BASE}/Gallery/IMG_0612.jpg`, alt: "School life" },
      { src: `${BASE}/Gallery/IMG_0614.jpg`, alt: "Student life 2" },
      { src: `${BASE}/Gallery/IMG_0620.jpg`, alt: "School event 2" },
      { src: `${BASE}/Gallery/IMG_0628.jpg`, alt: "Community event" },
      { src: `${BASE}/Gallery/IMG_0633.jpg`, alt: "School photos" },
      { src: `${BASE}/Gallery/IMG_0637.jpg`, alt: "Events 2" },
      { src: `${BASE}/Gallery/IMG_0639.jpg`, alt: "School gathering" },
      { src: `${BASE}/Gallery/IMG_0643.jpg`, alt: "Students event" },
      { src: `${BASE}/Gallery/IMG_0657.jpg`, alt: "School celebration" },
      { src: `${BASE}/Gallery/IMG_0659.jpg`, alt: "Campus event" },
      { src: `${BASE}/Gallery/IMG_0667.jpg`, alt: "Events 3" },
      { src: `${BASE}/Gallery/IMG_0669.jpg`, alt: "School life 3" },
      { src: `${BASE}/Gallery/IMG_0690.jpg`, alt: "Events 4" },
      { src: `${BASE}/Gallery/IMG_0697.jpg`, alt: "School photos 2" },
      { src: `${BASE}/Gallery/IMG_0701.jpg`, alt: "Events 5" },
      { src: `${BASE}/Gallery/IMG_0702.jpg`, alt: "Community 2" },
      { src: `${BASE}/Gallery/IMG_0705.jpg`, alt: "Events 6" },
      { src: `${BASE}/Gallery/IMG_0751.jpg`, alt: "Events 7" },
      { src: `${BASE}/Gallery/IMG_0755.jpg`, alt: "School fun" },
      { src: `${BASE}/Gallery/IMG_0758.jpg`, alt: "Events 8" },
      { src: `${BASE}/Gallery/IMG_0762.jpg`, alt: "School community 2" },
      { src: `${BASE}/Gallery/IMG_0769.jpg`, alt: "Events 9" },
      { src: `${BASE}/Gallery/IMG_0776.jpg`, alt: "Events 10" },
      { src: `${BASE}/Gallery/IMG_0791.jpg`, alt: "Events 11" },
      { src: `${BASE}/Gallery/IMG_0796.jpg`, alt: "School 2" },
      { src: `${BASE}/Gallery/IMG_0797.jpg`, alt: "Events 12" },
      { src: `${BASE}/Gallery/IMG_0801.jpg`, alt: "Events 13" },
      { src: `${BASE}/Gallery/IMG_1477.jpg`, alt: "Events 14" },
      { src: `${BASE}/Gallery/IMG_1481.jpg`, alt: "Events 15" },
      { src: `${BASE}/Gallery/IMG_1486.jpg`, alt: "Events 16" },
      { src: `${BASE}/Gallery/IMG_1489.jpg`, alt: "Events 17" },
      { src: `${BASE}/Gallery/IMG_1491.jpg`, alt: "Events 18" },
      { src: `${BASE}/Gallery/IMG_1495.jpg`, alt: "Events final" },
    ],
  },
  {
    id: "teachers",
    label: "Our Teachers",
    emoji: "👩‍🏫",
    color: "#c1e5e6",
    images: [
      { src: `${BASE}/Gallery/MS ANJANI_IMG_1312.jpg`, alt: "Ms. Anjani" },
      { src: `${BASE}/Gallery/MS BARKLEY_IMG_0869.jpg`, alt: "Ms. Barkley" },
      { src: `${BASE}/Gallery/MS BRUZUAL_IMG_1258.jpg`, alt: "Ms. Bruzual" },
      { src: `${BASE}/Gallery/MS CHARLES_IMG_0806.jpg`, alt: "Ms. Charles" },
      { src: `${BASE}/Gallery/MS ESTHER_IMG_1400.jpg`, alt: "Ms. Esther" },
      { src: `${BASE}/Gallery/MS FORDE_IMG_0972.jpg`, alt: "Ms. Forde" },
      { src: `${BASE}/Gallery/MS MILLINGTON_IMG_1196.jpg`, alt: "Ms. Millington" },
      { src: `${BASE}/Gallery/MS RAMCHAIT_IMG_1111.jpg`, alt: "Ms. Ramchait" },
      { src: `${BASE}/Gallery/MS SERAIAH_IMG_1409.jpg`, alt: "Ms. Seraiah" },
      { src: `${BASE}/Gallery/MS SHAH_IMG_1498.jpg`, alt: "Ms. Shah" },
      { src: `${BASE}/Gallery/MS SHARISSA_IMG_1407.jpg`, alt: "Ms. Sharissa" },
      { src: `${BASE}/Gallery/MS SOOKDEO_IMG_1180.jpg`, alt: "Ms. Sookdeo" },
      { src: `${BASE}/Gallery/MS STEPHANIE_IMG_0933.jpg`, alt: "Ms. Stephanie" },
      { src: `${BASE}/Gallery/MS WEBSTER_IMG_1051.jpg`, alt: "Ms. Webster" },
      { src: `${BASE}/Gallery/MS. BRIDGELAL_IMG_1419.jpg`, alt: "Ms. Bridgelal" },
    ],
  },
];

// Flatten all images for the "All" view with category info attached
const ALL_IMAGES = STATIC_ALBUMS.flatMap((album) =>
  album.images.map((img) => ({ ...img, category: album.id, categoryLabel: album.label, color: album.color }))
);

// Varying aspect ratios to create visual variety (portrait / landscape / square alternation)
const ASPECTS = ["aspect-[4/5]", "aspect-[3/4]", "aspect-square", "aspect-[4/3]", "aspect-[3/4]", "aspect-square", "aspect-[4/5]", "aspect-[3/2]"];

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ images, startIndex, onClose }) {
  const [current, setCurrent] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const touchStart = useRef(null);

  const prev = useCallback(() => { setCurrent((c) => (c - 1 + images.length) % images.length); setZoom(1); }, [images.length]);
  const next = useCallback(() => { setCurrent((c) => (c + 1) % images.length); setZoom(1); }, [images.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, onClose]);

  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const delta = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) delta > 0 ? next() : prev();
    touchStart.current = null;
  };

  const img = images[current];
  const zoomIn = () => setZoom((z) => Math.min(z + 0.5, 3));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.5, 1));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.95)" }}
      role="dialog" aria-modal="true" aria-label="Image lightbox"
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}>
        <span className="text-white/60 text-sm font-medium">{current + 1} / {images.length}</span>
        <div className="flex items-center gap-2">
          <button onClick={zoomOut} disabled={zoom <= 1} aria-label="Zoom out" className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30">
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white/60 text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} disabled={zoom >= 3} aria-label="Zoom in" className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button onClick={onClose} aria-label="Close lightbox" className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Prev / Next */}
      <button onClick={prev} aria-label="Previous image" className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all hover:scale-110">
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button onClick={next} aria-label="Next image" className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all hover:scale-110">
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Image */}
      <div
        className="max-w-[90vw] max-h-[85vh] overflow-auto cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          key={current}
          src={img.src}
          alt={img.alt}
          style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s ease", maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain" }}
        />
      </div>

      {/* Caption */}
      <div className="absolute bottom-0 left-0 right-0 pb-4 px-4 text-center" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}>
        <p className="text-white/80 text-sm">{img.alt}</p>
        {img.categoryLabel && (
          <span className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: img.color + "80" }}>
            {img.categoryLabel}
          </span>
        )}
      </div>

      {/* Click outside to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

// ─── Main Gallery Page ─────────────────────────────────────────────────────────

const FILTER_GROUPS = [
  {
    group: "Category",
    filters: [
      { id: "all", label: "All Photos", emoji: "🖼️" },
      { id: "preschool", label: "Preschool Life", emoji: "🌱" },
      { id: "sea", label: "SEA 2026", emoji: "🎓" },
      { id: "activities", label: "Clubs & Activities", emoji: "🎨" },
      { id: "gallery", label: "School Events", emoji: "🌟" },
      { id: "teachers", label: "Our Teachers", emoji: "👩‍🏫" },
    ],
  },
  {
    group: "Year",
    filters: [
      { id: "year_2026", label: "2026", emoji: "📅", matchFn: (img) => img.category === "sea" || img.category === "preschool" },
      { id: "year_all_activities", label: "Activities (All)", emoji: "🏃", matchFn: (img) => img.category === "activities" },
      { id: "year_events", label: "Events & Gala", emoji: "🎭", matchFn: (img) => img.category === "gallery" },
    ],
  },
];

// Flatten for lookup
const FILTERS = FILTER_GROUPS.flatMap((g) => g.filters);

const PAGE_SIZE = 24;

export default function Gallery() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [lightboxImages, setLightboxImages] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [cmsImages, setCmsImages] = useState([]);

  // Fetch any CMS-uploaded images from the backend
  useEffect(() => {
    api.get("/website/gallery").then((r) => {
      if (Array.isArray(r.data) && r.data.length > 0) setCmsImages(r.data);
    }).catch(() => {});
  }, []);

  // Build the filtered image list
  const allImages = [
    ...cmsImages.map((img) => ({ src: img.src || img.url, alt: img.alt || img.caption || "Gallery image", category: img.category || "gallery", categoryLabel: img.categoryLabel || "Gallery", color: "#044875" })),
    ...ALL_IMAGES,
  ];

  const activeFilterObj = FILTERS.find((f) => f.id === activeFilter);
  const filtered = allImages.filter((img) => {
    let matchCat;
    if (activeFilter === "all") {
      matchCat = true;
    } else if (activeFilterObj?.matchFn) {
      matchCat = activeFilterObj.matchFn(img);
    } else {
      matchCat = img.category === activeFilter;
    }
    const matchSearch = !search || img.alt.toLowerCase().includes(search.toLowerCase()) || img.categoryLabel?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const shown = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = shown.length < filtered.length;

  const openLightbox = (images, index) => { setLightboxImages(images); setLightboxIndex(index); };
  const closeLightbox = () => setLightboxImages(null);

  const handleFilterChange = (id) => { setActiveFilter(id); setPage(1); };

  return (
    <PublicLayout>
      <Helmet>
        <title>Gallery | The RightWay Centre of Learning</title>
        <meta name="description" content="Explore photos from The RightWay Centre of Learning — preschool life, SEA 2026, clubs, activities, events, and our amazing teachers." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://learnrightschool.com/gallery" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="The RightWay Centre of Learning" />
        <meta property="og:title" content="Gallery | The RightWay Centre of Learning" />
        <meta property="og:description" content="Browse photos from The RightWay Centre — preschool, SEA 2026, clubs, activities, and school events in Trinidad." />
        <meta property="og:image" content="https://learnrightschool.com/TheRightWay_Images/PRESCHOOL 2026/IMG_8877.jpg" />
        <meta property="og:url" content="https://learnrightschool.com/gallery" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      {/* ── Page Hero ── */}
      <section className="relative py-24 overflow-hidden" style={{ background: "linear-gradient(135deg, #044875 0%, #0a6aac 60%, #c1e5e6 100%)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, #f8d904 0%, transparent 40%), radial-gradient(circle at 80% 20%, #FF6B6B 0%, transparent 40%)" }} />
        {/* Floating decorative dots */}
        {["#FF6B6B", "#f8d904", "#6BCB77", "#c1e5e6"].map((c, i) => (
          <div key={c} className="absolute rounded-full opacity-20 pointer-events-none" style={{ width: [80, 50, 100, 60][i], height: [80, 50, 100, 60][i], backgroundColor: c, top: ["10%", "70%", "20%", "60%"][i], left: ["5%", "10%", "88%", "85%"][i] }} />
        ))}
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className="text-5xl mb-4">📸</div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
            Life at Rightway
          </h1>
          <p className="text-white/75 text-lg max-w-xl mx-auto leading-relaxed">
            Real moments from our classrooms, events, international trips, and the vibrant daily life of the RightWay community.
          </p>
          <div className="mt-6 flex justify-center gap-4 flex-wrap">
            {STATIC_ALBUMS.map((a) => (
              <span key={a.id} className="px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: a.color + "60" }}>
                {a.emoji} {a.images.length} {a.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Filters & Search ── */}
      <section className="sticky top-16 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search photos..."
                aria-label="Search gallery photos"
                className="pl-9 pr-4 py-2 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/20 focus:border-[#044875] w-52"
              />
            </div>
            {/* Filter pills grouped by Category and Year */}
            <div className="flex flex-col gap-2 flex-1 overflow-x-auto">
              {FILTER_GROUPS.map((group) => (
                <div key={group.group} className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] w-14 flex-shrink-0">{group.group}</span>
                  {group.filters.map((f) => {
                    const count = f.id === "all" ? allImages.length
                      : f.matchFn ? allImages.filter(f.matchFn).length
                      : allImages.filter((i) => i.category === f.id).length;
                    return (
                      <button
                        key={f.id}
                        onClick={() => handleFilterChange(f.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                          activeFilter === f.id ? "text-white shadow-md" : "bg-[#F5F5F5] text-[#374151] hover:bg-[#E5E7EB]"
                        }`}
                        style={activeFilter === f.id ? { backgroundColor: "#044875" } : {}}
                        aria-pressed={activeFilter === f.id}
                      >
                        {f.emoji} {f.label}
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ml-0.5 ${activeFilter === f.id ? "bg-white/20" : "bg-white text-[#6B7280]"}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Gallery Grid ── */}
      <section className="py-12" style={{ background: "#FBF8F3" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {shown.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="font-bold text-[#1A1A2E] mb-2">No photos found</h3>
              <p className="text-[#6B7280] text-sm">Try adjusting your search or filter.</p>
            </div>
          ) : (
            <>
              {/* Masonry-style CSS columns grid — each image has a skeleton placeholder */}
              <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
                {shown.map((img, i) => (
                  <GalleryImg
                    key={`${img.src}-${i}`}
                    src={img.src}
                    alt={img.alt}
                    color={img.color}
                    aspectPair={ASPECT_PAIRS[i % ASPECT_PAIRS.length]}
                    categoryLabel={img.categoryLabel}
                    onOpen={() => openLightbox(filtered, i)}
                  />
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="mt-10 text-center">
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="px-8 py-3 rounded-xl border-2 border-[#044875] text-[#044875] font-bold text-sm hover:bg-[#044875] hover:text-white transition-all duration-200"
                  >
                    Load More ({filtered.length - shown.length} remaining)
                  </button>
                </div>
              )}

              <p className="mt-6 text-center text-xs text-[#9CA3AF]">
                Showing {shown.length} of {filtered.length} photos
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── Upload invite for admin ── */}
      <section className="py-12 bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="text-3xl mb-3">📁</div>
          <h3 className="font-extrabold text-[#1A1A2E] mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>More Photos Coming Soon</h3>
          <p className="text-[#6B7280] text-sm leading-relaxed">
            We continuously update our gallery with new moments from school life. Follow us on{" "}
            <a href="https://instagram.com/rightwayttschool" target="_blank" rel="noopener noreferrer" className="text-[#044875] font-semibold hover:underline">
              @rightwayttschool
            </a>{" "}
            and{" "}
            <a href="https://facebook.com/rightwayttschool" target="_blank" rel="noopener noreferrer" className="text-[#044875] font-semibold hover:underline">
              Facebook
            </a>{" "}
            for daily highlights.
          </p>
        </div>
      </section>

      {/* Lightbox */}
      {lightboxImages && (
        <Lightbox images={lightboxImages} startIndex={lightboxIndex} onClose={closeLightbox} />
      )}
    </PublicLayout>
  );
}
