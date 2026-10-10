"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { hexToLinearVec3, setLinearVec3 } from "../color";

import { getSceneColors, subscribeSceneColors } from "@vesper/lib/scene/color-store";
import { ORB_CONFIG } from "@vesper/lib/scene/constants";
import { getIntro } from "@vesper/lib/scene/intro";
import { getOutro } from "@vesper/lib/scene/outro";
import {
  orbAlpha,
  orbApproach,
  orbCoreOpen,
  orbDissolve,
  sceneTimeline,
} from "@vesper/lib/scene/timeline";
import { getParams, sceneWidth } from "../adaptive";
import { createOilPointer } from "./oil-pointer";
import { orbFragmentShader, orbVertexShader } from "./orb-shaders";

/** Fibonacci sphere — an even point distribution, radius 1. */
const buildGeometry = (count: number, radius: number) => {
  const positions = new Float32Array(count * 3);
  const randoms = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    positions[i * 3] = Math.cos(th) * r * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = Math.sin(th) * r * radius;

    randoms[i * 3] = Math.random() - 0.5;
    randoms[i * 3 + 1] = Math.random() - 0.5;
    randoms[i * 3 + 2] = Math.random() - 0.5;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 3));
  return geometry;
};

/** The hero form: a noise-displaced point sphere that scatters on scroll. */
export const Orb = () => {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const gl = useThree((state) => state.gl);

  const { orbCount, orbPointSize, orbMoveY, pointerReaction } = useMemo(
    () => getParams(sceneWidth()),
    [],
  );

  const geometry = useMemo(
    () => buildGeometry(orbCount, ORB_CONFIG.radius),
    [orbCount],
  );

  const oil = useMemo(() => createOilPointer(ORB_CONFIG.radius), []);
  const centre = useMemo(() => new THREE.Vector3(), []);
  const camLocal = useMemo(() => new THREE.Vector3(), []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPR: { value: 1 },
      uSize: { value: orbPointSize },
      uDeform: { value: ORB_CONFIG.deform as number },
      uOut: { value: 0 },
      uAssemble: { value: 0 },
      uCore: { value: 0 },
      uCentre: { value: new THREE.Vector3() },
      uCamLocal: { value: new THREE.Vector3(0, 0, 1) },
      uColTop: { value: hexToLinearVec3(ORB_CONFIG.colorTop) },
      uColBottom: { value: hexToLinearVec3(ORB_CONFIG.colorBottom) },
      uColEdge: { value: hexToLinearVec3(ORB_CONFIG.colorEdge) },
      uBrightness: { value: ORB_CONFIG.brightness as number },
      uOpacity: { value: ORB_CONFIG.opacity },
      uAppear: { value: 0 },
      uCursor: { value: new THREE.Vector3(0, 0, ORB_CONFIG.radius) },
      uCursorVel: { value: new THREE.Vector3() },
      uEnergy: { value: 0 },
      uPointerRadius: { value: ORB_CONFIG.pointerRadius },
      uOilBulge: { value: ORB_CONFIG.oilBulge },
      uOilRipple: { value: ORB_CONFIG.oilRipple },
      uOilDrag: { value: ORB_CONFIG.oilDrag },
      uRippleFreq: { value: ORB_CONFIG.rippleFreq },
      uRippleSpeed: { value: ORB_CONFIG.rippleSpeed },
      uIri: { value: ORB_CONFIG.iridescence },
    }),
    [orbPointSize],
  );

  // Live colours from the authoring store — the form's gradient, edge, and
  // brightness retune without a remount.
  useEffect(() => {
    const refresh = () => {
      const { orb } = getSceneColors();
      setLinearVec3(uniforms.uColTop.value, orb.colorTop);
      setLinearVec3(uniforms.uColBottom.value, orb.colorBottom);
      setLinearVec3(uniforms.uColEdge.value, orb.colorEdge);
      uniforms.uBrightness.value = orb.brightness;
    };
    refresh();
    return subscribeSceneColors(refresh);
  }, [uniforms]);

  // Build the material here rather than via `<shaderMaterial uniforms={...} />`.
  // r3f does not keep the uniforms object passed as a prop — the material ends up
  // owning a different one, so every per-frame write below would land in a
  // detached object the GPU never reads. See obsidian/frontend/webgl-scene.md.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: orbVertexShader,
        fragmentShader: orbFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );

  useFrame(({ clock, camera, pointer }, delta) => {
    const group = groupRef.current;
    const points = pointsRef.current;
    if (!group || !points) return;

    const state = sceneTimeline.getState();
    const progress = sceneTimeline.getProgress();
    const t = clock.getElapsedTime();
    const intro = getIntro();

    // Hand the frame to the closing sections: whatever is left of the orb dims
    // out rather than sitting behind real content.
    const handoff = 1 - getOutro();

    uniforms.uTime.value = t;
    uniforms.uPR.value = gl.getPixelRatio();
    uniforms.uAppear.value = handoff;
    uniforms.uAssemble.value = intro;
    uniforms.uOut.value = orbDissolve(state);
    uniforms.uCore.value = orbCoreOpen(progress);

    // Slow auto-rotation with a gentle tilt wobble.
    points.rotation.y = t * ORB_CONFIG.spin;
    points.rotation.x = Math.sin(t * 0.1) * ORB_CONFIG.tilt;

    // "Enter the unknown": instead of sinking away, the orb rushes toward the
    // camera and its displacement noise swells, so it warps as it approaches.
    const approach = orbApproach(progress);
    group.position.z = orbMoveY * ORB_CONFIG.approach * approach;
    uniforms.uDeform.value = ORB_CONFIG.deform * (1 + approach * ORB_CONFIG.distortGain);

    // The camera in the points' own space. The bore and the spawn origin are
    // both object-space, and the points spin, so this has to be recomputed
    // after the rotation above — and it needs a fresh world matrix.
    points.updateMatrixWorld();
    camLocal.copy(camera.position);
    points.worldToLocal(camLocal);
    uniforms.uCamLocal.value.copy(camLocal);
    centre.set(0, group.position.y, 0);
    uniforms.uCentre.value.copy(centre);

    oil.step(camera, pointer, centre, pointerReaction, delta);
    uniforms.uCursor.value.copy(oil.cursor);
    uniforms.uCursorVel.value.copy(oil.velocity);
    uniforms.uEnergy.value = oil.energy;

    // Keep drawing until the dissolve has actually carried it away — gating on
    // `orbOut` alone cut it off while it was still visibly fading.
    const visible = intro > 0.001 && handoff > 0.002 && orbAlpha(state) > 0.002;
    if (group.visible !== visible) group.visible = visible;
  });

  return (
    <group ref={groupRef}>
      <points
        ref={pointsRef}
        frustumCulled={false}
        geometry={geometry}
        material={material}
      />
    </group>
  );
};
