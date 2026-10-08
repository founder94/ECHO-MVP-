// 카메라에 붙어 떠다니는 잔입자(원본 scene/atmosphere.tsx · 은하 전환 제거 · 파랑 한 벌).
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Adaptive } from './adaptive';
import type { Clocks } from '../shared/clocks';
import { hexToLinearVec3 } from '../shared/color';
import { ATMO } from './constants';

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

interface Props { params: Adaptive; clocks: Clocks }

export function Atmosphere({ params, clocks }: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);

  const geometry = useMemo(() => {
    const positions = new Float32Array(params.atmoCount * 3);
    const sizes = new Float32Array(params.atmoCount);
    for (let i = 0; i < params.atmoCount; i++) {
      positions[i * 3] = 2 * Math.random() - 1;
      positions[i * 3 + 1] = 2 * Math.random() - 1;
      positions[i * 3 + 2] = 2 * Math.random() - 1;
      sizes[i] = params.atmoSize * (0.4 + Math.random());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return g;
  }, [params.atmoCount, params.atmoSize]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: hexToLinearVec3(ATMO.color) },
    uAlpha: { value: ATMO.alpha as number },
    uSpread: { value: ATMO.spread },
    uFadeNear: { value: ATMO.fadeNear },
    uFadeFar: { value: ATMO.fadeFar },
    uRes: { value: new THREE.Vector2(1, 1) },
  }), []);

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  }), [uniforms]);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame(({ clock, camera }) => {
    const points = pointsRef.current;
    if (!points) return;
    const dpr = gl.getPixelRatio();
    uniforms.uTime.value = clock.getElapsedTime() * 8;
    uniforms.uRes.value.set(size.width * dpr, size.height * dpr);
    // 등장과 함께 떠오르고, 흩어질 때 같이 옅어진다.
    uniforms.uAlpha.value = ATMO.alpha * clocks.intro * (1 - clocks.out);
    points.position.copy(camera.position);
  });

  return <points ref={pointsRef} frustumCulled={false} geometry={geometry} material={material} />;
}
