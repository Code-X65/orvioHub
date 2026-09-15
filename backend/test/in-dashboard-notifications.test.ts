import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';

describe('In-Dashboard Invite Notifications Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  const originalGetUserById = dataService.getUserById;
  const originalGetNotifications = dataService.getNotificationsForUser;
  const originalGetUnreadCount = dataService.getUnreadNotificationCount;
  const originalMarkNotificationRead = dataService.markNotificationRead;
  const originalMarkAllNotificationsRead = dataService.markAllNotificationsRead;
  const originalGetPendingInvites = dataService.getPendingInvitesForUser;
  const originalAcceptInvite = dataService.acceptInviteFromNotification;
  const originalDeclineInvite = dataService.declineInviteFromNotification;
  const originalAcceptWsInvite = dataService.acceptWorkspaceInviteFromNotification;
  const originalDeclineWsInvite = dataService.declineWorkspaceInviteFromNotification;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    dataService.getUserById = originalGetUserById;
    dataService.getNotificationsForUser = originalGetNotifications;
    dataService.getUnreadNotificationCount = originalGetUnreadCount;
    dataService.markNotificationRead = originalMarkNotificationRead;
    dataService.markAllNotificationsRead = originalMarkAllNotificationsRead;
    dataService.getPendingInvitesForUser = originalGetPendingInvites;
    dataService.acceptInviteFromNotification = originalAcceptInvite;
    dataService.declineInviteFromNotification = originalDeclineInvite;
    dataService.acceptWorkspaceInviteFromNotification = originalAcceptWsInvite;
    dataService.declineWorkspaceInviteFromNotification = originalDeclineWsInvite;
  });

  describe('1. Authentication Guard', () => {
    test('rejects unauthenticated requests to notifications with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications',
      });
      assert.equal(res.statusCode, 401);
    });

    test('rejects unauthenticated requests to unread-count with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications/unread-count',
      });
      assert.equal(res.statusCode, 401);
    });
  });

  describe('2. Notifications Query Endpoints', () => {
    test('GET /api/v1/notifications returns user notifications', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.getNotificationsForUser = async (userId, options) => {
        assert.equal(userId, 'user_test_1');
        return [
          {
            _id: 'notif_1',
            userId: 'user_test_1',
            type: 'org_invite',
            title: "You've been invited to join Acme Corp",
            body: 'John Doe invited you as Manager.',
            data: {
              inviteId: 'inv_1',
              inviteType: 'organization',
              organizationId: 'org_1',
              organizationName: 'Acme Corp',
              role: 'MANAGER',
              inviterName: 'John Doe',
            },
            severity: 'INFO',
            channel: 'IN_APP',
            status: 'UNREAD',
            createdAt: Date.now(),
          },
        ] as any;
      };

      const token = app.jwt.sign({ userId: 'user_test_1', email: 'user@example.com' });
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.success, true);
      assert.equal(json.data.notifications.length, 1);
      assert.equal(json.data.notifications[0].data.organizationName, 'Acme Corp');
    });

    test('GET /api/v1/notifications/unread-count returns badge count', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.getUnreadNotificationCount = async (userId) => {
        assert.equal(userId, 'user_test_1');
        return 3;
      };

      const token = app.jwt.sign({ userId: 'user_test_1', email: 'user@example.com' });
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications/unread-count',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.success, true);
      assert.equal(json.data.count, 3);
    });

    test('GET /api/v1/notifications/pending-invites returns user pending invites', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.getPendingInvitesForUser = async (userId) => {
        assert.equal(userId, 'user_test_1');
        return [
          {
            id: 'inv_1',
            inviteType: 'organization',
            organizationId: 'org_1',
            organizationName: 'Beta Org',
            organizationSlug: 'beta-org',
            role: 'STAFF',
            inviterName: 'Jane Smith',
            email: 'user@example.com',
            status: 'PENDING',
            expiresAt: Date.now() + 86400000,
            createdAt: Date.now(),
          },
        ] as any;
      };

      const token = app.jwt.sign({ userId: 'user_test_1', email: 'user@example.com' });
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications/pending-invites',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.success, true);
      assert.equal(json.data.invites.length, 1);
      assert.equal(json.data.invites[0].organizationName, 'Beta Org');
    });
  });

  describe('3. Notification Actions (Mark Read / Read All)', () => {
    test('POST /api/v1/notifications/:id/read marks notification as read', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      let markedId = '';
      dataService.markNotificationRead = async (notifId, userId) => {
        markedId = notifId;
        assert.equal(userId, 'user_test_1');
        return { success: true };
      };

      const token = app.jwt.sign({ userId: 'user_test_1', email: 'user@example.com' });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/notif_999/read',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(markedId, 'notif_999');
    });

    test('POST /api/v1/notifications/read-all marks all notifications as read', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.markAllNotificationsRead = async (userId) => {
        assert.equal(userId, 'user_test_1');
        return { count: 5 } as any;
      };

      const token = app.jwt.sign({ userId: 'user_test_1', email: 'user@example.com' });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/read-all',
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.data.updatedCount, 5);
    });
  });

  describe('4. Accept & Decline from Notification (via Notifications and Invitations endpoints)', () => {
    test('POST /api/v1/notifications/accept-invite successfully accepts org invite', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.acceptInviteFromNotification = async (inviteId, userId, notifId) => {
        assert.equal(inviteId, 'inv_456');
        assert.equal(userId, 'user_test_1');
        assert.equal(notifId, 'notif_123');
        return {
          success: true,
          organization: { id: 'org_1', name: 'Acme Corp', slug: 'acme' },
          role: 'MEMBER',
        };
      };

      const token = app.jwt.sign({ userId: 'user_test_1', email: 'user@example.com' });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/accept-invite',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          inviteId: 'inv_456',
          inviteType: 'organization',
          notificationId: 'notif_123',
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.success, true);
      assert.equal(json.data.organization.name, 'Acme Corp');
    });

    test('POST /api/v1/invitations/accept-from-notification also accepts invite', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.acceptInviteFromNotification = async (inviteId, userId) => {
        assert.equal(inviteId, 'inv_789');
        assert.equal(userId, 'user_test_1');
        return { success: true };
      };

      const token = app.jwt.sign({ userId: 'user_test_1', email: 'user@example.com' });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invitations/accept-from-notification',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          inviteId: 'inv_789',
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.success, true);
    });

    test('POST /api/v1/notifications/decline-invite declines invite', async () => {
      dataService.getUserById = async (id: string) => ({
        id,
        email: 'user@example.com',
        name: 'Test User',
        emailVerified: true,
        tokenVersion: 0,
        status: 'ACTIVE',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      dataService.declineInviteFromNotification = async (inviteId, userId, notifId) => {
        assert.equal(inviteId, 'inv_456');
        assert.equal(userId, 'user_test_1');
        return { success: true };
      };

      const token = app.jwt.sign({ userId: 'user_test_1', email: 'user@example.com' });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/decline-invite',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          inviteId: 'inv_456',
          inviteType: 'organization',
        },
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.success, true);
    });
  });
});
