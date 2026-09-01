import React from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { Header } from '@/components/landing/Header';
import { ProductCatalog } from '@/surfaces/launcher/pages/ProductCatalog';

export const AppLauncher: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white flex flex-col justify-between">
      {/* Top Universal Landing Header */}
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12">
        {/* Unified Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
            One Unified Platform.<br />Every App Your Business Needs.
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {isAuthenticated
              ? 'Select any application below to explore its live workspace or request early access.'
              : 'Explore our connected suite of business applications. Select any app to get started with an organization or try free for 14 days.'}
          </p>
        </div>

        {/* Product Catalog Section */}
        <ProductCatalog />
      </main>

      <footer className="w-full border-t border-white/5 bg-black py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Orviohub Inc. • Multi-Tenant Application Operating Platform
      </footer>
    </div>
  );
};

export default AppLauncher;
