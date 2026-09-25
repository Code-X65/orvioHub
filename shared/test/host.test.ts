import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveHost,
  UnknownHostError,
  getApplicationUrl,
  getLoginUrl,
  getSignupUrl,
  getPostLoginUrl,
  getPostVerificationUrl,
  getInvitationUrl,
  getVerifyEmailUrl,
  getResetPasswordUrl,
  isAllowedReturnTo,
  isAllowedOrigin,
  developmentOrigins,
  productionOrigins,
  applications,
  getAllowedHosts,
} from "../src/index.js";

describe("Host Resolution", () => {
  it("resolves development marketing root", () => {
    const res = resolveHost("orviohub.localhost:4000");
    assert.equal(res.application, "marketing");
    assert.equal(res.environment, "development");
    assert.equal(res.hostname, "orviohub.localhost");
  });

  it("resolves all development subdomains", () => {
    const cases = [
      { host: "account.orviohub.localhost:4000", expected: "accounts" },
      { host: "accounts.orviohub.localhost:4000", expected: "accounts" },
      { host: "home.orviohub.localhost:4000", expected: "home" },
      { host: "app.orviohub.localhost:4000", expected: "home" },
      { host: "inventory.orviohub.localhost:4000", expected: "inventory" },
      { host: "pos.orviohub.localhost:4000", expected: "inventory" },
      { host: "billing.orviohub.localhost:4000", expected: "billing" },
      { host: "taskmanagement.orviohub.localhost:4000", expected: "taskmanagement" },
      { host: "tasks.orviohub.localhost:4000", expected: "taskmanagement" },
    ] as const;

    for (const { host, expected } of cases) {
      const res = resolveHost(host);
      assert.equal(res.application, expected);
      assert.equal(res.environment, "development");
    }
  });

  it("resolves production root and subdomains", () => {
    assert.equal(resolveHost("orviohub.com").application, "marketing");
    assert.equal(resolveHost("account.orviohub.com").application, "accounts");
    assert.equal(resolveHost("accounts.orviohub.com").application, "accounts");
    assert.equal(resolveHost("home.orviohub.com").application, "home");
    assert.equal(resolveHost("app.orviohub.com").application, "home");
    assert.equal(resolveHost("inventory.orviohub.com").application, "inventory");
    assert.equal(resolveHost("pos.orviohub.com").application, "inventory");
    assert.equal(resolveHost("billing.orviohub.com").application, "billing");
    assert.equal(resolveHost("taskmanagement.orviohub.com").application, "taskmanagement");
    assert.equal(resolveHost("tasks.orviohub.com").application, "taskmanagement");

    assert.equal(resolveHost("orviohub.com").environment, "production");
    assert.equal(resolveHost("account.orviohub.com").environment, "production");
  });

  it("rejects admin.orviohub.* explicitly (isolated administrative service)", () => {
    assert.throws(() => resolveHost("admin.orviohub.localhost:4000"), UnknownHostError);
    assert.throws(() => resolveHost("admin.orviohub.com"), UnknownHostError);
  });

  it("rejects unrecognized subdomains with UnknownHostError without defaulting", () => {
    assert.throws(() => resolveHost("unknown.orviohub.localhost:4000"), UnknownHostError);
    assert.throws(() => resolveHost("unknown.orviohub.com"), UnknownHostError);
    assert.throws(() => resolveHost("gym.orviohub.localhost:4000"), UnknownHostError);
  });

  it("rejects nested subdomains outright", () => {
    assert.throws(() => resolveHost("nested.sub.orviohub.localhost:4000"), UnknownHostError);
    assert.throws(() => resolveHost("foo.bar.orviohub.com"), UnknownHostError);
  });

  it("rejects non-orviohub hosts", () => {
    assert.throws(() => resolveHost("google.com"), UnknownHostError);
    assert.throws(() => resolveHost("example.com"), UnknownHostError);
  });
});

