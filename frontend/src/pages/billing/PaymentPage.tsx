import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  CreditCard,
  Building2,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
  FileCheck,
  Lock,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { api } from '@/lib/api';
import { openPaystackPopup } from '@/lib/payment';
import { getHomeUrl } from '@/lib/domain';

const BANK_ACCOUNTS = [
  {
    bankName: 'Providus Bank',
    accountNumber: '0123456789',
    accountName: 'Orvio Technologies Nigeria Ltd',
    sortCode: '101',
  },
  {
    bankName: 'Guaranty Trust Bank (GTBank)',
    accountNumber: '0987654321',
    accountName: 'Orvio Technologies Ltd',
    sortCode: '058',
  },
];

export const PaymentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshSession } = useAuthStore();
  const { invalidateCache, fetchWorkspaces, selectWorkspace } = useWorkspaceStore();

  const orgId = searchParams.get('orgId') || searchParams.get('org') || searchParams.get('organizationId');
  const orgName = searchParams.get('orgName') || 'Your Business';
  const cycleParam = (searchParams.get('cycle') || 'monthly') as 'monthly' | 'annual';

  const [selectedPlan] = useState<'standard'>('standard');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(cycleParam);
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'bank_transfer'>('paystack');

  // Paystack and payment processing states
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Bank transfer submission state
  const [senderName, setSenderName] = useState(user?.name || '');
  const [transferRef, setTransferRef] = useState('');
  const [selectedBank] = useState(BANK_ACCOUNTS[0].bankName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSwitchingPlan, setIsSwitchingPlan] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState<string | null>(null);
  const [confirmedPaymentRef, setConfirmedPaymentRef] = useState<string>('');

  // Pricing calculations (Standard: ₦7,500/mo or ₦75,000/yr)
  const prices = {
    standard: {
      monthly: 7500,
      annual: 75000,
    },
  };

  const amountNGN = prices[selectedPlan][billingCycle];
  const uniqueRefCode = `ORV-PAY-${(user?.id || 'USER').slice(-6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(key);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  const handlePaystackPopupPayment = async () => {
    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      const email = user?.email || 'customer@orvio.io';
      await openPaystackPopup({
        email,
        amountInNaira: amountNGN,
        planName: `Orviohub Standard Plan (${billingCycle})`,
        onSuccess: async (verifiedRef: string) => {
          try {
            setConfirmedPaymentRef(verifiedRef);
            let res: any = null;

            if (orgId) {
              res = await api.post('/billing/confirm-org-payment', {
                organizationId: orgId,
                paymentReference: verifiedRef,
                provider: 'paystack',
                amount: amountNGN,
                billingInterval: billingCycle,
              });
            } else {
              res = await api.post('/billing/verify', {
                reference: verifiedRef,
                planKey: 'standard',
                billingInterval: billingCycle,
              });
            }

            const invId = res?.data?.invoiceId || res?.invoiceId || orgId;
            const invNum = res?.data?.invoiceNumber || res?.invoiceNumber || 'INV-000001';
            setCreatedInvoiceId(invId);
            setCreatedInvoiceNumber(invNum);

            // Invalidate frontend cache and re-fetch active workspace
            invalidateCache();
            await fetchWorkspaces(undefined, undefined, true);
            await refreshSession();

            if (orgId) {
              try {
                localStorage.setItem('orvio_active_workspace_id', orgId);
                await selectWorkspace(orgId).catch(() => {});
              } catch {}
            }

            setSubmittedSuccess(true);
            toast.success(`Payment of ₦${amountNGN.toLocaleString('en-NG')} confirmed! "${orgName}" is now active on Standard Plan.`);
          } catch (backendErr: any) {
            const errorMsg = backendErr?.message || 'Payment confirmation failed. Please contact support.';
            setPaymentError(errorMsg);
            toast.error(errorMsg);
          } finally {
            setIsProcessingPayment(false);
          }
        },
        onClose: () => {
          setIsProcessingPayment(false);
          toast.info('Paystack checkout was closed.');
        },
      });
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to initialize Paystack checkout.';
      setPaymentError(errorMsg);
      toast.error(errorMsg);
      setIsProcessingPayment(false);
    }
  };

  const handleSwitchToFreeTrial = async () => {
    if (!orgId) {
      navigate('/onboard/organization');
      return;
    }

    setIsSwitchingPlan(true);
    try {
      await api.post('/billing/switch-org-plan', {
        organizationId: orgId,
        newPlanKey: 'free_trial',
      });

      invalidateCache();
      await fetchWorkspaces(undefined, undefined, true);
      await refreshSession();
      toast.success(`Switched "${orgName}" to 30-Day Free Trial! Redirecting to dashboard...`);
      try {
        localStorage.setItem('orvio_active_workspace_id', orgId);
      } catch {}

      setTimeout(() => {
        window.location.href = getHomeUrl();
      }, 700);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to switch to Free Trial. You may already have a Free Trial organization.');
    } finally {
      setIsSwitchingPlan(false);
    }
  };

  const handleBankTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim()) {
      toast.error('Please enter the name on the sending bank account.');
      return;
    }

    setIsSubmitting(true);
    setPaymentError(null);
    const ref = transferRef.trim() || uniqueRefCode;
    setConfirmedPaymentRef(ref);

    try {
      let res: any = null;
      if (orgId) {
        res = await api.post('/billing/confirm-org-payment', {
          organizationId: orgId,
          paymentReference: ref,
          provider: 'bank_transfer',
          amount: amountNGN,
          billingInterval: billingCycle,
        });
      } else {
        res = await api.post('/billing/submit-bank-transfer', {
          planKey: selectedPlan,
          billingInterval: billingCycle,
          amount: amountNGN,
          senderName: senderName.trim(),
          reference: ref,
          bankName: selectedBank,
        });
      }

      const invId = res?.data?.invoiceId || res?.invoiceId || orgId;
      const invNum = res?.data?.invoiceNumber || res?.invoiceNumber || 'INV-000001';
      setCreatedInvoiceId(invId);
      setCreatedInvoiceNumber(invNum);

      invalidateCache();
      await fetchWorkspaces(undefined, undefined, true);
      await refreshSession();

      if (orgId) {
        try {
          localStorage.setItem('orvio_active_workspace_id', orgId);
          await selectWorkspace(orgId).catch(() => {});
        } catch {}
      }

      setSubmittedSuccess(true);
      toast.success(`Transfer details submitted! "${orgName}" has been activated.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit transfer details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white flex flex-col justify-between">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-12 w-full">
        {/* Step Header */}
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-xs font-semibold mb-3">
            <Lock className="w-3.5 h-3.5" />
            <span>Secure 256-Bit SSL Checkout • Paystack Verified</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Complete Payment for {orgName}
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Activate the Standard plan for your organization with instant Paystack checkout or direct Nigerian bank transfer.
          </p>
        </div>

        {/* Error Alert with Options */}
        {paymentError && (
          <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-rose-300">Payment Unsuccessful</p>
                <p className="text-xs text-rose-200/90 mt-0.5">{paymentError}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPaymentError(null)}
                className="border-rose-500/30 text-xs text-rose-200 hover:bg-rose-500/20"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                <span>Retry</span>
              </Button>
              {orgId && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSwitchToFreeTrial}
                  disabled={isSwitchingPlan}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  {isSwitchingPlan ? <Spinner className="w-3.5 h-3.5 mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                  <span>Switch to Free Trial</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {submittedSuccess ? (
          <div className="max-w-xl mx-auto p-8 rounded-2xl bg-[#120b10] border border-emerald-500/40 text-center shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight mb-1">Payment Confirmed!</h2>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Your organization <strong className="text-white">{orgName}</strong> is now activated on the <strong className="text-emerald-400">Standard Plan</strong> ({billingCycle}).
            </p>

            {/* Payment Summary Box */}
            <div className="p-4 bg-[#0a0508] rounded-xl border border-white/10 text-xs text-slate-300 mb-6 text-left space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-400 font-medium">Invoice Number</span>
                <span className="font-mono font-bold text-[#FDB02F]">{createdInvoiceNumber || 'INV-000001'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Organization</span>
                <span className="text-white font-medium">{orgName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Plan & Cycle</span>
                <span className="text-white font-medium capitalize">Standard ({billingCycle})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Amount Paid</span>
                <span className="text-white font-bold">₦{amountNGN.toLocaleString('en-NG')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Date</span>
                <span className="text-slate-300">{new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Reference</span>
                <span className="font-mono text-[11px] text-slate-300">{confirmedPaymentRef || uniqueRefCode}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <span className="text-slate-400">Payment Status</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>PAID</span>
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={getCrossSubdomainUrl('inventory', '/dashboard')}
                className="flex-1 h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-lg shadow-[#714b67]/30 flex items-center justify-center gap-2"
              >
                <span>Launch Inventory Workstation</span>
                <ArrowRight className="w-4 h-4 text-[#FDB02F]" />
              </a>

              <Button
                onClick={() => {
                  navigate(`/invoices/${createdInvoiceId || orgId}`);
                }}
                variant="outline"
                className="flex-1 h-11 border-[#714b67]/50 hover:border-[#714b67] bg-[#714b67]/10 hover:bg-[#714b67]/20 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                <FileCheck className="w-4 h-4 mr-2 text-[#FDB02F]" />
                <span>Download / View Invoice</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left Column: Plan & Order Summary */}
            <div className="md:col-span-5 p-6 rounded-2xl bg-[#120b10] border border-white/10 space-y-6">
              <div>
                <span className="text-xs font-semibold text-[#c79dbd] bg-[#714b67]/20 border border-[#714b67]/30 px-2.5 py-0.5 rounded-full">
                  Organization Subscription
                </span>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-white">{orgName}</h4>
                    <p className="text-xs text-slate-400 capitalize">Standard Plan • {billingCycle}</p>
                  </div>
                  <span className="text-xl font-extrabold text-white">
                    ₦{amountNGN.toLocaleString('en-NG')}
                  </span>
                </div>
              </div>

              {/* Billing Cycle Switcher */}
              <div className="pt-2 border-t border-white/5 space-y-3">
                <Label className="text-xs text-slate-300">Billing Cycle</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      billingCycle === 'monthly'
                        ? 'bg-[#714b67] border-[#714b67] text-white shadow-sm'
                        : 'bg-black/30 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    Monthly (₦7.5k/mo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                      billingCycle === 'annual'
                        ? 'bg-[#714b67] border-[#714b67] text-white shadow-sm'
                        : 'bg-black/30 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <span>Annual (₦75k/yr)</span>
                    <span className="text-[9px] text-emerald-300 font-bold">2 Months Free</span>
                  </button>
                </div>
              </div>

              {/* Inclusions */}
              <div className="pt-4 border-t border-white/5 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Full access to Inventory, POS & Tasks apps</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Multiple branch management & transfers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Up to 10 staff members with custom roles</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#FDB02F] shrink-0" />
                  <span>Priority support & audit logs</span>
                </div>
              </div>

              {/* Switch to Free Trial Option */}
              {orgId && (
                <div className="pt-4 border-t border-white/5 text-center">
                  <p className="text-xs text-slate-400">
                    Prefer to start with a trial first?{' '}
                    <button
                      type="button"
                      onClick={handleSwitchToFreeTrial}
                      disabled={isSwitchingPlan}
                      className="text-[#c79dbd] hover:text-white font-semibold transition-colors underline cursor-pointer inline-flex items-center gap-1"
                    >
                      {isSwitchingPlan ? <Spinner className="w-3 h-3 inline" /> : null}
                      <span>Switch to 30-Day Free Trial (₦0)</span>
                    </button>
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Payment Methods */}
            <div className="md:col-span-7 p-6 rounded-2xl bg-[#120b10] border border-white/10 space-y-6">
              {/* Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-black/50 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('paystack')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === 'paystack'
                      ? 'bg-[#714b67] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Pay with Paystack</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank_transfer')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === 'bank_transfer'
                      ? 'bg-[#714b67] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Bank Transfer</span>
                </button>
              </div>

              {/* Paystack Popup Checkout View */}
              {paymentMethod === 'paystack' && (
                <div className="space-y-5">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 text-xs text-emerald-300">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" /> Paystack Instant Checkout
                      </span>
                      <span className="font-mono text-[11px] bg-black/40 px-2.5 py-0.5 rounded border border-emerald-500/30 text-emerald-200">
                        ₦{amountNGN.toLocaleString('en-NG')}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                      Pay seamlessly with Mastercard, Visa, Verve, Bank Transfer, USSD, or Apple Pay via Paystack's official secure modal.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="text-slate-400">Account Billing Email:</span>
                      <span className="font-medium text-white font-mono">{user?.email || 'Your account email'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="text-slate-400">Total Charged:</span>
                      <span className="font-bold text-white text-sm">₦{amountNGN.toLocaleString('en-NG')}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-white/5 text-[11px] text-slate-400">
                      <Zap className="w-3.5 h-3.5 text-[#FDB02F] shrink-0" />
                      <span>Instant activation: your workspace and inventory become active immediately upon payment completion.</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handlePaystackPopupPayment}
                    disabled={isProcessingPayment}
                    className="w-full h-12 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xl text-sm font-bold cursor-pointer shadow-lg shadow-[#714b67]/30 transition-all hover:scale-[1.01]"
                  >
                    {isProcessingPayment ? (
                      <>
                        <Spinner className="w-4 h-4 mr-2" />
                        <span>Opening Paystack Checkout...</span>
                      </>
                    ) : (
                      <>
                        <span>Pay ₦{amountNGN.toLocaleString('en-NG')} with Paystack</span>
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Bank Transfer Form */}
              {paymentMethod === 'bank_transfer' && (
                <form onSubmit={handleBankTransferSubmit} className="space-y-4">
                  <div className="p-3.5 bg-black/40 border border-white/10 rounded-xl space-y-3">
                    <p className="text-xs text-slate-300 font-semibold">Make transfer to any of our designated bank accounts:</p>
                    {BANK_ACCOUNTS.map((acc, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-white">{acc.bankName}</p>
                          <p className="text-xs font-mono text-[#FDB02F] tracking-wider">{acc.accountNumber}</p>
                          <p className="text-[10px] text-slate-400">{acc.accountName}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(acc.accountNumber, `acc_${idx}`)}
                          className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedAccount === `acc_${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedAccount === `acc_${idx}` ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-200">Sender Name on Bank Account</Label>
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="e.g. Adeola Olawale"
                      className="bg-black/40 border-white/10 text-white"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-200">Transaction Reference (Optional)</Label>
                    <Input
                      value={transferRef}
                      onChange={(e) => setTransferRef(e.target.value)}
                      placeholder={uniqueRefCode}
                      className="bg-black/40 border-white/10 text-white font-mono"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-[#714b67]/30"
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner className="w-4 h-4 mr-2" />
                        <span>Submitting Transfer Proof...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Transfer Proof & Activate</span>
                        <ArrowRight className="w-4 h-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
