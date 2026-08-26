import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Boxes,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  Receipt,
  LayoutGrid,
  RefreshCw,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const InventoryDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const [metrics, setMetrics] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Quick POS Checkout Modal State
  const [isPosOpen, setIsPosOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [posQuantity, setPosQuantity] = useState(1);
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  const loadData = async (targetWsId?: string) => {
    const wsId = targetWsId || currentWorkspace?.id;
    if (!wsId) return;

    setIsLoading(true);
    try {
      const [metricsRes, productsRes] = await Promise.all([
        api.get<{ metrics: any }>('/inventory/dashboard', {
          headers: { 'x-workspace-id': wsId },
        }),
        api.get<{ products: any[] }>('/inventory/products', {
          headers: { 'x-workspace-id': wsId },
        }),
      ]);

      setMetrics(metricsRes.metrics);
      setProducts(productsRes.products || []);
    } catch (err: any) {
      toast.error('Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadData(currentWorkspace.id);
    }
  }, [currentWorkspace?.id]);

  const handleQuickSale = async () => {
    if (!selectedProduct || !currentWorkspace?.id) return;
    setIsProcessingSale(true);
    try {
      await api.post(
        '/inventory/sales',
        {
          items: [{ productId: selectedProduct._id || selectedProduct.id, quantity: Number(posQuantity) }],
          paymentMethod: 'CASH',
        },
        { headers: { 'x-workspace-id': currentWorkspace.id } }
      );
      toast.success(`Sale recorded for ${selectedProduct.name}!`);
      setIsPosOpen(false);
      setSelectedProduct(null);
      setPosQuantity(1);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record sale.');
    } finally {
      setIsProcessingSale(false);
    }
  };

  const currency = currentWorkspace?.currency || 'NGN';
  const workspaceName = currentWorkspace?.name || 'Code X Stores';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-sm bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
                <Boxes className="w-5 h-5" />
              </div>
              <div className="hidden sm:block">
                <span className="font-bold text-white tracking-tight">Inventory Management</span>
                <span className="text-[10px] block text-slate-400 font-mono">
                  inventory.orviohub.com • {workspaceName}
                </span>
              </div>
            </div>
            <WorkspaceSwitcher productKey="inventory" />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/launcher')}
              className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs hidden sm:flex"
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
              App Switcher
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/inventory/onboarding')}
              className="border-slate-800 text-indigo-400 hover:bg-slate-800 text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Onboarding Wizard
            </Button>

            <Button
              onClick={() => setIsPosOpen(true)}
              className="h-9 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-sm shadow-md shadow-emerald-500/20"
            >
              <ShoppingCart className="w-4 h-4 mr-1.5" />
              New POS Sale
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-rose-400 hover:bg-rose-500/10"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
            <Spinner className="w-8 h-8 text-indigo-500" />
            <p className="text-sm">Fetching real-time inventory telemetry...</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Revenue */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Total Revenue</span>
                  <div className="w-8 h-8 rounded-sm bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-white tracking-tight">
                  {currency} {(metrics?.totalRevenue || 0).toLocaleString()}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Real-time POS synced</span>
                </div>
              </div>

              {/* Transactions Count */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Sales Transactions</span>
                  <div className="w-8 h-8 rounded-sm bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-white tracking-tight">
                  {metrics?.totalSalesCount || 0} Orders
                </p>
                <p className="text-[11px] text-slate-500">Atomic stock movements recorded</p>
              </div>

              {/* Total Catalog Items */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Catalog SKUs</span>
                  <div className="w-8 h-8 rounded-sm bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                    <Boxes className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-white tracking-tight">
                  {metrics?.totalProducts || 0} Items
                </p>
                <p className="text-[11px] text-slate-500">
                  Stock Value: {currency} {(metrics?.totalStockValue || 0).toLocaleString()}
                </p>
              </div>

              {/* Low Stock Alerts */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Low Stock Alerts</span>
                  <div className="w-8 h-8 rounded-sm bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-amber-400 tracking-tight">
                  {metrics?.lowStockCount || 0} Warning(s)
                </p>
                <p className="text-[11px] text-slate-500">Items below reorder threshold</p>
              </div>
            </div>

            {/* Main Grid: Products Table & Recent Orders */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Product Catalog */}
              <div className="lg:col-span-2 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">Store Catalog & Live Quantities</h3>
                    <p className="text-xs text-slate-400">Multi-item stock tracking across branches</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadData()}
                    className="h-8 border-slate-800 text-slate-400 hover:text-white"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">SKU</th>
                        <th className="p-3.5">Product</th>
                        <th className="p-3.5">Category</th>
                        <th className="p-3.5 text-right">Price</th>
                        <th className="p-3.5 text-right">Stock</th>
                        <th className="p-3.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {products.map((p) => {
                        const isLow = p.stockQuantity <= p.minStockLevel;
                        return (
                          <tr key={p._id || p.sku} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-mono text-indigo-400 font-semibold">{p.sku}</td>
                            <td className="p-3.5 font-medium text-white">{p.name}</td>
                            <td className="p-3.5 text-slate-400">{p.category}</td>
                            <td className="p-3.5 text-right font-bold text-white">
                              {currency} {p.sellingPrice.toLocaleString()}
                            </td>
                            <td className="p-3.5 text-right">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded text-[11px] font-semibold border',
                                  isLow
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                )}
                              >
                                {p.stockQuantity} {p.unit}
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedProduct(p);
                                  setIsPosOpen(true);
                                }}
                                className="h-7 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                              >
                                Sell
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Sales Activity */}
              <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 space-y-4 shadow-xl flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-white text-base">Recent Sales Stream</h3>
                  <p className="text-xs text-slate-400">Digital receipts and payment records</p>

                  <div className="mt-4 space-y-3">
                    {metrics?.recentSales?.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs">
                        No sales recorded yet. Click "New POS Sale" to start.
                      </div>
                    ) : (
                      metrics?.recentSales?.map((s: any) => (
                        <div
                          key={s._id}
                          className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between"
                        >
                          <div className="space-y-0.5">
                            <p className="font-bold text-white text-xs">{s.saleNumber}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {new Date(s.createdAt).toLocaleTimeString()} • {s.paymentMethod}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-extrabold text-emerald-400">
                              {currency} {s.totalAmount?.toLocaleString()}
                            </p>
                            <span className="text-[10px] text-slate-400">{s.items?.length} item(s)</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <Button
                    onClick={() => navigate('/inventory/onboarding')}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-sm h-10"
                  >
                    Rerun Onboarding Checklist
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* POS Quick Sale Modal */}
      {isPosOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">POS Quick Checkout</h3>
              <button
                onClick={() => setIsPosOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Select Product</label>
                <select
                  value={selectedProduct?._id || ''}
                  onChange={(e) => {
                    const p = products.find((x) => x._id === e.target.value);
                    setSelectedProduct(p || null);
                  }}
                  className="w-full h-10 px-3 bg-slate-950 border border-slate-800 text-white rounded-md text-sm"
                >
                  <option value="">-- Choose item --</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id} className="bg-slate-900">
                      {p.name} ({currency} {p.sellingPrice.toLocaleString()}) - Stock: {p.stockQuantity}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Quantity</label>
                <Input
                  type="number"
                  min={1}
                  max={selectedProduct ? selectedProduct.stockQuantity : 99}
                  value={posQuantity}
                  onChange={(e) => setPosQuantity(Number(e.target.value))}
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>

              {selectedProduct && (
                <div className="p-3 rounded-sm bg-slate-950 border border-slate-800 text-xs flex justify-between">
                  <span className="text-slate-400">Total Payable:</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {currency} {(selectedProduct.sellingPrice * posQuantity).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsPosOpen(false)}
                className="flex-1 border-slate-800"
              >
                Cancel
              </Button>
              <Button
                disabled={!selectedProduct || isProcessingSale}
                onClick={handleQuickSale}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                {isProcessingSale ? <Spinner className="w-4 h-4 text-white" /> : 'Record Sale'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-500">
        Orviohub Multi-Product SaaS • Inventory Telemetry Active
      </footer>
    </div>
  );
};
