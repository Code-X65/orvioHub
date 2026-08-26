import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { ERROR_CODES } from '../src/config/constants.js';

describe('Leave Organization and Organization Deletion Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  const originalGetUserById = dataService.getUserById;
  const originalLeaveOrganization = dataService.leaveOrganization;
  const originalDeleteOrganization = dataService.deleteOrganization;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    dataService.getUserById = originalGetUserById;
    dataService.leaveOrganization = originalLeaveOrganization;
    dataService.deleteOrganization = originalDeleteOrganization;
  });

  describe('1. Leave Organization (POST /api/v1/organizations/:id/leave)', () => {
    test('Non-owner member can leave an organization successfully', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'member@acme.com',
        name: 'Member User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.leaveOrganization = async (orgId, userId) => {
        assert.equal(orgId, 'org_123');
        assert.equal(userId, 'user_member');
        return { success: true };
      };

      const token = app.jwt.sign({ userId: 'user_member', email: 'member@acme.com' });
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org_123/leave',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.match(body.message, /Successfully left the organization/);
    });

    test('Sole owner cannot leave organization if other members exist', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'owner@acme.com',
        name: 'Owner User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.leaveOrganization = async () => {
        const err = new Error('OWNER_CANNOT_LEAVE') as any;
        err.code = 'OWNER_CANNOT_LEAVE';
        throw err;
      };

      const token = app.jwt.sign({ userId: 'user_owner', email: 'owner@acme.com' });
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org_123/leave',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 400);
      const body = JSON.parse(response.body);
      assert.equal(body.success, false);
      assert.match(body.error.message, /sole Owner of this organization/);
    });

    test('Returns 404 when user is not a member of the organization', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'stranger@example.com',
        name: 'Stranger',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.leaveOrganization = async () => {
        const err = new Error('MEMBERSHIP_NOT_FOUND') as any;
        err.code = 'MEMBERSHIP_NOT_FOUND';
        throw err;
      };

      const token = app.jwt.sign({ userId: 'user_stranger', email: 'stranger@example.com' });
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations/org_unknown/leave',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 404);
      const body = JSON.parse(response.body);
      assert.equal(body.success, false);
      assert.match(body.error.message, /not an active member/);
    });
  });

  describe('2. Delete Organization (DELETE /api/v1/organizations/:id)', () => {
    test('Non-owner cannot delete an organization (403)', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'admin@acme.com',
        name: 'Admin User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.deleteOrganization = async () => {
        const err = new Error('ORGANIZATION_ACCESS_DENIED') as any;
        err.code = 'ORGANIZATION_ACCESS_DENIED';
        throw err;
      };

      const token = app.jwt.sign({ userId: 'user_admin', email: 'admin@acme.com' });
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org_123',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 403);
      const body = JSON.parse(response.body);
      assert.equal(body.success, false);
      assert.match(body.error.message, /Only the organization Owner can delete/);
    });

    test('Owner cannot delete organization while other active members exist (400)', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'owner@acme.com',
        name: 'Owner User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.deleteOrganization = async () => {
        const err = new Error('CANNOT_DELETE_ORG_WITH_MEMBERS') as any;
        err.code = 'CANNOT_DELETE_ORG_WITH_MEMBERS';
        throw err;
      };

      const token = app.jwt.sign({ userId: 'user_owner', email: 'owner@acme.com' });
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org_123',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(response.statusCode, 400);
      const body = JSON.parse(response.body);
      assert.equal(body.success, false);
      assert.match(body.error.message, /Cannot delete organization while other active members exist/);
    });

    test('Owner fails deletion when password is provided but incorrect (401)', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'owner@acme.com',
        name: 'Owner User',
        passwordHash,
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const token = app.jwt.sign({ userId: 'user_owner', email: 'owner@acme.com' });
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org_123',
        headers: { authorization: `Bearer ${token}` },
        payload: { password: 'WrongPassword999!' },
      });

      assert.equal(response.statusCode, 401);
      const body = JSON.parse(response.body);
      assert.equal(body.success, false);
      assert.equal(body.error.code, ERROR_CODES.INVALID_CREDENTIALS);
    });

    test('Owner successfully deletes organization when alone (200)', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'owner@acme.com',
        name: 'Owner User',
        passwordHash,
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.deleteOrganization = async (orgId, userId, password) => {
        assert.equal(orgId, 'org_123');
        assert.equal(userId, 'user_owner');
        assert.equal(password, 'CorrectPassword123!');
        return { success: true };
      };

      const token = app.jwt.sign({ userId: 'user_owner', email: 'owner@acme.com' });
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/organizations/org_123',
        headers: { authorization: `Bearer ${token}` },
        payload: { password: 'CorrectPassword123!' },
      });

      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.match(body.message, /Organization deleted successfully/);
    });
  });
});
