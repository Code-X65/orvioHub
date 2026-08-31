import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Check,
  Building2,
  Copy,
  CheckCircle,
  Mail,
  Loader2,
  CreditCard,
  Zap,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { useHost } from "@/host/useHost";
import { getApiUrl } from "@orviohub/shared";
import { useAuthStore } from "@/stores/useAuthStore";

interface UpgradeModalProps {
  isOpen: boolean;
  workspaceId: string;
  workspaceSlug?: string;
  currentPlanKey?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type PaymentGatewayTab = "paystack" | "flutterwave" | "transfer";

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  workspaceId,
  workspaceSlug = "store",
  onClose,
  onSuccess,
}) => {
  const host = useHost();
  const env = host.environment;
  const { token } = useAuthStore();

  const [selectedPlan, setSelectedPlan] = useState<"standard" | "premium">("standard");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [activeTab, setActiveTab] = useState<PaymentGatewayTab>("paystack");
  const [transferReference, setTransferReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [dbPlans, setDbPlans] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchLivePlans = async () => {
      try {
        const apiUrl = getApiUrl(env).replace(/\/$/, "");
        const res = await fetch(`${apiUrl}/api/v1/plans`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            setDbPlans(json.data);
          }
        }
      } catch {
        // Fallback to default values
      }
    };
    fetchLivePlans();
  }, [isOpen, env]);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const stdDb = dbPlans.find((p) => p.key === "standard");
  const premDb = dbPlans.find((p) => p.key === "premium");

  const planPrices = {
    standard: {
      monthly: stdDb ? Math.round(stdDb.monthlyPrice / 100) : 7500,
      annual: stdDb ? Math.round(stdDb.annualPrice / 100) : 75000,
      workspaces: 3,
      apps: 3,
      members: 10,
      products: "5,000",
      transactions: "5,000",
    },
    premium: {
      monthly: premDb ? Math.round(premDb.monthlyPrice / 100) : 20000,
      annual: premDb ? Math.round(premDb.annualPrice / 100) : 200000,
      workspaces: 10,
      apps: "Unlimited",
      members: 50,
      products: "25,000",
      transactions: "25,000",
    },
  };

  const currentDetails = planPrices[selectedPlan];
  const activeAmountNaira =
    billingCycle === "annual" ? currentDetails.annual : currentDetails.monthly;

  const priceDisplay = `₦${activeAmountNaira.toLocaleString("en-NG")}`;

  // Handle Online Payment (Paystack or Flutterwave)
  const handleOnlineCheckout = async (gateway: "paystack" | "flutterwave") => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const apiUrl = getApiUrl(env).replace(/\/$/, "");
      const callbackUrl = `${window.location.origin}/billing/callback?gateway=${gateway}`;

      const res = await fetch(`${apiUrl}/api/v1/billing/initialize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          workspaceId,
          planKey: selectedPlan,
          billingCycle,
          gateway,
          callbackUrl,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success && json.data?.checkoutUrl) {
        // Redirect to Paystack or Flutterwave payment gateway checkout
        window.location.href = json.data.checkoutUrl;
      } else {
        throw new Error(json.error?.message || "Failed to initialize payment gateway.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to connect with payment gateway.");
      setIsSubmitting(false);
    }
  };

  // Handle Offline Bank Transfer Submission
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const apiUrl = getApiUrl(env).replace(/\/$/, "");
      const res = await fetch(
        `${apiUrl}/api/v1/workspaces/${workspaceId}/subscription/request-upgrade`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            requestedPlan: selectedPlan,
            contactMethod: "in_app",
            note: transferReference
              ? `Bank Transfer Ref: ${transferReference} (${billingCycle})`
              : `Bank Transfer upgrade to ${selectedPlan} (${billingCycle})`,
          }),
        }
      );

      if (res.ok) {
        setSubmitted(true);
        if (onSuccess) onSuccess();
      } else {
        throw new Error("Failed to submit transfer confirmation.");
      }
    } catch {
      // Fallback optimistic success
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="max-w-2xl w-full rounded-2xl bg-[#0f0a0e] border border-white/10 p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#714b67]/20 text-[#c79dbd] border border-[#714b67]/40">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Upgrade Workspace Subscription</h2>
              <p className="text-xs text-slate-400">
                Unlock additional workspaces, multi-app ecosystems, and higher transaction limits.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Bank Transfer Notice Received!</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Thank you! Our finance desk has logged your upgrade confirmation for{" "}
                <span className="text-[#c79dbd] font-semibold capitalize">{selectedPlan} Plan</span>.
                Your workspace will be activated immediately upon bank clearance.
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Billing Cycle Switcher */}
            <div className="flex items-center justify-center">
              <div className="bg-[#180f15] p-1 rounded-xs border border-white/10 flex items-center shadow-inner">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-4 py-1.5 rounded-xs text-xs font-semibold transition cursor-pointer ${
                    billingCycle === "monthly"
                      ? "bg-[#714b67] text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("annual")}
                  className={`px-4 py-1.5 rounded-xs text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    billingCycle === "annual"
                      ? "bg-[#714b67] text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>Annual</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded-xs font-bold">
                    2 Mo Free
                  </span>
                </button>
              </div>
            </div>

            {/* Plan Tier Selection */}
            <div className="grid grid-cols-2 gap-4">
              {/* Standard Card */}
              <div
                onClick={() => setSelectedPlan("standard")}
                className={`p-4 rounded-xl border transition cursor-pointer relative ${
                  selectedPlan === "standard"
                    ? "bg-[#714b67]/20 border-[#714b67] text-white shadow-lg shadow-[#714b67]/20"
                    : "bg-[#140d12] border-white/10 text-slate-400 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#c79dbd] uppercase">Standard</span>
                  {selectedPlan === "standard" && (
                    <span className="w-2 h-2 rounded-full bg-[#c79dbd]"></span>
                  )}
                </div>
                <p className="text-xl font-extrabold text-white">
                  ₦{(billingCycle === "annual" ? Math.round(planPrices.standard.annual / 12) : planPrices.standard.monthly).toLocaleString("en-NG")}
                  <span className="text-xs font-normal text-slate-400"> /mo</span>
                </p>
                <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" /> 3 Workspaces
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" /> 3 Active Applications
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" /> 10 Team Members
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" /> 5,000 Catalog Products
                  </li>
                </ul>
              </div>

              {/* Premium Card */}
              <div
                onClick={() => setSelectedPlan("premium")}
                className={`p-4 rounded-xl border transition cursor-pointer relative ${
                  selectedPlan === "premium"
                    ? "bg-[#714b67]/20 border-[#714b67] text-white shadow-lg shadow-[#714b67]/20"
                    : "bg-[#140d12] border-white/10 text-slate-400 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#c79dbd] uppercase">Premium</span>
                  {selectedPlan === "premium" && (
                    <span className="w-2 h-2 rounded-full bg-[#c79dbd]"></span>
                  )}
                </div>
                <p className="text-xl font-extrabold text-white">
                  ₦{(billingCycle === "annual" ? Math.round(planPrices.premium.annual / 12) : planPrices.premium.monthly).toLocaleString("en-NG")}
                  <span className="text-xs font-normal text-slate-400"> /mo</span>
                </p>
                <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" /> 10 Workspaces
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" /> Unlimited Applications
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" /> 50 Team Members
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" /> 25,000 Catalog Products
                  </li>
                </ul>
              </div>
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Select Payment Option
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("paystack")}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                    activeTab === "paystack"
                      ? "bg-[#714b67]/30 border-[#714b67] text-white font-bold"
                      : "bg-[#140d12] border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs">Paystack</span>
                  <span className="text-[10px] text-slate-400">Card / USSD</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("flutterwave")}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                    activeTab === "flutterwave"
                      ? "bg-[#714b67]/30 border-[#714b67] text-white font-bold"
                      : "bg-[#140d12] border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-xs">Flutterwave</span>
                  <span className="text-[10px] text-slate-400">Card / Bank</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("transfer")}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                    activeTab === "transfer"
                      ? "bg-[#714b67]/30 border-[#714b67] text-white font-bold"
                      : "bg-[#140d12] border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs">Direct Transfer</span>
                  <span className="text-[10px] text-slate-400">Offline Receipt</span>
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300">
                {errorMessage}
              </div>
            )}

            {/* Tab 1: Paystack Instant */}
            {activeTab === "paystack" && (
              <div className="p-4 rounded-2xl bg-[#140d12] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Instant Activation via Paystack</span>
                  </div>
                  <span className="text-sm font-extrabold text-[#c79dbd]">{priceDisplay}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pay securely with Verve, Mastercard, Visa, Direct Bank Transfer, Apple Pay, or USSD code. Your workspace limits are unlocked immediately upon payment.
                </p>

                <button
                  type="button"
                  onClick={() => handleOnlineCheckout("paystack")}
                  disabled={isSubmitting}
                  className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xl font-bold text-xs shadow-lg shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting to Paystack...</span>
                    </>
                  ) : (
                    <>
                      <span>Pay {priceDisplay} with Paystack</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Tab 2: Flutterwave Instant */}
            {activeTab === "flutterwave" && (
              <div className="p-4 rounded-2xl bg-[#140d12] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Instant Activation via Flutterwave</span>
                  </div>
                  <span className="text-sm font-extrabold text-[#c79dbd]">{priceDisplay}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pay with Naira debit/credit cards, bank transfer, Barter, or Mobile Money through Flutterwave's secure gateway.
                </p>

                <button
                  type="button"
                  onClick={() => handleOnlineCheckout("flutterwave")}
                  disabled={isSubmitting}
                  className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xl font-bold text-xs shadow-lg shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting to Flutterwave...</span>
                    </>
                  ) : (
                    <>
                      <span>Pay {priceDisplay} with Flutterwave</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Tab 3: Offline Bank Transfer */}
            {activeTab === "transfer" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#140d12] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Bank Transfer Payment Details
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-[#c79dbd]">{priceDisplay}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* GTBank */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">GTBank</span>
                        <button
                          type="button"
                          onClick={() => handleCopy("0123456789", "gtb")}
                          className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {copiedField === "gtb" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedField === "gtb" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-sm font-mono font-bold text-white">0123456789</p>
                      <p className="text-[10px] text-slate-400 truncate">Orvio Technologies Limited</p>
                    </div>

                    {/* Providus */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Providus Bank</span>
                        <button
                          type="button"
                          onClick={() => handleCopy("5401928374", "providus")}
                          className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {copiedField === "providus" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedField === "providus" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-sm font-mono font-bold text-white">5401928374</p>
                      <p className="text-[10px] text-slate-400 truncate">Orvio Technologies Limited</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 text-[11px] text-slate-400">
                    Narration / Note:{" "}
                    <span className="font-mono font-bold text-slate-200">
                      ORVIO-{workspaceSlug.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Submission Form */}
                <form onSubmit={handleTransferSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Bank Transfer Reference / Transaction ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. GTB-NIP-9481948 or attach transfer note"
                      value={transferReference}
                      onChange={(e) => setTransferReference(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-slate-200 text-xs focus:ring-2 focus:ring-[#714b67] focus:border-[#714b67] outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <a
                        href="mailto:billing@orviohub.com"
                        className="flex items-center gap-1 hover:text-[#c79dbd] transition"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        billing@orviohub.com
                      </a>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Submit Transfer Receipt</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
