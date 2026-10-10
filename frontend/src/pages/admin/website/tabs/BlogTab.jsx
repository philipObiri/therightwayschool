import React, { useState, useEffect } from "react";
import { Plus, Trash2, Save, Eye } from "lucide-react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import api from "@/lib/api";
import { toast } from "sonner";

const EMPTY = { title: "", slug: "", excerpt: "", category: "", author: "", date: "", image: "", body: "", published: false };

export default function BlogTab() {
  const [posts, setPosts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/website/blog").then((r) => setPosts(r.data || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing("new"); setForm({ ...EMPTY, date: new Date().toISOString().split("T")[0] }); };
  const openEdit = (p) => { setEditing(p.id); setForm(p); };

  const handleSave = async (publish = false) => {
    setSaving(true);
    try {
      const payload = { ...form, published: publish || form.published };
      if (editing === "new") await api.post("/website/blog", payload);
      else await api.put(`/website/blog/${editing}`, payload);
      toast.success(publish ? "Published!" : "Saved as draft"); setEditing(null); load();
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this post?")) return;
    await api.delete(`/website/blog/${id}`).catch(() => {});
    load();
  };

  if (editing) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-[#1A1A2E]">{editing === "new" ? "New Post" : "Edit Post"}</h4>
          <button onClick={() => setEditing(null)} className="text-sm text-[#6B7280] hover:text-[#1A1A2E]">← Back</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { key: "title", label: "Title" },
            { key: "slug", label: "URL Slug (e.g. my-post-title)" },
            { key: "category", label: "Category" },
            { key: "author", label: "Author" },
            { key: "date", label: "Date" },
            { key: "image", label: "Cover Image URL" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-[#1A1A2E] mb-1">{label}</label>
              <input type="text" value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#2A7A5A]/30 focus:border-[#2A7A5A]" />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1A1A2E] mb-1">Excerpt</label>
          <textarea rows={2} value={form.excerpt || ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2A7A5A]/30 focus:border-[#2A7A5A]" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1A1A2E] mb-2">Body</label>
          <ReactQuill theme="snow" value={form.body || ""} onChange={(v) => setForm({ ...form, body: v })}
            className="bg-white rounded-xl border border-[#E5E7EB]" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={() => handleSave(false)} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 border border-[#2A7A5A] text-[#2A7A5A] text-sm font-semibold rounded-xl hover:bg-[#F0F7F4] transition-colors disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Draft"}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#2A7A5A] text-white text-sm font-semibold rounded-xl hover:bg-[#235f47] transition-colors disabled:opacity-60">
            <Eye className="w-4 h-4" /> Publish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[#6B7280]">Manage blog articles shown on the public website.</p>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-[#2A7A5A] text-white text-sm font-semibold rounded-xl hover:bg-[#235f47] transition-colors">
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>
      {posts.map((p) => (
        <div key={p.id} className="flex items-center gap-4 bg-white rounded-xl p-4 border border-[#E5E7EB] shadow-sm">
          {p.image && <img src={p.image} alt="" className="w-16 h-10 object-cover rounded-lg flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-[#1A1A2E] truncate">{p.title}</div>
            <div className="text-xs text-[#6B7280]">{p.date} · {p.category} · {p.published ? <span className="text-[#2A7A5A] font-semibold">Published</span> : <span className="text-[#F4A261]">Draft</span>}</div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => openEdit(p)} className="px-3 py-1.5 text-xs font-semibold text-[#2A7A5A] border border-[#2A7A5A] rounded-lg hover:bg-[#F0F7F4] transition-colors">Edit</button>
            <button onClick={() => handleDelete(p.id)} className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
