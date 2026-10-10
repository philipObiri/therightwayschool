import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { GraduationCap, BookOpen, Users, BarChart3, Shield, ArrowRight, CheckCircle } from 'lucide-react';

const HERO_IMAGES = [
  '/campus-1.jpg',
  '/campus-2.jpg',
  '/campus-3.jpg',
  '/campus-4.jpg',
];

// Placeholder logo — replace with actual school logo SVG/PNG
const RwLogo = ({ className }) => (
  <svg className={className} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#2A7A5A"/>
    <text x="20" y="28" fontFamily="Outfit,sans-serif" fontSize="22" fontWeight="800"
          textAnchor="middle" fill="#FFFFFF">R</text>
  </svg>
);

export default function LandingPage() {
  const navigate = useNavigate();
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setHeroIdx(i => (i + 1) % HERO_IMAGES.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const features = [
    { icon: BookOpen, title: 'Learning Management', desc: 'Create and deliver lessons with video, PDF, and interactive content.' },
    { icon: Users, title: 'Student & Staff Registry', desc: 'Comprehensive profiles, class management, and attendance tracking.' },
    { icon: BarChart3, title: 'Finance & Accounting', desc: 'Invoice generation, payment tracking, and financial reporting.' },
    { icon: Shield, title: 'Admin Operations', desc: 'Role-based access, audit logs, and complete school oversight.' },
  ];

  return (
    <div className="min-h-screen bg-[#FBF8F3]" data-testid="landing-page">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-3">
          <RwLogo className="w-12 h-12" />
          <span className="text-lg font-bold text-[#1A1A2E] font-['Outfit']">RightWay Workstation</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/login')} data-testid="nav-login-btn">
            Sign in
          </Button>
          <Button className="rounded-full bg-[#2A7A5A] hover:bg-[#236B4E]" onClick={() => navigate('/login')} data-testid="nav-get-started-btn">
            Get Started <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden min-h-[80vh] flex items-center">
        {HERO_IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt="RightWay Campus"
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{ opacity: i === heroIdx ? 1 : 0 }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-[#2A7A5A]/90 via-[#2A7A5A]/70 to-[#2A7A5A]/40" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24 w-full">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white rounded-full px-4 py-1.5 text-sm font-medium mb-6 border border-white/10">
              <CheckCircle className="w-4 h-4 text-[#F4A261]" /> Trusted by RightWay Community
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 font-['Outfit']">
              Your School's Complete <span className="text-[#F4A261]">Digital Workspace</span>
            </h1>
            <p className="text-lg text-white/70 leading-relaxed mb-8 max-w-lg">
              Manage academics, finance, staff operations, and communication all in one powerful platform designed for modern schools.
            </p>
            <Button
              size="lg"
              className="rounded-full bg-[#F4A261] hover:bg-[#E8904C] text-white font-bold h-12 px-8 text-base"
              onClick={() => navigate('/login')}
              data-testid="hero-get-started-btn"
            >
              Sign In <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <div className="flex gap-2 mt-10">
              {HERO_IMAGES.map((_, i) => (
                <button key={i} onClick={() => setHeroIdx(i)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === heroIdx ? 'bg-[#F4A261] w-8' : 'bg-white/30 w-4'}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#1A1A2E] mb-3 font-['Outfit']">Everything You Need</h2>
            <p className="text-[#6B7280] max-w-xl mx-auto">
              A comprehensive suite of tools designed specifically for school management.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-[#FBF8F3] rounded-xl overflow-hidden border border-[#E5E7EB] hover:-translate-y-1 transition-transform duration-200 shadow-sm hover:shadow-md">
                <div className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-[#F0F7F4] flex items-center justify-center mb-4">
                    <f.icon className="w-6 h-6 text-[#2A7A5A]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1A1A2E] mb-2 font-['Outfit']">{f.title}</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-16 md:py-24 overflow-hidden bg-[#2A7A5A]">
        <div className="relative z-10 max-w-4xl mx-auto px-6 md:px-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4 font-['Outfit']">Ready to Get Started?</h2>
          <p className="text-white/70 mb-8">Join the RightWay Centre community and transform your school experience.</p>
          <Button
            size="lg"
            className="rounded-full bg-[#F4A261] hover:bg-[#E8904C] text-white font-bold h-12 px-10"
            onClick={() => navigate('/login')}
            data-testid="cta-btn"
          >
            Sign In Now <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8 px-6 md:px-12 bg-[#1A1A2E]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <RwLogo className="w-10 h-10" />
            <span className="text-sm font-semibold text-white font-['Outfit']">RightWay Workstation</span>
          </div>
          <p className="text-sm text-white/40">&copy; {new Date().getFullYear()} The RightWay Centre of Learning. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
