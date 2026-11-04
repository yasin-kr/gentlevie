"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="status-page section-shell">
    <Link href="/" className="wordmark">gentle vie</Link>
    <p className="eyebrow">KISA BİR ARA</p>
    <h1>Bir şeyler<br /><em>yolunda gitmedi</em></h1>
    <p>Sayfayı yeniden yüklemeyi deneyebilirsin.</p>
    <button type="button" className="understated-link" onClick={reset}>Yeniden dene</button>
  </main>;
}
