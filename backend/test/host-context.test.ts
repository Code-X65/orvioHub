import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

describe('Backend Host Context & Rejection', () => {
  it('accepts and resolves valid subdomain host header', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/host-context',
      headers: {
        host: 'accounts.orviohub.localhost:4000',
      },
    });

    assert.equal(response.statusCode, 200);
    const json = JSON.parse(response.body);
    assert.equal(json.hostContext.application, 'accounts');
    assert.equal(json.hostContext.environment, 'development');
    await app.close();
  });

  it('handles CORS OPTIONS preflight from allowed origin with 204 / 200', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/auth/login',
      headers: {
        host: 'localhost:3000',
        origin: 'http://accounts.orviohub.localhost:4000',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,authorization',
      },
    });

    assert.ok(response.statusCode === 204 || response.statusCode === 200);
    assert.equal(
      response.headers['access-control-allow-origin'],
      'http://accounts.orviohub.localhost:4000'
    );
    assert.equal(response.headers['access-control-allow-credentials'], 'true');
    await app.close();
  });

  it('rejects unrecognized subdomain with 400 Bad Request', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/host-context',
      headers: {
        host: 'unknown.orviohub.localhost:4000',
      },
    });

    assert.equal(response.statusCode, 400);
    const json = JSON.parse(response.body);
    assert.equal(json.statusCode, 400);
    assert.equal(json.error, 'Bad Request');
    await app.close();
  });

  it('attaches wildcard .orviohub.localhost session cookies and authenticates with cookies', async () => {
    const app = await buildApp();
    const testEmail = `cookie-test-${Date.now()}@orviohub.com`;

    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      headers: {
        host: 'localhost:3000',
        origin: 'http://accounts.orviohub.localhost:4000',
      },
      payload: {
        email: testEmail,
        name: 'Cookie Tester',
        password: 'Password123!',
      },
    });

    assert.equal(signupRes.statusCode, 201);
    const cookies = signupRes.cookies;
    const sessionCookie = cookies.find((c) => c.name === 'orvio_session');
    assert.ok(sessionCookie, 'Expected orvio_session cookie in response');
    assert.equal(sessionCookie.domain, '.orviohub.localhost');
    assert.equal(sessionCookie.httpOnly, true);

    // Call /api/v1/auth/me using ONLY the wildcard cookie from marketing surface (without Authorization header)
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        host: 'localhost:3000',
        origin: 'http://orviohub.localhost:4000',
      },
      cookies: {
        orvio_session: sessionCookie.value,
      },
    });

    assert.equal(meRes.statusCode, 200);
    const meJson = JSON.parse(meRes.body);
    assert.equal(meJson.success, true);
    assert.equal(meJson.data.user.email, testEmail);
    await app.close();
  });
});
