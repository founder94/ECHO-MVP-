"use client";

import Image from "next/image";
import { RobotText as TextEngine } from "@vesper/components/common/robot-text";

import { Inview } from "@vesper/components/common/robot-inview";
import { HOME_V2 } from "@/pages/do-it/brand-home/copy";
import { FollowLineBlur, wordCount } from "../line-blur";
import {
  CARD_REVEAL,
  LETTER_FADE,
  MASK_REVEAL,
  UNIT_REVEAL,
  WORD_FADE,
} from "../reveal";

/**
 * First closing section — the Figma "A living interface" block.
 *
 * 2026-10-09 대표 승인: 흰 카드를 없애고 글·사진을 WebGL 장면 위에 바로 놓는다(밝은 글자 · 얇은 윗줄 · 여백으로만 구분).
 * 고정 높이(44.167vw)도 버리고 내용 높이로 흐른다: 데스크톱은 2열 격자(왼쪽 제목 + [01][02] 두 단, 오른쪽 사진),
 * 1024px 아래(ADR-0029)는 세로 쌓기. 도착 연출(CARD_REVEAL: 커지며 또렷해지고 기울기 풀림)과
 * 글 연출(제목 글자 단위 · 본문 단어 단위 · 사진 위→아래 마스크)은 원본 그대로 둔다.
 * Desktop measurements are the Figma pixels in `vw` (÷14.4).
 */

// 2026-10-09 대표 「홈페이지 수정사항 — 최신 정정」 4 영상 페이지 ② 확인·정정: 제목 하나 + 설명 두 줄.
const PAGE = HOME_V2.pages[1];
const BODY_ONE = PAGE.lines[0];
const BODY_TWO = PAGE.lines[1];

// 2026-10-09 대표 「최신 채택안」: 「어떻게 만나나요?」(이용 안내 승인 문장). 사진 칸은 승인 브랜드 그림(이야기 09) — 실제 ECHO 화면은 자료 미확보.
const TITLE = PAGE.title;

export const FinancialSection = () => {
  return (
    <section id="financial" className="relative mx-auto w-[96.667vw] [perspective:1400px] max-lg:w-auto max-lg:px-6 max-[360px]:px-5">
      <Inview
        mode="always"
        immediateOut={false}
        from={CARD_REVEAL.from}
        to={CARD_REVEAL.to}
        config={CARD_REVEAL.config}
        className="vesper-soft vesper-veil relative grid w-full origin-bottom grid-cols-[minmax(0,1fr)_27.361vw] gap-x-[2.222vw] gap-y-[2.222vw] border-t border-white/15 pt-[2.222vw] text-white max-lg:flex max-lg:flex-col max-lg:gap-[1rem] max-lg:pt-[1.5rem]"
      >
        <FollowLineBlur letters={TITLE.length}>
          {(onTextStart) => (
            <TextEngine
              tag="h2"
              mode="always"
              immediateOut={false}
              {...LETTER_FADE}
              onTextStart={onTextStart}
              className="col-start-1 row-start-1 m-0 w-[41.875vw] font-general text-[5.556vw] leading-[1.15] font-normal break-keep max-lg:w-full max-lg:text-[2.75rem] max-sm:text-[2.125rem]"
            >
              {TITLE}
            </TextEngine>
          )}
        </FollowLineBlur>

        <Inview
          mode="always"
          immediateOut={false}
          from={MASK_REVEAL.from}
          to={MASK_REVEAL.to}
          config={MASK_REVEAL.config}
          className="relative col-start-2 row-span-2 row-start-1 aspect-[1200/1495] w-full max-lg:aspect-auto max-lg:h-[20rem] max-sm:h-[15rem]"
        >
          {/* `next/image` shim: the source is a 1200×1495 image that never renders wider than ~27vw. */}
          <Image
            src="/brand/stories/story-09.webp"
            alt="창밖의 별을 바라보는 사람 — 어떤 사람을 만나고 싶으세요?"
            fill
            sizes="(max-width: 1023px) 100vw, 28vw"
            className="object-cover"
          />
        </Inview>

        <div className="col-start-1 row-start-2 grid grid-cols-2 gap-x-[2.222vw] self-end max-lg:grid-cols-1 max-lg:gap-y-[1rem]">
          <div className="flex flex-col gap-[0.833vw] max-lg:gap-[0.5rem]">
            <Inview
              mode="always"
              immediateOut={false}
              from={UNIT_REVEAL.from}
              to={UNIT_REVEAL.to}
              config={UNIT_REVEAL.config}
              className="font-general text-[1.111vw] leading-[1.2] text-white/70 max-lg:text-[0.875rem]"
            >
              [ 01 ]
            </Inview>
            <FollowLineBlur unit="word" letters={wordCount(BODY_ONE)}>
              {(onTextStart) => (
                <TextEngine
                  onTextStart={onTextStart}
                  tag="p"
                  mode="always"
                  immediateOut={false}
                  delayIn={120}
                  {...WORD_FADE}
                  className="m-0 w-[20.347vw] font-general text-[1.111vw] leading-[1.55] break-keep max-lg:w-full max-lg:text-[0.9375rem] max-sm:text-[0.875rem]"
                >
                  {BODY_ONE}
                </TextEngine>
              )}
            </FollowLineBlur>
          </div>

          <div className="flex flex-col gap-[0.833vw] max-lg:gap-[0.5rem]">
            <Inview
              mode="always"
              immediateOut={false}
              from={UNIT_REVEAL.from}
              to={UNIT_REVEAL.to}
              config={UNIT_REVEAL.config}
              className="font-general text-[1.111vw] leading-[1.2] text-white/70 max-lg:text-[0.875rem]"
            >
              [ 02 ]
            </Inview>
            <FollowLineBlur unit="word" letters={wordCount(BODY_TWO)}>
              {(onTextStart) => (
                <TextEngine
                  onTextStart={onTextStart}
                  tag="p"
                  mode="always"
                  immediateOut={false}
                  delayIn={180}
                  {...WORD_FADE}
                  className="m-0 w-[20.347vw] font-general text-[1.111vw] leading-[1.55] break-keep max-lg:w-full max-lg:text-[0.9375rem] max-sm:text-[0.875rem]"
                >
                  {BODY_TWO}
                </TextEngine>
              )}
            </FollowLineBlur>
          </div>
        </div>
      </Inview>
    </section>
  );
};
