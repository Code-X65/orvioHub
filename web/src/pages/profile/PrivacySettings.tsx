import React, { useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Download,
  Shield,
  FileText,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

export const PrivacySettings: React.FC = () => {
  const { user } = useAuthStore();
  const [isExporting, setIsExporting] = useState(false);

  // Consent states
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [analyticsConsent, setAnalyticsConsent] = useState(true);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const res = await api.post<{ data: any }>('/users/me/data-export', {});
      const exportData = res.data?.data || res.data;
      const dataStr =
        'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `orvio-personal-data-export-${user?.id || 'me'}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Personal data archive generated and downloaded!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate data export.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ProfileLayout
      title="Privacy & Personal Data Management"
      description="Manage your data rights per the Nigeria Data Protection Act (NDPA 2023) and global GDPR standards."
      activeSection="privacy"
    >
      <div className="space-y-8">
        {/* Data Portability & Export */}
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Download Personal Data Archive</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Download a complete, machine-readable JSON archive of all personal information, sessions, security records, and preferences stored in your account.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleExportData}
              disabled={isExporting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 shrink-0 flex items-center gap-1.5 self-start sm:self-center"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Generating Archive...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Export JSON Archive
                </>
              )}
            </Button>
          </div>

          <div className="p-3 bg-black/40 rounded-lg border border-white/5 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">Export contains:</div>
            <ul className="list-disc list-inside space-y-0.5 text-slate-400">
              <li>Personal identity and contact profile</li>
              <li>Connected authentication identities (without secrets)</li>
              <li>Workspace membership records</li>
              <li>Notification & regional display preferences</li>
              <li>Security audit event history</li>
            </ul>
          </div>
        </div>

        {/* Data Protection Rights (NDPA / GDPR) */}
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h4>Your Legal Privacy Rights</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { title: 'Right to Access', desc: 'Request and download a copy of all personal records.' },
              { title: 'Right to Rectification', desc: 'Update inaccurate personal or contact details anytime.' },
              { title: 'Right to Erasure', desc: 'Request permanent deletion of your central personal account.' },
              { title: 'Right to Data Portability', desc: 'Export your account data in standard open formats.' },
              { title: 'Right to Object', desc: 'Opt out of marketing communications and analytics.' },
              { title: 'Tenant Separation', desc: 'Workspace administrators cannot access private personal activity.' },
            ].map((right, idx) => (
              <div key={idx} className="p-3 bg-black/40 rounded-lg border border-white/5 space-y-1">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {right.title}
                </div>
                <div className="text-[11px] text-slate-400">{right.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Consent Controls */}
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <FileText className="w-4 h-4 text-[#714b67]" />
            <h4>Consent & Processing Preferences</h4>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5 hover:border-white/10 cursor-pointer">
              <div>
                <div className="text-xs font-medium text-white">Marketing & Promotional Communications</div>
                <div className="text-[11px] text-slate-400">
                  Allow Orvio to email promotional offers and platform updates.
                </div>
              </div>
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => {
                  setMarketingConsent(e.target.checked);
                  toast.success(
                    e.target.checked ? 'Marketing consent granted' : 'Marketing consent withdrawn'
                  );
                }}
                className="accent-[#714b67] w-4 h-4 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5 hover:border-white/10 cursor-pointer">
              <div>
                <div className="text-xs font-medium text-white">Product Telemetry & Analytics</div>
                <div className="text-[11px] text-slate-400">
                  Allow anonymous aggregated telemetry to help us improve UX performance.
                </div>
              </div>
              <input
                type="checkbox"
                checked={analyticsConsent}
                onChange={(e) => {
                  setAnalyticsConsent(e.target.checked);
                  toast.success(
                    e.target.checked ? 'Analytics consent updated' : 'Analytics consent withdrawn'
                  );
                }}
                className="accent-[#714b67] w-4 h-4 rounded"
              />
            </label>
          </div>
        </div>
      </div>
    </ProfileLayout>
  );
};
