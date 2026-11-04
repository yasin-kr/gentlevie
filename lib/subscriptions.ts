import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { getEmailAvailability } from "./auth-config";
import {
  SUBSCRIPTION_BODY_LIMIT,
  SUBSCRIPTION_CONSENT_VERSION,
  subscriptionSchema,
  type SubscriptionRecord,
} from "./subscription-schema";

export type SubscriptionEnvironment = {
  MONGODB_URI?: string;
  MONGODB_DB?: string;
  RATE_LIMIT_SECRET?: string;
  SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  SITE_OWNER_NAME?: string;
  PRIVACY_CONTACT_EMAIL?: string;
  NODE_ENV?: string;
  VERCEL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
};

export interface SubscriptionStore {
  consumeRateLimit(
    key: string,
    now: Date,
  ): Promise<{ allowed: boolean; retryAfter: number }>;
  subscribe(record: SubscriptionRecord, now: Date): Promise<void>;
}

type SubscriptionDependencies = {
  environment?: SubscriptionEnvironment;
  getStore: () => Promise<SubscriptionStore>;
  sendConfirmation: (email: string) => Promise<void>;
  now?: () => Date;
  onStorageError?: () => void;
};

const successMessage = "İsteğini aldık. Aboneliğin henüz aktif değilse e-posta adresine gelen onay bağlantısını aç. Zaten onayladıysan başka bir işlem yapmana gerek yok.";
const unavailableMessage = "Kayıtlar şu anda açık değil. Lütfen daha sonra tekrar dene.";

function configuredOrigin(environment: SubscriptionEnvironment): string | null {
  const explicitUrl = environment.SITE_URL || environment.NEXT_PUBLIC_SITE_URL;
  const vercelHost =
    environment.VERCEL_PROJECT_PRODUCTION_URL || environment.VERCEL_URL;
  const candidate = explicitUrl || (vercelHost ? `https://${vercelHost}` : null);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (environment.NODE_ENV === "production" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getSubscriptionAvailability(
  environment: SubscriptionEnvironment = process.env,
): boolean {
  const credentialsReady =
    /^mongodb(?:\+srv)?:\/\//.test(environment.MONGODB_URI || "") &&
    (environment.RATE_LIMIT_SECRET?.trim().length || 0) >= 32;
  const ownerReady = Boolean(environment.SITE_OWNER_NAME?.trim()) &&
    z.email().safeParse(environment.PRIVACY_CONTACT_EMAIL?.trim()).success;
  const hasExplicitOrigin = Boolean(environment.SITE_URL || environment.NEXT_PUBLIC_SITE_URL);
  const originReady = configuredOrigin(environment) !== null ||
    (!hasExplicitOrigin && environment.NODE_ENV !== "production");
  return credentialsReady && ownerReady && originReady && getEmailAvailability(environment);
}

function isAllowedOrigin(request: Request, environment: SubscriptionEnvironment): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const supplied = request.headers.get("origin");
  if (!supplied || supplied === "null") return false;

  try {
    const origin = new URL(supplied);
    if (origin.origin !== supplied) return false;
    const expected = configuredOrigin(environment);
    if (expected) return origin.origin === expected;
    if (environment.NODE_ENV === "production") return false;
    const requestUrl = new URL(request.url);
    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname);
    return isLocal && origin.origin === requestUrl.origin;
  } catch {
    return false;
  }
}

export function subscriptionRateKey(
  request: Request,
  environment: SubscriptionEnvironment,
): string {
  let identity = "shared-untrusted-client";
  if (environment.VERCEL === "1") {
    // Vercel replaces this header at its trusted edge. Never trust arbitrary
    // forwarding headers on a self-hosted or development server.
    const forwarded = request.headers.get("x-vercel-forwarded-for")?.trim();
    if (forwarded && isIP(forwarded)) identity = forwarded;
  } else if (environment.NODE_ENV !== "production") {
    const host = new URL(request.url).hostname;
    if (["localhost", "127.0.0.1", "[::1]"].includes(host)) identity = "local-development";
  }
  return createHmac("sha256", environment.RATE_LIMIT_SECRET || "")
    .update(identity)
    .digest("hex");
}

function jsonResponse(status: number, message: string, extraHeaders?: Record<string, string>): Response {
  return Response.json(
    { ok: status >= 200 && status < 300, message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...extraHeaders,
      },
    },
  );
}

class PayloadError extends Error {
  constructor(readonly status: number) {
    super("Invalid subscription payload");
  }
}

async function readLimitedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > SUBSCRIPTION_BODY_LIMIT)) {
    throw new PayloadError(Number(contentLength) > SUBSCRIPTION_BODY_LIMIT ? 413 : 400);
  }
  if (!request.body) throw new PayloadError(400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > SUBSCRIPTION_BODY_LIMIT) {
        await reader.cancel().catch(() => undefined);
        throw new PayloadError(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new PayloadError(400);
  }
}

export function createSubscriptionHandler(dependencies: SubscriptionDependencies) {
  return async function handleSubscription(request: Request): Promise<Response> {
    const environment = dependencies.environment || process.env;
    if (!getSubscriptionAvailability(environment)) return jsonResponse(503, unavailableMessage);
    if (!isAllowedOrigin(request, environment)) {
      return jsonResponse(403, "Bu kayıt isteğine izin verilmiyor.");
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return jsonResponse(415, "Kayıt bilgileri uygun biçimde gönderilmedi.");
    }

    let input: unknown;
    try {
      input = await readLimitedJson(request);
    } catch (error) {
      const status = error instanceof PayloadError ? error.status : 400;
      return jsonResponse(status, status === 413 ? "Gönderilen bilgi çok uzun." : "Kayıt bilgileri okunamadı.");
    }
    const parsed = subscriptionSchema.safeParse(input);
    if (!parsed.success) {
      return jsonResponse(400, "Geçerli bir e-posta adresi gir ve izin kutusunu işaretle.");
    }
    // A filled hidden field is treated like a completed request without creating
    // a subscriber, so simple form bots cannot use it as a detection oracle.
    if (parsed.data.website) return jsonResponse(200, successMessage);

    try {
      const store = await dependencies.getStore();
      const now = dependencies.now?.() || new Date();
      const limit = await store.consumeRateLimit(subscriptionRateKey(request, environment), now);
      if (!limit.allowed) {
        return jsonResponse(429, "Çok sık deneme yaptın. Biraz sonra tekrar deneyebilirsin.", {
          "Retry-After": String(Math.max(1, Math.ceil(limit.retryAfter))),
        });
      }
      await store.subscribe(
        {
          email: parsed.data.email,
          ...(parsed.data.name ? { name: parsed.data.name } : {}),
          consentVersion: SUBSCRIPTION_CONSENT_VERSION,
          source: "website",
          emailVerified: false,
        },
        now,
      );
      // The sender handles per-address cooldowns and already-confirmed readers.
      // Delivery errors must never be reported as a completed registration.
      await dependencies.sendConfirmation(parsed.data.email);
      return jsonResponse(200, successMessage);
    } catch {
      // Intentionally do not pass exceptions, addresses, payloads or MongoDB
      // connection details to logs or to the client.
      dependencies.onStorageError?.();
      return jsonResponse(503, unavailableMessage);
    }
  };
}
