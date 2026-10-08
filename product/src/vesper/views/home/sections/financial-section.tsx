"use client";

import Image from "next/image";
import { RobotText as TextEngine } from "@vesper/components/common/robot-text";

import { Inview } from "@vesper/components/common/robot-inview";
import { FollowLineBlur, wordCount } from "../line-blur";
import {
  CARD_REVEAL,
  LETTER_FADE,
  MASK_REVEAL,
  UNIT_REVEAL,
  WORD_FADE,
} from "../reveal";

/**
 * First closing section — the Figma "A living interface" card.
 *
 * A white card inset from the viewport edges, so the scene's shader stays visible
 * around it as the card floats up over the still-drawing scene. The card is in
 * flow and shorter than the viewport, so it scrolls in and out. It scales up,
 * unblurs, and tilts on the horizontal axis as it arrives (`CARD_REVEAL` on the
 * perspective wrapper), and its copy reveals over it (`mode="always"`, so both
 * reverse as the card leaves): the title letter-by-letter, the bodies
 * word-by-word, the labels fade-rise, and the photo unmasks top→bottom.
 * Desktop measurements are the Figma pixels in `vw` (÷14.4).
 *
 * Below 1024px (ADR-0029) the fixed-height card and its absolutely-placed columns
 * give way to a padded stack that grows with its content.
 *
 * > The card used to carry a 30px backdrop blur. Its background is opaque
 * > (`bg-white`), so the blur was never visible — it only cost a full-card
 * > backdrop-filter pass, every frame, over a live WebGL canvas. (Written out
 * > rather than quoted as a class name: Tailwind scans raw file text, so even a
 * > mention in a comment keeps the dead rule in the stylesheet.)
 */

const BODY_ONE =
  "앱 스토어에 가지 않아도 돼요. 브라우저에서 홈 화면에 두면 앱처럼 한 번에 열려요. 아이폰은 공유 버튼 → 홈 화면에 추가, 안드로이드는 메뉴 → 홈 화면에 추가.";
const BODY_TWO =
  "설치하지 않아도 웹에서 그대로 쓸 수 있어요. 처음에는 당신의 이야기를 듣는 데서 시작합니다.";

const TITLE = "홈 화면에서 바로 시작하세요.";

export const FinancialSection = () => {
  return (
    <section className="relative mx-auto h-[44.167vw] w-[96.667vw] [perspective:1400px] max-lg:h-auto max-lg:w-[calc(100%-3rem)] max-sm:w-[calc(100%-2rem)]">
      <Inview
        mode="always"
        immediateOut={false}
        from={CARD_REVEAL.from}
        to={CARD_REVEAL.to}
        config={CARD_REVEAL.config}
        className="relative h-full w-full origin-bottom border border-white/10 bg-white text-black max-lg:flex max-lg:flex-col max-lg:gap-[1rem] max-lg:p-[1.5rem] max-sm:p-[1.25rem]"
      >
        <FollowLineBlur letters={TITLE.length}>
          {(onTextStart) => (
            <TextEngine
              tag="h2"
              mode="always"
              immediateOut={false}
              {...LETTER_FADE}
              onTextStart={onTextStart}
              style={{ position: "absolute" }}
              className="absolute top-[2.222vw] left-[2.222vw] w-[41.875vw] font-general text-[5.556vw] leading-[0.9] font-light max-lg:!static max-lg:w-full max-lg:text-[2.75rem] max-sm:text-[2.125rem]"
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
          className="absolute top-[2.222vw] right-[2.222vw] h-[39.722vw] w-[27.361vw] max-lg:relative max-lg:h-[20rem] max-lg:w-full max-sm:h-[15rem]"
        >
          {/* `next/image`, not a raw `<img>`: the source is a 1200×1495 PNG (668 KB)
              that never renders wider than ~27vw, and the project already
              configures AVIF/WebP + device sizes in `next.config.ts`. Served raw it
              was the single heaviest asset on the page — heavier than the scene. */}
          <Image
            src="/brand/stories/story-07.webp"
            alt="창밖의 지구를 바라보는 우주인"
            fill
            sizes="(max-width: 1023px) 100vw, 28vw"
            className="object-cover"
          />
        </Inview>

        <Inview
          mode="always"
          immediateOut={false}
          from={UNIT_REVEAL.from}
          to={UNIT_REVEAL.to}
          config={UNIT_REVEAL.config}
          className="absolute top-[34.236vw] left-[2.222vw] font-general text-[1.111vw] leading-[1.2] max-lg:static max-lg:mt-[0.5rem] max-lg:text-[0.875rem]"
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
              style={{ position: "absolute" }}
              className="absolute top-[36.667vw] left-[2.222vw] w-[20.347vw] font-general text-[1.111vw] leading-[1.2] max-lg:!static max-lg:w-full max-lg:text-[0.9375rem] max-sm:text-[0.875rem]"
            >
              {BODY_ONE}
            </TextEngine>
          )}
        </FollowLineBlur>

        <Inview
          mode="always"
          immediateOut={false}
          from={UNIT_REVEAL.from}
          to={UNIT_REVEAL.to}
          config={UNIT_REVEAL.config}
          className="absolute top-[34.236vw] left-[24.792vw] font-general text-[1.111vw] leading-[1.2] max-lg:static max-lg:mt-[0.5rem] max-lg:text-[0.875rem]"
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
              style={{ position: "absolute" }}
              className="absolute top-[36.667vw] left-[24.792vw] w-[20.347vw] font-general text-[1.111vw] leading-[1.2] max-lg:!static max-lg:w-full max-lg:text-[0.9375rem] max-sm:text-[0.875rem]"
            >
              {BODY_TWO}
            </TextEngine>
          )}
        </FollowLineBlur>
      </Inview>
    </section>
  );
};
