"use client";

import { Interpolation, SpringValue } from "@react-spring/web";
import { useEffect, useMemo } from "react";

import { sceneTimeline } from "@vesper/lib/scene/timeline";

/**
 * Shared plumbing for the three fixed section overlays ({@link Hero},
 * {@link SectionGalaxy}, {@link SectionBrain}).
 *
 * Each is a full-viewport `fixed` layer whose opacity is scrubbed by the global
 * scene clock, and each is always mounted — a fixed overlay cannot use in-view,
 * so it has to be there to be faded.
 */

/** Below this the overlay is visually gone, so it should cost nothing. */
const CLEAR = 0.001;

/** A value the overlay's opacity can be derived from. */
type Fade = SpringValue<number> | Interpolation<number, number>;

/**
 * Mirror the scene clock into a `SpringValue` the overlay can derive styles
 * from.
 *
 * Deliberately not React state: the clock advances every ticker frame, and a
 * `setState` at that rate would re-render the whole overlay — split text and all
 * — 60 times a second. The spring writes straight to the DOM instead.
 */
export const useSceneClock = (): SpringValue<number> => {
  const clock = useMemo(() => new SpringValue(0), []);
  useEffect(
    () => sceneTimeline.subscribe((value) => clock.set(value)),
    [clock],
  );
  return clock;
};

/**
 * `visibility` for an overlay, derived from its own opacity.
 *
 * `opacity: 0` hides a layer but does **not** retire it: the browser still
 * rasterises it every frame. That is expensive here in a way it usually is not —
 * the copy is split into per-letter spans by `spring-text-engine`, each one
 * carrying an animated `filter: blur()`, composited over a full-screen WebGL
 * canvas. Two of the three overlays are invisible at any given moment, so most
 * of that work is for nothing.
 *
 * `visibility: hidden` takes the subtree out of paint entirely while leaving it
 * mounted and laid out, so the springs and the text engine keep their state and
 * the fade back in is unchanged.
 */
export const hiddenWhenClear = (
  opacity: Fade,
): Interpolation<number, "visible" | "hidden"> =>
  opacity.to((value): "visible" | "hidden" =>
    value < CLEAR ? "hidden" : "visible",
  );

/** `smoothstep` — the eased 0→1 ramp every overlay window is built from. */
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
