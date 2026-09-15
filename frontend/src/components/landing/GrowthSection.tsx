import React from 'react';
import AfricanPatternDivider from './AfricanPatternDivider';

export const GrowthSection: React.FC = () => {
  const countries = [
    { name: 'Nigeria', code: 'NG', flagSvg: '🇳🇬' },
    { name: 'Ghana', code: 'GH', flagSvg: '🇬🇭' },
    { name: 'Kenya', code: 'KE', flagSvg: '🇰🇪' },
    { name: 'South Africa', code: 'ZA', flagSvg: '🇿🇦' },
    { name: 'Egypt', code: 'EG', flagSvg: '🇪🇬' },
  ];

  return (
    <section className="w-full max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 py-12">
      <div className="rounded-sm bg-[#09090b] border border-white/10 overflow-hidden relative shadow-2xl">
        
        {/* Main Grid Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center p-8 sm:p-12 lg:p-14">
          
          {/* Left Column: Headline, Copy & Country Badges */}
          <div className="lg:col-span-6 space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Powering growth<br />
              across <span className="text-[#FDB02F]">Africa</span>
            </h2>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-md">
              From startups to enterprises, we help African businesses work smarter, move faster and scale bigger.
            </p>

            {/* Country Flag Badges */}
            <div className="flex items-center gap-3 pt-4">
              {countries.map((c) => (
                <div
                  key={c.code}
                  title={c.name}
                  className="w-10 h-10 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center text-xl hover:scale-110 transition-transform shadow-md cursor-default"
                >
                  <span>{c.flagSvg}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Hero Image with Floating Business Health Donut Card */}
          <div className="lg:col-span-6 relative flex items-center justify-center">
            
            {/* Businesswoman Photo Container */}
            <div className="relative w-full max-w-[500px] rounded-sm overflow-hidden shadow-2xl border border-white/10 aspect-[16/10]">
              <img
                src="/african_business_owner.jpg"
                alt="African business owner using Orivio"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>

            {/* Floating Circular Metric Card ("Business health") */}
            <div className="absolute -bottom-4 right-2 sm:right-6 w-[170px] sm:w-[190px] p-4 rounded-sm bg-[#0f0f13]/95 border border-white/15 shadow-2xl backdrop-blur-xl space-y-2 z-10 animate-in fade-in">
              <p className="text-[11px] font-semibold text-slate-300">Business health</p>

              <div className="flex items-center justify-center py-1">
                {/* Circular Donut Progress Ring */}
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-white/10"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-[#FDB02F]"
                      strokeDasharray="85, 100"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-base font-extrabold text-white">85%</span>
                    <span className="text-[9px] text-[#FDB02F] font-semibold">Excellent</span>
                  </div>
                </div>
              </div>

              {/* Gold wavy sparkline */}
              <div className="w-full h-4">
                <svg viewBox="0 0 100 20" className="w-full h-full" fill="none">
                  <path
                    d="M 0 15 Q 25 5, 50 12 T 100 4"
                    stroke="#FDB02F"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

          </div>

        </div>

        {/* African Pattern Bottom Footer Strip */}
        <div className="w-full border-t border-white/10 bg-black/40">
          <AfricanPatternDivider opacity={0.6} />
        </div>

      </div>
    </section>
  );
};

export default GrowthSection;
