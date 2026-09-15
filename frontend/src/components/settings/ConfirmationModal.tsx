import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
  title: string;
  description: string;
  confirmationPhrase?: string;
  requireReason?: boolean;
  confirmButtonText?: string;
  isDangerous?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmationPhrase,
  requireReason = false,
  confirmButtonText = 'Confirm Action',
  isDangerous = false,
}) => {
  const [typedPhrase, setTypedPhrase] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isPhraseValid = confirmationPhrase ? typedPhrase.trim() === confirmationPhrase : true;
  const isReasonValid = requireReason ? reason.trim().length > 0 : true;
  const canConfirm = isPhraseValid && isReasonValid && !isSubmitting;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setIsSubmitting(true);
    try {
      await onConfirm(reason);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="max-w-md w-full bg-[#160c15] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDangerous ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>

        {confirmationPhrase && (
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 block">
              To proceed, please type <span className="font-mono font-bold text-white bg-white/10 px-1.5 py-0.5 rounded">{confirmationPhrase}</span> below:
            </label>
            <Input
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              placeholder={confirmationPhrase}
              className="bg-black/50 border-white/10 text-xs focus:border-rose-500"
            />
          </div>
        )}

        {requireReason && (
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 block">Reason for this action:</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Organization restructuring"
              className="bg-black/50 border-white/10 text-xs"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`text-xs font-semibold ${
              isDangerous
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-950/50'
                : 'bg-[#714b67] hover:bg-[#86597a] text-white shadow-lg shadow-[#714b67]/25'
            }`}
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {confirmButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
};
