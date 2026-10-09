"use client";

/**
 * The menu the header's button opens on the narrow frames.
 *
 * It is the whole screen, not a panel: at 390 there is no room to be beside
 * anything. The list is the header's own five links and nothing else — the
 * site's inner pages live in the footer, and a menu that repeated them would
 * be a second footer. Under the list goes only what the list does not say:
 * the call to action, and the places the site keeps outside itself.
 *
 * It arrives the way a hop does, and the design picked the order: a point of
 * light runs the width of each row, the rule is drawn behind it, and the
 * words land on the finished line a beat later — one row after the next. The
 * same order the story tells about a packet crossing a relay. Leaving is that
 * motion taken back, quicker, because nobody watches a menu close.
 */

import { animated, useSpring, useSprings } from "@react-spring/web";
import { useCallback, useEffect, useRef } from "react";

import { CtaButton } from "@flora/components/ui/cta-button";
import type { NavLink } from "@flora/data/mocks/home";

export interface NavMenuProps {
  open: boolean;
  onClose: () => void;
  links: NavLink[];
  cta: NavLink;
  social: NavLink[];
  /** The button that opens it — focus goes back there on the way out. */
  opener: React.RefObject<HTMLButtonElement | null>;
}

/** How far a row stands below its place before it lands, in rem. */
const HOP = 1.5;
/** One row after the next, in ms. */
const STAGGER = 62;
/** The rule is already there when the words arrive. */
const RULE_LEAD = 90;
/** Coming apart is faster than coming together. */
const LEAVING = 26;

