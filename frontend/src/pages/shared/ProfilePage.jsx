import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { User, Save, Mail, Phone, Building, Shield } from 'lucide-react';
import api from '../../lib/api';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, checkAuth } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/auth/users/${user.user_id}`, { name, phone });
      toast.success('Profile updated');
      // Refresh user data
      await checkAuth();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update'); }
    setSaving(false);
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl" data-testid="profile-page">
      <h1 className="text-2xl font-bold text-[#1B2A4A]">My Profile</h1>

      {/* Profile header */}
      <div className="bg-white rounded-md border border-slate-200 p-6 flex items-center gap-5">
        <div className="w-20 h-20 rounded-md bg-[#2E6CC4] flex items-center justify-center text-white text-3xl font-bold">
          {name?.charAt(0) || '?'}
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1B2A4A]">{name}</h2>
          <div className="flex gap-2 mt-1">
            <Badge className="bg-blue-100 text-blue-700">{user.role?.replace(/_/g, ' ')}</Badge>
            {user.department && <Badge variant="secondary">{user.department}</Badge>}
          </div>
          <p className="text-xs text-slate-400 mt-1">{user.email}</p>
        </div>
      </div>

      {/* Edit form */}
      <Card className="rounded-md border-slate-200">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-5 h-5 text-[#2E6CC4]" /> Personal Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="rounded-md" data-testid="profile-name-input" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user.email} disabled className="rounded-md bg-slate-50" />
            <p className="text-[10px] text-slate-400">Email cannot be changed</p>
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+233..." className="rounded-md" data-testid="profile-phone-input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-md p-3"><p className="text-[10px] text-slate-500">Role</p><p className="text-sm font-medium">{user.role?.replace(/_/g, ' ')}</p></div>
            <div className="bg-slate-50 rounded-md p-3"><p className="text-[10px] text-slate-500">Department</p><p className="text-sm font-medium">{user.department || '-'}</p></div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="rounded-md bg-[#2E6CC4]" data-testid="save-profile-btn">
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
