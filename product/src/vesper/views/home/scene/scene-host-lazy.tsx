"use client";

import dynamic from "next/dynamic";

/**
 * The scene host in its own client-only chunk, like the canvas before it: the
 * robot form never loads it, and the page's hydration doesn't wait on it.
 */
export const SceneHostLazy = dynamic(
  () => import("./scene-host").then((m) => m.SceneHost),
  { ssr: false },
);
