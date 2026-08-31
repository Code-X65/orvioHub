import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { AuthLayout } from '@/pages/auth/AuthLayout';
import { Server, Database, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export const WorkspaceInit: React.FC = () => {
  const navigate = useNavigate();
  const { refreshSession, onboardingStatus } = useAuthStore();
  const hasStartedRef = useRef(false);
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);
  const [error, setError] = useState<string | null>(null);

  const startInitialization = async () => {
    setError(null);
    try {
      setPhase(0);
      await new Promise((r) => setTimeout(r, 700));

      setPhase(1);
      const branchName = localStorage.getItem('orvio_initial_branch_name') || undefined;
      const branchCode = localStorage.getItem('orvio_initial_branch_code') || undefined;
      await api.post('/onboarding/workspace', { branchName, branchCode });

      setPhase(2);
      await new Promise((r) => setTimeout(r, 700));

      setPhase(3);
      await refreshSession();

      await new Promise((r) => setTimeout(r, 600));
      navigate('/onboarding/team', { replace: true });
    } catch (err: any) {
      console.error('[WorkspaceInit Error]:', err);
      setError(err.message || 'Failed to initialize organization workspace. Please try again.');
    }
  };

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    startInitialization();
  }, []);

  const steps = [
    { title: 'Provisioning organization workspace', desc: 'Isolating database schemas and operational data vault', icon: Server },
    { title: 'Configuring enabled business applications', desc: 'Setting up catalog, POS terminal, and inventory stores', icon: Database },
    { title: 'Applying RBAC and security defaults', desc: 'Setting up role policies and compliance encryption', icon: ShieldCheck },
    { title: 'Organization workspace ready for collaboration', desc: 'Environment active and ready', icon: CheckCircle2 },
  ];

  if (error) {
    return (
      <AuthLayout>
        <div className="w-full max-w-md mx-auto space-y-4 bg-[#0c080b]/90 border border-red-500/30 p-8 rounded-2xl shadow-2xl text-center backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
            <RefreshCw className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-red-400">Workspace Provisioning Failed</h2>
          <p className="text-slate-400 text-xs leading-relaxed">{error}</p>
          <button
            onClick={() => startInitialization()}
            className="w-full mt-4 py-3 bg-gradient-to-r from-[#714b67] to-[#8a5d7e] hover:from-[#805575] hover:to-[#99678c] text-white rounded-xl font-semibold text-xs transition-all shadow-lg shadow-[#714b67]/25 cursor-pointer"
          >
            Retry Provisioning
          </button>
        </div>
      </AuthLayout>
    );
  }

  const CurrentIcon = steps[phase].icon;

  return (
    <AuthLayout>
      <div className="w-full max-w-[480px] mx-auto flex flex-col items-center text-center space-y-6 animate-in fade-in duration-200">
        {/* Animated Central Icon */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div
            className="absolute inset-0 rounded-full border-2 border-[#714b67] border-t-transparent animate-spin"
            style={{ animationDuration: '1.5s' }}
          />
          <div className="w-16 h-16 rounded-full bg-[#160f14] border border-white/10 flex items-center justify-center shadow-2xl">
            <CurrentIcon
              className={cn(
                'w-7 h-7 transition-colors duration-500',
                phase === 3 ? 'text-emerald-400' : 'text-[#d4a8c9]'
              )}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Setting up your organization
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            {onboardingStatus?.organization?.name || 'Your organization'} is being configured in a dedicated workspace.
          </p>
        </div>

        {/* Provisioning Checklist */}
        <div className="w-full bg-[#0c080b]/90 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl space-y-4 text-left">
          {steps.map((step, idx) => {
            const isDone = idx < phase;
            const isCurrent = idx === phase;

            return (
              <div
                key={idx}
                className={cn(
                  'flex items-start gap-3 transition-all duration-300',
                  isDone ? 'opacity-50' : isCurrent ? 'opacity-100 scale-[1.01]' : 'opacity-30'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 text-[10px] font-bold transition-colors',
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : isCurrent
                      ? 'bg-[#714b67] text-white shadow-sm'
                      : 'bg-white/5 text-slate-500 border border-white/5'
                  )}
                >
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                </div>

                <div className="space-y-0.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      'text-xs font-semibold transition-colors',
                      isCurrent ? 'text-white' : isDone ? 'text-slate-300' : 'text-slate-500'
                    )}
                  >
                    {step.title}
                  </div>
                  <div className="text-[10px] text-slate-400">{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AuthLayout>
  );
};
