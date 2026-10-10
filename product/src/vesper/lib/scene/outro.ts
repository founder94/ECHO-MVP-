/**
 * Outro clock — 0 while the scene owns the frame, 1 once the closing sections do.
 *
 * Driven by a `useProgressTrigger` on the first closing section. The section
 * overlays bind to it to fade out, and the brain plays its approach/burst exit
 * against it, as the white "Financial" card floats up over the scene.
 */

import { SpringValue } from "@react-spring/web";

export const outroValue = new SpringValue(0);

/** Scroll-scrubbed, so `set` (instant) rather than `start` (sprung). */
export const setOutro = (progress: number): void => {
  outroValue.set(progress);
};

export const getOutro = (): number => outroValue.get();

/**
 * Scene-cover clock — 0 while the scene is still visible (including behind the
 * translucent-margined Financial card), 1 once the **opaque** closing content
 * (FAQ / footer) has scrolled up and hidden it. Separate from `outro` so the
 * scene keeps drawing — the shader stays visible around the card — until real
 * opaque content actually covers it, which is when the frame gate stops.
 */
export const sceneCoverValue = new SpringValue(0);

export const setSceneCover = (progress: number): void => {
  sceneCoverValue.set(progress);
};

export const getSceneCover = (): number => sceneCoverValue.get();
