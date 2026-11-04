import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import PostEditor from '@/components/post-editor';
import NewsletterDispatch from '@/components/newsletter-dispatch';
import { getSession, isAdmin } from '@/lib/auth';
import { listAdminPosts } from '@/lib/posts';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Yazı yönetimi',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await getSession(await headers());
  if (!session) redirect('/uyelik');
  if (!isAdmin(session)) {
    return (
      <main className="admin-page section-shell">
        <Link className="wordmark" href="/">gentle vie</Link>
        <h1>Bu alan yöneticiye ait</h1>
        <p>Bu hesapla yazı yönetimine erişilemiyor</p>
        <Link className="understated-link" href="/hesabim">Hesabıma dön</Link>
      </main>
    );
  }

  let posts: Awaited<ReturnType<typeof listAdminPosts>> = [];
  let storageAvailable = true;
  try { posts = await listAdminPosts(); }
  catch {
    storageAvailable = false;
    console.error('[admin/posts] Editor storage temporarily unavailable');
  }

  return (
    <main className="admin-page section-shell">
      <header className="reading-header">
        <Link className="wordmark" href="/">gentle vie</Link>
        <Link className="reading-back" href="/hesabim">Hesabım</Link>
      </header>
      <div className="admin-intro">
        <p className="eyebrow">GENTLEVIE / YÖNETİM</p>
        <h1>Yeni bir<br /><em>bakış ekle</em></h1>
        <p>Yazını taslak olarak sakla veya okurlarınla paylaş</p>
      </div>
      <PostEditor initialPosts={posts} storageAvailable={storageAvailable} />
      <NewsletterDispatch />
    </main>
  );
}
