// Vesper 의 첫 화면 형태: 피보나치 구 위 점들이 노이즈로 숨 쉬고, 손가락·포인터에 기름막처럼 반응하고, 스크롤하면 액체처럼 흩어진다.
// 원본 src/views/home/scene/orb/orb.tsx 에서 타임라인·색 저장소·은하 전환을 떼어 내고 clocks(등장·흩어짐·포인터)만 쓴다.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Adaptive } from './adaptive';
import { smootherstep, type Clocks } from '../shared/clocks';
import { hexToLinearVec3 } from '../shared/color';
import { ORB_CONFIG } from './constants';
import { createOilPointer } from './oil-pointer';
import { orbFragmentShader, orbVertexShader } from './orb-shaders';

/** 피보나치 구 — 고른 점 분포, 반지름 1. */
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
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));
  return geometry;
};

interface Props { params: Adaptive; clocks: Clocks; spin: boolean }

export function Orb({ params, clocks, spin }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const gl = useThree((s) => s.gl);

  const geometry = useMemo(() => buildGeometry(params.orbCount, ORB_CONFIG.radius), [params.orbCount]);
  const oil = useMemo(() => createOilPointer(ORB_CONFIG.radius), []);
  const centre = useMemo(() => new THREE.Vector3(), []);
  const camLocal = useMemo(() => new THREE.Vector3(), []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPR: { value: 1 },
    uSize: { value: params.orbPointSize },
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
    uAppear: { value: 1 },
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
  }), [params.orbPointSize]);

  // r3f 의 <shaderMaterial uniforms> 는 객체를 바꿔치기해 매 프레임 쓰기가 사라진다(원본 주석) → 직접 만든다.
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms, vertexShader: orbVertexShader, fragmentShader: orbFragmentShader,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  }), [uniforms]);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame(({ clock, camera }, delta) => {
    const group = groupRef.current;
    const points = pointsRef.current;
    if (!group || !points) return;
    const t = clock.getElapsedTime();
    const out = smootherstep(clocks.out);

    uniforms.uTime.value = t;
    uniforms.uPR.value = gl.getPixelRatio();
    uniforms.uAssemble.value = clocks.intro;
    uniforms.uOut.value = out;

    // 자전(대표 결정 대기 · spin=false 면 0) + 가벼운 기울기 흔들림.
    points.rotation.y = spin ? t * ORB_CONFIG.spin : 0;
    points.rotation.x = Math.sin(t * 0.1) * ORB_CONFIG.tilt;
    group.position.y = params.orbOffsetY;

    points.updateMatrixWorld();
    camLocal.copy(camera.position);
    points.worldToLocal(camLocal);
    uniforms.uCamLocal.value.copy(camLocal);
    centre.set(0, group.position.y, 0);
    uniforms.uCentre.value.copy(centre);

    oil.step(camera, clocks.pointer, centre, params.pointerReaction && clocks.pointerActive, delta);
    uniforms.uCursor.value.copy(oil.cursor);
    uniforms.uCursorVel.value.copy(oil.velocity);
    uniforms.uEnergy.value = oil.energy;

    const visible = clocks.intro > 0.001 && out < 0.998;
    if (group.visible !== visible) group.visible = visible;
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} frustumCulled={false} geometry={geometry} material={material} />
    </group>
  );
}
