/**
 * Reusable CRUD list tab for simple website CMS collections.
 * Pass `endpoint`, `fields` array, and `title`.
 */
import React, { useState, useEffect } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function GenericListTab({ endpoint, fields, title, hint }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => api.get(`/website/${endpoint}`).then((r) => setItems(r.data || [])).catch(() => {});
  useEffect(() => { load(); }, [endpoint]);

  const empty = fields.reduce((acc, f) => ({ ...acc, [f.key]: f.default ?? "" }), {});
  const openNew = () => { setEditing("new"); setForm(empty); };
  const openEdit = (item) => { setEditing(item.id); setForm(item); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing === "new") await api.post(`/website/${endpoint}`, form);
      else await api.put(`/website/${endpoint}/${editing}`, form);
      toast.success("Saved"); setEditing(null); load();
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete this ${title.toLowerCase()}?`)) return;
    await api.delete(`/website/${endpoint}/${id}`).catch(() => {});
    load(); toast.success("Deleted");
  };

  const displayField = fields[0]?.key;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        {hint && <p className="text-sm text-[#6B7280]">{hint}</p>}
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-[#2A7A5A] text-white text-sm font-semibold rounded-xl hover:bg-[#235f47] transition-colors ml-auto">
          <Plus className="w-4 h-4" /> Add {title}
        </button>
      </div>

      {items.length === 0 && !editing && (
        <div className="text-center py-10 text-[#6B7280] text-sm">No {title.toLowerCase()}s yet. Click "Add {title}" to create one.</div>
      )}

      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-4 bg-white rounded-xl p-4 border border-[#E5E7EB] shadow-sm">
          {item.image && <img src={item.image} alt="" className="w-12 h-10 object-cover rounded-lg flex-shrink-0" />}
          {item.icon && <span className="text-2xl flex-shrink-0">{item.icon}</span>}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-[#1A1A2E] truncate">{item[displayField] || "(untitled)"}</div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => openEdit(item)} className="px-3 py-1.5 text-xs font-semibold text-[#2A7A5A] border border-[#2A7A5A] rounded-lg hover:bg-[#F0F7F4] transition-colors">Edit</button>
            <button onClick={() => handleDelete(item.id)} className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}

      {editing && (
        <div className="bg-[#FBF8F3] rounded-2xl p-6 border border-[#E5E7EB] space-y-4">
          <h4 className="font-bold text-[#1A1A2E]">{editing === "new" ? `New ${title}` : `Edit ${title}`}</h4>
          {fields.map(({ key, label, type = "text", rows }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-[#1A1A2E] mb-1">{label}</label>
              {type === "textarea" ? (
                <textarea rows={rows || 3} value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2A7A5A]/30 focus:border-[#2A7A5A]" />
              ) : type === "number" ? (
                <input type="number" value={form[key] || 0} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#2A7A5A]/30 focus:border-[#2A7A5A]" />
              ) : (
                <input type="text" value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#2A7A5A]/30 focus:border-[#2A7A5A]" />
              )}
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
