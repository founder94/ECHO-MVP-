"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import { SCENE_BACKGROUND } from "@vesper/lib/scene/constants";
import { getParams } from "./adaptive";
import { FrameGate } from "./frame-gate";
import { MainScene } from "./main-scene";

/**
 * The full-viewport WebGL layer. It fills `SceneViewport` (`scene-host.tsx`),
 * which holds the large viewport's height on touch devices.
 *
 * Mounted only on the client: the scene reads `window.innerWidth` while building
 * its geometry, so there is nothing meaningful to prerender. The canvas ignores
 * pointer events — `eventSource` points at `document.body` so the raycaster still
 * sees the pointer through the HUD above it.
 *
 * `frameloop="demand"` hands the render loop to {@link FrameGate}, which drives it
 * at a per-tier frame rate and stops entirely once the scene is behind content.
 */
export const SceneCanvas = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const params = useMemo(
    () => (mounted ? getParams(window.innerWidth) : null),
    [mounted],
  );

  if (!mounted || !params) return null;

  return (
    <Canvas
      className="pointer-events-none !absolute inset-0"
      eventSource={document.body}
      eventPrefix="client"
      frameloop="demand"
      // Point sprites are fill-rate bound, so cost scales with dpr². Uncapped, a
      // 3× Retina phone renders ~9× the fragments and starves the frame loop —
      // which stalls react-spring (it is rAF-driven) and freezes the loader.
      dpr={params.dpr}
      gl={{
        powerPreference: "high-performance",
        alpha: true,
        // MSAA does nothing for additive point sprites — they are already soft.
        antialias: false,
        toneMappingExposure: 1,
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
    >
      <color attach="background" args={[SCENE_BACKGROUND]} />
      <FrameGate targetFps={params.targetFps} />
      <Suspense fallback={null}>
        <MainScene />
      </Suspense>
      {/* No `<Preload all />`: it compiled every form in one task at load.
          Each later form compiles itself as it mounts (`deferred-mount`). */}
    </Canvas>
  );
};
