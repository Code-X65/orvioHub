import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Boxes,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  Layers,
  Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Question 1: Previous Tools
const PREVIOUS_TOOLS_OPTIONS = [
  { id: 'notebooks', label: 'Notebooks / Paper Records', desc: 'Handwritten sales ledgers and paper tally sheets' },
  { id: 'excel_sheets', label: 'Excel / Google Sheets', desc: 'Manual spreadsheets on computer or phone' },
  { id: 'whatsapp', label: 'WhatsApp / Chat Notes', desc: 'Message threads, notes, or mobile chat logs' },
  { id: 'other_pos', label: 'Another Software / POS', desc: 'Legacy POS terminal or previous software app' },
  { id: 'memory', label: 'Memory / No Formal System', desc: 'Informal estimation without consistent logs' },
  { id: 'other', label: 'Other Method', desc: 'Custom system or combination' },
];

// Question 2: Pain Points
const PAIN_POINTS_OPTIONS = [
  { id: 'stockouts_overstock', label: 'Stockouts & Overstocking', desc: 'Running out of hot sellers or tying up cash in dead stock' },
  { id: 'inaccurate_counts', label: 'Inaccurate Counts', desc: 'Physical inventory does not match written records' },
  { id: 'lost_records', label: 'Lost Records & Slips', desc: 'Missing sales slips, receipts, or altered registers' },
  { id: 'staff_theft', label: 'Staff Leakage & Theft', desc: 'Unaccounted stock disappearance and cash discrepancies' },
  { id: 'unknown_profit', label: 'Hard to Know Profit', desc: 'Unclear exact daily sales margins and actual business profit' },
  { id: 'debt_tracking', label: 'Hard to Track Debts', desc: 'Struggling to follow up on customer credit and balances' },
  { id: 'other', label: 'Other Operational Challenge', desc: 'General friction in day-to-day operations' },
];

// Question 3: Priority Features (Limit 3)
const PRIORITY_FEATURES_OPTIONS = [
  { id: 'pos_sales', label: 'Fast POS Checkout', desc: 'Issue receipts and ring up sales in seconds' },
  { id: 'stock_tracking', label: 'Real-time Stock Tracking', desc: 'Live quantity monitoring across shelves' },
  { id: 'purchases_suppliers', label: 'Purchases & Suppliers', desc: 'Track supply orders, invoices, and restocks' },
  { id: 'customer_debts', label: 'Customer Debts & Credit', desc: 'Customer accounts, balance reminders, credit limits' },
  { id: 'low_stock_alerts', label: 'Low Stock Alerts', desc: 'Proactive warnings before critical goods run dry' },
  { id: 'reports_analytics', label: 'Sales & Profit Reports', desc: 'Daily/monthly performance metrics and valuations' },
  { id: 'offline_mode', label: 'Offline Resiliency', desc: 'Keep recording when internet connectivity fluctuates' },
  { id: 'other', label: 'Other Core Feature', desc: 'Custom tools tailored for our workflow' },
];

// Question 5: Team Comfort Level
const TEAM_COMFORT_OPTIONS = [
  { id: 'very', label: 'Very comfortable', desc: 'Tech-savvy team that learns software very quickly' },
  { id: 'somewhat', label: 'Somewhat comfortable', desc: 'Regular smartphone users who prefer clean, guided steps' },
  { id: 'not_very', label: 'Not very comfortable', desc: 'Prefer minimal typing, big buttons, and simple workflows' },
  { id: 'not_at_all', label: 'First time with business apps', desc: 'Transitioning from completely offline paper processes' },
];

