import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Laptop,
  Smartphone,
  Globe,
  MapPin,
  Clock,
  LogOut,
  Loader2,
} from 'lucide-react';

interface SessionItem {
  id: string;
  deviceName?: string;
  browser?: string;
  operatingSystem?: string;
  ipAddress?: string;
  approximateLocation?: string;
  authenticationMethod?: string;
  lastActiveAt?: number;
  createdAt: number;
  isCurrent?: boolean;
  revokedAt?: number;
}

export const SessionsSettings: React.FC = () => {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ sessions: SessionItem[] }>('/users/me/sessions');
      setSessions(res.sessions || []);
    } catch {
      toast.error('Failed to load active sessions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevokeOne = async (sessionId: string) => {
    if (!confirm('Are you sure you want to sign out this device?')) return;

    setRevokingId(sessionId);
    try {
      await api.delete(`/users/me/sessions/${sessionId}`);
      toast.success('Device signed out successfully.');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign out session.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOther = async () => {
    if (!confirm('Are you sure you want to sign out all other devices?')) return;

    setIsRevokingAll(true);
    try {
      await api.post('/users/me/sessions/revoke-all', {});
      toast.success('All other sessions signed out.');
      setSessions((prev) => prev.filter((s) => s.isCurrent));
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke other sessions.');
    } finally {
      setIsRevokingAll(false);
    }
  };

  const getDeviceIcon = (session: SessionItem) => {
    const ua = (session.deviceName || session.browser || '').toLowerCase();
    if (ua.includes('iphone') || ua.includes('android') || ua.includes('mobile')) {
      return <Smartphone className="w-5 h-5 text-pink-400" />;
    }
    return <Laptop className="w-5 h-5 text-indigo-400" />;
  };

  const maskIp = (ip?: string) => {
    if (!ip) return 'Hidden';
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
    return ip;
  };

  return (
    <ProfileLayout
      title="Active Sessions"
      description="Manage active logins and connected devices across all Orvio applications."
      activeSection="sessions"
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xs bg-white/5 border border-white/10">
          <div>
            <h4 className="text-sm font-semibold text-white">Active Device Management</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Lost a device or used a public computer? Revoke access immediately.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRevokeAllOther}
            disabled={isRevokingAll || sessions.length <= 1}
            className="border-white/10 bg-white/5 hover:bg-rose-950/40 text-slate-200 hover:text-rose-300 text-xs shrink-0 rounded-xs"
          >
            {isRevokingAll ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Signing out...
              </>
            ) : (
              <>
                <LogOut className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                Sign Out All Other Devices
              </>
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading active sessions...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`p-4 rounded-xs border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  session.isCurrent
                    ? 'bg-[#714b67]/10 border-[#714b67]/40'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xs bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    {getDeviceIcon(session)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {session.deviceName || session.browser || 'Web Browser'}
                      </span>

                      {session.isCurrent && (
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Current Device
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-slate-500" />
                        {maskIp(session.ipAddress)}
                      </span>

                      {session.approximateLocation && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {session.approximateLocation}
                        </span>
                      )}

                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {session.lastActiveAt
                          ? `Active ${new Date(session.lastActiveAt).toLocaleString()}`
                          : `Created ${new Date(session.createdAt).toLocaleDateString()}`}
                      </span>
                    </div>
                  </div>
                </div>

                {!session.isCurrent && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevokeOne(session.id)}
                    disabled={revokingId === session.id}
                    className="border-white/10 bg-transparent text-rose-400 hover:bg-rose-950/30 text-xs shrink-0 self-end sm:self-center"
                  >
                    {revokingId === session.id ? 'Signing out...' : 'Sign Out'}
                  </Button>
                )}
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs">
                No active remote sessions detected.
              </div>
            )}
          </div>
        )}
      </div>
    </ProfileLayout>
  );
};
