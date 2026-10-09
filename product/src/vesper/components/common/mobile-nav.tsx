"use client";

import {
  animated,
  to,
  useSpring,
  useSprings,
  type SpringValue,
} from "@react-spring/web";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";

import { useScroll } from "@vesper/hooks/smooth-scroll/use-scroll";
import { PressableButton, PressableLink } from "@vesper/components/ui/pressable";
import {
  SPRING_CURTAIN,
  SPRING_CURTAIN_EXIT,
  SPRING_MENU_ITEM,
  SPRING_SOFT,
} from "@vesper/lib/springs/config";
import { GHOST, NAV_LINK, QUIET } from "@vesper/lib/springs/interaction";
import { appUrl } from "@/lib/siteRole";
import { HOME_V2, START_PATH, TOP_PATH } from "@/pages/do-it/brand-home/copy";

export interface MobileNavItem {
  label: string;
  href: string;
}

export interface MobileNavProps {
  items: readonly MobileNavItem[];
  /** One line under the links — the brand's own tagline. */
  tagline: string;
}

const PANEL_ID = "mobile-nav";
const TOGGLE_ID = "mobile-nav-toggle";
/** First link's delay after the curtain starts, then one beat per link. */
const LINK_DELAY_MS = 180;
const LINK_STAGGER_MS = 55;

/** Where the curtain grows from: the toggle's centre, and the radius that covers the screen. */
interface Origin {
  x: number;
  y: number;
  r: number;
}

const measureOrigin = (): Origin => {
  const toggle = document.getElementById(TOGGLE_ID);
  const w = window.innerWidth;
  const h = window.innerHeight;
  const rect = toggle?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : w - 40;
  const y = rect ? rect.top + rect.height / 2 : 40;
  const r = Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) + 8;
  return { x, y, r };
};

/** The burger's two bars, morphing into an ✕ off one spring. */
const Bars = ({ open }: { open: boolean }) => {
  const top = useSpring({
    rotate: open ? 45 : 0,
    y: open ? 5 : 0,
    config: SPRING_SOFT,
  });
  const bottom = useSpring({
    rotate: open ? -45 : 0,
    y: open ? -5 : 0,
    config: SPRING_SOFT,
  });
  return (
    <>
      <animated.span
        aria-hidden
        className="absolute block h-px w-[1.25rem] bg-white"
        style={{ ...top, top: "calc(50% - 5px)" }}
      />
      <animated.span
        aria-hidden
        className="absolute block h-px w-[1.25rem] bg-white"
        style={{ ...bottom, top: "calc(50% + 5px)" }}
      />
    </>
  );
};

/**
 * The header's nav below 1024px (ADR-0029) — a full-screen menu (owner review,
 * 2026-10-06; it was a small panel dropping out from under the bar).
 *
 * The violet ground grows as a circle out of the toggle, the header bar stays
 * where it was (the menu draws its own copy on top, so the burger morphs into
 * the ✕ in place), and the links rise one after another out of line masks —
 * the site's display face, large. Contact and the tagline settle in at the
 * bottom. Closing plays it back, faster.
 *
 * Portalled to `<body>`: the header is translated and blurred, which would make
 * it the containing block of anything `fixed` inside it.
 *
 * While open: page scroll is stopped through the scroll layout's own switch
 * (Lenis + the root's overflow), focus moves into the menu and stays there,
 * Escape closes, and focus returns to the toggle. A link closes the menu and
 * then scrolls to its target. Closed, the layer is `inert` and hidden. Under
 * reduced motion every spring jumps (react-spring's global `skipAnimation`).
 * The scene behind keeps running — it is covered, never remounted.
 */
