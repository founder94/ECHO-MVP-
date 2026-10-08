// GetLayers 3D Scenes 「Solaris」 — 첫 화면 대안 장면(대표 비교용 · ?scene_hero=solaris). 촘촘한 구가 숨 쉬고 가장자리만 빛나는 고리, 손가락이 닿는 곳에서 입자가 불꽃처럼 터져 나온다.
// 원본과 다른 점: Next 없음 · bloom 없음 · 색은 파랑·은빛 · 캔버스는 첫 화면 섹션 안 · 스크롤하면 옅어짐 · 오로라 배경은 shared/Aurora.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SceneProps } from '../registry';
import { Aurora } from '../shared/Aurora';
import { createClocks, smootherstep, type Clocks } from '../shared/clocks';
import { FrameGate } from '../shared/FrameGate';
import { bindSceneInputs } from '../shared/inputs';
import { solarisFragmentShader, solarisVertexShader } from './solaris-shaders';

/** 색: 원본 주황·파랑 → 은빛(위)·파랑(아래). 보라·네온 0. */
export const SOLARIS = {
  colorTop: '#d6e6ff',
  colorBottom: '#2b63ff',
  auroraA: '#5a86ff',
  auroraB: '#8fa6c8',
  auroraAmount: 0.42,
  radius: 4.2,
  cameraDistance: 10.8,
  noiseSpeed: 1.41,
  introSeconds: 2.4,
  cursorRadius: 2.0,
  cursorFlare: 1.4,
  cursorHeat: 1.0,
} as const;

interface Tier { point: number; widthSeg: number; heightSeg: number; scale: number; offsetY: number; dpr: [number, number]; targetFps: number }
const TIERS: Tier[] = [
  { point: Infinity, widthSeg: 160, heightSeg: 480, scale: 1, offsetY: 0, dpr: [1, 2], targetFps: 60 },
  { point: 1440, widthSeg: 140, heightSeg: 420, scale: 1, offsetY: 0, dpr: [1, 1.75], targetFps: 60 },
  { point: 1024, widthSeg: 110, heightSeg: 330, scale: 0.8, offsetY: 1.4, dpr: [0.9, 1.25], targetFps: 45 },
  // 휴대폰: 구를 줄이고 위로(글 위) · 30fps
  { point: 640, widthSeg: 84, heightSeg: 252, scale: 0.62, offsetY: 2.6, dpr: [0.75, 1.1], targetFps: 30 },
];
const tierFor = (w: number) => { let t = TIERS[0]; for (const x of TIERS) if (w <= x.point) t = x; return t; };

const hexToVec3 = (hex: string) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };

function Sun({ clocks, tier, spin }: { clocks: Clocks; tier: Tier; spin: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const geometry = useMemo(() => new THREE.SphereGeometry(SOLARIS.radius, tier.widthSeg, tier.heightSeg), [tier]);
  const pick = useMemo(() => new THREE.Mesh(new THREE.SphereGeometry(SOLARIS.radius, 48, 48)), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const cursorTarget = useMemo(() => new THREE.Vector3(0, 0, SOLARIS.radius), []);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uIntro: { value: 0 },
    uFade: { value: 1 },
    uColorTop: { value: hexToVec3(SOLARIS.colorTop) },
    uColorBottom: { value: hexToVec3(SOLARIS.colorBottom) },
    uCursor: { value: new THREE.Vector3(0, 0, SOLARIS.radius) },
    uCursorStrength: { value: 0 },
    uCursorRadius: { value: SOLARIS.cursorRadius as number },
    uCursorFlare: { value: SOLARIS.cursorFlare as number },
    uCursorHeat: { value: SOLARIS.cursorHeat as number },
  }), []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms, vertexShader: solarisVertexShader, fragmentShader: solarisFragmentShader,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }), [uniforms]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); pick.geometry.dispose(); }, [geometry, material, pick]);
  const time = useRef(0);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    time.current += delta * 0.3 * SOLARIS.noiseSpeed;
    uniforms.uTime.value = time.current;
    uniforms.uIntro.value = clocks.intro;
    uniforms.uFade.value = 1 - smootherstep(clocks.out);
    group.position.y = tier.offsetY;
    group.scale.setScalar(tier.scale);
    group.rotation.y = spin ? time.current * 0.08 : 0;
    // 손가락·포인터를 구 표면에 쏘아 불꽃 자리를 정한다(원본 pickSphere). 구와 같은 변환을 준다.
    let over = false;
    if (clocks.pointerActive) {
      pick.position.copy(group.position); pick.scale.copy(group.scale); pick.rotation.copy(group.rotation); pick.updateMatrixWorld();
      raycaster.setFromCamera(clocks.pointer, camera);
      const hit = raycaster.intersectObject(pick, false)[0];
      if (hit) { group.worldToLocal(cursorTarget.copy(hit.point)); over = true; }
    }
    const s = uniforms.uCursorStrength;
    s.value += ((over ? 1 : 0) - s.value) * Math.min(1, delta * 5.4);
    uniforms.uCursor.value.lerp(cursorTarget, Math.min(1, delta * 10.8));
    const visible = clocks.intro > 0.001 && clocks.out < 0.998;
    if (group.visible !== visible) group.visible = visible;
  });

  return (
    <group ref={groupRef}>
      <points frustumCulled={false} geometry={geometry} material={material} />
    </group>
  );
}

export default function SolarisHero({ host, spin, onFail }: SceneProps) {
  const tier = useMemo(() => tierFor(window.innerWidth), []);
  const clocks = useMemo(() => createClocks(SOLARIS.introSeconds * 1000), []);
  useEffect(() => bindSceneInputs(host, clocks, { scrollDissolve: true }), [host, clocks]);
  return (
    <Canvas
      className="bh-scene-canvas"
      frameloop="demand"
      dpr={tier.dpr}
      camera={{ fov: 60, near: 0.1, far: 1000, position: [0, 0, SOLARIS.cameraDistance] }}
      gl={{ alpha: true, antialias: false, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onFail('context-lost'); }, { once: true });
      }}
    >
      <FrameGate clocks={clocks} targetFps={tier.targetFps} />
      <Aurora clocks={clocks} colorA={SOLARIS.auroraA} colorB={SOLARIS.auroraB} amount={SOLARIS.auroraAmount} />
      <Sun clocks={clocks} tier={tier} spin={spin} />
    </Canvas>
  );
}
