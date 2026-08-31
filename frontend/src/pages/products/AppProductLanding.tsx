import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHost } from '@/host/useHost';
import {
  getAccountsUrl,
  getLauncherUrl,
  getApplicationUrl,
} from '@orviohub/shared';
import {
  Boxes,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Bell,
  ArrowLeft,
  Calendar,
  X,
} from 'lucide-react';

interface AppMeta {
  name: string;
  category: string;
  tagline: string;
  description: string;
  features: string[];
  isActiveProduct?: boolean;
}

const APP_REGISTRY: Record<string, AppMeta> = {
  inventory: {
    name: 'Inventory Management',
    category: 'Supply & Operations',
    tagline: 'Real-time multi-branch stock tracking, barcodes & automated reordering.',
    description:
      'A high-performance inventory hub built for scale. Manage warehouse levels, branch transfers, automated reorder thresholds, supplier orders, and low-stock telemetry across all physical and online stores.',
    features: [
      'Multi-branch and warehouse stock synchronization',
      'SKU & Barcode generation with real-time barcode scanning',
      'Automated purchase orders & low-stock replenishment',
      'Branch-scoped staff roles (Cashier, Stock Manager, Attendant)',
      'Instant stock movements, audits, and damage logs',
    ],
    isActiveProduct: true,
  },
  pos: {
    name: 'Point of Sale',
    category: 'Retail & Checkout',
    tagline: 'Lightning-fast retail terminal with offline resilience and receipt printing.',
    description:
      'Seamless in-store checkout experience integrated directly with your Orivo inventory catalog. Fast barcode lookup, multi-tender payments, cashier shifts, and customer receipts.',
    features: [
      'Instant barcode scanning & quick-key touch layout',
      'Split tender payments (Cash, Card, Transfer)',
      'Cash drawer and shift reconciliation reporting',
      'Direct sync with centralized inventory warehouse',
    ],
    isActiveProduct: true,
  },
  taskmanagement: {
    name: 'Task Management',
    category: 'Productivity & Collaboration',
    tagline: 'Streamline team workflows, sprint planning, and project milestones.',
    description:
      'Organize team operations with flexible Kanban boards, automated assignment rules, subtask tracking, and timeline schedules.',
    features: [
      'Custom Kanban boards & agile sprint workflows',
      'Automated task assignments based on workload',
      'Granular permissions and cross-department milestones',
      'Integrated time tracking and deadline reminders',
    ],
    isActiveProduct: true,
  },
  accounting: {
    name: 'Accounting & Bookkeeping',
    category: 'Finance & Compliance',
    tagline: 'Automated double-entry bookkeeping, tax reports, and multi-currency ledgers.',
    description:
      'Real-time financial management that syncs automatically with sales, purchases, and payroll. Generate compliant balance sheets, P&L statements, and tax summaries.',
    features: [
      'Automated journal entries from sales & inventory',
      'Bank feeds & reconciliation rules',
      'Multi-currency exchange rate adjustments',
      'Comprehensive P&L and tax export',
    ],
    isActiveProduct: false,
  },
  crm: {
    name: 'CRM & Pipeline',
    category: 'Sales & Customer Growth',
    tagline: 'Convert leads, manage client communications, and accelerate deals.',
    description:
      'Complete contact directory and sales pipeline tracking. Track conversations across email, phone, and messaging with automated deal scoring.',
    features: [
      'Visual deal stage pipeline & sales forecasts',
      'Automated follow-up reminders and email logging',
      'Customer lifetime value & purchase history',
    ],
    isActiveProduct: false,
  },
};

