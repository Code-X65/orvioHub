import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface AppItem {
  id: string;
  name: string;
  description: string;
  route?: string;
  isAvailable?: boolean;
  icon: React.ReactNode;
}

const APPS: AppItem[] = [
  {
    id: 'accounting',
    name: 'Accounting',
    description: 'Double-entry bookkeeping, multi-currency tax & instant P&L reporting.',
    route: '/app/accounting',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <circle cx="27" cy="24" r="10" fill="#F59E0B" />
        <circle cx="39" cy="40" r="10" fill="#14B8A6" />
        <rect x="26" y="6" width="12" height="52" rx="6" fill="#935a87" transform="rotate(45 32 32)" />
      </svg>
    ),
  },
  {
    id: 'knowledge',
    name: 'Knowledge',
    description: 'Centralized team wiki, SOPs, documentation & enterprise search.',
    route: '/app/knowledge',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <path d="M19 16 H35 V48 L27 42 L19 48 Z" fill="#935a87" />
        <path d="M27 12 H43 V44 L35 38 L27 44 Z" fill="#14B8A6" opacity="0.9" />
      </svg>
    ),
  },
  {
    id: 'sign',
    name: 'Sign',
    description: 'Cryptographic digital signatures & document approval flows.',
    route: '/app/sign',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <path
          d="M17 41 C 19 27, 26 19, 33 19 C 37 19, 37 27, 30 35 C 26 41, 22 43, 34 43 C 44 43, 47 37, 47 33"
          fill="none"
          stroke="#06B6D4"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="38" y1="35" x2="47" y2="35" stroke="#06B6D4" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'crm',
    name: 'CRM',
    description: 'Visual deal pipeline, customer interaction history & lead scoring.',
    route: '/app/crm',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <path d="M14 26 L28 40 L36 32 L22 18 Z" fill="#14B8A6" />
        <path d="M50 26 L36 40 L28 32 L42 18 Z" fill="#EC4899" />
        <circle cx="32" cy="36" r="4.5" fill="#935a87" />
      </svg>
    ),
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'No-code custom fields, automated triggers & screen designer.',
    route: '/app/studio',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <path d="M18 18 L46 46 M46 18 L18 46" stroke="#A855F7" strokeWidth="6" strokeLinecap="round" />
        <circle cx="18" cy="18" r="5" fill="#06B6D4" />
        <circle cx="46" cy="46" r="5" fill="#EC4899" />
        <circle cx="46" cy="18" r="5" fill="#06B6D4" />
        <circle cx="18" cy="46" r="5" fill="#EC4899" />
      </svg>
    ),
  },
  {
    id: 'subscriptions',
    name: 'Subscriptions',
    description: 'Recurring billing cycles, dunning management & MRR telemetry.',
    route: '/app/subscriptions',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <path d="M20 32 A 12 12 0 0 1 38 22" fill="none" stroke="#F97316" strokeWidth="5" strokeLinecap="round" />
        <circle cx="38" cy="22" r="3.5" fill="#F97316" />
        <path d="M44 32 A 12 12 0 0 1 26 42" fill="none" stroke="#10B981" strokeWidth="5" strokeLinecap="round" />
        <circle cx="26" cy="42" r="3.5" fill="#10B981" />
      </svg>
    ),
  },
  {
    id: 'ai',
    name: 'AI',
    description: 'Autonomous copilot for inventory predictions, sales & reports.',
    route: '/app/ai',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <defs>
          <linearGradient id="aiGradApps" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="50%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <text x="32" y="44" fontSize="26" fontWeight="900" fontFamily="system-ui" textAnchor="middle" fill="url(#aiGradApps)">
          AI
        </text>
      </svg>
    ),
  },
  {
    id: 'pos',
    name: 'Point of Sale',
    description: 'Fast barcode checkout, cash drawer shifts & offline resilience.',
    route: '/app/inventory',
    isAvailable: true,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <path d="M16 26 L22 42 H42 L48 26 Z" fill="#8B5CF6" />
        <path d="M14 26 Q 32 30 50 26 L46 20 H18 Z" fill="#F59E0B" />
        <line x1="26" y1="20" x2="26" y2="42" stroke="#4C1D95" strokeWidth="2" />
        <line x1="38" y1="20" x2="38" y2="42" stroke="#4C1D95" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: 'discuss',
    name: 'Discuss',
    description: 'Team direct messages, channel threads & audio huddles.',
    route: '/app/discuss',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <path d="M18 20 Q 32 16 46 20 Q 48 34 38 42 L 34 48 L 30 42 Q 16 40 18 20 Z" fill="#F97316" />
      </svg>
    ),
  },
  {
    id: 'documents',
    name: 'Documents',
    description: 'Cloud document management, folders & version control.',
    route: '/app/documents',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <rect x="25" y="16" width="21" height="29" rx="3" fill="#F59E0B" transform="rotate(10 35 31)" />
        <rect x="18" y="18" width="21" height="29" rx="3" fill="#06B6D4" />
      </svg>
    ),
  },
  {
    id: 'project',
    name: 'Project',
    description: 'Agile Kanban boards, sprint backlogs & task assignments.',
    route: '/app/project',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <path d="M18 34 L 28 44 L 46 22" fill="none" stroke="#06B6D4" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 38 L 28 44 L 38 30" fill="none" stroke="#A855F7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'timesheets',
    name: 'Timesheets',
    description: 'Stopwatch timer, employee hours & billable project rates.',
    route: '/app/timesheets',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <circle cx="32" cy="34" r="16" stroke="#0284C7" strokeWidth="4" fill="#0C1B2A" />
        <line x1="32" y1="34" x2="42" y2="24" stroke="#F43F5E" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="34" r="2.5" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: 'invoicing',
    name: 'Invoicing',
    description: 'Instant PDF invoices, automated payment reminders & receipts.',
    route: '/app/invoicing',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <path d="M34 14 L 18 34 H 30 L 26 50 L 46 28 H 32 Z" fill="#F59E0B" />
        <path d="M34 14 L 28 26 H 38 Z" fill="#A855F7" />
      </svg>
    ),
  },
  {
    id: 'inventory',
    name: 'Inventory',
    description: 'Multi-branch stock tracking, barcodes & automated reordering.',
    route: '/app/inventory',
    isAvailable: true,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <rect x="18" y="24" width="12" height="16" rx="2" fill="#F59E0B" />
        <rect x="34" y="24" width="12" height="16" rx="2" fill="#06B6D4" />
        <polygon points="26,20 22,24 26,28" fill="#F59E0B" />
        <polygon points="38,36 42,40 38,44" fill="#06B6D4" />
      </svg>
    ),
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    description: 'Patient records, clinical appointments & medical inventory.',
    route: '/app/healthcare',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <rect x="28" y="16" width="8" height="32" rx="3" fill="#10B981" />
        <rect x="16" y="28" width="32" height="8" rx="3" fill="#06B6D4" />
      </svg>
    ),
  },
  {
    id: 'purchase',
    name: 'Purchase',
    description: 'Supplier purchase orders, goods receipts & vendor management.',
    route: '/app/purchase',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <path d="M20 26 L24 44 H40 L44 26 Z" fill="#714b67" />
        <path d="M26 26 A 6 6 0 0 1 38 26" fill="none" stroke="#A78BFA" strokeWidth="3" />
      </svg>
    ),
  },
  {
    id: 'manufacturing',
    name: 'Manufacturing',
    description: 'Bills of Materials (BOM), work orders & shopfloor scheduling.',
    route: '/app/manufacturing',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <path d="M16 26 C 24 18, 40 18, 48 26 C 40 34, 24 34, 16 26 Z" fill="#06B6D4" />
        <path d="M16 38 C 24 30, 40 30, 48 38 C 40 46, 24 46, 16 38 Z" fill="#3B82F6" />
      </svg>
    ),
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Email campaigns, SMS marketing & automated subscriber lists.',
    route: '/app/marketing',
    isAvailable: false,
    icon: (
      <svg viewBox="0 0 64 64" className="w-full h-full max-w-[52px] max-h-[52px] sm:max-w-[62px] sm:max-h-[62px]">
        <polygon points="16,34 48,16 36,48 30,36" fill="#8B5CF6" />
        <polygon points="30,36 48,16 36,48" fill="#3B82F6" opacity="0.8" />
      </svg>
    ),
  },
];

