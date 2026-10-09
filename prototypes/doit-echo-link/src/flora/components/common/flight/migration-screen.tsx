"use client";

/**
 * The copy screens of the flight — Figma "02 The leak" (4204:3135) and "03
 * Stem" (4208:743).
 *
 * One sentence in two places at once. Everything the screen has to say starts
 * bottom right, one phrase to a line, resting 40 off the corner; the column
 * top left starts empty and fills as the reader scrolls. The phrase in hand
 * shrinks into the gap it leaves at the head of the waiting stack while the
 * same words fade up at the end of the settled text.
 *
 * Both screens set the settled copy small and the waiting stack large, and in
 * the same corners: the hand-over between them is then a change of words, not
 * of the machine, which is what keeps it smooth. They differ only in column
 * widths, which the design draws to the copy each carries. The veils hold
 * throughout: what has settled fades away down the screen, what is coming
 * gains its light.
 */

import { animated, useSpring } from "@react-spring/web";
import { Fragment, useCallback, useRef } from "react";

import { SwashText, type SwashKern } from "@flora/components/ui/swash-text";
import { WordFlight, flightLength } from "@flora/components/ui/word-flight";
import type { MigrationContent } from "@flora/data/mocks/home";
import { useStageProgress } from "@flora/hooks/use-stage-progress";
import { ramp } from "@flora/lib/scene/stage-progress";

export type MigrationScreenProps = Omit<MigrationContent, "window" | "scrim">;

interface Layout {
  /** The settled text, top left. */
  settled: string;
  /** The waiting stack, bottom right. */
  stack: string;
  /**
   * Where the settled column's head sits, if the narrow frames move it off the
   * measure the rest of the flight keeps.
   */
  settledTop?: string;
  /**
   * Where the design has been back over this screen's swashes and kerned them
   * by hand — a reading per column, since the two are set at different sizes
   * and the pair is measured by eye at each.
   */
  kerning?: { settled: SwashKern; stack: SwashKern };
  /**
   * How the waiting stack arrives. A stack that is a queue — phrases waiting
   * to be sent — fills a word at a time; a screen that is one statement set
   * large arrives the way the page's own heading does, a letter at a time
   * out of focus.
   */
  arrive?: "rise" | "letters";
}

/**
 * How far out of focus a phrase goes while it is crossing, in px.
 *
 * It is a **sine over the trip**, sharp at both ends and softest in the middle:
 * a line that is neither in the stack nor in the settled column yet is a line
 * in between two states, and the blur is what says so. At the ends it has to be
 * exactly zero, or the copy never settles into type you can read.
 */
const CROSSING = 5;

/**
 * How far one line of the waiting stack follows the line above it on the way
 * in, in ms — the stack fills from the top down, each line's words rising.
 */
const LINE = 110;

/**
 * The same, for a stack arriving letter by letter: the beat the page's own
 * heading puts between its two lines, so the second follows as the rest of
 * one sentence rather than starting with the first.
 */
const LETTER_LINE = 260;

/** How far along its own crossing phrase `index` is, 0–1. */
const share = (travelled: number, index: number) =>
  Math.min(1, Math.max(0, travelled - index));

/** The blur of a phrase part-way across; none at all at either end. */
const crossing = (along: number) => {
  const amount = Math.sin(Math.PI * along) * CROSSING;
  return amount > 0.01 ? `blur(${amount.toFixed(2)}px)` : "none";
};

const LAYOUTS: Record<MigrationContent["layout"], Layout> = {
  leak: {
    settled:
      "text-copy-aside leading-desc-ko w-[16.5625rem] max-laptop:w-[16.6875rem] max-tablet:w-[18.75rem]",
    stack:
      "text-copy-voice leading-none tracking-voice w-[35.6875rem] max-laptop:w-[32.875rem] max-tablet:w-[38.75rem] max-phone:w-[21.125rem]",
  },
  integrate: {
    settled:
      "text-copy-aside leading-desc-ko w-[22.875rem] max-laptop:w-[18.75rem] max-tablet:w-[18.125rem] max-phone:w-[13.4375rem]",
    stack:
      "text-copy-voice leading-none tracking-voice w-[34.375rem] max-laptop:w-[29.375rem] max-tablet:w-[38.75rem] max-phone:w-[21.875rem]",
    settledTop: "max-laptop:top-[8.25rem] max-tablet:top-[8.0625rem]",
    arrive: "letters",
    kerning: {
      settled: ["tracking-swash-tuck", "tracking-aside-swash"],
      stack: ["tracking-swash-tuck", "tracking-voice-swash"],
    },
  },
  stem: {
    // `whitespace-pre-wrap`: the design sets a double space after the swash in
    // "walkS", which is the room that glyph takes and not a typo to collapse.
    settled:
      "text-copy-aside leading-desc-ko tracking-aside w-[19.875rem] max-laptop:w-[16.6875rem] max-tablet:w-[18.75rem] whitespace-pre-wrap",
    stack:
      "text-copy-voice leading-none tracking-voice w-[34.25rem] max-laptop:w-[32.875rem] max-tablet:w-[38.75rem] max-phone:w-[21.125rem] whitespace-pre-wrap",
  },
};

