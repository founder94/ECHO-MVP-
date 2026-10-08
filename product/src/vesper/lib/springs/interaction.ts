import type { CSSProperties } from "react";
import type { SpringConfig } from "@react-spring/web";

/**
 * The site's interaction language — how every button, link and row answers a
 * pointer.
 *
 * Three states, layered: `hover` merges over `rest`, and `press` merges over both.
 * So a preset only declares what actually changes.
 *
 * **No scale, anywhere.** A control that grows under the cursor is a tell that the
 * motion was added for its own sake. These respond in colour and weight instead:
 * the surface takes light, the border firms up, the ink shifts to the accent. The
 * box never moves, so nothing reflows and nothing wobbles against the WebGL scene
 * behind it.
 *
 * ## Why the colours are literals here, not `var(--token)`
 * react-spring animates a colour by interpolating its channels, which it can only
 * do between two *parsed* colours. `var(--chalk)` is an opaque string to it, so a
 * spring between two custom properties does not animate — it snaps on the first
 * frame, which is exactly the CSS-transition-shaped result the project bans.
 *
 * This is the same exemption `lib/scene/constants.ts` takes for the WebGL palette,
 * and for the same reason: these are values an *interpolator* consumes, not styles
 * a stylesheet resolves. **Keep them in step with the tokens in `globals.css`.**
 */

/** Mirrors `--chalk` / `--signal` / the ink the Figma CTAs sit on. */
const CHALK = "#fdfdfd";
const SIGNAL = "#6cf3a3";
const SIGNAL_DEEP = "#4bd888";
const INK = "#000000";

const alpha = (value: number) => `rgba(255, 255, 255, ${value})`;
const ink = (value: number) => `rgba(0, 0, 0, ${value})`;

/** Style at each interaction state. `hover` and `press` layer over `rest`. */
export interface Interaction {
  rest: CSSProperties;
  hover?: CSSProperties;
  press?: CSSProperties;
}

/** Settling toward a hover — quick, but it reads as a move, not a jump. */
export const HOVER_CONFIG: SpringConfig = { tension: 320, friction: 30 };

/**
 * Answering a press — near-instant. A press is a *confirmation*: any perceptible
 * lag between finger and surface reads as the control being broken, not soft.
 */
export const PRESS_CONFIG: SpringConfig = { tension: 700, friction: 26 };

/**
 * The filled CTA (Send Request). White block, black label.
 *
 * Hover takes it to the signal mint — the accent already carried by the footer's
 * Contact button — so the primary action lights up rather than merely dimming.
 */
export const SOLID_CTA: Interaction = {
  rest: { backgroundColor: CHALK, color: INK },
  hover: { backgroundColor: SIGNAL },
  press: { backgroundColor: SIGNAL_DEEP },
};

/** The bordered ghost button (header / mobile "Contact Us"). */
export const GHOST: Interaction = {
  rest: {
    borderColor: alpha(0.5),
    backgroundColor: alpha(0),
    color: CHALK,
  },
  hover: { borderColor: alpha(1), backgroundColor: alpha(0.12) },
  press: { backgroundColor: alpha(0.22) },
};

/** The footer's submit — a ghost button that already reads in the accent. */
export const GHOST_SIGNAL: Interaction = {
  rest: {
    borderColor: alpha(0.5),
    backgroundColor: alpha(0),
    color: SIGNAL,
  },
  hover: { borderColor: SIGNAL, backgroundColor: "rgba(108, 243, 163, 0.12)" },
  press: { backgroundColor: "rgba(108, 243, 163, 0.22)" },
};

/** Primary nav links — white ink that picks up the accent. */
export const NAV_LINK: Interaction = {
  rest: { color: CHALK },
  hover: { color: SIGNAL },
  press: { color: SIGNAL_DEEP },
};

/** Secondary links (the footer's columns) — already dimmed; hover brings them up. */
export const MUTED_LINK: Interaction = {
  rest: { color: alpha(0.7) },
  hover: { color: alpha(1) },
  press: { color: alpha(0.8) },
};

/** Icon-only or wordmark controls — the logo, the burger. Nothing to recolour. */
export const QUIET: Interaction = {
  rest: { opacity: 1 },
  hover: { opacity: 0.6 },
  press: { opacity: 0.45 },
};

/** A full-width row on a **white** surface — the FAQ accordion. */
export const CARD_ROW: Interaction = {
  rest: { backgroundColor: ink(0) },
  hover: { backgroundColor: ink(0.035) },
  press: { backgroundColor: ink(0.07) },
};

/** A control on a white surface (the cookie banner's primary). */
export const SOLID_INVERSE: Interaction = {
  rest: { backgroundColor: CHALK, color: INK, opacity: 1 },
  hover: { opacity: 0.85 },
  press: { opacity: 0.72 },
};

/** A quiet, bordered control on a white surface (the cookie banner's secondary). */
export const GHOST_INVERSE: Interaction = {
  rest: { borderColor: ink(0.15), backgroundColor: ink(0) },
  hover: { borderColor: ink(0.3), backgroundColor: ink(0.04) },
  press: { backgroundColor: ink(0.08) },
};

/** A plain text link (error / 404 / inline legal copy). */
export const TEXT_LINK: Interaction = {
  rest: { opacity: 1 },
  hover: { opacity: 0.65 },
  press: { opacity: 0.5 },
};
