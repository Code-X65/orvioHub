import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ShieldCheck,
  Key,
  Copy,
  Check,
  Download,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAccessibleModal } from '@/hooks/useAccessibleModal';

export interface RegenerateBackupCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RegenerateBackupCodesModal: React.FC<RegenerateBackupCodesModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const modalRef = useAccessibleModal({
    isOpen,
    onClose: () => handleClose(),
    trapFocus: true,
    restoreFocus: true,
  });

  if (!isOpen) return null;

  const handleRegenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error('Please enter your account password.');
      return;
    }

    setIsRegenerating(true);
    try {
      const res = await api.post<{ backupCodes: string[] }>(
        '/users/me/security/2fa/backup-codes/regenerate',
        { password }
      );
      if (res?.backupCodes) {
        setBackupCodes(res.backupCodes);
        toast.success('New backup codes generated.');
        if (onSuccess) onSuccess();
      } else {
        throw new Error('No backup codes returned');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to regenerate backup codes. Incorrect password.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyBackupCodes = async () => {
    if (!backupCodes) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopiedCodes(true);
      toast.success('Backup codes copied to clipboard.');
      setTimeout(() => setCopiedCodes(false), 2500);
    } catch {
      toast.error('Failed to copy codes.');
    }
  };

  const handleDownloadBackupCodes = () => {
    if (!backupCodes) return;
    const text = [
      '========================================',
      'OrvioHub - 2FA Emergency Backup Codes',
      '========================================',
      `Generated: ${new Date().toISOString()}`,
      '',
      'Treat these backup codes like your passwords.',
      'Each code can only be used ONCE.',
      'Recommended: Store in a password manager (1Password, Bitwarden, Apple Keychain).',
      '',
      ...backupCodes.map((code, index) => `${index + 1}. ${code}`),
      '',
      '========================================',
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orviohub-2fa-backup-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('Backup codes saved to file.');
  };

  const handleClose = () => {
    setPassword('');
    setBackupCodes(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="regenerate-codes-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        className="bg-slate-900 border border-slate-800 rounded-sm p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
      >
        {backupCodes ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 id="regenerate-codes-title" className="text-lg font-bold text-slate-100">
                  New Recovery Backup Codes
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Your previous backup codes have been invalidated. Save these {backupCodes.length} new codes immediately.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                These codes are shown only once. If you lose access to your phone or authenticator app, these are required to regain account access.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 border border-slate-800 rounded-lg">
              {backupCodes.map((code, idx) => (
                <div
                  key={idx}
                  className="font-mono text-xs text-center py-2 px-3 bg-slate-900/60 rounded border border-slate-800/80 text-slate-200 tracking-wider"
                >
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyBackupCodes}
                className="flex-1 min-h-[44px] border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-800 text-xs cursor-pointer"
              >
                {copiedCodes ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" aria-hidden="true" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                    Copy All Codes
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadBackupCodes}
                className="flex-1 min-h-[44px] border-slate-800 bg-slate-950 text-slate-200 hover:bg-slate-800 text-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-indigo-400" aria-hidden="true" />
                Download (.txt)
              </Button>
            </div>

            <div className="p-2.5 rounded bg-slate-950/60 border border-white/5 text-[11px] text-slate-300 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
              <span>Tip: Save these into 1Password, Bitwarden, or Apple Keychain as secure notes.</span>
            </div>

            <Button
              onClick={handleClose}
              className="w-full min-h-[44px] bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold cursor-pointer"
            >
              I Have Safely Saved My Codes
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 id="regenerate-codes-title" className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" aria-hidden="true" />
              <span>Regenerate Recovery Backup Codes</span>
            </h3>
            <p className="text-xs text-slate-300">
              Generating new backup codes will <strong>permanently invalidate</strong> any existing codes. Please confirm your account password to proceed.
            </p>

            <form onSubmit={handleRegenerate} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="regenPasswordInput" className="text-slate-200 font-medium text-xs">
                  Account Password
                </Label>
                <div className="relative">
                  <Input
                    id="regenPasswordInput"
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
                    {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" />}
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
                  disabled={isRegenerating || !password}
                  aria-busy={isRegenerating}
                  className="bg-[#714b67] hover:bg-[#86597a] text-white font-medium text-xs px-4 cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  {isRegenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                      Regenerating...
                    </>
                  ) : (
                    'Generate New Codes'
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
