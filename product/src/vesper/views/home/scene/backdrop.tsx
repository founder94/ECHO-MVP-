"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { hexToLinearVec3, setLinearVec3 } from "./color";

import { getSceneColors, subscribeSceneColors } from "@vesper/lib/scene/color-store";
import { galaxyPresence, sceneTimeline } from "@vesper/lib/scene/timeline";
import { warp3d } from "./shaders/snoise";

/**
 * Positions are already in clip space — this quad ignores the camera entirely
 * and always covers the viewport.
 */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }`;

const fragmentShader = /* glsl */ `
  uniform float iTime;
  uniform vec3  uBg;
  uniform vec3  uFlameA;
  uniform vec3  uFlameB;
  uniform float uFlameAmt;
  varying vec2 vUv;

  ${warp3d}

  void main(){
    vec2 uv = 2.0 * vUv - 1.0;
    vec3 w = pow(warp3d(vec3(uv.x, sin(uv.y), uv.y), iTime * 1.5), vec3(1.5));
    vec3 flame = 1.5 * uFlameA * w.x;
    flame *= w.y;
    flame += uFlameB * w.z;
    flame *= smoothstep(0.25, 1.0, abs(uv.y));
    float md = smoothstep(-0.7, 1.0, -uv.y * uv.x);
    flame *= md * md;
    vec3 bg = uBg * (1.0 - 0.4 * length(uv));
    gl_FragColor = vec4(bg + flame * uFlameAmt, 1.0);
  }`;

/**
 * Mutable linear-RGB endpoints for one palette, refreshed from the live store.
 * Held in refs so the render loop lerps between them without reallocating, and
 * `flameAmt` rides along.
 */
interface PaletteVectors {
  bg: THREE.Vector3;
  flameA: THREE.Vector3;
  flameB: THREE.Vector3;
  flameAmt: number;
}

const makeVectors = (): PaletteVectors => ({
  bg: new THREE.Vector3(),
  flameA: new THREE.Vector3(),
  flameB: new THREE.Vector3(),
  flameAmt: 0,
});

/**
 * The full-screen background: a dark radial wash plus the drifting "flame"
 * domain-warp from the source scenes' composite pass.
 *
 * The source ran this as a post pass *after* bloom. Here it is a clip-space
 * quad drawn first, under the additive particles — visually equivalent, and it
 * avoids threading a second composer through `@react-three/postprocessing`.
 * It also gives the palette crossfade somewhere to live: the whole background
 * shifts from the orb's magenta to the galaxy's violet as the scenes hand off.
 */
export const Backdrop = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const orb = useMemo(() => makeVectors(), []);
  const galaxy = useMemo(() => makeVectors(), []);

  // Pull the current palette into the endpoint vectors, and again whenever the
  // authoring store changes.
  useEffect(() => {
    const refresh = () => {
      const { orb: o, galaxy: g } = getSceneColors();
      setLinearVec3(orb.bg, o.bg);
      setLinearVec3(orb.flameA, o.flameA);
      setLinearVec3(orb.flameB, o.flameB);
      orb.flameAmt = o.flameAmt;
      setLinearVec3(galaxy.bg, g.bg);
      setLinearVec3(galaxy.flameA, g.flameA);
      setLinearVec3(galaxy.flameB, g.flameB);
      galaxy.flameAmt = g.flameAmt;
    };
    refresh();
    return subscribeSceneColors(refresh);
  }, [orb, galaxy]);

  const uniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      uBg: { value: hexToLinearVec3(getSceneColors().orb.bg) },
      uFlameA: { value: hexToLinearVec3(getSceneColors().orb.flameA) },
      uFlameB: { value: hexToLinearVec3(getSceneColors().orb.flameB) },
      uFlameAmt: { value: getSceneColors().orb.flameAmt },
    }),
    [],
  );

  // Constructed here, not via `<shaderMaterial uniforms={...} />` — r3f swaps the
  // uniforms object out, orphaning every per-frame write. See [[webgl-scene]].
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [uniforms],
  );

  useFrame(({ clock }) => {
    const presence = galaxyPresence(sceneTimeline.getState());
    uniforms.iTime.value = clock.getElapsedTime();
    uniforms.uBg.value.lerpVectors(orb.bg, galaxy.bg, presence);
    uniforms.uFlameA.value.lerpVectors(orb.flameA, galaxy.flameA, presence);
    uniforms.uFlameB.value.lerpVectors(orb.flameB, galaxy.flameB, presence);
    uniforms.uFlameAmt.value =
      orb.flameAmt + (galaxy.flameAmt - orb.flameAmt) * presence;
  });

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={-1} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};
