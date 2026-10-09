"use client";

import { animated, useSpring } from "@react-spring/web";
import { useEffect, useRef, useState } from "react";

import { publicUrl } from "@shared/paths";
import type { HeroNavContent } from "@flora/data/mocks/home";
import { useFrame } from "@flora/hooks/use-frame";
import { NavMenu } from "@flora/views/home/nav-menu";

export type HeroNavProps = HeroNavContent & {
  /** 운영 주체 표기(대표 지시 §1: 모바일 서비스는 ECHO 가 주 브랜드, 운영사는 by DOIT COMPANY). */
  operator: string;
};

/**
 * The floating header — Figma "01 Hero" 4337:5444, and 4380:7999 (1024),
 * 4382:1080 (768), 4382:1142 (390). Three glass islands on a row the width of
 * the frame's own gutters — 1360, then 960, 720, 350: the logo, the nav, and
 * the connect button, the last two carrying the lime accent bar on their
 * edges.
 *
 * The row sheds an island at a time as it narrows. At 1024 the logo and the
 * nav stop sharing a measured 918 and simply stand 85 apart. At 768 the five
 * links go and the menu button takes their place at the end of the row; at 390
 * the connect island goes too and the row is the logo and that button.
 *
 * The button's two bars are the menu's only tell: they spring together into a
 * cross and back, so the thing that opened it is visibly the thing that shuts
 * it. Everything else it does — trapping the keyboard, holding the scroll,
 * handing focus back — belongs to `NavMenu`.
 */

/** Where the bars sit when they are a burger, and when they are a cross. */
const BURGER = { top: 1.15625, bottom: 1.65625 };
const CROSS = 1.46875;

const MORPH = { tension: 260, friction: 26 };

export const HeroNav = ({ brand, operator, links, connect, menu }: HeroNavProps) => {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const frame = useFrame();

  const [bars] = useSpring(
    () => ({ crossed: open ? 1 : 0, config: MORPH }),
    [open],
  );

  /* A menu that only exists on the narrow frames must not survive one being
     dragged wide: the button it belongs to has gone. */
  useEffect(() => {
    if (frame === "wide" || frame === "laptop") setOpen(false);
  }, [frame]);

  /* The design's turn is the long way round: 135 and -135 rather than 45 and
     -45, so the bars pass each other on their way to the cross. */
  const bar = (from: number) => ({
    top: bars.crossed.to((v) => `${from + (CROSS - from) * v}rem`),
    transform: bars.crossed.to(
      (v) => `rotate(${v * (from === BURGER.top ? 135 : -135)}deg)`,
    ),
  });

  return (
    <>
      {/* Above the sheet it opens, not under it: the button that opened the
          menu has to be the button that shuts it, and the logo stays where it
          was — which is what the design draws over the open menu too. */}
      <header className="absolute inset-x-0 top-4 z-50 flex justify-center">
        <div className="max-laptop:w-[60rem] max-tablet:w-[45rem] max-phone:w-[21.875rem] flex w-[85rem] items-center justify-between">
          {/* The logo and the nav share the left 918 of the row — below it the
              design stops measuring that share and sets the gap itself. */}
          <div className="max-laptop:w-auto max-laptop:gap-[5.3125rem] flex w-[57.375rem] items-center justify-between">
            <a
              href={links[0]?.href ?? "#"}
              aria-label={`${brand} ${operator}`}
              className="bg-surface-glass shadow-glass backdrop-blur-glass rounded-panel group flex h-[3.0625rem] items-center gap-3 overflow-clip py-[0.4375rem] pr-4 pl-4"
            >
              <span className="font-display text-wordmark leading-tight tracking-label text-scene-foreground font-medium uppercase">
                {brand}
              </span>
              <span className="text-operator text-foreground-note font-medium flex items-center gap-1.5 leading-none whitespace-nowrap">
                <img src={publicUrl("brand/doit-symbol.png")} alt="" aria-hidden="true" className="h-[1.05rem] w-auto" />
                {operator}
              </span>
            </a>

            <nav
              aria-label="Primary"
              className="bg-surface-glass-subtle shadow-glass backdrop-blur-glass rounded-panel max-tablet:hidden relative flex h-[3.0625rem] items-center gap-8 overflow-clip px-6"
            >
              <span
                aria-hidden
                className="bg-accent rounded-l-panel absolute inset-y-px left-0 w-[0.1875rem]"
              />
              {links.map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  /* The rule under a link is the path a hop travels: it draws
                     in from the left, then the label takes the accent. */
                  /* The lime runs through the letters themselves rather than
                     under them: the ink is what fills, left to right. */
                  className="ink-fill [--ink-from:var(--color-foreground-nav)] font-display text-label leading-nav tracking-label uppercase"
                >
                  {label}
                </a>
              ))}
              <span
                aria-hidden
                className="bg-accent rounded-r-panel absolute inset-y-px right-0 w-[0.1875rem]"
              />
            </nav>
          </div>

          {/* The tail of the row: on 768 the connect island and the menu button
              stand 7 apart, on 390 the button stands alone. */}
          <div className="flex items-center gap-[0.4375rem]">
            <a
              href={connect.href}
              className="bg-surface-glass shadow-glass-strong backdrop-blur-glass rounded-panel max-phone:hidden group relative flex h-[3.0625rem] items-center gap-3 px-5"
            >
              <span className="font-display text-label leading-nav tracking-label text-foreground-strong uppercase">
                {connect.label}
              </span>

              <span
                aria-hidden
                className="bg-accent rounded-r-panel absolute inset-y-px right-0 w-[0.1875rem]"
              />
            </a>

            <button
              ref={button}
              type="button"
              aria-label="Menu"
              aria-expanded={open}
              aria-controls="nav-menu"
              onClick={() => setOpen((was) => !was)}
              className="bg-surface-glass shadow-glass-edge rounded-panel max-tablet:block group relative hidden size-[3.0625rem] overflow-clip"
            >
              {/* The bars take the accent under the hand — the same lime every
                  other thing on this row lights with. */}
              <animated.span
                aria-hidden
                className="bg-foreground-nav group-hover:bg-accent absolute left-[0.90625rem] h-[0.125rem] w-[1.125rem] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-entrance)]"
                style={bar(BURGER.top)}
              />
              <animated.span
                aria-hidden
                className="bg-foreground-nav group-hover:bg-accent absolute left-[0.90625rem] h-[0.125rem] w-[1.125rem] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-entrance)]"
                style={bar(BURGER.bottom)}
              />
            </button>
          </div>
        </div>
      </header>

      <NavMenu
        open={open}
        onClose={() => setOpen(false)}
        links={links}
        cta={menu.cta}
        social={menu.social}
        opener={button}
      />
    </>
  );
};