export const MobileNav = ({ items, tagline }: MobileNavProps) => {
  const [open, setOpen] = useState(false);
  /** Shown from the first open frame until the close spring rests. */
  const [shown, setShown] = useState(false);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [origin, setOrigin] = useState<Origin>({ x: 0, y: 0, r: 0 });

  const panelRef = useRef<HTMLDivElement>(null);
  /** A navigation to run once the page can scroll again. */
  const pending = useRef<string | null>(null);
  /** Whether this menu is what stopped the scroll (so it only restarts its own). */
  const stoppedScroll = useRef(false);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => setPortal(document.body), []);

  const show = useCallback(() => {
    setOrigin(measureOrigin());
    setShown(true);
    setOpen(true);
  }, []);
  const hide = useCallback(() => setOpen(false), []);

  // The curtain: a circle from the toggle. 0 → 1.
  const curtain = useSpring({
    reveal: open ? 1 : 0,
    config: open ? SPRING_CURTAIN : SPRING_CURTAIN_EXIT,
    onRest: () => {
      if (!open) setShown(false);
    },
  });

  // Each link rises out of its mask; the rule under it draws left to right.
  const [links] = useSprings(
    items.length,
    (index) => ({
      y: open ? 0 : 105,
      line: open ? 1 : 0,
      delay: open ? LINK_DELAY_MS + index * LINK_STAGGER_MS : 0,
      config: open ? SPRING_MENU_ITEM : SPRING_CURTAIN_EXIT,
    }),
    [open],
  );

  const footer = useSpring({
    opacity: open ? 1 : 0,
    y: open ? 0 : 16,
    delay: open ? LINK_DELAY_MS + items.length * LINK_STAGGER_MS + 60 : 0,
    config: open ? SPRING_MENU_ITEM : SPRING_CURTAIN_EXIT,
  });

  // Codex 6차(대표 댓글 6077064641 의 제안): CSS 가 lg 에서 메뉴를 숨기니 같은 경계에서 상태도 닫는다(열린 채 넓어지면 스크롤 잠금이 남던 문제).
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeForDesktop = () => {
      if (!desktop.matches) return;
      pending.current = null;
      setOpen(false);
    };
    closeForDesktop();
    desktop.addEventListener("change", closeForDesktop);
    return () => desktop.removeEventListener("change", closeForDesktop);
  }, []);

  // Scroll lock, focus in, Escape — while open.
  useEffect(() => {
    if (!open) return;
    const scroll = useScroll.getState();
    if (scroll.isEnableScroll) {
      scroll.stop();
      stoppedScroll.current = true;
    }
    panelRef.current
      ?.querySelector<HTMLElement>("[data-menu-close]")
      ?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // On close: scroll back on, focus back to the toggle, then any navigation.
  useEffect(() => {
    if (open || !shown) return;
    if (stoppedScroll.current) {
      stoppedScroll.current = false;
      useScroll.getState().start();
    }
    const target = pending.current;
    pending.current = null;
    if (!target) {
      const toggle = document.getElementById(TOGGLE_ID);
      if (toggle?.getClientRects().length) {
        toggle.focus({ preventScroll: true });
      } else if (panelRef.current?.contains(document.activeElement)) {
        (document.activeElement as HTMLElement).blur();
      }
      return;
    }
    // After the scroll layout has re-enabled scrolling (its effect commits
    // with this render).
    const frame = requestAnimationFrame(() => {
      const [path, hash] = target.split("#");
      // 해시만 있는 링크(#how)는 같은 페이지.
      const samePage = !path || path === pathname;
      if (!samePage) {
        router.push(target);
        return;
      }
      const lenis = useScroll.getState().lenis;
      const element = hash ? document.getElementById(hash) : null;
      if (hash && !element) return;
      if (lenis) lenis.scrollTo(element ?? 0, { duration: 1.2 });
      else if (element) element.scrollIntoView({ behavior: "smooth" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, shown, pathname, router]);

  // A link closes the menu first; its navigation runs once scrolling is back.
  const onNavigate = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    pending.current = event.currentTarget.getAttribute("href");
    setOpen(false);
  }, []);

  // Keep Tab inside the open menu.
  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled])",
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const clipPath = curtain.reveal.to(
    (v) => `circle(${Math.max(0, v) * origin.r}px at ${origin.x}px ${origin.y}px)`,
  );

  const panel = (
    <animated.div
      ref={panelRef}
      id={PANEL_ID}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      inert={!open}
      hidden={!shown}
      onKeyDown={onPanelKeyDown}
      style={{ clipPath, WebkitClipPath: clipPath }}
      className="fixed inset-0 z-[55] h-dvh overflow-y-auto overscroll-contain bg-void text-white lg:hidden"
    >
      {/* A faint pool of the scene's mint where the curtain opened. */}
      <animated.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[image:var(--menu-glow)]"
        style={{ opacity: curtain.reveal }}
      />

      <div className="relative flex min-h-full flex-col px-[1.5rem] pt-[6.5rem] pb-[2rem] max-sm:px-[1.25rem]">
        {/* The header bar, drawn again on top: logo and the ✕ where the burger was. */}
        <div className="absolute top-[1rem] left-1/2 flex h-[3.5rem] w-[calc(100%-3rem)] -translate-x-1/2 items-center justify-between border border-white/10 py-[0.5rem] pr-[0.5rem] pl-[1rem] max-sm:top-[0.75rem] max-sm:w-[calc(100%-2.5rem)]">
          <PressableLink
            href={TOP_PATH}
            aria-label="DO IT — home"
            interaction={QUIET}
            onClick={onNavigate}
            className="block h-[1.5rem] w-[4.875rem] shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/doit-wordmark.webp" alt="DO IT" className="block h-full w-full object-contain object-left" />
          </PressableLink>
          <PressableButton
            data-menu-close=""
            type="button"
            aria-label="Close menu"
            onClick={hide}
            interaction={QUIET}
            className="relative flex size-[2.5rem] shrink-0 items-center justify-center"
          >
            <Bars open={open} />
          </PressableButton>
        </div>

        <nav aria-label="Main" className="flex flex-col">
          <ul className="flex flex-col">
            {items.map((item, index) => {
              const spring = links[index];
              return (
                <li key={item.label} className="relative">
                  <span className="block overflow-hidden py-[0.25rem]">
                    <animated.span
                      className="block will-change-transform"
                      style={{ transform: spring.y.to((y) => `translateY(${y}%)`) }}
                    >
                      <PressableLink
                        href={item.href}
                        interaction={NAV_LINK}
                        onClick={onNavigate}
                        className="flex items-baseline gap-[1rem] py-[0.5rem] font-general text-menu leading-title font-light tracking-title"
                      >
                        <span aria-hidden className="font-tag text-[0.8125rem] tracking-hud text-white/60">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {item.label}
                      </PressableLink>
                    </animated.span>
                  </span>
                  <Rule progress={spring.line} />
                </li>
              );
            })}
          </ul>
        </nav>

        <animated.div
          style={{
            opacity: footer.opacity,
            transform: footer.y.to((y) => `translateY(${y}px)`),
          }}
          className="mt-auto flex flex-col gap-[1.25rem] pt-[2.5rem]"
        >
          <p className="font-tag text-[0.8125rem] leading-[1.4] text-white uppercase">
            {tagline}
          </p>
          <PressableLink
            href={appUrl(START_PATH)}
            interaction={GHOST}
            className="flex items-center justify-center gap-[0.5rem] border px-[1.111rem] py-[0.875rem] font-general text-[1rem] leading-[1.2]"
          >
            {HOME_V2.start}
            <span aria-hidden className="block size-[0.1875rem] bg-current" />
          </PressableLink>
        </animated.div>
      </div>
    </animated.div>
  );

  return (
    <div className="hidden max-lg:block">
      <PressableButton
        id={TOGGLE_ID}
        type="button"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label="Open menu"
        onClick={show}
        interaction={QUIET}
        className="relative flex size-[2.5rem] shrink-0 items-center justify-center"
      >
        <Bars open={open} />
      </PressableButton>
      {portal && createPortal(panel, portal)}
    </div>
  );
};

/** The hairline under a link, drawn from the left as the link rises. */
const Rule = ({ progress }: { progress: SpringValue<number> }) => (
  <animated.span
    aria-hidden
    className="absolute right-0 bottom-0 left-0 block h-px origin-left bg-white/15"
    style={{ transform: to(progress, (p) => `scaleX(${p})`) }}
  />
);
