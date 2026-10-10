import React, { useState, useEffect } from "react";
import { Save } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

const FIELDS = [
  { key: "name", label: "School Name", type: "text" },
  { key: "tagline", label: "Tagline", type: "text" },
  { key: "phone", label: "Phone Number", type: "tel" },
  { key: "whatsapp", label: "WhatsApp Number (no spaces/dashes)", type: "tel" },
  { key: "email", label: "Email Address", type: "email" },
  { key: "address", label: "Physical Address", type: "text" },
  { key: "established", label: "Year Established", type: "text" },
  { key: "facebook", label: "Facebook URL", type: "url" },
  { key: "instagram", label: "Instagram URL", type: "url" },
  { key: "youtube", label: "YouTube URL", type: "url" },
  { key: "meta_description", label: "SEO Meta Description (150 chars)", type: "textarea" },
];

export default function SiteSettingsTab() {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/website/settings").then((r) => setForm(r.data || {})).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/website/settings", form);
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-[#F0F7F4] rounded-xl p-4 border border-[#84C4A0]/30 text-sm text-[#2A7A5A]">
        Changes here update the public website in real-time — phone number, WhatsApp, social links, and SEO tags.
      </div>

      {FIELDS.map(({ key, label, type }) => (
        <div key={key}>
          <label className="block text-xs font-semibold text-[#1A1A2E] mb-1.5">{label}</label>
          {type === "textarea" ? (
            <textarea
              rows={3}
              value={form[key] || ""}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              maxLength={160}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2A7A5A]/30 focus:border-[#2A7A5A]"
            />
          ) : (
            <input
              type={type}
              value={form[key] || ""}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#2A7A5A]/30 focus:border-[#2A7A5A]"
            />
          )}
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#2A7A5A] text-white font-semibold rounded-xl hover:bg-[#235f47] transition-colors disabled:opacity-60"
      >
        <Save className="w-4 h-4" />
        {saving ? "Saving…" : "Save Settings"}
      </button>
    </div>
  );
}
