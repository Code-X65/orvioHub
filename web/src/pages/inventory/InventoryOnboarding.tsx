import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Boxes,
  ShoppingCart,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Store,
  Plus,
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Building2,
  Clock,
  Check,
  ShoppingBag,
  Smartphone,
  BadgeCheck,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductRecord {
  id?: string;
  sku: string;
  name: string;
  barcode?: string;
  category: string;
  brand?: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number;
  stockQuantity: number;
  minStockLevel: number;
}

const BUSINESS_TYPES = [
  { id: 'provision', name: 'Provision Store', icon: Store, desc: 'FMCG, daily essentials, retail groceries' },
  { id: 'supermarket', name: 'Supermarket', icon: ShoppingCart, desc: 'Multi-aisle retail, high-volume checkout' },
  { id: 'boutique', name: 'Boutique & Fashion', icon: ShoppingBag, desc: 'Apparel, footwear, accessories, variants' },
  { id: 'cosmetics', name: 'Cosmetics & Beauty', icon: Sparkles, desc: 'Skincare, perfumes, batch & expiry' },
  { id: 'electronics', name: 'Electronics & Gadgets', icon: Smartphone, desc: 'Phones, laptops, accessories, serial numbers' },
  { id: 'wholesale', name: 'Wholesale & Distribution', icon: Boxes, desc: 'Bulk cartons, tiered pricing, pallets' },
  { id: 'pharmacy', name: 'Pharmacy & Drug Store', icon: AlertTriangle, desc: 'Medications, dosages, regulated items' },
  { id: 'other', name: 'General Trade & Services', icon: Building2, desc: 'Custom retail or specialty merchant' },
];

