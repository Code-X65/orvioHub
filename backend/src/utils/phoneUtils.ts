import crypto from 'crypto';

/**
 * Normalizes phone numbers into standard E.164 international format.
 * Defaults to Nigeria (+234) for local 10/11 digit numbers (e.g. '0803 123 4567' -> '+2348031234567').
 */
export function normalizePhoneNumber(rawPhone: string, defaultCountry = 'NG'): string {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('INVALID_PHONE_FORMAT: Phone number is required.');
  }

  // Remove whitespace, dashes, parens, dots
  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, '');

  if (!cleaned) {
    throw new Error('INVALID_PHONE_FORMAT: Phone number cannot be empty.');
  }

  // If already in international format starting with '+'
  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.slice(1).replace(/\D/g, '');
    if (digitsOnly.length < 8 || digitsOnly.length > 15) {
      throw new Error('INVALID_PHONE_FORMAT: International phone number must be between 8 and 15 digits.');
    }
    return `+${digitsOnly}`;
  }

  // If starts with '00' international prefix
  if (cleaned.startsWith('00')) {
    const digitsOnly = cleaned.slice(2).replace(/\D/g, '');
    if (digitsOnly.length < 8 || digitsOnly.length > 15) {
      throw new Error('INVALID_PHONE_FORMAT: Phone number must be between 8 and 15 digits.');
    }
    return `+${digitsOnly}`;
  }

  // Nigerian number handling
  if (defaultCountry === 'NG') {
    // Local format e.g. 08031234567, 070..., 090..., 081... (11 digits starting with 0)
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      return `+234${cleaned.slice(1)}`;
    }
    // 10 digits missing leading zero e.g. 8031234567
    if (cleaned.length === 10 && /^[789]\d{9}$/.test(cleaned)) {
      return `+234${cleaned}`;
    }
    // Starts with 234 without +
    if (cleaned.startsWith('234') && cleaned.length === 13) {
      return `+${cleaned}`;
    }
  }

  // Generic fallback: if 10-15 digits, prefix with + if not present
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
    if (defaultCountry === 'NG' && digitsOnly.startsWith('0')) {
      return `+234${digitsOnly.slice(1)}`;
    }
    return `+${digitsOnly}`;
  }

  throw new Error(`INVALID_PHONE_FORMAT: "${rawPhone}" is not a valid phone number.`);
}

/**
 * Validates whether a phone string can be normalized without throwing.
 */
export function isValidPhoneNumber(rawPhone: string, defaultCountry = 'NG'): boolean {
  try {
    normalizePhoneNumber(rawPhone, defaultCountry);
    return true;
  } catch {
    return false;
  }
}

/**
 * Masks phone number for public or log display (e.g. '+234 ••• ••• 4567').
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.length <= 4) return '••••';
  const prefix = cleaned.slice(0, 4);
  const suffix = cleaned.slice(-4);
  return `${prefix} •••• ${suffix}`;
}

/**
 * Generates a cryptographically random 6-digit numeric OTP.
 */
export function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Generates a SHA-256 digest hash of the given OTP string.
 * Ensures plain OTP is never stored in DB or logs.
 */
export function hashOtpCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}
