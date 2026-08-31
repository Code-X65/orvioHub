import { applications } from "./applications.js";
export function getApplicationUrl(key, env) {
    const app = applications[key];
    if (!app)
        throw new Error(`Unknown application: ${key}`);
    if (!app.enabled)
        throw new Error(`Application not enabled: ${key}`);
    return env === "production" ? app.productionUrl : app.developmentUrl;
}
export const getAccountsUrl = (e) => getApplicationUrl("accounts", e);
export const getHomeUrl = (e) => getApplicationUrl("home", e);
export const getLauncherUrl = (e) => getApplicationUrl("launcher", e);
export const getApiUrl = (e) => e === "production" ? "https://api.orviohub.com" : "http://localhost:3000";
export function getLoginUrl(returnTo, env) {
    return `${getAccountsUrl(env)}/login?returnTo=${encodeURIComponent(returnTo)}`;
}
export function getPostLoginUrl(_hasOrganizations, env) {
    return getHomeUrl(env);
}
export function getInvitationUrl(token, env) {
    return `${getAccountsUrl(env)}/invitations/${token}`;
}
export function getVerifyEmailUrl(token, env) {
    return `${getAccountsUrl(env)}/verify-email/${token}`;
}
export function getResetPasswordUrl(token, env) {
    return `${getAccountsUrl(env)}/reset-password?token=${token}`;
}
export function getConfirmEmailChangeUrl(token, env) {
    return `${getAccountsUrl(env)}/confirm-email-change?token=${token}`;
}
//# sourceMappingURL=urls.js.map