import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { CatalogOnboardingModal } from '../components/CatalogOnboardingModal';
import { toast } from 'sonner';
import {
  Boxes,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Store,
  Plus,
  Search,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductRowState {
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes: string;
}

export const OpeningStockEntry: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgParam = searchParams.get('org');
  const branchParam = searchParams.get('branchId') || searchParams.get('branch');

  const { currentWorkspace, workspaces, selectWorkspace } = useWorkspaceStore();
  const { branches, loadBranches, activeBranch, setActiveBranch } = useBranchStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [productRows, setProductRows] = useState<ProductRowState[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const activeOrgId =
    orgParam ||
    currentWorkspace?.id ||
    localStorage.getItem('orvio_active_workspace_id') ||
    workspaces[0]?.workspace?.id;
  const activeOrgName =
    currentWorkspace?.name ||
    workspaces.find((w) => w.workspace.id === activeOrgId)?.workspace.name ||
    'Your Business';

  const draftStorageKey = `orvio_opening_stock_draft_${activeOrgId}`;

  // 1. Initialize workspace, branches & products
  useEffect(() => {
    let mounted = true;
    const initData = async () => {
      try {
        if (!activeOrgId) {
          if (mounted) setIsLoading(false);
          return;
        }

        localStorage.setItem('orvio_active_workspace_id', activeOrgId);
        if (currentWorkspace?.id !== activeOrgId) {
          await selectWorkspace(activeOrgId).catch(() => {});
        }

        // Load branches
        const branchList = await loadBranches(activeOrgId, 'inventory', true).catch(() => []);
        const targetBranch =
          (branchParam ? branchList.find((b) => (b.id || b._id) === branchParam) : null) ||
          branchList.find((b) => b.isPrimary) ||
          branchList[0] ||
          activeBranch;

        if (targetBranch && mounted) {
          const targetId = String(targetBranch.id || targetBranch._id || '');
          setSelectedBranchId(targetId);
          setActiveBranch(targetBranch);
        }

        // Fetch products & opening stock data
        const res = await api
          .get<{ success?: boolean; data?: { products: any[] } } | { products: any[] }>(
            `/inventory/products`
          )
          .catch(() => null);

        const rawProducts =
          (res as any)?.data?.products || (res as any)?.products || [];

        if (mounted) {
          // Load draft from localStorage if present
          let draftData: Record<string, { quantity: number; unitCost: number; notes: string }> = {};
          try {
            const savedDraft = localStorage.getItem(draftStorageKey);
            if (savedDraft) {
              draftData = JSON.parse(savedDraft);
            }
          } catch {}

          const rows: ProductRowState[] = rawProducts.map((p: any) => {
            const draft = draftData[p._id || p.id];
            const quantity = draft ? draft.quantity : (p.stockQuantity !== undefined ? p.stockQuantity : 0);
            const unitCost = draft ? draft.unitCost : (p.costPrice !== undefined ? p.costPrice : 0);
            return {
              productId: String(p._id || p.id),
              name: p.name || 'Unnamed Product',
              sku: p.sku || 'SKU-N/A',
              barcode: p.barcode || '',
              category: p.category || 'General',
              unit: p.unit || 'pcs',
              quantity,
              unitCost,
              totalCost: quantity * unitCost,
              notes: draft ? draft.notes : '',
            };
          });

          setProductRows(rows);
        }
      } catch (err: any) {
        toast.error('Failed to load products for opening stock.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initData();
    return () => {
      mounted = false;
    };
  }, [activeOrgId, branchParam, draftStorageKey]);

  // Persist draft changes
  const saveDraft = (updatedRows: ProductRowState[]) => {
    try {
      const draftObj: Record<string, { quantity: number; unitCost: number; notes: string }> = {};
      for (const row of updatedRows) {
        draftObj[row.productId] = {
          quantity: row.quantity,
          unitCost: row.unitCost,
          notes: row.notes,
        };
      }
      localStorage.setItem(draftStorageKey, JSON.stringify(draftObj));
    } catch {}
  };

  const handleQuantityChange = (productId: string, val: string) => {
    const qty = Math.max(0, parseInt(val, 10) || 0);
    setProductRows((prev) => {
      const next = prev.map((row) =>
        row.productId === productId
          ? { ...row, quantity: qty, totalCost: qty * row.unitCost }
          : row
      );
      saveDraft(next);
      return next;
    });
  };

  const handleUnitCostChange = (productId: string, val: string) => {
    const cost = Math.max(0, parseFloat(val) || 0);
    setProductRows((prev) => {
      const next = prev.map((row) =>
        row.productId === productId
          ? { ...row, unitCost: cost, totalCost: row.quantity * cost }
          : row
      );
      saveDraft(next);
      return next;
    });
  };

  const handleNotesChange = (productId: string, notes: string) => {
    setProductRows((prev) => {
      const next = prev.map((row) =>
        row.productId === productId ? { ...row, notes } : row
      );
      saveDraft(next);
      return next;
    });
  };

  const toggleNotesRow = (productId: string) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  // Metrics
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return productRows;
    const q = searchQuery.toLowerCase();
    return productRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.barcode && r.barcode.toLowerCase().includes(q))
    );
  }, [productRows, searchQuery]);

  const totalProductsCount = productRows.length;
  const totalUnitsOnHand = useMemo(
    () => productRows.reduce((acc, r) => acc + r.quantity, 0),
    [productRows]
  );
  const totalStockValuation = useMemo(
    () => productRows.reduce((acc, r) => acc + r.totalCost, 0),
    [productRows]
  );

  const formatNaira = (val: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val);
  };

  // 3. Save Opening Stock
  const handleSaveOpeningStock = async () => {
    if (productRows.length === 0) {
      toast.info('No products to record stock for.');
      handleSkip();
      return;
    }

    setIsSaving(true);
    try {
      const entries = productRows.map((r) => ({
        productId: r.productId,
        quantity: r.quantity,
        unitCost: r.unitCost,
        totalCost: r.totalCost,
        notes: r.notes.trim() || undefined,
      }));

      await api.post('/inventory/opening-stock', {
        branchId: selectedBranchId || undefined,
        entries,
        notes: `Opening stock entry for ${activeOrgName}`,
      });

      // Clear draft
      localStorage.removeItem(draftStorageKey);

      toast.success('Opening stock recorded successfully!');
      navigate(`/dashboard?org=${activeOrgId}${selectedBranchId ? `&branchId=${selectedBranchId}` : ''}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save opening stock.');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Skip Opening Stock
  const handleSkip = async () => {
    try {
      await api.post('/onboarding/inventory/skip-step', {
        step: 'opening_stock_entry',
        workspaceId: activeOrgId,
      }).catch(() => {});
    } catch {}

    toast.info('Opening stock skipped. You can perform stock adjustments at any time.');
    navigate(`/dashboard?org=${activeOrgId}${selectedBranchId ? `&branchId=${selectedBranchId}` : ''}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3">
        <Spinner size="lg" className="text-[#714b67]" />
        <p className="text-xs text-slate-400">Loading opening stock ledger...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080608] text-slate-100 flex flex-col justify-between selection:bg-[#714b67] selection:text-white">
      {/* Top Header Bar */}
      <header className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-[#0d090d] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#714b67] flex items-center justify-center text-white font-bold text-sm shadow-md">
            <Boxes className="w-5 h-5 text-[#FDB02F]" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>{activeOrgName}</span>
              <span className="text-slate-500">•</span>
              <span className="text-[#c79dbd]">Opening Stock Entry</span>
            </div>
            <p className="text-[10px] text-slate-400">Inventory Ledger & Stock Valuation</p>
          </div>
        </div>

        {/* Branch Selector */}
        <div className="flex items-center gap-3">
          {branches.length > 1 ? (
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
              <Store className="w-3.5 h-3.5 text-[#FDB02F]" />
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  const b = branches.find((item) => (item.id || item._id) === e.target.value);
                  if (b) setActiveBranch(b);
                }}
                className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium"
              >
                {branches.map((b) => (
                  <option key={b.id || b._id} value={b.id || b._id} className="bg-[#120b10] text-white">
                    {b.name} {b.isPrimary ? '(Primary)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-[#FDB02F]" />
              <span>{branches[0]?.name || 'Main Branch'}</span>
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Step Intro Card */}
        <div className="p-6 rounded-2xl bg-[#120b10] border border-[#714b67]/30 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-[11px] font-bold">
                <Sparkles className="w-3 h-3 text-[#FDB02F]" />
                <span>Onboarding Step 3 of 4</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Add your opening stock
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                Tell us how much of each product you currently have on shelf or in warehouse. This will be recorded as your official opening stock movement and used for all valuation reports and audit tracking.
              </p>
            </div>

            {/* Quick KPI Summary Box */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0 bg-white/[0.03] border border-white/10 p-3 rounded-xl">
              <div className="text-center px-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Products</span>
                <span className="text-sm font-bold text-white">{totalProductsCount}</span>
              </div>
              <div className="text-center px-1 border-x border-white/10">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Total Units</span>
                <span className="text-sm font-bold text-[#FDB02F]">{totalUnitsOnHand}</span>
              </div>
              <div className="text-center px-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Valuation</span>
                <span className="text-sm font-bold text-emerald-400">{formatNaira(totalStockValuation)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Products Table Section */}
        {totalProductsCount === 0 ? (
          /* Empty State: No products exist */
          <div className="p-10 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#714b67]/20 border border-[#714b67]/30 flex items-center justify-center text-[#FDB02F] mx-auto">
              <Boxes className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-sm font-bold text-white">No Products Found in Catalog</h3>
              <p className="text-xs text-slate-400">
                To enter opening stock, add products via 1-click sample templates or import your product CSV.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                onClick={() => setIsCatalogModalOpen(true)}
                className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-bold gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FDB02F]" />
                <span>Add / Import Products</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                className="border-white/10 text-slate-400 hover:text-white text-xs"
              >
                Skip Opening Stock
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search & Bulk Helpers */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Search products by name, SKU, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-xs bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCatalogModalOpen(true)}
                  className="h-9 border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-[#FDB02F]" />
                  <span>Add More Products</span>
                </Button>
              </div>
            </div>

            {/* Product Entries Table */}
            <div className="rounded-2xl bg-[#120b10] border border-white/10 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.04] border-b border-white/10 text-[11px] text-slate-400 uppercase font-mono">
                    <tr>
                      <th className="py-3 px-4">Product Details</th>
                      <th className="py-3 px-4 w-32">Opening Quantity</th>
                      <th className="py-3 px-4 w-36">Unit Cost (₦)</th>
                      <th className="py-3 px-4 w-36 text-right">Total Valuation</th>
                      <th className="py-3 px-4 w-12 text-center">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredRows.map((row) => {
                      const isNotesOpen = expandedNotes[row.productId];
                      return (
                        <React.Fragment key={row.productId}>
                          <tr className="hover:bg-white/[0.02] transition-colors group">
                            {/* Product Info */}
                            <td className="py-3 px-4">
                              <div className="space-y-0.5">
                                <span className="font-bold text-white block truncate">{row.name}</span>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                  <span>{row.sku}</span>
                                  <span>•</span>
                                  <span className="text-slate-400">{row.category}</span>
                                  <span>•</span>
                                  <span>Unit: {row.unit}</span>
                                </div>
                              </div>
                            </td>

                            {/* Quantity Input */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  min="0"
                                  value={row.quantity}
                                  onChange={(e) => handleQuantityChange(row.productId, e.target.value)}
                                  className="h-8 text-xs font-bold text-white bg-black/40 border-white/15 focus:border-[#714b67] w-24 text-center"
                                />
                                <span className="text-[10px] text-slate-500">{row.unit}</span>
                              </div>
                            </td>

                            {/* Unit Cost Input */}
                            <td className="py-3 px-4">
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">₦</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.unitCost}
                                  onChange={(e) => handleUnitCostChange(row.productId, e.target.value)}
                                  className="h-8 pl-6 text-xs text-white bg-black/40 border-white/15 focus:border-[#714b67] w-28"
                                />
                              </div>
                            </td>

                            {/* Total Value */}
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                              {formatNaira(row.totalCost)}
                            </td>

                            {/* Toggle Notes Action */}
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => toggleNotesRow(row.productId)}
                                className={cn(
                                  'p-1.5 rounded-lg border transition-colors cursor-pointer',
                                  row.notes || isNotesOpen
                                    ? 'bg-[#714b67]/30 border-[#714b67]/50 text-[#d4a8c9]'
                                    : 'border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                )}
                                title={row.notes ? `Note: ${row.notes}` : 'Add note for this product'}
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>

                          {/* Expandable Row for Optional Notes */}
                          {isNotesOpen && (
                            <tr className="bg-white/[0.01]">
                              <td colSpan={5} className="px-4 py-2 bg-black/20 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400 font-mono shrink-0">Product Note:</span>
                                  <Input
                                    type="text"
                                    placeholder="Optional notes e.g., Shelf 2A, Batch #001, count discrepancy note..."
                                    value={row.notes}
                                    onChange={(e) => handleNotesChange(row.productId, e.target.value)}
                                    className="h-7 text-xs bg-black/50 border-white/10 text-slate-200 placeholder:text-slate-600"
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Summary Bar */}
              <div className="p-4 bg-white/[0.02] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Recorded entries create immutable ledger records with <strong>movementType = "opening_stock"</strong>.
                  </span>
                </div>

                <div className="flex items-center gap-4 font-medium">
                  <span className="text-slate-400">
                    Total Valuation:{' '}
                    <strong className="text-white text-sm font-mono">{formatNaira(totalStockValuation)}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-white/10">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            className="w-full sm:w-auto text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            <span>Skip for Now (Start with 0 Stock)</span>
          </Button>

          <Button
            type="button"
            onClick={handleSaveOpeningStock}
            disabled={isSaving || totalProductsCount === 0}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#714b67] hover:bg-[#86597a] text-white text-xs sm:text-sm font-bold shadow-xl shadow-[#714b67]/30 transition-all hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSaving ? (
              <Spinner className="w-4 h-4 text-white" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#FDB02F]" />
            )}
            <span>Save Opening Stock & Continue</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </main>

      {/* Catalog Modal (Add products or Seed sample sets) */}
      <CatalogOnboardingModal
        isOpen={isCatalogModalOpen}
        orgId={activeOrgId}
        orgName={activeOrgName}
        onComplete={async () => {
          setIsCatalogModalOpen(false);
          // Reload products
          const res = await api
            .get<{ success?: boolean; data?: { products: any[] } } | { products: any[] }>(
              `/inventory/products`
            )
            .catch(() => null);

          const raw = (res as any)?.data?.products || (res as any)?.products || [];
          setProductRows(
            raw.map((p: any) => ({
              productId: String(p._id || p.id),
              name: p.name || 'Unnamed Product',
              sku: p.sku || 'SKU-N/A',
              barcode: p.barcode || '',
              category: p.category || 'General',
              unit: p.unit || 'pcs',
              quantity: p.stockQuantity !== undefined ? p.stockQuantity : 0,
              unitCost: p.costPrice !== undefined ? p.costPrice : 0,
              totalCost: (p.stockQuantity || 0) * (p.costPrice || 0),
              notes: '',
            }))
          );
        }}
        onSkip={() => setIsCatalogModalOpen(false)}
      />
    </div>
  );
};

export default OpeningStockEntry;
