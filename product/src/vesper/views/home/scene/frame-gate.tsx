"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import { subscribeToTicker } from "@vesper/lib/animation/ticker";
import { getSceneCover } from "@vesper/lib/scene/outro";
import { pageMotionPaused } from "@vesper/lib/scene/page-motion";

/** Past this the scene is fully behind the *opaque* closing content. Stop it. */
const HANDOFF = 0.995;

export interface FrameGateProps {
  targetFps: number;
}

/**
 * Drives the render loop by hand.
 *
 * The `<Canvas>` runs `frameloop="demand"`, so nothing renders until something
 * calls `invalidate()`. That is this component, throttled by the shared ticker —
 * which gives three things a free-running loop cannot:
 *
 * - a **frame rate per device tier** (60 / 45 / 30), so a phone spends its budget
 *   on fewer, cheaper frames instead of dropping them unevenly;
 * - **no work in a background tab** (`document.hidden`);
 * - **no work once the scene has handed off** to the closing sections, which is
 *   most of the page's scroll length.
 *
 * The clock itself keeps advancing on the ticker regardless, so the HUD never
 * stalls just because the scene stopped drawing.
 */
export const FrameGate = ({ targetFps }: FrameGateProps) => {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const interval = 1000 / targetFps;

    return subscribeToTicker(
      () => {
        if (document.hidden) return;
        if (getSceneCover() >= HANDOFF) return;
        // 2026-10-09(Codex P2): 움직임 줄이기 · 이용 안내 창 열림 → 새 프레임 0(마지막 장면이 그대로 남는다).
        if (pageMotionPaused()) return;
        invalidate();
      },
      () => interval,
    );
  }, [invalidate, targetFps]);

  return null;
};
