"use client";

// 📖 Docs: obsidian/frontend/scene-3d.md

import { useEffect } from "react";

import { isRobotView, useRobot } from "@clarix/components/common/robot-view";

/** The scene at rest, captured from the running page — the robot form's backdrop. */
const SCENE_STILL = { desktop: "/assets/robot/scene-desktop.webp", mobile: "/assets/robot/scene-mobile.webp" };

const BG_ID = "clarix-bg";
const FG_ID = "clarix-fg";

/**
 * Starts the scene as soon as this module is evaluated in the browser — before
 * hydration, like the shipped page's module script, which began the preloader
 * at DOMContentLoaded. Waiting for hydration + a post-mount `import()` put the
 * whole entrance behind the original (measured: first WebGL frame at ~370 ms
 * vs ~90 ms; with this, and without the starter's `app/loading.tsx` Suspense
 * boundary whose throttled reveal held the page segment back ~200 ms, ~120 ms).
 * The canvases are server-rendered, so they are already in the DOM; React
 * never touches what three does to them. The scene module is its own chunk.
 */
/** One scene per page, held on `window` so a dev module re-evaluation (Fast
    Refresh) finds the running one instead of starting a second on the same canvases. */
type SceneSlot = { running: Promise<(() => void) | undefined> | null; mounted: number };
const slot = (): SceneSlot => {
  const w = window as typeof window & { __clarixScene?: SceneSlot };
  w.__clarixScene ??= { running: null, mounted: 0 };
  return w.__clarixScene;
};
const start = () => {
  if (typeof window === "undefined") return null;
  const s = slot();
  if (s.running) return s.running;
  const parsed =
    document.readyState === "loading"
      ? new Promise<void>((r) => document.addEventListener("DOMContentLoaded", () => r(), { once: true }))
      : Promise.resolve();
  // three is evaluated in a task of its own before the scene module (together
  // they were one ~60 ms task, ~250 ms on a 4× phone).
  const scene = import("three")
    .then(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
    .then(() => import("@clarix/lib/scene/clarix"));
  s.running = Promise.all([scene, parsed]).then(([{ initClarix }]) => {
    const bg = document.getElementById(BG_ID);
    const fg = document.getElementById(FG_ID);
    if (!(bg instanceof HTMLCanvasElement) || !(fg instanceof HTMLCanvasElement)) return undefined;
    // The robot form (D-016) has no canvases (a still instead) — and the
    // server's marker is in the parsed document by DOMContentLoaded.
    if (isRobotView()) return undefined;
    return initClarix(bg, fg);
  });
  return s.running;
};
// 연결 시안(Vite 단일 쪽 앱): 원본은 서버가 그린 캔버스가 이미 문서에 있어 모듈을 읽자마자 시작했다.
// 여기서는 React 가 캔버스를 그린 뒤(LiveSceneCanvas 의 effect)에만 시작한다 — 먼저 부르면 캔버스를 못 찾은
// 결과가 slot 에 남아 장면이 영영 시작되지 않는다.

/**
 * The two fixed full-viewport WebGL layers of the shipped page: the ASCII
 * background (z 1, under every text layer) and the holographic model with its
 * preloader blob and particle logo (z 3 — over the z 2 titles, under the z 4+
 * panels). Unmounting stops the loop and releases the GL resources.
 * Phones (D-033): `absolute` in the view's sticky stage box, which scrolls
 * away after "growth" — fixed everywhere else.
 */
export const SceneCanvas = () => (useRobot() ? <SceneStill /> : <LiveSceneCanvas />);

/** The robot form (D-016): the scene as a still, no WebGL. */
const SceneStill = () => (
  <picture>
    <source media="(min-width: 640px)" srcSet={SCENE_STILL.desktop} />
    <img src={SCENE_STILL.mobile} alt="" aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-1 block h-screen w-screen object-cover" />
  </picture>
);

const LiveSceneCanvas = () => {
  useEffect(() => {
    slot().mounted++;
    start();
    return () => {
      slot().mounted--;
      // Deferred: React's StrictMode (next dev) unmounts and remounts every
      // effect once. Disposing here synchronously raced the remount — the old
      // scene's cleanup ran *after* the new one had taken the same canvases,
      // releasing the background renderer's GL state, so the interactive
      // gradient vanished in dev. Only a real unmount (nothing remounted by
      // the next task) disposes.
      setTimeout(() => {
        const s = slot();
        if (s.mounted > 0 || !s.running) return;
        const scene = s.running;
        s.running = null;
        void scene.then((cleanup) => cleanup?.());
      }, 0);
    };
  }, []);

  return (
    <>
      <canvas id={BG_ID} aria-hidden="true" className="fixed top-0 left-0 z-1 h-screen w-screen" />
      <canvas id={FG_ID} aria-hidden="true" className="fixed top-0 left-0 z-3 h-screen w-screen" />
    </>
  );
};
