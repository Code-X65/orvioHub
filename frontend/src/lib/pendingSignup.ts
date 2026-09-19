export interface PendingSignup {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  idempotencyKey: string;
  timestamp: number;
  selectedProduct?: string;
  returnTo?: string;
}

const STORAGE_KEY = 'orvio_pending_signup';

export function getPendingSignup(): PendingSignup | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSignup;
    // Expire pending recovery state after 24 hours
    if (Date.now() - parsed.timestamp > 86_400_000) {
      clearPendingSignup();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setPendingSignup(data: Omit<PendingSignup, 'timestamp'> & { timestamp?: number }): void {
  try {
    const record: PendingSignup = {
      ...data,
      timestamp: data.timestamp || Date.now(),
    };
    const json = JSON.stringify(record);
    sessionStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Storage might be disabled or quota exceeded
  }
}

export function updatePendingSignupEmail(newEmail: string): void {
  const current = getPendingSignup();
  if (current) {
    setPendingSignup({
      ...current,
      email: newEmail.toLowerCase().trim(),
    });
  }
}

export function clearPendingSignup(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage error
  }
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idemp_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}
