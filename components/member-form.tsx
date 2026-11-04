"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { authClient } from "@/lib/auth-client";
import ArrowIcon from "./arrow-icon";

export type MemberMode = "signup" | "signin" | "forgot" | "reset";
type Notice = { kind: "success" | "error"; message: string };
type MemberFormProps = {
  available: boolean;
  initialMode?: MemberMode;
  resetToken?: string;
  initialError?: string;
  initialNotice?: string;
};

const tabs = [
  { mode: "signup", label: "Kaydol" },
  { mode: "signin", label: "Giriş yap" },
  { mode: "forgot", label: "Şifremi unuttum" },
] as const;

function errorMessage(error: { code?: string; status?: number } | null | undefined, mode: MemberMode) {
  if (error?.status === 429 || error?.code === "TOO_MANY_REQUESTS") return "Çok sayıda deneme yapıldı. Biraz bekleyip yeniden deneyebilirsin.";
  if (error?.code === "EMAIL_NOT_VERIFIED") return "Giriş yapmadan önce e-posta adresini doğrulamalısın. Gelen kutunu kontrol et veya yeni bir bağlantı iste.";
  if (["INVALID_TOKEN", "TOKEN_EXPIRED", "INVALID_VERIFICATION_TOKEN"].includes(error?.code ?? "")) return "Bu bağlantı geçersiz veya süresi dolmuş. Yeni bir bağlantı isteyebilirsin.";
  if (error?.code === "PRIVACY_CONSENT_REQUIRED") return "Devam etmek için gizlilik bilgilendirmesini okuyup üyelik onayını vermelisin.";
  if (mode === "signin" && (error?.status === 401 || error?.code === "INVALID_EMAIL_OR_PASSWORD")) return "E-posta adresini ve şifreni kontrol edip yeniden dene.";
  if (["PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG"].includes(error?.code ?? "")) return "Şifren 12 ile 128 karakter arasında olmalı.";
  return "İşlem şu anda tamamlanamadı. Bilgilerini kontrol edip biraz sonra yeniden deneyebilirsin.";
}

function initialErrorMessage(code: string) {
  if (["invalid_token", "expired_token", "token_expired", "INVALID_TOKEN", "TOKEN_EXPIRED"].includes(code)) return "Bağlantı geçersiz veya süresi dolmuş. Yeni bir doğrulama ya da şifre yenileme bağlantısı isteyebilirsin.";
  if (code === "email_not_verified") return "Devam etmek için e-posta adresini doğrulamalısın.";
  return "Bağlantıyla işlem tamamlanamadı. Yeniden giriş yapabilir veya yeni bir bağlantı isteyebilirsin.";
}

