import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { AppLoader } from '../../components/AppLoader';
import { useNavigate } from 'react-router-dom';
import {
  Package, ShoppingCart, Users, DollarSign, Calendar, ArrowRight,
  AlertTriangle, Clock, Shirt, MessageSquare
} from 'lucide-react';

export default function ReceptionistDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/receptionist/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <AppLoader />;

  const stats = [
    { label: 'Today Payments', value: data?.today_payments || 0, icon: DollarSign, color: 'bg-[#C5A55A]/10 text-[#C5A55A]', link: null },
    { label: 'Pending Procurement', value: data?.pending_procurement || 0, icon: ShoppingCart, color: 'bg-blue-50 text-[#2E6CC4]', link: '/receptionist/procurement' },
    { label: 'Low Stock Items', value: data?.low_stock_count || 0, icon: AlertTriangle, color: data?.low_stock_count > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600', link: '/receptionist/inventory' },
    { label: 'Total Inventory', value: data?.total_inventory || 0, icon: Package, color: 'bg-slate-50 text-slate-600', link: '/receptionist/inventory' },
  ];

  return (
    <div className="space-y-8" data-testid="receptionist-dashboard">
      {/* Hero */}
      <div className="relative w-full rounded-2xl bg-[#1B2A4A] overflow-hidden shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B2A4A] via-[#1B2A4A]/90 to-[#C5A55A]/10" />
        <div className="relative z-10 flex items-center justify-between px-6 md:px-10 py-8 md:py-10">
          <div>
            <p className="text-[#C5A55A] text-sm md:text-base font-semibold tracking-wide mb-1">Reception Desk</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Welcome, {user?.name}
            </h1>
            <p className="text-slate-300 mt-2 text-xs md:text-sm flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/receptionist/billing')} className="rounded-xl bg-[#C5A55A] hover:bg-[#B09444] text-white shadow-lg h-11 px-5" data-testid="quick-billing-btn">
              <Shirt className="w-4 h-4 mr-2" /> Uniform Billing
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div
            key={i}
            onClick={() => s.link && navigate(s.link)}
            className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden"
            data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#2E6CC4] to-[#C5A55A] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-[#1B2A4A]" style={{ fontFamily: 'DM Sans, sans-serif' }}>{s.value}</p>
            <p className="text-xs text-slate-500 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Low Stock Alert */}
      {(data?.low_stock_items || []).length > 0 && (
        <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4" data-testid="low-stock-alert">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Low Stock Alert</p>
              <p className="text-xs text-amber-600">{data.low_stock_items.map(i => `${i.name} (${i.quantity} left)`).join(', ')}</p>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => navigate('/receptionist/inventory')} data-testid="view-low-stock">
              View <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Uniform Billing', icon: Shirt, path: '/receptionist/billing', color: 'bg-[#C5A55A]/10 text-[#C5A55A]' },
          { label: 'Inventory', icon: Package, path: '/receptionist/inventory', color: 'bg-blue-50 text-[#2E6CC4]' },
          { label: 'Procurement', icon: ShoppingCart, path: '/receptionist/procurement', color: 'bg-amber-50 text-amber-600' },
          { label: 'Parent Messages', icon: MessageSquare, path: '/receptionist/messages', color: 'bg-green-50 text-green-600' },
        ].map((a, i) => (
          <div
            key={i}
            onClick={() => navigate(a.path)}
            className="bg-white rounded-xl border border-slate-200/60 p-5 flex flex-col items-center gap-3 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all group"
            data-testid={`quick-${a.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${a.color}`}>
              <a.icon className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-[#1B2A4A]">{a.label}</span>
          </div>
        ))}
      </div>

      {/* Recent Payments */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold" style={{ fontFamily: 'DM Sans, sans-serif' }}>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.recent_payments || []).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No recent payments</p>
          ) : (
            <div className="space-y-2">
              {(data?.recent_payments || []).slice(0, 5).map((p) => (
                <div key={p.payment_id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 text-sm">
                  <div className="w-9 h-9 rounded-lg bg-[#C5A55A]/10 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-[#C5A55A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1B2A4A] truncate">{p.student_name || p.payer_name}</p>
                    <p className="text-xs text-slate-400">{p.method} &middot; {p.reference}</p>
                  </div>
                  <span className="font-bold text-[#1B2A4A]">TT$ {(p.amount || 0).toLocaleString()}</span>
                  <Badge className={`text-[10px] ${p.status === 'allocated' || p.status === 'matched' ? 'bg-green-100 text-green-700' : p.status === 'reversed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
