/**
 * Code-splits the gradient, for the same reason the scene is split: it is
 * browser-only WebGL (optimize-3d-scene §1).
 * 연결 시안: Next `dynamic(…, { ssr: false })` → React.lazy + Suspense(이 앱은 브라우저에서만 그린다).
 */

import { lazy, Suspense } from "react";

import type { BackdropCanvasProps } from "@flora/components/common/scene/backdrop-canvas";

const BackdropCanvas = lazy(() =>
  import("@flora/components/common/scene/backdrop-canvas").then((mod) => ({ default: mod.BackdropCanvas })),
);

export const LazyBackdropCanvas = (props: BackdropCanvasProps) => (
  <Suspense fallback={null}>
    <BackdropCanvas {...props} />
  </Suspense>
);
