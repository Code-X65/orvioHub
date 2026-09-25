import React, { useState, useEffect, useTransition } from 'react';
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
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWizardDraft } from '@/hooks/useWizardDraft';

export interface InventoryQuestionnaireDraft {
  previousTools: string[];
  painPoints: string[];
  priorityFeatures: string[];
  teamComfortLevel: string;
}

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

// Question 4: Team Comfort Level
const TEAM_COMFORT_OPTIONS = [
  { id: 'very', label: 'Very comfortable', desc: 'Tech-savvy team that learns software very quickly' },
  { id: 'somewhat', label: 'Somewhat comfortable', desc: 'Regular smartphone users who prefer clean, guided steps' },
  { id: 'not_very', label: 'Not very comfortable', desc: 'Prefer minimal typing, big buttons, and simple workflows' },
  { id: 'not_at_all', label: 'First time with business apps', desc: 'Transitioning from completely offline paper processes' },
];

export const InventoryAppOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgParam = searchParams.get('org');

  const { currentWorkspace, workspaces, fetchWorkspaces, selectWorkspace } = useWorkspaceStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Questionnaire States (4 Questions)
  const urlStep = Number(searchParams.get('step'));
  const [currentStep, setCurrentStep] = useState<number>(
    urlStep >= 1 && urlStep <= 4 ? urlStep : 1
  );
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [, startTransition] = useTransition();
  const [previousTools, setPreviousTools] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [priorityFeatures, setPriorityFeatures] = useState<string[]>([]);
  const [teamComfortLevel, setTeamComfortLevel] = useState<string>('somewhat');

  const activeOrgId = orgParam || currentWorkspace?.id || localStorage.getItem('orvio_active_workspace_id') || workspaces[0]?.workspace?.id;
  const activeOrgName = currentWorkspace?.name || workspaces.find((w) => w.workspace.id === activeOrgId)?.workspace.name || 'Your Business';

  const goToStep = (nextStep: number, isBackward = false) => {
    setDirection(isBackward ? 'backward' : 'forward');
    startTransition(() => {
      setCurrentStep(nextStep);
    });
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('step', String(nextStep));
      if (activeOrgId && !next.has('org')) {
        next.set('org', activeOrgId);
      }
      return next;
    }, { replace: true });

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Sync step changes from browser Back/Forward navigation
  useEffect(() => {
    const s = Number(searchParams.get('step'));
    if (s >= 1 && s <= 4 && s !== currentStep) {
      setDirection(s < currentStep ? 'backward' : 'forward');
      startTransition(() => {
        setCurrentStep(s);
      });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [searchParams, currentStep]);

  const { hasDraft, getSavedDraft, saveDraft, clearDraft } =
    useWizardDraft<InventoryQuestionnaireDraft>({
      storageKey: activeOrgId ? `orvio_inv_onboarding_${activeOrgId}` : 'orvio_inv_onboarding_draft',
      isMeaningful: (d) =>
        (d.previousTools?.length || 0) > 0 ||
        (d.painPoints?.length || 0) > 0 ||
        (d.priorityFeatures?.length || 0) > 0,
    });

  // Restore draft answers from useWizardDraft on mount
  useEffect(() => {
    if (hasDraft) {
      const saved = getSavedDraft();
      if (saved) {
        if (Array.isArray(saved.previousTools) && saved.previousTools.length > 0) {
          setPreviousTools(saved.previousTools);
        }
        if (Array.isArray(saved.painPoints) && saved.painPoints.length > 0) {
          setPainPoints(saved.painPoints);
        }
        if (Array.isArray(saved.priorityFeatures) && saved.priorityFeatures.length > 0) {
          setPriorityFeatures(saved.priorityFeatures);
        }
        if (saved.teamComfortLevel) {
          setTeamComfortLevel(saved.teamComfortLevel);
        }
        toast.info('Restored your in-progress questionnaire responses.');
      }
    }
  }, [hasDraft, getSavedDraft]);

  // Persist draft answers with debouncing via useWizardDraft
  useEffect(() => {
    saveDraft({
      previousTools,
      painPoints,
      priorityFeatures,
      teamComfortLevel,
    });
  }, [previousTools, painPoints, priorityFeatures, teamComfortLevel, saveDraft]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const resolvedOrg =
          orgParam ||
          currentWorkspace?.id ||
          localStorage.getItem('orvio_active_workspace_id') ||
          workspaces[0]?.workspace?.id;

        if (resolvedOrg && mounted) {
          try {
            localStorage.setItem('orvio_active_workspace_id', resolvedOrg);
          } catch {}

          // Parallelize workspace selection, app status, and onboarding checks
          const [, appStatusRes, statusRes] = await Promise.all([
            currentWorkspace?.id !== resolvedOrg ? selectWorkspace(resolvedOrg).catch(() => {}) : Promise.resolve(),
            api
              .get<{ success: boolean; data?: { active: boolean } }>(
                `/organizations/${resolvedOrg}/applications/inventory/status`
              )
              .catch(() => null),
            api
              .get<{ completed: boolean; responses?: any }>(`/organizations/${resolvedOrg}/inventory-onboarding`)
              .catch(() => null),
          ]);

          if (!mounted) return;

          if (appStatusRes?.data && appStatusRes.data.active === false) {
            navigate(`/onboard/app?org=${resolvedOrg}`, { replace: true });
            return;
          }

          if (statusRes?.completed) {
            navigate(`/onboard/branch-single?org=${resolvedOrg}`, { replace: true });
            return;
          }
        }

        // Fetch remaining workspace list non-blockingly if not populated
        if (workspaces.length === 0) {
          fetchWorkspaces('inventory').catch(() => {});
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
    // Validate current step before advancing
    if (currentStep === 1 && previousTools.length === 0) {
      toast.error('Please select at least one method you used previously to continue.');
      return;
    }
    if (currentStep === 2 && painPoints.length === 0) {
      toast.error('Please select at least one pain point to continue.');
      return;
    }
    if (currentStep === 3 && priorityFeatures.length === 0) {
      toast.error('Please select at least one priority feature to continue.');
      return;
    }
    if (currentStep === 4 && !teamComfortLevel) {
      toast.error('Please select your team comfort level.');
      return;
    }

    if (currentStep < 4) {
      goToStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1, true);
    }
  };

  const handleSkipQuestionnaire = async () => {
    saveDraft({
      previousTools,
      painPoints,
      priorityFeatures,
      teamComfortLevel,
    });

    if (activeOrgId) {
      try {
        await api.post(`/organizations/${activeOrgId}/inventory-onboarding/skip`).catch(() => {});
      } catch {}
    }

    toast.info("Questionnaire skipped. You can update these answers anytime from Settings → Inventory Preferences.");
    navigate(`/onboard/branch-single?org=${activeOrgId || ''}`);
  };

  const handleSubmit = async () => {
    if (!activeOrgId) {
      toast.error('No organization selected.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post(`/organizations/${activeOrgId}/inventory-onboarding`, {
        previousTools,
        painPoints,
        priorityFeatures,
        teamComfortLevel,
      });

      clearDraft();

      toast.success('Inventory preferences saved! You can update these answers anytime from Settings → Inventory Preferences.');
      navigate(`/onboard/branch-single?org=${activeOrgId}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save Inventory preferences.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center space-y-4">
        <Spinner size="lg" className="text-[#714b67]" />
        <p className="text-xs text-slate-400 animate-pulse">Preparing your inventory workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-[#714b67] selection:text-white">
      {/* Top Bar Header */}
      <header className="h-16 border-b border-white/10 px-4 sm:px-6 flex items-center justify-between bg-[#0d090d]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-sm bg-[#714b67] flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
            <Boxes className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <span>{activeOrgName}</span>
              <span className="text-slate-500">•</span>
              <span className="text-[#c79dbd]">Inventory App Setup</span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">Mandatory configuration to tailor POS & Stock tracking</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSkipQuestionnaire}
            className="h-8 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-sm flex items-center gap-1 cursor-pointer"
          >
            <span>Skip for now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* Main Questionnaire Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-in fade-in duration-300">
        {/* Step Badge & Title */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold">
              <Sparkles className="w-3 h-3 text-[#FDB02F]" />
              <span>Question {currentStep} of 4</span>
            </div>
            <span className="text-xs font-medium text-slate-400">Step {currentStep} / 4</span>
          </div>

          <div className="min-h-[80px] sm:min-h-[82px] flex flex-col justify-center">
            <h1 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight transition-all duration-200">
              {currentStep === 1 && 'How were you tracking inventory and sales before Orviohub?'}
              {currentStep === 2 && 'What is your biggest pain point with your current setup?'}
              {currentStep === 3 && 'Which features are most important to you right now?'}
              {currentStep === 4 && 'How comfortable is your team with apps and software?'}
            </h1>

            <p className="text-xs text-slate-400 mt-1 transition-all duration-200">
              {currentStep === 1 && 'Select all that apply to help us migrate or import your previous system.'}
              {currentStep === 2 && 'Choose the issues you would most like Orviohub to solve.'}
              {currentStep === 3 && 'Select up to 3 priority features to customize your shortcuts.'}
              {currentStep === 4 && 'We adjust interface density and helper tips based on your team’s comfort level.'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/10 h-1.5 rounded-sm overflow-hidden">
            <div
              className="bg-[#c79dbd] h-full rounded-sm transition-all duration-300"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* QUESTION 1: Previous Tools */}
        {currentStep === 1 && (
          <div
            key="inv-step-1"
            className={cn(
              "grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-200 fill-mode-both",
              direction === 'forward' ? 'slide-in-from-right-3' : 'slide-in-from-left-3'
            )}
          >
            {PREVIOUS_TOOLS_OPTIONS.map((opt) => {
              const selected = previousTools.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleMultiSelect(previousTools, setPreviousTools, opt.id)}
                  className={cn(
                    'p-3.5 sm:p-4 rounded-sm border transition-all cursor-pointer flex items-start justify-between gap-3',
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
                      'w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 transition-colors',
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
          <div
            key="inv-step-2"
            className={cn(
              "grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-200 fill-mode-both",
              direction === 'forward' ? 'slide-in-from-right-3' : 'slide-in-from-left-3'
            )}
          >
            {PAIN_POINTS_OPTIONS.map((opt) => {
              const selected = painPoints.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleMultiSelect(painPoints, setPainPoints, opt.id)}
                  className={cn(
                    'p-3.5 sm:p-4 rounded-sm border transition-all cursor-pointer flex items-start justify-between gap-3',
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
                      'w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 transition-colors',
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
          <div
            key="inv-step-3"
            className={cn(
              "space-y-3 animate-in fade-in duration-200 fill-mode-both",
              direction === 'forward' ? 'slide-in-from-right-3' : 'slide-in-from-left-3'
            )}
          >
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
                      'p-3.5 sm:p-4 rounded-sm border transition-all cursor-pointer flex items-start justify-between gap-3',
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
                        'w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 transition-colors',
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

        {/* QUESTION 4: Team Comfort Level */}
        {currentStep === 4 && (
          <div
            key="inv-step-4"
            className={cn(
              "space-y-3 animate-in fade-in duration-200 fill-mode-both",
              direction === 'forward' ? 'slide-in-from-right-3' : 'slide-in-from-left-3'
            )}
          >
            {TEAM_COMFORT_OPTIONS.map((opt) => {
              const selected = teamComfortLevel === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setTeamComfortLevel(opt.id)}
                  className={cn(
                    'p-3.5 sm:p-4 rounded-sm border transition-all cursor-pointer flex items-center justify-between gap-3',
                    selected
                      ? 'bg-[#21111e] border-[#714b67] shadow-lg shadow-[#714b67]/20 ring-1 ring-[#714b67]'
                      : 'bg-[#120b10] border-white/10 hover:border-white/25 hover:bg-white/[0.02]'
                  )}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white">{opt.label}</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{opt.desc}</p>
                  </div>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 transition-colors',
                      selected ? 'bg-[#714b67] border-[#714b67] text-white' : 'border-white/20'
                    )}
                  >
                    {selected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="pt-6 border-t border-white/10 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              disabled={currentStep === 1 || isLoading}
              onClick={handleBack}
              className="rounded-sm border-white/10 hover:bg-white/5 text-xs text-slate-300 disabled:opacity-30 cursor-pointer flex-1 sm:flex-initial"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              <span>Back</span>
            </Button>

            <button
              type="button"
              onClick={handleSkipQuestionnaire}
              className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-4 px-2 py-1 transition-colors cursor-pointer"
            >
              Skip for now — I'll configure later
            </button>
          </div>

          <Button
            type="button"
            onClick={handleNext}
            disabled={isLoading}
            className="px-6 rounded-sm bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold shadow-lg shadow-[#714b67]/25 transition cursor-pointer flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Spinner size="sm" className="text-white" />
                <span>Saving Setup...</span>
              </>
            ) : currentStep < 4 ? (
              <>
                <span>Next Question</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Complete Setup & Proceed</span>
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default InventoryAppOnboarding;
