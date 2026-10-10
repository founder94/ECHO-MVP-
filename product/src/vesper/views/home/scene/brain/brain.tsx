"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { hexToLinearVec3, setLinearVec3 } from "../color";

import { getSceneColors, subscribeSceneColors } from "@vesper/lib/scene/color-store";
import { BRAIN_CONFIG } from "@vesper/lib/scene/constants";
import { perFrame } from "@vesper/lib/scene/per-frame";
import { getOutro } from "@vesper/lib/scene/outro";
import { brainAppear, sceneTimeline } from "@vesper/lib/scene/timeline";
import { getParams, sceneWidth } from "../adaptive";
import { BrainMesh, buildBrainGeometry, loadBrainMesh } from "./brain-geometry";
import { brainFragmentShader, brainVertexShader } from "./brain-shaders";

/** The baked mesh (ADR-0028). 43 KB, in place of the 4.67 MB GLB. */
export const BRAIN_MESH_URL = "/vesper/assets/brain/brain-mesh.bin";

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * The third form: a point-cloud brain sampled from the baked mesh, in place of
 * the returning orb and its logo. It assembles across the clock's 2.6→3.4 span
 * ({@link brainAppear}) as the galaxy blows apart, driven by the same shared
 * camera the other forms use — which by then has travelled back to the orb's
 * close distance.
 *
 * Colours run through {@link hexToLinearVec3} (the renderer outputs sRGB, so
 * shader colours must be linear — the source scene's raw hex would wash out here).
 *
 * > The mesh is fetched, **never suspended on** (ADR-0028). It used to come from
 * > `useGLTF`, which suspends `MainScene` — so the orb, the galaxy and the hero
 * > all waited behind a 4.67 MB download for a form that does not appear until
 * > the third act. Now nothing blocks: the brain simply renders once its 43 KB
 * > mesh lands, several viewports of scroll before it is ever needed.
 */
export const Brain = () => {
  const groupRef = useRef<THREE.Group>(null);
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);

  const { brainCount, pointerReaction } = useMemo(
    () => getParams(sceneWidth()),
    [],
  );

  const [mesh, setMesh] = useState<BrainMesh | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    loadBrainMesh(BRAIN_MESH_URL, controller.signal)
      .then(setMesh)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // A missing brain must not take the rest of the scene down with it — the
        // orb and the galaxy are unaffected, so log and render nothing.
        console.error("[brain] mesh failed to load:", error);
      });
    return () => controller.abort();
  }, []);

  const geometry = useMemo(
    () => (mesh ? buildBrainGeometry(mesh, brainCount, BRAIN_CONFIG.radius) : null),
    [mesh, brainCount],
  );

  useEffect(() => () => geometry?.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      iAlpha: { value: 0 },
      iResolutionY: { value: size.height * gl.getPixelRatio() },
      uCool: { value: hexToLinearVec3(BRAIN_CONFIG.colorCool) },
      uWarm: { value: hexToLinearVec3(BRAIN_CONFIG.colorWarm) },
      uEdgeColor: { value: hexToLinearVec3(BRAIN_CONFIG.colorEdge) },
      uCenterColor: { value: hexToLinearVec3(BRAIN_CONFIG.colorCenter) },
      uSynapse: { value: hexToLinearVec3(BRAIN_CONFIG.colorSynapse) },
      uDeepColor: { value: hexToLinearVec3(BRAIN_CONFIG.colorDeep) },
      uCursorColor: { value: hexToLinearVec3(BRAIN_CONFIG.colorCursor) },
      uHighlightColor: { value: hexToLinearVec3("#2563eb") },
      uCenterRadius: { value: BRAIN_CONFIG.centerRadius },
      uCenterFalloff: { value: BRAIN_CONFIG.centerFalloff as number },
      uSize: { value: BRAIN_CONFIG.size as number },
      uSynapseRate: { value: BRAIN_CONFIG.synapseRate },
      uFlowSpeed: { value: BRAIN_CONFIG.flowSpeed },
      uFlowAmount: { value: BRAIN_CONFIG.flowAmount },
      uGlow: { value: BRAIN_CONFIG.glow as number },
      uDepthDarkness: { value: BRAIN_CONFIG.depthDarkness as number },
      uOcclusionStrength: { value: 0 },
      uHighlightPos: { value: new THREE.Vector3(0, 0, 0) },
      uHighlightRadius: { value: 0.6 },
      uHighlightStrength: { value: 0 },
      uFocusFadeStrength: { value: 0.55 },
      uIsolateStrength: { value: 0.88 },
      uExplode: { value: 1 },
      uExplodeDist: { value: 5 },
      uMouse: { value: new THREE.Vector2(-10, -10) },
      uCursor: { value: 0 },
      uAspect: { value: 1 },
      uCursorRadius: { value: 0.1 },
    }),
    // Built once; size/dpr are refreshed per frame below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Constructed here, not via `<shaderMaterial uniforms={...} />` — r3f swaps the
  // uniforms object out, orphaning every per-frame write. See [[webgl-scene]].
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: brainVertexShader,
        fragmentShader: brainFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [uniforms],
  );

  // Live colours from the authoring panel — tint, edge, synapse, cursor, glow.
  useEffect(() => {
    const refresh = () => {
      const { brain } = getSceneColors();
      setLinearVec3(uniforms.uCool.value, brain.colorCool);
      setLinearVec3(uniforms.uWarm.value, brain.colorWarm);
      setLinearVec3(uniforms.uEdgeColor.value, brain.colorEdge);
      setLinearVec3(uniforms.uCenterColor.value, brain.colorCenter);
      setLinearVec3(uniforms.uSynapse.value, brain.colorSynapse);
      setLinearVec3(uniforms.uCursorColor.value, brain.colorCursor);
      uniforms.uGlow.value = brain.glow;
    };
    refresh();
    return subscribeSceneColors(refresh);
  }, [uniforms]);

  const parallax = useRef({ ry: 0, rx: 0 });

  useFrame(({ clock, camera, pointer }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const progress = sceneTimeline.getProgress();
    const appear = brainAppear(progress);
    // Exit sequence: the closing section's arrival advances the outro clock. Across it the
    // brain rushes toward the camera and bursts apart, so the section slides in
    // exactly as the brain scatters.
    const outro = getOutro();
    // Soft, gradual burst: a small dead-zone holds the assembled brain through the
    // first sliver of scroll, then it eases out (smoothstep, so no sharp onset).
    const exit = smoothstep(0.12, 1, outro);

    uniforms.iTime.value = clock.getElapsedTime();
    // Hold full brightness through the approach; fade only once the section has
    // begun to cover the scene.
    uniforms.iAlpha.value = appear * (1 - smoothstep(0.55, 1, outro));
    // Explode drives both the intro assembly (1→0 as it gathers) and the exit
    // burst (0→1 as it scatters).
    uniforms.uExplode.value = Math.max(1 - appear, exit);
    // Rush toward the camera on the way out.
    group.position.z = exit * BRAIN_CONFIG.approach;
    uniforms.iResolutionY.value = size.height * gl.getPixelRatio();
    uniforms.uAspect.value = size.width / Math.max(1, size.height);
    uniforms.uCursorRadius.value = clamp(
      (0.1 * 4.6) / camera.position.length(),
      0.04,
      0.13,
    );

    // Cursor halo + neuron lighting: ease the shader mouse toward the pointer.
    // Each ease is the fraction closed per 1/60 s, scaled by the frame's delta —
    // the same feel at the 30 fps phone gate and on a 120 Hz display.
    if (pointerReaction) {
      const mouse = perFrame(0.18, delta);
      uniforms.uMouse.value.x += (pointer.x - uniforms.uMouse.value.x) * mouse;
      uniforms.uMouse.value.y += (pointer.y - uniforms.uMouse.value.y) * mouse;
    }
    const cursorTarget = pointerReaction ? 1 : 0;
    uniforms.uCursor.value +=
      (cursorTarget - uniforms.uCursor.value) * perFrame(0.1, delta);

    // The spin overlaps the assembly (it starts turning while it is still
    // gathering) and runs right up to the burst, so the motion reads as one
    // continuous move — no pause between assembling and spinning. Plus a damped
    // swivel toward the cursor.
    const spin =
      clamp((progress - 2.7) / 1.3, 0, 1) * BRAIN_CONFIG.scrollSpin;
    const cursor = uniforms.uCursor.value;
    const targetRy = clamp(pointer.x, -1, 1) * BRAIN_CONFIG.cursorTilt * cursor;
    const targetRx =
      -clamp(pointer.y, -1, 1) * BRAIN_CONFIG.cursorTilt * 0.65 * cursor;
    const swivel = perFrame(0.05, delta);
    parallax.current.ry += (targetRy - parallax.current.ry) * swivel;
    parallax.current.rx += (targetRx - parallax.current.rx) * swivel;

    group.rotation.y = BRAIN_CONFIG.baseRotationY + spin + parallax.current.ry;
    group.rotation.x = parallax.current.rx;

    // Skip drawing the ~130k points entirely outside the third act — but keep
    // drawing through the exit burst until the section has covered the scene.
    const visible = appear > 0.001 && outro < 0.998;
    if (group.visible !== visible) group.visible = visible;
  });

  if (!geometry) return null;

  return (
    <group ref={groupRef} visible={false}>
      <points frustumCulled={false} geometry={geometry} material={material} />
    </group>
  );
};
