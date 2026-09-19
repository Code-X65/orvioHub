import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
  ArrowRight,
  X,
  Receipt,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { SeoMeta } from '@/components/seo/SeoMeta';
import { InventoryMarketingHeader } from '@/components/marketing/InventoryMarketingHeader';
import { getSignupUrl } from '@/lib/domain';
import { trackEvent } from '@/lib/analytics';

interface DemoProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  category: string;
  stock: number;
  imageEmoji: string;
}

const INITIAL_DEMO_PRODUCTS: DemoProduct[] = [
  { id: '1', name: 'Indomie Instant Noodles (Carton)', sku: 'IND-CRT-40', price: 12500, category: 'Foodstuff', stock: 24, imageEmoji: '🍜' },
  { id: '2', name: 'Peak Evaporated Milk (160g)', sku: 'PEAK-MILK-160', price: 950, category: 'Groceries', stock: 68, imageEmoji: '🥛' },
  { id: '3', name: 'Kings Pure Veg Oil (5 Liters)', sku: 'KNG-OIL-5L', price: 18000, category: 'Oils', stock: 12, imageEmoji: '🌻' },
  { id: '4', name: 'Golden Penny Pure Sugar (500g)', sku: 'GP-SGR-500', price: 1200, category: 'Groceries', stock: 45, imageEmoji: '🧊' },
  { id: '5', name: 'Milo Choco Refill Pack (500g)', sku: 'MLO-RFL-500', price: 4200, category: 'Beverages', stock: 19, imageEmoji: '🍫' },
  { id: '6', name: 'Sunlight Detergent Powder (1kg)', sku: 'SNL-DET-1K', price: 2100, category: 'Household', stock: 30, imageEmoji: '🧼' },
  { id: '7', name: 'Dangote Parboiled Rice (50kg)', sku: 'DNG-RCE-50', price: 74000, category: 'Foodstuff', stock: 8, imageEmoji: '🍚' },
  { id: '8', name: 'Gala Sausage Roll (Pack of 24)', sku: 'GLA-SSG-24', price: 4800, category: 'Snacks', stock: 15, imageEmoji: '🥖' },
];

