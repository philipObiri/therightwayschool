import React, { useState, useEffect, useRef } from "react";
import {
  Globe, Settings, Image, BookOpen, Calendar, LayoutGrid, Star,
  MessageSquare, HelpCircle, Users, Layers, FileText, X,
  ChevronRight, ChevronLeft, PlayCircle, ExternalLink
} from "lucide-react";
import SiteSettingsTab from "./tabs/SiteSettingsTab";
import HeroSlidesTab from "./tabs/HeroSlidesTab";
import BlogTab from "./tabs/BlogTab";
import TestimonialsTab from "./tabs/TestimonialsTab";
import MembersTab from "./tabs/MembersTab";
import GenericListTab from "./tabs/GenericListTab";
import ApplicationsTab from "./tabs/ApplicationsTab";

const TABS = [
  { id: "settings",      label: "Site Settings",     icon: Settings,     desc: "School name, contact info, social media links and general site details." },
  { id: "hero",          label: "Hero Slides",        icon: Image,        desc: "The large banner images and headlines that appear at the top of the home page." },
  { id: "programs",      label: "Programmes",         icon: Layers,       desc: "The three academic programme cards shown on the home page and Academics page." },
  { id: "gallery",       label: "Gallery",            icon: LayoutGrid,   desc: "Photos shown in the public gallery. Add images with captions and ordering." },
  { id: "events",        label: "Events",             icon: Calendar,     desc: "Upcoming school events displayed on the public website." },
  { id: "blog",          label: "Blog",               icon: BookOpen,     desc: "News articles and blog posts shown on the public website." },
  { id: "testimonials",  label: "Testimonials",       icon: Star,         desc: "Parent and student testimonials displayed as quotes on the website." },
  { id: "faq",           label: "FAQ",                icon: HelpCircle,   desc: "Frequently asked questions shown on the Admissions page." },
  { id: "usps",          label: "Why Us",             icon: MessageSquare, desc: "The \"Why Choose Rightway?\" highlight cards shown on the home page." },
  { id: "members",       label: "Registrations",      icon: Users,        desc: "Public registrations and interest submissions received from the website." },
  { id: "applications",  label: "Applications",       icon: FileText,     desc: "Full admissions applications submitted online via the Admissions page." },
];

const PROGRAMS_FIELDS = [
  { key: "name",        label: "Programme Name" },
  { key: "ageRange",    label: "Age Range" },
  { key: "color",       label: "Colour (hex, e.g. #044875)" },
  { key: "icon",        label: "Icon (emoji, e.g. 🎓)" },
  { key: "image",       label: "Image URL" },
  { key: "description", label: "Description", type: "textarea" },
  { key: "order",       label: "Display Order", type: "number", default: 0 },
];

const GALLERY_FIELDS = [
  { key: "src",   label: "Image URL (e.g. /kids/photo.jpg)" },
  { key: "alt",   label: "Caption / Alt Text" },
  { key: "order", label: "Display Order", type: "number", default: 0 },
];

const EVENTS_FIELDS = [
  { key: "title",       label: "Event Title" },
  { key: "date",        label: "Date (e.g. June 14, 2026)" },
  { key: "time",        label: "Time (e.g. 9:00 AM)" },
  { key: "location",    label: "Location" },
  { key: "category",    label: "Category (School Event / Academic / Sports / Ceremony)" },
  { key: "description", label: "Description", type: "textarea" },
];

const FAQ_FIELDS = [
  { key: "question", label: "Question" },
  { key: "answer",   label: "Answer", type: "textarea", rows: 4 },
  { key: "order",    label: "Display Order", type: "number", default: 0 },
];

const USP_FIELDS = [
  { key: "icon",        label: "Icon (emoji)" },
  { key: "title",       label: "Title" },
  { key: "description", label: "Description", type: "textarea" },
  { key: "order",       label: "Display Order", type: "number", default: 0 },
];

// ─── Guided Tour ──────────────────────────────────────────────────────────────

