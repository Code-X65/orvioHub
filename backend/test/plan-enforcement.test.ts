import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toPublicUser } from '../src/utils/userSerializer.js';

describe('Plan Enforcement & Discrepancy Prevention Test Suite', () => {
  const baseMockUser = {
    id: 'user_test_alison',
    email: 'alison@orviohub.localhost',
    name: 'Alison Argent',
    firstName: 'Alison',
    lastName: 'Argent',
    status: 'ACTIVE',
    createdAt: Date.now(),
  };

  describe('1. toPublicUser Serialization Guardrails', () => {
    it('forces free_trial when user selected standard but subscription is not active', () => {
      const publicUser = toPublicUser(baseMockUser, {
        planKey: 'standard',
        subscriptionStatus: 'trialing',
      });
      assert.ok(publicUser);
      assert.strictEqual(publicUser.planKey, 'free_trial');
      assert.strictEqual(publicUser.subscriptionStatus, 'trialing');
    });

    it('forces free_trial when user selected premium but subscription is pending_payment', () => {
      const publicUser = toPublicUser(baseMockUser, {
        planKey: 'premium',
        subscriptionStatus: 'pending_payment',
      });
      assert.ok(publicUser);
      assert.strictEqual(publicUser.planKey, 'free_trial');
      assert.strictEqual(publicUser.subscriptionStatus, 'trialing');
    });

    it('allows standard planKey when subscription is genuinely active (paid)', () => {
      const publicUser = toPublicUser(baseMockUser, {
        planKey: 'standard',
        subscriptionStatus: 'active',
      });
      assert.ok(publicUser);
      assert.strictEqual(publicUser.planKey, 'standard');
      assert.strictEqual(publicUser.subscriptionStatus, 'active');
    });

    it('allows premium planKey when subscription is genuinely active (paid)', () => {
      const publicUser = toPublicUser(baseMockUser, {
        planKey: 'premium',
        subscriptionStatus: 'active',
      });
      assert.ok(publicUser);
      assert.strictEqual(publicUser.planKey, 'premium');
      assert.strictEqual(publicUser.subscriptionStatus, 'active');
    });

    it('defaults missing subscription options to free_trial and trialing', () => {
      const publicUser = toPublicUser(baseMockUser);
      assert.ok(publicUser);
      assert.strictEqual(publicUser.planKey, 'free_trial');
      assert.strictEqual(publicUser.subscriptionStatus, 'trialing');
    });
  });
});
