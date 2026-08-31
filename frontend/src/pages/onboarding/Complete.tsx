import React, { useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { getHomeUrl } from '@orviohub/shared';
import { useHost } from '@/host/useHost';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Building2, CheckCircle2, ArrowRight, Sparkles, ShieldCheck, Layers } from 'lucide-react';

export const Complete: React.FC = () => {
  const host = useHost();
  const { refreshSession, onboardingStatus, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const orgName = onboardingStatus?.organization?.name || 'Your Organization';
  const orgSlug = onboardingStatus?.organization?.slug || 'my-org';
  const appsCount = onboardingStatus?.workspace?.initializedModules?.length || 1;

  const handleLaunch = async () => {
    setIsLoading(true);
    try {
      await api.post('/onboarding/complete');
      toast.success('Onboarding complete! Welcome to Orviohub.');
      await refreshSession();

      const token = localStorage.getItem('orvio_auth_token');
      const refreshToken = localStorage.getItem('orvio_refresh_token');
      const homeBase = getHomeUrl(host.environment);
      try {
        const homeUrl = new URL(homeBase);
        if (token) homeUrl.searchParams.set('auth_token', token);
        if (refreshToken) homeUrl.searchParams.set('refresh_token', refreshToken);
        window.location.href = homeUrl.toString();
      } catch {
        window.location.href = homeBase;
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete onboarding.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-slate-100 relative overflow-hidden items-center justify-center py-12 px-4 selection:bg-[#714b67] selection:text-white">
      {/* Background Radial Glow */}
      <div className="fixed top-[10%] left-[20%] w-[650px] h-[650px] rounded-full bg-[#714b67]/15 blur-[180px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-lg w-full text-center space-y-6">
        {/* Brand Icon */}
        <div className="relative group">
          <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-[#714b67]/40 flex items-center justify-center shadow-2xl relative z-10">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-10 h-10">
                <circle cx="50" cy="50" r="38" stroke="white" strokeWidth="16" fill="none" />
                <polygon points="50,50 88,12 55,28" fill="#714b67" />
              </svg>
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full border-2 border-black flex items-center justify-center z-20 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-black stroke-[3]" />
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Organization Active & Live</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            You're ready to roll!
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            Welcome, <strong className="text-white">{user?.name || 'there'}</strong>. Your centralized operating workspace for <strong className="text-[#d4a8c9]">{orgName}</strong> is ready.
          </p>
        </div>

        {/* Organization Details Card */}
        <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 text-left space-y-4 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Building2 className="w-4 h-4 text-[#d4a8c9]" />
              <span>Organization Identifier</span>
            </div>
            <span className="text-xs font-mono font-semibold text-white bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
              {orgSlug}
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Layers className="w-4 h-4 text-[#d4a8c9]" />
              <span>Active Business Applications</span>
            </div>
            <span className="text-xs font-semibold text-[#d4a8c9]">
              {appsCount} Application{appsCount > 1 ? 's' : ''} Configured
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Security & Compliance</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              NDPR Compliant & Encrypted
            </span>
          </div>
        </div>

        {/* Launch Button */}
        <Button
          onClick={handleLaunch}
          disabled={isLoading}
          className="w-full h-12 text-sm font-semibold bg-[#714b67] hover:bg-[#85587a] active:bg-[#603f57] text-white rounded-xl shadow-lg shadow-[#714b67]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {isLoading ? <Spinner size="default" className="mr-2 text-white" /> : null}
          {isLoading ? (
            'Launching Application...'
          ) : (
            <>
              <span>Launch Orviohub Apps</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
