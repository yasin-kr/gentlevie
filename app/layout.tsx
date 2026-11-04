import type { Metadata, Viewport } from "next";
import { siteDescription, siteName, siteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${siteName} — The Art of Living Well`, template: `%s | ${siteName}` },
  description: siteDescription,
  alternates: { canonical: "/" },
  applicationName: siteName,
  icons: { icon: "/assets/favicon.svg" },
  openGraph: {
    type: "website", locale: "tr_TR", siteName,
    title: `${siteName} — The Art of Living Well`, description: siteDescription,
    url: siteUrl,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "gentle vie — The art of living well" }],
  },
  twitter: { card: "summary_large_image", title: siteName, description: siteDescription, images: ["/opengraph-image"] },
};

export const viewport: Viewport = { themeColor: "#0845b7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <head>
        <link rel="preload" href="/assets/editorial-regular.woff" as="font" type="font/woff" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
