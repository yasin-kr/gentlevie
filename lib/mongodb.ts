import "server-only";
import { MongoClient, MongoServerError, type Db } from "mongodb";
import {
  SUBSCRIPTION_RATE_LIMIT,
  SUBSCRIPTION_RATE_WINDOW_MS,
  type SubscriptionRecord,
} from "./subscription-schema";
import type { SubscriptionStore } from "./subscriptions";

type MongoCache = {
  uri: string;
  client: Promise<MongoClient>;
  databases: Map<string, Db>;
};

const mongoGlobal = globalThis as typeof globalThis & {
  gentleVieMongo?: MongoCache;
};

export async function getMongoDatabase(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Subscription database is not configured");
  if (!mongoGlobal.gentleVieMongo || mongoGlobal.gentleVieMongo.uri !== uri) {
    const client = new MongoClient(uri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
      socketTimeoutMS: 10_000,
      waitQueueTimeoutMS: 5_000,
    });
    const connection = client.connect().catch(async (error: unknown) => {
      if (mongoGlobal.gentleVieMongo?.client === connection) {
        delete mongoGlobal.gentleVieMongo;
      }
      await client.close().catch(() => undefined);
      throw error;
    });
    mongoGlobal.gentleVieMongo = { uri, client: connection, databases: new Map() };
  }
  const client = await mongoGlobal.gentleVieMongo.client;
  const name = process.env.MONGODB_DB || "gentlevie";
  let db = mongoGlobal.gentleVieMongo.databases.get(name);
  if (!db) {
    db = client.db(name);
    mongoGlobal.gentleVieMongo.databases.set(name, db);
  }
  return db;
}

type StoredSubscriber = SubscriptionRecord & {
  createdAt: Date;
  consentedAt: Date;
  updatedAt: Date;
};

type RateBucket = {
  _id: string;
  count: number;
  expiresAt: Date;
};

const indexPromises = new WeakMap<Db, Promise<void>>();

async function ensureIndexes(db: Db): Promise<void> {
  let indexes = indexPromises.get(db);
  if (!indexes) {
    indexes = Promise.all([
      db.collection<StoredSubscriber>("subscribers").createIndex(
        { email: 1 },
        { unique: true, name: "unique_subscriber_email" },
      ),
      db.collection<RateBucket>("subscription_rate_limits").createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: "expire_subscription_rate_limits" },
      ),
    ]).then(() => undefined).catch((error: unknown) => {
      indexPromises.delete(db);
      throw error;
    });
    indexPromises.set(db, indexes);
  }
  await indexes;
}

function isDuplicateKey(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

export async function getMongoSubscriptionStore(): Promise<SubscriptionStore> {
  const db = await getMongoDatabase();
  await ensureIndexes(db);
  const subscribers = db.collection<StoredSubscriber>("subscribers");
  const rateLimits = db.collection<RateBucket>("subscription_rate_limits");

  return {
    async consumeRateLimit(key, now) {
      const bucket = Math.floor(now.getTime() / SUBSCRIPTION_RATE_WINDOW_MS);
      const resetAt = (bucket + 1) * SUBSCRIPTION_RATE_WINDOW_MS;
      const id = `subscription:${key}:${bucket}`;
      const update = {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date(resetAt + SUBSCRIPTION_RATE_WINDOW_MS) },
      };
      let result: RateBucket | null;
      try {
        result = await rateLimits.findOneAndUpdate(
          { _id: id },
          update,
          { upsert: true, returnDocument: "after", includeResultMetadata: false },
        );
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        result = await rateLimits.findOneAndUpdate(
          { _id: id },
          update,
          { returnDocument: "after", includeResultMetadata: false },
        );
      }
      if (!result) throw new Error("Rate limit storage unavailable");
      return {
        allowed: result.count <= SUBSCRIPTION_RATE_LIMIT,
        retryAfter: Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000)),
      };
    },
    async subscribe(record, now) {
      try {
        // Existing registrations receive the same response without overwriting
        // their name or consent history using an unverified public request.
        await subscribers.updateOne(
          { email: record.email },
          { $setOnInsert: { ...record, createdAt: now, consentedAt: now, updatedAt: now } },
          { upsert: true },
        );
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
      }
    },
  };
}
