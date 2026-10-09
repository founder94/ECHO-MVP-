"use client";

/**
 * "04 Fluff" — Figma 4279:4269, and 4414:743 (1024), 4414:841 (768),
 * 4414:942 (390).
 *
 * Two columns of amounts circle the beam, one either side of it — the left
 * climbing, the right descending, one wheel turning clockwise. Each column is
 * a loop: a value leaving one end comes back in at the other, faded out and in
 * beyond the drawn rows, so the stream never runs out.
 *
 * Everything hangs off the beam rather than off the middle of the frame. The
 * flower does not stand dead centre — it sways as it rises — so the axis is
 * set where the design draws the stem and where ours averages: 12 right of
 * centre, which is where every frame puts the gap the beam is drawn through.
 *
 * A value's place on its arc is what decides how it looks. The inner edge
 * bows in toward the beam along a circle fitted to the design's eleven rows
 * (see `Edge`), and the light gathers and the blur clears as a value nears the
 * middle — sampled per row, and read between two rows for a value between
 * them.
 *
 * The narrow frames keep the light and the blur to the sample and redraw
 * everything else — the pitch, the size, and the arc itself, which is not the
 * wide one scaled: at 1024 the waist stands 287 off the beam where a scaled
 * 357 would put it at 254. So the arcs are read per frame, and this is the one
 * screen that has to know which frame it is on: the value between two samples
 * is interpolated here, where a class name cannot reach.
 */

import { animated, to, useSpring } from "@react-spring/web";
import { useCallback, useRef } from "react";

import { WordFlight } from "@flora/components/ui/word-flight";
import type { FluffContent } from "@flora/data/mocks/home";
import { useFrame, type Frame } from "@flora/hooks/use-frame";
import { useStageProgress } from "@flora/hooks/use-stage-progress";
import { ramp } from "@flora/lib/scene/stage-progress";

export type FluffScreenProps = Omit<FluffContent, "window"> & {
  /** The screen's enter window: the wheel is already turning through it. */
  enter?: [number, number];
  /**
   * The screen's leave window. The amounts carry on round and fade out over
   * it, so the `ScreenFade` around them is set to `exit="own"`.
   */
  leave?: [number, number];
};

/** How a row reads once it is on its place — the same on every frame. */
interface Light {
  opacity: number;
  /** Design px — carried as rem so it scales with the type. */
  blur: number;
}

const LIGHT: readonly Light[] = [
  { opacity: 0.47, blur: 3.4 },
  { opacity: 0.57, blur: 2.7 },
  { opacity: 0.67, blur: 2.05 },
  { opacity: 0.77, blur: 1.4 },
  { opacity: 0.87, blur: 0.75 },
  { opacity: 0.93, blur: 0.1 },
  { opacity: 0.83, blur: 0.55 },
  { opacity: 0.73, blur: 1.2 },
  { opacity: 0.63, blur: 1.85 },
  { opacity: 0.53, blur: 2.5 },
  { opacity: 0.43, blur: 3.15 },
];

/**
 * An edge of one column, as a circle: its distance from the beam at a height
 * `y` down the column is `centre − √(radius² − (y − mid)²)`, in that frame's
 * design px.
 *
 * **Fitted, not sampled.** The design places each amount by hand, and read row
 * by row the right-hand column zig-zags by up to 15 px — the waist value sits
 * in, the two under it sit out — so a value travelling between those samples
 * went down the column in steps while the left one, drawn cleaner, went round.
 * These are least-squares circles through the design's own rows: the left edge
 * moves by at most 6 px, the right by at most 15, and both are now one true
 * curve a value can travel along smoothly.
 */
interface Edge {
  centre: number;
  mid: number;
  radius: number;
}

interface Arc {
  /** Row pitch and the top of the first row, in that frame's design px. */
  pitch: number;
  top: number;
  /** Half the gap the beam is drawn through. */
  split: number;
  /** The left column's right edge, as a distance from the beam. */
  left: Edge;
  /** The right column's left edge, same measure. */
  right: Edge;
}

