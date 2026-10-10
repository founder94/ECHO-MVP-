/**
 * Einstein–Rosen Lattice — 원본(einstein-rosen-lattice.html · three 0.143.0)의 장면을 값 그대로 옮긴 엔진.
 * 셰이더(BRIDGE_FRAG · GLOW_FRAG · FinalPass)와 합성 단계는 글자 하나 바꾸지 않았다.
 *
 * 원본에서 바꾼 것(「통합에 필요한 변경」 — 시각 값 변경 0). 바꾼 곳마다 [통합] 표시.
 *   [통합] 크기: 창 전체 → 효과 영역(가운데 띠) 크기. iResolution·uAspect 도 그 크기로.
 *   [통합] 포인터 좌표: 창 기준 → 효과 영역 기준(원본과 같은 가로세로비 보정·±2 묶음).
 *   [통합] 이벤트: window → 효과 영역(passive). 클릭 확대(zoom)는 제품 화면에서 끈다 —
 *          대표 지시 「강제 줌 금지」, 그리고 바로 아래 버튼을 누르려다 효과를 건드려도 화면이 움직이지 않게.
 *   [통합] 재생 방식: 'live'(첫 진입 — 원본 그대로 계속 움직임·1.25초 페이드 인) /
 *          'still'(다시 들어온 경우·움직임 줄이기 — 페이드 없이 완성된 한 장만 그리고 그리기 반복 없음).
 *   [통합] 실행 주기: 탭이 보일 때만 그린다. dispose() 가 반복·이벤트·합성기·GPU 자원을 모두 푼다.
 *   제외: 조절 패널(CONTROL PANEL)·localStorage 설정 덮어쓰기.
 *   [통합 · 앱] 2026-10-10 실제 ECHO 앱으로 옮김: 번들 three(0.186) — WebGL1Renderer → WebGLRenderer · PlaneBufferGeometry → PlaneGeometry ·
 *   extensions.derivatives 삭제(WebGL2 에서 fwidth 기본 제공). 홈페이지 첫 화면 이식본(src/vesper/views/home/hero/hero-lattice.tsx)과 같은 변경.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import { GammaCorrectionShader } from "three/examples/jsm/shaders/GammaCorrectionShader.js";

/* ─────────────  CONFIG — 원본 CONFIG 의 값(대표 전달 값과 같다)  ───────────── */
const CONFIG = {
  lineColor: "#eef3ff",
  throatTint: "#ffd9a6",
  rimTint: "#5878ff",
  glowColor: "#8fb4ff",
  throatRadius: 1.0,
  flareHeight: 1.7,
  cameraDistance: 14.5,
  cameraFov: 60.0,
  meridians: 60.0,
  ringSpacing: 1.0,
  lineWidth: 0.9,
  lineGain: 0.44,
  hazeMax: 0.263,
  throatBoost: 0.38,
  tintAmount: 0.3,
  tintFalloff: 3.0,
  fadeStart: 160.0,
  fadeEnd: 20000.0,
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
  zoomAmount: 0.06,
  zoomDuration: 0.9,
  parallaxAz: 0.11,
  parallaxEl: 0.0,
  parallaxEase: 0.055,
  glowIntensity: 0.0,
  glowWidth: 0.15,
  glowHeight: 0.33,
  glowFalloff: 2.4,
  bloomStrength: 0.3,
  bloomRadius: 0.55,
  bloomThreshold: 0.0,
  torusStrength: 0.22,
  torusRadius: 0.2,
} as const;

const hexToVec3 = (hex: string) => {
  const h = String(hex).replace("#", "");
  return new THREE.Vector3(
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  );
};

const LAYERS = { NONE: 0, TORUS_SCENE: 1, BLOOM_SCENE: 2, ENTIRE_SCENE: 3 };

