import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, CheckCircle2, X } from 'lucide-react';

export const HeroCTA: React.FC = () => {
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  return (
    <>
      <div className="w-full max-w-2xl mx-auto px-4 pt-2 pb-16 text-center flex flex-col items-center">
        
        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto">
          
          {/* Primary CTA */}
          <Link
            to="/signup"
            className="group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 text-base font-bold text-white bg-[#0066FF] hover:bg-[#0052CC] active:bg-[#0047B3] rounded-2xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 hover:-translate-y-0.5"
          >
            <span>Get Started Free</span>
            <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>

          {/* Secondary CTA */}
          <button
            onClick={() => setDemoModalOpen(true)}
            className="group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 text-base font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-blue-300 rounded-2xl transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 focus:outline-none"
          >
            <span>Book a Demo</span>
            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-colors">
              <Play className="w-3 h-3 fill-current ml-0.5" />
            </div>
          </button>

        </div>

        {/* 3 Reassurance Points */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs sm:text-sm font-medium text-slate-500">
          
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>No credit card required</span>
          </div>

          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>Easy setup</span>
          </div>

          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>Cancel anytime</span>
          </div>

        </div>

      </div>

      {/* Interactive Demo Video Modal */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200">
            <button
              onClick={() => setDemoModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-left mb-5">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Product Walkthrough</span>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">Experience OrvioHub in Action</h3>
              <p className="text-sm text-slate-600">See how CRM, Sales, HR, and Accounting integrate into one dashboard.</p>
            </div>

            {/* Interactive demo preview card */}
            <div className="relative aspect-video w-full rounded-2xl bg-gradient-to-tr from-slate-900 to-blue-950 flex flex-col items-center justify-center text-white p-6 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
              <img src="/orvio-logo.png" alt="OrvioHub" className="h-10 w-auto mb-4 invert brightness-200 opacity-90" />
              <div className="text-lg font-bold">Interactive Guided Tour</div>
              <p className="text-xs text-blue-200/80 max-w-sm text-center mt-1">
                Explore connected workflows across Lagos, Nairobi, London, and global operations.
              </p>
              <Link
                to="/signup"
                className="mt-6 px-6 py-2.5 rounded-sm bg-blue-600 hover:bg-blue-500 font-semibold text-xs text-white shadow-lg transition-all"
              >
                Launch Free Sandbox Workspace →
              </Link>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setDemoModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
