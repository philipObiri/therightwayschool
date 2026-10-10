import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Star } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function TestimonialsTab() {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [tab, setTab] = useState("pending");

  const loadPending = () => api.get("/website/testimonials/pending").then((r) => setPending(r.data || [])).catch(() => {});
  const loadApproved = () => api.get("/website/testimonials").then((r) => setApproved(r.data || [])).catch(() => {});

  useEffect(() => { loadPending(); loadApproved(); }, []);

  const approve = async (id) => {
    await api.put(`/website/testimonials/${id}/approve`).catch(() => {});
    toast.success("Approved"); loadPending(); loadApproved();
  };
  const reject = async (id) => {
    await api.put(`/website/testimonials/${id}/reject`).catch(() => {});
    toast.success("Rejected"); loadPending(); loadApproved();
  };

  const list = tab === "pending" ? pending : approved;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["pending", "approved"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${tab === t ? "bg-[#2A7A5A] text-white" : "border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F0F7F4]"}`}>
            {t === "pending" ? `Pending (${pending.length})` : `Approved (${approved.length})`}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <div className="text-center py-10 text-[#6B7280] text-sm">No {tab} testimonials.</div>
      )}

      {list.map((t) => (
        <div key={t.id} className="bg-white rounded-xl p-5 border border-[#E5E7EB] shadow-sm space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold text-[#1A1A2E] text-sm">{t.name}</div>
              <div className="text-xs text-[#6B7280]">{t.child}</div>
              <div className="flex gap-0.5 mt-1">
                {Array.from({ length: t.rating || 5 }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-[#F4A261] text-[#F4A261]" />
                ))}
              </div>
            </div>
            {tab === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => approve(t.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#2A7A5A] border border-[#2A7A5A] rounded-lg hover:bg-[#F0F7F4] transition-colors">
                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={() => reject(t.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-[#6B7280] leading-relaxed italic">"{t.text}"</p>
        </div>
      ))}
    </div>
  );
}
