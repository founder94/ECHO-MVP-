// GetLayers 「Solaris」 의 fBm 오로라 배경(네 모서리만 · 가운데는 비움)을 파랑·은빛으로 — 첫 화면 구체 뒤 깊이감. 원본 셰이더는 solaris-shaders.ts.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Clocks } from './clocks';
import { auroraFragmentShader, auroraVertexShader } from '../solaris/solaris-shaders';

// 원본은 밝기 0.9 고정 — uAmount 로 뺀다(검정 바탕 위에 더하기 섞기라 바탕 색은 안 칠한다).
const fragment = auroraFragmentShader
  .replace('uniform vec3 color2;', 'uniform vec3 color2;\n    uniform float uAmount;')
  .replace('finalColor *= cornerFade * 0.9;', 'finalColor *= cornerFade * uAmount;')
  .replace('gl_FragColor = vec4(baseBg + finalColor, 1.0);', 'gl_FragColor = vec4(finalColor, 1.0);');

interface Props { clocks: Clocks; colorA: string; colorB: string; amount: number }

export function Aurora({ clocks, colorA, colorB, amount }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const size = useThree((s) => s.size);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    color1: { value: new THREE.Color(colorA) },
    color2: { value: new THREE.Color(colorB) },
    uAmount: { value: amount },
  }), [colorA, colorB, amount]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms, vertexShader: auroraVertexShader, fragmentShader: fragment,
    depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, toneMapped: false,
  }), [uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime() * 0.12;
    uniforms.uResolution.value.set(size.width, size.height);
    uniforms.uAmount.value = amount * clocks.intro * (1 - clocks.out);
  });
  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={-1} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
