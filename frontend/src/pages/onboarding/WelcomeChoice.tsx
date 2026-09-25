import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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
  AlertTriangle,
  Layers,
} from 'lucide-react';

export const WelcomeChoice: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { skipPermanently, isLoading } = useOnboardingStore();
  const {
    workspaces,
    fetchWorkspaces,
    currentWorkspace,
    selectWorkspace,
  } = useWorkspaceStore();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [isConfirmSkipModalOpen, setIsConfirmSkipModalOpen] = useState(false);

  useEffect(() => {
    fetchWorkspaces().catch(() => {});
  }, [fetchWorkspaces]);

  const ownedWorkspaces = workspaces.filter((w) => {
    const role = (w.role || '').toUpperCase();
    return role === 'OWNER';
  });
  const ownedCount = ownedWorkspaces.length;
  const isAtLimit = ownedCount >= 3;
  const activeOrg = currentWorkspace || (ownedWorkspaces[0]?.workspace ?? null);

  const firstName = user?.firstName || user?.name?.split(' ')[0] || 'there';

  const handleContinueToOrg = async (orgId?: string) => {
    const targetId = orgId || activeOrg?.id;
    if (targetId) {
      try {
        await selectWorkspace(targetId);
      } catch (err) {
        console.warn('Failed to select workspace:', err);
      }
    }
    navigate('/inventory/dashboard');
  };

  const handleSkipPermanently = async () => {
    await skipPermanently();
    setIsConfirmSkipModalOpen(false);
    navigate('/inventory/dashboard');
  };

  const handleGoToAccount = () => {
    navigate('/profile/personal');
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
          {/* Card 1: Contextual Branching Based on Owned Organization Count */}
          {isAtLimit ? (
            /* State C: User owns 3/3 organizations (At limit) */
            <div className="group relative rounded-2xl bg-gradient-to-b from-amber-500/10 via-[#160f14] to-[#0c080b] border border-amber-500/30 p-6 transition-all duration-200 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Organization Limit Reached</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      3/3 Max
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    You've reached your maximum limit of 3 organizations. Switch to an existing organization or manage your company workspaces.
                  </p>
                </div>

                {/* Existing Organizations Selector */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Your Organizations (3/3)
                  </span>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {ownedWorkspaces.map((entry) => {
                      const isSelected = activeOrg?.id === entry.workspace.id;
                      return (
                        <button
                          key={entry.workspace.id}
                          type="button"
                          onClick={() => handleContinueToOrg(entry.workspace.id)}
                          className={cn(
                            'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left',
                            isSelected
                              ? 'bg-[#714b67]/30 text-white font-medium border border-[#714b67]/40'
                              : 'hover:bg-white/5 text-slate-300'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Building2 className="w-3.5 h-3.5 text-[#d4a8c9] shrink-0" />
                            <span className="truncate">{entry.workspace.name}</span>
                          </div>
                          {isSelected && <span className="text-[10px] text-[#e2b9d8]">Active</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={() => handleContinueToOrg()}
                  className="w-full h-11 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] hover:to-[#a06892] text-white rounded-xl text-xs font-semibold shadow-lg shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to {activeOrg?.name || 'Active Organization'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : ownedCount >= 1 ? (
            /* State B: User owns 1 or 2 organizations (Show Continue to [Org Name]) */
            <div className="group relative rounded-2xl bg-gradient-to-b from-[#160f14] to-[#0c080b] border border-white/10 hover:border-[#714b67]/60 p-6 transition-all duration-200 shadow-xl hover:shadow-[#714b67]/15 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#e2b9d8]">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Continue to {activeOrg?.name || 'Organization'}</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Active Org
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Return to your existing operational workspace. Manage real-time inventory, sales checkouts, branches, and staff.
                  </p>
                </div>

                {ownedCount > 1 && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#d4a8c9]" />
                    <span>You own {ownedCount} organizations ({ownedCount}/3 limit)</span>
                  </div>
                )}
              </div>

              <div className="pt-6 space-y-2.5">
                <Button
                  onClick={() => handleContinueToOrg()}
                  className="w-full h-11 bg-gradient-to-r from-[#714b67] to-[#8d5b80] hover:from-[#8d5b80] hover:to-[#a06892] text-white rounded-xl text-xs font-semibold shadow-lg shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Open {activeOrg?.name || 'Workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/onboarding/organization')}
                    className="text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    or set up another organization ({ownedCount} of 3 used) &rarr;
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* State A: User owns 0 organizations (Show Set up an organization) */
            <div className="group relative rounded-2xl bg-gradient-to-b from-[#160f14] to-[#0c080b] border border-white/10 hover:border-[#714b67]/60 p-6 transition-all duration-200 shadow-xl hover:shadow-[#714b67]/15 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#e2b9d8]">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Set up an organization</h2>
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
                  <span>Set Up Organization</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

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

          {/* Card 3: Explore the Platform */}
          <div className="group relative rounded-2xl bg-[#0c080b] border border-white/10 hover:border-white/20 p-6 transition-all duration-200 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Compass className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-white">Explore the platform</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Browse application catalogs, interactive demos, or test drive the flagship Inventory management suite.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                onClick={() => navigate('/products')}
                className="w-full h-11 bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Explore Products & Apps</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Button>
            </div>
          </div>

          {/* Card 4: Visit Personal Profile */}
          <div className="group relative rounded-2xl bg-[#0c080b] border border-white/10 hover:border-white/20 p-6 transition-all duration-200 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <User className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-white">Visit personal profile</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Manage personal profile details, contact information, 2FA security, and account preferences.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <Button
                variant="outline"
                onClick={handleGoToAccount}
                className="w-full h-11 bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-slate-200 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Visit Profile</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </Button>
            </div>
          </div>
        </div>

        {/* Skip Onboarding Option */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setIsConfirmSkipModalOpen(true)}
            className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-4 transition-colors cursor-pointer"
          >
            Skip for now and go directly to Inventory Dashboard
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
                You will be taken directly to the Inventory Dashboard. You can always create an organization or join a team later from your Account Settings.
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
