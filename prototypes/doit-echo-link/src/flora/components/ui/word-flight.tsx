"use client";

/**
 * Copy that arrives a word — or a letter — at a time.
 *
 * Three readings. A heading's words **scatter**: they come in from different
 * corners, at different distances, and settle into their places — packets
 * crossing a network arrive out of order and are put back in order, and that is
 * the one thing this site is about. A paragraph's words **rise**: the same idea
 * at a whisper, because a body of text with a dozen words flying at it from all
 * sides is unreadable. And **letters** rises a glyph at a time, out of focus
 * and out of nothing, which is what the page's own heading does.
 *
 * `letters` is the only mode that costs an element per character, so it is for
 * a line of display type and not for a paragraph. The blur is what makes it
 * read as coming into being rather than sliding up: without it, a letter that
 * fades while it moves is just a letter moving.
 *
 * The offsets are not random. A random field would differ between the server
 * and the browser and would change on every re-render; these come from the
 * word's own index, so the same word always arrives from the same place.
 *
 * Swashes are counted, not guessed: `SwashText` takes its hand-set kerning as
 * a list in the order the swashes appear, so each word is handed the slice of
 * that list its own capital S's claim. A single pair is not a list of one — it
 * is the reading for every swash in the text, and it goes to every word whole.
 */

import {
  animated,
  easings,
  useSprings,
  type Interpolation,
  type SpringValue,
} from "@react-spring/web";
import { useEffect } from "react";

import { SwashText, type SwashKern } from "@flora/components/ui/swash-text";
import { useArrived } from "@flora/components/common/flight/arrival";
import { useRobot } from "@flora/components/common/robot-view";
import { useIdleReady } from "@flora/hooks/use-idle-ready";

export interface WordFlightProps {
  text: string;
  /** How the copy comes in. */
  mode?: "scatter" | "rise" | "letters";
  /** Added to every word's delay — how a second line follows a first. */
  offset?: number;
  className?: string;
  leadClassName?: string;
  scriptClassName?: string;
  kerning?: SwashKern | readonly SwashKern[];
  /**
   * **Scroll-driven instead of timed.** A value in ms of the flight's own
   * time, set by the caller from the scroll: each word or letter sits wherever
   * its entrance would have got to by then, on the same stagger and the same
   * curve the timed flight uses (`SCRUB`). Run it backwards and the copy leaves
   * as the exact inverse of its arrival — last in, first out. `flightLength`
   * says how long the clock has to run for the whole of it to land.
   *
   * Without it the flight is timed and starts when the screen arrives.
   */
  clock?: SpringValue<number>;
}

const STEP = { scatter: 66, rise: 34, letters: 38 };
const CONFIG = {
  scatter: { tension: 180, friction: 26 },
  rise: { tension: 210, friction: 30 },
  /* The one that is **not** a spring. A letter has to come in quickly and then
     take a long time to arrive — most of its travel spent over the last of the
     distance, which is what makes the line read as settling rather than as
     landing. No damping gives that: a spring's tail is an exponential and it is
     the same shape however it is tuned. A quintic ease-out is, and the blur
     going with it is what the eye reads the slowing on.

     It is also why a letter is in the air for well over a second at a 38 ms
     step: a dozen of them are slowing together, and the wave is the overlap. */
  letters: { duration: 1400, easing: easings.easeOutQuint },
};

/**
 * The timed flight's curves, as durations — what a scroll-driven one plays.
 * The letters' is the timed one exactly; the word modes are springs when
 * timed, and these are the shapes those springs settle in.
 */
const SCRUB = {
  scatter: { duration: 900, easing: easings.easeOutCubic },
  rise: { duration: 700, easing: easings.easeOutCubic },
  letters: { duration: 1400, easing: easings.easeOutQuint },
};

/** Words keep their spaces as tokens — see `WordFlight`. */
const splitWords = (text: string) =>
  text.split(/(\s+)/).filter((part) => part.length > 0);

/** How many units a text flies in — letters, or word-and-space tokens. */
const unitsOf = (text: string, mode: NonNullable<WordFlightProps["mode"]>) =>
  mode === "letters"
    ? [...text].filter((char) => !/\s/.test(char)).length
    : splitWords(text).length;

/**
 * How much flight time a text takes to land whole, in ms — the clock a
 * scroll-driven flight has to run to. `offset` is the same one the flight is
 * given.
 */
