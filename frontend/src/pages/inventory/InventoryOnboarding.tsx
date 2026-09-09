import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Boxes,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Store,
  Plus,
  Check,
  MapPin,
  Phone,
  Edit2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Question 1 Options: Previous Tools
const PREVIOUS_TOOLS_OPTIONS = [
  { id: 'notebooks', label: 'Notebooks / Paper records' },
  { id: 'excel_sheets', label: 'Excel / Google Sheets' },
  { id: 'whatsapp', label: 'WhatsApp messages & chat notes' },
  { id: 'other_pos', label: 'Another software / POS terminal' },
  { id: 'memory', label: 'Memory / No formal system' },
  { id: 'other', label: 'Other system' },
];

// Question 2 Options: Pain Points
const PAIN_POINTS_OPTIONS = [
  { id: 'stockouts_overstock', label: 'Stockouts & unexpected overstocking' },
  { id: 'inaccurate_counts', label: 'Inaccurate stock counts & inventory loss' },
  { id: 'lost_sales', label: 'Lost sales records & paper slips' },
  { id: 'theft_leakage', label: 'Staff theft & stock leakage' },
  { id: 'unknown_profit', label: 'Hard to know daily sales & exact profit' },
  { id: 'debt_tracking', label: 'Hard to track customer debts & credit' },
  { id: 'other', label: 'Other operational issue' },
];

// Question 3 Options: Priority Features (Limit 3)
const PRIORITY_FEATURES_OPTIONS = [
  { id: 'pos_sales', label: 'Recording sales quickly (POS register)' },
  { id: 'stock_levels', label: 'Tracking real-time stock levels' },
  { id: 'purchases_suppliers', label: 'Tracking purchases & supplier invoices' },
  { id: 'customer_debts', label: 'Tracking customer debts & payments' },
  { id: 'low_stock_alerts', label: 'Automated low-stock alerts' },
  { id: 'financial_reports', label: 'Financial, sales & profit reports' },
  { id: 'offline_operation', label: 'Offline operation when internet is down' },
  { id: 'other', label: 'Other feature' },
];

// Question 5 Options: Team Comfort Level
const TEAM_COMFORT_OPTIONS = [
  { id: 'very', label: 'Very comfortable', desc: 'Tech-savvy team that learns tools quickly' },
  { id: 'somewhat', label: 'Somewhat comfortable', desc: 'Regular smartphone users, need straightforward design' },
  { id: 'not_very', label: 'Not very comfortable', desc: 'Prefer very simple workflows and minimum typing' },
  { id: 'not_at_all', label: 'Not at all comfortable', desc: 'First time using computer or business software' },
];

