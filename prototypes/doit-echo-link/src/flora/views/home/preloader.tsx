"use client";

/**
 * The preloader — Figma 4264:3434 (start), 4264:3446 (mid), 4264:3458 (end).
 *
 * A small keyhole is cut out of a night field, and it holds that size for the
 * whole of the load. **The bar under it is what moves while the page is
 * arriving**; when the bar is full, the keyhole opens — once, evenly, straight
 * out past the corners of the screen — and the bar and the sentence go with it.
 *
 * **What is behind it is the page, from the first frame.** The hole is a hole:
 * the hero is drawing there the whole time and the night simply stops covering
 * it, a little more of it at each per cent. Nothing fades from one picture into
 * another, which is why there is no seam between the two screens anywhere.
 *
 * The percentage is a real measure and never a timed animation: it is whatever
 * `boot-progress` says has arrived — the fonts, the scene, the page — eased by
 * a spring so a step that lands at once still reads as travel rather than as a
 * jump. The opening is the same number: nothing here animates on its own.
 *
 * See obsidian/frontend/preloader.md.
 */

import { animated, config, easings, useSpring } from "@react-spring/web";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { subscribeToTicker } from "@flora/lib/animation/ticker";
import { WordFlight } from "@flora/components/ui/word-flight";
import type { PreloaderContent } from "@flora/data/mocks/home";
import {
  finishBoot,
  markBooted,
  onBootProgress,
} from "@flora/lib/loading/boot-progress";
import { backdropIsReady, onBackdropReady } from "@flora/lib/loading/backdrop";
import { holdCurtain, raiseCurtain } from "@flora/lib/loading/curtain";

export type PreloaderProps = PreloaderContent;

/**
 * The opening, as a share of the shape's drawn size: a point of light at 0, and
 * well past its own size once everything has arrived — by a hundred per cent
 * the keyhole is most of the height of the screen and there is plenty of page
 * to see through it. What is left after that is the exit, which carries it on
 * out to `cover`.
 */
/**
 * The keyhole's size while the page loads, as a share of the shape's drawn
 * size. It does not move: **the bar is the thing that is loading**, and a shape
 * tied to a real measure cannot be even — the boot lands in four lumps, so it
 * shot forward, hung in the middle waiting for the rest, and crawled to the
 * end. One even move, after the wait, is what an opening wants to be.
 */
const SMALL = 0.33;

/** How long the one move takes, from that small keyhole to a cleared screen. */
const OPEN = 1400;

/**
 * The least the keyhole is on screen before it opens. A warm cache answers in
 * under a fifth of a second, and a preloader that appears and vanishes inside
 * one is a flash of something nobody read. Spent on the still keyhole, never
 * inside the move.
 */
const FLOOR = 900;

/** Nothing may hold the page longer than this, whatever failed to report. */
const PATIENCE = 9000;

/**
 * The counter drifts between the things it is waiting for.
 *
 * What arrives, arrives in three pieces, and three pieces is three jumps: a
 * number that stands still and then leaps reads as broken however well it is
 * sprung. So between one arrival and the next the target creeps on across the
 * gap — `REACH` of it at most, and asymptotically, so it slows as it goes and
 * never reaches the next mark on its own. It is a pace, not a claim.
 */
const TRICKLE = 900;
const REACH = 0.45;
/** The drift only needs to move the goal, not draw it — 30 a second is ample. */
const DRIFT_FRAME = 1000 / 30;

/**
 * Every spring here is overdamped on purpose — friction well past the `2√k`
 * that critical damping asks for — so none of them can pass their goal and
 * come back. A counter that overshoots reads a hundred and one; a curtain that
 * overshoots fades out and then ghosts back in on the page behind it.
 */
const COUNTING = { tension: 100, friction: 30 };
/** A touch firmer for the last stretch, so a hundred arrives rather than creeps. */
const ARRIVING = { tension: 130, friction: 30 };
/**
 * The opening is given a **duration and an easing** rather than a spring: every
 * spring is front-loaded, and over a scale this large that is a lunge followed
 * by a crawl however it is damped. `spring-trigger.tsx` drives its scrubs the
 * same way.
 *
 * The easing is **sine, in and out**, and the choice of curve has been argued
 * three times:
 *
 * - *Linear* reads as a slow start and a run away at the end, because a shape
 *   opening toward the viewer is not read at the rate its scale changes — the
 *   same step of scale sweeps a little more of the screen each time.
 * - *Ease-out cubic* takes that out, but it is at full speed in its first
 *   frame, and a move that starts at full speed has no beginning.
 * - **Sine, in and out**, has a beginning and an end and stays near linear in
 *   between: its fastest moment is only about half again its average, where a
 *   cubic's is double. Nothing in it is abrupt, which is the whole ask.
 */
