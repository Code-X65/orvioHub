import React, { useState, useEffect } from 'react';
import { Laptop, Smartphone, Tablet, LogOut, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { DeviceSession } from '../../lib/types';
import { useAuthStore } from '../../stores/useAuthStore';
import { toast } from 'sonner';

export const ActiveSessions: React.FC = () => {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const { logoutAllAccounts } = useAuthStore();

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ sessions: DeviceSession[] }>('/users/me/sessions');
      if (res && res.sessions) {
        setSessions(res.sessions);
      }
    } catch {
      toast.error('Failed to load active sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setRevokingId(sessionId);
      await api.delete(`/users/me/sessions/${sessionId}`);
      toast.success('Device session revoked successfully.');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke session.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOther = async () => {
    if (!window.confirm('Are you sure you want to sign out of all other devices?')) return;
    try {
      setRevokingAll(true);
      await api.post('/auth/logout-all');
      toast.success('Signed out of all devices.');
      await logoutAllAccounts();
      window.location.href = '/login';
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign out of all devices.');
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceIcon = (userAgent?: string, deviceName?: string) => {
    const text = `${userAgent || ''} ${deviceName || ''}`.toLowerCase();
    if (text.includes('mobile') || text.includes('android') || text.includes('iphone')) {
      return <Smartphone className="w-5 h-5 text-indigo-500" />;
    }
    if (text.includes('ipad') || text.includes('tablet')) {
      return <Tablet className="w-5 h-5 text-purple-500" />;
    }
    return <Laptop className="w-5 h-5 text-blue-500" />;
  };

  const formatTimeAgo = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading active devices...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            Active Devices & Sessions
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {sessions.length}
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Devices that are currently signed into your Orvio account.
          </p>
        </div>

        {sessions.length > 1 && (
          <button
            type="button"
            disabled={revokingAll}
            onClick={handleRevokeAllOther}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/50 hover:bg-rose-100 transition-colors shrink-0"
          >
            {revokingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            <span>Sign out all devices</span>
          </button>
        )}
      </div>

      <div className="space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No active sessions found.
          </div>
        ) : (
          sessions.map((session, index) => {
            const isFirst = index === 0; // The active session is top of order
            return (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 rounded-sm border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-3">
                  <div className="w-10 h-10 rounded-sm bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center shrink-0">
                    {getDeviceIcon(session.userAgent, session.deviceName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {session.deviceName || 'Web Browser Session'}
                      </p>
                      {isFirst && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                          <CheckCircle2 className="w-3 h-3" />
                          This Device
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>IP: {session.ipAddress || '127.0.0.1'}</span>
                      <span>•</span>
                      <span>Last active: {formatTimeAgo(session.lastActiveAt || session.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {!isFirst && (
                  <button
                    type="button"
                    disabled={revokingId === session.id}
                    onClick={() => handleRevokeSession(session.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900 transition-all shrink-0"
                  >
                    {revokingId === session.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Revoke'
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
