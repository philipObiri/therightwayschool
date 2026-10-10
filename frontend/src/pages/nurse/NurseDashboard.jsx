import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { AppLoader } from '../../components/AppLoader';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Users, HeartPulse, Pill, AlertTriangle, Clock, Calendar,
  ArrowRight, Stethoscope, Thermometer, BedDouble
} from 'lucide-react';

export default function NurseDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/sick-bay/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <AppLoader />;

  const stats = [
    { label: 'Active Patients', value: data?.active_admissions || 0, icon: BedDouble, color: 'bg-red-50 text-red-600', link: '/nurse/admissions' },
    { label: 'Today Admitted', value: data?.today_admissions || 0, icon: HeartPulse, color: 'bg-blue-50 text-[#2E6CC4]', link: '/nurse/admissions' },
    { label: 'Today Discharged', value: data?.today_discharged || 0, icon: Activity, color: 'bg-[#C5A55A]/10 text-[#C5A55A]', link: '/nurse/admissions' },
    { label: 'Total Records', value: data?.total_records || 0, icon: Stethoscope, color: 'bg-slate-50 text-slate-600', link: '/nurse/admissions' },
    { label: 'Low Stock Meds', value: data?.low_stock_meds || 0, icon: Pill, color: data?.low_stock_meds > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600', link: '/nurse/inventory' },
  ];

  return (
    <div className="space-y-8" data-testid="nurse-dashboard">
      {/* Hero Banner */}
      <div className="relative w-full rounded-2xl bg-[#1B2A4A] overflow-hidden shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B2A4A] via-[#1B2A4A]/90 to-[#2E6CC4]/20" />
        <div className="relative z-10 flex items-center justify-between px-6 md:px-10 py-8 md:py-10">
          <div>
            <p className="text-[#C5A55A] text-sm md:text-base font-semibold tracking-wide mb-1">Sick Bay</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight" style={{ fontFamily: 'DM Sans, sans-serif' }}>
              Welcome, {user?.name}
            </h1>
            <p className="text-slate-300 mt-2 text-xs md:text-sm flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <Button
            onClick={() => navigate('/nurse/emergency')}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg h-11 px-6"
            data-testid="emergency-btn"
          >
            <AlertTriangle className="w-4 h-4 mr-2" /> Emergency
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

      {/* Active Patients Warning */}
      {(data?.active_admissions || 0) > 0 && (
        <div className="rounded-lg border-l-4 border-red-400 bg-gradient-to-r from-red-50 to-rose-50 p-4" data-testid="active-patients-alert">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <BedDouble className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1B2A4A]">{data.active_admissions} student{data.active_admissions !== 1 ? 's' : ''} currently in sick bay</p>
                <p className="text-xs text-slate-500">Requires monitoring and attention</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/nurse/admissions')} data-testid="view-active-btn">
              View <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Recent Admissions */}
      <Card className="rounded-xl border-slate-200/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold" style={{ fontFamily: 'DM Sans, sans-serif' }}>Recent Admissions</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/nurse/admissions')} data-testid="view-all-admissions-btn">
            View All <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {(data?.recent_admissions || []).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No recent admissions</p>
          ) : (
            <div className="space-y-3">
              {(data?.recent_admissions || []).slice(0, 6).map((a) => (
                <div key={a.admission_id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors" data-testid={`admission-${a.admission_id}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    a.status === 'discharged' ? 'bg-green-100' :
                    a.status === 'referred_to_hospital' ? 'bg-red-100' :
                    'bg-amber-100'
                  }`}>
                    {a.status === 'discharged' ? <Activity className="w-4 h-4 text-green-600" /> :
                     a.status === 'referred_to_hospital' ? <AlertTriangle className="w-4 h-4 text-red-600" /> :
                     <Thermometer className="w-4 h-4 text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1B2A4A] truncate">{a.student_name}</p>
                    <p className="text-xs text-slate-400">{a.reason || 'No reason specified'} &middot; {a.year_group}</p>
                  </div>
                  <Badge className={`text-[10px] ${
                    a.status === 'discharged' ? 'bg-green-100 text-green-700' :
                    a.status === 'admitted' ? 'bg-amber-100 text-amber-700' :
                    a.status === 'under_observation' ? 'bg-blue-100 text-blue-700' :
                    a.status === 'resting' ? 'bg-purple-100 text-purple-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {(a.status || '').replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {a.admitted_at ? new Date(a.admitted_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
