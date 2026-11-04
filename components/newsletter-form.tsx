"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import ArrowIcon from "@/components/arrow-icon";

export default function NewsletterForm({ available }: { available: boolean }) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !available) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), consent: data.get("consent") === "on", website: data.get("website") }),
        signal: AbortSignal.timeout(65000),
      });
      const body: unknown = await response.json();
      const message = typeof body === "object" && body !== null && "message" in body && typeof body.message === "string" ? body.message : "Şu anda kaydını tamamlayamadık. Biraz sonra yeniden deneyebilirsin.";
      setResult({ ok: response.ok, message });
      if (response.ok) form.reset();
    } catch {
      setResult({ ok: false, message: "Bağlantı kurulamadı. Biraz sonra yeniden deneyebilirsin." });
    } finally {
      setPending(false);
    }
  }

  return <section className="newsletter section-shell" id="katil" aria-labelledby={`${id}-title`}>
    <div className="newsletter-copy">
      <p className="eyebrow">GENTLEVIE MEKTUPLARI</p>
      <h2 id={`${id}-title`}>İyi şeylerden<br /><em>haberdar ol</em></h2>
      <p>Yeni yazılar, küçük keşifler ve gündelik hayata iyi gelen ayrıntılar. E-posta adresini bırak, bağlantıda kalalım.</p>
    </div>
    <form className="newsletter-form" method="post" action="/api/subscriptions" onSubmit={subscribe} aria-busy={pending}>
      <label htmlFor={`${id}-email`}>E-posta adresin</label>
      <div className="newsletter-input-row">
        <input id={`${id}-email`} type="email" name="email" placeholder="sen@ornek.com" autoComplete="email" inputMode="email" maxLength={254} required disabled={!available || pending} aria-describedby={`${id}-status`} />
        <button type="submit" disabled={!available || pending} className="newsletter-submit">
          <span>{pending ? "Kaydediliyor" : "Katıl"}</span><ArrowIcon direction="diagonal" />
        </button>
      </div>
      <div className="form-honeypot" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Web sitesi</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" maxLength={200} />
      </div>
      <label className="newsletter-consent" htmlFor={`${id}-consent`}>
        <input id={`${id}-consent`} name="consent" type="checkbox" required disabled={!available || pending} />
        <span><Link href="/gizlilik">Gizlilik bilgilendirmesini</Link> okudum. E-posta adresimin GentleVie duyuruları için kullanılmasını kabul ediyorum.</span>
      </label>
      <p className={`form-status${result && !result.ok ? " form-status--error" : ""}`} id={`${id}-status`} role="status" aria-live="polite">
        {!available ? "Bülten kayıtları yakında açılıyor" : result?.message || "Yalnızca GentleVie haberleri. Dilediğin zaman ayrılabilirsin."}
      </p>
    </form>
    <noscript><style>{".newsletter-form{display:none}"}</style><p>Bültene katılmak için tarayıcında JavaScript&apos;i etkinleştir.</p></noscript>
  </section>;
}