const TOUR_STEPS = [
  {
    target: "tour-header",
    title: "Welcome to Website Manager 👋",
    body: "This is where you control everything the public sees on the Rightway website. Changes go live immediately — no technical knowledge required.",
  },
  {
    target: "tour-preview",
    title: "Preview Your Website",
    body: "Click \"View Website\" at any time to see exactly what the public sees. Always check here after making changes.",
  },
  {
    target: "tour-settings",
    title: "Start with Site Settings",
    body: "This is the first place to update. Set your school name, phone number, email address, and social media links here.",
  },
  {
    target: "tour-hero",
    title: "Hero Slides (Home Page Banner)",
    body: "These are the large rotating images at the top of your home page. You can update the photos, headlines, and button text.",
  },
  {
    target: "tour-gallery",
    title: "Add Photos to the Gallery",
    body: "Upload school photos here and they will appear in the Gallery page. Add a caption for each photo to help visitors understand what they're seeing.",
  },
  {
    target: "tour-applications",
    title: "Review Admissions Applications",
    body: "When families complete the online application form, their submissions appear here. You can review details, and update the status to Pending, Under Review, Accepted, or Declined.",
  },
  {
    target: "tour-members",
    title: "Registrations & Interest Forms",
    body: "Families who submit a quick interest form (without full application) appear here. Great for building a follow-up list.",
  },
  {
    target: "tour-faq",
    title: "Update the FAQ",
    body: "Add or edit frequently asked questions. These appear on the Admissions page to help families before they apply.",
  },
  {
    target: null,
    title: "You're all set! 🎉",
    body: "You now know all the key sections. Remember: changes go live immediately, and you can always click \"View Website\" to see how things look. Happy editing!",
  },
];

const TAB_TOUR_MAP = {
  "tour-settings":     "settings",
  "tour-hero":         "hero",
  "tour-gallery":      "gallery",
  "tour-applications": "applications",
  "tour-members":      "members",
  "tour-faq":          "faq",
};

