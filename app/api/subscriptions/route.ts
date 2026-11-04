import { getMongoSubscriptionStore } from "@/lib/mongodb";
import { createSubscriptionHandler } from "@/lib/subscriptions";
import { sendNewsletterConfirmation } from "@/lib/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = createSubscriptionHandler({
  getStore: getMongoSubscriptionStore,
  sendConfirmation: sendNewsletterConfirmation,
  onStorageError: () => console.error("[subscriptions] Registration temporarily unavailable"),
});