export const AppProductLanding: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const host = useHost();
  const env = host.environment;
  const { user, isAuthenticated } = useAuthStore();

  const launcherUrl = getLauncherUrl(env);
  const accountsUrl = getAccountsUrl(env);
  const marketingUrl = getApplicationUrl('marketing', env);

  const currentKey = (appId || (host.application === 'inventory' ? 'inventory' : host.application === 'taskmanagement' ? 'taskmanagement' : 'inventory')).toLowerCase();
  const meta: AppMeta = APP_REGISTRY[currentKey] || {
    name: currentKey.charAt(0).toUpperCase() + currentKey.slice(1),
    category: 'Business Application',
    tagline: 'Streamlined enterprise application for modern teams.',
    description: `The ${currentKey} module is part of the unified Orivo business platform. It gives your team real-time visibility, automated workflows, and multi-device support.`,
    features: [
      'Multi-workspace collaboration and access controls',
      'Real-time audit logs and security telemetry',
      'Cross-app data sync across all your Orivo tools',
      'Instant cloud backups and NDPR compliance',
    ],
    isActiveProduct: false,
  };

  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [isJoined, setIsJoined] = useState(false);

  // Demo Request Modal State
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoName, setDemoName] = useState('');
  const [demoEmail, setDemoEmail] = useState('');
  const [demoPhone, setDemoPhone] = useState('');
  const [demoBusinessName, setDemoBusinessName] = useState('');
  const [demoMessage, setDemoMessage] = useState('');
  const [demoConsent, setDemoConsent] = useState(true);
  const [demoSubmitting, setDemoSubmitting] = useState(false);

  const handleJoinWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail || !waitlistEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setIsJoined(true);
    toast.success(`You are on the waitlist for ${meta.name}! We'll notify you as soon as it launches.`);
  };

  const handleSubmitDemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoName.trim() || !demoEmail.trim()) {
      toast.error('Please provide your name and work email');
      return;
    }
    if (!demoConsent) {
      toast.error('Please agree to be contacted for the demo');
      return;
    }
    setDemoSubmitting(true);
    setTimeout(() => {
      setDemoSubmitting(false);
      setDemoModalOpen(false);
      toast.success('Demo request received! Our product specialist will reach out shortly.');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white flex flex-col justify-between">
      {/* Top Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        {/* Back Link */}
        <div className="mb-8">
          <a
            href={launcherUrl}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Apps</span>
          </a>
        </div>

        {meta.isActiveProduct ? (
          /* Active Production Ready View */
          <div className="space-y-16 animate-in fade-in duration-200">
            {/* Hero Section */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10">
              <div className="space-y-4 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xs bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Production Ready • Live in Workspace</span>
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight font-serif">
                  {meta.name}
                </h1>

                <p className="text-lg sm:text-xl text-slate-300 font-light leading-relaxed">
                  {meta.tagline}
                </p>

                <p className="text-sm text-slate-400 leading-relaxed">
                  {meta.description}
                </p>

                <div className="pt-4 flex flex-wrap items-center gap-4">
                  <Button
                    onClick={() => {
                      if (isAuthenticated && user) {
                        navigate('/dashboard');
                      } else {
                        window.location.href = `${accountsUrl}/signup?product=${currentKey}`;
                      }
                    }}
                    className="bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white font-semibold text-xs px-6 py-3 rounded-xs h-12 shadow-lg shadow-[#714b67]/25 flex items-center gap-2 cursor-pointer"
                  >
                    <span>
                      {isAuthenticated && user
                        ? 'Open Dashboard'
                        : 'Start Free Trial'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDemoModalOpen(true)}
                    className="bg-[#140e12] hover:bg-[#20151c] border-white/10 text-white font-medium text-xs px-5 py-3 rounded-xs h-12 flex items-center gap-2 cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-[#c79dbd]" />
                    <span>Book a Demo</span>
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => {
                      window.location.href = `${marketingUrl}/pricing`;
                    }}
                    className="text-xs text-slate-300 hover:text-white font-medium"
                  >
                    <span>View Pricing Plans</span>
                  </Button>
                </div>
              </div>

              {/* Product Preview Card */}
              <div className="w-full lg:max-w-[480px] p-6 rounded-2xl bg-gradient-to-br from-[#180e16] to-[#0f080e] border border-[#2d1827] shadow-2xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xs bg-[#714b67] flex items-center justify-center text-white">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-white">Live Central Hub</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-xs border border-emerald-500/30">
                    Active Sync
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-lg border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-slate-300">Warehouse Stock Count</span>
                    <span className="font-mono font-bold text-white">4,280 Pcs</span>
                  </div>
                  <div className="p-3 rounded-lg border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-slate-300">Active POS Registers</span>
                    <span className="font-mono font-bold text-emerald-400">3 Online</span>
                  </div>
                  <div className="p-3 rounded-lg border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-slate-300">Today's Sales Recorded</span>
                    <span className="font-mono font-bold text-white">₦248,500</span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    if (isAuthenticated && user) {
                      navigate('/dashboard');
                    } else {
                      window.location.href = `${accountsUrl}/signup?product=inventory`;
                    }
                  }}
                  variant="outline"
                  className="w-full h-10 bg-white/5 hover:bg-white/10 border-white/10 text-white rounded-xs text-xs font-semibold cursor-pointer"
                >
                  Explore Interactive Live POS Terminal
                </Button>
              </div>
            </div>

            {/* Features Checklist */}
            <div className="pt-12 border-t border-white/5">
              <h3 className="text-xl font-bold text-white mb-6">Core Capabilities</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {meta.features.map((feat, i) => (
                  <div key={i} className="p-4 rounded-sm bg-[#120b10] border border-white/5 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#c79dbd] shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-slate-200">{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Coming Soon / Beta View */
          <div className="flex flex-col items-center text-center space-y-6 py-12 animate-in fade-in duration-200">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xs bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>In Active Development • Beta Coming Soon</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight font-serif">
              {meta.name}
            </h1>

            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl font-light leading-relaxed">
              {meta.description}
            </p>

            {/* Early Access Notification Form */}
            <div className="w-full max-w-md pt-4">
              {isJoined ? (
                <div className="p-4 rounded-xs bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>You're registered for early beta access!</span>
                </div>
              ) : (
                <form onSubmit={handleJoinWaitlist} className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Enter your email for beta access"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    className="bg-[#140d12] border-[#2d1b27] text-white text-xs rounded-xs h-11 focus:ring-1 focus:ring-[#714b67]"
                  />
                  <Button
                    type="submit"
                    className="bg-[#714b67] hover:bg-[#86597a] text-white font-semibold text-xs px-5 rounded-xs h-11 whitespace-nowrap shadow-md shadow-[#714b67]/25 cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5 mr-1.5" />
                    <span>Notify Me</span>
                  </Button>
                </form>
              )}
            </div>

            {/* Cross-Promo: Try Active Inventory App */}
            <div className="w-full max-w-xl mt-12 p-6 rounded-2xl bg-gradient-to-r from-[#170e15] to-[#120a11] border border-[#2d1827] flex flex-col sm:flex-row items-center justify-between gap-4 text-left shadow-xl">
              <div>
                <div className="text-xs font-bold text-[#c79dbd] uppercase tracking-wider mb-1">
                  Ready To Explore Today
                </div>
                <h4 className="text-base font-bold text-white">Orivo Inventory & POS</h4>
                <p className="text-xs text-slate-400">
                  Full stock control, warehouse transfers & multi-branch management.
                </p>
              </div>
              <Button
                onClick={() => {
                  window.location.href = getApplicationUrl('inventory', env);
                }}
                className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-4 py-2 rounded-xs whitespace-nowrap cursor-pointer"
              >
                <span>Try Inventory</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Book a Demo Modal */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#120b10] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setDemoModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 mb-6">
              <div className="inline-flex items-center gap-1 text-[11px] text-[#c79dbd] font-semibold bg-[#714b67]/20 px-2 py-0.5 rounded-xs border border-[#714b67]/30 mb-1">
                <Calendar className="w-3 h-3" />
                <span>Product Walkthrough</span>
              </div>
              <h3 className="text-xl font-bold text-white">Book an {meta.name} Demo</h3>
              <p className="text-xs text-slate-400">
                Get a personalized guided tour from our solutions team.
              </p>
            </div>

            <form onSubmit={handleSubmitDemo} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Your Full Name *</Label>
                  <Input
                    placeholder="e.g. Alex Johnson"
                    value={demoName}
                    onChange={(e) => setDemoName(e.target.value)}
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Work Email *</Label>
                  <Input
                    type="email"
                    placeholder="alex@company.com"
                    value={demoEmail}
                    onChange={(e) => setDemoEmail(e.target.value)}
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Phone / WhatsApp</Label>
                  <Input
                    placeholder="+234 800 000 0000"
                    value={demoPhone}
                    onChange={(e) => setDemoPhone(e.target.value)}
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Business / Store Name</Label>
                  <Input
                    placeholder="Acme Stores Ltd"
                    value={demoBusinessName}
                    onChange={(e) => setDemoBusinessName(e.target.value)}
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-300">What would you like to explore?</Label>
                <textarea
                  placeholder="e.g. We have 3 retail branches and want to sync our stock and barcode scanning..."
                  value={demoMessage}
                  onChange={(e) => setDemoMessage(e.target.value)}
                  className="w-full h-20 p-3 bg-[#0e0a0d] border border-white/10 text-white rounded-xs text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[#714b67]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="consent"
                  checked={demoConsent}
                  onChange={(e) => setDemoConsent(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#0e0a0d] border-white/10 text-[#714b67] focus:ring-0"
                />
                <label htmlFor="consent" className="text-[11px] text-slate-400">
                  I agree to receive product demo communication from Orivo specialists.
                </label>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={demoSubmitting}
                  className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white font-semibold text-xs rounded-xs shadow-lg shadow-[#714b67]/25 cursor-pointer"
                >
                  {demoSubmitting ? 'Submitting Request...' : 'Schedule Live Product Walkthrough'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
