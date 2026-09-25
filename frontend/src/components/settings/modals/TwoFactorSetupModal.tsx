import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  Download,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAccessibleModal } from '@/hooks/useAccessibleModal';

export interface TwoFactorSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  secret: string;
  otpauthUrl: string;
  onSuccess: () => void;
}

export const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({
  isOpen,
  onClose,
  secret,
  otpauthUrl,
  onSuccess,
}) => {
  const [verifyCode, setVerifyCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const modalRef = useAccessibleModal({
    isOpen,
    onClose,
    trapFocus: true,
    restoreFocus: true,
  });

  if (!isOpen) return null;

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      toast.success('Manual setup key copied to clipboard.');
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      toast.error('Failed to copy secret key.');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCode.trim().length !== 6) {
      toast.error('Please enter a 6-digit authentication code.');
      return;
    }

    setIsVerifying(true);
    try {
      const res: any = await api.post('/auth/2fa/verify', {
        code: verifyCode.trim(),
      });
      toast.success('Two-factor authentication enabled successfully!');
      if (res?.data?.backupCodes || res?.backupCodes) {
        setBackupCodes(res.data?.backupCodes || res.backupCodes);
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Invalid verification code. Please check your authenticator app.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyBackupCodes = async () => {
    if (!backupCodes) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopiedCodes(true);
      toast.success('All backup codes copied to clipboard.');
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="two-factor-setup-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
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
                <h3 id="two-factor-setup-title" className="text-lg font-bold text-slate-100">
                  Save Your Recovery Backup Codes
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Store these {backupCodes.length} emergency codes in a secure password manager.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                If you lose access to your phone or authenticator app, these single-use codes are the only way to recover account access.
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
              onClick={onClose}
              className="w-full min-h-[44px] bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold cursor-pointer"
            >
              I Have Safely Saved My Codes
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 id="two-factor-setup-title" className="text-lg font-bold text-slate-100">
                  Set Up Two-Factor Authentication
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Scan the QR code with Google Authenticator, Authy, or 1Password.
                </p>
              </div>
            </div>

            {/* QR Code Container with fluid responsive sizing */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-sm shadow-inner mx-auto max-w-[220px] aspect-square w-full">
              {otpauthUrl && (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    otpauthUrl
                  )}`}
                  alt="2FA QR Code"
                  className="w-full h-full max-w-[180px] max-h-[180px] object-contain"
                />
              )}
            </div>

            {/* Manual Secret Key */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">Manual Setup Key</span>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer py-1"
                  aria-label="Copy manual setup key"
                >
                  {copiedSecret ? <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                  <span>{copiedSecret ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="font-mono text-xs text-slate-200 break-all select-all">{secret}</p>
            </div>

            {/* Verification Code Input */}
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <Label htmlFor="verify2faCode" className="text-slate-200 font-medium text-xs">
                  Enter 6-Digit Code From Your App
                </Label>
                <Input
                  id="verify2faCode"
                  type="text"
                  maxLength={6}
                  autoFocus
                  placeholder="123456"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  className="mt-1.5 h-11 bg-slate-950 border-slate-800 text-center font-mono text-lg tracking-widest text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
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
                  disabled={isVerifying || verifyCode.trim().length !== 6}
                  aria-busy={isVerifying}
                  className="bg-[#714b67] hover:bg-[#86597a] text-white font-medium text-xs px-5 cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                      Verifying...
                    </>
                  ) : (
                    'Activate 2FA'
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
