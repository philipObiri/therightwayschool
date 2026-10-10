import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AppLoader } from '../../components/AppLoader';

export default function AuthCallback() {
  const hasProcessed = useRef(false);
  const { loginWithSession } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const sessionId = new URLSearchParams(hash.replace('#', '?')).get('session_id');

    if (!sessionId) {
      navigate('/login');
      return;
    }

    const processSession = async () => {
      try {
        const userData = await loginWithSession(sessionId);
        const routes = {
          Admin: '/admin/dashboard', SuperAdmin: '/admin/dashboard',
          Teacher: '/teacher/dashboard', Student: '/student/home',
          Parent: '/parent/home', CEO: '/admin/dashboard',
          Founder: '/admin/dashboard', Principal: '/admin/dashboard',
          HeadTeacher: '/admin/dashboard',
        };
        // Clear hash
        window.history.replaceState(null, '', window.location.pathname);
        navigate(routes[userData.role] || '/student/home', { state: { user: userData } });
      } catch {
        navigate('/login');
      }
    };

    processSession();
  }, [loginWithSession, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FB]" data-testid="auth-callback">
      <div className="text-center">
        <AppLoader size="sm" />
        <p className="text-slate-600">Completing sign in...</p>
      </div>
    </div>
  );
}
