/**
 * Re-exports and helpers backed by @orviohub/shared
 * Single source of truth application registry and URL utilities.
 */
import {
  resolveHost,
  getApplicationUrl,
  isAllowedReturnTo,
  type ApplicationKey,
  type Environment,
} from "@orviohub/shared";

export * from "@orviohub/shared";
export { applications as APPLICATIONS } from "@orviohub/shared";
export { getApplicationUrl as getAppUrl } from "@orviohub/shared";

/**
 * Returns the current application surface key.
 */
export function getCurrentSubdomain(): ApplicationKey {
  if (typeof window === "undefined") return "marketing";
  try {
    const host = resolveHost(window.location.host);
    return host.application;
  } catch {
    return "marketing";
  }
}

/**
 * Generates cross-surface URL pointing to the appropriate subdomain and path.
 */
export function getCrossSubdomainUrl(
  appKey: ApplicationKey,
  path = "",
  _includeAuth = false,
  _envOverride?: Environment
): string {
  let env: Environment = _envOverride || "development";
  if (typeof window !== "undefined") {
    try {
      const host = resolveHost(window.location.host);
      env = host.environment;
    } catch {
      env = "development";
    }
  }

  const cleanPath = path.startsWith("/") ? path : path ? `/${path}` : "";
  return getApplicationUrl(appKey, env, cleanPath);
}

/**
 * Validates whether a return URL is safe to redirect to.
 */
export function isValidReturnUrl(url: string, envOverride?: Environment): boolean {
  let env: Environment = envOverride || "development";
  if (typeof window !== "undefined") {
    try {
      const host = resolveHost(window.location.host);
      env = host.environment;
    } catch {
      env = "development";
    }
  }
  return isAllowedReturnTo(url, env);
}