const OPENING = { duration: OPEN, easing: easings.easeInOutSine };
/**
 * The field is cleared before it is lifted, and that is two moves rather than
 * one: the keyhole, the sentence and the bar go first, leaving plain night, and
 * only then does the night itself go. Nothing of the preloader is ever on the
 * screen at the same time as the page — two sets of type dissolving through
 * each other is not a hand-over, it is a smear.
 */
const CLEARING = { tension: 150, friction: 32 };

/**
 * The keyhole's own silhouette, traced off the design row by row: a circle of
 * 50 running down to the neck at 92, a neck held at 55 wide, and a skirt
 * flaring straight out to 80 at the foot. It is drawn twice — once as the
 * light, once as the hole that light turns into — so it is written once.
 */
const KEYHOLE =
  "M77 92.6A50 50 0 1 0 23 92.6c-.7 4.4-1 7.4-.8 11.4L10 152c-.6 5 3 9 8 9h64c5 0 8.6-4 8-9l-12.2-48c.2-4-.1-7-.8-11.4Z";

/**
 * Where the shape sits, in its own 100 x 161 box: the middle of the circle
 * across, and the point the CSS transform pivots about down the box. Both are
 * read straight off the rules on the element below — `left-1/2`, `top-[47.6%]`
 * and `translate(-50%, -31.06%)` — so the hole can be placed in SVG user
 * units at exactly the same place as the light.
 */
const PIVOT_X = 50;
const PIVOT_Y = 80.5;
/** The element's top, as a share of the viewport, and the pivot's drop from it. */
const ANCHOR_Y = 0.476;
const ANCHOR_DROP = 0.305;
/**
 * How far the circle's middle climbs per unit of scale, as a share of the
 * shape's width — the pivot sits below it, so growing lifts it.
 */
const CIRCLE_RISE = 0.305;
/** Slack on the scale that clears the screen — a hair, not a safety net. */
const CLEARANCE = 1.06;
/**
 * How soft the cut edge is, in the shape's own units — so it is the same
 * softness relative to the opening at every size, rather than a hairline once
 * the hole is wide.
 *
 * It is the **only** thing drawn at the edge. There was a rim of light around
 * the cut and it was wrong twice over: it is not black, so it read as a ring
 * pasted onto the night, and it had to be faded out before the end or it was
 * left on screen when the field unmounted. The night's own black, falling off
 * over this many units, is the edge.
 */
const EDGE = 9;

/**
 * **The soft edge is blurred once, not every frame.** It used to be an SVG
 * `feGaussianBlur` inside the mask, in the shape's own units — so as the hole
 * scaled out to `cover` the blur radius grew with it, and WebKit re-rasterised
 * a full-screen mask through a Gaussian hundreds of device pixels wide on
 * every frame of the opening. Measured in WebKit at 402×874 @3x: 5 fps across
 * the hand-off, frames up to 530 ms — the whole of the "lag after the loader".
 *
 * Now the blurred silhouette is drawn once into a small bitmap (the stamp) and
 * the night is a 2D canvas that fills itself and punches that stamp out,
 * scaled. The blur still lives in the shape's own units, so it grows with the
 * hole exactly as before; what changed is that growing it is a scaled
 * `drawImage` on the GPU rather than a new convolution. Measured after: 50 fps
 * through the same hand-off.
 *
 * `STAMP_RES` is pixels per shape unit. The stamp is a Gaussian, so bilinear
 * upscaling of it is still a Gaussian — resolution only has to hold the small
 * keyhole's silhouette, where it is drawn near 1:1.
 */
const STAMP_RES = 4;
/** Room around the silhouette for the blur's tail: three sigma. */
const STAMP_MARGIN = EDGE * 3;
/** Past this the field is flat black at any softness — no finer buffer helps. */
const FIELD_DPR = 2;

