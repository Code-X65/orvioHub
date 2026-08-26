import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { ModuleCard, ModuleInfo } from '@/components/onboarding/ModuleCard';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Package, Users, TrendingUp, PieChart, Briefcase, ClipboardList, ArrowRight, Layers } from 'lucide-react';

const MODULES_CATALOG: ModuleInfo[] = [
  {
    id: 'inventory',
    name: 'Inventory & Stock Management',
    desc: 'Multi-warehouse stock tracking, low-stock alerts, barcodes, and POS terminal ready.',
    icon: Package,
    category: 'Operations',
    isComingSoon: false,
  },
  {
    id: 'customers',
    name: 'Customers CRM',
    desc: 'Centralized customer directory, contact history, and pipeline lead stages.',
    icon: Users,
    category: 'Core CRM',
    isComingSoon: true,
  },
  {
    id: 'sales',
    name: 'Sales & Deals',
    desc: 'Quotes, orders, deal stage velocity, and revenue forecasting.',
    icon: TrendingUp,
    category: 'Revenue',
    isComingSoon: true,
  },
  {
    id: 'finance',
    name: 'Finance & Ledger',
    desc: 'Invoicing, expenses, general ledger, and financial reporting.',
    icon: PieChart,
    category: 'Accounting',
    isComingSoon: true,
  },
  {
    id: 'hr',
    name: 'HR & People',
    desc: 'Employee directory, payroll records, leave tracking, and departments.',
    icon: Briefcase,
    category: 'Workforce',
    isComingSoon: true,
  },
  {
    id: 'projects',
    name: 'Projects & Tasks',
    desc: 'Kanban boards, milestone tracking, team assignments, and time logs.',
    icon: ClipboardList,
    category: 'Productivity',
    isComingSoon: true,
  },
];

export const ModuleSelection: React.FC = () => {
  const navigate = useNavigate();
  const { refreshSession, onboardingStatus } = useAuthStore();
  const [selected, setSelected] = useState<Set<string>>(new Set(['inventory']));
  const [isLoading, setIsLoading] = useState(false);

  const toggleModule = (id: string) => {
    const mod = MODULES_CATALOG.find((m) => m.id === id);
    if (mod?.isComingSoon) return;

    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size === 1) {
        toast.info('At least one application must remain selected.');
        return;
      }
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const onSubmit = async () => {
    if (selected.size === 0) {
      toast.error('Please select at least one active application to continue.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/onboarding/modules', {
        modules: Array.from(selected),
        organizationId: onboardingStatus?.organization?.id,
      });

      await refreshSession();
      navigate('/onboarding/workspace');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save application selection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OnboardingLayout
      title="Choose the applications your business needs"
      subtitle="Select the applications you wish to enable for your organization."
    >
      <div className="space-y-4">
        {/* Module Cards Grid */}
        <div className="grid grid-cols-1 gap-2.5">
          {MODULES_CATALOG.map((mod) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              isSelected={selected.has(mod.id)}
              onToggle={toggleModule}
              disabled={isLoading}
            />
          ))}
        </div>

        {/* Selected Count & Action */}
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Layers className="w-3.5 h-3.5 text-[#c79dbd]" />
            <span>
              <strong className="text-white font-bold">{selected.size}</strong> application active
            </span>
          </div>

          <Button
            type="button"
            onClick={onSubmit}
            className="w-full sm:w-auto h-10 px-6 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            disabled={isLoading || selected.size === 0}
          >
            {isLoading ? <Spinner size="sm" className="mr-1 text-white" /> : null}
            {isLoading ? 'Activating Applications...' : (
              <>
                <span>Continue to Provisioning</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  );
};
