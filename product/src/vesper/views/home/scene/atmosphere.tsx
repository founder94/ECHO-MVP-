"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { hexToLinearVec3, setLinearVec3 } from "./color";

import { getSceneColors, subscribeSceneColors } from "@vesper/lib/scene/color-store";
import { GALAXY, ORB } from "@vesper/lib/scene/constants";
import { galaxyPresence, sceneTimeline } from "@vesper/lib/scene/timeline";
import { getParams, sceneWidth } from "./adaptive";

const vertexShader = /* glsl */ `
  attribute float size;
  uniform float uTime;
  uniform vec2  uRes;
  uniform float uSpread;
  uniform float uFadeNear;
  uniform float uFadeFar;
  varying float vA;

  vec3 warp(vec3 p, float t){
    float c = 0.9, a = 1.9, b = 0.02, s = 0.05;
    p *= 2.0;
    p.x += c*sin(s*t + a*p.y) + t*b; p.y += c*cos(s*t + a*p.x);
    p.y += c*sin(s*t + a*p.z) + t*b; p.z += c*cos(s*t + a*p.y);
    p.z += c*sin(s*t + a*p.x) + t*b; p.x += c*cos(s*t + a*p.z);
    return cos(p + vec3(1, 2, 4));
  }

  void main(){
    vec3 v = position * uSpread + warp(position, uTime) * (uSpread * 0.28);
    vec4 mv = modelViewMatrix * vec4(v, 1.0);
    float r = length(v);
    float farF = 1.0 - smoothstep(uFadeNear, uFadeFar, r);
    float nearF = smoothstep(0.0, 0.3, -mv.z);
    vA = farF * nearF;
    gl_PointSize = size * uRes.y / 900.0 / -mv.z;
    gl_PointSize = max(gl_PointSize, 1.0);
    gl_Position = projectionMatrix * mv;
  }`;

const fragmentShader = /* glsl */ `
  uniform vec3  uColor;
  uniform float uAlpha;
  varying float vA;
  void main(){
    vec2 p = gl_PointCoord - 0.5;
    float l = length(p);
    if (l > 0.5) discard;
    float tex = smoothstep(0.5, 0.0, l);
    gl_FragColor = vec4(uColor * tex, tex * vA * uAlpha);
  }`;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Camera-attached drifting motes — the ambient dust both source scenes share.
 *
 * Replaces the old `Stars` component, which recycled stars against a static
 * `camera.position.z`. The camera now travels from ~4 to ~48 world units across
 * the dive, which that recycling could not survive. These motes follow the
 * camera instead, so they work at any depth.
 *
 * Spread, fade radius, colour, and opacity all crossfade between the orb's and
 * the galaxy's tuning as the scenes hand off.
 */
export const Atmosphere = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);

  const { atmoCount, atmoSize } = useMemo(
    () => getParams(sceneWidth()),
    [],
  );

  const orbColor = useMemo(() => hexToLinearVec3(ORB.atmo), []);
  const galaxyColor = useMemo(() => hexToLinearVec3(GALAXY.atmo), []);

  // Track the live mote colours from the authoring store.
  useEffect(() => {
    const refresh = () => {
      const { orb, galaxy } = getSceneColors();
      setLinearVec3(orbColor, orb.atmo);
      setLinearVec3(galaxyColor, galaxy.atmo);
    };
    refresh();
    return subscribeSceneColors(refresh);
  }, [orbColor, galaxyColor]);

  const geometry = useMemo(() => {
    const positions = new Float32Array(atmoCount * 3);
    const sizes = new Float32Array(atmoCount);
    for (let i = 0; i < atmoCount; i++) {
      positions[i * 3] = 2 * Math.random() - 1;
      positions[i * 3 + 1] = 2 * Math.random() - 1;
      positions[i * 3 + 2] = 2 * Math.random() - 1;
      sizes[i] = atmoSize * (0.4 + Math.random());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    return g;
  }, [atmoCount, atmoSize]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: orbColor.clone() },
      uAlpha: { value: ORB.atmoAlpha },
      uSpread: { value: ORB.atmoSpread },
      uFadeNear: { value: ORB.atmoFadeNear },
      uFadeFar: { value: ORB.atmoFadeFar },
      uRes: { value: new THREE.Vector2(1, 1) },
    }),
    [orbColor],
  );

  // Constructed here, not via `<shaderMaterial uniforms={...} />` — r3f swaps the
  // uniforms object out, orphaning every per-frame write. See [[webgl-scene]].
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );

  useFrame(({ clock, camera }) => {
    const points = pointsRef.current;
    if (!points) return;

    const presence = galaxyPresence(sceneTimeline.getState());
    const dpr = gl.getPixelRatio();

    uniforms.uTime.value = clock.getElapsedTime() * 8;
    uniforms.uRes.value.set(size.width * dpr, size.height * dpr);
    uniforms.uColor.value.lerpVectors(orbColor, galaxyColor, presence);
    uniforms.uAlpha.value = lerp(ORB.atmoAlpha, GALAXY.atmoAlpha, presence);
    uniforms.uSpread.value = lerp(ORB.atmoSpread, GALAXY.atmoSpread, presence);
    uniforms.uFadeNear.value = lerp(ORB.atmoFadeNear, GALAXY.atmoFadeNear, presence);
    uniforms.uFadeFar.value = lerp(ORB.atmoFadeFar, GALAXY.atmoFadeFar, presence);

    points.position.copy(camera.position);
  });

  return (
    <points
      ref={pointsRef}
      frustumCulled={false}
      geometry={geometry}
      material={material}
    />
  );
};
