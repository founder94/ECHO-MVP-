/**
 * Scroll-track scaling.
 *
 * The scroll document's four timeline tracks (`scroll-stage`) are each one clock
 * unit; their height is the scroll distance that advances that unit. This factor
 * makes a track taller than a viewport so the scenes need more scroll to hand off
 * — without touching the clock's `p1 + 2·p2 + p3` shape or its 0→4 range.
 *
 * (This file used to also compute the per-line text-reveal bands; those are gone
 * now that every section is a fixed Figma overlay — see ADR-0025.)
 */

/**
 * Scroll length of one timeline track, in `lvh` (one viewport = 100).
 *
 * Raising it lengthens the whole timeline. At 200 the timeline takes twice the
 * scroll it did at 100.
 */
export const SCROLL_TRACK_LVH = 200;

/**
 * Format a track offset as a CSS length. One track is {@link SCROLL_TRACK_LVH}
 * `lvh`, and the `toFixed` trims binary-float noise (`1.15 * 200 =
 * 229.99999999999997`).
 */
export const toLvh = (tracks: number): string =>
  `${Number((tracks * SCROLL_TRACK_LVH).toFixed(4))}lvh`;
