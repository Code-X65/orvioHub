import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, CheckCircle2, Loader2, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAccessibleModal } from '@/hooks/useAccessibleModal';

export interface ChangeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail?: string;
  onSuccess: (newEmail: string) => void;
}

export const ChangeEmailModal: React.FC<ChangeEmailModalProps> = ({
  isOpen,
  onClose,
  currentEmail,
  onSuccess,
}) => {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const modalRef = useAccessibleModal({
    isOpen,
    onClose: () => handleClose(),
    trapFocus: true,
    restoreFocus: true,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error('Please enter a new email address.');
      return;
    }
    if (newEmail.trim().toLowerCase() === currentEmail?.toLowerCase()) {
      toast.error('New email address must be different from current email.');
      return;
    }

    setIsSending(true);
    try {
      await api.post('/auth/email/change-request', {
        newEmail: newEmail.trim(),
        password: password || undefined,
      });
      setSentSuccess(true);
      toast.success('Verification link sent to your new email address.');
      onSuccess(newEmail.trim());
    } catch (err: any) {
      toast.error(err.message || 'Failed to request email change.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setNewEmail('');
    setPassword('');
    setSentSuccess(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-email-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div ref={modalRef} className="bg-slate-900 border border-slate-800 rounded-sm p-6 max-w-md w-full shadow-2xl relative">
        <h3 id="change-email-title" className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Mail className="w-5 h-5 text-indigo-400" aria-hidden="true" />
          <span>Change Account Email</span>
        </h3>
        <p className="text-xs text-slate-300 mt-1 mb-4">
          Enter your new email address. We'll send a confirmation link to verify ownership.
        </p>

        {sentSuccess ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-100">Verification Link Sent</h4>
              <p className="text-xs text-slate-300 mt-1">
                We sent a confirmation link to <strong className="text-white">{newEmail}</strong>.
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                A security alert was also sent to your current email address (<span className="text-slate-300">{currentEmail}</span>).
              </p>
            </div>
            <Button
              onClick={handleClose}
              className="w-full min-h-[44px] bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold cursor-pointer"
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                For your security, a notification of this request will also be dispatched to your current email address.
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modalNewEmail" className="text-slate-200 font-medium text-xs">
                New Email Address
              </Label>
              <Input
                id="modalNewEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                autoFocus
                className="h-11 bg-slate-950 border-slate-800 text-slate-100 text-sm focus:border-indigo-500"
                placeholder="new.email@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modalEmailPassword" className="text-slate-200 font-medium text-xs">
                Current Password (for verification)
              </Label>
              <div className="relative">
                <Input
                  id="modalEmailPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-slate-950 border-slate-800 text-slate-100 text-sm pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-2 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer rounded-xs"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-800 text-xs cursor-pointer min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSending || !newEmail || !password}
                aria-busy={isSending}
                className="bg-[#714b67] hover:bg-[#86597a] text-white font-medium text-xs px-4 cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                    Sending...
                  </>
                ) : (
                  'Send Verification Link'
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
