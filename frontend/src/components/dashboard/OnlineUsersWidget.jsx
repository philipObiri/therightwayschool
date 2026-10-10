import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle, MessageSquare, Users } from 'lucide-react';
import api from '../../lib/api';

const roleColors = {
  CEO: '#C5A55A', Principal: '#C5A55A', Founder: '#C5A55A',
  SuperAdmin: '#2E6CC4', Admin: '#2E6CC4', HeadTeacher: '#2E6CC4',
  Teacher: '#4B87D6', HeadOfAcademics: '#4B87D6',
  FinanceOfficer: '#F59E0B', Student: '#64748B', Parent: '#64748B',
};

export function OnlineUsersWidget() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const intervalRef = useRef(null);

  const load = async () => {
    try {
      const res = await api.get('/chat/online/users');
      if (Array.isArray(res.data)) setUsers(res.data);
    } catch { /* silent */ }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 15000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const handleClick = (userId) => {
    navigate(`/messenger?user=${userId}`);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-[0_2px_10px_rgba(27,42,74,0.02)]" data-testid="online-users-widget">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1B2A4A]/5 flex items-center justify-center">
            <Users className="w-4 h-4 text-[#1B2A4A]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#1B2A4A]" style={{ fontFamily: 'Outfit, sans-serif' }}>Online Now</h3>
            <p className="text-[10px] text-slate-400">{users.length} {users.length === 1 ? 'person' : 'people'} active</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C5A55A] opacity-50" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#C5A55A]" />
          </span>
          <span className="text-xs font-bold text-[#C5A55A]">{users.length}</span>
        </div>
      </div>

      {/* Users list */}
      <div className="max-h-[280px] overflow-y-auto">
        {users.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <Users className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-sm text-slate-400">No one else is online</p>
            <p className="text-[10px] text-slate-300 mt-1">Users appear here when they log in</p>
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u.user_id}
              onClick={() => handleClick(u.user_id)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/80 cursor-pointer transition-all duration-200 group border-b border-slate-50 last:border-0"
              data-testid={`online-user-${u.user_id}`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {u.picture ? (
                  <img src={u.picture} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ backgroundColor: roleColors[u.role] || '#64748B' }}>
                    {u.name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#C5A55A] border-2 border-white rounded-full" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#1B2A4A] truncate">{u.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{u.role}{u.department ? ` — ${u.department}` : ''}</p>
              </div>

              {/* Chat icon on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <div className="w-7 h-7 rounded-lg bg-[#2E6CC4]/10 flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-[#2E6CC4]" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
