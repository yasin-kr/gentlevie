import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSubscriptionHandler,
  getSubscriptionAvailability,
  subscriptionRateKey,
  type SubscriptionEnvironment,
  type SubscriptionStore,
} from "../lib/subscriptions";
import { SUBSCRIPTION_BODY_LIMIT, type SubscriptionRecord } from "../lib/subscription-schema";

const environment: SubscriptionEnvironment = {
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  RATE_LIMIT_SECRET: "test-only-secret-with-at-least-32-characters",
  SITE_URL: "https://gentlevie.example",
  SITE_OWNER_NAME: "GentleVie Test",
  PRIVACY_CONTACT_EMAIL: "privacy@example.com",
  NODE_ENV: "production",
  VERCEL: "1",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_USER: "test-user",
  SMTP_PASS: "test-only-password",
};
const validPayload = { email: "reader@example.com", consent: true };

function request(payload: unknown = validPayload, headers: Record<string, string> = {}): Request {
  return new Request("https://gentlevie.example/api/subscriptions", {
    method: "POST",
    headers: {
      origin: "https://gentlevie.example",
      "content-type": "application/json",
      "x-vercel-forwarded-for": "203.0.113.1",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

function fixture(options: { unavailable?: boolean; missingSmtp?: boolean; rateLimited?: boolean; failing?: boolean; mailFailing?: boolean } = {}) {
  const registrations = new Map<string, SubscriptionRecord>();
  const rateKeys: string[] = [];
  const confirmations: string[] = [];
  const events: string[] = [];
  let storeCalls = 0;
  let storageErrors = 0;
  const store: SubscriptionStore = {
    async consumeRateLimit(key) {
      rateKeys.push(key);
      return { allowed: !options.rateLimited, retryAfter: 123 };
    },
    async subscribe(record) {
      if (options.failing) throw new Error("Mongo connection mongodb://secret:password@private.example failed");
      if (!registrations.has(record.email)) registrations.set(record.email, record);
      events.push("stored");
    },
  };
  const handler = createSubscriptionHandler({
    environment: options.unavailable ? {} : options.missingSmtp ? { ...environment, SMTP_PASS: undefined } : environment,
    getStore: async () => {
      storeCalls++;
      return store;
    },
    sendConfirmation: async (email) => {
      confirmations.push(email);
      events.push("confirmation");
      if (options.mailFailing) throw new Error("SMTP password=private-password recipient=reader@example.com");
    },
    now: () => new Date("2026-11-04T10:00:00Z"),
    onStorageError: () => storageErrors++,
  });
  return { handler, registrations, confirmations, events, rateKeys, storeCalls: () => storeCalls, storageErrors: () => storageErrors };
}

test("normalizes a consenting subscriber and returns no private data", async () => {
  const f = fixture();
  const response = await f.handler(request({ email: " Reader@Example.COM ", name: " Reader ", consent: true }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.email, undefined);
  assert.match(body.message, /onay bağlantısını aç/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(f.registrations.get("reader@example.com"), {
    email: "reader@example.com",
    name: "Reader",
    consentVersion: "2026-11-04",
    source: "website",
    emailVerified: false,
  });
  assert.match(f.rateKeys[0], /^[a-f0-9]{64}$/);
  assert(!f.rateKeys[0].includes("203.0.113.1"));
  assert.deepEqual(f.confirmations, ["reader@example.com"]);
  assert.deepEqual(f.events, ["stored", "confirmation"]);
});

test("duplicate registration has the same response and cannot overwrite an existing name", async () => {
  const f = fixture();
  const first = await f.handler(request({ ...validPayload, name: "First name" }));
  const duplicate = await f.handler(request({ ...validPayload, name: "Changed name" }));
  assert.deepEqual(await first.json(), await duplicate.json());
  assert.equal(f.registrations.size, 1);
  assert.equal(f.registrations.get(validPayload.email)?.name, "First name");
  assert.deepEqual(f.confirmations, [validPayload.email, validPayload.email]);
});

test("rejects invalid email, missing consent, object injection and unexpected fields before storage", async () => {
  const f = fixture();
  for (const payload of [
    { email: "invalid", consent: true },
    { email: validPayload.email, consent: false },
    { email: validPayload.email },
    { email: { $ne: null }, consent: true },
    { ...validPayload, role: "admin" },
    { ...validPayload, name: "x".repeat(81) },
  ]) {
    assert.equal((await f.handler(request(payload))).status, 400);
  }
  assert.equal(f.storeCalls(), 0);
  assert.equal(f.confirmations.length, 0);
});

test("missing database, privacy or SMTP configuration fails closed without a success response", async () => {
  const f = fixture({ unavailable: true });
  const response = await f.handler(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
  assert.equal(f.storeCalls(), 0);
  assert.equal(getSubscriptionAvailability({ ...environment, SITE_OWNER_NAME: "" }), false);
  assert.equal(getSubscriptionAvailability({ ...environment, PRIVACY_CONTACT_EMAIL: "invalid" }), false);
  assert.equal(getSubscriptionAvailability({ ...environment, RATE_LIMIT_SECRET: "short" }), false);
  assert.equal(getSubscriptionAvailability({ ...environment, SITE_URL: "http://gentlevie.example" }), false);
  assert.equal(getSubscriptionAvailability({ ...environment, SMTP_PASS: "" }), false);
  assert.equal(getSubscriptionAvailability({ ...environment, SMTP_PORT: "25" }), false);
  assert.equal(getSubscriptionAvailability(environment), true);
  const noMail = fixture({ missingSmtp: true });
  const noMailResponse = await noMail.handler(request());
  assert.equal(noMailResponse.status, 503);
  assert.equal((await noMailResponse.json()).ok, false);
  assert.equal(noMail.storeCalls(), 0);
  assert.equal(noMail.confirmations.length, 0);
});

test("requires the configured origin and rejects cross-site requests", async () => {
  const f = fixture();
  const rejectedHeaders: Record<string, string>[] = [
    { origin: "https://attacker.example" },
    { origin: "null" },
    { origin: "" },
    { origin: "https://gentlevie.example/path" },
    { "sec-fetch-site": "cross-site" },
  ];
  for (const headers of rejectedHeaders) {
    assert.equal((await f.handler(request(validPayload, headers))).status, 403);
  }
  const spoofedUrl = new Request("https://attacker.example/api/subscriptions", {
    method: "POST",
    headers: { origin: "https://attacker.example", "content-type": "application/json" },
    body: JSON.stringify(validPayload),
  });
  assert.equal((await f.handler(spoofedUrl)).status, 403);
  assert.equal(f.storeCalls(), 0);
});

test("accepts JSON only and reports malformed JSON without storage access", async () => {
  const f = fixture();
  assert.equal((await f.handler(request(validPayload, { "content-type": "text/plain" }))).status, 415);
  const malformed = new Request("https://gentlevie.example/api/subscriptions", {
    method: "POST",
    headers: { origin: "https://gentlevie.example", "content-type": "application/json" },
    body: "{not json",
  });
  assert.equal((await f.handler(malformed)).status, 400);
  assert.equal(f.storeCalls(), 0);
});

test("limits both advertised and streamed body size before parsing", async () => {
  const f = fixture();
  assert.equal((await f.handler(request(validPayload, { "content-length": "4097" }))).status, 413);
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(SUBSCRIPTION_BODY_LIMIT));
      controller.enqueue(new Uint8Array(1));
    },
    cancel() { cancelled = true; },
  });
  const streamed = new Request("https://gentlevie.example/api/subscriptions", {
    method: "POST",
    headers: { origin: "https://gentlevie.example", "content-type": "application/json" },
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  assert.equal((await f.handler(streamed)).status, 413);
  assert.equal(cancelled, true);
  assert.equal(f.storeCalls(), 0);
});

test("rate limiting supplies Retry-After and never creates a subscriber", async () => {
  const f = fixture({ rateLimited: true });
  const response = await f.handler(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "123");
  assert.equal(f.registrations.size, 0);
  assert.equal(f.confirmations.length, 0);
});

test("storage failures fail closed and never expose exception details", async () => {
  const f = fixture({ failing: true });
  const response = await f.handler(request());
  const text = await response.text();
  assert.equal(response.status, 503);
  assert(!text.includes("password"));
  assert(!text.includes("mongodb"));
  assert.equal(f.storageErrors(), 1);
  assert.equal(f.confirmations.length, 0);
});

test("confirmation delivery failure returns a redacted error and leaves registration unverified", async () => {
  const f = fixture({ mailFailing: true });
  const response = await f.handler(request());
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.ok, false);
  assert(!JSON.stringify(body).includes("private-password"));
  assert(!JSON.stringify(body).includes(validPayload.email));
  assert.equal(f.storageErrors(), 1);
  assert.equal(f.registrations.get(validPayload.email)?.emailVerified, false);
  assert.deepEqual(f.events, ["stored", "confirmation"]);
});

test("honeypot submissions create no records", async () => {
  const f = fixture();
  assert.equal((await f.handler(request({ ...validPayload, website: "spam.example" }))).status, 200);
  assert.equal(f.storeCalls(), 0);
  assert.equal(f.registrations.size, 0);
  assert.equal(f.confirmations.length, 0);
});

test("only the trusted Vercel header affects the hashed rate key", () => {
  const one = request(validPayload, { "x-vercel-forwarded-for": "203.0.113.1" });
  const two = request(validPayload, { "x-vercel-forwarded-for": "203.0.113.2" });
  assert.notEqual(subscriptionRateKey(one, environment), subscriptionRateKey(two, environment));
  const selfHosted = { ...environment, VERCEL: undefined };
  assert.equal(subscriptionRateKey(one, selfHosted), subscriptionRateKey(two, selfHosted));
  const arbitraryHeader = request(validPayload, { "x-forwarded-for": "192.0.2.200" });
  assert.equal(subscriptionRateKey(one, environment), subscriptionRateKey(arbitraryHeader, environment));
  const invalidChain = request(validPayload, { "x-vercel-forwarded-for": "203.0.113.1, 203.0.113.2" });
  const absent = request(validPayload, { "x-vercel-forwarded-for": "" });
  assert.equal(subscriptionRateKey(invalidChain, environment), subscriptionRateKey(absent, environment));
});
