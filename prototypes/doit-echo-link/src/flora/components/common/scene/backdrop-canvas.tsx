"use client";

/**
 * The client leaf that owns the backdrop gradient's lifecycle — the animated
 * ground the dandelion stands on.
 *
 * React holds the canvas and the gates; `BackdropGradient` holds the WebGL. It
 * draws through the app-wide ticker, throttled by the device tier's frame
 * budget, and only while it is on screen and the tab is visible — exactly like
 * the scene above it (optimize-3d-scene §4, §5).
 *
 * 📖 Docs: obsidian/frontend/backdrop-gradient.md
 */

import { useEffect, useRef, useState } from "react";

import { subscribeToTicker } from "@flora/lib/animation/ticker";
import { markBackdropReady } from "@flora/lib/loading/backdrop";
import {
  BackdropGradient,
  type BackdropConfig,
} from "@flora/lib/scene/backdrop/backdrop-gradient";
import {
  COARSE_POINTER_QUERY,
  frameBudget,
  readTier,
  sceneShouldFreeze,
} from "@flora/lib/scene/device";
import {
  EMPTY_STAGE,
  measureStage,
  ramp,
  stageProgress,
} from "@flora/lib/scene/stage-progress";
import { readBackdropTokens } from "@flora/lib/scene/tokens";

export interface BackdropCanvasProps {
  config: BackdropConfig;
  /**
   * Where the gradient goes out, in stage progress. The scene above puts the
   * room out as the camera comes round; the ground has to go with it, or the
   * flight into the dark happens over a lit field.
   */
  fadeStart: number;
  fadeEnd: number;
}

/** Start drawing a viewport early, so the field is warm when it arrives. */
const IN_VIEW_MARGIN = "100% 0px";

/**
 * The pointer is **felt, not tracked**: a fast lead node chased by a slower
 * body. One lerp can only decelerate into its target, so a direction change
 * hinges on a corner and the tail of every move reads as dead weight. Two poles
 * swing through the turn and coast for a beat after the hand stops — and the
 * **gap between them is the velocity**, which opens while the hand moves and
 * closes by itself, so the field gets a wake with no history buffer anywhere.
 */
const LEAD_EASE = 0.105;
const BODY_EASE = 0.043;

/** Frame interval clamps (ms), and the upper bound in 60ths of a second. */
const MIN_FRAME = 4.167;
const MAX_FRAME = 50;
const MAX_STEP = 2.2;

