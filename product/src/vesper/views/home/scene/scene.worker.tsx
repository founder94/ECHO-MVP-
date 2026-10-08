/**
 * The r3f scene on an OffscreenCanvas, off the page's main thread.
 *
 * On a phone (4× CPU) the canvas creation (~190 ms), the galaxy's deferred
 * mount (~145 ms) and three.js itself all ran on the main thread during the
 * load, alongside hydration — most of the page's TBT. Here they run in a
 * worker: the scene code is unchanged, and the page sends what the scene used
 * to read from it — the scroll clock, the intro/outro springs, the pointer and
 * the size — once per frame it wants drawn (`scene-host.tsx`). A failure to
 * start posts `{ type: "error" }`, and the page renders the scene itself.
 *
 * See obsidian/meta/changelog.md (2026-10-04).
 */

import { advance, createRoot, extend, type RootStore } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";

import { SCENE_BACKGROUND } from "@vesper/lib/scene/constants";
import { introValue } from "@vesper/lib/scene/intro";
import { outroValue } from "@vesper/lib/scene/outro";
import { syncTimeline } from "@vesper/lib/scene/timeline";
import { setSceneWidth } from "./adaptive";
import { MainScene } from "./main-scene";
import type { SceneMessage, SceneReply } from "./scene-protocol";

// `<Canvas>` registers three's classes as JSX elements itself; a bare root
// doesn't.
extend(THREE as unknown as Parameters<typeof extend>[0]);

const reply = (message: SceneReply) => self.postMessage(message);

let store: RootStore | null = null;
let running = false;
let interval = 1000 / 60;
let last = 0;
let loop = 0;
/** The first frame's timestamp — the scene clock's zero, as `<Canvas>` starts at 0. */
let origin = -1;
/** The last frame's clock, in seconds — a re-size redraws at it. */
let seconds = 0;

/*
 * The worker paces its own frames on the OffscreenCanvas's animation frames
 * (a dedicated worker has `requestAnimationFrame`): the tier's frame rate
 * (the jitter slack of `lib/animation/ticker.ts`), nothing while the page says
 * stop. Driven instead by a message per page frame, each render landed one
 * worker frame after the page's and the two loops beat against each other —
 * hosted desktop scroll went from 0 to 5 % dropped frames.
 */
const frameApi = self as unknown as {
  requestAnimationFrame: (callback: (time: number) => void) => number;
  cancelAnimationFrame: (handle: number) => void;
};
const tick = (time: number) => {
  loop = 0;
  if (!running || !store) return;
  if (time - last >= interval - 1) {
    last = time;
    if (origin < 0) origin = time;
    // `advance` takes the clock in SECONDS: with `frameloop: "never"` r3f sets
    // `clock.elapsedTime` to it and hands `useFrame` the difference as `delta`.
    // Passed the frame's millisecond timestamp, every `clock.getElapsedTime()`
    // ran 1000× fast and every `delta` was ~33 "seconds" — the orb's spin,
    // wobble and noise flickered at random ("shaking", owner 2026-10-06) and
    // every delta-eased follow snapped. Seconds since the first frame match the
    // page's `<Canvas>` clock exactly, at any refresh rate.
    seconds = (time - origin) / 1000;
    advance(seconds, true, store.getState());
  }
  loop = frameApi.requestAnimationFrame(tick);
};
const setRunning = (on: boolean) => {
  running = on;
  if (on && !loop && store) loop = frameApi.requestAnimationFrame(tick);
  if (!on && loop) {
    frameApi.cancelAnimationFrame(loop);
    loop = 0;
  }
};
let root: ReturnType<typeof createRoot<OffscreenCanvas>> | null = null;

const sizeOf = (width: number, height: number) => ({
  width,
  height,
  top: 0,
  left: 0,
  // An OffscreenCanvas has no style to update; the page's element is sized by CSS.
  updateStyle: false,
});

const start = async (message: Extract<SceneMessage, { type: "init" }>) => {
  setSceneWidth(message.viewportWidth);
  root = createRoot(message.canvas);
  interval = 1000 / message.targetFps;
  await root.configure({
    // Rendered by `tick` above, not by r3f's own loop.
    frameloop: "never",
    dpr: message.dpr,
    size: sizeOf(message.width, message.height),
    // The same renderer settings as the page's `<Canvas>` (`scene-canvas.tsx`).
    gl: {
      powerPreference: "high-performance",
      alpha: true,
      antialias: false,
      toneMappingExposure: 1,
      toneMapping: THREE.ACESFilmicToneMapping,
      outputColorSpace: THREE.SRGBColorSpace,
    },
  });
  store = root.render(
    <>
      <color attach="background" args={[SCENE_BACKGROUND]} />
      <Suspense fallback={null}>
        <MainScene />
      </Suspense>
    </>,
  );
  setRunning(message.running);
};

self.onmessage = (event: MessageEvent<SceneMessage>) => {
  const message = event.data;
  if (message.type === "init") {
    start(message).catch(() => reply({ type: "error" }));
    return;
  }
  if (!store || !root) return;
  if (message.type === "state") {
    syncTimeline(message.progress, message.target);
    introValue.set(message.intro);
    outroValue.set(message.outro);
    store.getState().pointer.set(message.x, message.y);
  } else if (message.type === "run") {
    setRunning(message.on);
  } else if (message.type === "resize") {
    void resize(message);
  }
};

/**
 * Re-sizing clears the drawing buffer, so it happens only for a real change
 * and is followed by a frame in the same task: the next commit is a drawn
 * frame, never the cleared buffer (a blank flash on iOS, owner review 2,
 * D-036). The page sends a size only when the scene's box changes, and that
 * box no longer follows the toolbar (`SceneViewport`) — in practice, a rotation.
 */
const resize = async (message: Extract<SceneMessage, { type: "resize" }>) => {
  if (!store || !root) return;
  const { size, viewport } = store.getState();
  if (size.width === message.width && size.height === message.height && viewport.dpr === message.dpr) return;
  await root.configure({
    size: sizeOf(message.width, message.height),
    dpr: message.dpr,
  });
  if (running && store) advance(seconds, true, store.getState());
};
