import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import MemberPanel from "@/components/member-panel";
import { getSession, isAdmin } from "@/lib/auth";
import { getAuthAvailability } from "@/lib/auth-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hesabım", robots: { index: false, follow: false }, alternates: { canonical: "/hesabim" } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!getAuthAvailability()) redirect("/uyelik");
  const params = await searchParams;
  const session = await getSession(await headers());
  if (!session) {
    const verificationError = typeof params.error === "string" ? params.error : "";
    const safeError = ["invalid_token", "expired_token", "token_expired", "INVALID_TOKEN", "TOKEN_EXPIRED"].includes(verificationError) ? verificationError : verificationError ? "verification_failed" : "";
    redirect(`/uyelik?sekme=giris${safeError ? `&error=${encodeURIComponent(safeError)}` : ""}`);
  }
  if (!session.user.emailVerified) redirect("/uyelik?sekme=giris&error=email_not_verified");

  return <div className="auth-page">
    <header className="reading-header section-shell"><Link className="wordmark" href="/" aria-label="GentleVie ana sayfa">gentle vie</Link><Link className="reading-back" href="/">Siteye dön</Link></header>
    <main className="auth-card" aria-labelledby="account-title">
      <p className="eyebrow">GENTLEVIE HESABIM</p><h1 id="account-title">Hoş geldin,<br /><em>{session.user.name}</em></h1>
      <MemberPanel name={session.user.name} email={session.user.email} admin={isAdmin(session)} />
    </main>
    <footer className="reading-footer section-shell"><span>THE ART OF LIVING WELL</span><nav aria-label="Hesap alt menüsü"><Link href="/gizlilik">Gizlilik</Link><a href="mailto:gentlevie@gmail.com">İletişim</a></nav></footer>
  </div>;
}
