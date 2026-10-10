import React, { useState } from 'react';
import { LogOut, User, Key } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '../../ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';
import { toast } from 'sonner';

const roleBadgeColors = {
  Admin: 'bg-blue-100 text-blue-700', SuperAdmin: 'bg-blue-100 text-[#1B2A4A]',
  Teacher: 'bg-[#C5A55A]/15 text-[#C5A55A]', CEO: 'bg-red-100 text-red-700',
  Founder: 'bg-indigo-100 text-indigo-700', Principal: 'bg-blue-100 text-[#2E6CC4]',
  HeadTeacher: 'bg-blue-100 text-[#2E6CC4]', Student: 'bg-amber-100 text-amber-700',
  Parent: 'bg-blue-100 text-[#2E6CC4]',
};

export function UserMenu({ user }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) { toast.error('Passwords do not match'); return; }
    if (pwForm.new_password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', { current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast.success('Password changed successfully');
      setPasswordDialog(false);
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to change password'); }
    setPwSaving(false);
  };

  const badgeColor = roleBadgeColors[user?.role] || 'bg-slate-100 text-slate-700';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 hover:bg-slate-50 rounded-md px-2 py-1.5 transition-colors" data-testid="user-menu-trigger">
            <div className="w-8 h-8 rounded-md bg-[#2E6CC4] flex items-center justify-center flex-shrink-0">
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-8 h-8 rounded-md" />
              ) : (
                <span className="text-white text-sm font-semibold">{user?.name?.charAt(0) || 'U'}</span>
              )}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-slate-700 leading-tight">{user?.name || 'User'}</p>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-md font-medium ${badgeColor}`}>{user?.role || 'Unknown'}</span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/profile')} data-testid="profile-menu-item">
            <User className="w-4 h-4 mr-2" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => setPasswordDialog(true)} data-testid="change-password-menu-item">
            <Key className="w-4 h-4 mr-2" /> Change Password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600" data-testid="logout-menu-item">
            <LogOut className="w-4 h-4 mr-2" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input type="password" value={pwForm.current_password} onChange={e => setPwForm({...pwForm, current_password: e.target.value})} required className="rounded-md" data-testid="current-password-input" />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={pwForm.new_password} onChange={e => setPwForm({...pwForm, new_password: e.target.value})} required minLength={6} className="rounded-md" data-testid="new-password-input" />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input type="password" value={pwForm.confirm_password} onChange={e => setPwForm({...pwForm, confirm_password: e.target.value})} required className="rounded-md" data-testid="confirm-password-input" />
              {pwForm.new_password && pwForm.confirm_password && pwForm.new_password !== pwForm.confirm_password && (
                <p className="text-xs text-[#DC2626]">Passwords do not match</p>
              )}
            </div>
            <Button type="submit" disabled={pwSaving} className="w-full rounded-md bg-[#2E6CC4]" data-testid="submit-password-change">
              {pwSaving ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
