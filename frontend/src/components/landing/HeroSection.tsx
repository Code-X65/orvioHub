import React from 'react';
import { ArrowRight, ChevronDown, X } from 'lucide-react';
import { useHost } from '@/host/useHost';
import { getAccountsUrl } from '@orviohub/shared';
import { getCrossSubdomainUrl } from '@/lib/domain';

export const HeroSection: React.FC = () => {
  const host = useHost();
  const env = host.environment;
  const accountsUrl = getAccountsUrl(env);
  const homeUrl = getCrossSubdomainUrl('home', '', true, env);
  const launcherUrl = getCrossSubdomainUrl('launcher', '', true, env);

  const signupUrl = `${accountsUrl}/signup?returnTo=${encodeURIComponent(homeUrl)}`;

  return (
    <section className="relative w-full max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 pt-10 pb-16 lg:py-16 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
        
        {/* Left Column: Headline, CTAs & Social Proof */}
        <div className="lg:col-span-6 space-y-8 z-10">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-[62px] font-extrabold text-white tracking-tight leading-[1.1]">
              One platform.<br />
              <span className="text-[#714B67]">Built</span> for{' '}
              <span className="relative inline-block text-[#FDB02F]">
                Africa.
                {/* Hand-drawn style golden underline curve */}
                <svg
                  className="absolute -bottom-2.5 left-0 w-full h-3 text-[#FDB02F]"
                  viewBox="0 0 160 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M 2 8 C 45 1.5, 115 1.5, 158 9"
                    stroke="#FDB02F"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-xl font-normal leading-relaxed pt-2">
              Everything African businesses need to sell, get paid, manage operations and grow — all in one powerful platform.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <a
              href={signupUrl}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-sm bg-[#714B67] hover:bg-[#86597A] text-white text-sm font-semibold shadow-xl shadow-[#714B67]/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>Get started free</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href={launcherUrl}
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-sm bg-black/60 hover:bg-white/5 border border-[#FDB02F]/40 hover:border-[#FDB02F] text-[#FDB02F] text-sm font-semibold transition-all"
            >
              <span>Explore solutions</span>
            </a>
          </div>

          {/* Trust Metrics Pill Strip */}
          <div className="grid grid-cols-3 gap-3 pt-6 max-w-lg border-t border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center text-[#FDB02F] shrink-0 overflow-hidden">
                <img src="/icon_businesses.jpg" alt="Businesses" className="w-6 h-6 object-cover mix-blend-screen" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">50K+</p>
                <p className="text-[11px] text-slate-400">Businesses</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center text-[#FDB02F] shrink-0 overflow-hidden">
                <img src="/icon_africa.jpg" alt="Africa" className="w-6 h-6 object-cover mix-blend-screen" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">22+</p>
                <p className="text-[11px] text-slate-400 leading-tight">African countries</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center text-[#FDB02F] shrink-0 overflow-hidden">
                <img src="/icon_shield.jpg" alt="Secure" className="w-6 h-6 object-cover mix-blend-screen" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">99.9%</p>
                <p className="text-[11px] text-slate-400 leading-tight">Uptime & secure</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: African Map Graphic & Floating Telemetry Glassmorphism Cards */}
        <div className="lg:col-span-6 relative flex items-center justify-center min-h-[460px] lg:min-h-[520px]">
          
          {/* African Map Visual in Purple and Gold Geometric Pattern */}
          <div className="relative w-full max-w-[480px] aspect-square flex items-center justify-center">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-radial from-[#714B67]/25 via-transparent to-transparent blur-2xl -z-10" />

            <img
              src="/africa_pattern_map.jpg"
              alt="Africa Pattern Map"
              className="w-full h-full object-contain rounded-sm drop-shadow-[0_10px_35px_rgba(113,75,103,0.35)]"
            />

            {/* Floating Card 1: Total Balance Card (Top Right) */}
            <div className="absolute -top-3 -right-2 sm:-right-4 w-[230px] sm:w-[250px] p-4 rounded-sm bg-[#0f0f13]/95 border border-white/10 shadow-2xl backdrop-blur-xl space-y-2.5 z-20 animate-in fade-in duration-300">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Total balance</span>
                <span className="flex items-center gap-1 text-[10px] text-slate-300 bg-white/5 px-2 py-0.5 rounded-sm border border-white/5">
                  This month <ChevronDown className="w-2.5 h-2.5" />
                </span>
              </div>

              <p className="text-base sm:text-lg font-extrabold text-white font-mono tracking-tight">
                NGN 24,560,000
              </p>

              {/* Sparkline gradient wave */}
              <div className="w-full h-10 overflow-hidden">
                <svg viewBox="0 0 200 40" className="w-full h-full" fill="none">
                  <defs>
                    <linearGradient id="purpleGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#714B67" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#714B67" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0 35 Q 30 10, 60 25 T 120 15 T 160 5 T 200 12 L 200 40 L 0 40 Z"
                    fill="url(#purpleGlow)"
                  />
                  <path
                    d="M 0 35 Q 30 10, 60 25 T 120 15 T 160 5 T 200 12"
                    stroke="#A56F97"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              <div className="space-y-1 pt-1 border-t border-white/5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-sm bg-emerald-400" /> Income
                  </span>
                  <span className="font-mono text-slate-200 font-semibold text-[10px]">NGN 15,040,000</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-sm bg-rose-400" /> Expenses
                  </span>
                  <span className="font-mono text-slate-200 font-semibold text-[10px]">NGN 9,520,000</span>
                </div>
              </div>
            </div>

            {/* Floating Card 2: Successful Payments Bar Card (Bottom Right) */}
            <div className="absolute -bottom-4 right-0 sm:-right-2 w-[185px] sm:w-[205px] p-3.5 rounded-sm bg-[#0f0f13]/95 border border-white/10 shadow-2xl backdrop-blur-xl space-y-2 z-20 animate-in fade-in duration-500">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Payments</span>
                <X className="w-3 h-3 text-slate-500 hover:text-white cursor-pointer" />
              </div>

              <div>
                <p className="text-[10px] text-slate-400">Successful</p>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-xs font-bold text-white font-mono">NGN 10,540,000</span>
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center">
                    ↑ 12.6%
                  </span>
                </div>
              </div>

              {/* Gold vertical bar chart */}
              <div className="flex items-end justify-between gap-1 h-8 pt-1">
                {[35, 55, 40, 70, 85, 45, 95, 60, 80, 100, 75, 90].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-[#FDB02F] opacity-90 transition-all hover:opacity-100"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};

export default HeroSection;
