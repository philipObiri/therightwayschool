import React, { useRef, useState, useEffect } from "react";
import { CalendarDays, FileText, Users, Backpack, Send } from "lucide-react";
import { ADMISSIONS_STEPS } from "../data/placeholder-data";
import api from "@/lib/api";

function useScrollReveal() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);
  return visible;
}

const STEP_ICONS = [CalendarDays, FileText, Users, Backpack];

export default function AdmissionsSection({ steps: apiSteps }) {
  const steps = (apiSteps?.length ? apiSteps : ADMISSIONS_STEPS).map((s, i) => ({
    ...s,
    Icon: STEP_ICONS[i] || CheckCircle2,
  }));

  const visible = useScrollReveal();

  const [form, setForm] = useState({
    parent_name: "", email: "", phone: "",
    child_name: "", child_age: "", program: "", tour_date: "", notes: "",
  });
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required = ["parent_name", "email", "phone", "child_name", "child_age", "program"];
    if (required.some((k) => !form[k].trim())) {
      setStatus({ type: "error", text: "Please fill in all required fields." });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/website/tour-request", form);
      setStatus({ type: "success", text: "Thank you! We'll contact you within 24 hours to confirm your tour." });
      setForm({ parent_name: "", email: "", phone: "", child_name: "", child_age: "", program: "", tour_date: "", notes: "" });
    } catch {
      setStatus({ type: "error", text: "Unable to submit. Please call us directly." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="admissions" className="py-20" style={{ background: "#EFF8FF" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h2 className="text-4xl sm:text-5xl font-extrabold mb-4" style={{ fontFamily: "Outfit, sans-serif", color: "#044875" }}>
            Admissions
          </h2>
          <p className="text-[#6B7280] max-w-2xl mx-auto leading-relaxed">
            Join The RightWay Centre of Learning family. Our simple {steps.length}-step admissions process
            makes it easy to give your child the gift of an excellent education.
          </p>
        </div>

        {/* Steps â€” clean horizontal row */}
        <div className={`grid grid-cols-2 md:grid-cols-${steps.length} gap-6 mb-20 transition-all duration-700 delay-200 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          {steps.map((step, i) => {
            const Icon = step.Icon;
            return (
              <div
                key={i}
                className="flex flex-col items-center text-center"
                style={{ transitionDelay: `${i * 100 + 200}ms` }}
              >
                {/* Circle icon */}
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-md"
                  style={{ background: "#2A7A5A" }}>
                  <Icon className="w-9 h-9 text-white" strokeWidth={1.5} />
                </div>
                <h3 className="font-bold text-[#044875] text-sm mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
                  {step.title}
                </h3>
                <p className="text-[#6B7280] text-xs leading-relaxed max-w-[160px]">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Tour Booking Form */}
        <div className={`transition-all duration-700 delay-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-[#E5E7EB]">
            {/* Form header */}
            <div className="bg-[#044875] px-8 py-6 flex items-center gap-3">
              <CalendarDays className="w-6 h-6 text-[#f8d904]" />
              <div>
                <h3 className="text-xl font-extrabold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Schedule Your Tour Today
                </h3>
                <p className="text-white/70 text-sm">
                  Complete this form and we'll contact you within 24 hours to schedule your personalized campus tour.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-[#044875] mb-2 uppercase tracking-wide">
                    Parent/Guardian Name *
                  </label>
                  <input
                    type="text" placeholder="Full name" required
                    value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/20 focus:border-[#044875] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#044875] mb-2 uppercase tracking-wide">
                    Email Address *
                  </label>
                  <input
                    type="email" placeholder="your@email.com" required
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/20 focus:border-[#044875] transition-colors"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-[#044875] mb-2 uppercase tracking-wide">
                    Phone Number *
                  </label>
                  <input
                    type="tel" placeholder="+1 (868) 000-0000" required
                    value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/20 focus:border-[#044875] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#044875] mb-2 uppercase tracking-wide">
                    Child's Name *
                  </label>
                  <input
                    type="text" placeholder="Child's full name" required
                    value={form.child_name} onChange={(e) => setForm({ ...form, child_name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/20 focus:border-[#044875] transition-colors"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-[#044875] mb-2 uppercase tracking-wide">
                    Child's Age *
                  </label>
                  <input
                    type="text" placeholder="e.g., 4 years" required
                    value={form.child_age} onChange={(e) => setForm({ ...form, child_age: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/20 focus:border-[#044875] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#044875] mb-2 uppercase tracking-wide">
                    Programme Interest *
                  </label>
                  <select
                    required
                    value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/20 focus:border-[#044875] bg-white transition-colors"
                  >
                    <option value="">Select a programme</option>
                    <option value="nursery">Nursery (Ages 2â€“3)</option>
                    <option value="kindergarten">Kindergarten (Ages 4â€“5)</option>
                    <option value="primary">Primary (Ages 6â€“11)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#044875] mb-2 uppercase tracking-wide">
                  Preferred Tour Date
                </label>
                <input
                  type="date"
                  value={form.tour_date} onChange={(e) => setForm({ ...form, tour_date: e.target.value })}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/20 focus:border-[#044875] bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#044875] mb-2 uppercase tracking-wide">
                  Additional Questions or Comments
                </label>
                <textarea
                  rows={4} placeholder="Any questions or special requirements..."
                  value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#044875]/20 focus:border-[#044875] transition-colors"
                />
              </div>

              {status && (
                <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                  status.type === "success"
                    ? "bg-[#c1e5e6]/30 text-[#044875] border border-[#c1e5e6]"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {status.text}
                </div>
              )}

              <button
                type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-[#044875] text-sm transition-all duration-200 disabled:opacity-60 hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #f8d904, #bc9908)" }}
              >
                <Send className="w-4 h-4" />
                {submitting ? "Submittingâ€¦" : "Submit Inquiry"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}





