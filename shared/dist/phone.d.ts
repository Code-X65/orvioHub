/**
 * Canonical Nigerian & International Phone Validation and Formatting Utilities
 * Single source of truth across frontend, backend, and shared libraries.
 */
export declare const NIGERIAN_PREFIXES: readonly ["701", "702", "703", "704", "705", "706", "707", "708", "709", "801", "802", "803", "804", "805", "806", "807", "808", "809", "810", "811", "812", "813", "814", "815", "816", "817", "818", "819", "901", "902", "903", "904", "905", "906", "907", "908", "909", "912", "913", "915", "916"];
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
export declare function cleanPhone(val?: string | null): string;
/**
 * Extracts national digits (e.g. '8031234567' from '+2348031234567' or '08031234567').
 */
export declare function extractNationalDigits(phone?: string | null): string;
/**
 * Formats 10 national phone digits to standard E.164 (+234...).
 */
export declare function formatPhoneE164(phoneDigits?: string | null): string | undefined;
/**
 * Validates and normalizes Nigerian mobile phone numbers.
 * Converts 08012345678, 8012345678, or +2348012345678 -> 2348012345678
 */
export declare function validateNigerianPhone(phone: string): PhoneValidationResult;
/**
 * Validates either Nigerian phone (+234) or international standard E.164 phone numbers.
 */
export declare function validatePhoneNumber(phone: string, countryCode?: string): PhoneValidationResult;
/**
 * Formats a normalized phone number for local display (e.g. 0801 234 5678).
 */
export declare function formatPhoneForDisplay(phone?: string | null): string;
/**
 * Formats a normalized phone number with international dial code (e.g. +234 801 234 5678).
 */
export declare function formatPhoneInternational(phone?: string | null): string;
//# sourceMappingURL=phone.d.ts.map