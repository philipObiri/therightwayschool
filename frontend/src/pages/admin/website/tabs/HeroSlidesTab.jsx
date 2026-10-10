import React, { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

const EMPTY = { image: "", heading: "", subheading: "", cta1_label: "", cta1_href: "#admissions", cta2_label: "", cta2_href: "#contact", order: 0 };

export default function HeroSlidesTab() {
  const [slides, setSlides] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/website/hero").then((r) => setSlides(r.data || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing("new"); setForm(EMPTY); };
  const openEdit = (s) => { setEditing(s.id); setForm(s); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing === "new") await api.post("/website/hero", form);
      else await api.put(`/website/hero/${editing}`, form);
      toast.success("Saved"); setEditing(null); load();
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this slide?")) return;
    await api.delete(`/website/hero/${id}`).catch(() => {});
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[#6B7280]">Hero slides auto-rotate every 5 seconds on the public website.</p>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-[#2A7A5A] text-white text-sm font-semibold rounded-xl hover:bg-[#235f47] transition-colors">
          <Plus className="w-4 h-4" /> Add Slide
        </button>
      </div>

      {slides.map((s) => (
        <div key={s.id} className="flex items-center gap-4 bg-white rounded-xl p-4 border border-[#E5E7EB] shadow-sm">
          <GripVertical className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
          {s.image && <img src={s.image} alt="" className="w-16 h-10 object-cover rounded-lg flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-[#1A1A2E] truncate">{s.heading || "(no heading)"}</div>
            <div className="text-xs text-[#6B7280] truncate">{s.image}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => openEdit(s)} className="px-3 py-1.5 text-xs font-semibold text-[#2A7A5A] border border-[#2A7A5A] rounded-lg hover:bg-[#F0F7F4] transition-colors">Edit</button>
            <button onClick={() => handleDelete(s.id)} className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}

      {/* Edit form */}
      {editing && (
        <div className="bg-[#FBF8F3] rounded-2xl p-6 border border-[#E5E7EB] space-y-4">
          <h4 className="font-bold text-[#1A1A2E]">{editing === "new" ? "New Slide" : "Edit Slide"}</h4>
          {[
            { key: "image", label: "Image URL or /kids/filename.jpg" },
            { key: "heading", label: "Heading" },
            { key: "subheading", label: "Sub-heading" },
            { key: "cta1_label", label: "Button 1 Label" },
            { key: "cta1_href", label: "Button 1 Link (#section-id)" },
            { key: "cta2_label", label: "Button 2 Label" },
            { key: "cta2_href", label: "Button 2 Link (#section-id)" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-[#1A1A2E] mb-1">{label}</label>
              <input type="text" value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#2A7A5A]/30 focus:border-[#2A7A5A]" />
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#2A7A5A] text-white text-sm font-semibold rounded-xl hover:bg-[#235f47] transition-colors disabled:opacity-60">
              <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-semibold text-[#6B7280] border border-[#E5E7EB] rounded-xl hover:bg-white transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
