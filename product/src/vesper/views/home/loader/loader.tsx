"use client";

import { animated, easings, useSpring } from "@react-spring/web";
import { useCallback, useEffect, useRef, useState } from "react";

import type { LoaderCopy } from "@vesper/data/mocks/home";
import { subscribeToTicker } from "@vesper/lib/animation/ticker";
import { cubicBezier } from "@vesper/utils/animation/cubic-bezier";
import { StarFall } from "./star-fall";

/** The loader never flashes past faster than this, however fast assets land. */
const MIN_DURATION_MS = 900;
/** Beat spent showing a full bar before the curtain lifts. */
const HOLD_AT_FULL_MS = 260;
/** Gap between the curtain lifting and the intro reveal starting. */
const INTRO_DELAY_MS = 90;

const EXIT_MS = 900;
const exitEasing = cubicBezier(0.6, 0.05, 0.2, 1);

/** How far past 1 the star field pushes as the curtain leaves — the warp. */
const EXIT_INTENSITY = 2.6;

export interface LoaderProps {
  copy: LoaderCopy;
  /** Fired once the curtain starts lifting — kicks off the intro reveal. */
  onReady: () => void;
}

/**
 * What drei's `useProgress` reported here, always: nothing the scene needs goes
 * through a three.js loader (see below), so its loading manager never starts.
 * Importing the hook put `@react-three/drei` — and three.js with it — in the
 * page's first-load bundle, evaluated at hydration before the lazy scene chunk
 * was even asked for (mobile TBT). The constant keeps the loader's logic as it
 * was; if the scene ever loads through a three.js loader again, read the
 * progress from inside the lazy scene chunk, not from here.
 */
const SCENE_PROGRESS = { active: false, loaded: 0, total: 0 } as const;

export const Loader = ({ copy, onReady }: LoaderProps) => {
  const { active, loaded, total } = SCENE_PROGRESS;
  const [percent, setPercent] = useState(0);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Held in a ref so re-subscribing on load progress does not restart the floor.
  const startedAt = useRef<number | null>(null);
  const progressState = useRef({ active, loaded, total });
  const intensityRef = useRef(0);

  useEffect(() => {
    progressState.current = { active, loaded, total };
  }, [active, loaded, total]);

  // Read by the star field every frame — never through React, so the field is
  // free to run at whatever rate the ticker gives it.
  const intensity = useCallback(() => intensityRef.current, []);

  useEffect(() => {
    startedAt.current ??= performance.now();

    return subscribeToTicker(
      () => {
        const elapsed = performance.now() - (startedAt.current ?? 0);
        const { active, loaded, total } = progressState.current;

        const floor = Math.min(1, elapsed / MIN_DURATION_MS);
        // Nothing the scene needs goes through a three.js loader any more — the orb
        // and the galaxy are pure geometry, and the brain's mesh is fetched rather
        // than suspended on (ADR-0028) — so `total` stays 0. Treat "nothing to
        // load" as loaded, or the bar sticks at 0 and the curtain never lifts.
        const real = total > 0 ? loaded / total : 1;
        const target = Math.min(real, floor) * 100;

        setPercent((prev) => (Math.abs(prev - target) < 0.5 ? prev : target));

        const ready = !active && elapsed >= MIN_DURATION_MS && target >= 99;
        if (ready) {
          setPercent(100);
          setDone(true);
        }
      },
      () => 0,
    );
  }, []);

  // Ramp the star field: it accelerates with the bar, then warps out on exit.
  useEffect(() => {
    if (done) return;
    intensityRef.current = percent / 100;
  }, [percent, done]);

  useEffect(() => {
    if (!done) return;
    const start = performance.now();
    const stop = subscribeToTicker(
      () => {
        const t = Math.min(1, (performance.now() - start) / EXIT_MS);
        intensityRef.current = 1 + EXIT_INTENSITY * t;
      },
      () => 0,
    );
    return stop;
  }, [done]);

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(onReady, HOLD_AT_FULL_MS + INTRO_DELAY_MS);
    return () => clearTimeout(id);
  }, [done, onReady]);

  const exit = useSpring({
    opacity: done ? 0 : 1,
    scale: done ? 1.06 : 1,
    delay: done ? HOLD_AT_FULL_MS : 0,
    config: { duration: EXIT_MS, easing: exitEasing },
    onRest: () => {
      if (done) setHidden(true);
    },
  });

  const bar = useSpring({
    width: `${Math.floor(percent)}%`,
    config: { duration: 220, easing: easings.easeOutCubic },
  });

  if (hidden) return null;

  const shown = Math.floor(percent);

  return (
    <animated.div
      className="fixed inset-0 z-60 overflow-hidden bg-black font-tag text-[1.111vw] text-chalk uppercase max-lg:text-[0.875rem]"
      style={exit}
      role="status"
      aria-live="polite"
      aria-label={copy.initializing}
    >
      <StarFall intensity={intensity} />

      <div className="absolute top-0 left-0 flex items-center gap-loader-inline px-loader-x py-loader-y">
        <span>{copy.brand}</span>
        <span className="text-chalk/35">{copy.brandDetail}</span>
      </div>

      {/* The only chrome: a hairline that fills across the foot of the frame. */}
      <div className="absolute inset-x-0 bottom-0 px-loader-x pb-loader-y">
        <div className="mb-loader flex items-baseline justify-between">
          <span className="text-[0.972vw] text-chalk/40 max-lg:text-[0.75rem]">
            {copy.initializing}
          </span>
          <span className="font-general text-[1.111vw] tabular-nums text-chalk/80 max-lg:text-[0.875rem]">
            {String(shown).padStart(3, "0")}
            <span className="text-chalk/35">%</span>
          </span>
        </div>
        <div className="relative h-px w-full overflow-hidden bg-chalk/12">
          <animated.span
            className="absolute inset-y-0 left-0 block bg-chalk"
            style={bar}
          />
        </div>
      </div>
    </animated.div>
  );
};
