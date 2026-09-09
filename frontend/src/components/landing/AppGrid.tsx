import React from 'react';

interface AppItem {
  id: string;
  name: string;
  subdomain?: string;
  icon: React.ReactNode;
}

export const AppGrid: React.FC = () => {
  const launcherUrl = '/inventory/dashboard';

  const apps: AppItem[] = [
    {
      id: 'payments',
      name: 'Payments',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <rect x="8" y="14" width="22" height="12" rx="6" transform="rotate(-30 8 14)" fill="#714B67" />
          <rect x="22" y="24" width="22" height="12" rx="6" transform="rotate(-30 22 24)" fill="#FDB02F" />
        </svg>
      ),
    },
    {
      id: 'accounting',
      name: 'Accounting',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <rect x="8" y="8" width="32" height="32" rx="6" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <rect x="14" y="24" width="4" height="10" rx="1" fill="#FDB02F" />
          <rect x="22" y="18" width="4" height="16" rx="1" fill="#FDB02F" />
          <rect x="30" y="14" width="4" height="20" rx="1" fill="#FDB02F" />
          <path d="M12 28 L22 18 L28 22 L36 12" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'pos',
      name: 'POS',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <rect x="10" y="10" width="28" height="20" rx="4" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <rect x="15" y="15" width="18" height="8" rx="2" fill="#FDB02F" />
          <path d="M6 34 L42 34 L38 40 L10 40 Z" fill="#FDB02F" />
          <circle cx="16" cy="37" r="1.5" fill="#714B67" />
          <circle cx="24" cy="37" r="1.5" fill="#714B67" />
          <circle cx="32" cy="37" r="1.5" fill="#714B67" />
        </svg>
      ),
    },
    {
      id: 'inventory',
      name: 'Inventory',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <path d="M10 16 L24 8 L38 16 L38 34 L24 42 L10 34 Z" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <path d="M24 8 L24 42" stroke="#A56F97" strokeWidth="2" />
          <path d="M10 16 L24 24 L38 16" stroke="#A56F97" strokeWidth="2" />
          <rect x="14" y="24" width="8" height="10" rx="1" fill="#FDB02F" />
          <rect x="26" y="24" width="8" height="10" rx="1" fill="#FDB02F" />
        </svg>
      ),
    },
    {
      id: 'invoicing',
      name: 'Invoicing',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <rect x="12" y="8" width="24" height="32" rx="4" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <line x1="18" y1="16" x2="30" y2="16" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          <line x1="18" y1="22" x2="26" y2="22" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="32" r="8" fill="#FDB02F" />
          <path d="M29 32 L31.5 34.5 L35.5 30" stroke="#714B67" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'crm',
      name: 'CRM',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <circle cx="24" cy="24" r="6" fill="#FDB02F" />
          <circle cx="12" cy="14" r="4" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <circle cx="36" cy="14" r="4" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <circle cx="12" cy="34" r="4" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <circle cx="36" cy="34" r="4" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <line x1="15" y1="16" x2="20" y2="21" stroke="#FDB02F" strokeWidth="1.5" />
          <line x1="33" y1="16" x2="28" y2="21" stroke="#FDB02F" strokeWidth="1.5" />
          <line x1="15" y1="32" x2="20" y2="27" stroke="#FDB02F" strokeWidth="1.5" />
          <line x1="33" y1="32" x2="28" y2="27" stroke="#FDB02F" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      id: 'commerce',
      name: 'Commerce',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <path d="M8 12 L14 12 L20 30 L36 30 L40 16 L14 16" stroke="#714B67" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="20" cy="36" r="3" fill="#FDB02F" />
          <circle cx="34" cy="36" r="3" fill="#FDB02F" />
          <rect x="22" y="19" width="10" height="7" rx="1" fill="#FDB02F" />
        </svg>
      ),
    },
    {
      id: 'expenses',
      name: 'Expenses',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <rect x="10" y="12" width="28" height="24" rx="4" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <rect x="14" y="8" width="20" height="8" rx="2" fill="#FDB02F" />
          <circle cx="24" cy="24" r="5" fill="#FDB02F" />
          <path d="M24 21 L24 27" stroke="#714B67" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M22 22 C22 21 26 21 26 23 C26 25 22 25 22 27 C22 28 26 28 26 27" stroke="#714B67" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'projects',
      name: 'Projects',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <rect x="8" y="16" width="32" height="24" rx="4" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <path d="M18 16 V12 C18 10 20 8 22 8 H26 C28 8 30 10 30 12 V16" stroke="#FDB02F" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="20" y="24" width="8" height="6" rx="1" fill="#FDB02F" />
          <line x1="8" y1="22" x2="40" y2="22" stroke="#A56F97" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      id: 'documents',
      name: 'Documents',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <rect x="14" y="8" width="22" height="28" rx="3" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <rect x="10" y="14" width="22" height="28" rx="3" fill="#0d0d10" stroke="#FDB02F" strokeWidth="2" />
          <line x1="16" y1="22" x2="26" y2="22" stroke="#FDB02F" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="28" x2="24" y2="28" stroke="#FDB02F" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="34" x2="21" y2="34" stroke="#FDB02F" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'team',
      name: 'Team',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <circle cx="24" cy="16" r="6" fill="#FDB02F" />
          <path d="M12 36 C12 28 17 26 24 26 C31 26 36 28 36 36" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <circle cx="12" cy="20" r="4" fill="#714B67" />
          <circle cx="36" cy="20" r="4" fill="#714B67" />
        </svg>
      ),
    },
    {
      id: 'payroll',
      name: 'Payroll',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <circle cx="24" cy="15" r="5" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <path d="M15 36 C15 30 19 28 24 28 C29 28 33 30 33 36" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <circle cx="34" cy="34" r="8" fill="#FDB02F" />
          <path d="M34 30 V38 M32 32 C32 31 36 31 36 33 C36 35 32 35 32 37 C32 38 36 38 36 37" stroke="#714B67" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'analytics',
      name: 'Analytics',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <rect x="8" y="28" width="6" height="12" rx="2" fill="#714B67" />
          <rect x="18" y="20" width="6" height="20" rx="2" fill="#FDB02F" />
          <rect x="28" y="12" width="6" height="28" rx="2" fill="#714B67" />
          <rect x="38" y="6" width="6" height="34" rx="2" fill="#FDB02F" />
        </svg>
      ),
    },
    {
      id: 'logistics',
      name: 'Logistics',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <rect x="6" y="16" width="22" height="16" rx="2" fill="#714B67" stroke="#A56F97" strokeWidth="1.5" />
          <path d="M28 20 H36 L40 26 V32 H28 V20 Z" fill="#FDB02F" />
          <circle cx="14" cy="34" r="4" fill="#FDB02F" />
          <circle cx="34" cy="34" r="4" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
        </svg>
      ),
    },
    {
      id: 'marketing',
      name: 'Marketing',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <path d="M10 20 L26 12 V36 L10 28 Z" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <path d="M26 18 C32 18 36 14 36 14 V34 C36 34 32 30 26 30" fill="#FDB02F" />
          <rect x="6" y="20" width="4" height="8" rx="1" fill="#FDB02F" />
          <path d="M14 28 L16 38 H20 L18 28" fill="#FDB02F" />
        </svg>
      ),
    },
    {
      id: 'ai-assistant',
      name: 'AI Assistant',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <circle cx="24" cy="24" r="16" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <path d="M24 14 L26 22 L34 24 L26 26 L24 34 L22 26 L14 24 L22 22 Z" fill="#FDB02F" />
        </svg>
      ),
    },
    {
      id: 'marketplace',
      name: 'Marketplace',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <path d="M8 18 L12 8 H36 L40 18 Z" fill="#FDB02F" />
          <rect x="10" y="18" width="28" height="22" rx="2" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <rect x="18" y="26" width="12" height="14" rx="2" fill="#FDB02F" />
          <path d="M12 18 V22 M20 18 V22 M28 18 V22 M36 18 V22" stroke="#714B67" strokeWidth="2" />
        </svg>
      ),
    },
    {
      id: 'more',
      name: 'More',
      icon: (
        <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none">
          <circle cx="16" cy="16" r="5" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
          <circle cx="32" cy="16" r="5" fill="#FDB02F" />
          <circle cx="16" cy="32" r="5" fill="#FDB02F" />
          <circle cx="32" cy="32" r="5" fill="#714B67" stroke="#A56F97" strokeWidth="2" />
        </svg>
      ),
    },
  ];

  return (
    <section className="w-full max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 py-16">
      <div className="space-y-10">
        
        {/* Section Heading with Subtle African Geometric Accent Lines */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-4">
            {/* Left Pattern */}
            <svg width="120" height="12" viewBox="0 0 120 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#FDB02F] opacity-70">
              <path d="M0 6H12 M18 2L24 10L30 2H18Z M36 6H48 M54 6C54 4.5 56.5 4.5 56.5 6C56.5 7.5 59 7.5 59 6 M65 6H77 M83 2L89 10L95 2H83Z M101 6H113 M118 6A1 1 0 10118 4A1 1 0 10118 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Everything your business needs
            </h2>
            
            {/* Right Pattern */}
            <svg width="120" height="12" viewBox="0 0 120 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#FDB02F] opacity-70">
              <path d="M120 6H108 M102 2L96 10L90 2H102Z M84 6H72 M66 6C66 4.5 63.5 4.5 63.5 6C63.5 7.5 61 7.5 61 6 M55 6H43 M37 2L31 10L25 2H37Z M19 6H7 M2 6A1 1 0 102 4A1 1 0 102 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
        </div>

        {/* 18 App Cards in 6 Columns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {apps.map((app) => (
            <a
              key={app.id}
              href={launcherUrl}
              className="relative overflow-hidden group p-6 rounded-2xl bg-[#0b0b0d] hover:bg-[#121216] border border-white/5 hover:border-[#714B67]/60 transition-all duration-300 flex flex-col items-center justify-center text-center space-y-4 shadow-lg hover:shadow-xl hover:shadow-[#714B67]/15 hover:-translate-y-1"
            >
              {/* Faint Background Pattern */}
              <div 
                className="absolute inset-0 opacity-[0.02] mix-blend-screen pointer-events-none transition-opacity duration-300 group-hover:opacity-[0.04]"
                style={{ backgroundImage: 'url(/africa_pattern_map.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
              />
              
              {/* App Icon Container without borders */}
              <div className="flex items-center justify-center transition-transform duration-300 group-hover:scale-110 mb-1">
                {app.icon}
              </div>

              <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">
                {app.name}
              </span>
            </a>
          ))}
        </div>

      </div>
    </section>
  );
};

export default AppGrid;
