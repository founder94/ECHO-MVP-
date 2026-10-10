// 2026-10-10 Codex #158 P1: Flora 원본 src/lib/scene/dandelion/dandelion-geometry.worker.ts 를 그대로 옮김(입자 42만 개를 화면 스레드 밖에서 만든다).
/**
 * Builds the dandelion's particle buffers off the main thread.
 *
 * `buildDandelion` is pure arithmetic over typed arrays — about a second of
 * solid main thread on a phone (4× CPU), which was the largest single task of
 * the page's load. Run here, the page keeps hydrating and the preloader keeps
 * counting while the flower is grown; the arrays are **transferred** back, not
 * copied. A failure posts `{ error }` and the caller builds on its own thread.
 *
 * 📖 Docs: obsidian/frontend/dandelion-scene.md
 */

import {
  buildDandelion,
  dandelionTransferables,
  sphereOf,
  type DandelionGeometryOptions,
} from "./dandelion-geometry";

self.onmessage = (event: MessageEvent<DandelionGeometryOptions>) => {
  const scope = self as unknown as Worker;
  try {
    const geometry = buildDandelion(event.data);
    geometry.sphere = sphereOf(geometry.position);
    scope.postMessage({ geometry }, dandelionTransferables(geometry));
  } catch (error) {
    scope.postMessage({ error: String(error) });
  }
};
