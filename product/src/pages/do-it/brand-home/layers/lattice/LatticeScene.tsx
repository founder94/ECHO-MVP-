// GetLayers 3D Scenes 「Einstein–Rosen Lattice」 — 제작 과정 화면 배경. 두 세계를 잇는 다리(웜홀)를 은빛 격자로 그린다 = 「뜻밖의 연결」.
// 픽셀마다 광선 추적(ray-march)하는 셰이더라 비용은 해상도에 비례 → dpr 상한을 낮추고 휴대폰은 걸음 수(STEPS)를 줄인다.
// 원본과 다른 점: bloom·glow 없음 · 색은 은빛·파랑(금빛 목 → 얼음빛) · 투명 캔버스(별 배경 위) · 누르면 맥동(click zoom 은 없음).
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SceneProps } from '../registry';
import { createClocks, type Clocks } from '../shared/clocks';
import { FrameGate } from '../shared/FrameGate';
import { bindSceneInputs } from '../shared/inputs';
import { bridgeFragmentShader, quadVertexShader } from './lattice-shaders';

export const LATTICE = {
  lineColor: '#eef3ff',
  throatTint: '#dfe9ff',
  rimTint: '#5878ff',
  throatRadius: 1.0,
  flareHeight: 1.7,
  cameraDistance: 14.5,
  cameraFov: 60,
  meridians: 60,
  ringSpacing: 1.0,
  lineWidth: 0.9,
  lineGain: 0.44,
  hazeMax: 0.263,
  throatBoost: 0.38,
  tintAmount: 0.3,
  tintFalloff: 3.0,
  fadeStart: 160,
  fadeEnd: 20000,
  vignette: 0.18,
  vignettePower: 1.6,
  horizonFloor: 1.0,
  seamGap: 1.5,
  spinSpeed: 0.022,
  driftSpeed: 0.12,
  breathAmp: 0.02,
  breathSpeed: 0.3,
  pulseAmp: 0.32,
  pulseDecay: 1.15,
  fadeInSeconds: 1.25,
  parallaxAz: 0.11,
  parallaxEase: 0.055,
} as const;

interface Tier { point: number; steps: number; bisect: number; dpr: [number, number]; targetFps: number }
const TIERS: Tier[] = [
  { point: Infinity, steps: 72, bisect: 18, dpr: [1, 1.25], targetFps: 45 },
  { point: 1024, steps: 56, bisect: 14, dpr: [0.8, 1], targetFps: 30 },
  { point: 640, steps: 40, bisect: 12, dpr: [0.6, 0.85], targetFps: 30 },
];
const tierFor = (w: number) => { let t = TIERS[0]; for (const x of TIERS) if (w <= x.point) t = x; return t; };
const hexToVec3 = (hex: string) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };

interface Live { pulse: number; spin: number; phase: number; px: number }

