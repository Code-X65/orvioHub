import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export const AccountDeletion: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [understoodCheckbox, setUnderstoodCheckbox] = useState(false);
  const [activeDeletionRequest, setActiveDeletionRequest] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [ownedWorkspacesBlocker, setOwnedWorkspacesBlocker] = useState<any[] | null>(null);

  const fetchProfile = async () => {
    try {
      const res = await api.get<{ activeDeletionRequest: any }>('/users/me');
      setActiveDeletionRequest(res.activeDeletionRequest || null);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    const cancelToken = searchParams.get('cancelToken') || searchParams.get('token');
    if (cancelToken) {
      handleCancelWithToken(cancelToken);
    } else {
      fetchProfile();
    }
  }, [searchParams]);

  const handleCancelWithToken = async (token: string) => {
    setIsCancelling(true);
    try {
      await api.post('/users/deletion/cancel', { token });
      toast.success('Account deletion request has been successfully cancelled.');
      setActiveDeletionRequest(null);
      // Remove query parameters
      setSearchParams({});
      await fetchProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel deletion request with token.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleScheduleDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnedWorkspacesBlocker(null);

    if (confirmationText.trim().toLowerCase() !== 'delete my account') {
      toast.error('Please type "delete my account" to confirm.');
      return;
    }

    if (!understoodCheckbox) {
      toast.error('Please confirm that you understand this will permanently delete your account.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<{ deletionRequest: any }>('/users/me/deletion/request', {
        password: password || undefined,
        reason: reason || undefined,
        coolingOffDays: 7,
      });

      toast.success('Account deletion scheduled with a 7-day cooling-off period.');
      setActiveDeletionRequest(res.deletionRequest || res);
      setPassword('');
      setConfirmationText('');
      setUnderstoodCheckbox(false);
    } catch (err: any) {
      if (err.code === 'SOLE_OWNER_CANNOT_LEAVE_WORKSPACE') {
        setOwnedWorkspacesBlocker(err.ownedWorkspaces || []);
        toast.error(err.message || 'Cannot delete account while owning workspaces.');
      } else if (err.code === 'INVALID_CREDENTIALS') {
        toast.error('Incorrect password entered.');
      } else {
        toast.error(err.message || 'Failed to request account deletion.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelDeletion = async () => {
    setIsCancelling(true);
    try {
      await api.post('/users/me/deletion/cancel', {});
      toast.success('Account deletion request has been cancelled.');
      setActiveDeletionRequest(null);
      await fetchProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel deletion.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <ProfileLayout
      title="Account Deletion"
      description="Permanently delete your Orvio personal account, authentication credentials, and personal profile."
      activeSection="delete"
    >
      <div className="space-y-6 max-w-2xl">
        {/* Active Cooling-off Request Banner */}
        {activeDeletionRequest && (
          <div className="p-5 rounded-xs bg-amber-950/30 border border-amber-500/40 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xs bg-amber-500/20 flex items-center justify-center text-amber-300 shrink-0">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Account Deletion Scheduled</h4>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  Your account is in an NDPA 7-day cooling-off period and is scheduled for permanent erasure on{' '}
                  <span className="font-mono font-semibold text-white">
                    {new Date(activeDeletionRequest.scheduledDeletionAt).toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  .
                </p>
                <p className="text-[11px] text-amber-300/75">
                  You received an email with a 1-click cancellation link. You can also cancel immediately below.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleCancelDeletion}
              disabled={isCancelling}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 rounded-xs cursor-pointer flex items-center gap-1.5"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cancelling Deletion...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Cancel Deletion Request & Keep Account
                </>
              )}
            </Button>
          </div>
        )}

        {/* Ownership Blocker Alert */}
        {ownedWorkspacesBlocker && (
          <div className="p-5 rounded-xs bg-rose-950/30 border border-rose-500/40 space-y-3">
            <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <h4>Ownership Transfer Required Before Deletion</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              You are currently the registered Owner of the following workspace(s). To protect business continuity, you must transfer ownership to another member or close these workspaces before deleting your personal account:
            </p>
            <div className="space-y-1 pt-1">
              {ownedWorkspacesBlocker.map((ws: any, idx: number) => (
                <div key={idx} className="p-2.5 bg-black/40 rounded-xs border border-white/5 text-xs text-white font-medium flex items-center justify-between">
                  <span>{ws.workspace?.name || `Workspace ID: ${ws.workspaceId}`}</span>
                  <span className="text-[10px] text-amber-400 font-bold uppercase">Owner Role</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Consequences Disclosure */}
        <div className="p-5 rounded-xs bg-white/5 border border-white/10 space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            What happens when you delete your account:
          </h4>

          <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
            <li>Your personal credentials, passwords, 2FA keys, and active sessions will be permanently destroyed.</li>
            <li>You will lose access to all joined workspaces and Orvio applications.</li>
            <li>
              <strong>NDPA 2023 & Tax Compliance:</strong> Past sales, receipts, invoices, and accounting audits made on behalf of organizations will remain preserved for legal compliance with your identity anonymized.
            </li>
            <li>A 7-day cooling-off period applies before final data erasure, during which you can cancel at any time.</li>
          </ul>
        </div>

        {/* Deletion Form */}
        {!activeDeletionRequest && (
          <form onSubmit={handleScheduleDeletion} className="space-y-5 p-5 rounded-xs bg-rose-950/10 border border-rose-900/30">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Reason for leaving (Optional)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. No longer needed / Switching platforms"
                className="bg-black/60 border-white/10 text-white focus:border-rose-500 rounded-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Current Password (Re-authentication) *</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className="bg-black/60 border-white/10 text-white focus:border-rose-500 rounded-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">
                Type <span className="font-mono text-rose-300 font-bold">delete my account</span> to confirm *
              </Label>
              <Input
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                required
                placeholder="delete my account"
                className="bg-black/60 border-white/10 text-white focus:border-rose-500 font-mono text-xs rounded-xs"
              />
            </div>

            <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={understoodCheckbox}
                onChange={(e) => setUnderstoodCheckbox(e.target.checked)}
                className="mt-1 accent-rose-500 rounded-xs"
                required
              />
              <div>
                <div className="text-xs font-medium text-white">
                  I understand this will schedule permanent deletion of my account
                </div>
                <div className="text-[11px] text-slate-400">
                  A 7-day cooling-off period will begin. If not cancelled within 7 days, all personal data will be irrevocably erased.
                </div>
              </div>
            </label>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  confirmationText.trim().toLowerCase() !== 'delete my account' ||
                  !understoodCheckbox ||
                  !password
                }
                className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium py-2.5 rounded-xs cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Scheduling Account Deletion...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Schedule Account Deletion (7-Day Cooling Off)
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </ProfileLayout>
  );
};

export default AccountDeletion;

