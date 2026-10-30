"use client";

import { Lottie } from "lottie-react";
import { useCallback, useEffect, useState } from "react";
import bubbles from "../../../public/lottie/bubbles.json";

// Splash intro: seabed background, bubble animation, logo scale-in, light rays, flash, fade.
// Rendered from the first server paint so the HQ never shows before it. Shown once per browser
// session. Skipped with reduced motion. Skip, Escape, or Enter ends it.
const SEEN_KEY = "aquahab.intro.seen";
const DURATION_MS = 3400;
const FADE_MS = 500;

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false; // storage blocked: show the intro, it is not critical
  }
}

export function Intro() {
  const [show, setShow] = useState(true);
  const [leaving, setLeaving] = useState(false);

  const finish = useCallback(() => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore: the intro will simply show again next session
    }
    setShow(false);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (alreadySeen() || reduced) {
      // Hide in a timer, not synchronously, so the effect does not trigger a render cascade.
      const hide = window.setTimeout(() => setShow(false), 0);
      return () => window.clearTimeout(hide);
    }
    const fade = window.setTimeout(() => setLeaving(true), DURATION_MS - FADE_MS);
    const end = window.setTimeout(finish, DURATION_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(end);
      window.removeEventListener("keydown", onKey);
    };
  }, [finish]);

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Aquahab intro"
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-deep transition-opacity ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="intro-bg absolute inset-0 bg-[url(/backgrounds/seabed.webp)] bg-cover bg-center" aria-hidden="true" />
      <div className="intro-rays absolute inset-0" aria-hidden="true" />
      <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 opacity-40" aria-hidden="true">
        <div className="intro-bubbles h-full w-full">
          <Lottie src={bubbles} loop autoplay style={{ width: "100%", height: "100%" }} />
        </div>
      </div>
      <h1 className="intro-logo relative text-5xl font-semibold tracking-tight text-fg">Aquahab</h1>
      <div className="intro-flash absolute inset-0 bg-[#5ee7f0]" aria-hidden="true" />
      <button
        type="button"
        onClick={finish}
        className="absolute right-4 top-4 rounded-md border border-line bg-surface/80 px-3 py-1.5 text-sm text-fg-2 focus-visible:outline-focus"
      >
        Skip
      </button>
    </div>
  );
}
