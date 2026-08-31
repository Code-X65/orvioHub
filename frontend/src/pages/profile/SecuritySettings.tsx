import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { ProfileLayout } from '@/components/profile/ProfileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Key,
  ShieldCheck,
  QrCode,
  Copy,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Globe,
} from 'lucide-react';

export const SecuritySettings: React.FC = () => {
  const { user, updateUser, refreshSession } = useAuthStore();

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // 2FA State
  const [is2faModalOpen, setIs2faModalOpen] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorVerifyCode, setTwoFactorVerifyCode] = useState('');
  const [isStarting2fa, setIsStarting2fa] = useState(false);
  const [isVerifying2fa, setIsVerifying2fa] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Connected Accounts / Login Methods State
  const [identities, setIdentities] = useState<any[]>([]);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchIdentities = async () => {
      try {
        const res = await api.get<{ identities: any[] }>('/users/me/identities');
        setIdentities(res.identities || []);
      } catch {
        // Fallback default
        setIdentities([{ provider: 'password', providerEmail: user?.email }]);
      }
    };
    fetchIdentities();
  }, [user]);

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score += 25;
    if (/[A-Z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass)) score += 25;
    if (/[^A-Za-z0-9]/.test(pass)) score += 25;
    return score;
  };

  const strength = getPasswordStrength(newPassword);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await api.post('/users/me/password/change', {
        currentPassword,
        newPassword,
        revokeOtherSessions,
      });
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.message || 'Failed to update password.';
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // 2FA Handlers
  const handleStart2fa = async () => {
    setIsStarting2fa(true);
    try {
      const res = await api.post<any>('/auth/2fa/enable');
      setTwoFactorSecret(res.secret);
      setTwoFactorVerifyCode('');
      setBackupCodes(null);
      setIs2faModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate 2FA setup.');
    } finally {
      setIsStarting2fa(false);
    }
  };

  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorVerifyCode.trim() || twoFactorVerifyCode.trim().length !== 6) {
      toast.error('Please enter a valid 6-digit code.');
      return;
    }

    setIsVerifying2fa(true);
    try {
      const res = await api.post<any>('/auth/2fa/verify', {
        code: twoFactorVerifyCode.trim(),
      });
      setBackupCodes(res.backupCodes || []);
      updateUser({ twoFactorEnabled: true });
      await refreshSession();
      toast.success('Two-factor authentication successfully enabled!');
    } catch (err: any) {
      toast.error(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsVerifying2fa(false);
    }
  };

  const handleCopySecret = async () => {
    if (!twoFactorSecret) return;
    await navigator.clipboard.writeText(twoFactorSecret);
    setCopiedSecret(true);
    toast.success('Secret key copied to clipboard.');
    setTimeout(() => setCopiedSecret(false), 2500);
  };

  const handleUnlinkIdentity = async (provider: string) => {
    if (identities.length <= 1) {
      toast.error('You cannot disconnect your only login method to prevent account lockout.');
      return;
    }

    if (!confirm(`Are you sure you want to disconnect ${provider}?`)) return;

    setUnlinkingId(provider);
    try {
      await api.delete(`/users/me/identities/${provider}`);
      toast.success(`${provider} disconnected successfully.`);
      setIdentities((prev) => prev.filter((i) => i.provider !== provider));
    } catch (err: any) {
      toast.error(err.message || 'Failed to unlink login method.');
    } finally {
      setUnlinkingId(null);
    }
  };

  return (
    <ProfileLayout
      title="Security & Login Methods"
      description="Protect your Orvio central account with strong passwords, two-factor authentication, and connected identities."
      activeSection="security"
    >
      <div className="space-y-10">
        {/* Password Management */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Key className="w-4 h-4 text-[#714b67]" />
            <h3>Change Password</h3>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-lg">
            {passwordError && (
              <div className="p-3 rounded-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Current Password *</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67] rounded-xs"
                placeholder="••••••••••••"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">New Password *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67] rounded-xs"
                placeholder="••••••••••••"
              />

              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="space-y-1 pt-1">
                  <div className="h-1.5 w-full bg-white/10 rounded-xs overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        strength <= 25
                          ? 'bg-rose-500 w-1/4'
                          : strength <= 50
                          ? 'bg-amber-500 w-2/4'
                          : strength <= 75
                          ? 'bg-blue-500 w-3/4'
                          : 'bg-emerald-500 w-full'
                      }`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Password Strength</span>
                    <span className="font-medium text-slate-300">
                      {strength <= 25 ? 'Weak' : strength <= 50 ? 'Fair' : strength <= 75 ? 'Good' : 'Strong'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">Confirm New Password *</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="bg-black/60 border-white/10 text-white focus:border-[#714b67]"
                placeholder="••••••••••••"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={revokeOtherSessions}
                onChange={(e) => setRevokeOtherSessions(e.target.checked)}
                className="accent-[#714b67] rounded"
              />
              <span className="text-xs text-slate-300">Log out all other devices after password change</span>
            </label>

            <Button
              type="submit"
              disabled={isUpdatingPassword || !currentPassword || !newPassword}
              className="bg-[#714b67] hover:bg-[#88597c] text-white text-xs px-5 mt-2"
            >
              {isUpdatingPassword ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </form>
        </section>

        <div className="border-t border-white/10" />

        {/* Two-Factor Authentication (2FA) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3>Two-Factor Authentication (2FA / TOTP)</h3>
            </div>

            {user?.twoFactorEnabled ? (
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xs flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Enabled & Active
              </span>
            ) : (
              <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xs">
                Not Enabled
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Add an extra layer of security to your central account. When enabled, you will need to provide a 6-digit TOTP code from an authenticator app (Google Authenticator, Authy, etc.) during sign-in.
          </p>

          {!user?.twoFactorEnabled ? (
            <Button
              type="button"
              onClick={handleStart2fa}
              disabled={isStarting2fa}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 flex items-center gap-1.5 rounded-xs"
            >
              <Smartphone className="w-3.5 h-3.5" />
              {isStarting2fa ? 'Initializing...' : 'Enable Two-Factor Authentication'}
            </Button>
          ) : (
            <div className="text-xs text-slate-400">
              Two-factor protection is protecting your account across all Orvio products.
            </div>
          )}
        </section>

        <div className="border-t border-white/10" />

        {/* Connected Login Methods */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Globe className="w-4 h-4 text-[#714b67]" />
            <h3>Connected Login Methods</h3>
          </div>

          <p className="text-xs text-slate-400">
            Sign in instantly using your existing identity providers. You cannot remove your only active login method to prevent lockout.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            {/* Google */}
            <div className="p-4 rounded-xs bg-white/5 border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xs bg-white/10 flex items-center justify-center font-bold text-white text-xs">
                  G
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Google</div>
                  <div className="text-[10px] text-slate-400">Single Sign-On</div>
                </div>
              </div>

              {identities.some((i) => i.provider === 'google') ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnlinkIdentity('google')}
                  disabled={unlinkingId === 'google'}
                  className="border-white/10 bg-transparent text-rose-400 hover:bg-rose-950/30 text-xs rounded-xs"
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => (window.location.href = '/api/v1/auth/google')}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs rounded-xs"
                >
                  Connect
                </Button>
              )}
            </div>

            {/* Facebook */}
            <div className="p-4 rounded-xs bg-white/5 border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xs bg-blue-600/20 flex items-center justify-center font-bold text-blue-400 text-xs">
                  f
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Facebook</div>
                  <div className="text-[10px] text-slate-400">Single Sign-On</div>
                </div>
              </div>

              {identities.some((i) => i.provider === 'facebook') ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnlinkIdentity('facebook')}
                  disabled={unlinkingId === 'facebook'}
                  className="border-white/10 bg-transparent text-rose-400 hover:bg-rose-950/30 text-xs rounded-xs"
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => (window.location.href = '/api/v1/auth/facebook')}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs rounded-xs"
                >
                  Connect
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* 2FA Setup Modal */}
      {is2faModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-950 border border-white/10 rounded-xs p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xs bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Set Up Authenticator</h3>
                <p className="text-xs text-slate-400">Scan QR or enter key in Google Authenticator</p>
              </div>
            </div>

            {!backupCodes ? (
              <form onSubmit={handleVerify2fa} className="space-y-4">
                <div className="p-3 bg-black/60 rounded-xs border border-white/10 space-y-2">
                  <div className="text-xs text-slate-300 font-mono flex items-center justify-between">
                    <span>Secret Key:</span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="text-pink-300 hover:text-pink-200 text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedSecret ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-2 bg-white/5 rounded-xs font-mono text-center text-xs text-white tracking-widest break-all">
                    {twoFactorSecret}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-300">Enter 6-Digit Code from App</Label>
                  <Input
                    type="text"
                    maxLength={6}
                    value={twoFactorVerifyCode}
                    onChange={(e) => setTwoFactorVerifyCode(e.target.value)}
                    required
                    placeholder="123456"
                    className="bg-black/60 border-white/10 text-white text-center font-mono tracking-widest text-lg focus:border-[#714b67] rounded-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIs2faModalOpen(false)}
                    className="border-white/10 bg-transparent text-slate-300 text-xs rounded-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isVerifying2fa}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 rounded-xs"
                  >
                    {isVerifying2fa ? 'Verifying...' : 'Activate 2FA'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                  2FA successfully activated! Save these emergency backup recovery codes in a safe place.
                </div>

                <div className="p-3 bg-black/60 rounded-xs border border-white/10 font-mono text-xs text-slate-200 grid grid-cols-2 gap-2">
                  {backupCodes.map((code, idx) => (
                    <div key={idx} className="p-1.5 bg-white/5 rounded-xs text-center">
                      {code}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  onClick={() => setIs2faModalOpen(false)}
                  className="w-full bg-[#714b67] hover:bg-[#88597c] text-white text-xs rounded-xs"
                >
                  I have saved my backup codes
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </ProfileLayout>
  );
};
