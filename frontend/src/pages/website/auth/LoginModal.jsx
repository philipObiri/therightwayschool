import React, { useState, useEffect } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import api from "@/lib/api";
import { useNavigate } from "react-router-dom";

export default function LoginModal({ open, onClose, onSwitchToRegister }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", form);
      localStorage.setItem("rw_token", res.data.access_token);
      localStorage.setItem("rw_user", JSON.stringify(res.data.user));
      onClose();
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Green header */}
        <div className="bg-[#2A7A5A] px-8 py-7 text-center">
          <img src="/main_logo.png" alt="RightWay Centre" className="h-16 w-auto object-contain mx-auto mb-3" />
          <h2 className="text-white font-extrabold text-xl" style={{ fontFamily: "Outfit, sans-serif" }}>
            Welcome Back
          </h2>
          <p className="text-white/70 text-sm mt-1">Sign in to your RightWay account</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1A1A2E] mb-1.5">Email Address</label>
              <input
                type="email" placeholder="your@email.com" required
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#2A7A5A]/30 focus:border-[#2A7A5A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1A1A2E] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"} placeholder="••••••••" required
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#2A7A5A]/30 focus:border-[#2A7A5A]"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#2A7A5A] transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-3 bg-[#2A7A5A] text-white font-bold rounded-xl hover:bg-[#235f47] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#6B7280]">
            Don't have an account?{" "}
            <button
              onClick={onSwitchToRegister}
              className="text-[#2A7A5A] font-semibold hover:underline"
            >
              Register
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
