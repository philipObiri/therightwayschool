import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../contexts/AuthContext';
import AnnouncementPopup from '../AnnouncementPopup';
import EmergencyAlertPopup from '../EmergencyAlertPopup';

export default function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user } = useAuth();
  const isStaffRole = user && !['Parent', 'Student'].includes(user.role);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]" data-testid="dashboard-layout">
      {isStaffRole && <AnnouncementPopup />}
      {isStaffRole && <EmergencyAlertPopup />}
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          data-testid="mobile-overlay"
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static z-50 h-full shadow-2xl
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        transition-transform duration-300 ease-out
      `}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onClose={() => setMobileSidebarOpen(false)}
          role={user?.role}
          user={user}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          onMenuToggle={() => setMobileSidebarOpen(true)}
          user={user}
        />
        {/* Gold accent line */}
        <div className="gold-accent-line" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
          <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 opacity-[0.03]" aria-hidden="true">
            <img src="/main_logo.png" alt="" className="w-[500px] h-[500px] object-contain select-none" />
          </div>
          <div className="max-w-7xl mx-auto relative z-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
