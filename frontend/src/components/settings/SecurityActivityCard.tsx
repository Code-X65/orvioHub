import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Key, Globe, Smartphone, Clock, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

interface ActivityItem {
  _id?: string;
  id?: string;
  eventType: string;
  severity?: 'info' | 'warning' | 'critical';
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
}

export const SecurityActivityCard: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        const res = await api.get<{ activities?: ActivityItem[]; events?: ActivityItem[] }>(
          '/users/me/security-activity'
        );
        const list = res.activities || res.events || [];
        setActivities(list.slice(0, 5));
      } catch {
        // Fallback default
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, []);

  const getEventDescription = (type: string) => {
    switch (type) {
      case 'auth.login_success':
      case 'login_success':
        return 'Successful sign in';
      case 'auth.login_failed':
      case 'login_failed':
        return 'Failed sign in attempt';
      case 'password_changed':
        return 'Account password changed';
      case '2fa_enabled':
      case 'user_2fa_enabled':
        return 'Two-factor authentication enabled';
      case '2fa_disabled':
      case 'user_2fa_disabled':
        return 'Two-factor authentication disabled';
      case 'passkey_registered':
        return 'New passkey enrolled';
      case 'passkey_deleted':
        return 'Passkey deleted';
      case 'email_change_requested':
        return 'Email change requested';
      case 'email_changed':
        return 'Email address changed';
      default:
        return type.replace(/[._]/g, ' ');
    }
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" />
          <span>Recent Security Activity</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Recent authentication events and sensitive security actions on your account.
        </p>
      </div>

      <div className="mt-4 space-y-2.5">
        {loading ? (
          <div className="py-6 text-center text-xs text-slate-500">Loading security log...</div>
        ) : activities.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
            No recent suspicious security activity detected.
          </div>
        ) : (
          activities.map((item, idx) => {
            const isWarning = item.severity === 'warning' || item.eventType.includes('failed');
            return (
              <div
                key={item._id || item.id || idx}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800/80 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 ${
                      isWarning
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {isWarning ? <ShieldAlert className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200 capitalize">
                      {getEventDescription(item.eventType)}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>IP: {item.ipAddress || '127.0.0.1'}</span>
                      {item.userAgent && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[180px] sm:max-w-xs">{item.userAgent}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-[11px] text-slate-500 font-mono shrink-0 ml-2">
                  {formatTimeAgo(item.createdAt)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