const ARCS: Record<Frame, Arc> = {
  wide: {
    pitch: 76,
    top: -1,
    split: 24,
    left: { centre: 925.2, mid: 391.2, radius: 566.1 },
    right: { centre: 925.2, mid: 393.8, radius: 556.7 },
  },
  laptop: {
    pitch: 67.296875,
    top: 0,
    split: 16,
    left: { centre: 1041.9, mid: 343.8, radius: 755.2 },
    right: { centre: 969.5, mid: 351.0, radius: 706.7 },
  },
  tablet: {
    pitch: 86.3984375,
    top: -2,
    split: 16,
    left: { centre: 1904.5, mid: 428.4, radius: 1719.6 },
    right: { centre: 1681.4, mid: 446.6, radius: 1520.1 },
  },
  phone: {
    pitch: 67.3984375,
    top: -2,
    split: 16,
    left: { centre: 2404.4, mid: 320.8, radius: 2328.0 },
    right: { centre: 1947.1, mid: 343.8, radius: 1895.0 },
  },
};

/** How far an edge stands off the beam at `y` down its column. */
const edgeAt = (edge: Edge, y: number) =>
  edge.centre -
  Math.sqrt(Math.max(0, edge.radius * edge.radius - (y - edge.mid) ** 2));

/**
 * The beat between the two halves of the line the beam splits. The sentence
 * runs across the gap — it is the one about spreading — so the far half waits
 * for the near one to be read before it arrives.
 */
const ACROSS = 260;

/** The beam's axis, in design px right of the frame's middle. */
const BEAM = 12;
const ROWS = LIGHT.length;
const REM = 16;

/**
 * **The two columns turn round the flower as one wheel — clockwise.** The
 * left column climbs its arc, the right one descends its own, so the amounts
 * circle the beam rather than both drifting the same way past it.
 *
 * And the wheel never stands still while the screen is up: it is already
 * turning as the screen arrives and it keeps turning as it goes, the amounts
 * carried on along their arcs — up toward the top left, down toward the
 * bottom right — until they have faded out. The rate is the run's the whole
 * way, so at the run's start every value still sits on its own sample: the
 * frame the design draws.
 */

/** Design px of blur a value gains as the screen goes. */
const SMEAR = 6;

/** 0–1 eased at both ends. */
const smooth = (value: number) => {
  const x = Math.min(1, Math.max(0, value));
  return x * x * (3 - 2 * x);
};

