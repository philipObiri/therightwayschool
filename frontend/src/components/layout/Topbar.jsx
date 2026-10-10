import React from 'react';
import { Menu } from 'lucide-react';
import { SearchBar } from './topbar/SearchBar';
import { NotificationDropdown } from './topbar/NotificationDropdown';
import { TermSelector } from './topbar/TermSelector';
import { UserMenu } from './topbar/UserMenu';

export default function Topbar({ onMenuToggle, user }) {
  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 md:px-8 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 shadow-[0_4px_24px_-8px_rgba(27,42,74,0.06)]" data-testid="topbar">
      {/* Left side */}
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
          data-testid="menu-toggle-btn"
        >
          <Menu className="w-5 h-5 text-slate-500" />
        </button>
        <SearchBar />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-3">
        <TermSelector user={user} />
        <NotificationDropdown user={user} />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
