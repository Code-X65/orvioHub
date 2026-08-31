import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
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
} from 'lucide-react';

export const AccountDeletion: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [useCoolingOff, setUseCoolingOff] = useState(true);
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
    fetchProfile();
  }, []);

  const handleScheduleDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnedWorkspacesBlocker(null);

    if (confirmationText.trim().toLowerCase() !== 'delete my account') {
      toast.error('Please type "delete my account" to confirm.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<{ deletionRequest: any }>('/users/me/deletion-request', {
        password: password || undefined,
        reason: reason || undefined,
        coolingOffDays: useCoolingOff ? 14 : 0,
      });

      if (!useCoolingOff) {
        toast.success('Your account has been permanently deleted.');
        await logout();
        navigate('/');
        return;
      }

      toast.success('Account deletion scheduled with a 14-day cooling-off period.');
      setActiveDeletionRequest(res.deletionRequest);
      setPassword('');
      setConfirmationText('');
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
      await api.post('/users/me/deletion-request/cancel', {});
      toast.success('Account deletion request has been cancelled.');
      setActiveDeletionRequest(null);
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
                  Your account is in a cooling-off period and is scheduled for permanent deletion on{' '}
                  <span className="font-mono font-semibold text-white">
                    {new Date(activeDeletionRequest.scheduledDeletionAt).toLocaleDateString()}
                  </span>
                  .
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleCancelDeletion}
              disabled={isCancelling}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 rounded-xs cursor-pointer"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Deletion Request & Keep Account'}
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
                <div key={idx} className="p-2 bg-black/40 rounded-xs border border-white/5 text-xs text-white font-medium">
                  {ws.workspace?.name || `Workspace ID: ${ws.workspaceId}`}
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
              <strong>For employee/worker records:</strong> Past sales, receipts, and logs made on behalf of employers will remain preserved for accounting compliance, with your personal name anonymized.
            </li>
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
                checked={useCoolingOff}
                onChange={(e) => setUseCoolingOff(e.target.checked)}
                className="mt-1 accent-rose-500 rounded-xs"
              />
              <div>
                <div className="text-xs font-medium text-white">Enable 14-day cooling-off safety period (Recommended)</div>
                <div className="text-[11px] text-slate-400">
                  Gives you 14 days to cancel the deletion request in case you change your mind.
                </div>
              </div>
            </label>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  confirmationText.trim().toLowerCase() !== 'delete my account' ||
                  !password
                }
                className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium py-2.5 rounded-xs cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Processing Deletion Request...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Permanently Schedule Account Deletion
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