export const InventoryAppOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgParam = searchParams.get('org');

  const { currentWorkspace, workspaces, fetchWorkspaces, selectWorkspace } = useWorkspaceStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Questionnaire States
  const [currentStep, setCurrentStep] = useState<number>(1); // 1 to 5
  const [previousTools, setPreviousTools] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [priorityFeatures, setPriorityFeatures] = useState<string[]>([]);
  const [needsMultiBranch, setNeedsMultiBranch] = useState<boolean | null>(null);
  const [teamComfortLevel, setTeamComfortLevel] = useState<string>('somewhat');

  const activeOrgId = orgParam || currentWorkspace?.id || localStorage.getItem('orvio_active_workspace_id') || workspaces[0]?.workspace?.id;
  const activeOrgName = currentWorkspace?.name || workspaces.find((w) => w.workspace.id === activeOrgId)?.workspace.name || 'Your Business';

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        let wsList = workspaces;
        if (wsList.length === 0) {
          wsList = await fetchWorkspaces('inventory');
        }

        const resolvedOrg = orgParam || currentWorkspace?.id || wsList[0]?.workspace?.id;
        if (resolvedOrg && mounted) {
          localStorage.setItem('orvio_active_workspace_id', resolvedOrg);
          if (currentWorkspace?.id !== resolvedOrg) {
            await selectWorkspace(resolvedOrg).catch(() => {});
          }

          // Verify that application is activated for this organization (US-A2)
          const appStatus = await api
            .get<{ success: boolean; data?: { active: boolean } }>(
              `/organizations/${resolvedOrg}/applications/inventory/status`
            )
            .catch(() => null);

          if (appStatus?.data && appStatus.data.active === false) {
            navigate(`/onboard/activate?org=${resolvedOrg}`, { replace: true });
            return;
          }

          // Check if onboarding responses already recorded
          const statusRes = await api
            .get<{ completed: boolean; responses?: any }>(`/organizations/${resolvedOrg}/inventory-onboarding`)
            .catch(() => null);

          if (statusRes?.completed) {
            // If already completed, check branch preferences or forward
            const isMulti = statusRes.responses?.needsMultiBranch;
            if (isMulti) {
              navigate(`/onboard/branch-multi?org=${resolvedOrg}`, { replace: true });
            } else {
              navigate(`/onboard/branch-single?org=${resolvedOrg}`, { replace: true });
            }
            return;
          }
        }
      } catch {
        // Proceed with questionnaire
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [orgParam, currentWorkspace?.id, workspaces.length, fetchWorkspaces, selectWorkspace, navigate]);

  const toggleMultiSelect = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    id: string,
    limit?: number
  ) => {
    if (list.includes(id)) {
      setList(list.filter((x) => x !== id));
    } else {
      if (limit && list.length >= limit) {
        toast.info(`You can select up to ${limit} items for this question.`);
        return;
      }
      setList([...list, id]);
    }
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (skipAll: boolean = false) => {
    if (!activeOrgId) {
      toast.error('No organization selected.');
      return;
    }

    setIsLoading(true);
    try {
      const finalNeedsMulti = skipAll ? false : needsMultiBranch ?? false;

      const payload = {
        previousTools: skipAll ? [] : previousTools,
        painPoints: skipAll ? [] : painPoints,
        priorityFeatures: skipAll ? [] : priorityFeatures,
        needsMultiBranch: finalNeedsMulti,
        teamComfortLevel: skipAll ? 'somewhat' : teamComfortLevel,
      };

      await api.post(`/organizations/${activeOrgId}/inventory-onboarding`, payload);

      toast.success('Inventory preferences saved!');

      // Route according to US-3:
      // If single location -> US-4A /onboard/branch-single
      // If multiple branches -> US-4B /onboard/branch-multi
      if (finalNeedsMulti) {
        navigate(`/onboard/branch-multi?org=${activeOrgId}`);
      } else {
        navigate(`/onboard/branch-single?org=${activeOrgId}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save Inventory preferences.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <Spinner size="lg" className="text-[#714b67]" />
        <p className="text-xs text-slate-400">Loading Inventory onboarding...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-[#714b67] selection:text-white">
      {/* Top Bar Header */}
      <header className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-[#0d090d]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#714b67] flex items-center justify-center text-white font-bold text-sm shadow-md">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>{activeOrgName}</span>
              <span className="text-slate-500">•</span>
              <span className="text-[#c79dbd]">Inventory App Onboarding</span>
            </div>
            <p className="text-[10px] text-slate-400">Help us tailor Inventory for your business</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isLoading}
          className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-white/5"
        >
          Skip for now
        </button>
      </header>

      {/* Main Questionnaire Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8 animate-in fade-in duration-300">
        {/* Step Badge & Title */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold">
              <Sparkles className="w-3 h-3 text-[#FDB02F]" />
              <span>Question {currentStep} of 5</span>
            </div>
            <span className="text-xs font-medium text-slate-400">Step {currentStep} / 5</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {currentStep === 1 && 'How were you tracking inventory and sales before Orviohub?'}
            {currentStep === 2 && 'What is your biggest pain point with your current setup?'}
            {currentStep === 3 && 'Which features are most important to you right now?'}
            {currentStep === 4 && 'Do you need to track multiple branches or locations?'}
            {currentStep === 5 && 'How comfortable is your team with apps and software?'}
          </h1>

          <p className="text-xs text-slate-400">
            {currentStep === 1 && 'Select all that apply to help us migrate or import your previous system.'}
            {currentStep === 2 && 'Choose the issues you would most like Orviohub to solve.'}
            {currentStep === 3 && 'Select up to 3 priority features to customize your shortcuts.'}
            {currentStep === 4 && 'This determines whether we configure a single primary branch or guide you through branch setup.'}
            {currentStep === 5 && 'We adjust interface density and helper tips based on your team’s comfort level.'}
          </p>

          {/* Progress bar */}
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#c79dbd] h-full rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* QUESTION 1: Previous Tools */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PREVIOUS_TOOLS_OPTIONS.map((opt) => {
              const selected = previousTools.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleMultiSelect(previousTools, setPreviousTools, opt.id)}
                  className={cn(
                    'p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3',
                    selected
                      ? 'bg-[#21111e] border-[#714b67] shadow-lg shadow-[#714b67]/20 ring-1 ring-[#714b67]'
                      : 'bg-[#120b10] border-white/10 hover:border-white/25 hover:bg-white/[0.02]'
                  )}
                >
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">{opt.label}</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{opt.desc}</p>
                  </div>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                      selected
                        ? 'bg-[#714b67] border-[#714b67] text-white'
                        : 'border-white/20 bg-black/40 text-transparent'
                    )}
                  >
                    <Check className="w-3 h-3" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* QUESTION 2: Pain Points */}
        {currentStep === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PAIN_POINTS_OPTIONS.map((opt) => {
              const selected = painPoints.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleMultiSelect(painPoints, setPainPoints, opt.id)}
                  className={cn(
                    'p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3',
                    selected
                      ? 'bg-[#21111e] border-[#714b67] shadow-lg shadow-[#714b67]/20 ring-1 ring-[#714b67]'
                      : 'bg-[#120b10] border-white/10 hover:border-white/25 hover:bg-white/[0.02]'
                  )}
                >
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">{opt.label}</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{opt.desc}</p>
                  </div>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                      selected
                        ? 'bg-[#714b67] border-[#714b67] text-white'
                        : 'border-white/20 bg-black/40 text-transparent'
                    )}
                  >
                    <Check className="w-3 h-3" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* QUESTION 3: Priority Features (Limit 3) */}
        {currentStep === 3 && (
          <div className="space-y-3">
            <div className="text-[11px] text-[#c79dbd] font-semibold flex items-center justify-between px-1">
              <span>Selected: {priorityFeatures.length} / 3</span>
              {priorityFeatures.length === 3 && <span className="text-amber-300 font-bold">Maximum 3 selected</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PRIORITY_FEATURES_OPTIONS.map((opt) => {
                const selected = priorityFeatures.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleMultiSelect(priorityFeatures, setPriorityFeatures, opt.id, 3)}
                    className={cn(
                      'p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3',
                      selected
                        ? 'bg-[#21111e] border-[#714b67] shadow-lg shadow-[#714b67]/20 ring-1 ring-[#714b67]'
                        : 'bg-[#120b10] border-white/10 hover:border-white/25 hover:bg-white/[0.02]'
                    )}
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white">{opt.label}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{opt.desc}</p>
                    </div>
                    <div
                      className={cn(
                        'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                        selected
                          ? 'bg-[#714b67] border-[#714b67] text-white'
                          : 'border-white/20 bg-black/40 text-transparent'
                      )}
                    >
                      <Check className="w-3 h-3" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* QUESTION 4: Multi-Branch / Location Need */}
        {currentStep === 4 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Option A: Single Location */}
            <div
              onClick={() => setNeedsMultiBranch(false)}
              className={cn(
                'p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4',
                needsMultiBranch === false
                  ? 'bg-gradient-to-br from-[#291325] via-[#140b12] to-black border-[#714b67] shadow-xl shadow-[#714b67]/25 ring-1 ring-[#714b67]'
                  : 'bg-[#120b10] border-white/10 hover:border-white/25 hover:bg-white/[0.02]'
              )}
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#714b67]/25 border border-[#714b67]/40 flex items-center justify-center text-white font-bold">
                  <Store className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">One Primary Location</h3>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                      Free Trial & Standard
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Single retail shop, store, or warehouse. We will auto-create your "Main Store" so you can start POS checkouts and stock tracking immediately.
                  </p>
                </div>
              </div>
              <div className="pt-2 flex items-center justify-between text-xs font-semibold">
                <span className={needsMultiBranch === false ? 'text-white' : 'text-slate-500'}>
                  1 Branch (Main Store)
                </span>
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border flex items-center justify-center transition-colors',
                    needsMultiBranch === false ? 'bg-[#714b67] border-[#714b67] text-white' : 'border-white/20'
                  )}
                >
                  {needsMultiBranch === false && <Check className="w-3 h-3" />}
                </div>
              </div>
            </div>

            {/* Option B: Multiple Branches */}
            <div
              onClick={() => setNeedsMultiBranch(true)}
              className={cn(
                'p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4',
                needsMultiBranch === true
                  ? 'bg-gradient-to-br from-[#291325] via-[#140b12] to-black border-[#714b67] shadow-xl shadow-[#714b67]/25 ring-1 ring-[#714b67]'
                  : 'bg-[#120b10] border-white/10 hover:border-white/25 hover:bg-white/[0.02]'
              )}
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#714b67]/25 border border-[#714b67]/40 flex items-center justify-center text-white font-bold">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Multiple Branches</h3>
                    <span className="text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                      Standard Plan
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Two or more locations (up to 3 branches on Standard Plan). Configure individual stock tracking, separate POS registers, and manager assignments per location.
                  </p>
                </div>
              </div>
              <div className="pt-2 flex items-center justify-between text-xs font-semibold">
                <span className={needsMultiBranch === true ? 'text-white' : 'text-slate-500'}>
                  Up to 3 Branches (Standard)
                </span>
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border flex items-center justify-center transition-colors',
                    needsMultiBranch === true ? 'bg-[#714b67] border-[#714b67] text-white' : 'border-white/20'
                  )}
                >
                  {needsMultiBranch === true && <Check className="w-3 h-3" />}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QUESTION 5: Team Comfort Level */}
        {currentStep === 5 && (
          <div className="space-y-3">
            {TEAM_COMFORT_OPTIONS.map((opt) => {
              const selected = teamComfortLevel === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setTeamComfortLevel(opt.id)}
                  className={cn(
                    'p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3',
                    selected
                      ? 'bg-[#21111e] border-[#714b67] shadow-lg shadow-[#714b67]/20 ring-1 ring-[#714b67]'
                      : 'bg-[#120b10] border-white/10 hover:border-white/25 hover:bg-white/[0.02]'
                  )}
                >
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">{opt.label}</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{opt.desc}</p>
                  </div>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                      selected ? 'bg-[#714b67] border-[#714b67] text-white' : 'border-white/20 bg-black/40'
                    )}
                  >
                    {selected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Navigation & Submission Controls */}
        <div className="flex items-center justify-between pt-6 border-t border-white/10">
          <div>
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isLoading}
                className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs px-4"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                <span>Back</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleNext}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer px-2"
            >
              Skip this question
            </button>

            <Button
              type="button"
              onClick={handleNext}
              disabled={isLoading || (currentStep === 4 && needsMultiBranch === null)}
              className="bg-[#714b67] hover:bg-[#86597a] text-white font-bold text-xs px-6 py-2.5 shadow-lg shadow-[#714b67]/30 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  <span>Saving...</span>
                </>
              ) : currentStep < 5 ? (
                <>
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </>
              ) : (
                <>
                  <span>Complete Onboarding</span>
                  <CheckCircle2 className="w-3.5 h-3.5 ml-1.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};
