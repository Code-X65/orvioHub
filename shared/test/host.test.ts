import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveHost,
  UnknownHostError,
  getApplicationUrl,
  getLoginUrl,
  getPostLoginUrl,
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
      { host: "accounts.orviohub.localhost:4000", expected: "accounts" },
      { host: "home.orviohub.localhost:4000", expected: "home" },
      { host: "app.orviohub.localhost:4000", expected: "launcher" },
      { host: "inventory.orviohub.localhost:4000", expected: "inventory" },
      { host: "taskmanagement.orviohub.localhost:4000", expected: "taskmanagement" },
    ] as const;

    for (const { host, expected } of cases) {
      const res = resolveHost(host);
      assert.equal(res.application, expected);
      assert.equal(res.environment, "development");
    }
  });

  it("resolves production root and subdomains", () => {
    assert.equal(resolveHost("orviohub.com").application, "marketing");
    assert.equal(resolveHost("accounts.orviohub.com").application, "accounts");
    assert.equal(resolveHost("home.orviohub.com").application, "home");
    assert.equal(resolveHost("app.orviohub.com").application, "launcher");
    assert.equal(resolveHost("inventory.orviohub.com").application, "inventory");
    assert.equal(resolveHost("taskmanagement.orviohub.com").application, "taskmanagement");

    assert.equal(resolveHost("orviohub.com").environment, "production");
    assert.equal(resolveHost("accounts.orviohub.com").environment, "production");
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
    assert.throws(() => resolveHost("localhost:4000"), UnknownHostError);
    assert.throws(() => resolveHost("example.com"), UnknownHostError);
  });
});

describe("URL Helpers", () => {
  it("generates correct application URLs", () => {
    assert.equal(getApplicationUrl("accounts", "development"), "http://accounts.orviohub.localhost:4000");
    assert.equal(getApplicationUrl("accounts", "production"), "https://accounts.orviohub.com");
  });

  it("generates login and post-login URLs", () => {
    const loginUrl = getLoginUrl("http://inventory.orviohub.localhost:4000/items", "development");
    assert.equal(
      loginUrl,
      "http://accounts.orviohub.localhost:4000/login?returnTo=http%3A%2F%2Finventory.orviohub.localhost%3A4000%2Fitems"
    );

    assert.equal(getPostLoginUrl(true, "development"), "http://app.orviohub.localhost:4000");
    assert.equal(getPostLoginUrl(false, "development"), "http://home.orviohub.localhost:4000");
  });

  it("validates returnTo URLs safely", () => {
    assert.equal(isAllowedReturnTo("/dashboard", "development"), true);
    assert.equal(isAllowedReturnTo("http://inventory.orviohub.localhost:4000/dashboard", "development"), true);
    assert.equal(isAllowedReturnTo("https://evil.com", "development"), false);
    assert.equal(isAllowedReturnTo("http://unknown.orviohub.localhost:4000", "development"), false);
  });

  it("contains registry-derived CORS origins", () => {
    assert.ok(developmentOrigins.includes("http://accounts.orviohub.localhost:4000"));
    assert.ok(developmentOrigins.includes("http://inventory.orviohub.localhost:4000"));
    assert.ok(productionOrigins.includes("https://accounts.orviohub.com"));
  });
});
