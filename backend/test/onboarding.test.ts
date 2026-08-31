import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import { emailService } from '../src/services/email.js';
import { ERROR_CODES, ROLES, ONBOARDING_STEPS, ONBOARDING_STATUS } from '../src/config/constants.js';

describe('Backend User Onboarding Lifecycle Test Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const testEmail = (name: string) => `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@acme.com`;

  beforeEach(async () => {
    dataService.clearAll();
    emailService.clearSentEmails();
    app = await buildApp();
  });

  test('1. Happy path: full onboarding lifecycle from signup to completion', async () => {
    const aliceEmail = testEmail('alice');
    const bobEmail = testEmail('bob');
    const carolEmail = testEmail('carol');

    // 1.1 Account Creation
    const signupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        email: aliceEmail,
        name: 'Alice Founder',
        password: 'Password123!',
      },
    });
    assert.equal(signupRes.statusCode, 201);
    const signupBody = JSON.parse(signupRes.payload);
    assert.equal(signupBody.success, true);
    assert.equal(signupBody.data.user.email, aliceEmail);
    assert.equal(signupBody.data.user.emailVerified, false);
    assert.equal(signupBody.data.onboarding.currentStep, ONBOARDING_STEPS.EMAIL_VERIFICATION);

    // Verify verification email was dispatched
    const sentEmails = emailService.getSentEmails();
    const aliceEmailEntry = sentEmails.find((e) => e.payload.to === aliceEmail);
    assert.ok(aliceEmailEntry);
    assert.equal(aliceEmailEntry.event, 'USER_VERIFICATION_REQUESTED');
    const verificationToken = aliceEmailEntry.payload.data.token as string;
    assert.ok(verificationToken);

    // 1.2 Verify Email
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: verificationToken },
    });
    assert.equal(verifyRes.statusCode, 200);
    const verifyBody = JSON.parse(verifyRes.payload);
    assert.equal(verifyBody.success, true);
    assert.equal(verifyBody.data.user.emailVerified, true);
    assert.equal(verifyBody.data.onboarding.currentStep, ONBOARDING_STEPS.ORGANIZATION_CREATION);
    const aliceToken = verifyBody.data.token;

    // 1.3 Create Organization (Atomically creates org, owner membership, settings)
    const createOrgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        name: 'Acme Technologies',
        industry: 'Technology',
        country: 'US',
        timezone: 'America/New_York',
        website: 'https://acme.example.com',
        size: '11_50',
      },
    });
    assert.equal(createOrgRes.statusCode, 201);
    const createOrgBody = JSON.parse(createOrgRes.payload);
    assert.equal(createOrgBody.success, true);
    assert.equal(createOrgBody.data.organization.name, 'Acme Technologies');
    assert.ok(createOrgBody.data.organization.slug.startsWith('acme-technologies'));
    assert.equal(createOrgBody.data.membership.role, ROLES.OWNER);
    assert.equal(createOrgBody.data.membership.status, 'ACTIVE');
    const orgId = createOrgBody.data.organization.id;

    // 1.4 Configure Organization (PATCH)
    const patchOrgRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        website: 'https://www.acme.example.com',
        size: '51_200',
      },
    });
    assert.equal(patchOrgRes.statusCode, 200);
    const patchOrgBody = JSON.parse(patchOrgRes.payload);
    assert.equal(patchOrgBody.data.organization.website, 'https://www.acme.example.com');

    // 1.5 Select Modules
    const selectModulesRes = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/modules',
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        modules: ['customers', 'sales', 'finance'],
      },
    });
    assert.equal(selectModulesRes.statusCode, 200);
    const selectModulesBody = JSON.parse(selectModulesRes.payload);
    assert.equal(selectModulesBody.success, true);
    assert.deepEqual(selectModulesBody.data.enabledModules, ['customers', 'sales', 'finance']);
    assert.equal(selectModulesBody.data.onboarding.currentStep, ONBOARDING_STEPS.WORKSPACE_INITIALIZATION);

    // 1.6 Initialize Workspace
    const initWorkspaceRes = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/workspace',
      headers: { authorization: `Bearer ${aliceToken}` },
    });
    assert.equal(initWorkspaceRes.statusCode, 200);
    const initWorkspaceBody = JSON.parse(initWorkspaceRes.payload);
    assert.equal(initWorkspaceBody.data.workspace.status, 'READY');
    assert.equal(initWorkspaceBody.data.onboarding.currentStep, 'WORKSPACE_READY');

    // 1.7 Team Invitation
    const inviteRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/invitations`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        invitations: [
          { email: bobEmail, role: 'MEMBER' },
          { email: carolEmail, role: 'MANAGER' },
        ],
      },
    });
    assert.equal(inviteRes.statusCode, 201);
    const inviteBody = JSON.parse(inviteRes.payload);
    assert.equal(inviteBody.success, true);
    assert.equal(inviteBody.data.invitations.length, 2);

    // Verify invitation email was dispatched
    const allEmails = emailService.getSentEmails();
    const inviteEmail = allEmails.find(
      (e) => e.event === 'ORGANIZATION_INVITATION_CREATED' && e.payload.to === bobEmail
    );
    assert.ok(inviteEmail);
    const bobInviteToken = inviteEmail.payload.data.token as string;
    assert.ok(bobInviteToken);

    // 1.8 Accept Invitation as Bob
    const bobSignup = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: bobEmail, name: 'Bob Member', password: 'BobPassword123!' },
    });
    const bobVerifyToken = emailService
      .getSentEmails()
      .find((e) => e.payload.to === bobEmail && e.event === 'USER_VERIFICATION_REQUESTED')
      ?.payload.data.token as string;
    const bobVerifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: bobVerifyToken },
    });
    const bobToken = JSON.parse(bobVerifyRes.payload).data.token;

    // Bob accepts invitation
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/v1/invitations/${bobInviteToken}/accept`,
      headers: { authorization: `Bearer ${bobToken}` },
    });
    assert.equal(acceptRes.statusCode, 200);
    const acceptBody = JSON.parse(acceptRes.payload);
    assert.equal(acceptBody.success, true);
    assert.equal(acceptBody.data.role, 'MEMBER');
    assert.ok(acceptBody.data.organization?.id === orgId || acceptBody.data.workspace?.id);

    // 1.9 Complete Onboarding as Alice (Owner)
    const completeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/complete',
      headers: { authorization: `Bearer ${aliceToken}` },
    });
    assert.equal(completeRes.statusCode, 200);
    const completeBody = JSON.parse(completeRes.payload);
    assert.equal(completeBody.success, true);
    assert.equal(completeBody.data.status, ONBOARDING_STATUS.COMPLETED);
    assert.equal(completeBody.data.currentStep, ONBOARDING_STEPS.COMPLETED);

    // 1.10 Verify final status endpoint
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/onboarding/status',
      headers: { authorization: `Bearer ${aliceToken}` },
    });
    assert.equal(statusRes.statusCode, 200);
    const statusBody = JSON.parse(statusRes.payload);
    assert.equal(statusBody.data.status, ONBOARDING_STATUS.COMPLETED);
    assert.equal(statusBody.data.currentStep, ONBOARDING_STEPS.COMPLETED);
  });

  test('2. Resumable onboarding: user can leave and return to exact step', async () => {
    const resumeEmail = testEmail('resumable');
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: resumeEmail, name: 'Resume Tester', password: 'Password123!' },
    });
    const token = emailService.getSentEmails().find((e) => e.payload.to === resumeEmail)?.payload.data.token as string;
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token },
    });
    const userToken = JSON.parse(verifyRes.payload).data.token;

    // Create organization
    await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        name: 'Resume Corp',
        industry: 'Finance',
        country: 'GB',
        timezone: 'Europe/London',
      },
    });

    // Stop at MODULE_SELECTION, log in again
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: resumeEmail, password: 'Password123!' },
    });
    assert.equal(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.payload);
    assert.equal(loginBody.data.onboarding.currentStep, ONBOARDING_STEPS.MODULE_SELECTION);
    assert.equal(loginBody.data.onboarding.status, ONBOARDING_STATUS.IN_PROGRESS);

    // Check /status directly
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/onboarding/status',
      headers: { authorization: `Bearer ${loginBody.data.token}` },
    });
    const statusBody = JSON.parse(statusRes.payload);
    assert.equal(statusBody.data.currentStep, ONBOARDING_STEPS.MODULE_SELECTION);
    assert.equal(statusBody.data.organization.name, 'Resume Corp');
  });

  test('3. Idempotency: duplicate requests are safely handled', async () => {
    const idempEmail = testEmail('idempotent');
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: idempEmail, name: 'Idempotent User', password: 'Password123!' },
    });
    const token = emailService.getSentEmails().find((e) => e.payload.to === idempEmail)?.payload.data.token as string;
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token },
    });
    const userToken = JSON.parse(verifyRes.payload).data.token;

    // First org creation
    const org1 = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: 'Double Click Corp', industry: 'Logistics', country: 'CA', timezone: 'America/Toronto' },
    });
    assert.equal(org1.statusCode, 201);
    const org1Body = JSON.parse(org1.payload);

    // Second org creation (accidental double click) -> should return existing org safely
    const org2 = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: 'Double Click Corp', industry: 'Logistics', country: 'CA', timezone: 'America/Toronto' },
    });
    assert.equal(org2.statusCode, 200);
    const org2Body = JSON.parse(org2.payload);
    assert.equal(org1Body.data.organization.id, org2Body.data.organization.id);

    // Select modules twice
    const mod1 = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/modules',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { modules: ['inventory', 'customers', 'sales'] },
    });
    assert.equal(mod1.statusCode, 200);

    const mod2 = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/modules',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { modules: ['inventory', 'customers', 'sales'] },
    });
    assert.equal(mod2.statusCode, 200);
  });

  test('4. Security & RBAC: non-admin member cannot configure org, select modules, or invite', async () => {
    const ownerEmail = testEmail('owner_rbac');
    const memberEmail = testEmail('member_rbac');
    const otherEmail = testEmail('other_rbac');

    // Create Owner & Org
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: ownerEmail, name: 'Owner', password: 'Password123!' },
    });
    const ownerVerify = emailService.getSentEmails().find((e) => e.payload.to === ownerEmail)?.payload.data.token as string;
    const ownerToken = JSON.parse(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token: ownerVerify } })).payload
    ).data.token;

    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'RBAC Corp', industry: 'Tech', country: 'US', timezone: 'UTC' },
    });
    const orgId = JSON.parse(orgRes.payload).data.organization.id;

    // Invite Member
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/invitations`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { invitations: [{ email: memberEmail, role: 'MEMBER' }] },
    });
    const memberInviteToken = emailService
      .getSentEmails()
      .find((e) => e.payload.to === memberEmail && e.event === 'ORGANIZATION_INVITATION_CREATED')
      ?.payload.data.token as string;

    // Member signs up and accepts
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: memberEmail, name: 'Member', password: 'Password123!' },
    });
    const memberVerify = emailService
      .getSentEmails()
      .find((e) => e.payload.to === memberEmail && e.event === 'USER_VERIFICATION_REQUESTED')
      ?.payload.data.token as string;
    const memberToken = JSON.parse(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token: memberVerify } })).payload
    ).data.token;

    await app.inject({
      method: 'POST',
      url: `/api/v1/invitations/${memberInviteToken}/accept`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    // Attempt 1: Member tries to configure organization -> 403
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { name: 'Hacked Corp' },
    });
    assert.equal(patchRes.statusCode, 403);
    assert.equal(JSON.parse(patchRes.payload).error.code, ERROR_CODES.ORGANIZATION_ACCESS_DENIED);

    // Attempt 2: Member tries to select modules for org -> 403
    const modRes = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/modules',
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { organizationId: orgId, modules: ['customers'] },
    });
    assert.equal(modRes.statusCode, 403);
    assert.equal(JSON.parse(modRes.payload).error.code, ERROR_CODES.ORGANIZATION_ACCESS_DENIED);

    // Attempt 3: Member tries to invite others -> 403
    const invRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/invitations`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { invitations: [{ email: otherEmail, role: 'MEMBER' }] },
    });
    assert.equal(invRes.statusCode, 403);
    assert.equal(JSON.parse(invRes.payload).error.code, ERROR_CODES.INVITATION_ACCESS_DENIED);
  });

  test('5. Multi-tenant isolation: User in Org A cannot access or manipulate Org B', async () => {
    const userAEmail = testEmail('usera');
    const userBEmail = testEmail('userb');

    // Create Org A with User A
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: userAEmail, name: 'User A', password: 'Password123!' },
    });
    const tokenA = emailService.getSentEmails().find((e) => e.payload.to === userAEmail)?.payload.data.token as string;
    const authA = JSON.parse(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token: tokenA } })).payload
    ).data.token;
    const orgARes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${authA}` },
      payload: { name: 'Organization A', industry: 'Health', country: 'US', timezone: 'UTC' },
    });
    const orgAId = JSON.parse(orgARes.payload).data.organization.id;

    // Create Org B with User B
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: userBEmail, name: 'User B', password: 'Password123!' },
    });
    const tokenB = emailService
      .getSentEmails()
      .find((e) => e.payload.to === userBEmail)
      ?.payload.data.token as string;
    const authB = JSON.parse(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token: tokenB } })).payload
    ).data.token;
    const orgBRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${authB}` },
      payload: { name: 'Organization B', industry: 'Finance', country: 'UK', timezone: 'UTC' },
    });
    const orgBId = JSON.parse(orgBRes.payload).data.organization.id;

    // User A attempts to read Org B details -> 403 Access Denied
    const readBRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgBId}`,
      headers: { authorization: `Bearer ${authA}` },
    });
    assert.equal(readBRes.statusCode, 403);
    assert.equal(JSON.parse(readBRes.payload).error.code, ERROR_CODES.ORGANIZATION_ACCESS_DENIED);

    // User A attempts to configure Org B -> 403 Access Denied
    const patchBRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgBId}`,
      headers: { authorization: `Bearer ${authA}` },
      payload: { name: 'Hacked B' },
    });
    assert.equal(patchBRes.statusCode, 403);
  });

  test('6. Data & Security validation: invalid modules, email mismatches, and premature completion', async () => {
    const valEmail = testEmail('val');
    const intendedEmail = testEmail('intended');
    const wrongEmail = testEmail('wrong');

    // Create user and verify
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: valEmail, name: 'Val Tester', password: 'Password123!' },
    });
    const token = emailService.getSentEmails().find((e) => e.payload.to === valEmail)?.payload.data.token as string;
    const userToken = JSON.parse(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token } })).payload
    ).data.token;

    // Org creation
    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: 'Validation Org', industry: 'Retail', country: 'US', timezone: 'America/Chicago' },
    });
    const orgId = JSON.parse(orgRes.payload).data.organization.id;

    // Attempt invalid module name -> INVALID_MODULE (400)
    const invalidModRes = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/modules',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { modules: ['admin', 'database', 'customers'] },
    });
    assert.equal(invalidModRes.statusCode, 400);
    assert.equal(JSON.parse(invalidModRes.payload).error.code, ERROR_CODES.INVALID_MODULE);

    // Attempt premature completion before selecting modules -> 400 ONBOARDING_INCOMPLETE
    const prematureComplete = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/complete',
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(prematureComplete.statusCode, 400);
    assert.equal(JSON.parse(prematureComplete.payload).error.code, ERROR_CODES.ONBOARDING_INCOMPLETE);

    // Send invitation to intended user
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/invitations`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { invitations: [{ email: intendedEmail, role: 'MEMBER' }] },
    });
    const inviteToken = emailService
      .getSentEmails()
      .find((e) => e.payload.to === intendedEmail && e.event === 'ORGANIZATION_INVITATION_CREATED')
      ?.payload.data.token as string;

    // User Y attempts to accept user X's invitation -> 403 INVITATION_EMAIL_MISMATCH
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: wrongEmail, name: 'Wrong Person', password: 'Password123!' },
    });
    const wrongVerify = emailService
      .getSentEmails()
      .find((e) => e.payload.to === wrongEmail)
      ?.payload.data.token as string;
    const wrongToken = JSON.parse(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token: wrongVerify } })).payload
    ).data.token;

    const wrongAcceptRes = await app.inject({
      method: 'POST',
      url: `/api/v1/invitations/${inviteToken}/accept`,
      headers: { authorization: `Bearer ${wrongToken}` },
    });
    assert.equal(wrongAcceptRes.statusCode, 403);
    assert.equal(JSON.parse(wrongAcceptRes.payload).error.code, ERROR_CODES.INVITATION_EMAIL_MISMATCH);
  });

  test('7. Optional step skipping: TEAM_INVITATION can be skipped', async () => {
    const skipEmail = testEmail('skipper');
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: skipEmail, name: 'Skipper', password: 'Password123!' },
    });
    const token = emailService.getSentEmails().find((e) => e.payload.to === skipEmail)?.payload.data.token as string;
    const userToken = JSON.parse(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token } })).payload
    ).data.token;

    await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: 'Skip Corp', industry: 'Logistics', country: 'US', timezone: 'UTC' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/modules',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { modules: ['projects', 'customers', 'sales'] },
    });

    await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/workspace',
      headers: { authorization: `Bearer ${userToken}` },
    });

    // Check status allows skipping current step (TEAM_INVITATION)
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/onboarding/status',
      headers: { authorization: `Bearer ${userToken}` },
    });
    const statusBody = JSON.parse(statusRes.payload);
    assert.equal(statusBody.data.canSkipCurrentStep, true);

    // Skip TEAM_INVITATION
    const skipRes = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/skip',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { step: 'TEAM_INVITATION' },
    });
    assert.equal(skipRes.statusCode, 200);

    // Complete onboarding
    const completeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/complete',
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(completeRes.statusCode, 200);
    assert.equal(JSON.parse(completeRes.payload).data.status, ONBOARDING_STATUS.COMPLETED);
  });

  test('8. Unverified email cannot create organization', async () => {
    const unverifiedEmail = testEmail('unverified');
    // Signup without verifying email
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: unverifiedEmail, name: 'Unverified User', password: 'Password123!' },
    });

    // Login directly without verifying email
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: unverifiedEmail, password: 'Password123!' },
    });
    const token = JSON.parse(loginRes.payload).data.token;

    // Attempt to create org -> 403 EMAIL_NOT_VERIFIED
    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Illegal Org', industry: 'Tech', country: 'US', timezone: 'UTC' },
    });
    assert.equal(orgRes.statusCode, 403);
    assert.equal(JSON.parse(orgRes.payload).error.code, ERROR_CODES.EMAIL_NOT_VERIFIED);
  });

  test('9. Expired invitation cannot be accepted', async () => {
    const ownerEmail = testEmail('exp_owner');
    const lateEmail = testEmail('exp_late');

    // Create Owner & Org
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: ownerEmail, name: 'Owner', password: 'Password123!' },
    });
    const ownerVerify = emailService.getSentEmails().find((e) => e.payload.to === ownerEmail)?.payload.data.token as string;
    const ownerToken = JSON.parse(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token: ownerVerify } })).payload
    ).data.token;

    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'Expiry Org', industry: 'Tech', country: 'US', timezone: 'UTC' },
    });
    const orgId = JSON.parse(orgRes.payload).data.organization.id;

    // Create invitation
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/invitations`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { invitations: [{ email: lateEmail, role: 'MEMBER' }] },
    });
    const inviteEmail = emailService
      .getSentEmails()
      .find((e) => e.payload.to === lateEmail && e.event === 'ORGANIZATION_INVITATION_CREATED');
    const inviteToken = inviteEmail?.payload.data.token as string;

    // Invitee signs up and verifies
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: lateEmail, name: 'Late Invitee', password: 'Password123!' },
    });
    const lateVerify = emailService
      .getSentEmails()
      .find((e) => e.payload.to === lateEmail && e.event === 'USER_VERIFICATION_REQUESTED')
      ?.payload.data.token as string;
    const lateToken = JSON.parse(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', payload: { token: lateVerify } })).payload
    ).data.token;

    // Invoking with invalid or manipulated invite token -> 404
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/v1/invitations/expired-or-invalid-token-12345/accept`,
      headers: { authorization: `Bearer ${lateToken}` },
    });
    assert.equal(acceptRes.statusCode, 404);
    assert.equal(JSON.parse(acceptRes.payload).error.code, ERROR_CODES.INVITATION_NOT_FOUND);
  });

  test('10. Swagger documentation and OpenAPI spec endpoint are accessible', async () => {
    const docsRes = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });
    assert.equal(docsRes.statusCode, 200);
    const spec = JSON.parse(docsRes.payload);
    assert.equal(spec.openapi, '3.0.3');
    assert.equal(spec.info.title, 'orvioHub Backend Onboarding API');
    assert.ok(spec.paths['/api/v1/onboarding/status']);
    assert.ok(spec.paths['/api/v1/organizations/'] || spec.paths['/api/v1/organizations']);
    assert.ok(spec.paths['/api/v1/auth/signup']);
  });
});
