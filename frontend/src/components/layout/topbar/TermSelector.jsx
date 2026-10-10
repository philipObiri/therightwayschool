import React from 'react';
import { Calendar, CheckCircle } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '../../ui/dropdown-menu';
import { useTerm } from '../../../contexts/TermContext';
import { toast } from 'sonner';

export function TermSelector({ user }) {
  const { activeTerm, academicYear, changeTerm } = useTerm();
  const canChange = ['CEO', 'Principal', 'HeadTeacher', 'Admin', 'SuperAdmin'].includes(user?.role);

  if (canChange) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 bg-[#C5A55A]/10 border border-[#C5A55A]/30 rounded-md px-2 py-1.5 hover:bg-[#C5A55A]/20 transition-colors" data-testid="term-selector">
            <Calendar className="w-3.5 h-3.5 text-[#C5A55A]" />
            <span className="text-xs font-semibold text-[#1B2A4A] hidden sm:inline">{activeTerm}</span>
            <span className="text-[10px] text-slate-400 hidden lg:inline">{academicYear}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {['Term 1', 'Term 2', 'Term 3'].map(t => (
            <DropdownMenuItem key={t} onClick={() => { changeTerm(t); toast.success(`Active term changed to ${t}`); }} className={`cursor-pointer ${activeTerm === t ? 'bg-[#C5A55A]/10 font-semibold' : ''}`} data-testid={`set-term-${t.replace(' ', '-')}`}>
              <Calendar className="w-3.5 h-3.5 mr-2" /> {t} {activeTerm === t && <CheckCircle className="w-3 h-3 ml-auto text-[#C5A55A]" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {['2024-2025', '2025-2026', '2026-2027'].map(y => (
            <DropdownMenuItem key={y} onClick={() => { changeTerm(activeTerm, y); toast.success(`Academic year changed to ${y}`); }} className={`cursor-pointer text-xs ${academicYear === y ? 'bg-slate-50 font-semibold' : ''}`}>
              {y} {academicYear === y && <CheckCircle className="w-3 h-3 ml-auto text-[#2E6CC4]" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex items-center gap-1.5 bg-slate-50 rounded-md px-2 py-1.5">
      <Calendar className="w-3.5 h-3.5 text-[#C5A55A]" />
      <span className="text-xs font-semibold text-[#1B2A4A] hidden sm:inline">{activeTerm}</span>
      <span className="text-[10px] text-slate-400 hidden lg:inline">{academicYear}</span>
    </div>
  );
}
