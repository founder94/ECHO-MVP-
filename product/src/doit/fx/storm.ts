/**
 * Storm — 대표 전달 효과(2026-10-10, storm.html · three 0.143). 5만 개 빛 점이 숨 쉬듯 부풀었다 줄며 천천히 도는 구슬.
 * CONFIG · 기하 · 셰이더는 원본 그대로. 공통 파이프라인과 [통합] 변경은 house.ts 머리말.
 *
 * 'pair' 배치(찌릿 예시 — 대표 확인 전 시안): 대표가 준 찌릿 그림(디자인 8번 「두 사람 사이를 잇는 전류」)을
 * Flora 밤하늘 위에서 다시 그린 것. 같은 Storm 구슬 두 개(크기만 0.42배)를 좌우에 두고, 사이에 전류 한 줄(ECHO 추가 셰이더).
 */
import { LAYERS, SNOISE, createHouse, hexToVec3, type FxHandle, type FxPlay, type SceneCtx, type SceneImpl } from "./house";

export const STORM_CONFIG = {
  bgColor: "#1a0418",
  flameColor: "#ff2d6b",
  flameColor2: "#ffd36b",
  flameAmt: 0.2,
  atmoColor: "#ff7ab0",
  atmoCount: 300,
  atmoSize: 24,
  atmoSpeed: 1.0,
  coreColor: "#6a0a2a",
  midColor: "#ff2d6b",
  rimColor: "#ffd36b",
  opacity: 2,
  pointSize: 80,
  brightness: 1.6,
  spin: 0.03,
  blowUp: 0,
  repelRadius: 1.4,
  repelStrength: 4,
  scrollDive: 3,
  scrollGrow: 0.5,
  scrollSpin: 0.6,
  parallax: 0.7,
};
const CONFIG = STORM_CONFIG;

const STORM_VERT = `
        uniform float uTime; uniform float uSize; uniform float uBlowUp;
        uniform vec3 uCursor; uniform float uRepelRadius; uniform float uRepelStrength; uniform float uActivity;
        uniform vec3 uCore; uniform vec3 uMid; uniform vec3 uRim;
        attribute float aScale; attribute float aNoise; attribute float aRadialPush; attribute float aMix;
        varying vec3 vColor; varying float vBlowUp;
        void main() {
          vec3 pos = position;
          // Per-particle in/out wobble.
          float t = uTime * 1.4 + aNoise * 6.2831;
          float wobble = sin(t) * 0.1 * aRadialPush;
          pos *= 1.0 + wobble;
          // Slow secondary swirl on xz.
          float swirlAngle = uTime * 0.05 + aNoise * 6.2831;
          mat2 swirl = mat2(cos(swirlAngle), -sin(swirlAngle), sin(swirlAngle), cos(swirlAngle));
          pos.xz = swirl * pos.xz;
          // Blow-up — radial explosion with a squared falloff.
          vec3 outward = normalize(pos + vec3(0.0001));
          float blow = uBlowUp * uBlowUp;
          pos += outward * blow * (10.0 + aNoise * 18.0) * aRadialPush;
          vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
          vec3 toParticle = modelPosition.xyz - uCursor;
          float dist = length(toParticle);
          float falloff = smoothstep(uRepelRadius, 0.0, dist);
          modelPosition.xyz += normalize(toParticle + vec3(0.0001)) * falloff * uRepelStrength * uActivity;
          vec4 viewPosition = viewMatrix * modelPosition;
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = uSize * aScale;
          gl_PointSize *= (1.0 / -viewPosition.z);
          // Three-stop radial gradient (aMix = biased radius 0..1).
          float t1 = smoothstep(0.25, 0.85, aMix);
          vec3 mix1 = mix(uCore, uMid, t1);
          float t2 = clamp((aMix - 0.7) * 3.0, 0.0, 1.0);
          vColor = mix(mix1, uRim, t2);
          vBlowUp = uBlowUp;
        }`;

