import { test } from "node:test";
import assert from "node:assert/strict";
import { createUnsubscribeToken, hashConfirmationToken, readUnsubscribeToken } from "../lib/newsletter-tokens";

const secret = "test-newsletter-secret-at-least-32-characters";
const id = "0123456789abcdef01234567";

test("unsubscribe tokens authorize only the original subscriber", () => {
  const token = createUnsubscribeToken(id, secret);
  assert.equal(readUnsubscribeToken(token, secret), id);
  assert.equal(readUnsubscribeToken(token.replace(id, "abcdef0123456789abcdef01"), secret), null);
  assert.equal(readUnsubscribeToken(token, `${secret}wrong`), null);
  assert.equal(readUnsubscribeToken(`${token}x`, secret), null);
  assert.equal(readUnsubscribeToken("", secret), null);
});

test("short secrets cannot create usable tokens and confirmation tokens are hashed", () => {
  assert.throws(() => createUnsubscribeToken(id, "short"));
  assert.equal(readUnsubscribeToken("bad", "short"), null);
  assert.equal(hashConfirmationToken("test-token").length, 64);
  assert.notEqual(hashConfirmationToken("test-token"), hashConfirmationToken("another-token"));
});
