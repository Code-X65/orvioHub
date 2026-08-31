import React, { useState } from 'react';
import { Header } from '@/components/landing/Header';
import { HeroHeader } from '@/components/landing/HeroHeader';
import { AppModules } from '@/components/landing/AppModules';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export const LandingPage: React.FC = () => {
  const [, setSelectedModule] = useState<string>('pos');
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white relative overflow-x-hidden flex flex-col justify-between">
      
      {/* Background Radial Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[550px] bg-radial from-[#714b67]/12 to-transparent pointer-events-none -z-10" />

      {/* 1. Header Navigation Bar */}
      <Header />

      {/* Main Hero Container */}
      <main className="relative flex flex-col items-center flex-1">
        {/* 2. Hero Headline, Handwritten Price & CTAs */}
        <HeroHeader />

        {/* 3. 18 Business Application Cards in Arched Dome Layout */}
        <AppModules onSelectModule={(id) => setSelectedModule(id)} />
      </main>

      {/* Floating Bottom-Right Chat Bubble Button in #714b67 (matching Image 2) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => {
            setIsChatOpen(!isChatOpen);
            if (!isChatOpen) toast.info('Orivo live support is ready to help!');
          }}
          className="w-13 h-13 rounded-full bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white flex items-center justify-center shadow-2xl shadow-[#714b67]/50 hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[#714b67]/30"
          aria-label="Open support chat"
        >
          <MessageSquare className="w-6 h-6 fill-white text-white" />
        </button>
      </div>

      {/* Dark Minimal Footer */}
      <footer className="w-full border-t border-white/5 bg-black py-8">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <div className="relative w-5 h-5 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-5 h-5">
                <circle cx="50" cy="50" r="38" stroke="white" strokeWidth="16" fill="none" />
                <polygon points="50,50 88,12 55,28" fill="#714b67" />
              </svg>
            </div>
            <span>© {new Date().getFullYear()} Orivo. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-slate-300 transition-colors">Terms of Service</a>
            <a href="#pricing" className="hover:text-slate-300 transition-colors">Pricing</a>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 font-semibold border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>All Apps Live</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};
