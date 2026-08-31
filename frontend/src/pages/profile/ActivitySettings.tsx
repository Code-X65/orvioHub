import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Activity,
  ShieldAlert,
  Key,
  Mail,
  Smartphone,
  Globe,
  Clock,
  Filter,
  Flag,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface ActivityLogItem {
  _id: string;
  eventType: string;
  severity: 'info' | 'warning' | 'critical';
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  isSuspicious?: boolean;
  suspiciousReason?: string;
  createdAt: number;
}

export const ActivitySettings: React.FC = () => {
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  // Report Suspicious Modal
  const [reportingItem, setReportingItem] = useState<ActivityLogItem | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const fetchActivities = async (eventType?: string) => {
    try {
      setIsLoading(true);
      const query = eventType && eventType !== 'ALL' ? `?eventType=${eventType}` : '';
      const res = await api.get<{ activities: ActivityLogItem[] }>(`/users/me/security-activity${query}`);
      setActivities(res.activities || []);
    } catch {
      toast.error('Failed to load security activity log.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(selectedFilter);
  }, [selectedFilter]);

  const handleReportSuspicious = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingItem) return;

    setIsSubmittingReport(true);
    try {
      await api.post(`/users/me/security-activity/${reportingItem._id}/suspicious`, {
        reason: reportReason || 'Unrecognized activity reported by user',
      });
      toast.success('Activity reported as suspicious. Our security team has been notified.');
      setReportingItem(null);
      setReportReason('');
      fetchActivities(selectedFilter);
    } catch (err: any) {
      toast.error(err.message || 'Failed to report activity.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'auth.login_success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'auth.login_failed':
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case 'user.password_changed':
        return <Key className="w-4 h-4 text-indigo-400" />;
      case 'user.email_changed':
        return <Mail className="w-4 h-4 text-pink-400" />;
      case 'user.phone_changed':
        return <Smartphone className="w-4 h-4 text-amber-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatEventName = (eventType: string) => {
    return eventType
      .replace(/^(auth\.|user\.|workspace\.)/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <ProfileLayout
      title="Security Activity Log"
      description="Review chronological records of logins, password updates, and critical security events."
      activeSection="activity"
    >
      <div className="space-y-6">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xs bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="w-4 h-4 text-[#714b67]" />
            <span>Filter events:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {['ALL', 'auth.login_success', 'auth.login_failed', 'user.profile_updated', 'user.password_changed'].map(
              (type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedFilter(type)}
                  className={`px-3 py-1 rounded-xs text-xs font-medium transition-colors cursor-pointer ${
                    selectedFilter === type
                      ? 'bg-[#714b67] text-white'
                      : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {type === 'ALL' ? 'All Activity' : formatEventName(type)}
                </button>
              )
            )}
          </div>
        </div>

        {/* Activity Timeline */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading security timeline...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((item) => (
              <div
                key={item._id}
                className={`p-4 rounded-xs border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  item.isSuspicious
                    ? 'bg-rose-950/20 border-rose-500/40'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-xs bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    {getEventIcon(item.eventType)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {formatEventName(item.eventType)}
                      </span>

                      {item.isSuspicious && (
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-xs bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Marked Suspicious
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      {item.ipAddress && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-500" />
                          {item.ipAddress}
                        </span>
                      )}

                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {!item.isSuspicious && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setReportingItem(item)}
                    className="border-white/10 bg-transparent text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 text-xs shrink-0 self-end sm:self-center rounded-xs cursor-pointer"
                  >
                    <Flag className="w-3 h-3 mr-1" />
                    Report Suspicious
                  </Button>
                )}
              </div>
            ))}

            {activities.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs">
                No security activity events matching the selected filter.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Report Suspicious Modal */}
      {reportingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-950 border border-white/10 rounded-xs p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xs bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Report Unrecognized Activity</h3>
                <p className="text-xs text-slate-400">Event: {formatEventName(reportingItem.eventType)}</p>
              </div>
            </div>

            <form onSubmit={handleReportSuspicious} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Reason / Details</label>
                <textarea
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="I do not recognize this device/location..."
                  className="w-full rounded-xs border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#714b67] focus:outline-none"
                />
              </div>

              <div className="text-[11px] text-slate-400 bg-white/5 p-3 rounded-xs border border-white/5">
                We recommend changing your password and terminating remote sessions if you suspect unauthorized access.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReportingItem(null)}
                  className="border-white/10 bg-transparent text-slate-300 text-xs rounded-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-4 rounded-xs"
                >
                  {isSubmittingReport ? 'Submitting...' : 'Flag & Report'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProfileLayout>
  );
};