describe("URL Helpers", () => {
  it("generates correct application URLs", () => {
    assert.equal(getApplicationUrl("accounts", "development"), "http://account.orviohub.localhost:3000");
    assert.equal(getApplicationUrl("accounts", "production"), "https://accounts.orviohub.com");
    assert.equal(getApplicationUrl("home", "development"), "http://home.orviohub.localhost:3000");
    assert.equal(getApplicationUrl("inventory", "development"), "http://inventory.orviohub.localhost:3000");
    assert.equal(getApplicationUrl("billing", "development"), "http://billing.orviohub.localhost:3000");
  });

  it("generates cross-subdomain login and post-login URLs", () => {
    const loginUrl = getLoginUrl("http://inventory.orviohub.localhost:3000/dashboard", "development");
    assert.equal(loginUrl, "http://account.orviohub.localhost:3000/login?redirect=http%3A%2F%2Finventory.orviohub.localhost%3A3000%2Fdashboard");

    assert.equal(getLoginUrl(undefined, "development"), "http://account.orviohub.localhost:3000/login");
    assert.equal(getSignupUrl(undefined, "development"), "http://account.orviohub.localhost:3000/signup");
    assert.equal(getPostLoginUrl(true, "development"), "http://home.orviohub.localhost:3000");
    assert.equal(getPostVerificationUrl("development"), "http://home.orviohub.localhost:3000/onboard/personal");
  });

  it("generates email action URLs with token and email parameters", () => {
    const verifyUrl = getVerifyEmailUrl("tok123", "development", "user@company.com");
    assert.equal(verifyUrl, "http://account.orviohub.localhost:3000/verify-email?token=tok123&email=user%40company.com");

    const resetUrl = getResetPasswordUrl("tok456", "development", "user@company.com");
    assert.equal(resetUrl, "http://account.orviohub.localhost:3000/reset-password?token=tok456&email=user%40company.com");

    const inviteUrl = getInvitationUrl("inv789", "development");
    assert.equal(inviteUrl, "http://account.orviohub.localhost:3000/invite?token=inv789");
  });

  it("validates returnTo URLs safely and blocks admin / evil redirects", () => {
    assert.equal(isAllowedReturnTo("/dashboard", "development"), true);
    assert.equal(isAllowedReturnTo("/inventory/dashboard", "development"), true);
    assert.equal(isAllowedReturnTo("http://inventory.orviohub.localhost:3000/dashboard", "development"), true);
    assert.equal(isAllowedReturnTo("http://home.orviohub.localhost:3000/onboard", "development"), true);
    assert.equal(isAllowedReturnTo("https://evil.com", "development"), false);
    assert.equal(isAllowedReturnTo("http://admin.orviohub.localhost:3000", "development"), false);
    assert.equal(isAllowedReturnTo("javascript:alert(1)", "development"), false);
  });

  it("contains registry-derived CORS origins", () => {
    assert.ok(developmentOrigins.includes("http://account.orviohub.localhost:3000"));
    assert.ok(developmentOrigins.includes("http://home.orviohub.localhost:3000"));
    assert.ok(developmentOrigins.includes("http://inventory.orviohub.localhost:3000"));
    assert.ok(developmentOrigins.includes("http://localhost:3000"));
    assert.ok(productionOrigins.includes("https://accounts.orviohub.com"));
  });

  it("strictly validates allowed CORS origins and rejects lookalikes & admin", () => {
    // Development
    assert.equal(isAllowedOrigin("http://account.orviohub.localhost:3000", "development"), true);
    assert.equal(isAllowedOrigin("http://home.orviohub.localhost:3000", "development"), true);
    assert.equal(isAllowedOrigin("http://localhost:3000", "development"), true);
    assert.equal(isAllowedOrigin("http://127.0.0.1:4000", "development"), true);
    assert.equal(isAllowedOrigin("http://admin.orviohub.localhost:3000", "development"), false);
    assert.equal(isAllowedOrigin("http://evil-orviohub.localhost:3000", "development"), false);
    assert.equal(isAllowedOrigin("https://evil.orviohub.localhost", "development"), false);

    // Production
    assert.equal(isAllowedOrigin("https://orviohub.com", "production"), true);
    assert.equal(isAllowedOrigin("https://accounts.orviohub.com", "production"), true);
    assert.equal(isAllowedOrigin("https://home.orviohub.com", "production"), true);
    assert.equal(isAllowedOrigin("https://inventory.orviohub.com", "production"), true);
    assert.equal(isAllowedOrigin("https://admin.orviohub.com", "production"), false);
    assert.equal(isAllowedOrigin("https://evil-orviohub.com", "production"), false);
    assert.equal(isAllowedOrigin("https://orviohub.com.evil.com", "production"), false);
    assert.equal(isAllowedOrigin("http://accounts.orviohub.com", "production"), false); // plain http rejected in prod
    assert.equal(isAllowedOrigin("https://unknown.orviohub.com", "production"), false);

    // Preproduction
    assert.equal(isAllowedOrigin("https://orviohub.vercel.app", "preproduction"), true);
    assert.equal(isAllowedOrigin("https://accounts.preprod.orviohub.com", "preproduction"), true);
    assert.equal(isAllowedOrigin("https://admin.preprod.orviohub.com", "preproduction"), false);
    assert.equal(isAllowedOrigin("https://evil-preview.vercel.app", "preproduction"), false);
  });

  it("exports applications with type and path metadata", () => {
    assert.equal(applications.launcher.type, "subdomain");
    assert.equal(applications.launcher.subdomain, "app");
    assert.equal(applications.launcher.developmentUrl.includes("app.orviohub.localhost"), true);

    assert.equal(applications.pos.type, "path");
    assert.equal(applications.pos.subdomain, "inventory");
    assert.equal(applications.pos.path, "/pos");

    assert.equal(applications.booking.type, "path");
    assert.equal(applications.booking.subdomain, "home");
    assert.equal(applications.booking.path, "/apps/booking");

    assert.equal(applications.gym.type, "path");
    assert.equal(applications.gym.subdomain, "home");
    assert.equal(applications.gym.path, "/apps/gym");

    assert.equal((applications as any).task_management, undefined);
  });

  it("dynamically generates allowedHosts including all environments and subdomains", () => {
    const allHosts = getAllowedHosts();
    assert.ok(allHosts.includes("orviohub.localhost"));
    assert.ok(allHosts.includes(".orviohub.localhost"));
    assert.ok(allHosts.includes("account.orviohub.localhost"));
    assert.ok(allHosts.includes("accounts.orviohub.localhost"));
    assert.ok(allHosts.includes("app.orviohub.localhost"));
    assert.ok(allHosts.includes("home.orviohub.localhost"));
    assert.ok(allHosts.includes("inventory.orviohub.localhost"));
    assert.ok(allHosts.includes("preprod.orviohub.com"));
    assert.ok(allHosts.includes("orviohub.vercel.app"));
    assert.ok(allHosts.includes("orviohub.com"));
  });
});

