import React from 'react';
import { Header } from '@/components/landing/Header';

export const OnboardingLayout: React.FC<{
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  stepName?: string;
}> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen flex flex-col bg-black text-slate-100 selection:bg-[#714b67] selection:text-white justify-between">
      {/* Top Universal Header */}
      <Header />

      {/* Background Radial Glow */}
      <div className="fixed top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-[#714b67]/10 blur-[160px] pointer-events-none" />

      {/* Main Content Area without box cards or progress bar */}
      <main className="flex-1 flex flex-col items-center justify-center pt-6 pb-12 px-4 sm:px-6 relative z-10">
        <div className="w-full max-w-[460px] mx-auto">
          <div className="text-center mb-6 space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          <div className="w-full">
            {children}
          </div>
        </div>
      </main>

      {/* Dark Minimal Footer */}
      <footer className="w-full border-t border-white/5 bg-black py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Orivo Inc. • Single Unified Business Platform
      </footer>
    </div>
  );
};