export const InventoryOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace, workspaces, fetchWorkspaces } = useWorkspaceStore();
  const { branches, loadBranches, createBranch } = useBranchStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // Questionnaire State (US-2)
  const [questionIndex, setQuestionIndex] = useState(0); // 0 to 4
  const [previousTools, setPreviousTools] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [priorityFeatures, setPriorityFeatures] = useState<string[]>([]);
  const [needsMultiBranch, setNeedsMultiBranch] = useState<boolean>(false);
  const [teamComfortLevel, setTeamComfortLevel] = useState<string>('somewhat');

  // Branch Setup Phase (US-3)
  const [onboardingStage, setOnboardingStage] = useState<'questionnaire' | 'branch_setup'>('questionnaire');
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);

  // New Branch Form
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [newBranchIsPrimary, setNewBranchIsPrimary] = useState(false);
  const [isAddingBranch, setIsAddingBranch] = useState(false);

  const activeOrgId = currentWorkspace?.id || workspaces[0]?.workspace?.id;
  const activeOrgName = currentWorkspace?.name || workspaces[0]?.workspace?.name || 'Your Business';

  // Check if onboarding is already completed
  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      try {
        let wsList = workspaces;
        if (wsList.length === 0) {
          wsList = await fetchWorkspaces('inventory');
        }

        const orgId = currentWorkspace?.id || wsList[0]?.workspace?.id;
        if (!orgId) {
          if (mounted) setIsCheckingStatus(false);
          return;
        }

        // Load existing branches
        await loadBranches(orgId, 'inventory');

        // Check if onboarding responses already recorded
        const statusRes = await api.get<{
          completed: boolean;
          responses?: any;
        }>(`/organizations/${orgId}/inventory-onboarding`);

        if (mounted) {
          if (statusRes?.completed) {
            // Already completed questionnaire, go straight to branch setup or dashboard
            setOnboardingStage('branch_setup');
          }
        }
      } catch {
        // Fallback: proceed to questionnaire
      } finally {
        if (mounted) setIsCheckingStatus(false);
      }
    };

    checkStatus();
    return () => {
      mounted = false;
    };
  }, [currentWorkspace?.id, workspaces.length]);

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
        toast.info(`You can select up to ${limit} most important features.`);
        return;
      }
      setList([...list, id]);
    }
  };

  // Submit Questionnaire Responses (US-2)
  const handleSaveQuestionnaire = async (skip: boolean = false) => {
    if (!activeOrgId) {
      toast.error('No active organization found.');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        previousTools: skip ? [] : previousTools,
        painPoints: skip ? [] : painPoints,
        priorityFeatures: skip ? [] : priorityFeatures,
        needsMultiBranch: skip ? false : needsMultiBranch,
        teamComfortLevel: skip ? 'somewhat' : teamComfortLevel,
      };

      await api.post(`/organizations/${activeOrgId}/inventory-onboarding`, payload);

      // Reload branches
      await loadBranches(activeOrgId, 'inventory');

      toast.success('Inventory preferences saved!');
      setOnboardingStage('branch_setup');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save preferences.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new branch (US-3)
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId) return;

    if (!newBranchName.trim()) {
      toast.error('Branch name is required.');
      return;
    }

    setIsLoading(true);
    try {
      await createBranch({
        workspaceId: activeOrgId,
        name: newBranchName.trim(),
        code: newBranchCode.trim() || undefined,
        address: newBranchAddress.trim() || undefined,
        phone: newBranchPhone.trim() || undefined,
        isPrimary: newBranchIsPrimary || branches.length === 0,
      });

      toast.success(`Branch "${newBranchName}" added successfully!`);
      setNewBranchName('');
      setNewBranchCode('');
      setNewBranchAddress('');
      setNewBranchPhone('');
      setNewBranchIsPrimary(false);
      setIsAddingBranch(false);

      await loadBranches(activeOrgId, 'inventory');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create branch.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishBranchSetup = () => {
    if (branches.length === 0) {
      toast.error('Please create at least one branch before using Inventory.');
      return;
    }
    toast.success('Inventory workstation ready!');
    navigate('/dashboard');
  };

  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <Spinner size="lg" className="text-[#714b67]" />
        <p className="text-xs text-slate-400">Loading Inventory setup...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-[#714b67] selection:text-white">
      {/* Top Bar */}
      <header className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-[#0d090d]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#714b67] flex items-center justify-center text-white font-bold text-sm shadow-md">
            <Boxes className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>{activeOrgName}</span>
              <span className="text-slate-500">•</span>
              <span className="text-[#c79dbd]">Inventory Setup</span>
            </div>
            <p className="text-[10px] text-slate-400">First-Time Application Onboarding</p>
          </div>
        </div>

        {onboardingStage === 'questionnaire' && (
          <button
            type="button"
            onClick={() => handleSaveQuestionnaire(true)}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Skip for now
          </button>
        )}
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* PHASE 1: QUESTIONNAIRE (US-2) */}
        {onboardingStage === 'questionnaire' && (
          <div className="space-y-6">
            {/* Header / Step Tracker */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold">
                <Sparkles className="w-3 h-3 text-[#FDB02F]" />
                <span>Help us tailor Inventory for your business</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {questionIndex === 0 && 'How were you tracking inventory and sales before?'}
                {questionIndex === 1 && 'What is your biggest pain point with your current setup?'}
                {questionIndex === 2 && 'Which features are most important right now?'}
                {questionIndex === 3 && 'Do you need to track multiple branches or locations?'}
                {questionIndex === 4 && 'How comfortable is your team with apps & software?'}
              </h1>
              <p className="text-xs text-slate-400">
                Question {questionIndex + 1} of 5 — {questionIndex === 2 ? 'Select up to 3' : 'Select options'}
              </p>

              {/* Progress Dots */}
              <div className="flex gap-1.5 pt-1">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-all duration-300',
                      idx <= questionIndex ? 'bg-[#714b67]' : 'bg-white/10'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Question 1: Previous Tools */}
            {questionIndex === 0 && (
              <div className="p-6 rounded-2xl bg-[#120b10] border border-white/10 shadow-xl space-y-3">
                {PREVIOUS_TOOLS_OPTIONS.map((opt) => {
                  const isChecked = previousTools.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleMultiSelect(previousTools, setPreviousTools, opt.id)}
                      className={cn(
                        'w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all',
                        isChecked
                          ? 'bg-[#714b67]/25 border-[#714b67] text-white'
                          : 'bg-black/30 border-white/5 text-slate-300 hover:border-white/20'
                      )}
                    >
                      <span className="text-xs font-semibold">{opt.label}</span>
                      <div
                        className={cn(
                          'w-4 h-4 rounded flex items-center justify-center text-[10px]',
                          isChecked ? 'bg-[#714b67] text-white' : 'border border-white/20'
                        )}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Question 2: Pain Points */}
            {questionIndex === 1 && (
              <div className="p-6 rounded-2xl bg-[#120b10] border border-white/10 shadow-xl space-y-3">
                {PAIN_POINTS_OPTIONS.map((opt) => {
                  const isChecked = painPoints.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleMultiSelect(painPoints, setPainPoints, opt.id)}
                      className={cn(
                        'w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all',
                        isChecked
                          ? 'bg-[#714b67]/25 border-[#714b67] text-white'
                          : 'bg-black/30 border-white/5 text-slate-300 hover:border-white/20'
                      )}
                    >
                      <span className="text-xs font-semibold">{opt.label}</span>
                      <div
                        className={cn(
                          'w-4 h-4 rounded flex items-center justify-center text-[10px]',
                          isChecked ? 'bg-[#714b67] text-white' : 'border border-white/20'
                        )}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Question 3: Priority Features (Max 3) */}
            {questionIndex === 2 && (
              <div className="p-6 rounded-2xl bg-[#120b10] border border-white/10 shadow-xl space-y-3">
                {PRIORITY_FEATURES_OPTIONS.map((opt) => {
                  const isChecked = priorityFeatures.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleMultiSelect(priorityFeatures, setPriorityFeatures, opt.id, 3)}
                      className={cn(
                        'w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all',
                        isChecked
                          ? 'bg-[#714b67]/25 border-[#714b67] text-white'
                          : 'bg-black/30 border-white/5 text-slate-300 hover:border-white/20'
                      )}
                    >
                      <span className="text-xs font-semibold">{opt.label}</span>
                      <div
                        className={cn(
                          'w-4 h-4 rounded flex items-center justify-center text-[10px]',
                          isChecked ? 'bg-[#714b67] text-white' : 'border border-white/20'
                        )}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Question 4: Multi-Branch Needs */}
            {questionIndex === 3 && (
              <div className="p-6 rounded-2xl bg-[#120b10] border border-white/10 shadow-xl space-y-4">
                <button
                  type="button"
                  onClick={() => setNeedsMultiBranch(false)}
                  className={cn(
                    'w-full p-4 rounded-xl border text-left transition-all',
                    !needsMultiBranch
                      ? 'bg-[#714b67]/25 border-[#714b67] text-white'
                      : 'bg-black/30 border-white/5 text-slate-300 hover:border-white/20'
                  )}
                >
                  <div className="font-bold text-xs text-white">No (Single Location)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    We manage all stock and sales in one primary store or warehouse.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setNeedsMultiBranch(true)}
                  className={cn(
                    'w-full p-4 rounded-xl border text-left transition-all',
                    needsMultiBranch
                      ? 'bg-[#714b67]/25 border-[#714b67] text-white'
                      : 'bg-black/30 border-white/5 text-slate-300 hover:border-white/20'
                  )}
                >
                  <div className="font-bold text-xs text-white">Yes (Multiple Branches)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    We have 2 or more physical locations and need inter-branch stock transfers and branch-level reporting.
                  </div>
                </button>
              </div>
            )}

            {/* Question 5: Team Comfort Level */}
            {questionIndex === 4 && (
              <div className="p-6 rounded-2xl bg-[#120b10] border border-white/10 shadow-xl space-y-3">
                {TEAM_COMFORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTeamComfortLevel(opt.id)}
                    className={cn(
                      'w-full p-3.5 rounded-xl border text-left transition-all',
                      teamComfortLevel === opt.id
                        ? 'bg-[#714b67]/25 border-[#714b67] text-white ring-1 ring-[#714b67]'
                        : 'bg-black/30 border-white/5 text-slate-300 hover:border-white/20'
                    )}
                  >
                    <div className="font-bold text-xs text-white">{opt.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Questionnaire Navigation Controls */}
            <div className="flex items-center justify-between pt-2">
              {questionIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuestionIndex(questionIndex - 1)}
                  className="border-white/10 text-slate-300 hover:bg-white/5 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  <span>Previous</span>
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (questionIndex < 4) {
                      setQuestionIndex(questionIndex + 1);
                    } else {
                      handleSaveQuestionnaire(false);
                    }
                  }}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  Skip Question
                </Button>

                {questionIndex < 4 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setQuestionIndex(questionIndex + 1)}
                    className="bg-[#714b67] hover:bg-[#86597a] text-white font-bold text-xs px-5 shadow-md shadow-[#714b67]/20"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSaveQuestionnaire(false)}
                    disabled={isLoading}
                    className="bg-[#714b67] hover:bg-[#86597a] text-white font-bold text-xs px-5 shadow-md shadow-[#714b67]/20"
                  >
                    {isLoading ? (
                      <>
                        <Spinner className="w-3.5 h-3.5 mr-1.5" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue to Branches</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PHASE 2: BRANCH SETUP (US-3) */}
        {onboardingStage === 'branch_setup' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold">
                <Store className="w-3.5 h-3.5 text-[#FDB02F]" />
                <span>Branch & Location Setup</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {branches.length <= 1 ? 'Your Main Branch is Set Up' : 'Manage Your Branches'}
              </h1>
              <p className="text-xs text-slate-400">
                All inventory levels, purchases, and sales in Orviohub are scoped to physical branch locations.
              </p>
            </div>

            {/* Existing Branches List */}
            <div className="space-y-3">
              {branches.map((branch) => (
                <div
                  key={branch.id || branch._id}
                  className={cn(
                    "p-4 rounded-xl bg-[#120b10] border border-white/10 flex items-center justify-between gap-4 transition",
                    editingBranchId === (branch.id || branch._id) && "border-[#714b67] bg-[#714b67]/10"
                  )}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white truncate">{branch.name}</span>
                      {branch.isPrimary && (
                        <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-[#714b67]/30 border border-[#714b67]/50 text-[#f0d8e8]">
                          Primary Branch
                        </span>
                      )}
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/5 text-slate-400 font-mono">
                        {branch.code || 'MAIN'}
                      </span>
                    </div>
                    {branch.address && (
                      <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{branch.address}</span>
                      </p>
                    )}
                    {branch.phone && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{branch.phone}</span>
                      </p>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingBranchId(branch.id || branch._id || null);
                      toast.info(`Editing branch "${branch.name}"`);
                    }}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    <span>Edit</span>
                  </Button>
                </div>
              ))}
            </div>

            {/* Add Branch Form / Toggle */}
            {!isAddingBranch ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddingBranch(true)}
                className="w-full py-3 rounded-xl border-dashed border-white/15 bg-white/[0.02] hover:bg-white/5 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Branch</span>
              </Button>
            ) : (
              <form
                onSubmit={handleCreateBranch}
                className="p-5 rounded-xl bg-[#150d13] border border-[#714b67]/40 space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <h3 className="text-xs font-bold text-white">Add New Branch Location</h3>
                  <button
                    type="button"
                    onClick={() => setIsAddingBranch(false)}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-slate-200">
                      Branch Name <span className="text-rose-400">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Ikeja Outlet or Abuja Warehouse"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      className="bg-black/50 border-white/10 text-xs text-white"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-slate-200">
                      Branch Code (Optional)
                    </Label>
                    <Input
                      placeholder="e.g. IKJ, ABJ, WH1"
                      value={newBranchCode}
                      onChange={(e) => setNewBranchCode(e.target.value.toUpperCase())}
                      className="bg-black/50 border-white/10 text-xs text-white uppercase"
                      maxLength={6}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-slate-200">
                      Address / Area (Optional)
                    </Label>
                    <Input
                      placeholder="e.g. 22 Allen Avenue, Ikeja"
                      value={newBranchAddress}
                      onChange={(e) => setNewBranchAddress(e.target.value)}
                      className="bg-black/50 border-white/10 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-slate-200">
                      Phone Number (Optional)
                    </Label>
                    <Input
                      placeholder="e.g. 08033221144"
                      value={newBranchPhone}
                      onChange={(e) => setNewBranchPhone(e.target.value)}
                      className="bg-black/50 border-white/10 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isPrimaryCheck"
                    checked={newBranchIsPrimary}
                    onChange={(e) => setNewBranchIsPrimary(e.target.checked)}
                    className="rounded border-white/20 text-[#714b67] focus:ring-[#714b67]"
                  />
                  <Label htmlFor="isPrimaryCheck" className="text-[11px] text-slate-300 cursor-pointer">
                    Set as primary default branch for transactions
                  </Label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingBranch(false)}
                    className="text-xs text-slate-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isLoading}
                    className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold"
                  >
                    Save Branch
                  </Button>
                </div>
              </form>
            )}

            {/* Launch Inventory Action */}
            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOnboardingStage('questionnaire')}
                className="text-xs text-slate-400"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                <span>Preferences</span>
              </Button>

              <Button
                type="button"
                onClick={handleFinishBranchSetup}
                className="bg-[#714b67] hover:bg-[#86597a] text-white font-bold text-xs px-6 py-2.5 shadow-lg shadow-[#714b67]/30 flex items-center gap-2"
              >
                <span>Launch Inventory Workstation</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
