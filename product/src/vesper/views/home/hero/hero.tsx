"use client";

import { animated } from "@react-spring/web";
import { Fragment, useMemo } from "react";
import { HeroText as TextEngine } from "./hero-text";

import { Inview } from "@vesper/components/common/robot-inview";
import { hiddenWhenClear, useSceneClock } from "../overlay";
import { LETTER_FADE, UNIT_REVEAL_FIRST_SCREEN, WORD_REVEAL } from "../reveal";
import { LineBlur } from "../line-blur";
import { SendRequest } from "../send-request";
import { BRAND_HOME_COPY } from "@/pages/do-it/brand-home/copy";

/**
 * Hero overlay — the Figma "Motion instead of chrome" screen.
 *
 * A fixed layer over the WebGL scene: the display title top-left, and a
 * bottom-anchored cluster carrying the tagline, tags, supporting copy, and the
 * Send Request CTA. Copy reveals once the loader hands off (`introStarted`) — the
 * title letter-by-letter, the tagline/support word-by-word, the tags + CTA
 * fade-rising — so on reload the reveal plays after the preloader. The whole
 * overlay then fades out as the scene scrolls past section one.
 *
 * ## Two layouts, one tree (ADR-0029)
 * At **≥1024px** this is the Figma artboard, sized in `vw` (Figma pixels ÷ 14.4),
 * with every element absolutely placed at its design offset.
 *
 * Below 1024px those offsets stop meaning anything — the artboard is 1440 wide,
 * so its 16px body copy would land at 4px on a phone. The `max-lg:` rules turn
 * the overlay into a plain top-to-bottom flex stack sized in `rem`, and pull the
 * children back into flow. The `!` matters: `TextEngine` hardcodes `position` as
 * an **inline** style, so only `position: static !important` can beat it.
 */

const TITLE = `${BRAND_HOME_COPY.heroTitle[0]} ${BRAND_HOME_COPY.heroTitle[1]}`;
const TAGLINE = `${BRAND_HOME_COPY.heroLine[0]} ${BRAND_HOME_COPY.heroLine[1]}`;
const SUPPORT = BRAND_HOME_COPY.heroNote;
const TAGS = ["[ ECHO ]", "[ ONLINE SERENDIPITY ]", "[ JUST TRY. ]"];

export interface HeroProps {
  /** Flips true once the loader curtain lifts — gates the reveal. */
  introStarted: boolean;
}

export const Hero = ({ introStarted }: HeroProps) => {
  const clock = useSceneClock();

  // Fades out (as a group) as the scene scrolls past section one.
  const opacity = useMemo(
    () =>
      clock.to((value) => 1 - Math.min(Math.max((value - 0.08) / 0.2, 0), 1)),
    [clock],
  );
  const visibility = useMemo(() => hiddenWhenClear(opacity), [opacity]);

  return (
    <animated.div
      className="pointer-events-none fixed inset-0 z-10 text-white max-lg:flex max-lg:flex-col max-lg:justify-between max-lg:px-[1.5rem] max-lg:pt-[6.5rem] max-lg:pb-[2rem] max-sm:px-[1.25rem] max-sm:pt-[5.5rem]"
      style={{ opacity, visibility }}
    >
      <LineBlur active={introStarted} letters={TITLE.length} delay={200}>
        <TextEngine
          tag="h1"
          mode="once"
          enabled={introStarted}
          delayIn={200}
          {...LETTER_FADE}
          style={{ position: "absolute" }}
          className="absolute top-[9.028vw] left-[1.667vw] w-[41.875vw] font-general text-[5.556vw] leading-[0.9] font-light max-lg:!static max-lg:w-full max-lg:text-[3.25rem] max-sm:text-[2.375rem]"
        >
          {TITLE}
        </TextEngine>
      </LineBlur>

      {/* Bottom cluster — children at their exact Figma offsets on desktop, a
          simple stack below 1024. */}
      <div className="absolute right-[1.667vw] bottom-[2.153vw] left-[1.667vw] h-[14.514vw] max-lg:!static max-lg:flex max-lg:h-auto max-lg:flex-col max-lg:gap-[1.25rem]">
        <TextEngine
          tag="p"
          mode="once"
          enabled={introStarted}
          delayIn={500}
          {...WORD_REVEAL}
          style={{ position: "absolute" }}
          className="absolute top-0 left-0 w-[27.5vw] font-tag text-[1.111vw] leading-[1.2] uppercase max-lg:!static max-lg:w-full max-lg:text-[0.9375rem] max-sm:text-[0.8125rem]"
        >
          {TAGLINE}
        </TextEngine>

        <TextEngine
          tag="p"
          mode="once"
          enabled={introStarted}
          delayIn={560}
          {...WORD_REVEAL}
          style={{ position: "absolute" }}
          className="absolute top-0 right-0 w-[19.348vw] text-left font-general text-[1.111vw] leading-[1.2] max-lg:!static max-lg:w-full max-lg:text-[0.9375rem] max-sm:text-[0.8125rem]"
        >
          {SUPPORT}
        </TextEngine>

        <Inview
          mode="once"
          enabled={introStarted}
          delayIn={700}
          {...UNIT_REVEAL_FIRST_SCREEN}
          className="absolute top-[13.194vw] left-0 flex items-center gap-[1.667vw] font-tag text-[1.111vw] leading-[1.2] whitespace-nowrap uppercase max-lg:static max-lg:flex-wrap max-lg:gap-[0.75rem] max-lg:text-[0.75rem] max-lg:whitespace-normal"
        >
          {TAGS.map((tag, index) => (
            <Fragment key={index}>
              {index > 0 && (
                <span className="size-[0.208vw] shrink-0 bg-white max-lg:size-[0.1875rem]" />
              )}
              <span>{tag}</span>
            </Fragment>
          ))}
        </Inview>

        <Inview
          mode="once"
          enabled={introStarted}
          delayIn={820}
          {...UNIT_REVEAL_FIRST_SCREEN}
          className="pointer-events-auto absolute top-[10.972vw] right-0 max-lg:static"
        >
          <SendRequest />
        </Inview>
      </div>
    </animated.div>
  );
};
