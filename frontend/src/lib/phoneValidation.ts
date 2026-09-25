/**
 * Frontend phone validation adapter.
 * Re-exports canonical implementation from @orviohub/shared to prevent drift.
 */

export {
  NIGERIAN_PREFIXES,
  type PhoneValidationResult,
  cleanPhone,
  extractNationalDigits,
  formatPhoneE164,
  validateNigerianPhone,
  validatePhoneNumber,
  formatPhoneForDisplay,
  formatPhoneInternational,
} from '@orviohub/shared';

