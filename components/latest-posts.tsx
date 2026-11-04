import Image from "next/image";
import Link from "next/link";
import ArrowIcon from "@/components/arrow-icon";
import type { Article } from "@/lib/articles";

export default function LatestPosts({ articles }: { articles: Article[] }) {
  if (!articles.length) return null;
  return <section className="latest-posts" aria-labelledby="latest-posts-title">
    <h3 id="latest-posts-title">Journal’dan yeni bakışlar</h3>
    <div className="latest-posts-grid">
      {articles.map(article => <Link href={`/journal/${article.slug}`} className="latest-post-card" key={article.slug}>
        <Image src={article.image} alt={article.imageAlt} width={900} height={675} sizes="(max-width: 650px) 90vw, (max-width: 1000px) 45vw, 30vw" />
        <p className="eyebrow">{article.category} / {article.readTime}</p>
        <h4>{article.title}</h4>
        <p>{article.subtitle}</p>
        <ArrowIcon direction="diagonal" />
      </Link>)}
    </div>
  </section>;
}
