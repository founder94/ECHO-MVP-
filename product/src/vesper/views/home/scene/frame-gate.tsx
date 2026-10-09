"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import { subscribeToTicker } from "@vesper/lib/animation/ticker";
import { getIntro } from "@vesper/lib/scene/intro";
import { getOutro, getSceneCover } from "@vesper/lib/scene/outro";
import { sceneTimeline } from "@vesper/lib/scene/timeline";
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
    let stillKey = "";

    return subscribeToTicker(
      () => {
        if (document.hidden) return;
        if (getSceneCover() >= HANDOFF) return;
        // 2026-10-09(Codex P2): 움직임 줄이기 · 이용 안내 창 열림 → 시간에 따른 새 프레임 0.
        // 스크롤 등 상태(진행도 · 등장/퇴장)가 바뀔 때만 한 장(처음 한 장 포함) 다시 그린다.
        if (pageMotionPaused()) {
          const key = `${sceneTimeline.getProgress()}|${sceneTimeline.getTarget()}|${getIntro()}|${getOutro()}`;
          if (key === stillKey) return;
          stillKey = key;
          invalidate();
          return;
        }
        stillKey = "";
        invalidate();
      },
      () => interval,
    );
  }, [invalidate, targetFps]);

  return null;
};
