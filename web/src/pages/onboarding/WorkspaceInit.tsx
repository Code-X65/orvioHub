import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
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
      await api.post('/onboarding/workspace', {});

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-slate-100 p-6 text-center">
        <div className="max-w-md space-y-4 border border-rose-500/30 p-8 rounded-2xl shadow-2xl">
          <div className="w-14 h-14 rounded-xs bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
            <RefreshCw className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-rose-400">Workspace Provisioning Failed</h2>
          <p className="text-slate-400 text-xs leading-relaxed">{error}</p>
          <button
            onClick={() => startInitialization()}
            className="w-full mt-4 py-3 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs font-semibold text-xs transition-all shadow-lg shadow-[#714b67]/25 cursor-pointer"
          >
            Retry Provisioning
          </button>
        </div>
      </div>
    );
  }

  const CurrentIcon = steps[phase].icon;

  return (
    <div className="min-h-screen flex flex-col bg-black text-slate-100 relative overflow-hidden items-center justify-center">
      {/* Background ambient lighting */}
      <div className="fixed top-[20%] left-[20%] w-[600px] h-[600px] rounded-full bg-[#714b67]/10 blur-[160px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-lg w-full px-6 text-center">
        {/* Animated Central Icon */}
        <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div
            className="absolute inset-0 rounded-full border-2 border-[#714b67] border-t-transparent animate-spin"
            style={{ animationDuration: '1.5s' }}
          />
          <div className="w-16 h-16 rounded-full bg-[#180e16] border border-white/10 flex items-center justify-center shadow-2xl">
            <CurrentIcon
              className={cn(
                'w-7 h-7 transition-colors duration-500',
                phase === 3 ? 'text-emerald-400' : 'text-[#c79dbd]'
              )}
            />
          </div>
        </div>

        <div className="space-y-1.5 mb-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Setting up your organization's workspace
          </h2>
          <p className="text-xs text-slate-400">
            {onboardingStatus?.organization?.name || 'Your organization'} is being configured in a secure workspace. This takes a few seconds.
          </p>
        </div>

        {/* Provisioning Checklist */}
        <div className="w-full border border-white/10 rounded-2xl p-5 space-y-3.5 text-left">
          {steps.map((step, idx) => {
            const isDone = idx < phase;
            const isCurrent = idx === phase;

            return (
              <div
                key={idx}
                className={cn(
                  'flex items-start gap-3 transition-all duration-300',
                  isDone ? 'opacity-40' : isCurrent ? 'opacity-100 scale-[1.01]' : 'opacity-20'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-xs flex items-center justify-center mt-0.5 shrink-0 text-[10px] font-bold transition-colors',
                    isDone
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                      : isCurrent
                      ? 'bg-[#714b67] text-white shadow-sm'
                      : 'bg-[#180e16] text-slate-500 border border-white/5'
                  )}
                >
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                </div>

                <div className="space-y-0.5">
                  <div
                    className={cn(
                      'text-xs font-bold transition-colors',
                      isCurrent ? 'text-[#c79dbd]' : isDone ? 'text-slate-300' : 'text-slate-500'
                    )}
                  >
                    {step.title}
                  </div>
                  <div className="text-[10px] text-slate-500">{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
