import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAccessibleModal } from '@/hooks/useAccessibleModal';

export interface DisableTwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DisableTwoFactorModal: React.FC<DisableTwoFactorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  const modalRef = useAccessibleModal({
    isOpen,
    onClose,
    trapFocus: true,
    restoreFocus: true,
  });

  if (!isOpen) return null;

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error('Please enter your account password to confirm.');
      return;
    }

    setIsDisabling(true);
    try {
      await api.post('/auth/2fa/disable', {
        password,
      });
      toast.success('Two-factor authentication has been disabled.');
      setPassword('');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to disable 2FA. Incorrect password.');
    } finally {
      setIsDisabling(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disable-2fa-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div ref={modalRef} className="bg-slate-900 border border-slate-800 rounded-sm p-6 max-w-md w-full shadow-2xl">
        <h3 id="disable-2fa-title" className="text-lg font-bold text-rose-400 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" aria-hidden="true" />
          <span>Disable Two-Factor Authentication</span>
        </h3>
        <p className="text-xs text-slate-300 mt-2">
          Disabling 2FA reduces your account security. Please enter your account password to confirm this action.
        </p>

        <form onSubmit={handleDisable} className="space-y-4 mt-5">
          <div className="space-y-1.5">
            <Label htmlFor="disable2faPasswordInput" className="text-slate-200 font-medium text-xs">
              Account Password
            </Label>
            <div className="relative">
              <Input
                id="disable2faPasswordInput"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-slate-950 border-slate-800 text-slate-100 text-sm pr-10"
                placeholder="••••••••"
                autoFocus
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
              onClick={onClose}
              className="border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-800 text-xs cursor-pointer min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isDisabling || !password}
              aria-busy={isDisabling}
              className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs px-4 cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {isDisabling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                  Disabling...
                </>
              ) : (
                'Disable 2FA'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
