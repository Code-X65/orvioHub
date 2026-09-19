# Orviohub Incident Response Runbook

Standard Operating Procedures (SOP) for handling security, billing, and system incidents.

---

## 1. Incident Severity Definitions

| Severity | Description | Response Time Target |
| :--- | :--- | :--- |
| **SEV-1 (Critical)** | Cross-tenant data bleed, unauthorized privilege escalation, total API outage. | < 15 Minutes |
| **SEV-2 (High)** | Payment webhook failures, inability to switch branches, critical quota bugs. | < 1 Hour |
| **SEV-3 (Medium)** | Notification delivery delays, minor UI styling issues, non-blocking logs. | < 24 Hours |

---

## 2. Standard Operating Procedures

### Scenario A: Potential Cross-Tenant Access Alert
1. **Containment**: Immediately block the affected endpoint or revoke the suspect user's active sessions via `POST /api/v1/admin/organizations/:id/revoke-sessions`.
2. **Investigation**: Query `audit_events` for the suspect user ID and inspect all tenant scopes accessed.
3. **Remediation**: Verify and patch authorization checks in `requireWorkspaceRole`. Add automated regression test in `test/phase9-e2e-security-hardening.test.ts`.
4. **Post-Mortem**: Document root cause, timeline, affected tenant list, and preventative actions.

### Scenario B: Payment & Webhook Delivery Failure
1. **Verification**: Inspect Paystack dashboard event log and Fastify webhook receiver status.
2. **Safe Replay**: Re-dispatch the failed webhook event from the Paystack dashboard using idempotent event IDs.
3. **Reconciliation**: Confirm the customer's subscription and entitlements updated correctly.
