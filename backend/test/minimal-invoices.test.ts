import { describe, it, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { dataService } from '../src/services/dataService.js';
import type { FastifyInstance } from 'fastify';

describe('Minimal Invoices for Organization Subscriptions Test Suite', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  test('1. Successful Standard plan payment generates sequential invoice and returns invoiceId and invoiceNumber', async () => {
    const testUserId = 'user_inv_owner_1';
    const testOrgId = 'org_inv_test_1';
    const testRef = 'pstk_test_inv_998811';

    let confirmArgsReceived: any = null;
    let invoiceCreated: any = null;

    dataService.confirmPaymentAndActivateOrg = async (args: any) => {
      confirmArgsReceived = args;
      invoiceCreated = {
        id: 'inv_generated_001',
        invoiceNumber: 'INV-000001',
        organizationId: args.organizationId,
        subscriptionId: 'sub_test_001',
        paymentId: 'pay_test_001',
        status: 'paid',
        amount: args.amount || 7500,
        currency: 'NGN',
        paymentReference: args.paymentReference,
        paymentMethod: args.provider || 'paystack',
      };
      return {
        success: true,
        organizationId: args.organizationId,
        subscriptionId: 'sub_test_001',
        invoiceId: 'inv_generated_001',
        invoiceNumber: 'INV-000001',
        status: 'active',
        planKey: 'standard',
      };
    };

    dataService.getUserById = async () => ({
      id: testUserId,
      email: 'owner@invoicetest.com',
      emailVerified: true,
      name: 'Invoice Owner',
    } as any);

    const token = app.jwt.sign({ userId: testUserId, email: 'owner@invoicetest.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/confirm-org-payment',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        organizationId: testOrgId,
        paymentReference: testRef,
        provider: 'paystack',
        amount: 7500,
        billingInterval: 'monthly',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.organizationId, testOrgId);
    assert.strictEqual(body.data.invoiceId, 'inv_generated_001');
    assert.strictEqual(body.data.invoiceNumber, 'INV-000001');
    assert.strictEqual(body.data.status, 'active');
    assert.strictEqual(body.data.planKey, 'standard');
    assert.strictEqual(confirmArgsReceived.paymentReference, testRef);
  });

  test('2. Query invoice by ID returns full enriched invoice details and line items', async () => {
    const testUserId = 'user_inv_owner_2';
    const testInvoiceId = 'inv_generated_002';
    const now = Date.now();

    dataService.getInvoiceById = async (invId: string) => {
      assert.strictEqual(invId, testInvoiceId);
      return {
        id: testInvoiceId,
        _id: testInvoiceId,
        invoiceNumber: 'INV-000002',
        status: 'paid',
        amount: 7500,
        currency: 'NGN',
        issuedAt: now,
        paidAt: now,
        periodStart: now,
        periodEnd: now + 30 * 86_400_000,
        paymentReference: 'pstk_test_ref_4455',
        paymentMethod: 'paystack',
        organization: {
          id: 'org_inv_test_2',
          name: 'Apex Supermarket',
          address: '14 Marina St, Lagos, Nigeria',
          phone: '+2348011223344',
          currency: 'NGN',
        },
        subscription: {
          id: 'sub_test_002',
          planKey: 'standard',
          billingInterval: 'monthly',
          status: 'active',
        },
        payment: {
          id: 'pay_test_002',
          provider: 'paystack',
          reference: 'pstk_test_ref_4455',
          status: 'success',
        },
        items: [
          {
            description: 'Orviohub Standard Plan (Monthly)',
            quantity: 1,
            unitPrice: 7500,
            total: 7500,
          },
        ],
      };
    };

    const token = app.jwt.sign({ userId: testUserId, email: 'owner@invoicetest.com' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/billing/invoices/${testInvoiceId}`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.invoiceNumber, 'INV-000002');
    assert.strictEqual(body.data.status, 'paid');
    assert.strictEqual(body.data.amount, 7500);
    assert.strictEqual(body.data.organization.name, 'Apex Supermarket');
    assert.strictEqual(body.data.payment.reference, 'pstk_test_ref_4455');
    assert.strictEqual(body.data.items.length, 1);
    assert.strictEqual(body.data.items[0].description, 'Orviohub Standard Plan (Monthly)');
  });

  test('3. Query organization invoices lists all past invoices for organization', async () => {
    const testUserId = 'user_inv_owner_3';
    const testOrgId = 'org_inv_test_3';

    dataService.getInvoicesByOrganization = async (orgId: string) => {
      assert.strictEqual(orgId, testOrgId);
      return [
        {
          id: 'inv_003_2',
          invoiceNumber: 'INV-000005',
          status: 'paid',
          amount: 75000,
          currency: 'NGN',
          issuedAt: Date.now(),
          paidAt: Date.now(),
          organizationName: 'Beta Retail',
          items: [{ description: 'Orviohub Standard Plan (Annual)', quantity: 1, unitPrice: 75000, total: 75000 }],
        },
        {
          id: 'inv_003_1',
          invoiceNumber: 'INV-000001',
          status: 'paid',
          amount: 7500,
          currency: 'NGN',
          issuedAt: Date.now() - 365 * 86_400_000,
          paidAt: Date.now() - 365 * 86_400_000,
          organizationName: 'Beta Retail',
          items: [{ description: 'Orviohub Standard Plan (Monthly)', quantity: 1, unitPrice: 7500, total: 7500 }],
        },
      ];
    };

    const token = app.jwt.sign({ userId: testUserId, email: 'owner@invoicetest.com' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/billing/organizations/${testOrgId}/invoices`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.length, 2);
    assert.strictEqual(body.data[0].invoiceNumber, 'INV-000005');
    assert.strictEqual(body.data[0].amount, 75000);
    assert.strictEqual(body.data[1].invoiceNumber, 'INV-000001');
    assert.strictEqual(body.data[1].amount, 7500);
  });

  test('4. Sequential invoice number helper generates INV-000001, INV-000002 format', async () => {
    const { generateNextInvoiceNumber } = await import('../convex/invoices.js');

    const fakeDbEmpty = {
      query: () => ({
        collect: async () => [],
      }),
    };

    const next1 = await generateNextInvoiceNumber({ db: fakeDbEmpty as any });
    assert.strictEqual(next1, 'INV-000001');

    const fakeDbWithInvoices = {
      query: () => ({
        collect: async () => [{ _id: '1' }, { _id: '2' }, { _id: '3' }],
      }),
    };

    const next4 = await generateNextInvoiceNumber({ db: fakeDbWithInvoices as any });
    assert.strictEqual(next4, 'INV-000004');
  });
});
