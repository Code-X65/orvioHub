import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';

describe('server-side cookie sessions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const originalGetUserByEmail = dataService.getUserByEmail;
  const originalVerifyPassword = dataService.verifyPassword;
  const originalCreateSession = dataService.createSession;
  const originalGetSessionBySecret = dataService.getSessionBySecret;
  const originalGetUserById = dataService.getUserById;
  const originalMemberships = dataService.getUserMemberships;
  const originalOnboarding = dataService.getOnboardingStatus;

  beforeEach(async () => { app = await buildApp(); });
  afterEach(async () => {
    dataService.getUserByEmail = originalGetUserByEmail;
    dataService.verifyPassword = originalVerifyPassword;
    dataService.createSession = originalCreateSession;
    dataService.getSessionBySecret = originalGetSessionBySecret;
    dataService.getUserById = originalGetUserById;
    dataService.getUserMemberships = originalMemberships;
    dataService.getOnboardingStatus = originalOnboarding;
    await app.close();
  });

  test('login and /me use an opaque HttpOnly session cookie without a bearer JWT', async () => {
    const user: any = { id: 'user_1', email: 'sam@example.com', name: 'Sam', status: 'ACTIVE', emailVerified: true, tokenVersion: 1, createdAt: Date.now(), updatedAt: Date.now() };
    dataService.getUserByEmail = async () => user;
    dataService.verifyPassword = async () => true;
    dataService.createSession = async () => ({ sessionId: 'session_1', refreshToken: 'opaque-session-secret', rememberMe: false });
    dataService.getSessionBySecret = async () => ({ id: 'session_1', userId: user.id, tokenVersion: 1, expiresAt: Date.now() + 60_000, absoluteExpiresAt: Date.now() + 60_000 });
    dataService.getUserById = async () => user;
    dataService.getUserMemberships = async () => [];
    dataService.getOnboardingStatus = async () => ({ status: 'COMPLETED', currentStep: 'COMPLETED' } as any);

    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: user.email, password: 'Password123!' } });
    assert.equal(login.statusCode, 200);
    assert.equal(JSON.parse(login.payload).data.token, undefined);
    const cookie = (Array.isArray(login.headers['set-cookie']) ? login.headers['set-cookie'][0] : login.headers['set-cookie'])!;
    assert.match(cookie, /orvio_session=opaque-session-secret/i);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Path=\/api/i);

    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: cookie.split(';')[0] } });
    assert.equal(me.statusCode, 200);
    assert.equal(JSON.parse(me.payload).data.user.id, user.id);
  });
});
