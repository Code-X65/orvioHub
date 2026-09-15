import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  PlanLimitReachedError,
} from '../src/errors/AppError.js';

describe('Error Handling Strategy (Gap 2.4)', () => {
  it('handles NotFoundError with 404 status and canonical envelope', async () => {
    const app = await buildApp();
    app.get('/test-not-found', async () => {
      throw new NotFoundError('Workspace item not found', { itemId: '123' });
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-not-found',
    });

    assert.equal(res.statusCode, 404);
    const body = res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(body.error.message, 'Workspace item not found');
    assert.deepEqual(body.error.details, { itemId: '123' });
  });

  it('handles UnauthorizedError with 401 status and code UNAUTHORIZED', async () => {
    const app = await buildApp();
    app.get('/test-unauthorized', async () => {
      throw new UnauthorizedError('Invalid token');
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-unauthorized',
    });

    assert.equal(res.statusCode, 401);
    const body = res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  it('handles ForbiddenError with 403 status and code FORBIDDEN', async () => {
    const app = await buildApp();
    app.get('/test-forbidden', async () => {
      throw new ForbiddenError('Insufficient permissions');
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-forbidden',
    });

    assert.equal(res.statusCode, 403);
    const body = res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  it('handles ValidationError with 400 status and code VALIDATION_ERROR', async () => {
    const app = await buildApp();
    app.get('/test-validation-error', async () => {
      throw new ValidationError('Email is invalid', { field: 'email' });
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-validation-error',
    });

    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(body.error.details, { field: 'email' });
  });

  it('handles ConflictError with 409 status and code CONFLICT', async () => {
    const app = await buildApp();
    app.get('/test-conflict', async () => {
      throw new ConflictError('Slug already exists');
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-conflict',
    });

    assert.equal(res.statusCode, 409);
    const body = res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'CONFLICT');
  });

  it('handles PlanLimitReachedError with 403 status and code PLAN_LIMIT_REACHED', async () => {
    const app = await buildApp();
    app.get('/test-plan-limit', async () => {
      throw new PlanLimitReachedError('Max branch limit reached (3/3)', {
        metric: 'branches',
        current: 3,
        limit: 3,
      });
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-plan-limit',
    });

    assert.equal(res.statusCode, 403);
    const body = res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'PLAN_LIMIT_REACHED');
    assert.equal(body.error.details?.metric, 'branches');
  });

  it('handles Fastify schema validation errors automatically', async () => {
    const app = await buildApp();
    app.post(
      '/test-schema-validation',
      {
        schema: {
          body: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' },
            },
          },
        },
      },
      async () => {
        return { ok: true };
      }
    );

    const res = await app.inject({
      method: 'POST',
      url: '/test-schema-validation',
      payload: {},
    });

    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok(body.error.details?.validation);
  });

  it('handles unexpected internal errors with 500 status', async () => {
    const app = await buildApp();
    app.get('/test-internal-crash', async () => {
      throw new Error('Database connection crashed unexpectedly');
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-internal-crash',
    });

    assert.equal(res.statusCode, 500);
    const body = res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR');
  });
});
