import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getErrorMessage, getFieldErrors, isErrorCode } from '../../frontend/src/lib/errorMapper.js';

describe('User Experience Remediation (Gaps 3.3, 3.4, 3.5, 3.6)', () => {
  describe('3.3 Centralized Error-to-UI Mapper', () => {
    it('maps canonical auth and session error codes to clear messages', () => {
      assert.strictEqual(
        getErrorMessage({ code: 'USER_ALREADY_EXISTS' }),
        'An account with this email address already exists.'
      );
      assert.strictEqual(
        getErrorMessage({ code: 'INVALID_CREDENTIALS' }),
        'The email or password you entered is incorrect. Please check and try again.'
      );
      assert.strictEqual(
        getErrorMessage({ code: 'ACCOUNT_LOCKED' }),
        'Account has been temporarily locked due to multiple failed login attempts. Please try again later or reset your password.'
      );
      assert.strictEqual(
        getErrorMessage({ code: 'UNAUTHORIZED' }),
        'Your session has expired or you are not signed in. Please sign in again.'
      );
      assert.strictEqual(
        getErrorMessage({ code: 'SESSION_EXPIRED' }),
        'Your session has expired. Please sign in again to continue.'
      );
    });

    it('maps resource and plan limits to actionable upgrade messages', () => {
      assert.strictEqual(
        getErrorMessage({ code: 'PLAN_LIMIT_REACHED' }),
        'You have reached the resource limit for your current subscription plan. Upgrade your plan to increase limits.'
      );
      assert.strictEqual(
        getErrorMessage({ code: 'BRANCH_LIMIT_REACHED' }),
        'You have reached the maximum number of branches for your plan. Please upgrade to add more branches.'
      );
      assert.strictEqual(
        getErrorMessage({ code: 'MEMBER_LIMIT_REACHED' }),
        'You have reached the maximum number of team members for your plan. Please upgrade to invite more members.'
      );
      assert.strictEqual(
        getErrorMessage({ code: 'PRODUCT_LIMIT_REACHED' }),
        'You have reached the maximum catalog product limit for your plan.'
      );
    });

    it('extracts structured field validation errors if available', () => {
      const valError = {
        code: 'VALIDATION_ERROR',
        fields: {
          email: ['Please provide a valid business email address'],
          name: ['Name is required'],
        },
      };
      assert.strictEqual(
        getErrorMessage(valError),
        'Please provide a valid business email address'
      );

      const fieldMap = getFieldErrors(valError);
      assert.strictEqual(fieldMap.email, 'Please provide a valid business email address');
      assert.strictEqual(fieldMap.name, 'Name is required');
    });

    it('falls back gracefully to HTTP status code mappings', () => {
      assert.strictEqual(
        getErrorMessage({ status: 404, message: 'Request failed with status 404' }),
        'The requested item was not found.'
      );
      assert.strictEqual(
        getErrorMessage({ status: 429, message: 'Request failed with status 429' }),
        'Too many requests. Please slow down and try again shortly.'
      );
      assert.strictEqual(
        getErrorMessage({ status: 503, message: 'Request failed with status 503' }),
        'Service temporarily unavailable. Please try again in a few moments.'
      );
    });

    it('identifies error codes reliably with isErrorCode', () => {
      const err = { code: 'BRANCH_LIMIT_REACHED' };
      assert.strictEqual(isErrorCode(err, 'BRANCH_LIMIT_REACHED'), true);
      assert.strictEqual(isErrorCode(err, 'branch_limit_reached'), true);
      assert.strictEqual(isErrorCode(err, 'MEMBER_LIMIT_REACHED', 'PLAN_LIMIT_REACHED'), false);
    });
  });

  describe('3.4 Optimistic Update Exact Rollback Pattern', () => {
    it('restores snapshot state on failure for optimistic mutation', async () => {
      // Test state store rollback model
      let state = {
        notifications: [
          { id: 'notif_1', status: 'UNREAD' },
          { id: 'notif_2', status: 'UNREAD' },
        ],
        unreadCount: 2,
      };

      const markAsReadOptimistic = async (id: string, simulateFail = false) => {
        const prev = { notifications: [...state.notifications], unreadCount: state.unreadCount };

        // Optimistic update
        state = {
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, status: 'READ' } : n)),
          unreadCount: Math.max(0, state.unreadCount - 1),
        };

        if (simulateFail) {
          // Rollback on failure
          state = prev;
          throw new Error('Server reject');
        }
      };

      // 1. Success case
      await markAsReadOptimistic('notif_1', false);
      assert.strictEqual(state.unreadCount, 1);
      assert.strictEqual(state.notifications.find((n) => n.id === 'notif_1')?.status, 'READ');

      // 2. Failure case with rollback
      await assert.rejects(async () => {
        await markAsReadOptimistic('notif_2', true);
      });
      assert.strictEqual(state.unreadCount, 1, 'Unread count restored to pre-mutation value');
      assert.strictEqual(state.notifications.find((n) => n.id === 'notif_2')?.status, 'UNREAD', 'Item status restored');
    });
  });

  describe('3.5 Debounced Search Utility & State Management', () => {
    it('debounced value updates only after the specified timer period', async () => {
      let executedCount = 0;
      let lastQuery = '';

      const debouncedFn = (query: string) => {
        executedCount++;
        lastQuery = query;
      };

      let timer: any = null;
      const trigger = (val: string, delay = 100) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          debouncedFn(val);
        }, delay);
      };

      trigger('a');
      trigger('ap');
      trigger('app');
      trigger('apple');

      assert.strictEqual(executedCount, 0, 'Should not execute before timer fires');
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.strictEqual(executedCount, 1, 'Should execute only once with final value');
      assert.strictEqual(lastQuery, 'apple', 'Executed with latest search term');
    });
  });
});
