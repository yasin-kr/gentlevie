(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const range = (p, a, b) => clamp((p - a) / (b - a));
  const smooth = v => v * v * (3 - 2 * v);
  const journey = $('.journey');
  const stage = $('.stage');
  const scenes = $$('.scene');
  const copies = $$('.scene__copy');
  const menu = $('#site-menu');
  const articleDialog = $('#article-dialog');
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let savedMotion = null;
  try { savedMotion = localStorage.getItem('gentlevie-motion'); } catch (_) {}
  let reduced = savedMotion ? savedMotion === 'reduced' : motionPreference.matches;
  let activeScene = -1;
  let rafPending = false;
  let currentArticle = null;
  let returnHash = '';
  let previousFocus = null;
  let menuFocus = null;
  let enteredByArticleLink = false;
  let articleReturnTarget = null;
  let motionOverride = savedMotion !== null;

  function setSceneAccessibility(index) {
    if (activeScene === index) return;
    activeScene = index;
    scenes.forEach((scene, i) => {
      scene.setAttribute('aria-hidden', String(!reduced && i !== index));
      scene.inert = !reduced && i !== index;
    });
    $$('.scene-nav button').forEach((button, i) => {
      button.classList.toggle('is-active', i === index);
      if (i === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }

  function draw() {
    rafPending = false;
    const rect = journey.getBoundingClientRect();
    const height = stage.clientHeight;
    let theme = 'dark';
    if (reduced) {
      const visible = scenes.findIndex(scene => {
        const bounds = scene.getBoundingClientRect();
        return bounds.top <= 90 && bounds.bottom > 90;
      });
      if (visible >= 0) theme = visible === 1 ? 'warm' : 'light';
      copies.forEach(copy => { copy.inert = false; });
      setSceneAccessibility(visible < 0 ? 0 : visible);
    } else {
      const p = clamp(-rect.top / Math.max(1, rect.height - height));
      const firstFade = smooth(range(p, .13, .24));
      const reveal = smooth(range(p, .18, .4));
      const secondIn = smooth(range(p, .34, .45));
      const secondOut = smooth(range(p, .62, .72));
      const finalReveal = smooth(range(p, .67, .86));
      const finalIn = smooth(range(p, .81, .92));
      stage.style.setProperty('--p', p.toFixed(4));
      stage.style.setProperty('--s0', (1.035 + p * .24).toFixed(4));
      stage.style.setProperty('--s1', (1.1 - range(p, .25, .75) * .07).toFixed(4));
      stage.style.setProperty('--s2', (1.18 - range(p, .7, 1) * .12).toFixed(4));
      copies[0].style.opacity = String(1 - firstFade);
      copies[0].inert = firstFade > .85;
      copies[0].style.transform = `translateY(calc(-45% - ${firstFade * 28}px))`;
      $('.hero-note').style.opacity = String(1 - firstFade);
      scenes[1].style.clipPath = `circle(${(reveal * 130).toFixed(3)}% at 77% 47%)`;
      copies[1].style.opacity = String(secondIn * (1 - secondOut));
      copies[1].inert = secondIn * (1 - secondOut) < .15;
      copies[1].style.transform = `translateY(calc(-45% + ${(1 - secondIn) * 32 - secondOut * 22}px))`;
      scenes[2].style.clipPath = `inset(${((1 - finalReveal) * 100).toFixed(3)}% 0 0 0)`;
      copies[2].style.opacity = String(finalIn);
      copies[2].inert = finalIn < .15;
      copies[2].style.transform = `translateY(calc(-45% + ${(1 - finalIn) * 32}px))`;
      const index = p < .3 ? 0 : p < .78 ? 1 : 2;
      setSceneAccessibility(index);
      stage.classList.toggle('is-warm', index === 1);
      if (rect.bottom > height * .45) theme = p > .32 && p < .82 ? 'warm' : 'light';
    }
    if (document.body.dataset.theme !== theme) document.body.dataset.theme = theme;
  }
  function requestDraw() {
    if (!rafPending) { rafPending = true; requestAnimationFrame(draw); }
  }

  function setMotion(value, persist = false) {
    reduced = value;
    document.documentElement.classList.toggle('is-reduced', reduced);
    const button = $('#motion-toggle');
    button.setAttribute('aria-pressed', String(reduced));
    $('#motion-label').textContent = reduced ? 'Hareketi aç' : 'Hareketi azalt';
    activeScene = -1;
    if (persist) {
      motionOverride = true;
      try { localStorage.setItem('gentlevie-motion', reduced ? 'reduced' : 'full'); } catch (_) {}
    }
    draw();
  }
  setMotion(reduced);
  $('#motion-toggle').addEventListener('click', () => setMotion(!reduced, true));
  motionPreference.addEventListener('change', e => { if (!motionOverride) setMotion(e.matches); });
  addEventListener('scroll', requestDraw, { passive: true });
  addEventListener('resize', requestDraw, { passive: true });
  addEventListener('pageshow', requestDraw);
  document.fonts?.ready.then(requestDraw);

  $$('[data-scene]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.scene);
    if (reduced) {
      scenes[index].scrollIntoView({ behavior: 'auto' });
      return;
    }
    const points = [0, .51, .96];
    const top = journey.getBoundingClientRect().top + scrollY + (journey.clientHeight - stage.clientHeight) * points[index];
    window.scrollTo({ top, behavior: 'smooth' });
  }));
  if (matchMedia('(pointer: fine)').matches) {
    stage.addEventListener('pointermove', event => {
      if (reduced) return;
      const bounds = stage.getBoundingClientRect();
      stage.style.setProperty('--pan-x', ((event.clientX / bounds.width - .5) * -10).toFixed(2));
      stage.style.setProperty('--pan-y', (((event.clientY - bounds.top) / bounds.height - .5) * -7).toFixed(2));
    }, { passive: true });
    stage.addEventListener('pointerleave', () => {
      stage.style.setProperty('--pan-x', '0');
      stage.style.setProperty('--pan-y', '0');
    });
  }

  function syncLock() {
    document.body.classList.toggle('dialog-open', menu.open || articleDialog.open);
  }
  $('#menu-toggle').addEventListener('click', () => {
    menuFocus = document.activeElement;
    menu.showModal();
    $('#menu-toggle').setAttribute('aria-expanded', 'true');
    syncLock();
    $('#menu-close').focus();
  });
  $('#menu-close').addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => {
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
    syncLock();
    menuFocus?.focus({ preventScroll: true });
  });
  $$('nav a', menu).forEach(link => link.addEventListener('click', event => {
    const target = $(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    menuFocus = null;
    menu.close();
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      history.replaceState(null, '', link.getAttribute('href'));
      const focusTarget = target.querySelector('.story-open, h2') || target;
      if (!focusTarget.matches('a, button')) focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    });
  }));

  const articles = window.GENTLEVIE_ARTICLES || {};
  const articleKeys = Object.keys(articles);
  function renderArticle(key) {
    const article = articles[key];
    if (!article) return false;
    currentArticle = key;
    $('#article-title').textContent = article.title;
    $('#article-category').textContent = `${article.category.toUpperCase()} / ${article.readTime.toUpperCase()}`;
    $('#article-number').textContent = article.number;
    $('#article-subtitle').textContent = article.subtitle;
    $('#article-image').src = article.image;
    $('#article-image').alt = article.imageAlt;
    $('#article-paragraphs').replaceChildren(...article.paragraphs.map(text => {
      const p = document.createElement('p'); p.textContent = text; return p;
    }));
    $('#share-status').textContent = '';
    const next = articleKeys[(articleKeys.indexOf(key) + 1) % articleKeys.length];
    $('#next-article').dataset.article = next;
    $('#next-article-title').textContent = articles[next].title;
    $('#article-scroll').scrollTop = 0;
    return true;
  }
  function openArticle(key, updateHash = true) {
    if (!articles[key]) return;
    if (!articleDialog.open) {
      previousFocus = document.activeElement;
      enteredByArticleLink = location.hash.startsWith('#yazi=');
      returnHash = location.hash.startsWith('#yazi=') ? '#journal' : location.hash;
    }
    renderArticle(key);
    if (!articleDialog.open) articleDialog.showModal();
    syncLock();
    if (updateHash) history.pushState({ article: key }, '', `#yazi=${key}`);
    $('#article-title').focus({ preventScroll: true });
  }
  function closeArticle() { articleDialog.close(); }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-article]');
    if (button) openArticle(button.dataset.article);
  });
  $('#article-close').addEventListener('click', closeArticle);
  $('#article-home').addEventListener('click', event => { event.preventDefault(); articleReturnTarget = '#journal'; closeArticle(); });
  articleDialog.addEventListener('click', event => {
    if (event.target !== articleDialog) return;
    const rect = articleDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeArticle();
  });
  articleDialog.addEventListener('close', () => {
    syncLock();
    if (location.hash.startsWith('#yazi=')) history.replaceState(null, '', location.pathname + location.search + returnHash);
    currentArticle = null;
    const destination = articleReturnTarget || (enteredByArticleLink ? '#journal' : null);
    articleReturnTarget = null;
    enteredByArticleLink = false;
    if (destination) {
      const target = $(destination);
      history.replaceState(null, '', destination);
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
        const heading = target.querySelector('h2') || target;
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      });
    } else previousFocus?.focus({ preventScroll: true });
  });
  function handleLocation() {
    const key = location.hash.startsWith('#yazi=') ? location.hash.slice(6) : null;
    if (key && articles[key]) openArticle(key, false);
    else if (articleDialog.open) articleDialog.close();
  }
  addEventListener('popstate', handleLocation);
  addEventListener('hashchange', handleLocation);
  handleLocation();
  $('#share-article').addEventListener('click', async () => {
    const url = new URL(location.href);
    url.hash = `yazi=${currentArticle}`;
    try {
      await navigator.clipboard.writeText(url.href);
      $('#share-status').textContent = 'Yazının bağlantısı kopyalandı.';
    } catch (_) {
      $('#share-status').textContent = `Bağlantı: ${url.href}`;
    }
  });

  if ('IntersectionObserver' in window) {
    document.documentElement.classList.add('is-animated');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .07 });
    $$('[data-reveal]').forEach(element => observer.observe(element));
  }
})();