function Bridge({ clocks, tier, live }: { clocks: Clocks; tier: Tier; live: Live }) {
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const uniforms = useMemo(() => ({
    iResolution: { value: new THREE.Vector3(1, 1, 1) },
    iTime: { value: 0 }, iAlpha: { value: 0 }, uAspect: { value: 1 },
    iAz: { value: 0 }, iEl: { value: 0 }, iSpin: { value: 0 }, iPhase: { value: 0 }, iPulse: { value: 0 }, iBreath: { value: 1 },
    uA: { value: LATTICE.throatRadius as number }, uB: { value: LATTICE.flareHeight as number }, uCamDist: { value: LATTICE.cameraDistance as number },
    uTanFov: { value: Math.tan((LATTICE.cameraFov * Math.PI) / 360) },
    uMeridians: { value: LATTICE.meridians as number }, uRingSpacing: { value: LATTICE.ringSpacing as number },
    uLineWidth: { value: LATTICE.lineWidth as number }, uLineGain: { value: LATTICE.lineGain as number }, uHazeMax: { value: LATTICE.hazeMax as number }, uThroatBoost: { value: LATTICE.throatBoost as number },
    uTintAmount: { value: LATTICE.tintAmount as number }, uTintFalloff: { value: LATTICE.tintFalloff as number },
    uFadeStart: { value: LATTICE.fadeStart as number }, uFadeEnd: { value: LATTICE.fadeEnd as number }, uVignette: { value: LATTICE.vignette as number }, uVignettePower: { value: LATTICE.vignettePower as number }, uHorizonFloor: { value: LATTICE.horizonFloor as number },
    uPulseAmp: { value: LATTICE.pulseAmp as number }, uSeamGap: { value: LATTICE.seamGap as number },
    uLineColor: { value: hexToVec3(LATTICE.lineColor) }, uThroatTint: { value: hexToVec3(LATTICE.throatTint) }, uRimTint: { value: hexToVec3(LATTICE.rimTint) },
  }), []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms, vertexShader: quadVertexShader, fragmentShader: bridgeFragmentShader,
    defines: { STEPS: tier.steps, BISECT: tier.bisect },
    depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
  }), [uniforms, tier]);
  useEffect(() => () => material.dispose(), [material]);
  const last = useRef(-1);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    const dt = last.current < 0 ? 0 : Math.min(Math.max(now - last.current, 0), 0.05);
    last.current = now;
    const dpr = gl.getPixelRatio();
    uniforms.iResolution.value.set(size.width * dpr, size.height * dpr, 1);
    uniforms.uAspect.value = size.width / Math.max(1, size.height);
    uniforms.iTime.value = now;
    uniforms.iAlpha.value = clocks.intro;
    live.spin = (live.spin + dt * LATTICE.spinSpeed) % (Math.PI * 2);
    const ringPeriod = (2 * Math.PI * LATTICE.flareHeight) / Math.max(LATTICE.meridians, 1) * LATTICE.ringSpacing;
    live.phase = (live.phase + dt * LATTICE.driftSpeed) % ringPeriod;
    live.pulse *= Math.exp(-dt * LATTICE.pulseDecay);
    uniforms.iSpin.value = live.spin;
    uniforms.iPhase.value = live.phase;
    uniforms.iPulse.value = live.pulse;
    uniforms.iBreath.value = 1 + LATTICE.breathAmp * Math.sin(now * LATTICE.breathSpeed);
    // 포인터 시차(원본 parallaxAz) — 화면 비율 보정한 NDC x
    const aspect = size.width / Math.max(1, size.height);
    const tx = clocks.pointerActive ? Math.max(-2, Math.min(2, clocks.pointer.x * (aspect >= 1 ? aspect : 1))) : 0;
    const e = 1 - Math.pow(1 - LATTICE.parallaxEase, dt * 60);
    live.px += (tx - live.px) * e;
    uniforms.iAz.value = live.px * LATTICE.parallaxAz;
  });

  return (
    <mesh frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

export default function LatticeScene({ host, onFail }: SceneProps) {
  const tier = useMemo(() => tierFor(window.innerWidth), []);
  const clocks = useMemo(() => createClocks(LATTICE.fadeInSeconds * 1000), []);
  const live = useMemo<Live>(() => ({ pulse: 0, spin: 0, phase: 0, px: 0 }), []);
  useEffect(() => bindSceneInputs(host, clocks, { scrollDissolve: false, onPress: () => { live.pulse = 1; } }), [host, clocks, live]);
  return (
    <Canvas
      className="bh-scene-canvas"
      frameloop="demand"
      dpr={tier.dpr}
      camera={{ fov: 60, near: 0.1, far: 100, position: [0, 0, 5] }}
      gl={{ alpha: true, antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onFail('context-lost'); }, { once: true });
      }}
    >
      <FrameGate clocks={clocks} targetFps={tier.targetFps} />
      <Bridge clocks={clocks} tier={tier} live={live} />
    </Canvas>
  );
}
