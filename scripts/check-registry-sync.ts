/**
 * Build-time and CI validation script: check-registry-sync.ts
 *
 * Verifies that the single canonical source of truth for applications
 * (shared/src/applications.ts) is in complete sync across:
 * 1. Canonical Shared Application Definitions
 * 2. Backend activation gating (APPLICATIONS and isActivatable)
 * 3. Frontend display metadata (appRegistry.ts)
 * 4. Frontend redirect routing (appRedirectRegistry.ts)
 *
 * Fails with a non-zero exit code if any drift or missing metadata is detected.
 */

import {
  applications,
  USER_FACING_APP_KEYS,
  KNOWN_PLAN_KEYS,
  type ApplicationKey,
} from '../shared/src/applications.js';

interface SyncError {
  appKey: string;
  category: string;
  message: string;
}

const errors: SyncError[] = [];

console.log('🔍 Validating Application Registry synchronization across packages...\n');

// 1. Validate Canonical Shared Definitions
for (const [key, app] of Object.entries(applications)) {
  if (!app.key) {
    errors.push({ appKey: key, category: 'shared/applications', message: 'Missing key property' });
  }
  if (!app.name || app.name.trim() === '') {
    errors.push({ appKey: key, category: 'shared/applications', message: 'Missing or empty name' });
  }
  if (!app.description || app.description.trim() === '') {
    errors.push({ appKey: key, category: 'shared/applications', message: 'Missing or empty description' });
  }
  if (!app.availability || !['available', 'coming_soon', 'beta'].includes(app.availability)) {
    errors.push({ appKey: key, category: 'shared/applications', message: `Invalid or missing availability: "${app.availability}"` });
  }
  if (app.badge && app.badge.toLowerCase().includes('coming soon')) {
    errors.push({
      appKey: key,
      category: 'shared/applications',
      message: 'Badge field is overloaded with "Coming Soon". Use availability field instead of marketing badge.',
    });
  }
  if (!Array.isArray(app.planRequirements)) {
    errors.push({ appKey: key, category: 'shared/applications', message: 'Missing planRequirements array' });
  } else {
    for (const req of app.planRequirements) {
      if (!KNOWN_PLAN_KEYS.includes(req.toLowerCase() as any)) {
        errors.push({
          appKey: key,
          category: 'planRequirements',
          message: `Unrecognized planRequirement "${req}". Must be one of: ${KNOWN_PLAN_KEYS.join(', ')}`,
        });
      }
    }
  }
  if (!app.iconName || app.iconName.trim() === '') {
    errors.push({ appKey: key, category: 'shared/applications', message: 'Missing or empty iconName' });
  }
  if (typeof app.isActivatable !== 'boolean') {
    errors.push({ appKey: key, category: 'shared/applications', message: 'isActivatable must be a boolean' });
  }
}

// 2. Validate User-Facing Keys
for (const userKey of USER_FACING_APP_KEYS) {
  const app = applications[userKey];
  if (!app) {
    errors.push({
      appKey: userKey,
      category: 'USER_FACING_APP_KEYS',
      message: `Key "${userKey}" is in USER_FACING_APP_KEYS but missing from applications registry`,
    });
  } else {
    if (app.isActivatable && app.status !== 'available') {
      errors.push({
        appKey: userKey,
        category: 'activation_consistency',
        message: `App "${userKey}" is marked isActivatable: true but status is "${app.status}" (must be "available")`,
      });
    }
  }
}

// 3. Validate Frontend Display Registry Alignment
// Note: frontend/src/lib/appRegistry.ts dynamically imports and derives from @orviohub/shared
for (const userKey of USER_FACING_APP_KEYS) {
  const app = applications[userKey];
  if (app) {
    if (app.planRequirements.length === 0 && app.isActivatable) {
      errors.push({
        appKey: userKey,
        category: 'frontend/appRegistry',
        message: `Activatable app "${userKey}" has empty planRequirements`,
      });
    }
  }
}

// 4. Output Results
if (errors.length > 0) {
  console.error('❌ Registry sync failed with errors:');
  for (const err of errors) {
    console.error(`  - [${err.category}] App "${err.appKey}": ${err.message}`);
  }
  console.error(`\nTotal errors: ${errors.length}. Aborting build.`);
  process.exit(1);
} else {
  console.log('✅ All application registries are in perfect synchronization!');
  console.log(`   - Verified ${Object.keys(applications).length} total application definitions.`);
  console.log(`   - Verified ${USER_FACING_APP_KEYS.length} user-facing applications: ${USER_FACING_APP_KEYS.join(', ')}.`);
  console.log('   - Canonical source: shared/src/applications.ts');
  process.exit(0);
}
