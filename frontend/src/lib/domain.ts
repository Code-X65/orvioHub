/**
 * Re-exports and helpers backed by @orviohub/shared
 * Single source of truth application registry and URL utilities.
 */
import {
  getApplicationUrl,
  resolveHost,
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
 * Generates cross-surface URL with optional authentication token forwarding.
 */
export function getCrossSubdomainUrl(
  appKey: ApplicationKey,
  path = "",
  includeAuth = true,
  envOverride?: Environment
): string {
  const env =
    envOverride ||
    (typeof window !== "undefined"
      ? resolveHost(window.location.host).environment
      : "development");

  const baseUrl = getApplicationUrl(appKey, env);
  const cleanPath = path.startsWith("/") ? path : path ? `/${path}` : "";
  const targetUrl = `${baseUrl}${cleanPath}`;

  if (typeof window === "undefined" || !includeAuth) return targetUrl;

  const token = localStorage.getItem("orvio_auth_token");
  const refreshToken = localStorage.getItem("orvio_refresh_token");

  if (!token) return targetUrl;

  try {
    const url = new URL(targetUrl);
    url.searchParams.set("auth_token", token);
    if (refreshToken) {
      url.searchParams.set("refresh_token", refreshToken);
    }
    return url.toString();
  } catch {
    return targetUrl;
  }
}
