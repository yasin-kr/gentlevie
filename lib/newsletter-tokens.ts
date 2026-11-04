import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function hashConfirmationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createUnsubscribeToken(subscriberId: string, secret: string): string {
  if (!/^[a-f0-9]{24}$/.test(subscriberId) || secret.length < 32) throw new Error("Invalid newsletter token configuration");
  const signature = createHmac("sha256", secret).update(`gentlevie:unsubscribe:${subscriberId}`).digest("base64url");
  return `${subscriberId}.${signature}`;
}

export function readUnsubscribeToken(token: string, secret: string): string | null {
  if (secret.length < 32 || !/^[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const id = token.split(".")[0]!;
  const expected = Buffer.from(createUnsubscribeToken(id, secret));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received) ? id : null;
}
