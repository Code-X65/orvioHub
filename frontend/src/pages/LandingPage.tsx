import React, { useState } from 'react';
import { Header } from '@/components/landing/Header';
import { HeroSection } from '@/components/landing/HeroSection';
import { AfricanPatternDivider } from '@/components/landing/AfricanPatternDivider';
import { AppGrid } from '@/components/landing/AppGrid';
import { GrowthSection } from '@/components/landing/GrowthSection';
import { LandingPricingSection } from '@/components/landing/LandingPricingSection';
import { CallToAction } from '@/components/landing/CallToAction';
import { Footer } from '@/components/landing/Footer';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { SeoMeta } from '@/components/seo/SeoMeta';

export const LandingPage: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714B67] selection:text-white relative overflow-x-hidden flex flex-col justify-between">
      <SeoMeta
        title="Orviohub • All-in-One Cloud Business Operating Platform"
        description="Run your retail, wholesale, multi-branch inventory, invoicing, POS, and team workspaces with Orviohub."
        softwareApplication={{
          name: 'Orviohub Platform',
          applicationCategory: 'BusinessApplication',
        }}
      />
      
      {/* Background Ambient Radial Glows in Royal Purple (#714B67) & Golden Amber (#FDB02F) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1440px] h-[600px] bg-radial from-[#714B67]/15 via-transparent to-transparent pointer-events-none -z-10" />
      <div className="absolute top-[800px] right-0 w-[500px] h-[500px] bg-radial from-[#FDB02F]/5 via-transparent to-transparent pointer-events-none -z-10" />

      {/* 1. Header Navigation Bar */}
      <Header />

      {/* Main Page Flow */}
      <main className="relative flex flex-col items-center flex-1 w-full">
        {/* 2. Hero Section: "One platform. Built for Africa." + Pattern Map + Floating Stats */}
        <HeroSection />

        {/* 3. African Geometric Pattern Divider Band */}
        <AfricanPatternDivider opacity={0.7} />

        {/* 4. 18 Business Applications Grid: "Everything your business needs" */}
        <AppGrid />

        {/* 5. "Powering growth across Africa" with African Businesswoman & Business Health Meter */}
        <GrowthSection />

        {/* 6. Pricing Section: 3 Tiers, Billing Toggle & Start Free Trial CTA */}
        <LandingPricingSection />

        {/* 7. African Geometric Pattern Divider Band */}
        <AfricanPatternDivider opacity={0.5} />

        {/* 8. "Ready to transform your business?" Call To Action Banner */}
        <CallToAction />
      </main>

      {/* Floating Bottom-Right Support Chat Bubble */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => {
            setIsChatOpen(!isChatOpen);
            if (!isChatOpen) toast.info('Orivio Live Support is ready to assist you!');
          }}
          className="w-13 h-13 rounded-sm bg-[#714B67] hover:bg-[#86597A] active:bg-[#603F57] text-white flex items-center justify-center shadow-2xl shadow-[#714B67]/50 hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[#714B67]/30"
          aria-label="Open support chat"
        >
          <MessageSquare className="w-6 h-6 fill-white text-white" />
        </button>
      </div>

      {/* 7. Comprehensive Brand Footer */}
      <Footer />

    </div>
  );
};

export default LandingPage;
