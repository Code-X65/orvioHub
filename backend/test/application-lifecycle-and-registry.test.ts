import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { dataService } from '../src/services/dataService.js';
import {
  getApplicationUrl,
  applications,
  type ApplicationKey,
} from '@orviohub/shared';

describe('Application Management: P1 (Registry & URLs) & P2 (Lifecycle & Deactivation) Test Suite', () => {
  let app: FastifyInstance;
  const testUserId = 'test_owner_user_id';
  const testOrgId = 'test_org_app_lifecycle';

  const originalGetUserById = dataService.getUserById;
  const originalActivateApplication = dataService.activateApplication;
  const originalDeactivateApplication = dataService.deactivateApplication;
  const originalGetOrganizationApps = dataService.getOrganizationApps;
  const originalGetOrganizationWorkspaces = dataService.getOrganizationWorkspaces;

  before(async () => {
    app = await buildApp();
    await app.ready();

    dataService.getUserById = async (id: string) => ({
      id,
      email: 'owner@business.localhost',
      name: 'Business Owner',
      emailVerified: true,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

    dataService.createSession = async () => ({
      sessionId: 'sess_test_app',
      refreshToken: 'refresh_test_app',
    } as any);

    dataService.logAudit = async () => ({} as any);
    dataService.getOrganizationWorkspaces = async () => [] as any;
  });

  after(async () => {
    dataService.getUserById = originalGetUserById;
    dataService.activateApplication = originalActivateApplication;
    dataService.deactivateApplication = originalDeactivateApplication;
    dataService.getOrganizationApps = originalGetOrganizationApps;
    dataService.getOrganizationWorkspaces = originalGetOrganizationWorkspaces;
    await app.close();
  });

  const getAuthHeaders = () => {
    const token = app.jwt.sign({
      userId: testUserId,
      email: 'owner@business.localhost',
    });
    return {
      authorization: `Bearer ${token}`,
    };
  };

  // ==========================================
  // P1: APPLICATION REGISTRY & URL RESOLUTION
  // ==========================================
  describe('P1: Application Registry & URL Resolution', () => {
    test('all applications (pos, booking, gym, taskmanagement, inventory, billing, etc.) are registered in shared', () => {
      const expectedKeys: ApplicationKey[] = [
        'marketing',
        'accounts',
        'home',
        'launcher',
        'inventory',
        'pos',
        'booking',
        'gym',
        'billing',
        'taskmanagement',
      ];

      for (const key of expectedKeys) {
        assert.ok(applications[key], `Application "${key}" must be registered in applications object`);
        assert.strictEqual(applications[key].key, key);
        assert.strictEqual(applications[key].enabled, true);
      }
    });

    test('getApplicationUrl generates valid URLs for all registered applications without throwing', () => {
      const keys: ApplicationKey[] = [
        'marketing',
        'accounts',
        'home',
        'launcher',
        'inventory',
        'pos',
        'booking',
        'gym',
        'billing',
        'taskmanagement',
      ];

      for (const key of keys) {
        const devUrl = getApplicationUrl(key, 'development', '/dashboard');
        assert.ok(devUrl.includes('orviohub.localhost'), `Dev URL for ${key} should target orviohub.localhost: ${devUrl}`);

        const prodUrl = getApplicationUrl(key, 'production', '/dashboard');
        assert.ok(prodUrl.startsWith('https://'), `Prod URL for ${key} should start with https: ${prodUrl}`);
      }
    });

    test('getApplicationUrl falls back gracefully when an unknown key is passed instead of crashing', () => {
      const fallbackUrl = getApplicationUrl('nonexistent_key' as any, 'development', '/dashboard');
      assert.ok(typeof fallbackUrl === 'string' && fallbackUrl.length > 0);
      assert.ok(fallbackUrl.includes('orviohub.localhost'));
    });
  });

  // ==========================================
  // P2: APPLICATION LIFECYCLE & DEACTIVATION
  // ==========================================
  describe('P2: Application Lifecycle & Deactivation Endpoints', () => {
    test('POST /api/v1/organizations/:id/applications/:key/activate calls dataService.activateApplication', async () => {
      let passedArgs: any = null;
      dataService.activateApplication = async (args: any) => {
        passedArgs = args;
        return {
          success: true,
          orgApplicationId: 'org_app_123',
          applicationId: 'app_inv',
          applicationKey: args.applicationKey,
          status: 'active',
          planId: args.planKey || 'free_trial',
        };
      };

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${testOrgId}/applications/inventory/activate`,
        headers: getAuthHeaders(),
        payload: {
          planKey: 'free_trial',
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.status, 'active');
      assert.strictEqual(passedArgs.organizationId, testOrgId);
      assert.strictEqual(passedArgs.applicationKey, 'inventory');
    });

    test('POST /api/v1/organizations/:id/applications/:key/deactivate successfully deactivates an active application', async () => {
      let passedArgs: any = null;
      dataService.deactivateApplication = async (args: any) => {
        passedArgs = args;
        return {
          success: true,
          orgApplicationId: 'org_app_123',
          applicationId: 'app_inv',
          applicationKey: args.applicationKey,
          status: 'inactive',
        };
      };

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${testOrgId}/applications/inventory/deactivate`,
        headers: getAuthHeaders(),
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.status, 'inactive');
      assert.strictEqual(passedArgs.organizationId, testOrgId);
      assert.strictEqual(passedArgs.applicationKey, 'inventory');
    });

    test('DELETE /api/v1/organizations/:id/applications/:key functions as deactivation alias', async () => {
      let passedArgs: any = null;
      dataService.deactivateApplication = async (args: any) => {
        passedArgs = args;
        return {
          success: true,
          orgApplicationId: 'org_app_123',
          applicationId: 'app_inv',
          applicationKey: args.applicationKey,
          status: 'inactive',
        };
      };

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${testOrgId}/applications/inventory`,
        headers: getAuthHeaders(),
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.status, 'inactive');
      assert.strictEqual(passedArgs.applicationKey, 'inventory');
    });

    test('POST /.../deactivate returns 403 when user lacks permissions', async () => {
      dataService.deactivateApplication = async () => {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      };

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${testOrgId}/applications/inventory/deactivate`,
        headers: getAuthHeaders(),
      });

      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, false);
      assert.ok(body.error.message.includes('Owners, Admins, or Managers'));
    });

    test('POST /.../deactivate returns 400 when application was never activated', async () => {
      dataService.deactivateApplication = async () => {
        throw new Error('APPLICATION_NOT_ACTIVATED');
      };

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${testOrgId}/applications/gym/deactivate`,
        headers: getAuthHeaders(),
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'APPLICATION_NOT_ACTIVATED');
    });

    test('POST /.../deactivate returns 404 when organization is not found', async () => {
      dataService.deactivateApplication = async () => {
        throw new Error('ORGANIZATION_NOT_FOUND');
      };

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/unknown_org/applications/inventory/deactivate`,
        headers: getAuthHeaders(),
      });

      assert.strictEqual(res.statusCode, 404);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, false);
    });
  });
});