export const MigrationScreen = ({
  layout,
  settled,
  phrases,
  run,
  scrub,
}: MigrationScreenProps) => {
  const ref = useRef<HTMLDivElement>(null);
  /* A screen with no run is a caption, not a machine: it holds what it was
     given on both sides while the scene does the moving. */
  const [runStart, runEnd] = run ?? [0, 0];
  const look = LAYOUTS[layout];

  /**
   * **One number drives both columns: how many phrases have been travelled.**
   *
   * Every line reads its own share of it — `travelled − index`, clamped to
   * 0–1 — so the line leaving the stack and the same words arriving in the
   * settled column are one value seen twice, on the same frame, in both
   * directions of scroll.
   *
   * It used to be two: a React state for *which* phrase was in hand and a
   * spring for how far along it was. The state lands a render later than the
   * spring, so on every boundary the new phrase's progress was applied to the
   * old phrase's line for a frame — and scrolling back, the line that came
   * back to the stack was a fresh element whose words rose into place all over
   * again. Back and forth over a boundary, that is the stutter. Now every line
   * of both columns is mounted for the whole trip, nothing re-renders while the
   * page scrolls, and nothing is decided at a boundary.
   *
   * Set, never sprung: the scroll is smoothed once, upstream (ADR-0034), and a
   * spring re-targeted every frame rings around a moving target.
   */
  const [{ travelled, clock }, api] = useSpring(() => ({
    travelled: 0,
    clock: 0,
  }));

  /* The stack's own arrival: how each line follows the one above it. */
  const arrive = look.arrive ?? "rise";
  const lineStep = arrive === "letters" ? LETTER_LINE : LINE;

  /* For a screen on the scroll clock, how much flight time lands the whole of
     its copy — the longest of the settled paragraph and every stack line. */
  const whole = Math.max(
    settled ? flightLength(settled, "rise") : 0,
    ...phrases.map((phrase, index) =>
      flightLength(phrase, arrive, index * lineStep),
    ),
  );

  const onProgress = useCallback(
    (progress: number) => {
      if (scrub) {
        /* In over the arrive stretch, out over the depart one — the same
           clock run back down, so the exit is the arrival reversed. */
        const shown = Math.min(
          ramp(scrub.arrive[0], scrub.arrive[1], progress),
          1 - ramp(scrub.depart[0], scrub.depart[1], progress),
        );
        api.set({ clock: shown * whole });
      }
      if (runStart === runEnd) return;
      api.set({ travelled: ramp(runStart, runEnd, progress) * phrases.length });
    },
    [api, phrases.length, runStart, runEnd, scrub, whole],
  );
  const scrubbed = scrub ? clock : undefined;

  useStageProgress(ref, onProgress);

  const travelling = runStart !== runEnd;

  return (
    <div ref={ref} className="absolute inset-0">
      {/* The copy is on the page once, whole, for anything that reads rather
          than looks — the two columns below are some of it twice. */}
      <p className="sr-only">
        {[settled, ...phrases].filter(Boolean).join(" ").replace(/S/g, "s")}
      </p>

      <p
        aria-hidden
        className={`font-display text-foreground-desc max-laptop:top-[8.0625rem] max-laptop:left-8 max-tablet:left-6 max-phone:top-[7.0625rem] max-phone:left-5 absolute top-[11.25rem] left-10 font-semibold uppercase [mask-image:var(--copy-veil-fading)] ${look.settledTop ?? ""} ${look.settled}`}
      >
        {/* 연결 시안: 설명 문장은 따로 한 덩어리(문장 하나 = 한 줄, 넘치면 고르게 두 줄) — 뒤따라 오는
            큰 문장 조각이 설명 끝에 같은 줄로 붙지 않게 한다. */}
        {settled ? (
          <span className="mb-[0.6em] block text-balance">
            <WordFlight
              text={settled}
              mode="rise"
              kerning={look.kerning?.settled}
              clock={scrubbed}
            />
          </span>
        ) : null}
        {/* Inline, not `inline-block`: an atomic box moves as one, so a
            phrase on its way in wrapped differently from the same phrase
            settled, and the words jumped lines the moment it landed. As plain
            inline runs they flow the way they will stay.

            **All of them, from the start**, the ones still to come at nothing:
            the column's veil is a gradient over its own height, and a column
            that grew a line as each phrase set off re-stretched it — the whole
            of the settled text changing its light by a step, several times a
            screen. At its final height from the first frame, it never does. */}
        {travelling
          ? phrases.map((phrase, index) => (
              <Fragment key={index}>
                <animated.span
                  style={{
                    opacity: travelled.to((value) => share(value, index)),
                    filter: travelled.to((value) =>
                      crossing(share(value, index)),
                    ),
                  }}
                >
                  <SwashText text={phrase} kerning={look.kerning?.settled} />
                </animated.span>{" "}
              </Fragment>
            ))
          : null}
      </p>

      <p
        aria-hidden
        className={`font-display text-title max-laptop:right-8 max-laptop:bottom-8 max-tablet:right-6 max-tablet:bottom-6 max-phone:right-5 max-phone:bottom-5 absolute right-10 bottom-10 text-right font-medium uppercase [mask-image:var(--copy-veil-rising)] ${look.stack}`}
      >
        {/* The phrase in hand: it shrinks into its own line, so the stack below
            closes the gap at exactly the rate the words give it up.

            The size the stack is set at is the frame's, not a number this
            screen keeps: every narrow frame re-sets it, so the line gives up
            its share of that token rather than of a fixed 48. What is animated
            is the share alone — a bare number in a custom property, which the
            two measures read. A `calc()` built in JS would reach the spring as
            a string to take apart, and it would take the token apart with.

            **The height is what shrinks; the glyphs are scaled.** Animating the
            font size as well drove a re-layout and a re-rasterisation of the
            text on every frame, and at fractional sizes that is a line of type
            visibly crawling. A transform is the compositor's, costs no layout,
            and the letters stay the shape they were drawn at. The height still
            has to be a real measure: it is what the stack closes the gap with.

            **And the height is a style prop, not a custom property.** It was
            `--held`, read by a `calc()` in the class — and a custom property is
            not something react-spring can drive frame by frame: the transform
            followed the spring and the height did not, so the line shrank, the
            gap stayed open, and the stack snapped shut at the next render.
            That is the "it shrinks and then suddenly grows" this screen was
            reported for. Interpolated into the `height` itself, both measures
            move on the same frame. */}
        {/* Every phrase is one line, kept on its own key for the whole trip:
            the line that is in hand is the same element it was while it was
            waiting, so the stack hands over without anything being mounted —
            and nothing that has already arrived arrives a second time. A line
            that has made the trip stays too, at no height and no size, so
            scrolling back grows the same element out again rather than
            mounting a new one whose words rise in from scratch. */}
        {phrases.map((phrase, index) => (
          <animated.span
            key={index}
            className="block origin-top-right"
            style={
              travelling
                ? {
                    /* `em`, not a `calc()` over the token: the line's own
                       font size *is* that token, so this is the same measure
                       with none of the trouble — a `calc(… var(…))` is
                       resolved on the client and left whole on the server,
                       which is a hydration mismatch. At rest it is `auto`, so a
                       line the frame wraps is never cut to one. The size is
                       the `scale` property for the same reason. */
                    height: travelled.to((value) => {
                      const gone = share(value, index);
                      return gone > 0 ? `${1 - gone}em` : "auto";
                    }),
                    scale: travelled.to(
                      (value) => `${1 - share(value, index)}`,
                    ),
                    opacity: travelled.to((value) => 1 - share(value, index)),
                    filter: travelled.to((value) =>
                      crossing(share(value, index)),
                    ),
                  }
                : undefined
            }
          >
            <WordFlight
              text={phrase}
              mode={arrive}
              offset={index * lineStep}
              kerning={look.kerning?.stack}
              clock={scrubbed}
            />
          </animated.span>
        ))}
      </p>
    </div>
  );
};
