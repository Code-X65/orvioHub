import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Master Checklist: Auth + Onboarding + Org/Branch Setup + Billing (Free & Paid)', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  // -------------------------------------------------------------
  // Journey A: New user, 14-Day Free Trial
  // -------------------------------------------------------------
  describe('Journey A: New User, 14-Day Free Trial Flow', () => {
    const timestamp = Date.now();
    const userEmail = `journey_a_${timestamp}@orviohub.localhost`;
    const userPassword = 'Password123!';
    let userToken: string;
    let userId: string;
    let orgId: string;

    test('1. Signup creates unverified user and generates verification token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: {
          name: 'Journey A Owner',
          email: userEmail,
          password: userPassword,
        },
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.ok(body.data.user.id);
      userId = body.data.user.id;

      const user = await dataService.getUserById(userId);
      assert.strictEqual(user?.emailVerified, false);
    });

    test('2. Email verification via GET activates user account', async () => {
      const rawUser = await dataService.getUserByEmail(userEmail);
      assert.ok(rawUser);
      assert.ok(rawUser.emailVerificationToken);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/verify-email?token=${rawUser.emailVerificationToken}&email=${encodeURIComponent(userEmail)}`,
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);

      const verifiedUser = await dataService.getUserById(userId);
      assert.strictEqual(verifiedUser?.emailVerified, true);
    });

    test('3. Login creates session and sets auth token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: userEmail,
          password: userPassword,
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.ok(body.data.token);
      userToken = body.data.token;
    });

    test('4. Organization creation with 14-day Free Trial auto-provisions branch, owner role, and trial subscription', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'Journey A Free Business',
          businessPhone: '+2348011223344',
          address: '14 Free Trial Avenue, Lagos, Nigeria',
          category: 'Retail & Supermarket',
          currency: 'NGN',
          receiptFooter: 'Thank you for shopping with Journey A Free Business!',
          taxSettings: { showTax: true, defaultTaxRate: 7.5 },
          planId: 'free_trial',
        },
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.ok(body.data.organization.id);
      orgId = body.data.organization.id;

      // Verify organization data
      const org = await dataService.getOrganizationById(orgId);
      assert.ok(org);
      assert.strictEqual(org.name, 'Journey A Free Business');

      // Verify primary branch auto-created
      const branchesRes = await app.inject({
        method: 'GET',
        url: `/api/v1/orgs/${orgId}/branches`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(branchesRes.statusCode, 200);
      const branchesBody = JSON.parse(branchesRes.payload);
      assert.strictEqual(branchesBody.success, true);
      assert.ok(branchesBody.data.branches.length >= 1);
      assert.strictEqual(branchesBody.data.branches[0].isPrimary, true);

      // Verify Owner membership
      const membersRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/members`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(membersRes.statusCode, 200);
      const membersBody = JSON.parse(membersRes.payload);
      const ownerMember = membersBody.data.members.find((m: any) => m.userId === userId);
      assert.ok(ownerMember);
      assert.strictEqual(ownerMember.role.toLowerCase(), 'owner');

      // Verify Subscription is trialing / active on free plan
      const subRes = await app.inject({
        method: 'GET',
        url: `/api/v1/billing/subscription?organizationId=${orgId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(subRes.statusCode, 200);
      const subBody = JSON.parse(subRes.payload);
      assert.strictEqual(subBody.success, true);
      assert.ok(['trialing', 'active'].includes(subBody.data.subscription.status));
    });
  });

  // -------------------------------------------------------------
  // Journey B: New user, Paid Plan (Standard)
  // -------------------------------------------------------------
  describe('Journey B: New User, Paid Plan (Standard) Flow', () => {
    const timestamp = Date.now();
    const userEmail = `journey_b_${timestamp}@orviohub.localhost`;
    const userPassword = 'Password123!';
    let userToken: string;
    let userId: string;
    let orgId: string;

    before(async () => {
      const { user } = await dataService.createUser({
        name: 'Journey B Paid Owner',
        email: userEmail,
        password: userPassword,
        emailVerified: true,
      });
      userId = user.id;

      const session = await dataService.createSession(userId, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        authenticationMethod: 'password',
        tokenVersion: 1,
      });

      userToken = app.jwt.sign({
        userId,
        email: userEmail,
        sessionId: session.sessionId,
        tokenVersion: 1,
      });
    });

    test('1. Org creation with Standard Paid plan and payment reference activates paid subscription', async () => {
      const paymentRef = `pay_ref_${Date.now()}`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/orgs',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'Journey B Standard Enterprise',
          businessPhone: '+2348099887766',
          address: '42 Marina, Lagos Island',
          category: 'Wholesale & Distribution',
          currency: 'NGN',
          planId: 'standard',
          billingCycle: 'monthly',
          paymentReference: paymentRef,
        },
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      orgId = body.data.organization.id;

      // Verify subscription is active standard
      const subRes = await app.inject({
        method: 'GET',
        url: `/api/v1/billing/subscription?organizationId=${orgId}`,
        headers: { authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(subRes.statusCode, 200);
      const subBody = JSON.parse(subRes.payload);
      assert.strictEqual(subBody.success, true);
      assert.strictEqual(subBody.data.subscription.planId, 'standard');
      assert.strictEqual(subBody.data.subscription.status, 'active');
    });
  });

  // -------------------------------------------------------------
  // Journey C: Existing Free Trial user upgrades to Paid Plan
  // -------------------------------------------------------------
  describe('Journey C: Upgrade from Free Trial to Standard', () => {
    const timestamp = Date.now();
    const userEmail = `journey_c_${timestamp}@orviohub.localhost`;
    let userToken: string;
    let userId: string;
    let orgId: string;

    before(async () => {
      const { user } = await dataService.createUser({
        name: 'Journey C Upgrader',
        email: userEmail,
        password: 'Password123!',
        emailVerified: true,
      });
      userId = user.id;

      const session = await dataService.createSession(userId, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        authenticationMethod: 'password',
        tokenVersion: 1,
      });

      userToken = app.jwt.sign({
        userId,
        email: userEmail,
        sessionId: session.sessionId,
        tokenVersion: 1,
      });

      // Create initial org on free trial
      const orgRes = await dataService.createOrganization({
        userId,
        name: 'Upgrade Test Org',
        industry: 'Retail',
        country: 'Nigeria',
        timezone: 'Africa/Lagos',
        planId: 'free_trial',
      });
      orgId = orgRes.organization.id;
    });

    test('1. POST /api/v1/billing/subscribe upgrades org to Standard plan', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/subscribe',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          organizationId: orgId,
          planId: 'standard',
          billingCycle: 'monthly',
          provider: 'paystack',
          providerReference: `upgrade_ref_${Date.now()}`,
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.subscription.planId, 'standard');
      assert.strictEqual(body.data.subscription.status, 'active');
    });
  });

  // -------------------------------------------------------------
  // Journey D: Existing Paid user cancels subscription
  // -------------------------------------------------------------
  describe('Journey D: Cancel subscription at period end', () => {
    const timestamp = Date.now();
    const userEmail = `journey_d_${timestamp}@orviohub.localhost`;
    let userToken: string;
    let userId: string;
    let orgId: string;

    before(async () => {
      const { user } = await dataService.createUser({
        name: 'Journey D Canceller',
        email: userEmail,
        password: 'Password123!',
        emailVerified: true,
      });
      userId = user.id;

      const session = await dataService.createSession(userId, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        authenticationMethod: 'password',
        tokenVersion: 1,
      });

      userToken = app.jwt.sign({
        userId,
        email: userEmail,
        sessionId: session.sessionId,
        tokenVersion: 1,
      });

      const orgRes = await dataService.createOrganization({
        userId,
        name: 'Cancel Test Org',
        industry: 'Retail',
        country: 'Nigeria',
        timezone: 'Africa/Lagos',
        planId: 'standard',
      });
      orgId = orgRes.organization.id;
    });

    test('1. POST /api/v1/billing/cancel schedules cancellation at period end', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/cancel',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          organizationId: orgId,
          reason: 'Testing cancellation flow',
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.subscription.cancelAtPeriodEnd, true);
    });
  });

  // -------------------------------------------------------------
  // Journey E: Invited Staff Member Flow & Role Scoping
  // -------------------------------------------------------------
  describe('Journey E: Staff Member Invitations & Role Scoping', () => {
    const timestamp = Date.now();
    const ownerEmail = `journey_e_owner_${timestamp}@orviohub.localhost`;
    const staffEmail = `staff_member_${timestamp}@orviohub.localhost`;
    let ownerToken: string;
    let staffToken: string;
    let ownerId: string;
    let staffId: string;
    let orgId: string;
    let inviteToken: string;

    before(async () => {
      // Create owner
      const { user: owner } = await dataService.createUser({
        name: 'Journey E Owner',
        email: ownerEmail,
        password: 'Password123!',
        emailVerified: true,
      });
      ownerId = owner.id;

      const ownerSession = await dataService.createSession(ownerId, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        authenticationMethod: 'password',
        tokenVersion: 1,
      });
      ownerToken = app.jwt.sign({
        userId: ownerId,
        email: ownerEmail,
        sessionId: ownerSession.sessionId,
        tokenVersion: 1,
      });

      // Create staff member account
      const { user: staff } = await dataService.createUser({
        name: 'Sales Attendant User',
        email: staffEmail,
        password: 'Password123!',
        emailVerified: true,
      });
      staffId = staff.id;

      const staffSession = await dataService.createSession(staffId, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        authenticationMethod: 'password',
        tokenVersion: 1,
      });
      staffToken = app.jwt.sign({
        userId: staffId,
        email: staffEmail,
        sessionId: staffSession.sessionId,
        tokenVersion: 1,
      });

      // Create organization
      const orgRes = await dataService.createOrganization({
        userId: ownerId,
        name: 'Team Invite Org',
        industry: 'Retail',
        country: 'Nigeria',
        timezone: 'Africa/Lagos',
        planId: 'standard',
        paymentReference: 'team_invite_paid_ref',
      });
      orgId = orgRes.organization.id;
    });

    test('1. Owner invites member with SALES_ATTENDANT role via /members/invite', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/members/invite`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          email: staffEmail,
          role: 'SALES_ATTENDANT',
        },
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.ok(body.data.inviteToken || body.data.token);
      inviteToken = body.data.inviteToken || body.data.token;
    });

    test('2. Invitee queries invitation details via /api/v1/invite/:token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/invite/${inviteToken}`,
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.invitation.email, staffEmail);
      assert.strictEqual(body.data.invitation.role.toLowerCase(), 'sales_attendant');
    });

    test('3. Invitee accepts invitation and membership is confirmed', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invite/accept',
        headers: { authorization: `Bearer ${staffToken}` },
        payload: {
          token: inviteToken,
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);

      // Verify membership list in org contains staff member with role
      const membersRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/members`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      assert.strictEqual(membersRes.statusCode, 200);
      const membersBody = JSON.parse(membersRes.payload);
      const invitedMember = membersBody.data.members.find((m: any) => m.userId === staffId);
      assert.ok(invitedMember);
      assert.strictEqual(invitedMember.role.toLowerCase(), 'sales_attendant');
    });

    test('4. Supports additional operational roles: STOCK_MANAGER and ACCOUNTANT', async () => {
      // Invite stock manager
      const stockRes = await app.inject({
        method: 'POST',
        url: `/api/v1/orgs/${orgId}/members/invite`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          email: `stock_mgr_${Date.now()}@orviohub.localhost`,
          role: 'STOCK_MANAGER',
        },
      });
      assert.strictEqual(stockRes.statusCode, 201);

      // Invite accountant
      const acctRes = await app.inject({
        method: 'POST',
        url: `/api/v1/orgs/${orgId}/members/invite`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          email: `accountant_${Date.now()}@orviohub.localhost`,
          role: 'ACCOUNTANT',
        },
      });
      assert.strictEqual(acctRes.statusCode, 201);
    });
  });

  // -------------------------------------------------------------
  // Branch Management Endpoints
  // -------------------------------------------------------------
  describe('Branch Management API', () => {
    let userToken: string;
    let orgId: string;
    let newBranchId: string;

    before(async () => {
      const timestamp = Date.now();
      const { user } = await dataService.createUser({
        name: 'Branch Manager Test',
        email: `branch_test_${timestamp}@orviohub.localhost`,
        password: 'Password123!',
        emailVerified: true,
      });

      const session = await dataService.createSession(user.id, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        authenticationMethod: 'password',
        tokenVersion: 1,
      });

      userToken = app.jwt.sign({
        userId: user.id,
        email: user.email,
        sessionId: session.sessionId,
        tokenVersion: 1,
      });

      const orgRes = await dataService.createOrganization({
        userId: user.id,
        name: 'Branch Multi Test Org',
        industry: 'Retail',
        country: 'Nigeria',
        timezone: 'Africa/Lagos',
        planId: 'standard',
        paymentReference: 'branch_init_ref',
      });
      orgId = orgRes.organization.id;
    });

    test('1. Create secondary branch via POST /api/v1/orgs/:id/branches', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/orgs/${orgId}/branches`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'Ikeja Branch',
          code: 'IKJ',
          address: 'Obafemi Awolowo Way, Ikeja',
          phone: '+2348022334455',
          isPrimary: false,
        },
      });

      assert.strictEqual(res.statusCode, 201);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.ok(body.data.branch.id);
      assert.strictEqual(body.data.branch.name, 'Ikeja Branch');
      newBranchId = body.data.branch.id;
    });

    test('2. List branches via GET /api/v1/orgs/:id/branches', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/orgs/${orgId}/branches`,
        headers: { authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.ok(body.data.branches.length >= 1);
      const found = body.data.branches.find((b: any) => b.id === newBranchId);
      assert.ok(found);
    });

    test('3. Update branch via PATCH /api/v1/orgs/:id/branches/:branchId', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/orgs/${orgId}/branches/${newBranchId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          name: 'Ikeja City Mall Outlet',
          phone: '+2348099001122',
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.branch.name, 'Ikeja City Mall Outlet');
    });
  });

  // -------------------------------------------------------------
  // Billing Endpoints Checklist
  // -------------------------------------------------------------
  describe('Billing Specifics Endpoints Verification', () => {
    test('1. GET /api/v1/billing/plans lists Free Trial and Standard plans', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/billing/plans',
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      const plansList = body.data?.plans || body.plans;
      assert.ok(Array.isArray(plansList));
      const free = plansList.find((p: any) => p.key === 'free' || p.key === 'free_trial');
      const standard = plansList.find((p: any) => p.key === 'standard');
      assert.ok(free);
      assert.ok(standard);
    });

    test('2. POST /api/v1/billing/payment-intent generates reference and checkout details', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/payment-intent',
        payload: {
          planId: 'standard',
          billingCycle: 'monthly',
          email: 'payer@orviohub.localhost',
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
      assert.ok(body.data.reference);
      assert.ok(body.data.amount > 0);
    });

    test('3. POST /api/v1/billing/webhook handles payment provider verification', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/webhook',
        payload: {
          event: 'charge.success',
          data: {
            reference: 'webhook_test_ref_123',
            amount: 750000,
            currency: 'NGN',
            status: 'success',
          },
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.success, true);
    });
  });
});
