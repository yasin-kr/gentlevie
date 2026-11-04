import assert from "node:assert/strict";
import test from "node:test";
import {
  getAuthAvailability,
  getAuthBaseUrl,
  getEmailAvailability,
  getSmtpConfiguration,
  getTrustedIpHeaders,
  isAdminSession,
  privacyConsentSchema,
  validateAuthEmailUrl,
  type AuthEnvironment,
} from "../lib/auth-config";

const configured: AuthEnvironment = {
  NODE_ENV: "production",
  SITE_URL: "https://gentlevie.example",
  MONGODB_URI: "mongodb://test-only.invalid/gentlevie",
  BETTER_AUTH_SECRET: "test-only-secret-32-characters-long",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_USER: "test-user",
  SMTP_PASS: "test-only-password",
};

test("membership requires database, explicit origin, a strong secret and SMTP", () => {
  assert.equal(getAuthAvailability(configured), true);
  for (const key of ["SITE_URL", "MONGODB_URI", "BETTER_AUTH_SECRET", "SMTP_HOST", "SMTP_USER", "SMTP_PASS"] as const) {
    assert.equal(getAuthAvailability({ ...configured, [key]: "" }), false, key);
  }
  assert.equal(getAuthAvailability({ ...configured, BETTER_AUTH_SECRET: "short" }), false);
  assert.equal(getAuthAvailability({ ...configured, MONGODB_URI: "https://database.example.com" }), false);
  assert.equal(getAuthAvailability({ ...configured, MONGODB_URI: "not-a-database-url" }), false);
  assert.equal(getAuthAvailability({}), false);
});

test("production origins require HTTPS and never accept paths or credentials", () => {
  for (const SITE_URL of ["http://gentlevie.example", "https://gentlevie.example/path", "https://user:password@gentlevie.example", "https://gentlevie.example/?secret=value", "not-a-url", "http://localhost:3000", "https://localhost:3000"]) {
    assert.equal(getAuthBaseUrl({ ...configured, SITE_URL }), null, SITE_URL);
  }
  assert.equal(getAuthBaseUrl({ NODE_ENV: "development", SITE_URL: "http://localhost:3000" }), "http://localhost:3000");
  assert.equal(getAuthBaseUrl({ NODE_ENV: "development", SITE_URL: "http://untrusted.example" }), null);
});

test("SMTP accepts only implicit TLS or required STARTTLS ports", () => {
  assert.equal(getSmtpConfiguration(configured)?.secure, false);
  assert.equal(getSmtpConfiguration({ ...configured, SMTP_PORT: "465" })?.secure, true);
  assert.equal(getSmtpConfiguration(configured)?.from, "gentle vie <gentlevie@gmail.com>");
  for (const SMTP_PORT of ["25", "2525", "0", "bad"]) {
    assert.equal(getEmailAvailability({ ...configured, SMTP_PORT }), false);
  }
  for (const SMTP_HOST of ["https://smtp.example.com", "smtp.example.com\r\nInjected: true"]) {
    assert.equal(getEmailAvailability({ ...configured, SMTP_HOST }), false);
  }
  assert.equal(getEmailAvailability({ ...configured, SMTP_FROM: "invalid" }), false);
  assert.equal(getEmailAvailability({ ...configured, SMTP_FROM: "a@example.com\r\nBcc: b@example.com" }), false);
});

test("admin access needs the configured verified email; role claims have no effect", () => {
  assert.equal(isAdminSession(null), false);
  assert.equal(isAdminSession({ user: { email: "gentlevie@gmail.com", emailVerified: false } }), false);
  assert.equal(isAdminSession({ user: { email: "GentleVie@gmail.com", emailVerified: true } }), true);
  const forged = { user: { email: "attacker@example.com", emailVerified: true, role: "admin" } };
  assert.equal(isAdminSession(forged), false);
  assert.equal(isAdminSession({ user: { email: "owner@example.com", emailVerified: true } }, { ADMIN_EMAIL: "owner@example.com" }), true);
  assert.equal(isAdminSession({ user: { email: "gentlevie@gmail.com", emailVerified: true } }, { ADMIN_EMAIL: "" }), false);
});

test("only explicit true grants privacy acceptance", () => {
  assert.equal(privacyConsentSchema.safeParse(true).success, true);
  for (const value of [false, undefined, null, "true", 1, {}]) {
    assert.equal(privacyConsentSchema.safeParse(value).success, false);
  }
});

test("IP headers are trusted only when Vercel replaces the header", () => {
  assert.deepEqual(getTrustedIpHeaders({}), []);
  assert.deepEqual(getTrustedIpHeaders({ VERCEL: "true" }), []);
  assert.deepEqual(getTrustedIpHeaders({ VERCEL: "1" }), ["x-vercel-forwarded-for"]);
});

test("authentication emails only link to this site's auth endpoint", () => {
  const origin = "https://gentlevie.example";
  const url = `${origin}/api/auth/verify-email?token=test-only-token`;
  assert.equal(validateAuthEmailUrl(url, origin), url);
  assert.throws(() => validateAuthEmailUrl("https://attacker.example/api/auth/verify-email", origin));
  assert.throws(() => validateAuthEmailUrl(`${origin}/outside`, origin));
});
