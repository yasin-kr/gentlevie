"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import ArrowIcon from "./arrow-icon";

type MemberPanelProps = { name: string; email: string; admin: boolean };

export default function MemberPanel({ name, email, admin }: MemberPanelProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const busyRef = useRef(false);
  useEffect(() => setReady(true), []);

  async function signOut(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busyRef.current) return;
    busyRef.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await authClient.signOut();
      if (result.error) setMessage("Çıkış yapılamadı. Biraz sonra yeniden deneyebilirsin.");
      else {
        router.replace("/uyelik?sekme=giris&cikis=1");
        router.refresh();
      }
    } catch {
      setMessage("Bağlantı kurulamadı. Biraz sonra yeniden deneyebilirsin.");
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  }

  return <div className="member-panel">
    <dl className="member-details"><div><dt>Adın</dt><dd>{name}</dd></div><div><dt>E-posta adresin</dt><dd>{email}</dd></div><div><dt>Hesap durumu</dt><dd>E-posta adresi doğrulandı</dd></div></dl>
    <nav className="member-links" aria-label="Hesap bağlantıları">
      <Link className="understated-link" href="/#journal">Yazıları keşfet<ArrowIcon direction="diagonal" /></Link>
      <Link className="understated-link" href="/#katil">Bültene katıl<ArrowIcon direction="diagonal" /></Link>
      <Link className="understated-link" href="/uyelik?sekme=sifremi-unuttum">Şifremi yenile<ArrowIcon direction="diagonal" /></Link>
      {admin && <Link className="understated-link" href="/yonetim">Yönetim paneli<ArrowIcon direction="diagonal" /></Link>}
    </nav>
    <p className="auth-help">Üyelik ve bülten kaydı ayrı tutulur. Bültene katılmak için e-posta onayını ayrıca verebilirsin.</p>
    <form method="post" className="auth-form" onSubmit={signOut} aria-busy={pending}>
      <button type="submit" className="auth-submit" disabled={!ready || pending}>{pending ? "Çıkış yapılıyor" : "Çıkış yap"}<ArrowIcon direction="diagonal" /></button>
      <p className="form-status form-status--error" role="status" aria-live="polite">{message}</p>
    </form>
    <noscript><p className="auth-notice">Çıkış yapmak için tarayıcında JavaScript’i etkinleştir.</p></noscript>
  </div>;
}
