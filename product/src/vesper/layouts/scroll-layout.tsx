"use client";

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useLocation } from "react-router-dom";
import { useScroll } from "@vesper/hooks/smooth-scroll/use-scroll";
import { subscribeToTicker, TICKER_PRIORITY } from "@vesper/lib/animation/ticker";
import { scrollTo } from "@vesper/utils/scroll-to";
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
  // 2026-10-09: 해시(#faq 등)로 굴러가는 원본 로직은 경로+해시를 본다. usePathname 은 Next 처럼 해시 없이 두고(휴대폰 메뉴의
  // 같은 페이지 판정), 여기서만 해시를 붙인다.
  const locationHash = useLocation().hash;
  const pathname = usePathname() + locationHash;
  const savedPathname = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    const lenis = new Lenis({
      smoothWheel: true,
      // syncTouch: true,
    });
    (window as typeof window & { lenis: Lenis }).lenis = lenis;
    setLenis(lenis);

    // Driven by the shared ticker rather than a second `requestAnimationFrame`
    // of its own. Two loops is one too many, but the reason that matters is
    // **order**: Lenis writes the scroll position, and every scroll trigger on
    // the page reads it back with `getBoundingClientRect`. In separate loops the
    // order is whichever registered first, so the readers could spend the whole
    // frame measuring the *previous* frame's scroll. `scroll` priority puts the
    // write first, every frame.
    const unsubscribe = subscribeToTicker(
      (time) => lenis.raf(time),
      () => 0,
      TICKER_PRIORITY.scroll,
    );

    return () => {
      // Unsubscribe before destroying — otherwise the ticker keeps calling `raf`
      // on a destroyed instance after unmount/HMR.
      unsubscribe();
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