/* ───────────────────────────  SHADERS — 원본 그대로  ─────────────────────────── */
const QUAD_VERT = `
  void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIDGE_FRAG = `
  precision highp float;

  uniform vec3  iResolution;
  uniform float iTime, iAlpha, uAspect;
  uniform float iAz, iEl, iSpin, iPhase, iPulse, iBreath;
  uniform float uA, uB, uCamDist, uTanFov;
  uniform float uMeridians, uRingSpacing;
  uniform float uLineWidth, uLineGain, uHazeMax, uThroatBoost;
  uniform float uTintAmount, uTintFalloff;
  uniform float uFadeStart, uFadeEnd, uVignette, uVignettePower, uHorizonFloor;
  uniform float uPulseAmp;
  uniform float uSeamGap;
  uniform vec3  uLineColor, uThroatTint, uRimTint;

  const int   STEPS  = 72;
  const int   BISECT = 18;
  const float PI     = 3.14159265359;
  const float SPAN   = 15.0;

  float acoshx(float x){ x = max(x, 1.0); return log(x + sqrt(x * x - 1.0)); }
  float asinhx(float x){ return log(x + sqrt(x * x + 1.0)); }

  // signed "outside-ness": > 0 in the waist chamber the camera occupies,
  // < 0 inside the funnel.  Root = the catenoid  rho = a*cosh(y/b).
  float phiOf(float sig, float A, float Rm2, float cy, float vy, float a, float b){
    float R = sqrt(A * sig * sig + Rm2);
    return acoshx(R / a) - abs(cy + vy * sig) / b;
  }

  // one lattice family: crisp line, dissolving to a bounded haze once the
  // spacing drops under a pixel (this is what paints the horizon band)
  float lattice(float v, float per, float grad){
    float w = max(grad * uLineWidth, 1e-9);
    float d = abs(fract(v / per) - 0.5) * per;
    float s = 1.0 - clamp(d / w, 0.0, 1.0);
    s = s * s * (3.0 - 2.0 * s);
    float ratio = 2.0 * w / per;
    float avg = min(clamp(ratio, 0.0, 1.0), uHazeMax);
    float k = clamp((ratio - 0.30) / 0.70, 0.0, 1.0);
    return clamp(mix(s, avg, k), 0.0, 1.0);
  }

  void main(){
    vec2 p = gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0;

    // breathing throat + click ripple through the bridge
    float a = uA * iBreath * (1.0 - iPulse * uPulseAmp * 0.25);
    float b = uB * (1.0 + iPulse * uPulseAmp * 0.35);

    // orbit camera (pointer parallax) — at rest this is (0, 0, D) looking at 0
    float ca = cos(iAz), sa = sin(iAz), ce = cos(iEl), se = sin(iEl);
    vec3  O  = uCamDist * vec3(sa * ce, se, ca * ce);
    vec3  fw = normalize(-O);
    vec3  rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
    vec3  up = cross(rt, fw);
    vec3  V  = normalize(fw + rt * (p.x * uTanFov * uAspect) + up * (p.y * uTanFov));

    float A    = max(V.x * V.x + V.z * V.z, 1e-8);
    float sqA  = sqrt(A);
    float tst  = -(O.x * V.x + O.z * V.z) / A;
    float Rm2  = max(O.x * O.x + O.z * O.z - A * tst * tst, 0.0);
    float cy   = O.y + V.y * tst;

    // scan sigma = t - tstar in an asinh-warped variable so the throat and
    // the far field are both resolved by the same fixed step count
    float sig0 = -tst;
    float w0   = asinhx(sqA * sig0 / a);
    float dw   = SPAN / float(STEPS);
    float ew   = exp(w0);
    float ed   = exp(dw);
    float iw   = 1.0 / ew;
    float id   = 1.0 / ed;
    float kSig = a / sqA;

    float sPrev = sig0;
    float pPrev = phiOf(sig0, A, Rm2, cy, V.y, a, b);
    float lo = 0.0, hi = 0.0;
    bool  hit = false;

    for (int i = 0; i < STEPS; i++){
      ew *= ed; iw *= id;
      float sg = kSig * 0.5 * (ew - iw);
      float ph = phiOf(sg, A, Rm2, cy, V.y, a, b);
      if (pPrev > 0.0 && ph <= 0.0){ lo = sPrev; hi = sg; hit = true; break; }
      sPrev = sg; pPrev = ph;
    }

    // near-equatorial rays never cross the catenoid — rather than stamp a hard
    // black seam across the middle, let them ride out to the farthest marched
    // sample so the horizon reads as one continuous surface top-to-bottom
    float miss = hit ? 0.0 : 1.0;
    if (hit){
      for (int i = 0; i < BISECT; i++){
        float m = 0.5 * (lo + hi);
        if (phiOf(m, A, Rm2, cy, V.y, a, b) > 0.0) lo = m; else hi = m;
      }
    } else {
      lo = sPrev; hi = sPrev;
    }

    float t = tst + 0.5 * (lo + hi);
    vec3  h = O + V * t;

    // lattice coordinates: rings drift along the bridge, meridians spin
    float ring = h.y + iPhase;
    float mer  = atan(h.z, h.x) + iSpin;

    float perR = 2.0 * PI * b / uMeridians * uRingSpacing;
    float perM = 2.0 * PI / uMeridians;

    float dR = fwidth(ring);
    float dM = min(fwidth(mer), fwidth(mod(mer + PI, 2.0 * PI)));

    float g = max(lattice(ring, perR, dR), lattice(mer, perM, dM));

    // shading — value structure: black field, fine bright wire
    float rr = clamp(abs(h.y) / (b * uTintFalloff), 0.0, 1.0);
    vec3  col = uLineColor;
    col = mix(col, uThroatTint, uTintAmount * (1.0 - smoothstep(0.0, 0.55, rr)));
    col = mix(col, uRimTint,    uTintAmount * smoothstep(0.35, 1.0, rr));

    float boost = 1.0 + uThroatBoost * (1.0 - smoothstep(0.0, 0.45, rr));
    float fade  = 1.0 - clamp((t - uFadeStart) / max(uFadeEnd - uFadeStart, 1e-3), 0.0, 1.0);
    // keep lit pixels (lines + horizon haze) above a floor so the far field and
    // the equatorial miss-fill never fade to a black seam — the sheets stay joined
    fade = max(fade, uHorizonFloor);
    float vig   = 1.0 - uVignette * pow(clamp(length(p) * 0.72, 0.0, 1.0), uVignettePower);

    // FAR-HORIZON gap: split the BACKGROUND where the receding upper & lower
    // sheets meet at the equator, WITHOUT touching the near throat. The seam is an
    // EQUATORIAL-DIRECTION ray (cy ~ 0, cy = the ray's height at closest approach
    // to the axis) — true for BOTH the near throat and the far horizon, so cy alone
    // can't tell them apart. Distance does: gate on t so only far hits (the
    // background horizon, t >> throat) get cut, leaving the central throat whole.
    // uSeamGap = half-width of the black band in cy (world height at the axis).
    float farNess = smoothstep(uCamDist * 1.7, uCamDist * 3.0, t);
    float eqNess  = 1.0 - smoothstep(0.0, max(uSeamGap, 1e-4), abs(cy));
    float gapMask = farNess * eqNess;

    float I = g * boost * fade * vig * uLineGain * iAlpha * (1.0 - gapMask);
    gl_FragColor = vec4(col * I, 1.0);
  }
