import Link from "next/link";

export default function NotFound() {
  return <main className="status-page section-shell">
    <Link href="/" className="wordmark">gentle vie</Link>
    <p className="eyebrow">404 / KÜÇÜK BİR SAPAK</p>
    <h1>Bu sayfa<br /><em>burada değil</em></h1>
    <p>Aradığın bağlantı değişmiş olabilir. Yeni bir başlangıç için ana sayfaya dönebilirsin.</p>
    <Link href="/" className="understated-link">Ana sayfaya dön</Link>
  </main>;
}
