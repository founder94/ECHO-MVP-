"use client";

import { easings, useSpring, type Controller } from "@react-spring/web";
import { useCallback, useRef, useState, type ReactNode } from "react";

import { useMotionOff } from "@vesper/hooks/animation/use-motion-off";
import { LETTER_BLUR, LETTER_FADE, WORD_BLUR, WORD_FADE } from "./reveal";

/**
 * The heading reveal's blur, **once per line instead of once per letter**.
 *
 * `LETTER_REVEAL` used to animate `filter: blur()` on every letter. Each one is
 * then a filter layer of its own, re-rastered every frame of the reveal, over
 * a full-screen WebGL canvas — and the overlays reveal *during* the scroll: the
 * scroll test dropped half the frames of "Motion instead of chrome" arriving
 * (desktop, 0.7 s). The letters keep their staggered fade (`LETTER_FADE`,
 * now opacity only); the blur is one filter on the engine's own box, sharpening
 * over the same span the wave takes to cross the line.
 *
 * The engine renders its own container, so the filter is written to it by
 * reference — `display: contents` keeps this wrapper out of the layout. At rest
 * the filter is removed entirely, so a settled heading is not a filter layer.
 *
 * Body copy takes the same treatment with `unit="word"` (D-031): `WORD_REVEAL`
 * blurred every word, ~25 filter layers per paragraph re-rastered each frame on
 * a phone — the scroll test's 200–500 ms frames over the overlays and the
 * white cards. The words keep their staggered rise and fade (`WORD_FADE`); the
 * 8 px blur is one filter on the paragraph, over the span the wave crosses it.
 */

/** A reveal unit — the engine's letters or its words. */
type Unit = "letter" | "word";

const UNIT = {
  letter: {
    blur: LETTER_BLUR,
    span: (n: number) =>
      LETTER_FADE.letterConfig.duration + LETTER_FADE.letterStagger * n,
  },
  word: {
    blur: WORD_BLUR,
    span: (n: number) =>
      WORD_FADE.wordConfig.duration + WORD_FADE.wordStagger * n,
  },
} as const;

/** Words in a string, as the engine splits them. */
export const wordCount = (text: string) => text.trim().split(/\s+/).length;
/** `onTextStart` as the engine calls it; only the controller is read. */
type EngineStart = (
  type: string,
  result: unknown,
  ctrl: Controller<Record<string, unknown>>,
) => void;

/**
 * `LineBlur` for an engine that plays itself — in view, not on an `enabled`
 * flag (the closing cards and the footer). The line follows the engine's own
 * letters: the first letter that starts toward opacity 1 sharpens the line,
 * the first that starts toward 0 (a `mode="always"` reveal going back out)
 * blurs it again. Hand `onTextStart` to the engine; it is stable, as it must
 * be — the engine reads its callbacks once, when it creates its springs.
 */
export const FollowLineBlur = ({
  letters,
  unit = "letter",
  children,
}: {
  /** Units in the line — letters, or words with `unit="word"`. */
  letters: number;
  unit?: Unit;
  children: (onTextStart: EngineStart) => ReactNode;
}) => {
  const [active, setActive] = useState(false);
  const onTextStart = useCallback<EngineStart>(
    (type, _result, ctrl) => {
      if (type !== unit) return;
      const goal = (ctrl.springs as { opacity?: { goal?: unknown } }).opacity
        ?.goal;
      if (typeof goal !== "number") return;
      const next = goal > 0.5;
      setActive((prev) => (prev === next ? prev : next));
    },
    [unit],
  );
  return (
    <LineBlur active={active} letters={letters} unit={unit}>
      {children(onTextStart)}
    </LineBlur>
  );
};

export const LineBlur = ({
  active,
  letters,
  unit = "letter",
  delay = 0,
  children,
}: {
  /** The engine's own `enabled`. */
  active: boolean;
  /** Units in the line — the wave's length sets the blur's duration. */
  letters: number;
  /** What the engine staggers: letters (headings) or words (body copy). */
  unit?: Unit;
  /** The engine's `delayIn`. */
  delay?: number;
  children: ReactNode;
}) => {
  const wrapper = useRef<HTMLSpanElement>(null);
  const motionOff = useMotionOff();

  const write = (blur: number) => {
    const line = wrapper.current?.firstElementChild as HTMLElement | null;
    if (!line) return;
    line.style.filter = blur < 0.05 ? "" : `blur(${blur}px)`;
  };

  useSpring({
    blur: active || motionOff ? 0 : UNIT[unit].blur,
    delay: active ? delay : 0,
    config: {
      duration: UNIT[unit].span(letters),
      easing: easings.easeOutQuint,
    },
    onChange: ({ value }) => write(value.blur),
  });

  return (
    <span ref={wrapper} className="contents">
      {children}
    </span>
  );
};