function GuidedTour({ onClose, onTabChange }) {
  const [step, setStep] = useState(0);
  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  useEffect(() => {
    if (current.target && TAB_TOUR_MAP[current.target]) {
      onTabChange(TAB_TOUR_MAP[current.target]);
    }
  }, [step]);

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose} />

      {/* Tour card — centred */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] max-w-[90vw] pointer-events-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-[#E5E7EB]">
            <div
              className="h-full bg-[#044875] transition-all duration-500"
              style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Step {step + 1} of {TOUR_STEPS.length}
              </span>
              <button onClick={onClose} className="w-7 h-7 rounded-lg bg-[#F5F5F5] flex items-center justify-center text-[#6B7280] hover:bg-[#E5E7EB] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="font-extrabold text-[#1A1A2E] text-lg mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
              {current.title}
            </h3>
            <p className="text-[#374151] text-sm leading-relaxed mb-6">
              {current.body}
            </p>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep((s) => s - 1)}
                disabled={step === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F5F5F5] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              {isLast ? (
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-[#044875] text-white hover:bg-[#0a6aac] transition-colors"
                >
                  Finish Tour ✓
                </button>
              ) : (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold bg-[#f8d904] text-[#044875] hover:bg-[#bc9908] transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab Content ──────────────────────────────────────────────────────────────

function TabContent({ tabId }) {
  switch (tabId) {
    case "settings":     return <SiteSettingsTab />;
    case "hero":         return <HeroSlidesTab />;
    case "programs":     return <GenericListTab endpoint="programs" fields={PROGRAMS_FIELDS} title="Programme" hint="Each programme appears as a card on the public website." />;
    case "gallery":      return <GenericListTab endpoint="gallery" fields={GALLERY_FIELDS} title="Photo" hint="Photos shown in the masonry gallery. Max 20 recommended. After adding, click 'View Website' to see the result." />;
    case "events":       return <GenericListTab endpoint="events" fields={EVENTS_FIELDS} title="Event" hint="Upcoming events shown on the public website in chronological order." />;
    case "blog":         return <BlogTab />;
    case "testimonials": return <TestimonialsTab />;
    case "faq":          return <GenericListTab endpoint="faq" fields={FAQ_FIELDS} title="FAQ" hint="Frequently asked questions shown on the Admissions page." />;
    case "usps":         return <GenericListTab endpoint="usps" fields={USP_FIELDS} title="USP" hint='"Why Choose Us" highlights. Add an emoji icon, title, and short description.' />;
    case "members":      return <MembersTab />;
    case "applications": return <ApplicationsTab />;
    default:             return null;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WebsiteManager() {
  const [activeTab, setActiveTab]   = useState("settings");
  const [tourOpen, setTourOpen]     = useState(false);
  const [tourSeen, setTourSeen]     = useState(() => localStorage.getItem("wm_tour_seen") === "1");
  const activeInfo                  = TABS.find((t) => t.id === activeTab);

  const startTour = () => {
    setTourOpen(true);
    localStorage.setItem("wm_tour_seen", "1");
    setTourSeen(true);
  };

  const closeTour = () => setTourOpen(false);

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      {/* Header */}
      <div id="tour-header" className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-[#044875] flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
              Website Manager
            </h1>
            <p className="text-xs text-[#6B7280]">Edit public website content · Changes go live immediately</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Guided tour button */}
            <button
              onClick={startTour}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#044875] border border-[#044875]/30 rounded-xl hover:bg-[#044875]/5 transition-colors relative"
            >
              <PlayCircle className="w-4 h-4" />
              {!tourSeen && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              )}
              Guided Tour
            </button>
            {/* View website */}
            <a
              id="tour-preview"
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#044875] border border-[#044875] rounded-xl hover:bg-[#044875] hover:text-white transition-all duration-200"
            >
              <ExternalLink className="w-4 h-4" /> View Website
            </a>
          </div>
        </div>
      </div>

      {/* New user hint */}
      {!tourSeen && (
        <div className="bg-[#044875]/5 border-b border-[#044875]/10 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <span className="text-sm text-[#044875]">
              👋 <strong>New here?</strong> Take the guided tour to learn how to update your website — no technical knowledge needed.
            </span>
            <button onClick={startTour}
              className="ml-auto flex-shrink-0 px-3 py-1.5 bg-[#044875] text-white text-xs font-bold rounded-xl hover:bg-[#0a6aac] transition-colors">
              Start Tour
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Sidebar nav */}
        <aside className="w-52 flex-shrink-0">
          <nav className="space-y-1 sticky top-6">
            {TABS.map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                id={id === "settings" ? "tour-settings" : id === "hero" ? "tour-hero" : id === "gallery" ? "tour-gallery" : id === "applications" ? "tour-applications" : id === "members" ? "tour-members" : id === "faq" ? "tour-faq" : undefined}
                onClick={() => setActiveTab(id)}
                title={desc}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left ${
                  activeTab === id
                    ? "bg-[#044875] text-white shadow-md"
                    : "text-[#6B7280] hover:bg-white hover:text-[#1A1A2E] hover:shadow-sm"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Help card */}
          <div className="mt-6 bg-white rounded-2xl p-4 border border-[#E5E7EB] text-center">
            <div className="text-2xl mb-2">💬</div>
            <p className="text-xs font-semibold text-[#1A1A2E] mb-1">Need Help?</p>
            <p className="text-[10px] text-[#6B7280] mb-3">Contact your system admin or run the guided tour again.</p>
            <button
              onClick={startTour}
              className="w-full py-1.5 text-xs font-bold text-[#044875] border border-[#044875]/30 rounded-xl hover:bg-[#044875]/5 transition-colors"
            >
              Run Tour
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Section header */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] mb-4 px-6 py-4 flex items-start gap-3">
            {activeInfo && (
              <div className="w-9 h-9 rounded-xl bg-[#044875]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <activeInfo.icon className="w-5 h-5 text-[#044875]" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-[#1A1A2E]" style={{ fontFamily: "Outfit, sans-serif" }}>
                {activeInfo?.label}
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">{activeInfo?.desc}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-6">
            <TabContent tabId={activeTab} />
          </div>
        </main>
      </div>

      {/* Guided Tour overlay */}
      {tourOpen && (
        <GuidedTour
          onClose={closeTour}
          onTabChange={(tabId) => setActiveTab(tabId)}
        />
      )}
    </div>
  );
}
