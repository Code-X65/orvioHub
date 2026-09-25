import { DEFAULT_NIGERIAN_STATES, type NigerianState } from '@/stores/useLocationStore';
import {
  cleanPhone,
  formatPhoneE164,
  validateNigerianPhone,
} from '@orviohub/shared';

export { cleanPhone, formatPhoneE164, validateNigerianPhone };

export interface BranchFormData {
  name: string;
  code?: string;
  phoneDigits?: string;
  phone?: string;
  email?: string;
  street?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  lga?: string;
  blockNumber?: string;
  area?: string;
  landmark?: string;
  postalCode?: string;
  country?: string;
  address?: string;
  isPrimary?: boolean;
  phoneVerified?: boolean;
}

export interface BranchFormErrors {
  name?: string;
  email?: string;
  phoneDigits?: string;
  general?: string;
}



/**
 * Assembles a multi-part address into a single readable string.
 */
export function assembleAddress(parts: {
  blockNumber?: string;
  street?: string;
  area?: string;
  city?: string;
  lga?: string;
  state?: string;
  country?: string;
}): string | undefined {
  const segments = [
    parts.blockNumber?.trim(),
    parts.street?.trim(),
    parts.area?.trim(),
    parts.city?.trim(),
    parts.lga?.trim(),
    parts.state?.trim(),
    parts.country?.trim() || 'Nigeria',
  ].filter(Boolean);

  return segments.length > 0 ? segments.join(', ') : undefined;
}

/**
 * Generates an uppercase 3-4 character code based on a branch name.
 * Handles multi-word acronyms (e.g. Victoria Island -> VI, Marina Main Store -> MMS).
 */
export function generateBranchCode(name: string): string {
  if (!name || !name.trim()) return '';
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const acronym = words.map((w) => w[0]?.toUpperCase() || '').join('').slice(0, 4);
    if (acronym.length >= 2) return acronym;
  }
  const alphanumeric = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return alphanumeric.slice(0, 4) || 'MAIN';
}

/**
 * Generates options array for state dropdown, falling back to full 36 states + FCT.
 */
export function getStateOptions(states?: NigerianState[]): { label: string; value: string }[] {
  const source = states && states.length > 0 ? states : DEFAULT_NIGERIAN_STATES;
  return source.map((s) => ({
    label: s.name,
    value: s.name,
  }));
}

/**
 * Validates branch form data.
 */
export function validateBranchForm(data: BranchFormData): BranchFormErrors {
  const errors: BranchFormErrors = {};

  if (!data.name || !data.name.trim()) {
    errors.name = 'Branch name is required.';
  }

  if (data.email && data.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
  }

  if (data.phoneDigits && data.phoneDigits.trim()) {
    const digits = cleanPhone(data.phoneDigits);
    if (digits.length > 0 && (digits.length < 10 || digits.length > 11)) {
      errors.phoneDigits = 'Nigerian phone number must be 10 or 11 digits.';
    }
  }

  return errors;
}
