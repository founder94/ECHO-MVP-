"use client";

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis-flora";

import { subscribeToTicker } from "@flora/lib/animation/ticker";
import { useScroll } from "@flora/hooks/smooth-scroll/use-scroll";
import { scrollTo } from "@flora/utils/scroll-to";
import { useShallow } from "zustand/react/shallow";

export const scrollSpeed = { current: 1 };

export function ScrollLayout({ children }: { children: React.ReactNode }) {
  // Server-safe rendering
  return (
    <div className="scroll-layout">
      {/* Static content that can be rendered on server */}
      <div className="scroll-layout-content">{children}</div>

      {/* Client-only functionality */}
      <ScrollController />
    </div>
  );
}

function ScrollController() {
  const isEnableScroll = useScroll((state) => state.isEnableScroll);
  const [hash, setHash] = useState<string>("");
  const [lenis, setLenis] = useScroll(
    useShallow((state) => [state.lenis, state.setLenis]),
  );
  const pathname = typeof window === "undefined" ? "" : window.location.pathname + window.location.hash;
  const savedPathname = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.hash) window.scrollTo(0, 0);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = new Lenis({
      smoothWheel: !reduced,
      // Lenis's default is a 1.2 s duration curve, which arrives in a rush and
      // then crawls to a stop. A lerp is a continuous approach instead: every
      // frame closes this fraction of the remaining distance, so a long flick
      // and a single notch of the wheel feel the same. Lower is heavier.
      lerp: 0.075,
      wheelMultiplier: 0.9,
      // Touch stays native: the OS momentum is what a phone user expects, and
      // syncing it fights their thumb.
      syncTouch: false,
    });
    (window as typeof window & { lenis: Lenis }).lenis = lenis;
    setLenis(lenis);

    // Lenis drives off the app-wide ticker rather than a loop of its own: a
    // page that carries a scene was running two forever-rAFs side by side, and
    // one loop with two subscribers is the whole point of having a ticker
    // (optimize-3d-scene §4). Every tick, never throttled — the scroll is the
    // one thing that must not be sampled at half rate.
    const untick = subscribeToTicker(
      (time) => lenis.raf(time),
      () => 0,
    );

    return () => {
      // Leave the loop before destroying Lenis — otherwise the ticker keeps
      // calling `raf` on a destroyed instance after unmount/HMR.
      untick();
      lenis.destroy();
      setLenis(null);
    };
  }, [setLenis]);

  useEffect(() => {
    if (isEnableScroll) {
      lenis?.start();
      enableNativeScroll(true);
    } else {
      lenis?.stop();
      enableNativeScroll(false);
    }
  }, [isEnableScroll, lenis]);

  useEffect(() => {
    if (lenis && hash) {
      setTimeout(() => {
        scrollTo(hash, true);
      }, 300);
    }
  }, [lenis, hash]);

  useEffect(() => {
    if (savedPathname.current !== pathname) {
      savedPathname.current = pathname;
      if (pathname.includes("#")) {
        const hash = pathname.split("#").pop();
        if (hash) {
          setHash(hash);
        }
      }
    }
  }, [pathname, setHash]);

  return null; // This component doesn't render anything visible
}

const enableNativeScroll = (value: boolean) => {
  if (typeof document === "undefined") return;
  if (!document) return;
  const html = document.querySelector("html");
  if (!html) return;
  if (!value) {
    html.style.position = "relative";
    html.style.overflow = "hidden";
    html.style.height = "100%";
  } else {
    html.style.removeProperty("position");
    html.style.removeProperty("overflow");
    html.style.removeProperty("height");
  }
};
