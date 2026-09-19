import React, { useState } from 'react';
import { useBranchStore } from '@/stores/useBranchStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Package,
  Receipt,
  Warehouse,
  FileBarChart2,
  Plus,
  Search,
  SlidersHorizontal,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Barcode,
  Sparkles,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Download,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

export const ProductsCatalogPage: React.FC = () => {
  const { activeBranch } = useBranchStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const mockProducts = [
    { id: '1', sku: 'BV-7740', name: 'Premium Arabica Coffee Beans (1kg)', category: 'Beverages', price: 14500, stock: 48, minStock: 10 },
    { id: '2', sku: 'DR-1092', name: 'Sparkling Mineral Water (750ml x 12)', category: 'Beverages', price: 9200, stock: 120, minStock: 25 },
    { id: '3', sku: 'SN-4432', name: 'Roasted Almonds & Sea Salt (250g)', category: 'Snacks', price: 4800, stock: 8, minStock: 15 },
    { id: '4', sku: 'PK-9912', name: 'Eco-Friendly Takeaway Bags (Pack of 100)', category: 'Packaging', price: 6500, stock: 350, minStock: 50 },
    { id: '5', sku: 'DR-3321', name: 'Organic Cold-Pressed Juice (500ml)', category: 'Beverages', price: 3200, stock: 19, minStock: 10 },
  ];

  const filtered = mockProducts.filter(
    (p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Products & Catalog</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
              Demo Preview
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage SKU listings, pricing, and stock thresholds for <strong>{activeBranch?.name || 'Active Branch'}</strong>.
          </p>
        </div>

        <Button
          onClick={() => {
            setIsAddModalOpen(true);
            toast.info('Interactive demo: In production, this opens the full product provisioning form.');
          }}
          className="bg-gradient-to-r from-[#8a4b77] to-[#714b67] hover:from-[#9c5587] hover:to-[#815575] text-white text-xs font-semibold cursor-pointer shadow-lg shadow-[#714b67]/20"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Product SKU
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Total Products</span>
          <p className="text-xl font-bold text-white">482 SKUs</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">In Stock Value</span>
          <p className="text-xl font-bold text-emerald-400">₦4,850,200</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Low Stock Alerts</span>
          <p className="text-xl font-bold text-amber-400">14 Items</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Active Categories</span>
          <p className="text-xl font-bold text-indigo-300">12 Categories</p>
        </div>
      </div>

      {/* Table & Search Bar */}
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search products by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-black/40 border-white/10 text-xs text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-white/10 text-xs text-slate-300">
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              Filter Category
            </Button>
            <Button variant="outline" size="sm" className="border-white/10 text-xs text-slate-300">
              <Download className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              Export
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/[0.04] text-[10px] font-bold uppercase text-slate-400 border-b border-white/5">
              <tr>
                <th className="py-3 px-4">SKU / Code</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Unit Price</th>
                <th className="py-3 px-4">Branch Stock</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02] transition">
                  <td className="py-3 px-4 font-mono text-slate-400 font-medium">{item.sku}</td>
                  <td className="py-3 px-4 font-bold text-white">{item.name}</td>
                  <td className="py-3 px-4 text-slate-400">{item.category}</td>
                  <td className="py-3 px-4 font-mono font-bold text-white">₦{item.price.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className={`font-bold font-mono ${item.stock <= item.minStock ? 'text-amber-400' : 'text-slate-200'}`}>
                      {item.stock} units
                    </span>
                    {item.stock <= item.minStock && (
                      <span className="text-[10px] text-amber-400 block font-sans">Low stock</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const SalesPOSPage: React.FC = () => {
  const { activeBranch } = useBranchStore();

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Sales & Point of Sale</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
              Demo Preview
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fast checkout register & real-time cashier ledger for <strong>{activeBranch?.name || 'Active Branch'}</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Barcode className="w-4 h-4 text-[#e296cb]" />
              Scan or Search Items
            </h2>
            <Input
              placeholder="Scan barcode or type product name..."
              className="bg-black/40 border-white/10 text-sm h-11 text-white"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {['Coffee Beans (1kg)', 'Mineral Water (750ml)', 'Roasted Almonds', 'Energy Drink', 'Paper Cups (50x)', 'Gift Card ₦5,000'].map((name, i) => (
                <button
                  key={i}
                  onClick={() => toast.success(`Added ${name} to checkout cart`)}
                  className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-[#714b67]/50 hover:bg-[#714b67]/10 transition text-left cursor-pointer group"
                >
                  <span className="text-xs font-bold text-white block group-hover:text-[#e6a8d6] transition">{name}</span>
                  <span className="text-[11px] font-mono text-emerald-400 mt-1 block">₦{(i + 1) * 2200}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 h-fit">
          <h2 className="text-sm font-bold text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#e296cb]" />
              Current Order Cart
            </span>
            <span className="text-[11px] text-slate-400">Order #1042</span>
          </h2>

          <div className="space-y-2 border-b border-white/10 pb-4 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Premium Arabica Beans x 2</span>
              <span className="font-mono font-bold">₦29,000</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Sparkling Water x 1</span>
              <span className="font-mono font-bold">₦9,200</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono">₦38,200</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>VAT / Tax (7.5%)</span>
              <span className="font-mono">₦2,865</span>
            </div>
            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/10">
              <span>Total Payable</span>
              <span className="text-emerald-400 font-mono">₦41,065</span>
            </div>
          </div>

          <Button
            onClick={() => toast.success('Sale transaction recorded and receipt generated (Demo).')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 text-xs cursor-pointer"
          >
            Complete Cash / Card Checkout
          </Button>
        </div>
      </div>
    </div>
  );
};

export const StockTransfersPage: React.FC = () => {
  const { activeBranch } = useBranchStore();

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Stock Movements & Transfers</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
              Demo Preview
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track stock receipts, inter-branch transfers, and audit adjustments for <strong>{activeBranch?.name || 'Active Branch'}</strong>.
          </p>
        </div>

        <Button
          onClick={() => toast.info('Transfer dispatch form loaded in interactive demo.')}
          className="bg-gradient-to-r from-[#8a4b77] to-[#714b67] text-white text-xs font-semibold cursor-pointer"
        >
          <ArrowRightLeft className="w-4 h-4 mr-1.5" />
          Initiate Inter-Branch Transfer
        </Button>
      </div>

      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
        <h2 className="text-sm font-bold text-white">Recent Stock Movement Ledger</h2>
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/[0.04] text-[10px] font-bold uppercase text-slate-400 border-b border-white/5">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Item SKU</th>
                <th className="py-3 px-4">Movement Type</th>
                <th className="py-3 px-4">Source / Destination</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4 text-right">Logged By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { date: 'Today, 2:45 PM', sku: 'BV-7740', type: 'Stock Receipt (PO-88)', loc: 'Supplier Delivery', qty: '+50 Units', by: 'Stock Manager' },
                { date: 'Today, 11:20 AM', sku: 'SN-4432', type: 'Inter-Branch Transfer', loc: 'To: Ikeja Branch', qty: '-20 Units', by: 'Branch Manager' },
                { date: 'Yesterday, 6:00 PM', sku: 'DR-1092', type: 'POS Daily Sales', loc: 'Floor Register #1', qty: '-14 Units', by: 'System / Register' },
              ].map((m, i) => (
                <tr key={i} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-mono text-slate-400">{m.date}</td>
                  <td className="py-3 px-4 font-bold text-white">{m.sku}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-200 border border-white/10 text-[10px]">
                      {m.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{m.loc}</td>
                  <td className={`py-3 px-4 font-mono font-bold ${m.qty.startsWith('+') ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {m.qty}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">{m.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const ReportsAnalyticsPage: React.FC = () => {
  const { activeBranch } = useBranchStore();

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Reports & Profit Analytics</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
              Demo Preview
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time gross margins, shrinkage, and revenue trends for <strong>{activeBranch?.name || 'Active Branch'}</strong>.
          </p>
        </div>

        <Button variant="outline" size="sm" className="border-white/10 text-xs text-slate-300">
          <Download className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
          Export Profit / Loss CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
          <span className="text-xs text-slate-400">Monthly Gross Revenue</span>
          <p className="text-2xl font-bold text-white font-mono">₦12,480,000</p>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +18.4% vs last month
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
          <span className="text-xs text-slate-400">Gross Margin %</span>
          <p className="text-2xl font-bold text-emerald-400 font-mono">34.8%</p>
          <span className="text-[11px] text-slate-400">Target: 30.0% Minimum</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
          <span className="text-xs text-slate-400">Average Transaction Size</span>
          <p className="text-2xl font-bold text-indigo-300 font-mono">₦14,250</p>
          <span className="text-[11px] text-slate-400">876 Transactions this cycle</span>
        </div>
      </div>
    </div>
  );
};
