import React, { useRef, useState, useEffect } from "react";
import {
  Calculator, BookOpen, FlaskConical, Globe2, Palette, Music,
  Dumbbell, Monitor, Languages, Cross, Theater, Wrench,
} from "lucide-react";

function useScrollReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

const DEFAULT_SUBJECTS = [
  { icon: Calculator, name: "Mathematics", description: "Number sense, problem-solving, and logical reasoning from concrete to abstract." },
  { icon: BookOpen, name: "Language Arts", description: "Reading, writing, phonics, comprehension, and oral communication skills." },
  { icon: FlaskConical, name: "Science", description: "Hands-on experiments exploring biology, chemistry, and earth sciences." },
  { icon: Globe2, name: "Social Studies", description: "History, geography, and civics grounded in Caribbean and global contexts." },
  { icon: Palette, name: "Visual Arts", description: "Creative expression through drawing, painting, sculpture, and mixed media." },
  { icon: Music, name: "Music & Steel Pan", description: "Trinidad's musical heritage â€” melody, rhythm, and ensemble performance." },
  { icon: Dumbbell, name: "Physical Education", description: "Team sports, fitness, and movement for healthy body and mind." },
  { icon: Monitor, name: "ICT / Computing", description: "Digital literacy, coding fundamentals, and responsible technology use." },
  { icon: Languages, name: "Spanish", description: "Conversational Spanish and cultural appreciation from an early age." },
  { icon: Cross, name: "Religious Education", description: "Values, ethics, and an understanding of world faiths and traditions." },
  { icon: Theater, name: "Drama & Expression", description: "Confidence, empathy, and storytelling through performance and roleplay." },
  { icon: Wrench, name: "Design & Technology", description: "Practical problem-solving, making, and engineering thinking." },
];

// Alternating image pairs for the weaved layout
const SECTION_IMAGES = [
  "/kids/2149129485.jpg",
  "/kids/2148892510.jpg",
  "/kids/2149068381.jpg",
  "/kids/2148764069.jpg",
];

// Group subjects into rows of 3 for the weaved layout
function chunkSubjects(subjects) {
  const rows = [];
  for (let i = 0; i < subjects.length; i += 3) rows.push(subjects.slice(i, i + 3));
  return rows;
}

function SubjectCard({ subject, delay, visible }) {
  const Icon = subject.icon || Calculator;
  return (
    <div
      className={`group flex flex-col gap-3 p-5 bg-white/10 rounded-2xl border border-white/20 hover:bg-white/20 transition-all duration-500 hover:-translate-y-1 cursor-default ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      style={{ transitionDelay: delay }}
    >
      <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
        <Icon className="w-6 h-6 text-[#c1e5e6]" strokeWidth={1.5} />
      </div>
      <div>
        <h4 className="text-white font-bold text-sm mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>{subject.name}</h4>
        <p className="text-white/65 text-xs leading-relaxed">{subject.description}</p>
      </div>
    </div>
  );
}

function CurriculumRow({ subjects, image, reverse, rowIndex, visible }) {
  return (
    <div className={`grid lg:grid-cols-2 gap-8 items-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
      style={{ transitionDelay: `${rowIndex * 150}ms` }}>
      {/* Image side */}
      <div className={`${reverse ? "lg:order-2" : ""} relative`}>
        <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[4/3]">
          <img src={image} alt="Curriculum" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#044875]/40 to-transparent" />
        </div>
        {/* Decorative corner */}
        <div className={`absolute -bottom-4 ${reverse ? "-left-4" : "-right-4"} w-20 h-20 rounded-2xl bg-[#f8d904]/20 border-2 border-[#f8d904]/30 -z-10`} />
      </div>

      {/* Cards side */}
      <div className={`${reverse ? "lg:order-1" : ""} grid sm:grid-cols-3 gap-3`}>
        {subjects.map((subject, i) => (
          <SubjectCard key={i} subject={subject} delay={`${rowIndex * 150 + i * 80}ms`} visible={visible} />
        ))}
      </div>
    </div>
  );
}

export default function CurriculumSection({ subjects: apiSubjects }) {
  const subjects = apiSubjects?.length ? apiSubjects : DEFAULT_SUBJECTS;
  const visible = useScrollReveal();
  const rows = chunkSubjects(subjects);

  return (
    <section id="curriculum" className="py-20 overflow-hidden" style={{ background: "#5E60CE" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 text-[#c1e5e6] text-xs font-bold uppercase tracking-widest mb-3">
            <div className="w-8 h-0.5 bg-[#c1e5e6]" />
            Curriculum
            <div className="w-8 h-0.5 bg-[#c1e5e6]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
            A Holistic, Well-Rounded Education
          </h2>
          <p className="text-white/70 mt-3 max-w-xl mx-auto text-sm">
            Our curriculum covers every dimension of child development â€” academic, creative, physical, and social.
          </p>
        </div>

        {/* Weaved rows */}
        <div className="space-y-16">
          {rows.map((rowSubjects, i) => (
            <CurriculumRow
              key={i}
              subjects={rowSubjects}
              image={SECTION_IMAGES[i % SECTION_IMAGES.length]}
              reverse={i % 2 === 1}
              rowIndex={i}
              visible={visible}
            />
          ))}
        </div>

        {/* National curriculum badge */}
        <div className={`mt-14 text-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          style={{ transitionDelay: `${rows.length * 150 + 200}ms` }}>
          <div className="inline-flex items-center gap-3 bg-white/10 border border-white/20 rounded-full px-6 py-3">
            <Globe2 className="w-5 h-5 text-[#c1e5e6]" strokeWidth={1.5} />
            <span className="text-white/90 text-sm">
              Fully aligned with the <strong>Ministry of Education, Trinidad & Tobago</strong> national curriculum
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}





