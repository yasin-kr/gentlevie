"use client";

import { useEffect, useRef, useState } from "react";

type Counts = { pending: number; sent: number; cancelled: number; failed: number };

export default function NewsletterDispatch() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const running = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function refresh() {
    try {
      const response = await fetch("/api/admin/newsletter", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setCounts(data.counts);
      setMessage("");
    } catch { setMessage("Duyuru durumu şu anda yüklenemiyor"); }
  }

  async function send() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage("Duyurular gönderiliyor. İşlem bitene kadar bu sayfayı açık tut.");
    try {
      while (active.current) {
        const response = await fetch("/api/admin/newsletter", { method: "POST", signal: AbortSignal.timeout(65000) });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error();
        if (!active.current) break;
        setCounts(data.counts);
        if (data.result.failed > 0) {
          setMessage("Bazı e-postalar gönderilemedi. Gönderilenler korundu; bir dakika sonra kalanlar için yeniden deneyebilirsin.");
          break;
        }
        if (data.result.remaining === 0) {
          setMessage("Gönderim sırasındaki duyurular tamamlandı");
          break;
        }
        if (data.result.sent + data.result.cancelled === 0) {
          setMessage("Bazı gönderimler işleniyor veya yeniden denemeyi bekliyor. Biraz sonra durumu yenileyebilirsin.");
          break;
        }
      }
    } catch { if (active.current) setMessage("Gönderim tamamlanamadı. Durumu yenileyip kalan duyuruları yeniden gönderebilirsin."); }
    finally { running.current = false; if (active.current) setBusy(false); }
  }

  return <section className="dispatch-panel" aria-labelledby="dispatch-title">
    <p className="eyebrow">BÜLTEN</p>
    <h2 id="dispatch-title">Okurlarına haber ver</h2>
    <p>Yazı yayınlarken duyuru seçeneğini işaretlediğinde, onaylı abonelerin için bir gönderim sırası oluşur. Aşağıdaki düğmeyle bu duyuruları gönder.</p>
    {counts && <p className="dispatch-counts">Bekleyen: {counts.pending} · Gönderilen: {counts.sent} · İptal: {counts.cancelled} · Başarısız: {counts.failed}</p>}
    <div className="editor-post-actions">
      <button type="button" className="understated-link" onClick={refresh} disabled={busy}>Durumu yenile</button>
      <button type="button" className="editor-submit" onClick={send} disabled={busy}>{busy ? "Gönderiliyor" : "Sıradaki duyuruları gönder"}</button>
    </div>
    <p className="editor-status" role="status" aria-live="polite">{message}</p>
  </section>;
}
