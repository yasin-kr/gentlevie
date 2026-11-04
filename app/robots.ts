import type { MetadataRoute } from "next";
import { isPublicProduction, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: isPublicProduction ? "/" : undefined, disallow: isPublicProduction ? ["/api/", "/hesabim", "/yonetim", "/bulten/", "/sifre-yenile"] : "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
