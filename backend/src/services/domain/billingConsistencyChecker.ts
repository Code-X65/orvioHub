import { dataService } from '../dataService.js';

export interface ConsistencyCheckIssue {
  type: string;
  severity: 'high' | 'medium' | 'low';
  workspaceId: string;
  description: string;
  details?: Record<string, any>;
  suggestedAction: string;
}

export interface ConsistencyCheckReport {
  timestamp: number;
  totalWorkspacesChecked: number;
  healthyCount: number;
  mismatchCount: number;
  issues: ConsistencyCheckIssue[];
}

export class BillingConsistencyChecker {
  /**
   * Run comprehensive audit across all tenant workspaces
   */
  public async runFullAudit(): Promise<ConsistencyCheckReport> {
    const issues: ConsistencyCheckIssue[] = [];
    const now = Date.now();

    // Query active workspaces
    let workspaces: any[] = [];
    try {
      const res = await dataService.query('workspaces:listActiveWorkspaces', {} as any);
      workspaces = Array.isArray(res) ? res : [];
    } catch {
      try {
        const allWs = await dataService.query('workspaces:list', {} as any);
        workspaces = Array.isArray(allWs) ? allWs : [];
      } catch {
        workspaces = [];
      }
    }
    let healthyCount = 0;

    for (const ws of workspaces) {
      const wsId = String(ws._id || ws.id);
      try {
        const context: any = await dataService.query('subscriptions:getBillingContext', {
          organizationId: wsId as any,
        });

        if (!context) {
          issues.push({
            type: 'missing_billing_context',
            severity: 'high',
            workspaceId: wsId,
            description: `Workspace ${ws.name || wsId} has no resolved billing context.`,
            suggestedAction: 'recalculate_entitlements',
          });
          continue;
        }

        const sub = context.billing;
        const status = (sub?.status || sub?.subscriptionStatus || '').toLowerCase();
        const activePlan = (sub?.activePlan || '').toLowerCase();
        const planKey = (sub?.planKey || '').toLowerCase();

        // 1. Check: Paid Active subscription with trial limits
        if (status === 'active' && (planKey === 'standard' || planKey === 'premium')) {
          const entitlements = context.entitlements;
          if (entitlements?.maxBranchesPerApplication === 1 && planKey !== 'free_trial') {
            issues.push({
              type: 'paid_subscription_with_trial_entitlements',
              severity: 'high',
              workspaceId: wsId,
              description: `Workspace ${ws.name} is on ${planKey} but has Free Trial limits.`,
              details: { planKey, limits: entitlements },
              suggestedAction: 'recalculate_entitlements',
            });
          }
        }

        // 2. Check: Active subscription with trialEnd remaining
        if (status === 'active' && (planKey === 'standard' || planKey === 'premium') && sub?.trialEnd) {
          issues.push({
            type: 'active_paid_has_trial_end_timestamp',
            severity: 'medium',
            workspaceId: wsId,
            description: `Workspace ${ws.name} has paid active subscription but retains trialEnd timestamp.`,
            details: { planKey, trialEnd: sub.trialEnd },
            suggestedAction: 'clear_trial_end',
          });
        }

        // 3. Check: Entitlement status mismatch
        if (status === 'active' && sub?.entitlementStatus === 'inactive') {
          issues.push({
            type: 'entitlement_status_mismatch',
            severity: 'high',
            workspaceId: wsId,
            description: `Subscription status is active but entitlementStatus is inactive.`,
            details: { subscriptionStatus: status, entitlementStatus: sub?.entitlementStatus },
            suggestedAction: 'activate_entitlements',
          });
        }

        if (issues.filter((i) => i.workspaceId === wsId).length === 0) {
          healthyCount++;
        }
      } catch (err: any) {
        issues.push({
          type: 'evaluation_error',
          severity: 'low',
          workspaceId: wsId,
          description: `Failed to evaluate consistency for ${wsId}: ${err?.message || String(err)}`,
          suggestedAction: 'inspect_manually',
        });
      }
    }

    return {
      timestamp: now,
      totalWorkspacesChecked: workspaces.length,
      healthyCount,
      mismatchCount: workspaces.length - healthyCount,
      issues,
    };
  }
}

export const billingConsistencyChecker = new BillingConsistencyChecker();
