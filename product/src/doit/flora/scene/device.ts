/**
 * Device tiering for WebGL scenes.
 *
 * One module decides what "mobile" means, so DPR, particle counts, bloom and the
 * frame budget can never drift apart. Read the tier at construction, hold it in a
 * mutable slot, and re-read it only when the viewport width or the pointer media
 * query actually changes — never per frame.
 *
 * 📖 Docs: obsidian/frontend/dandelion-scene.md · .claude/skills/optimize-3d-scene §2
 */

export type DeviceTier = "mobile" | "tablet" | "desktop";

/** Breakpoints the tier is read at — aligned with the adaptive grid. */
const MOBILE_MAX_WIDTH = 768;
const TABLET_MAX_WIDTH = 1024;

/** `(hover: none) and (pointer: coarse)` — the clause that catches tablets. */
export const COARSE_POINTER_QUERY = "(hover: none) and (pointer: coarse)";

/** Web-exposed hints that have no lib.dom typing. */
interface NetworkInformation {
  saveData?: boolean;
}
interface NavigatorWithHints extends Navigator {
  connection?: NetworkInformation;
  deviceMemory?: number;
}

export const isCoarsePointer = (): boolean =>
  typeof window !== "undefined" && window.matchMedia(COARSE_POINTER_QUERY).matches;

export const readTier = (): DeviceTier => {
  if (typeof window === "undefined") return "desktop";
  const width = window.innerWidth;
  if (width < MOBILE_MAX_WIDTH || isCoarsePointer()) return "mobile";
  if (width < TABLET_MAX_WIDTH) return "tablet";
  return "desktop";
};

/**
 * A 3× phone renders 9× the fragments of a 1× screen for no perceptible gain on
 * soft-edged sprites — clamp hard, and apply the same value to the composer.
 *
 * The mobile floor is 1.0, not the 0.85 the skill suggests: the dandelion's
 * bristles are hard-edged, single-pixel detail, and below 1.0 they alias into a
 * visibly coarser flower than a desktop shows. §6 makes that exception itself.
 */
export const clampPixelRatio = (tier: DeviceTier): number => {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  if (tier === "mobile") return Math.min(dpr, 1);
  if (tier === "tablet") return Math.min(Math.max(dpr, 0.75), 1.25);
  return Math.min(Math.max(dpr, 0.75), 1.5);
};

/**
 * Minimum gap between frames (ms) — 0 means every tick.
 *
 * **Only a touch device is capped.** The tier is read off the window's width,
 * and a desktop window narrower than 1024 is a desktop GPU in a narrow window,
 * not a tablet: capped, the plant's slow sway on load went by in 30 steps a
 * second on a 60 Hz screen, and the reader saw it as the swing stuttering —
 * worst in its fastest part, the first lean. Measured at a 1000-wide window:
 * 30 scene frames a second against 60 before this, 60 after. The cap exists for
 * a phone's fill rate, so it is kept for a coarse pointer (ADR-0047).
 */
export const frameBudget = (tier: DeviceTier): number => {
  if (!isCoarsePointer()) return 0;
  if (tier === "mobile") return 1000 / 30;
  if (tier === "tablet") return 1000 / 45;
  return 0;
};

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The nearest web-exposed proxy for iOS Low Power Mode, which has no API. */
export const isEnergySaver = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as NavigatorWithHints;
  return nav.connection?.saveData === true || (nav.deviceMemory ?? 8) <= 2;
};

/**
 * Reduced motion on any device, or a mobile flagged energy-constrained: play the
 * entrance, then stop drawing on a settled frame. WebGL keeps the last frame on
 * the canvas, so a frozen scene costs nothing.
 */
export const sceneShouldFreeze = (tier: DeviceTier): boolean =>
  prefersReducedMotion() || (tier === "mobile" && isEnergySaver());
