"use client";

/**
 * How far the page has scrolled through the stage an element sits in, 0 → 1.
 *
 * This is the same number the scene's camera flies on, read the same way
 * (`src/lib/scene/stage-progress.ts`): the stage is measured on mount and on
 * resize, **never per frame**, and a frame reads `window.scrollY` and nothing
 * else. An overlay that called `getBoundingClientRect()` every frame would
 * force a layout in the frame Lenis and the WebGL loop are already sharing —
 * the stutter optimize-3d-scene §9 is about.
 *
 * 📖 Docs: obsidian/frontend/hooks.md
 */

import { type RefObject, useEffect, useRef } from "react";

import { subscribeToTicker } from "@flora/lib/animation/ticker";
import { measureStage, stageProgress } from "@flora/lib/scene/stage-progress";

/** No throttle: the overlay rides the scene, so it reads as often as it draws. */
const EVERY_FRAME = () => 0;

export const useStageProgress = (
  ref: RefObject<HTMLElement | null>,
  onProgress: (progress: number) => void,
): void => {
  const handler = useRef(onProgress);

  useEffect(() => {
    handler.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let stage = measureStage(element);
    const remeasure = () => {
      stage = measureStage(element);
    };

    window.addEventListener("resize", remeasure);
    const unsubscribe = subscribeToTicker(
      // The frame's own timestamp goes in: on touch the position is low-passed
      // once per frame, upstream, and the overlay has to read the same eased
      // number the scene flies on or the two drift apart.
      (time) => handler.current(stageProgress(stage, time)),
      EVERY_FRAME,
    );

    return () => {
      window.removeEventListener("resize", remeasure);
      unsubscribe();
    };
  }, [ref]);
};
