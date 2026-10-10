import React from "react";
import { Phone, Mail, Facebook, Instagram, Youtube, Monitor, GraduationCap } from "lucide-react";
import { SCHOOL_INFO } from "../data/placeholder-data";

export default function PublicTopBar({ settings }) {
  const info = settings || SCHOOL_INFO;

  return (
    <div className="bg-[#044875] text-white text-xs py-2 px-4 hidden md:block">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left — contact */}
        <div className="flex items-center gap-5">
          <a href={`tel:${info.phone}`} className="flex items-center gap-1.5 hover:text-[#f8d904] transition-colors whitespace-nowrap">
            <Phone className="w-3 h-3" />
            <span>{info.phone}</span>
          </a>
          <a href={`mailto:${info.email}`} className="flex items-center gap-1.5 hover:text-[#f8d904] transition-colors whitespace-nowrap">
            <Mail className="w-3 h-3" />
            <span>{info.email}</span>
          </a>
        </div>

        {/* Right — portals + socials */}
        <div className="flex items-center gap-4">
          <a
            href="/login"
            className="flex items-center gap-1.5 font-semibold hover:text-[#f8d904] transition-colors whitespace-nowrap border-r border-white/20 pr-4"
          >
            <Monitor className="w-3 h-3" />
            Staff Workstation
          </a>
          <a
            href="/login"
            className="flex items-center gap-1.5 font-semibold hover:text-[#f8d904] transition-colors whitespace-nowrap border-r border-white/20 pr-4"
          >
            <GraduationCap className="w-3 h-3" />
            Student Portal
          </a>
          <div className="flex items-center gap-3">
            {info.facebook && (
              <a href={info.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                className="hover:text-[#f8d904] transition-colors">
                <Facebook className="w-3.5 h-3.5" />
              </a>
            )}
            {info.instagram && (
              <a href={info.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                className="hover:text-[#f8d904] transition-colors">
                <Instagram className="w-3.5 h-3.5" />
              </a>
            )}
            {info.youtube && (
              <a href={info.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube"
                className="hover:text-[#f8d904] transition-colors">
                <Youtube className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
