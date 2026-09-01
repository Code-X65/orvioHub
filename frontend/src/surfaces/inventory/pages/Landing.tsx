import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  ArrowRight,
  Sparkles,
  Check,
  Calendar,
  BarChart3,
  ShieldCheck,
  Store,
  Users,
  CreditCard,
  QrCode,
  Truck,
  Loader2,
  X,
  HelpCircle,
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useHost } from '@/host/useHost';
import { api } from '@/lib/api';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InventoryIcon } from '@/components/icons/InventoryIcon';
import { toast } from 'sonner';
import { getAccountsUrl } from '@orviohub/shared';

export const InventoryLanding: React.FC = () => {
  const navigate = useNavigate();
  const host = useHost();
  const env = host.environment;
  const { isAuthenticated } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();

  const accountsUrl = getAccountsUrl(env);
  const workspaceId = currentWorkspace?.id || localStorage.getItem('orvio_active_workspace_id');

  // Activation check state
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [isCheckingActivation, setIsCheckingActivation] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Book a demo modal state
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoName, setDemoName] = useState('');
  const [demoEmail, setDemoEmail] = useState('');
  const [demoPhone, setDemoPhone] = useState('');
  const [demoBusinessName, setDemoBusinessName] = useState('');
  const [demoMessage, setDemoMessage] = useState('');
  const [demoConsent, setDemoConsent] = useState(true);
  const [demoSubmitting, setDemoSubmitting] = useState(false);

  // FAQ open accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Check product activation for the user's workspace
  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated && workspaceId) {
      setIsCheckingActivation(true);
      api
        .get<{ isActive: boolean }>(
          `/workspaces/${workspaceId}/products/inventory/is-active`
        )
        .then((res) => {
          if (isMounted && res) {
            setIsActivated(Boolean(res.isActive));
          }
        })
        .catch(() => {
          if (isMounted) {
            // Default to true if already in workspace
            setIsActivated(true);
          }
        })
        .finally(() => {
          if (isMounted) setIsCheckingActivation(false);
        });
    } else {
      setIsActivated(null);
      setIsCheckingActivation(false);
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, workspaceId]);

  // Handle product activation
  const handleActivateProduct = async () => {
    if (!workspaceId) return;
    setIsActivating(true);
    try {
      await api.post(
        `/workspaces/${workspaceId}/products/inventory/activate`,
        { planId: 'standard' }
      );
      toast.success('Inventory & POS activated successfully!');
      setIsActivated(true);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to activate Inventory module.');
    } finally {
      setIsActivating(false);
    }
  };

  // Determine dynamic CTA properties
  const getCtaConfig = () => {
    if (!isAuthenticated) {
      const returnUrl = typeof window !== 'undefined' ? window.location.href : '';
      return {
        text: 'Sign Up Free',
        href: `${accountsUrl}/signup?product=inventory&returnUrl=${encodeURIComponent(returnUrl)}`,
        action: undefined,
        primary: true,
      };
    }

    if (!workspaceId) {
      return {
        text: 'Create Organization',
        href: undefined,
        action: () => navigate('/onboarding'),
        primary: true,
      };
    }

    if (isActivated === false) {
      return {
        text: 'Activate Inventory',
        href: undefined,
        action: handleActivateProduct,
        primary: true,
        loading: isActivating,
      };
    }

    return {
      text: 'Go to Dashboard',
      href: undefined,
      action: () => navigate('/dashboard'),
      primary: true,
    };
  };

  const cta = getCtaConfig();

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoName.trim() || !demoEmail.trim()) {
      toast.error('Please provide your name and email.');
      return;
    }
    if (!demoConsent) {
      toast.error('Please agree to receive demo communication.');
      return;
    }
    setDemoSubmitting(true);
    setTimeout(() => {
      setDemoSubmitting(false);
      setDemoModalOpen(false);
      toast.success('Demo request received! Our product team will reach out shortly.');
    }, 600);
  };

  const features = [
    {
      icon: <Store className="w-6 h-6 text-[#FDB02F]" />,
      title: 'Multi-Branch Inventory',
      description: 'Manage warehouse counts, branch transfers, automated reorder thresholds, and low-stock telemetry across all retail locations.',
    },
    {
      icon: <QrCode className="w-6 h-6 text-emerald-400 text-emerald-400" />,
      title: 'Barcode Scanner & POS',
      description: 'Lightning-fast retail terminal with instant barcode recognition, cash drawer reconciliation, split tenders, and receipt generation.',
    },
    {
      icon: <Truck className="w-6 h-6 text-sky-400" />,
      title: 'Supplier & Purchase Orders',
      description: 'Track incoming vendor consignments, purchase order approvals, cost price history, and automated stock replenishment.',
    },
    {
      icon: <Users className="w-6 h-6 text-purple-400" />,
      title: 'Branch-Scoped Staff Roles',
      description: 'Granular permissions for Cashiers, Stock Managers, and Branch Supervisors with tamper-evident audit logs.',
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-amber-400" />,
      title: 'Real-Time Sales Telemetry',
      description: 'Live profit margins, revenue breakdowns, top-selling SKUs, and daily reconciliation reports across all branches.',
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-rose-400" />,
      title: 'Enterprise Security & Backup',
      description: 'Encrypted cloud backups, NDPR compliance, offline resilience, and automatic synchronization across all devices.',
    },
  ];

  const pricingPlans = [
    {
      name: 'Starter / Free Trial',
      price: 'Free',
      period: 'for 14 days',
      description: 'Perfect for single-store retailers testing out real-time inventory and POS.',
      features: [
        '1 Retail Branch or Warehouse',
        'Up to 500 Product SKUs',
        'Unlimited POS Transactions',
        'Basic Daily Sales Reports',
        'Single Cashier Account',
      ],
      ctaText: isAuthenticated ? 'Start Free Trial' : 'Sign Up Free',
      popular: false,
    },
    {
      name: 'Standard Retail',
      price: '₦7,500',
      period: '/ month',
      description: 'Built for growing retail businesses with high sales volume and barcode scanning.',
      features: [
        'Up to 3 Branches & Warehouses',
        'Unlimited Product SKUs',
        'Barcode Generation & POS',
        'Multi-tender & Split Payments',
        'Stock Movement & Transfer Logs',
        'Branch Cashier & Manager Roles',
      ],
      ctaText: isAuthenticated ? 'Select Standard' : 'Start with Standard',
      popular: true,
    },
    {
      name: 'Enterprise Scale',
      price: '₦20,000',
      period: '/ month',
      description: 'For multi-branch supermarket chains, wholesale distributors, and warehouse networks.',
      features: [
        'Unlimited Branches & Warehouses',
        'Automated Purchase Reorders',
        'Supplier Consignment Tracking',
        'Custom Staff Roles & Audit Logs',
        'Priority 24/7 Phone Support',
        'Dedicated Solutions Onboarding',
      ],
      ctaText: 'Contact Enterprise',
      popular: false,
    },
  ];

  const faqs = [
    {
      question: 'Can I use barcode scanners and thermal receipt printers?',
      answer: 'Yes! Orviohub Inventory works with standard USB and Bluetooth barcode scanners as well as standard 58mm/80mm thermal receipt printers without needing proprietary hardware.',
    },
    {
      question: 'How does multi-branch stock transfer work?',
      answer: 'You can initiate stock transfers between any of your registered branches or central warehouse. The receiving branch verifies item counts upon delivery, automatically updating both balances in real time.',
    },
    {
      question: 'Can staff members see sensitive profit margin data?',
      answer: 'No. Branch-scoped cashier accounts only have access to POS checkout and stock lookup. Cost prices, profit margins, and supplier purchase orders are restricted to Admins and Managers.',
    },
    {
      question: 'Is my data secure and backed up?',
      answer: 'All transactions, stock levels, and receipts are encrypted and backed up continuously in real time with 99.9% uptime SLA.',
    },
  ];

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white flex flex-col justify-between">
      {/* Universal Top Header */}
      <Header />

      {/* SEO Semantic Header Structure */}
      <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-24">
        {/* Hero Section */}
        <section aria-labelledby="hero-heading" className="space-y-12">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-12">
            {/* Left Hero Content */}
            <div className="space-y-6 max-w-2xl">
              {/* Product Badge */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#1a0f18] border border-[#714b67]/40 flex items-center justify-center text-[#FDB02F] shadow-lg">
                  <InventoryIcon className="w-7 h-7" />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Production Ready • Live in Workspace</span>
                </div>
              </div>

              {/* Main Headline */}
              <h1
                id="hero-heading"
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight"
              >
                Inventory & POS Management for Modern Businesses
              </h1>

              {/* Tagline & Subtext */}
              <p className="text-lg sm:text-xl text-slate-300 font-light leading-relaxed">
                Track warehouse stock, record rapid POS sales, manage multi-branch transfers, and prevent stock-outs across your entire business.
              </p>

              <p className="text-sm text-slate-400 leading-relaxed">
                Designed specifically for high-speed retail checkout, supermarkets, pharmacies, electronics distributors, and wholesale operations in Nigeria and emerging markets.
              </p>

              {/* CTA Buttons */}
              <div className="pt-4 flex flex-wrap items-center gap-4">
                {cta.href ? (
                  <a
                    href={cta.href}
                    className="h-12 px-7 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white font-semibold text-xs rounded-lg shadow-xl shadow-[#714b67]/30 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>{cta.text}</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                ) : (
                  <Button
                    type="button"
                    onClick={cta.action}
                    disabled={cta.loading || isCheckingActivation}
                    className="h-12 px-7 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white font-semibold text-xs rounded-lg shadow-xl shadow-[#714b67]/30 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {cta.loading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                    <span>{cta.text}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDemoModalOpen(true)}
                  className="h-12 px-6 bg-[#140e12] hover:bg-[#20151c] border-white/15 text-white font-medium text-xs rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Calendar className="w-4 h-4 text-[#c79dbd]" />
                  <span>Book Guided Demo</span>
                </Button>
              </div>
            </div>

            {/* Right Hero Live Terminal Preview */}
            <div className="w-full lg:max-w-[500px] p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-[#180e16] via-[#110910] to-black border border-[#2d1827] shadow-2xl space-y-5 relative group overflow-hidden">
              {/* African Decorative Stroke Accent */}
              <div
                className="absolute -top-10 -right-10 w-36 h-36 opacity-15 pointer-events-none group-hover:opacity-30 transition-opacity"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0L40 20L20 40L0 20Z' fill='none' stroke='%23FDB02F' stroke-width='2'/%3E%3Cpath d='M10 10L30 30M10 30L30 10' stroke='%23714B67' stroke-width='2'/%3E%3C/svg%3E\")",
                  backgroundSize: '40px 40px',
                }}
              />

              <div className="flex items-center justify-between pb-3.5 border-b border-white/10 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#714b67] flex items-center justify-center text-white shadow-sm">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Main Hub Telemetry</span>
                    <span className="text-[10px] text-slate-400">Lagos Central Warehouse</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  ● Online Sync
                </span>
              </div>

              <div className="space-y-2.5 relative z-10">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-300">Total Warehouse Stock Units</span>
                  <span className="font-mono font-bold text-white text-sm">4,820 Pcs</span>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-300">Active POS Terminals</span>
                  <span className="font-mono font-bold text-emerald-400">4 Online (Branches 1–3)</span>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-300">Today's Sales Recorded</span>
                  <span className="font-mono font-bold text-[#FDB02F] text-sm">₦384,200</span>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-300">Low-Stock Auto Alerts</span>
                  <span className="font-mono font-bold text-amber-400">2 Items Reordered</span>
                </div>
              </div>

              <div className="pt-2 relative z-10">
                {cta.href ? (
                  <a
                    href={cta.href}
                    className="w-full h-11 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Launch Interactive POS Demo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <Button
                    type="button"
                    onClick={cta.action}
                    className="w-full h-11 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Launch Interactive POS Demo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid Section */}
        <section aria-labelledby="features-heading" className="space-y-10 pt-10 border-t border-white/5">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#FDB02F] uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>Full Operational Capability</span>
            </div>
            <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Everything Your Store Needs to Scale
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Eliminate manual stock-taking discrepancies, manage employee cash-ups, and get instant visibility across multiple branches.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-gradient-to-br from-[#140c12]/90 to-black border border-white/10 space-y-3.5 hover:border-[#714b67]/50 hover:shadow-xl hover:shadow-[#714b67]/10 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                  {feat.icon}
                </div>
                <h3 className="text-base font-bold text-white">{feat.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{feat.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Section */}
        <section aria-labelledby="pricing-heading" className="space-y-10 pt-10 border-t border-white/5">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#FDB02F] uppercase tracking-wider">
              <CreditCard className="w-3 h-3" />
              <span>Transparent Pricing</span>
            </div>
            <h2 id="pricing-heading" className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Predictable Plans with Zero Hidden Fees
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Start with a 14-day free trial on any tier. Upgrade or change your branches anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {pricingPlans.map((plan, idx) => (
              <div
                key={idx}
                className={`p-7 rounded-2xl flex flex-col justify-between space-y-6 relative transition-all duration-300 ${
                  plan.popular
                    ? 'bg-gradient-to-b from-[#241320] via-[#140b12] to-black border-2 border-[#714b67] shadow-2xl shadow-[#714b67]/25 lg:-translate-y-2'
                    : 'bg-[#120b10] border border-white/10 hover:border-white/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#714b67] border border-[#FDB02F] text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                    Most Popular
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{plan.description}</p>
                  </div>

                  <div className="flex items-baseline gap-1 pt-2 pb-1 border-b border-white/5">
                    <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                      {plan.price}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{plan.period}</span>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    {plan.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2.5 text-xs text-slate-300">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  {cta.href ? (
                    <a
                      href={cta.href}
                      className={`w-full h-11 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        plan.popular
                          ? 'bg-[#714b67] hover:bg-[#86597a] text-white shadow-lg shadow-[#714b67]/30'
                          : 'bg-white/10 hover:bg-white/15 text-white'
                      }`}
                    >
                      <span>{plan.ctaText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <Button
                      type="button"
                      onClick={cta.action}
                      className={`w-full h-11 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        plan.popular
                          ? 'bg-[#714b67] hover:bg-[#86597a] text-white shadow-lg shadow-[#714b67]/30'
                          : 'bg-white/10 hover:bg-white/15 text-white'
                      }`}
                    >
                      <span>{plan.ctaText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section aria-labelledby="faq-heading" className="space-y-8 pt-10 border-t border-white/5 max-w-3xl mx-auto w-full">
          <div className="text-center space-y-2">
            <h2 id="faq-heading" className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs text-slate-400">Everything you need to know about setting up your stores.</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-white/10 bg-[#120b10] overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between text-xs sm:text-sm font-semibold text-white hover:text-[#FDB02F] transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-4 text-xs text-slate-300 leading-relaxed border-t border-white/5 pt-3">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Final High-Converting CTA Banner */}
        <section className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#2a1324] via-[#190d16] to-[#0c060b] border border-[#714b67]/40 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left relative overflow-hidden">
          <div className="space-y-2.5 max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Ready to Upgrade Your Retail & Stock Operations?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Join leading retail chains, supermarkets, and suppliers managing operations on Orviohub.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            {cta.href ? (
              <a
                href={cta.href}
                className="h-12 px-7 bg-[#FDB02F] hover:bg-[#fca510] text-slate-950 font-bold text-xs rounded-lg shadow-lg flex items-center gap-2 transition-transform hover:scale-[1.02] cursor-pointer"
              >
                <span>{cta.text}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            ) : (
              <Button
                type="button"
                onClick={cta.action}
                className="h-12 px-7 bg-[#FDB02F] hover:bg-[#fca510] text-slate-950 font-bold text-xs rounded-lg shadow-lg flex items-center gap-2 transition-transform hover:scale-[1.02] cursor-pointer"
              >
                <span>{cta.text}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setDemoModalOpen(true)}
              className="h-12 px-6 border-white/20 text-white hover:bg-white/10 text-xs font-medium rounded-lg cursor-pointer"
            >
              <span>Book Guided Demo</span>
            </Button>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-white/5 bg-black py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Orviohub Inc. • Multi-Tenant Inventory & POS Platform
      </footer>

      {/* Book a Demo Modal */}
      {demoModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !demoSubmitting) {
              setDemoModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-lg bg-[#120b10] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setDemoModalOpen(false)}
              disabled={demoSubmitting}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 mb-6">
              <div className="inline-flex items-center gap-1 text-[11px] text-[#c79dbd] font-semibold bg-[#714b67]/20 px-2.5 py-0.5 rounded-full border border-[#714b67]/30 mb-1">
                <Calendar className="w-3 h-3 text-[#FDB02F]" />
                <span>Product Guided Walkthrough</span>
              </div>
              <h3 className="text-xl font-bold text-white">Book an Inventory & POS Demo</h3>
              <p className="text-xs text-slate-400">
                Get a personalized 15-minute tour tailored to your store setup.
              </p>
            </div>

            <form onSubmit={handleDemoSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Your Full Name *</Label>
                  <Input
                    placeholder="e.g. Alex Johnson"
                    value={demoName}
                    onChange={(e) => setDemoName(e.target.value)}
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-lg text-xs"
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
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-lg text-xs"
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
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Store / Business Name</Label>
                  <Input
                    placeholder="Acme Supermarket Ltd"
                    value={demoBusinessName}
                    onChange={(e) => setDemoBusinessName(e.target.value)}
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-300">What would you like to explore?</Label>
                <textarea
                  placeholder="e.g. We have 3 branches and want barcode scanning with centralized stock replenishment..."
                  value={demoMessage}
                  onChange={(e) => setDemoMessage(e.target.value)}
                  className="w-full h-20 p-3 bg-[#0e0a0d] border border-white/10 text-white rounded-lg text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[#714b67]"
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
                  I agree to receive product demo updates from Orviohub specialists.
                </label>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={demoSubmitting}
                  className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white font-semibold text-xs rounded-lg shadow-lg shadow-[#714b67]/25 cursor-pointer flex items-center justify-center gap-2"
                >
                  {demoSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{demoSubmitting ? 'Submitting...' : 'Schedule Live Product Walkthrough'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryLanding;
