import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Boxes,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Play,
  TrendingUp,
  Users,
  WifiOff,
  Building,
  Smartphone,
  ChevronDown,
  ShoppingBag,
  Package,
  Search,
  Plus,
  Minus,
  Check,
  Send,
  X,
  Zap,
  BarChart3,
  ArrowDown,
  Star,
  Receipt,
} from 'lucide-react';
import { SeoMeta } from '@/components/seo/SeoMeta';
import { InventoryMarketingHeader } from '@/components/marketing/InventoryMarketingHeader';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { getCrossSubdomainUrl, getSignupUrl } from '@/lib/domain';
import { trackEvent, captureAttribution } from '@/lib/analytics';

// Sample mock items for interactive POS demo
interface ProductItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  category: string;
  stock: number;
  imageEmoji: string;
}

const DEMO_PRODUCTS: ProductItem[] = [
  { id: '1', name: 'Indomie Instant Noodles (Carton)', sku: 'IND-CRT-40', price: 12500, category: 'Foodstuff', stock: 24, imageEmoji: '🍜' },
  { id: '2', name: 'Peak Evaporated Milk (160g)', sku: 'PEAK-MILK-160', price: 950, category: 'Groceries', stock: 68, imageEmoji: '🥛' },
  { id: '3', name: 'Kings Pure Veg Oil (5 Liters)', sku: 'KNG-OIL-5L', price: 18000, category: 'Oils', stock: 12, imageEmoji: '🌻' },
  { id: '4', name: 'Golden Penny Pure Sugar (500g)', sku: 'GP-SGR-500', price: 1200, category: 'Groceries', stock: 45, imageEmoji: '🧊' },
  { id: '5', name: 'Milo Choco Refill Pack (500g)', sku: 'MLO-RFL-500', price: 4200, category: 'Beverages', stock: 19, imageEmoji: '🍫' },
  { id: '6', name: 'Sunlight Detergent Powder (1kg)', sku: 'SNL-DET-1K', price: 2100, category: 'Household', stock: 30, imageEmoji: '🧼' },
];

const STOCK_TABLE_DATA = [
  { name: 'Indomie Instant Noodles (Carton)', sku: 'IND-CRT-40', stock: 24, reorder: 10, status: 'In Stock', updated: '10 mins ago', category: 'Foodstuff' },
  { name: 'Kings Pure Veg Oil (5 Liters)', sku: 'KNG-OIL-5L', stock: 3, reorder: 5, status: 'Low Stock', updated: '2 hours ago', category: 'Oils' },
  { name: 'Peak Evaporated Milk (160g)', sku: 'PEAK-MILK-160', stock: 68, reorder: 20, status: 'In Stock', updated: '1 day ago', category: 'Groceries' },
  { name: 'Golden Penny Sugar (500g)', sku: 'GP-SGR-500', stock: 0, reorder: 15, status: 'Out of Stock', updated: '3 days ago', category: 'Groceries' },
  { name: 'Milo Choco Refill Pack (500g)', sku: 'MLO-RFL-500', stock: 19, reorder: 8, status: 'In Stock', updated: 'Just now', category: 'Beverages' },
  { name: 'Sunlight Detergent Powder (1kg)', sku: 'SNL-DET-1K', stock: 30, reorder: 10, status: 'In Stock', updated: '4 hours ago', category: 'Household' },
];

