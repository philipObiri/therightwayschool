import React, { useRef, useState, useEffect } from "react";
import {
  CircleDot, Waves, Paintbrush2, Mic2, Music4, BookMarked,
  Leaf, Drama, Trophy, Brain, Globe2, ChefHat,
} from "lucide-react";

function useScrollReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

const DEFAULT_ACTIVITIES = [
  { icon: CircleDot, name: "Football", category: "Sports", description: "Team-based play that builds fitness, strategy, and sportsmanship." },
  { icon: Waves, name: "Swimming", category: "Sports", description: "Water safety and competitive swimming for all skill levels." },
  { icon: Paintbrush2, name: "Art Club", category: "Creative", description: "Explore painting, drawing, and mixed media with guided instruction." },
  { icon: Mic2, name: "School Choir", category: "Creative", description: "Vocal training, harmony, and performance for confident young singers." },
  { icon: Music4, name: "Steel Pan", category: "Creative", description: "Our national instrument â€” from basics to full band performance." },
  { icon: BookMarked, name: "Book Club", category: "Academic", description: "Guided reading and discussion to build a lifelong love of literature." },
  { icon: Leaf, name: "Gardening Club", category: "Life Skills", description: "Grow fruits, vegetables, and herbs while learning about ecology." },
  { icon: Drama, name: "Drama Club", category: "Creative", description: "Script writing, rehearsal, and stage performance for budding actors." },
  { icon: Trophy, name: "Cricket", category: "Sports", description: "Trinidad's favourite sport â€” technique, teamwork, and spirit." },
  { icon: Brain, name: "Chess Club", category: "Academic", description: "Critical thinking, patience, and strategy through the game of kings." },
  { icon: Globe2, name: "Debate Society", category: "Academic", description: "Research, public speaking, and persuasive argument skills." },
  { icon: ChefHat, name: "Home Economics", category: "Life Skills", description: "Practical cooking, nutrition, and household management basics." },
];

const CATEGORY_CONFIG = {
  Sports: { color: "#044875", bg: "bg-[#c1e5e6]/20", text: "text-[#044875]" },
  Creative: { color: "#bc9908", bg: "bg-[#f8d904]/15", text: "text-[#bc9908]" },
  Academic: { color: "#2A7A5A", bg: "bg-[#c1e5e6]/20", text: "text-[#2A7A5A]" },
  "Life Skills": { color: "#E76F51", bg: "bg-[#FFF4F2]", text: "text-[#E76F51]" },
};

const ROW_IMAGES = [
  "/kids/3875.jpg",
  "/kids/46286.jpg",
  "/kids/59574.jpg",
];

const CATEGORIES = ["All", "Sports", "Creative", "Academic", "Life Skills"];

function ActivityCard({ activity, delay, visible }) {
  const Icon = activity.icon || CircleDot;
  const cfg = CATEGORY_CONFIG[activity.category] || CATEGORY_CONFIG.Sports;
  return (
    <div
      className={`group flex gap-4 p-4 bg-white rounded-2xl border border-[#F0EDE9] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-400 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      style={{ transitionDelay: delay }}
    >
      <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center ${cfg.bg} group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-6 h-6" style={{ color: cfg.color }} strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-bold text-[#1A1A2E] text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>{activity.name}</h4>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{activity.category}</span>
        </div>
        <p className="text-[#6B7280] text-xs leading-relaxed">{activity.description}</p>
      </div>
    </div>
  );
}

function ActivitiesRow({ activities, image, reverse, rowIndex, visible }) {
  return (
    <div className={`grid lg:grid-cols-2 gap-8 items-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
      style={{ transitionDelay: `${rowIndex * 150}ms` }}>
      {/* Image */}
      <div className={`${reverse ? "lg:order-2" : ""} relative`}>
        <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3]">
          <img src={image} alt="School activities" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#E76F51]/30 to-transparent" />
        </div>
        <div className={`absolute -bottom-4 ${reverse ? "-left-4" : "-right-4"} w-16 h-16 rounded-2xl bg-[#F4A261]/40 border-2 border-[#F4A261]/50 -z-10`} />
      </div>

      {/* Cards */}
      <div className={`${reverse ? "lg:order-1" : ""} grid sm:grid-cols-2 gap-3`}>
        {activities.map((a, i) => (
          <ActivityCard key={i} activity={a} delay={`${rowIndex * 150 + i * 70}ms`} visible={visible} />
        ))}
      </div>
    </div>
  );
}

export default function ActivitiesSection({ activities: apiActivities }) {
  const activities = apiActivities?.length
    ? apiActivities.map((a, i) => ({ ...DEFAULT_ACTIVITIES[i % DEFAULT_ACTIVITIES.length], ...a }))
    : DEFAULT_ACTIVITIES;

  const [activeCategory, setActiveCategory] = useState("All");
  const visible = useScrollReveal();

  const filtered = activeCategory === "All" ? activities : activities.filter((a) => a.category === activeCategory);

  // Group into rows of 4 for the weaved layout
  const rows = [];
  for (let i = 0; i < filtered.length; i += 4) rows.push(filtered.slice(i, i + 4));

  return (
    <section id="activities" className="py-20 overflow-hidden" style={{ background: "#FFF0E6" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-10 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 text-[#044875] text-xs font-bold uppercase tracking-widest mb-3">
            <div className="w-8 h-0.5 bg-[#044875]" />
            Beyond the Classroom
            <div className="w-8 h-0.5 bg-[#044875]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
            Life Beyond the Classroom
          </h2>
          <p className="text-[#6B7280] mt-3 max-w-xl mx-auto text-sm">
            We nurture the whole child â€” mind, body, and spirit â€” through a rich programme of extracurricular activities.
          </p>
        </div>

        {/* Category filter */}
        <div className={`flex flex-wrap justify-center gap-2 mb-12 transition-all duration-700 delay-150 ${visible ? "opacity-100" : "opacity-0"}`}>
          {CATEGORIES.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 ${
                  activeCategory === cat
                    ? "bg-[#c1e5e6] text-[#044875] border-[#044875] shadow-md font-bold"
                    : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#044875] hover:text-[#044875]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Weaved rows */}
        <div className="space-y-16">
          {rows.map((rowActivities, i) => (
            <ActivitiesRow
              key={i}
              activities={rowActivities}
              image={ROW_IMAGES[i % ROW_IMAGES.length]}
              reverse={i % 2 === 1}
              rowIndex={i}
              visible={visible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}





