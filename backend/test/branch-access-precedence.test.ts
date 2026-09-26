import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRequestedBranchId } from '../src/plugins/authorization.js';

describe('branch request precedence', () => {
  test('query branchId overrides the persisted x-branch-id header', () => {
    const request: any = { params: {}, body: undefined, query: { branchId: 'branch-b' }, headers: { 'x-branch-id': 'branch-a' } };
    assert.equal(resolveRequestedBranchId(request), 'branch-b');
  });

  test('path branchId overrides query and header values', () => {
    const request: any = { params: { branchId: 'branch-path' }, body: { branchId: 'branch-body' }, query: { branchId: 'branch-query' }, headers: { 'x-branch-id': 'branch-header' } };
    assert.equal(resolveRequestedBranchId(request), 'branch-path');
  });
});
