import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { totpService } from '../src/services/totp.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 5: Security Hardening, Governance & Audit Logging Test Suite', () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let ownerEmail: string;
  let ownerUserId: string;
  let ownerSessionId: string;

  let memberToken: string;
  let memberEmail: string;
  let memberUserId: string;

  let orgId: string;
  let twoFactorSecret: string;
  let secondSessionId: string;

  before(async () => {
    app = await buildApp();
    await app.ready();

    const timestamp = Date.now();

    // 1. Create verified Owner User
    ownerEmail = `sec_owner_${timestamp}@security-test.com`;
    const { user: ownerUser } = await dataService.createUser({
      name: 'Security Admin',
      email: ownerEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    ownerUserId = ownerUser.id;

    const ownerSession = await dataService.createSession(ownerUser.id, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
      ipAddress: '192.168.1.100',
      authenticationMethod: 'password',
      tokenVersion: ownerUser.tokenVersion ?? 1,
    });
    ownerSessionId = ownerSession.sessionId;

    ownerToken = app.jwt.sign({
      userId: ownerUser.id,
      email: ownerUser.email,
      sessionId: ownerSession.sessionId,
      tokenVersion: ownerUser.tokenVersion ?? 1,
    });

    // 2. Create verified Member User
    memberEmail = `sec_member_${timestamp}@security-test.com`;
    const { user: memberUser } = await dataService.createUser({
      name: 'Regular Member',
      email: memberEmail,
      password: 'Password123!',
      emailVerified: true,
    });
    memberUserId = memberUser.id;

    const memberSession = await dataService.createSession(memberUser.id, {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ipAddress: '192.168.1.105',
      authenticationMethod: 'password',
      tokenVersion: memberUser.tokenVersion ?? 1,
    });

    memberToken = app.jwt.sign({
      userId: memberUser.id,
      email: memberUser.email,
      sessionId: memberSession.sessionId,
      tokenVersion: memberUser.tokenVersion ?? 1,
    });

    // 3. Create Organization
    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'CyberShield Africa',
        industry: 'Software & Technology',
        country: 'NG',
        currency: 'NGN',
        timezone: 'Africa/Lagos',
      },
    });
    const orgBody = JSON.parse(orgRes.payload);
    orgId = orgBody.data.organization.id;
  });

  after(async () => {
    await app.close();
  });

  test('1. Two-Factor Authentication (TOTP): Full Setup, Verification & Disable Lifecycle', async () => {
    // 1a. Start 2FA setup
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/2fa/enable-start',
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.strictEqual(startRes.statusCode, 200);
    const startBody = JSON.parse(startRes.payload);
    assert.strictEqual(startBody.success, true);
    assert.ok(startBody.data.secret);
    assert.ok(startBody.data.otpauthUrl.startsWith('otpauth://totp/'));

    twoFactorSecret = startBody.data.secret;

    // 1b. Verify 2FA with generated TOTP code
    const validTotpCode = totpService.generateTotpCode(twoFactorSecret);
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/2fa/enable-verify',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { code: validTotpCode },
    });

    assert.strictEqual(verifyRes.statusCode, 200);
    const verifyBody = JSON.parse(verifyRes.payload);
    assert.strictEqual(verifyBody.success, true);
    assert.ok(Array.isArray(verifyBody.data.backupCodes));
    assert.strictEqual(verifyBody.data.backupCodes.length, 8);

    // 1c. Verify profile reflects 2FA active
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    const meBody = JSON.parse(meRes.payload);
    assert.strictEqual(meBody.data.user.twoFactorEnabled, true);

    // 1d. Disable 2FA with password confirmation
    const disableFail = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/2fa/disable',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { password: 'WrongPassword!' },
    });
    assert.strictEqual(disableFail.statusCode, 401);

    const disableSuccess = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/2fa/disable',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { password: 'Password123!' },
    });
    assert.strictEqual(disableSuccess.statusCode, 200);
  });

  test('2. Active Sessions Vault: Device Inspector & Remote Termination', async () => {
    // Create a second session (e.g. mobile device)
    const secondSession = await dataService.createSession(ownerUserId, {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      ipAddress: '102.89.45.12',
      authenticationMethod: 'password',
      tokenVersion: 1,
    });
    secondSessionId = secondSession.sessionId;

    // List active sessions
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/sessions',
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.strictEqual(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.payload);
    assert.ok(Array.isArray(listBody.data.sessions));
    assert.ok(listBody.data.sessions.length >= 2);

    const currentSession = listBody.data.sessions.find((s: any) => s.id === ownerSessionId);
    assert.ok(currentSession);
    assert.strictEqual(currentSession.isCurrent, true);

    // Revoke the mobile session
    const revokeRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/users/me/sessions/${secondSessionId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(revokeRes.statusCode, 200);

    // Revoke all other sessions
    const revokeAllRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/me/sessions',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(revokeAllRes.statusCode, 200);
  });

  test('3. Organization Audit Trail Explorer: Query, Action Filtering & Tenant Isolation', async () => {
    // Create workspace to generate audit logs
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/workspaces`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Abuja Regional Branch',
        slug: `abuja-${Date.now()}`,
      },
    });

    // Query audit logs as Owner
    const auditRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/audit-logs?limit=10`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.strictEqual(auditRes.statusCode, 200);
    const auditBody = JSON.parse(auditRes.payload);
    assert.strictEqual(auditBody.success, true);
    assert.ok(Array.isArray(auditBody.data.logs));
    assert.ok(auditBody.data.logs.length >= 1);

    // Query via alias
    const aliasRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/audit-log?limit=10`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(aliasRes.statusCode, 200);

    // Outsider/unauthorized member cannot view audit logs
    const failRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/audit-logs`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert.strictEqual(failRes.statusCode, 403);
  });

  test('4. NDPR / GDPR Data Export: Complete Account & Activity Package', async () => {
    const exportRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/export',
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    assert.strictEqual(exportRes.statusCode, 200);
    const exportBody = JSON.parse(exportRes.payload);
    assert.strictEqual(exportBody.success, true);
    assert.ok(exportBody.data.user);
    assert.strictEqual(exportBody.data.user.email, ownerEmail);
    assert.ok(Array.isArray(exportBody.data.memberships));
    assert.ok(Array.isArray(exportBody.data.identities));
  });
});
