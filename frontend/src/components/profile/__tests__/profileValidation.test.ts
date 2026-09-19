import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { personalProfileSchema } from '../PersonalProfileForm';

describe('Personal Profile Frontend Validation Suite', () => {
  test('1. Valid payload with required first and last name passes schema validation', () => {
    const validData = {
      firstName: 'Chinedu',
      lastName: 'Okafor',
      country: 'NG' as const,
      timezone: 'Africa/Lagos' as const,
    };

    const parsed = personalProfileSchema.safeParse(validData);
    assert.equal(parsed.success, true);
  });

  test('2. Empty or missing firstName fails validation', () => {
    const data = {
      firstName: '',
      lastName: 'Okafor',
      country: 'NG' as const,
      timezone: 'Africa/Lagos' as const,
    };

    const parsed = personalProfileSchema.safeParse(data);
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(parsed.error.errors[0].message, 'First name is required');
    }
  });

  test('3. Empty or missing lastName fails validation', () => {
    const data = {
      firstName: 'Chinedu',
      lastName: '',
      country: 'NG' as const,
      timezone: 'Africa/Lagos' as const,
    };

    const parsed = personalProfileSchema.safeParse(data);
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(parsed.error.errors[0].message, 'Last name is required');
    }
  });

  test('4. Display name, job title, department, and phone are optional', () => {
    const withOptional = {
      firstName: 'Chinedu',
      lastName: 'Okafor',
      displayName: 'Chinedu O.',
      jobTitle: 'Store Attendant',
      department: 'Sales',
      phone: '+2348012345678',
      country: 'NG' as const,
      timezone: 'Africa/Lagos' as const,
    };

    const parsed = personalProfileSchema.safeParse(withOptional);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.displayName, 'Chinedu O.');
      assert.equal(parsed.data.jobTitle, 'Store Attendant');
      assert.equal(parsed.data.department, 'Sales');
      assert.equal(parsed.data.phone, '+2348012345678');
    }
  });

  test('5. Non-Nigerian country is rejected by client-side schema', () => {
    const nonNigeria = {
      firstName: 'Chinedu',
      lastName: 'Okafor',
      country: 'US',
      timezone: 'Africa/Lagos',
    };

    const parsed = personalProfileSchema.safeParse(nonNigeria);
    assert.equal(parsed.success, false);
  });

  test('6. Non-Lagos timezone is rejected by client-side schema', () => {
    const nonLagos = {
      firstName: 'Chinedu',
      lastName: 'Okafor',
      country: 'NG',
      timezone: 'America/New_York',
    };

    const parsed = personalProfileSchema.safeParse(nonLagos);
    assert.equal(parsed.success, false);
  });

  test('7. Nickname and Bio/About are deferred and stripped from personalProfileSchema', () => {
    const withDeferred = {
      firstName: 'Chinedu',
      lastName: 'Okafor',
      preferredName: 'JD',
      nickname: 'JD',
      bio: 'About me text',
      country: 'NG' as const,
      timezone: 'Africa/Lagos' as const,
    };

    const parsed = personalProfileSchema.safeParse(withDeferred);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal((parsed.data as any).preferredName, undefined);
      assert.equal((parsed.data as any).nickname, undefined);
      assert.equal((parsed.data as any).bio, undefined);
    }
  });
});
