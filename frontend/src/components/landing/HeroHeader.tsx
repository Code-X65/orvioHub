import React, { useEffect } from 'react';
import { ArrowRight, LayoutDashboard, User } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHost } from '@/host/useHost';
import {
  getAccountsUrl,
  getHomeUrl,
  getApplicationUrl,
} from '@orviohub/shared';

export const HeroHeader: React.FC = () => {
  const { user, isAuthenticated, isInitialized, refreshSession } = useAuthStore();
  const host = useHost();
  const env = host.environment;
  const isMarketing = host.application === 'marketing';

  useEffect(() => {
    if (!isInitialized) {
      refreshSession();
    }
  }, [isInitialized, refreshSession]);

  const homeUrl = getHomeUrl(env);
  const myAccountUrl = `${getAccountsUrl(env)}/profile/personal`;
  const signupUrl = `${getAccountsUrl(env)}/signup`;
  const pricingUrl = isMarketing ? '/pricing' : `${getApplicationUrl('marketing', env)}/pricing`;

  return (
    <section className="relative w-full max-w-[1400px] mx-auto pt-12 sm:pt-16 pb-16 sm:pb-20 px-6 sm:px-8 text-center flex flex-col items-center">
      {/* Background Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#714b67]/15 blur-[120px] pointer-events-none -z-10 rounded-full" />

      {/* Main Headline */}
      <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight leading-[1.1] max-w-4xl">
        All your business on{' '}
        <span className="inline-block bg-[#714b67] text-white px-4 sm:px-6 py-0.5 sm:py-1 rounded-full shadow-xl shadow-[#714b67]/30 transform -rotate-1 hover:rotate-0 transition-transform duration-300">
          one platform.
        </span>
      </h1>

      {/* Sub-headline with handwritten price callout */}
      <div className="mt-4 sm:mt-6 relative inline-block">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium text-slate-200 tracking-tight">
          Simple, efficient, yet{' '}
          <span className="text-white underline decoration-[#714b67] decoration-wavy decoration-2 underline-offset-4">
            affordable!
          </span>
        </h2>

        {/* Handwritten Annotation Arrow & Price Callout */}
        <div className="absolute left-full top-1/2 ml-3 sm:ml-6 -translate-y-2 hidden md:flex items-center gap-2 pointer-events-none select-none">
          {/* Curved Hand-drawn SVG Arrow */}
          <svg width="65" height="50" viewBox="0 0 65 50" fill="none" className="text-[#a37497] -rotate-6">
            <path
              d="M 5 5 Q 35 10 20 40 L 15 32 M 20 40 L 28 36"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="text-left font-handwritten text-[#c79dbd] text-2xl sm:text-3xl leading-tight font-bold whitespace-nowrap transform rotate-2">
            <div>US$ 7.25 / month</div>
            <div className="text-xl sm:text-2xl text-[#a37497]">for ALL apps</div>
          </div>
        </div>
      </div>

      {/* Mobile-only compact price badge */}
      <div className="md:hidden mt-3 inline-block font-handwritten text-[#c79dbd] text-xl font-bold bg-[#714b67]/15 px-3 py-1 rounded-full border border-[#714b67]/30">
        US$ 7.25 / month for ALL apps
      </div>

      {/* Action Buttons (Dynamically detects authentication state) */}
      <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mx-auto">
        {isAuthenticated && user ? (
          <>
            <a
              href={homeUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xs bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white font-semibold text-sm shadow-lg shadow-[#714b67]/25 hover:shadow-xl hover:shadow-[#714b67]/35 hover:scale-[1.01] transition-all duration-200"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Open Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href={myAccountUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xs bg-[#140d12] hover:bg-[#20141d] text-slate-200 hover:text-white font-semibold text-sm border border-[#2d1b27] hover:border-[#44283b] transition-all duration-200"
            >
              <User className="w-4 h-4 text-[#c79dbd]" />
              <span>Manage profile</span>
            </a>
          </>
        ) : (
          <>
            <a
              href={signupUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xs bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white font-semibold text-sm shadow-lg shadow-[#714b67]/25 hover:shadow-xl hover:shadow-[#714b67]/35 hover:scale-[1.01] transition-all duration-200"
            >
              <span>Start now – It's free</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href={pricingUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xs bg-[#140d12] hover:bg-[#20141d] text-slate-200 hover:text-white font-semibold text-sm border border-[#2d1b27] hover:border-[#44283b] transition-all duration-200"
            >
              <span>Explore pricing</span>
            </a>
          </>
        )}
      </div>
    </section>
  );
};
