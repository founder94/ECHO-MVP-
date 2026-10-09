"use client";

/**
 * The lime square at the end of every call to action — two dots and an arrow.
 *
 * It is the relay path in miniature, so it behaves like one even when nobody
 * is touching it: the dots fill one after the other, and once both are in the
 * arrow sends the packet off the right-hand edge. Then the square rests and
 * a fresh packet starts collecting. That is the page's own sentence told in
 * 49 pixels.
 *
 * Under the pointer the loop stops and the square holds: both dots lit, the
 * arrow leaning forward. A packet ready to go, rather than one going — it
 * leaves when the button is actually pressed, and an idle animation running
 * under the cursor reads as the button ignoring the hand on it.
 *
 * Drawn here rather than loaded as a file: the dots and the arrow have to
 * move apart, and the exported SVG is one path.
 */

import { animated, to, useSpring } from "@react-spring/web";
import { useEffect } from "react";

import { useArrived } from "@flora/components/common/flight/arrival";

/** A step of the loop, and the breath after the packet is away. */
const BEAT = 420;
const REST = 700;

/** The hand arrives quicker than the loop moves. */
const POISED = { tension: 300, friction: 28 };

const ARROW =
  "M30.6709 20.174C30.8681 19.955 31.2057 19.9378 31.4248 20.1349L35.5312 23.8302L35.9727 24.2267L35.5312 24.6242L31.4248 28.3195C31.2058 28.5164 30.8681 28.4982 30.6709 28.2795C30.474 28.0603 30.4919 27.7227 30.7109 27.5255L33.7832 24.7609H24.498C24.2033 24.7609 23.964 24.5215 23.9639 24.2267C23.964 23.932 24.2033 23.6935 24.498 23.6935H33.7832L30.7109 20.9279C30.4919 20.7307 30.4737 20.3931 30.6709 20.174Z";

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

export interface CtaIconProps {
  className?: string;
  /** True while the button it sits in is under the pointer or focused. */
  firing?: boolean;
}

export const CtaIcon = ({ className = "", firing = false }: CtaIconProps) => {
  const live = useArrived();
  const [{ first, second, sent, poised }, api] = useSpring(() => ({
    first: 0,
    second: 0,
    sent: 0,
    poised: 0,
    config: { tension: 200, friction: 24 },
  }));

  /* The hand holds the square: the packet completes and waits. Letting go
     puts it back to an empty square, and the loop below picks up again. */
  useEffect(() => {
    if (!firing) return;
    api.start({ first: 1, second: 1, sent: 0, poised: 1, config: POISED });
    return () => {
      api.set({ first: 0, second: 0, sent: 0, poised: 0 });
    };
  }, [firing, api]);

  useEffect(() => {
    if (!live || firing) return;
    let stopped = false;

    const run = async () => {
      while (!stopped) {
        api.start({ first: 1 });
        await wait(BEAT);
        if (stopped) return;
        api.start({ second: 1 });
        await wait(BEAT);
        if (stopped) return;
        api.start({ sent: 1 });
        await wait(BEAT);
        if (stopped) return;
        /* Set, not sprung: the next packet starts, it does not rewind. */
        api.set({ first: 0, second: 0, sent: 0 });
        await wait(REST);
      }
    };

    void run();
    return () => {
      stopped = true;
    };
  }, [live, firing, api]);

  return (
    <svg viewBox="0 0 49 49" fill="none" aria-hidden className={className}>
      <rect width="49" height="49" rx="4" fill="#BBFC9E" />
      <animated.circle
        cx="14.2316"
        cy="24.2321"
        r="1.2319"
        fill="#050B14"
        style={{ opacity: first.to((value) => 0.32 + value * 0.68) }}
      />
      <animated.circle
        cx="19.9807"
        cy="24.2321"
        r="1.2319"
        fill="#050B14"
        style={{ opacity: second.to((value) => 0.32 + value * 0.68) }}
      />
      <animated.path
        d={ARROW}
        fill="#050B14"
        style={{
          /* Away on the loop's own clock, forward and bright under the hand. */
          opacity: to([sent, poised], (away, held) =>
            Math.max(1 - away * 0.92, held),
          ),
          transform: to(
            [sent, poised],
            (away, held) => `translateX(${away * 10 + held * 3}px)`,
          ),
        }}
      />
    </svg>
  );
};