export const InventoryMarketingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { workspaces, currentWorkspace } = useWorkspaceStore();

  // Video modal state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  // Demo Tab State: 'record_sale' | 'check_stock' | 'view_reports'
  const [activeDemoTab, setActiveDemoTab] = useState<'record_sale' | 'check_stock' | 'view_reports'>('record_sale');

  // Interactive Demo Cart State
  const [cart, setCart] = useState<Array<{ product: ProductItem; quantity: number }>>([
    { product: DEMO_PRODUCTS[0], quantity: 1 },
    { product: DEMO_PRODUCTS[1], quantity: 2 },
  ]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Transfer' | 'POS'>('Transfer');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [lastReceiptNumber, setLastReceiptNumber] = useState('ORV-2026-9812');

  // Interactive Stock filter
  const [stockSearch, setStockSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [selectedStockItem, setSelectedStockItem] = useState<(typeof STOCK_TABLE_DATA)[0] | null>(null);

  // FAQ open index state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    captureAttribution();
    trackEvent(
      'marketing_inventory_page_viewed',
      {
        page: 'inventory_marketing',
        authenticated: isAuthenticated,
        userId: user?.id,
      },
      { oncePerSession: true }
    );
  }, [isAuthenticated, user]);

  // Auth-aware primary CTA
  const hasWorkspace = (workspaces && workspaces.length > 0) || !!currentWorkspace;
  const hasInventory = workspaces?.some((w) =>
    w.enabledProducts?.some((p) => p.productKey === 'inventory' && p.status === 'active')
  ) || false;

  const dashboardUrl = getCrossSubdomainUrl('inventory', '/dashboard');
  const signupTrialUrl = `${getSignupUrl(window.location.origin)}?plan=inventory_trial&source=inventory_marketing`;

  // Add to cart helper
  const handleAddToCart = (product: ProductItem) => {
    trackEvent('demo_interaction_started', {
      interaction_type: 'add_to_cart',
      product_name: product.name,
    });
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as Array<{ product: ProductItem; quantity: number }>
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handleCompleteSale = () => {
    const receiptId = `ORV-${Math.floor(100000 + Math.random() * 900000)}`;
    setLastReceiptNumber(receiptId);
    setIsReceiptModalOpen(true);
    trackEvent('demo_interaction_started', {
      interaction_type: 'complete_sale',
      total_amount: cartTotal,
      payment_method: paymentMethod,
    });
  };

  const toggleFaq = (index: number) => {
    const isExpanding = openFaqIndex !== index;
    setOpenFaqIndex(isExpanding ? index : null);
    if (isExpanding) {
      trackEvent('faq_expanded', {
        faq_index: index,
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white flex flex-col justify-between overflow-x-hidden">
      {/* SEO & Structured Data */}
      <SeoMeta
        title="Inventory Management Software for Nigerian Businesses | Orviohub"
        description="Track stock, record sales, and manage multi-branch inventory offline. Built specifically for Nigerian businesses. Start your 30-day free trial."
        canonicalPath="/inventory"
        softwareApplication={{
          name: 'Orviohub Inventory',
          applicationCategory: 'BusinessApplication',
          price: '0',
          priceCurrency: 'NGN',
        }}
      />

      {/* 1. Dedicated Marketing Header */}
      <InventoryMarketingHeader />

      {/* Main Content Sections */}
      <main className="flex-1 w-full">
        {/* ========================================================================= */}
        {/* SECTION 3.1: HERO SECTION */}
        {/* ========================================================================= */}
        <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
          {/* Ambient glowing radial gradients */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-radial from-emerald-500/15 via-teal-500/5 to-transparent pointer-events-none -z-10" />
          <div className="absolute top-48 right-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Text & CTAs */}
              <div className="lg:col-span-7 flex flex-col text-left space-y-6">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide w-fit">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  BUILT FOR NIGERIAN WHOLESALE & RETAIL
                </div>

                {/* H1 Headline */}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
                  Simple Inventory Management for{' '}
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
                    Nigerian Businesses
                  </span>
                </h1>

                {/* Subheadline */}
                <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-2xl">
                  Track stock, record sales, and know exactly what you have — all in one place. Built
                  with 100% offline resilience so poor network never stops your business.
                </p>

                {/* Primary & Secondary Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                  {!isAuthenticated ? (
                    <a
                      href={signupTrialUrl}
                      onClick={() =>
                        trackEvent('hero_cta_clicked', {
                          cta_type: 'start_trial',
                          authenticated: false,
                        })
                      }
                      className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-xl shadow-emerald-950/60 hover:shadow-emerald-900/80 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span>Start Free Trial</span>
                      <ArrowRight className="w-5 h-5" />
                    </a>
                  ) : !hasWorkspace ? (
                    <a
                      href="/workspaces/new"
                      onClick={() =>
                        trackEvent('hero_cta_clicked', {
                          cta_type: 'create_workspace',
                          authenticated: true,
                        })
                      }
                      className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base transition-all"
                    >
                      <span>Create Workspace</span>
                      <ArrowRight className="w-5 h-5" />
                    </a>
                  ) : hasInventory ? (
                    <a
                      href={dashboardUrl}
                      onClick={() =>
                        trackEvent('hero_cta_clicked', {
                          cta_type: 'go_to_dashboard',
                          authenticated: true,
                        })
                      }
                      className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-xl shadow-emerald-950/60 transition-all hover:scale-[1.02]"
                    >
                      <span>Go to Inventory Dashboard</span>
                      <ArrowRight className="w-5 h-5" />
                    </a>
                  ) : (
                    <a
                      href="/apps/inventory/activate"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base transition-all"
                    >
                      <span>Activate Inventory Now</span>
                      <ArrowRight className="w-5 h-5" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsVideoModalOpen(true);
                      trackEvent('demo_video_played', { video_type: 'hero_video' });
                    }}
                    className="inline-flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-semibold text-base transition-all hover:text-white"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </div>
                    <span>Watch Demo Video</span>
                  </button>
                </div>

                {/* Trust Indicators */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-y-2 gap-x-6 pt-4 text-xs sm:text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>No credit card required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>30-day free trial</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Works 100% offline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Made for Nigeria (₦)</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Hero Visual Mockup */}
              <div className="lg:col-span-5 relative">
                <div className="relative mx-auto rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 p-2 sm:p-3 shadow-2xl border border-slate-700/80 group">
                  {/* Mock Window Top Bar */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 bg-slate-900/90 rounded-t-xl mb-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <span className="text-emerald-400">inventory.orviohub.com</span>
                    </div>
                    <div className="w-12 text-right">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" title="Online & Synced" />
                    </div>
                  </div>

                  {/* Mock Dashboard UI */}
                  <div className="bg-slate-950 rounded-xl p-4 space-y-4 text-left font-sans">
                    {/* Top Stats Banner */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                        <span className="text-[11px] text-slate-400 font-medium">Today's Sales</span>
                        <div className="text-xl font-bold text-emerald-400 mt-0.5">₦348,200</div>
                        <div className="text-[10px] text-emerald-500 font-medium mt-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> +18.4% vs yesterday
                        </div>
                      </div>

                      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                        <span className="text-[11px] text-slate-400 font-medium">Stock Telemetry</span>
                        <div className="text-xl font-bold text-white mt-0.5">1,420 Items</div>
                        <div className="text-[10px] text-amber-400 font-medium mt-1 flex items-center gap-1">
                          ⚠️ 3 low stock alerts
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Preview */}
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/80 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">Recent POS Checkouts</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          Live Sync
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800/60">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🍜</span>
                            <div>
                              <p className="font-medium text-slate-200">Indomie Carton x2</p>
                              <p className="text-[10px] text-slate-500">Cashier: Chidi (Lagos Branch)</p>
                            </div>
                          </div>
                          <span className="font-bold text-emerald-400">₦25,000</span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800/60">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🌻</span>
                            <div>
                              <p className="font-medium text-slate-200">Kings Veg Oil 5L x1</p>
                              <p className="text-[10px] text-slate-500">WhatsApp Receipt Sent</p>
                            </div>
                          </div>
                          <span className="font-bold text-emerald-400">₦18,000</span>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Floating Card Indicator */}
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                          <WifiOff className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs text-slate-300 font-medium">Offline Mode Active & Ready</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-400">Auto-Sync</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Video Walkthrough Modal */}
        {isVideoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-400 fill-current" />
                  <h3 className="text-sm font-bold text-white">Orviohub Inventory Walkthrough Demo</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVideoModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="aspect-video w-full bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4">
                  <Play className="w-8 h-8 fill-current ml-1" />
                </div>
                <h4 className="text-lg font-bold text-white mb-1">Interactive Product Tour</h4>
                <p className="text-sm text-slate-400 max-w-md mb-6">
                  Learn how to register products, scan barcodes, print receipts, and manage branch
                  inventories with zero network latency.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsVideoModalOpen(false);
                      const el = document.getElementById('demo');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all"
                  >
                    Try Interactive Simulator Below
                  </button>
                  <button
                    onClick={() => setIsVideoModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 3.2: PROBLEM / SOLUTION SECTION */}
        {/* ========================================================================= */}
        <section className="py-20 bg-slate-900/50 border-y border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                Tired of guessing your stock levels?
              </h2>
              <p className="mt-3 text-base text-slate-400">
                Traditional stock-keeping methods cost Nigerian shop owners thousands in stolen items,
                unrecorded sales, and double-orders.
              </p>
            </div>

            {/* 3 Problem Cards (Light Red Tint) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Notebook */}
              <div className="p-6 rounded-2xl bg-red-950/20 border border-red-900/30 text-left hover:border-red-800/50 transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
                  <XCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-red-200">Notebook stock counts are wrong</h3>
                <p className="mt-2 text-sm text-red-300/80 leading-relaxed">
                  Pages get torn, handwriting gets messy, and manual tallies are quickly outdated when sales happen fast.
                </p>
              </div>

              {/* Card 2: Excel */}
              <div className="p-6 rounded-2xl bg-red-950/20 border border-red-900/30 text-left hover:border-red-800/50 transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
                  <XCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-red-200">Excel sheets get messy</h3>
                <p className="mt-2 text-sm text-red-300/80 leading-relaxed">
                  Painful to update on a mobile phone, easy to overwrite by staff, and impossible to barcode scan on the fly.
                </p>
              </div>

              {/* Card 3: Memory */}
              <div className="p-6 rounded-2xl bg-red-950/20 border border-red-900/30 text-left hover:border-red-800/50 transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mb-4">
                  <XCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-red-200">Memory & WhatsApp chats</h3>
                <p className="mt-2 text-sm text-red-300/80 leading-relaxed">
                  Staff promise they recorded items, but stock vanishes without paper trails or accountability.
                </p>
              </div>
            </div>

            {/* Bouncing Transition Down Arrow */}
            <div className="my-10 flex justify-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-bounce">
                <ArrowDown className="w-6 h-6" />
              </div>
            </div>

            {/* Solution Banner */}
            <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border-2 border-emerald-500/40 text-center shadow-2xl relative overflow-hidden">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 mb-4 shadow-lg shadow-emerald-950/50">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                The Solution: Orviohub Inventory
              </h3>
              <p className="mt-2 text-base text-emerald-200 max-w-2xl mx-auto font-medium">
                Accurate stock, real-time sales, automated low-stock warnings, and clear daily profit reports
                tailored for Nigerian trade.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3.3: FEATURE PREVIEW GRID */}
        {/* ========================================================================= */}
        <section id="features" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              POWERFUL TOOLSET
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-3">
              Everything you need to run your business
            </h2>
            <p className="mt-3 text-slate-400 text-base">
              Built from the ground up for wholesalers, supermarkets, electronics retailers, and boutique shops.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Card 1: Product Catalog */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all hover:-translate-y-1 shadow-lg text-left group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                Product Catalog
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Create items with multiple variants, custom barcodes, wholesale/retail pricing, and supplier info.
              </p>
              <button
                onClick={() => {
                  setActiveDemoTab('check_stock');
                  document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
                  trackEvent('feature_card_clicked', { feature_name: 'product_catalog' });
                }}
                className="mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group-hover:gap-2 transition-all"
              >
                Learn more <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 2: POS & Sales */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all hover:-translate-y-1 shadow-lg text-left group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                POS & Sales
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Lightning-fast cashier terminal. Search or scan barcodes, accept split payments (Cash, Transfer, POS).
              </p>
              <button
                onClick={() => {
                  setActiveDemoTab('record_sale');
                  document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
                  trackEvent('feature_card_clicked', { feature_name: 'pos_sales' });
                }}
                className="mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group-hover:gap-2 transition-all"
              >
                Learn more <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 3: Stock Tracking */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all hover:-translate-y-1 shadow-lg text-left group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <Boxes className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                Stock Tracking
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Real-time stock movement audits, damage adjustments, batch expiry dates, and low-stock telemetry.
              </p>
              <button
                onClick={() => {
                  setActiveDemoTab('check_stock');
                  document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
                  trackEvent('feature_card_clicked', { feature_name: 'stock_tracking' });
                }}
                className="mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group-hover:gap-2 transition-all"
              >
                Learn more <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 4: Reports */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all hover:-translate-y-1 shadow-lg text-left group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                Reports & Analytics
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Daily end-of-shift reconciliation, gross margin calculators, dead-stock warnings, and profit charts.
              </p>
              <button
                onClick={() => {
                  setActiveDemoTab('view_reports');
                  document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
                  trackEvent('feature_card_clicked', { feature_name: 'reports' });
                }}
                className="mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group-hover:gap-2 transition-all"
              >
                Learn more <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 5: Team Management */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all hover:-translate-y-1 shadow-lg text-left group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                Team Management
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Role-scoped permissions. Prevent cashiers from editing stock or viewing profit margins.
              </p>
              <button
                onClick={() => {
                  trackEvent('feature_card_clicked', { feature_name: 'team_management' });
                  navigate('/inventory/demo');
                }}
                className="mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group-hover:gap-2 transition-all"
              >
                Learn more <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 6: Offline Mode */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all hover:-translate-y-1 shadow-lg text-left group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <WifiOff className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                100% Offline Mode
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Sell items and print receipts even with zero internet. Transactions queue locally and sync automatically.
              </p>
              <button
                onClick={() => {
                  trackEvent('feature_card_clicked', { feature_name: 'offline_mode' });
                  navigate('/inventory/demo');
                }}
                className="mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group-hover:gap-2 transition-all"
              >
                Learn more <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 7: Multi-Branch */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all hover:-translate-y-1 shadow-lg text-left group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <Building className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                Multi-Branch Central
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Operate Lagos, Abuja, and Port Harcourt shops from one master screen with inter-branch transfers.
              </p>
              <button
                onClick={() => {
                  trackEvent('feature_card_clicked', { feature_name: 'multi_branch' });
                  navigate('/inventory/demo');
                }}
                className="mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group-hover:gap-2 transition-all"
              >
                Learn more <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 8: WhatsApp Receipts */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all hover:-translate-y-1 shadow-lg text-left group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                WhatsApp Receipts
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Save paper costs. Dispatch itemized e-receipts directly to customers' WhatsApp with 1 click.
              </p>
              <button
                onClick={() => {
                  setActiveDemoTab('record_sale');
                  document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
                  trackEvent('feature_card_clicked', { feature_name: 'whatsapp_receipts' });
                }}
                className="mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group-hover:gap-2 transition-all"
              >
                Learn more <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Card 9: Fast Barcode Scanner Support */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all hover:-translate-y-1 shadow-lg text-left group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                Plug & Play Hardware
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Works with USB/Bluetooth handheld barcode scanners, ESC/POS thermal printers, and cash drawers.
              </p>
              <button
                onClick={() => {
                  trackEvent('feature_card_clicked', { feature_name: 'hardware' });
                  navigate('/inventory/demo');
                }}
                className="mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group-hover:gap-2 transition-all"
              >
                Learn more <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3.4: INTERACTIVE DEMO PREVIEW (RECORD SALE, CHECK STOCK, REPORTS) */}
        {/* ========================================================================= */}
        <section id="demo" className="py-20 bg-slate-900/40 border-y border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <span className="text-xs uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                LIVE INTERACTIVE SIMULATOR
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-3">
                See it in action
              </h2>
              <p className="mt-2 text-slate-400 text-sm sm:text-base">
                Click around below to experience how fast you can record sales, check stock levels, and view daily profits.
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex p-1.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner">
                <button
                  type="button"
                  onClick={() => {
                    setActiveDemoTab('record_sale');
                    trackEvent('demo_tab_changed', { tab_name: 'record_sale' });
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    activeDemoTab === 'record_sale'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>1. Record Sale (POS)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveDemoTab('check_stock');
                    trackEvent('demo_tab_changed', { tab_name: 'check_stock' });
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    activeDemoTab === 'check_stock'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Boxes className="w-4 h-4" />
                  <span>2. Check Stock</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveDemoTab('view_reports');
                    trackEvent('demo_tab_changed', { tab_name: 'view_reports' });
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    activeDemoTab === 'view_reports'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>3. View Reports</span>
                </button>
              </div>
            </div>

            {/* Interactive Mockup Container */}
            <div className="rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl p-4 sm:p-6 transition-all min-h-[480px]">
              {/* TAB 1: POS RECORD SALE */}
              {activeDemoTab === 'record_sale' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
                  {/* Left: Product Selector */}
                  <div className="lg:col-span-7 space-y-4 text-left">
                    <div className="flex items-center justify-between">
                      <div className="relative flex-1 mr-3">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search product name or barcode (e.g. Indomie)..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          readOnly
                        />
                      </div>
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 whitespace-nowrap">
                        Tap item to add
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {DEMO_PRODUCTS.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleAddToCart(prod)}
                          className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 transition-all text-left group hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <div className="text-2xl mb-2">{prod.imageEmoji}</div>
                          <p className="text-xs font-bold text-white line-clamp-2 group-hover:text-emerald-400">
                            {prod.name}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-400">
                              ₦{prod.price.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Stock: {prod.stock}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right: Active POS Cart */}
                  <div className="lg:col-span-5 bg-slate-900/90 rounded-xl border border-slate-800 p-4 flex flex-col justify-between text-left space-y-4">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-emerald-400" />
                          <h4 className="text-sm font-bold text-white">Active Ticket</h4>
                        </div>
                        <span className="text-xs text-slate-400">{cart.length} items</span>
                      </div>

                      <div className="divide-y divide-slate-800/60 max-h-56 overflow-y-auto mt-2 pr-1">
                        {cart.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-500">
                            Ticket is empty. Tap any product on the left to add.
                          </div>
                        ) : (
                          cart.map((item) => (
                            <div key={item.product.id} className="py-2.5 flex items-center justify-between">
                              <div>
                                <p className="text-xs font-semibold text-slate-200">{item.product.name}</p>
                                <p className="text-[11px] text-emerald-400 font-medium">
                                  ₦{item.product.price.toLocaleString()} each
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(item.product.id, -1)}
                                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-xs font-bold text-white w-4 text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(item.product.id, 1)}
                                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-800">
                      {/* Payment Options */}
                      <div className="flex items-center gap-2">
                        {(['Cash', 'Transfer', 'POS'] as const).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setPaymentMethod(method)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              paymentMethod === method
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>

                      {/* Total and Checkout */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Total Payable:</span>
                        <span className="text-xl font-extrabold text-emerald-400">
                          ₦{cartTotal.toLocaleString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleCompleteSale}
                        disabled={cart.length === 0}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>Complete Sale & Issue Receipt</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CHECK STOCK */}
              {activeDemoTab === 'check_stock' && (
                <div className="space-y-4 animate-in fade-in duration-300 text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setStockFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          stockFilter === 'all'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        All Stock (6)
                      </button>
                      <button
                        onClick={() => setStockFilter('low')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          stockFilter === 'low'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        Low Stock (1)
                      </button>
                      <button
                        onClick={() => setStockFilter('out')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          stockFilter === 'out'
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        Out of Stock (1)
                      </button>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        value={stockSearch}
                        onChange={(e) => setStockSearch(e.target.value)}
                        placeholder="Search stock item..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Product Name</th>
                          <th className="py-3 px-4">SKU</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Current Stock</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Last Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-950 font-medium text-slate-200">
                        {STOCK_TABLE_DATA.filter((item) => {
                          const matchesFilter =
                            stockFilter === 'low'
                              ? item.status === 'Low Stock'
                              : stockFilter === 'out'
                              ? item.status === 'Out of Stock'
                              : true;
                          const matchesSearch =
                            item.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
                            item.sku.toLowerCase().includes(stockSearch.toLowerCase());
                          return matchesFilter && matchesSearch;
                        }).map((item, idx) => (
                          <tr
                            key={idx}
                            onClick={() => setSelectedStockItem(item)}
                            className="hover:bg-slate-900/60 cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-4 font-bold text-white">{item.name}</td>
                            <td className="py-3 px-4 font-mono text-slate-400">{item.sku}</td>
                            <td className="py-3 px-4 text-slate-400">{item.category}</td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-emerald-400">{item.stock}</span> units
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  item.status === 'In Stock'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : item.status === 'Low Stock'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">{item.updated}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Selected stock inspection drawer */}
                  {selectedStockItem && (
                    <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 animate-in slide-in-from-bottom-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-emerald-400" />
                          <h5 className="text-sm font-bold text-white">
                            Audit Trail: {selectedStockItem.name}
                          </h5>
                        </div>
                        <button
                          onClick={() => setSelectedStockItem(null)}
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          Close
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                          <span className="text-slate-500">Opening Balance:</span>
                          <p className="text-white font-bold mt-0.5">50 Units</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                          <span className="text-slate-500">Total Sold Today:</span>
                          <p className="text-emerald-400 font-bold mt-0.5">26 Units (₦325,000)</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                          <span className="text-slate-500">Minimum Reorder:</span>
                          <p className="text-amber-400 font-bold mt-0.5">
                            {selectedStockItem.reorder} Units
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: VIEW REPORTS */}
              {activeDemoTab === 'view_reports' && (
                <div className="space-y-6 animate-in fade-in duration-300 text-left">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-xs text-slate-400">Total Sales (Today)</span>
                      <div className="text-2xl font-black text-emerald-400 mt-1">₦482,500</div>
                      <span className="text-[11px] text-emerald-500 font-semibold">
                        +22.5% vs 7-day average
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-xs text-slate-400">Gross Estimated Profit</span>
                      <div className="text-2xl font-black text-white mt-1">₦146,800</div>
                      <span className="text-[11px] text-slate-400">Margin: 30.4%</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-xs text-slate-400">Total Transactions</span>
                      <div className="text-2xl font-black text-white mt-1">58 Orders</div>
                      <span className="text-[11px] text-emerald-400">100% Synced & Reconciled</span>
                    </div>
                  </div>

                  {/* Interactive Visual Graph & Top Sellers */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    {/* SVG Chart */}
                    <div className="lg:col-span-7 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-white">Daily Revenue Trend</span>
                        <span className="text-[10px] text-slate-400">Mon - Sun (₦ Thousands)</span>
                      </div>
                      <div className="h-40 flex items-end justify-between gap-3 px-2 pt-6">
                        {[
                          { day: 'Mon', val: 280, h: '60%' },
                          { day: 'Tue', val: 320, h: '70%' },
                          { day: 'Wed', val: 240, h: '50%' },
                          { day: 'Thu', val: 410, h: '85%' },
                          { day: 'Fri', val: 490, h: '95%' },
                          { day: 'Sat', val: 560, h: '100%' },
                          { day: 'Sun', val: 482, h: '90%' },
                        ].map((bar, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                            <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                              ₦{bar.val}k
                            </span>
                            <div
                              className="w-full bg-emerald-600 group-hover:bg-emerald-400 rounded-t-md transition-all cursor-pointer"
                              style={{ height: bar.h }}
                            />
                            <span className="text-[10px] text-slate-400 font-semibold">{bar.day}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Products */}
                    <div className="lg:col-span-5 bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                      <span className="text-xs font-bold text-white block">Top Selling Products</span>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950">
                          <span className="font-semibold text-slate-200">Indomie Carton</span>
                          <span className="font-bold text-emerald-400">₦225,000 (18 cs)</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950">
                          <span className="font-semibold text-slate-200">Kings Veg Oil 5L</span>
                          <span className="font-bold text-emerald-400">₦144,000 (8 btls)</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950">
                          <span className="font-semibold text-slate-200">Peak Milk Powder</span>
                          <span className="font-bold text-emerald-400">₦64,600 (68 pk)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom CTA for full interactive demo */}
            <div className="mt-8 flex justify-center">
              <Link
                to="/inventory/demo"
                onClick={() =>
                  trackEvent('demo_cta_clicked', { position: 'demo_preview' })
                }
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 hover:scale-105 transition-all"
              >
                <span>Launch Full Interactive Sandbox Demo</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Receipt Simulation Modal */}
        {isReceiptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 text-center shadow-2xl relative">
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Receipt className="w-6 h-6" />
              </div>

              <h4 className="text-lg font-bold text-white">Sale Recorded Successfully!</h4>
              <p className="text-xs text-slate-400 mt-1">Receipt ID: {lastReceiptNumber}</p>

              {/* Receipt Body */}
              <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 text-left font-mono text-xs space-y-2">
                <div className="text-center border-b border-dashed border-slate-800 pb-2">
                  <p className="font-bold text-white uppercase">ORVIOHUB INVENTORY POS</p>
                  <p className="text-[10px] text-slate-500">Lagos Branch • +234 800 ORVIO</p>
                </div>

                <div className="divide-y divide-slate-900 py-1 space-y-1">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex justify-between text-[11px] pt-1">
                      <span>
                        {item.product.name.slice(0, 18)} x{item.quantity}
                      </span>
                      <span className="font-bold text-emerald-400">
                        ₦{(item.product.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-slate-800 pt-2 flex justify-between font-bold text-sm text-white">
                  <span>TOTAL:</span>
                  <span className="text-emerald-400">₦{cartTotal.toLocaleString()}</span>
                </div>
                <div className="text-[10px] text-slate-500 text-center">
                  Paid via: <span className="text-slate-300">{paymentMethod}</span>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiptModalOpen(false);
                    setCart([]);
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send via WhatsApp (+234)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiptModalOpen(false);
                    setCart([]);
                  }}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Close & New Ticket
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 3.5: HOW IT WORKS (3 SIMPLE STEPS) */}
        {/* ========================================================================= */}
        <section id="how-it-works" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              FAST ONBOARDING
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-3">
              Get started in 3 simple steps
            </h2>
            <p className="mt-3 text-slate-400 text-base">
              You don't need IT consultants or weeks of setup. Start ringing sales today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 text-left relative group hover:border-emerald-500/40 transition-all shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-950/60">
                1
              </div>
              <h3 className="text-xl font-bold text-white">Create account</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Sign up in less than 2 minutes with your business name and email. No credit card required.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 text-left relative group hover:border-emerald-500/40 transition-all shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-950/60">
                2
              </div>
              <h3 className="text-xl font-bold text-white">Add products</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Upload your existing Excel / CSV product list or add items quickly using your phone's camera.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 text-left relative group hover:border-emerald-500/40 transition-all shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-950/60">
                3
              </div>
              <h3 className="text-xl font-bold text-white">Start selling</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Record your first checkout in under 5 minutes and see instant stock deduction and profit stats.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <a
              href={signupTrialUrl}
              onClick={() =>
                trackEvent('how_it_works_viewed', { position: 'step_section_cta' })
              }
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-xl shadow-emerald-950/60 hover:scale-105 transition-all"
            >
              <span>Start Your Free 30-Day Trial</span>
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3.6: PRICING PREVIEW SECTION */}
        {/* ========================================================================= */}
        <section id="pricing" className="py-20 bg-slate-900/50 border-y border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                AFFORDABLE TIERS
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-3">
                Simple, transparent pricing
              </h2>
              <p className="mt-3 text-slate-400 text-base">
                No hidden charges. Upgrade, downgrade, or cancel anytime. All plans include Nigerian Naira (₦) billing.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
              {/* Card 1: Free Trial */}
              <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-left flex flex-col justify-between hover:border-slate-700 transition-all shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                      30-DAY TRIAL
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white">Free Trial</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Perfect for new businesses testing the waters.
                  </p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">₦0</span>
                    <span className="text-xs text-slate-400">/ 30 days</span>
                  </div>

                  <div className="mt-8 space-y-3.5 text-sm text-slate-300">
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>1 Physical Branch</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>2 Staff Accounts</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Up to 500 Products</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>All Core POS & Inventory Features</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <a
                    href={`${getSignupUrl(window.location.origin)}?plan=free_trial`}
                    onClick={() =>
                      trackEvent('pricing_card_clicked', { plan_name: 'free_trial' })
                    }
                    className="w-full block text-center py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all"
                  >
                    Start Free Trial →
                  </a>
                </div>
              </div>

              {/* Card 2: Standard (Highlighted / Popular) */}
              <div className="p-8 rounded-3xl bg-gradient-to-b from-emerald-950/70 via-slate-900 to-slate-900 border-2 border-emerald-500 text-left flex flex-col justify-between relative shadow-2xl scale-[1.03]">
                <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] tracking-wider uppercase shadow-md">
                  MOST POPULAR
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-white">Standard</h3>
                  <p className="text-xs text-emerald-200 mt-1">
                    For thriving retail shops and provision stores.
                  </p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-emerald-400">₦7,500</span>
                    <span className="text-xs text-slate-400">/ month</span>
                  </div>

                  <div className="mt-8 space-y-3.5 text-sm text-slate-200">
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Up to 3 Branches</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>10 Staff Accounts with Roles</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Up to 5,000 Products</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>WhatsApp Receipts & Reports</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Fast Email & WhatsApp Support</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <a
                    href={`${getSignupUrl(window.location.origin)}?plan=standard`}
                    onClick={() =>
                      trackEvent('pricing_card_clicked', { plan_name: 'standard' })
                    }
                    className="w-full block text-center py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/60 transition-all hover:scale-[1.02]"
                  >
                    Choose Standard →
                  </a>
                </div>
              </div>

              {/* Card 3: Premium */}
              <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-left flex flex-col justify-between hover:border-slate-700 transition-all shadow-xl">
                <div>
                  <h3 className="text-2xl font-bold text-white">Premium</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    For large wholesale supermarkets and distributors.
                  </p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">₦15,000</span>
                    <span className="text-xs text-slate-400">/ month</span>
                  </div>

                  <div className="mt-8 space-y-3.5 text-sm text-slate-300">
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Up to 10 Branches</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>50 Staff Accounts</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>25,000+ Products</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Dedicated Account Manager</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>REST API & Custom Export</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <a
                    href={`${getSignupUrl(window.location.origin)}?plan=premium`}
                    onClick={() =>
                      trackEvent('pricing_card_clicked', { plan_name: 'premium' })
                    }
                    className="w-full block text-center py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all"
                  >
                    Choose Premium →
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom Footer Info */}
            <div className="mt-10 text-center space-y-2">
              <p className="text-xs text-slate-400">
                All plans include offline mode, WhatsApp e-receipts, free automatic updates, and daily cloud backup.
              </p>
              <Link
                to="/inventory/pricing"
                className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                View Full Pricing Comparison & Feature Matrix →
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3.7: TESTIMONIALS SECTION */}
        {/* ========================================================================= */}
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              TRUSTED IN NIGERIA
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-3">
              Trusted by Nigerian shop owners
            </h2>
            <p className="mt-3 text-slate-400 text-base">
              Here is what retailers across Lagos, Enugu, and Kano say about switching to Orviohub.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Testimonial 1 */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 text-left relative shadow-xl">
              <div className="flex items-center gap-1 text-amber-400 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <p className="text-slate-200 text-base sm:text-lg italic leading-relaxed">
                "Orviohub helped me finally know my exact stock levels. No more guessing or losing cartons of milk to unaccounted sales. The daily profit summary on my phone is incredible!"
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-bold text-sm">
                  CO
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Chidinma O.</h4>
                  <p className="text-xs text-slate-400">Provision Store Owner • Enugu</p>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 text-left relative shadow-xl">
              <div className="flex items-center gap-1 text-amber-400 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <p className="text-slate-200 text-base sm:text-lg italic leading-relaxed">
                "The offline mode is a complete lifesaver. In Kano our network cuts out frequently, but the cashiers keep scanning barcodes and selling without any pause. Everything syncs when the network is back."
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-teal-600/30 text-teal-300 border border-teal-500/40 flex items-center justify-center font-bold text-sm">
                  AM
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Ahmed M.</h4>
                  <p className="text-xs text-slate-400">Electronics Retailer • Kano</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3.8: FAQ SECTION */}
        {/* ========================================================================= */}
        <section id="faq" className="py-20 bg-slate-900/50 border-y border-slate-800/80">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="text-xs uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                GOT QUESTIONS?
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-3">
                Frequently asked questions
              </h2>
              <p className="mt-3 text-slate-400 text-base">
                Everything you need to know about setting up and running Orviohub Inventory.
              </p>
            </div>

            <div className="space-y-4 text-left">
              {[
                {
                  q: 'Do I need constant internet to use Orviohub?',
                  a: 'No! Orviohub is built offline-first. Your cashier can scan barcodes, issue sales, and print thermal receipts without internet. When your connection returns, all records sync automatically to the cloud.',
                },
                {
                  q: 'Can I import my existing product catalog from Excel?',
                  a: 'Yes! You can upload a standard CSV or Excel file containing product names, barcodes/SKUs, cost prices, and opening stock counts. We configure your inventory automatically in seconds.',
                },
                {
                  q: 'What happens after the 30-day free trial?',
                  a: 'You can upgrade to our Standard (₦7,500/mo) or Premium plan. If you choose not to upgrade immediately, your data remains safely stored and preserved in your workspace.',
                },
                {
                  q: 'Can my staff use it with restricted cashier access?',
                  a: 'Yes. You can invite team members and assign them roles such as Cashier, Stock Clerk, or Branch Manager. Cashiers can only record sales and cannot see cost prices or delete historical records.',
                },
                {
                  q: 'Is my business and financial data secure?',
                  a: 'Absolutely. All records are secured using AES-256 encryption, isolated per workspace, and backed up in real time across multiple redundant servers.',
                },
              ].map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={index}
                    className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(index)}
                      className="w-full px-6 py-4 flex items-center justify-between text-left text-base font-bold text-white hover:text-emerald-400 transition-colors"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-emerald-400' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3 animate-in fade-in duration-200">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3.9: FINAL CTA SECTION */}
        {/* ========================================================================= */}
        <section className="py-20 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 p-8 sm:p-14 text-center shadow-2xl relative overflow-hidden">
              {/* Background ambient lighting */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight max-w-3xl mx-auto leading-tight">
                Ready to take complete control of your inventory?
              </h2>
              <p className="mt-4 text-base sm:text-lg text-emerald-100 max-w-2xl mx-auto font-medium">
                Join hundreds of Nigerian retail & wholesale businesses using Orviohub to track stock,
                prevent loss, and scale operations.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href={signupTrialUrl}
                  onClick={() =>
                    trackEvent('final_cta_clicked', {
                      position: 'bottom_banner',
                    })
                  }
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white text-emerald-950 font-extrabold text-base shadow-xl hover:bg-slate-100 transition-all hover:scale-105 active:scale-95"
                >
                  Start Free 30-Day Trial →
                </a>
                <a
                  href="/contact"
                  className="w-full sm:w-auto px-7 py-4 rounded-xl bg-transparent border-2 border-white/80 text-white font-bold text-base hover:bg-white/10 transition-all"
                >
                  Talk to Sales Team
                </a>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-emerald-100 font-medium">
                <span>✓ 30-day free trial</span>
                <span>✓ No credit card required</span>
                <span>✓ Cancel anytime with 1 click</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* SECTION 3.10: RICH MARKETING FOOTER */}
      {/* ========================================================================= */}
      <footer className="bg-slate-950 border-t border-slate-900 py-16 text-slate-400 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            {/* Brand column */}
            <div className="col-span-2 space-y-4 text-left">
              <Link to="/" className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                  <Boxes className="w-4 h-4" />
                </div>
                <span className="text-lg font-bold text-white tracking-tight">Orviohub</span>
              </Link>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                The all-in-one cloud business operating system engineered for high-growth enterprises and retail stores across Africa.
              </p>
              <div className="text-xs font-semibold text-emerald-400">
                Made with ❤️ in Nigeria
              </div>
            </div>

            {/* Column 1: Products */}
            <div className="text-left space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-white">Products</h5>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link to="/inventory" className="text-emerald-400 font-medium hover:underline">
                    Inventory & POS
                  </Link>
                </li>
                <li>
                  <span className="text-slate-500">Task Management (Soon)</span>
                </li>
                <li>
                  <span className="text-slate-500">CRM & Contacts (Soon)</span>
                </li>
                <li>
                  <span className="text-slate-500">Gym Management (Soon)</span>
                </li>
                <li>
                  <span className="text-slate-500">Booking & Rental (Soon)</span>
                </li>
              </ul>
            </div>

            {/* Column 2: Company */}
            <div className="text-left space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-white">Company</h5>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link to="/about" className="hover:text-white transition-colors">
                    About Orviohub
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-white transition-colors">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <span className="text-slate-500">Careers</span>
                </li>
              </ul>
            </div>

            {/* Column 3: Legal & Support */}
            <div className="text-left space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-white">Legal & Help</h5>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link to="/privacy" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/security" className="hover:text-white transition-colors">
                    Security Architecture
                  </Link>
                </li>
                <li>
                  <span className="text-slate-500">Status: Operational</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© 2026 Orviohub Technologies Ltd. All rights reserved.</p>
            <div className="flex items-center gap-4 text-slate-400">
              <span className="hover:text-white cursor-pointer">Twitter (X)</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer">LinkedIn</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer">Instagram</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer">YouTube</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default InventoryMarketingPage;
