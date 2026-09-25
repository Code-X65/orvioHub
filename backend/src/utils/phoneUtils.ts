import crypto from 'crypto';

export const NIGERIAN_PREFIXES = [
  '701', '702', '703', '704', '705', '706', '707', '708', '709',
  '801', '802', '803', '804', '805', '806', '807', '808', '809',
  '810', '811', '812', '813', '814', '815', '816', '817', '818', '819',
  '901', '902', '903', '904', '905', '906', '907', '908', '909',
  '912', '913', '915', '916'
];

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
    if (digitsOnly.startsWith('234')) {
      if (digitsOnly.length !== 13) {
        throw new Error('INVALID_PHONE_FORMAT: Nigerian phone number must be 13 digits with country code (+234...).');
      }
      const prefix = digitsOnly.slice(3, 6);
      if (!NIGERIAN_PREFIXES.includes(prefix)) {
        throw new Error(`INVALID_PHONE_FORMAT: Invalid Nigerian mobile network prefix (${prefix}).`);
      }
    }
    return `+${digitsOnly}`;
  }

  // If starts with '00' international prefix
  if (cleaned.startsWith('00')) {
    const digitsOnly = cleaned.slice(2).replace(/\D/g, '');
    if (digitsOnly.length < 8 || digitsOnly.length > 15) {
      throw new Error('INVALID_PHONE_FORMAT: Phone number must be between 8 and 15 digits.');
    }
    if (digitsOnly.startsWith('234')) {
      if (digitsOnly.length !== 13) {
        throw new Error('INVALID_PHONE_FORMAT: Nigerian phone number must be 13 digits with country code (00234...).');
      }
      const prefix = digitsOnly.slice(3, 6);
      if (!NIGERIAN_PREFIXES.includes(prefix)) {
        throw new Error(`INVALID_PHONE_FORMAT: Invalid Nigerian mobile network prefix (${prefix}).`);
      }
    }
    return `+${digitsOnly}`;
  }

  // Nigerian number handling
  if (defaultCountry === 'NG') {
    // Local format e.g. 08031234567, 070..., 090..., 081... (11 digits starting with 0)
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      const prefix = cleaned.slice(1, 4);
      if (!NIGERIAN_PREFIXES.includes(prefix)) {
        throw new Error(`INVALID_PHONE_FORMAT: Invalid Nigerian mobile network prefix (${prefix}).`);
      }
      return `+234${cleaned.slice(1)}`;
    }
    // 10 digits missing leading zero e.g. 8031234567
    if (cleaned.length === 10) {
      const prefix = cleaned.slice(0, 3);
      if (!NIGERIAN_PREFIXES.includes(prefix)) {
        throw new Error(`INVALID_PHONE_FORMAT: Invalid Nigerian mobile network prefix (${prefix}).`);
      }
      return `+234${cleaned}`;
    }
    // Starts with 234 without +
    if (cleaned.startsWith('234') && cleaned.length === 13) {
      const prefix = cleaned.slice(3, 6);
      if (!NIGERIAN_PREFIXES.includes(prefix)) {
        throw new Error(`INVALID_PHONE_FORMAT: Invalid Nigerian mobile network prefix (${prefix}).`);
      }
      return `+${cleaned}`;
    }
    throw new Error(`INVALID_PHONE_FORMAT: "${rawPhone}" is not a valid Nigerian phone number.`);
  }

  // Generic fallback: if 10-15 digits, prefix with + if not present
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
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

/**
 * Returns canonical digits for comparison (e.g. '08012345678' -> '2348012345678', '+2348012345678' -> '2348012345678').
 */
export function toCanonicalPhoneDigits(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  return digits;
}
