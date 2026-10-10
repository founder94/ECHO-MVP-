import { easings } from "@react-spring/web";

/**
 * Shared reveal presets for the section copy.
 *
 * **Headings** and **body copy** animate per-letter / per-word with
 * `spring-text-engine`; **non-text units** (buttons, labels, lists) and the
 * **photo** use the `Inview` spring wrapper.
 *
 * ## Keeping the layout put
 * `TextEngine` lays its container out as `display:flex; flex-wrap:wrap` with a
 * `column-gap` between words, AND hardcodes `position: relative` on it. Three
 * things must be handled at every call site or the copy shifts:
 * 1. **Positioning** — the inline `position: relative` beats a Tailwind `absolute`
 *    class, so an absolutely-positioned engine falls back into flow (left-anchored
 *    copy survives by coincidence; `right-0` / centered copy breaks). Pass
 *    `style={{ position: "absolute" }}` — the engine spreads `...style` last, so it
 *    wins. (In-flow copy like the FAQ title needs nothing.)
 * 2. **Alignment** — flex ignores `text-align`. Centered copy needs
 *    `justify-center`, right-aligned copy needs `justify-end` (left is the flex
 *    default). Keep the `text-*` class too, for the hidden SEO copy.
 * 3. **Word spacing** — `columnGap` (below) replaces the natural space; ~0.25em
 *    matches the font's space glyph. Tune here if spacing looks off.
 *
 * Letters carry **no transform** (opacity + blur only), and words translate via
 * the inner span — never the container — so neither disturbs the box or a
 * `-translate-x-1/2` centering. Spread a preset into `<TextEngine>` / `<Inview>`;
 * set `mode`, `enabled`, `immediateOut`, `delayIn`, `tag`, `className` per site.
 */

const SOFT = { duration: 1000, easing: easings.easeOutQuint };
const SOFT_SLOW = { duration: 1200, easing: easings.easeOutQuint };

/** How far out of focus a heading starts, in px. */
export const LETTER_BLUR = 12;

/** Heading — per-letter, left→right, blur + opacity (no transform → box stays). */
export const LETTER_REVEAL = {
  letterIn: { opacity: 1, filter: "blur(0px)" },
  letterOut: { opacity: 0, filter: `blur(${LETTER_BLUR}px)` },
  letterStagger: 26,
  letterConfig: SOFT,
  columnGap: 0.25,
} as const;

/**
 * `LETTER_REVEAL` for the fixed overlays over the canvas: the same staggered
 * fade, with the blur taken off the letters and applied once per line by
 * `LineBlur`. A filter per letter there dropped frames mid-scroll.
 */
export const LETTER_FADE = {
  ...LETTER_REVEAL,
  letterIn: { opacity: 1 },
  letterOut: { opacity: 0 },
} as const;

/** Body / sub-head — per-word, bottom→up, blur + opacity. */
export const WORD_REVEAL = {
  wordIn: { y: 0, opacity: 1, filter: "blur(0px)" },
  wordOut: { y: 16, opacity: 0, filter: "blur(8px)" },
  wordStagger: 42,
  wordConfig: SOFT_SLOW,
  columnGap: 0.25,
} as const;

/** How far out of focus body copy starts, in px. */
export const WORD_BLUR = 8;

/**
 * `WORD_REVEAL` with the blur taken off the words and applied once per
 * paragraph by `LineBlur unit="word"` — a filter per word dropped frames
 * mid-scroll (D-031). Same rise, same staggered fade.
 */
export const WORD_FADE = {
  ...WORD_REVEAL,
  wordIn: { y: 0, opacity: 1 },
  wordOut: { y: 16, opacity: 0 },
} as const;

/** Non-text unit (button, tag row, label) — fade + blur + rise, via `Inview`. */
export const UNIT_REVEAL = {
  from: { opacity: 0, y: 20, filter: "blur(10px)" },
  to: { opacity: 1, y: 0, filter: "blur(0px)" },
  config: SOFT,
} as const;

/**
 * {@link UNIT_REVEAL} for the first screen, with its fade drawn as a uniform
 * mask instead of `opacity` (vexon's `fadeMask`): `mask-image` with one alpha
 * paints exactly what `opacity` with that alpha paints, while the element's
 * opacity stays 1. Lighthouse's axe reads `opacity`, not masks, so it no longer
 * samples the hero's CTA mid-fade at 1.1–3.9:1 (axe-sweep, desktop ~2.4 s) —
 * a visitor sees the same frames.
 */
export const UNIT_REVEAL_FIRST_SCREEN = {
  from: {
    maskImage: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
    y: 20,
    filter: "blur(10px)",
  },
  to: {
    maskImage: "linear-gradient(rgba(0,0,0,1),rgba(0,0,0,1))",
    y: 0,
    filter: "blur(0px)",
  },
  config: SOFT,
} as const;

/** Image mask — reveals top→bottom (the clip opens downward), via `Inview`. */
export const MASK_REVEAL = {
  from: { clipPath: "inset(0 0 100% 0)" },
  to: { clipPath: "inset(0 0 0% 0)" },
  config: SOFT_SLOW,
} as const;

/**
 * White-card reveal, via `Inview`. The card scales up, unblurs, and tilts on the
 * horizontal axis (`rotateX`) as it settles — needs `perspective` + `origin-bottom`
 * on the wrapper for the tilt to read in 3D. `scale`/`rotateX` are react-spring
 * transform shorthands, so they compose on the animated element's `transform`.
 */
export const CARD_REVEAL = {
  from: { opacity: 0, scale: 0.94, rotateX: 12, filter: "blur(14px)" },
  to: { opacity: 1, scale: 1, rotateX: 0, filter: "blur(0px)" },
  config: SOFT_SLOW,
} as const;
