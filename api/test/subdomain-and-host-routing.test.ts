import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  resolveHostContext,
  getApplicationUrl,
  getLoginUrl,
  isValidReturnUrl,
  APPLICATIONS,
} from '../src/config/domain.js';

describe('Orviohub Subdomain & Hostname Resolution System', () => {
  describe('1. Production Hostname Resolution', () => {
    it('resolves production marketing domain', () => {
      const ctx = resolveHostContext('orviohub.com', 'production');
      expect(ctx.application).toBe('marketing');
      expect(ctx.environment).toBe('production');
    });

    it('resolves production www marketing domain', () => {
      const ctx = resolveHostContext('www.orviohub.com', 'production');
      expect(ctx.application).toBe('marketing');
      expect(ctx.environment).toBe('production');
    });

    it('resolves production accounts domain', () => {
      const ctx = resolveHostContext('accounts.orviohub.com', 'production');
      expect(ctx.application).toBe('accounts');
      expect(ctx.environment).toBe('production');
    });

    it('resolves production launcher domain', () => {
      const ctx = resolveHostContext('app.orviohub.com', 'production');
      expect(ctx.application).toBe('launcher');
      expect(ctx.environment).toBe('production');
    });

    it('resolves production inventory domain', () => {
      const ctx = resolveHostContext('inventory.orviohub.com', 'production');
      expect(ctx.application).toBe('inventory');
      expect(ctx.environment).toBe('production');
    });

    it('resolves production taskmanagement domain', () => {
      const ctx = resolveHostContext('taskmanagement.orviohub.com', 'production');
      expect(ctx.application).toBe('taskmanagement');
      expect(ctx.environment).toBe('production');
    });

    it('resolves production api domain', () => {
      const ctx = resolveHostContext('api.orviohub.com', 'production');
      expect(ctx.application).toBe('api');
      expect(ctx.environment).toBe('production');
    });

    it('rejects unknown or workspace-like subdomains (e.g. acme.orviohub.com)', () => {
      expect(() => resolveHostContext('acme.orviohub.com', 'production')).toThrow(
        /Unknown or unauthorized subdomain/
      );
      expect(() => resolveHostContext('codexstores.orviohub.com', 'production')).toThrow(
        /Unknown or unauthorized subdomain/
      );
    });
  });

  describe('2. Development Subdomain Resolution', () => {
    it('resolves development root domain orviohub.localhost', () => {
      const ctx = resolveHostContext('orviohub.localhost', 'development');
      expect(ctx.application).toBe('marketing');
    });

    it('resolves development accounts subdomain', () => {
      const ctx = resolveHostContext('accounts.orviohub.localhost:5173', 'development');
      expect(ctx.application).toBe('accounts');
    });

    it('resolves development inventory subdomain', () => {
      const ctx = resolveHostContext('inventory.orviohub.localhost:5173', 'development');
      expect(ctx.application).toBe('inventory');
    });

    it('resolves development launcher subdomain', () => {
      const ctx = resolveHostContext('app.orviohub.localhost:5173', 'development');
      expect(ctx.application).toBe('launcher');
    });

    it('handles uppercase hostnames and port stripping', () => {
      const ctx = resolveHostContext('INVENTORY.ORVIOHUB.LOCALHOST:5173', 'development');
      expect(ctx.application).toBe('inventory');
    });
  });

  describe('3. Fallback Port-Based Development Mode', () => {
    it('resolves port 3001 as accounts', () => {
      const ctx = resolveHostContext('localhost:3001', 'development');
      expect(ctx.application).toBe('accounts');
      expect(ctx.mode).toBe('port');
    });

    it('resolves port 3003 as inventory', () => {
      const ctx = resolveHostContext('localhost:3003', 'development');
      expect(ctx.application).toBe('inventory');
      expect(ctx.mode).toBe('port');
    });

    it('resolves port 4000 as api', () => {
      const ctx = resolveHostContext('localhost:4000', 'development');
      expect(ctx.application).toBe('api');
      expect(ctx.mode).toBe('port');
    });
  });

  describe('4. URL Helpers & Return-To Allowlist Validation', () => {
    it('generates correct application URLs', () => {
      expect(getApplicationUrl('inventory', 'production', '/dashboard')).toBe(
        'https://inventory.orviohub.com/dashboard'
      );
      expect(getApplicationUrl('accounts', 'production', '/login')).toBe(
        'https://accounts.orviohub.com/login'
      );
      expect(getLoginUrl('https://inventory.orviohub.com/dashboard', 'production')).toBe(
        'https://accounts.orviohub.com/login?returnTo=https%3A%2F%2Finventory.orviohub.com%2Fdashboard'
      );
    });

    it('validates returnTo URLs against allowlist and prevents open redirects', () => {
      // Allowed production hosts
      expect(isValidReturnUrl('https://inventory.orviohub.com/dashboard', 'production')).toBe(true);
      expect(isValidReturnUrl('https://app.orviohub.com', 'production')).toBe(true);
      expect(isValidReturnUrl('/dashboard', 'production')).toBe(true);

      // Malicious or open redirects rejected
      expect(isValidReturnUrl('https://evil-phishing-site.com', 'production')).toBe(false);
      expect(isValidReturnUrl('https://attacker.orviohub.com.attacker.com', 'production')).toBe(false);
      expect(isValidReturnUrl('javascript:alert(1)', 'production')).toBe(false);
    });
  });

  describe('5. Fastify Host-Context & Health Endpoints', () => {
    let app: any;

    beforeAll(async () => {
      app = await buildApp();
    });

    afterAll(async () => {
      if (app) await app.close();
    });

    it('returns host context from /v1/host-context', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/host-context',
        headers: {
          host: 'inventory.orviohub.com',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.status).toBe('ok');
      expect(json.hostContext.application).toBe('inventory');
    });

    it('exposes /ready and /version health checks', async () => {
      const readyRes = await app.inject({ method: 'GET', url: '/ready' });
      expect(readyRes.statusCode).toBe(200);
      expect(JSON.parse(readyRes.body).status).toBe('ready');

      const versionRes = await app.inject({ method: 'GET', url: '/version' });
      expect(versionRes.statusCode).toBe(200);
      expect(JSON.parse(versionRes.body).version).toBe('1.0.0');
    });

    it('rejects unauthorized or unknown subdomains on request hook', async () => {
      const badRes = await app.inject({
        method: 'GET',
        url: '/v1/host-context',
        headers: {
          host: 'unauthorized-subdomain.orviohub.com',
        },
      });

      expect(badRes.statusCode).toBe(400);
      const json = JSON.parse(badRes.body);
      expect(json.error).toBe('Bad Request');
    });
  });
});
