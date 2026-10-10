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
/**
 * 2026-10-09(Codex 검수 P2 · PR #151): 멈춤 상태(움직임 줄이기 · 이용 안내)로 시작하면 `running` 이 false 라 첫 장조차
 * 없었다. 멈춤 중에는 지금 상태로 **한 장만** 그린다 — 시작할 때, 페이지가 `frame` 을 보낼 때(스크롤 등 상태 변화),
 * 크기가 바뀌어 버퍼가 지워졌을 때. 시계는 「자리 잡은」 값으로 한 번에 건너뛴다(지난 장보다 1초 이상 뒤): 카메라 ·
 * 포인터 따라가기가 `min(1, delta × k)` 로 완화되므로 큰 delta 한 번이면 목표 자리에 바로 선다(delta 0 이면 등장
 * 전 먼 카메라에 멈춘 작은 구슬이 남는다). 등장(intro)은 `lib/scene/intro.ts` 가 멈춤이면 끝 상태(1)로 둔다.
 */
const drawOnce = () => {
  if (!store || running) return;
  frameApi.requestAnimationFrame((time) => {
    if (!store || running) return;
    if (origin < 0) origin = time;
    last = time;
    seconds = Math.max((time - origin) / 1000, seconds + 1);
    advance(seconds, true, store.getState());
  });
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
  if (!message.running) drawOnce();
  // 준비되는 동안 온 마지막 크기·상태·재생·그리기를 이제 반영한다(페이지는 이미 보냈다고 여긴다).
  for (const type of REPLAY_ORDER) {
    const queued = early.get(type);
    if (queued) apply(queued);
  }
  // 모아 둔 「멈춤」이 막 시작한 재생을 끊었으면 한 장도 없을 수 있다: 멈춤이면 지금 상태로 한 장(재생 중이면 아무것도 안 함).
  if (early.size) drawOnce();
  early.clear();
};

// 2026-10-10(Codex P2 4236844168): `root.configure()` 를 기다리는 동안 온 메시지를 버리면 마지막 intro·멈춤
// 상태가 영영 오지 않을 수 있다. 종류마다 마지막 것만 모아 두었다가 준비되면 이 순서로 보낸다.
const early = new Map<SceneMessage["type"], SceneMessage>();
const REPLAY_ORDER: SceneMessage["type"][] = ["resize", "state", "run", "frame"];

const apply = (message: SceneMessage) => {
  if (!store) return;
  if (message.type === "state") {
    syncTimeline(message.progress, message.target);
    introValue.set(message.intro);
    outroValue.set(message.outro);
    store.getState().pointer.set(message.x, message.y);
  } else if (message.type === "run") {
    setRunning(message.on);
  } else if (message.type === "frame") {
    drawOnce();
  } else if (message.type === "resize") {
    void resize(message);
  }
};

self.onmessage = (event: MessageEvent<SceneMessage>) => {
  const message = event.data;
  if (message.type === "init") {
    start(message).catch(() => reply({ type: "error" }));
    return;
  }
  if (!store || !root) {
    early.set(message.type, message);
    return;
  }
  apply(message);
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
  if (!store) return;
  // 크기가 바뀌면 버퍼가 지워진다: 멈춤 중이어도 한 장은 다시 그린다(회전한 채 빈 화면 0).
  if (running) advance(seconds, true, store.getState());
  else drawOnce();
};
