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
