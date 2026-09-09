import React from 'react';
import { ArrowRight, Rocket } from 'lucide-react';

export const CallToAction: React.FC = () => {
  const signupUrl = '/signup';

  return (
    <section className="w-full max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 py-8">
      <div className="rounded-sm bg-[#0b0b0e] border border-[#FDB02F]/20 p-6 sm:p-8 lg:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        
        {/* Ambient Glow */}
        <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-[#714B67]/20 rounded-sm blur-3xl pointer-events-none" />
        <div className="absolute -right-20 -top-20 w-60 h-60 bg-[#FDB02F]/15 rounded-sm blur-3xl pointer-events-none" />

        {/* Left & Middle: Rocket Box & Call to Action text */}
        <div className="flex items-center gap-5 sm:gap-6 z-10">
          {/* Patterned Rocket Container */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-sm bg-gradient-to-br from-[#714B67]/40 to-[#FDB02F]/20 border border-[#FDB02F]/40 flex items-center justify-center text-[#FDB02F] shrink-0 shadow-lg">
            <Rocket className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Ready to transform your business?
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Join thousands of African businesses already growing with Orivio.
            </p>
          </div>
        </div>

        {/* Right: CTA Button */}
        <div className="z-10 w-full md:w-auto flex justify-end">
          <a
            href={signupUrl}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-sm bg-[#714B67] hover:bg-[#86597A] text-white text-sm font-semibold shadow-xl shadow-[#714B67]/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <span>Start free trial</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

      </div>
    </section>
  );
};

export default CallToAction;
