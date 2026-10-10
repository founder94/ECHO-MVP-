// 2026-10-10 Codex #158 P1: Flora 원본 src/lib/scene/dandelion/dandelion-geometry-off-thread.ts 를 그대로 옮김(입자 42만 개를 화면 스레드 밖에서 만든다).
/**
 * Grows the dandelion's buffers in a module worker.
 *
 * Kept apart from `dandelion-geometry.ts` on purpose: the worker imports that
 * module, and a module that both builds the geometry and spawns the worker
 * that imports it is a cycle the bundler has to resolve into its own entry.
 *
 * 📖 Docs: obsidian/frontend/dandelion-scene.md
 */

import {
  buildDandelion,
  type DandelionGeometry,
  type DandelionGeometryOptions,
} from "./dandelion-geometry";

/**
 * `buildDandelion` in a module worker (`dandelion-geometry.worker.ts`), so the
 * second of arithmetic it costs a phone never blocks the page's thread. The
 * output is the same function's, bit for bit — only the thread differs. Where a
 * worker cannot start, or fails, it builds here instead.
 */
export const buildDandelionOffThread = (
  options: DandelionGeometryOptions,
): Promise<DandelionGeometry> => {
  if (typeof Worker === "undefined") {
    return Promise.resolve(buildDandelion(options));
  }
  return new Promise<DandelionGeometry>((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("./dandelion-geometry.worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch {
      resolve(buildDandelion(options));
      return;
    }
    const fallBack = (): void => {
      worker.terminate();
      resolve(buildDandelion(options));
    };
    worker.onmessage = (
      event: MessageEvent<{ geometry?: DandelionGeometry; error?: string }>,
    ) => {
      if (!event.data.geometry) {
        fallBack();
        return;
      }
      worker.terminate();
      resolve(event.data.geometry);
    };
    worker.onerror = fallBack;
    worker.postMessage(options);
  });
};
