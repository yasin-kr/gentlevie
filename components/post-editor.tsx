'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createPostSchema, type AdminPost } from '@/lib/post-schema';

type PostEditorProps = {
  initialPosts: AdminPost[];
  storageAvailable: boolean;
};

type PostResponse = {
  ok?: boolean;
  post?: AdminPost;
  message?: string;
  notice?: string;
  notificationQueued?: boolean;
};

export default function PostEditor({ initialPosts, storageAvailable }: PostEditorProps) {
  const messageId = useId();
  const [posts, setPosts] = useState(initialPosts);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [notifyDrafts, setNotifyDrafts] = useState<Record<string, boolean>>({});
  useEffect(() => setReady(true), []);

  function remember(post: AdminPost) {
    setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy || !storageAvailable) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = createPostSchema.safeParse({
      title: data.get('title'),
      subtitle: data.get('subtitle'),
      slug: data.get('slug'),
      category: data.get('category'),
      image: data.get('image'),
      paragraphs: String(data.get('paragraphs') || '').split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean),
      status,
      notify: status === 'published' && data.get('notify') === 'on',
    });
    if (!input.success) {
      setMessage('Alanları kontrol et. Bağlantı adresinde küçük Latin harfleri, rakam ve tire kullan; yazı en fazla 24 paragraf olabilir');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input.data),
      });
      const result: PostResponse = await response.json();
      if (!response.ok || !result.ok || !result.post) throw new Error(result.message || 'Yazı kaydedilemedi');
      remember(result.post);
      form.reset();
      setStatus('draft');
      setMessage(result.notice || (result.post.status === 'draft' ? 'Taslak kaydedildi' : result.notificationQueued ? 'Yazı yayınlandı ve duyuru sıraya alındı. Gönderimi aşağıdaki Duyurular alanından başlatabilirsin' : 'Yazı yayınlandı'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bağlantı kurulamadı. Lütfen tekrar dene');
    } finally { setBusy(false); }
  }

  async function publish(post: AdminPost, notify: boolean) {
    if (!ready || activeId || busy || !storageAvailable) return;
    setActiveId(post.id);
    setMessage('');
    try {
      const response = await fetch('/api/admin/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, status: 'published', notify }),
      });
      const result: PostResponse = await response.json();
      if (!response.ok || !result.ok || !result.post) throw new Error(result.message || 'İşlem tamamlanamadı');
      remember(result.post);
      setMessage(result.notice || (result.notificationQueued ? 'Duyuru sıraya alındı. Gönderimi aşağıdaki Duyurular alanından başlatabilirsin' : 'Yazı yayınlandı'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bağlantı kurulamadı. Lütfen tekrar dene');
    } finally { setActiveId(null); }
  }

  return (
    <>
      {!storageAvailable ? <p className="editor-status" role="status">Yazı arşivine şu anda ulaşılamıyor. Biraz sonra sayfayı yenileyebilirsin</p> : null}
      <form className="editor-form" method="post" onSubmit={submitPost} aria-describedby={messageId}>
        <fieldset disabled={!ready || busy || Boolean(activeId) || !storageAvailable}>
          <legend>Yeni yazı</legend>
          <div className="editor-grid">
            <label>Başlık<input name="title" required minLength={3} maxLength={140} /></label>
            <label>Bağlantı adresi<input name="slug" required minLength={3} maxLength={96} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="yeni-bir-bakis" autoCapitalize="none" spellCheck={false} /></label>
            <label>Kategori<select name="category" defaultValue="journal"><option value="style">Style</option><option value="living">Living</option><option value="journal">Journal</option></select></label>
            <label>Görsel<select name="image" defaultValue="/assets/hero.webp"><option value="/assets/hero.webp">Traverten kemer ve mavi gökyüzü</option><option value="/assets/style.webp">Keten ceket ve ceviz sandalye</option><option value="/assets/ritual.webp">Seramik fincan ve sabah ışığı</option></select></label>
          </div>
          <label>Alt başlık<textarea name="subtitle" rows={2} required minLength={3} maxLength={320} /></label>
          <label>Yazı<textarea name="paragraphs" rows={12} required maxLength={30_000} aria-describedby="paragraph-help" /></label>
          <p className="editor-help" id="paragraph-help">Paragraflar arasında bir boş satır bırak. Yazılar düz metin olarak yayınlanır</p>
          <label>Durum<select name="status" value={status} onChange={(event) => setStatus(event.target.value as 'draft' | 'published')}><option value="draft">Taslak olarak sakla</option><option value="published">Yayınla</option></select></label>
          <label className="editor-checkbox"><input type="checkbox" name="notify" disabled={status !== 'published'} />Bülten abonelerine duyur</label>
          <button className="editor-submit" type="submit">{busy ? 'Kaydediliyor' : status === 'draft' ? 'Taslağı kaydet' : 'Yazıyı yayınla'}</button>
        </fieldset>
      </form>
      <noscript><p className="editor-status">Yazı oluşturmak ve yayınlamak için tarayıcında JavaScript’i etkinleştir</p></noscript>
      <p className="editor-status" id={messageId} role="status" aria-live="polite">{message}</p>
      <section className="editor-posts" aria-labelledby="editor-posts-title">
        <h2 id="editor-posts-title">Yazıların</h2>
        {posts.length ? (
          <ul className="editor-post-list">
            {posts.map((post) => (
              <li key={post.id}>
                <div><span className="eyebrow">{post.status === 'draft' ? 'TASLAK' : 'YAYINDA'} / {post.category.toUpperCase()}</span><h3>{post.title}</h3><p>/{post.slug}</p></div>
                <div className="editor-post-actions">
                  {post.status === 'published' ? <><Link href={`/journal/${post.slug}`}>Yazıyı aç</Link><button type="button" onClick={() => publish(post, true)} disabled={busy || Boolean(activeId) || !storageAvailable}>{activeId === post.id ? 'Hazırlanıyor' : 'Duyuruyu sıraya al'}</button></> : <><label className="editor-checkbox"><input type="checkbox" checked={Boolean(notifyDrafts[post.id])} onChange={(event) => setNotifyDrafts((current) => ({ ...current, [post.id]: event.target.checked }))} disabled={busy || Boolean(activeId)} />Bülten abonelerine duyur</label><button type="button" onClick={() => publish(post, Boolean(notifyDrafts[post.id]))} disabled={busy || Boolean(activeId) || !storageAvailable}>{activeId === post.id ? 'Yayınlanıyor' : 'Taslağı yayınla'}</button></>}
                </div>
              </li>
            ))}
          </ul>
        ) : <p>Henüz eklediğin bir yazı yok</p>}
      </section>
    </>
  );
}
