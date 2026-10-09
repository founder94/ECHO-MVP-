"use client";

import { animated } from "@react-spring/web";
import { useEffect, useMemo, useState } from "react";
import { HeroText as TextEngine } from "./hero/hero-text";

import { Inview } from "@vesper/components/common/robot-inview";
import { sceneTimeline } from "@vesper/lib/scene/timeline";
import { hiddenWhenClear, smoothstep, useSceneClock } from "./overlay";
import { LETTER_FADE, UNIT_REVEAL, WORD_FADE } from "./reveal";
import { LineBlur, wordCount } from "./line-blur";
import { SendRequest } from "./send-request";

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

const TITLE_LEFT = "내 이야기는, 내 말로.";
const TITLE_RIGHT = "마지막 말은, 나에게.";
const TAGLINE_LEFT =
  "AI의 해석이 나와 다르면 그 자리에서 고칠 수 있어요. 고친 내용은 다음 대화에 이어집니다.";
const TAGLINE_RIGHT = "움직임 줄이기 설정을 따릅니다";

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
          className="absolute top-[9.028vw] left-[1.667vw] w-[41.875vw] font-general text-[5.556vw] leading-[0.9] font-light max-lg:!static max-lg:w-full max-lg:text-[2.75rem] max-sm:text-[2rem]"
        >
          {TITLE_LEFT}
        </TextEngine>
      </LineBlur>

      <LineBlur
        active={active}
        unit="word"
        letters={wordCount(TAGLINE_LEFT)}
        delay={200}
      >
        <TextEngine
          tag="p"
          mode="always"
          enabled={active}
          immediateOut={false}
          delayIn={200}
          {...WORD_FADE}
          style={{ position: "absolute" }}
          className="absolute top-[calc(50%+2.361vw)] left-[1.667vw] w-[26.597vw] font-tag text-[1.111vw] leading-[1.2] uppercase max-lg:!static max-lg:w-full max-lg:text-[0.8125rem] max-sm:text-[0.75rem]"
        >
          {TAGLINE_LEFT}
        </TextEngine>
      </LineBlur>

      <LineBlur
        active={active}
        unit="word"
        letters={wordCount(TAGLINE_RIGHT)}
        delay={260}
      >
        <TextEngine
          tag="p"
          mode="always"
          enabled={active}
          immediateOut={false}
          delayIn={260}
          {...WORD_FADE}
          style={{ position: "absolute" }}
          className="absolute top-[calc(50%+2.361vw)] right-[1.667vw] w-[14.583vw] justify-end text-right font-tag text-[1.111vw] leading-[1.2] uppercase max-lg:!static max-lg:w-full max-lg:justify-start max-lg:text-left max-lg:text-[0.8125rem] max-sm:text-[0.75rem]"
        >
          {TAGLINE_RIGHT}
        </TextEngine>
      </LineBlur>

      <LineBlur active={active} letters={TITLE_RIGHT.length} delay={120}>
        <TextEngine
          tag="p"
          mode="always"
          enabled={active}
          immediateOut={false}
          delayIn={120}
          {...LETTER_FADE}
          style={{ position: "absolute" }}
          className="absolute right-[1.667vw] bottom-[1.667vw] w-[40.972vw] justify-end text-right font-general text-[5.556vw] leading-[0.9] font-light max-lg:!static max-lg:w-full max-lg:justify-start max-lg:text-left max-lg:text-[2.75rem] max-sm:text-[2rem]"
        >
          {TITLE_RIGHT}
        </TextEngine>
      </LineBlur>

      <Inview
        mode="always"
        enabled={active}
        immediateOut={false}
        delayIn={500}
        {...UNIT_REVEAL}
        className="pointer-events-auto absolute bottom-[1.667vw] left-[1.667vw] max-lg:static max-lg:mt-[0.75rem]"
      >
        <SendRequest />
      </Inview>
    </animated.div>
  );
};
