"use client";

import { animated } from "@react-spring/web";
import { useEffect, useMemo, useState } from "react";
import { HeroText as TextEngine } from "./hero/hero-text";

import { Inview } from "@vesper/components/common/robot-inview";
import { sceneTimeline } from "@vesper/lib/scene/timeline";
import { HOME_V2 } from "@/pages/do-it/brand-home/copy";
import { hiddenWhenClear, smoothstep, useSceneClock } from "./overlay";
import { LETTER_FADE, UNIT_REVEAL } from "./reveal";
import { LineBlur } from "./line-blur";

/**
 * Third-section overlay — the Figma "convergence" screen over the brain. A fixed
 * layer that brings the two prior titles together: "Motion instead of chrome"
 * top-left and "Reads presence, in motion" bottom-right, with the Send Request
 * CTA bottom-left and a supporting line on each flank.
 *
 * It fades against the global clock's brain window, and the copy reveals (fade +
 * blur + rise) when the brain owns the frame. A fixed overlay can't rely on
 * in-view, so the reveal gates on the clock window (`active`) and reverses when
 * it leaves. Desktop measurements are the Figma pixels in `vw` (÷14.4).
 *
 * Below 1024px (ADR-0029) the four-corner composition collapses to a single
 * column — the two titles read as one stacked pair, which is what the section is
 * about anyway.
 */

// 2026-10-09 대표 「홈페이지 수정사항 — 최신 정정」 4 영상 페이지 ① 이야기: 제목 하나 + 설명 두 줄(이용 안내 승인 문장).
const PAGE = HOME_V2.pages[0];
const TITLE_LEFT = PAGE.title;
const LINES = PAGE.lines;

export const SectionBrain = () => {
  const clock = useSceneClock();

  const opacity = useMemo(
    () =>
      clock.to((value) => {
        const shown = smoothstep(2.2, 2.65, value);
        const gone = smoothstep(3.6, 4.1, value);
        return shown * (1 - gone);
      }),
    [clock],
  );
  const visibility = useMemo(() => hiddenWhenClear(opacity), [opacity]);

  const [active, setActive] = useState(false);
  useEffect(
    () =>
      sceneTimeline.subscribe((value) =>
        setActive((prev) => {
          const next = value > 2.55 && value < 3.7;
          return prev === next ? prev : next;
        }),
      ),
    [],
  );

  return (
    <animated.div
      className="pointer-events-none fixed inset-0 z-10 text-white max-lg:flex max-lg:flex-col max-lg:justify-center max-lg:gap-[1.25rem] max-lg:px-[1.5rem] max-lg:py-[6.5rem] max-sm:px-[1.25rem]"
      style={{ opacity, visibility }}
    >
      {/* 2026-10-09 대표: 휴대폰에서 뇌와 글이 겹쳐 보임 → 글 뒤에 어두운 막(뇌는 배경으로 묻힘). 1024px 이상은 원본 그대로. */}
      <div aria-hidden className="absolute inset-0 -z-10 hidden max-lg:block bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.72)_22%,rgba(0,0,0,0.72)_78%,rgba(0,0,0,0)_100%)]" />
      <LineBlur active={active} letters={TITLE_LEFT.length}>
        <TextEngine
          tag="h2"
          mode="always"
          enabled={active}
          immediateOut={false}
          {...LETTER_FADE}
          style={{ position: "absolute" }}
          className="absolute top-[9.028vw] left-[1.667vw] w-[41.875vw] font-general text-[5.556vw] leading-[1.15] font-normal break-keep max-lg:!static max-lg:w-full max-lg:text-[3.25rem] max-sm:text-[2.375rem]"
        >
          {TITLE_LEFT}
        </TextEngine>
      </LineBlur>

      <Inview
        mode="always"
        enabled={active}
        immediateOut={false}
        delayIn={200}
        {...UNIT_REVEAL}
        className="absolute top-[calc(50%+2.361vw)] left-[1.667vw] flex w-[26.597vw] flex-col gap-[0.4vw] font-general text-[1.111vw] leading-[1.55] break-keep max-lg:static max-lg:w-full max-lg:text-[1rem]"
      >
        {LINES.map((line) => (
          <p key={line} className="m-0">{line}</p>
        ))}
      </Inview>
    </animated.div>
  );
};
