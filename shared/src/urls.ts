import { applications, type ApplicationKey } from "./applications.js";
import type { Environment } from "./host.js";

export function getApplicationUrl(key: ApplicationKey, env: Environment): string {
  const app = applications[key];
  if (!app) throw new Error(`Unknown application: ${key}`);
  if (!app.enabled) throw new Error(`Application not enabled: ${key}`);
  return env === "production" ? app.productionUrl : app.developmentUrl;
}

export const getAccountsUrl = (e: Environment) => getApplicationUrl("accounts", e);
export const getHomeUrl = (e: Environment) => getApplicationUrl("home", e);
export const getLauncherUrl = (e: Environment) => getApplicationUrl("launcher", e);

export const getApiUrl = (e: Environment) =>
  e === "production" ? "https://api.orviohub.com" : "http://localhost:3000";

export function getLoginUrl(returnTo: string, env: Environment): string {
  return `${getAccountsUrl(env)}/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function getPostLoginUrl(_hasOrganizations: boolean, env: Environment): string {
  return getHomeUrl(env);
}

export function getInvitationUrl(token: string, env: Environment): string {
  return `${getAccountsUrl(env)}/invitations/${token}`;
}

export function getVerifyEmailUrl(token: string, env: Environment): string {
  return `${getAccountsUrl(env)}/verify-email/${token}`;
}

export function getResetPasswordUrl(token: string, env: Environment): string {
  return `${getAccountsUrl(env)}/reset-password?token=${token}`;
}

export function getConfirmEmailChangeUrl(token: string, env: Environment): string {
  return `${getAccountsUrl(env)}/confirm-email-change?token=${token}`;
}
