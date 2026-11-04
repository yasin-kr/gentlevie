import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelSubscription, confirmSubscription } from "@/app/bulten/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bülten tercihin", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function NewsletterDecision({ params, searchParams }: {
  params: Promise<{ action: string }>;
  searchParams: Promise<{ token?: string; durum?: string }>;
}) {
  const { action } = await params;
  const { token, durum } = await searchParams;
  if (!["onay", "ayril", "sonuc"].includes(action)) notFound();
  const isConfirmation = action === "onay";
  const validToken = typeof token === "string" && (isConfirmation ? /^[a-f0-9]{64}$/.test(token) : /^[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/.test(token));
  const outcomes: Record<string, [string, string]> = {
    onaylandi: ["Hoş geldin", "Bülten aboneliğin onaylandı. Yeni GentleVie yazılarından haberdar olabilirsin."],
    ayrildin: ["Tercihini kaydettik", "Bülten aboneliğinden ayrıldın. Üye hesabın ve siteye erişimin bu işlemden etkilenmez."],
    gecersiz: ["Bağlantı kullanılamıyor", "Bu bağlantı daha önce kullanılmış veya süresi dolmuş olabilir. Bülten formundan yeni bir onay isteyebilirsin."],
    hata: ["Kısa bir ara", "İşlem şu anda tamamlanamadı. Biraz sonra aynı bağlantıdan yeniden deneyebilirsin."],
  };
  const outcome = outcomes[durum || "gecersiz"] || outcomes.gecersiz!;
  return <main className="status-page section-shell">
    <Link href="/" className="wordmark">gentle vie</Link>
    <p className="eyebrow">GENTLEVIE MEKTUPLARI</p>
    <h1>{action === "sonuc" ? outcome[0] : isConfirmation ? "Bize katıl" : "Bültenden ayrıl"}</h1>
    {action === "sonuc" ? <p>{outcome[1]}</p> : validToken ? <>
      <p>{isConfirmation ? "Yeni yazılardan haberdar olmak için bülten aboneliğini aşağıdan onayla." : "GentleVie bülten e-postalarını durdurmak istediğini aşağıdan onaylayabilirsin."}</p>
      <form action={isConfirmation ? confirmSubscription : cancelSubscription}>
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="editor-submit">{isConfirmation ? "Aboneliğimi onayla" : "Bültenden ayrıl"}</button>
      </form>
    </> : <p>Bağlantı geçersiz. Lütfen e-postandaki bağlantıyı kontrol et.</p>}
    <Link className="understated-link" href="/#katil">GentleVie&apos;ye dön</Link>
  </main>;
}
