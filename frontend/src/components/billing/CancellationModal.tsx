import React, { useState } from 'react';
import { api } from '@/lib/api';
import {
  Ban,
  Calendar,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organizationId: string;
  organizationName: string;
  currentPlanName: string;
  currentPeriodEnd?: number;
}

export const CancellationModal: React.FC<CancellationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  organizationId,
  organizationName,
  currentPlanName,
  currentPeriodEnd,
}) => {
  const [reason, setReason] = useState<string>('');
  const [selectedReasonOption, setSelectedReasonOption] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const effectiveTimestamp = currentPeriodEnd || (Date.now() + 30 * 86_400_000);
  const formattedPeriodEnd = new Date(effectiveTimestamp).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const REASON_OPTIONS = [
    'Not using the service enough',
    'Switching to an alternative solution',
    'Temporary pause in business operations',
    'Subscription cost too high',
    'Missing required features',
    'Other reason',
  ];

  const handleConfirmCancellation = async () => {
    if (!organizationId) return;
    setIsSubmitting(true);

    const finalReason = [selectedReasonOption, reason.trim()].filter(Boolean).join(': ');
    const idempotencyKey = `idemp_cancel_${organizationId}_${Date.now()}`;

    try {
      await api.post(
        `/workspaces/${organizationId}/billing/cancel`,
        {
          cancelAtPeriodEnd: true,
          reason: finalReason || 'User requested subscription cancellation',
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      toast.success(
        `Cancellation scheduled for ${formattedPeriodEnd}. Paid access continues until then, and you can resume anytime before this date.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule subscription cancellation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="max-w-lg w-full bg-[#140d12] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-[#1c1219]/60 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Cancel Organization Subscription
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cancelling paid subscription for <span className="text-white font-medium">{organizationName}</span>.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition text-xs p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Retained Access Notice */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-300">
              <Calendar className="w-4 h-4" />
              <span>Full Access Continues Until {formattedPeriodEnd}</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Your {currentPlanName} features remain fully active through the end of your current billing period. No further renewal charges will be made.
            </p>
          </div>

          {/* Data Preservation Guarantee */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 space-y-1">
            <div className="flex items-center gap-2 font-bold text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero Data Loss Guarantee</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Your business records, invoices, sales, and products are never deleted. When expired, data remains safely preserved, and you can resume or upgrade at any time.
            </p>
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Please tell us why you are cancelling (optional)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {REASON_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setSelectedReasonOption(opt === selectedReasonOption ? '' : opt)}
                  className={`p-2.5 rounded-xl border text-left text-[11px] transition cursor-pointer ${
                    selectedReasonOption === opt
                      ? 'bg-[#714b67]/30 border-[#714b67] text-white font-medium'
                      : 'bg-black/40 border-white/10 text-slate-400 hover:border-white/20'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Additional feedback or details..."
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs outline-none focus:ring-1 focus:ring-[#714b67] mt-2"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#1c1219]/60 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs border-white/10 text-slate-300 hover:text-white"
          >
            Keep Subscription Active
          </Button>

          <Button
            size="sm"
            disabled={isSubmitting}
            onClick={handleConfirmCancellation}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-950/40"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                Scheduling Cancellation...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Confirm Cancellation at Period End
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
