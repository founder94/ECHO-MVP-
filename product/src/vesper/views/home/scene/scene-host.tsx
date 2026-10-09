"use client";

import { useEffect, useRef, useState } from "react";

import { SceneViewport } from "@vesper/components/common/scene-viewport";
import { subscribeToTicker } from "@vesper/lib/animation/ticker";
import { getIntro } from "@vesper/lib/scene/intro";
import { getOutro, getSceneCover } from "@vesper/lib/scene/outro";
import { pageMotionPaused } from "@vesper/lib/scene/page-motion";
import { sceneTimeline } from "@vesper/lib/scene/timeline";
import { getStableViewportHeight } from "@vesper/utils/stable-viewport";
import { getParams } from "./adaptive";
import { SceneCanvasLazy } from "./scene-canvas-lazy";
import type { SceneMessage, SceneReply } from "./scene-protocol";

/** Past this the scene is fully behind the *opaque* closing content (`frame-gate`). */
const HANDOFF = 0.995;

/** The renderer's pixel ratio for this tier — what r3f derives from `dpr={[min, max]}`. */
const pixelRatio = (): number => {
  const [min, max] = getParams(window.innerWidth).dpr;
  return Math.min(Math.max(window.devicePixelRatio || 1, min), max);
};

/** Draw only while the tab is visible and the scene not yet covered (`frame-gate`). */
const shouldRun = (): boolean =>
  !document.hidden && !pageMotionPaused() && getSceneCover() < HANDOFF;

const canRenderInWorker = (): boolean =>
  typeof Worker !== "undefined" &&
  typeof OffscreenCanvas !== "undefined" &&
  "transferControlToOffscreen" in HTMLCanvasElement.prototype;

/**
 * The widest viewport (the tablet tier, `adaptive.ts`) whose scene renders in
 * the worker. Wider ones keep the page's own `<Canvas>`: on the hosted record
 * (2026-10-04) desktop scroll went from 0 to 5 % dropped frames with the scene
 * in the worker — its frames are no longer drawn in the page's own frame —
 * while a desktop's main thread never needed the help (TBT 0–17 ms, perf 100
 * with the scene on it). Phones are where the load's main-thread time is.
 */
const WORKER_MAX_WIDTH = 1024;

const rendersInWorker = (): boolean =>
  window.innerWidth <= WORKER_MAX_WIDTH && canRenderInWorker();

/**
 * The full-viewport WebGL layer, rendered in a worker on phones and tablets.
 *
 * The canvas is handed to `scene.worker.tsx` (OffscreenCanvas), which runs the
 * unchanged r3f scene there: building it and three.js itself no longer hold the
 * page's main thread while it loads and hydrates. This element keeps what the
 * main thread owns — the frame gate (a per-tier frame rate, nothing while the
 * tab is hidden or the scene covered; see `frame-gate.tsx`), the scroll clock,
 * the intro/outro springs and the pointer — and posts them when they change;
 * the worker paces its own frames.
 *
 * Wider than a tablet (see `WORKER_MAX_WIDTH`), or where a worker can't
 * render (no OffscreenCanvas, no WebGL in workers), the page renders the same
 * scene itself (`SceneCanvasLazy`).
 */
