import React, { useState, useEffect } from "react";
import { X, CheckCircle } from "lucide-react";
import api from "@/lib/api";

export default function SignupModal({ open, onClose, onSwitchToLogin }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "Parent" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      await api.post("/website/register", form);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#2A7A5A] px-8 py-7 text-center">
          <img src="/main_logo.png" alt="RightWay Centre" className="h-16 w-auto object-contain mx-auto mb-3" />
          <h2 className="text-white font-extrabold text-xl" style={{ fontFamily: "Outfit, sans-serif" }}>
            Create an Account
          </h2>
          <p className="text-white/70 text-sm mt-1">Join the RightWay community</p>
        </div>

        <div className="p-8">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle className="w-16 h-16 text-[#2A7A5A] mx-auto mb-4" />
              <h3 className="font-bold text-[#1A1A2E] text-lg mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
                Registration Received!
              </h3>
              <p className="text-[#6B7280] text-sm leading-relaxed mb-6">
                Your account is pending admin approval. You'll receive an email once it's activated — usually within one business day.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-[#2A7A5A] text-white font-semibold rounded-xl hover:bg-[#235f47] transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1A1A2E] mb-1.5">Full Name</label>
                <input
                  type="text" placeholder="Your full name" required
                  value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#2A7A5A]/30 focus:border-[#2A7A5A]"
                />
              </div>
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
                <input
                  type="password" placeholder="Minimum 8 characters" required minLength={8}
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#2A7A5A]/30 focus:border-[#2A7A5A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1A1A2E] mb-1.5">I am a…</label>
                <select
                  value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#2A7A5A]/30 focus:border-[#2A7A5A] bg-white"
                >
                  <option value="Parent">Parent / Guardian</option>
                  <option value="Prospective">Prospective Parent</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full py-3 bg-[#2A7A5A] text-white font-bold rounded-xl hover:bg-[#235f47] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Registering…" : "Create Account"}
              </button>
            </form>
          )}

          {!success && (
            <div className="mt-6 text-center text-sm text-[#6B7280]">
              Already have an account?{" "}
              <button onClick={onSwitchToLogin} className="text-[#2A7A5A] font-semibold hover:underline">
                Sign In
              </button>
            </div>
          )}
        </div>

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
