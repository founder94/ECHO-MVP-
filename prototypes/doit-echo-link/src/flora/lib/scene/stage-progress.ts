/**
 * How far through a scroll stage the page is, 0 → 1.
 *
 * Both canvases in the hero are driven by this one number, so it is defined
 * once. The geometry is **measured on mount and on resize, never per frame**:
 * `getBoundingClientRect()` forces a layout, and Lenis is writing transforms in
 * the same frame — the two together are a stutter you can feel while scrolling
 * (optimize-3d-scene §9). Per frame this reads `window.scrollY` and nothing else.
 *
 * **Smoothing is for touch only.** Lenis smooths the wheel (see
 * `scroll-layout.tsx`), and a lerp on top of that is a second easing: the scene
 * lags the page, then catches up, which reads as the scene speeding up and
 * slowing down under a wheel turning at a steady rate. But Lenis deliberately
 * leaves touch to the OS, so on a phone `scrollY` arrives in the discrete steps
 * of the momentum scroller and every value derived from it jitters — worst on a
 * scene that is redrawing at 30 fps. There the position is low-passed once,
 * here, upstream of both canvases, so they inherit the same easing and can
 * never disagree about where the page is (optimize-3d-scene §10).
 *
 * 📖 Docs: obsidian/frontend/dandelion-scene.md
 */

import { COARSE_POINTER_QUERY } from "@flora/lib/scene/device";

export interface StageMetrics {
  /** The stage's top, in document coordinates. */
  top: number;
  /** How far the page scrolls between the stage's first and last frame. */
  travel: number;
}

export const EMPTY_STAGE: StageMetrics = { top: 0, travel: 1 };

/** Measure the scroll stage a canvas is mounted in. */
export const measureStage = (canvas: Element): StageMetrics => {
  const stage = canvas.closest("section");
  if (!stage) return EMPTY_STAGE;
  const rect = stage.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    travel: Math.max(1, rect.height - window.innerHeight),
  };
};

/**
 * How much of the remaining distance the smoothed position closes per 60th of
 * a second — retention 0.75, which is `helion`'s tuned band. Lower than this
 * and the scene reads as disconnected from the thumb once the 30 fps cap is
 * stacked on top.
 */
const SMOOTHING = 0.25;

/**
 * Past this much of a viewport, the position is assigned rather than eased: an
 * anchor jump is not a scroll, and crawling to it takes seconds.
 */
const JUMP = 1.5;

/** Whether this session smooths at all — read once; a device keeps its pointer. */
let onTouch: boolean | null = null;
/** The eased position, and the frame it was last advanced on. */
let eased = 0;
let easedAt = -1;

/**
 * The scroll position the stage is read against. Both canvases call this on the
 * same frame and the second one gets the first one's answer, so the low pass
 * advances once per frame however many things are drawing.
 */
const scrolled = (time?: number): number => {
  const raw = window.scrollY;
  if (onTouch === null) {
    onTouch = window.matchMedia(COARSE_POINTER_QUERY).matches;
    eased = raw;
    easedAt = time ?? -1;
  }
  if (!onTouch || time === undefined) return raw;
  if (time === easedAt) return eased;

  const seconds = Math.min(0.05, Math.max(0, (time - easedAt) / 1000));
  easedAt = time;
  if (Math.abs(raw - eased) > JUMP * window.innerHeight) {
    eased = raw;
    return eased;
  }
  /* Frame-rate independent, so a capped tier eases at the same speed. */
  eased += (raw - eased) * (1 - Math.pow(1 - SMOOTHING, seconds * 60));
  return eased;
};

/**
 * @param time - the ticker's frame timestamp. Passed by anything drawing per
 *   frame, so the touch low pass can advance exactly once a frame; omitted by
 *   a one-off read, which takes the raw position.
 */
export const stageProgress = (
  { top, travel }: StageMetrics,
  time?: number,
): number => Math.min(1, Math.max(0, (scrolled(time) - top) / travel));

/**
 * The staging primitive the scene itself uses, repeated here so a fade shares
 * the shape of every other transition: 0 below `start`, 1 above `end`, linear in
 * between.
 */
export const ramp = (start: number, end: number, value: number): number =>
  Math.min(1, Math.max(0, (value - start) / Math.max(end - start, 0.0001)));
