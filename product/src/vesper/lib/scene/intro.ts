/**
 * Intro reveal clock — a single 0→1 spring, started once the loader finishes.
 *
 * Drives the camera dolly-in, the HUD fade-up, and the first section's copy.
 * A bare `SpringValue` (rather than a `useSpring` hook) so the render loop can
 * read it imperatively via `getIntro()` outside of React, while the HUD binds
 * to it declaratively through `animated`.
 */

import { SpringValue, easings } from "@react-spring/web";

import { pageMotionPaused } from "@vesper/lib/scene/page-motion";

/**
 * Duration of the intro reveal.
 *
 * Longer than the source's 1800 ms: the orb now assembles out of points flying
 * in from the camera, and at the old pace they crossed the frame too fast to
 * read as gathering.
 */
const INTRO_DURATION_MS = 2900;

export const introValue = new SpringValue(0);

let started = false;

export const startIntro = (): void => {
  if (started) return;
  started = true;
  // 2026-10-09(Codex 검수 P2 · PR #151): 움직임 줄이기(또는 이용 안내 열림)면 등장을 재생하지 않고 끝 상태로 — 장면 루프가
  // 멈춘 채 그리는 한 장이 「구슬이 모이다 만 모습」이 되지 않게.
  if (pageMotionPaused()) {
    introValue.set(1);
    return;
  }
  introValue.start({
    to: 1,
    config: { duration: INTRO_DURATION_MS, easing: easings.easeOutCubic },
  });
};

/** Live 0→1 intro progress, safe to read every frame. */
export const getIntro = (): number => introValue.get();
