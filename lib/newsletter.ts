import "server-only";
import { randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import type { Article } from "@/lib/articles";
import { getMongoDatabase } from "@/lib/mongodb";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site";
import { SUBSCRIPTION_CONSENT_VERSION } from "@/lib/subscription-schema";
import { createUnsubscribeToken, hashConfirmationToken, readUnsubscribeToken } from "@/lib/newsletter-tokens";

type Subscriber = {
  _id: ObjectId;
  email: string;
  emailVerified: boolean;
  unsubscribedAt?: Date;
  confirmationTokenHash?: string;
  confirmationExpiresAt?: Date;
  confirmationQueuedAt?: Date;
  confirmationSentAt?: Date;
  verifiedAt?: Date;
  consentedAt?: Date;
  consentVersion?: string;
};

type Delivery = {
  _id: string;
  subscriberId: ObjectId;
  email: string;
  postSlug: string;
  title: string;
  subtitle: string;
  status: "pending" | "sent" | "cancelled" | "failed";
  attempts: number;
  createdAt: Date;
  leaseUntil?: Date;
  leaseId?: string;
  sentAt?: Date;
};

export async function sendNewsletterConfirmation(email: string): Promise<void> {
  const db = await getMongoDatabase();
  const subscribers = db.collection<Subscriber>("subscribers");
  const subscriber = await subscribers.findOne({ email });
  if (!subscriber || (subscriber.emailVerified && !subscriber.unsubscribedAt)) return;
  const now = new Date();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashConfirmationToken(token);
  const claimed = await subscribers.findOneAndUpdate({
    _id: subscriber._id,
    $or: [{ confirmationQueuedAt: { $exists: false } }, { confirmationQueuedAt: { $lt: new Date(now.getTime() - 10 * 60_000) } }],
  }, { $set: { confirmationTokenHash: tokenHash, confirmationExpiresAt: new Date(now.getTime() + 24 * 60 * 60_000), confirmationQueuedAt: now } }, { returnDocument: "after" });
  if (!claimed) return;
  try {
    await sendEmail({
      to: email,
      subject: "GentleVie bülten aboneliğini onayla",
      text: `GentleVie'ye hoş geldin. Yeni yazılardan haberdar olmak için aboneliğini aşağıdaki bağlantıdan onaylayabilirsin. Bağlantı 24 saat geçerlidir.\n\n${siteUrl}/bulten/onay?token=${token}\n\nBu isteği sen yapmadıysan e-postayı yok sayabilirsin. Onay vermeden bülten gönderilmez.`,
    });
  } catch {
    await subscribers.updateOne({ _id: subscriber._id, confirmationTokenHash: tokenHash }, { $unset: { confirmationQueuedAt: "", confirmationTokenHash: "", confirmationExpiresAt: "" } });
    throw new Error("Confirmation email unavailable");
  }
  // Delivery already succeeded; a bookkeeping outage must not invalidate the
  // link the reader just received.
  await subscribers.updateOne({ _id: subscriber._id, confirmationTokenHash: tokenHash }, { $set: { confirmationSentAt: new Date() } }).catch(() => {
    console.error("[newsletter] Confirmation timestamp unavailable");
  });
}

export async function confirmNewsletter(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const db = await getMongoDatabase();
  const now = new Date();
  const result = await db.collection<Subscriber>("subscribers").updateOne({
    confirmationTokenHash: hashConfirmationToken(token), confirmationExpiresAt: { $gt: now },
  }, {
    $set: { emailVerified: true, verifiedAt: now, consentedAt: now, consentVersion: SUBSCRIPTION_CONSENT_VERSION },
    $unset: { unsubscribedAt: "", confirmationTokenHash: "", confirmationExpiresAt: "", confirmationQueuedAt: "" },
  });
  return result.modifiedCount === 1;
}

export async function unsubscribeNewsletter(token: string): Promise<boolean> {
  const id = readUnsubscribeToken(token, process.env.RATE_LIMIT_SECRET || "");
  if (!id) return false;
  const db = await getMongoDatabase();
  await db.collection<Subscriber>("subscribers").updateOne({ _id: new ObjectId(id) }, { $set: { unsubscribedAt: new Date() } });
  return true;
}

export async function queuePostAnnouncement(post: Article): Promise<void> {
  const db = await getMongoDatabase();
  const deliveries = db.collection<Delivery>("newsletter_deliveries");
  await deliveries.createIndex({ status: 1, createdAt: 1 });
  // MongoDB creates the recipient snapshot without loading personal data into the UI.
  await db.collection<Subscriber>("subscribers").aggregate([
    { $match: { emailVerified: true, unsubscribedAt: { $exists: false } } },
    { $project: {
      _id: { $concat: [{ $literal: `${post.slug}:` }, { $toString: "$_id" }] },
      subscriberId: "$_id", email: 1,
      postSlug: { $literal: post.slug }, title: { $literal: post.title }, subtitle: { $literal: post.subtitle },
      status: { $literal: "pending" }, attempts: { $literal: 0 }, createdAt: { $literal: new Date() },
    } },
    { $merge: { into: "newsletter_deliveries", on: "_id", whenMatched: "keepExisting", whenNotMatched: "insert" } },
  ]).toArray();
}

export async function getNewsletterQueueCounts(): Promise<Record<Delivery["status"], number>> {
  const db = await getMongoDatabase();
  const counts = { pending: 0, sent: 0, cancelled: 0, failed: 0 };
  for (const item of await db.collection<Delivery>("newsletter_deliveries").aggregate<{ _id: Delivery["status"]; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray()) {
    if (item._id in counts) counts[item._id] = item.count;
  }
  return counts;
}

export async function dispatchNewsletterBatch(): Promise<{ sent: number; failed: number; cancelled: number; remaining: number }> {
  const db = await getMongoDatabase();
  const deliveries = db.collection<Delivery>("newsletter_deliveries");
  const subscribers = db.collection<Subscriber>("subscribers");
  const result = { sent: 0, failed: 0, cancelled: 0, remaining: 0 };
  // A worker may have stopped during its final attempt; do not leave that lease
  // in the pending queue forever after it expires.
  await deliveries.updateMany({
    status: "pending", attempts: { $gte: 3 }, leaseUntil: { $lte: new Date() },
  }, { $set: { status: "failed" }, $unset: { leaseId: "", leaseUntil: "" } });
  // One bounded SMTP delivery per request; the editor advances the queue while
  // it stays open without depending on a process surviving after the response.
  for (let i = 0; i < 1; i++) {
    const leaseId = randomBytes(16).toString("hex");
    const now = new Date();
    const delivery = await deliveries.findOneAndUpdate({
      status: "pending", attempts: { $lt: 3 },
      $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }],
    }, { $set: { leaseId, leaseUntil: new Date(now.getTime() + 120_000) }, $inc: { attempts: 1 } }, { sort: { createdAt: 1 }, returnDocument: "after" });
    if (!delivery) break;
    const subscriber = await subscribers.findOne({ _id: delivery.subscriberId, emailVerified: true, unsubscribedAt: { $exists: false } });
    if (!subscriber) {
      await deliveries.updateOne({ _id: delivery._id, leaseId }, { $set: { status: "cancelled" }, $unset: { leaseId: "", leaseUntil: "" } });
      result.cancelled++;
      continue;
    }
    const token = createUnsubscribeToken(subscriber._id.toHexString(), process.env.RATE_LIMIT_SECRET || "");
    const unsubscribeUrl = `${siteUrl}/bulten/ayril?token=${token}`;
    try {
      await sendEmail({
        to: subscriber.email,
        subject: `GentleVie'de yeni: ${delivery.title}`,
        text: `${delivery.title}\n\n${delivery.subtitle}\n\nYazıyı oku: ${siteUrl}/journal/${delivery.postSlug}\n\nThe art of living well\n\nBültenden ayrıl: ${unsubscribeUrl}\nİletişim: ${process.env.PRIVACY_CONTACT_EMAIL || "gentlevie@gmail.com"}`,
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
      });
      await deliveries.updateOne({ _id: delivery._id, leaseId }, { $set: { status: "sent", sentAt: new Date() }, $unset: { leaseId: "", leaseUntil: "" } });
      result.sent++;
    } catch {
      const finalAttempt = delivery.attempts >= 3;
      await deliveries.updateOne({ _id: delivery._id, leaseId }, { $set: { status: finalAttempt ? "failed" : "pending", leaseUntil: new Date(Date.now() + 60_000) }, $unset: { leaseId: "" } });
      result.failed++;
      break;
    }
  }
  result.remaining = await deliveries.countDocuments({ status: "pending" });
  return result;
}