export const SceneHost = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Client-only (`scene-host-lazy`), so the viewport is known at first render.
  const [fallback, setFallback] = useState(() => !rendersInWorker());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (fallback) return;

    let stop: (() => void) | null = null;
    let disposed = false;

    // Starts the worker in a task of its own once the page has loaded — not in
    // the hydration commit, where creating the worker and measuring the canvas
    // lengthened the page's longest task. The loader covers the scene until long
    // after this; the bare page script loaded the old main-thread canvas at the
    // same point.
    const begin = () => {
      if (disposed) return;
      let worker: Worker;
      try {
        const offscreen = canvas.transferControlToOffscreen();
        worker = new Worker(new URL("./scene.worker.tsx", import.meta.url), {
          type: "module",
        });
        const init: SceneMessage = {
          type: "init",
          canvas: offscreen,
          // The canvas fills `SceneViewport`: the viewport's width and the
          // large viewport's locked height, without a layout read.
          width: window.innerWidth,
          height: getStableViewportHeight() || window.innerHeight,
          viewportWidth: window.innerWidth,
          dpr: pixelRatio(),
          targetFps: getParams(window.innerWidth).targetFps,
          running: shouldRun(),
        };
        worker.postMessage(init, [offscreen]);
      } catch {
        setFallback(true);
        return;
      }

      let failed = false;
      const fail = () => {
        if (failed) return;
        failed = true;
        worker.terminate();
        setFallback(true);
      };
      worker.onmessage = (event: MessageEvent<SceneReply>) => {
        if (event.data.type === "error") fail();
      };
      worker.onerror = fail;

      const send = (message: SceneMessage) => {
        if (!failed) worker.postMessage(message);
      };

      // r3f's pointer, as `<Canvas eventSource={document.body}>` measured it.
      let x = 0;
      let y = 0;
      const onPointerMove = (event: PointerEvent) => {
        x = (event.clientX / window.innerWidth) * 2 - 1;
        y = -(event.clientY / window.innerHeight) * 2 + 1;
      };
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      // The page's own frames stop in a hidden tab: say so from the event.
      const onVisibility = () => {
        if (shouldRun() === on) return;
        on = shouldRun();
        send({ type: "run", on });
      };
      document.addEventListener("visibilitychange", onVisibility);

      // The worker draws on its own frames; the page tells it what changed —
      // the clocks and the pointer, and whether to draw at all.
      let sent = { progress: -1, target: -1, intro: -1, outro: -1, x: 0, y: 0 };
      let on = shouldRun();
      const unsubscribe = subscribeToTicker(
        () => {
          const run = shouldRun();
          if (run !== on) {
            on = run;
            send({ type: "run", on });
          }
          // 멈춤(움직임 줄이기 · 이용 안내)이라도 탭이 보이고 아직 덮이지 않았으면, 스크롤 등 상태가 바뀔 때 한 장만 다시 그린다.
          const pausedButShown = !on && pageMotionPaused() && !document.hidden && getSceneCover() < HANDOFF;
          if (!on && !pausedButShown) return;
          const next = {
            progress: sceneTimeline.getProgress(),
            target: sceneTimeline.getTarget(),
            intro: getIntro(),
            outro: getOutro(),
            x,
            y,
          };
          if (
            next.progress === sent.progress &&
            next.target === sent.target &&
            next.intro === sent.intro &&
            next.outro === sent.outro &&
            next.x === sent.x &&
            next.y === sent.y
          )
            return;
          sent = next;
          send({ type: "state", ...next });
          if (pausedButShown) send({ type: "frame" });
        },
        () => 0,
      );

      // The canvas's box is held at the large viewport (`SceneViewport`): the
      // iOS toolbar moving with the scroll no longer changes it, so this posts
      // on a rotation, not on every scroll direction change — each message
      // re-sizes (clears) the worker's drawing buffer (owner review 2, D-036).
      // The first callback reports the size it starts with — skip unchanged ones.
      let last = `${window.innerWidth}x${getStableViewportHeight() || window.innerHeight}`;
      const observer = new ResizeObserver(() => {
        const { clientWidth: width, clientHeight: height } = canvas;
        if (!width || !height || `${width}x${height}` === last) return;
        last = `${width}x${height}`;
        send({ type: "resize", width, height, dpr: pixelRatio() });
      });
      observer.observe(canvas);

      stop = () => {
        unsubscribe();
        observer.disconnect();
        window.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("visibilitychange", onVisibility);
        worker.terminate();
      };
    };

    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(begin, 0);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener("load", schedule);
      stop?.();
    };
  }, [fallback]);

  // Sized to the large viewport and locked while a phone scrolls — the iOS
  // toolbar no longer resizes the scene (owner review 2, D-036).
  return (
    <SceneViewport className="pointer-events-none">
      {fallback ? (
        <SceneCanvasLazy />
      ) : (
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 block h-full w-full" />
      )}
    </SceneViewport>
  );
};
