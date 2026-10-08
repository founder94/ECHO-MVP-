"use client";

import { animated } from "@react-spring/web";
import { useEffect, useMemo, useState } from "react";
import { HeroText as TextEngine } from "./hero/hero-text";

import { sceneTimeline } from "@vesper/lib/scene/timeline";
import { hiddenWhenClear, smoothstep, useSceneClock } from "./overlay";
import { LETTER_FADE, WORD_FADE } from "./reveal";
import { LineBlur, wordCount } from "./line-blur";
import { BRAND_HOME_COPY } from "@/pages/do-it/brand-home/copy";

/**
 * Second-section overlay — the Figma "Reads presence, in motion" screen over the
 * galaxy. A fixed layer: centred title, centred support copy, and a four-stat
 * band across the foot with faint column dividers.
 *
 * It fades against the global clock's galaxy window. Desktop measurements are the
 * Figma pixels in `vw` (÷14.4).
 *
 * Below 1024px (ADR-0029) the stat band cannot survive as authored — four 11vw
 * columns pinned at fixed `left` offsets — so it becomes a 2×2 grid on tablet and
 * a single column on phones, with the copy stacked above it.
 */

const TITLE = `${BRAND_HOME_COPY.storyTitle[0]} ${BRAND_HOME_COPY.storyTitle[1]}`;
const SUPPORT = BRAND_HOME_COPY.scope;

/** `value` / `label` / `left` (Figma x ÷14.4 — the desktop offset only). */
const STATS = [
  { value: "01", label: "당신의 하루", left: "6.944vw" },
  { value: "02", label: "AI의 이해", left: "31.944vw" },
  { value: "03", label: "연결의 시작", left: "56.944vw" },
  { value: "04", label: "메아리의 답", left: "81.944vw" },
];

/** Column dividers between the stats (Figma x ÷14.4 — desktop only). */
const DIVIDERS = ["25vw", "50vw", "75vw"];

export const SectionGalaxy = () => {
  const clock = useSceneClock();

  const opacity = useMemo(
    () =>
      clock.to((value) => {
        const shown = smoothstep(0.32, 0.52, value);
        const gone = smoothstep(1.9, 2.3, value);
        return shown * (1 - gone);
      }),
    [clock],
  );
  const visibility = useMemo(() => hiddenWhenClear(opacity), [opacity]);

  // The copy reveals when the galaxy owns the frame; a fixed overlay can't rely
  // on in-view, so it gates the engine on the clock window instead.
  const [active, setActive] = useState(false);
  useEffect(
    () =>
      sceneTimeline.subscribe((value) =>
        setActive((prev) => {
          const next = value > 0.45 && value < 2.05;
          return prev === next ? prev : next;
        }),
      ),
    [],
  );

  return (
    <animated.div
      className="pointer-events-none fixed inset-0 z-10 text-white max-lg:flex max-lg:flex-col max-lg:justify-between max-lg:px-[1.5rem] max-lg:pt-[6.5rem] max-lg:pb-[2rem] max-sm:px-[1.25rem] max-sm:pt-[5.5rem]"
      style={{ opacity, visibility }}
    >
      <LineBlur active={active} letters={TITLE.length}>
        <TextEngine
          tag="h2"
          mode="always"
          enabled={active}
          immediateOut={false}
          {...LETTER_FADE}
          style={{ position: "absolute" }}
          className="absolute top-[7.014vw] left-1/2 w-[46.319vw] -translate-x-1/2 justify-center text-center font-general text-[5.556vw] leading-[0.9] font-light max-lg:!static max-lg:w-full max-lg:translate-x-0 max-lg:text-[3.25rem] max-sm:text-[2.375rem]"
        >
          {TITLE}
        </TextEngine>
      </LineBlur>

      {/* Bottom cluster — support copy, dividers, stat band. */}
      <div className="absolute inset-x-0 bottom-0 h-[16.181vw] max-lg:!static max-lg:flex max-lg:h-auto max-lg:flex-col max-lg:gap-[1.5rem]">
        <LineBlur
          active={active}
          unit="word"
          letters={wordCount(SUPPORT)}
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
            className="absolute top-0 left-1/2 w-[29.097vw] -translate-x-1/2 justify-center text-center font-general text-[1.111vw] leading-[1.2] max-lg:!static max-lg:w-full max-lg:translate-x-0 max-lg:justify-start max-lg:text-left max-lg:text-[0.9375rem] max-sm:text-[0.8125rem]"
          >
            {SUPPORT}
          </TextEngine>
        </LineBlur>

        {/* The rule across the top of the stat band, and the columns between the
            stats. Both are pure desktop chrome — the grid below carries its own
            divider. */}
        <div className="absolute inset-x-0 top-[4.792vw] border-t border-white/20 max-lg:hidden" />
        {DIVIDERS.map((left) => (
          <div
            key={left}
            className="absolute top-[4.792vw] h-[11.389vw] border-l border-white/20 max-lg:hidden"
            style={{ left }}
          />
        ))}

        {/* `contents` on desktop, so the stats stay direct children of the
            cluster they are absolutely placed in; a real grid below 1024. */}
        <div className="contents max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-[1.25rem] max-lg:gap-y-[1rem] max-lg:border-t max-lg:border-white/20 max-lg:pt-[1.25rem] max-sm:grid-cols-1 max-sm:gap-y-[0.625rem]">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="absolute top-[8.333vw] flex w-[11.111vw] flex-col items-start gap-[0.833vw] border-l border-white/80 pl-[1.111vw] max-lg:static max-lg:w-auto max-lg:gap-[0.25rem] max-lg:pl-[0.625rem] max-sm:flex-row max-sm:items-baseline max-sm:gap-[0.5rem]"
              style={{ left: stat.left }}
            >
              <span className="font-tag text-[2.222vw] leading-none font-light max-lg:text-[1.5rem] max-sm:text-[1.25rem]">
                {stat.value}
              </span>
              <span className="font-tag text-[1.111vw] leading-[1.2] font-normal max-lg:text-[0.75rem] max-lg:text-white/70">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </animated.div>
  );
};
