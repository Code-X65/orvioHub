import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export const ConfirmEmailChange: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { setAuthData } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Verification token is missing.');
      setLoading(false);
      return;
    }

    const confirm = async () => {
      try {
        const res = await api.post<{
          user: any;
          token: string;
        }>('/auth/email/confirm-change', { token });

        if (res.token && res.user) {
          localStorage.setItem('orvio_auth_token', res.token);
          setAuthData({
            user: res.user,
            token: res.token,
            onboarding: { status: 'COMPLETED', currentStep: 'COMPLETED' },
          });
        }
        setSuccess(true);
      } catch (err: any) {
        setError(err.message || 'Failed to verify email change. The link may have expired.');
      } finally {
        setLoading(false);
      }
    };

    confirm();
  }, [token, setAuthData]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10 text-center">
          {loading && (
            <div className="py-8 space-y-4">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
              <h2 className="text-xl font-semibold text-slate-100">Confirming Email Change</h2>
              <p className="text-sm text-slate-400">Please wait while we verify your new email address...</p>
            </div>
          )}

          {!loading && success && (
            <div className="py-6 space-y-5">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">Email Address Updated!</h2>
                <p className="text-sm text-slate-400 mt-2">
                  Your account email has been successfully updated and verified.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  onClick={() => navigate('/settings/profile')}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  <span>Go to Settings</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="py-6 space-y-5">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">Verification Failed</h2>
                <p className="text-sm text-rose-400 mt-2">{error}</p>
              </div>
              <div className="pt-2 space-y-2">
                <Link to="/login">
                  <Button className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200">
                    Return to Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
