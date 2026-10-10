import React, { useRef, useState, useEffect } from "react";
import { Calendar, ArrowRight } from "lucide-react";
import { BLOG_POSTS } from "../data/placeholder-data";

function useScrollReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

export default function BlogSection({ posts: apiPosts }) {
  const posts = apiPosts?.length ? apiPosts : BLOG_POSTS;
  const visible = useScrollReveal();

  return (
    <section id="blog" className="py-20" style={{ background: "#F0F7FF" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-14 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 text-[#044875] text-xs font-bold uppercase tracking-widest mb-3">
            <div className="w-8 h-0.5 bg-[#044875]" />
            Latest Articles
            <div className="w-8 h-0.5 bg-[#044875]" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
            News & Resources for Families
          </h2>
          <p className="text-[#6B7280] mt-3 max-w-xl mx-auto">
            Educational insights, school news, and parenting resources from our team.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {posts.map((post, i) => (
            <article
              key={post.slug}
              className={`bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <div className="relative h-48 overflow-hidden">
                <img src={post.image} alt={post.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-3 left-3">
                  <span className="bg-[#044875] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {post.category}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-3">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{post.date}</span>
                  {post.author && <><span>Â·</span><span>{post.author}</span></>}
                </div>
                <h3 className="text-base font-bold text-[#1A1A2E] mb-2 leading-snug line-clamp-2" style={{ fontFamily: "Outfit, sans-serif" }}>
                  {post.title}
                </h3>
                <p className="text-[#6B7280] text-sm leading-relaxed mb-4 line-clamp-3">{post.excerpt}</p>
                <button className="inline-flex items-center gap-1.5 text-[#044875] text-sm font-semibold hover:gap-2.5 transition-all duration-200">
                  Read More <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}