export const BackdropCanvas = ({
  config,
  fadeStart,
  fadeEnd,
}: BackdropCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gradientRef = useRef<BackdropGradient | null>(null);
  const budgetRef = useRef(frameBudget(readTier()));
  const frozenRef = useRef(false);
  const lastTimeRef = useRef(0);
  const clockRef = useRef(0);
  const stageRef = useRef(EMPTY_STAGE);
  const pointerRef = useRef({ tx: 0, ty: 0, ax: 0, ay: 0, x: 0, y: 0 });
  /** Whether the last drawn frame had any light in it — see the loop. */
  const litRef = useRef(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gradient: BackdropGradient;
    try {
      gradient = new BackdropGradient({
        canvas,
        tokens: readBackdropTokens(document.documentElement),
        config,
      });
    } catch (error) {
      // No WebGL2, or the context was refused — the section's own background
      // colour stands in, and the scene above is unaffected. The preloader is
      // waiting on this to cut its keyhole: a gradient that will never come is
      // still an answer, or the keyhole never appears at all.
      console.error("[backdrop] gradient failed to start:", error);
      markBackdropReady();
      return;
    }

    gradientRef.current = gradient;

    const tier = readTier();
    budgetRef.current = frameBudget(tier);
    frozenRef.current = sceneShouldFreeze(tier);

    stageRef.current = measureStage(canvas);
    gradient.resize();
    // One draw before anything else, so we never fade in on a blank canvas.
    gradient.render(0, 0, 0, 0, 0, 1);
    // …and there is now something behind the preloader's keyhole to see.
    markBackdropReady();

    let resizeFrame = 0;
    let lastWidth = window.innerWidth;
    const coarse = window.matchMedia(COARSE_POINTER_QUERY);

    const applyResize = (): void => {
      resizeFrame = 0;
      stageRef.current = measureStage(canvas);
      gradient.resize();
      budgetRef.current = frameBudget(readTier());
    };

    // Coalesced to one resize per frame: a window drag fires far faster than the
    // display refreshes, and every raw call reallocates the drawing buffer.
    // Height-only changes on touch are the collapsing URL bar, not a resize.
    const onResize = (): void => {
      const widthChanged = window.innerWidth !== lastWidth;
      lastWidth = window.innerWidth;
      if (coarse.matches && !widthChanged) return;
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(applyResize);
    };

    const observer = new IntersectionObserver(
      ([entry]) => setRunning(entry.isIntersecting && !document.hidden),
      { rootMargin: IN_VIEW_MARGIN },
    );
    observer.observe(canvas);

    const onVisibility = (): void => {
      if (document.hidden) setRunning(false);
      else setRunning(canvas.getBoundingClientRect().top < window.innerHeight);
    };

    // One handler for both events, doing exactly one job: write the target.
    // Everything that moves is integrated in the loop, so a flick that fires
    // forty events inside a frame costs the same as one that fires one — and a
    // touch aims on contact instead of staying dead until the first drag.
    const aim = (event: PointerEvent): void => {
      if (!gradient.followsPointer) return;
      const aspect = window.innerWidth / window.innerHeight;
      const pointer = pointerRef.current;
      pointer.tx = (event.clientX / window.innerWidth - 0.5) * aspect;
      pointer.ty = 0.5 - event.clientY / window.innerHeight;
    };

    /* Only where there is a pointer to follow. On touch these would fire on
       every tap and feed a field that does not read them (§11). */
    if (!coarse.matches && gradient.followsPointer) {
      window.addEventListener("pointermove", aim, { passive: true });
      window.addEventListener("pointerdown", aim, { passive: true });
    }
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    coarse.addEventListener("change", onResize);

    return () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      window.removeEventListener("pointermove", aim);
      window.removeEventListener("pointerdown", aim);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      coarse.removeEventListener("change", onResize);
      setRunning(false);
      gradientRef.current = null;
      gradient.dispose();
    };
  }, [config]);

  useEffect(() => {
    if (!running) return;

    lastTimeRef.current = performance.now();

    return subscribeToTicker(
      (time) => {
        const gradient = gradientRef.current;
        if (!gradient) return;

        // **The clock accumulates from a clamped interval**, never off the wall
        // clock: rAF stops in a background tab and wall time does not, and
        // handing the shader that gap is exactly what makes a field lurch on the
        // way back. Clamped, an alt-tab costs a pause and never a jump. The same
        // interval steps the pointer, so the follow-lag is identical at 60, 120
        // and 144 Hz.
        const raw = time - lastTimeRef.current;
        lastTimeRef.current = time;

        // **The gradient is skipped once it has nothing left to show.** The
        // scene above puts the ground out early — `darkenEnd` is a fifth of the
        // way through the flight — and past that this shader resolves to black
        // over the whole viewport for the remaining four fifths. A full-screen
        // fragment pass that contributes nothing is the most expensive kind of
        // nothing there is (optimize-3d-scene §7). One frame is still drawn as
        // it reaches zero, so the canvas is left black rather than on its last
        // lit frame; scrolling back up lights it again from where it stopped.
        const fade =
          1 - ramp(fadeStart, fadeEnd, stageProgress(stageRef.current, time));
        if (fade <= 0 && !litRef.current) return;
        litRef.current = fade > 0;

        const ms = Math.min(Math.max(raw, MIN_FRAME), MAX_FRAME);
        const step = ms > 36.7 ? MAX_STEP : ms * 0.06;
        if (!frozenRef.current) clockRef.current += ms * 0.001;

        const pointer = pointerRef.current;
        if (!frozenRef.current && gradient.followsPointer) {
          const lead = LEAD_EASE * step;
          const body = BODY_EASE * step;
          pointer.ax += (pointer.tx - pointer.ax) * lead;
          pointer.ay += (pointer.ty - pointer.ay) * lead;
          pointer.x += (pointer.ax - pointer.x) * body;
          pointer.y += (pointer.ay - pointer.y) * body;
        }

        gradient.render(
          clockRef.current,
          pointer.x,
          pointer.y,
          pointer.ax - pointer.x,
          pointer.ay - pointer.y,
          fade,
        );
      },
      () => budgetRef.current,
    );
  }, [running, fadeStart, fadeEnd]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      // Sized against the largest viewport, so a collapsing URL bar never
      // re-allocates the drawing buffer.
      // The compositor hints keep a neighbouring repaint during scroll from
      // invalidating the WebGL layer on WebKit, which reads as a whole-scene
      // flash (optimize-3d-scene §13).
      className="pointer-events-none absolute inset-0 block h-lvh w-lvw transform-gpu backface-hidden will-change-transform"
    />
  );
};
