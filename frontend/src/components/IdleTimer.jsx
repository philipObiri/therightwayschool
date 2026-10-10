import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Clock, LogOut } from 'lucide-react';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;   // 10 minutes before warning
const COUNTDOWN_SECONDS = 60;              // 60-second countdown before auto-logout

const ROLE_COPY = {
  Student:   { title: 'Still studying?',  cta: 'Continue Studying' },
  Parent:    { title: 'Still there?',     cta: 'Continue Session' },
  default:   { title: 'Still working?',   cta: 'Continue Working' },
};

function getRoleCopy(role) {
  return ROLE_COPY[role] || ROLE_COPY.default;
}

export default function IdleTimer() {
  const { user, logout } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const idleTimer = useRef(null);
  const countdownTimer = useRef(null);

  const resetIdle = useCallback(() => {
    if (showModal) return; // Don't reset while countdown is running
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setShowModal(true), IDLE_TIMEOUT_MS);
  }, [showModal]);

  // Wire up activity listeners
  useEffect(() => {
    if (!user) return;

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle));
      clearTimeout(idleTimer.current);
    };
  }, [user, resetIdle]);

  // Countdown timer when modal is shown
  useEffect(() => {
    if (!showModal) {
      clearInterval(countdownTimer.current);
      setCountdown(COUNTDOWN_SECONDS);
      return;
    }

    setCountdown(COUNTDOWN_SECONDS);
    countdownTimer.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimer.current);
          handleAutoLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  const handleAutoLogout = useCallback(async () => {
    setShowModal(false);
    await logout();
    window.location.href = '/login';
  }, [logout]);

  const handleContinue = useCallback(() => {
    setShowModal(false);
    clearInterval(countdownTimer.current);
    // Restart the idle timer
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setShowModal(true), IDLE_TIMEOUT_MS);
  }, []);

  if (!user || !showModal) return null;

  const { title, cta } = getRoleCopy(user.role);
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timeStr = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `${seconds}s`;

  return (
    <Dialog open={showModal} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm text-center"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-[#1B2A4A]">{title}</h2>
            <p className="text-sm text-slate-500 mt-1">
              You've been inactive for 10 minutes.
              <br />
              You'll be logged out in{' '}
              <span className="font-bold text-amber-600">{timeStr}</span>.
            </p>
          </div>

          {/* Circular countdown */}
          <div className="relative w-16 h-16">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#f1f5f9" strokeWidth="6" />
              <circle
                cx="32" cy="32" r="28" fill="none"
                stroke="#f59e0b" strokeWidth="6"
                strokeDasharray={2 * Math.PI * 28}
                strokeDashoffset={2 * Math.PI * 28 * (1 - countdown / COUNTDOWN_SECONDS)}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-amber-600">
              {timeStr}
            </span>
          </div>

          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1 gap-2 text-slate-500"
              onClick={handleAutoLogout}
            >
              <LogOut className="w-4 h-4" /> Log out
            </Button>
            <Button
              className="flex-1 bg-[#2A7A5A] hover:bg-[#1F5E43]"
              onClick={handleContinue}
            >
              {cta}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
