import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Shield,
  Package,
  Loader2,
  Ban,
  Power,
  CreditCard,
  PlusCircle,
  Store,
  ClipboardList,
  CheckCircle,
  Clock,
  Trash2,
  Sliders,
  Palette,
  MapPin,
  Globe,
  FileText,
  UserCheck,
  Mail,
  Phone,
  Hash,
} from "lucide-react";
import { InventoryIcon } from "../components/icons/InventoryIcon";
import { useAuth } from "../hooks/useAuth";
import { adminOrganizationsApi } from "../api/adminOrganizations";
import { adminBillingApi, ManualPaymentRecord } from "../api/adminBilling";
import StatusBadge from "../components/StatusBadge";
import ConfirmDialog from "../components/ConfirmDialog";
import { RecordPaymentModal } from "../components/RecordPaymentModal";
import SuspendModal from "../components/SuspendModal";
import DeleteModal from "../components/DeleteModal";
import EmergencyTransferModal from "../components/EmergencyTransferModal";

export const OrganizationDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sessionToken, admin } = useAuth();
  const [data, setData] = useState<any>(null);
  const [fullSettings, setFullSettings] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "settings">("overview");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [manualPayments, setManualPayments] = useState<ManualPaymentRecord[]>([]);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isExtendTrialOpen, setIsExtendTrialOpen] = useState(false);
  const [extensionDays, setExtensionDays] = useState(14);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEmergencyTransferOpen, setIsEmergencyTransferOpen] = useState(false);

  const handleExtendTrial = async () => {
    if (!id || !sessionToken || !org) return;
    setActionLoading(true);
    try {
      await adminOrganizationsApi.extendTrial(sessionToken, org.id, extensionDays);
      await loadDetails();
      setIsExtendTrialOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to extend trial.");
    } finally {
      setActionLoading(false);
    }
  };

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

  const loadDetails = async () => {
    if (!id || !sessionToken) return;
    try {
      const [res, payments, settingsRes] = await Promise.all([
        adminOrganizationsApi.getOrganizationDetails(sessionToken, id),
        adminBillingApi.listManualPayments(id),
        adminOrganizationsApi.getFullSettings(sessionToken, id).catch(() => null),
      ]);
      setData(res);
      setManualPayments(payments || []);
      setFullSettings(settingsRes);
    } catch (err) {
      console.error("Failed to load organization details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [sessionToken, id]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
        <p className="text-xs text-slate-400">Loading organization topology and configuration...</p>
      </div>
    );
  }

  if (!data?.organization) {
    return (
      <div className="py-24 text-center space-y-4">
        <p className="text-sm text-slate-400">Organization not found.</p>
        <Link
          to="/organizations"
          className="inline-flex items-center gap-2 text-xs text-brand-400 hover:text-brand-300"
        >
          <ArrowLeft className="w-4 h-4" /> Back to organizations
        </Link>
      </div>
    );
  }

  const org = data.organization;
  const owner = data.owner;
  const members = data.members || [];
  const products = data.products || [];
  const branches = data.branches || [];
  const onboardingAnswers = data.onboardingAnswers;
  const orgProfile = onboardingAnswers?.organizationProfile;
  const invOnboarding = onboardingAnswers?.inventoryOnboarding;

  const handleToggleProduct = (productKey: string, isCurrentlyActive: boolean) => {
    setDialogConfig({
      isOpen: true,
      title: isCurrentlyActive ? `Disable Product: ${productKey}` : `Enable Product: ${productKey}`,
      message: isCurrentlyActive
        ? `Disable ${productKey} for "${org.name}"? Workspace members will lose access immediately.`
        : `Activate ${productKey} for "${org.name}"?`,
      confirmLabel: isCurrentlyActive ? "Disable Product" : "Enable Product",
      isDestructive: isCurrentlyActive,
      action: async () => {
        setActionLoading(true);
        try {
          if (isCurrentlyActive) {
            await adminOrganizationsApi.disableProduct(sessionToken!, org.id, productKey);
          } else {
            await adminOrganizationsApi.enableProduct(sessionToken!, org.id, productKey);
          }
          await loadDetails();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleConfirmSuspend = async (formData: { reason: string; notes: string }) => {
    if (!sessionToken || !org) return;
    setActionLoading(true);
    try {
      await adminOrganizationsApi.suspendOrganization(sessionToken, org.id, formData.reason, formData.notes);
      setIsSuspendModalOpen(false);
      await loadDetails();
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async (options: any) => {
    if (!sessionToken || !org) return;
    setActionLoading(true);
    try {
      await adminOrganizationsApi.deleteOrganization(sessionToken, org.id, options);
      setIsDeleteModalOpen(false);
      navigate("/organizations");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmEmergencyTransfer = async (targetUserId: string, reason: string, ticketNumber?: string) => {
    if (!sessionToken || !org) return;
    setActionLoading(true);
    try {
      await adminOrganizationsApi.emergencyTransferOwnership(
        sessionToken,
        org.id,
        targetUserId,
        reason,
        ticketNumber
      );
      await loadDetails();
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = () => {
    setDialogConfig({
      isOpen: true,
      title: "Activate Organization",
      message: `Reactivate "${org.name}" and restore product and membership access?`,
      confirmLabel: "Activate",
      isDestructive: false,
      action: async () => {
        setActionLoading(true);
        try {
          await adminOrganizationsApi.restoreOrganization(sessionToken!, org.id);
          await loadDetails();
        } finally {
          setActionLoading(false);
          setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          to="/organizations"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Organizations
        </Link>

        <div className="flex items-center gap-2">
          {org.status === "active" ? (
            <button
              onClick={() => setIsSuspendModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Suspend</span>
            </button>
          ) : (
            <button
              onClick={handleActivate}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Activate</span>
            </button>
          )}

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Overview Card */}
      <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-brand-600 flex items-center justify-center font-bold text-2xl text-white shadow-lg shadow-indigo-600/30 shrink-0">
            {org.name?.charAt(0)?.toUpperCase() || "O"}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-white">{org.name}</h1>
              <StatusBadge status={org.status} size="sm" />
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Slug: /{org.slug} • Type: <span className="uppercase">{org.type}</span>
            </p>
            <p className="text-[11px] text-slate-500">
              Workspace ID: <span className="font-mono text-slate-400">{org.id}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Owner</span>
              {owner ? (
                <Link to={`/users/${owner.id}`} className="font-semibold text-brand-400 hover:underline block mt-0.5 truncate">
                  {owner.name}
                </Link>
              ) : (
                <span className="text-slate-400 block mt-0.5">Unassigned</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsEmergencyTransferOpen(true)}
              className="mt-2 text-[10px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <UserCheck className="w-3 h-3" />
              <span>Emergency Transfer</span>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Location</span>
            <span className="font-semibold text-slate-200 mt-0.5 block">
              {org.country || "Nigeria"} ({org.currency || "NGN"})
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Provisioned</span>
            <span className="font-semibold text-slate-200 mt-0.5 block">
              {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
            activeTab === "overview"
              ? "bg-brand-600/20 text-brand-300 border border-brand-500/30 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Topology & Billing</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
            activeTab === "settings"
              ? "bg-brand-600/20 text-brand-300 border border-brand-500/30 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Settings & Branding Inspector</span>
        </button>
      </div>

      {activeTab === "settings" ? (
        /* Settings & Configuration Inspector */
        <div className="space-y-6">
          {/* General & Structured Address Profile */}
          <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">General & Business Identity Settings</h2>
                <p className="text-xs text-slate-400">
                  Legal entity registration, tax compliance, and Nigerian structured address configuration.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-brand-400" />
                  Legal Registration
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-500">Legal Business Name</span>
                    <span className="font-semibold text-white">
                      {fullSettings?.settings?.legalName || org.name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-500">CAC / Registration No</span>
                    <span className="font-mono text-slate-200">
                      {fullSettings?.settings?.registrationNumber || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-500">Tax Identification (TIN)</span>
                    <span className="font-mono text-slate-200">
                      {fullSettings?.settings?.taxId || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Support Email
                    </span>
                    <span className="text-slate-200">
                      {fullSettings?.settings?.supportEmail || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Support Phone
                    </span>
                    <span className="font-mono text-slate-200">
                      {fullSettings?.settings?.supportPhone || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-400" />
                  Structured Nigerian Address
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-500">Street Address</span>
                    <span className="text-slate-200 text-right max-w-xs truncate">
                      {fullSettings?.settings?.address?.street || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-500">LGA (Local Govt)</span>
                    <span className="font-semibold text-white">
                      {fullSettings?.settings?.address?.lga || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-500">State / Region</span>
                    <span className="font-semibold text-white">
                      {fullSettings?.settings?.address?.state || org.state || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-500">Postal Code / Country</span>
                    <span className="text-slate-200">
                      {fullSettings?.settings?.address?.postalCode || "—"} • {fullSettings?.settings?.address?.country || org.country || "Nigeria"}
                    </span>
                  </div>
                  <div className="pt-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                      Full Formatted Line
                    </span>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300">
                      {fullSettings?.settings?.address?.formatted || "No formatted address string"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Brand Identity & Thermal Receipt Customization */}
          <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Brand Identity & POS Receipt Configuration</h2>
                <p className="text-xs text-slate-400">
                  Visual theme palette, brand logo assets, and 80mm thermal receipt templates.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Theme Palette & Brand Assets
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Primary Brand Color</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg border border-white/20 shadow-sm"
                        style={{ backgroundColor: fullSettings?.branding?.primaryColor || "#714b67" }}
                      />
                      <span className="font-mono text-xs font-semibold text-white">
                        {fullSettings?.branding?.primaryColor || "#714b67"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Accent Color</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg border border-white/20 shadow-sm"
                        style={{ backgroundColor: fullSettings?.branding?.accentColor || "#10b981" }}
                      />
                      <span className="font-mono text-xs font-semibold text-white">
                        {fullSettings?.branding?.accentColor || "#10b981"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Brand Logo</span>
                    {fullSettings?.branding?.logoUrl || org.logoUrl ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Uploaded & Active
                      </span>
                    ) : (
                      <span className="text-slate-500">Default Avatar</span>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Favicon Asset</span>
                    {fullSettings?.branding?.faviconUrl ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Custom Set
                      </span>
                    ) : (
                      <span className="text-slate-500">Standard</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Thermal Receipt Preview Box */}
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  80mm Thermal Receipt Header & Footer
                </h3>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-2">
                  <div className="text-center font-bold text-white border-b border-dashed border-slate-700 pb-2">
                    {fullSettings?.branding?.receiptHeader || org.name}
                  </div>
                  <div className="text-slate-500 text-[10px] py-2 text-center">
                    [... Sample Order #INV-0092 • 2 Items • Total ₦15,000 ...]
                  </div>
                  <div className="text-center text-[10px] text-slate-400 border-t border-dashed border-slate-700 pt-2 whitespace-pre-line">
                    {fullSettings?.branding?.receiptFooter || "Thank you for your business!"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Regional Localization & Global Defaults */}
          <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Localization & Regional Defaults</h2>
                <p className="text-xs text-slate-400">
                  ISO Currencies, IANA Timezones, and numbering sequence rules.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Base Currency</span>
                <p className="text-lg font-bold text-white">
                  {fullSettings?.settings?.currency || org.currency || "NGN"}
                  <span className="text-xs text-emerald-400 ml-1.5 font-normal">
                    ({(fullSettings?.settings?.currency || org.currency) === "USD" ? "$" : "₦"})
                  </span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase font-bold">IANA Timezone</span>
                <p className="text-sm font-bold text-white truncate">
                  {fullSettings?.settings?.timezone || org.timezone || "Africa/Lagos"}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Date Format</span>
                <p className="text-sm font-bold text-white font-mono">
                  {fullSettings?.settings?.dateFormat || "DD/MM/YYYY"}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Invoice Prefix</span>
                <p className="text-sm font-bold text-brand-300 font-mono">
                  {fullSettings?.settings?.invoicePrefix || "INV-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Standard Topology & Billing Overview */
        <>
          {/* Subscription & Plan Management Card */}
          <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Subscription & Plan Tier</h2>
                  <p className="text-xs text-slate-400">Current tier entitlements, plan limits, and manual overrides.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {data?.entitlements?.isFreeTrial && (
                  <button
                    onClick={() => setIsExtendTrialOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/20 transition cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Extend Trial
                  </button>
                )}

                <button
                  onClick={() => setIsRecordPaymentOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Record Payment
                </button>

                <span className="text-xs text-slate-400 font-medium">Change Tier:</span>
                <select
                  value={org.planId || "free_trial"}
                  onChange={async (e) => {
                    const newPlan = e.target.value;
                    setActionLoading(true);
                    try {
                      await adminOrganizationsApi.updateOrganizationPlan(sessionToken!, org.id, newPlan);
                      await loadDetails();
                    } catch (err: any) {
                      alert(err.message || "Failed to change plan.");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-brand-500 uppercase cursor-pointer"
                >
                  <option value="free_trial">Free Trial (30-Day Limit)</option>
                  <option value="standard">Standard (₦7,500/mo)</option>
                  <option value="premium">Premium (₦20,000/mo)</option>
                </select>
              </div>
            </div>

            {/* Free Trial Status & Entitlement Meters */}
            {data?.entitlements?.isFreeTrial && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/30 to-indigo-950/20 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      30-Day Free Trial Policy
                    </span>
                    {data.entitlements.daysRemaining !== null && (
                      <span className={`text-xs font-bold ${
                        data.entitlements.daysRemaining <= 3 ? "text-red-400 font-mono animate-pulse" : "text-amber-300 font-mono"
                      }`}>
                        {data.entitlements.daysRemaining} days remaining
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    Trial Limit: Maximum 1 Application and 1 Branch. Trial ends on{" "}
                    <span className="text-white font-semibold">
                      {data.entitlements.trialEndsAt ? new Date(data.entitlements.trialEndsAt).toLocaleDateString() : "—"}
                    </span>.
                  </p>
                </div>
                <button
                  onClick={() => setIsExtendTrialOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition shrink-0"
                >
                  + Extend Duration
                </button>
              </div>
            )}

            {/* Plan Limits & Live Resource Usage */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Active Apps</span>
                  {data?.entitlements?.isFreeTrial && (
                    <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded">
                      Limit: 1
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-white">
                  {data?.entitlements?.activeApplications ?? products.length}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    / {data?.entitlements?.isFreeTrial ? "1 max" : "unlimited"}
                  </span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Branches</span>
                  {data?.entitlements?.isFreeTrial && (
                    <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded">
                      Limit: 1
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-white">
                  {data?.entitlements?.activeBranches ?? branches.length}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    / {data?.entitlements?.isFreeTrial ? "1 max" : "unlimited"}
                  </span>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Team Members</span>
                <p className="text-xl font-bold text-white">{members.length} <span className="text-xs font-normal text-slate-400">members</span></p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] uppercase font-bold">Subscription Status</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase mt-1 ${
                  data?.entitlements?.isFreeTrial
                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}>
                  {data?.entitlements?.isFreeTrial ? "Trialing" : "Active Standard"}
                </span>
              </div>
            </div>

            {/* Owner's Other Organizations */}
            {data?.ownerOtherOrgs && data.ownerOtherOrgs.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Owner's Other Organizations ({data.ownerOtherOrgs.length})
                  </span>
                  <span className="text-[11px] text-slate-500">Enforcing: Max 1 Free Trial Org Per User</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {data.ownerOtherOrgs.map((o: any) => (
                    <div key={o.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <Link to={`/organizations/${o.id}`} className="font-medium text-white hover:text-brand-300">
                        {o.name}
                      </Link>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        o.isTrial ? "bg-purple-500/10 text-purple-300 border border-purple-500/20" : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                      }`}>
                        {o.planKey}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offline Payment History */}
            {manualPayments.length > 0 && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Offline Payment History ({manualPayments.length})
                  </h3>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Plan</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Method & Ref</th>
                        <th className="py-2.5 px-3">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {manualPayments.map((p) => (
                        <tr key={p._id || p.paymentReference} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3">
                            {new Date(p.paidAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-200 uppercase">{p.planKey}</span> ({p.billingCycle})
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                            ₦{(p.amount / 100).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-slate-200 capitalize">{p.paymentMethod.replace("_", " ")}</span>
                            <p className="text-[10px] text-slate-400 font-mono">{p.paymentReference}</p>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {p.recordedByName || "Admin"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Grid: Products & Members */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Enabled Products Control */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-brand-400" />
                  <h3 className="text-sm font-bold text-white">Product Activations ({products.length})</h3>
                </div>
              </div>

              <div className="space-y-3">
                {["inventory", "taskmanagement", "crm"].map((productKey) => {
                  const activeProd = products.find((p: any) => p.productKey === productKey);
                  const isActive = activeProd && (activeProd.status === "ACTIVE" || activeProd.status === "active");

                  return (
                    <div
                      key={productKey}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                          {productKey === "inventory" ? (
                            <InventoryIcon className="w-5 h-5" />
                          ) : (
                            <Package className="w-4 h-4 text-brand-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white uppercase">{productKey}</p>
                          <p className="text-[11px] text-slate-400">
                            {isActive
                              ? `Active since ${new Date(activeProd.activatedAt || Date.now()).toLocaleDateString()}`
                              : "Not activated for this workspace"}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleProduct(productKey, !!isActive)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                          isActive
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{isActive ? "Disable" : "Enable"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Workspace Members */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white">Team Members ({members.length})</h3>
              </div>

              {members.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No members found.</p>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {members.map((m: any) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <Link
                          to={`/users/${m.userId}`}
                          className="font-bold text-white hover:text-brand-400 transition"
                        >
                          {m.name}
                        </Link>
                        <p className="text-[11px] text-slate-400">{m.email}</p>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 font-bold text-[10px] border border-indigo-500/20">
                          {m.role}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-1">
                          Joined: {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Branches & Store Locations Table */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-bold text-white">Store Branches & Warehouse Locations ({branches.length})</h3>
              </div>
              <span className="text-xs text-slate-400">
                {branches.filter((b: any) => b.status === "active").length} Active Locations
              </span>
            </div>

            {branches.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No physical branch locations registered (Default single-store setup).
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/60 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Branch Name & Code</th>
                      <th className="py-2.5 px-4">Location (LGA / State)</th>
                      <th className="py-2.5 px-4">Address</th>
                      <th className="py-2.5 px-4">Contact</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {branches.map((b: any) => (
                      <tr key={b.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{b.name}</span>
                            {b.isPrimary && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px] font-bold">
                                Primary
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">Code: {b.code || "MAIN"}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-200">
                            {b.lga ? `${b.lga}, ` : ""}{b.state || org.state || "Nigeria"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                          {b.formattedAddress || b.address || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {b.phone || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={b.status || "active"} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Stored Onboarding Answers */}
          <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Stored Onboarding Responses</h2>
                  <p className="text-xs text-slate-400">
                    Read-only customer answers provided during Organization Profile creation and Inventory setup.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Organization Profile Answers */}
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Organization Profile
                  </h3>
                  {orgProfile ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle className="w-2.5 h-2.5" /> Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/40">
                      <Clock className="w-2.5 h-2.5" /> Pending / Skipped
                    </span>
                  )}
                </div>

                {orgProfile ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Business Type</span>
                      <span className="font-semibold text-slate-200 capitalize">
                        {orgProfile.businessType || "Not specified"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Branch Count Range</span>
                      <span className="font-semibold text-slate-200">
                        {orgProfile.branchCountRange ? `${orgProfile.branchCountRange} branches` : "Not specified"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Product / SKU Range</span>
                      <span className="font-semibold text-slate-200">
                        {orgProfile.productCountRange ? `${orgProfile.productCountRange} SKUs` : "Not specified"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Primary Users</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {orgProfile.primaryUsers?.length ? (
                          orgProfile.primaryUsers.map((u: string) => (
                            <span
                              key={u}
                              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-[10px] capitalize"
                            >
                              {u}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500">None specified</span>
                        )}
                      </div>
                    </div>
                    {orgProfile.completedAt && (
                      <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/60">
                        Completed on: {new Date(orgProfile.completedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-4">No organization profile answers recorded.</p>
                )}
              </div>

              {/* Inventory App Onboarding Answers */}
              <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Inventory App Questionnaire
                  </h3>
                  {invOnboarding ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      <CheckCircle className="w-2.5 h-2.5" /> Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/40">
                      <Clock className="w-2.5 h-2.5" /> Pending / Skipped
                    </span>
                  )}
                </div>

                {invOnboarding ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Previous Tracking Tools</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {invOnboarding.previousTools?.length ? (
                          invOnboarding.previousTools.map((t: string) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-[10px]"
                            >
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500">None specified</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Biggest Pain Points</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {invOnboarding.painPoints?.length ? (
                          invOnboarding.painPoints.map((p: string) => (
                            <span
                              key={p}
                              className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px]"
                            >
                              {p}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500">None specified</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Top Priority Features</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {invOnboarding.priorityFeatures?.length ? (
                          invOnboarding.priorityFeatures.map((f: string) => (
                            <span
                              key={f}
                              className="px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 text-brand-300 text-[10px]"
                            >
                              {f}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500">None specified</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Needs Multi-Branch</span>
                        <span className="font-semibold text-slate-200">
                          {invOnboarding.needsMultiBranch === true
                            ? "Yes"
                            : invOnboarding.needsMultiBranch === false
                            ? "No (Single Location)"
                            : "Not answered"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Team Software Comfort</span>
                        <span className="font-semibold text-slate-200 capitalize">
                          {invOnboarding.teamComfortLevel || "Not answered"}
                        </span>
                      </div>
                    </div>

                    {invOnboarding.completedAt && (
                      <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/60">
                        Completed on: {new Date(invOnboarding.completedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-4">No Inventory onboarding answers recorded.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal */}
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

      {/* Extend Trial Modal */}
      {isExtendTrialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Extend Free Trial</h3>
                  <p className="text-xs text-slate-400">Add days to "{org.name}" 30-day trial</p>
                </div>
              </div>
              <button
                onClick={() => setIsExtendTrialOpen(false)}
                className="text-slate-400 hover:text-white p-1 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Select Extension Period:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setExtensionDays(d)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      extensionDays === d
                        ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/30"
                        : "bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    +{d} Days
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <label className="text-[11px] text-slate-400 block mb-1">Custom Days:</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={extensionDays}
                  onChange={(e) => setExtensionDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p>• Retains the 1 App / 1 Branch Trial Quota.</p>
                <p>• Extends active application access without requiring immediate payment.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsExtendTrialOpen(false)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExtendTrial}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition flex items-center gap-1.5 cursor-pointer"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm +{extensionDays} Days</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        workspaceId={org.id}
        workspaceName={org.name}
        currentPlanKey={org.planId || "standard"}
        adminUserId={admin?.id || "admin_user"}
        onClose={() => setIsRecordPaymentOpen(false)}
        onSuccess={() => {
          loadDetails();
        }}
      />

      {/* Structured Suspend Organization Modal */}
      <SuspendModal
        isOpen={isSuspendModalOpen}
        targetType="organization"
        targetName={org.name}
        targetId={org.id}
        isLoading={actionLoading}
        onClose={() => setIsSuspendModalOpen(false)}
        onConfirm={handleConfirmSuspend}
      />

      {/* Structured Delete Organization Modal */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        targetType="organization"
        targetName={org.name}
        targetId={org.id}
        isLoading={actionLoading}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
      />

      {/* Emergency Ownership Recovery Modal */}
      <EmergencyTransferModal
        isOpen={isEmergencyTransferOpen}
        workspaceName={org.name}
        currentOwnerName={owner?.name}
        members={members}
        isLoading={actionLoading}
        onClose={() => setIsEmergencyTransferOpen(false)}
        onConfirm={handleConfirmEmergencyTransfer}
      />
    </div>
  );
};

export default OrganizationDetails;
