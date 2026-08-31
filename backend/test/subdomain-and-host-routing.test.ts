import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import {
  resolveHost,
  UnknownHostError,
  getApplicationUrl,
  getLoginUrl,
  isValidReturnUrl,
  applications,
} from '@orviohub/shared';

describe('Orviohub Subdomain & Hostname Resolution System', () => {
  describe('1. Production Hostname Resolution', () => {
    it('resolves production marketing domain', () => {
      const ctx = resolveHost('orviohub.com');
      assert.equal(ctx.application, 'marketing');
      assert.equal(ctx.environment, 'production');
    });

    it('resolves production accounts domain', () => {
      const ctx = resolveHost('accounts.orviohub.com');
      assert.equal(ctx.application, 'accounts');
      assert.equal(ctx.environment, 'production');
    });

    it('resolves production launcher domain', () => {
      const ctx = resolveHost('app.orviohub.com');
      assert.equal(ctx.application, 'launcher');
      assert.equal(ctx.environment, 'production');
    });

    it('resolves production inventory domain', () => {
      const ctx = resolveHost('inventory.orviohub.com');
      assert.equal(ctx.application, 'inventory');
      assert.equal(ctx.environment, 'production');
    });

    it('resolves production taskmanagement domain', () => {
      const ctx = resolveHost('taskmanagement.orviohub.com');
      assert.equal(ctx.application, 'taskmanagement');
      assert.equal(ctx.environment, 'production');
    });

    it('rejects unknown or workspace-like subdomains (e.g. acme.orviohub.com)', () => {
      assert.throws(() => resolveHost('acme.orviohub.com'), UnknownHostError);
      assert.throws(() => resolveHost('codexstores.orviohub.com'), UnknownHostError);
    });
  });

  describe('2. Development Subdomain Resolution', () => {
    it('resolves development root domain orviohub.localhost', () => {
      const ctx = resolveHost('orviohub.localhost:4000');
      assert.equal(ctx.application, 'marketing');
      assert.equal(ctx.environment, 'development');
    });

    it('resolves development accounts subdomain', () => {
      const ctx = resolveHost('accounts.orviohub.localhost:4000');
      assert.equal(ctx.application, 'accounts');
      assert.equal(ctx.environment, 'development');
    });

    it('resolves development inventory subdomain', () => {
      const ctx = resolveHost('inventory.orviohub.localhost:4000');
      assert.equal(ctx.application, 'inventory');
      assert.equal(ctx.environment, 'development');
    });

    it('resolves development launcher subdomain', () => {
      const ctx = resolveHost('app.orviohub.localhost:4000');
      assert.equal(ctx.application, 'launcher');
      assert.equal(ctx.environment, 'development');
    });

    it('handles uppercase hostnames and port stripping', () => {
      const ctx = resolveHost('INVENTORY.ORVIOHUB.LOCALHOST:4000');
      assert.equal(ctx.application, 'inventory');
    });
  });

  describe('3. URL Helpers & Return-To Allowlist Validation', () => {
    it('generates correct application URLs', () => {
      assert.equal(
        getApplicationUrl('inventory', 'production'),
        'https://inventory.orviohub.com'
      );
      assert.equal(
        getApplicationUrl('accounts', 'production'),
        'https://accounts.orviohub.com'
      );
      assert.equal(
        getLoginUrl('https://inventory.orviohub.com/dashboard', 'production'),
        'https://accounts.orviohub.com/login?returnTo=https%3A%2F%2Finventory.orviohub.com%2Fdashboard'
      );
    });

    it('validates returnTo URLs against allowlist and prevents open redirects', () => {
      assert.equal(isValidReturnUrl('https://inventory.orviohub.com/dashboard', 'production'), true);
      assert.equal(isValidReturnUrl('https://app.orviohub.com', 'production'), true);
      assert.equal(isValidReturnUrl('/dashboard', 'production'), true);

      // Malicious or open redirects rejected
      assert.equal(isValidReturnUrl('https://evil-phishing-site.com', 'production'), false);
      assert.equal(isValidReturnUrl('https://attacker.orviohub.com.attacker.com', 'production'), false);
      assert.equal(isValidReturnUrl('javascript:alert(1)', 'production'), false);
    });
  });

  describe('4. Fastify Host-Context & Health Endpoints', () => {
    it('returns host context from /v1/host-context', async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: 'GET',
        url: '/v1/host-context',
        headers: {
          host: 'inventory.orviohub.com',
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.status, 'ok');
      assert.equal(json.hostContext.application, 'inventory');
      await app.close();
    });

    it('exposes /ready and /version health checks', async () => {
      const app = await buildApp();
      const readyRes = await app.inject({ method: 'GET', url: '/ready' });
      assert.equal(readyRes.statusCode, 200);
      assert.equal(JSON.parse(readyRes.body).status, 'ready');

      const versionRes = await app.inject({ method: 'GET', url: '/version' });
      assert.equal(versionRes.statusCode, 200);
      assert.equal(JSON.parse(versionRes.body).version, '1.0.0');
      await app.close();
    });

    it('rejects unauthorized or unknown subdomains on request hook', async () => {
      const app = await buildApp();
      const badRes = await app.inject({
        method: 'GET',
        url: '/v1/host-context',
        headers: {
          host: 'unauthorized-subdomain.orviohub.com',
        },
      });

      assert.equal(badRes.statusCode, 400);
      const json = JSON.parse(badRes.body);
      assert.equal(json.error, 'Bad Request');
      await app.close();
    });
  });
});