`;

const GLOW_FRAG = `
  precision highp float;
  uniform vec3  iResolution;
  uniform float uAspect, iAlpha, iPulse;
  uniform float uGlowIntensity, uGlowWidth, uGlowHeight, uGlowFalloff;
  uniform vec3  uGlowColor;
  void main(){
    vec2 q = gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0;
    q.x *= uAspect;
    vec2 e = q / vec2(max(uGlowWidth, 1e-3), max(uGlowHeight, 1e-3));
    float d = length(e);
    float g = exp(-pow(d, uGlowFalloff));
    float amp = uGlowIntensity * (1.0 + iPulse * 0.9);
    gl_FragColor = vec4(uGlowColor * g * amp * iAlpha, 1.0);
  }
`;

const FinalPass = {
  uniforms: {
    tDiffuse: { value: null },
    torusTexture: { value: null },
    bloomTexture: { value: null },
    haloTexture: { value: null },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D torusTexture;
    uniform sampler2D bloomTexture;
    uniform sampler2D haloTexture;
    varying vec2 vUv;
    void main(){
      vec4 base  = texture2D(tDiffuse,     vUv);
      vec4 torus = texture2D(torusTexture, vUv);
      vec4 bloom = texture2D(bloomTexture, vUv);
      vec4 halo  = texture2D(haloTexture,  vUv);
      gl_FragColor = vec4(bloom.rgb + torus.rgb + base.rgb + halo.rgb, 1.0);
    }
  `,
};

export type ErlPlay = "live" | "still";

export interface ErlHandle {
  dispose: () => void;
}

