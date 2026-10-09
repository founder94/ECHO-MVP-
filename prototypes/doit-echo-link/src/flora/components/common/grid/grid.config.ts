// 📖 Docs: obsidian/frontend/components/common.md

/**
 * Adaptive scaling grid configuration.
 *
 * The grid keeps a rem-based design proportional across viewports by scaling
 * the root (`<html>`) font-size. Each breakpoint maps a viewport `maxWidth` to
 * the design `baseWidth` it was laid out at — at `baseWidth` the root
 * font-size equals `FONT_BASE` and rem values match the design 1:1.
 *
 * - Scaling DOWN (viewport at or below `GRID_BASE_WIDTH`) is driven by the
 *   `vw` media queries in `src/app/globals.css`.
 * - Scaling UP (viewport above `GRID_BASE_WIDTH`) is driven at runtime by the
 *   `AdaptiveGrid` component / `useAdaptiveGrid` hook.
 *
 * Changing these values means updating the `html` media queries in
 * `globals.css` to match — the formula is:
 *   font-size: FONT_BASE * 100 / baseWidth  (vw)
 */

/** Root font-size (px) the design is measured against. */
export const FONT_BASE = 16;

export interface GridBreakpoint {
  /** Media-query `max-width` threshold (px). */
  maxWidth: number;
  /** Design base width (px) the range was laid out at. */
  baseWidth: number;
}

/**
 * Breakpoints, largest first.
 *
 * The widest range is laid out at 1440 rather than at its own 1920: that is
 * the width every frame of this design is drawn at, and a range that divided
 * by 1920 would shrink the composition into the middle of a wide screen.
 *
 * The thresholds below are the handovers between the drawn frames, taken at
 * the geometric middle of each pair so neither side is asked to stretch more
 * than the other — 1214, 887, and 600 for the 768↔390 gap, biased toward the
 * phone. Every drawn width lands inside its own range and renders at exactly
 * `FONT_BASE`, which is the point: the four frames do not move.
 */
export const GRID_BREAKPOINTS: readonly GridBreakpoint[] = [
  { maxWidth: 1920, baseWidth: 1440 },
  { maxWidth: 1440, baseWidth: 1440 },
  { maxWidth: 1214, baseWidth: 1024 },
  { maxWidth: 887, baseWidth: 768 },
  { maxWidth: 600, baseWidth: 390 },
];

/**
 * The width the scale-up is measured from — the design width of the widest
 * range, not its upper bound. Above it `AdaptiveGrid` carries the root
 * font-size on from where the `vw` rule in `globals.css` leaves it, so the two
 * meet at the same value instead of stepping.
 */
export const GRID_BASE_WIDTH = GRID_BREAKPOINTS[0].baseWidth;
