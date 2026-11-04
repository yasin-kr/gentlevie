import { getSession, isAdmin } from '@/lib/auth';
import { POST_BODY_LIMIT, createPostSchema, publishPostSchema } from '@/lib/post-schema';
import { createPost, DuplicatePostSlugError, listAdminPosts, publishDraft, publishedPostAsArticle } from '@/lib/posts';
import { queuePostAnnouncement } from '@/lib/newsletter';
import type { AdminPost } from '@/lib/post-schema';
import { siteUrl } from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function respond(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

function sameOrigin(request: Request): boolean {
  return request.headers.get('sec-fetch-site') !== 'cross-site' && request.headers.get('origin') === siteUrl;
}

async function enqueueAnnouncement(post: AdminPost, notify: boolean) {
  if (!notify || post.status !== 'published') return { notificationQueued: false };
  try {
    const article = publishedPostAsArticle(post);
    if (!article) return { notificationQueued: false };
    await queuePostAnnouncement(article);
    return { notificationQueued: true };
  } catch {
    console.error('[admin/posts] Announcement queue temporarily unavailable');
    return { notificationQueued: false, notice: 'Yazı yayınlandı ancak duyuru sıraya alınamadı. Yazı listesinden yeniden deneyebilirsin' };
  }
}

class BodyError extends Error {
  constructor(readonly status: number) { super('Invalid post request body'); }
}

async function readBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new BodyError(415);
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > POST_BODY_LIMIT)) throw new BodyError(Number(length) > POST_BODY_LIMIT ? 413 : 400);
  if (!request.body) throw new BodyError(400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > POST_BODY_LIMIT) {
        await reader.cancel().catch(() => undefined);
        throw new BodyError(413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new BodyError(400); }
}

export async function GET(request: Request) {
  try {
    const session = await getSession(request.headers);
    if (!session) return respond(401, { ok: false, message: 'Önce giriş yapmalısın' });
    if (!isAdmin(session)) return respond(403, { ok: false, message: 'Bu alana erişim yetkin yok' });
    return respond(200, { ok: true, posts: await listAdminPosts() });
  } catch {
    console.error('[admin/posts] Listing temporarily unavailable');
    return respond(503, { ok: false, message: 'Yazılar şu anda yüklenemiyor' });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession(request.headers);
    if (!session) return respond(401, { ok: false, message: 'Önce giriş yapmalısın' });
    if (!isAdmin(session)) return respond(403, { ok: false, message: 'Bu alana erişim yetkin yok' });
    if (!sameOrigin(request)) return respond(403, { ok: false, message: 'Bu isteğe izin verilmiyor' });
    const parsed = createPostSchema.safeParse(await readBody(request));
    if (!parsed.success) return respond(400, { ok: false, message: 'Yazı alanlarını ve bağlantı adresini kontrol et' });
    const post = await createPost(parsed.data, session.user.id);
    return respond(201, { ok: true, post, ...await enqueueAnnouncement(post, parsed.data.notify) });
  } catch (error) {
    if (error instanceof BodyError) return respond(error.status, { ok: false, message: error.status === 413 ? 'Yazı çok uzun' : 'İstek biçimi geçersiz' });
    if (error instanceof DuplicatePostSlugError) return respond(409, { ok: false, message: 'Bu bağlantı adresi başka bir yazıda kullanılıyor' });
    console.error('[admin/posts] Creation temporarily unavailable');
    return respond(503, { ok: false, message: 'Yazı kaydedilemedi. Biraz sonra tekrar dene' });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession(request.headers);
    if (!session) return respond(401, { ok: false, message: 'Önce giriş yapmalısın' });
    if (!isAdmin(session)) return respond(403, { ok: false, message: 'Bu alana erişim yetkin yok' });
    if (!sameOrigin(request)) return respond(403, { ok: false, message: 'Bu isteğe izin verilmiyor' });
    const parsed = publishPostSchema.safeParse(await readBody(request));
    if (!parsed.success) return respond(400, { ok: false, message: 'Yayınlama isteği geçersiz' });
    const result = await publishDraft(parsed.data.id);
    if (!result) return respond(404, { ok: false, message: 'Taslak bulunamadı' });
    return respond(200, { ok: true, post: result.post, ...await enqueueAnnouncement(result.post, parsed.data.notify) });
  } catch (error) {
    if (error instanceof BodyError) return respond(error.status, { ok: false, message: 'İstek biçimi geçersiz' });
    console.error('[admin/posts] Publication temporarily unavailable');
    return respond(503, { ok: false, message: 'Yazı yayınlanamadı. Biraz sonra tekrar dene' });
  }
}
