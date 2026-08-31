import React from 'react';
import { Header } from '@/components/landing/Header';

export const OnboardingLayout: React.FC<{
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  stepName?: string;
  stepNumber?: number;
  totalSteps?: number;
}> = ({ children, title, subtitle, stepName, stepNumber, totalSteps = 4 }) => {
  return (
    <div className="min-h-screen flex flex-col bg-black text-slate-100 selection:bg-[#714b67] selection:text-white justify-between relative overflow-x-hidden">
      {/* Top Universal Header */}
      <Header />

      {/* Ambient Radial Glow */}
      <div className="fixed top-[-10%] left-[20%] w-[650px] h-[650px] rounded-full bg-[#714b67]/15 blur-[180px] pointer-events-none -z-10" />

      {/* Main Content Area with Orviohub Card */}
      <main className="flex-1 flex flex-col items-center justify-center pt-8 pb-12 px-4 sm:px-6 relative z-10">
        <div className="w-full max-w-[560px] mx-auto space-y-6">
          {/* Header Title & Step Indicator */}
          <div className="text-center space-y-3">
            {/* Visual Step Progression Bar */}
            {stepNumber && totalSteps && (
              <div className="flex items-center justify-center gap-2 max-w-xs mx-auto mb-2">
                {Array.from({ length: totalSteps }).map((_, idx) => {
                  const currentIdx = idx + 1;
                  const isCompleted = currentIdx < stepNumber;
                  const isCurrent = currentIdx === stepNumber;
                  return (
                    <div key={idx} className="flex items-center flex-1 last:flex-none">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                          isCompleted
                            ? 'bg-[#714b67] text-white'
                            : isCurrent
                            ? 'bg-[#714b67]/30 border-2 border-[#714b67] text-[#e0bad6]'
                            : 'bg-slate-800 text-slate-500 border border-white/5'
                        }`}
                      >
                        {isCompleted ? '✓' : currentIdx}
                      </div>
                      {idx < totalSteps - 1 && (
                        <div
                          className={`h-0.5 flex-1 mx-1.5 rounded transition-all ${
                            isCompleted ? 'bg-[#714b67]' : 'bg-slate-800'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {stepName && (
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/40 text-[#d4a8c9] text-[11px] font-semibold tracking-wide shadow-sm">
                <span>
                  {stepNumber ? `Step ${stepNumber} of ${totalSteps} • ` : ''}
                  {stepName}
                </span>
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          {/* Clean Borderless Form Container */}
          <div className="w-full animate-in fade-in duration-150">
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
