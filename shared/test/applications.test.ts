import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  applications,
  USER_FACING_APP_KEYS,
  KNOWN_PLAN_KEYS,
  getApplication,
} from '../src/applications.js';

describe('Application Registry Single Source of Truth', () => {
  test('all applications contain required canonical metadata', () => {
    for (const [key, app] of Object.entries(applications)) {
      assert.ok(app.key, `App ${key} must have key`);
      assert.ok(app.name && app.name.trim().length > 0, `App ${key} must have name`);
      assert.ok(app.description && app.description.trim().length > 0, `App ${key} must have description`);
      assert.ok(['available', 'coming_soon', 'beta'].includes(app.availability || ''), `App ${key} has valid availability`);
      assert.ok(Array.isArray(app.planRequirements), `App ${key} must have planRequirements array`);
      assert.ok(app.iconName && app.iconName.trim().length > 0, `App ${key} must have iconName`);
      assert.equal(typeof app.isActivatable, 'boolean', `App ${key} isActivatable must be boolean`);
    }
  });

  test('plan requirements match known canonical plans', () => {
    for (const [key, app] of Object.entries(applications)) {
      for (const req of app.planRequirements || []) {
        assert.ok(
          KNOWN_PLAN_KEYS.includes(req.toLowerCase() as any),
          `App ${key} has unknown plan requirement: ${req}`
        );
      }
    }
  });

  test('user facing app keys are all present in applications registry', () => {
    for (const userKey of USER_FACING_APP_KEYS) {
      const app = applications[userKey];
      assert.ok(app, `User facing key ${userKey} must exist in applications registry`);
    }
  });

  test('getApplication helper resolves case-insensitively', () => {
    const inv1 = getApplication('inventory');
    const inv2 = getApplication('INVENTORY');
    assert.ok(inv1);
    assert.equal(inv1?.key, 'inventory');
    assert.equal(inv2?.key, 'inventory');
  });
});
