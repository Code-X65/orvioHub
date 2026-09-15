import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import {
  Package,
  Layers,
  ShoppingBag,
  Receipt,
  Users,
  Loader2,
  Save,
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

  // Settings State
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
    negativeStockAllowed: false,
    lowStockThreshold: 10,
    stockAdjustmentApprovalRequired: false,
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

  const [receiptSettings, setReceiptSettings] = useState({
    storeName: '',
    tagline: 'Quality goods & exceptional service',
    headerText: 'Welcome to our store',
    footerMessage: 'Thank you for your patronage! Please keep this receipt.',
    returnPolicy: 'Goods in original condition may be returned within 7 days.',
    tin: '',
    vatRate: 7.5,
    enableVat: false,
    showCashier: true,
    showCustomer: true,
    showBarcode: true,
    paperWidth: '80mm',
    phone: '',
    email: '',
    address: '',
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
        if (app.settings.stockRules) setStockRules(app.settings.stockRules);
        if (app.settings.salesRules) setSalesRules(app.settings.salesRules);
        if (app.settings.receiptSettings) setReceiptSettings(app.settings.receiptSettings);
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
          receiptSettings,
        },
      });
      toast.success('Inventory application settings saved.');
    } catch (err: any) {
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const navItems: SettingsNavItem[] = [
    { id: 'products', label: 'Product Configuration', icon: Package },
    { id: 'stock', label: 'Stock Rules & Alerts', icon: Layers },
    { id: 'sales', label: 'POS & Sales Rules', icon: ShoppingBag },
    { id: 'receipts', label: 'Receipt Template', icon: Receipt },
    { id: 'permissions', label: 'Inventory Roles & RBAC', icon: Users },
  ];

  return (
    <SettingsLayout
      title="Inventory Settings"
      subtitle="Configure SKU conventions, stock decrement policies, POS rules, and receipt formatting"
      contextTag="Inventory & POS"
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
                <h2 className="text-base font-bold text-white">Product & SKU Configuration</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Standards for automated barcode assignment, SKU prefixes, and default categories.
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
                      className="w-4 h-4 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
                    <div>
                      <h4 className="text-xs font-bold text-white">Enable Barcode Scanning</h4>
                      <p className="text-[11px] text-slate-400">
                        Allow USB/Bluetooth handheld barcode scanners at POS register.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={productConfig.enableBarcodes}
                      onChange={(e) => setProductConfig({ ...productConfig, enableBarcodes: e.target.checked })}
                      disabled={!isOwnerOrAdmin}
                      className="w-4 h-4 rounded"
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
                <h2 className="text-base font-bold text-white">Stock Decrement & Threshold Policies</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Accounting costing methods and global stock alerting limits.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Default Low-Stock Threshold</Label>
                  <Input
                    type="number"
                    min={0}
                    value={stockRules.lowStockThreshold}
                    onChange={(e) => setStockRules({ ...stockRules, lowStockThreshold: parseInt(e.target.value) || 0 })}
                    disabled={!isOwnerOrAdmin}
                    className="bg-black/40 border-white/10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Inventory Costing Method</Label>
                  <select
                    value={stockRules.costingMethod}
                    onChange={(e) => setStockRules({ ...stockRules, costingMethod: e.target.value })}
                    disabled={!isOwnerOrAdmin}
                    className="w-full h-9 px-3 bg-black/40 border border-white/10 rounded-md text-xs text-white focus:border-[#714b67] focus:outline-none"
                  >
                    <option value="FIFO">First In, First Out (FIFO)</option>
                    <option value="WEIGHTED_AVERAGE">Weighted Average Cost</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-3 pt-2">
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
                    <div>
                      <h4 className="text-xs font-bold text-white">Require Approval for Stock Adjustments</h4>
                      <p className="text-[11px] text-slate-400">
                        Manual inventory count changes require manager sign-off.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={stockRules.stockAdjustmentApprovalRequired}
                      onChange={(e) => setStockRules({ ...stockRules, stockAdjustmentApprovalRequired: e.target.checked })}
                      disabled={!isOwnerOrAdmin}
                      className="w-4 h-4 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
                    <div>
                      <h4 className="text-xs font-bold text-white">Require Approval for Branch Transfers</h4>
                      <p className="text-[11px] text-slate-400">
                        Transfers between stores require destination branch acceptance.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={stockRules.branchTransferApprovalRequired}
                      onChange={(e) => setStockRules({ ...stockRules, branchTransferApprovalRequired: e.target.checked })}
                      disabled={!isOwnerOrAdmin}
                      className="w-4 h-4 rounded"
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
                <h2 className="text-base font-bold text-white">POS Checkout & Sales Policies</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Allowed payment types, discount limits, and credit sale permissions.
                </p>
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
                  <Label className="text-xs text-slate-200">Receipt Number Prefix</Label>
                  <Input
                    value={salesRules.receiptPrefix}
                    onChange={(e) => setSalesRules({ ...salesRules, receiptPrefix: e.target.value })}
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
                        Allow recording sales without immediate payment settlement.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={salesRules.allowCreditSales}
                      onChange={(e) => setSalesRules({ ...salesRules, allowCreditSales: e.target.checked })}
                      disabled={!isOwnerOrAdmin}
                      className="w-4 h-4 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/40">
                    <div>
                      <h4 className="text-xs font-bold text-white">Allow Sale Ticket Cancellation</h4>
                      <p className="text-[11px] text-slate-400">
                        Allow cashiers to void or reverse posted transactions with audit tracking.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={salesRules.saleCancellationAllowed}
                      onChange={(e) => setSalesRules({ ...salesRules, saleCancellationAllowed: e.target.checked })}
                      disabled={!isOwnerOrAdmin}
                      className="w-4 h-4 rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Receipts Tab with Live Preview */}
          {activeTab === 'receipts' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-base font-bold text-white">Receipt Design & Layout</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Customize thermal receipt headers, footer thank-you messages, and tax information.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Form Inputs */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-200">Store Name on Receipt</Label>
                    <Input
                      value={receiptSettings.storeName}
                      onChange={(e) => setReceiptSettings({ ...receiptSettings, storeName: e.target.value })}
                      placeholder="e.g. Code X Stores"
                      disabled={!isOwnerOrAdmin}
                      className="bg-black/40 border-white/10 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-200">Tagline / Subheader</Label>
                    <Input
                      value={receiptSettings.tagline}
                      onChange={(e) => setReceiptSettings({ ...receiptSettings, tagline: e.target.value })}
                      disabled={!isOwnerOrAdmin}
                      className="bg-black/40 border-white/10 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-200">Footer Thank You Message</Label>
                    <Input
                      value={receiptSettings.footerMessage}
                      onChange={(e) => setReceiptSettings({ ...receiptSettings, footerMessage: e.target.value })}
                      disabled={!isOwnerOrAdmin}
                      className="bg-black/40 border-white/10 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-200">Return Policy Note</Label>
                    <Input
                      value={receiptSettings.returnPolicy}
                      onChange={(e) => setReceiptSettings({ ...receiptSettings, returnPolicy: e.target.value })}
                      disabled={!isOwnerOrAdmin}
                      className="bg-black/40 border-white/10 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-200">Tax ID / TIN</Label>
                      <Input
                        value={receiptSettings.tin}
                        onChange={(e) => setReceiptSettings({ ...receiptSettings, tin: e.target.value })}
                        placeholder="e.g. 12345678-0001"
                        disabled={!isOwnerOrAdmin}
                        className="bg-black/40 border-white/10 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-200">Paper Width</Label>
                      <select
                        value={receiptSettings.paperWidth}
                        onChange={(e) => setReceiptSettings({ ...receiptSettings, paperWidth: e.target.value })}
                        disabled={!isOwnerOrAdmin}
                        className="w-full h-9 px-3 bg-black/40 border border-white/10 rounded-md text-xs text-white focus:border-[#714b67] focus:outline-none"
                      >
                        <option value="80mm">80mm (Standard POS)</option>
                        <option value="58mm">58mm (Mobile POS)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Live Preview Paper */}
                <div className="p-6 bg-slate-900 border border-white/10 rounded-2xl flex flex-col items-center shadow-2xl">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-4">
                    Live Receipt Thermal Preview
                  </div>

                  <div className="w-64 bg-white text-black p-5 rounded-lg shadow-xl font-mono text-[11px] leading-tight space-y-3">
                    <div className="text-center space-y-1 border-b border-black/20 pb-2">
                      <div className="font-bold text-sm tracking-tight">{receiptSettings.storeName || 'ORVIOHUB STORE'}</div>
                      <div className="text-[10px] text-gray-600">{receiptSettings.tagline}</div>
                      <div className="text-[9px] text-gray-500">Ikeja, Lagos, Nigeria</div>
                      {receiptSettings.tin && <div className="text-[9px]">TIN: {receiptSettings.tin}</div>}
                    </div>

                    <div className="text-[10px] text-gray-600 space-y-0.5">
                      <div className="flex justify-between"><span>Rcpt: INV-00421</span><span>Date: 15/09/2026</span></div>
                      <div className="flex justify-between"><span>Cashier: Admin User</span><span>Time: 14:32</span></div>
                    </div>

                    <div className="border-t border-b border-black/20 py-1.5 space-y-1">
                      <div className="flex justify-between font-semibold"><span>Item</span><span>Total</span></div>
                      <div className="flex justify-between text-[10px]"><span>1x Coffee Beans 1kg</span><span>₦ 12,500</span></div>
                      <div className="flex justify-between text-[10px]"><span>2x Milk Cartons</span><span>₦ 4,000</span></div>
                    </div>

                    <div className="space-y-1 font-bold">
                      <div className="flex justify-between"><span>SUBTOTAL</span><span>₦ 16,500</span></div>
                      <div className="flex justify-between"><span>VAT (7.5%)</span><span>₦ 1,237.50</span></div>
                      <div className="flex justify-between text-xs border-t border-black/20 pt-1">
                        <span>TOTAL</span><span>₦ 17,737.50</span>
                      </div>
                    </div>

                    <div className="text-center text-[9px] text-gray-600 pt-2 border-t border-dashed border-black/20 space-y-1">
                      <div>{receiptSettings.footerMessage}</div>
                      <div>{receiptSettings.returnPolicy}</div>
                      <div className="font-bold">*** THANK YOU ***</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. Permissions Tab */}
          {activeTab === 'permissions' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-white/10 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Inventory Role Privileges</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Review permissions granted across Manager, Cashier, Stock Manager, and Accountant roles.
                  </p>
                </div>
                <select
                  value={selectedRoleForMatrix}
                  onChange={(e) => setSelectedRoleForMatrix(e.target.value)}
                  className="h-8 px-3 bg-black/40 border border-white/10 text-white rounded-lg text-xs"
                >
                  <option value="owner">Inventory Owner</option>
                  <option value="manager">Inventory Manager</option>
                  <option value="cashier">Cashier</option>
                  <option value="stock_manager">Stock Manager</option>
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

          {/* Submit Footer */}
          {isOwnerOrAdmin && activeTab !== 'permissions' && (
            <div className="flex justify-end pt-4 border-t border-white/10">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold px-5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Save Inventory Settings
              </Button>
            </div>
          )}
        </form>
      )}
    </SettingsLayout>
  );
};
