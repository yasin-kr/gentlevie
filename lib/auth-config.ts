import { z } from "zod";

export const PRIVACY_CONSENT_VERSION = "2026-11-04";
export const privacyConsentSchema = z.literal(true);
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export type AuthEnvironment = {
  NODE_ENV?: string;
  VERCEL?: string;
  SITE_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  MONGODB_URI?: string;
  BETTER_AUTH_SECRET?: string;
  ADMIN_EMAIL?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
};

const emailSchema = z.email();

export function getAuthBaseUrl(environment: AuthEnvironment = process.env): string | null {
  const value = environment.SITE_URL || environment.NEXT_PUBLIC_SITE_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol === "http:" && (environment.NODE_ENV === "production" || !local)) return null;
    if (environment.NODE_ENV === "production" && local) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getSmtpConfiguration(environment: AuthEnvironment = process.env) {
  const host = environment.SMTP_HOST?.trim();
  const port = environment.SMTP_PORT || "587";
  const user = environment.SMTP_USER?.trim();
  const pass = environment.SMTP_PASS;
  const from = environment.SMTP_FROM?.trim() || "gentle vie <gentlevie@gmail.com>";
  // Only a hostname and one sender address are accepted; no URLs or header injection.
  const sender = from.match(/^[^<>\r\n]*<([^<>\r\n]+)>$/)?.[1] ?? from;
  if (!host || !/^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(host)) return null;
  if (port !== "465" && port !== "587") return null;
  if (!user || /[\r\n]/.test(user) || !pass?.trim()) return null;
  if (/[\r\n]/.test(from) || !emailSchema.safeParse(sender).success) return null;
  return { host, port: Number(port), user, pass, from, secure: port === "465" };
}

export function getEmailAvailability(environment: AuthEnvironment = process.env): boolean {
  return getSmtpConfiguration(environment) !== null;
}

export function getAuthAvailability(environment: AuthEnvironment = process.env): boolean {
  return Boolean(
    /^mongodb(?:\+srv)?:\/\//.test(environment.MONGODB_URI || "")
      && (environment.BETTER_AUTH_SECRET?.trim().length ?? 0) >= 32
      && getAuthBaseUrl(environment)
      && getEmailAvailability(environment),
  );
}

export function getTrustedIpHeaders(environment: AuthEnvironment = process.env): string[] {
  return environment.VERCEL === "1" ? ["x-vercel-forwarded-for"] : [];
}

export type AuthorizableSession = {
  user: { email: string; emailVerified: boolean };
} | null | undefined;

export function isAdminSession(
  session: AuthorizableSession,
  environment: AuthEnvironment = process.env,
): boolean {
  const adminEmail = (environment.ADMIN_EMAIL ?? "gentlevie@gmail.com").trim().toLowerCase();
  return Boolean(
    session?.user.emailVerified === true
      && emailSchema.safeParse(adminEmail).success
      && session.user.email.trim().toLowerCase() === adminEmail,
  );
}

export function validateAuthEmailUrl(value: string, baseUrl: string): string {
  const url = new URL(value);
  if (url.origin !== baseUrl || !url.pathname.startsWith("/api/auth/")) {
    throw new Error("Invalid authentication email URL");
  }
  return url.href;
}