export const FluffScreen = ({
  left,
  right,
  split,
  run,
  enter,
  leave,
}: FluffScreenProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const arc = ARCS[useFrame()];
  const cycle = ROWS * arc.pitch;
  const [runStart, runEnd] = run;
  const [leaveStart, leaveEnd] = leave ?? [runEnd, runEnd];
  /* The stretch the wheel turns over: the whole time the screen is up. */
  const from = enter ? enter[0] : runStart;
  const until = leave ? leaveEnd : runEnd;
  const [{ offset, gone }, api] = useSpring(() => ({
    offset: 0,
    gone: 0,
  }));

  const onProgress = useCallback(
    (progress: number) => {
      /* Set, not sprung: the columns ride the scroll and a spring on top of
         it lags and wobbles — see `MigrationScreen`. */
      const at = Math.min(until, Math.max(from, progress));
      api.set({
        /* Negative on the way in, past a whole turn on the way out: it is
           the run's rate carried either side of it, not a ramp over it. */
        offset: ((at - runStart) / (runEnd - runStart)) * cycle,
        gone: leave ? ramp(leaveStart, leaveEnd, progress) : 0,
      });
    },
    [api, cycle, from, until, runStart, runEnd, leave, leaveStart, leaveEnd],
  );

  useStageProgress(ref, onProgress);

  /**
   * Where a value is down the arc, given how far the wheel has turned — the
   * left column going up it, the right one down.
   *
   * The loop is a cycle of one pitch per value, and it **wraps half a pitch
   * outside the drawn rows** — above the first, below the last — where
   * `edge` has already taken the value to nothing. So a value going round
   * never jumps from one end of the column to the other in sight, and every
   * row the design draws is at full strength.
   */
  const placeOn = (index: number, turned: number, side: "left" | "right") => {
    const half = arc.pitch / 2;
    const along = index * arc.pitch + (side === "left" ? -turned : turned);
    const u = ((((along + half) % cycle) + cycle) % cycle) - half;
    const edge = smooth((u + half) / half) * smooth((cycle - half - u) / half);
    return { y: u + arc.top, edge };
  };

  /** The arc, read between its samples. */
  const readArc = (y: number) => {
    const step = Math.min(Math.max((y - arc.top) / arc.pitch, 0), ROWS - 1);
    const index = Math.min(Math.floor(step), ROWS - 2);
    const t = step - index;
    const mix = (a: number, b: number) => a + (b - a) * t;
    return {
      left: edgeAt(arc.left, y - arc.top),
      right: edgeAt(arc.right, y - arc.top),
      opacity: mix(LIGHT[index].opacity, LIGHT[index + 1].opacity),
      blur: mix(LIGHT[index].blur, LIGHT[index + 1].blur),
    };
  };

  const place = (index: number, side: "left" | "right", turned: number) => {
    const { y, edge } = placeOn(index, turned, side);
    const read = readArc(y);
    const x = BEAM + (side === "left" ? -read.left : read.right);
    return { x, y, edge, read };
  };

  const column = (values: string[], side: "left" | "right") =>
    values.map((value, index) => (
      <animated.p
        key={`${side}-${index}-${value}`}
        className={`font-display text-stream leading-stream text-scene-foreground absolute top-0 whitespace-nowrap ${
          side === "left" ? "right-1/2" : "left-1/2"
        }`}
        style={{
          transform: offset.to((turned) => {
            const at = place(index, side, turned);
            return `translate3d(${at.x / REM}rem, ${at.y / REM}rem, 0)`;
          }),
          opacity: to([offset, gone], (turned, away) => {
            const at = place(index, side, turned);
            return at.read.opacity * at.edge * (1 - smooth(away));
          }),
          filter: to([offset, gone], (turned, away) => {
            const at = place(index, side, turned);
            return `blur(${(at.read.blur + smooth(away) * SMEAR) / REM}rem)`;
          }),
        }}
      >
        {value}
      </animated.p>
    ));

  /* The split line is not on the wheel: it simply goes, as the screen around
     it used to take it. */
  const splitLeaving = {
    opacity: gone.to((away) => 1 - away),
    filter: gone.to((away) =>
      away > 0 ? `blur(${(away * SMEAR) / REM}rem)` : "none",
    ),
  };

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      {column(left, "left")}
      {column(right, "right")}

      {/* The line the beam splits in two: each half is set its own half-gap
          from the axis, so the two are even whatever they happen to measure. */}
      <animated.p
        className="font-display text-split leading-note text-title font-medium max-laptop:bottom-8 max-laptop:w-[12.5rem] max-tablet:bottom-6 max-tablet:w-[9.9375rem] max-phone:bottom-5 max-phone:w-[9.375rem] absolute right-1/2 bottom-10 w-[12.875rem] text-right [mask-image:var(--accent-veil-rising)] uppercase"
        style={{
          transform: `translateX(${(BEAM - arc.split) / REM}rem)`,
          ...splitLeaving,
        }}
      >
        <WordFlight text={split[0]} mode="rise" />
      </animated.p>
      <animated.p
        className="font-display text-split leading-note text-title font-medium max-laptop:bottom-8 max-laptop:w-[12.5rem] max-tablet:bottom-6 max-tablet:w-[11.25rem] max-phone:bottom-5 max-phone:w-[9.375rem] absolute bottom-10 left-1/2 w-[11.375rem] [mask-image:var(--accent-veil-rising)] uppercase"
        style={{
          transform: `translateX(${(BEAM + arc.split) / REM}rem)`,
          ...splitLeaving,
        }}
      >
        <WordFlight text={split[1]} mode="rise" offset={ACROSS} />
      </animated.p>
    </div>
  );
};
