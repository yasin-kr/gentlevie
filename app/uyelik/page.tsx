import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import MemberForm, { type MemberMode } from "@/components/member-form";
import { getSession } from "@/lib/auth";
import { getAuthAvailability } from "@/lib/auth-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Üyelik", robots: { index: false, follow: false }, alternates: { canonical: "/uyelik" } };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MembershipPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const section = typeof params.sekme === "string" ? params.sekme : "";
  const mode: MemberMode = section === "giris" ? "signin" : section === "sifremi-unuttum" ? "forgot" : "signup";
  const available = getAuthAvailability();
  if (available && mode !== "forgot") {
    const session = await getSession(await headers());
    if (session?.user.emailVerified) redirect("/hesabim");
  }
  const error = typeof params.error === "string" ? params.error : undefined;
  const notice = params.cikis === "1" ? "Oturumun kapatıldı." : undefined;

  return <div className="auth-page">
    <header className="reading-header section-shell"><Link className="wordmark" href="/" aria-label="GentleVie ana sayfa">gentle vie</Link><Link className="reading-back" href="/">Siteye dön</Link></header>
    <main className="auth-card" aria-labelledby="membership-title">
      <p className="eyebrow">GENTLEVIE ÜYELİK</p><h1 id="membership-title">Kendine biraz<br /><em>yer aç</em></h1>
      <p className="auth-description">Hesabını oluştur veya kaldığın yerden devam et.</p>
      <MemberForm key={`${mode}-${error ?? ""}`} available={available} initialMode={mode} initialError={error} initialNotice={notice} />
    </main>
    <footer className="reading-footer section-shell"><span>THE ART OF LIVING WELL</span><nav aria-label="Üyelik alt menüsü"><Link href="/gizlilik">Gizlilik</Link><a href="mailto:gentlevie@gmail.com">İletişim</a></nav></footer>
  </div>;
}
