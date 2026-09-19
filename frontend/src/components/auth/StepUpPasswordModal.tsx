import React, { useState } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface StepUpPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  title?: string;
  description?: string;
  actionButtonText?: string;
  isDangerous?: boolean;
}

export const StepUpPasswordModal: React.FC<StepUpPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Security Verification Required',
  description = 'Please verify your password before proceeding with this sensitive action.',
  actionButtonText = 'Verify & Proceed',
  isDangerous = false,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isSubmitting) return;

    setIsSubmitting(true);
    setPasswordError(null);

    try {
      await api.post('/auth/verify-password', { password });
      toast.success('Identity verified.');
      await onSuccess();
      onClose();
    } catch (err: any) {
      const errMsg = err?.message || err?.error?.message || 'Incorrect password.';
      setPasswordError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="max-w-md w-full bg-[#160c15] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDangerous
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                : 'bg-[#714b67]/20 text-[#c79dbd] border border-[#714b67]/40'
            }`}
          >
            {isDangerous ? <Lock className="w-5 h-5 text-rose-400" /> : <ShieldCheck className="w-5 h-5 text-[#FDB02F]" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 p-3.5 rounded-xl bg-black/40 border border-white/10">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#c79dbd]" />
              <span>Current Account Password</span>
            </label>
            <div className="relative mt-2">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                autoFocus
                required
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                }}
                placeholder="Enter password"
                className="bg-black/60 border-white/10 text-xs pr-10 focus:border-[#714b67]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && (
              <p className="text-[11px] text-rose-400 font-medium">{passwordError}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!password || isSubmitting}
              className={`text-xs font-semibold cursor-pointer ${
                isDangerous
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-950/50'
                  : 'bg-[#714b67] hover:bg-[#86597a] text-white shadow-lg shadow-[#714b67]/25'
              }`}
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {actionButtonText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
