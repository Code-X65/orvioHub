import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useHost } from '@/host/useHost';
import { getAccountsUrl } from '@orviohub/shared';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  User,
  Building2,
  Users,
  Compass,
  ArrowRight,
  Sparkles,
  Shield,
  KeyRound,
  X,
} from 'lucide-react';

export const WelcomeChoice: React.FC = () => {
  const navigate = useNavigate();
  const host = useHost();
  const env = host.environment;
  const { user } = useAuthStore();
  const { skipPermanently, isLoading } = useOnboardingStore();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [isConfirmSkipModalOpen, setIsConfirmSkipModalOpen] = useState(false);

  const firstName = user?.firstName || user?.name?.split(' ')[0] || 'there';

  const handleSkipPermanently = async () => {
    await skipPermanently();
    setIsConfirmSkipModalOpen(false);
    navigate('/app');
  };

  const handleGoToAccount = () => {
    const token = localStorage.getItem('orvio_auth_token');
    const refreshToken = localStorage.getItem('orvio_refresh_token');
    const target = new URL(`${getAccountsUrl(env)}/profile/personal`);
    if (token) target.searchParams.set('auth_token', token);
    if (refreshToken) target.searchParams.set('refresh_token', refreshToken);
    window.location.href = target.toString();
  };

  const handleAcceptInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    navigate(`/invite/${encodeURIComponent(inviteCode.trim())}`);
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col selection:bg-[#714b67]/30 selection:text-[#e2b9d8]">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col justify-center">
        {/* Hero Section */}
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-slate-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-[#e2b9d8]" />
            <span>Account Ready</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Welcome to Orviohub, {firstName}! 👋
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto">
            Your account is ready. What would you like to do today?
          </p>
        </div>

        {/* 4 Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Card 1: Create Organization (Primary Action) */}
          <div className="group relative rounded-2xl bg-gradient-to-b from-[#160f14] to-[#0c080b] border border-white/10 hover:border-[#714b67]/60 p-6 transition-all duration-200 shadow-xl hover:shadow-[#714b67]/15 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#e2b9d8]">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">Create an organization</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Start a new business, store, or team. Configure branches, assign permissions, and manage real-time inventory.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <Button
                onClick={() => navigate('/onboarding/organization')}
                className="w-full h-11 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] hover:to-[#a06892] text-white rounded-xl text-xs font-semibold shadow-lg shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Create Organization</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Card 2: Join an Organization */}
          <div className="group relative rounded-2xl bg-[#0c080b] border border-white/10 hover:border-white/20 p-6 transition-all duration-200 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Users className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-white">Join an organization</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Accept an invitation from your team or enter an invite token to access your company's workspace.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                onClick={() => setIsInviteModalOpen(true)}
                className="w-full h-11 bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-slate-400" />
                <span>Join with Invite Code</span>
              </Button>
            </div>
          </div>

          {/* Card 3: Explore Orviohub */}
          <div className="group relative rounded-2xl bg-[#0c080b] border border-white/10 hover:border-white/20 p-6 transition-all duration-200 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Compass className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-white">Explore Orviohub</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Browse application catalogs, interactive demos, and read technical documentation for Nigerian businesses.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                onClick={() => navigate('/products')}
                className="w-full h-11 bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Explore Products</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Button>
            </div>
          </div>

          {/* Card 4: Go to My Account */}
          <div className="group relative rounded-2xl bg-[#0c080b] border border-white/10 hover:border-white/20 p-6 transition-all duration-200 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <User className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-white">Go to my account</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Manage personal profile, 2FA security, active browser sessions, and regional display preferences.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                onClick={handleGoToAccount}
                className="w-full h-11 bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Account Settings</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Button>
            </div>
          </div>
        </div>

        {/* Skip Onboarding Permanently Option */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setIsConfirmSkipModalOpen(true)}
            className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-4 transition-colors cursor-pointer"
          >
            Skip onboarding permanently and go to App Launcher
          </button>
        </div>

        {/* Security & Data Minimization Note */}
        <div className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-3 text-xs text-slate-500">
          <Shield className="w-4 h-4 shrink-0 text-slate-400" />
          <p>
            You have full ownership of your data. You can switch between organizations, invite colleagues, or update regional preferences at any time.
          </p>
        </div>
      </main>

      {/* Confirm Permanent Skip Modal */}
      {isConfirmSkipModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#0c080b] border border-white/10 p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Skip Onboarding?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                You will be taken directly to the App Launcher. You can always create an organization or join a team later from your Account Settings.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfirmSkipModalOpen(false)}
                className="flex-1 h-9 bg-white/5 border-white/10 text-xs text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isLoading}
                onClick={handleSkipPermanently}
                className="flex-1 h-9 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold"
              >
                {isLoading ? 'Skipping...' : 'Yes, Skip'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Enter Invite Code Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0c080b] border border-white/10 p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Enter Invitation Code</h3>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Paste the invite token or code provided in your invitation email to join your team.
            </p>
            <form onSubmit={handleAcceptInvite} className="space-y-4">
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="e.g. inv_ab12cd34..."
                className="h-10 bg-[#160f14] border-white/10 text-white rounded-xl text-xs"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="flex-1 h-9 bg-white/5 border-white/10 text-xs text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!inviteCode.trim()}
                  className="flex-1 h-9 bg-[#714b67] hover:bg-[#8d5b80] text-xs text-white"
                >
                  Continue
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
