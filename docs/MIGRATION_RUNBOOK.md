# Orviohub Migration & Reconciliation Runbook

This runbook describes safe procedures for database schema evolution, tenant identity normalization, and quota reconciliations.

---

## 1. Safety Preconditions & Rules
1. **Never perform destructive database modifications without an active backup snapshot.**
2. **Execute all migration scripts with a `--dry-run` flag first to inspect affected record counts.**
3. **Log all migration operations to `admin_audit_logs` with the executing administrator's ID.**

---

## 2. Standard Migration Procedures

### Procedure A: Data Integrity Diagnostic Check
- **Purpose**: Detect orphaned branches, duplicate primary branches, or branch quota breaches.
- **Execution Command**:
  ```bash
  npx tsx -e "import { DataIntegrityService } from './src/services/dataIntegrityService.js'; DataIntegrityService.runDiagnostics({}).then(console.log);"
  ```
- **Validation**: Ensure `isHealthy: true` and `totalIssuesFound: 0`.

### Procedure B: Organization Identity Normalization
- **Purpose**: Ensure all legacy `workspaceId` and `organizationId` references point to the canonical workspace identifier.
- **Rollback Strategy**: Restore Convex database snapshot from pre-migration backup tag.
