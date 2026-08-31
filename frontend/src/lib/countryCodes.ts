export interface CountryDialCode {
  name: string;
  code: string; // ISO 2-letter
  dialCode: string;
  flag: string;
  format?: string;
  samplePlaceholder?: string;
}

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { name: 'Nigeria', code: 'NG', dialCode: '+234', flag: '🇳🇬', format: '#### ### ####', samplePlaceholder: '0801 234 5678' },
  { name: 'Ghana', code: 'GH', dialCode: '+233', flag: '🇬🇭', format: '## ### ####', samplePlaceholder: '020 123 4567' },
  { name: 'Kenya', code: 'KE', dialCode: '+254', flag: '🇰🇪', format: '### ### ###', samplePlaceholder: '0712 345 678' },
  { name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦', format: '## ### ####', samplePlaceholder: '082 123 4567' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧', format: '#### ######', samplePlaceholder: '07123 456789' },
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸', format: '### ### ####', samplePlaceholder: '202 555 0123' },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦', format: '### ### ####', samplePlaceholder: '416 555 0199' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪', format: '## ### ####', samplePlaceholder: '50 123 4567' },
  { name: 'Rwanda', code: 'RW', dialCode: '+250', flag: '🇷🇼', format: '### ### ###', samplePlaceholder: '788 123 456' },
  { name: 'Uganda', code: 'UG', dialCode: '+256', flag: '🇺🇬', format: '### ### ###', samplePlaceholder: '772 123 456' },
  { name: 'Egypt', code: 'EG', dialCode: '+20', flag: '🇪🇬', format: '## #### ####', samplePlaceholder: '010 1234 5678' },
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪', format: '### ########', samplePlaceholder: '0151 12345678' },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷', format: '# ## ## ## ##', samplePlaceholder: '06 12 34 56 78' },
  { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳', format: '##### #####', samplePlaceholder: '98765 43210' },
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺', format: '### ### ###', samplePlaceholder: '0412 345 678' },
];

export const DEFAULT_COUNTRY_CODE = 'NG';
export const DEFAULT_COUNTRY = COUNTRY_DIAL_CODES[0];
