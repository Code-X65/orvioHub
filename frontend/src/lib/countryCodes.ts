export interface CountryDialCode {
  name: string;
  code: string; // ISO 2-letter
  dialCode: string;
  flag: string;
  format?: string;
  samplePlaceholder?: string;
}

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  // West & Sub-Saharan Africa
  { name: 'Nigeria', code: 'NG', dialCode: '+234', flag: '🇳🇬', format: '#### ### ####', samplePlaceholder: '0801 234 5678' },
  { name: 'Ghana', code: 'GH', dialCode: '+233', flag: '🇬🇭', format: '## ### ####', samplePlaceholder: '020 123 4567' },
  { name: 'Kenya', code: 'KE', dialCode: '+254', flag: '🇰🇪', format: '### ### ###', samplePlaceholder: '0712 345 678' },
  { name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦', format: '## ### ####', samplePlaceholder: '082 123 4567' },
  { name: 'Rwanda', code: 'RW', dialCode: '+250', flag: '🇷🇼', format: '### ### ###', samplePlaceholder: '788 123 456' },
  { name: 'Uganda', code: 'UG', dialCode: '+256', flag: '🇺🇬', format: '### ### ###', samplePlaceholder: '772 123 456' },
  { name: 'Tanzania', code: 'TZ', dialCode: '+255', flag: '🇹🇿', format: '### ### ###', samplePlaceholder: '0754 123 456' },
  { name: 'Egypt', code: 'EG', dialCode: '+20', flag: '🇪🇬', format: '## #### ####', samplePlaceholder: '010 1234 5678' },
  { name: 'Morocco', code: 'MA', dialCode: '+212', flag: '🇲🇦', format: '## #### ####', samplePlaceholder: '06 12 34 56 78' },
  { name: 'Ethiopia', code: 'ET', dialCode: '+251', flag: '🇪🇹', format: '## ### ####', samplePlaceholder: '091 123 4567' },
  { name: 'Cameroon', code: 'CM', dialCode: '+237', flag: '🇨🇲', format: '#### ####', samplePlaceholder: '6 71 23 45 67' },
  { name: 'Ivory Coast', code: 'CI', dialCode: '+225', flag: '🇨🇮', format: '## ## ## ## ##', samplePlaceholder: '07 01 23 45 67' },
  { name: 'Senegal', code: 'SN', dialCode: '+221', flag: '🇸🇳', format: '## ### ####', samplePlaceholder: '77 123 45 67' },

  // North America
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸', format: '### ### ####', samplePlaceholder: '202 555 0123' },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦', format: '### ### ####', samplePlaceholder: '416 555 0199' },
  { name: 'Mexico', code: 'MX', dialCode: '+52', flag: '🇲🇽', format: '## #### ####', samplePlaceholder: '55 1234 5678' },

  // Europe
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧', format: '#### ######', samplePlaceholder: '07123 456789' },
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪', format: '### ########', samplePlaceholder: '0151 12345678' },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷', format: '# ## ## ## ##', samplePlaceholder: '06 12 34 56 78' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱', format: '# ########', samplePlaceholder: '06 12345678' },
  { name: 'Ireland', code: 'IE', dialCode: '+353', flag: '🇮🇪', format: '## ### ####', samplePlaceholder: '087 123 4567' },
  { name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸', format: '### ### ###', samplePlaceholder: '612 345 678' },
  { name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹', format: '### #######', samplePlaceholder: '320 1234567' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭', format: '## ### ## ##', samplePlaceholder: '079 123 45 67' },
  { name: 'Sweden', code: 'SE', dialCode: '+46', flag: '🇸🇪', format: '## ### ## ##', samplePlaceholder: '070 123 45 67' },
  { name: 'Norway', code: 'NO', dialCode: '+47', flag: '🇳🇴', format: '### ## ###', samplePlaceholder: '412 34 567' },
  { name: 'Poland', code: 'PL', dialCode: '+48', flag: '🇵🇱', format: '### ### ###', samplePlaceholder: '512 345 678' },
  { name: 'Portugal', code: 'PT', dialCode: '+351', flag: '🇵🇹', format: '### ### ###', samplePlaceholder: '912 345 678' },
  { name: 'Belgium', code: 'BE', dialCode: '+32', flag: '🇧🇪', format: '### ## ## ##', samplePlaceholder: '0470 12 34 56' },
  { name: 'Austria', code: 'AT', dialCode: '+43', flag: '🇦🇹', format: '### #######', samplePlaceholder: '0664 1234567' },

  // Middle East
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪', format: '## ### ####', samplePlaceholder: '50 123 4567' },
  { name: 'Saudi Arabia', code: 'SA', dialCode: '+966', flag: '🇸🇦', format: '## ### ####', samplePlaceholder: '050 123 4567' },
  { name: 'Qatar', code: 'QA', dialCode: '+974', flag: '🇶🇦', format: '#### ####', samplePlaceholder: '3312 3456' },
  { name: 'Israel', code: 'IL', dialCode: '+972', flag: '🇮🇱', format: '## ### ####', samplePlaceholder: '050 123 4567' },
  { name: 'Turkey', code: 'TR', dialCode: '+90', flag: '🇹🇷', format: '### ### ####', samplePlaceholder: '532 123 4567' },

  // Asia-Pacific
  { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳', format: '##### #####', samplePlaceholder: '98765 43210' },
  { name: 'Singapore', code: 'SG', dialCode: '+65', flag: '🇸🇬', format: '#### ####', samplePlaceholder: '8123 4567' },
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺', format: '### ### ###', samplePlaceholder: '0412 345 678' },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64', flag: '🇳🇿', format: '## ### ####', samplePlaceholder: '021 123 4567' },
  { name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵', format: '## #### ####', samplePlaceholder: '090 1234 5678' },
  { name: 'South Korea', code: 'KR', dialCode: '+82', flag: '🇰🇷', format: '## #### ####', samplePlaceholder: '010 1234 5678' },
  { name: 'China', code: 'CN', dialCode: '+86', flag: '🇨🇳', format: '### #### ####', samplePlaceholder: '138 1234 5678' },
  { name: 'Hong Kong', code: 'HK', dialCode: '+852', flag: '🇭🇰', format: '#### ####', samplePlaceholder: '9123 4567' },
  { name: 'Malaysia', code: 'MY', dialCode: '+60', flag: '🇲🇾', format: '## ### ####', samplePlaceholder: '012 345 6789' },
  { name: 'Indonesia', code: 'ID', dialCode: '+62', flag: '🇮🇩', format: '### #### ####', samplePlaceholder: '0812 3456 7890' },
  { name: 'Philippines', code: 'PH', dialCode: '+63', flag: '🇵🇭', format: '### ### ####', samplePlaceholder: '0917 123 4567' },
  { name: 'Pakistan', code: 'PK', dialCode: '+92', flag: '🇵🇰', format: '### #######', samplePlaceholder: '0300 1234567' },
  { name: 'Bangladesh', code: 'BD', dialCode: '+880', flag: '🇧🇩', format: '#### ######', samplePlaceholder: '01712 345678' },

  // Latin America
  { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷', format: '## ##### ####', samplePlaceholder: '11 91234 5678' },
  { name: 'Argentina', code: 'AR', dialCode: '+54', flag: '🇦🇷', format: '## #### ####', samplePlaceholder: '11 1234 5678' },
  { name: 'Colombia', code: 'CO', dialCode: '+57', flag: '🇨🇴', format: '### ### ####', samplePlaceholder: '300 123 4567' },
  { name: 'Chile', code: 'CL', dialCode: '+56', flag: '🇨🇱', format: '# #### ####', samplePlaceholder: '9 1234 5678' },
];

export const DEFAULT_COUNTRY_CODE = 'NG';
export const DEFAULT_COUNTRY = COUNTRY_DIAL_CODES[0];

export function getCountryByDialCode(dialCode: string): CountryDialCode | undefined {
  return COUNTRY_DIAL_CODES.find((c) => c.dialCode === dialCode);
}

export function findCountryByPhone(phone: string): CountryDialCode | undefined {
  const clean = phone.startsWith('+') ? phone : `+${phone}`;
  // Sort descending by dialCode length to match longest prefix first
  const sorted = [...COUNTRY_DIAL_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  return sorted.find((c) => clean.startsWith(c.dialCode));
}
