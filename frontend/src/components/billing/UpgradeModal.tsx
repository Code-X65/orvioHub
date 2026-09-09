import React, { useState } from "react";
import {
  X,
  Sparkles,
  Check,
  Building2,
  Copy,
  CheckCircle,
  Mail,
  Loader2,
  Zap,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { useHost } from "@/host/useHost";
import { getApiUrl } from "@orviohub/shared";
import { useAuthStore } from "@/stores/useAuthStore";
import { openPaystackPopup } from "@/lib/payment";
import { toast } from "sonner";

interface UpgradeModalProps {
  isOpen: boolean;
  workspaceId?: string;
  workspaceSlug?: string;
  currentPlanKey?: string;
  triggerReason?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type PaymentGatewayTab = "paystack" | "transfer";
type SelectedPlanTier = "standard";

export function getUpgradeMessage(triggerReason?: string) {
  switch (triggerReason) {
    case "workspace_limit":
      return "Your current plan includes 1 workspace. Upgrade to Standard for up to 3 organizations.";
    case "app_limit":
      return "Your Free plan includes 1 application. Upgrade to Standard for up to 3 applications.";
    case "branch_limit":
      return "Your current plan includes 1 branch. Upgrade to Standard for up to 3 branches per application.";
    case "member_limit":
      return "Your current plan includes 2 team members. Upgrade to Standard for up to 10 team members.";
    case "product_limit":
      return "You have reached your product catalogue limit (500). Upgrade to Standard for 5,000 products.";
    case "transaction_limit":
      return "You have reached your monthly transaction limit (500). Upgrade to Standard for 5,000 transactions/month.";
    default:
      return "Upgrade your organization plan to unlock more applications, branches, and higher quotas.";
  }
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  workspaceId = "",
  workspaceSlug = "store",
  currentPlanKey = "free_trial",
  triggerReason,
  onClose,
  onSuccess,
}) => {
  const host = useHost();
  const env = host.environment;
  const { token, user } = useAuthStore();

  const normalizedPlan = (currentPlanKey || "free_trial").toLowerCase();
  const isStandard = normalizedPlan === "standard";

  const [selectedPlan] = useState<SelectedPlanTier>("standard");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [paymentMethod, setPaymentMethod] = useState<PaymentGatewayTab>("paystack");
  const [transferReference, setTransferReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  if (isStandard) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
        <div className="max-w-md w-full rounded-2xl bg-[#0f0a0e] border border-white/10 p-6 md:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Standard Plan Active</h2>
                <p className="text-xs text-slate-400">Your organization is fully activated</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200">
              Your business is on the Standard Plan with access to 3 apps, 3 branches, and 10 members.
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              If you require custom capacity or enterprise volume beyond standard limits, please reach out to our team.
            </p>

            <div className="pt-2 flex flex-col gap-2.5">
              <a
                href="mailto:support@orviohub.com?subject=Enterprise%20Plan%20Inquiry"
                className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xl font-bold text-xs shadow-lg shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Mail className="w-4 h-4" />
                <span>Contact Support</span>
              </a>
              <button
                type="button"
                onClick={onClose}
                className="w-full h-10 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-semibold text-xs transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const planPricing = {
    standard: {
      monthly: 7500,
      annual: 75000,
      name: "Standard Plan",
      features: [
        "Up to 3 Applications",
        "Up to 3 Branches per app",
        "Up to 10 Team Members",
        "5,000 Products",
        "5,000 Tx / month",
        "Priority Support",
      ],
    },
  };

  const activePlanInfo = planPricing[selectedPlan];
  const activeAmount = activePlanInfo[billingInterval];
  const priceDisplay = `₦${activeAmount.toLocaleString("en-NG")}`;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePaystackCheckout = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const email = user?.email || "customer@orviohub.com";

    try {
      await openPaystackPopup({
        email,
        amountInNaira: activeAmount,
        planName: `${activePlanInfo.name} (${billingInterval === "annual" ? "Annual" : "Monthly"})`,
        onSuccess: async (verifiedRef) => {
          try {
            const apiUrl = getApiUrl(env).replace(/\/$/, "");
            await fetch(
              `${apiUrl}/api/v1/billing/verify?reference=${encodeURIComponent(verifiedRef)}&gateway=paystack&workspaceId=${encodeURIComponent(workspaceId)}&interval=${billingInterval}&plan=${selectedPlan}`,
              {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              }
            );
            toast.success(`Payment confirmed! Upgraded to ${activePlanInfo.name}.`);
            if (onSuccess) onSuccess();
            onClose();
          } catch {
            if (onSuccess) onSuccess();
            onClose();
          } finally {
            setIsSubmitting(false);
          }
        },
        onClose: () => {
          setIsSubmitting(false);
        },
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initialize Paystack checkout.");
      setIsSubmitting(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferReference.trim()) {
      toast.error("Please enter your bank transfer reference or transaction ID.");
      return;
    }

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
            billingInterval,
            paymentMethod: "bank_transfer",
            contactMethod: "in_app",
            note: `Bank Transfer Ref: ${transferReference.trim()} (${selectedPlan} ${billingInterval}) - ₦${activeAmount.toLocaleString()}`,
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
      setSubmitted(true);
      if (onSuccess) onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="max-w-xl w-full rounded-2xl bg-[#0f0a0e] border border-white/10 p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#714b67]/20 text-[#c79dbd] border border-[#714b67]/40">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {triggerReason ? "Limit Reached" : "Upgrade Your Subscription"}
              </h2>
              <p className="text-xs text-slate-400">
                Single subscription covering all your workspaces and business applications.
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

        {/* Tier-Specific Upgrade Prompt */}
        {isStandard ? (
          <div className="p-4 rounded-xl bg-[#140d12] border border-[#714b67]/40 space-y-3">
            <div className="flex items-start gap-2.5 text-xs text-slate-200">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold text-white">
                  You have reached the limit of your Standard plan (3 organizations, 3 apps, 3 branches).
                </p>
                <p className="text-slate-400 mt-1">Upgrade to Premium to unlock:</p>
                <ul className="mt-2 space-y-1 text-slate-300 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Up to 10 organizations
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Unlimited apps
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Up to 10 branches per app
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Up to 50 team members
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    25,000 products &amp; 25,000 transactions/month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Full suite of 10 business apps (CRM, Analytics, Invoicing, HR)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#140d12] border border-[#714b67]/40 space-y-3">
            <div className="flex items-start gap-2.5 text-xs text-slate-200">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold text-white">
                  You have reached the limit of your Free Trial plan (1 organization, 1 app, 1 branch).
                </p>
                <p className="text-slate-400 mt-1">Upgrade to Standard to unlock:</p>
                <ul className="mt-2 space-y-1 text-slate-300 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Up to 3 organizations
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Up to 3 apps per organization
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Up to 3 branches per app
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Up to 10 team members
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    5,000 products &amp; 5,000 transactions/month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Access to Booking and Gym apps
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Trigger Reason Specific Alert if distinct */}
        {triggerReason && !isStandard && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <span>{getUpgradeMessage(triggerReason)}</span>
          </div>
        )}

        {submitted ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Bank Transfer Notice Received!</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Thank you! Our finance team will verify your transfer reference (
                <span className="font-mono text-white">{transferReference}</span>) and activate your {activePlanInfo.name}.
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
            {/* Plan Tier Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                Selected Plan
              </label>
              <div className="p-3.5 rounded-xl border bg-[#714b67]/25 border-[#714b67] text-white shadow-md shadow-[#714b67]/15 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Standard Organization Plan</span>
                  <span className="text-[10px] bg-[#714b67]/40 text-white px-2 py-0.5 rounded-full font-bold">
                    Official Plan
                  </span>
                </div>
                <p className="text-base font-extrabold text-white mt-1">
                  ₦{billingInterval === "annual" ? "75,000" : "7,500"}
                  <span className="text-[10px] font-normal text-slate-400">
                    /{billingInterval === "annual" ? "yr" : "mo"}
                  </span>
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Up to 3 Apps • Up to 3 Branches per app • Up to 10 Members</p>
              </div>
            </div>

            {/* Selected Plan Features Overview */}
            <div className="p-4 rounded-xl bg-[#140d12] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#c79dbd] uppercase tracking-wider">
                    {activePlanInfo.name} Features
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                    Per-User Subscription
                  </span>
                </div>
                <span className="text-sm font-extrabold text-white">{priceDisplay}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                {activePlanInfo.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Billing Interval Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                Billing Interval
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setBillingInterval("monthly")}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                    billingInterval === "monthly"
                      ? "bg-[#714b67]/25 border-[#714b67] text-white shadow-md shadow-[#714b67]/15"
                      : "bg-[#140d12] border-white/10 text-slate-400 hover:border-white/20"
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold text-white">Monthly</p>
                    <p className="text-sm font-extrabold text-white mt-0.5">
                      ₦{activePlanInfo.monthly.toLocaleString()}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Billed monthly</span>
                </div>

                <div
                  onClick={() => setBillingInterval("annual")}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between relative ${
                    billingInterval === "annual"
                      ? "bg-[#714b67]/25 border-[#714b67] text-white shadow-md shadow-[#714b67]/15"
                      : "bg-[#140d12] border-white/10 text-slate-400 hover:border-white/20"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-white">Annual</p>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
                        Save 17%
                      </span>
                    </div>
                    <p className="text-sm font-extrabold text-white mt-0.5">
                      ₦{activePlanInfo.annual.toLocaleString()}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Billed yearly</span>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("paystack")}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1 ${
                    paymentMethod === "paystack"
                      ? "bg-[#714b67]/25 border-[#714b67] text-white shadow-md"
                      : "bg-[#140d12] border-white/10 text-slate-400 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Paystack</span>
                    <Zap className="w-3.5 h-3.5 text-[#00c3f7]" />
                  </div>
                  <span className="text-[10px] text-slate-400">Card, Bank Transfer, USSD (Instant)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("transfer")}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1 ${
                    paymentMethod === "transfer"
                      ? "bg-[#714b67]/25 border-[#714b67] text-white shadow-md"
                      : "bg-[#140d12] border-white/10 text-slate-400 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Bank Transfer</span>
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] text-slate-400">Manual verification (1-2 hours)</span>
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300">
                {errorMessage}
              </div>
            )}

            {/* Paystack Checkout View */}
            {paymentMethod === "paystack" && (
              <div className="p-4 rounded-xl bg-[#140d12] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Instant Activation via Paystack</span>
                  </div>
                  <span className="text-sm font-extrabold text-[#c79dbd]">{priceDisplay}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pay securely with Verve, Mastercard, Visa, Direct Bank Transfer, or USSD code. Your {activePlanInfo.name} limits unlock immediately across all your workspaces.
                </p>

                <button
                  type="button"
                  onClick={handlePaystackCheckout}
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

            {/* Bank Transfer View */}
            {paymentMethod === "transfer" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#140d12] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Bank Transfer Details
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

                <form onSubmit={handleTransferSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Bank Transfer Reference / Transaction ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. GTB-NIP-9481948 or session ID"
                      value={transferReference}
                      onChange={(e) => setTransferReference(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/10 text-slate-200 text-xs focus:ring-2 focus:ring-[#714b67] focus:border-[#714b67] outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <a
                        href="mailto:support@orviohub.com"
                        className="flex items-center gap-1 hover:text-[#c79dbd] transition"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        support@orviohub.com
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

            {/* Continue Without Upgrade Option */}
            <div className="pt-2 border-t border-white/5 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-200 transition py-1.5 px-3 rounded-lg hover:bg-white/5 cursor-pointer font-medium"
              >
                Continue Without Upgrade
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


