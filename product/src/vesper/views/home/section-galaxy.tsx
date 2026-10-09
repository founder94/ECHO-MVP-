"use client";

import { animated } from "@react-spring/web";
import { useEffect, useMemo, useState } from "react";

import { sceneTimeline } from "@vesper/lib/scene/timeline";
import { HOME_V2 } from "@/pages/do-it/brand-home/copy";
import { hiddenWhenClear, smoothstep, useSceneClock } from "./overlay";
import { UNIT_REVEAL } from "./reveal";
import { Inview } from "@vesper/components/common/robot-inview";

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

// 2026-10-09 대표 「홈페이지 수정사항 — 최신 정정」 2 회전 카드: 카드마다 짧은 문장 하나(제목·긴 설명 0). 은하 장면의 세 칸이 그 카드다.
const CARDS = HOME_V2.cards;
/** 세 칸의 데스크톱 x(원본 네 칸 간격을 셋으로 — 1440 기준 ÷14.4). */
const CARD_LEFT = ["6.944vw", "41.5vw", "76vw"];

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
      {/* Bottom cluster — 가로 줄 + 세 카드(문장 하나씩). */}
      <div className="absolute inset-x-0 bottom-0 h-[16.181vw] max-lg:!static max-lg:flex max-lg:h-auto max-lg:flex-col max-lg:gap-[1.5rem]">
        <div className="absolute inset-x-0 top-[4.792vw] border-t border-white/20 max-lg:hidden" />
        <div className="contents max-lg:flex max-lg:flex-col max-lg:gap-y-[1rem] max-lg:border-t max-lg:border-white/20 max-lg:pt-[1.25rem]">
          {CARDS.map((line, index) => (
            <Inview
              key={line}
              mode="always"
              enabled={active}
              immediateOut={false}
              delayIn={200 + index * 120}
              {...UNIT_REVEAL}
              className="absolute top-[8.333vw] flex w-[17vw] flex-col items-start gap-[0.833vw] border-l border-white/80 pl-[1.111vw] max-lg:static max-lg:w-auto max-lg:gap-[0.25rem] max-lg:pl-[0.625rem]"
              style={{ left: CARD_LEFT[index] }}
            >
              <span className="font-tag text-[1.111vw] leading-none text-white/60 max-lg:text-[0.75rem]">{String(index + 1).padStart(2, "0")}</span>
              <span className="font-general text-[1.944vw] leading-[1.3] break-keep max-lg:text-[1.375rem]">{line}</span>
            </Inview>
          ))}
        </div>
      </div>
    </animated.div>
  );
};
