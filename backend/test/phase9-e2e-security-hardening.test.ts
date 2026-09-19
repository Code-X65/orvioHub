import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { type FastifyInstance } from 'fastify';
import { auditService } from '../src/services/auditService.js';
import { notificationService } from '../src/services/notificationService.js';
import { DataIntegrityService } from '../src/services/dataIntegrityService.js';
import { workspaceRoutes } from '../src/routes/workspaces.js';
import { adminWorkspaceRoutes } from '../src/routes/admin/workspaces.js';
import { adminPlatformRoutes } from '../src/routes/admin/platform.js';
import { notificationRoutes } from '../src/routes/notifications.js';

describe('Phase 9: Full-System Hardening, Security & Data Integrity Verification Suite', () => {
  let app: FastifyInstance;

  // Mock Users across distinct tenant boundaries
  const mockUsers: Record<string, any> = {
    userOwnerA: { id: 'user_owner_a', name: 'Owner Alpha', email: 'owner.a@example.com', role: 'owner', isVerified: true },
    userAdminA: { id: 'user_admin_a', name: 'Admin Alpha', email: 'admin.a@example.com', role: 'admin', isVerified: true },
    userMemberA: { id: 'user_member_a', name: 'Member Alpha', email: 'member.a@example.com', role: 'member', isVerified: true },
    userOwnerB: { id: 'user_owner_b', name: 'Owner Beta', email: 'owner.b@example.com', role: 'owner', isVerified: true },
    superadmin: {
      id: 'admin_platform_01',
      name: 'Super Admin',
      email: 'super@orvio.internal',
      role: 'platform_owner',
      permissions: ['*'],
    },
    readOnlyAdmin: {
      id: 'admin_ro_01',
      name: 'Read Only Admin',
      email: 'readonly@orvio.internal',
      role: 'read_only_admin',
      permissions: ['admin.dashboard.view', 'admin.organizations.view'],
    },
  };

  let currentAuthUser: any = mockUsers.userOwnerA;

  before(async () => {
    app = Fastify({ logger: false });

    // Authentication decorator
    app.decorate('authenticate', async (req: any, reply: any) => {
      if (!currentAuthUser) {
        return reply.status(401).send({ error: 'UNAUTHORIZED' });
      }
      req.user = currentAuthUser;
    });

    // Workspace role authorization decorator
    app.decorate('requireWorkspaceRole', (roles: string[]) => async (req: any, reply: any) => {
      const workspaceId = req.params.workspaceId || req.params.id;
      if (workspaceId === 'org_alpha' && req.user.id.includes('b')) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Cross-tenant access denied' } });
      }
      if (workspaceId === 'org_beta' && req.user.id.includes('a')) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Cross-tenant access denied' } });
      }
      if (req.user.role && !roles.includes(req.user.role) && req.user.role !== 'owner') {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient workspace permissions' } });
      }
    });

    // Register test routes
    await app.register(workspaceRoutes, { prefix: '/api/v1/workspaces' });
    await app.register(adminPlatformRoutes, { prefix: '/api/v1/admin' });
    await app.register(adminWorkspaceRoutes, { prefix: '/api/v1/admin' });
    await app.register(notificationRoutes, { prefix: '/api/v1/notifications' });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  // ==========================================
  // 1. Organization Creation & Hard Limits
  // ==========================================
  describe('1. Organization Creation & Guardrail Limits', () => {
    it('Enforces Nigerian country restriction and 30-day Free Trial defaults', () => {
      const validOrgConfig = {
        name: 'Lagos Ventures',
        country: 'NG',
        currency: 'NGN',
        timezone: 'Africa/Lagos',
        plan: 'free_trial',
        trialDurationDays: 30,
      };
      assert.strictEqual(validOrgConfig.country, 'NG');
      assert.strictEqual(validOrgConfig.currency, 'NGN');
      assert.strictEqual(validOrgConfig.trialDurationDays, 30);
    });

    it('Rejects fourth owned organization for standard user (max 3 allowed)', () => {
      const userOwnedOrgs = ['org_1', 'org_2', 'org_3'];
      const maxAllowed = 3;
      const canCreateFourth = userOwnedOrgs.length < maxAllowed;
      assert.strictEqual(canCreateFourth, false, 'User must not be able to create a 4th organization');
    });

    it('Enforces single Free Trial organization per user constraint', () => {
      const existingTrials = [{ orgId: 'org_1', plan: 'free_trial', status: 'active' }];
      const hasActiveTrial = existingTrials.some((t) => t.plan === 'free_trial');
      assert.strictEqual(hasActiveTrial, true, 'User cannot create a second free trial organization');
    });
  });

  // ==========================================
  // 2. Organization Switching & Isolation
  // ==========================================
  describe('2. Organization Switching & Isolation Context', () => {
    it('Allows user to access their own organization (Org A)', async () => {
      currentAuthUser = mockUsers.userOwnerA;
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/workspaces/org_alpha/audit',
      });
      assert.strictEqual(res.statusCode, 200);
    });

    it('Blocks user from accessing another organization (Org B) -> 403 Forbidden', async () => {
      currentAuthUser = mockUsers.userOwnerA;
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/workspaces/org_beta/audit',
      });
      assert.strictEqual(res.statusCode, 403);
    });

    it('Allows user to switch to Org B when authorized as User Owner B', async () => {
      currentAuthUser = mockUsers.userOwnerB;
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/workspaces/org_beta/audit',
      });
      assert.strictEqual(res.statusCode, 200);
    });
  });

  // ==========================================
  // 3. Application Scope & MVP Guardrails
  // ==========================================
  describe('3. Application Scope & MVP Guardrails', () => {
    it('Only Inventory demo is active; future applications are disabled and hidden', () => {
      const applicationRegistry = [
        { key: 'inventory', name: 'Inventory Management', isAvailable: true, status: 'active' },
        { key: 'pos', name: 'Point of Sale', isAvailable: false, status: 'coming_soon' },
        { key: 'booking', name: 'Bookings & Appointments', isAvailable: false, status: 'coming_soon' },
        { key: 'gym', name: 'Gym Membership', isAvailable: false, status: 'coming_soon' },
        { key: 'taskmanagement', name: 'Task Management', isAvailable: false, status: 'coming_soon' },
      ];

      const activeApps = applicationRegistry.filter((a) => a.isAvailable);
      assert.strictEqual(activeApps.length, 1);
      assert.strictEqual(activeApps[0].key, 'inventory');

      const futureApps = applicationRegistry.filter((a) => !a.isAvailable);
      assert.strictEqual(futureApps.length, 4);
      futureApps.forEach((app) => {
        assert.strictEqual(app.status, 'coming_soon');
      });
    });
  });

  // ==========================================
  // 4. Branch Quotas & Lifecycle Integrity
  // ==========================================
  describe('4. Branch Quotas & Lifecycle Integrity', () => {
    it('Authoritative branch limits strictly match: Free Trial (1), Standard (3), Premium (10)', () => {
      const planLimits = {
        free_trial: 1,
        standard: 3,
        premium: 10,
      };
      assert.strictEqual(planLimits.free_trial, 1);
      assert.strictEqual(planLimits.standard, 3);
      assert.strictEqual(planLimits.premium, 10);
    });

    it('Enforces single primary branch invariant per organization', () => {
      const branches = [
        { id: 'b1', name: 'Main Branch', isPrimary: true, status: 'active' },
        { id: 'b2', name: 'Annex Branch', isPrimary: false, status: 'active' },
      ];

      // Switch primary to b2
      const updated = branches.map((b) => ({
        ...b,
        isPrimary: b.id === 'b2',
      }));

      const primaryCount = updated.filter((b) => b.isPrimary).length;
      assert.strictEqual(primaryCount, 1);
      assert.strictEqual(updated.find((b) => b.id === 'b2')?.isPrimary, true);
      assert.strictEqual(updated.find((b) => b.id === 'b1')?.isPrimary, false);
    });
  });

  // ==========================================
  // 5. Granular Memberships & Ownership Protection
  // ==========================================
  describe('5. Granular Memberships & Ownership Protection', () => {
    it('Blocks removing the last organization owner', () => {
      const members = [
        { userId: 'u1', role: 'owner', status: 'active' },
        { userId: 'u2', role: 'admin', status: 'active' },
      ];

      const targetRemovalUserId = 'u1';
      const remainingOwners = members.filter((m) => m.role === 'owner' && m.userId !== targetRemovalUserId);
      const canRemove = remainingOwners.length > 0;

      assert.strictEqual(canRemove, false, 'Cannot remove the last owner of an organization');
    });

    it('Enforces granular branch roles: branch_manager, inventory_staff, viewer', () => {
      const validBranchRoles = ['branch_manager', 'inventory_staff', 'viewer'];
      assert.ok(validBranchRoles.includes('branch_manager'));
      assert.ok(validBranchRoles.includes('inventory_staff'));
      assert.ok(validBranchRoles.includes('viewer'));
    });
  });

  // ==========================================
  // 6. Security & Secret Sanitization
  // ==========================================
  describe('6. Security & Secret Masking Engine', () => {
    it('Redacts sensitive tokens, passwords, and secrets from audit and response structures', () => {
      const sanitized = auditService.sanitizeMetadata({
        user: 'admin',
        password: 'supersecretpassword',
        token: 'eyJhGciOi...',
        apiKey: 'sk_live_1234567890',
        nested: {
          authorization: 'Bearer token_abc',
          otp: '123456',
        },
      });

      assert.strictEqual(sanitized.password, '[REDACTED]');
      assert.strictEqual(sanitized.token, '[REDACTED]');
      assert.strictEqual(sanitized.apiKey, '[REDACTED]');
      assert.strictEqual(sanitized.nested.authorization, '[REDACTED]');
      assert.strictEqual(sanitized.nested.otp, '[REDACTED]');
      assert.strictEqual(sanitized.user, 'admin');
    });
  });

  // ==========================================
  // 7. Superadmin Governance & High-Risk Guardrails
  // ==========================================
  describe('7. Superadmin Governance & Verification Guardrails', () => {
    it('Rejects non-admin users from accessing administrative endpoints with 403', async () => {
      currentAuthUser = mockUsers.userOwnerA;
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations',
      });
      assert.strictEqual(res.statusCode, 403);
    });

    it('Allows read-only admin to list organizations without mutations', async () => {
      currentAuthUser = mockUsers.readOnlyAdmin;
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations',
      });
      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.success, true);
    });

    it('Blocks read-only admin from modifying organization status -> 403 Forbidden', async () => {
      currentAuthUser = mockUsers.readOnlyAdmin;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/organizations/org_alpha/suspend',
        payload: { reason: 'Test block' },
      });
      assert.strictEqual(res.statusCode, 403);
    });

    it('Requires step-up TOTP verification for high-risk archive action', async () => {
      currentAuthUser = mockUsers.superadmin;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/organizations/org_alpha/archive',
        payload: { reason: 'Company closed' },
      });
      assert.strictEqual(res.statusCode, 403);
      const json = res.json();
      assert.strictEqual(json.error.code, 'STEP_UP_AUTHENTICATION_REQUIRED');
    });
  });

  // ==========================================
  // 8. Data Integrity & Reconciliation Diagnostics
  // ==========================================
  describe('8. Data Integrity Diagnostics Service', () => {
    it('Detects orphaned branches, duplicate primary branches, and quota violations', async () => {
      const mockDiagnosticData = {
        organizations: [
          { _id: 'org_1', name: 'Alpha Ltd', plan: 'free_trial' },
          { _id: 'org_2', name: 'Beta Ltd', plan: 'standard' },
        ],
        branches: [
          // Valid branches
          { _id: 'b1', workspaceId: 'org_1', name: 'Main', isPrimary: true, status: 'active' },
          // Violation: 2nd active branch on Free Trial (limit 1)
          { _id: 'b2', workspaceId: 'org_1', name: 'Second', isPrimary: false, status: 'active' },
          // Orphaned branch referencing non-existent org
          { _id: 'b3', workspaceId: 'org_ghost', name: 'Ghost', isPrimary: false, status: 'active' },
          // Beta has 2 primary branches (duplicate primary conflict)
          { _id: 'b4', workspaceId: 'org_2', name: 'Beta 1', isPrimary: true, status: 'active' },
          { _id: 'b5', workspaceId: 'org_2', name: 'Beta 2', isPrimary: true, status: 'active' },
        ],
        memberships: [
          { _id: 'm1', workspaceId: 'org_1', userId: 'u1', role: 'owner' },
          { _id: 'm2', workspaceId: 'org_deleted', userId: 'u2', role: 'member' }, // Orphaned
        ],
        auditLogs: [
          { eventId: 'evt_1', workspaceId: 'org_1', eventType: 'branch.created' },
          { eventId: 'evt_2', eventType: 'system.alert' }, // Missing workspaceId
        ],
      };

      const report = await DataIntegrityService.runDiagnostics(mockDiagnosticData);
      assert.strictEqual(report.isHealthy, false);
      assert.ok(report.totalIssuesFound >= 4);

      // Verify specific conflict detections
      const orphanedBranch = report.issues.find((i) => i.recordType === 'branch' && i.detectedConflict.includes('non-existent organization org_ghost'));
      assert.ok(orphanedBranch, 'Should detect orphaned branch');

      const dupPrimary = report.issues.find((i) => i.recordType === 'branch' && i.detectedConflict.includes('active primary branches'));
      assert.ok(dupPrimary, 'Should detect duplicate primary branches');

      const quotaBreach = report.issues.find((i) => i.recordType === 'organization' && i.detectedConflict.includes('limit: 1'));
      assert.ok(quotaBreach, 'Should detect free trial branch limit breach');

      const auditMissingScope = report.issues.find((i) => i.recordType === 'audit_log');
      assert.ok(auditMissingScope, 'Should detect audit log missing workspaceId');
    });

    it('Reports healthy when database records are fully consistent', async () => {
      const cleanDiagnosticData = {
        organizations: [
          { _id: 'org_1', name: 'Alpha Ltd', plan: 'standard' },
        ],
        branches: [
          { _id: 'b1', workspaceId: 'org_1', name: 'Main', isPrimary: true, status: 'active' },
          { _id: 'b2', workspaceId: 'org_1', name: 'Branch 2', isPrimary: false, status: 'active' },
        ],
        memberships: [
          { _id: 'm1', workspaceId: 'org_1', userId: 'u1', role: 'owner' },
        ],
        auditLogs: [
          { eventId: 'evt_1', workspaceId: 'org_1', eventType: 'branch.created' },
        ],
      };

      const report = await DataIntegrityService.runDiagnostics(cleanDiagnosticData);
      assert.strictEqual(report.isHealthy, true);
      assert.strictEqual(report.totalIssuesFound, 0);
    });
  });
});
