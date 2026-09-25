import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect } from '@/components/ui/custom-select';
import { toast } from 'sonner';
import {
  User as UserIcon,
  Shield,
  ArrowLeft,
  Mail,
  Lock,
  Globe,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Download,
  Trash2,
  Database,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { ActiveSessions } from '@/components/settings/ActiveSessions';
import { LinkedIdentities } from '@/components/settings/LinkedIdentities';
import { PhoneVerificationCard } from '@/components/settings/PhoneVerificationCard';
import { PasskeyManagementCard } from '@/components/settings/PasskeyManagementCard';
import { SecurityActivityCard } from '@/components/settings/SecurityActivityCard';

// Extracted Modals
import { TwoFactorSetupModal } from '@/components/settings/modals/TwoFactorSetupModal';
import { DisableTwoFactorModal } from '@/components/settings/modals/DisableTwoFactorModal';
import { RegenerateBackupCodesModal } from '@/components/settings/modals/RegenerateBackupCodesModal';
import { ChangeEmailModal } from '@/components/settings/modals/ChangeEmailModal';
import { DeleteAccountModal } from '@/components/settings/modals/DeleteAccountModal';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Africa/Lagos', label: 'West Africa Time (WAT) - Lagos, Abuja' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'Europe/London', label: 'London, Edinburgh, Dublin (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris, Berlin, Rome, Madrid (CET)' },
  { value: 'Asia/Dubai', label: 'Dubai, Abu Dhabi (GST)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore, Hong Kong, Beijing (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo, Seoul (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney, Melbourne (AEST)' },
];

export const ProfileSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout, refreshSession } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'privacy'>('profile');

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Lagos');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.name) setName(user.name);
      if (user.displayName) setDisplayName(user.displayName);
      if (user.timezone) setTimezone(user.timezone);
    }
  }, [user]);

  // Email Change State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isCancellingEmailChange, setIsCancellingEmailChange] = useState(false);
  const [isResendingEmailChange, setIsResendingEmailChange] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorStepUpCode, setTwoFactorStepUpCode] = useState('');
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Password Visibility Toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 2FA Setup State
  const [is2faModalOpen, setIs2faModalOpen] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorOtpauthUrl, setTwoFactorOtpauthUrl] = useState('');
  const [isStarting2fa, setIsStarting2fa] = useState(false);

  // 2FA Modals
  const [isDisable2faModalOpen, setIsDisable2faModalOpen] = useState(false);
  const [isRegenBackupModalOpen, setIsRegenBackupModalOpen] = useState(false);

  // GDPR Data Export State
  const [isExporting, setIsExporting] = useState(false);

  // Account Deletion State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Handle Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await api.patch<{ user: any }>('/users/me', {
        name: name.trim(),
        displayName: displayName.trim() || undefined,
        timezone,
      });
      updateUser(res.user);
      await refreshSession();
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Cancel Pending Email Change
  const handleCancelEmailChange = async () => {
    setIsCancellingEmailChange(true);
    try {
      await api.post('/auth/email/cancel-change');
      toast.success('Pending email change cancelled.');
      await refreshSession();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel email change.');
    } finally {
      setIsCancellingEmailChange(false);
    }
  };

  // Resend Pending Email Change Verification
  const handleResendEmailChange = async () => {
    if (!user?.pendingEmail) return;
    setIsResendingEmailChange(true);
    try {
      await api.post('/auth/email/change-request', {
        newEmail: user.pendingEmail,
      });
      toast.success(`Fresh confirmation link dispatched to ${user.pendingEmail}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend confirmation email.');
    } finally {
      setIsResendingEmailChange(false);
    }
  };

  // Password Strength Score
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score += 25;
    if (/[A-Z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass)) score += 25;
    if (/[^A-Za-z0-9]/.test(pass)) score += 25;
    return score;
  };

  const passwordStrength = getPasswordStrength(newPassword);

  // Handle Password Update
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

    if (newPassword === currentPassword) {
      setPasswordError('Your new password cannot be the same as your current password.');
      return;
    }

    if (user?.twoFactorEnabled && !twoFactorStepUpCode.trim()) {
      setPasswordError('Two-factor authentication code is required to update password.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await api.post('/users/me/password', {
        currentPassword,
        newPassword,
        revokeOtherSessions,
        twoFactorCode: twoFactorStepUpCode.trim() || undefined,
      });
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTwoFactorStepUpCode('');
      await refreshSession();
    } catch (err: any) {
      const msg = err.message || 'Failed to update password.';
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Start 2FA Setup
  const handleStart2fa = async () => {
    setIsStarting2fa(true);
    try {
      const res = await api.post<any>('/auth/2fa/enable');
      setTwoFactorSecret(res.secret);
      setTwoFactorOtpauthUrl(res.otpauthUrl);
      setIs2faModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate 2FA setup.');
    } finally {
      setIsStarting2fa(false);
    }
  };

  // Handle GDPR Data Export
  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const res = await api.get<{ data: any }>('/auth/account/export');
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `orvio-user-data-${user?.id || 'export'}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Personal data archive downloaded successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export data.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/app')}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-4 w-px bg-slate-800" />
            <h1 className="text-base font-semibold text-slate-100">Account Settings</h1>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex space-x-2 border-b border-slate-800 pb-px">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 py-2 px-4 border-b-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#c79dbd] text-[#c79dbd]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>Profile & Personal</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 py-2 px-4 border-b-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'security'
                ? 'border-[#c79dbd] text-[#c79dbd]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Security & Authentication</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 py-2 px-4 border-b-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'privacy'
                ? 'border-[#c79dbd] text-[#c79dbd]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Privacy & Compliance</span>
          </button>
        </div>

        {/* TAB 1: Profile & Personal */}
        {activeTab === 'profile' && (
          <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
            {/* Basic Profile Details */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-indigo-400" />
                <span>Personal Information</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Manage your identity details across Orvio workspaces.</p>

              <form onSubmit={handleSaveProfile} className="space-y-4 mt-6">
                <div>
                  <Label htmlFor="name" className="text-slate-300 font-medium text-xs">
                    Full Name *
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1.5 bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-100"
                    placeholder="Chinedu Okafor"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="displayName" className="text-slate-300 font-medium text-xs">
                      Display Name
                    </Label>
                    <span className="text-[11px] text-slate-500">(Optional)</span>
                  </div>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="mt-1.5 bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-100"
                    placeholder="Chinedu O."
                  />
                  <p className="text-[11px] text-slate-500 mt-1">How you appear to colleagues in team lists.</p>
                </div>

                <div>
                  <Label htmlFor="timezone" className="text-slate-300 font-medium text-xs">
                    Timezone
                  </Label>
                  <div className="mt-1.5">
                    <CustomSelect
                      value={timezone}
                      onChange={setTimezone}
                      options={TIMEZONES}
                      searchable
                      placeholder="Select your timezone"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Used to synchronize timestamps, logs, and notification scheduling.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={isSavingProfile}
                    className="bg-[#714b67] hover:bg-[#86597a] text-white font-medium text-xs px-5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* Email Address Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-indigo-400" />
                    <span>Email Address</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Your account identity and primary notification inbox.</p>
                </div>
                {user?.emailVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>

              {/* Pending Email Change Banner */}
              {user?.pendingEmail && (
                <div className="mt-4 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Email change in progress</p>
                      <p className="text-amber-200/90 mt-0.5">
                        A confirmation link was sent to <strong className="text-white">{user.pendingEmail}</strong>. Please check that inbox to verify.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      disabled={isResendingEmailChange}
                      onClick={handleResendEmailChange}
                      className="hover:underline text-[#c79dbd] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isResendingEmailChange ? 'animate-spin' : ''}`} />
                      <span>Resend link</span>
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      disabled={isCancellingEmailChange}
                      onClick={handleCancelEmailChange}
                      className="hover:underline text-rose-400 font-semibold cursor-pointer"
                    >
                      {isCancellingEmailChange ? 'Cancelling...' : 'Cancel change request'}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block">Current Email</span>
                  <span className="text-sm font-medium text-slate-200">{user?.email}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEmailModalOpen(true)}
                  className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs cursor-pointer"
                >
                  Change Email
                </Button>
              </div>
            </div>

            {/* Phone & SMS Security */}
            <PhoneVerificationCard />
          </div>
        )}

        {/* TAB 2: Security & Authentication */}
        {activeTab === 'security' && (
          <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
            {/* Two-Factor Authentication (2FA) Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <span>Two-Factor Authentication (2FA)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Require an authenticator code (TOTP) from your mobile device when signing in.
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    user?.twoFactorEnabled
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      user?.twoFactorEnabled ? 'bg-emerald-400' : 'bg-slate-500'
                    }`}
                  />
                  {user?.twoFactorEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>

              <div className="mt-5 p-4 rounded-lg bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    {user?.twoFactorEnabled
                      ? 'Authenticator App (TOTP)'
                      : 'No 2FA Method Configured'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {user?.twoFactorEnabled
                      ? `${user?.twoFactorBackupCodesRemaining ?? 8} recovery backup codes remaining.`
                      : 'Add an extra barrier against unauthorized access and credential theft.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {user?.twoFactorEnabled ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsRegenBackupModalOpen(true)}
                        className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                        Backup Codes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDisable2faModalOpen(true)}
                        className="border-rose-900/50 hover:bg-rose-950/40 text-rose-400 text-xs cursor-pointer"
                      >
                        Disable
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={handleStart2fa}
                      disabled={isStarting2fa}
                      size="sm"
                      className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold cursor-pointer"
                    >
                      {isStarting2fa ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                      Enable 2FA
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Passkeys & Biometrics Management Card */}
            <PasskeyManagementCard />

            {/* Password Management Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-400" />
                <span>Account Password</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Ensure your account is using a long, random password for maximum defense.
              </p>

              {passwordError && (
                <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4 mt-5">
                <div>
                  <Label htmlFor="currentPasswordInput" className="text-slate-300 font-medium text-xs">
                    Current Password
                  </Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="currentPasswordInput"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-slate-100 pr-9"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="newPasswordInput" className="text-slate-300 font-medium text-xs">
                    New Password (min 8 chars, mixed case, number, symbol)
                  </Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="newPasswordInput"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-slate-100 pr-9"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Password Strength:</span>
                        <span className={passwordStrength >= 75 ? 'text-emerald-400' : 'text-amber-400'}>
                          {passwordStrength >= 100
                            ? 'Excellent'
                            : passwordStrength >= 75
                            ? 'Strong'
                            : passwordStrength >= 50
                            ? 'Moderate'
                            : 'Weak'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            passwordStrength >= 75 ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${passwordStrength}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPasswordInput" className="text-slate-300 font-medium text-xs">
                    Confirm New Password
                  </Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="confirmPasswordInput"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-slate-100 pr-9"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 2FA Step-up prompt if active */}
                {user?.twoFactorEnabled && (
                  <div className="p-3 rounded bg-indigo-500/10 border border-indigo-500/20 space-y-1.5">
                    <Label htmlFor="twoFactorStepUpInput" className="text-xs font-semibold text-indigo-300">
                      Two-Factor Authentication Code
                    </Label>
                    <Input
                      id="twoFactorStepUpInput"
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={twoFactorStepUpCode}
                      onChange={(e) => setTwoFactorStepUpCode(e.target.value.replace(/\D/g, ''))}
                      className="bg-slate-950 border-slate-800 text-slate-100 font-mono tracking-widest text-sm"
                      required
                    />
                    <p className="text-[11px] text-slate-400">
                      Step-up authentication required since 2FA is active on your account.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="revokeOtherSessionsCheckbox"
                    checked={revokeOtherSessions}
                    onChange={(e) => setRevokeOtherSessions(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-[#714b67] focus:ring-0 cursor-pointer"
                  />
                  <Label htmlFor="revokeOtherSessionsCheckbox" className="text-xs text-slate-400 cursor-pointer">
                    Sign out of all other devices and active browser sessions
                  </Label>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={isUpdatingPassword || !currentPassword || !newPassword}
                    className="bg-[#714b67] hover:bg-[#86597a] text-white font-medium text-xs px-5 cursor-pointer disabled:opacity-50"
                  >
                    {isUpdatingPassword ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* Active Sessions */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <ActiveSessions />
            </div>

            {/* Security Events Audit Log */}
            <SecurityActivityCard />
          </div>
        )}

        {/* TAB 3: Privacy & Compliance */}
        {activeTab === 'privacy' && (
          <div className="space-y-6 max-w-2xl animate-in fade-in duration-150">
            {/* Linked Identities / Social Logins */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <LinkedIdentities />
            </div>

            {/* GDPR Data Portability (Article 20) */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                    <Download className="w-4 h-4 text-indigo-400" />
                    <span>Download Personal Data (GDPR Article 20)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Export a machine-readable archive containing your account profile, organization roles, and consent records.
                  </p>
                </div>
              </div>

              <div className="mt-5 p-4 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200">Personal Data Export</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">JSON format • Includes profile and telemetry metadata</span>
                </div>
                <Button
                  onClick={handleExportData}
                  disabled={isExporting}
                  size="sm"
                  className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Download JSON
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* GDPR Account Deletion (Article 17) */}
            <div className="bg-slate-900 border border-rose-900/40 rounded-sm p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-rose-400 flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Account (GDPR Article 17)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Request permanent erasure of your user identity and revoke all memberships.
                  </p>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-slate-300">
                  <p className="font-semibold text-rose-300">Irreversible Action</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Includes a 14-day recovery grace period. Signing back in within 14 days cancels the deletion request.
                  </p>
                </div>
                <Button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 cursor-pointer shrink-0"
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Extracted Modals */}
      <TwoFactorSetupModal
        isOpen={is2faModalOpen}
        onClose={() => setIs2faModalOpen(false)}
        secret={twoFactorSecret}
        otpauthUrl={twoFactorOtpauthUrl}
        onSuccess={async () => {
          updateUser({ twoFactorEnabled: true });
          await refreshSession();
        }}
      />

      <DisableTwoFactorModal
        isOpen={isDisable2faModalOpen}
        onClose={() => setIsDisable2faModalOpen(false)}
        onSuccess={async () => {
          updateUser({ twoFactorEnabled: false });
          await refreshSession();
          setIsDisable2faModalOpen(false);
        }}
      />

      <RegenerateBackupCodesModal
        isOpen={isRegenBackupModalOpen}
        onClose={() => setIsRegenBackupModalOpen(false)}
        onSuccess={async () => {
          await refreshSession();
        }}
      />

      <ChangeEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        currentEmail={user?.email}
        onSuccess={async (newEmail) => {
          updateUser({ pendingEmail: newEmail });
          await refreshSession();
        }}
      />

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onSuccess={async () => {
          setIsDeleteModalOpen(false);
          await logout();
          navigate('/');
        }}
      />
    </div>
  );
};
