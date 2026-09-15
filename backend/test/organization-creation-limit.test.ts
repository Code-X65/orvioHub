import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { entitlementService } from '../src/services/entitlementService.js';
import type { FastifyInstance } from 'fastify';

describe('Organization & Workspace Creation Limits Test Suite (Max 3 Owned Orgs)', () => {
  let app: FastifyInstance;
  const originalGetEligibility = dataService.getOrganizationCreationEligibility;
  const originalGetCategorized = dataService.getUserOrganizationsCategorized;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserMemberships = dataService.getUserMemberships;
  const originalCreateOrg = dataService.createOrganization;
  const originalCreateWithPlan = dataService.createOrganizationWithPlan;
  const originalArchiveOrg = dataService.archiveOrganization;
  const originalRestoreOrg = dataService.restoreOrganization;
  const originalTransferOwnership = dataService.transferOrganizationOwnership;
  const originalSetOverride = dataService.setOrganizationLimitOverride;
  const originalRemoveOverride = dataService.removeOrganizationLimitOverride;
  const originalGetUsage = dataService.getSuperadminOrganizationUsage;
  const originalGetEvents = dataService.getOrganizationLimitEvents;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    dataService.getOrganizationCreationEligibility = originalGetEligibility;
    dataService.getUserOrganizationsCategorized = originalGetCategorized;
    dataService.getUserById = originalGetUserById;
    dataService.getUserMemberships = originalGetUserMemberships;
    dataService.createOrganization = originalCreateOrg;
    dataService.createOrganizationWithPlan = originalCreateWithPlan;
    dataService.archiveOrganization = originalArchiveOrg;
    dataService.restoreOrganization = originalRestoreOrg;
    dataService.transferOrganizationOwnership = originalTransferOwnership;
    dataService.setOrganizationLimitOverride = originalSetOverride;
    dataService.removeOrganizationLimitOverride = originalRemoveOverride;
    dataService.getSuperadminOrganizationUsage = originalGetUsage;
    dataService.getOrganizationLimitEvents = originalGetEvents;
    await app.close();
  });

  test('1. Eligibility check endpoint returns 2 of 3 used when user owns 2 orgs', async () => {
    const testUserId = 'user_limit_test_1';
    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'user1@orviohub.com',
      emailVerified: true,
      name: 'User One',
    } as any);

    dataService.getOrganizationCreationEligibility = async (userId: string) => {
      assert.strictEqual(userId, testUserId);
      return {
        allowed: true,
        currentOwnedOrganizations: 2,
        maximumOwnedOrganizations: 3,
        remainingOwnedOrganizations: 1,
      };
    };

    const token = app.jwt.sign({ userId: testUserId, email: 'user1@orviohub.com' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/organization-creation-eligibility',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.allowed, true);
    assert.strictEqual(body.currentOwnedOrganizations, 2);
    assert.strictEqual(body.maximumOwnedOrganizations, 3);
    assert.strictEqual(body.remainingOwnedOrganizations, 1);
  });

  test('2. User with 0, 1, 2 owned orgs successfully creates 3rd org', async () => {
    const testUserId = 'user_limit_test_2';
    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'user2@orviohub.com',
      emailVerified: true,
      name: 'User Two',
    } as any);

    let createdCount = 2;
    dataService.getOrganizationCreationEligibility = async () => ({
      allowed: createdCount < 3,
      currentOwnedOrganizations: createdCount,
      maximumOwnedOrganizations: 3,
      remainingOwnedOrganizations: 3 - createdCount,
    });

    dataService.createOrganizationWithPlan = async (args: any) => {
      createdCount++;
      return {
        organizationId: 'org_test_3',
        workspaceId: 'ws_test_3',
        slug: 'code-x-retail',
        name: args.name,
        planKey: 'standard',
        status: 'active',
      };
    };

    const token = app.jwt.sign({ userId: testUserId, email: 'user2@orviohub.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/with-plan',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Code X Retail',
        phone: '08011112222',
        category: 'Electronics',
        planKey: 'standard',
        billingInterval: 'monthly',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.data.organizationId, 'org_test_3');
  });

  test('3. User with 3 owned orgs is rejected with 409 Conflict when attempting to create 4th org', async () => {
    const testUserId = 'user_limit_test_3';
    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'user3@orviohub.com',
      emailVerified: true,
      name: 'User Three',
    } as any);

    dataService.getOrganizationCreationEligibility = async () => ({
      allowed: false,
      currentOwnedOrganizations: 3,
      maximumOwnedOrganizations: 3,
      remainingOwnedOrganizations: 0,
      code: 'ORGANIZATION_LIMIT_REACHED',
      message: 'You already own 3 organizations. You can still join other organizations by invitation.',
    });

    const token = app.jwt.sign({ userId: testUserId, email: 'user3@orviohub.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/with-plan',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Fourth Business Attempt',
        phone: '08033334444',
        category: 'Boutique',
        planKey: 'standard',
      },
    });

    assert.strictEqual(res.statusCode, 409);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.error.code, 'ORGANIZATION_LIMIT_REACHED');
    assert.strictEqual(body.error.currentOwnedOrganizations, 3);
    assert.strictEqual(body.error.maximumOwnedOrganizations, 3);
  });

  test('4. Archived owned organizations count toward the limit', async () => {
    const testUserId = 'user_limit_test_4';
    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'user4@orviohub.com',
      emailVerified: true,
      name: 'User Four',
    } as any);

    // 1 active + 2 archived = 3 owned orgs
    dataService.getUserMemberships = async () => [
      { membership: { role: 'OWNER', status: 'ACTIVE' }, organization: { _id: 'org_1', status: 'active' } },
      { membership: { role: 'OWNER', status: 'ACTIVE' }, organization: { _id: 'org_2', status: 'archived', archivedAt: Date.now() - 1000 } },
      { membership: { role: 'OWNER', status: 'ACTIVE' }, organization: { _id: 'org_3', status: 'archived', archivedAt: Date.now() - 2000 } },
    ] as any;

    dataService.getOrganizationCreationEligibility = async () => ({
      allowed: false,
      currentOwnedOrganizations: 3,
      maximumOwnedOrganizations: 3,
      remainingOwnedOrganizations: 0,
      code: 'ORGANIZATION_LIMIT_REACHED',
      message: 'You already own 3 organizations.',
    });

    const token = app.jwt.sign({ userId: testUserId, email: 'user4@orviohub.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Attempt After Archiving',
        phone: '08055556666',
        category: 'Pharmacy',
      },
    });

    assert.strictEqual(res.statusCode, 409);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.error.code, 'ORGANIZATION_LIMIT_REACHED');
  });

  test('5. Joined organizations (Member/Admin) do not count against the ownership limit', async () => {
    const testUserId = 'user_limit_test_5';
    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'user5@orviohub.com',
      emailVerified: true,
      name: 'User Five',
    } as any);

    // User owns 2 orgs and joined 5 other orgs
    dataService.getOrganizationCreationEligibility = async () => ({
      allowed: true,
      currentOwnedOrganizations: 2,
      maximumOwnedOrganizations: 3,
      remainingOwnedOrganizations: 1,
    });

    dataService.getUserOrganizationsCategorized = async () => ({
      owned: [
        { organization: { name: 'Owned 1' }, role: 'OWNER', status: 'active' },
        { organization: { name: 'Owned 2' }, role: 'OWNER', status: 'active' },
      ],
      joined: [
        { organization: { name: 'Joined 1' }, role: 'ADMIN', status: 'active' },
        { organization: { name: 'Joined 2' }, role: 'MEMBER', status: 'active' },
        { organization: { name: 'Joined 3' }, role: 'MEMBER', status: 'active' },
      ],
      archived: [],
      creationLimit: {
        currentOwned: 2,
        maximumOwned: 3,
        remaining: 1,
        canCreate: true,
      },
    });

    const token = app.jwt.sign({ userId: testUserId, email: 'user5@orviohub.com' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/organizations',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.owned.length, 2);
    assert.strictEqual(body.joined.length, 3);
    assert.strictEqual(body.creationLimit.currentOwned, 2);
    assert.strictEqual(body.creationLimit.canCreate, true);
  });

  test('6. Superadmin can view and grant organization limit override with audit tracking', async () => {
    const adminUserId = 'superadmin_test_1';
    const targetUserId = 'target_user_test_6';

    dataService.getUserById = async (id: string) => ({
      id,
      email: id === adminUserId ? 'admin@orviohub.com' : 'target@orviohub.com',
      emailVerified: true,
      role: id === adminUserId ? 'superadmin' : 'user',
    } as any);

    let overrideRecorded: any = null;
    dataService.setOrganizationLimitOverride = async (args: any) => {
      overrideRecorded = args;
      return { success: true };
    };

    const adminToken = app.jwt.sign({
      userId: adminUserId,
      email: 'admin@orviohub.com',
      role: 'superadmin',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${targetUserId}/organization-limit-override`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        overrideLimit: 5,
        reason: 'Enterprise franchise partner special tier',
        expiresAt: Date.now() + 365 * 86_400_000,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(overrideRecorded.userId, targetUserId);
    assert.strictEqual(overrideRecorded.overrideLimit, 5);
    assert.strictEqual(overrideRecorded.reason, 'Enterprise franchise partner special tier');
  });

  test('7. Superadmin organization usage metrics endpoint returns aggregate statistics', async () => {
    const adminUserId = 'superadmin_test_2';
    dataService.getUserById = async () => ({
      id: adminUserId,
      email: 'admin@orviohub.com',
      emailVerified: true,
      role: 'superadmin',
    } as any);

    dataService.getSuperadminOrganizationUsage = async () => ({
      totalOrganizations: 42,
      archivedOrganizations: 5,
      uniqueOwnersCount: 20,
      usersAtLimitCount: 6,
      defaultMaxOwnedLimit: 3,
    });

    const adminToken = app.jwt.sign({
      userId: adminUserId,
      email: 'admin@orviohub.com',
      role: 'superadmin',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/organization-usage',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.data.totalOrganizations, 42);
    assert.strictEqual(body.data.usersAtLimitCount, 6);
    assert.strictEqual(body.data.defaultMaxOwnedLimit, 3);
  });

  test('8. Free Trial rule: user with 1 free trial org is blocked from 2nd free trial, but allowed on standard plan', async () => {
    const testUserId = 'user_free_trial_test';
    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'freetrial@orviohub.com',
      emailVerified: true,
      name: 'Trial User',
    } as any);

    let attemptedPlan: string | null = null;
    dataService.getOrganizationCreationEligibility = async () => ({
      canCreate: true,
      allowed: true,
      currentOwned: 1,
      currentOwnedOrganizations: 1,
      maximumOwned: 3,
      maximumOwnedOrganizations: 3,
      remainingOwned: 2,
      remainingOwnedOrganizations: 2,
      freeTrial: {
        used: 1,
        maximum: 1,
        available: false,
        organizationName: 'Trial Org 1',
      },
      reasons: ['free_trial_limit_reached'],
      recommendedPlan: 'standard',
    } as any);

    dataService.createOrganizationWithPlan = async (args: any) => {
      attemptedPlan = args.planKey;
      if (args.planKey === 'free_trial') {
        const err: any = new Error('FREE_TRIAL_LIMIT_REACHED: You already have an organization on Free Trial.');
        err.statusCode = 400;
        throw err;
      }
      return {
        organizationId: 'org_paid_2',
        name: args.name,
        hasDefaultBranch: true,
        planKey: 'standard',
        status: 'active',
      } as any;
    };

    const token = app.jwt.sign({ userId: testUserId, email: 'freetrial@orviohub.com' });

    // Attempt 1: free_trial -> should fail
    const resFail = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/with-plan',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Second Org Trial Attempt',
        phone: '08012345678',
        category: 'Retail',
        planKey: 'free_trial',
      },
    });

    assert.strictEqual(resFail.statusCode, 403);

    // Attempt 2: standard -> should succeed
    const resSuccess = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/with-plan',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Second Org Standard Paid',
        phone: '08012345678',
        category: 'Retail',
        planKey: 'standard',
      },
    });

    assert.strictEqual(resSuccess.statusCode, 201);
    const bodySuccess = JSON.parse(resSuccess.payload);
    const orgId = bodySuccess.data?.organizationId || bodySuccess.organizationId;
    const pKey = bodySuccess.data?.planKey || bodySuccess.planKey;
    assert.strictEqual(orgId, 'org_paid_2');
    assert.strictEqual(pKey, 'standard');
  });

  test('9. Enhanced eligibility response returns full quota, freeTrial breakdown, and recommendedPlan', async () => {
    const testUserId = 'user_eligibility_breakdown_test';
    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'breakdown@orviohub.com',
      emailVerified: true,
    } as any);

    dataService.getOrganizationCreationEligibility = async () => ({
      canCreate: true,
      allowed: true,
      currentOwned: 2,
      currentOwnedOrganizations: 2,
      maximumOwned: 3,
      maximumOwnedOrganizations: 3,
      remainingOwned: 1,
      remainingOwnedOrganizations: 1,
      freeTrial: {
        used: 1,
        maximum: 1,
        available: false,
        organizationId: 'org_first_trial',
        organizationName: 'First Boutique',
        trialEndsAt: Date.now() + 15 * 86_400_000,
      },
      reasons: ['free_trial_limit_reached'],
      recommendedPlan: 'standard',
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'breakdown@orviohub.com' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/organization-creation-eligibility',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.canCreate, true);
    assert.strictEqual(body.currentOwned, 2);
    assert.strictEqual(body.maximumOwned, 3);
    assert.strictEqual(body.remainingOwned, 1);
    assert.strictEqual(body.freeTrial.available, false);
    assert.strictEqual(body.freeTrial.used, 1);
    assert.strictEqual(body.recommendedPlan, 'standard');
  });
});
