import React, { useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { BranchSwitcher } from '@/components/workspace/BranchSwitcher';
import { BranchCreationModal } from '@/components/workspace/BranchCreationModal';
import { BranchEditModal } from '@/components/workspace/BranchEditModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCrossSubdomainUrl, getLauncherUrl } from '@/lib/domain';
import { useHost } from '@/host/useHost';
import { toast } from 'sonner';
import {
  Boxes,
  LayoutGrid,
  LogOut,
  User as UserIcon,
  Settings,
  Package,
  Receipt,
  AlertTriangle,
  FileBarChart,
  Warehouse,
  Plus,
  Search,
  Barcode,
  ArrowUpRight,
  XCircle,
  SlidersHorizontal,
  X,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Core Inventory Types
export interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  stockOnHand: number;
  minThreshold: number;
  costPrice: number;
  sellingPrice: number;
  unit: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  lastUpdated: number;
}

export interface StockMovement {
  id: string;
  productName: string;
  sku: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  reason: string;
  actor: string;
  timestamp: number;
}

// Initial Nigerian Retail Inventory Dataset
const INITIAL_PRODUCTS: InventoryProduct[] = [
  {
    id: 'prod-1',
    name: 'Peak Full Cream Milk Tin 400g',
    sku: 'MILK-PK-400',
    barcode: '615110001201',
    category: 'Groceries & Dairy',
    stockOnHand: 48,
    minThreshold: 15,
    costPrice: 2100,
    sellingPrice: 2600,
    unit: 'tin',
    status: 'in_stock',
    lastUpdated: Date.now() - 1000 * 60 * 30,
  },
  {
    id: 'prod-2',
    name: 'Golden Penny Semovita 2kg',
    sku: 'SEMO-GP-002',
    barcode: '615110004512',
    category: 'Grains & Flour',
    stockOnHand: 6,
    minThreshold: 10,
    costPrice: 3200,
    sellingPrice: 3800,
    unit: 'bag',
    status: 'low_stock',
    lastUpdated: Date.now() - 1000 * 60 * 120,
  },
  {
    id: 'prod-3',
    name: 'Milo Chocolate Drink Refill 500g',
    sku: 'MILO-REF-500',
    barcode: '615110008821',
    category: 'Beverages',
    stockOnHand: 32,
    minThreshold: 12,
    costPrice: 2800,
    sellingPrice: 3400,
    unit: 'pouch',
    status: 'in_stock',
    lastUpdated: Date.now() - 1000 * 60 * 45,
  },
  {
    id: 'prod-4',
    name: 'Indomie Instant Noodles Super Pack (Box of 40)',
    sku: 'NDL-IND-SUP40',
    barcode: '615110012903',
    category: 'Groceries & Dairy',
    stockOnHand: 18,
    minThreshold: 8,
    costPrice: 11500,
    sellingPrice: 13200,
    unit: 'carton',
    status: 'in_stock',
    lastUpdated: Date.now() - 1000 * 60 * 200,
  },
  {
    id: 'prod-5',
    name: 'Mamador Pure Vegetable Oil 3.5L',
    sku: 'OIL-MAM-35L',
    barcode: '615110019481',
    category: 'Groceries & Dairy',
    stockOnHand: 4,
    minThreshold: 8,
    costPrice: 14200,
    sellingPrice: 16500,
    unit: 'keg',
    status: 'low_stock',
    lastUpdated: Date.now() - 1000 * 60 * 80,
  },
  {
    id: 'prod-6',
    name: 'Dettol Antiseptic Liquid 500ml',
    sku: 'HLT-DET-500',
    barcode: '615110023194',
    category: 'Personal Care & Hygiene',
    stockOnHand: 22,
    minThreshold: 10,
    costPrice: 2400,
    sellingPrice: 2950,
    unit: 'bottle',
    status: 'in_stock',
    lastUpdated: Date.now() - 1000 * 60 * 310,
  },
  {
    id: 'prod-7',
    name: 'Ariel Auto Washing Powder 1kg',
    sku: 'DET-ARL-1KG',
    barcode: '615110034821',
    category: 'Household & Cleaning',
    stockOnHand: 0,
    minThreshold: 10,
    costPrice: 3100,
    sellingPrice: 3750,
    unit: 'pack',
    status: 'out_of_stock',
    lastUpdated: Date.now() - 1000 * 60 * 400,
  },
  {
    id: 'prod-8',
    name: 'Dangote Refined Granulated Sugar 1kg',
    sku: 'SGR-DGT-1KG',
    barcode: '615110041289',
    category: 'Groceries & Dairy',
    stockOnHand: 5,
    minThreshold: 12,
    costPrice: 2200,
    sellingPrice: 2700,
    unit: 'bag',
    status: 'low_stock',
    lastUpdated: Date.now() - 1000 * 60 * 50,
  },
];

const INITIAL_MOVEMENTS: StockMovement[] = [
  {
    id: 'mov-1',
    productName: 'Peak Full Cream Milk Tin 400g',
    sku: 'MILK-PK-400',
    type: 'IN',
    quantity: 24,
    reason: 'Shipment Restock (Supplier PO-104)',
    actor: 'Store Admin',
    timestamp: Date.now() - 1000 * 60 * 25,
  },
  {
    id: 'mov-2',
    productName: 'Indomie Instant Noodles Super Pack',
    sku: 'NDL-IND-SUP40',
    type: 'OUT',
    quantity: 4,
    reason: 'POS Counter Sale #1042',
    actor: 'Cashier Attendant',
    timestamp: Date.now() - 1000 * 60 * 85,
  },
  {
    id: 'mov-3',
    productName: 'Golden Penny Semovita 2kg',
    sku: 'SEMO-GP-002',
    type: 'ADJUST',
    quantity: -2,
    reason: 'Damaged packaging write-off',
    actor: 'Inventory Supervisor',
    timestamp: Date.now() - 1000 * 60 * 180,
  },
  {
    id: 'mov-4',
    productName: 'Milo Chocolate Drink Refill 500g',
    sku: 'MILO-REF-500',
    type: 'IN',
    quantity: 12,
    reason: 'Inter-branch transfer from Central Depot',
    actor: 'Warehouse Mgr',
    timestamp: Date.now() - 1000 * 60 * 240,
  },
];

const CATEGORIES = [
  'All Categories',
  'Groceries & Dairy',
  'Grains & Flour',
  'Beverages',
  'Personal Care & Hygiene',
  'Household & Cleaning',
];

export const InventoryDashboard: React.FC = () => {
  const host = useHost();
  const env = host.environment;
  const { logout, user } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { activeBranch, branches } = useBranchStore();

  // Navigation Sidebar active item
  const [activeNav, setActiveNav] = useState<string>('overview');

  // Branch Modals
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isEditingBranch, setIsEditingBranch] = useState(false);

  // Inventory Products State
  const [products, setProducts] = useState<InventoryProduct[]>(INITIAL_PRODUCTS);
  const [movements, setMovements] = useState<StockMovement[]>(INITIAL_MOVEMENTS);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Modals: Add Product & Adjust Stock
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<InventoryProduct | null>(null);

  // Add Product Form State
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Groceries & Dairy');
  const [newProdStock, setNewProdStock] = useState('20');
  const [newProdThreshold, setNewProdThreshold] = useState('8');
  const [newProdCostPrice, setNewProdCostPrice] = useState('');
  const [newProdSellingPrice, setNewProdSellingPrice] = useState('');
  const [newProdUnit, setNewProdUnit] = useState('pcs');

  // Adjust Stock Form State
  const [adjustQuantity, setAdjustQuantity] = useState('5');
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
  const [adjustReason, setAdjustReason] = useState('Supplier shipment received');

  // KPI Calculations
  const totalProducts = products.length;
  const lowStockCount = useMemo(() => products.filter((p) => p.status === 'low_stock').length, [products]);
  const outOfStockCount = useMemo(() => products.filter((p) => p.status === 'out_of_stock').length, [products]);
  const totalStockValuation = useMemo(
    () => products.reduce((acc, curr) => acc + curr.stockOnHand * curr.sellingPrice, 0),
    [products]
  );

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.barcode.includes(searchQuery);

      const matchesCat =
        selectedCategory === 'All Categories' || item.category === selectedCategory;

      const matchesStatus =
        statusFilter === 'all' || item.status === statusFilter;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [products, searchQuery, selectedCategory, statusFilter]);

  // Handle Add Product Submit
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdSellingPrice) {
      toast.error('Product name and selling price are required');
      return;
    }

    const stock = parseInt(newProdStock, 10) || 0;
    const threshold = parseInt(newProdThreshold, 10) || 5;
    const cost = parseFloat(newProdCostPrice) || 0;
    const selling = parseFloat(newProdSellingPrice) || 0;

    let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
    if (stock === 0) status = 'out_of_stock';
    else if (stock <= threshold) status = 'low_stock';

    const newProduct: InventoryProduct = {
      id: `prod-${Date.now()}`,
      name: newProdName.trim(),
      sku: newProdSku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      barcode: newProdBarcode.trim() || `615110${Math.floor(100000 + Math.random() * 900000)}`,
      category: newProdCategory,
      stockOnHand: stock,
      minThreshold: threshold,
      costPrice: cost,
      sellingPrice: selling,
      unit: newProdUnit,
      status,
      lastUpdated: Date.now(),
    };

    setProducts([newProduct, ...products]);

    // Record Movement
    if (stock > 0) {
      const movement: StockMovement = {
        id: `mov-${Date.now()}`,
        productName: newProduct.name,
        sku: newProduct.sku,
        type: 'IN',
        quantity: stock,
        reason: 'Initial stock setup',
        actor: user?.name || 'Store Admin',
        timestamp: Date.now(),
      };
      setMovements([movement, ...movements]);
    }

    toast.success(`Product "${newProduct.name}" added to catalog!`);
    setIsAddProductOpen(false);

    // Reset Form
    setNewProdName('');
    setNewProdSku('');
    setNewProdBarcode('');
    setNewProdCostPrice('');
    setNewProdSellingPrice('');
    setNewProdStock('20');
  };

  // Handle Quick Stock Adjust Submit
  const handleAdjustStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAdjust) return;

    const delta = parseInt(adjustQuantity, 10) || 0;
    if (delta <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const currentStock = selectedProductForAdjust.stockOnHand;
    let updatedStock = currentStock;

    if (adjustType === 'IN') {
      updatedStock = currentStock + delta;
    } else if (adjustType === 'OUT') {
      updatedStock = Math.max(0, currentStock - delta);
    } else {
      updatedStock = delta;
    }

    let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
    if (updatedStock === 0) status = 'out_of_stock';
    else if (updatedStock <= selectedProductForAdjust.minThreshold) status = 'low_stock';

    setProducts((prev) =>
      prev.map((p) =>
        p.id === selectedProductForAdjust.id
          ? {
              ...p,
              stockOnHand: updatedStock,
              status,
              lastUpdated: Date.now(),
            }
          : p
      )
    );

    // Add telemetry movement
    const movement: StockMovement = {
      id: `mov-${Date.now()}`,
      productName: selectedProductForAdjust.name,
      sku: selectedProductForAdjust.sku,
      type: adjustType,
      quantity: adjustType === 'OUT' ? -delta : delta,
      reason: adjustReason,
      actor: user?.name || 'Store Attendant',
      timestamp: Date.now(),
    };
    setMovements([movement, ...movements]);

    toast.success(`Stock updated for ${selectedProductForAdjust.name} (Now: ${updatedStock} units)`);
    setIsAdjustStockOpen(false);
    setSelectedProductForAdjust(null);
  };

  const navItems = [
    { key: 'overview', label: 'Overview', icon: LayoutGrid },
    { key: 'products', label: 'Products & SKUs', icon: Package, badge: totalProducts },
    { key: 'low_stock', label: 'Low Stock Alerts', icon: AlertTriangle, badge: lowStockCount, badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    { key: 'movements', label: 'Stock Movements', icon: History },
    { key: 'warehouses', label: 'Branches & Locations', icon: Warehouse, badge: branches.length },
    { key: 'pos', label: 'Point of Sale (POS)', icon: Receipt },
    { key: 'reports', label: 'Reports & Valuation', icon: FileBarChart },
  ];

  return (
    <div className="flex h-screen w-full bg-[#080608] text-slate-100 font-sans selection:bg-[#714b67] selection:text-white overflow-hidden">
      
      {/* 1. STATIC SIDEBAR */}
      <aside className="w-64 bg-[#0d090d] border-r border-white/10 flex flex-col justify-between shrink-0 select-none z-30">
        
        {/* Brand & App Title Header */}
        <div className="p-3.5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xs bg-[#714b67] flex items-center justify-center text-white font-bold shadow-sm shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-white text-xs tracking-tight block">Inventory Hub</span>
              <span className="text-[10px] text-slate-500 font-mono block truncate">Workspace Suite</span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
          <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Inventory Workstation
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.key === 'pos') {
                    toast.info('Point of Sale POS is ready for counter checkout!', {
                      description: 'Integrated with inventory catalog.',
                    });
                  }
                  setActiveNav(item.key);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-2 rounded-xs text-xs font-medium transition-colors cursor-pointer text-left group',
                  isActive
                    ? 'bg-[#714b67] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200')} />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.2 rounded-xs border',
                      item.badgeColor || (isActive ? 'bg-white/20 text-white border-white/30' : 'bg-white/10 text-slate-300 border-white/10')
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-4 px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Management
          </div>

          <a
            href="/settings"
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xs text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Organization Settings</span>
          </a>

          <a
            href={getLauncherUrl(env)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xs text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4 text-slate-400" />
            <span>All Applications</span>
          </a>
        </nav>

        {/* Sidebar Footer / User Profile */}
        <div className="p-3 border-t border-white/10 bg-[#0a070a] space-y-2.5">
          {/* Plan Pill */}
          <div className="px-2 py-1.5 rounded-xs bg-white/5 border border-white/5 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Free Tier (1 App)</span>
            <span className="text-[#f0d8e8] font-bold bg-[#714b67]/30 border border-[#714b67]/40 px-1.5 py-0.2 rounded-xs">
              Nigeria
            </span>
          </div>

          {/* User Section */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <a
              href={getCrossSubdomainUrl('accounts', '/profile/personal', true, env)}
              className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xs bg-[#714b67] text-white text-xs font-bold flex items-center justify-center border border-white/10 shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate leading-tight">
                  {user?.name || user?.email?.split('@')[0] || 'Member'}
                </p>
                <p className="text-[10px] text-slate-500 truncate leading-tight">
                  {user?.email || 'Authenticated'}
                </p>
              </div>
            </a>

            <button
              type="button"
              onClick={async () => {
                await logout();
                window.location.href = getCrossSubdomainUrl('accounts', '/login?logged_out=true', false, env);
              }}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xs transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Top Navbar */}
        <header className="h-14 bg-[#0d090d] border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 z-20">
          {/* Header Switchers: Organization & Branch */}
          <div className="flex items-center gap-2 min-w-0">
            <WorkspaceSwitcher productKey="inventory" />
            <span className="text-slate-600 text-xs hidden sm:inline">/</span>
            <BranchSwitcher productKey="inventory" />
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2.5">
            {/* Quick Adjust Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (products.length > 0) {
                  setSelectedProductForAdjust(products[0]);
                  setIsAdjustStockOpen(true);
                } else {
                  setIsAddProductOpen(true);
                }
              }}
              className="h-8 px-3 rounded-xs border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#f0d8e8]" />
              <span className="hidden sm:inline">Adjust Stock</span>
            </Button>

            {/* Add Product Button */}
            <Button
              size="sm"
              onClick={() => setIsAddProductOpen(true)}
              className="h-8 px-3.5 rounded-xs bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Product</span>
            </Button>
          </div>
        </header>

        {/* Scrollable Workstation Body */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Top KPI Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Total SKUs */}
            <div className="p-4 rounded-xs bg-[#0e0a0d] border border-white/10 shadow-lg space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">Catalog SKUs</span>
                <Package className="w-4 h-4 text-[#f0d8e8]" />
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {totalProducts} <span className="text-xs font-normal text-slate-400">Products</span>
              </div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <ArrowUpRight className="w-3 h-3" />
                <span>Synchronized with catalog</span>
              </div>
            </div>

            {/* Card 2: Stock Valuation */}
            <div className="p-4 rounded-xs bg-[#0e0a0d] border border-white/10 shadow-lg space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">Total Stock Valuation</span>
                <span className="text-xs font-bold text-[#f0d8e8]">₦ NGN</span>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                ₦{totalStockValuation.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                Retail potential across on-hand units
              </div>
            </div>

            {/* Card 3: Low Stock Alerts */}
            <div className="p-4 rounded-xs bg-[#0e0a0d] border border-white/10 shadow-lg space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">Low Stock Warnings</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 tracking-tight">
                {lowStockCount} <span className="text-xs font-normal text-slate-400">Items</span>
              </div>
              <div className="text-[11px] text-amber-400/90 font-medium">
                {lowStockCount > 0 ? 'Below minimum reorder point' : 'All items well stocked'}
              </div>
            </div>

            {/* Card 4: Out of Stock */}
            <div className="p-4 rounded-xs bg-[#0e0a0d] border border-white/10 shadow-lg space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">Out of Stock</span>
                <XCircle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-rose-400 tracking-tight">
                {outOfStockCount} <span className="text-xs font-normal text-slate-400">Items</span>
              </div>
              <div className="text-[11px] text-rose-400/90 font-medium">
                {outOfStockCount > 0 ? 'Requires immediate PO replenishment' : 'No stockouts recorded'}
              </div>
            </div>
          </div>

          {/* MAIN INVENTORY CATALOG & TELEMETRY SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT 2 COLS: INVENTORY CATALOG TABLE */}
            <div className="lg:col-span-2 space-y-3.5">
              
              {/* Table Filter Controls */}
              <div className="p-3.5 rounded-xs bg-[#0e0a0d] border border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search product name, SKU, or scan barcode..."
                    className="h-8 pl-8.5 bg-[#080608] border-white/10 text-white placeholder:text-slate-600 rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-8 px-2 bg-[#080608] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#0e0a0d] text-white">
                        {cat}
                      </option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="h-8 px-2 bg-[#080608] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] cursor-pointer"
                  >
                    <option value="all" className="bg-[#0e0a0d] text-white">All Status</option>
                    <option value="in_stock" className="bg-[#0e0a0d] text-white">In Stock</option>
                    <option value="low_stock" className="bg-[#0e0a0d] text-white">Low Stock</option>
                    <option value="out_of_stock" className="bg-[#0e0a0d] text-white">Out of Stock</option>
                  </select>
                </div>
              </div>

              {/* Products Table */}
              <div className="rounded-xs bg-[#0e0a0d] border border-white/10 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Product & SKU</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Stock On Hand</th>
                        <th className="py-3 px-3">Selling Price</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-200">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500">
                            No inventory items matched your search criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((prod) => (
                          <tr
                            key={prod.id}
                            className="hover:bg-white/[0.02] transition-colors group"
                          >
                            {/* Product & SKU */}
                            <td className="py-3 px-4 min-w-[200px]">
                              <div className="font-semibold text-white group-hover:text-[#f0d8e8] transition-colors">
                                {prod.name}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
                                <span>{prod.sku}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-slate-500">
                                  <Barcode className="w-3 h-3" />
                                  {prod.barcode}
                                </span>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="py-3 px-3 text-slate-400 text-[11px]">
                              {prod.category}
                            </td>

                            {/* Stock on Hand */}
                            <td className="py-3 px-3">
                              <div className="font-bold text-white text-xs">
                                {prod.stockOnHand} <span className="text-[10px] font-normal text-slate-400">{prod.unit}</span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                Threshold: {prod.minThreshold}
                              </div>
                            </td>

                            {/* Selling Price */}
                            <td className="py-3 px-3 font-semibold text-white">
                              ₦{prod.sellingPrice.toLocaleString()}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3">
                              {prod.status === 'in_stock' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  IN STOCK
                                </span>
                              )}
                              {prod.status === 'low_stock' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  LOW STOCK
                                </span>
                              )}
                              {prod.status === 'out_of_stock' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  OUT OF STOCK
                                </span>
                              )}
                            </td>

                            {/* Quick Action */}
                            <td className="py-3 px-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedProductForAdjust(prod);
                                  setIsAdjustStockOpen(true);
                                }}
                                className="h-7 px-2.5 rounded-xs text-[11px] border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-slate-200 cursor-pointer"
                              >
                                Adjust
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* RIGHT 1 COL: TELEMETRY ACTIVITY & QUICK ACTIONS */}
            <div className="space-y-4">
              
              {/* Branch Quick Switch Card */}
              <div className="p-4 rounded-xs bg-[#0e0a0d] border border-white/10 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-[#f0d8e8]" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Branch Location
                    </h3>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsCreatingBranch(true)}
                    className="h-7 px-2 text-[11px] text-[#f0d8e8] hover:text-white cursor-pointer"
                  >
                    + New Branch
                  </Button>
                </div>

                <div className="p-2.5 rounded-xs bg-[#080608] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-white">
                    <span>{activeBranch?.name || 'Main Branch'}</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">ONLINE</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {activeBranch?.address || 'Lagos, Nigeria'}
                  </p>
                </div>
              </div>

              {/* Recent Stock Movement Telemetry */}
              <div className="p-4 rounded-xs bg-[#0e0a0d] border border-white/10 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[#f0d8e8]" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Live Stock Movement
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Real-time</span>
                </div>

                <div className="space-y-2.5">
                  {movements.slice(0, 5).map((mov) => (
                    <div
                      key={mov.id}
                      className="p-2.5 rounded-xs bg-[#080608] border border-white/5 space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs font-medium text-white">
                        <span className="truncate max-w-[160px]">{mov.productName}</span>
                        <span
                          className={cn(
                            'text-xs font-bold font-mono',
                            mov.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'
                          )}
                        >
                          {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="truncate max-w-[150px]">{mov.reason}</span>
                        <span className="text-slate-500 font-mono">
                          {new Date(mov.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>

      {/* 3. MODAL: ADD NEW PRODUCT */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xs bg-[#0e0a0d] border border-white/10 p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#f0d8e8]" />
                <h3 className="text-sm font-bold text-white">Add Product to Catalog</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddProductOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4 text-xs">
              <div className="space-y-1">
                <Label className="text-xs text-slate-300 font-medium">Product Name *</Label>
                <Input
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="e.g. Peak Full Cream Milk 400g"
                  className="h-9 bg-[#080608] border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300 font-medium">SKU (Stock Code)</Label>
                  <Input
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value.toUpperCase())}
                    placeholder="e.g. MILK-PK-400"
                    className="h-9 bg-[#080608] border-white/10 text-white font-mono text-xs rounded-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-300 font-medium">Barcode (EAN/UPC)</Label>
                  <Input
                    value={newProdBarcode}
                    onChange={(e) => setNewProdBarcode(e.target.value)}
                    placeholder="e.g. 615110001201"
                    className="h-9 bg-[#080608] border-white/10 text-white font-mono text-xs rounded-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300 font-medium">Category</Label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full h-9 px-2 bg-[#080608] border border-white/10 text-white rounded-xs text-xs cursor-pointer"
                  >
                    {CATEGORIES.filter((c) => c !== 'All Categories').map((c) => (
                      <option key={c} value={c} className="bg-[#0e0a0d] text-white">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-300 font-medium">Unit of Measure</Label>
                  <Input
                    value={newProdUnit}
                    onChange={(e) => setNewProdUnit(e.target.value)}
                    placeholder="e.g. tin, pcs, carton"
                    className="h-9 bg-[#080608] border-white/10 text-white text-xs rounded-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300 font-medium">Cost Price (₦)</Label>
                  <Input
                    type="number"
                    value={newProdCostPrice}
                    onChange={(e) => setNewProdCostPrice(e.target.value)}
                    placeholder="2100"
                    className="h-9 bg-[#080608] border-white/10 text-white text-xs rounded-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-300 font-medium">Selling Price (₦) *</Label>
                  <Input
                    type="number"
                    value={newProdSellingPrice}
                    onChange={(e) => setNewProdSellingPrice(e.target.value)}
                    placeholder="2600"
                    className="h-9 bg-[#080608] border-white/10 text-white text-xs rounded-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300 font-medium">Initial Stock On Hand</Label>
                  <Input
                    type="number"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    placeholder="20"
                    className="h-9 bg-[#080608] border-white/10 text-white text-xs rounded-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-300 font-medium">Low Stock Warning Threshold</Label>
                  <Input
                    type="number"
                    value={newProdThreshold}
                    onChange={(e) => setNewProdThreshold(e.target.value)}
                    placeholder="8"
                    className="h-9 bg-[#080608] border-white/10 text-white text-xs rounded-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddProductOpen(false)}
                  className="flex-1 h-9 rounded-xs border-white/10 text-xs text-slate-300 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-9 rounded-xs bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold cursor-pointer"
                >
                  Save Product
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL: QUICK STOCK ADJUSTMENT */}
      {isAdjustStockOpen && selectedProductForAdjust && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xs bg-[#0e0a0d] border border-white/10 p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#f0d8e8]" />
                <h3 className="text-sm font-bold text-white">Adjust Stock Level</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAdjustStockOpen(false);
                  setSelectedProductForAdjust(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xs bg-[#080608] border border-white/5 space-y-1">
              <p className="text-xs font-bold text-white">{selectedProductForAdjust.name}</p>
              <p className="text-[11px] text-slate-400 font-mono">
                SKU: {selectedProductForAdjust.sku} • Current Stock: <strong className="text-white">{selectedProductForAdjust.stockOnHand} {selectedProductForAdjust.unit}</strong>
              </p>
            </div>

            <form onSubmit={handleAdjustStock} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <Label className="text-xs text-slate-300 font-medium">Adjustment Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('IN');
                      setAdjustReason('Shipment Restock Received');
                    }}
                    className={cn(
                      'py-2 px-2 rounded-xs border text-xs font-semibold transition-colors cursor-pointer',
                      adjustType === 'IN'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-white/5 text-slate-400 border-white/5'
                    )}
                  >
                    + Stock In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('OUT');
                      setAdjustReason('Damaged / Expired Write-off');
                    }}
                    className={cn(
                      'py-2 px-2 rounded-xs border text-xs font-semibold transition-colors cursor-pointer',
                      adjustType === 'OUT'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-white/5 text-slate-400 border-white/5'
                    )}
                  >
                    - Stock Out
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('ADJUST');
                      setAdjustReason('Physical Inventory Audit Count');
                    }}
                    className={cn(
                      'py-2 px-2 rounded-xs border text-xs font-semibold transition-colors cursor-pointer',
                      adjustType === 'ADJUST'
                        ? 'bg-[#714b67]/40 text-[#f0d8e8] border-[#714b67]'
                        : 'bg-white/5 text-slate-400 border-white/5'
                    )}
                  >
                    Exact Count
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-300 font-medium">
                  {adjustType === 'ADJUST' ? 'New Exact Count' : 'Quantity to Add/Deduct'}
                </Label>
                <Input
                  type="number"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  placeholder="5"
                  className="h-9 bg-[#080608] border-white/10 text-white text-xs rounded-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-300 font-medium">Reason / Reference</Label>
                <Input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Shipment PO-105"
                  className="h-9 bg-[#080608] border-white/10 text-white text-xs rounded-xs"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAdjustStockOpen(false);
                    setSelectedProductForAdjust(null);
                  }}
                  className="flex-1 h-9 rounded-xs border-white/10 text-xs text-slate-300 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-9 rounded-xs bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold cursor-pointer"
                >
                  Apply Stock Adjustment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. BRANCH CREATION / EDIT MODALS */}
      {isCreatingBranch && (
        <BranchCreationModal
          isOpen={isCreatingBranch}
          workspaceId={currentWorkspace?.id || ''}
          onClose={() => setIsCreatingBranch(false)}
          onSuccess={() => {
            setIsCreatingBranch(false);
            toast.success('New branch location created successfully!');
          }}
        />
      )}

      {isEditingBranch && activeBranch && (
        <BranchEditModal
          isOpen={isEditingBranch}
          branch={activeBranch}
          onClose={() => setIsEditingBranch(false)}
          onSuccess={() => {
            setIsEditingBranch(false);
            toast.success('Branch details updated!');
          }}
        />
      )}

    </div>
  );
};
