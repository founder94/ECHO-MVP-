"use client";

import { animated } from "@react-spring/web";
import { useMemo } from "react";
import { HeroText as TextEngine } from "./hero-text";

import { Inview } from "@vesper/components/common/robot-inview";
import { hiddenWhenClear, useSceneClock } from "../overlay";
import { LETTER_FADE, UNIT_REVEAL_FIRST_SCREEN, WORD_REVEAL } from "../reveal";
import { LineBlur } from "../line-blur";
import { HOME_V2 } from "@/pages/do-it/brand-home/copy";

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
// 2026-10-09 대표 「홈페이지 수정사항 — 최신 정정」 1·3: 첫 화면은 로고(머리글)·제목·작은 스크롤 안내만. 긴 설명·큰 시작 버튼 0.
// 입자 구체 한 줄은 장면이 안정된 뒤(인트로 2.9초 뒤)에 왼쪽 아래 — 구체 중심을 가리지 않는다.
const TITLE = HOME_V2.heroTitle;
const SPHERE_LINE = HOME_V2.sphereLine;
const SCROLL_HINT = HOME_V2.scrollHint;

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

      {/* Bottom cluster — 구체 한 줄(왼쪽 아래 · 안정된 뒤) + 작은 스크롤 안내(가운데 아래). */}
      <div className="absolute right-[1.667vw] bottom-[2.153vw] left-[1.667vw] h-[6vw] max-lg:!static max-lg:flex max-lg:h-auto max-lg:flex-col max-lg:gap-[1rem]">
        <TextEngine
          tag="p"
          mode="once"
          enabled={introStarted}
          delayIn={3200}
          {...WORD_REVEAL}
          style={{ position: "absolute" }}
          className="absolute bottom-0 left-0 w-[27.5vw] font-general text-[1.111vw] leading-[1.55] break-keep max-lg:!static max-lg:w-full max-lg:text-[1rem]"
        >
          {SPHERE_LINE}
        </TextEngine>
        <Inview
          mode="once"
          enabled={introStarted}
          delayIn={1400}
          {...UNIT_REVEAL_FIRST_SCREEN}
          className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-[0.556vw] font-tag text-[0.833vw] leading-[1.2] text-white/70 max-lg:static max-lg:translate-x-0 max-lg:text-[0.8125rem]"
        >
          <span>{SCROLL_HINT}</span>
          <span aria-hidden className="vesper-scroll-hint block h-[1.111vw] w-px bg-white/70 max-lg:h-[1rem]" />
        </Inview>
      </div>
    </animated.div>
  );
};
