import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, User } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function MembersTab() {
  const [regs, setRegs] = useState([]);
  const [filter, setFilter] = useState("pending");

  const load = () => api.get("/website/registrations").then((r) => setRegs(r.data || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    await api.post(`/website/registrations/${id}/approve`).catch(() => {});
    toast.success("Account created and activated"); load();
  };
  const reject = async (id) => {
    await api.post(`/website/registrations/${id}/reject`).catch(() => {});
    toast.success("Rejected"); load();
  };

  const filtered = regs.filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6B7280]">People who registered via the public website form.</p>
        <div className="flex gap-2">
          {["pending", "approved", "rejected", "all"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${filter === f ? "bg-[#2A7A5A] text-white" : "border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F0F7F4]"}`}>
              {f} {f === "pending" && `(${regs.filter((r) => r.status === "pending").length})`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-[#6B7280] text-sm">No {filter} registrations.</div>
      )}

      {filtered.map((r) => (
        <div key={r.id} className="flex items-center gap-4 bg-white rounded-xl p-4 border border-[#E5E7EB] shadow-sm">
          <div className="w-10 h-10 rounded-full bg-[#F0F7F4] flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-[#2A7A5A]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-[#1A1A2E]">{r.full_name}</div>
            <div className="text-xs text-[#6B7280]">{r.email} · {r.role} · {r.created_at?.split("T")[0]}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.status === "pending" ? "bg-[#FFF8F0] text-[#F4A261]" : r.status === "approved" ? "bg-[#F0F7F4] text-[#2A7A5A]" : "bg-red-50 text-red-600"}`}>
              {r.status}
            </span>
            {r.status === "pending" && (
              <>
                <button onClick={() => approve(r.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#2A7A5A] border border-[#2A7A5A] rounded-lg hover:bg-[#F0F7F4] transition-colors">
                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={() => reject(r.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
