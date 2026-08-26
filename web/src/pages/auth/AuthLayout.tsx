import React from 'react';
import { Header } from '@/components/landing/Header';

interface AuthLayoutProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, fullWidth = false }) => {
  return (
    <div className="min-h-screen flex flex-col bg-black text-slate-100 selection:bg-[#714b67] selection:text-white relative overflow-x-hidden">
      {/* Top Main Navigation Header (Present on all pages) */}
      <Header />

      {/* Background Subtle Radial Glow */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-radial from-[#714b67]/15 to-transparent pointer-events-none -z-10" />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10">
        <div className={`w-full ${fullWidth ? 'max-w-[1240px]' : 'max-w-[460px]'} mx-auto`}>
          {children}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-white/5 bg-black py-6">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} Orivo Inc. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-slate-300 transition-colors">Terms of Service</a>
            <a href="#help" className="hover:text-slate-300 transition-colors">Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
