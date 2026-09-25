import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { applications, getAllowedHosts, resolveHost } from '@orviohub/shared';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('Architecture & Inconsistency Remediations (Section 3)', () => {
  let app: FastifyInstance;

  before(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  describe('3.1 Application Type Classification & Launcher Subdomain', () => {
    it('properly distinguishes subdomain apps vs path-based apps', () => {
      // Subdomain-per-application
      assert.equal(applications.accounts.type, 'subdomain');
      assert.equal(applications.accounts.subdomain, 'account');

      assert.equal(applications.home.type, 'subdomain');
      assert.equal(applications.home.subdomain, 'home');

      assert.equal(applications.launcher.type, 'subdomain');
      assert.equal(applications.launcher.subdomain, 'app');
      assert.ok(applications.launcher.developmentUrl.includes('app.orviohub.localhost'));
      assert.equal(applications.launcher.productionUrl, 'https://app.orviohub.com');

      assert.equal(applications.inventory.type, 'subdomain');
      assert.equal(applications.inventory.subdomain, 'inventory');

      assert.equal(applications.billing.type, 'subdomain');
      assert.equal(applications.billing.subdomain, 'billing');

      assert.equal(applications.taskmanagement.type, 'subdomain');
      assert.equal(applications.taskmanagement.subdomain, 'taskmanagement');

      // Path-per-application on shared subdomains
      assert.equal(applications.pos.type, 'path');
      assert.equal(applications.pos.subdomain, 'inventory');
      assert.equal(applications.pos.path, '/pos');
      assert.equal(applications.pos.productionUrl, 'https://inventory.orviohub.com/pos');

      assert.equal(applications.booking.type, 'path');
      assert.equal(applications.booking.subdomain, 'home');
      assert.equal(applications.booking.path, '/apps/booking');
      assert.equal(applications.booking.productionUrl, 'https://home.orviohub.com/apps/booking');

      assert.equal(applications.gym.type, 'path');
      assert.equal(applications.gym.subdomain, 'home');
      assert.equal(applications.gym.path, '/apps/gym');
      assert.equal(applications.gym.productionUrl, 'https://home.orviohub.com/apps/gym');
    });
  });

  describe('3.2 Elimination of Duplicate task_management Key', () => {
    it('has removed task_management and retains only taskmanagement', () => {
      assert.equal((applications as any).task_management, undefined);
      assert.ok(applications.taskmanagement);
      assert.equal(applications.taskmanagement.key, 'taskmanagement');
      assert.equal(applications.taskmanagement.subdomain, 'taskmanagement');
    });
  });

  describe('3.3 Canonical /api/v1 Prefix & Legacy /v1 Rewrite', () => {
    it('serves canonical /api/v1/auth endpoints directly', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: {
          'x-request-host': 'account.orviohub.localhost:3000',
        },
        payload: {
          email: 'invalid@example.com',
          password: 'Password123!',
        },
      });

      // Validating route was matched and processed by auth handler (e.g. 401 or validation error)
      assert.ok(res.statusCode === 401 || res.statusCode === 400);
      const body = JSON.parse(res.body);
      assert.equal(body.success, false);
    });

    it('redirects legacy /v1/auth POST requests with 308 Permanent Redirect to /api/v1/auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        headers: {
          'x-request-host': 'account.orviohub.localhost:3000',
        },
        payload: {
          email: 'invalid@example.com',
          password: 'Password123!',
        },
      });

      assert.equal(res.statusCode, 308);
      assert.equal(res.headers.location, '/api/v1/auth/login');
    });

    it('redirects legacy /v1/entitlements GET requests with 301 Moved Permanently to /api/v1/entitlements', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/entitlements/features',
        headers: {
          'x-request-host': 'inventory.orviohub.localhost:3000',
        },
      });

      assert.equal(res.statusCode, 301);
      assert.equal(res.headers.location, '/api/v1/entitlements/features');
    });
  });

  describe('3.4 Vite allowedHosts Dynamic Generation', () => {
    it('generates allowed hosts covering all registered applications and subdomains', () => {
      const hosts = getAllowedHosts();
      assert.ok(Array.isArray(hosts));
      assert.ok(hosts.includes('orviohub.localhost'));
      assert.ok(hosts.includes('.orviohub.localhost'));
      assert.ok(hosts.includes('account.orviohub.localhost'));
      assert.ok(hosts.includes('accounts.orviohub.localhost'));
      assert.ok(hosts.includes('home.orviohub.localhost'));
      assert.ok(hosts.includes('app.orviohub.localhost'));
      assert.ok(hosts.includes('inventory.orviohub.localhost'));
      assert.ok(hosts.includes('billing.orviohub.localhost'));
      assert.ok(hosts.includes('taskmanagement.orviohub.localhost'));
      assert.ok(hosts.includes('preprod.orviohub.com'));
      assert.ok(hosts.includes('.preprod.orviohub.com'));
      assert.ok(hosts.includes('orviohub.vercel.app'));
      assert.ok(hosts.includes('orviohub.com'));
      assert.ok(hosts.includes('.orviohub.com'));
    });
  });
});
