import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { useHost } from '@/host/useHost';
import { getApiUrl, getLauncherUrl } from '@orviohub/shared';
import { useAuthStore } from '@/stores/useAuthStore';

export const BillingCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const host = useHost();
  const env = host.environment;
  const { token } = useAuthStore();

  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [planKey, setPlanKey] = useState<string>('standard');

  useEffect(() => {
    let isMounted = true;

    const verifyPayment = async () => {
      // Paystack sends 'reference' or 'trxref', Flutterwave sends 'tx_ref' or 'transaction_id'
      const reference =
        searchParams.get('reference') ||
        searchParams.get('trxref') ||
        searchParams.get('tx_ref') ||
        searchParams.get('transaction_id');

      const gateway =
        searchParams.get('gateway') ||
        (reference?.includes('flw') ? 'flutterwave' : 'paystack');

      if (!reference) {
        setStatus('failed');
        setErrorMessage('No payment reference found in callback URL.');
        return;
      }

      try {
        const apiUrl = getApiUrl(env).replace(/\/$/, '');
        const res = await fetch(
          `${apiUrl}/api/v1/billing/verify?reference=${encodeURIComponent(reference)}&gateway=${gateway}`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        const data = await res.json().catch(() => ({}));

        if (!isMounted) return;

        if (res.ok && data.success) {
          setStatus('success');
          if (data.data?.planKey) {
            setPlanKey(data.data.planKey);
          }
        } else {
          setStatus('failed');
          setErrorMessage(data.error?.message || 'Unable to verify payment status with payment gateway.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setStatus('failed');
        setErrorMessage(err.message || 'Network error while verifying payment.');
      }
    };

    verifyPayment();

    return () => {
      isMounted = false;
    };
  }, [searchParams, env, token]);

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white flex flex-col justify-between">
      <Header />

      <main className="flex-1 max-w-lg mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
        {status === 'verifying' && (
          <div className="p-8 rounded-sm bg-[#120b10] border border-white/10 w-full shadow-2xl animate-pulse">
            <Loader2 className="w-12 h-12 text-[#c79dbd] animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white font-serif mb-2">Verifying Your Payment</h2>
            <p className="text-xs text-slate-400">
              Connecting with payment gateway to confirm your subscription activation...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="p-8 rounded-sm bg-[#120b10] border border-emerald-500/30 w-full shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>

            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-xs mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              Payment Successful & Verified
            </div>

            <h2 className="text-2xl font-bold text-white font-serif mb-2">
              Workspace Upgraded!
            </h2>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Your subscription to the <strong className="text-white capitalize">{planKey} Plan</strong> is now active. All resource limits, applications, and team capabilities have been unlocked.
            </p>

            <Button
              onClick={() => {
                window.location.href = getLauncherUrl(env);
              }}
              className="w-full h-11 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs font-semibold text-xs shadow-lg shadow-[#714b67]/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Launch Your Applications</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {status === 'failed' && (
          <div className="p-8 rounded-sm bg-[#120b10] border border-rose-500/30 w-full shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-rose-950/80 border border-rose-500/40 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-rose-400" />
            </div>

            <h2 className="text-2xl font-bold text-white font-serif mb-2">Payment Incomplete</h2>
            <p className="text-xs text-rose-300 mb-6">
              {errorMessage || 'The payment could not be confirmed. Please check your bank or try again.'}
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/pricing')}
                className="flex-1 h-10 border-white/10 text-slate-300 hover:text-white rounded-xs text-xs cursor-pointer"
              >
                View Plans
              </Button>
              <Button
                onClick={() => {
                  window.location.href = getLauncherUrl(env);
                }}
                className="flex-1 h-10 bg-[#714b67] hover:bg-[#86597a] text-white rounded-xs text-xs cursor-pointer"
              >
                Back to Launcher
              </Button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Orvio Inc. • Secure Nigerian Naira payments with Paystack & Flutterwave.
      </footer>
    </div>
  );
};
