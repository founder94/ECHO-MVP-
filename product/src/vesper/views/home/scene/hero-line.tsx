"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { getIntro } from "@vesper/lib/scene/intro";
import { sceneTimeline } from "@vesper/lib/scene/timeline";

/**
 * The Figma hero's thin horizontal rule — drawn in WebGL so it sits **behind the
 * orb**. It is a clip-space quad rendered after the backdrop but before the
 * particle forms (renderOrder −0.5), so the additive orb draws over it. A DOM
 * line could not: the canvas clear + backdrop are opaque.
 *
 * Additive particles cannot *occlude* the line, so to read as genuinely behind
 * the sphere the line fades to nothing across the orb's screen footprint (a
 * centre mask) — leaving it visible only to the sides, exactly as in the design.
 *
 * Its Y tracks the bottom text cluster (Figma: 24px above the tagline), and it
 * fades up with the intro / out past section one.
 */
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }`;

const fragmentShader = /* glsl */ `
  uniform float uY;
  uniform float uThickness;
  uniform float uMaskRadius;
  uniform float uAlpha;
  varying vec2 vUv;
  void main(){
    float d = abs(vUv.y - uY);
    float line = 1.0 - smoothstep(0.0, uThickness, d);
    // Hide the line across the orb's central footprint so it reads as behind it.
    float side = smoothstep(uMaskRadius * 0.6, uMaskRadius, abs(vUv.x - 0.5));
    // Matches the Figma line: white at 0.2 opacity.
    gl_FragColor = vec4(vec3(1.0), line * side * 0.2 * uAlpha);
  }`;

/** Design values from the 1440×800 artboard. */
const DESIGN_WIDTH = 1440;
/** Line's distance from the artboard bottom (24px above the tagline at 560). */
const LINE_FROM_BOTTOM = 264;

export const HeroLine = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const size = useThree((state) => state.size);

  const uniforms = useMemo(
    () => ({
      uY: { value: 0.33 },
      uThickness: { value: 0.0015 },
      uMaskRadius: { value: 0.2 },
      uAlpha: { value: 0 },
    }),
    [],
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    [uniforms],
  );

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const intro = getIntro();
    const clock = sceneTimeline.getProgress();

    // Position in step with the vw-scaled DOM cluster: the line sits
    // `LINE_FROM_BOTTOM` design-px above the bottom, scaled by viewport width.
    const fromBottomPx = (LINE_FROM_BOTTOM * size.width) / DESIGN_WIDTH;
    uniforms.uY.value = Math.min(
      Math.max(fromBottomPx / Math.max(1, size.height), 0.02),
      0.95,
    );
    // Crisp ~1px line (matches the 1px section dividers); centre mask sized to
    // the orb's horizontal half-extent.
    uniforms.uThickness.value = 0.6 / Math.max(1, size.height);
    uniforms.uMaskRadius.value = (0.36 * size.height) / Math.max(1, size.width);

    const revealed = Math.min(Math.max((intro - 0.35) / 0.65, 0), 1);
    const gone = Math.min(Math.max((clock - 0.08) / 0.2, 0), 1);
    const alpha = revealed * (1 - gone);
    uniforms.uAlpha.value = alpha;

    const visible = alpha > 0.002;
    if (mesh.visible !== visible) mesh.visible = visible;
  });

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={-0.5} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};
