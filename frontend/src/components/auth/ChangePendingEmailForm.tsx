import React, { useState, useRef, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export interface ChangePendingEmailResponse {
  status: 'verification_required' | 'verification_already_pending';
  maskedEmail: string;
  verificationSent: boolean;
  expiresAt?: number;
  email?: string;
}

export interface ChangePendingEmailFormProps {
  currentMaskedEmail: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newMaskedEmail: string, response: ChangePendingEmailResponse) => void;
  onSessionExpired?: () => void;
}

export const ChangePendingEmailForm: React.FC<ChangePendingEmailFormProps> = ({
  currentMaskedEmail,
  isOpen,
  onClose,
  onSuccess,
  onSessionExpired,
}) => {
  const [newEmail, setNewEmail] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Persistent Idempotency-Key per edit attempt; preserved across network retries
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus input and refresh key when opened
  useEffect(() => {
    if (isOpen) {
      idempotencyKeyRef.current = crypto.randomUUID();
      setClientError(null);
      setServerError(null);
      setNetworkError(false);
      setIsRateLimited(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateEmail = (val: string): boolean => {
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) {
      setClientError('Please enter an email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setClientError('Please enter a valid email address.');
      return false;
    }
    if (trimmed.length > 254) {
      setClientError('Email address is too long.');
      return false;
    }
    setClientError(null);
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setServerError(null);
    setNetworkError(false);

    const trimmed = newEmail.trim().toLowerCase();
    if (!validateEmail(trimmed)) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Send with persistent idempotency key
      const res = await api.post<{ success: boolean; data: ChangePendingEmailResponse }>(
        '/auth/change-pending-email',
        { newEmail: trimmed },
        {
          headers: {
            'Idempotency-Key': idempotencyKeyRef.current,
          },
        }
      );

      const responseData = res.data;
      toast.success('Pending email updated! A new verification code has been sent.');
      onSuccess(responseData.maskedEmail, responseData);
    } catch (err: any) {
      if (err instanceof ApiError || err.status) {
        const statusCode = err.status;
        const code = err.code;

        if (statusCode === 409 || code === 'EMAIL_ALREADY_IN_USE' || code === 'USER_ALREADY_EXISTS') {
          setServerError(
            'This email cannot be used for this account. Try another email or sign in to the existing account.'
          );
        } else if (statusCode === 401 || code === 'VERIFICATION_SESSION_EXPIRED') {
          toast.error('Your verification session has expired. Please sign in again.');
          if (onSessionExpired) {
            onSessionExpired();
          } else {
            window.location.href = '/login';
          }
        } else if (statusCode === 429 || code === 'RATE_LIMIT_EXCEEDED' || code === 'RATE_LIMITED') {
          setIsRateLimited(true);
          setServerError('Too many attempts. Please wait before trying again.');
        } else {
          setServerError(err.message || 'Failed to update email address. Please try again.');
        }
      } else {
        // Network failure
        setNetworkError(true);
        setServerError(
          'Your email change may already have been processed. Check the new email or request another verification code.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full p-4 rounded-sm bg-[#140e12] border border-white/10 text-left space-y-3.5 animate-in fade-in duration-150">
      <div className="flex items-center justify-between pb-1 border-b border-white/5">
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
          <Mail className="w-3.5 h-3.5 text-[#c79dbd]" />
          <span>Change Email Address</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Current address: <span className="font-medium text-slate-200">{currentMaskedEmail}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-pending-email" className="text-xs text-slate-300 font-medium">
            New Work Email
          </Label>
          <Input
            id="new-pending-email"
            ref={inputRef}
            type="email"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              if (clientError) validateEmail(e.target.value);
            }}
            placeholder="you@company.com"
            disabled={isSubmitting || isRateLimited}
            className="h-10 bg-[#0a0609] border-white/10 text-white rounded-xs text-xs focus:border-[#c79dbd]"
            autoComplete="email"
          />
          {clientError && (
            <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />
              <span>{clientError}</span>
            </p>
          )}
        </div>

        {serverError && (
          <div className="p-2.5 rounded-xs bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>{serverError}</p>
              {networkError && (
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-white underline hover:no-underline cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                  Retry with same key
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="submit"
            disabled={isSubmitting || isRateLimited || !newEmail.trim()}
            className="h-9 px-4 bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold rounded-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Spinner size="sm" className="mr-1.5" /> : null}
            Update & Send Code
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 px-3 text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};