interface AppModulesProps {
  activeModule?: string;
  onSelectModule?: (id: string) => void;
}

export const AppModules: React.FC<AppModulesProps> = ({ onSelectModule }) => {
  const navigate = useNavigate();
  const [hoveredAppId, setHoveredAppId] = useState<string | null>(null);

  const handleAppClick = (app: AppItem) => {
    if (onSelectModule) onSelectModule(app.id);
    if (app.route) navigate(app.route);
  };

  return (
    <section id="apps" className="w-full max-w-[1240px] mx-auto pt-8 pb-28 px-4 sm:px-6">
      {/* 6 columns on desktop, 3 columns on tablet/mobile */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-x-6 sm:gap-x-10 md:gap-x-12 gap-y-8 sm:gap-y-10 justify-items-center">
        {APPS.map((app) => {
          const isHovered = hoveredAppId === app.id;
          return (
            <div
              key={app.id}
              className="relative flex flex-col items-center group"
              onMouseEnter={() => setHoveredAppId(app.id)}
              onMouseLeave={() => setHoveredAppId(null)}
            >
              {/* Smooth Animated Popover on Hover */}
              {isHovered && (
                <div className="absolute bottom-full mb-3 w-52 p-3 rounded-sm bg-[#181116] border border-white/10 text-left shadow-2xl shadow-black z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-white">{app.name}</span>
                    {app.isAvailable ? (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded-xs border border-emerald-500/30">
                        Live
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-[#c79dbd] bg-[#251521] px-1.5 py-0.5 rounded-xs border border-[#44253b]">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {app.description}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleAppClick(app)}
                className="flex flex-col items-center cursor-pointer focus:outline-none"
              >
                {/* Large Squircle App Icon Tile */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl sm:rounded-3xl bg-[#141417] hover:bg-[#1e1e24] border border-white/[0.08] hover:border-white/20 flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-black/70 shadow-lg p-3 sm:p-4">
                  {app.icon}
                </div>

                {/* Clean White Text Label */}
                <span className="mt-3 text-xs sm:text-sm md:text-[15px] font-medium text-slate-200 group-hover:text-white transition-colors text-center truncate max-w-[110px]">
                  {app.name}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
