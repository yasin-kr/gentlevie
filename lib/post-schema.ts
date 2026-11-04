import { z } from 'zod';
import { articles } from './articles';

export const POST_BODY_LIMIT = 64 * 1024;
export const POST_IMAGES = ['/assets/style.webp', '/assets/ritual.webp', '/assets/hero.webp'] as const;
export const POST_CATEGORIES = ['style', 'living', 'journal'] as const;
export const POST_STATUSES = ['draft', 'published'] as const;

const reservedSlugs = new Set(articles.map((article) => article.slug));

export const postSlugSchema = z.string().trim().min(3).max(96)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((slug) => !reservedSlugs.has(slug), 'Bu adres mevcut bir yazıya ait');

export const createPostSchema = z.object({
  title: z.string().trim().min(3).max(140)
    .refine((title) => !/[\r\n]/.test(title), 'Başlığı tek satır olarak yaz'),
  subtitle: z.string().trim().min(3).max(320),
  slug: postSlugSchema,
  category: z.enum(POST_CATEGORIES),
  image: z.enum(POST_IMAGES),
  paragraphs: z.array(z.string().trim().min(1).max(3000)).min(1).max(24)
    .refine((paragraphs) => paragraphs.join('').length <= 30_000, 'Yazı çok uzun'),
  status: z.enum(POST_STATUSES).default('draft'),
  notify: z.boolean().default(false),
}).strict();

export const publishPostSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/),
  status: z.literal('published'),
  notify: z.boolean().default(false),
}).strict();

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type AdminPost = Omit<CreatePostInput, 'notify'> & {
  id: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};
