import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/posts";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getPublishedPosts();
  return [
    { url: siteUrl, changeFrequency: "monthly", priority: 1 },
    ...articles.map(article => ({ url: `${siteUrl}/journal/${article.slug}`, lastModified: article.publishedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${siteUrl}/gizlilik`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
