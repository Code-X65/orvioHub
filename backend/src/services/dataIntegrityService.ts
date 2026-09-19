/**
 * Data Integrity Diagnostic Service
 * Runs validation checks across Organizations, Applications, Branches, Memberships,
 * Subscriptions, and Audit records to detect anomalies, orphaned rows, and quota breaches.
 */

export interface IntegrityIssue {
  recordType: 'organization' | 'branch' | 'membership' | 'application' | 'subscription' | 'audit_log';
  recordId: string;
  detectedConflict: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  repairRecommendation: string;
  repairStatus: 'detected' | 'repaired' | 'manual_review_required';
}

export interface IntegrityReport {
  timestamp: string;
  totalRecordsChecked: number;
  totalIssuesFound: number;
  issues: IntegrityIssue[];
  isHealthy: boolean;
}

export class DataIntegrityService {
  /**
   * Runs diagnostic checks across in-memory or database records
   */
  public static async runDiagnostics(data: {
    organizations?: any[];
    branches?: any[];
    memberships?: any[];
    applications?: any[];
    subscriptions?: any[];
    auditLogs?: any[];
  }): Promise<IntegrityReport> {
    const issues: IntegrityIssue[] = [];
    const orgs = data.organizations || [];
    const branches = data.branches || [];
    const memberships = data.memberships || [];
    const apps = data.applications || [];
    const subs = data.subscriptions || [];
    const auditLogs = data.auditLogs || [];

    const orgIdSet = new Set(orgs.map((o) => o._id || o.id));

    // 1. Check for orphaned branches (branch with non-existent organization/workspace)
    for (const branch of branches) {
      const orgId = branch.workspaceId || branch.organizationId;
      if (orgId && !orgIdSet.has(orgId)) {
        issues.push({
          recordType: 'branch',
          recordId: branch._id || branch.id || 'unknown',
          detectedConflict: `Branch references non-existent organization ${orgId}`,
          severity: 'high',
          repairRecommendation: 'Reassign to a valid organization or archive orphaned branch',
          repairStatus: 'manual_review_required',
        });
      }
    }

    // 2. Check for duplicate primary branches within the same organization
    const orgPrimaryBranches: Record<string, any[]> = {};
    for (const branch of branches) {
      const orgId = branch.workspaceId || branch.organizationId;
      if (branch.isPrimary && branch.status !== 'archived') {
        if (!orgPrimaryBranches[orgId]) {
          orgPrimaryBranches[orgId] = [];
        }
        orgPrimaryBranches[orgId].push(branch);
      }
    }

    for (const [orgId, primList] of Object.entries(orgPrimaryBranches)) {
      if (primList.length > 1) {
        issues.push({
          recordType: 'branch',
          recordId: primList.map((b) => b._id || b.id).join(', '),
          detectedConflict: `Organization ${orgId} has ${primList.length} active primary branches`,
          severity: 'high',
          repairRecommendation: 'Designate the latest active branch as primary and set isPrimary=false on older branches',
          repairStatus: 'manual_review_required',
        });
      }
    }

    // 3. Check for orphaned memberships
    for (const member of memberships) {
      const orgId = member.workspaceId || member.organizationId;
      if (orgId && !orgIdSet.has(orgId)) {
        issues.push({
          recordType: 'membership',
          recordId: member._id || member.id || 'unknown',
          detectedConflict: `Membership references non-existent organization ${orgId}`,
          severity: 'medium',
          repairRecommendation: 'Purge or archive orphaned membership record',
          repairStatus: 'manual_review_required',
        });
      }
    }

    // 4. Check for branch limit violations against plan tiers
    const planLimits: Record<string, number> = {
      free_trial: 1,
      standard: 3,
      premium: 10,
    };

    for (const org of orgs) {
      const orgId = org._id || org.id;
      const orgBranches = branches.filter(
        (b) => (b.workspaceId === orgId || b.organizationId === orgId) && b.status !== 'archived'
      );
      const sub = subs.find((s) => s.workspaceId === orgId || s.organizationId === orgId);
      const plan = sub?.plan || org.plan || 'free_trial';
      const maxAllowed = planLimits[plan] || 1;

      if (orgBranches.length > maxAllowed) {
        issues.push({
          recordType: 'organization',
          recordId: orgId,
          detectedConflict: `Organization on ${plan} has ${orgBranches.length} active branches (limit: ${maxAllowed})`,
          severity: 'high',
          repairRecommendation: `Prompt organization to upgrade plan or archive excess branches beyond limit ${maxAllowed}`,
          repairStatus: 'manual_review_required',
        });
      }
    }

    // 5. Check for audit logs missing canonical tenant context
    for (const log of auditLogs) {
      if (!log.workspaceId && !log.organizationId) {
        issues.push({
          recordType: 'audit_log',
          recordId: log.eventId || log._id || 'unknown',
          detectedConflict: 'Audit log record lacks canonical workspaceId/organizationId tenant identifier',
          severity: 'critical',
          repairRecommendation: 'Re-index audit event with actor workspace context',
          repairStatus: 'manual_review_required',
        });
      }
    }

    const totalRecordsChecked =
      orgs.length + branches.length + memberships.length + apps.length + subs.length + auditLogs.length;

    return {
      timestamp: new Date().toISOString(),
      totalRecordsChecked,
      totalIssuesFound: issues.length,
      issues,
      isHealthy: issues.length === 0,
    };
  }
}
