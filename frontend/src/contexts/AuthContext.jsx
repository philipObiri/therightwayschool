import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../lib/api';
import { initPushNotifications } from '../lib/notifications';
import { clearQueue } from '../lib/offlineQueue';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // User profile is cached in localStorage for fast hydration (not the token — that's an httpOnly cookie)
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('rw_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // The httpOnly cookie is sent automatically via withCredentials — no token in localStorage
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
      localStorage.setItem('rw_user', JSON.stringify(res.data));
    } catch {
      localStorage.removeItem('rw_user');
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    // Backend sets the httpOnly cookie in the response — we just store the user profile
    const res = await api.post('/auth/login', { email, password });
    const { user: userData } = res.data;
    // Clear any stale offline queue accumulated before login (pre-auth mutations are meaningless)
    clearQueue().catch(() => {});
    localStorage.setItem('rw_user', JSON.stringify(userData));
    setUser(userData);
    initPushNotifications().catch(() => {});

    // Force password change for seeded / admin-reset accounts
    if (userData.password_change_required) {
      window.location.href = '/change-password';
      return userData;
    }

    if (!['Student', 'Parent'].includes(userData.role)) {
      try { await api.post('/hr/clock/auto-in'); } catch { /* non-critical */ }
    }
    return userData;
  };

  const loginWithGoogle = () => {
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      redirect_uri: `${window.location.origin}/auth/callback`,
      response_type: 'token id_token',
      scope: 'openid email profile',
      nonce: crypto.randomUUID(),
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const loginWithSession = async (sessionId) => {
    const res = await api.post('/auth/session', { session_id: sessionId });
    const { user: userData } = res.data;
    localStorage.setItem('rw_user', JSON.stringify(userData));
    setUser(userData);
    if (userData.password_change_required) {
      window.location.href = '/change-password';
    }
    return userData;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* best-effort */ }
    localStorage.removeItem('rw_user');
    setUser(null);
  };

  const value = { user, loading, login, loginWithGoogle, loginWithSession, logout, checkAuth };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
