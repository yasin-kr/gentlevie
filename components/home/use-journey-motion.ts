"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SceneIndex = 0 | 1 | 2;
type MotionControls = {
  setMotion: (value: boolean, persist?: boolean) => void;
  goToScene: (index: SceneIndex, focusHeading?: boolean) => void;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const range = (progress: number, start: number, end: number) => clamp((progress - start) / (end - start));
const smooth = (value: number) => value * value * (3 - 2 * value);

export function useJourneyMotion() {
  const rootRef = useRef<HTMLDivElement>(null);
  const journeyRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<MotionControls | null>(null);
  const reducedRef = useRef(true);
  // The server and first client render share a static, fully readable layout.
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const root = rootRef.current;
    const journey = journeyRef.current;
    const stage = stageRef.current;
    if (!root || !journey || !stage) return;

    const scenes = Array.from(stage.querySelectorAll<HTMLElement>(".scene"));
    const copies = Array.from(stage.querySelectorAll<HTMLElement>(".scene__copy"));
    const navigation = Array.from(stage.querySelectorAll<HTMLButtonElement>(".scene-nav button"));
    const note = stage.querySelector<HTMLElement>(".hero-note");
    const [heroCopy, ritualCopy, horizonCopy] = copies;
    const [, ritualScene, horizonScene] = scenes;
    if (!heroCopy || !ritualCopy || !horizonCopy || !ritualScene || !horizonScene) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    const previousTheme = document.body.dataset.theme;
    const previousReducedClass = document.documentElement.classList.contains("is-reduced");
    let storedMotion: string | null = null;
    try { storedMotion = localStorage.getItem("gentlevie-motion"); } catch { /* Storage is optional. */ }
    let motionOverride = storedMotion === "full" || storedMotion === "reduced";
    let activeScene = -1;
    let frame = 0;
    let initialAnchorFrame = 0;
    let disposed = false;
    let pendingFocus: SceneIndex | null = null;

    function focusScene(index: SceneIndex) {
      const heading = copies[index]?.querySelector<HTMLElement>("h1, h2");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }

    function updateSceneAccessibility(index: number) {
      if (activeScene === index) return;
      activeScene = index;
      scenes.forEach((scene, sceneIndex) => {
        const hidden = !reducedRef.current && sceneIndex !== index;
        scene.setAttribute("aria-hidden", String(hidden));
        scene.inert = hidden;
      });
      navigation.forEach((button, sceneIndex) => {
        button.classList.toggle("is-active", sceneIndex === index);
        if (sceneIndex === index) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
      });
    }

    function draw() {
      frame = 0;
      if (disposed) return;
      const bounds = journey!.getBoundingClientRect();
      const height = stage!.clientHeight;
      let theme = "dark";

      if (reducedRef.current) {
        const visible = scenes.findIndex((scene) => {
          const rect = scene.getBoundingClientRect();
          return rect.top <= 90 && rect.bottom > 90;
        });
        if (visible >= 0) theme = visible === 1 ? "warm" : "light";
        copies.forEach((copy) => { copy.inert = false; });
        updateSceneAccessibility(Math.max(0, visible));
        stage!.classList.remove("is-warm");
      } else {
        const progress = clamp(-bounds.top / Math.max(1, bounds.height - height));
        const firstFade = smooth(range(progress, .13, .24));
        const reveal = smooth(range(progress, .18, .4));
        const secondIn = smooth(range(progress, .34, .45));
        const secondOut = smooth(range(progress, .62, .72));
        const finalReveal = smooth(range(progress, .67, .86));
        const finalIn = smooth(range(progress, .81, .92));
        stage!.style.setProperty("--p", progress.toFixed(4));
        stage!.style.setProperty("--s0", (1.035 + progress * .24).toFixed(4));
        stage!.style.setProperty("--s1", (1.1 - range(progress, .25, .75) * .07).toFixed(4));
        stage!.style.setProperty("--s2", (1.18 - range(progress, .7, 1) * .12).toFixed(4));
        heroCopy!.style.opacity = String(1 - firstFade);
        heroCopy!.inert = firstFade > .85;
        heroCopy!.style.transform = `translateY(calc(-45% - ${firstFade * 28}px))`;
        if (note) note.style.opacity = String(1 - firstFade);
        ritualScene!.style.clipPath = `circle(${(reveal * 130).toFixed(3)}% at 77% 47%)`;
        ritualCopy!.style.opacity = String(secondIn * (1 - secondOut));
        ritualCopy!.inert = secondIn * (1 - secondOut) < .15;
        ritualCopy!.style.transform = `translateY(calc(-45% + ${(1 - secondIn) * 32 - secondOut * 22}px))`;
        horizonScene!.style.clipPath = `inset(${((1 - finalReveal) * 100).toFixed(3)}% 0 0 0)`;
        horizonCopy!.style.opacity = String(finalIn);
        horizonCopy!.inert = finalIn < .15;
        horizonCopy!.style.transform = `translateY(calc(-45% + ${(1 - finalIn) * 32}px))`;
        const index = progress < .3 ? 0 : progress < .78 ? 1 : 2;
        updateSceneAccessibility(index);
        stage!.classList.toggle("is-warm", index === 1);
        if (bounds.bottom > height * .45) theme = progress > .32 && progress < .82 ? "warm" : "light";
        if (pendingFocus !== null && pendingFocus === index && !copies[index]?.inert && Number(copies[index]?.style.opacity) > .9) {
          focusScene(pendingFocus);
          pendingFocus = null;
        }
      }
      if (document.body.dataset.theme !== theme) document.body.dataset.theme = theme;
    }

    function requestDraw() {
      if (!disposed && !frame) frame = requestAnimationFrame(draw);
    }

    function setMotion(value: boolean, persist = false) {
      reducedRef.current = value;
      root!.classList.toggle("is-reduced", value);
      document.documentElement.classList.toggle("is-reduced", value);
      stage!.style.setProperty("--pan-x", "0");
      stage!.style.setProperty("--pan-y", "0");
      setReduced(value);
      activeScene = -1;
      if (persist) {
        motionOverride = true;
        try { localStorage.setItem("gentlevie-motion", value ? "reduced" : "full"); } catch { /* Storage is optional. */ }
      }
      requestDraw();
    }

    function goToScene(index: SceneIndex, focusHeading = false) {
      if (reducedRef.current) {
        scenes[index]?.scrollIntoView({ behavior: "auto" });
        if (focusHeading) focusScene(index);
        return;
      }
      pendingFocus = focusHeading ? index : null;
      const points = [0, .51, .96] as const;
      const top = journey!.getBoundingClientRect().top + window.scrollY + (journey!.clientHeight - stage!.clientHeight) * points[index];
      window.scrollTo({ top, behavior: "smooth" });
      requestDraw();
    }

    const onPreferenceChange = (event: MediaQueryListEvent) => { if (!motionOverride) setMotion(event.matches); };
    const onPointerMove = (event: PointerEvent) => {
      if (reducedRef.current || !finePointer.matches) return;
      const bounds = stage.getBoundingClientRect();
      stage.style.setProperty("--pan-x", (((event.clientX - bounds.left) / bounds.width - .5) * -10).toFixed(2));
      stage.style.setProperty("--pan-y", (((event.clientY - bounds.top) / bounds.height - .5) * -7).toFixed(2));
    };
    const onPointerLeave = () => {
      stage.style.setProperty("--pan-x", "0");
      stage.style.setProperty("--pan-y", "0");
    };

    controlsRef.current = { setMotion, goToScene };
    setMotion(motionOverride ? storedMotion === "reduced" : preference.matches);
    // Router/browser hash scrolling can run while the SSR layout is still stacked.
    // Align known destinations once after the final motion layout has been applied.
    const initialHash = window.location.hash;
    const knownAnchors = new Set(["#baslangic", "#scene-0", "#scene-1", "#scene-2", "#journal", "#stories", "#style", "#living", "#journal-story", "#hakkinda", "#katil"]);
    if (knownAnchors.has(initialHash)) {
      initialAnchorFrame = requestAnimationFrame(() => {
        initialAnchorFrame = 0;
        if (disposed || window.location.hash !== initialHash) return;
        const target = root.querySelector<HTMLElement>(initialHash);
        if (!target) return;
        const sceneMatch = /^#scene-([012])$/.exec(initialHash);
        if (sceneMatch && !reducedRef.current) {
          const index = Number(sceneMatch[1]) as SceneIndex;
          const points = [0, .51, .96] as const;
          window.scrollTo({ top: journey.getBoundingClientRect().top + window.scrollY + (journey.clientHeight - stage.clientHeight) * points[index], behavior: "instant" });
          draw();
          focusScene(index);
        } else {
          target.scrollIntoView({ behavior: "instant" });
          draw();
          const focusTarget = target.querySelector<HTMLElement>(".story-open, h1, h2") ?? target;
          if (!focusTarget.matches("a, button, input, textarea, select")) focusTarget.tabIndex = -1;
          focusTarget.focus({ preventScroll: true });
        }
      });
    }
    preference.addEventListener("change", onPreferenceChange);
    window.addEventListener("scroll", requestDraw, { passive: true });
    window.addEventListener("resize", requestDraw, { passive: true });
    window.addEventListener("pageshow", requestDraw);
    stage.addEventListener("pointermove", onPointerMove, { passive: true });
    stage.addEventListener("pointerleave", onPointerLeave);
    void document.fonts.ready.then(requestDraw);

    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      root.classList.add("is-animated");
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer?.unobserve(entry.target);
          }
        });
      }, { threshold: .07 });
      root.querySelectorAll("[data-reveal]").forEach((element) => observer?.observe(element));
    }

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      if (initialAnchorFrame) cancelAnimationFrame(initialAnchorFrame);
      controlsRef.current = null;
      observer?.disconnect();
      root.classList.remove("is-animated");
      preference.removeEventListener("change", onPreferenceChange);
      window.removeEventListener("scroll", requestDraw);
      window.removeEventListener("resize", requestDraw);
      window.removeEventListener("pageshow", requestDraw);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerleave", onPointerLeave);
      document.documentElement.classList.toggle("is-reduced", previousReducedClass);
      if (previousTheme === undefined) delete document.body.dataset.theme;
      else document.body.dataset.theme = previousTheme;
    };
  }, []);

  const toggleMotion = useCallback(() => controlsRef.current?.setMotion(!reducedRef.current, true), []);
  const goToScene = useCallback((index: SceneIndex, focusHeading = false) => controlsRef.current?.goToScene(index, focusHeading), []);

  return { rootRef, journeyRef, stageRef, reduced, toggleMotion, goToScene };
}
