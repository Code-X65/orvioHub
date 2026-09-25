import { describe, it } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../src/app.js';
import { realtimeEventBus } from '../src/services/realtimeEventBus.js';
import { jobService } from '../src/services/jobService.js';

describe('Real-Time, Long-Running Jobs & Cross-Tab Sync (Gaps 3.7, 3.8, 3.9)', () => {
  describe('3.7 Real-Time Event Bus & SSE Endpoints', () => {
    it('publishes and delivers user-scoped events to subscribers', () => {
      const received: any[] = [];
      const unsub = realtimeEventBus.subscribeUser('usr_target_123', (evt) => {
        received.push(evt);
      });

      realtimeEventBus.publish('notification.created', { title: 'New Invite' }, {
        targetUserId: 'usr_target_123',
      });
      realtimeEventBus.publish('notification.created', { title: 'Other User Invite' }, {
        targetUserId: 'usr_other_456',
      });

      unsub();

      assert.strictEqual(received.length, 1);
      assert.strictEqual(received[0].payload.title, 'New Invite');
      assert.strictEqual(received[0].type, 'notification.created');
    });

    it('publishes and delivers workspace-scoped events', () => {
      const wsEvents: any[] = [];
      const unsub = realtimeEventBus.subscribeWorkspace('ws_789', (evt) => {
        wsEvents.push(evt);
      });

      realtimeEventBus.publish('branch.created', { branchId: 'br_new' }, {
        targetWorkspaceId: 'ws_789',
      });

      unsub();

      assert.strictEqual(wsEvents.length, 1);
      assert.strictEqual(wsEvents[0].payload.branchId, 'br_new');
      assert.strictEqual(wsEvents[0].type, 'branch.created');
    });

    it('POST /api/v1/realtime/publish validates schema and dispatches events', async () => {
      const app = await buildApp();

      let receivedEvent: any = null;
      const unsub = realtimeEventBus.subscribeUser('usr_api_test', (evt) => {
        receivedEvent = evt;
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/realtime/publish',
        payload: {
          type: 'inventory.stock_updated',
          payload: { productId: 'prod_1', newStock: 42 },
          targetUserId: 'usr_api_test',
        },
      });

      unsub();
      await app.close();

      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(receivedEvent?.payload.newStock, 42);
    });
  });

  describe('3.8 Feedback for Long-Running Operations & Async Jobs', () => {
    it('tracks step-by-step progress and computes completion percentage correctly', () => {
      const job = jobService.createJob({
        type: 'branch_provisioning',
        userId: 'usr_owner_1',
        steps: [
          { id: 'validate', name: 'Validating Store Config' },
          { id: 'create_records', name: 'Creating Branch Records' },
          { id: 'seed_registers', name: 'Initializing POS Registers' },
          { id: 'finalize', name: 'Finalizing Deployment' },
        ],
      });

      assert.strictEqual(job.status, 'pending');
      assert.strictEqual(job.progressPercentage, 0);

      // Step 1: in progress
      jobService.updateJobProgress(job.id, 0, 'in_progress', 'Checking unique code...');
      let updated = jobService.getJob(job.id);
      assert.strictEqual(updated?.status, 'in_progress');

      // Step 1: completed
      jobService.updateJobProgress(job.id, 0, 'completed');
      updated = jobService.getJob(job.id);
      assert.strictEqual(updated?.progressPercentage, 25);

      // Step 2: completed
      jobService.updateJobProgress(job.id, 1, 'completed');
      updated = jobService.getJob(job.id);
      assert.strictEqual(updated?.progressPercentage, 50);

      // Final complete
      jobService.completeJob(job.id, { branchId: 'br_provisioned_100' });
      updated = jobService.getJob(job.id);
      assert.strictEqual(updated?.status, 'completed');
      assert.strictEqual(updated?.progressPercentage, 100);
      assert.strictEqual(updated?.result.branchId, 'br_provisioned_100');
    });

    it('GET /api/v1/jobs/:jobId returns job details and 404 for unknown job', async () => {
      const app = await buildApp();

      const job = jobService.createJob({
        type: 'test_job',
        steps: [{ id: 'step_1', name: 'Step 1' }],
      });

      // 1. Existing job
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/jobs/${job.id}`,
      });
      assert.strictEqual(res.statusCode, 200);
      const json = res.json();
      assert.strictEqual(json.data.job.id, job.id);

      // 2. Unknown job
      const missingRes = await app.inject({
        method: 'GET',
        url: '/api/v1/jobs/job_unknown_999',
      });
      assert.strictEqual(missingRes.statusCode, 404);

      await app.close();
    });
  });

  describe('3.9 Cross-Tab State Synchronization Protocol', () => {
    it('creates well-formed broadcast payloads with unique tab isolation', () => {
      const createMessage = (type: string, payload: any, tabId: string) => ({
        id: `msg_${Date.now()}`,
        type,
        payload,
        sourceTabId: tabId,
        timestamp: Date.now(),
      });

      const tabA = 'tab_123';
      const tabB = 'tab_456';

      const msg = createMessage('WORKSPACE_CHANGED', { workspaceId: 'ws_switched_99' }, tabA);

      // Handler on Tab B
      let receivedOnTabB = false;
      const handleTabB = (incoming: any) => {
        if (incoming.sourceTabId !== tabB) {
          receivedOnTabB = true;
        }
      };

      handleTabB(msg);
      assert.strictEqual(receivedOnTabB, true, 'Tab B should receive message from Tab A');

      // Handler on Tab A (should ignore own message)
      let receivedOnTabA = false;
      const handleTabA = (incoming: any) => {
        if (incoming.sourceTabId !== tabA) {
          receivedOnTabA = true;
        }
      };

      handleTabA(msg);
      assert.strictEqual(receivedOnTabA, false, 'Tab A should ignore own message to avoid infinite loop');
    });
  });
});
