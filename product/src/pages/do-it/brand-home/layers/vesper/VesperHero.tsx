// GetLayers 「Vesper」 첫 화면 입자 구체 — 홈페이지(Vite+React) 이식판. 2026-10-08 대표 구매·결정(3D 허용 · 600KB 허용 · 모바일도 3D).
// 이 파일은 SceneHost 가 첫 그림이 뜬 뒤 늦게 불러온다(동적 import). page.tsx 는 three.js 를 모른다.
// 원본과 다른 점: Next.js·worker·Lenis·react-spring·은하/뇌 장면·bloom 없음 · 색은 파랑 · 캔버스는 첫 화면 섹션 안(고정 아님) · 스크롤하면 흩어짐 · 뒤에 Solaris 오로라 배경(네 모서리).
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { SceneProps } from '../registry';
import { Aurora } from '../shared/Aurora';
import { createClocks } from '../shared/clocks';
import { FrameGate } from '../shared/FrameGate';
import { bindSceneInputs } from '../shared/inputs';
import { getParams } from './adaptive';
import { Atmosphere } from './Atmosphere';
import { AURORA, INTRO_MS } from './constants';
import { Orb } from './Orb';

export default function VesperHero({ host, spin, onFail }: SceneProps) {
  const params = useMemo(() => getParams(window.innerWidth), []);
  const clocks = useMemo(() => createClocks(INTRO_MS), []);
  // 포인터·손가락·스크롤(흩어짐)·보임·탭 숨김 — 공통 입력(shared/inputs.ts)
  useEffect(() => bindSceneInputs(host, clocks, { scrollDissolve: true }), [host, clocks]);

  return (
    <Canvas
      className="bh-scene-canvas"
      frameloop="demand"
      dpr={params.dpr}
      camera={{ fov: 45, near: 0.1, far: 100, position: [0, 0, params.orbCameraZ] }}
      gl={{
        alpha: true,
        antialias: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onFail('context-lost'); }, { once: true });
      }}
    >
      <FrameGate clocks={clocks} targetFps={params.targetFps} />
      <Aurora clocks={clocks} colorA={AURORA.colorA} colorB={AURORA.colorB} amount={AURORA.amount} />
      <Orb params={params} clocks={clocks} spin={spin} />
      <Atmosphere params={params} clocks={clocks} />
    </Canvas>
  );
}
