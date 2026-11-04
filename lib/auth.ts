import "server-only";
import { createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { APIError } from "better-auth/api";
import { MongoServerError, type Db } from "mongodb";
import { after } from "next/server";
import {
  getAuthAvailability,
  getAuthBaseUrl,
  getTrustedIpHeaders,
  isAdminSession,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PRIVACY_CONSENT_VERSION,
  privacyConsentSchema,
  validateAuthEmailUrl,
  type AuthorizableSession,
} from "./auth-config";
import { sendEmail } from "./email";
import { getMongoDatabase } from "./mongodb";

export { getAuthAvailability } from "./auth-config";

type AuthRateBucket = { _id: string; count: number; expiresAt: Date };

async function createAuthIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("user").createIndex({ email: 1 }, { unique: true, name: "unique_auth_user_email" }),
    db.collection("session").createIndex({ token: 1 }, { unique: true, name: "unique_auth_session_token" }),
    db.collection("session").createIndex({ userId: 1 }, { name: "auth_session_user" }),
    db.collection("session").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expire_auth_sessions" }),
    db.collection("account").createIndex({ providerId: 1, accountId: 1 }, { unique: true, name: "unique_auth_account" }),
    db.collection("account").createIndex({ userId: 1 }, { name: "auth_account_user" }),
    db.collection("verification").createIndex({ identifier: 1 }, { name: "auth_verification_identifier" }),
    db.collection("verification").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expire_auth_verifications" }),
    db.collection("auth_rate_limits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expire_auth_rate_limits" }),
  ]);
}

async function initializeAuth() {
  const baseURL = getAuthBaseUrl();
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!getAuthAvailability() || !baseURL || !secret) {
    throw new Error("Authentication is not configured");
  }
  const db = await getMongoDatabase();
  await createAuthIndexes(db);
  const rateLimits = db.collection<AuthRateBucket>("auth_rate_limits");

  return betterAuth({
    appName: "gentle vie",
    baseURL,
    basePath: "/api/auth",
    secret,
    trustedOrigins: [baseURL],
    database: mongodbAdapter(db, { client: db.client, transaction: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      requireEmailVerification: true,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url }) {
        const link = validateAuthEmailUrl(url, baseURL);
        await sendEmail({
          to: user.email,
          subject: "gentle vie · Şifreni yenile",
          text: `Şifreni yenilemek için aşağıdaki bağlantıyı aç. Bağlantı 30 dakika geçerlidir.\n\n${link}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.\n\ngentle vie`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      async sendVerificationEmail({ user, url }) {
        const link = validateAuthEmailUrl(url, baseURL);
        await sendEmail({
          to: user.email,
          subject: "gentle vie · E-posta adresini doğrula",
          text: `gentle vie üyeliğini tamamlamak için e-posta adresini doğrula. Bağlantı 1 saat geçerlidir.\n\n${link}\n\nBu kaydı sen oluşturmadıysan bu e-postayı yok sayabilirsin. Üyelik bültene otomatik olarak kaydolmaz.\n\ngentle vie`,
        });
      },
    },
    user: {
      additionalFields: {
        privacyAccepted: {
          type: "boolean",
          required: true,
          input: true,
          validator: { input: privacyConsentSchema },
        },
        privacyConsentVersion: {
          type: "string",
          required: true,
          input: false,
          defaultValue: PRIVACY_CONSENT_VERSION,
        },
        privacyConsentedAt: {
          type: "date",
          required: true,
          input: false,
          defaultValue: () => new Date(),
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          async before(user) {
            if (user.privacyAccepted !== true) {
              throw new APIError("BAD_REQUEST", {
                code: "PRIVACY_CONSENT_REQUIRED",
                message: "Üyelik için gizlilik metnini kabul etmelisin",
              });
            }
            const name = user.name.trim();
            if (name.length < 2 || name.length > 80) {
              throw new APIError("BAD_REQUEST", { code: "INVALID_NAME", message: "Adın 2–80 karakter olmalı" });
            }
            return { data: { ...user, name, privacyConsentVersion: PRIVACY_CONSENT_VERSION, privacyConsentedAt: new Date() } };
          },
        },
        update: {
          async before(user) {
            if (user.name === undefined) return;
            if (typeof user.name !== "string" || user.name.trim().length < 2 || user.name.trim().length > 80) {
              throw new APIError("BAD_REQUEST", { code: "INVALID_NAME", message: "Adın 2–80 karakter olmalı" });
            }
            return { data: { ...user, name: user.name.trim() } };
          },
        },
      },
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 600, max: 3 },
        "/request-password-reset": { window: 600, max: 3 },
        "/send-verification-email": { window: 600, max: 3 },
        "/reset-password": { window: 600, max: 5 },
      },
      customStorage: {
        async consume(key, rule) {
          const now = Date.now();
          const windowMs = rule.window * 1000;
          const bucket = Math.floor(now / windowMs);
          const resetAt = (bucket + 1) * windowMs;
          const hash = createHmac("sha256", secret).update(`auth-rate:${key}`).digest("hex");
          const id = `${hash}:${rule.window}:${bucket}`;
          const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(resetAt + windowMs) } };
          let result: AuthRateBucket | null;
          try {
            result = await rateLimits.findOneAndUpdate(
              { _id: id }, update,
              { upsert: true, returnDocument: "after", includeResultMetadata: false },
            );
          } catch (error) {
            if (!(error instanceof MongoServerError) || error.code !== 11000) throw new Error("Authentication rate limiter unavailable");
            result = await rateLimits.findOneAndUpdate(
              { _id: id }, update,
              { returnDocument: "after", includeResultMetadata: false },
            );
          }
          if (!result) throw new Error("Authentication rate limiter unavailable");
          const allowed = result.count <= rule.max;
          return { allowed, retryAfter: allowed ? null : Math.max(1, Math.ceil((resetAt - now) / 1000)) };
        },
      },
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production" || baseURL.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      ipAddress: { ipAddressHeaders: getTrustedIpHeaders(), ipv6Subnet: 64 },
      // Next keeps deferred delivery alive on Vercel without leaking account
      // existence through SMTP response time during signup/password reset.
      backgroundTasks: {
        handler: (promise) => after(async () => {
          try {
            await promise;
          } catch {
            console.error("[auth] Background operation unavailable");
          }
        }),
      },
    },
    logger: {
      level: "warn",
      log(level) {
        if (level === "error" || level === "warn") console.error("[auth] Authentication service event");
      },
    },
  });
}

export type Auth = Awaited<ReturnType<typeof initializeAuth>>;
export type AuthSession = Auth["$Infer"]["Session"];
let authPromise: Promise<Auth> | undefined;

export async function getAuth(): Promise<Auth> {
  if (!getAuthAvailability()) throw new Error("Authentication is not configured");
  authPromise ??= initializeAuth().catch(() => {
    authPromise = undefined;
    throw new Error("Authentication service unavailable");
  });
  return authPromise;
}

export async function getSession(requestHeaders: Headers): Promise<AuthSession | null> {
  if (!getAuthAvailability()) return null;
  try {
    const auth = await getAuth();
    return await auth.api.getSession({ headers: requestHeaders, query: { disableCookieCache: true } });
  } catch {
    console.error("[auth] Session lookup unavailable");
    return null;
  }
}

export function isAdmin(session: AuthorizableSession): boolean {
  return isAdminSession(session);
}
