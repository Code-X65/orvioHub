import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { smsService } from '../src/services/sms.js';
import { env } from '../src/config/env.js';

describe('Brevo Email and Termii SMS Configuration Suite', () => {
  test('1. Environment schema parses Brevo and Termii variables', () => {
    assert.equal(typeof env.EMAIL_FROM_NAME, 'string');
    assert.equal(typeof env.TERMII_SENDER_ID, 'string');
    assert.equal(typeof env.TERMII_BASE_URL, 'string');
  });

  test('2. Termii SMS service simulates delivery in non-production environments when key is omitted', async () => {
    const res = await smsService.sendSms({
      to: '2348012345678',
      message: 'Your verification code is 123456',
    });

    assert.equal(res.success, true);
    assert.ok(res.messageId);
  });

  test('3. Phone number formatter correctly prepares international MSISDN strings', () => {
    assert.equal(smsService.formatPhoneNumber('+234 801 234 5678'), '2348012345678');
    assert.equal(smsService.formatPhoneNumber('+1 (555) 019-2834'), '15550192834');
    assert.equal(smsService.formatPhoneNumber('2348012345678'), '2348012345678');
  });
});
