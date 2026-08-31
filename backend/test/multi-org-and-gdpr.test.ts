import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { ERROR_CODES } from '../src/config/constants.js';

describe('Multi-Org Management and GDPR Account Deletion Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGetUserById = dataService.getUserById;
  const originalGetUserMemberships = dataService.getUserMemberships;
  const originalLeaveOrganization = dataService.leaveOrganization;
  const originalExportUserData = dataService.exportUserData;
  const originalDeleteUserAccount = dataService.deleteUserAccount;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    dataService.getUserById = originalGetUserById;
    dataService.getUserMemberships = originalGetUserMemberships;
    dataService.leaveOrganization = originalLeaveOrganization;
    dataService.exportUserData = originalExportUserData;
    dataService.deleteUserAccount = originalDeleteUserAccount;
  });

  test('1. GET /api/v1/organizations lists all memberships for authenticated user', async () => {
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'member@example.com',
      name: 'Multi Org Member',
      emailVerified: true,
      tokenVersion: 0,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.getUserMemberships = async () => [
      {
        organization: {
          id: 'org_1',
          name: 'Acme Corp',
          slug: 'acme-corp',
          industry: 'Tech',
          country: 'US',
          timezone: 'UTC',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        membership: {
          id: 'mem_1',
          organizationId: 'org_1',
          userId: 'user_multi',
          role: 'OWNER' as const,
          status: 'ACTIVE' as const,
          joinedAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      {
        organization: {
          id: 'org_2',
          name: 'Beta Global',
          slug: 'beta-global',
          industry: 'Finance',
          country: 'UK',
          timezone: 'UTC',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        membership: {
          id: 'mem_2',
          organizationId: 'org_2',
          userId: 'user_multi',
          role: 'MEMBER' as const,
          status: 'ACTIVE' as const,
          joinedAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    ];

    const token = app.jwt.sign({ userId: 'user_multi', email: 'member@example.com', tokenVersion: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/organizations',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.memberships.length, 2);
    assert.equal(body.data.memberships[0].organization.name, 'Acme Corp');
    assert.equal(body.data.memberships[1].organization.name, 'Beta Global');
  });

  test('2. POST /api/v1/organizations/:id/leave allows leaving an organization', async () => {
    let leftOrgId: string | undefined;
    let leftUserId: string | undefined;

    dataService.getUserById = async (id: string) => ({
      id,
      email: 'member@example.com',
      name: 'Org Member',
      emailVerified: true,
      tokenVersion: 0,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.leaveOrganization = async (orgId: string, userId: string) => {
      leftOrgId = orgId;
      leftUserId = userId;
      return { success: true };
    };

    const token = app.jwt.sign({ userId: 'user_leave', email: 'member@example.com', tokenVersion: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/org_leave_123/leave',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(leftOrgId, 'org_leave_123');
    assert.equal(leftUserId, 'user_leave');
  });

  test('3. POST /api/v1/organizations/:id/leave returns 400 when sole owner attempts to leave without transferring ownership', async () => {
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'soleowner@example.com',
      name: 'Sole Owner',
      emailVerified: true,
      tokenVersion: 0,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.leaveOrganization = async () => {
      const err: Error & { code?: string } = new Error('You are the sole Owner.');
      err.code = 'OWNER_CANNOT_LEAVE';
      throw err;
    };

    const token = app.jwt.sign({ userId: 'user_owner', email: 'soleowner@example.com', tokenVersion: 0 });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/org_sole_owner/leave',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.FORBIDDEN);
  });

  test('4. GET /api/v1/auth/account/export returns complete personal GDPR archive', async () => {
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'gdpr@example.com',
      name: 'GDPR User',
      emailVerified: true,
      tokenVersion: 0,
      status: 'ACTIVE',
      createdAt: 1000,
      updatedAt: 2000,
    });

    dataService.exportUserData = async (userId: string) => ({
      user: {
        id: userId,
        email: 'gdpr@example.com',
        name: 'GDPR User',
        emailVerified: true,
        status: 'ACTIVE',
        createdAt: 1000,
        updatedAt: 2000,
      },
      identities: [],
      organizations: [
        {
          organization: { id: 'org_1', name: 'GDPR Org', slug: 'gdpr-org', industry: 'Tech', country: 'DE' },
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: 1000,
        },
      ],
      onboarding: { status: 'COMPLETED', currentStep: 'COMPLETED' },
      activityHistory: [],
      exportGeneratedAt: 3000,
    });

    const token = app.jwt.sign({ userId: 'user_gdpr', email: 'gdpr@example.com', tokenVersion: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/account/export',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(res.statusCode, 200);
    assert.ok(res.headers['content-disposition']?.includes('attachment; filename="orvio-user-data.json"'));
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.data.user.email, 'gdpr@example.com');
    assert.equal(body.data.organizations.length, 1);
  });

  test('5. DELETE /api/v1/auth/account deletes user account with password verification', async () => {
    let deletedUserId: string | undefined;

    dataService.getUserById = async (id: string) => ({
      id,
      email: 'delete@example.com',
      name: 'To Delete',
      emailVerified: true,
      tokenVersion: 0,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.deleteUserAccount = async (userId: string) => {
      deletedUserId = userId;
      return { success: true };
    };

    const token = app.jwt.sign({ userId: 'user_del', email: 'delete@example.com', tokenVersion: 0 });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/account',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        password: 'ValidPassword123!',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(deletedUserId, 'user_del');
  });

  test('6. DELETE /api/v1/auth/account returns 401 on incorrect password', async () => {
    dataService.getUserById = async (id: string) => ({
      id,
      email: 'delete@example.com',
      name: 'To Delete',
      emailVerified: true,
      tokenVersion: 0,
      status: 'ACTIVE',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    dataService.deleteUserAccount = async () => {
      const err: Error & { code?: string } = new Error('Incorrect password.');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    };

    const token = app.jwt.sign({ userId: 'user_del', email: 'delete@example.com', tokenVersion: 0 });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/auth/account',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        password: 'WrongPassword!',
      },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, false);
    assert.equal(body.error.code, ERROR_CODES.INVALID_CREDENTIALS);
  });
});
