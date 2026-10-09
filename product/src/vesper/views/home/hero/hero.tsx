"use client";

import { animated } from "@react-spring/web";
import { Fragment, useMemo } from "react";
import { HeroText as TextEngine } from "./hero-text";

import { Inview } from "@vesper/components/common/robot-inview";
import { hiddenWhenClear, useSceneClock } from "../overlay";
import { LETTER_FADE, UNIT_REVEAL_FIRST_SCREEN, WORD_REVEAL } from "../reveal";
import { LineBlur } from "../line-blur";
import { SendRequest } from "../send-request";
import { PressableLink } from "@vesper/components/ui/pressable";
import { GHOST } from "@vesper/lib/springs/interaction";
import { HOME_V2, HOW_PATH } from "@/pages/do-it/brand-home/copy";

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

// 2026-10-09 대표 「최신 채택안」: 원본 글 칸에 ECHO 문구(제목 · 선택권 안내 · 서비스 설명 · 꼬리표 · 주요/보조 버튼). 한글 행간 제목 1.15 · 본문 1.55.
const TITLE = HOME_V2.heroTitle;
const TAGLINE = HOME_V2.heroChoice;
const SUPPORT = HOME_V2.heroDesc;
const TAGS = HOME_V2.tags;

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
          className="absolute top-[9.028vw] left-[1.667vw] w-[41.875vw] font-general text-[5.556vw] leading-[1.15] font-normal break-keep max-lg:!static max-lg:w-full max-lg:text-[3.25rem] max-sm:text-[2.375rem]"
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
          className="absolute top-0 left-0 w-[27.5vw] font-general text-[1.111vw] leading-[1.55] break-keep max-lg:!static max-lg:w-full max-lg:text-[0.9375rem] max-sm:text-[0.8125rem]"
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
          className="absolute top-0 right-0 w-[19.348vw] text-left font-general text-[1.111vw] leading-[1.55] break-keep max-lg:!static max-lg:w-full max-lg:text-[0.9375rem] max-sm:text-[0.8125rem]"
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
          className="pointer-events-auto absolute top-[10.972vw] right-0 flex items-center gap-[0.833vw] max-lg:static"
        >
          <SendRequest />
          {/* 보조 버튼 — 바로 아래 이용 방법(#how)으로. */}
          <PressableLink
            href={HOW_PATH}
            interaction={GHOST}
            className="flex h-[3.542vw] items-center border px-[1.111vw] font-general text-[1.111vw] leading-[1.2] font-normal whitespace-nowrap"
          >
            {HOME_V2.how}
          </PressableLink>
        </Inview>
      </div>
    </animated.div>
  );
};