/**
 * The keyhole, blurred by `EDGE`, as an alpha bitmap. The blur is a canvas
 * shadow rather than `ctx.filter`, which older Safari does not have: the shape
 * is drawn far off the bitmap and only its shadow — `shadowBlur` is twice the
 * sigma — is offset back onto it.
 */
const buildStamp = (): HTMLCanvasElement => {
  const stamp = document.createElement("canvas");
  stamp.width = (100 + STAMP_MARGIN * 2) * STAMP_RES;
  stamp.height = (161 + STAMP_MARGIN * 2) * STAMP_RES;
  const ctx = stamp.getContext("2d");
  if (!ctx) return stamp;
  const away = stamp.width * 2;
  ctx.shadowColor = "#000";
  ctx.shadowBlur = EDGE * STAMP_RES * 2;
  ctx.shadowOffsetX = -away;
  ctx.setTransform(
    STAMP_RES,
    0,
    0,
    STAMP_RES,
    STAMP_MARGIN * STAMP_RES + away,
    STAMP_MARGIN * STAMP_RES,
  );
  ctx.fill(new Path2D(KEYHOLE));
  return stamp;
};

/** How long the keyhole takes to appear, once there is something behind it. */
const KINDLING = 700;

/**
 * How far into the clearing the page behind is told to arrive, in ms.
 *
 * It is a balance with two edges and neither is far away: earlier and the
 * preloader's own sentence is still legible under the page's, later and the
 * interface is arriving after the hole rather than with it.
 */
const HANDOVER = 360;



/**
 * The seed field. Fixed rather than random: the overlay renders on the server
 * too, so that the first paint is already the preloader, and a random field
 * would not survive hydration. Each seed is [x %, y %, size, tail].
 */
const SEEDS: readonly [number, number, number, number][] = [
  [6.6, 27.4, 1.6, 0],
  [12.1, 70.2, 2.4, 22],
  [15.4, 12.8, 1.4, 0],
  [18.9, 44.1, 1.8, 0],
  [21.2, 88.6, 1.5, 0],
  [24.6, 30.7, 2.2, 18],
  [27.3, 61.4, 1.3, 0],
  [31.8, 8.9, 1.7, 0],
  [34.2, 52.3, 1.4, 0],
  [36.9, 79.5, 2.1, 20],
  [40.1, 22.6, 1.5, 0],
  [43.4, 66.8, 1.6, 0],
  [46.2, 15.3, 1.3, 0],
  [49.7, 92.1, 1.8, 0],
  [52.4, 38.9, 1.4, 0],
  [55.1, 74.6, 2.3, 24],
  [58.6, 19.7, 1.6, 0],
  [61.2, 57.2, 1.4, 0],
  [63.8, 85.4, 1.7, 0],
  [66.4, 11.6, 2.2, 19],
  [69.1, 47.8, 1.3, 0],
  [72.6, 72.3, 1.5, 0],
  [75.2, 25.1, 1.9, 0],
  [77.9, 63.7, 1.4, 0],
  [80.4, 34.2, 2.0, 21],
  [83.1, 90.8, 1.6, 0],
  [85.7, 17.4, 1.4, 0],
  [88.2, 55.6, 1.7, 0],
  [90.8, 81.2, 1.5, 0],
  [93.4, 40.5, 2.1, 17],
  [95.9, 68.9, 1.3, 0],
  [3.2, 49.6, 1.5, 0],
  [9.4, 96.3, 1.4, 0],
  [29.7, 41.2, 1.2, 0],
  [45.3, 5.8, 1.5, 0],
  [57.8, 94.7, 1.3, 0],
  [71.4, 3.9, 1.4, 0],
  [97.6, 13.2, 1.6, 0],
];