export const InventoryInteractiveDemoPage: React.FC = () => {
  const [products, setProducts] = useState<DemoProduct[]>(INITIAL_DEMO_PRODUCTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [cart, setCart] = useState<Array<{ product: DemoProduct; quantity: number }>>([
    { product: INITIAL_DEMO_PRODUCTS[0], quantity: 1 },
    { product: INITIAL_DEMO_PRODUCTS[1], quantity: 3 },
  ]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Transfer' | 'POS'>('Transfer');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('ORV-2026-9812');
  const [totalSalesToday, setTotalSalesToday] = useState(248500);
  const [salesCount, setSalesCount] = useState(19);

  useEffect(() => {
    trackEvent(
      'marketing_inventory_demo_viewed',
      { section: 'full_demo_sandbox' },
      { oncePerSession: true }
    );
  }, []);

  const categories = ['All', 'Foodstuff', 'Groceries', 'Oils', 'Beverages', 'Household', 'Snacks'];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = activeCategory === 'All' || p.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const handleAddToCart = (product: DemoProduct) => {
    if (product.stock <= 0) return;
    trackEvent('demo_interaction_started', {
      interaction_type: 'add_to_cart_sandbox',
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

  const handleUpdateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as Array<{ product: DemoProduct; quantity: number }>
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;

    // Deduct stock in real-time
    setProducts((prev) =>
      prev.map((p) => {
        const inCart = cart.find((item) => item.product.id === p.id);
        if (inCart) {
          return { ...p, stock: Math.max(0, p.stock - inCart.quantity) };
        }
        return p;
      })
    );

    setTotalSalesToday((prev) => prev + cartTotal);
    setSalesCount((prev) => prev + 1);
    setReceiptNumber(`ORV-${Math.floor(100000 + Math.random() * 900000)}`);
    setIsReceiptModalOpen(true);
  };

  const handleResetSandbox = () => {
    setProducts(INITIAL_DEMO_PRODUCTS);
    setCart([]);
    setTotalSalesToday(248500);
    setSalesCount(19);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white flex flex-col justify-between">
      <SeoMeta
        title="Interactive POS & Inventory Demo Sandbox | Orviohub"
        description="Try our full interactive Nigerian POS and stock tracking terminal live in your browser with zero signup required."
        canonicalPath="/inventory/demo"
      />

      <InventoryMarketingHeader />

      {/* Top Demo Banner */}
      <div className="bg-emerald-950/80 border-b border-emerald-500/30 py-2.5 px-4 text-center text-xs font-semibold text-emerald-300 flex items-center justify-center gap-3">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          Interactive Demo Sandbox — Click items to simulate checkout, barcode search, & live stock updates
        </span>
        <button
          type="button"
          onClick={handleResetSandbox}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-emerald-500/40 text-white hover:bg-slate-800 text-[11px]"
        >
          <RotateCcw className="w-3 h-3" />
          Reset Demo Data
        </button>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Live Top Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-xs text-slate-400">Total Sales (Today)</span>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">
              ₦{totalSalesToday.toLocaleString()}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-xs text-slate-400">Transactions Completed</span>
            <div className="text-xl font-bold text-white mt-0.5">{salesCount} Orders</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-xs text-slate-400">Catalog SKUs</span>
            <div className="text-xl font-bold text-white mt-0.5">{products.length} Products</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <span className="text-xs text-slate-400">Cashier Register</span>
            <div className="text-xl font-bold text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Terminal #1 Active
            </div>
          </div>
        </div>

        {/* Main Cashier Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
          {/* Left Column: Product Search & Grid */}
          <div className="lg:col-span-8 space-y-4">
            {/* Search & Categories */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Scan barcode or search (e.g. Indomie, Sugar, Oil)..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeCategory === cat
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Card Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {filteredProducts.map((prod) => (
                <button
                  key={prod.id}
                  onClick={() => handleAddToCart(prod)}
                  disabled={prod.stock <= 0}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all group ${
                    prod.stock <= 0
                      ? 'bg-slate-900/40 border-slate-900 opacity-60 cursor-not-allowed'
                      : 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/60 hover:scale-[1.02] active:scale-98'
                  }`}
                >
                  <div>
                    <div className="text-3xl mb-2">{prod.imageEmoji}</div>
                    <h4 className="text-xs font-bold text-white line-clamp-2 group-hover:text-emerald-400">
                      {prod.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{prod.sku}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-400">
                      ₦{prod.price.toLocaleString()}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        prod.stock <= 0
                          ? 'bg-red-500/10 text-red-400'
                          : prod.stock <= 10
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {prod.stock > 0 ? `${prod.stock} in stock` : 'Out of stock'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Active POS Cart Terminal */}
          <div className="lg:col-span-4 bg-slate-900/90 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">Current Ticket</h3>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-red-400 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              {/* Items List */}
              <div className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto mt-3 pr-1">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                    <ShoppingBag className="w-8 h-8 text-slate-700 mx-auto" />
                    <p>No items added yet. Click any product to add to ticket.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.product.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{item.product.imageEmoji}</span>
                        <div>
                          <p className="text-xs font-semibold text-slate-200 line-clamp-1">
                            {item.product.name}
                          </p>
                          <p className="text-[11px] text-emerald-400 font-bold">
                            ₦{item.product.price.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.product.id, -1)}
                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-white w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.product.id, 1)}
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

            {/* Bottom Payment Block */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="space-y-1.5">
                <span className="text-xs text-slate-400 font-medium">Payment Tender:</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'Transfer', 'POS'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        paymentMethod === method
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">Total Due:</span>
                <span className="text-2xl font-black text-emerald-400">
                  ₦{cartTotal.toLocaleString()}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm shadow-xl shadow-emerald-950/60 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Checkout & Print E-Receipt</span>
              </button>

              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-center">
                <p className="text-xs text-emerald-200 font-medium">
                  Ready to run your real store with Orviohub?
                </p>
                <a
                  href={`${getSignupUrl(window.location.origin)}?plan=inventory_trial`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 rounded-lg transition-colors"
                >
                  Start 30-Day Free Trial <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Simulated Receipt Modal */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 text-center shadow-2xl relative">
            <button
              onClick={() => {
                setIsReceiptModalOpen(false);
                setCart([]);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-6 h-6" />
            </div>

            <h4 className="text-lg font-bold text-white">Receipt Generated!</h4>
            <p className="text-xs text-slate-400 mt-1">Ref: {receiptNumber}</p>

            <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 text-left font-mono text-xs space-y-2">
              <div className="text-center border-b border-dashed border-slate-800 pb-2">
                <p className="font-bold text-white uppercase">ORVIOHUB DEMO STORE</p>
                <p className="text-[10px] text-slate-500">Shop #4, Trade Fair Complex, Lagos</p>
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
                <span>PAID ({paymentMethod.toUpperCase()}):</span>
                <span className="text-emerald-400">₦{cartTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <a
                href={`${getSignupUrl(window.location.origin)}?plan=inventory_trial`}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md"
              >
                <span>Launch Your Real Shop Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => {
                  setIsReceiptModalOpen(false);
                  setCart([]);
                }}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close & Next Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryInteractiveDemoPage;
