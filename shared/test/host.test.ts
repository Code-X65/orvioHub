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
  developmentOrigins,
  productionOrigins,
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
});

