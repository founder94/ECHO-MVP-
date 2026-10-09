"use client";

import { animated, useSpring } from "@react-spring/web";

import { useArrived } from "@flora/components/common/flight/arrival";
import { CtaButton } from "@flora/components/ui/cta-button";
import { WordFlight } from "@flora/components/ui/word-flight";
import type { NavLink } from "@flora/data/mocks/home";

export interface HeroIntroProps {
  lead: string;
  cta: NavLink;
}

/**
 * The left column — Figma "01 Hero" 4337:5415, and 4380:8081 (1024),
 * 4382:1051 (768), 4382:1113 (390). A paragraph and the call to action under
 * it; the button keeps its 220 × 49 on every frame.
 *
 * On the wide frames the block sits between the header and the heading, so it
 * takes its place as a share of the screen's height — 35% at 1440 (y 280 of
 * 800), 33.4% at 1024 (y 234 of 700) — rather than as a measure off either
 * edge. From 768 down the heading leaves the bottom corner and the column
 * takes it instead, hung off the bottom; at 390 the two become one block, laid
 * out by the stack in `Hero`.
 */
/** The button does not fly in; it comes into focus where it already is. */
const FOCUS = { tension: 170, friction: 28 };

export const HeroIntro = ({ lead, cta }: HeroIntroProps) => {
  const live = useArrived();
  const [{ sharp }] = useSpring(
    () => ({ sharp: live ? 1 : 0, delay: live ? 420 : 0, config: FOCUS }),
    [live],
  );

  return (
    <div className="max-laptop:top-[33.4286%] max-laptop:left-8 max-tablet:top-auto max-tablet:bottom-6 max-tablet:left-6 max-tablet:w-[23.125rem] max-phone:static max-phone:w-full absolute top-[35%] left-10 flex w-[32.5rem] flex-col gap-6">
      <p className="font-display text-lead leading-lead tracking-lead text-foreground-lead uppercase">
        <WordFlight text={lead} mode="rise" offset={220} />
      </p>

      {/* The cell and its icon are two shapes with a 2px gutter, not one button
        with a divider — the icon square is the design's own asset. */}
      <animated.span
        style={{
          opacity: sharp,
          filter: sharp.to((value) => `blur(${(1 - value) * 7}px)`),
        }}
      >
        <CtaButton
          href={cta.href}
          label={cta.label}
          className="w-[13.75rem]"
          plateClassName="w-[10.5625rem] pl-5"
        />
      </animated.span>
    </div>
  );
};
