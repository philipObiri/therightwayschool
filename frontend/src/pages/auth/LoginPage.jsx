import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, ArrowRight, GraduationCap, BookOpen, Users } from 'lucide-react';
import { PWAInstallPrompt } from '../../components/PWAInstallPrompt';

const SLIDES = [
  {
    image: '/kids/young_school_boy_in_class.jpg',
    quote: 'Where every child is seen, heard, and empowered to thrive.',
    tag: 'Montessori Excellence',
  },
  {
    image: '/kids/2149091553.jpg',
    quote: 'Building confident learners through curiosity and creativity.',
    tag: 'Holistic Development',
  },
  {
    image: '/kids/2149557939.jpg',
    quote: 'A safe, nurturing space where great futures begin.',
    tag: 'Community & Care',
  },
  {
    image: '/kids/2148892510.jpg',
    quote: 'Inspiring young minds to discover their unique brilliance.',
    tag: 'Academic Excellence',
  },
];

const STATS = [
  { icon: Users, value: '200+', label: 'Students' },
  { icon: GraduationCap, value: '20+', label: 'Educators' },
  { icon: BookOpen, value: '12+', label: 'Subjects' },
];

const ROLE_ROUTES = {
  Admin: '/admin/dashboard', SuperAdmin: '/admin/dashboard',
  Teacher: '/teacher/dashboard', Student: '/student/home',
  Parent: '/parent/home', FinanceOfficer: '/admin/finance',
  HR_Officer: '/admin/hr', HeadOfAcademics: '/admin/dashboard',
  CEO: '/admin/dashboard', Founder: '/admin/dashboard',
  Principal: '/admin/dashboard', HeadTeacher: '/admin/dashboard',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const { login, loginWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  // Auto-advance slides
  useEffect(() => {
    const timer = setInterval(() => {
      setTransitioning(true);
      setTimeout(() => {
        setSlideIndex(i => (i + 1) % SLIDES.length);
        setTransitioning(false);
      }, 600);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate(ROLE_ROUTES[user.role] || '/student/home');
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const userData = await login(email, password);
      navigate(ROLE_ROUTES[userData.role] || '/student/home');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password. Please try again.');
    }
    setIsLoading(false);
  };

  const goToSlide = (i) => {
    if (i === slideIndex) return;
    setTransitioning(true);
    setTimeout(() => { setSlideIndex(i); setTransitioning(false); }, 300);
  };

  const current = SLIDES[slideIndex];

  return (
    <>
    <PWAInstallPrompt />
    <div className="min-h-screen flex" data-testid="login-page">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col">

        {/* Slide images */}
        {SLIDES.map((slide, i) => (
          <img
            key={slide.image}
            src={slide.image}
            alt="RightWay Learning Centre"
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            style={{ opacity: i === slideIndex && !transitioning ? 1 : 0 }}
          />
        ))}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#044875]/80 via-[#044875]/50 to-[#044875]/90" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-12 py-10">

          {/* Logo + name */}
          <div className="flex items-center gap-3">
            <img
              src="/main_logo.png"
              alt="The RightWay Centre of Learning"
              className="h-14 w-14 object-contain bg-white rounded-2xl p-1.5 shadow-lg"
            />
            <div>
              <div className="text-white font-bold text-base leading-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
                The RightWay Centre of Learning
              </div>
              <div className="text-[#c1e5e6] text-[11px] uppercase tracking-widest">Management Workstation</div>
            </div>
          </div>

          {/* Centre content */}
          <div className="flex-1 flex flex-col items-start justify-center max-w-lg">
            {/* Tag pill */}
            <div
              key={slideIndex + '-tag'}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[#044875] text-xs font-bold mb-6 shadow-md"
              style={{ background: '#f8d904', animation: 'fadeInUp 0.5s ease both' }}
            >
              ✦ {current.tag}
            </div>

            {/* Quote */}
            <blockquote
              key={slideIndex + '-quote'}
              className="text-white text-3xl font-extrabold leading-snug mb-8"
              style={{ fontFamily: 'Outfit, sans-serif', animation: 'fadeInUp 0.5s ease 0.1s both' }}
            >
              "{current.quote}"
            </blockquote>

            {/* Stats row */}
            <div className="flex items-center gap-8">
              {STATS.map(({ icon: Icon, value, label }) => (
                <div key={label} className="text-center">
                  <div className="text-[#f8d904] text-2xl font-extrabold" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</div>
                  <div className="text-white/60 text-xs mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: slide dots + aligned with Ministry badge */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={`h-2 rounded-full transition-all duration-400 ${
                    i === slideIndex ? 'w-8 bg-[#f8d904]' : 'w-2 bg-white/30 hover:bg-white/60'
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
            <div className="text-white/40 text-[11px]">
              Ministry of Education, Trinidad & Tobago aligned
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-[#F8FAFC]">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/main_logo.png" alt="RightWay" className="h-12 w-12 object-contain" />
            <div>
              <div className="text-[#044875] font-bold text-sm" style={{ fontFamily: 'Outfit, sans-serif' }}>
                The RightWay Centre of Learning
              </div>
              <div className="text-[#6B7280] text-xs">Management Workstation</div>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-[#1A1A2E] mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Welcome back
            </h1>
            <p className="text-[#6B7280] text-sm">Sign in to your workstation account to continue</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2" data-testid="login-error">
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-[#1A1A2E] mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@rightway.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                data-testid="login-email-input"
                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm text-[#1A1A2E] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#044875]/30 focus:border-[#044875] transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-semibold text-[#1A1A2E]">
                  Password
                </label>
                <button type="button" className="text-xs text-[#044875] hover:underline font-medium">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  data-testid="login-password-input"
                  className="w-full h-12 px-4 pr-11 rounded-xl border border-gray-200 bg-white text-sm text-[#1A1A2E] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#044875]/30 focus:border-[#044875] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#044875] transition-colors"
                  data-testid="toggle-password-btn"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              data-testid="login-submit-btn"
              className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              style={{ background: isLoading ? '#044875' : 'linear-gradient(135deg, #044875, #0a6aad)', color: '#fff' }}
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or continue with</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google */}
          <button
            onClick={loginWithGoogle}
            data-testid="google-login-btn"
            className="w-full h-12 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-[#1A1A2E] flex items-center justify-center gap-3 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Footer note */}
          <p className="text-center text-xs text-gray-400 mt-8 leading-relaxed">
            This portal is for staff, students, and parents of<br />
            <span className="font-semibold text-[#044875]">The RightWay Centre of Learning</span>
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
