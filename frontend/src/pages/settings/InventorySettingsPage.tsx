import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { api } from '@/lib/api';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { SettingsSidebar, type SettingsNavItem } from '@/components/settings/SettingsSidebar';
import { WorkspaceContextHeader } from '@/components/settings/WorkspaceContextHeader';
import { PermissionMatrix } from '@/components/settings/PermissionMatrix';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useComfortLevel } from '@/hooks/useComfortLevel';
import {
  Package,
  Layers,
  ShoppingBag,
  Users,
  Loader2,
  Save,
  ArrowRight,
  Info,
  Store,
  Sliders,
} from 'lucide-react';

export const InventorySettingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { memberships, activeOrganizationId } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();

  const tabParam = searchParams.get('tab') || 'products';
  const [activeTab, setActiveTab] = useState<string>(tabParam);

  const activeMembership =
    memberships.find((m) => m.organization.id === activeOrganizationId) || memberships[0];
  const workspaceId = activeMembership?.organization?.id || currentWorkspace?.id;
  const isOwnerOrAdmin = activeMembership?.role === 'OWNER' || activeMembership?.role === 'ADMIN';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Application-level Settings State
  const [productConfig, setProductConfig] = useState({
    skuPrefix: 'PRD',
    autoGenerateSku: true,
    enableBarcodes: true,
    defaultCategory: 'General',
    allowProductArchive: true,
    priceLevelsEnabled: false,
    costVisibility: 'admin_only',
  });

  const [stockRules, setStockRules] = useState({
    costingMethod: 'FIFO',
    autoDeductOnSale: true,
    branchTransferApprovalRequired: true,
  });

  const [salesRules, setSalesRules] = useState({
    paymentMethods: ['CASH', 'CARD', 'TRANSFER'],
    allowCreditSales: false,
    allowDiscounts: true,
    maxDiscountPercentage: 15,
    requireCustomerForCredit: true,
    saleCancellationAllowed: true,
    receiptPrefix: 'INV-',
  });

  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<string>('cashier');

  // Load Inventory Settings
  const loadSettings = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      const res = await api.get<{ data: { application: any } }>(
        `/workspaces/${workspaceId}/applications/inventory/settings`
      );
      const app = res.data?.application;
      if (app?.settings) {
        if (app.settings.productConfig) setProductConfig(app.settings.productConfig);
        if (app.settings.stockRules) {
          setStockRules({
            costingMethod: app.settings.stockRules.costingMethod || 'FIFO',
            autoDeductOnSale: app.settings.stockRules.autoDeductOnSale ?? true,
            branchTransferApprovalRequired: app.settings.stockRules.branchTransferApprovalRequired ?? true,
          });
        }
        if (app.settings.salesRules) setSalesRules(app.settings.salesRules);
      }
    } catch {
      // Use defaults if empty
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    setIsSaving(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/applications/inventory/settings`, {
        settings: {
          productConfig,
          stockRules,
          salesRules,
        },
      });
      toast.success('Inventory application settings saved.');
    } catch (err: any) {
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const { comfortLevelId, densityTier } = useComfortLevel();

  const COMFORT_LABELS: Record<string, { label: string; desc: string; color: string }> = {
    very: { label: 'Very comfortable', desc: 'Compact layout, tooltips hidden, concise empty states', color: 'text-emerald-400' },
    somewhat: { label: 'Somewhat comfortable', desc: 'Default layout with guided tooltips', color: 'text-blue-400' },
    not_very: { label: 'Not very comfortable', desc: 'Spacious layout, larger controls, extended onboarding tour', color: 'text-amber-400' },
    not_at_all: { label: 'First time with business apps', desc: 'Maximum guidance, large targets, verbose empty states', color: 'text-rose-400' },
  };

  const navItems: SettingsNavItem[] = [
    { id: 'products', label: 'Product Configuration', icon: Package },
    { id: 'stock', label: 'Stock Accounting Rules', icon: Layers },
    { id: 'sales', label: 'Sales & POS Policies', icon: ShoppingBag },
    { id: 'permissions', label: 'Inventory Roles & RBAC', icon: Users },
    { id: 'preferences', label: 'UI Preferences', icon: Sliders },
  ];

  return (
    <SettingsLayout
      title="Inventory Settings"
      subtitle="Configure organization-wide catalog standards, inventory costing methods, and POS sales policies"
      contextTag="Inventory Application"
      sidebar={
        <SettingsSidebar
          items={navItems}
          activeId={activeTab}
          onSelect={(tab) => {
            setActiveTab(tab);
            setSearchParams({ tab });
          }}
          header={<WorkspaceContextHeader />}
        />
      }
    >
      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-6 h-6 text-[#e6a8d6] animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading inventory settings...</p>
        </div>
      ) : (
        <form onSubmit={handleSaveAll} className="space-y-6">
          {/* 1. Products Tab */}
          {activeTab === 'products' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white">Global Product & Catalog Configuration</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Standards for automated barcode assignment, SKU generation prefixes, and default product categorization across all branches.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Default SKU Prefix</Label>
                  <Input
                    value={productConfig.skuPrefix}
                    onChange={(e) => setProductConfig({ ...productConfig, skuPrefix: e.target.value.toUpperCase() })}
                    placeholder="PRD"
                    disabled={!isOwnerOrAdmin}
                    className="bg-black/40 border-white/10 text-xs font-mono uppercase"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Default Catalog Category</Label>
                  <Input
                    value={productConfig.defaultCategory}
                    onChange={(e) => setProductConfig({ ...productConfig, defaultCategory: e.target.value })}
                    placeholder="General"
                    disabled={!isOwnerOrAdmin}
                    className="bg-black/40 border-white/10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Cost Price Visibility</Label>
                  <select
                    value={productConfig.costVisibility}
                    onChange={(e) => setProductConfig({ ...productConfig, costVisibility: e.target.value })}
                    disabled={!isOwnerOrAdmin}
                    className="w-full h-9 px-3 bg-black/40 border border-white/10 rounded-md text-xs text-white focus:border-[#714b67] focus:outline-none cursor-pointer"
                  >
                    <option value="admin_only">Owners & Managers Only</option>
                    <option value="all_staff">All Inventory Staff</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-3 pt-2">
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
                    <div>
                      <h4 className="text-xs font-bold text-white">Auto-Generate SKU Numbers</h4>
                      <p className="text-[11px] text-slate-400">
                        Automatically assign sequential SKU codes when creating new products.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={productConfig.autoGenerateSku}
                      onChange={(e) => setProductConfig({ ...productConfig, autoGenerateSku: e.target.checked })}
                      disabled={!isOwnerOrAdmin}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
                    <div>
                      <h4 className="text-xs font-bold text-white">Enable Barcode Scanning</h4>
                      <p className="text-[11px] text-slate-400">
                        Allow USB/Bluetooth handheld barcode scanners at POS registers.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={productConfig.enableBarcodes}
                      onChange={(e) => setProductConfig({ ...productConfig, enableBarcodes: e.target.checked })}
                      disabled={!isOwnerOrAdmin}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
                    <div>
                      <h4 className="text-xs font-bold text-white">Allow Product Archiving</h4>
                      <p className="text-[11px] text-slate-400">
                        Permit soft-deleting products to preserve historic sales reports and stock ledger entries.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={productConfig.allowProductArchive}
                      onChange={(e) => setProductConfig({ ...productConfig, allowProductArchive: e.target.checked })}
                      disabled={!isOwnerOrAdmin}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Stock Rules Tab */}
          {activeTab === 'stock' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white">Stock Accounting & Valuation Policies</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Global valuation methodology and inventory movement automation rules.
                </p>
              </div>

              {/* Notice Banner pointing to Branch Settings for location-level rules */}
              <div className="p-4 rounded-xl bg-purple-950/30 border border-[#714b67]/40 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-[#e6a8d6] shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold text-white">Looking for Location-Specific Stock Alert Levels?</p>
                    <p className="text-slate-400">
                      Low-stock thresholds, negative stock checkout permissions, and physical stock count approval are configured per branch.
                    </p>
                  </div>
                </div>
                <Link
                  to="/settings/branches?tab=inventory"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#714b67]/30 hover:bg-[#714b67]/50 text-[#f3bce2] text-xs font-semibold border border-[#714b67]/40 shrink-0 transition-colors"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Branch Inventory Rules</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Inventory Costing Method</Label>
                  <select
                    value={stockRules.costingMethod}
                    onChange={(e) => setStockRules({ ...stockRules, costingMethod: e.target.value })}
                    disabled={!isOwnerOrAdmin}
                    className="w-full h-9 px-3 bg-black/40 border border-white/10 rounded-md text-xs text-white focus:border-[#714b67] focus:outline-none cursor-pointer"
                  >
                    <option value="FIFO">First In, First Out (FIFO)</option>
                    <option value="WEIGHTED_AVERAGE">Weighted Average Cost (AVCO)</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-3 pt-2">
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
                    <div>
                      <h4 className="text-xs font-bold text-white">Auto-Deduct Stock on Completed Sale</h4>
                      <p className="text-[11px] text-slate-400">
                        Automatically decrement inventory quantities in real-time when cashiers complete a checkout.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={stockRules.autoDeductOnSale}
                      onChange={(e) => setStockRules({ ...stockRules, autoDeductOnSale: e.target.checked })}
                      disabled={!isOwnerOrAdmin}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
                    <div>
                      <h4 className="text-xs font-bold text-white">Require Two-Way Approval for Branch Transfers</h4>
                      <p className="text-[11px] text-slate-400">
                        Inter-store inventory transfers require receiving confirmation at the destination location.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={stockRules.branchTransferApprovalRequired}
                      onChange={(e) => setStockRules({ ...stockRules, branchTransferApprovalRequired: e.target.checked })}
                      disabled={!isOwnerOrAdmin}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Sales Rules Tab */}
          {activeTab === 'sales' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white">Cross-Branch POS & Checkout Policies</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Organization-wide payment acceptance types, cashier discount ceilings, and credit sale permissions.
                </p>
              </div>

              {/* Notice Banner pointing to Branch Settings for Thermal Receipts */}
              <div className="p-4 rounded-xl bg-purple-950/30 border border-[#714b67]/40 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-[#e6a8d6] shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold text-white">Configuring Thermal Receipts & Printers?</p>
                    <p className="text-slate-400">
                      Receipt headers, footers, tax ID (TIN), paper widths (80mm/58mm), and branch phone numbers are customized per branch location.
                    </p>
                  </div>
                </div>
                <Link
                  to="/settings/branches?tab=pos"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#714b67]/30 hover:bg-[#714b67]/50 text-[#f3bce2] text-xs font-semibold border border-[#714b67]/40 shrink-0 transition-colors"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Branch POS Receipts</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Maximum Cashier Discount (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={salesRules.maxDiscountPercentage}
                    onChange={(e) => setSalesRules({ ...salesRules, maxDiscountPercentage: parseInt(e.target.value) || 0 })}
                    disabled={!isOwnerOrAdmin}
                    className="bg-black/40 border-white/10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Default Global Invoice Prefix</Label>
                  <Input
                    value={salesRules.receiptPrefix}
                    onChange={(e) => setSalesRules({ ...salesRules, receiptPrefix: e.target.value.toUpperCase() })}
                    placeholder="INV-"
                    disabled={!isOwnerOrAdmin}
                    className="bg-black/40 border-white/10 text-xs font-mono uppercase"
                  />
                </div>

                <div className="sm:col-span-2 space-y-3 pt-2">
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
                    <div>
                      <h4 className="text-xs font-bold text-white">Allow Credit Sales (Pay Later)</h4>
                      <p className="text-[11px] text-slate-400">
                        Allow recording sales on customer account without immediate cash/transfer settlement.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={salesRules.allowCreditSales}
                      onChange={(e) => setSalesRules({ ...salesRules, allowCreditSales: e.target.checked })}
                      disabled={!isOwnerOrAdmin}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
                    <div>
                      <h4 className="text-xs font-bold text-white">Require Customer Profile for Credit Sales</h4>
                      <p className="text-[11px] text-slate-400">
                        Enforce attaching a registered customer with verified phone number before issuing credit.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={salesRules.requireCustomerForCredit}
                      onChange={(e) => setSalesRules({ ...salesRules, requireCustomerForCredit: e.target.checked })}
                      disabled={!isOwnerOrAdmin}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
                    <div>
                      <h4 className="text-xs font-bold text-white">Allow Sale Ticket Void & Cancellation</h4>
                      <p className="text-[11px] text-slate-400">
                        Permit authorized staff to void transactions with automated inventory reversal and audit logging.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={salesRules.saleCancellationAllowed}
                      onChange={(e) => setSalesRules({ ...salesRules, saleCancellationAllowed: e.target.checked })}
                      disabled={!isOwnerOrAdmin}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Permissions Tab */}
          {activeTab === 'permissions' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-white/10 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Inventory Role Privileges & RBAC</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Review and verify role permissions across Manager, Cashier, Stock Manager, and Accountant.
                  </p>
                </div>
                <select
                  value={selectedRoleForMatrix}
                  onChange={(e) => setSelectedRoleForMatrix(e.target.value)}
                  className="h-8 px-3 bg-black/40 border border-white/10 text-white rounded-lg text-xs cursor-pointer"
                >
                  <option value="owner">Inventory Owner</option>
                  <option value="manager">Inventory Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="stock_manager">Stock Keeper</option>
                  <option value="accountant">Accountant</option>
                </select>
              </div>

              <PermissionMatrix
                selectedRole={selectedRoleForMatrix}
                assignedPermissions={
                  selectedRoleForMatrix === 'owner'
                    ? ['workspace.view', 'workspace.update', 'inventory.view', 'inventory.create_product', 'inventory.adjust_stock', 'inventory.record_sales', 'inventory.cancel_sales', 'inventory.view_cost', 'branch.view', 'branch.manage_hours', 'branch.manage_members', 'branch.manage_operations']
                    : selectedRoleForMatrix === 'manager'
                    ? ['inventory.view', 'inventory.create_product', 'inventory.adjust_stock', 'inventory.record_sales', 'inventory.cancel_sales', 'inventory.view_cost', 'branch.view', 'branch.manage_hours', 'branch.manage_operations']
                    : selectedRoleForMatrix === 'cashier'
                    ? ['inventory.view', 'inventory.record_sales', 'branch.view']
                    : ['inventory.view', 'inventory.create_product', 'inventory.adjust_stock', 'branch.view']
                }
                readOnly
              />
            </div>
          )}

          {/* 5. UI Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white">UI Preferences</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your team's comfort level controls layout density, tooltip visibility, onboarding tour depth, and empty-state guidance across the inventory app.
                </p>
              </div>

              {/* Current comfort level card */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Current Team Comfort Level</p>
                    <p className={`text-sm font-bold ${COMFORT_LABELS[comfortLevelId]?.color ?? 'text-white'}`}>
                      {COMFORT_LABELS[comfortLevelId]?.label ?? comfortLevelId}
                    </p>
                    <p className="text-xs text-slate-400">
                      {COMFORT_LABELS[comfortLevelId]?.desc}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-mono px-2 py-1 rounded-md border border-white/10 text-slate-300 bg-white/5">
                    {densityTier}
                  </span>
                </div>

                {/* Active adaptations */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {[
                    { label: 'Layout density', value: densityTier },
                    { label: 'Tooltips', value: comfortLevelId === 'very' ? 'Hidden' : 'Visible' },
                    { label: 'Button size', value: comfortLevelId === 'very' ? 'Small' : comfortLevelId === 'somewhat' ? 'Default' : 'Large' },
                    { label: 'Onboarding tour', value: (comfortLevelId === 'not_very' || comfortLevelId === 'not_at_all') ? 'Extended' : 'Standard' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-white/5 border border-white/5 p-3 space-y-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                      <p className="text-xs font-semibold text-slate-200 capitalize">{value}</p>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="flex items-center gap-3 pt-3 border-t border-white/10">
                  <Link
                    to={`/onboard/inventory-setup?org=${workspaceId}&step=4`}
                    className="inline-flex items-center gap-1.5 text-xs text-[#c79dbd] hover:text-[#e6a8d6] font-medium transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Change comfort level
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                  <span className="text-slate-600 text-xs">• Takes you to the team questionnaire</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Footer */}
          {isOwnerOrAdmin && activeTab !== 'permissions' && activeTab !== 'preferences' && (
            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-5 cursor-pointer shadow-md shadow-[#714b67]/20"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Save Inventory Application Settings
              </Button>
            </div>
          )}
        </form>
      )}
    </SettingsLayout>
  );
};
