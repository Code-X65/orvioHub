export const NIGERIAN_PREFIXES = [
  '701', '702', '703', '704', '705', '706', '707', '708', '709',
  '801', '802', '803', '804', '805', '806', '807', '808', '809',
  '810', '811', '812', '813', '814', '815', '816', '817', '818', '819',
  '901', '902', '903', '904', '905', '906', '907', '908', '909',
  '912', '913', '915', '916'
];

export interface PhoneValidationResult {
  valid: boolean;
  normalized?: string;
  formatted?: string;
  error?: string;
}

export function validateNigerianPhone(phone: string): PhoneValidationResult {
  if (!phone || typeof phone !== 'string') {
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
      error: 'Enter a valid 11-digit Nigerian number (e.g. 0801 234 5678).',
    };
  }

  if (normalized.length !== 13) {
    return { valid: false, error: 'Phone number must be 11 digits (or +234 followed by 10 digits).' };
  }

  const prefix = normalized.slice(3, 6);
  if (!NIGERIAN_PREFIXES.includes(prefix)) {
    return { valid: false, error: `Unrecognized Nigerian mobile prefix (${prefix}).` };
  }

  const local = '0' + normalized.slice(3);
  const formatted = `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;

  return {
    valid: true,
    normalized,
    formatted,
  };
}

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
