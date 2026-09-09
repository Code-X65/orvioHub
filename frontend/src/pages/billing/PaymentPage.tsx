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
  UploadCloud,
  FileCheck,
  Lock,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';

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
  const { user } = useAuthStore();

  const cycleParam = (searchParams.get('cycle') || 'monthly') as 'monthly' | 'annual';

  const [selectedPlan] = useState<'standard'>('standard');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(cycleParam);
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'bank_transfer'>('paystack');

  // Bank transfer submission state
  const [senderName, setSenderName] = useState(user?.name || '');
  const [transferRef, setTransferRef] = useState('');
  const [selectedBank] = useState(BANK_ACCOUNTS[0].bankName);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitializingPaystack, setIsInitializingPaystack] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

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

  const handlePaystackCheckout = async () => {
    setIsInitializingPaystack(true);
    try {
      const res: any = await api.post('/billing/initialize-checkout', {
        planKey: selectedPlan,
        billingInterval: billingCycle,
        gateway: 'paystack',
      });

      if (res?.data?.authorizationUrl) {
        window.location.href = res.data.authorizationUrl;
      } else {
        toast.error('Unable to retrieve payment gateway checkout URL.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment initialization failed.');
    } finally {
      setIsInitializingPaystack(false);
    }
  };

  const handleBankTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim()) {
      toast.error('Please enter the name on the sending bank account.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/billing/submit-bank-transfer', {
        planKey: selectedPlan,
        billingInterval: billingCycle,
        amount: amountNGN,
        senderName: senderName.trim(),
        reference: transferRef.trim() || uniqueRefCode,
        bankName: selectedBank,
        proofUrl: proofFile ? proofFile.name : undefined,
      });

      setSubmittedSuccess(true);
      toast.success('Transfer proof submitted! Your workspace has been activated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit transfer proof. Please try again.');
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xs bg-[#714b67]/20 border border-[#714b67]/30 text-[#c79dbd] text-xs font-semibold mb-3">
            <Lock className="w-3.5 h-3.5" />
            <span>Secure 256-Bit SSL Checkout</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white font-serif tracking-tight">
            Complete Subscription Payment
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Activate your Orviohub business plan. Fast instant online checkout or direct Nigerian bank transfer.
          </p>
        </div>

        {submittedSuccess ? (
          <div className="max-w-lg mx-auto p-8 rounded-sm bg-[#120b10] border border-emerald-500/30 text-center shadow-2xl animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white font-serif mb-2">Payment Proof Received!</h2>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Thank you, <strong>{senderName}</strong>. Our finance team will verify your transfer of{' '}
              <strong className="text-emerald-400">₦{amountNGN.toLocaleString('en-NG')}</strong> within 1-2 hours.
            </p>
            <div className="p-3 bg-[#0a0508] rounded-xs border border-white/5 text-[11px] text-slate-400 mb-6 text-left">
              <p>• Reference: <span className="font-mono text-white">{transferRef || uniqueRefCode}</span></p>
              <p>• Status: <span className="text-amber-400 font-semibold">Pending Review</span></p>
              <p>• Plan: <span className="text-white capitalize">{selectedPlan} ({billingCycle})</span></p>
            </div>
            <p className="text-xs text-slate-300 mb-6">
              You do not need to wait — your account has been unlocked so you can begin setting up your organization right now!
            </p>
            <Button
              onClick={() => navigate('/onboarding/organization')}
              className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs font-semibold cursor-pointer"
            >
              <span>Proceed to Workspace Setup</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left Column: Plan & Order Summary */}
            <div className="md:col-span-5 p-6 rounded-sm bg-[#120b10] border border-white/10 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider text-slate-400">
                  Order Summary
                </h3>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-white capitalize">Standard Organization Plan</h4>
                    <p className="text-xs text-slate-400 capitalize">Billed {billingCycle}</p>
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
                    className={`py-2 px-3 rounded-xs text-xs font-semibold border transition-all cursor-pointer ${
                      billingCycle === 'monthly'
                        ? 'bg-[#714b67] border-[#714b67] text-white'
                        : 'bg-[#160f14] border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    Monthly (₦7.5k/mo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('annual')}
                    className={`py-2 px-3 rounded-xs text-xs font-semibold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                      billingCycle === 'annual'
                        ? 'bg-[#714b67] border-[#714b67] text-white'
                        : 'bg-[#160f14] border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <span>Annual (₦75k/yr)</span>
                    <span className="text-[9px] text-emerald-300 font-bold">2 Months Free</span>
                  </button>
                </div>
              </div>

              {/* Inclusions */}
              <div className="pt-4 border-t border-white/5 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Full access to Inventory, Tasks & POS apps</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Multiple branch configuration</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Instant receipt generation & invoice dispatch</span>
                </div>
              </div>

              {/* Free Trial Switch Link */}
              <div className="pt-4 border-t border-white/5 text-center">
                <p className="text-xs text-slate-400">
                  Want to test the platform first?{' '}
                  <a
                    href="/onboarding?plan=free_trial"
                    className="text-[#c79dbd] hover:text-white font-semibold transition-colors underline"
                  >
                    Start Free Trial (₦0)
                  </a>
                </p>
              </div>
            </div>

            {/* Right Column: Payment Methods */}
            <div className="md:col-span-7 p-6 rounded-sm bg-[#120b10] border border-white/10 space-y-6">
              {/* Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-[#0c070a] p-1 rounded-xs border border-white/5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('paystack')}
                  className={`py-2 px-3 rounded-xs text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === 'paystack'
                      ? 'bg-[#714b67] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Card / Paystack</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank_transfer')}
                  className={`py-2 px-3 rounded-xs text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentMethod === 'bank_transfer'
                      ? 'bg-[#714b67] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Bank Transfer</span>
                </button>
              </div>

              {/* Paystack Tab View */}
              {paymentMethod === 'paystack' ? (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="p-4 rounded-xs bg-[#160f14] border border-white/5 space-y-2">
                    <p className="text-xs text-slate-200 font-semibold">Instant Automated Activation</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Pay securely with your Mastercard, Visa, Verve card, or make an instant virtual bank transfer via Paystack. Your plan is activated immediately upon successful payment.
                    </p>
                  </div>

                  <Button
                    onClick={handlePaystackCheckout}
                    disabled={isInitializingPaystack}
                    className="w-full h-12 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold rounded-xs cursor-pointer shadow-lg shadow-[#714b67]/20"
                  >
                    {isInitializingPaystack ? (
                      <Spinner size="sm" className="mr-2" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 mr-2 text-emerald-400" />
                    )}
                    Pay ₦{amountNGN.toLocaleString('en-NG')} with Paystack
                  </Button>

                  <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500">
                    <span>Secured by Paystack</span>
                    <span>•</span>
                    <span>PCI-DSS Compliant</span>
                    <span>•</span>
                    <span>CBN Licensed</span>
                  </div>
                </div>
              ) : (
                /* Bank Transfer Tab View */
                <form onSubmit={handleBankTransferSubmit} className="space-y-5 animate-in fade-in duration-150">
                  <div className="p-4 rounded-xs bg-[#160f14] border border-white/5 space-y-3">
                    <p className="text-xs font-semibold text-slate-200">Official Company Bank Accounts</p>
                    <div className="space-y-2">
                      {BANK_ACCOUNTS.map((acc) => (
                        <div
                          key={acc.accountNumber}
                          className="p-3 bg-[#0e080c] rounded-xs border border-white/5 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-semibold text-white">{acc.bankName}</div>
                            <div className="font-mono text-amber-300 font-bold tracking-wider text-sm mt-0.5">
                              {acc.accountNumber}
                            </div>
                            <div className="text-[11px] text-slate-400">{acc.accountName}</div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(acc.accountNumber, acc.accountNumber)}
                            className="h-8 px-2.5 text-xs text-[#c79dbd] hover:text-white"
                          >
                            {copiedAccount === acc.accountNumber ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 mr-1" />
                            )}
                            Copy
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="p-2.5 bg-amber-950/30 border border-amber-500/20 rounded-xs text-[11px] text-amber-200 flex items-start gap-2">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Please use Payment Reference: <strong className="font-mono text-white">{uniqueRefCode}</strong> as your transfer remark/narration.
                      </span>
                    </div>
                  </div>

                  {/* Submission Form */}
                  <div className="space-y-3 text-left">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-300">Sender Account Name</Label>
                      <Input
                        type="text"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="e.g. Chukwuemeka Adeleke"
                        required
                        className="h-9 bg-[#0e080c] border-white/10 text-white rounded-xs text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-300">Bank Transfer Reference / Session ID (Optional)</Label>
                      <Input
                        type="text"
                        value={transferRef}
                        onChange={(e) => setTransferRef(e.target.value)}
                        placeholder="e.g. 100004240904000123"
                        className="h-9 bg-[#0e080c] border-white/10 text-white rounded-xs text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-300">Upload Receipt / Screenshot (Optional)</Label>
                      <div className="p-3 border border-dashed border-white/15 rounded-xs bg-[#0e080c] text-center cursor-pointer hover:border-white/30 transition-all">
                        <input
                          type="file"
                          id="receipt-upload"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setProofFile(e.target.files[0]);
                            }
                          }}
                        />
                        <label htmlFor="receipt-upload" className="cursor-pointer block">
                          {proofFile ? (
                            <div className="flex items-center justify-center gap-2 text-xs text-emerald-400">
                              <FileCheck className="w-4 h-4" />
                              <span>{proofFile.name}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1 text-slate-400 text-xs">
                              <UploadCloud className="w-5 h-5 text-[#c79dbd]" />
                              <span>Click to attach payment screenshot</span>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || !senderName.trim()}
                    className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold rounded-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? <Spinner size="sm" className="mr-2" /> : null}
                    Submit Proof & Continue to Setup
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