export const flightLength = (
  text: string,
  mode: NonNullable<WordFlightProps["mode"]> = "rise",
  offset = 0,
) =>
  offset +
  Math.max(0, unitsOf(text, mode) - 1) * STEP[mode] +
  SCRUB[mode].duration;

/** How far a letter rises, in rem, and how far out of focus it starts, in px. */
const LETTER_RISE = 0.85;
const LETTER_BLUR = 7;

/**
 * A word's own corner, in rem. Deterministic: three coprime multipliers give
 * a spread that never repeats over a line and never needs a random number.
 */
const cornerOf = (index: number) => ({
  x: (((index * 37) % 13) / 6 - 1) * 1.6,
  y: (((index * 53) % 11) / 5 - 1) * 1.1,
});

/**
 * The swash readings, split per word — one pair for the whole text, or a list
 * read swash by swash. Shared by the flying and the resting forms.
 */
const readKerning = (words: string[], kerning: WordFlightProps["kerning"]) => {
  const whole =
    kerning && typeof kerning[0] === "string" ? (kerning as SwashKern) : null;
  const list = whole
    ? undefined
    : (kerning as readonly SwashKern[] | undefined);

  /* Each word takes the swash readings its own capital S's account for —
     folded rather than counted up in place, so nothing is reassigned while
     the component renders. */
  const slices = words.reduce<{
    seen: number;
    out: (readonly SwashKern[] | undefined)[];
  }>(
    (carry, word) => {
      if (/^\s+$/.test(word))
        return { ...carry, out: [...carry.out, undefined] };
      const count = [...word].filter((char) => char === "S").length;
      const slice = list?.slice(carry.seen, carry.seen + count);
      return {
        seen: carry.seen + count,
        out: [...carry.out, slice && slice.length > 0 ? slice : undefined],
      };
    },
    { seen: 0, out: [] },
  ).out;
  return { whole, slices };
};

const FlyingWords = ({
  text,
  mode = "rise",
  offset = 0,
  className = "",
  leadClassName,
  scriptClassName,
  kerning,
  clock,
}: WordFlightProps) => {
  const live = useArrived();
  /* Split on the space, keep the space: the design sets a double space after
     some swashes and that room is the glyph's, not a typo to collapse. */
  const words = splitWords(text);

  /* One pair covers the text, a list is read swash by swash — the same two
     readings `SwashText` takes, told apart the same way. */
  const { whole, slices } = readKerning(words, kerning);

  /* One spring per letter in `letters`, per word otherwise. Counted off the
     copy rather than off what `SwashText` emits, because the count has to be
     known before anything renders. */
  const count = unitsOf(text, mode);

  const [springs, api] = useSprings(count, () => ({
    landed: 0,
    config: CONFIG[mode],
  }));

  useEffect(() => {
    /* Driven by the scroll, the springs are not what is shown. */
    if (clock) return;
    /* **Backwards, last word first.** A screen leaving in reverse takes its
       arrival back (see `ScreenFade`'s `inverse` exit), and what the reader
       watched assemble has to come apart the way it went together — which
       means the stagger runs the other way too, not just the springs. */
    if (!live) {
      api.start((index) => ({
        landed: 0,
        delay: (count - 1 - index) * STEP[mode],
        config: CONFIG[mode],
      }));
      return;
    }
    api.start((index) => ({
      landed: 1,
      delay: offset + index * STEP[mode],
      config: CONFIG[mode],
    }));
  }, [live, api, count, mode, offset, clock]);

  /** How far unit `index` has landed, 0–1 — off the clock, or off its spring. */
  const landedOf = (index: number): Interpolation<number, number> => {
    if (!clock) return springs[index].landed.to((value) => value);
    const { duration, easing } = SCRUB[mode];
    return clock.to((time) =>
      easing(
        Math.min(
          1,
          Math.max(0, (time - offset - index * STEP[mode]) / duration),
        ),
      ),
    );
  };

  if (mode === "letters") {
    /* Where each word's letters start in the line's own count, worked out
       before anything renders: the wave has to carry through the spaces rather
       than restart at every one of them, and a counter ticked up while
       rendering is a counter that is wrong on the second pass. */
    const starts = words.reduce<number[]>(
      (carry, word) => {
        const last = carry[carry.length - 1] ?? 0;
        return [...carry, last + (/^\s+$/.test(word) ? 0 : [...word].length)];
      },
      [0],
    );

    return (
      <span className={className}>
        {words.map((word, index) => {
          if (/^\s+$/.test(word)) return <span key={index}>{word}</span>;
          return (
            <SwashText
              key={index}
              text={word}
              kerning={whole ?? slices[index]}
              leadClassName={leadClassName}
              scriptClassName={scriptClassName}
              glyph={(node, at) => {
                const letter = starts[index] + at;
                if (!springs[letter]) return node;
                const landed = landedOf(letter);
                return (
                  <animated.span
                    key={letter}
                    className="inline-block whitespace-pre will-change-[filter,transform]"
                    style={{
                      opacity: landed,
                      transform: landed.to(
                        (value) =>
                          `translate3d(0, ${(1 - value) * LETTER_RISE}rem, 0)`,
                      ),
                      filter: landed.to(
                        (value) => `blur(${(1 - value) * LETTER_BLUR}px)`,
                      ),
                    }}
                  >
                    {node}
                  </animated.span>
                );
              }}
            />
          );
        })}
      </span>
    );
  }

  return (
    <span className={className}>
      {words.map((word, index) => {
        if (/^\s+$/.test(word)) return <span key={index}>{word}</span>;
        const from = cornerOf(index);
        const landed = landedOf(index);
        return (
          <animated.span
            key={index}
            className="inline-block whitespace-pre"
            style={{
              opacity: landed,
              transform: landed.to((value) => {
                const away = 1 - value;
                return mode === "scatter"
                  ? `translate3d(${away * from.x}rem, ${away * from.y}rem, 0)`
                  : `translate3d(0, ${away * 0.7}rem, 0)`;
              }),
            }}
          >
            <SwashText
              text={word}
              kerning={whole ?? slices[index]}
              leadClassName={leadClassName}
              scriptClassName={scriptClassName}
            />
          </animated.span>
        );
      })}
    </span>
  );
};

