"use client";

import { animated, config, useInView, useSpring } from "@react-spring/web";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { RobotText as TextEngine } from "@vesper/components/common/robot-text";

import { Inview } from "@vesper/components/common/robot-inview";
import { PressableButton } from "@vesper/components/ui/pressable";
import { useMotionOff } from "@vesper/hooks/animation/use-motion-off";
import type { FaqCopy } from "@vesper/data/mocks/home";
import { LIGHT_ROW } from "@vesper/lib/springs/interaction";
import { FollowLineBlur } from "../line-blur";
import { CARD_REVEAL, LETTER_FADE, UNIT_REVEAL } from "../reveal";

interface FaqItemProps {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}

/**
 * One accordion row — 2026-10-09 대표 승인: 흰 카드 없이 장면 위 투명 아코디언(밝은 글자 · 흰 20% 구분선).
 *
 * Height is sprung, not transitioned, so the panel is measured before paint (the
 * first open never flashes). The `+` marker rotates 45° into an `×` on open.
 */
const FaqItem = ({ question, answer, open, onToggle }: FaqItemProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const id = useId();

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const measure = () => setHeight(panel.scrollHeight);
    measure();

    // Also re-measures when the viewport crosses a breakpoint and the answer
    // reflows to a different number of lines.
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [answer]);

  const reveal = useSpring({
    height: open ? height : 0,
    opacity: open ? 1 : 0,
    config: config.gentle,
  });

  const marker = useSpring({ rotate: open ? 45 : 0, config: config.stiff });

  return (
    <li className="border-b border-white/20">
      <h3 className="m-0">
        {/* The whole row is the control, so it takes the hover — a question that
            only lights up when the cursor is exactly on its text reads as broken.
            `LIGHT_ROW` tints with a faint light: this sits on the dark scene. */}
        <PressableButton
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          interaction={LIGHT_ROW}
          className="flex w-full items-center justify-between gap-[1.111vw] px-[0.75vw] py-[1.667vw] text-left max-lg:gap-[1rem] max-lg:px-[0.5rem] max-lg:py-[1rem]"
        >
          <span className="font-tag text-[1.111vw] leading-[1.2] uppercase max-lg:text-[0.875rem]">
            {question}
          </span>
          <animated.span
            aria-hidden
            className="relative block size-[1.389vw] shrink-0 max-lg:size-[1rem]"
            style={marker}
          >
            <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-white" />
            <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-white" />
          </animated.span>
        </PressableButton>
      </h3>

      <animated.div
        id={id}
        role="region"
        className="overflow-hidden"
        style={reveal}
        aria-hidden={!open}
      >
        <div ref={panelRef} className="pb-[1.667vw] max-lg:pb-[1rem]">
          <p className="m-0 w-[33.958vw] font-general text-[0.972vw] leading-[1.55] break-keep text-white/85 max-lg:w-full max-lg:text-[0.875rem]">
            {answer}
          </p>
        </div>
      </animated.div>
    </li>
  );
};

/**
 * The mark above the title — spins slowly clockwise.
 *
 * The spin is gated on in-view. `loop: true` never rests, so left ungated it
 * keeps a spring (and therefore the shared rAF loop) alive for the entire page,
 * including the whole scroll-driven scene above it, to turn an 18px asterisk
 * nobody can see.
 */
const FaqAsterisk = () => {
  const [ref, inView] = useInView();

  // Under reduced motion / the robot form react-spring skips animation, and a
  // loop would restart in the same tick forever once in view.
  const motionOff = useMotionOff();
  const spin = useSpring({
    from: { rotate: 0 },
    to: { rotate: 360 },
    loop: !motionOff,
    pause: !inView,
    config: { duration: 9000 },
  });

  return (
    <animated.img
      ref={ref}
      src="/vesper/assets/sections/asterisk-light.svg"
      alt=""
      className="block size-[1.806vw] max-lg:size-[1.5rem]"
      style={spin}
    />
  );
};

export interface FaqSectionProps {
  copy: FaqCopy;
}

/**
 * "Frequently asked" — the Figma FAQ block. 2026-10-09 대표 승인: 흰 카드를 없애고
 * 장면 위에 바로(밝은 글자 · 얇은 윗줄 · 투명 아코디언 — 펼치면 아래 내용이 밀려 내려간다),
 * with an asterisk mark, centred title, and the accordion. The card scales up, unblurs,
 * and tilts on the horizontal axis as it arrives (`CARD_REVEAL` on the perspective
 * wrapper). Desktop measurements are the Figma pixels in `vw` (÷14.4). See
 * ADR-0026; the responsive stack is ADR-0029.
 *
 */
export const FaqSection = ({ copy }: FaqSectionProps) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      aria-label={copy.title}
      className="mx-auto w-[96.667vw] [perspective:1400px] max-lg:w-auto max-lg:px-6 max-[360px]:px-5"
    >
      <Inview
        mode="always"
        immediateOut={false}
        from={CARD_REVEAL.from}
        to={CARD_REVEAL.to}
        config={CARD_REVEAL.config}
        className="vesper-soft vesper-veil relative flex w-full origin-bottom flex-col items-center border-t border-white/15 pt-[2.222vw] pb-[3.056vw] text-white max-lg:pt-[1.5rem] max-lg:pb-[2.5rem]"
      >
        <FaqAsterisk />

        <FollowLineBlur letters={copy.title.length}>
          {(onTextStart) => (
            <TextEngine
              tag="h2"
              mode="always"
              immediateOut={false}
              {...LETTER_FADE}
              onTextStart={onTextStart}
              className="mt-[1.111vw] justify-center text-center font-general text-[5.556vw] leading-[1.15] font-normal break-keep max-lg:mt-[1rem] max-lg:text-[2.75rem] max-sm:text-[2.125rem]"
            >
              {copy.title}
            </TextEngine>
          )}
        </FollowLineBlur>

        <Inview
          tag="ul"
          mode="always"
          immediateOut={false}
          from={UNIT_REVEAL.from}
          to={UNIT_REVEAL.to}
          config={UNIT_REVEAL.config}
          className="m-0 mt-[4.167vw] flex w-[42.778vw] list-none flex-col border-t border-white/20 p-0 max-lg:mt-[2rem] max-lg:w-full"
        >
          {copy.items.map((item, index) => (
            <FaqItem
              key={item.question}
              question={item.question}
              answer={item.answer}
              open={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </Inview>
      </Inview>
    </section>
  );
};
