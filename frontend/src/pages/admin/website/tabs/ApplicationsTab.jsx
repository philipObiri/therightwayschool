import React, { useState, useEffect } from "react";
import {
  FileText, RefreshCw, Eye, CheckCircle, XCircle, Clock,
  Search, ChevronDown, ChevronUp, Download, Phone, Mail, Calendar
} from "lucide-react";
import api from "@/lib/api";

const STATUS_CONFIG = {
  pending: { label: "Pending Review", color: "#FFD93D", bg: "#FFF9E6", icon: Clock },
  reviewed: { label: "Under Review", color: "#044875", bg: "#E8F4FD", icon: Eye },
  accepted: { label: "Accepted", color: "#22C55E", bg: "#F0FDF4", icon: CheckCircle },
  rejected: { label: "Declined", color: "#EF4444", bg: "#FEF2F2", icon: XCircle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function ApplicationCard({ app, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);

  const changeStatus = async (newStatus) => {
    setUpdating(true);
    try {
      await api.put(`/website/admissions-applications/${app._id}`, { status: newStatus });
      onStatusChange(app._id, newStatus);
    } catch {
      // silent
    } finally {
      setUpdating(false);
    }
  };

  const child = `${app.child_first_name || ""} ${app.child_family_name || ""}`.trim() || "Unnamed";
  const parent = app.declaration_name || app.mother_name || app.father_name || "—";
  const submitted = app.created_at ? new Date(app.created_at).toLocaleDateString("en-TT", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <div className="border border-[#E5E7EB] rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200">
      {/* Summary row */}
      <div className="flex items-center gap-4 px-5 py-4 bg-white">
        <div className="w-10 h-10 rounded-xl bg-[#044875]/10 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-[#044875]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[#1A1A2E] text-sm truncate">{child}</div>
          <div className="text-xs text-[#6B7280] flex items-center gap-3 mt-0.5 flex-wrap">
            <span>{app.class_sought || "Class not specified"}</span>
            <span>·</span>
            <span>Parent: {parent}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {submitted}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <StatusBadge status={app.status || "pending"} />
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-8 h-8 rounded-lg bg-[#F5F5F5] flex items-center justify-center text-[#6B7280] hover:bg-[#E5E7EB] transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-[#E5E7EB] bg-[#FBF8F3] px-5 py-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            <InfoBlock label="Child's Full Name" value={child} />
            <InfoBlock label="Date of Birth" value={app.dob || "—"} />
            <InfoBlock label="Gender" value={app.gender || "—"} />
            <InfoBlock label="Class Sought" value={app.class_sought || "—"} />
            <InfoBlock label="Nationality" value={app.nationality || "—"} />
            <InfoBlock label="Languages at Home" value={[app.language_1, app.language_2].filter(Boolean).join(", ") || "—"} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <InfoBlock label="Home Address" value={app.address || "—"} />
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Contact</p>
              {app.phone_mobile && (
                <a href={`tel:${app.phone_mobile}`} className="flex items-center gap-1.5 text-sm text-[#044875] hover:underline mb-1">
                  <Phone className="w-3.5 h-3.5" />{app.phone_mobile}
                </a>
              )}
              {(app.father_email || app.mother_email) && (
                <a href={`mailto:${app.father_email || app.mother_email}`}
                  className="flex items-center gap-1.5 text-sm text-[#044875] hover:underline">
                  <Mail className="w-3.5 h-3.5" />{app.father_email || app.mother_email}
                </a>
              )}
            </div>
          </div>

          {app.medical_conditions && app.medical_conditions !== "None" && (
            <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-red-600 mb-1">⚠️ Medical Conditions</p>
              <p className="text-sm text-red-800">{app.medical_conditions}</p>
            </div>
          )}
          {app.allergies && app.allergies !== "None" && (
            <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-amber-600 mb-1">⚠️ Allergies</p>
              <p className="text-sm text-amber-800">{app.allergies}</p>
            </div>
          )}

          {/* Status actions */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-[#E5E7EB]">
            <p className="w-full text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Update Status</p>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const isActive = (app.status || "pending") === key;
              return (
                <button
                  key={key}
                  disabled={updating || isActive}
                  onClick={() => changeStatus(key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
                  style={{
                    backgroundColor: isActive ? cfg.bg : "white",
                    color: isActive ? cfg.color : "#6B7280",
                    borderColor: isActive ? cfg.color + "50" : "#E5E7EB",
                    opacity: updating ? 0.6 : 1,
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-[#1A1A2E]">{value}</p>
    </div>
  );
}

export default function ApplicationsTab() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/website/admissions-applications");
      setApps(Array.isArray(res.data) ? res.data : []);
    } catch {
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleStatusChange = (id, newStatus) => {
    setApps((prev) => prev.map((a) => a._id === id ? { ...a, status: newStatus } : a));
  };

  const filtered = apps.filter((a) => {
    const matchFilter = filter === "all" || (a.status || "pending") === filter;
    const name = `${a.child_first_name} ${a.child_family_name} ${a.declaration_name}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    all: apps.length,
    pending: apps.filter((a) => !a.status || a.status === "pending").length,
    reviewed: apps.filter((a) => a.status === "reviewed").length,
    accepted: apps.filter((a) => a.status === "accepted").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by child or parent name..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/20 focus:border-[#044875]"
          />
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#6B7280] hover:bg-[#F5F5F5] transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: "all", label: "All" },
          { key: "pending", label: "Pending" },
          { key: "reviewed", label: "Under Review" },
          { key: "accepted", label: "Accepted" },
          { key: "rejected", label: "Declined" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              filter === key
                ? "bg-[#044875] text-white border-[#044875]"
                : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#044875] hover:text-[#044875]"
            }`}
          >
            {label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === key ? "bg-white/20" : "bg-[#E5E7EB]"}`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Applications list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[#F5F5F5] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="font-bold text-[#1A1A2E] mb-1">No Applications Yet</h3>
          <p className="text-[#6B7280] text-sm">
            {search || filter !== "all"
              ? "No applications match your current filter."
              : "Online admissions applications submitted via the website will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <ApplicationCard key={app._id} app={app} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
