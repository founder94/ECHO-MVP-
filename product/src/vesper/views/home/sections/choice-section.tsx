"use client";

import { RobotText as TextEngine } from "@vesper/components/common/robot-text";

import { Inview } from "@vesper/components/common/robot-inview";
import { HOME_V2 } from "@/pages/do-it/brand-home/copy";
import { FollowLineBlur } from "../line-blur";
import { CARD_REVEAL, LETTER_FADE, UNIT_REVEAL } from "../reveal";

/**
 * 2026-10-09 대표 「홈페이지 수정사항 — 최신 정정」 4 영상 페이지 ③ 직접 선택: 제목 하나 + 설명 두 줄.
 * 흰 판 0 — 장면 위에 바로(밝은 글자 · 얇은 윗줄 · 옅은 그라데이션). 도착 연출은 ②(어떻게)와 같은 CARD_REVEAL.
 */
const PAGE = HOME_V2.pages[2];

export const ChoiceSection = () => (
  <section id="choice-page" className="relative mx-auto w-[96.667vw] [perspective:1400px] max-lg:w-auto max-lg:px-6 max-[360px]:px-5">
    <Inview
      mode="always"
      immediateOut={false}
      from={CARD_REVEAL.from}
      to={CARD_REVEAL.to}
      config={CARD_REVEAL.config}
      className="vesper-soft vesper-veil relative flex w-full origin-bottom flex-col gap-[1.667vw] border-t border-white/15 pt-[2.222vw] pb-[2.222vw] text-white max-lg:gap-[1rem] max-lg:pt-[1.5rem]"
    >
      <FollowLineBlur letters={PAGE.title.length}>
        {(onTextStart) => (
          <TextEngine
            tag="h2"
            mode="always"
            immediateOut={false}
            {...LETTER_FADE}
            onTextStart={onTextStart}
            className="m-0 w-[41.875vw] font-general text-[5.556vw] leading-[1.15] font-normal break-keep max-lg:w-full max-lg:text-[2.75rem] max-sm:text-[2.125rem]"
          >
            {PAGE.title}
          </TextEngine>
        )}
      </FollowLineBlur>
      <Inview
        mode="always"
        immediateOut={false}
        delayIn={120}
        from={UNIT_REVEAL.from}
        to={UNIT_REVEAL.to}
        config={UNIT_REVEAL.config}
        className="flex w-[41.875vw] flex-col gap-[0.4vw] font-general text-[1.111vw] leading-[1.55] break-keep max-lg:w-full max-lg:text-[0.9375rem]"
      >
        {PAGE.lines.map((line) => (
          <p key={line} className="m-0">{line}</p>
        ))}
      </Inview>
    </Inview>
  </section>
);
