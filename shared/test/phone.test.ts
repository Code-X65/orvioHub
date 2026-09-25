import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNigerianPhone,
  validatePhoneNumber,
  cleanPhone,
  formatPhoneForDisplay,
  formatPhoneInternational,
  extractNationalDigits,
  formatPhoneE164,
  NIGERIAN_PREFIXES,
} from '../src/phone.js';

describe('Canonical Phone Validation & Formatting', () => {
  describe('validateNigerianPhone', () => {
    test('validates standard 11-digit local Nigerian numbers starting with 0', () => {
      const res = validateNigerianPhone('08012345678');
      assert.equal(res.valid, true);
      assert.equal(res.normalized, '2348012345678');
      assert.equal(res.formatted, '0801 234 5678');
    });

    test('validates Nigerian numbers with +234 country prefix and spaces', () => {
      const res = validateNigerianPhone('+234 801 234 5678');
      assert.equal(res.valid, true);
      assert.equal(res.normalized, '2348012345678');
      assert.equal(res.formatted, '0801 234 5678');
    });

    test('validates Nigerian numbers with 234 prefix without plus', () => {
      const res = validateNigerianPhone('2348012345678');
      assert.equal(res.valid, true);
      assert.equal(res.normalized, '2348012345678');
      assert.equal(res.formatted, '0801 234 5678');
    });

    test('validates 10-digit national number without leading 0', () => {
      const res = validateNigerianPhone('8012345678');
      assert.equal(res.valid, true);
      assert.equal(res.normalized, '2348012345678');
      assert.equal(res.formatted, '0801 234 5678');
    });

    test('validates various valid network prefixes (MTN, Airtel, Glo, 9mobile)', () => {
      const prefixes = ['701', '703', '706', '802', '803', '805', '812', '903', '909', '912'];
      for (const p of prefixes) {
        const res = validateNigerianPhone(`0${p}1234567`);
        assert.equal(res.valid, true, `Prefix ${p} should be valid`);
        assert.equal(res.normalized, `234${p}1234567`);
      }
    });

    test('rejects numbers with invalid network prefixes', () => {
      const res = validateNigerianPhone('06012345678');
      assert.equal(res.valid, false);
      assert.match(res.error || '', /Invalid Nigerian mobile network prefix/);
    });

    test('rejects numbers with invalid lengths (too short or too long)', () => {
      const shortRes = validateNigerianPhone('080123456');
      assert.equal(shortRes.valid, false);

      const longRes = validateNigerianPhone('0801234567890');
      assert.equal(longRes.valid, false);
    });

    test('rejects empty or whitespace-only inputs', () => {
      assert.equal(validateNigerianPhone('').valid, false);
      assert.equal(validateNigerianPhone('   ').valid, false);
      // @ts-ignore
      assert.equal(validateNigerianPhone(null).valid, false);
    });
  });

  describe('cleanPhone & extractNationalDigits', () => {
    test('cleans +234 prefixes and formatted strings', () => {
      assert.equal(cleanPhone('+234 801 234 5678'), '8012345678');
      assert.equal(cleanPhone('0801-234-5678'), '8012345678');
      assert.equal(cleanPhone('(0801) 234 5678'), '8012345678');
      assert.equal(cleanPhone('2348012345678'), '8012345678');
      assert.equal(cleanPhone('8012345678'), '8012345678');
    });

    test('extractNationalDigits matches cleanPhone', () => {
      assert.equal(extractNationalDigits('+2348031234567'), '8031234567');
      assert.equal(extractNationalDigits('08031234567'), '8031234567');
    });

    test('handles empty and null values gracefully', () => {
      assert.equal(cleanPhone(''), '');
      assert.equal(cleanPhone(null), '');
      assert.equal(cleanPhone(undefined), '');
    });
  });

  describe('formatPhoneE164', () => {
    test('formats national digits to E.164', () => {
      assert.equal(formatPhoneE164('8012345678'), '+2348012345678');
      assert.equal(formatPhoneE164('08012345678'), '+2348012345678');
      assert.equal(formatPhoneE164('+2348012345678'), '+2348012345678');
      assert.equal(formatPhoneE164(''), undefined);
      assert.equal(formatPhoneE164(null), undefined);
    });
  });

  describe('validatePhoneNumber (International + Nigerian)', () => {
    test('routes Nigerian country code and formats to Nigerian validator', () => {
      const res = validatePhoneNumber('08012345678', '+234');
      assert.equal(res.valid, true);
      assert.equal(res.normalized, '2348012345678');
    });

    test('validates non-Nigerian international E.164 numbers', () => {
      const res = validatePhoneNumber('4155552671', '+1');
      assert.equal(res.valid, true);
      assert.equal(res.normalized, '14155552671');
    });

    test('rejects international numbers with invalid length', () => {
      const res = validatePhoneNumber('123', '+1');
      assert.equal(res.valid, false);
    });
  });

  describe('formatPhoneForDisplay & formatPhoneInternational', () => {
    test('formats for display locally with spaces', () => {
      assert.equal(formatPhoneForDisplay('2348012345678'), '0801 234 5678');
      assert.equal(formatPhoneForDisplay('08012345678'), '0801 234 5678');
      assert.equal(formatPhoneForDisplay(''), '');
    });

    test('formats internationally with dial code', () => {
      assert.equal(formatPhoneInternational('08012345678'), '+234 801 234 5678');
      assert.equal(formatPhoneInternational('2348012345678'), '+234 801 234 5678');
    });
  });
});
