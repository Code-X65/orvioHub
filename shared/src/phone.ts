/**
 * Canonical Nigerian & International Phone Validation and Formatting Utilities
 * Single source of truth across frontend, backend, and shared libraries.
 */

export const NIGERIAN_PREFIXES = [
  '701', '702', '703', '704', '705', '706', '707', '708', '709',
  '801', '802', '803', '804', '805', '806', '807', '808', '809',
  '810', '811', '812', '813', '814', '815', '816', '817', '818', '819',
  '901', '902', '903', '904', '905', '906', '907', '908', '909',
  '912', '913', '915', '916'
] as const;

export interface PhoneValidationResult {
  valid: boolean;
  normalized?: string;
  formatted?: string;
  error?: string;
}

/**
 * Normalizes any phone input by stripping whitespace, dashes, parentheses,
 * and country prefixes (+234, 234, leading 0). Returns the 10 national digits.
 */
export function cleanPhone(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  let raw = val.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (raw.startsWith('+234')) {
    raw = raw.slice(4);
  } else if (raw.startsWith('234') && raw.length === 13) {
    raw = raw.slice(3);
  } else if (raw.startsWith('0') && raw.length === 11) {
    raw = raw.slice(1);
  }
  return raw.replace(/\D/g, '');
}

/**
 * Extracts national digits (e.g. '8031234567' from '+2348031234567' or '08031234567').
 */
export function extractNationalDigits(phone?: string | null): string {
  return cleanPhone(phone);
}

/**
 * Formats 10 national phone digits to standard E.164 (+234...).
 */
export function formatPhoneE164(phoneDigits?: string | null): string | undefined {
  if (!phoneDigits) return undefined;
  const cleaned = cleanPhone(phoneDigits);
  return cleaned ? `+234${cleaned}` : undefined;
}

/**
 * Validates and normalizes Nigerian mobile phone numbers.
 * Converts 08012345678, 8012345678, or +2348012345678 -> 2348012345678
 */
export function validateNigerianPhone(phone: string): PhoneValidationResult {
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return { valid: false, error: 'Phone number is required.' };
  }

  const digits = phone.replace(/\D/g, '');

  let normalized = digits;
  if (digits.startsWith('0') && digits.length === 11) {
    normalized = '234' + digits.slice(1);
  } else if (digits.startsWith('234') && digits.length === 13) {
    normalized = digits;
  } else if (digits.length === 10) {
    normalized = '234' + digits;
  } else {
    return {
      valid: false,
      error: 'Phone number must be a valid Nigerian number (e.g. 0801 234 5678 or +234 801 234 5678).',
    };
  }

  if (normalized.length !== 13) {
    return { valid: false, error: 'Phone number must be 11 digits (or +234 followed by 10 digits).' };
  }

  const prefix = normalized.slice(3, 6);
  if (!(NIGERIAN_PREFIXES as readonly string[]).includes(prefix)) {
    return { valid: false, error: `Invalid Nigerian mobile network prefix (${prefix}).` };
  }

  const local = '0' + normalized.slice(3);
  const formatted = `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;

  return {
    valid: true,
    normalized,
    formatted,
  };
}

/**
 * Validates either Nigerian phone (+234) or international standard E.164 phone numbers.
 */
export function validatePhoneNumber(phone: string, countryCode?: string): PhoneValidationResult {
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return { valid: false, error: 'Phone number is required.' };
  }

  const cleanCountry = (countryCode || '+234').trim();
  const digitsOnly = phone.replace(/\D/g, '');

  if (
    cleanCountry === '+234' ||
    cleanCountry === '234' ||
    (!countryCode && (phone.startsWith('+234') || phone.startsWith('234') || (phone.startsWith('0') && digitsOnly.length === 11)))
  ) {
    return validateNigerianPhone(phone);
  }

  // Non-Nigerian international number validation
  const countryDigits = cleanCountry.replace(/\D/g, '');
  let fullDigits = digitsOnly;
  if (!fullDigits.startsWith(countryDigits)) {
    fullDigits = countryDigits + digitsOnly;
  }

  // Standard E.164 phone length is between 7 and 15 digits
  if (fullDigits.length < 7 || fullDigits.length > 15) {
    return {
      valid: false,
      error: 'Please enter a valid phone number (between 7 and 15 digits).',
    };
  }

  return {
    valid: true,
    normalized: fullDigits,
    formatted: `+${countryDigits} ${digitsOnly}`,
  };
}

/**
 * Formats a normalized phone number for local display (e.g. 0801 234 5678).
 */
export function formatPhoneForDisplay(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) {
    const local = '0' + digits.slice(3);
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

/**
 * Formats a normalized phone number with international dial code (e.g. +234 801 234 5678).
 */
export function formatPhoneInternational(phone?: string | null): string {
  if (!phone) return '';
  const validation = validateNigerianPhone(phone);
  if (validation.valid && validation.normalized) {
    const norm = validation.normalized;
    return `+${norm.slice(0, 3)} ${norm.slice(3, 6)} ${norm.slice(6, 9)} ${norm.slice(9)}`;
  }
  return phone;
}
