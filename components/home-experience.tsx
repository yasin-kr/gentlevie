"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { getArticleByKey, type ArticleKey } from "@/lib/articles";
import ArrowIcon, { type ArrowDirection } from "./arrow-icon";
import { useJourneyMotion } from "./home/use-journey-motion";

type HomeExperienceProps = { newsletter?: ReactNode; latestPosts?: ReactNode };

const navigation = [
  { href: "#style", label: "Style" },
  { href: "#living", label: "Living" },
  { href: "#journal", label: "Journal" },
  { href: "#hakkinda", label: "Hakkında" },
  { href: "#katil", label: "Katıl" },
] as const;

function articleHref(key: ArticleKey) {
  const article = getArticleByKey(key);
  if (!article) throw new Error(`Missing editorial article: ${key}`);
  return `/journal/${article.slug}`;
}

function RoundArrow({ direction = "diagonal" }: { direction?: ArrowDirection }) {
  return <span className="round-arrow" aria-hidden="true"><ArrowIcon direction={direction} /></span>;
}

function ImageArrow() {
  return <span className="image-arrow" aria-hidden="true"><ArrowIcon direction="diagonal" /></span>;
}

function isUnmodifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export default function HomeExperience({ newsletter, latestPosts }: HomeExperienceProps) {
  const { rootRef, journeyRef, stageRef, reduced, toggleMotion, goToScene } = useJourneyMotion();
  const router = useRouter();
  const menuRef = useRef<HTMLDialogElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const navigationFrameRef = useRef<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Preserve links shared before articles received their own pages.
    const followLegacyArticle = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#yazi=")) return;
      const article = getArticleByKey(hash.slice(6));
      if (article) router.replace(`/journal/${article.slug}`);
    };
    followLegacyArticle();
    window.addEventListener("hashchange", followLegacyArticle);
    return () => window.removeEventListener("hashchange", followLegacyArticle);
  }, [router]);

  useEffect(() => () => {
    if (navigationFrameRef.current !== null) cancelAnimationFrame(navigationFrameRef.current);
    document.body.classList.remove("dialog-open");
  }, []);

  const openMenu = useCallback(() => {
    const menu = menuRef.current;
    if (!menu || menu.open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    menu.showModal();
    setMenuOpen(true);
    document.body.classList.add("dialog-open");
    menuCloseRef.current?.focus();
  }, []);

  const closeMenu = useCallback(() => menuRef.current?.close(), []);

  const onMenuClose = useCallback(() => {
    setMenuOpen(false);
    document.body.classList.remove("dialog-open");
    const previousFocus = returnFocusRef.current;
    returnFocusRef.current = null;
    previousFocus?.focus({ preventScroll: true });
  }, []);

  function navigateToSection(event: MouseEvent<HTMLAnchorElement>) {
    if (!isUnmodifiedClick(event)) return;
    const hash = event.currentTarget.hash;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    event.preventDefault();
    returnFocusRef.current = null;
    if (menuRef.current?.open) menuRef.current.close();
    if (navigationFrameRef.current !== null) cancelAnimationFrame(navigationFrameRef.current);
    navigationFrameRef.current = requestAnimationFrame(() => {
      navigationFrameRef.current = null;
      window.history.replaceState(window.history.state, "", hash);
      if (hash === "#baslangic") {
        goToScene(0, true);
        return;
      }
      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
      const focusTarget = target.querySelector<HTMLElement>(".story-open, h1, h2") ?? target;
      if (!focusTarget.matches("a, button, input, textarea, select")) focusTarget.tabIndex = -1;
      focusTarget.focus({ preventScroll: true });
    });
  }

  function discoverStory(event: MouseEvent<HTMLAnchorElement>) {
    if (!isUnmodifiedClick(event)) return;
    event.preventDefault();
    window.history.replaceState(window.history.state, "", "#scene-1");
    goToScene(1, true);
  }

  return (
    <div ref={rootRef} className="home-experience is-reduced">
      <a className="skip-link" href="#journal" onClick={navigateToSection}>Yazılara geç</a>

      <header className="site-header" id="site-header">
        <a href="#baslangic" className="wordmark" aria-label="GentleVie ana sayfa" onClick={navigateToSection}>gentle vie</a>
        <span className="header-motto">THE ART OF LIVING WELL</span>
        <button className="menu-toggle" id="menu-toggle" type="button" aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls="site-menu" onClick={openMenu}>
          <span>Keşfet</span><span className="menu-icon" aria-hidden="true"><i /><i /></span>
        </button>
      </header>

      <main>
        <section ref={journeyRef} className="journey" id="baslangic" aria-label="Yavaşlığın estetiği">
          <div ref={stageRef} className="stage">
            <article className="scene scene--hero" id="scene-0">
              <div className="scene__visual">
                <img src="/assets/hero.webp" width="1536" height="1024" fetchPriority="high" alt="Masmavi denize açılan traverten kemer, keten kumaş ve havada asılı altın küre." />
                <p className="hero-note">DAHA AZ GÜRÜLTÜ<br />DAHA ÇOK HİS</p>
              </div>
              <div className="scene__shade" />
              <div className="scene__copy hero-copy">
                <p className="eyebrow hero-eyebrow">LIFE <span>YAVAŞLIĞIN ESTETİĞİ</span></p>
                <h1>Hayatı biraz<br /><em>yavaşlat</em></h1>
                <p className="scene__intro">Bir doku. Bir ışık. Bir his<br />Güzel yaşamak, küçük şeyleri fark etmekle başlar</p>
                <a className="text-link" href="#scene-1" onClick={discoverStory}>Hikâyeyi keşfet <RoundArrow /></a>
              </div>
            </article>

            <article className="scene scene--ritual" id="scene-1">
              <div className="scene__visual"><img src="/assets/ritual.webp" width="1536" height="1024" alt="Güneşli taş yüzeyde seramik bir fincan, keten ve altın küre." /></div>
              <div className="scene__shade" />
              <div className="scene__copy ritual-copy">
                <p className="eyebrow">LIVING <span>—</span> GÜNDELİK RİTÜELLER</p>
                <h2>Güzel olan,<br /><em>ayrıntıda</em></h2>
                <p className="scene__intro">Sabah ışığının düştüğü bir masa<br />Sevdiğin fincanın tanıdık dokusu<br />Kendine ayırdığın birkaç dakika</p>
                <Link className="text-link" href={articleHref("living")}>Bir sabaha eşlik et <RoundArrow /></Link>
              </div>
            </article>

            <article className="scene scene--horizon" id="scene-2">
              <div className="scene__visual"><img src="/assets/hero.webp" width="1536" height="1024" alt="" /></div>
              <div className="scene__shade" />
              <div className="scene__copy horizon-copy">
                <p className="eyebrow">SANA AİT BİR BAKIŞ</p>
                <h2>Biraz daha az<br /><em>Biraz daha sen</em></h2>
                <p className="scene__intro">Stil, yaşam ve küçük keşifler üzerine</p>
                <a href="#journal" className="text-link" onClick={navigateToSection}>İlk sayıyı aç <RoundArrow direction="down" /></a>
              </div>
            </article>

            <div className="stage-footer">
              <span className="scroll-cue"><ArrowIcon direction="down" /> AŞAĞI KAYDIR</span>
              <div className="scene-nav" role="group" aria-label="Görsel bölümler">
                <button type="button" data-scene="0" className="is-active" aria-label="Birinci sahne: Yavaşla" aria-current="step" onClick={() => goToScene(0)}>01</button>
                <span className="scene-track" aria-hidden="true"><i /></span>
                <button type="button" data-scene="1" aria-label="İkinci sahne: Fark et" onClick={() => goToScene(1)}>02</button>
                <span className="scene-track" aria-hidden="true"><i /></span>
                <button type="button" data-scene="2" aria-label="Üçüncü sahne: Kendin ol" onClick={() => goToScene(2)}>03</button>
              </div>
              <span className="stage-caption">YAVAŞLA &nbsp; / &nbsp; FARK ET &nbsp; / &nbsp; KENDİN OL</span>
            </div>
            <div className="journey-progress" aria-hidden="true"><i /></div>
          </div>
        </section>

        <section className="journal section-shell" id="journal" aria-labelledby="journal-title">
          <div className="section-topline"><p className="eyebrow">GENTLEVIE JOURNAL</p><p className="eyebrow">SAYI 01 / BİR BAŞLANGIÇ</p></div>
          <div className="journal-intro" data-reveal="">
            <h2 id="journal-title">Biraz daha<br /><em>yakından</em></h2>
            <div><p>Üzerine düşündüğümüz şeyler<br />Dokular, mekânlar ve arada kalan anlar</p><a className="understated-link" href="#stories" onClick={navigateToSection}>Bu sayıda <ArrowIcon direction="down-left" /></a></div>
          </div>
          <div className="stories" id="stories">
            <article className="story story--style" id="style" data-reveal="">
              <Link className="story-open" href={articleHref("style")} aria-label="Az parçayla, kendin gibi yazısını oku">
                <span className="story-image story-image--style"><img src="/assets/style.webp" width="1536" height="1024" loading="lazy" alt="Ceviz sandalye üzerine bırakılmış fildişi keten ceket." /><ImageArrow /></span>
                <span className="story-meta"><span>STYLE</span><span>2 DK OKUMA</span></span>
                <h3>Az parçayla,<br /><em>kendin gibi</em></h3>
              </Link>
              <p>Renklerin, dokuların ve sana ait bir stilin peşinde</p>
            </article>

            <article className="story story--living" id="living" data-reveal="">
              <Link className="story-open" href={articleHref("living")} aria-label="Bir sabahın küçük ritüelleri yazısını oku">
                <span className="story-image story-image--living"><img src="/assets/ritual.webp" width="1536" height="1024" loading="lazy" alt="Taş bir yüzey üzerindeki seramik kahve fincanı ve keten." /><ImageArrow /></span>
                <span className="story-meta"><span>LIVING</span><span>2 DK OKUMA</span></span>
                <h3>Bir sabahın<br /><em>küçük ritüelleri</em></h3>
              </Link>
              <p>Güne başlamadan önce, kendine ayırdığın o kısa an</p>
            </article>

            <article className="story story--journal" id="journal-story" data-reveal="">
              <Link className="story-open" href={articleHref("journal")} aria-label="Bir yere yetişmeden yazısını oku">
                <span className="story-image story-image--journal"><img src="/assets/hero.webp" width="1536" height="1024" loading="lazy" alt="Mavi gökyüzüne ve denize açılan taş basamaklar." /><ImageArrow /></span>
                <span className="story-text">
                  <span className="story-meta"><span>JOURNAL</span><span>2 DK OKUMA</span></span>
                  <h3>Bir yere<br /><em>yetişmeden</em></h3>
                  <span className="story-summary">Bir öğleden sonra. Birkaç yeni ayrıntı<br />Hiçbir yere acele etmeden</span>
                  <span className="understated-link">Yazıyı oku <ArrowIcon direction="diagonal" /></span>
                </span>
              </Link>
            </article>
          </div>
          {latestPosts}
        </section>

        <section className="about section-shell" id="hakkinda" aria-labelledby="about-title">
          <p className="eyebrow" data-reveal="">GENTLEVIE ÜZERİNE</p>
          <div className="about-layout" data-reveal="">
            <h2 id="about-title">İyi yaşamak,<br />önce <em>fark etmek</em></h2>
            <div className="about-copy">
              <img className="little-sun" src="/assets/sun.svg" width="48" height="48" alt="" aria-hidden="true" />
              <p>GentleVie, stil ve yaşam üzerine bağımsız bir editoryal bakış. İyi hissettiren bir kumaşın, yaşanmış bir mekânın, hatırlamaya değer bir anın peşinde.</p>
              <p>Kendi ritmini bulmak için bazen yalnızca biraz durmak yeter. Burada o duraklara yer açıyoruz.</p>
              <span className="signature">The art of living well</span>
            </div>
          </div>
        </section>

        {newsletter}
      </main>

      <footer className="site-footer section-shell">
        <div className="footer-top"><p>Hayata biraz<br /><em>daha yakından</em></p><a href="#baslangic" className="back-top" aria-label="Sayfanın başına dön" onClick={navigateToSection}><ArrowIcon direction="up" /></a></div>
        <nav className="footer-nav" aria-label="Alt menü">
          {navigation.map(({ href, label }) => <a key={href} href={href} onClick={navigateToSection}>{label}</a>)}
          <Link href="/uyelik">Üyelik</Link>
          <Link href="/gizlilik">Gizlilik</Link>
        </nav>
        <span className="footer-wordmark" aria-hidden="true">gentle vie</span>
        <div className="footer-bottom">
          <span>© 2026 GENTLEVIE</span><span>THE ART OF LIVING WELL</span>
          <button id="motion-toggle" type="button" aria-pressed={reduced} onClick={toggleMotion}><span id="motion-label">{reduced ? "Hareketi aç" : "Hareketi azalt"}</span> <ArrowIcon direction="diagonal" /></button>
        </div>
      </footer>

      <dialog ref={menuRef} className="menu-dialog" id="site-menu" aria-label="Ana menü" onClose={onMenuClose}>
        <div className="menu-inner">
          <div className="dialog-top">
            <span className="wordmark">gentle vie</span>
            <button ref={menuCloseRef} className="close-button menu-close-button" id="menu-close" type="button" aria-label="Menüyü kapat" onClick={closeMenu}><span aria-hidden="true">×</span></button>
          </div>
          <div className="menu-content">
            <div><nav aria-label="Ana menü">{navigation.map(({ href, label }) => <a key={href} href={href} onClick={navigateToSection}>{label}<ArrowIcon direction="diagonal" className="menu-arrow" size={32} /></a>)}<Link href="/uyelik" onClick={closeMenu}>Üyelik<ArrowIcon direction="diagonal" className="menu-arrow" size={32} /></Link></nav></div>
            <div className="menu-picture"><img src="/assets/hero.webp" width="1536" height="1024" alt="Denize açılan traverten kemer." /><p>Güzel şeylere<br /><em>biraz yer aç</em></p></div>
          </div>
          <div className="menu-bottom"><span>THE ART OF LIVING WELL</span></div>
        </div>
      </dialog>

      <noscript><style>{".menu-toggle,#motion-toggle{display:none}"}</style></noscript>
    </div>
  );
}
