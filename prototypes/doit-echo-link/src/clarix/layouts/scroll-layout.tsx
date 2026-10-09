"use client";

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { useScroll } from "@clarix/hooks/smooth-scroll/use-scroll";
import { scrollTo } from "@clarix/utils/scroll-to";
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
    // 연결 시안: 메뉴 해시(#company · #echo)로 들어오면 그 장면에서 시작하도록 맨 위로 되돌리지 않는다.
    if (!window.location.hash) window.scrollTo(0, 0);
    // 움직임 줄이기: 휠을 부드럽게 끌지 않는다(장면은 스크롤 위치를 그대로 따른다).
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Clarix's shipped Lenis options: a 1.5 s exponential-out glide per wheel
    // step (duration + easing win over lerp in Lenis).
    const lenis = new Lenis({
      smoothWheel: !reduced,
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    (window as typeof window & { lenis: Lenis }).lenis = lenis;
    setLenis(lenis);

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      // Cancel the loop before destroying Lenis — otherwise it keeps calling
      // `raf` on a destroyed instance after unmount/HMR.
      cancelAnimationFrame(rafId);
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
