import { z } from "zod";

export const SUBSCRIPTION_CONSENT_VERSION = "2026-11-04";
export const SUBSCRIPTION_BODY_LIMIT = 4 * 1024;
export const SUBSCRIPTION_RATE_LIMIT = 5;
export const SUBSCRIPTION_RATE_WINDOW_MS = 10 * 60 * 1000;

export const subscriptionSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254).email(),
    name: z.string().trim().max(80).optional(),
    consent: z.literal(true),
    website: z.string().max(200).optional(),
  })
  .strict();

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

export type SubscriptionRecord = {
  email: string;
  name?: string;
  consentVersion: string;
  source: "website";
  emailVerified: false;
};
