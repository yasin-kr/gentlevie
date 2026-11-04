import 'server-only';
import { MongoServerError, ObjectId, type Db } from 'mongodb';
import { articles, getArticleBySlug, type Article } from './articles';
import { getMongoDatabase } from './mongodb';
import { createPostSchema, type AdminPost, type CreatePostInput } from './post-schema';

type StoredPost = Omit<CreatePostInput, 'notify'> & {
  _id: ObjectId;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
};

const indexPromises = new WeakMap<Db, Promise<void>>();
const categories = { style: 'Style', living: 'Living', journal: 'Journal' } as const;
const imageDescriptions: Record<CreatePostInput['image'], string> = {
  '/assets/style.webp': 'Ceviz sandalye üzerinde fildişi keten ceket.',
  '/assets/ritual.webp': 'Taş yüzey üzerinde seramik fincan ve keten kumaş.',
  '/assets/hero.webp': 'Mavi gökyüzüne açılan traverten kemer ve basamaklar.',
};

async function getPostCollection() {
  const db = await getMongoDatabase();
  let indexes = indexPromises.get(db);
  if (!indexes) {
    indexes = Promise.all([
      db.collection<StoredPost>('posts').createIndex({ slug: 1 }, { unique: true, name: 'unique_post_slug' }),
      db.collection<StoredPost>('posts').createIndex({ status: 1, publishedAt: -1 }, { name: 'published_posts' }),
    ]).then(() => undefined).catch((error: unknown) => {
      indexPromises.delete(db);
      throw error;
    });
    indexPromises.set(db, indexes);
  }
  await indexes;
  return db.collection<StoredPost>('posts');
}

function asAdminPost(post: StoredPost): AdminPost {
  return {
    id: post._id.toHexString(),
    title: post.title,
    subtitle: post.subtitle,
    slug: post.slug,
    category: post.category,
    image: post.image,
    paragraphs: post.paragraphs,
    status: post.status,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    publishedAt: post.publishedAt?.toISOString() || null,
  };
}

export function publishedPostAsArticle(post: AdminPost): Article | undefined {
  if (post.status !== 'published' || !post.publishedAt) return undefined;
  const published = new Date(post.publishedAt);
  if (!Number.isFinite(published.getTime())) return undefined;
  const wordCount = post.paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
  return {
    key: post.category,
    slug: post.slug,
    category: categories[post.category],
    number: '',
    title: post.title,
    subtitle: post.subtitle,
    readTime: `${Math.max(1, Math.ceil(wordCount / 200))} dk okuma`,
    image: post.image,
    imageAlt: imageDescriptions[post.image],
    paragraphs: post.paragraphs,
    publishedAt: published.toISOString(),
  };
}

function safePublishedArticle(post: StoredPost): Article | undefined {
  const { _id, createdBy, createdAt, updatedAt, publishedAt, ...input } = post;
  void createdBy;
  if (!createPostSchema.safeParse(input).success || !(_id instanceof ObjectId) ||
    !(createdAt instanceof Date) || !(updatedAt instanceof Date) || !(publishedAt instanceof Date)) return undefined;
  if (![createdAt, updatedAt, publishedAt].every((date) => Number.isFinite(date.getTime()))) return undefined;
  return publishedPostAsArticle(asAdminPost(post));
}

export async function getPublishedPosts(): Promise<Article[]> {
  if (!process.env.MONGODB_URI) return [...articles];
  try {
    const collection = await getPostCollection();
    const stored = await collection.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(100).toArray();
    const published = stored.map(safePublishedArticle).filter((post): post is Article => Boolean(post));
    return [...published, ...articles];
  } catch {
    console.error('[posts] Published content temporarily unavailable');
    return [...articles];
  }
}

export async function getPublishedPostBySlug(slug: string): Promise<Article | undefined> {
  const seed = getArticleBySlug(slug);
  if (seed) return seed;
  if (!process.env.MONGODB_URI || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 96) return undefined;
  try {
    const collection = await getPostCollection();
    const stored = await collection.findOne({ slug, status: 'published' });
    return stored ? safePublishedArticle(stored) : undefined;
  } catch {
    console.error('[posts] Published content temporarily unavailable');
    return undefined;
  }
}

export async function listAdminPosts(): Promise<AdminPost[]> {
  const collection = await getPostCollection();
  return (await collection.find({}).sort({ createdAt: -1 }).limit(100).toArray()).map(asAdminPost);
}

export class DuplicatePostSlugError extends Error {
  constructor() { super('Post slug is already in use'); }
}

export async function createPost(input: CreatePostInput, actorId: string): Promise<AdminPost> {
  const validated = createPostSchema.parse(input);
  const { notify, ...content } = validated;
  void notify;
  const now = new Date();
  const post: StoredPost = {
    ...content,
    _id: new ObjectId(),
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
    publishedAt: validated.status === 'published' ? now : null,
  };
  const collection = await getPostCollection();
  try {
    await collection.insertOne(post);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) throw new DuplicatePostSlugError();
    throw error;
  }
  return asAdminPost(post);
}

export async function publishDraft(id: string): Promise<{ post: AdminPost; newlyPublished: boolean } | undefined> {
  if (!/^[a-fA-F0-9]{24}$/.test(id)) return undefined;
  const collection = await getPostCollection();
  const now = new Date();
  const post = await collection.findOneAndUpdate(
    { _id: new ObjectId(id), status: 'draft' },
    { $set: { status: 'published', publishedAt: now, updatedAt: now } },
    { returnDocument: 'after', includeResultMetadata: false },
  );
  if (post) return { post: asAdminPost(post), newlyPublished: true };
  const existing = await collection.findOne({ _id: new ObjectId(id), status: 'published' });
  return existing ? { post: asAdminPost(existing), newlyPublished: false } : undefined;
}