/**
 * The robot form (D-016): the same words in the same spans, at rest — no
 * spring per word or letter to create and hydrate. Six screens of flights were
 * the robot's TBT. They still appear only when the flying form would have
 * landed them — on arrival, or once a scroll clock passes the offset — because
 * a screen that brings itself in is hidden by nothing but its own words.
 */
const RestingWords = ({
  text,
  mode = "rise",
  offset = 0,
  className = "",
  leadClassName,
  scriptClassName,
  kerning,
  clock,
}: WordFlightProps) => {
  const live = useArrived();
  const words = splitWords(text);
  const { whole, slices } = readKerning(words, kerning);
  return (
    <animated.span
      className={className}
      style={{
        opacity: clock
          ? clock.to((time) => (time > offset ? 1 : 0))
          : live
            ? 1
            : 0,
      }}
    >
      {words.map((word, index) => {
        if (/^\s+$/.test(word)) return <span key={index}>{word}</span>;
        const swash = (
          <SwashText
            key={index}
            text={word}
            kerning={whole ?? slices[index]}
            leadClassName={leadClassName}
            scriptClassName={scriptClassName}
            glyph={
              mode === "letters"
                ? (node, at) => (
                    <span key={at} className="inline-block whitespace-pre">
                      {node}
                    </span>
                  )
                : undefined
            }
          />
        );
        // Same boxes as the flying form: a letter wave wraps each letter,
        // the word modes wrap each word.
        return mode === "letters" ? (
          swash
        ) : (
          <span key={index} className="inline-block whitespace-pre">
            {swash}
          </span>
        );
      })}
    </animated.span>
  );
};

/**
 * People get the flying form — but not at hydration for a screen that has not
 * arrived. Until then nothing of its copy is visible either way (every word of
 * the flying form starts at opacity 0, and so does the resting form's line),
 * so the resting spans stand in and the springs are created in an idle period
 * of their own after load (`useIdleReady`). That was most of the hydration
 * task: a spring per word or letter for six screens. A screen that arrives
 * first, or one already live (the preloader), gets its springs at once.
 */
export const WordFlight = (props: WordFlightProps) => {
  const robot = useRobot();
  const live = useArrived();
  // The robot form never flies, so it never queues anything.
  const ready = useIdleReady(live || robot);
  return robot || !ready ? (
    <RestingWords {...props} />
  ) : (
    <FlyingWords {...props} />
  );
};
