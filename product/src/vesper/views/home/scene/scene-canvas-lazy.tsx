"use client";

import dynamic from "next/dynamic";

/**
 * The r3f scene in its own chunk, so the robot form — which renders a still
 * instead — never downloads three.js (dringle: robot mobile 54 → 100). People
 * lose nothing: the loader covers the first frames anyway.
 */
export const SceneCanvasLazy = dynamic(
  () => import("./scene-canvas").then((m) => m.SceneCanvas),
  { ssr: false },
);
