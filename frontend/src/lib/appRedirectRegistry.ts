/**
 * Application redirect registry.
 * Maps application keys to their post-activation or entry redirect target and type ('spa' | 'external').
 * Prevents hardcoded branching in activation flows and eliminates inconsistent UX.
 */

import { getCrossSubdomainUrl } from './domain';

export type AppRedirectType = 'spa' | 'external';

export interface AppRedirectConfig {
  type: AppRedirectType;
  /**
   * Generates the target URL or path for this application given an organization ID.
   */
  getTarget: (orgId: string) => string;
}

/**
 * Registry mapping each application key to its redirect configuration.
 */
export const appRedirectRegistry: Record<string, AppRedirectConfig> = {
  inventory: {
    type: 'external',
    getTarget: (orgId: string) =>
      getCrossSubdomainUrl('inventory', `/onboard/app?org=${orgId}`),
  },
  pos: {
    type: 'spa',
    getTarget: (orgId: string) => `/orgs/${orgId}/apps/pos/branches`,
  },
  booking: {
    type: 'spa',
    getTarget: (orgId: string) => `/orgs/${orgId}/apps/booking/branches`,
  },
  gym: {
    type: 'spa',
    getTarget: (orgId: string) => `/orgs/${orgId}/apps/gym/branches`,
  },
  billing: {
    type: 'spa',
    getTarget: (orgId: string) => `/orgs/${orgId}/apps/billing/branches`,
  },
  taskmanagement: {
    type: 'spa',
    getTarget: (orgId: string) => `/orgs/${orgId}/apps/taskmanagement/branches`,
  },
};

/**
 * Default fallback redirect for unknown or future applications.
 */
export const defaultAppRedirect: AppRedirectConfig = {
  type: 'spa',
  getTarget: (orgId: string) => `/orgs/${orgId}/apps/inventory/branches`,
};

/**
 * Resolves the redirect configuration for an application key.
 */
export function getAppRedirectConfig(appKey: string): AppRedirectConfig {
  const normalizedKey = appKey.toLowerCase();
  return (
    appRedirectRegistry[normalizedKey] ?? {
      type: 'spa',
      getTarget: (orgId: string) => `/orgs/${orgId}/apps/${normalizedKey}/branches`,
    }
  );
}

/**
 * Executes the redirect for an application based on the registry.
 */
export function executeAppRedirect(
  appKey: string,
  orgId: string,
  navigate: (path: string) => void
): void {
  const config = getAppRedirectConfig(appKey);
  const target = config.getTarget(orgId);
  if (config.type === 'external') {
    window.location.href = target;
  } else {
    navigate(target);
  }
}