export const Preloader = ({ lines, mark, note, status }: PreloaderProps) => {
  const [gone, setGone] = useState(false);
  /* Claimed on the first render rather than in an effect: the hero renders
     after this one and has to already know it is being waited for. A state
     initialiser is the one place React lets a component do something once
     during render. */
  useState(() => {
    holdCurtain();
    return null;
  });
  const raisedAt = useRef(0);
  /** What has actually arrived, when it did, and the goal already shown. */
  const arrived = useRef(0);
  const since = useRef(0);
  const shown = useRef(0);
  const done = useRef(false);
  const [{ shut, lit, cleared, opened }, api] = useSpring(() => ({
    shut: 0,
    lit: 0,
    cleared: 0,
    opened: 0,
    config: COUNTING,
  }));

  /* **The keyhole waits for something to show through it.** Cut before the
     gradient behind has painted, it is a black shape on black — and one that
     appears the instant the gradient arrives is a shape popping into being.
     So it is not there at all until the backdrop says it has drawn, and then
     it fades in. */
  useEffect(
    () =>
      onBackdropReady(() =>
        api.start({
          lit: 1,
          config: { duration: KINDLING, easing: easings.easeOutSine },
        }),
      ),
    [api],
  );

  /**
   * The screen and the keyhole's drawn width, measured rather than assumed:
   * `--keyhole-size` is viewport-relative and two media queries cut it down.
   * The hole is placed in SVG user units, so it needs both in pixels.
   */
  const keyholeRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0, size: 0 });

  useEffect(() => {
    const measure = (): void =>
      setFrame({
        width: window.innerWidth,
        height: window.innerHeight,
        /* Layout width, so the element's own scale does not feed back in. */
        size: keyholeRef.current?.offsetWidth ?? 0,
      });
    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, []);

  /**
   * Leaving is two moves and they are taken in turn: 0 while the field is
   * held, 1 while what it carries is cleared off it, 2 while the field itself
   * lifts. The second move is started from an effect rather than from the
   * first's `onRest` — a spring started inside another's rest callback runs,
   * but its own rest is never announced, and the page behind would wait for a
   * signal that had already been swallowed.
   */
  const [leaving, setLeaving] = useState<0 | 1 | 2>(0);
  const lift = useCallback(() => setLeaving(1), []);

  useEffect(() => {
    if (leaving !== 1) return;
    /* The type leaves **and** the opening starts in the same moment. Only the
       words are a hand-over. */
    api.start({ cleared: 1, config: CLEARING });
    api.start({ opened: 1, config: OPENING, onRest: () => setGone(true) });
    /* The page is called **while the words are still going**, not after they
       have gone: `HANDOVER` is most of the way through the clearing, which is
       long enough that nothing of the preloader's own type is legible when the
       page's own starts arriving, and short enough that the interface is
       already coming up while the hole is opening rather than after it. */
    const soon = window.setTimeout(() => setLeaving(2), HANDOVER);
    return () => window.clearTimeout(soon);
  }, [leaving, api]);

  useEffect(() => {
    if (leaving !== 2) return;
    /* **The page is told to arrive while the hole is still opening**, the
       moment the preloader's own words are off the screen. That is the whole of
       the hand-over: the interface plays its arrivals and the flower starts
       growing while the night is still coming off them, so what widens is one
       moving picture rather than a shutter opening on a photograph. There is
       still never two sets of words on the screen at once. */
    raiseCurtain();
  }, [leaving]);

  useEffect(() => {
    raisedAt.current = performance.now();
    since.current = raisedAt.current;

    /* The three things the page is waiting for. The scene marks itself from
       its own leaf, because it is behind a dynamic import and cannot be
       awaited from here. */
    document.fonts?.ready.then(() => markBooted("fonts"));
    if (document.readyState === "complete") markBooted("page");
    else
      window.addEventListener("load", () => markBooted("page"), { once: true });

    const timers: number[] = [];
    const rescue = window.setTimeout(finishBoot, PATIENCE);

    const stop = onBootProgress((progress) => {
      const now = performance.now();
      arrived.current = progress;
      /* Re-based rather than restarted. The creep is measured from the mark it
         is crossing, so a new mark would put it back at the beginning of a gap
         it has already walked — and the counter would stand still until the
         creep caught up with itself. Instead the clock is moved so the drift
         reads exactly where it already is, and simply carries on. */
      const room = (1 - progress) * REACH;
      const walked =
        room > 0
          ? Math.min(0.98, Math.max(0, (shown.current - progress) / room))
          : 0;
      since.current = now + TRICKLE * Math.log(1 - walked);
      if (progress < 1) return;

      done.current = true;
      window.clearTimeout(rescue);
      /* Everything has arrived, but the counter has not: it is a spring, and it
         is still on its way to a hundred. It goes straight there — a number
         that stops halfway while the page is already behind the hole is the one
         thing a preloader must not do — and the field goes when the number the
         visitor is watching has arrived *and* the shape has finished growing. */
      api.start({
        shut: 1,
        config: ARRIVING,
        onRest: () => {
          const held = Math.max(
            0,
            FLOOR - (performance.now() - raisedAt.current),
          );
          timers.push(window.setTimeout(lift, held));
        },
      });
    });

    /* The drift. It only moves the goal; the spring is what draws it, and the
       goal never steps back — a new arrival resets the creep, and without this
       the counter would fall back to the mark it had just passed. */
    const untick = subscribeToTicker(
      (time) => {
        if (done.current) return;
        const settled = arrived.current;
        const eased = 1 - Math.exp(-(time - since.current) / TRICKLE);
        const goal = settled + (1 - settled) * REACH * eased;
        if (goal <= shown.current + 0.0005) return;
        shown.current = goal;
        api.start({ shut: goal });
      },
      () => DRIFT_FRAME,
    );

    return () => {
      stop();
      untick();
      window.clearTimeout(rescue);
      timers.forEach(window.clearTimeout);
    };
  }, [api, lift]);

  /* The scroll belongs to the flight, and the flight is not on yet. */
  useEffect(() => {
    if (gone) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [gone]);

  /**
   * How far the shape has to be scaled for the hole to have cleared the screen.
   *
   * Worked from the silhouette, because the shape does not grow about its own
   * middle: the pivot is low in the box, so as it scales the circle climbs
   * while its radius grows faster than the climb.
   *
   * > What has to be covered is the **corners**, not the edges.
   *
   * Checking the circle's widest row against the screen's width and its foot
   * against the screen's foot is not the same thing, and on a wide screen it is
   * badly short: on a 32-inch display it left the corners black and the field
   * then unmounted with them still there, which reads as the whole thing
   * vanishing. The circle has to *contain* the far corners, so:
   *
   *     centre  (w/2, anchor − 0.305k)      radius  k/2      k = scale × size
   *     need    k/2 ≥ √( (w/2)² + (h − anchor + 0.305k)² )
   *
   * which is a quadratic in k, and this is its positive root. The skirt below
   * the circle is narrower than the circle, so the circle is what binds.
   */
  const cover = useMemo(() => {
    if (frame.size <= 0) return 1;
    const anchor = frame.height * ANCHOR_Y + frame.size * ANCHOR_DROP;
    const across = frame.width / 2;
    const below = frame.height - anchor;
    const a = 0.25 - CIRCLE_RISE * CIRCLE_RISE;
    const b = -2 * CIRCLE_RISE * below;
    const c = -(across * across + below * below);
    const k = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    return (CLEARANCE * k) / frame.size;
  }, [frame]);

  /**
   * **The night is drawn, not masked** — see `STAMP_RES`. One fill of the
   * field, then the blurred keyhole punched out of it at the opening's scale,
   * placed at the same point the CSS puts the light: the middle of the screen
   * across, and the element's top plus the pivot's drop down. It redraws only
   * when something it shows has moved, so the still keyhole of the load costs
   * two number comparisons a frame.
   */
  const fieldRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = fieldRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || frame.size <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, FIELD_DPR);
    canvas.width = Math.round(frame.width * dpr);
    canvas.height = Math.round(frame.height * dpr);
    /* The colour is the token, read off the element that carries it. */
    const field = getComputedStyle(canvas).color;
    const stamp = buildStamp();
    const pivotX = frame.width / 2;
    const pivotY = frame.height * ANCHOR_Y + frame.size * ANCHOR_DROP;
    let drawn = "";

    const draw = (): void => {
      const going = Math.min(1, Math.max(0, opened.get()));
      /* One value places the hole: the small keyhole holds while the page
         loads, then goes straight out to `cover` at one even rate. */
      const scale = SMALL + (Math.max(cover, SMALL) - SMALL) * going;
      const alpha = lit.get();
      const key = `${scale.toFixed(5)}|${alpha.toFixed(4)}`;
      if (key === drawn) return;
      drawn = key;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = field;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (alpha <= 0) return;
      const unit = (dpr * scale * frame.size) / 100;
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = alpha;
      ctx.setTransform(
        unit,
        0,
        0,
        unit,
        dpr * pivotX - unit * PIVOT_X,
        dpr * pivotY - unit * PIVOT_Y,
      );
      ctx.drawImage(
        stamp,
        -STAMP_MARGIN,
        -STAMP_MARGIN,
        100 + STAMP_MARGIN * 2,
        161 + STAMP_MARGIN * 2,
      );
    };

    draw();
    /* The element's own background is the night until the canvas has drawn
       it — the server's paint and the first frame before hydration. Once it
       has, the background has to go, or it shows through the hole. */
    canvas.style.background = "transparent";
    return subscribeToTicker(draw, () => 0);
  }, [frame, cover, lit, opened]);

  if (gone) return null;

  return (
    <animated.div
      className="isolate fixed inset-0 z-60 overflow-hidden"
      style={{
        // A curtain on its way out must not keep catching what is behind it.
        pointerEvents: opened.to((value) => (value > 0.001 ? "none" : "auto")),
      }}
      // It is a curtain, not a document: what is behind it is not ready to be
      // read. The counter is not announced per cent by per cent — that is a
      // number changing sixty times a second, and no one needs it read out.
      role="status"
      aria-label={status}
    >
      {/* **The night itself.** One canvas, filled with the field and with the
          keyhole punched out of it, so the hole is a hole: what shows through
          is whatever the page has drawn there, at full strength, with nothing
          cross-fading over it. Its CSS background and text colour are the same
          token — the background covers the page until the first draw, the
          colour is what the draw reads. */}
      <canvas
        ref={fieldRef}
        aria-hidden
        className="bg-preloader-field text-preloader-field absolute inset-0 block h-full w-full"
      />

      {/* Everything the field carries, in one layer, because it all leaves
          together and before the field does. */}
      <animated.div
        className="absolute inset-0"
        style={{ opacity: cleared.to((value) => 1 - value) }}
      >
        <div aria-hidden className="absolute inset-0">
          {SEEDS.map(([x, y, size, tail], index) => (
            <span
              key={index}
              className="absolute"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span
                className="bg-seed block rounded-full"
                style={{ width: `${size}px`, height: `${size}px` }}
              />
              {/* The thread a seed falls on — the design draws it under the
                brightest of them, fading out as it goes. */}
              {tail ? (
                <span
                  className="absolute left-1/2 block w-px -translate-x-1/2"
                  style={{
                    top: `${size}px`,
                    height: `${tail}px`,
                    background:
                      "linear-gradient(to bottom, var(--color-seed), transparent)",
                  }}
                />
              ) : null}
            </span>
          ))}
        </div>

        {/* The sentence is what the visitor reads while they wait, so it is
          written to them rather than posted: word by word, line after line,
          and the last line — the one that answers the first two — lands after
          a breath of its own. */}
        <p className="font-display text-lead leading-lead tracking-lead text-foreground-lead max-tablet:px-6 max-phone:px-5 short:top-8 absolute top-20 right-0 left-0 text-center uppercase">
          {lines.map((line, index) => (
            <span key={line} className="block">
              <WordFlight
                text={line}
                mode="rise"
                offset={
                  220 + index * 320 + (index === lines.length - 1 ? 260 : 0)
                }
              />
            </span>
          ))}
        </p>

        {/* The bar reads as the footer's own rule: the run of the frame, the
          stretch already closed over it, and the small print under. */}
        <div className="max-laptop:right-8 max-laptop:bottom-8 max-laptop:left-8 max-tablet:right-6 max-tablet:bottom-6 max-tablet:left-6 max-phone:right-5 max-phone:bottom-5 max-phone:left-5 absolute right-10 bottom-10 left-10 flex flex-col gap-5">
          <span aria-hidden className="bg-rule relative h-px w-full">
            <animated.span
              className="bg-accent absolute inset-y-0 left-0"
              style={{ width: shut.to((value) => `${value * 100}%`) }}
            />
          </span>
          <div className="font-display text-foot tracking-foot text-foreground-faint flex items-center justify-between gap-4 leading-none uppercase">
            <span>{mark}</span>
            <span className="max-tablet:hidden">{note}</span>
            <animated.span className="text-accent">
              {shut.to(
                (value) =>
                  `${status} ${String(Math.round(value * 100)).padStart(2, "0")}%`,
              )}
            </animated.span>
          </div>
        </div>
      </animated.div>

      {/* Nothing is drawn here. It exists so the hole can be placed in the
          SVG's own pixels at the size the CSS has decided: `--keyhole-size` is
          a `min()` of two viewport units and two media queries cut it down, so
          it is measured rather than assumed. */}
      <div
        aria-hidden
        ref={keyholeRef}
        className="pointer-events-none invisible absolute top-0 left-0 h-0 w-[var(--keyhole-size)]"
      />
    </animated.div>
  );
};
