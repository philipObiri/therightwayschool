import React, { useRef, useState, useEffect } from "react";
import { Clock, MapPin } from "lucide-react";
import { EVENTS } from "../data/placeholder-data";

function useScrollReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

const CATEGORY_COLORS = {
  "School Event": "#044875",
  Academic: "#bc9908",
  Sports: "#044875",
  Ceremony: "#c1e5e6",
};

function parseDateParts(dateStr) {
  try {
    const d = new Date(dateStr);
    return { month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(), day: d.getDate() };
  } catch {
    const parts = dateStr.split(" ");
    return { month: parts[0]?.slice(0, 3).toUpperCase() || "", day: parts[1]?.replace(",", "") || "" };
  }
}

export default function EventsSection({ events: apiEvents }) {
  const events = apiEvents?.length ? apiEvents : EVENTS;
  const visible = useScrollReveal();

  return (
    <section id="events" className="py-20" style={{ background: "#FFFBEB" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-14 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 text-[#044875] text-xs font-bold uppercase tracking-widest mb-3">
            <div className="w-8 h-0.5 bg-[#044875]" />
            Upcoming Events
            <div className="w-8 h-0.5 bg-[#044875]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
            Mark Your Calendar
          </h2>
          <p className="text-[#6B7280] mt-3 max-w-xl mx-auto">
            Stay connected with school life â€” key dates, celebrations, and community moments.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {events.map((event, i) => {
            const { month, day } = parseDateParts(event.date);
            const color = CATEGORY_COLORS[event.category] || "#044875";
            return (
              <div
                key={i}
                className={`flex gap-5 bg-white rounded-2xl p-5 shadow-sm border border-[#E5E7EB] hover:shadow-md hover:-translate-y-0.5 transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {/* Date badge */}
                <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center rounded-xl py-3" style={{ background: color }}>
                  <span className="text-white/80 text-[10px] font-bold uppercase tracking-wider">{month}</span>
                  <span className="text-white text-2xl font-extrabold leading-none" style={{ fontFamily: "Outfit, sans-serif" }}>{day}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-[#1A1A2E] text-sm leading-snug" style={{ fontFamily: "Outfit, sans-serif" }}>
                      {event.title}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 text-white" style={{ background: color }}>
                      {event.category}
                    </span>
                  </div>
                  <p className="text-[#6B7280] text-xs leading-relaxed mb-2 line-clamp-2">{event.description}</p>
                  <div className="flex flex-wrap gap-3 text-[#6B7280] text-xs">
                    {event.time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {event.time}
                      </span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {event.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}






