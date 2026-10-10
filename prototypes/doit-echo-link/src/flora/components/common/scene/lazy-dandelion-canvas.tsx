/**
 * Code-splits the scene: `three` lands in its own chunk that only loads in the
 * browser (optimize-3d-scene §1).
 * 연결 시안: Next `dynamic(…, { ssr: false })` → React.lazy + Suspense.
 */

import { lazy, Suspense } from "react";

import type { DandelionCanvasProps } from "@flora/components/common/scene/dandelion-canvas";
import { markBooted } from "@flora/lib/loading/boot-progress";

const DandelionCanvas = lazy(() =>
  import("@flora/components/common/scene/dandelion-canvas").then((mod) => {
    // `three` is down and evaluated. The preloader counts this apart from
    // the scene itself, which is the compile that comes after it.
    markBooted("chunk");
    return { default: mod.DandelionCanvas };
  }),
);

export const LazyDandelionCanvas = (props: DandelionCanvasProps) => (
  <Suspense fallback={null}>
    <DandelionCanvas {...props} />
  </Suspense>
);
