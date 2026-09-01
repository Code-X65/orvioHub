import React, { useState, useEffect } from 'react';
import { Bell, Check, Loader2, X, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export interface JoinWaitlistModalProps {
  productKey: string;
  productName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (productKey: string) => void;
}

export const JoinWaitlistModal: React.FC<JoinWaitlistModalProps> = ({
  productKey,
  productName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNotified, setIsNotified] = useState(false);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pre-fill email when user session changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail(user?.email || '');
      setIsNotified(false);
      setAlreadySubscribed(false);
      setErrorMessage(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await api.post<{
        alreadySubscribed?: boolean;
        message?: string;
      }>(`/products/${productKey}/notify`, {
        email: cleanEmail,
      });

      if (result?.alreadySubscribed) {
        setAlreadySubscribed(true);
        toast.info(`You're already on the list for ${productName}!`);
        onSuccess?.(productKey);
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setIsNotified(true);
        toast.success(`You'll be notified when ${productName} launches!`);
        onSuccess?.(productKey);
        setTimeout(() => {
          onClose();
          setIsNotified(false);
        }, 1800);
      }
    } catch (err: any) {
      const msg = err.message || 'Something went wrong. Please try again.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="max-w-md w-full bg-[#130b12] border border-amber-500/30 rounded-2xl shadow-2xl p-6 sm:p-7 space-y-5 relative animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Get Notified When {productName} Launches
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Join the early access priority waitlist
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informational reassurance */}
        <p className="text-xs text-slate-300 leading-relaxed">
          We'll send you an email as soon as <strong>{productName}</strong> becomes available for your organization. No spam, ever.
        </p>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-200">
              Email Address <span className="text-amber-400">*</span>
            </label>
            <Input
              type="email"
              required
              disabled={isSubmitting || isNotified}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="name@company.com"
              className="bg-black/60 border-white/15 text-white placeholder:text-slate-500 rounded-lg text-xs h-11 focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xs h-10 px-4 rounded-lg cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || isNotified || alreadySubscribed}
              className={`text-xs h-10 px-5 rounded-lg font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-md ${
                isNotified
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                  : alreadySubscribed
                  ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Joining...</span>
                </>
              ) : isNotified ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>✓ Notified</span>
                </>
              ) : alreadySubscribed ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Already on List</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  <span>Notify Me</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
