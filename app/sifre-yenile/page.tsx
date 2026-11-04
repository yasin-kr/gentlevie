import type { Metadata } from "next";
import Link from "next/link";
import MemberForm from "@/components/member-form";
import { getAuthAvailability } from "@/lib/auth-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Şifreyi yenile", robots: { index: false, follow: false }, referrer: "no-referrer", alternates: { canonical: "/sifre-yenile" } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" && params.token.length <= 2048 ? params.token : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  return <div className="auth-page">
    <header className="reading-header section-shell"><Link className="wordmark" href="/" aria-label="GentleVie ana sayfa">gentle vie</Link><Link className="reading-back" href="/uyelik?sekme=giris">Giriş yap</Link></header>
    <main className="auth-card" aria-labelledby="reset-title">
      <p className="eyebrow">GENTLEVIE ÜYELİK</p><h1 id="reset-title">Yeni bir<br /><em>şifre belirle</em></h1>
      <MemberForm available={getAuthAvailability()} initialMode="reset" resetToken={token} initialError={error} />
    </main>
    <footer className="reading-footer section-shell"><span>THE ART OF LIVING WELL</span><nav aria-label="Şifre yenileme alt menüsü"><Link href="/gizlilik">Gizlilik</Link><a href="mailto:gentlevie@gmail.com">İletişim</a></nav></footer>
  </div>;
}