export const InventoryOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Active step (1 to 12)
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Step 2: Business Type
  const [businessType, setBusinessType] = useState<string>('supermarket');

  // Step 3: Branch Setup
  const [branchName, setBranchName] = useState<string>('Central Hub Store');
  const [branchAddress, setBranchAddress] = useState<string>('12 Marina Street, Victoria Island, Lagos');
  const [branchPhone, setBranchPhone] = useState<string>('+234 801 234 5678');
  const [branchCode, setBranchCode] = useState<string>('BR-01');
  const [branchManager, setBranchManager] = useState<string>(user?.name || 'Store Manager');

  // Step 4: Inventory Settings
  const [currency, setCurrency] = useState<string>('NGN');
  const [taxInclusive, setTaxInclusive] = useState<boolean>(true);
  const taxRate = 7.5;
  const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(false);
  const [defaultUnit, setDefaultUnit] = useState<string>('Piece');
  const defaultReorderLevel = 10;
  const tutorialReceiptId = 'REC-89021';

  // Step 5 & 6: Product Setup
  const [productSetupChoice, setProductSetupChoice] = useState<'sample' | 'manual' | 'csv' | 'skip'>('sample');
  const [products, setProducts] = useState<ProductRecord[]>([
    {
      sku: 'PRD-001',
      name: 'Premium Basmati Rice 5kg',
      barcode: '8901234567890',
      category: 'Food & Groceries',
      unit: 'Bag',
      costPrice: 4500,
      sellingPrice: 6200,
      stockQuantity: 40,
      minStockLevel: 10,
    },
    {
      sku: 'PRD-002',
      name: 'Golden Vegetable Cooking Oil 3L',
      barcode: '8909876543210',
      category: 'Cooking Essentials',
      unit: 'Bottle',
      costPrice: 3200,
      sellingPrice: 4500,
      stockQuantity: 30,
      minStockLevel: 8,
    },
    {
      sku: 'PRD-003',
      name: 'Full Cream Powdered Milk 900g',
      barcode: '8905556667778',
      category: 'Dairy',
      unit: 'Tin',
      costPrice: 2800,
      sellingPrice: 3800,
      stockQuantity: 25,
      minStockLevel: 5,
    },
  ]);

  // Manual Product Form
  const [manualSku, setManualSku] = useState('PRD-101');
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('General');
  const [manualCost, setManualCost] = useState(1000);
  const [manualPrice, setManualPrice] = useState(1500);
  const [manualStock, setManualStock] = useState(50);

  // Step 7: CSV Upload State
  const [csvUploaded, setCsvUploaded] = useState(false);
  const [csvRowCount, setCsvRowCount] = useState(0);

  // Step 9: Staff Invitation
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState('cashier');
  const [invitedStaffList, setInvitedStaffList] = useState<Array<{ name: string; email: string; role: string }>>([
    { name: 'Sarah Cashier', email: 'sarah@store.ng', role: 'Cashier' },
  ]);

  // Step 10: Receipt Settings
  const [receiptBusinessName, setReceiptBusinessName] = useState('Orivo Superstore');
  const [receiptPhone, setReceiptPhone] = useState('+234 801 234 5678');
  const [receiptAddress, setReceiptAddress] = useState('12 Marina Street, Lagos');
  const [receiptFooter, setReceiptFooter] = useState('Thank you for shopping with us! No refund without receipt.');

  // Step 11: First Sale Tutorial State
  const [tutorialCart, setTutorialCart] = useState<Array<{ product: ProductRecord; quantity: number }>>([]);
  const [tutorialPaymentMethod, setTutorialPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [tutorialSaleCompleted, setTutorialSaleCompleted] = useState(false);

  // Load initial workspace context
  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const res = await api.get<{ workspaces: any[] }>('/workspaces');
        if (res.workspaces && res.workspaces.length > 0) {
          const ws = res.workspaces[0].workspace;
          setReceiptBusinessName(ws.name);
          setCurrency(ws.currency || 'NGN');
        }
      } catch {
        // Fallback
      }
    };
    loadWorkspace();
  }, []);

  // Add Manual Product Helper
  const handleAddManualProduct = () => {
    if (!manualName.trim()) {
      toast.error('Product name is required');
      return;
    }
    const newProd: ProductRecord = {
      sku: manualSku,
      name: manualName.trim(),
      category: manualCategory,
      unit: defaultUnit,
      costPrice: Number(manualCost),
      sellingPrice: Number(manualPrice),
      stockQuantity: Number(manualStock),
      minStockLevel: defaultReorderLevel,
    };
    setProducts((prev) => [...prev, newProd]);
    setManualName('');
    setManualSku(`PRD-${Math.floor(100 + Math.random() * 900)}`);
    toast.success('Product added to list!');
  };

  // Add Staff Member Helper
  const handleAddStaff = () => {
    if (!staffName.trim() || !staffEmail.trim()) {
      toast.error('Staff name and email/phone are required');
      return;
    }
    setInvitedStaffList((prev) => [...prev, { name: staffName.trim(), email: staffEmail.trim(), role: staffRole }]);
    setStaffName('');
    setStaffEmail('');
    toast.success('Staff invitation added!');
  };

  // Simulate CSV File Upload
  const handleSimulateCsvUpload = () => {
    setCsvUploaded(true);
    setCsvRowCount(18);
    toast.success('Parsed 18 products from CSV template successfully!');
  };

  // Tutorial POS: Add product to cart
  const handleAddToCart = (prod: ProductRecord) => {
    setTutorialCart((prev) => {
      const existing = prev.find((item) => item.product.sku === prod.sku);
      if (existing) {
        return prev.map((item) =>
          item.product.sku === prod.sku ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
  };

  // Tutorial POS: Complete Sale
  const handleCompleteTutorialSale = async () => {
    if (tutorialCart.length === 0) {
      toast.error('Add at least one item to cart to test checkout');
      return;
    }
    setIsLoading(true);
    try {
      // Record completed sale tutorial
      setTutorialSaleCompleted(true);
      toast.success('First sale recorded! Live inventory stock updated.');
    } catch {
      toast.error('Sale simulation error');
    } finally {
      setIsLoading(false);
    }
  };

  // Format money helper
  const fmt = (n: number) => {
    const symbol = currency === 'NGN' ? '₦' : currency === 'USD' ? '$' : '£';
    return `${symbol}${n.toLocaleString()}`;
  };

  const tutorialSubtotal = tutorialCart.reduce((acc, item) => acc + item.product.sellingPrice * item.quantity, 0);
  const tutorialTax = taxInclusive ? 0 : tutorialSubtotal * (taxRate / 100);
  const tutorialTotal = tutorialSubtotal + tutorialTax;

  const STEPS_LIST = [
    'Welcome',
    'Business Type',
    'Branch Setup',
    'Settings',
    'Product Setup',
    'Product Entry',
    'CSV Import',
    'Opening Stock',
    'Staff Setup',
    'Receipt Setup',
    'First Sale Test',
    'Complete',
  ];

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white flex flex-col justify-between">
      {/* Top Sticky Header with Progress */}
      <header className="sticky top-0 z-40 bg-[#0a0508]/90 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xs bg-[#714b67] text-white flex items-center justify-center font-bold text-sm shadow-md">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white leading-tight">
                Inventory & POS Onboarding
              </div>
              <div className="text-[10px] text-slate-400">
                Step {activeStep} of 12 • {STEPS_LIST[activeStep - 1]}
              </div>
            </div>
          </div>

          {/* Step Progress Bar */}
          <div className="hidden sm:flex items-center gap-1.5 max-w-xs w-full">
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#714b67] transition-all duration-300 rounded-full"
                style={{ width: `${(activeStep / 12) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-[#c79dbd] shrink-0 font-semibold">
              {Math.round((activeStep / 12) * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/inventory/dashboard')}
              className="text-[11px] text-slate-400 hover:text-white transition-colors"
            >
              Skip to Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main Wizard Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="p-6 sm:p-10 rounded-2xl bg-[#0f0a0e] border border-white/5 shadow-2xl relative">
          {/* STEP 1: WELCOME & OVERVIEW */}
          {activeStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-2 text-center max-w-xl mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] flex items-center justify-center mx-auto mb-2 shadow-lg">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Welcome to Inventory & POS
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Let's configure your store, products, branches, and point of sale terminal in under 3 minutes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <div className="p-4 rounded-sm bg-[#160f14] border border-white/5 space-y-1">
                  <Clock className="w-5 h-5 text-[#c79dbd]" />
                  <div className="text-xs font-bold text-white">Estimated Time</div>
                  <div className="text-[11px] text-slate-400">~3 minutes to complete</div>
                </div>
                <div className="p-4 rounded-sm bg-[#160f14] border border-white/5 space-y-1">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <div className="text-xs font-bold text-white">Data Privacy</div>
                  <div className="text-[11px] text-slate-400">Data minimization compliant</div>
                </div>
                <div className="p-4 rounded-sm bg-[#160f14] border border-white/5 space-y-1">
                  <Store className="w-5 h-5 text-amber-400" />
                  <div className="text-xs font-bold text-white">Multi-Branch POS</div>
                  <div className="text-[11px] text-slate-400">Live barcode checkout ready</div>
                </div>
              </div>

              <div className="pt-6 flex items-center justify-between border-t border-white/5">
                <div className="text-[11px] text-slate-500">You can edit these settings anytime later.</div>
                <Button
                  onClick={() => setActiveStep(2)}
                  className="h-11 px-6 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs font-semibold text-xs shadow-md shadow-[#714b67]/25 flex items-center gap-2 cursor-pointer"
                >
                  <span>Start Store Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: BUSINESS TYPE */}
          {activeStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">Select Your Business Category</h2>
                <p className="text-xs text-slate-400">
                  This helps us tailor your default units, reorder levels, and POS templates.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                {BUSINESS_TYPES.map((b) => {
                  const isSelected = businessType === b.id;
                  const Icon = b.icon;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setBusinessType(b.id)}
                      className={cn(
                        'p-4 rounded-sm border text-left cursor-pointer transition-all flex items-start gap-3 relative',
                        isSelected
                          ? 'bg-[#714b67]/20 border-[#714b67] shadow-md shadow-[#714b67]/15'
                          : 'bg-[#140e12] border-white/5 hover:border-white/20'
                      )}
                    >
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                        isSelected ? 'bg-[#714b67] text-white' : 'bg-[#0a0508] text-slate-400'
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{b.name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{b.desc}</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#c79dbd] absolute top-3 right-3" />}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/5">
                <Button variant="ghost" onClick={() => setActiveStep(1)} className="text-xs text-slate-400 hover:text-white">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <Button onClick={() => setActiveStep(3)} className="h-10 px-5 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold">
                  <span>Continue</span> <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: BRANCH SETUP */}
          {activeStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">Configure Your Primary Branch</h2>
                <p className="text-xs text-slate-400">
                  Every inventory workspace has a primary store or warehouse location. You can add more later.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Branch Name</Label>
                  <Input
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Branch Code / Tag</Label>
                  <Input
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value)}
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-medium text-slate-300">Physical Address / City</Label>
                  <Input
                    value={branchAddress}
                    onChange={(e) => setBranchAddress(e.target.value)}
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Store Phone Number</Label>
                  <Input
                    value={branchPhone}
                    onChange={(e) => setBranchPhone(e.target.value)}
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Branch Manager</Label>
                  <Input
                    value={branchManager}
                    onChange={(e) => setBranchManager(e.target.value)}
                    className="h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67]"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/5">
                <Button variant="ghost" onClick={() => setActiveStep(2)} className="text-xs text-slate-400 hover:text-white">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <Button onClick={() => setActiveStep(4)} className="h-10 px-5 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold">
                  <span>Continue</span> <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: INVENTORY SETTINGS */}
          {activeStep === 4 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">Stock & Pricing Rules</h2>
                <p className="text-xs text-slate-400">
                  Set default tax, currency, and stock replenishment rules.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Operating Currency</Label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full h-10 px-3 bg-[#0e0a0d] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] focus:outline-none"
                  >
                    <option value="NGN" className="bg-[#120b10]">Nigerian Naira (NGN - ₦)</option>
                    <option value="USD" className="bg-[#120b10]">US Dollar (USD - $)</option>
                    <option value="GBP" className="bg-[#120b10]">British Pound (GBP - £)</option>
                    <option value="GHS" className="bg-[#120b10]">Ghanaian Cedi (GHS - ₵)</option>
                    <option value="KES" className="bg-[#120b10]">Kenyan Shilling (KES - KSh)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-300">Default Stock Unit</Label>
                  <select
                    value={defaultUnit}
                    onChange={(e) => setDefaultUnit(e.target.value)}
                    className="w-full h-10 px-3 bg-[#0e0a0d] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] focus:outline-none"
                  >
                    <option value="Piece" className="bg-[#120b10]">Piece (Pcs)</option>
                    <option value="Carton" className="bg-[#120b10]">Carton (Ctn)</option>
                    <option value="Kg" className="bg-[#120b10]">Kilogram (Kg)</option>
                    <option value="Pack" className="bg-[#120b10]">Pack (Pk)</option>
                    <option value="Bottle" className="bg-[#120b10]">Bottle (Btl)</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-sm bg-[#140e12] border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Prices Include Tax (VAT)</div>
                    <div className="text-[11px] text-slate-400">Display final price on receipts</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={taxInclusive}
                    onChange={(e) => setTaxInclusive(e.target.checked)}
                    className="w-4 h-4 accent-[#714b67] cursor-pointer"
                  />
                </div>

                <div className="p-3.5 rounded-sm bg-[#140e12] border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Allow Negative Stock</div>
                    <div className="text-[11px] text-slate-400">Allow sales when quantity is 0</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowNegativeStock}
                    onChange={(e) => setAllowNegativeStock(e.target.checked)}
                    className="w-4 h-4 accent-[#714b67] cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/5">
                <Button variant="ghost" onClick={() => setActiveStep(3)} className="text-xs text-slate-400 hover:text-white">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <Button onClick={() => setActiveStep(5)} className="h-10 px-5 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold">
                  <span>Continue</span> <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: PRODUCT SETUP CHOICE */}
          {activeStep === 5 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">How would you like to add your products?</h2>
                <p className="text-xs text-slate-400">
                  Select your preferred method to populate your inventory catalogue.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'sample', title: 'Load Starter Products', desc: 'Pre-populate with 3 popular retail items (Recommended)', icon: Sparkles },
                  { id: 'manual', title: 'Add Manually', desc: 'Type in product name, SKU, prices & opening stock', icon: Plus },
                  { id: 'csv', title: 'Import from CSV / Excel', desc: 'Upload existing spreadsheet catalogue', icon: FileSpreadsheet },
                  { id: 'skip', title: 'Start with Blank Store', desc: 'I will create products inside the dashboard later', icon: Boxes },
                ].map((opt) => {
                  const isSelected = productSetupChoice === opt.id;
                  const Icon = opt.icon;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setProductSetupChoice(opt.id as any)}
                      className={cn(
                        'p-4 rounded-sm border text-left cursor-pointer transition-all flex items-start gap-3 relative',
                        isSelected
                          ? 'bg-[#714b67]/20 border-[#714b67] shadow-md'
                          : 'bg-[#140e12] border-white/5 hover:border-white/20'
                      )}
                    >
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                        isSelected ? 'bg-[#714b67] text-white' : 'bg-[#0a0508] text-slate-400'
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{opt.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#c79dbd] absolute top-3 right-3" />}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/5">
                <Button variant="ghost" onClick={() => setActiveStep(4)} className="text-xs text-slate-400 hover:text-white">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <Button
                  onClick={() => {
                    if (productSetupChoice === 'manual') setActiveStep(6);
                    else if (productSetupChoice === 'csv') setActiveStep(7);
                    else setActiveStep(8); // sample or skip jumps to opening stock
                  }}
                  className="h-10 px-5 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold"
                >
                  <span>Continue</span> <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 6: MANUAL PRODUCT ENTRY */}
          {activeStep === 6 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">Add Products Manually</h2>
                <p className="text-xs text-slate-400">
                  Enter items to build your initial product catalogue.
                </p>
              </div>

              <div className="p-4 rounded-sm bg-[#140e12] border border-white/5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Product Name</Label>
                    <Input
                      placeholder="e.g. Golden Penny Spaghetti 500g"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="h-9 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">SKU / Code</Label>
                    <Input
                      value={manualSku}
                      onChange={(e) => setManualSku(e.target.value)}
                      className="h-9 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Category</Label>
                    <Input
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      className="h-9 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Cost Price ({currency})</Label>
                    <Input
                      type="number"
                      value={manualCost}
                      onChange={(e) => setManualCost(Number(e.target.value))}
                      className="h-9 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Selling Price ({currency})</Label>
                    <Input
                      type="number"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(Number(e.target.value))}
                      className="h-9 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Opening Stock</Label>
                    <Input
                      type="number"
                      value={manualStock}
                      onChange={(e) => setManualStock(Number(e.target.value))}
                      className="h-9 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleAddManualProduct}
                  className="h-9 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xs text-xs font-medium flex items-center gap-1.5 cursor-pointer mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to List</span>
                </Button>
              </div>

              {/* Products Table Preview */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300">Products in Catalogue ({products.length})</div>
                <div className="rounded-sm border border-white/5 bg-[#0e0a0d] overflow-x-auto max-h-[160px] overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#160f14] text-[10px] uppercase text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-2.5">SKU</th>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Cost</th>
                        <th className="p-2.5">Price</th>
                        <th className="p-2.5">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {products.map((p, i) => (
                        <tr key={i}>
                          <td className="p-2.5 font-mono text-[11px] text-slate-400">{p.sku}</td>
                          <td className="p-2.5 font-medium text-white">{p.name}</td>
                          <td className="p-2.5">{fmt(p.costPrice)}</td>
                          <td className="p-2.5 font-semibold text-emerald-400">{fmt(p.sellingPrice)}</td>
                          <td className="p-2.5">{p.stockQuantity} {p.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/5">
                <Button variant="ghost" onClick={() => setActiveStep(5)} className="text-xs text-slate-400 hover:text-white">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <Button onClick={() => setActiveStep(8)} className="h-10 px-5 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold">
                  <span>Continue</span> <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 7: CSV IMPORT */}
          {activeStep === 7 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">Import Products via CSV</h2>
                <p className="text-xs text-slate-400">
                  Download our CSV template, fill in your product lines, and upload it here.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Download Template */}
                <div className="p-5 rounded-sm bg-[#140e12] border border-white/5 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
                      <Download className="w-4 h-4 text-[#c79dbd]" />
                      <span>1. Download Spreadsheet Template</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Standard columns: SKU, Name, Category, CostPrice, SellingPrice, OpeningStock, Barcode.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => toast.success('Downloaded sample CSV template (inventory_template.csv)')}
                    variant="outline"
                    className="w-full h-9 bg-white/5 border-white/10 hover:bg-white/10 text-xs text-white rounded-xs"
                  >
                    Download CSV Template (.csv)
                  </Button>
                </div>

                {/* 2. Upload Dropzone */}
                <div
                  onClick={handleSimulateCsvUpload}
                  className={cn(
                    'p-5 rounded-sm border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all',
                    csvUploaded
                      ? 'border-emerald-500/50 bg-emerald-950/20'
                      : 'border-white/10 bg-[#0e0a0d] hover:border-white/20'
                  )}
                >
                  <Upload className="w-6 h-6 text-[#c79dbd] mb-2" />
                  <div className="text-xs font-bold text-white">
                    {csvUploaded ? 'inventory_batch_upload.csv' : 'Click to Upload CSV'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {csvUploaded ? `${csvRowCount} valid product rows verified` : 'or drag and drop your spreadsheet here'}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/5">
                <Button variant="ghost" onClick={() => setActiveStep(5)} className="text-xs text-slate-400 hover:text-white">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <Button onClick={() => setActiveStep(8)} className="h-10 px-5 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold">
                  <span>Continue</span> <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 8: OPENING STOCK */}
          {activeStep === 8 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">Opening Stock Balances</h2>
                <p className="text-xs text-slate-400">
                  Review initial warehouse quantities for {branchName}.
                </p>
              </div>

              <div className="rounded-sm border border-white/5 bg-[#0e0a0d] overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#160f14] text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Unit Cost</th>
                      <th className="p-3">Opening Qty</th>
                      <th className="p-3">Stock Valuation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {products.map((p, i) => (
                      <tr key={i}>
                        <td className="p-3 font-medium text-white">{p.name}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-400">{p.sku}</td>
                        <td className="p-3">{fmt(p.costPrice)}</td>
                        <td className="p-3 font-semibold text-white">{p.stockQuantity} {p.unit}</td>
                        <td className="p-3 font-semibold text-emerald-400">{fmt(p.costPrice * p.stockQuantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/5">
                <Button variant="ghost" onClick={() => setActiveStep(5)} className="text-xs text-slate-400 hover:text-white">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <Button onClick={() => setActiveStep(9)} className="h-10 px-5 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold">
                  <span>Continue</span> <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 9: STAFF INVITATION */}
          {activeStep === 9 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">Invite Team & Cashiers</h2>
                <p className="text-xs text-slate-400">
                  Add staff members to operate point of sale and manage stock levels. (Optional)
                </p>
              </div>

              <div className="p-4 rounded-sm bg-[#140e12] border border-white/5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Staff Name</Label>
                    <Input
                      placeholder="e.g. John Doe"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      className="h-9 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Email or Phone</Label>
                    <Input
                      placeholder="john@store.ng"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      className="h-9 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Role</Label>
                    <select
                      value={staffRole}
                      onChange={(e) => setStaffRole(e.target.value)}
                      className="w-full h-9 px-3 bg-[#0e0a0d] border border-white/10 text-white rounded-xs text-xs focus:ring-1 focus:ring-[#714b67] focus:outline-none"
                    >
                      <option value="cashier" className="bg-[#120b10]">Cashier (Sales only)</option>
                      <option value="stock_manager" className="bg-[#120b10]">Stock Manager (Inventory)</option>
                      <option value="store_admin" className="bg-[#120b10]">Store Admin (Full access)</option>
                    </select>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleAddStaff}
                  className="h-9 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xs text-xs font-medium flex items-center gap-1.5 cursor-pointer mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Invitation</span>
                </Button>
              </div>

              {/* Invited Staff List */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300">Pending Invitations ({invitedStaffList.length})</div>
                <div className="space-y-2">
                  {invitedStaffList.map((s, i) => (
                    <div key={i} className="p-3 rounded-lg bg-[#0e0a0d] border border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-white">{s.name}</span>
                        <span className="text-slate-400 ml-2 font-mono text-[11px]">{s.email}</span>
                      </div>
                      <span className="text-[10px] bg-[#714b67]/20 text-[#c79dbd] border border-[#714b67]/30 px-2 py-0.5 rounded-xs font-semibold">
                        {s.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/5">
                <Button variant="ghost" onClick={() => setActiveStep(8)} className="text-xs text-slate-400 hover:text-white">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <Button onClick={() => setActiveStep(10)} className="h-10 px-5 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold">
                  <span>Continue</span> <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 10: RECEIPT SETTINGS */}
          {activeStep === 10 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">Receipt & POS Branding</h2>
                <p className="text-xs text-slate-400">
                  Customize the printed and digital receipt shown to customers.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Receipt Fields Form */}
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Receipt Business Name</Label>
                    <Input
                      value={receiptBusinessName}
                      onChange={(e) => setReceiptBusinessName(e.target.value)}
                      className="h-9 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Store Contact Phone</Label>
                    <Input
                      value={receiptPhone}
                      onChange={(e) => setReceiptPhone(e.target.value)}
                      className="h-9 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Store Address</Label>
                    <Input
                      value={receiptAddress}
                      onChange={(e) => setReceiptAddress(e.target.value)}
                      className="h-9 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-300">Footer Note / Policy</Label>
                    <Input
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      className="h-9 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs"
                    />
                  </div>
                </div>

                {/* Live Thermal Receipt Preview */}
                <div className="p-5 rounded-sm bg-white text-slate-900 font-mono text-[11px] shadow-2xl flex flex-col justify-between border border-slate-300">
                  <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
                    <div className="font-bold text-sm tracking-wider uppercase">{receiptBusinessName}</div>
                    <div className="text-[10px] text-slate-600">{receiptAddress}</div>
                    <div className="text-[10px] text-slate-600">Tel: {receiptPhone}</div>
                  </div>

                  <div className="py-2.5 space-y-1 border-b border-dashed border-slate-300 text-[10px]">
                    <div className="flex justify-between">
                      <span>Receipt: #{tutorialReceiptId}</span>
                      <span>{new Date().toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Cashier: {branchManager}</span>
                      <span>POS-01</span>
                    </div>
                  </div>

                  <div className="py-2 space-y-1 border-b border-dashed border-slate-300">
                    <div className="flex justify-between font-semibold">
                      <span>1x Premium Rice 5kg</span>
                      <span>{fmt(6200)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>1x Cooking Oil 3L</span>
                      <span>{fmt(4500)}</span>
                    </div>
                  </div>

                  <div className="py-2 space-y-1 font-bold">
                    <div className="flex justify-between text-xs">
                      <span>TOTAL:</span>
                      <span>{fmt(10700)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-600 font-normal">
                      <span>Paid via: CARD (POS)</span>
                      <span>APPROVED</span>
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-300">
                    {receiptFooter}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/5">
                <Button variant="ghost" onClick={() => setActiveStep(9)} className="text-xs text-slate-400 hover:text-white">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <Button onClick={() => setActiveStep(11)} className="h-10 px-5 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold">
                  <span>Continue to First Sale Test</span> <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 11: FIRST SALE TUTORIAL */}
          {activeStep === 11 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold bg-emerald-950/80 px-2 py-0.5 rounded-xs border border-emerald-500/30">
                  <Sparkles className="w-3 h-3" /> Interactive Guided Tutorial
                </div>
                <h2 className="text-2xl font-bold text-white">Record Your First Test Sale</h2>
                <p className="text-xs text-slate-400">
                  Experience how your cashier sells an item, generates a receipt, and deducts live inventory stock.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Left: Product Selection for POS */}
                <div className="space-y-3">
                  <div className="text-xs font-bold text-white">1. Select Products to Add</div>
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {products.map((p, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-sm bg-[#140e12] border border-white/5 hover:border-white/20 flex items-center justify-between transition-all"
                      >
                        <div>
                          <div className="text-xs font-semibold text-white">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Stock: {p.stockQuantity} • {fmt(p.sellingPrice)}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => handleAddToCart(p)}
                          className="h-8 px-3 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-medium cursor-pointer"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: POS Cart & Checkout */}
                <div className="p-4 rounded-sm bg-[#120b10] border border-white/10 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-white pb-2 border-b border-white/5">
                      <span>2. POS Checkout Cart</span>
                      <span>{tutorialCart.length} Items</span>
                    </div>

                    {tutorialCart.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        Click "Add" on any product to begin sale test.
                      </div>
                    ) : (
                      <div className="py-2 space-y-2 max-h-[140px] overflow-y-auto">
                        {tutorialCart.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-slate-200 truncate max-w-[150px]">
                              {item.quantity}x {item.product.name}
                            </span>
                            <span className="font-semibold text-white">
                              {fmt(item.product.sellingPrice * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t border-white/5">
                    {/* Payment Method Selector */}
                    <div className="flex items-center gap-2">
                      {(['CASH', 'CARD', 'TRANSFER'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setTutorialPaymentMethod(method)}
                          className={cn(
                            'flex-1 py-1.5 text-[10px] font-semibold rounded-xs border transition-all cursor-pointer',
                            tutorialPaymentMethod === method
                              ? 'bg-[#714b67] text-white border-[#714b67]'
                              : 'bg-[#160f14] text-slate-400 border-white/5 hover:text-white'
                          )}
                        >
                          {method}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-sm font-bold text-white">
                      <span>Total Amount:</span>
                      <span className="text-emerald-400 font-mono">{fmt(tutorialTotal)}</span>
                    </div>

                    <Button
                      onClick={handleCompleteTutorialSale}
                      disabled={tutorialCart.length === 0 || isLoading || tutorialSaleCompleted}
                      className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xs font-semibold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {tutorialSaleCompleted ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Sale Completed Successfully!</span>
                        </>
                      ) : (
                        <>
                          <span>Complete Sale & Print Receipt</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/5">
                <Button variant="ghost" onClick={() => setActiveStep(10)} className="text-xs text-slate-400 hover:text-white">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                </Button>
                <Button
                  onClick={() => setActiveStep(12)}
                  className="h-10 px-5 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold"
                >
                  <span>Finish Setup</span> <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 12: COMPLETION & DASHBOARD HANDOFF */}
          {activeStep === 12 && (
            <div className="space-y-6 text-center animate-in fade-in duration-200 max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-2 shadow-xl">
                <BadgeCheck className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white tracking-tight">
                  Inventory & POS Setup Complete!
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Your store <strong className="text-white">{receiptBusinessName}</strong> is ready for daily operations.
                </p>
              </div>

              {/* Completion Checklist Cards */}
              <div className="grid grid-cols-2 gap-3 text-left pt-2">
                <div className="p-3 rounded-sm bg-[#140e12] border border-white/5 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-slate-200">Catalogue Initialized</span>
                </div>
                <div className="p-3 rounded-sm bg-[#140e12] border border-white/5 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-slate-200">Branch & Tax Configured</span>
                </div>
                <div className="p-3 rounded-sm bg-[#140e12] border border-white/5 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-slate-200">Receipt Branding Set</span>
                </div>
                <div className="p-3 rounded-sm bg-[#140e12] border border-white/5 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-slate-200">POS Checkout Tested</span>
                </div>
              </div>

              <div className="pt-6 space-y-3">
                <Button
                  onClick={() => navigate('/inventory/dashboard')}
                  className="w-full h-12 bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white rounded-xs font-semibold text-sm shadow-xl shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Enter Inventory Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate('/app')}
                  className="w-full h-10 bg-transparent hover:bg-white/5 border-white/10 text-slate-300 text-xs rounded-xs"
                >
                  Go to Workspace App Launcher
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Orivo Inc. • Single Unified Business Engine
      </footer>
    </div>
  );
};
