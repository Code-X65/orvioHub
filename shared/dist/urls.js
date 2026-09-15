import { applications, resolveDevUrl } from "./applications.js";
function getEnv(key) {
    const globalObj = globalThis;
    if (typeof globalObj.process !== "undefined" && globalObj.process?.env && globalObj.process.env[key]) {
        return globalObj.process.env[key];
    }
    try {
        // @ts-ignore
        if (typeof import.meta !== "undefined" && import.meta?.env) {
            // @ts-ignore
            return import.meta.env[`VITE_${key}`] || import.meta.env[key];
        }
    }
    catch { }
    return undefined;
}
export function getApplicationUrl(key, env = "development", path = "") {
    const app = applications[key] || applications.home || applications.marketing;
    if (!app) {
        return resolveDevUrl("home", path);
    }
    const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
    if (env === "production")
        return `${app.productionUrl}${cleanPath}`;
    if (env === "preproduction")
        return `${app.preproductionUrl || app.productionUrl}${cleanPath}`;
    // Development environment: check explicit BASE_URL_* overrides
    if (key === "marketing" && getEnv("BASE_URL_MARKETING")) {
        return `${getEnv("BASE_URL_MARKETING").replace(/\/$/, "")}${cleanPath}`;
    }
    if (key === "accounts" && getEnv("BASE_URL_ACCOUNT")) {
        return `${getEnv("BASE_URL_ACCOUNT").replace(/\/$/, "")}${cleanPath}`;
    }
    if ((key === "home" || key === "launcher" || key === "booking" || key === "gym") && getEnv("BASE_URL_HOME")) {
        return `${getEnv("BASE_URL_HOME").replace(/\/$/, "")}${cleanPath}`;
    }
    if ((key === "inventory" || key === "pos") && getEnv("BASE_URL_INVENTORY")) {
        return `${getEnv("BASE_URL_INVENTORY").replace(/\/$/, "")}${cleanPath}`;
    }
    if (key === "taskmanagement" && getEnv("BASE_URL_TASKS")) {
        return `${getEnv("BASE_URL_TASKS").replace(/\/$/, "")}${cleanPath}`;
    }
    return resolveDevUrl(app.subdomain, cleanPath);
}
export const getMarketingUrl = (e = "development", path = "") => getApplicationUrl("marketing", e, path);
export const getAccountsUrl = (e = "development", path = "") => getApplicationUrl("accounts", e, path);
export const getHomeUrl = (e = "development", path = "") => getApplicationUrl("home", e, path);
export const getLauncherUrl = (e = "development", path = "") => getApplicationUrl("launcher", e, path);
export const getInventoryUrl = (e = "development", path = "") => getApplicationUrl("inventory", e, path);
export const getPosUrl = (e = "development", path = "") => getApplicationUrl("pos", e, path);
export const getBookingUrl = (e = "development", path = "") => getApplicationUrl("booking", e, path);
export const getGymUrl = (e = "development", path = "") => getApplicationUrl("gym", e, path);
export const getTaskmanagementUrl = (e = "development", path = "") => getApplicationUrl("taskmanagement", e, path);
export const getBillingUrl = (e = "development", path = "") => getApplicationUrl("billing", e, path);
export const getApiUrl = (e = "development") => {
    if (e === "production")
        return "https://api.orviohub.com";
    if (e === "preproduction")
        return "https://api.preprod.orviohub.com";
    return "http://localhost:4000";
};
export function getLoginUrl(returnTo, env = "development") {
    const base = getAccountsUrl(env);
    if (returnTo) {
        return `${base}/login?redirect=${encodeURIComponent(returnTo)}`;
    }
    return `${base}/login`;
}
export function getSignupUrl(returnTo, env = "development") {
    const base = getAccountsUrl(env);
    if (returnTo) {
        return `${base}/signup?redirect=${encodeURIComponent(returnTo)}`;
    }
    return `${base}/signup`;
}
export function getPostLoginUrl(_hasOrganizations, env = "development") {
    return getHomeUrl(env);
}
export function getPostVerificationUrl(env = "development") {
    return `${getHomeUrl(env)}/onboard/personal`;
}
export function getPersonalOnboardingUrl(env = "development") {
    return `${getHomeUrl(env)}/onboard/personal`;
}
export function getOrganizationOnboardingUrl(env = "development") {
    return `${getHomeUrl(env)}/onboard/organization`;
}
export function getInvitationUrl(token, env = "development") {
    return `${getAccountsUrl(env)}/invite?token=${encodeURIComponent(token)}`;
}
export function getVerifyEmailUrl(token, env = "development", email) {
    const emailParam = email ? `&email=${encodeURIComponent(email)}` : "";
    return `${getAccountsUrl(env)}/verify-email?token=${encodeURIComponent(token)}${emailParam}`;
}
export function getResetPasswordUrl(token, env = "development", email) {
    const emailParam = email ? `&email=${encodeURIComponent(email)}` : "";
    return `${getAccountsUrl(env)}/reset-password?token=${encodeURIComponent(token)}${emailParam}`;
}
export function getConfirmEmailChangeUrl(token, env = "development") {
    return `${getAccountsUrl(env)}/confirm-email-change?token=${encodeURIComponent(token)}`;
}
//# sourceMappingURL=urls.js.map