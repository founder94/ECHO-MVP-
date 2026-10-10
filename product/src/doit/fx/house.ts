/**
 * 대표 전달 효과(Storm · DNA Helix · Planet — 2026-10-10, three 0.143 원본)가 함께 쓰는 「집」 파이프라인.
 * 원본 세 파일에 똑같이 들어 있는 부분(LAYERS · hexToVec3 · SNOISE · FinalPass · 떠다니는 빛 알갱이 · 합성기 3개 ·
 * 포인터를 z=0 평면으로 옮기는 계산)을 한곳에 모았다. 셰이더 계산은 원본 그대로(일부 영어 설명 주석만 줄임).
 *
 * 원본에서 바꾼 것(「통합에 필요한 변경」 — 시각 값 변경 0). 바꾼 곳마다 [통합] 표시.
 *   [통합] 번들 three 0.186: WebGL1Renderer → WebGLRenderer. 빛 세기는 옛 방식(legacy lights)과 같게 π 를 곱한다(Planet).
 *   [통합] 크기: 창 전체 → 효과 영역(host) 크기. 포인터도 효과 영역 기준(손가락 pointer 이벤트 포함).
 *   [통합] 스크롤 대신 「기다림 진행값」(progress): 앱의 기다리는 화면에는 스크롤이 없다. 원본에서 스크롤이 하던 일
 *          (구슬이 커지며 다가옴 · 나선이 오르며 조여짐)을 기다린 시간이 대신 천천히 밀어 준다 — 오래 기다릴수록 장면이 바뀌어 지루하지 않게.
 *          원본과 같은 이중 감쇠(0.10 → 0.06)를 거친다.
 *   [통합] 재생: 'live'(원본 그대로) / 'still'(움직임 줄이기·저사양 — 다 나타난 한 장만 그리고 반복 없음).
 *          탭이 숨었거나 효과 영역이 화면 밖이면 그리기를 멈춘다. dispose() 가 반복·이벤트·합성기·GPU 자원을 모두 푼다.
 *   제외: 조절 패널 · localStorage 설정 덮어쓰기 · 스크롤 안내 글.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import { GammaCorrectionShader } from "three/examples/jsm/shaders/GammaCorrectionShader.js";

export type FxPlay = "live" | "still";

export const LAYERS = { NONE: 0, TORUS_SCENE: 1, BLOOM_SCENE: 2, ENTIRE_SCENE: 3 } as const;
export const Lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function hexToVec3(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Ashima 3D simplex noise + hash — 원본 그대로 */
export const SNOISE = `
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
    vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  float random(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
`;