const STORM_FRAG = `
        uniform float uOpacity; uniform float uBrightness;
        varying vec3 vColor; varying float vBlowUp;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float strength = pow(1.0 - d * 2.0, 4.5);
          vec3 color = mix(vec3(0.0), vColor, strength);
          float blowFade = 1.0 - smoothstep(0.15, 1.0, vBlowUp);
          gl_FragColor = vec4(color * uBrightness, strength * uOpacity * blowFade);
        }`;

/** 원본 buildGeometry 그대로 */
function stormGeometry(THREE: SceneCtx["THREE"]) {
  const count = 50000, radius = 2.5;
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const noises = new Float32Array(count);
  const radialPush = new Float32Array(count);
  const mixv = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    let u: number, v: number, s: number;
    do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
    const factor = 2 * Math.sqrt(1 - s);
    const dx = u * factor, dy = v * factor, dz = 1 - 2 * s;
    const rN = Math.pow(Math.random(), 0.4); // bias outward
    const r = radius * (0.55 + rN * 0.45);
    positions[i3] = dx * r; positions[i3 + 1] = dy * r; positions[i3 + 2] = dz * r;
    mixv[i] = rN;
    scales[i] = 0.45 + Math.random() * 0.8;
    noises[i] = Math.random();
    radialPush[i] = 0.4 + rN * 1.1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("aScale", new THREE.Float32BufferAttribute(scales, 1));
  g.setAttribute("aNoise", new THREE.Float32BufferAttribute(noises, 1));
  g.setAttribute("aRadialPush", new THREE.Float32BufferAttribute(radialPush, 1));
  g.setAttribute("aMix", new THREE.Float32BufferAttribute(mixv, 1));
  return g;
}

/** [ECHO 추가 · 찌릿 예시] 두 구슬 사이 전류 한 줄 — 대표 그림 8번의 「찌릿」 선. 띠 하나에 노이즈로 흔들리는 밝은 실 */
const CURRENT_FRAG = `
  uniform float uTime; uniform float uAlpha; uniform vec3 uColor; varying vec2 vUv;
  ${SNOISE}
  void main(){
    float x = vUv.x; float y = vUv.y * 2.0 - 1.0;
    float n = snoise(vec3(x * 6.0, uTime * 3.2, 0.0)) * 0.45 + snoise(vec3(x * 17.0, uTime * 7.0, 3.0)) * 0.18;
    float env = smoothstep(0.0, 0.12, x) * smoothstep(1.0, 0.88, x);
    float d = abs(y - n * env);
    float core = exp(-d * 24.0);
    float glow = exp(-d * 5.0) * 0.55;
    float flick = 0.75 + 0.25 * sin(uTime * 23.0 + x * 9.0);
    float a = (core + glow) * env * flick * uAlpha;
    gl_FragColor = vec4(uColor * a, a);
  }`;

