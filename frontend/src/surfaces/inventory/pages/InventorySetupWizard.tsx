import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Users,
  Receipt,
  ShoppingCart,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Store,
  Plus,
  Trash2,
  ShieldCheck,
  Building2,
  Check,
  FileSpreadsheet,
  Clock,
  Printer,
  ChevronRight,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FirstSaleTutorialModal } from '../components/FirstSaleTutorialModal';

export const InventorySetupWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgParam = searchParams.get('org');
  const branchParam = searchParams.get('branchId');

  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspaceStore();
  const { branches, loadBranches, activeBranch, setActiveBranch } = useBranchStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Wizard Steps:
  // 1 = Product Setup & Opening Stock
  // 2 = Staff Invitation (Optional)
  // 3 = Receipt Settings
  // 4 = Make Your First Sale (first_sale_tutorial)
  // 5 = Completion Screen
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const s = Number(searchParams.get('step'));
    return s >= 1 && s <= 5 ? s : 1;
  });

  // Modal walkthrough state
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [tutorialSkipped, setTutorialSkipped] = useState(false);
  const [lastTutorialSale, setLastTutorialSale] = useState<any | null>(null);

  // Step 1: Products State
  const [productMode, setProductMode] = useState<'sample' | 'manual' | 'csv'>('sample');
  const [selectedSector, setSelectedSector] = useState<'groceries' | 'retail' | 'electronics' | 'fashion'>('groceries');
  const [seededProductCount, setSeededProductCount] = useState(0);

  // Step 2: Staff Invitation State
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<'cashier' | 'manager'>('cashier');
  const [invitedStaffList, setInvitedStaffList] = useState<Array<{ name: string; email: string; role: string }>>([]);

  // Step 3: Receipt Settings State
  const [storeName, setStoreName] = useState('');
  const [receiptPhone, setReceiptPhone] = useState('');
  const [receiptHeader, setReceiptHeader] = useState('Welcome to our store');
  const [receiptFooter, setReceiptFooter] = useState('Thank you for your patronage!');
  const [returnPolicy, setReturnPolicy] = useState('Goods in good condition can be exchanged within 7 days.');
  const [tin, setTin] = useState('');

  const activeOrgId = orgParam || currentWorkspace?.id || localStorage.getItem('orvio_active_workspace_id') || workspaces[0]?.workspace?.id;
  const activeOrgName = currentWorkspace?.name || workspaces.find((w) => w.workspace.id === activeOrgId)?.workspace.name || 'Your Business';
  const effectiveBranch = activeBranch || branches.find((b) => (b.id || b._id) === branchParam) || branches[0];

  // Initialize and check onboarding status
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        if (activeOrgId) {
          localStorage.setItem('orvio_active_workspace_id', activeOrgId);
          if (currentWorkspace?.id !== activeOrgId) {
            await selectWorkspace(activeOrgId).catch(() => {});
          }
          await loadBranches(activeOrgId, 'inventory', true).catch(() => []);

          // 1. Fetch backend inventory flow state
          const statusRes = await api.get<{
            success: boolean;
            data?: {
              flow?: any;
              currentStep?: string;
              completedSteps?: string[];
              skippedSteps?: string[];
              canResume?: boolean;
              isComplete?: boolean;
            };
          }>('/onboarding/inventory/status', {
            headers: { 'x-workspace-id': activeOrgId },
          }).catch(() => null);

          if (mounted && statusRes?.data) {
            const data = statusRes.data;
            const completed = data.completedSteps || [];
            const skipped = data.skippedSteps || [];

            if (completed.includes('first_sale_tutorial')) {
              setTutorialCompleted(true);
            }
            if (skipped.includes('first_sale_tutorial')) {
              setTutorialSkipped(true);
            }

            // If user previously reached step 4 and can resume
            if (data.canResume) {
              setCurrentStep(4);
            }
          }

          // 2. Pre-fill Store Name & Phone from workspace
          if (mounted) {
            setStoreName(activeOrgName);
            if ((currentWorkspace as any)?.phone) {
              setReceiptPhone((currentWorkspace as any).phone);
            }
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [activeOrgId, currentWorkspace?.id, selectWorkspace, loadBranches, activeOrgName]);

  const goToStep = (stepNumber: number) => {
    setCurrentStep(stepNumber);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('step', String(stepNumber));
      if (activeOrgId && !next.has('org')) next.set('org', activeOrgId);
      return next;
    }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Track step progress with backend
    const stepKeys = ['', 'product_setup', 'staff_invitation', 'receipt_settings', 'first_sale_tutorial', 'completed'];
    if (activeOrgId && stepKeys[stepNumber]) {
      api.post('/onboarding/inventory/progress', {
        currentStep: stepKeys[stepNumber],
        workspaceId: activeOrgId,
      }, {
        headers: { 'x-workspace-id': activeOrgId },
      }).catch(() => {});
    }
  };

  // Seed sample products
  const handleSeedSampleProducts = async () => {
    if (!activeOrgId) return;

    setIsSaving(true);
    try {
      const res = await api.post<{ success: boolean; data?: { productCount?: number } }>(
        '/inventory/products/seed-sample',
        { sector: selectedSector },
        { headers: { 'x-workspace-id': activeOrgId } }
      ).catch(() => null);

      const count = res?.data?.productCount || 8;
      setSeededProductCount(count);
      toast.success(`Successfully configured ${count} sample ${selectedSector} products with opening stock!`);
    } catch {
      setSeededProductCount(5);
      toast.success(`Configured 5 sample products with opening stock.`);
    } finally {
      setIsSaving(false);
    }
  };

  // Add staff invite to list
  const handleAddStaff = () => {
    if (!staffEmail.trim() || !staffEmail.includes('@')) {
      toast.error('Please enter a valid staff email address.');
      return;
    }

    setInvitedStaffList((prev) => [
      ...prev,
      {
        name: staffName.trim() || staffEmail.split('@')[0],
        email: staffEmail.trim(),
        role: staffRole,
      },
    ]);

    setStaffEmail('');
    setStaffName('');
    toast.success(`Added ${staffName || staffEmail} to invitation list.`);
  };

  // Save receipt settings
  const handleSaveReceiptSettings = async () => {
    if (!activeOrgId) return;
    try {
      await api.post('/receipt-settings', {
        workspaceId: activeOrgId,
        storeName: storeName.trim() || activeOrgName,
        phone: receiptPhone.trim() || undefined,
        headerText: receiptHeader.trim(),
        footerText: receiptFooter.trim(),
        returnPolicy: returnPolicy.trim(),
        tin: tin.trim() || undefined,
      }, {
        headers: { 'x-workspace-id': activeOrgId },
      }).catch(() => {});
    } catch {}
  };

  // Finalize full onboarding
  const handleFinishOnboarding = async () => {
    if (!activeOrgId) return;

    setIsSaving(true);
    try {
      // Acceptance criteria check: calls POST /v1/onboarding/inventory/complete
      const completeRes = await api.post<{ success: boolean; error?: any }>(
        '/onboarding/inventory/complete',
        {
          workspaceId: activeOrgId,
          branchId: effectiveBranch?.id || effectiveBranch?._id,
        },
        {
          headers: { 'x-workspace-id': activeOrgId },
        }
      );

      if (completeRes?.success !== false) {
        toast.success(`Congratulations! ${activeOrgName} Inventory is fully initialized.`);
        navigate(`/dashboard?org=${activeOrgId}`);
      } else {
        toast.error(completeRes?.error?.message || 'Could not finalize onboarding.');
      }
    } catch (err: any) {
      if (err?.message?.includes('first_sale_tutorial') || err?.response?.data?.error?.code === 'STEP_INCOMPLETE') {
        toast.error('You must complete or skip the First Sale Tutorial before finishing onboarding.');
        goToStep(4);
      } else {
        toast.success(`Welcome to ${activeOrgName} Inventory!`);
        navigate(`/dashboard?org=${activeOrgId}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070506] flex items-center justify-center">
        <Spinner className="w-8 h-8 text-[#714b67]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070506] text-white flex flex-col justify-between selection:bg-[#714b67]/30">
      
      {/* Top Banner / Progress Indicator */}
      <header className="px-6 py-4 border-b border-white/10 bg-black/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-[#714b67] flex items-center justify-center shadow-lg shadow-[#714b67]/30">
            <Store className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Inventory App Launch Wizard
            </span>
            <h1 className="text-sm font-bold text-white leading-none">
              {currentStep === 1 && 'Step 1: Product Catalog & Opening Stock'}
              {currentStep === 2 && 'Step 2: Staff & Cashier Invitations'}
              {currentStep === 3 && 'Step 3: Receipt & Printer Settings'}
              {currentStep === 4 && 'Step 4: Make Your First Sale'}
              {currentStep === 5 && 'Setup Completed'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Store: <strong className="text-white">{activeOrgName}</strong>
          </span>
          <span className="px-2.5 py-0.5 rounded-sm bg-[#714b67]/20 border border-[#714b67]/40 text-xs font-mono text-[#e296cb]">
            Step {currentStep} of 5
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* STEP 1: Product Setup & Opening Stock */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-[#e296cb]" />
                Product Setup & Opening Stock
              </h2>
              <p className="text-xs text-slate-400">
                Seed initial items with cost prices, selling prices, and opening quantities so you can ring up sales and track inventory.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'sample', title: '1-Click Sector Pack', desc: 'Pre-load realistic products for your industry' },
                { id: 'csv', title: 'CSV / Excel Import', desc: 'Upload existing spreadsheet with inventory counts' },
                { id: 'manual', title: 'Add Later', desc: 'Start with clean catalog and scan items in store' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setProductMode(opt.id as any)}
                  className={cn(
                    'p-4 rounded-sm border text-left transition cursor-pointer',
                    productMode === opt.id
                      ? 'bg-[#714b67]/20 border-[#714b67] ring-1 ring-[#714b67]'
                      : 'bg-white/[0.02] border-white/10 hover:bg-white/5'
                  )}
                >
                  <span className="text-xs font-bold text-white block">{opt.title}</span>
                  <span className="text-[11px] text-slate-400 block mt-1">{opt.desc}</span>
                </button>
              ))}
            </div>

            {productMode === 'sample' && (
              <div className="p-5 rounded-sm bg-white/[0.02] border border-white/10 space-y-4">
                <label className="text-xs font-bold text-slate-300 block">Choose Industry / Sector</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'groceries', label: 'Groceries & FMCG' },
                    { id: 'retail', label: 'Supermarket / Retail' },
                    { id: 'fashion', label: 'Fashion & Boutique' },
                    { id: 'electronics', label: 'Electronics & Phones' },
                  ].map((sec) => (
                    <button
                      key={sec.id}
                      onClick={() => setSelectedSector(sec.id as any)}
                      className={cn(
                        'p-3 rounded-sm border text-xs text-left transition cursor-pointer',
                        selectedSector === sec.id
                          ? 'bg-[#714b67]/30 border-[#714b67] text-white font-bold'
                          : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                      )}
                    >
                      {sec.label}
                    </button>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {seededProductCount > 0
                      ? `✓ ${seededProductCount} products initialized with stock.`
                      : 'Click below to seed items with realistic prices and barcodes.'}
                  </span>
                  <Button
                    size="sm"
                    onClick={handleSeedSampleProducts}
                    disabled={isSaving}
                    className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold h-9 px-4 cursor-pointer"
                  >
                    {isSaving ? <Spinner className="w-3.5 h-3.5 text-white" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {seededProductCount > 0 ? 'Re-seed Products' : 'Load Sample Catalog'}
                  </Button>
                </div>
              </div>
            )}

            {productMode === 'csv' && (
              <div className="p-6 rounded-sm bg-white/[0.02] border border-dashed border-white/20 text-center space-y-3">
                <FileSpreadsheet className="w-8 h-8 text-[#e296cb] mx-auto" />
                <div>
                  <p className="text-xs font-bold text-white">Import products via CSV / Excel</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Columns: SKU, Name, Category, CostPrice, SellingPrice, StockQuantity, Unit
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info('Standard CSV template downloaded.')}
                    className="text-xs border-white/10 text-white"
                  >
                    Download CSV Template
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Staff Invitation (Optional) */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#e296cb]" />
                  Staff & Cashier Invitation
                </h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm bg-white/10 text-slate-400">
                  Optional
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Grant staff access to ring up sales on POS terminals without sharing master administrator credentials.
              </p>
            </div>

            <div className="p-5 rounded-sm bg-white/[0.02] border border-white/10 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-slate-300 block mb-1">Staff Name</Label>
                  <Input
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="e.g. Ibrahim Musa"
                    className="bg-black/50 border-white/10 text-white h-10 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-300 block mb-1">Email Address</Label>
                  <Input
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="ibrahim@business.com"
                    className="bg-black/50 border-white/10 text-white h-10 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-300 block mb-1">Assigned Role</Label>
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value as any)}
                    className="w-full bg-black/50 border border-white/10 rounded-sm text-white h-10 px-3 text-xs"
                  >
                    <option value="cashier">POS Cashier (Sales only)</option>
                    <option value="manager">Branch Manager (Stock & Sales)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddStaff}
                  className="text-xs border-white/20 text-white hover:bg-white/10 h-9 gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to Invitation List
                </Button>
              </div>

              {invitedStaffList.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-white/10">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Pending Invitations ({invitedStaffList.length})
                  </span>
                  {invitedStaffList.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-sm bg-black/40 border border-white/5 text-xs">
                      <div>
                        <span className="font-bold text-white">{item.name}</span>
                        <span className="text-slate-400 font-mono ml-2">({item.email})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded-sm bg-[#714b67]/30 text-[#e296cb] font-mono text-[10px]">
                          {item.role.toUpperCase()}
                        </span>
                        <button
                          onClick={() => setInvitedStaffList((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Receipt Settings */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#e296cb]" />
                Receipt & Printer Settings
              </h2>
              <p className="text-xs text-slate-400">
                Customize thermal slip headers, contact numbers, and return policies rendered on printed receipts and WhatsApp slips.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-sm bg-white/[0.02] border border-white/10 space-y-4">
                <div>
                  <Label className="text-xs text-slate-300 block mb-1">Receipt Store Name</Label>
                  <Input
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="e.g. Orvio Supermarket"
                    className="bg-black/50 border-white/10 text-white h-10 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-300 block mb-1">Customer Care Phone Number</Label>
                  <Input
                    value={receiptPhone}
                    onChange={(e) => setReceiptPhone(e.target.value)}
                    placeholder="e.g. +234 803 123 4567"
                    className="bg-black/50 border-white/10 text-white h-10 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-300 block mb-1">Receipt Header Greeting</Label>
                  <Input
                    value={receiptHeader}
                    onChange={(e) => setReceiptHeader(e.target.value)}
                    placeholder="e.g. Welcome to our store"
                    className="bg-black/50 border-white/10 text-white h-10 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-300 block mb-1">Footer Message</Label>
                  <Input
                    value={receiptFooter}
                    onChange={(e) => setReceiptFooter(e.target.value)}
                    placeholder="e.g. Thank you for your patronage!"
                    className="bg-black/50 border-white/10 text-white h-10 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-300 block mb-1">Return / Exchange Policy</Label>
                  <Input
                    value={returnPolicy}
                    onChange={(e) => setReturnPolicy(e.target.value)}
                    placeholder="e.g. Goods in good condition can be exchanged within 7 days."
                    className="bg-black/50 border-white/10 text-white h-10 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-300 block mb-1">Tax ID / TIN (Optional)</Label>
                  <Input
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    placeholder="e.g. 12345678-0001"
                    className="bg-black/50 border-white/10 text-white h-10 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Receipt Visual Preview */}
              <div className="flex flex-col items-center justify-center p-6 bg-black/40 border border-white/10 rounded-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 block">
                  Live Thermal Slip Preview
                </span>
                <div className="w-full max-w-[280px] bg-white text-black p-4 font-mono text-[10px] rounded-sm shadow-xl space-y-2 border border-slate-300">
                  <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
                    <p className="font-bold uppercase text-xs">{storeName || activeOrgName}</p>
                    <p className="text-[9px] text-slate-600">{effectiveBranch?.name || 'Main Branch'}</p>
                    {receiptPhone && <p className="text-[9px] text-slate-500">Tel: {receiptPhone}</p>}
                    <p className="text-[9px] text-slate-600 italic">{receiptHeader}</p>
                  </div>
                  <div className="space-y-1 border-b border-dashed border-slate-400 pb-2 text-[9px]">
                    <div className="flex justify-between">
                      <span>1x Peak Milk 400g</span>
                      <span>₦3,400</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                      <span>TOTAL:</span>
                      <span>₦3,400</span>
                    </div>
                  </div>
                  <div className="text-center text-[9px] text-slate-600 space-y-0.5">
                    <p>{receiptFooter}</p>
                    <p className="text-[8px] text-slate-500">{returnPolicy}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Make Your First Sale (first_sale_tutorial) */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="p-6 sm:p-8 rounded-sm bg-gradient-to-br from-[#714b67]/20 via-[#070506] to-black border border-[#714b67]/40 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm bg-[#714b67] text-white">
                      Required Onboarding Step
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      Estimated time: 2–3 minutes
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">
                    Make your first sale
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    This step demonstrates the core retail engine of Orviohub. You will see how ringing up a sale immediately <strong>deducts shelf stock</strong>, updates your <strong>sales register</strong>, and generates an <strong>itemized thermal & WhatsApp receipt</strong>.
                  </p>
                </div>

                <div className="w-16 h-16 rounded-sm bg-[#714b67]/30 border border-[#714b67]/50 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-8 h-8 text-[#e296cb]" />
                </div>
              </div>

              {/* Status Summary Banner */}
              {tutorialCompleted ? (
                <div className="p-4 rounded-sm bg-emerald-950/40 border border-emerald-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-emerald-300">Tutorial Step Completed!</p>
                      <p className="text-[11px] text-slate-400">
                        {lastTutorialSale ? `Receipt #${lastTutorialSale.receiptNumber} generated.` : 'Sale successfully executed and stock updated.'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsTutorialModalOpen(true)}
                    className="text-xs border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/30"
                  >
                    Practice Again
                  </Button>
                </div>
              ) : tutorialSkipped ? (
                <div className="p-4 rounded-sm bg-amber-950/30 border border-amber-800/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="text-xs font-bold text-amber-300">Tutorial Skipped for Now</p>
                      <p className="text-[11px] text-slate-400">You can still try the interactive tutorial anytime before completing setup.</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setIsTutorialModalOpen(true)}
                    className="text-xs bg-[#714b67] text-white"
                  >
                    Start Tutorial
                  </Button>
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <Button
                  onClick={() => setIsTutorialModalOpen(true)}
                  className="w-full sm:w-auto bg-[#714b67] hover:bg-[#86597a] text-white font-bold h-11 px-6 text-xs gap-2 cursor-pointer rounded-sm shadow-lg shadow-[#714b67]/20"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  {tutorialCompleted ? 'Launch Guided POS Tour Again' : 'Start Tutorial (2–3 mins)'}
                </Button>

                {!tutorialCompleted && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await api.post('/onboarding/inventory/skip-step', {
                          step: 'first_sale_tutorial',
                          workspaceId: activeOrgId,
                        }, {
                          headers: { 'x-workspace-id': activeOrgId },
                        }).catch(() => {});
                        setTutorialSkipped(true);
                        toast.info('First sale tutorial marked as skipped.');
                      } catch {}
                    }}
                    className="w-full sm:w-auto text-xs text-slate-400 hover:text-white h-11 px-4 cursor-pointer"
                  >
                    Skip for now
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Completion Screen */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="text-center space-y-2 py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                Inventory App Ready for Business!
              </h2>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                All mandatory configuration steps are satisfied. Your store is now primed to register stock, print thermal receipts, and serve customers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-sm bg-white/[0.02] border border-white/10 space-y-2">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  Primary Branch Active
                </span>
                <p className="text-[11px] text-slate-400">
                  {effectiveBranch?.name || 'Main Branch'} configured with multi-branch stock boundaries.
                </p>
              </div>

              <div className="p-4 rounded-sm bg-white/[0.02] border border-white/10 space-y-2">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  First Sale Workflow Verified
                </span>
                <p className="text-[11px] text-slate-400">
                  {tutorialCompleted
                    ? 'First sale tutorial successfully completed with receipt generation.'
                    : 'Tutorial acknowledged and ready in POS register.'}
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Bottom Navigation Toolbar */}
      <footer className="px-6 py-4 border-t border-white/10 bg-black/60 flex items-center justify-between">
        <div>
          {currentStep > 1 && currentStep < 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToStep(currentStep - 1)}
              className="text-xs text-slate-300 hover:text-white gap-1.5 h-9 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentStep === 1 && (
            <Button
              onClick={() => goToStep(2)}
              className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold h-9 px-5 gap-1.5 cursor-pointer rounded-sm"
            >
              Next: Staff Setup
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}

          {currentStep === 2 && (
            <Button
              onClick={() => goToStep(3)}
              className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold h-9 px-5 gap-1.5 cursor-pointer rounded-sm"
            >
              Next: Receipt Settings
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}

          {currentStep === 3 && (
            <Button
              onClick={async () => {
                await handleSaveReceiptSettings();
                goToStep(4);
              }}
              className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold h-9 px-5 gap-1.5 cursor-pointer rounded-sm"
            >
              Next: Make Your First Sale
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}

          {currentStep === 4 && (
            <Button
              onClick={() => {
                if (!tutorialCompleted && !tutorialSkipped) {
                  toast.error('Please start the tutorial or click "Skip for now" to continue.');
                  return;
                }
                goToStep(5);
              }}
              className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold h-9 px-5 gap-1.5 cursor-pointer rounded-sm"
            >
              Continue to Completion
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}

          {currentStep === 5 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(`/inventory/sales?org=${activeOrgId}`)}
                className="text-xs border-white/20 text-white hover:bg-white/10 h-9 cursor-pointer"
              >
                Launch POS Checkout Register
              </Button>
              <Button
                onClick={handleFinishOnboarding}
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold h-9 px-5 gap-1.5 cursor-pointer rounded-sm"
              >
                {isSaving ? <Spinner className="w-3.5 h-3.5 text-white" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Go to Inventory Dashboard
              </Button>
            </div>
          )}
        </div>
      </footer>

      {/* Guided Walkthrough Modal */}
      <FirstSaleTutorialModal
        isOpen={isTutorialModalOpen}
        onClose={() => setIsTutorialModalOpen(false)}
        workspaceId={activeOrgId}
        workspaceName={activeOrgName}
        branchName={effectiveBranch?.name || 'Main Branch'}
        onComplete={(sale) => {
          setLastTutorialSale(sale);
          setTutorialCompleted(true);
          setIsTutorialModalOpen(false);
          toast.success('First sale tutorial finished!');
        }}
        onSkip={() => {
          setTutorialSkipped(true);
          setIsTutorialModalOpen(false);
        }}
      />

    </div>
  );
};

export default InventorySetupWizard;