export default function MemberForm({ available, initialMode = "signup", resetToken, initialError, initialNotice }: MemberFormProps) {
  const id = useId();
  const router = useRouter();
  const [mode, setMode] = useState<MemberMode>(initialMode);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<"submit" | "resend" | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(Boolean(initialError));
  const [resetComplete, setResetComplete] = useState(false);
  const [resendUntil, setResendUntil] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(() => initialError
    ? { kind: "error", message: initialErrorMessage(initialError) }
    : initialNotice ? { kind: "success", message: initialNotice } : null);
  const busyRef = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (!resendUntil) return;
    const timer = setTimeout(() => setResendUntil(0), Math.max(0, resendUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [resendUntil]);

  function selectMode(next: MemberMode) {
    if (busyRef.current) return;
    setMode(next);
    setPassword("");
    setConfirmation("");
    setNotice(null);
    setNeedsVerification(false);
  }

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectMode(tabs[next]!.mode);
    tabRefs.current[next]?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available || !ready || busyRef.current || resetComplete) return;
    if (mode === "signup" && !privacyAccepted) {
      setNotice({ kind: "error", message: errorMessage({ code: "PRIVACY_CONSENT_REQUIRED" }, mode) });
      return;
    }
    if (mode === "reset" && (!resetToken || password !== confirmation)) {
      setNotice({ kind: "error", message: !resetToken ? "Geçerli bir şifre yenileme bağlantısı gerekli." : "Girdiğin şifreler aynı olmalı." });
      confirmationRef.current?.focus();
      return;
    }
    busyRef.current = true;
    setPending("submit");
    setNotice(null);

    try {
      if (mode === "signup") {
        const payload = { name: name.trim(), email: email.trim(), password, callbackURL: "/hesabim", privacyAccepted: true };
        const result = await authClient.signUp.email(payload);
        if (result.error) setNotice({ kind: "error", message: errorMessage(result.error, mode) });
        else if (result.data) {
          setPassword("");
          setNeedsVerification(true);
          setResendUntil(Date.now() + 60_000);
          setNotice({ kind: "success", message: "Kaydını tamamlamak için e-posta adresine gelen doğrulama bağlantısını aç. Daha önce üye olduysan giriş yapabilirsin." });
        } else setNotice({ kind: "error", message: errorMessage(null, mode) });
      } else if (mode === "signin") {
        const result = await authClient.signIn.email({ email: email.trim(), password, callbackURL: "/hesabim" });
        if (result.error) {
          setNeedsVerification(result.error.code === "EMAIL_NOT_VERIFIED");
          setNotice({ kind: "error", message: errorMessage(result.error, mode) });
        } else if (result.data) {
          router.replace("/hesabim");
          router.refresh();
        } else setNotice({ kind: "error", message: errorMessage(null, mode) });
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/sifre-yenile" });
        if (result.error) setNotice({ kind: "error", message: errorMessage(result.error, mode) });
        else if (result.data) setNotice({ kind: "success", message: "Bu adresle bir hesap varsa şifre yenileme bağlantısı gönderildi. Gelen kutunu ve spam klasörünü kontrol edebilirsin." });
        else setNotice({ kind: "error", message: errorMessage(null, mode) });
      } else {
        const result = await authClient.resetPassword({ newPassword: password, token: resetToken! });
        if (result.error) setNotice({ kind: "error", message: errorMessage(result.error, mode) });
        else if (result.data) {
          setPassword("");
          setConfirmation("");
          setResetComplete(true);
          setNotice({ kind: "success", message: "Şifren yenilendi. Yeni şifrenle giriş yapabilirsin." });
        } else setNotice({ kind: "error", message: errorMessage(null, mode) });
      }
    } catch {
      setNotice({ kind: "error", message: "Bağlantı kurulamadı. Biraz sonra yeniden deneyebilirsin." });
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  }

  async function resendVerification() {
    if (!available || !ready || busyRef.current || resendUntil || !emailRef.current?.reportValidity()) return;
    busyRef.current = true;
    setPending("resend");
    setResendUntil(Date.now() + 60_000);
    setNotice(null);
    try {
      const result = await authClient.sendVerificationEmail({ email: email.trim(), callbackURL: "/hesabim" });
      if (result.error) setNotice({ kind: "error", message: errorMessage(result.error, mode) });
      else if (result.data) setNotice({ kind: "success", message: "Bu adres doğrulama bekleyen bir hesaba aitse yeni bağlantı gönderildi. Gelen kutunu kontrol edebilirsin." });
      else setNotice({ kind: "error", message: errorMessage(null, mode) });
    } catch {
      setNotice({ kind: "error", message: "Bağlantı gönderilemedi. Biraz sonra yeniden deneyebilirsin." });
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  }

  const resetInvalid = mode === "reset" && (!resetToken || Boolean(initialError));
  const disabled = !available || !ready || pending !== null || resetInvalid || resetComplete;
  const selectedTab = tabs.find((tab) => tab.mode === mode);
  const labels = { signup: "Hesabını oluştur", signin: "Giriş yap", forgot: "Yenileme bağlantısı gönder", reset: "Şifremi yenile" } as const;

  return <>
    {mode !== "reset" && <div className="auth-tabs" role="tablist" aria-label="Üyelik işlemleri">
      {tabs.map((tab, index) => <button key={tab.mode} ref={(element) => { tabRefs.current[index] = element; }} type="button" role="tab" id={`${id}-tab-${tab.mode}`} aria-controls={`${id}-panel`} aria-selected={mode === tab.mode} tabIndex={mode === tab.mode ? 0 : -1} disabled={!ready || pending !== null} onClick={() => selectMode(tab.mode)} onKeyDown={(event) => moveTab(event, index)}>{tab.label}</button>)}
    </div>}
    <div id={`${id}-panel`} role={selectedTab ? "tabpanel" : undefined} aria-labelledby={selectedTab ? `${id}-tab-${selectedTab.mode}` : undefined}>
      {!available && <p className="auth-notice" role="status">Üyelik yakında açılıyor. Bu sırada yazılarımızı keşfedebilirsin.</p>}
      {mode === "forgot" && <p className="auth-description">Hesabında kullandığın e-posta adresine bir yenileme bağlantısı gönderelim.</p>}
      {resetInvalid && <p className="auth-notice">Bu bağlantı geçersiz veya süresi dolmuş. <Link href="/uyelik?sekme=sifremi-unuttum">Yeni bağlantı iste</Link></p>}
      <form className="auth-form" method="post" onSubmit={submit} aria-busy={pending !== null}>
        <fieldset disabled={disabled}>
          {mode === "signup" && <div className="auth-field"><label htmlFor={`${id}-name`}>Adın</label><input id={`${id}-name`} name="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={80} required /></div>}
          {mode !== "reset" && <div className="auth-field"><label htmlFor={`${id}-email`}>E-posta adresin</label><input ref={emailRef} id={`${id}-email`} name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete={mode === "signin" ? "username" : "email"} inputMode="email" maxLength={254} required /></div>}
          {mode !== "forgot" && <div className="auth-field"><label htmlFor={`${id}-password`}>{mode === "reset" ? "Yeni şifren" : "Şifren"}</label><input id={`${id}-password`} name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signin" ? undefined : 12} maxLength={128} required aria-describedby={mode === "signin" ? undefined : `${id}-password-help`} />{mode !== "signin" && <p className="auth-help" id={`${id}-password-help`}>12–128 karakter kullan.</p>}</div>}
          {mode === "reset" && <div className="auth-field"><label htmlFor={`${id}-confirmation`}>Yeni şifreni tekrar yaz</label><input ref={confirmationRef} id={`${id}-confirmation`} name="passwordConfirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required /></div>}
          {mode === "signup" && <label className="auth-consent" htmlFor={`${id}-privacy`}><input id={`${id}-privacy`} name="privacyAccepted" type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} required /><span><Link href="/gizlilik">Gizlilik bilgilendirmesini</Link> okudum ve bilgilerimin üyelik işlemleri için kullanılmasını kabul ediyorum.</span></label>}
          <button className="auth-submit" type="submit">{pending === "submit" ? "Lütfen bekle" : labels[mode]}<ArrowIcon direction="diagonal" /></button>
        </fieldset>
        <p id={`${id}-status`} className={`form-status${notice?.kind === "error" ? " form-status--error" : ""}`} role="status" aria-live="polite">{notice?.message ?? ""}</p>
      </form>
      {needsVerification && mode !== "reset" && <button className="understated-link auth-resend" type="button" disabled={!available || !ready || pending !== null || resendUntil > 0} onClick={resendVerification}>{pending === "resend" ? "Gönderiliyor" : resendUntil ? "Yeni bağlantı için biraz bekle" : "Doğrulama bağlantısını yeniden gönder"}<ArrowIcon direction="diagonal" /></button>}
      {resetComplete && <Link className="understated-link" href="/uyelik?sekme=giris">Giriş yap<ArrowIcon direction="diagonal" /></Link>}
      {mode === "signup" && <p className="auth-help">Üyelik bülten kaydı oluşturmaz. Mektuplarımıza ayrıca <Link href="/#katil">katılabilirsin</Link>.</p>}
      <noscript><p className="auth-notice">Güvenli üyelik işlemleri için tarayıcında JavaScript’i etkinleştir. <a href="mailto:gentlevie@gmail.com">gentlevie@gmail.com</a> adresinden bize ulaşabilirsin.</p></noscript>
    </div>
  </>;
}