export function createStorm(canvas: HTMLCanvasElement, host: HTMLElement, opts: { play: FxPlay; layout?: "single" | "pair"; progress?: { max: number; seconds: number } }): FxHandle | null {
  const pair = opts.layout === "pair";
  return createHouse(canvas, host, {
    bgColor: CONFIG.bgColor, flameColor: CONFIG.flameColor, flameColor2: CONFIG.flameColor2, flameAmt: CONFIG.flameAmt,
    atmoColor: CONFIG.atmoColor, atmoCount: CONFIG.atmoCount, atmoSize: CONFIG.atmoSize, atmoSpeed: CONFIG.atmoSpeed, atmoAlpha: 0.6,
    bloom: [0.4, 0.55], fov: 45, near: 0.1, far: 80, camZ: 7, fog: true,
  }, (ctx): SceneImpl => {
    const { THREE, scene, camera, pointer, mouse } = ctx;
    const uniforms = {
      uTime: { value: 0 },
      uSize: { value: CONFIG.pointSize },
      uOpacity: { value: 0 },
      uBlowUp: { value: CONFIG.blowUp },
      uCursor: { value: new THREE.Vector3() },
      uRepelRadius: { value: CONFIG.repelRadius },
      uRepelStrength: { value: CONFIG.repelStrength },
      uActivity: { value: 0 },
      uCore: { value: hexToVec3(CONFIG.coreColor) },
      uMid: { value: hexToVec3(CONFIG.midColor) },
      uRim: { value: hexToVec3(CONFIG.rimColor) },
      uBrightness: { value: CONFIG.brightness },
    };
    const geometry = stormGeometry(THREE);
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: STORM_VERT, fragmentShader: STORM_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const groups: InstanceType<typeof THREE.Group>[] = [];
    const placements = pair ? [{ x: -1.75, s: 0.42 }, { x: 1.75, s: 0.42 }] : [{ x: 0, s: 1 }];
    for (const p of placements) {
      const group = new THREE.Group();
      const points = new THREE.Points(geometry, material);
      points.layers.enable(LAYERS.ENTIRE_SCENE);
      group.add(points);
      group.position.x = p.x;
      group.userData.base = p.s;
      group.scale.setScalar(p.s);
      if (pair && p.x > 0) group.rotation.y = 1.7; // 두 구슬이 같은 모양으로 보이지 않게(시작 각도만 다르게)
      scene.add(group);
      groups.push(group);
    }

    let current: InstanceType<typeof THREE.Mesh> | null = null;
    let currentMat: InstanceType<typeof THREE.ShaderMaterial> | null = null;
    if (pair) {
      currentMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uColor: { value: hexToVec3("#aef0ff") } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: CURRENT_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      current = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), currentMat);
      current.layers.enable(LAYERS.ENTIRE_SCENE);
      scene.add(current);
    }

    const appearStart = performance.now();
    return {
      // [통합] 점 크기 = 원본 값 × (그림 높이 ÷ 원본 기준 900 화소). 원본은 창 전체(기준 900 — 원본 알갱이 셰이더의 uRes.y / 900 과 같은 기준)에
      // 맞춘 크기라, 작은 효과 영역에 그대로 두면 점이 겹쳐 하얗게 뭉친다. 높이에 비례시키면 원본 화면과 같은 밀도·색이 된다.
      resize: (_w, h) => { uniforms.uSize.value = CONFIG.pointSize * ((h * ctx.dpr) / 900) * (pair ? 0.42 : 1); }, // pair: 구슬을 0.42배로 줄인 만큼 점도 같은 비율(밀도 같게)
      update: (scroll, now, dt, still) => {
        uniforms.uTime.value = now;
        // Scroll dives in while the storm grows and engulfs; cursor parallax sways it. — 원본 그대로
        camera.position.set(mouse.x * CONFIG.parallax, mouse.y * CONFIG.parallax, 7 - scroll * CONFIG.scrollDive);
        camera.lookAt(0, 0, 0);
        const elapsed = performance.now() - appearStart;
        const fade = still ? 1 : Math.max(0, Math.min(1, (elapsed - 300) / 1400));
        uniforms.uOpacity.value = fade * CONFIG.opacity;
        uniforms.uBlowUp.value = CONFIG.blowUp;
        uniforms.uCursor.value.copy(pointer.world);
        uniforms.uActivity.value = pointer.activity;
        for (const g of groups) {
          g.scale.setScalar(g.userData.base * (1 + scroll * CONFIG.scrollGrow));
          g.rotation.y += dt * (CONFIG.spin + scroll * CONFIG.scrollSpin);
          g.rotation.x += dt * CONFIG.spin * 0.33;
        }
        if (currentMat) {
          currentMat.uniforms.uTime.value = now;
          // 구슬이 다 나타난 뒤 전류가 「찌릿」 하고 이어진다
          const c = still ? 1 : Math.max(0, Math.min(1, (elapsed - 1500) / 500));
          currentMat.uniforms.uAlpha.value = c;
        }
      },
      dispose: () => {
        geometry.dispose();
        material.dispose();
        current?.geometry.dispose();
        currentMat?.dispose();
      },
    };
  }, { play: opts.play, progress: opts.progress, interactive: true });
}