/** WebGL 을 쓸 수 없으면 null — 부르는 쪽이 대체 화면을 보여 준다. */
export const createLattice = (canvas: HTMLCanvasElement, host: HTMLElement, play: ErlPlay): ErlHandle | null => {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;

  /* uniforms — 원본 블록 + applyConfig() 결과(대표 전달 값)를 처음부터 넣는다 */
  const U = {
    iTime: { value: 0 },
    iAlpha: { value: 0 },
    iResolution: { value: new THREE.Vector3(1, 1, 1) },
    uAspect: { value: 1 },
    iAz: { value: 0 },
    iEl: { value: 0 },
    iSpin: { value: 0 },
    iPhase: { value: 0 },
    iPulse: { value: 0 },
    iBreath: { value: 1 },
    uA: { value: CONFIG.throatRadius },
    uB: { value: CONFIG.flareHeight },
    uCamDist: { value: CONFIG.cameraDistance },
    uTanFov: { value: Math.tan((CONFIG.cameraFov * Math.PI) / 360) },
    uMeridians: { value: CONFIG.meridians },
    uRingSpacing: { value: CONFIG.ringSpacing },
    uLineWidth: { value: CONFIG.lineWidth },
    uLineGain: { value: CONFIG.lineGain },
    uHazeMax: { value: CONFIG.hazeMax },
    uThroatBoost: { value: CONFIG.throatBoost },
    uTintAmount: { value: CONFIG.tintAmount },
    uTintFalloff: { value: CONFIG.tintFalloff },
    uFadeStart: { value: CONFIG.fadeStart },
    uFadeEnd: { value: CONFIG.fadeEnd },
    uVignette: { value: CONFIG.vignette },
    uVignettePower: { value: CONFIG.vignettePower },
    uHorizonFloor: { value: CONFIG.horizonFloor },
    uPulseAmp: { value: CONFIG.pulseAmp },
    uSeamGap: { value: CONFIG.seamGap },
    uLineColor: { value: hexToVec3(CONFIG.lineColor) },
    uThroatTint: { value: hexToVec3(CONFIG.throatTint) },
    uRimTint: { value: hexToVec3(CONFIG.rimTint) },
    uGlowColor: { value: hexToVec3(CONFIG.glowColor) },
    uGlowIntensity: { value: CONFIG.glowIntensity },
    uGlowWidth: { value: CONFIG.glowWidth },
    uGlowHeight: { value: CONFIG.glowHeight },
    uGlowFalloff: { value: CONFIG.glowFalloff },
  };

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.layers.enable(LAYERS.NONE);
  camera.layers.enable(LAYERS.TORUS_SCENE);
  camera.layers.enable(LAYERS.BLOOM_SCENE);
  camera.layers.enable(LAYERS.ENTIRE_SCENE);
  scene.add(camera);

  const quad = new THREE.PlaneGeometry(2, 2);
  const bridgeMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: QUAD_VERT,
    fragmentShader: BRIDGE_FRAG,
    depthTest: false,
    depthWrite: false,
    transparent: false,
  });
  const bridge = new THREE.Mesh(quad, bridgeMat);
  bridge.frustumCulled = false;
  bridge.renderOrder = 0;
  bridge.layers.enable(LAYERS.ENTIRE_SCENE);
  bridge.layers.enable(LAYERS.TORUS_SCENE);
  scene.add(bridge);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: QUAD_VERT,
    fragmentShader: GLOW_FRAG,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(quad, glowMat);
  glow.frustumCulled = false;
  glow.renderOrder = 1;
  glow.layers.enable(LAYERS.ENTIRE_SCENE);
  glow.layers.enable(LAYERS.BLOOM_SCENE);
  scene.add(glow);

  /* composers — 원본 그대로 */
  const size = () => ({ w: Math.max(1, host.clientWidth), h: Math.max(1, host.clientHeight) });
  const { w: w0, h: h0 } = size();
  renderer.setSize(w0, h0, false);
  const res = new THREE.Vector2(w0, h0);
  const renderScene = new RenderPass(scene, camera);
  const torusComposer = new EffectComposer(renderer);
  torusComposer.renderToScreen = false;
  torusComposer.addPass(renderScene);
  torusComposer.addPass(new ShaderPass(GammaCorrectionShader));
  const torusBloom = new UnrealBloomPass(res, CONFIG.torusStrength, CONFIG.torusRadius, 0);
  torusComposer.addPass(torusBloom);
  torusComposer.addPass(new ShaderPass(CopyShader));
  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(renderScene);
  const bloomPass = new UnrealBloomPass(res, CONFIG.bloomStrength, CONFIG.bloomRadius, 0);
  bloomPass.threshold = CONFIG.bloomThreshold;
  bloomComposer.addPass(bloomPass);
  bloomComposer.addPass(new ShaderPass(GammaCorrectionShader));
  const blackPixel = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
  blackPixel.needsUpdate = true;
  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(renderScene);
  const finalPass = new ShaderPass(FinalPass);
  finalPass.uniforms.bloomTexture.value = bloomComposer.renderTarget1.texture;
  finalPass.uniforms.torusTexture.value = torusComposer.renderTarget1.texture;
  finalPass.uniforms.haloTexture.value = blackPixel;
  finalComposer.addPass(finalPass);

  /* scene state — 원본 그대로 */
  const t0 = performance.now() / 1000;
  let last = t0;
  let spin = 0;
  let phase = 0;
  let pulse = 0;
  let px = 0;
  let tx = 0;
  // still: 페이드 없이 완성된 모습(iAlpha 1)

  const update = () => {
    const now = performance.now() / 1000;
    let dt = now - last;
    last = now;
    dt = Math.min(Math.max(dt, 0), 0.05);
    U.iTime.value = now;
    const f = play === "still" ? 1 : Math.min(1, (now - t0) / CONFIG.fadeInSeconds);
    U.iAlpha.value = f * f * (3 - 2 * f);
    spin += dt * CONFIG.spinSpeed;
    if (spin > Math.PI * 2) spin -= Math.PI * 2;
    U.iSpin.value = spin;
    const ringPeriod = ((2 * Math.PI * CONFIG.flareHeight) / CONFIG.meridians) * CONFIG.ringSpacing;
    phase += dt * CONFIG.driftSpeed;
    if (phase > ringPeriod) phase -= ringPeriod;
    U.iPhase.value = phase;
    pulse *= Math.exp(-dt * CONFIG.pulseDecay);
    U.iPulse.value = pulse;
    U.iBreath.value = 1 + CONFIG.breathAmp * Math.sin(now * CONFIG.breathSpeed);
    // [통합] 클릭 확대 끔 — 카메라 거리는 원본 기본값 그대로(zoom 0)
    U.uCamDist.value = CONFIG.cameraDistance;
    const e = 1 - Math.pow(1 - CONFIG.parallaxEase, dt * 60);
    px += (tx - px) * e;
    U.iAz.value = px * CONFIG.parallaxAz;
    U.iEl.value = 0 * CONFIG.parallaxEl;
  };
  const draw = () => {
    camera.layers.set(LAYERS.TORUS_SCENE);
    torusComposer.render();
    camera.layers.set(LAYERS.BLOOM_SCENE);
    bloomComposer.render();
    camera.layers.set(LAYERS.ENTIRE_SCENE);
    finalComposer.render();
  };

  /* resize — [통합] 효과 영역 크기 */
  const resize = () => {
    const { w, h } = size();
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    torusComposer.setSize(w, h);
    bloomComposer.setSize(w, h);
    finalComposer.setSize(w, h);
    finalPass.uniforms.bloomTexture.value = bloomComposer.renderTarget1.texture;
    finalPass.uniforms.torusTexture.value = torusComposer.renderTarget1.texture;
    U.iResolution.value.set(w * dpr, h * dpr, 1);
    U.uAspect.value = w / h;
  };
  resize();

  /* pointer — [통합] 효과 영역 기준 · 원본의 가로세로비 보정과 ±2 묶음 그대로 */
  const onMove = (ev: PointerEvent) => {
    const r = host.getBoundingClientRect();
    const a = r.width / r.height;
    let x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    if (a >= 1) x *= a;
    tx = Math.max(-2, Math.min(2, x));
  };
  const onLeave = () => {
    tx = 0;
  };

  let raf = 0;
  let running = false;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    update();
    draw();
  };
  const sync = () => {
    const want = play === "live" && !document.hidden && inView;
    if (want && !running) {
      running = true;
      last = performance.now() / 1000; // 숨었던 동안의 시간을 한꺼번에 흘리지 않는다(dt 는 0.05 로도 묶여 있다)
      raf = requestAnimationFrame(frame);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };
  // [통합] 효과 영역이 화면 밖(짧은·가로 화면에서 위/아래로 벗어남)이면 그리기를 멈춘다(Codex 검수 P2).
  let inView = true;
  const io = new IntersectionObserver((entries) => {
    inView = entries.some((e) => e.isIntersecting);
    sync();
  });
  io.observe(host);
  const ro = new ResizeObserver(() => {
    resize();
    if (!running) {
      update();
      draw();
    }
  });
  ro.observe(host);
  if (play === "live") {
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave, { passive: true });
  }
  document.addEventListener("visibilitychange", sync);
  update();
  draw();
  sync();

  return {
    dispose: () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      torusComposer.renderTarget1.dispose();
      torusComposer.renderTarget2.dispose();
      bloomComposer.renderTarget1.dispose();
      bloomComposer.renderTarget2.dispose();
      finalComposer.renderTarget1.dispose();
      finalComposer.renderTarget2.dispose();
      torusBloom.dispose();
      bloomPass.dispose();
      quad.dispose();
      bridgeMat.dispose();
      glowMat.dispose();
      blackPixel.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
};
