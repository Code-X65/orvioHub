import React from 'react';

export const TrustSection: React.FC = () => {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 pt-4 pb-8 text-center">
      {/* Small centered label */}
      <p className="text-xs sm:text-sm font-medium text-slate-500 uppercase tracking-wider mb-5">
        Trusted by forward-thinking businesses
      </p>

      {/* 5 Subtle monochrome fictional company logos */}
      <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 md:gap-12 opacity-65 grayscale hover:grayscale-0 hover:opacity-90 transition-all duration-300">
        
        {/* TechNova */}
        <div className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          <span className="font-bold tracking-tight text-[15px]">TechNova</span>
        </div>

        {/* BrightEdge */}
        <div className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
          <span className="font-bold tracking-tight text-[15px]">BrightEdge</span>
        </div>

        {/* Flexware */}
        <div className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </svg>
          <span className="font-bold tracking-tight text-[15px]">Flexware</span>
        </div>

        {/* Novatek */}
        <div className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="font-bold tracking-tight text-[15px]">Novatek</span>
        </div>

        {/* Cloudix */}
        <div className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
          </svg>
          <span className="font-bold tracking-tight text-[15px]">Cloudix</span>
        </div>

      </div>
    </div>
  );
};
