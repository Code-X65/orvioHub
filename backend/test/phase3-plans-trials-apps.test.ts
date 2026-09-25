import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_CONFIG, PLAN_LIMITS, getPlanLimits, getCanonicalPlanConfig, buildEntitlementLimitError } from '../src/config/planLimits.js';
import { DEFAULT_PLANS } from '../convex/plans.js';
import { applications } from '../../shared/src/applications.js';

describe('Phase 3: Authoritative Product, Plan Limits & Application Visibility Suite', () => {
  describe('1. Plan Configuration & Limits Verification', () => {
    test('Free Trial has canonical 30 days trial duration', () => {
      const freeTrial = getCanonicalPlanConfig('free_trial');
      assert.equal(freeTrial.trialDays, 30);
      assert.equal(freeTrial.paid, false);
      assert.equal(freeTrial.public, true);
    });

    test('Free Trial allows 1 branch, 2 members, 500 products, 300 monthly transactions', () => {
      const freeTrial = getCanonicalPlanConfig('free_trial');
      assert.equal(freeTrial.limits.branchesPerOrganization, 1);
      assert.equal(freeTrial.limits.membersPerOrganization, 2);
      assert.equal(freeTrial.limits.productsPerOrganization, 500);
      assert.equal(freeTrial.limits.monthlyTransactions, 300);
      assert.equal(freeTrial.limits.ownedOrganizations, 1);
      assert.deepEqual(freeTrial.allowedApplications, ['inventory']);
    });

    test('Standard plan allows 3 branches, 10 members, 5,000 products, 5,000 monthly transactions', () => {
      const standard = getCanonicalPlanConfig('standard');
      assert.equal(standard.paid, true);
      assert.equal(standard.trialDays, null);
      assert.equal(standard.limits.branchesPerOrganization, 3);
      assert.equal(standard.limits.membersPerOrganization, 10);
      assert.equal(standard.limits.productsPerOrganization, 5000);
      assert.equal(standard.limits.monthlyTransactions, 5000);
      assert.equal(standard.limits.ownedOrganizations, 3);
      assert.deepEqual(standard.allowedApplications, ['inventory']);
    });

    test('Premium plan allows 10 branches, 50 members, 25,000 products, 25,000 monthly transactions', () => {
      const premium = getCanonicalPlanConfig('premium');
      assert.equal(premium.paid, true);
      assert.equal(premium.trialDays, null);
      assert.equal(premium.limits.branchesPerOrganization, 10);
      assert.equal(premium.limits.membersPerOrganization, 50);
      assert.equal(premium.limits.productsPerOrganization, 25000);
      assert.equal(premium.limits.monthlyTransactions, 25000);
      assert.equal(premium.limits.ownedOrganizations, 10);
      assert.deepEqual(premium.allowedApplications, ['inventory']);
    });

    test('Legacy permanent Free plan is non-public and not selectable', () => {
      const legacyFree = PLAN_CONFIG.free;
      assert.equal(legacyFree.public, false);
      assert.equal(legacyFree.paid, false);
    });

    test('Convex DEFAULT_PLANS match canonical values', () => {
      const freeTrial = DEFAULT_PLANS.find((p) => p.key === 'free_trial');
      assert.ok(freeTrial);
      assert.equal(freeTrial.trialDays, 30);
      assert.equal(freeTrial.limits.branches, 1);
      assert.equal(freeTrial.limits.members, 2);
      assert.equal(freeTrial.limits.products, 500);
      assert.equal(freeTrial.limits.transactions, 300);

      const standard = DEFAULT_PLANS.find((p) => p.key === 'standard');
      assert.ok(standard);
      assert.equal(standard.limits.branches, 3);
      assert.equal(standard.limits.members, 10);
      assert.equal(standard.limits.products, 5000);
      assert.equal(standard.limits.transactions, 5000);

      const premium = DEFAULT_PLANS.find((p) => p.key === 'premium');
      assert.ok(premium);
      assert.equal(premium.limits.branches, 10);
      assert.equal(premium.limits.members, 50);
      assert.equal(premium.limits.products, 25000);
      assert.equal(premium.limits.transactions, 25000);

      const legacyFree = DEFAULT_PLANS.find((p) => p.key === 'free');
      assert.ok(legacyFree);
      assert.equal(legacyFree.isActive, false);
    });
  });

  describe('2. Entitlement Limit Error Format Specification', () => {
    test('Builds exact ENTITLEMENT_LIMIT_REACHED error for Free Trial branch limit', () => {
      const err = buildEntitlementLimitError('inventory.max_branches', 1, 1, 'free_trial');
      assert.deepEqual(err, {
        error: {
          code: 'ENTITLEMENT_LIMIT_REACHED',
          featureKey: 'inventory.max_branches',
          currentUsage: 1,
          limit: 1,
          upgradePlan: 'standard',
          message: 'Your current plan allows 1 branch.',
        },
      });
    });

    test('Builds exact ENTITLEMENT_LIMIT_REACHED error for Standard branch limit', () => {
      const err = buildEntitlementLimitError('inventory.max_branches', 3, 3, 'standard');
      assert.deepEqual(err, {
        error: {
          code: 'ENTITLEMENT_LIMIT_REACHED',
          featureKey: 'inventory.max_branches',
          currentUsage: 3,
          limit: 3,
          upgradePlan: 'premium',
          message: 'Your current plan allows 3 branches.',
        },
      });
    });
  });

  describe('3. Application Visibility & Activation Guards', () => {
    test('Inventory is enabled, visible, and activatable', () => {
      const inv = applications.inventory;
      assert.equal(inv.enabled, true);
      assert.equal(inv.status, 'available');
      assert.equal(inv.isVisibleToUsers, true);
      assert.equal(inv.isActivatable, true);
    });

    test('Future applications (pos, booking, gym, taskmanagement) are hidden and non-activatable', () => {
      const futureKeys = ['pos', 'booking', 'gym', 'taskmanagement'] as const;
      for (const key of futureKeys) {
        const app = applications[key];
        assert.ok(app, `Application ${key} should be defined`);
        assert.equal(app.enabled, false, `${key} should be disabled`);
        assert.equal(app.status, 'coming_soon', `${key} should be coming_soon`);
        assert.equal(app.isVisibleToUsers, false, `${key} should not be visible to users`);
        assert.equal(app.isActivatable, false, `${key} should not be activatable`);
      }
    });
  });
});
