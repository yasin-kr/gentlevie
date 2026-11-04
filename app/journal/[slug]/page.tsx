import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleActions from '@/components/article-actions';
import ArrowIcon from '@/components/arrow-icon';
import { articles } from '@/lib/articles';
import { getPublishedPostBySlug, getPublishedPosts } from '@/lib/posts';
import { siteName, siteUrl } from '@/lib/site';

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return articles.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedPostBySlug(slug);
  if (!article) notFound();
  const path = `/journal/${article.slug}`;
  const image = new URL(article.image, siteUrl).href;

  return {
    title: article.title,
    description: article.subtitle,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      locale: 'tr_TR',
      siteName,
      url: new URL(path, siteUrl).href,
      title: article.title,
      description: article.subtitle,
      images: [{ url: image, width: 1536, height: 1024, alt: article.imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.subtitle,
      images: [{ url: image, alt: article.imageAlt }],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getPublishedPostBySlug(slug);
  if (!article) notFound();

  const publishedPosts = await getPublishedPosts();
  const index = publishedPosts.findIndex((item) => item.slug === article.slug);
  const nextArticle = publishedPosts[(index + 1) % publishedPosts.length]!;
  const path = `/journal/${article.slug}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.subtitle,
    inLanguage: 'tr-TR',
    mainEntityOfPage: new URL(path, siteUrl).href,
    image: new URL(article.image, siteUrl).href,
    isPartOf: { '@type': 'WebSite', name: siteName, url: siteUrl },
  };

  return (
    <div className="article-page">
      <a className="skip-link" href="#article-content">Yazıya geç</a>
      <header className="reading-header section-shell">
        <Link className="wordmark" href="/" aria-label="GentleVie ana sayfa">gentle vie</Link>
        <Link className="reading-back" href="/#journal">Journal’a dön</Link>
      </header>
      <main id="article-content" tabIndex={-1}>
        <div className="article-hero reading-hero">
          <Image
            src={article.image}
            alt={article.imageAlt}
            width={1536}
            height={1024}
            sizes="(max-width: 1200px) 100vw, 1200px"
            preload
          />
        </div>
        <article className="article-body reading-body" aria-labelledby="article-title">
          <p className="eyebrow">{article.category.toUpperCase()} / {article.readTime.toLocaleUpperCase('tr-TR')}</p>
          <h1 id="article-title">{article.title}</h1>
          <p className="article-subtitle">{article.subtitle}</p>
          <div className="article-paragraphs">
            {article.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
          </div>
          <div className="article-end">
            <span className="signature">gentle vie journal</span>
            <ArticleActions path={path} />
          </div>
          <Link className="next-article" href={`/journal/${nextArticle.slug}`}>
            <span className="eyebrow">SIRADAKİ YAZI</span>
            <span>{nextArticle.title}</span>
            <ArrowIcon />
          </Link>
        </article>
      </main>
      <footer className="reading-footer section-shell">
        <span>THE ART OF LIVING WELL</span>
        <nav aria-label="Yazı alt menüsü">
          <Link href="/#journal">Tüm yazılar</Link>
          <Link href="/#katil">Bize katıl</Link>
          <Link href="/gizlilik">Gizlilik</Link>
        </nav>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
    </div>
  );
}
