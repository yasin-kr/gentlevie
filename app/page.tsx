import HomeExperience from "@/components/home-experience";
import NewsletterForm from "@/components/newsletter-form";
import { getSubscriptionAvailability } from "@/lib/subscriptions";
import LatestPosts from "@/components/latest-posts";
import { getPublishedPosts } from "@/lib/posts";
import { articles } from "@/lib/articles";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const seedSlugs = new Set(articles.map(article => article.slug));
  const latest = (await getPublishedPosts()).filter(article => !seedSlugs.has(article.slug));
  return <HomeExperience
    newsletter={<NewsletterForm available={getSubscriptionAvailability()} />}
    latestPosts={<LatestPosts articles={latest} />}
  />;
}
