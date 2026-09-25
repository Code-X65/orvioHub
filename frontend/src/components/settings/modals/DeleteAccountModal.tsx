import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, AlertTriangle, Loader2, Eye, EyeOff, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAccessibleModal } from '@/hooks/useAccessibleModal';

export interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const modalRef = useAccessibleModal({
    isOpen,
    onClose: () => handleClose(),
    trapFocus: true,
    restoreFocus: true,
  });

  if (!isOpen) return null;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmationText.trim().toLowerCase() !== 'delete my account') {
      toast.error('Please type "delete my account" to confirm.');
      return;
    }

    setIsDeleting(true);
    try {
      await api.delete('/auth/account', {
        password: password || undefined,
      });
      toast.success('Your account has been scheduled for permanent deletion.');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete account. Incorrect password.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setConfirmationText('');
    onClose();
  };

  const isConfirmed = confirmationText.trim().toLowerCase() === 'delete my account';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div ref={modalRef} className="bg-slate-900 border border-rose-900/50 rounded-sm p-6 max-w-md w-full shadow-2xl">
        <h3 id="delete-account-title" className="text-lg font-bold text-rose-400 flex items-center gap-2">
          <Trash2 className="w-5 h-5" aria-hidden="true" />
          <span>Confirm Account Deletion</span>
        </h3>

        <div className="mt-3 p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            This action will disconnect all workspace memberships, revoke active sessions, and anonymize your personal data.
          </span>
        </div>

        <div className="mt-2.5 p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 flex items-start gap-2">
          <Calendar className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>14-Day Recovery Grace Period:</strong> You can cancel this deletion anytime within the next 14 days by simply logging in. After 14 days, your data is purged permanently.
          </span>
        </div>

        <form onSubmit={handleDelete} className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="delPasswordInput" className="text-slate-200 font-medium text-xs">
              Account Password (to verify identity)
            </Label>
            <div className="relative">
              <Input
                id="delPasswordInput"
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
                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmDeletePhrase" className="text-slate-200 font-medium text-xs">
              Type <span className="font-semibold text-rose-400">delete my account</span> to confirm
            </Label>
            <Input
              id="confirmDeletePhrase"
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              required
              className="h-11 bg-slate-950 border-slate-800 text-slate-100 text-sm"
              placeholder="delete my account"
            />
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
              disabled={isDeleting || !isConfirmed || !password}
              aria-busy={isDeleting}
              className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs px-4 cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                  Processing...
                </>
              ) : (
                'Schedule Deletion'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
