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
  QrCode,
  Copy,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { ActiveSessions } from '@/components/settings/ActiveSessions';
import { LinkedIdentities } from '@/components/settings/LinkedIdentities';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
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
  const { user, updateUser, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'privacy'>('profile');

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Lagos');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.name) setName(user.name);
      if (user.timezone) setTimezone(user.timezone);
    }
  }, [user]);

  // Email Change State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isSendingEmailRequest, setIsSendingEmailRequest] = useState(false);
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // 2FA State
  const [is2faModalOpen, setIs2faModalOpen] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorOtpauthUrl, setTwoFactorOtpauthUrl] = useState('');
  const [twoFactorVerifyCode, setTwoFactorVerifyCode] = useState('');
  const [isStarting2fa, setIsStarting2fa] = useState(false);
  const [isVerifying2fa, setIsVerifying2fa] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  const [isDisable2faModalOpen, setIsDisable2faModalOpen] = useState(false);
  const [disable2faPassword, setDisable2faPassword] = useState('');
  const [isDisabling2fa, setIsDisabling2fa] = useState(false);

  // GDPR Data Export State
  const [isExporting, setIsExporting] = useState(false);

  // Account Deletion State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

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
        timezone,
      });
      updateUser(res.user);
      await useAuthStore.getState().refreshSession();
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handle Request Email Change
  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error('Please enter a new email address.');
      return;
    }
    if (newEmail.trim().toLowerCase() === user?.email.toLowerCase()) {
      toast.error('New email address must be different from current email.');
      return;
    }

    setIsSendingEmailRequest(true);
    try {
      await api.post('/auth/email/change-request', {
        newEmail: newEmail.trim(),
      });
      setEmailChangeSuccess(true);
      toast.success('Confirmation link sent to your new email address!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to request email change.');
    } finally {
      setIsSendingEmailRequest(false);
    }
  };

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

    setIsUpdatingPassword(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
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

  // Start 2FA Setup
  const handleStart2fa = async () => {
    setIsStarting2fa(true);
    try {
      const res = await api.post<any>('/auth/2fa/enable');
      setTwoFactorSecret(res.secret);
      setTwoFactorOtpauthUrl(res.otpauthUrl);
      setTwoFactorVerifyCode('');
      setBackupCodes(null);
      setCopiedSecret(false);
      setIs2faModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate 2FA setup.');
    } finally {
      setIsStarting2fa(false);
    }
  };

  // Verify and Activate 2FA
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
      toast.success('Two-factor authentication successfully enabled!');
    } catch (err: any) {
      toast.error(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsVerifying2fa(false);
    }
  };

  // Copy Secret
  const handleCopySecret = async () => {
    if (!twoFactorSecret) return;
    await navigator.clipboard.writeText(twoFactorSecret);
    setCopiedSecret(true);
    toast.success('Secret key copied to clipboard.');
    setTimeout(() => setCopiedSecret(false), 2500);
  };

  // Copy Backup Codes
  const handleCopyBackupCodes = async () => {
    if (!backupCodes) return;
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedBackupCodes(true);
    toast.success('Backup recovery codes copied to clipboard.');
    setTimeout(() => setCopiedBackupCodes(false), 2500);
  };

  // Download Backup Codes
  const handleDownloadBackupCodes = () => {
    if (!backupCodes) return;
    const text = [
      '========================================',
      'OrvioHub - 2FA Emergency Backup Codes',
      '========================================',
      'Account: ' + (user?.email || ''),
      'Generated: ' + new Date().toISOString(),
      '',
      'Treat these backup codes like your passwords.',
      'Each code can only be used ONCE.',
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

  // Disable 2FA
  const handleDisable2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDisabling2fa(true);
    try {
      await api.post('/auth/2fa/disable', {
        password: disable2faPassword || undefined,
      });
      updateUser({ twoFactorEnabled: false });
      setIsDisable2faModalOpen(false);
      setDisable2faPassword('');
      toast.success('Two-factor authentication disabled.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to disable 2FA.');
    } finally {
      setIsDisabling2fa(false);
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

  // Handle Account Deletion
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmationText.trim().toLowerCase() !== 'delete my account') {
      toast.error('Please type "delete my account" to confirm.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      await api.delete('/auth/account', {
        password: deletePassword || undefined,
      });
      toast.success('Your account has been permanently deleted.');
      await logout();
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete account.');
    } finally {
      setIsDeletingAccount(false);
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
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="font-semibold text-slate-100">Account Settings</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Account & Security Settings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your personal profile, email preferences, password security, two-factor authentication, and GDPR privacy options.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 mb-8 space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-4 text-sm font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>Profile Information</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-4 text-sm font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'security'
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Security & 2FA</span>
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`pb-4 text-sm font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'privacy'
                ? 'text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Privacy & Data (GDPR)</span>
          </button>
        </div>

        {/* Tab 1: Profile Information */}
        {activeTab === 'profile' && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-100 mb-1">Personal Details</h2>
              <p className="text-xs text-slate-400 mb-6">Update your name and regional preferences.</p>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div>
                  <Label htmlFor="name" className="text-slate-300 font-medium text-xs">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1.5 bg-slate-950 border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 text-slate-100"
                    placeholder="Jane Doe"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="timezone" className="text-slate-300 font-medium text-xs flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>Timezone</span>
                  </Label>
                  <CustomSelect
                    options={TIMEZONES}
                    value={timezone}
                    onChange={(val) => setTimezone(val)}
                    placeholder="Select timezone"
                    searchable={true}
                    searchPlaceholder="Search timezone..."
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={isSavingProfile}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-5"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                  <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
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

              <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block">Current Email</span>
                  <span className="text-sm font-medium text-slate-200">{user?.email}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewEmail('');
                    setEmailChangeSuccess(false);
                    setIsEmailModalOpen(true);
                  }}
                  className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs"
                >
                  Change Email
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Security & 2FA */}
        {activeTab === 'security' && (
          <div className="space-y-6 max-w-2xl">
            {/* Two-Factor Authentication (2FA) Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <span>Two-Factor Authentication (2FA)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Add an extra layer of security to your account using Time-based One-Time Passwords (TOTP) from Google Authenticator, Authy, or 1Password.
                  </p>
                </div>
                {user?.twoFactorEnabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Enabled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    Disabled
                  </span>
                )}
              </div>

              <div className="mt-5 p-4 rounded-lg bg-slate-950 border border-slate-800/80">
                {user?.twoFactorEnabled ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-200">2FA is currently active</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Your account requires a 6-digit code or emergency backup code each time you sign in.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDisable2faPassword('');
                        setIsDisable2faModalOpen(true);
                      }}
                      className="border-rose-900/60 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 text-xs ml-4 flex-shrink-0"
                    >
                      Disable 2FA
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-200">Protect your account</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Require an authentication code in addition to your password when signing in.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleStart2fa}
                      disabled={isStarting2fa}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs ml-4 flex-shrink-0"
                    >
                      {isStarting2fa ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        'Enable 2FA'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Change Password Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-400" />
                <span>Change Password</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 mb-6">
                Ensure your account is using a long, random password with uppercase, lowercase, numbers, and special symbols.
              </p>

              {passwordError && (
                <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword" className="text-slate-300 font-medium text-xs">
                    Current Password
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="mt-1.5 bg-slate-950 border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 text-slate-100"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword" className="text-slate-300 font-medium text-xs">
                    New Password (min 8 chars, mixed case, number, symbol)
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="mt-1.5 bg-slate-950 border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 text-slate-100"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-slate-300 font-medium text-xs">
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="mt-1.5 bg-slate-950 border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 text-slate-100"
                    placeholder="••••••••"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm px-5"
                  >
                    {isUpdatingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* Linked Identities / Connected Accounts Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <LinkedIdentities />
            </div>

            {/* Active Devices & Sessions Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <ActiveSessions />
            </div>
          </div>
        )}

        {/* Tab 3: Privacy & Data (GDPR) */}
        {activeTab === 'privacy' && (
          <div className="space-y-6 max-w-2xl">
            {/* GDPR Export Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-400" />
                <span>Export Personal Data (GDPR Art. 20)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 mb-5">
                Download a machine-readable JSON copy of all personal information, identities, organization memberships, and activity records linked to your account.
              </p>

              <Button
                onClick={handleExportData}
                disabled={isExporting}
                variant="outline"
                className="border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Generating Export...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 mr-2 text-indigo-400" />
                    Download Personal Data (.json)
                  </>
                )}
              </Button>
            </div>

            {/* Danger Zone: Delete Account */}
            <div className="bg-rose-950/20 border border-rose-900/40 rounded-sm p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-rose-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Danger Zone: Delete Account (GDPR Art. 17)</span>
              </h2>
              <p className="text-xs text-slate-300 mt-1 mb-5">
                Permanently delete your account and all associated personal data. This action is immediate and cannot be undone.
              </p>

              <Button
                onClick={() => {
                  setDeletePassword('');
                  setDeleteConfirmationText('');
                  setIsDeleteModalOpen(true);
                }}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium"
              >
                Delete My Account
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* 2FA Setup / Backup Codes Modal */}
      {is2faModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {backupCodes ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">Save Your Recovery Backup Codes</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Store these 8 emergency codes in a secure password manager.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    If you lose access to your phone or authenticator app, these single-use codes are the only way to recover account access.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  {backupCodes.map((code, idx) => (
                    <div key={idx} className="font-mono text-xs text-center py-2 px-3 bg-slate-900/60 rounded border border-slate-800/80 text-slate-200 tracking-wider">
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyBackupCodes}
                    className="flex-1 border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                  >
                    {copiedBackupCodes ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Copy All Codes
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadBackupCodes}
                    className="flex-1 border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    Download (.txt)
                  </Button>
                </div>

                <Button
                  onClick={() => setIs2faModalOpen(false)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm mt-2"
                >
                  I Have Safely Saved My Codes
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">Set Up Two-Factor Authentication</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Scan the QR code with Google Authenticator, Authy, or 1Password.
                    </p>
                  </div>
                </div>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-sm shadow-inner mx-auto w-fit">
                  {twoFactorOtpauthUrl && (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                        twoFactorOtpauthUrl
                      )}`}
                      alt="2FA QR Code"
                      className="w-44 h-44 rounded"
                    />
                  )}
                </div>

                {/* Manual Secret Key */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Manual Setup Key</span>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                    >
                      {copiedSecret ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSecret ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="font-mono text-xs text-slate-200 break-all select-all">{twoFactorSecret}</p>
                </div>

                {/* Verification Code Input */}
                <form onSubmit={handleVerify2fa} className="space-y-4">
                  <div>
                    <Label htmlFor="verify2faCode" className="text-slate-300 font-medium text-xs">
                      Enter 6-Digit Code From Your App
                    </Label>
                    <Input
                      id="verify2faCode"
                      type="text"
                      maxLength={6}
                      autoFocus
                      placeholder="123456"
                      value={twoFactorVerifyCode}
                      onChange={(e) => setTwoFactorVerifyCode(e.target.value)}
                      className="mt-1.5 bg-slate-950 border-slate-800 text-center font-mono text-lg tracking-widest text-slate-100"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIs2faModalOpen(false)}
                      className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isVerifying2fa || twoFactorVerifyCode.trim().length !== 6}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-5"
                    >
                      {isVerifying2fa ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
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
      )}

      {/* Disable 2FA Modal */}
      {isDisable2faModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span>Disable Two-Factor Authentication</span>
            </h3>
            <p className="text-xs text-slate-300 mt-2">
              Disabling 2FA reduces your account security. Please enter your account password to confirm.
            </p>

            <form onSubmit={handleDisable2fa} className="space-y-4 mt-5">
              <div>
                <Label htmlFor="disable2faPassword" className="text-slate-300 font-medium text-xs">
                  Account Password
                </Label>
                <Input
                  id="disable2faPassword"
                  type="password"
                  value={disable2faPassword}
                  onChange={(e) => setDisable2faPassword(e.target.value)}
                  className="mt-1 bg-slate-950 border-slate-800 text-slate-100 text-sm"
                  placeholder="••••••••"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDisable2faModalOpen(false)}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isDisabling2fa}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs px-4"
                >
                  {isDisabling2fa ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
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
      )}

      {/* Change Email Dialog Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 max-w-md w-full shadow-2xl relative">
            <h3 className="text-lg font-semibold text-slate-100">Change Account Email</h3>
            <p className="text-xs text-slate-400 mt-1 mb-5">
              Enter your new email address. We'll send a confirmation link to verify ownership.
            </p>

            {emailChangeSuccess ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">Confirmation Link Sent</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    We sent a verification link to <span className="font-medium text-slate-200">{newEmail}</span>. Please click the link to confirm your new email.
                  </p>
                </div>
                <Button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
                >
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleRequestEmailChange} className="space-y-4">
                <div>
                  <Label htmlFor="modalNewEmail" className="text-slate-300 font-medium text-xs">
                    New Email Address
                  </Label>
                  <Input
                    id="modalNewEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    autoFocus
                    className="mt-1.5 bg-slate-950 border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 text-slate-100"
                    placeholder="new.email@example.com"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEmailModalOpen(false)}
                    className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSendingEmailRequest}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4"
                  >
                    {isSendingEmailRequest ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
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
      )}

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-900/50 rounded-sm p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>Confirm Account Deletion</span>
            </h3>
            <p className="text-xs text-slate-300 mt-2">
              This will permanently delete your account, organization memberships, and personal data.
            </p>

            <form onSubmit={handleDeleteAccount} className="space-y-4 mt-5">
              <div>
                <Label htmlFor="delPassword" className="text-slate-300 font-medium text-xs">
                  Enter Account Password (if applicable)
                </Label>
                <Input
                  id="delPassword"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="mt-1 bg-slate-950 border-slate-800 text-slate-100 text-sm"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <Label htmlFor="confirmDeleteText" className="text-slate-300 font-medium text-xs">
                  Type <span className="font-semibold text-rose-400">delete my account</span> to confirm
                </Label>
                <Input
                  id="confirmDeleteText"
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  required
                  className="mt-1 bg-slate-950 border-slate-800 text-slate-100 text-sm"
                  placeholder="delete my account"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isDeletingAccount || deleteConfirmationText.trim().toLowerCase() !== 'delete my account'}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs px-4"
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Permanently Delete'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
