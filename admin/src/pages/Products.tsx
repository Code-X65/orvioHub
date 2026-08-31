import React, { useEffect, useState } from "react";
import {
  Package,
  Loader2,
  RefreshCw,
  Plus,
  Edit2,
  Archive,
  Trash2,
  Bell,
  EyeOff,
  CheckCircle2,
  Clock,
  Download,
  Sparkles,
  Layers,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { adminProductsApi, type PlatformProduct } from "../api/adminProducts";
import ConfirmDialog from "../components/ConfirmDialog";

export const Products: React.FC = () => {
  const { sessionToken } = useAuth();
  const [products, setProducts] = useState<PlatformProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PlatformProduct | null>(null);
  const [waitlistProduct, setWaitlistProduct] = useState<PlatformProduct | null>(null);
  const [waitlistEntries, setWaitlistEntries] = useState<any[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    key: "",
    description: "",
    status: "active" as "active" | "coming_soon" | "draft",
    displayOrder: 1,
    isBeta: false,
    isFeatured: false,
    iconUrl: "",
    subdomain: "",
    documentationUrl: "",
    supportEmail: "",
  });

  // Confirmation dialog state
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    isDestructive?: boolean;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    action: async () => {},
  });

  const loadProducts = async () => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      const res = await adminProductsApi.listProducts(sessionToken);
      setProducts(res || []);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [sessionToken]);

  const handleOpenCreate = () => {
    setFormData({
      name: "",
      key: "",
      description: "",
      status: "active",
      displayOrder: (products.length || 0) + 1,
      isBeta: false,
      isFeatured: false,
      iconUrl: "",
      subdomain: "",
      documentationUrl: "",
      supportEmail: "",
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (prod: PlatformProduct) => {
    const s = (prod.status || "active").toLowerCase();
    const cleanStatus = (s === "coming_soon" || s === "beta")
      ? "coming_soon"
      : s === "draft"
      ? "draft"
      : "active";

    setFormData({
      name: prod.name,
      key: prod.key,
      description: prod.description,
      status: cleanStatus,
      displayOrder: prod.displayOrder ?? 1,
      isBeta: Boolean(prod.isBeta),
      isFeatured: Boolean(prod.isFeatured),
      iconUrl: prod.iconUrl || "",
      subdomain: prod.subdomain || "",
      documentationUrl: prod.documentationUrl || "",
      supportEmail: prod.supportEmail || "",
    });
    setEditingProduct(prod);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setActionLoading(true);
    try {
      if (editingProduct) {
        await adminProductsApi.updateProduct(editingProduct.key, {
          name: formData.name,
          description: formData.description,
          status: formData.status,
          displayOrder: Number(formData.displayOrder),
          isBeta: formData.isBeta,
          isFeatured: formData.isFeatured,
          iconUrl: formData.iconUrl || undefined,
          subdomain: formData.subdomain || undefined,
          documentationUrl: formData.documentationUrl || undefined,
          supportEmail: formData.supportEmail || undefined,
        });
        setEditingProduct(null);
      } else {
        await adminProductsApi.createProduct({
          name: formData.name.trim(),
          key: formData.key.trim() || undefined,
          description: formData.description,
          status: formData.status,
          displayOrder: Number(formData.displayOrder),
          isBeta: formData.isBeta,
          isFeatured: formData.isFeatured,
          iconUrl: formData.iconUrl || undefined,
          subdomain: formData.subdomain || undefined,
          documentationUrl: formData.documentationUrl || undefined,
          supportEmail: formData.supportEmail || undefined,
        });
        setIsCreateModalOpen(false);
      }
      await loadProducts();
    } catch (err: any) {
      alert(err.message || "Failed to save product.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = (prod: PlatformProduct) => {
    setDialogConfig({
      isOpen: true,
      title: `Archive ${prod.name}`,
      message: `Move ${prod.name} to Draft status? It will be hidden from the user app launcher and marketing catalog.`,
      confirmLabel: "Archive to Draft",
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await adminProductsApi.archiveProduct(prod.key);
          await loadProducts();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDelete = (prod: PlatformProduct) => {
    setDialogConfig({
      isOpen: true,
      title: `Delete Draft ${prod.name}`,
      message: `Permanently delete ${prod.name} from the platform catalog? This action cannot be undone.`,
      confirmLabel: "Delete Draft",
      isDestructive: true,
      action: async () => {
        setActionLoading(true);
        try {
          await adminProductsApi.deleteProduct(prod.key);
          await loadProducts();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleOpenWaitlist = async (prod: PlatformProduct) => {
    setWaitlistProduct(prod);
    setWaitlistLoading(true);
    try {
      const res = await adminProductsApi.getNotifyList(prod.key);
      setWaitlistEntries(res || []);
    } catch (err) {
      console.error("Failed to load waitlist:", err);
      setWaitlistEntries([]);
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleExportWaitlist = () => {
    if (!waitlistProduct || waitlistEntries.length === 0) return;
    const content = waitlistEntries.map((e) => `${e.email},${new Date(e.createdAt).toISOString()}`).join("\n");
    const blob = new Blob([`Email,SubscribedAt\n${content}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${waitlistProduct.key}-waitlist.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSeedDefaults = async () => {
    setActionLoading(true);
    try {
      await adminProductsApi.seedDefaultProducts();
      await loadProducts();
    } catch (err) {
      console.error("Seed error:", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Metrics
  const activeCount = products.filter((p) => (p.status || "").toLowerCase() === "active").length;
  const comingSoonCount = products.filter((p) => {
    const s = (p.status || "").toLowerCase();
    return s === "coming_soon" || s === "beta";
  }).length;
  const draftCount = products.filter((p) => (p.status || "").toLowerCase() === "draft").length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Product Launch & Application Catalog</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Govern modular SaaS applications, visibility states (`Active`, `Coming Soon`, `Draft`), and customer waitlists.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadProducts}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-600/30 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Catalog</span>
            <Layers className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-2xl font-bold text-white">{products.length}</p>
          <span className="text-[10px] text-slate-500">Registered SaaS surfaces</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Active in App</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
          <span className="text-[10px] text-slate-500">Live for all users</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Coming Soon</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">{comingSoonCount}</p>
          <span className="text-[10px] text-slate-500">Waitlist collection active</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Drafts (Hidden)</span>
            <EyeOff className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-400">{draftCount}</p>
          <span className="text-[10px] text-slate-500">Visible to Super Admins only</span>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
          <p className="text-xs text-slate-400">Loading platform product registry...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-4">
          <Package className="w-12 h-12 text-slate-600 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-white">No products found in registry</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Initialize the default Orviohub catalog with Inventory, Task Management, CRM, Booking, and Gym.
            </p>
          </div>
          <button
            onClick={handleSeedDefaults}
            disabled={actionLoading}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Seed Default Applications</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => {
            const rawStatus = (p.status || "active").toLowerCase();
            const isDraft = rawStatus === "draft";
            const isComingSoon = rawStatus === "coming_soon" || rawStatus === "beta";
            const isActive = rawStatus === "active";

            return (
              <div
                key={p._id || p.key}
                className={`p-6 rounded-2xl border shadow-xl flex flex-col justify-between space-y-5 transition-all ${
                  isDraft
                    ? "bg-slate-950/60 border-slate-800/60 opacity-80"
                    : isComingSoon
                    ? "bg-slate-900/80 border-amber-500/20"
                    : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center border font-bold text-sm ${
                          isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : isComingSoon
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-slate-800/40 text-slate-400 border-slate-700/40"
                        }`}
                      >
                        {p.name?.charAt(0) || "P"}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-white truncate max-w-[170px]">{p.name}</h3>
                          {p.isBeta && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              BETA
                            </span>
                          )}
                          {p.isFeatured && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              FEATURED
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">key: {p.key}</p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isActive
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : isComingSoon
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {rawStatus.replace("_", " ")}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{p.description}</p>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Target Host:</span>
                    <span className="font-mono text-slate-300 text-[11px]">{p.subdomain || `${p.key}.orviohub.com`}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Display Order:</span>
                    <span className="font-bold text-slate-200">#{p.displayOrder ?? 99}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/40">
                    <button
                      onClick={() => handleOpenWaitlist(p)}
                      className="text-xs text-slate-400 hover:text-amber-300 flex items-center gap-1.5 transition"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-400" />
                      <span>Waitlist</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>

                      {!isDraft ? (
                        <button
                          onClick={() => handleArchive(p)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-rose-400 text-xs transition"
                          title="Archive to Draft"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDelete(p)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs transition"
                          title="Delete Draft"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(isCreateModalOpen || editingProduct) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Package className="w-5 h-5 text-brand-400" />
                <h2 className="text-lg font-bold text-white">
                  {editingProduct ? `Edit ${editingProduct.name}` : "Create New SaaS Product"}
                </h2>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingProduct(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Gym Management"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Product Key (Slug)</label>
                  <input
                    type="text"
                    disabled={Boolean(editingProduct)}
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    placeholder="e.g. gym"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 text-xs disabled:opacity-60 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Summarize product capabilities, target workflows, and key features..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 text-xs resize-none"
                />
              </div>

              {/* Visibility Status Selector */}
              <div className="space-y-2 pt-1">
                <label className="text-slate-300 font-semibold block">Visibility State</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label
                    className={`p-3 rounded-xl border flex flex-col gap-1 cursor-pointer transition ${
                      formData.status === "active"
                        ? "bg-emerald-500/10 border-emerald-500 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="status"
                        value="active"
                        checked={formData.status === "active"}
                        onChange={() => setFormData({ ...formData, status: "active" })}
                        className="accent-emerald-500"
                      />
                      <span className="font-bold text-emerald-400">Active</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">Visible & ready to activate</span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex flex-col gap-1 cursor-pointer transition ${
                      formData.status === "coming_soon"
                        ? "bg-amber-500/10 border-amber-500 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="status"
                        value="coming_soon"
                        checked={formData.status === "coming_soon"}
                        onChange={() => setFormData({ ...formData, status: "coming_soon" })}
                        className="accent-amber-500"
                      />
                      <span className="font-bold text-amber-400">Coming Soon</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">Badge + Waitlist subscription</span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex flex-col gap-1 cursor-pointer transition ${
                      formData.status === "draft"
                        ? "bg-slate-800 border-slate-600 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="status"
                        value="draft"
                        checked={formData.status === "draft"}
                        onChange={() => setFormData({ ...formData, status: "draft" })}
                        className="accent-slate-500"
                      />
                      <span className="font-bold text-slate-300">Draft</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">Hidden from all regular users</span>
                  </label>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.isBeta}
                    onChange={(e) => setFormData({ ...formData, isBeta: e.target.checked })}
                    className="rounded border-slate-700 accent-brand-500 w-4 h-4"
                  />
                  <span>Show "BETA" Tag</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    className="rounded border-slate-700 accent-brand-500 w-4 h-4"
                  />
                  <span>Feature in App Launcher</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Display Order</label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold">Custom Subdomain</label>
                  <input
                    type="text"
                    value={formData.subdomain}
                    onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                    placeholder="e.g. gym.orviohub.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition flex items-center gap-2 shadow-lg shadow-brand-600/30 disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingProduct ? "Save Changes" : "Create Product"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Waitlist Modal */}
      {waitlistProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6 max-h-[85vh] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-base font-bold text-white">{waitlistProduct.name} — Waitlist</h2>
                  <p className="text-[11px] text-slate-400">Subscribers who requested launch notifications</p>
                </div>
              </div>
              <button
                onClick={() => setWaitlistProduct(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {waitlistLoading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                  <p className="text-xs text-slate-400">Loading waitlist entries...</p>
                </div>
              ) : waitlistEntries.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No users have joined the waitlist for this product yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 px-2 flex justify-between">
                    <span>Subscriber Email ({waitlistEntries.length})</span>
                    <span>Date Joined</span>
                  </div>
                  {waitlistEntries.map((e) => (
                    <div
                      key={e._id || e.email}
                      className="px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <span className="font-mono text-slate-200">{e.email}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(e.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-400 font-medium">
                Total Subscribers: <strong className="text-white">{waitlistEntries.length}</strong>
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setWaitlistProduct(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs transition"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handleExportWaitlist}
                  disabled={waitlistEntries.length === 0}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        confirmLabel={dialogConfig.confirmLabel}
        isDestructive={dialogConfig.isDestructive}
        isLoading={actionLoading}
        onConfirm={dialogConfig.action}
        onCancel={() => setDialogConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Products;
