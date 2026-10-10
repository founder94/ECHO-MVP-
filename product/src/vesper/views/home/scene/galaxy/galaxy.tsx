"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { hexToLinearVec3, setLinearVec3 } from "../color";

import { getSceneColors, subscribeSceneColors } from "@vesper/lib/scene/color-store";
import { GALAXY_CONFIG } from "@vesper/lib/scene/constants";
import { perFrame } from "@vesper/lib/scene/per-frame";
import {
  galaxyAppear,
  galaxyAssemble,
  galaxyBlow,
  sceneTimeline,
} from "@vesper/lib/scene/timeline";
import { getParams, sceneWidth } from "../adaptive";
import { galaxyFragmentShader, galaxyVertexShader } from "./galaxy-shaders";

/**
 * The second scene: a two-arm spiral galaxy.
 *
 * It assembles as the orb scatters, tips toward edge-on across the dive, then
 * blows apart as the orb returns. The camera dive itself lives in `main-scene`,
 * which owns the shared camera.
 */
export const Galaxy = () => {
  const groupRef = useRef<THREE.Group>(null);
  const { galaxyWidthSegments, galaxyHeightSegments, pointerReaction } = useMemo(
    () => getParams(sceneWidth()),
    [],
  );

  /**
   * A seed lattice, never drawn as a sphere — the vertex shader hashes each
   * position into an arm or bulge coordinate.
   *
   * `SphereGeometry` is indexed, and `THREE.Points` honours the index: every
   * vertex is referenced ~6× by the triangle list, so the sphere would draw
   * ~719k point sprites for only ~121k distinct stars, stacked exactly on top of
   * one another. Dropping the index draws each star once.
   *
   * Additive blending is linear, so N coincident sprites of alpha `a` sum to
   * exactly `N·a`. Scaling opacity by the duplicate factor reproduces the source
   * image while doing a sixth of the work.
   */
  const { geometry, opacity } = useMemo(() => {
    const sphere = new THREE.SphereGeometry(
      4.2,
      galaxyWidthSegments,
      galaxyHeightSegments,
    );
    const vertices = sphere.attributes.position.count;
    const duplicates = sphere.index ? sphere.index.count / vertices : 1;
    sphere.setIndex(null);
    return { geometry: sphere, opacity: GALAXY_CONFIG.opacity * duplicates };
  }, [galaxyWidthSegments, galaxyHeightSegments]);

  const cursor = useMemo(() => new THREE.Vector3(), []);
  const cursorTarget = useMemo(() => new THREE.Vector3(), []);
  const ndc = useMemo(() => new THREE.Vector3(), []);
  const rayDir = useMemo(() => new THREE.Vector3(), []);
  const activity = useRef(0);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAppear: { value: 0 },
      uFade: { value: 1 },
      uBlow: { value: 0 },
      uAssemble: { value: 1 },
      uColEdge: { value: hexToLinearVec3(GALAXY_CONFIG.colorEdge) },
      uColCore: { value: hexToLinearVec3(GALAXY_CONFIG.colorCore) },
      uOpacity: { value: opacity },
      uSize: { value: GALAXY_CONFIG.pointSize },
      uBrightness: { value: GALAXY_CONFIG.brightness as number },
      uArmSpin: { value: GALAXY_CONFIG.armSpin },
      uScale: { value: GALAXY_CONFIG.scale },
      uCursor: { value: new THREE.Vector3() },
      uRepelRadius: { value: GALAXY_CONFIG.pointerRadius },
      uRepelStrength: { value: GALAXY_CONFIG.pointerStrength },
      uActivity: { value: 0 },
    }),
    [opacity],
  );

  // Live colours from the authoring store — the disc's core, arms, and
  // brightness retune without a remount.
  useEffect(() => {
    const refresh = () => {
      const { galaxy } = getSceneColors();
      setLinearVec3(uniforms.uColEdge.value, galaxy.colorEdge);
      setLinearVec3(uniforms.uColCore.value, galaxy.colorCore);
      uniforms.uBrightness.value = galaxy.brightness;
    };
    refresh();
    return subscribeSceneColors(refresh);
  }, [uniforms]);

  // Constructed here, not via `<shaderMaterial uniforms={...} />` — r3f swaps the
  // uniforms object out, orphaning every per-frame write. See [[webgl-scene]].
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: galaxyVertexShader,
        fragmentShader: galaxyFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );

  useFrame(({ clock, camera, pointer }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const state = sceneTimeline.getState();
    const appear = galaxyAppear(state);
    const blow = galaxyBlow(state);
    const assemble = galaxyAssemble(state);

    uniforms.uTime.value = clock.getElapsedTime();
    uniforms.uAppear.value = appear;
    uniforms.uBlow.value = blow;
    uniforms.uFade.value = 1 - blow;
    uniforms.uAssemble.value = assemble;

    // Tip toward edge-on as the dive deepens.
    group.rotation.x = -(GALAXY_CONFIG.tilt + state.galaxyDive * GALAXY_CONFIG.diveTilt);
    group.rotation.z = pointerReaction ? pointer.x * 0.12 : 0;

    // Cursor void: project the pointer onto the z = 0 plane in world space.
    cursorTarget.set(0, 0, 0);
    if (pointerReaction) {
      ndc.set(pointer.x, pointer.y, 0.5).unproject(camera);
      rayDir.copy(ndc).sub(camera.position).normalize();
      if (Math.abs(rayDir.z) > 1e-4) {
        const t = -camera.position.z / rayDir.z;
        if (t > 0 && Number.isFinite(t)) {
          cursorTarget.copy(camera.position).addScaledVector(rayDir, t);
        }
      }
    }
    // 0.12 per 1/60 s, whatever the frame rate.
    cursor.lerp(cursorTarget, perFrame(0.12, delta));
    uniforms.uCursor.value.copy(cursor);

    const wanted = pointerReaction ? 1 : 0;
    activity.current += (wanted - activity.current) * Math.min(1, delta * 4);
    uniforms.uActivity.value = activity.current;

    // Stars are already streaming in while `appear` is still small, so gate on
    // assembly too — otherwise the inbound dust is invisible.
    const visible = (appear > 0.001 || assemble < 0.999) && blow < 0.999;
    if (group.visible !== visible) group.visible = visible;
  });

  return (
    <group ref={groupRef}>
      <points frustumCulled={false} geometry={geometry} material={material} />
    </group>
  );
};