const ARRIVING = { tension: 210, friction: 30 };
const GOING = { tension: 260, friction: 32 };

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const NavMenu = ({
  open,
  onClose,
  links,
  cta,
  social,
  opener,
}: NavMenuProps) => {
  const sheet = useRef<HTMLDivElement>(null);
  /* The rows, then the button, then the row of places: one list, because they
     all arrive on the same count. */
  const steps = links.length + 2;

  const [veil, veilApi] = useSpring(() => ({
    shown: 0,
    config: ARRIVING,
  }));

  const [rows, rowsApi] = useSprings(steps, () => ({
    landed: 0,
    config: ARRIVING,
  }));

  const [rules, rulesApi] = useSprings(links.length, () => ({
    drawn: 0,
    config: ARRIVING,
  }));

  useEffect(() => {
    if (open) {
      veilApi.start({ shown: 1, config: ARRIVING });
      rulesApi.start((index) => ({
        drawn: 1,
        delay: index * STAGGER,
        config: ARRIVING,
      }));
      rowsApi.start((index) => ({
        landed: 1,
        delay: RULE_LEAD + index * STAGGER,
        config: ARRIVING,
      }));
      return;
    }
    veilApi.start({ shown: 0, delay: steps * LEAVING, config: GOING });
    rulesApi.start((index) => ({
      drawn: 0,
      delay: index * LEAVING,
      config: GOING,
    }));
    rowsApi.start((index) => ({
      landed: 0,
      delay: index * LEAVING,
      config: GOING,
    }));
  }, [open, steps, veilApi, rowsApi, rulesApi]);

  /* Escape, and the tab ring kept inside the sheet: while this is up it is the
     only thing on the page, and the keyboard should agree. */
  const onKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !sheet.current) return;
      const stops = [...sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const on = document.activeElement;
      if (event.shiftKey && on === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && on === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    const held = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    const opened = opener.current;
    /* The first stop inside, not the sheet itself: a screen reader should be
       told what it landed on, and the first link is what. */
    sheet.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      document.body.style.overflow = held;
      document.removeEventListener("keydown", onKey);
      opened?.focus();
    };
  }, [open, onKey, opener]);

  const row = (index: number) => ({
    opacity: rows[index].landed,
    transform: rows[index].landed.to(
      (value) => `translate3d(0, ${(1 - value) * HOP}rem, 0)`,
    ),
  });

  return (
    <animated.div
      ref={sheet}
      id="nav-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="bg-preloader-field/95 backdrop-blur-glass max-tablet:block fixed inset-0 z-40 hidden"
      style={{
        opacity: veil.shown,
        /* Gone is gone: a sheet at zero must not still be catching taps. On
           the way in it is the prop that decides, not the spring — the focus
           below is moved in the same tick the sheet opens, and a `hidden`
           element cannot take focus. */
        visibility: open
          ? "visible"
          : veil.shown.to((value) => (value < 0.01 ? "hidden" : "visible")),
      }}
      // `inert` would be the honest word, but it is the page behind that is
      // inert — here it is enough that nothing under zero can be reached.
      aria-hidden={open ? undefined : true}
    >
      <nav
        aria-label="Primary"
        className="max-tablet:top-[8.125rem] max-tablet:right-6 max-tablet:left-6 max-phone:top-[7rem] max-phone:right-5 max-phone:left-5 absolute"
      >
        {links.map((link, index) => (
          <div key={link.href} className="relative">
            {/* The path, drawn from the left, before the hop lands on it —
                and the packet that draws it, running along the leading edge. */}
            <animated.span
              aria-hidden
              className="bg-rule absolute inset-x-0 top-0 h-px origin-left"
              style={{
                transform: rules[index].drawn.to((v) => `scaleX(${v})`),
              }}
            />
            <animated.span
              aria-hidden
              className="bg-accent absolute top-0 size-[0.3125rem] -translate-y-1/2 rounded-full shadow-[0_0_8px_var(--color-accent)]"
              style={{
                left: rules[index].drawn.to((v) => `${v * 100}%`),
                opacity: rules[index].drawn.to((v) =>
                  v < 0.02 || v > 0.98 ? 0 : 1,
                ),
              }}
            />
            {index === links.length - 1 ? (
              <animated.span
                aria-hidden
                className="bg-rule absolute inset-x-0 bottom-0 h-px origin-left"
                style={{
                  transform: rules[index].drawn.to((v) => `scaleX(${v})`),
                }}
              />
            ) : null}
            <animated.span className="block" style={row(index)}>
              <a
                href={link.href}
                onClick={onClose}
                className="group max-tablet:gap-[1.375rem] max-tablet:py-[2.125rem] max-phone:gap-4 max-phone:py-[1.875rem] flex items-baseline"
              >
                <span className="font-display text-foot tracking-foot text-accent max-tablet:w-[1.625rem] max-phone:w-[1.375rem] w-[1.375rem] shrink-0 leading-none transition-[opacity,transform] duration-[var(--duration-fast)] ease-[var(--ease-entrance)] group-hover:translate-x-1">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="ink-fill [--ink-from:var(--color-scene-foreground)] font-display max-tablet:text-[2.75rem] max-phone:text-[2rem] leading-none uppercase">
                  {link.label}
                </span>
              </a>
            </animated.span>
          </div>
        ))}
      </nav>

      <div className="max-tablet:right-6 max-tablet:bottom-6 max-tablet:left-6 max-phone:right-5 max-phone:bottom-5 max-phone:left-5 absolute flex flex-col gap-5">
        <animated.div style={row(links.length)}>
          {/* The same button as the two screens carry, across the grid. */}
          <CtaButton
            href={cta.href}
            label={cta.label}
            onClick={onClose}
            plateClassName="flex-1 pl-5"
          />
        </animated.div>

        <animated.ul
          className="flex justify-center gap-[1.625rem]"
          style={row(links.length + 1)}
        >
          {social.map((place) => (
            <li key={place.href}>
              <a
                href={place.href}
                onClick={onClose}
                className="ink-fill [--ink-from:var(--color-foreground-quiet)] font-display text-link tracking-foot leading-none uppercase"
              >
                {place.label}
              </a>
            </li>
          ))}
        </animated.ul>
      </div>
    </animated.div>
  );
};
