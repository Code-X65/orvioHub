import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { getLoginUrl } from '@orviohub/shared';
import { Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { useAccessibleModal } from '@/hooks/useAccessibleModal';

export interface SessionExpiringEventDetail {
  secondsRemaining?: number;
  reason?: string;
  canExtend?: boolean;
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs < 10 ? `0${secs}` : secs}s`;
  }
  return `${secs}s`;
}

export const SessionExpiryModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [isExtending, setIsExtending] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);
  const [canExtend, setCanExtend] = useState(true);

  const countdownTimerRef = useRef<any>(null);
  const extendSession = useAuthStore((s) => s.extendSession);
  const logout = useAuthStore((s) => s.logout);

  const modalRef = useAccessibleModal({
    isOpen,
    onClose: () => {
      if (canExtend) {
        handleExtendSession();
      } else {
        handleForceLogout();
      }
    },
    trapFocus: true,
    restoreFocus: true,
  });

  useEffect(() => {
    const handleSessionExpiring = (event: CustomEvent<SessionExpiringEventDetail>) => {
      const duration = event.detail?.secondsRemaining ?? 120;
      setCanExtend(event.detail?.canExtend ?? true);
      setSecondsLeft(duration);
      setExtendError(null);
      setIsOpen(true);

      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

      countdownTimerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            handleForceLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const handleSessionExpired = () => {
      setCanExtend(false);
      setSecondsLeft(5);
      setIsOpen(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:session-expiring' as any, handleSessionExpiring);
      window.addEventListener('auth:session-expired' as any, handleSessionExpired);
    }

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth:session-expiring' as any, handleSessionExpiring);
        window.removeEventListener('auth:session-expired' as any, handleSessionExpired);
      }
    };
  }, []);

  const handleForceLogout = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setIsOpen(false);
    logout(true);
  };

  const handleExtendSession = async () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setIsExtending(true);
    setExtendError(null);
    try {
      const renewedSession = await extendSession();
      const expiresAt = renewedSession?.expiresAt || (Date.now() + 7 * 86_400_000);
      if (expiresAt <= Date.now()) {
        throw new Error('The server did not provide a valid extended session. Please sign in again.');
      }
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setSecondsLeft(120);
      setIsOpen(false);
    } catch (err: any) {
      setExtendError(err?.message || 'Session extension failed.');
      setSecondsLeft(30);
      countdownTimerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            handleForceLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } finally {
      setIsExtending(false);
    }
  };

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const loginUrl = getLoginUrl(currentUrl);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expiry-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md p-6 rounded-lg bg-zinc-950 border border-amber-500/40 text-slate-100 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
      >
        {/* Header with glowing icon */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Clock className="w-5 h-5 animate-pulse" aria-hidden="true" />
          </div>
          <div>
            <h2 id="session-expiry-title" className="text-base font-semibold text-white">
              Session Expiration Notice
            </h2>
            <p className="text-xs text-zinc-300">Your session is about to expire</p>
          </div>
        </div>

        {/* Message and Countdown */}
        <div className="p-3.5 rounded bg-zinc-900/80 border border-zinc-800 space-y-2.5 text-xs text-zinc-200">
          <p className="leading-relaxed">
            Your login session has expired or could not be renewed. You will be redirected to the sign-in page in{' '}
            <span className="font-mono font-bold text-amber-400 text-sm px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/30">
              {formatTime(secondsLeft)}
            </span>
          </p>
          <p className="text-[11px] text-zinc-300">
            Any unsaved changes on this page may be lost unless you extend your session now.
          </p>
        </div>

        {extendError && (
          <div role="alert" className="p-2.5 rounded bg-red-950/50 border border-red-500/30 flex items-center gap-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
            <span>{extendError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleForceLogout}
            className="w-full sm:w-auto px-4 py-2 min-h-[44px] rounded text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer text-center"
          >
            Sign In Now
          </button>

          {canExtend && (
            <button
              type="button"
              onClick={handleExtendSession}
              disabled={isExtending}
              aria-busy={isExtending}
              className="w-full sm:w-auto px-4 py-2 min-h-[44px] rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isExtending ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{isExtending ? 'Extending...' : 'Extend Session'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export function triggerSessionExpiringWarning(secondsRemaining = 120, canExtend = true) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('auth:session-expiring', {
        detail: { secondsRemaining, canExtend },
      })
    );
  }
}
