import { useState, useEffect, useRef, useCallback } from 'react';

export interface WizardDraftData {
  name: string;
  phoneDigits: string;
  category: string;
  currency: string;
  street: string;
  city: string;
  stateName: string;
  stateCode?: string;
  lga?: string;
  blockNumber?: string;
  area?: string;
  landmark?: string;
  postalCode?: string;
  planKey: 'free_trial' | 'standard';
  billingCycle: 'monthly' | 'annual';
  businessType: string;
  branchCountRange: string;
  productCountRange: string;
  primaryUsers: string[];
  savedAt?: number;
}

export interface WizardDraftOptions<T> {
  storageKey?: string;
  ttlMs?: number;
  isMeaningful?: (data: T) => boolean;
}

const DEFAULT_STORAGE_KEY = 'orvio_org_wizard_draft';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days TTL

export function useWizardDraft<T = WizardDraftData>(
  options?: WizardDraftOptions<T> | string
) {
  const storageKey =
    typeof options === 'string'
      ? options
      : options?.storageKey || DEFAULT_STORAGE_KEY;
  const ttlMs =
    typeof options === 'object' && options?.ttlMs ? options.ttlMs : DEFAULT_TTL_MS;
  const isMeaningful =
    typeof options === 'object' ? options?.isMeaningful : undefined;

  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed?.savedAt || Date.now() - parsed.savedAt > ttlMs) {
        sessionStorage.removeItem(storageKey);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSavedDraft = useCallback((): (T & { savedAt?: number }) | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.savedAt && Date.now() - parsed.savedAt > ttlMs) {
        sessionStorage.removeItem(storageKey);
        setHasDraft(false);
        return null;
      }
      return parsed as T & { savedAt?: number };
    } catch {
      return null;
    }
  }, [storageKey, ttlMs]);

  const saveDraft = useCallback(
    (data: Omit<T, 'savedAt'> | T) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        try {
          if (isMeaningful && !isMeaningful(data as T)) {
            return;
          } else if (!isMeaningful) {
            // Default check for WizardDraftData
            const d = data as any;
            if (
              d.name !== undefined &&
              !d.name?.trim() &&
              !d.phoneDigits?.trim() &&
              !d.street?.trim() &&
              !d.city?.trim()
            ) {
              return;
            }
          }

          const payload = {
            ...data,
            savedAt: Date.now(),
          };
          sessionStorage.setItem(storageKey, JSON.stringify(payload));
          setHasDraft(true);
        } catch {}
      }, 500);
    },
    [storageKey, isMeaningful]
  );

  const clearDraft = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
    setHasDraft(false);
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    hasDraft,
    getSavedDraft,
    saveDraft,
    clearDraft,
  };
}