/** 합성 + 어두운 바탕 + 모서리 불꽃 — 원본 FinalPass 그대로 */
function makeFinalPass(bg: string, flameA: string, flameB: string, flameAmt: number) {
  return {
    uniforms: {
      iTime: { value: 0 },
      tDiffuse: { value: null }, torusTexture: { value: null }, bloomTexture: { value: null }, haloTexture: { value: null as THREE.Texture | null },
      uBg: { value: hexToVec3(bg) },
      uFlameA: { value: hexToVec3(flameA) },
      uFlameB: { value: hexToVec3(flameB) },
      uFlameAmt: { value: flameAmt },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
    uniform float iTime; uniform sampler2D tDiffuse; uniform sampler2D bloomTexture; uniform sampler2D torusTexture; uniform sampler2D haloTexture;
    uniform vec3 uBg; uniform vec3 uFlameA; uniform vec3 uFlameB; uniform float uFlameAmt;
    varying vec2 vUv;
    vec3 warp3d(vec3 pos, float t){ float curv=.8,a=1.9,b=0.7; pos*=2.;
      pos.x+=curv*sin(t+a*pos.y)+t*b; pos.y+=curv*cos(t+a*pos.x);
      pos.y+=curv*sin(t+a*pos.z)+t*b; pos.z+=curv*cos(t+a*pos.y);
      pos.z+=curv*sin(t+a*pos.x)+t*b; pos.x+=curv*cos(t+a*pos.z);
      return 0.5+0.5*cos(pos.xyz+vec3(1,2,4)); }
    void main(){
      vec2 uv = 2.*vUv - 1.;
      vec3 w = pow(warp3d(vec3(uv.x, sin(uv.y), uv.y), iTime*1.5), vec3(1.5));
      vec3 flame = 1.5*uFlameA*w.x; flame*=w.y; flame += uFlameB*w.z;
      flame *= smoothstep(0.25, 1., abs(uv.y));
      float md = smoothstep(-0.7, 1., -uv.y*uv.x); flame *= md*md;
      vec3 bg = uBg * (1.0 - 0.4 * length(uv));
      vec3 halo = texture2D(haloTexture, vUv).xyz;
      gl_FragColor = vec4(bg + flame*uFlameAmt + texture2D(bloomTexture, vUv).xyz + texture2D(torusTexture, vUv).xyz + texture2D(tDiffuse, vUv).xyz + halo, 1.);
    }`,
  };
}

export type HouseConfig = {
  bgColor: string; flameColor: string; flameColor2: string; flameAmt: number;
  atmoColor: string; atmoCount: number; atmoSize: number; atmoSpeed: number;
  /** 떠다니는 빛 알갱이 조각 셰이더의 마지막 곱(Storm·DNA 0.6 · Planet 0.55) — 원본 그대로 */
  atmoAlpha: number;
  /** bloomComposer 의 UnrealBloomPass (세기, 반경) — 장면마다 원본 값 */
  bloom: [number, number];
  fov: number; near: number; far: number; camZ: number;
  fog: boolean; outputSRGB?: boolean;
};

export type Pointer = { ndc: THREE.Vector2; world: THREE.Vector3; activity: number; active: boolean; lastMove: number };

export type SceneCtx = {
  THREE: typeof THREE;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  pointer: Pointer;
  /** 원본의 mouseSmooth / mouse(NDC, 0.06 감쇠) */
  mouse: { x: number; y: number };
  dpr: number;
  size: () => { w: number; h: number };
};

export type SceneImpl = {
  /** 매 프레임 — 원본 sceneObj.render(scroll, mouse) 자리. progress = 원본 scroll(0..1) 자리 */
  update: (progress: number, now: number, dt: number, still: boolean) => void;
  resize?: (w: number, h: number) => void;
  /** still 로 그릴 수 있게 준비됐는지(Planet: 모형을 다 불러왔는지) */
  ready?: () => boolean;
  /** 그릴 재료를 끝내 못 불러왔는지(Planet: 모형 404·끊김·깨짐) — 참이면 반복을 멈추고 onFail(부르는 쪽이 은은한 빛) */
  failed?: () => boolean;
  dispose: () => void;
};

export type FxHandle = { dispose: () => void };

export type HouseOptions = {
  play: FxPlay;
  /** 기다림 진행값: seconds 동안 0 → max 로(원본 스크롤 자리). 없으면 0 고정 */
  progress?: { max: number; seconds: number };
  /** 포인터로 장면을 흔들 수 있는지(기다림 화면은 켬) */
  interactive?: boolean;
  onReady?: () => void;
  onFail?: () => void;
};

// 확인용 문맥은 바로 돌려준다(갤럭시 A 등은 동시에 쥘 수 있는 WebGL 문맥 수가 적다 — scene-host.tsx 와 같은 방식).
const canWebGL = () => {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
};

/** 「집」 파이프라인을 만들고 장면(build)을 얹는다. WebGL 이 없으면 null(부르는 쪽이 대체 화면). */
export function createHouse(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  config: HouseConfig,
  build: (ctx: SceneCtx) => SceneImpl,
  opts: HouseOptions,
): FxHandle | null {
  if (!canWebGL()) return null;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return null;
  }
  // [통합] 휴대폰 3배 화면에서 합성기 3개 × 반투명 점은 너무 무겁다 → 2 로 묶는다(점 크기 셰이더는 원본 그대로).
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  if (config.outputSRGB) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // [통합] r143 WebGL1Renderer 기본(선형 출력)과 같게
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const size = () => {
    const r = host.getBoundingClientRect();
    return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  if (config.fog) scene.fog = new THREE.Fog(0x000000, 0, 15);
  const { w: w0, h: h0 } = size();
  const camera = new THREE.PerspectiveCamera(config.fov, w0 / h0, config.near, config.far);
  camera.position.set(0, 0, config.camZ);
  camera.layers.enable(LAYERS.TORUS_SCENE);
  camera.layers.enable(LAYERS.BLOOM_SCENE);
  camera.layers.enable(LAYERS.ENTIRE_SCENE);
  scene.add(camera);

  /* COMPOSER (reduced bloom; final pass is composite-only) — 원본 그대로 */
  const renderScene = new RenderPass(scene, camera);
  const torusComposer = new EffectComposer(renderer);
  torusComposer.renderToScreen = false;
  torusComposer.addPass(renderScene);
  torusComposer.addPass(new ShaderPass(GammaCorrectionShader));
  const torusBloom = new UnrealBloomPass(new THREE.Vector2(w0, h0), 0.22, 0.2, 0);
  torusComposer.addPass(torusBloom);
  torusComposer.addPass(new ShaderPass(CopyShader));
  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(renderScene);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(w0, h0), config.bloom[0], config.bloom[1], 0);
  bloomComposer.addPass(bloomPass);
  bloomComposer.addPass(new ShaderPass(GammaCorrectionShader));
  // [통합] 원본은 haloTexture 를 비워 둔다(null → 검정). WebGL2 에서 빈 표본기 경고를 피하려 검정 한 칸을 넣는다(값 같음).
  const blackPixel = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
  blackPixel.needsUpdate = true;
  const finalPass = new ShaderPass(makeFinalPass(config.bgColor, config.flameColor, config.flameColor2, config.flameAmt));
  finalPass.uniforms.bloomTexture.value = bloomComposer.renderTarget1.texture;
  finalPass.uniforms.torusTexture.value = torusComposer.renderTarget1.texture;
  finalPass.uniforms.haloTexture.value = blackPixel;
  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(renderScene);
  finalComposer.addPass(finalPass);

  /* POINTER (world-space cursor "void") — 원본 계산 그대로, [통합] 효과 영역 기준 */
  const pointer: Pointer = { ndc: new THREE.Vector2(0, 0), world: new THREE.Vector3(), activity: 0, active: false, lastMove: performance.now() };
  const mouse = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    pointer.ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.ndc.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    pointer.active = true;
    pointer.lastMove = performance.now();
  };
  const onOut = () => { pointer.active = false; };
  const _ndc = new THREE.Vector3(), _dir = new THREE.Vector3(), _target = new THREE.Vector3();
  const updatePointer = () => {
    _target.set(0, 0, 0);
    if (pointer.active) {
      _ndc.set(mouse.x, mouse.y, 0.5).unproject(camera);
      _dir.copy(_ndc).sub(camera.position).normalize();
      const denom = _dir.z;
      if (Math.abs(denom) > 1e-4) {
        const t = -camera.position.z / denom;
        if (t > 0 && Number.isFinite(t)) _target.copy(camera.position).addScaledVector(_dir, t);
      }
    }
    pointer.world.lerp(_target, 0.12);
    const idle = (performance.now() - pointer.lastMove) / 1000;
    const want = pointer.active && idle < 3 ? 1 : 0;
    pointer.activity += (want - pointer.activity) * 0.06;
  };

  /* ambient atmosphere particles (camera-attached drifting motes) — 원본 그대로 */
  const N = Math.round(config.atmoCount);
  const mPos = new Float32Array(N * 3), mSize = new Float32Array(N), mSeed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    mPos[i * 3] = 2 * Math.random() - 1; mPos[i * 3 + 1] = 2 * Math.random() - 1; mPos[i * 3 + 2] = 2 * Math.random() - 1;
    mSize[i] = config.atmoSize * (0.4 + Math.random()); mSeed[i] = Math.random();
  }
  const motesGeo = new THREE.BufferGeometry();
  motesGeo.setAttribute("position", new THREE.Float32BufferAttribute(mPos, 3));
  motesGeo.setAttribute("size", new THREE.Float32BufferAttribute(mSize, 1));
  motesGeo.setAttribute("seed", new THREE.Float32BufferAttribute(mSeed, 1));
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: hexToVec3(config.atmoColor) }, uRes: { value: new THREE.Vector2(w0 * dpr, h0 * dpr) } },
    vertexShader: `
      attribute float size; attribute float seed; uniform float uTime; uniform vec2 uRes;
      varying float vA;
      vec3 warp(vec3 p, float t){ float c=0.9,a=1.9,b=0.02,s=0.05; p*=2.;
        p.x+=c*sin(s*t+a*p.y)+t*b; p.y+=c*cos(s*t+a*p.x); p.y+=c*sin(s*t+a*p.z)+t*b;
        p.z+=c*cos(s*t+a*p.y); p.z+=c*sin(s*t+a*p.x)+t*b; p.x+=c*cos(s*t+a*p.z);
        return cos(p+vec3(1,2,4)); }
      void main(){
        vec3 v = position*4.0 + warp(position, uTime)*1.2;
        vec4 mv = modelViewMatrix * vec4(v, 1.0);
        float r = length(v); float farF = 1.0 - smoothstep(5.0, 6.5, r); float nearF = smoothstep(0.0, 0.5, -mv.z);
        vA = farF * nearF;
        gl_PointSize = size * uRes.y / 900.0 / -mv.z; gl_PointSize = max(gl_PointSize, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying float vA;
      void main(){ vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
        float tex = smoothstep(0.5, 0.0, l); gl_FragColor = vec4(uColor * tex, tex * vA * ${config.atmoAlpha.toFixed(2)}); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  });
  const motes = new THREE.Points(motesGeo, atmoMat);
  motes.frustumCulled = false;
  motes.layers.enable(LAYERS.ENTIRE_SCENE);
  scene.add(motes);
  motes.onBeforeRender = () => {
    const t = performance.now() / 1000;
    atmoMat.uniforms.uTime.value = t * config.atmoSpeed * 8.0;
    motes.position.copy(camera.position);
    finalPass.uniforms.iTime.value = t;
  };

  const ctx: SceneCtx = { THREE, scene, camera, renderer, pointer, mouse, dpr, size };
  let impl: SceneImpl;
  try {
    impl = build(ctx);
  } catch {
    renderer.dispose();
    return null;
  }

  /* RESIZE — [통합] 효과 영역 크기 */
  let sidePassesDirty = true; // TORUS·BLOOM 합성기를 다시 그려야 하는지(아래 draw)
  const resize = () => {
    sidePassesDirty = true;
    const { w, h } = size();
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const c of [torusComposer, bloomComposer, finalComposer]) { c.setPixelRatio(dpr); c.setSize(w, h); }
    finalPass.uniforms.bloomTexture.value = bloomComposer.renderTarget1.texture;
    finalPass.uniforms.torusTexture.value = torusComposer.renderTarget1.texture;
    atmoMat.uniforms.uRes.value.set(w * dpr, h * dpr);
    impl.resize?.(w, h);
  };
  resize();

  /* 기다림 진행값(원본 scroll 자리) — 원본과 같은 이중 감쇠 */
  const born = performance.now() / 1000;
  let pSmooth = 0, pCurrent = 0;
  const progressTarget = (now: number) => {
    if (!opts.progress) return 0;
    const x = clamp((now - born) / opts.progress.seconds, 0, 1);
    return opts.progress.max * (1 - Math.pow(1 - x, 2));
  };

  let last = born;
  const still = opts.play === "still";
  const update = () => {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, Math.max(0, now - last));
    last = now;
    pSmooth = Lerp(pSmooth, progressTarget(now), 0.1);
    pCurrent = Lerp(pCurrent, pSmooth, 0.06);
    mouse.x = Lerp(mouse.x, pointer.ndc.x, 0.06);
    mouse.y = Lerp(mouse.y, pointer.ndc.y, 0.06);
    updatePointer();
    impl.update(pCurrent, now, dt, still);
  };
  // [통합] 원본 4개도 TORUS·BLOOM 층에 올린 물체가 없다(카메라만 켬) → 두 합성기 결과는 늘 같은 검은 배경 한 장.
  // 같은 그림을 매 프레임 다시 그리지 않는다: 처음 · 크기 바뀜 · 그 층에 물체가 생겼을 때만(화면 결과 같음 · 휴대폰 GPU 절약 · Codex #159 P2).
  // (sidePassesDirty 는 resize 위에서 선언 — 크기가 바뀌면 다시 그림)
  const layerInUse = (layer: number) => {
    let used = false;
    scene.traverse((o) => { if (!used && o !== camera && o.layers.isEnabled(layer)) used = true; });
    return used;
  };
  const draw = () => {
    if (sidePassesDirty || layerInUse(LAYERS.TORUS_SCENE)) { camera.layers.set(LAYERS.TORUS_SCENE); torusComposer.render(); }
    if (sidePassesDirty || layerInUse(LAYERS.BLOOM_SCENE)) { camera.layers.set(LAYERS.BLOOM_SCENE); bloomComposer.render(); }
    sidePassesDirty = false;
    camera.layers.set(LAYERS.ENTIRE_SCENE); finalComposer.render();
  };

  let raf = 0;
  let running = false;
  let inView = true;
  let readyFired = false;
  let halted = false; // 재료를 못 불러와 멈춤 — 다시 켜지 않는다
  const fireReady = () => {
    if (readyFired || (impl.ready && !impl.ready())) return;
    readyFired = true;
    opts.onReady?.();
  };
  const halt = () => {
    if (halted) return false;
    if (!impl.failed?.()) return false;
    halted = true;
    running = false;
    cancelAnimationFrame(raf);
    opts.onFail?.();
    return true;
  };
  const frame = () => {
    if (halt()) return;
    raf = requestAnimationFrame(frame);
    update();
    draw();
    fireReady();
  };
  // still: 재료(모형)가 다 올 때까지 그리지 않고 기다렸다가(값만 갱신 · 몇 초가 걸려도 끝까지) 다 오면 한 장 그리고 멈춘다.
  // 끝내 못 불러오면 failed → onFail. 탭이 숨으면 브라우저가 반복을 쉬게 한다.
  const stillFrame = () => {
    if (halt()) return;
    update();
    if (impl.ready && !impl.ready()) { raf = requestAnimationFrame(stillFrame); return; }
    draw();
    fireReady();
  };
  const sync = () => {
    const want = !halted && !still && !document.hidden && inView;
    if (want && !running) {
      running = true;
      last = performance.now() / 1000;
      raf = requestAnimationFrame(frame);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };
  // GPU 가 문맥을 잃으면(저사양 기기 메모리 부족 · 오래 뒤로 가 있던 탭) 그리기를 멈추고 실패 길(onFail → 은은한 빛)로.
  const onContextLost = (e: Event) => {
    e.preventDefault();
    if (halted) return;
    halted = true;
    running = false;
    cancelAnimationFrame(raf);
    opts.onFail?.();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  const io = new IntersectionObserver((entries) => { inView = entries.some((e) => e.isIntersecting); sync(); });
  io.observe(host);
  const ro = new ResizeObserver(() => { resize(); if (!running && !halted && (!impl.ready || impl.ready())) { update(); draw(); } });
  ro.observe(host);
  if (opts.interactive && !still) {
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerdown", onMove, { passive: true });
    host.addEventListener("pointerleave", onOut, { passive: true });
  }
  document.addEventListener("visibilitychange", sync);
  if (still) raf = requestAnimationFrame(stillFrame);
  else sync();

  return {
    dispose: () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onMove);
      host.removeEventListener("pointerleave", onOut);
      impl.dispose();
      motesGeo.dispose();
      atmoMat.dispose();
      for (const c of [torusComposer, bloomComposer, finalComposer]) { c.renderTarget1.dispose(); c.renderTarget2.dispose(); }
      torusBloom.dispose();
      bloomPass.dispose();
      blackPixel.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
