// 📖 Docs: obsidian/frontend/scene-3d.md

/* ============================================================
   CLARIX — the shipped scene and its scroll choreography
   (clarix-old/3d-website/main.js), ported to TypeScript line for line: the
   same two renderers (ASCII background + holographic model), shaders,
   preloader blob, particle logo, camera/model keyframes and the per-frame
   writes to the page's fixed layers (flying words, glass panel, phase 4–6
   blocks, footer), on three@0.184.0 as the shipped package.json had it.

   Deliberate differences, all invisible:
   - lil-gui is gone; the values it held are constants (`P4`, colours). The
     shipped page created it hidden (`gui.hide()`), so no visitor saw it.
   - Lenis is the starter's (layouts/scroll-layout.tsx, same options) rather
     than a second instance; this loop reads `scrollY` from the scroll event
     exactly as before.
   - The odometer rows and the per-character title spans are rendered by React
     (components/clarix/*), and the CSS-transition reveals the shipped page
     triggered here (`.revealed`, `.preload-hidden`, the preloader fade) are
     springs that subscribe to `useStage` — this loop only says *when*.
   - Draco is decoded from /draco/ (the shipped page used gstatic).
   - The model is shown on load if the preloader has already finished (the
     shipped page left it hidden forever when the GLB arrived after the
     ~1.7 s preloader — a race nobody on a fast connection saw).
   - Globals (`window.mainModel`, …) are module-scoped variables.
   - Portrait screens are framed by aspect (`reframe`); every landscape
     screen keeps the shipped camera exactly (ADR-0031).
   - The disabled OrbitControls no longer block touch scrolling (`pan-y`).
   - THREE.Clock (deprecated in r183, warns) is replaced by its getDelta().

   initClarix(bgCanvas, fgCanvas) builds everything and returns a cleanup.
============================================================ */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

import { useStage } from "@clarix/hooks/use-stage";
import { isMobileFlow } from "@clarix/utils/mobile-flow";
import { publicUrl } from "@shared/paths";

/** The values the shipped lil-gui panel held (its defaults — the panel was hidden). */
const P4 = {
  phase4X: -1.35,
  phase4Y: -5.4,
  phase4Z: 5.67,
  phase4Scale: 0.85,
  phase4RotX: 0,
  phase4RotY: 0.6723,
  phase4RotZ: 0,
} as const;

/* DOIT COMPANY 연결 시안(2026-10-09): 쪽마다 주소 깊이가 달라 공개 파일은 사이트 맨 위 기준으로 찾는다. */
const MODEL_URL = () => publicUrl("assets/model.glb");
/* 입자로 조립되는 것은 Clarix 로고가 아니라 회사 D 심볼이다(대표 지시 §3). 배경·가운데 구멍이 투명한
   심볼 그림의 알파를 마스크로 쓴다 — 검은 사진 배경은 입자가 되지 않는다. */
const LOGO_URL = () => publicUrl("brand/doit-symbol.png");
const DRACO_PATH = () => publicUrl("draco/");
/* D 는 꽉 찬 면이라(원본 로고는 가는 글자) 같은 450px 샘플링이면 입자가 네 배 넘게 늘어난다.
   2px 간격으로 샘플해 원본 로고와 비슷한 입자 수로 맞추고, 세로로 긴 모양이라 세계 폭을 줄인다. */
const LOGO_STRIDE = 2;
const LOGO_WORLD_WIDTH = 2.9;
/* 휴대폰·태블릿의 고해상도 화면에서 두 렌더러를 기기 배율 3 그대로 그리면 프레임이 무너진다.
   효과는 그대로 두고 그리는 해상도만 2 로 묶는다(대표 지시 §5: 정지 화면 대체 금지, 픽셀 비율 먼저 조절). */
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);

/** [scroll position in viewports, story progress] — see onScroll / ADR-0033. */
type PaceKeys = readonly (readonly [number, number])[];
/* 대표 지시 §5(2026-10-09): 최초 연결 시안은 원본 그대로 2800vh — 26 화면 동안 0→1 로 곧게 흐르고
   마지막 1 화면은 100% 정지(원본 main.js 의 pauseScroll). 아래 재조정 키는 참고로만 남긴다. */
export const PACE_ORIGINAL: PaceKeys = [
  [0, 0],
  [26, 1.0],
  [27, 1.0],
];
export const PACE_LANDSCAPE: PaceKeys = [
  [0, 0], // hero → camera glide; the flow titles and client logos scroll by
  [3.1, 0.12],
  [3.5, 0.14], // "Tools" starts
  [7.2, 0.4], // Tools · kill · growth (overlapping), growth parks centre
  [9.6, 0.54], // glass card slides up, growth flies off
  [12.2, 0.68], // card leaves, phase 4 in/hold/out, model to its pose
  [14.6, 0.8], // particles assemble the logo, phase 5 text in
  [15.4, 0.86], // short float, phase 5 text out
  [18.0, 1.0], // finale: model flies in, logo shatters, footer slides up
  [18.3, 1.0], // a beat to land on the footer
];
/** Portrait (touch): the same story, the post-flow phases ~15 % shorter. */
export const PACE_PORTRAIT: PaceKeys = [
  [0, 0],
  [3.1, 0.12],
  [3.45, 0.14],
  [6.6, 0.4],
  [8.65, 0.54],
  [10.85, 0.68],
  [12.9, 0.8],
  [13.6, 0.86],
  [15.8, 1.0],
  [16.1, 1.0],
];
/**
 * Phones (owner review, D-033): the scene plays only up to "growth" parked in
 * the centre (story 0.4), on the portrait keys. Its box is sticky for the
 * last key + `MOBILE_HOLD` viewports, then scrolls away with the page — the
 * stage track's height (`--raw-stage-height-mobile`, globals.css) is
 * last key + hold + 1 viewport. Everything after is flow content.
 */
export const PACE_MOBILE: PaceKeys = PACE_PORTRAIT.slice(0, 4);
export const MOBILE_END = 0.4;
const paceProgress = (keys: PaceKeys, v: number) => {
  if (v <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [v1, p1] = keys[i];
    if (v <= v1) {
      const [v0, p0] = keys[i - 1];
      return p0 + ((p1 - p0) * (v - v0)) / (v1 - v0);
    }
  }
  return keys[keys.length - 1][1];
};

/** Yield the main thread: the build runs as several short tasks, not one
    (perf pass, 2026-10-03 — on a 4× phone it was one ~240 ms task). */
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function initClarix(bgCanvas: HTMLCanvasElement, fgCanvas: HTMLCanvasElement): Promise<() => void> {
  const stage = useStage.getState;

  /* Phones (D-033): the canvases live in a sticky box (`#clarix-stage`, 100lvh)
     that scrolls away after "growth" — they are sized to that box, the large
     viewport, so the URL bar collapsing never resizes the drawing buffer. */
  let mobile = isMobileFlow();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stageBox = document.getElementById("clarix-stage");
  const viewSize = () =>
    mobile && stageBox && stageBox.clientHeight > 0
      ? { w: stageBox.clientWidth, h: stageBox.clientHeight }
      : { w: window.innerWidth, h: window.innerHeight };
  let view = viewSize();

  const bgScene = new THREE.Scene();
  bgScene.background = new THREE.Color(0xf6fafe);

  const scene = new THREE.Scene();

  /* Framing by aspect (rebuild addition — the shipped page framed for a
     landscape screen only, so a phone saw the hero model mostly off its right
     edge). `portrait` is 0 for every landscape screen (aspect ≥ 1.3: all
     desktop values are the shipped ones, untouched) and rises to 1 at a
     phone's ~0.45: the field of view widens 75° → 85°, the hero camera steps
     back 1.5 and its focal point moves from x −1.8 toward the model, so the
     whole figure stands at the right of the title instead of off-screen. */
  const portraitOf = (aspect: number) => THREE.MathUtils.clamp((1.3 - aspect) / 0.85, 0, 1);
  const frame = { fov: 75, heroX: -1.8, heroBack: 0 };
  const reframe = () => {
    const p = portraitOf(view.w / view.h);
    frame.fov = THREE.MathUtils.lerp(75, 85, p);
    frame.heroX = THREE.MathUtils.lerp(-1.8, -1.2, p);
    frame.heroBack = THREE.MathUtils.lerp(0, 1.5, p);
  };
  reframe();

  const camera = new THREE.PerspectiveCamera(frame.fov, view.w / view.h, 0.1, 1000);
  camera.position.set(0, 1, 5);

  const rendererBg = new THREE.WebGLRenderer({ canvas: bgCanvas, antialias: true });
  rendererBg.setSize(view.w, view.h);
  rendererBg.setPixelRatio(pixelRatio());
  await nextTask();

  const renderer = new THREE.WebGLRenderer({ canvas: fgCanvas, antialias: true, alpha: true });
  renderer.setSize(view.w, view.h);
  renderer.setPixelRatio(pixelRatio());
  // Important for GLTF models:
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  await nextTask();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false; // Disable manual mouse rotation
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  // OrbitControls.connect() sets `touch-action: none` on its element — here the
  // full-screen model canvas — which stopped touch scrolling on phones (the
  // shipped page had the same bug). The controls are disabled; give the page
  // its vertical pan back.
  renderer.domElement.style.touchAction = "pan-y";

  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
  directionalLight.position.set(5, 10, 5);
  scene.add(directionalLight);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight2.position.set(-5, -5, -5);
  scene.add(directionalLight2);

  // Variables for animation
  let mixer: THREE.AnimationMixer | undefined;
  // The shipped THREE.Clock's getDelta(), inlined: r183 deprecated Clock and it
  // logs a warning on construction (a console issue in next dev). Same
  // semantics — the first call starts the clock and returns 0.
  let lastTime: number | null = null;
  const clock = {
    getDelta: () => {
      const now = performance.now();
      const delta = lastTime === null ? 0 : (now - lastTime) / 1000;
      lastTime = now;
      return delta;
    },
  };
  const targetMouse = new THREE.Vector2(0.5, 0.5);
  const _revealVec = new THREE.Vector3(); // reused to project the model's center for the reveal origin
  const shaderUniforms = {
    time: { value: 0 },
    mouse: { value: new THREE.Vector2(0.5, 0.5) },
    resolution: { value: new THREE.Vector2(view.w, view.h) },
    bgColor: { value: new THREE.Color(0xf6fafe) },
    colorCyan: { value: new THREE.Color(0x00aaff) },
    colorPurple: { value: new THREE.Color(0x8000ff) },
    colorBlue: { value: new THREE.Color(0x0091ff) },
    colorPeach: { value: new THREE.Color(0xff0000) },
    colorHotPink: { value: new THREE.Color(0xff0099) },
    edgeBlurAmount: { value: 0.5 },
    uRevealProgress: { value: 0.0 },
    uRevealOrigin: { value: new THREE.Vector2(0.5, 0.5) },
  };

  // --- Custom ASCII Background ---
  const bgGeo = new THREE.PlaneGeometry(2, 2);
  const bgMat = new THREE.ShaderMaterial({
    uniforms: {
      time: shaderUniforms.time,
      mouse: shaderUniforms.mouse,
      bgColor: shaderUniforms.bgColor,
      resolution: shaderUniforms.resolution,
      colorCyan: shaderUniforms.colorCyan,
      colorBlue: shaderUniforms.colorBlue,
      colorHotPink: shaderUniforms.colorHotPink,
      colorPeach: shaderUniforms.colorPeach,
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      // Lock the plane to the screen completely ignoring the camera
      gl_Position = vec4(position.xy, 1.0, 1.0);
    }
  `,
    fragmentShader: `
    uniform float time;
    uniform vec2 mouse;
    uniform vec3 bgColor;
    uniform vec2 resolution;
    uniform vec3 colorCyan;
    uniform vec3 colorBlue;
    uniform vec3 colorHotPink;
    uniform vec3 colorPeach;
    varying vec2 vUv;

    // 2D Rotation for organic noise
    mat2 rotate2d(float _angle){
        return mat2(cos(_angle),-sin(_angle),
                    sin(_angle),cos(_angle));
    }

    void main() {
       float pixelSize = 15.0;
       vec2 screenUv = vUv;
       float aspect = resolution.x / resolution.y;
       vec2 aspectUv = vec2(screenUv.x * aspect, screenUv.y);

       vec2 gridUv = aspectUv * (resolution.y / pixelSize);
       vec2 localUv = fract(gridUv) - 0.5;

       // --- 1. Procedural Background Colors ---
       float wave1 = sin(aspectUv.x * 4.0 - time * 0.8);
       float wave2 = cos(aspectUv.y * 3.0 + time * 0.6);
       float combinedWave = smoothstep(-0.8, 0.8, (wave1 + wave2) * 0.5);
       float wavePeach = sin(aspectUv.y * 3.0 - aspectUv.x * 2.0 + time * 0.9) * 0.5 + 0.5;

       vec3 mixColor = mix(colorBlue, colorCyan, combinedWave);
       vec3 pinkTransition = mix(mixColor, colorHotPink, smoothstep(0.1, 0.7, wavePeach));
       mixColor = mix(pinkTransition, colorPeach, smoothstep(0.5, 1.0, wavePeach));
       vec3 lightGridColor = mix(mixColor, vec3(1.0), 0.6);

       // --- 2. ASCII Grid ---
       float boxSize = 0.3 + sin(time * 2.0 + gridUv.x * 0.2 + gridUv.y * 0.2) * 0.1;
       float radius = 0.12;
       float d = length(max(abs(localUv) - (boxSize - radius), 0.0)) - radius;
       float alpha = smoothstep(0.05, 0.0, d);

       // --- 3. Interactive Organic Masking ---
       // Parallax radial mask: center shifts slightly towards the mouse
       vec2 radialCenter = mix(vec2(0.5, 0.5), mouse, 0.3);
       float radialMask = smoothstep(0.7, 0.1, distance(screenUv, radialCenter));

       vec2 p = aspectUv * 3.0;

       vec2 mouseAspect = vec2(mouse.x * aspect, mouse.y);
       float mouseDist = distance(aspectUv, mouseAspect);

       // Multi-layered rotated sine waves for blobs
       float noise = 0.0;
       noise += sin(p.x + time * 0.4) * sin(p.y + time * 0.3);
       p *= rotate2d(1.1);
       noise += sin(p.x * 1.5 - time * 0.5) * sin(p.y * 1.5 + time * 0.2);
       p *= rotate2d(2.3);
       noise += sin(p.x * 2.0 + time * 0.3) * sin(p.y * 2.0 - time * 0.4);

       // Dynamic shape morphing instead of space warping (prevents stretched ray artifacts)
       // Creates an organic ripple/push effect that morphs the blobs near the cursor
       noise += cos(mouseDist * 12.0 - time * 3.0) * smoothstep(0.6, 0.0, mouseDist) * 1.2;

       float blobMask = smoothstep(0.0, 1.5, noise);

       // Extra interactive element: reveal ASCII grid brightly right at the cursor
       float cursorHighlight = smoothstep(0.2, 0.0, mouseDist);

       float finalMask = clamp((radialMask * blobMask) + (cursorHighlight * 0.5), 0.0, 1.0);
       float finalAlpha = alpha * finalMask * 0.85;

       vec3 finalColor = mix(bgColor, lightGridColor, finalAlpha);
       gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
    depthWrite: false, // Ensure it stays in the background
    depthTest: false,
  });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.renderOrder = -1; // Render before anything else
  bgMesh.frustumCulled = false;
  bgScene.add(bgMesh);

  // --- The model, the logo particles (filled in by the loaders) ---
  let mainModel: THREE.Object3D | null = null;
  let mainModelMaterial: THREE.MeshPhysicalMaterial | null = null;
  let baseModelScale = 1.0;
  let currentModelScale = 0;
  let logoParticles: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  let disposed = false;
  let modelReady = false;
  let revealing = false;

  // Advanced holographic procedural shader
  // Reusable function to apply the shader to any material (works for normal meshes and InstancedMeshes)
  const applyHolographicShader = (mat: THREE.Material) => {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.time = shaderUniforms.time;
      shader.uniforms.colorCyan = shaderUniforms.colorCyan;
      shader.uniforms.colorPurple = shaderUniforms.colorPurple;
      shader.uniforms.colorBlue = shaderUniforms.colorBlue;
      shader.uniforms.colorPeach = shaderUniforms.colorPeach;
      shader.uniforms.colorHotPink = shaderUniforms.colorHotPink;
      shader.uniforms.edgeBlurAmount = shaderUniforms.edgeBlurAmount;
      shader.uniforms.uRevealProgress = shaderUniforms.uRevealProgress;
      shader.uniforms.uRevealOrigin = shaderUniforms.uRevealOrigin;
      shader.uniforms.resolution = shaderUniforms.resolution;

      shader.vertexShader = `
          varying vec3 vLocalPosition;
        ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
           #ifdef USE_INSTANCING
             vLocalPosition = (instanceMatrix * vec4(position, 1.0)).xyz;
           #else
             vLocalPosition = position;
           #endif
          `,
      );

      shader.fragmentShader = `
          uniform float time;
          uniform float edgeBlurAmount;
          uniform float uRevealProgress;
          uniform vec2 uRevealOrigin;
          uniform vec2 resolution;
          uniform vec3 colorCyan;
          uniform vec3 colorPurple;
          uniform vec3 colorBlue;
          uniform vec3 colorPeach;
          uniform vec3 colorHotPink;
          varying vec3 vLocalPosition;
        ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <dithering_fragment>`,
        `#include <dithering_fragment>
           vec3 vDir = normalize( vViewPosition );
           float fresnel = 1.0 - max(dot(vDir, normal), 0.0);
           float fresnelPow = pow(fresnel, 2.0); // Softer fresnel falloff

           // Procedural waves (softer, slower)
           // Bind to local position so waves stick to the geometry during rotation
           float wave1 = sin(vLocalPosition.x * 2.0 - time * 1.0);
           float wave2 = cos(vLocalPosition.y * 1.5 + time * 0.8);
           float wave3 = sin(vLocalPosition.z * 2.5 + time * 0.5);
           float combinedWave = (wave1 + wave2 + wave3) / 3.0;
           combinedWave = smoothstep(-0.5, 0.5, combinedWave); // Softer mixing

           float wavePeachRaw = sin(vLocalPosition.y * 2.0 - vLocalPosition.x * 1.0 + time * 1.2);
           // Normalize to 0..1 for clean blending
           float wavePeach = wavePeachRaw * 0.5 + 0.5;

           // 1. Base cold colors (Blue -> Cyan)
           vec3 mixColor = mix(colorBlue, colorCyan, combinedWave);

           // 2. Clean transition to warm colors
           // Smooth, gentle transitions between the pastel tones
           vec3 pinkTransition = mix(mixColor, colorHotPink, smoothstep(0.2, 0.8, wavePeach));
           mixColor = mix(pinkTransition, colorPeach, smoothstep(0.5, 0.95, wavePeach));

           // 3. Purple rim light
           mixColor = mix(mixColor, colorPurple, fresnel);

           // Glowing rim effect (softer)
           vec3 glow = colorCyan * fresnelPow * 1.5;

           // Curved, softer lines
           // Add distortion using X and Z to make the lines wavy/curved
           float distortion = sin(vLocalPosition.x * 2.5 + time * 0.5) * 0.4 + cos(vLocalPosition.z * 2.0) * 0.4;
           float curvedY = vLocalPosition.y + distortion;

           // Less quantity (multiplier 1.2), slower movement
           float lines = fract((curvedY - time * 0.2) * 1.2);

           // Very soft transition for the lines
           float lineIntensity = smoothstep(0.2, 0.6, lines) * smoothstep(1.0, 0.6, lines);
           vec3 lineGlow = vec3(0.2, 0.8, 1.0) * lineIntensity * (0.3 + fresnel * 1.0);

           vec3 finalEmission = mixColor * 0.6 + glow + lineGlow;

           // --- ASCII Dynamic Shapes Effect ---
           float pixelSize = 8.0;
           vec2 localUv = fract(gl_FragCoord.xy / pixelSize) - 0.5;

           float luma = dot(finalEmission, vec3(0.2126, 0.7152, 0.0722));

           // 1. Dynamic Size: scale dramatically based on brightness
           float currentSize = clamp(luma * 1.2, 0.05, 0.45);

           // 2. Dynamic Shape: morph from square to circle based on color!
           // wavePeach controls the warm colors.
           // 0.0 (Cold blue/cyan) = Sharp Squares
           // 1.0 (Warm pink/peach) = Perfect Circles
           float currentRadius = mix(0.0, currentSize, wavePeach);

           // SDF for dynamic rounded box
           float d = length(max(abs(localUv) - (currentSize - currentRadius), 0.0)) - currentRadius;
           float shapeAlpha = smoothstep(1.5 / pixelSize, 0.0, d);

           // Keep discard for the ASCII grid so depth sorting works correctly
           if (shapeAlpha < 0.1) discard;

           // Soften/blur the geometric edges of the model using the fresnel angle
           // Dynamic blur controlled by the slider (0.0 = sharp, 1.0 = extreme blur)
           float edgeStart = mix(1.0, 0.7, edgeBlurAmount);
           float edgeEnd = mix(0.99, 0.1, edgeBlurAmount);
           float edgeBlur = smoothstep(edgeStart, edgeEnd, fresnel);

           finalEmission *= 1.2; // Boost brightness a bit

           // --- SPECTACULAR 2D SCREEN-SPACE REVEAL ---
           // We use screen coordinates so the reveal is perfectly consistent
           // regardless of how the 3D model is scaled or offset internally!
           vec2 screenUv = gl_FragCoord.xy / resolution.xy;
           screenUv.x *= resolution.x / resolution.y; // correct aspect ratio

           // Only carve out the reveal DURING the intro animation. Once it completes the discard is
           // fully disabled, so the model can NEVER be hidden again no matter where it flies during
           // the scroll choreography (fixes the model vanishing when scrolling into the finale).
           if (uRevealProgress < 0.999) {
             // Reveal emanates from the model's ACTUAL on-screen center (updated every frame on the CPU).
             vec2 revealOrigin = uRevealOrigin;
             float distFromCenter2D = distance(screenUv, revealOrigin);

             // Expand radius generously so the whole model is guaranteed to be revealed by the end.
             float currentRadius2D = uRevealProgress * 3.0;

             // Add digital grid noise based on pixel coordinates for a dissolving edge.
             float gridRandom = fract(sin(dot(floor(gl_FragCoord.xy / 8.0), vec2(12.9898, 78.233))) * 43758.5453);
             // Fade the noise out as the reveal completes so nothing stays permanently carved away.
             float noisyRadius2D = currentRadius2D - gridRandom * 0.15 * (1.0 - uRevealProgress);

             if (distFromCenter2D > noisyRadius2D) {
               discard;
             }

             // Glowing edge at the expansion border
             float revealEdge = smoothstep(noisyRadius2D - 0.05, noisyRadius2D, distFromCenter2D);
             vec3 revealGlow = colorHotPink * revealEdge * 3.0 + colorCyan * pow(revealEdge, 4.0) * 8.0;
             finalEmission += revealGlow;
           }

           // Multiply alpha by edgeBlur to make the silhouette soft and blurry
           gl_FragColor = vec4(gl_FragColor.rgb + finalEmission, gl_FragColor.a * shapeAlpha * edgeBlur);
          `,
      );
    };
  };

  // Phase 5: Load SVG Logo to Canvas and setup particle system
  // Built in slices (a yield every few dozen rows / thousands of particles):
  // in one piece it was a ~110 ms task on a 4× phone. Same points, same order.
  let logoImg: HTMLImageElement | null = null;
  let logoBuilding = false;
  const buildLogo = () => {
    if (logoBuilding || !logoImg) return;
    logoBuilding = true;
    void buildLogoParticles(logoImg);
  };
  const buildLogoParticles = async (img: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const aspect = img.height / img.width;

    // Even higher resolution for a massive increase in particle density
    canvas.width = 450;
    canvas.height = Math.floor(450 * aspect);

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    type Pt = { x: number; y: number; z: number; isAmbient: number };
    const validPoints: Pt[] = [];
    const getAlpha = (x: number, y: number) => {
      if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return 0;
      return imgData.data[(y * canvas.width + x) * 4 + 3];
    };

    // Use thickness to create a 3D block
    const thickness = 0.25; // Thin profile so the logo looks unified, not fragmented

    for (let y = 0; y < canvas.height; y += LOGO_STRIDE) {
      if (y % 40 === 39 || y % 40 === 38) {
        await nextTask();
        if (disposed) return;
      }
      for (let x = 0; x < canvas.width; x += LOGO_STRIDE) {
        const alpha = getAlpha(x, y);
        if (alpha > 128) {
          // Front and Back faces
          validPoints.push({ x, y, z: thickness / 2, isAmbient: 0.0 });
          validPoints.push({ x, y, z: -thickness / 2, isAmbient: 0.0 });

          // If it's an edge pixel, spawn particles to form the sides
          if (getAlpha(x - LOGO_STRIDE, y) < 128 || getAlpha(x + LOGO_STRIDE, y) < 128 || getAlpha(x, y - LOGO_STRIDE) < 128 || getAlpha(x, y + LOGO_STRIDE) < 128) {
            const sidePoints = 3; // Fewer side points needed since it's thinner
            for (let s = 1; s < sidePoints; s++) {
              const zPos = -thickness / 2 + (thickness * s) / sidePoints;
              validPoints.push({ x, y, z: zPos, isAmbient: 0.0 });
            }
          }
        }
      }
    }

    // Ambient Particles for Background Depth
    const ambientCount = 3500; // Increased for a thicker galaxy
    for (let i = 0; i < ambientCount; i++) {
      validPoints.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 3.0,
        y: canvas.height / 2 + (Math.random() - 0.5) * canvas.height * 10.0,
        z: (Math.random() - 0.5) * 20.0, // Massive Z spread for depth
        isAmbient: 1.0,
      });
    }

    const logoScale = LOGO_WORLD_WIDTH / canvas.width;

    const particleCount = validPoints.length;
    const positions = new Float32Array(particleCount * 3);
    const randomPositions = new Float32Array(particleCount * 3);
    const delays = new Float32Array(particleCount);
    const isAmbientArray = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      if (i % 12000 === 11999) {
        await nextTask();
        if (disposed) return;
      }
      const pt = validPoints[i];

      // Organic Jitter to break the perfect pixel grid
      const jitterX = (Math.random() - 0.5) * 1.2;
      const jitterY = (Math.random() - 0.5) * 1.2;
      const jitterZ = (Math.random() - 0.5) * 0.1;

      // Target Layout (Local Space, centered at 0,0,0)
      const targetX = (pt.x + jitterX - canvas.width / 2) * logoScale;
      const targetY = -(pt.y + jitterY - canvas.height / 2) * logoScale;
      const targetZ = pt.z + jitterZ;

      positions[i * 3 + 0] = targetX;
      positions[i * 3 + 1] = targetY;
      positions[i * 3 + 2] = targetZ;

      // Random Origin: Organized cylindrical scatter (Local Space)
      const angle = Math.random() * Math.PI * 2;
      const radius = 25 + Math.random() * 25; // Wide spread to fill the screen
      const randX = Math.cos(angle) * radius;
      const randY = (Math.random() - 0.5) * 45; // Tall column
      const randZ = Math.sin(angle) * radius; // Perfect radial symmetry!

      randomPositions[i * 3 + 0] = randX;
      randomPositions[i * 3 + 1] = randY;
      randomPositions[i * 3 + 2] = randZ;

      // Base delay on distance from center for a cool radial assembly effect
      const distFromCenter = Math.sqrt(Math.pow(pt.x - canvas.width / 2, 2) + Math.pow(pt.y - canvas.height / 2, 2));
      const normalizedDist = distFromCenter / (canvas.width / 2);
      delays[i] = Math.random() * 0.5 + normalizedDist * 0.5;

      isAmbientArray[i] = pt.isAmbient || 0.0;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute("aRandomPosition", new THREE.BufferAttribute(randomPositions, 3));
    particleGeo.setAttribute("aDelay", new THREE.BufferAttribute(delays, 1));
    particleGeo.setAttribute("aIsAmbient", new THREE.BufferAttribute(isAmbientArray, 1));

    const particleMat = new THREE.ShaderMaterial({
      uniforms: {
        time: shaderUniforms.time,
        uProgress: { value: 0.0 },
        uScale: { value: 1.0 },
        uShatterFade: { value: 0.0 }, // Fades out the logo particles during shatter
        colorCyan: shaderUniforms.colorCyan,
        colorBlue: shaderUniforms.colorBlue,
        colorPeach: shaderUniforms.colorPeach,
        colorHotPink: shaderUniforms.colorHotPink,
      },
      vertexShader: `
          uniform float time;
          uniform float uProgress;
          uniform float uScale;
          attribute vec3 aRandomPosition;
          attribute float aDelay;
          attribute float aIsAmbient;
          varying vec3 vLocalPosition;
          varying float vIsAmbient;

          void main() {
            vLocalPosition = position;
            vIsAmbient = aIsAmbient;

            float safeProgress = clamp(uProgress, 0.0, 1.0);

            float startThreshold = aDelay * 0.4;
            float particleProgress = clamp((safeProgress - startThreshold) / (1.0 - startThreshold), 0.0, 1.0);

            // Sharper ease out so they snap firmly into place
            float rushEase = 1.0 - pow(1.0 - particleProgress, 4.0);

            // Clean Spin: rotate the random position around Y axis (Local Space)
            float spin = (1.0 - particleProgress) * 10.0;
            float s = sin(spin);
            float c = cos(spin);

            vec3 spiraledPos = aRandomPosition;
            spiraledPos.x = aRandomPosition.x * c - aRandomPosition.z * s;
            spiraledPos.z = aRandomPosition.x * s + aRandomPosition.z * c;

            // FLATTEN the depth of shattered particles so they stay close to the camera
            // and don't shrink into tiny specks due to 3D perspective!
            spiraledPos.z *= 0.15;

            // Smooth vertical convergence without crazy noise
            spiraledPos.y = mix(spiraledPos.y, position.y, rushEase);

            vec3 currentPos = mix(spiraledPos, position, rushEase);

            // Add continuous slow drift to ambient particles AND shattered logo particles!
            // rushEase is 1.0 when assembled, 0.0 when scattered.
            // So (1.0 - rushEase) makes them drift only when scattered!
            float driftFactor = (aIsAmbient > 0.5) ? 1.0 : (1.0 - rushEase);
            if (driftFactor > 0.01) {
               currentPos.x += sin(time * 0.4 + aRandomPosition.y) * 1.5 * driftFactor;
               currentPos.y += cos(time * 0.3 + aRandomPosition.x) * 1.5 * driftFactor;
               currentPos.z += sin(time * 0.5 + aRandomPosition.z) * 1.5 * driftFactor;
            }

            vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);

            // Expand the base size of shattered logo particles by 4x to counteract any depth shrinking
            float shatterBoost = mix(4.5, 1.0, rushEase);
            float baseSize = (aIsAmbient > 0.5 ? 40.0 : (16.0 * shatterBoost)) * uScale;

            // Point size attenuation with less aggressive clamping
            gl_PointSize = clamp(baseSize / max(0.5, -mvPosition.z), 4.0, 120.0);

            gl_Position = projectionMatrix * mvPosition;
          }
        `,
      fragmentShader: `
          uniform float time;
          uniform float uProgress;
          uniform float uShatterFade;
          uniform vec3 colorCyan;
          uniform vec3 colorBlue;
          uniform vec3 colorPeach;
          uniform vec3 colorHotPink;
          varying vec3 vLocalPosition;
          varying float vIsAmbient;

          void main() {
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            float r = dot(cxy, cxy);
            if (r > 1.0) discard;

            float dist = sqrt(r);
            // Stronger core, softer edge for a denser "juicy" look without additive washout
            float glow = smoothstep(1.0, 0.2, dist);

            // Spatial Gradient + Flowing Time Animation
            float waveX = sin(time * 1.5) * 1.5;
            float waveY = cos(time * 1.2) * 0.8;

            // Map ambient particles into the gradient bounds so they shimmer too
            float effX = vIsAmbient > 0.5 ? mod(vLocalPosition.x + time, 6.0) - 3.0 : vLocalPosition.x;
            float effY = vIsAmbient > 0.5 ? mod(vLocalPosition.y + time, 2.0) - 1.0 : vLocalPosition.y;

            float tX = smoothstep(-3.0, 3.0, effX + waveX);
            float tY = smoothstep(-1.0, 1.0, effY + waveY);

            // Bilinear blend of 4 colors
            vec3 leftColor = mix(colorBlue, colorCyan, tY);
            vec3 rightColor = mix(colorHotPink, colorPeach, tY);

            // Boost the vibrancy of the colors to make them "juicy"
            vec3 finalColor = mix(leftColor, rightColor, tX) * 1.4;

            // Fade out logo particles during the final shatter phase, but keep ambient particles fully visible
            float alphaMultiplier = vIsAmbient > 0.5 ? 1.0 : (1.0 - uShatterFade);

            // Global fade-in to prevent abrupt popping when they first appear
            float globalFadeIn = smoothstep(0.0, 0.15, uProgress);

            gl_FragColor = vec4(finalColor, glow * alphaMultiplier * globalFadeIn);
          }
        `,
      transparent: true,
      depthWrite: false, // Prevent particle sorting issues
      blending: THREE.NormalBlending, // Correct blending for vibrant colors on white backgrounds
    });

    logoParticles = new THREE.Points(particleGeo, particleMat);
    // Place the entire particle group at the exact focal point in world space
    logoParticles.position.set(-0.6, -2.0, -3.0);
    logoParticles.frustumCulled = false;
    logoParticles.visible = false;
    scene.add(logoParticles);
  };

  // Load the 3D model
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_PATH());

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.load(
    MODEL_URL(),
    (gltf) => {
      if (disposed) return;
      const model = gltf.scene;

      // Auto center and scale the model so it always fits nicely
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Scale model to a standard size
      if (maxDim > 0) {
        const scale = 5 / maxDim;
        model.scale.setScalar(scale);
        baseModelScale = scale; // Save the dynamic base scale for later animations
      } else {
        baseModelScale = 1.0;
      }

      // (The shipped code measured the box again here and centred the model on
      // it — then overwrote the position on the next line. That second
      // bounding box of the skinned mesh was ~20 ms of a 4× phone's main
      // thread for nothing; the position below is the one that applies.)

      // Apply the user's custom default coordinates and rotation
      // Moved 70px (approx +0.7 units) to the right, and rotated 15 degrees clockwise on Y axis
      model.position.set(0.1, -3.93, 4.17);
      model.rotation.set(-0.05026, -0.92781, -0.12566);

      // Expose the model so the animate loop can access and move it.
      // Hidden until the preloader finishes (shown at once if it already has).
      mainModel = model;
      mainModel.visible = revealing;

      // Offset the focal point to the left (-1.8) so the model appears on the right side.
      // Set the focal target slightly higher (0.5) and camera lower (-1.0) for a heroic upward angle.
      camera.position.set(frame.heroX, -1.0, 6.5 + frame.heroBack);
      camera.lookAt(frame.heroX, 0.5, 0);
      controls.target.set(frame.heroX, 0.5, 0);
      controls.update();

      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const baseMat = new THREE.MeshPhysicalMaterial({
            color: 0x010103, // Very dark, almost black
            metalness: 0.9,
            roughness: 0.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide,
          });

          applyHolographicShader(baseMat);

          (child as THREE.Mesh).material = baseMat;
        }
      });

      scene.add(model);
      modelReady = true;

      // Prewarm (owner-approved, ADR-0033): compile the holographic material's
      // program now, during the loader, so the first frame the figure shows is
      // not also the frame that compiles it. `compile` skips invisible objects.
      const wasVisible = model.visible;
      model.visible = true;
      void renderer.compileAsync(scene, camera).finally(() => {
        if (mainModel === model && !revealing) model.visible = wasVisible;
      });

      // Save reference for fading out
      model.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) mainModelMaterial = (c as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
      });

      const img = new Image();
      img.src = LOGO_URL();
      // Phones never reach the logo (the scene stops at "growth", D-033): its
      // particles are built only on a screen that plays it.
      img.onload = () => {
        logoImg = img;
        if (!disposed && !mobile) buildLogo();
      };

      // Setup animation
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
          mixer?.clipAction(clip).play();
        });
      }
    },
    undefined,
    (error) => {
      console.error("An error happened while loading the model:", error);
    },
  );

  let scrollProgress = 0;
  // Dampen the upscaling so it doesn't get ridiculously huge on 4K monitors
  const _ratio = window.innerWidth / 1200;
  let responsiveScale = _ratio <= 1.0 ? _ratio : 1.0 + (_ratio - 1.0) * 0.4; // Grows at 40% speed above 1200px

  // Re-paced scroll (owner-approved, ADR-0033). The shipped page mapped scroll
  // to story progress linearly over 26 viewports (+1 of pause), so a phase's
  // length followed its slice of 0..1, not what it shows: each flying word took
  // ~3 viewports, phase 4 held still for ~2, the logo floated for ~1.5 and the
  // page ended on a full viewport of nothing. Now the scroll position (in
  // viewports) maps to progress through these keys — every phase keeps its
  // choreography, only the distance it takes changes. The page height
  // (`--raw-page-height`, globals.css) is the last key + 1 viewport.
  const onScroll = () => {
    if (mobile) {
      // The sticky box is 100lvh: viewports from it, not innerHeight.
      scrollProgress = Math.min(MOBILE_END, paceProgress(PACE_MOBILE, window.scrollY / view.h));
      return;
    }
    const keys = PACE_ORIGINAL;
    // Viewports from the document's own height, so a phone's collapsing URL bar
    // (innerHeight ≠ 100vh) cannot skew the mapping.
    const vh = document.body.scrollHeight / (keys[keys.length - 1][0] + 1);
    scrollProgress = paceProgress(keys, window.scrollY / vh);
  };
  window.addEventListener("scroll", onScroll);

  // The page's fixed layers this loop writes to every frame (rendered by the view).
  const byId = (id: string) => document.getElementById(id);
  const word1 = byId("word1");
  const word2 = byId("word2");
  const word3 = byId("word3");
  const glassContainer = byId("glass-container");
  const glassGradient = byId("glass-gradient");
  const phase4Container = byId("phase4-container");
  const phase5Container = byId("phase5-container");
  const phase6Container = byId("phase6-container");
  const phase6Footer = byId("phase6-footer");
  const odoNumbers = byId("odometer-numbers");

  // Helper function to animate flying words smoothly
  function updateWordAnimation(el: HTMLElement | null, p: number, start: number, end: number, stopAtCenter = false) {
    if (!el) return;
    if (p <= start) {
      el.style.opacity = "0";
      return;
    }

    const localP = (p - start) / (end - start);

    if (!stopAtCenter && localP >= 1.0) {
      el.style.opacity = "0";
      return;
    }

    let xOff: number, yOff: number, rotY: number, zOff: number;

    if (stopAtCenter && localP > 1.0) {
      // Phase 3 Final Transition: Fly upwards out of screen
      const extraP = Math.min(1.0, (localP - 1.0) / 1.25);
      const easeIn = extraP * extraP; // Accelerate upwards

      xOff = 0; // Stay centered horizontally
      yOff = 0 - easeIn * 100; // Fly straight up 100vh
      rotY = 0; // Stay perfectly flat
      zOff = -800;

      el.style.opacity = "1";

      // Animate individual letters at different speeds!
      if (el.children.length > 0) {
        const speedMultipliers = [0.8, 1.4, 0.5, 1.7, 0.9, 1.2];
        for (let i = 0; i < el.children.length; i++) {
          const child = el.children[i] as HTMLElement;
          const speed = speedMultipliers[i % speedMultipliers.length];
          const extraY = -(easeIn * 60 * speed);

          // Increased from 8 to 24 per user request
          const blurAmount = easeIn * 24 * speed;

          child.style.transform = `translate3d(0, ${extraY}vh, 0)`;
          child.style.opacity = "1";
          child.style.filter = blurAmount > 0.1 ? `blur(${blurAmount}px)` : "none";
        }
      }
    } else {
      // Smooth Easing Functions
      const sineInOut = (t: number) => 0.5 - Math.cos(t * Math.PI) / 2;

      if (stopAtCenter) {
        xOff = 1400 - sineInOut(localP) * 1400;
        const yEaseOut = 1 - Math.pow(1 - localP, 3);
        yOff = 80 - yEaseOut * 80;
      } else {
        xOff = 1400 - sineInOut(localP) * 3100;
        const yProgress = Math.min(1.0, localP / 0.55);
        const yEaseOut = 1 - Math.pow(1 - yProgress, 3);
        yOff = 80 - yEaseOut * 80;
      }

      // Magical dynamic perspective
      rotY = -(xOff / 800) * 60;
      zOff = -800;

      // Staggered Fly-In Logic for individual letters
      if (el.children.length > 0) {
        const totalChars = el.children.length;
        for (let i = 0; i < totalChars; i++) {
          const child = el.children[i] as HTMLElement;
          const delay = (i / totalChars) * 0.25;
          const flyInDuration = 0.35;
          let childP = (localP - delay) / flyInDuration;
          childP = Math.max(0, Math.min(1.0, childP));

          let childOpacity = Math.min(1.0, childP / 0.5); // Fades in during the first half of its flyInDuration

          // Start 60vh lower and slide up into the word's baseline
          const yEase = 1 - Math.pow(1 - childP, 3);
          let childY = 60 - yEase * 60;

          // Increased blur from 8 to 24
          let childBlur = 24 - yEase * 24;

          // Fly-out logic for normal words (staircase upwards, left to right)
          if (!stopAtCenter) {
            const outDelay = (i / totalChars) * 0.15;
            // Start flying out much earlier (0.50 instead of 0.65)
            let outP = (localP - (0.5 + outDelay)) / 0.25;
            outP = Math.max(0, Math.min(1.0, outP));

            if (outP > 0) {
              const outEase = outP * outP; // Accelerate upwards smoothly
              childY -= outEase * 60; // Fly upwards (negative Y offset)
              childBlur += outEase * 24; // Increase blur back up to 24px
              childOpacity = Math.min(childOpacity, 1.0 - outP); // Fade out to 0
            }
          }

          child.style.transform = `translate3d(0, ${childY}vh, 0)`;
          child.style.opacity = childOpacity.toString();
          child.style.filter = childBlur > 0.1 ? `blur(${childBlur}px)` : "none";
        }
        el.style.opacity = "1";
      } else {
        // Fallback for parent opacity if no spans
        let opacity = 1.0;
        if (localP < 0.1) opacity = localP / 0.1;
        else if (!stopAtCenter && localP > 0.8) opacity = 1.0 - (localP - 0.8) / 0.2;
        el.style.opacity = opacity.toString();
      }
    }

    // Portrait (ADR-0033): the flight path is in px tuned for a ~1440 px
    // screen, so on a phone a word spent most of its range off-screen (the
    // scroll did nothing visible). Its travel scales with the width — the word
    // itself is 25vw — and its turn (rotY, from the unscaled path) is unchanged.
    const travel = window.matchMedia("(orientation: portrait)").matches ? window.innerWidth / 1440 : 1;
    el.style.transform = `translate3d(calc(-50% + ${xOff * travel}px), calc(-50% + ${yOff}vh), ${zOff}px) rotateY(${rotY}deg)`;
  }

  /**
   * Phones (D-033): the same flight across the screen, the word as one piece —
   * no per-letter stagger, rise or blur (24 px blurs on every letter of a
   * 25vw word were the costliest frames a phone drew). `park`: growth flies
   * in and stays centred; the stage then scrolls away with it.
   */
  function updateWordSimple(el: HTMLElement | null, p: number, start: number, end: number, park = false) {
    if (!el) return;
    const t = (p - start) / (end - start);
    if (t <= 0 || (!park && t >= 1)) {
      el.style.opacity = "0";
      return;
    }
    const k = Math.min(1, t);
    const sineInOut = (x: number) => 0.5 - Math.cos(x * Math.PI) / 2;
    const xOff = park ? 1400 - sineInOut(k) * 1400 : 1400 - sineInOut(k) * 3100;
    const yEaseOut = 1 - Math.pow(1 - Math.min(1, park ? k : k / 0.55), 3);
    const yOff = 80 - yEaseOut * 80;
    const fadeIn = Math.min(1, k / 0.3);
    const fadeOut = park ? 1 : 1 - Math.max(0, Math.min(1, (k - 0.6) / 0.3));
    const rotY = -(xOff / 800) * 60;
    const travel = window.innerWidth / 1440;
    el.style.opacity = String(Math.min(fadeIn, fadeOut));
    el.style.transform = `translate3d(calc(-50% + ${xOff * travel}px), calc(-50% + ${yOff}vh), -800px) rotateY(${rotY}deg)`;
  }

  // Event Listeners
  const onMouseMove = (event: MouseEvent) => {
    // Update target mouse for delayed lerp (Shader expects 0.0 to 1.0 UV coordinates)
    targetMouse.x = event.clientX / window.innerWidth;
    targetMouse.y = 1.0 - event.clientY / window.innerHeight;
  };
  window.addEventListener("mousemove", onMouseMove);

  // The page's fixed layers the frame loop writes — on phones they are flow
  // content (D-033) and carry none of its inline styles.
  const loopLayers = () => [glassContainer, glassGradient, phase4Container, phase5Container, phase6Container, phase6Footer];
  const releaseLayers = () => {
    for (const el of loopLayers()) el?.removeAttribute("style");
  };

  // Resize handler
  const onResize = () => {
    const wasMobile = mobile;
    mobile = isMobileFlow();
    // A phone's URL bar collapsing changes only the height: the sticky box is
    // the large viewport already, so nothing to redo (a resize reallocates
    // and clears the drawing buffers — a blank frame mid-scroll).
    if (mobile && wasMobile && viewSize().w === view.w) return;
    view = viewSize();
    if (mobile && !wasMobile) releaseLayers();
    if (!mobile) buildLogo();
    onScroll();
    resume();
    camera.aspect = view.w / view.h;
    reframe();
    camera.fov = frame.fov;
    placePreloader();
    camera.updateProjectionMatrix();
    rendererBg.setSize(view.w, view.h);
    renderer.setSize(view.w, view.h);
    shaderUniforms.resolution.value.set(view.w, view.h);

    // Update 3D scale proportionality (damped upscaling)
    const _newRatio = window.innerWidth / 1200;
    responsiveScale = _newRatio <= 1.0 ? _newRatio : 1.0 + (_newRatio - 1.0) * 0.4;
  };
  window.addEventListener("resize", onResize);

  // --- PRELOADER SETUP ---
  let preloaderDone = false;
  let preloaderCurrentPercent = 0;
  let preloaderTargetPercent = 0;
  let preloaderShatter = 0.0;

  const preloaderPointsGeo = new THREE.PlaneGeometry(4, 4);
  const preloaderPointsMat = new THREE.ShaderMaterial({
    uniforms: {
      time: shaderUniforms.time,
      colorCyan: shaderUniforms.colorCyan,
      colorPurple: shaderUniforms.colorPurple,
      colorBlue: shaderUniforms.colorBlue,
      colorPeach: shaderUniforms.colorPeach,
      colorHotPink: shaderUniforms.colorHotPink,
      uShatter: { value: 0.0 },
    },
    vertexShader: `
    uniform float uShatter;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 pos = position;
      // Expand while scattering
      pos *= (1.0 + uShatter * 2.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
    fragmentShader: `
    uniform float time;
    uniform float uShatter;
    uniform vec3 colorCyan;
    uniform vec3 colorPurple;
    uniform vec3 colorBlue;
    uniform vec3 colorPeach;
    uniform vec3 colorHotPink;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5, 0.5);
      vec2 st = vUv - center;

      float angle = atan(st.y, st.x);
      float radius = length(st);

      // Dynamic fluid wobble
      float wobble = sin(angle * 3.0 + time * 1.5) * 0.03 + cos(angle * 2.0 - time) * 0.04;
      float maxRadius = 0.35 + wobble;

      // Scatter/Expand logic
      float currentRadius = maxRadius * (1.0 + uShatter * 1.5);

      // Soft alpha edge
      float alpha = smoothstep(currentRadius + 0.08, currentRadius - 0.02, radius);

      // Dissolve noise during shatter
      float shatterNoise = fract(sin(dot(vUv * 10.0, vec2(12.9898, 78.233))) * 43758.5453);
      alpha -= (shatterNoise * uShatter * 2.0);
      alpha *= (1.0 - uShatter); // Fade out completely

      if (alpha <= 0.01) discard;

      // Organic color gradients
      vec2 p = vUv * 2.0 - 1.0;
      float wave1 = sin(p.x * 2.0 - time * 1.0);
      float wave2 = cos(p.y * 1.5 + time * 0.8);
      float combinedWave = smoothstep(-0.5, 0.5, (wave1 + wave2)/2.0);

      float wavePeach = sin(p.y * 2.0 - p.x * 1.0 + time * 1.2) * 0.5 + 0.5;

      vec3 mixColor = mix(colorBlue, colorCyan, combinedWave);
      vec3 pinkTransition = mix(mixColor, colorHotPink, smoothstep(0.2, 0.8, wavePeach));
      mixColor = mix(pinkTransition, colorPeach, smoothstep(0.5, 0.95, wavePeach));

      // Purple edge
      mixColor = mix(mixColor, colorPurple, smoothstep(0.2, 0.45, radius));
      // Soften colors by mixing towards white
      mixColor = mix(mixColor, vec3(1.0), 0.35); // 35% lighter/pastel

      gl_FragColor = vec4(mixColor, alpha);
    }
  `,
    transparent: true,
    depthWrite: false,
  });
  const preloaderPoints = new THREE.Mesh(preloaderPointsGeo, preloaderPointsMat);
  const placePreloader = () => {
    preloaderPoints.position.set(frame.heroX, -0.25, 4.5); // Move closer to camera to overlap exactly in the center
    preloaderPoints.lookAt(frame.heroX, -1.0, 6.5); // Face the camera perfectly
  };
  placePreloader();
  scene.add(preloaderPoints);

  // Stepped loader: snap the target to 0 → 25 → 50 → 75 → 100 with a short hold between
  // each step. The animate loop smoothly rolls the visible counter up to each target, so the
  // number visibly climbs, pauses, climbs again — a deliberate, premium cadence instead of a
  // slow continuous crawl.
  const loaderSteps = [25, 50, 75, 100];
  let loaderStepIndex = 0;
  const timers: number[] = [];
  // The last step waits for the model (owner-approved, ADR-0033): the count
  // holds at 75 until the GLB is in and compiled, capped at MODEL_WAIT_MS from
  // start, so the hand-over never reveals an empty stage on a slow network.
  const loaderStart = performance.now();
  const MODEL_WAIT_MS = 6000;
  function advanceLoader() {
    if (loaderStepIndex >= loaderSteps.length) return;
    if (loaderSteps[loaderStepIndex] === 100 && !modelReady && performance.now() - loaderStart < MODEL_WAIT_MS) {
      timers.push(window.setTimeout(advanceLoader, 50));
      return;
    }
    preloaderTargetPercent = loaderSteps[loaderStepIndex];
    loaderStepIndex++;
    timers.push(window.setTimeout(advanceLoader, 300)); // little delay between each step
  }
  timers.push(window.setTimeout(advanceLoader, 200)); // brief beat before the count begins

  let revealStartTime: number | null = null;

  // Custom lerp that snaps to the target to prevent infinite floating point GUI updates
  const snapLerp = (current: number, target: number, speed: number) => {
    if (Math.abs(target - current) < 0.0001) return target;
    return THREE.MathUtils.lerp(current, target, speed);
  };

  // Animation Loop
  let rafId = 0;
  // Phones (D-033): once the stage has scrolled off the top the loop stops —
  // nothing it draws or writes is on screen — and restarts when it returns.
  let stageOnScreen = true;
  let paused = false;
  const resume = () => {
    if (!paused || disposed) return;
    paused = false;
    lastTime = null; // no catch-up delta: the lerps would overshoot
    rafId = requestAnimationFrame(animate);
  };
  const stageObserver =
    stageBox &&
    new IntersectionObserver(([entry]) => {
      stageOnScreen = entry.isIntersecting;
      if (stageOnScreen) resume();
    });
  if (stageObserver && stageBox) stageObserver.observe(stageBox);

  function animate() {
    if (mobile && !stageOnScreen && preloaderDone) {
      paused = true;
      return;
    }
    rafId = requestAnimationFrame(animate);

    const delta = clock.getDelta();
    // 연결 시안(움직임 줄이기 대체 동작): 스크롤을 따라가는 장면 전환은 그대로 두되(사용자가 직접 움직이는 것),
    // 저절로 흐르는 움직임 — 배경 물결·입자 표류·모델 자체 애니메이션 — 은 로딩이 끝난 뒤 멈춘다.
    const ambientDelta = reducedMotion.matches && preloaderDone ? 0 : delta;

    shaderUniforms.time.value += ambientDelta;
    preloaderPointsMat.uniforms.time.value = shaderUniforms.time.value;

    // Smoothly interpolate mouse position for delayed interactive effect
    shaderUniforms.mouse.value.lerp(targetMouse, delta * 3.0);

    // Cinematic Scroll Transition
    // We complete the screen transition in the first 15% of the scroll.
    const transitionProgress = Math.min(1.0, scrollProgress / 0.12);

    // Phase 3 Transition (0.40 to 0.54) - Glass slides up
    const phase3Progress = Math.max(0, Math.min(1.0, (scrollProgress - 0.4) / 0.14));

    // Phase 4: 0.54 -> 0.68 (Glass block flies away)
    const phase4Progress = Math.max(0, Math.min(1.0, (scrollProgress - 0.54) / 0.14));

    // Phase 5: 0.68 -> 0.80 (Camera pushes deep into the scene, particles assemble)
    // Finishes assembling at 0.80, then holds while the logo floats
    const phase5Progress = Math.max(0, Math.min(1.0, (scrollProgress - 0.68) / 0.12));

    // Model Fly-In: 0.86 -> 1.00 (generous range so the finale + footer never feel rushed)
    // Starts after a short pause (0.80 to 0.86) where the assembled logo just floats
    const modelFlyInProgress = Math.max(0, Math.min(1.0, (scrollProgress - 0.86) / 0.14));

    // Logo Shatter: 0.86 -> 1.00
    // Starts exactly with the model fly-in
    const logoShatterProgress = Math.max(0, Math.min(1.0, (scrollProgress - 0.86) / 0.14));

    // Phones: phases 3–6 are flow content after the scene (D-033).
    if (!mobile) {
      // Animate the Phase 4 text container
      if (phase4Container) {
        if (phase4Progress > 0 && phase4Progress < 1.0) {
          let opacity = 1.0;
          let yOffset = 0;

          if (phase4Progress < 0.2) {
            const p = phase4Progress / 0.2; // Fade in smoothly
            opacity = p;
            yOffset = 50 * (1 - p); // Slide up
          } else if (phase4Progress > 0.8) {
            const p = (phase4Progress - 0.8) / 0.2; // Fade out smoothly
            opacity = 1 - p;
            yOffset = -50 * p; // Continue sliding up and out
          }

          phase4Container.style.opacity = opacity.toString();
          phase4Container.style.transform = `translateY(${yOffset}px)`;
          phase4Container.style.pointerEvents = opacity > 0.5 ? "auto" : "none";

          if (opacity > 0.7) stage().reveal("phase4-title");
        } else {
          phase4Container.style.opacity = "0";
          phase4Container.style.pointerEvents = "none";
        }
      }

      // Animate the Phase 5 text container (Particle Logo Section)
      if (phase5Container) {
        if (scrollProgress >= 0.68 && scrollProgress <= 1.0) {
          let opacity = 0;
          if (scrollProgress < 0.74) {
            // Stay hidden until particles are mostly assembled
            opacity = 0;
          } else if (scrollProgress < 0.78) {
            // Fade in quickly
            opacity = (scrollProgress - 0.74) / 0.04;
          } else if (scrollProgress < 0.82) {
            // Hold during pause
            opacity = 1.0;
          } else if (scrollProgress < 0.86) {
            // Fade out BEFORE phase 6 starts
            opacity = 1.0 - (scrollProgress - 0.82) / 0.04;
          } else {
            opacity = 0;
          }
          phase5Container.style.opacity = Math.max(0, Math.min(1, opacity)).toString();

          if (opacity > 0.7) {
            stage().reveal("phase5-title-1");
            stage().reveal("phase5-title-2");
          }
        } else {
          phase5Container.style.opacity = "0";
        }
      }

      // Animate the Phase 6 text container (Final Scene)
      if (phase6Container) {
        if (scrollProgress >= 0.86) {
          // Fade in across the final stretch so the finale breathes
          const opacity = (scrollProgress - 0.86) / 0.14;
          const boundedOpacity = Math.max(0, Math.min(1, opacity));
          phase6Container.style.opacity = boundedOpacity.toString();

          // Slide up the footer instead of fading (fixes Chrome backdrop-filter bugs)
          const easeOutFooter = 1.0 - Math.pow(1.0 - boundedOpacity, 3);
          const footerY = 100 * (1 - easeOutFooter);
          if (phase6Footer) phase6Footer.style.transform = `translateY(${footerY}vh)`;

          // Slight scale-up for dramatic effect
          const scale = 0.95 + 0.05 * boundedOpacity;
          phase6Container.style.transform = `scale(${scale})`;

          if (boundedOpacity > 0.7) stage().reveal("phase6-title");
        } else {
          phase6Container.style.opacity = "0";
          if (phase6Footer) phase6Footer.style.transform = `translateY(100vh)`;
        }
      }
    }

    // Move camera and target X to -0.6 (model's exact center)
    // Move camera and target Y lower to vertically center the model
    const targetCamX = THREE.MathUtils.lerp(frame.heroX, -0.6, transitionProgress);
    const targetFocusX = THREE.MathUtils.lerp(frame.heroX, -0.6, transitionProgress);

    const targetCamY = THREE.MathUtils.lerp(-1.0, -2.0, transitionProgress);
    const targetFocusY = THREE.MathUtils.lerp(0.5, -2.0, transitionProgress);

    // In Phase 3, zoom in. In Phase 5, fly deep into the logo!
    const phase3CamZ = THREE.MathUtils.lerp(7.5, 7.15, phase3Progress);
    const targetCamZ = THREE.MathUtils.lerp(6.5 + frame.heroBack, phase3CamZ, transitionProgress);
    const finalCamZ = THREE.MathUtils.lerp(targetCamZ, 0.5, phase5Progress); // Deep push forward

    const lerpSpeed = delta * 6.0;

    // --- PRELOADER ANIMATION LOGIC ---
    if (!preloaderDone) {
      if (preloaderCurrentPercent < preloaderTargetPercent) {
        preloaderCurrentPercent += delta * 180; // roll speed between steps
        if (preloaderCurrentPercent > preloaderTargetPercent) preloaderCurrentPercent = preloaderTargetPercent;

        if (odoNumbers) {
          odoNumbers.style.transform = `translateY(-${preloaderCurrentPercent * 4}rem)`;
        }
      }

      // When hit 100%, start shatter
      if (preloaderCurrentPercent >= 100) {
        // The figure starts emerging as the blob bursts (owner-approved,
        // ADR-0033) — the shipped page waited for the burst to end + 0.5 s.
        if (!revealing) {
          revealing = true;
          if (mainModel) mainModel.visible = true;
        }
        preloaderShatter += delta * 2.0; // Shatter timer (~0.5s)

        // Ease-in cubic: expands slowly at first, then accelerates rapidly outwards!
        const easeInShatter = Math.pow(preloaderShatter, 3.0);
        preloaderPointsMat.uniforms.uShatter.value = easeInShatter;

        if (preloaderShatter > 1.0) {
          preloaderDone = true;
          preloaderPoints.visible = false;

          // Reveal content: the model here; the preloader fade, the hero chrome
          // and the hero title's stagger are springs listening to the stage.
          if (mainModel) mainModel.visible = true;
          stage().finishPreloader();
        }
      }

      // Prevent scrolling while preloader is active!
      window.scrollTo(0, 0);
      scrollProgress = 0;
    }

    // Apply with smooth inertia and snapping
    camera.position.x = snapLerp(camera.position.x, targetCamX, lerpSpeed);
    camera.position.y = snapLerp(camera.position.y, targetCamY, lerpSpeed);
    camera.position.z = snapLerp(camera.position.z, finalCamZ, lerpSpeed);
    controls.target.x = snapLerp(controls.target.x, targetFocusX, lerpSpeed);
    controls.target.y = snapLerp(controls.target.y, targetFocusY, lerpSpeed);

    // Cinematic Scroll Transition for Model
    if (mainModel) {
      // Interpolate model position using the fast transitionProgress
      const baseModelX = THREE.MathUtils.lerp(-0.6, -0.5, transitionProgress);
      const baseModelY = THREE.MathUtils.lerp(-3.93, -6.15, transitionProgress);
      const baseModelZ = THREE.MathUtils.lerp(4.17, 7.0, transitionProgress);

      // In Phase 4, lerp to the exact GUI settings so the user can test visually
      const targetModelX = THREE.MathUtils.lerp(baseModelX, P4.phase4X, phase4Progress);
      const targetModelY = THREE.MathUtils.lerp(baseModelY, P4.phase4Y, phase4Progress);
      const targetModelZ = THREE.MathUtils.lerp(baseModelZ, P4.phase4Z, phase4Progress);

      // Model Fly-In: We want the model to snap exactly to its center at the very end
      const p6Ease = 1.0 - Math.pow(1.0 - modelFlyInProgress, 3);

      // Lowered final Y to -5.2 as requested, shifted slightly to -0.4
      const p6ModelX = THREE.MathUtils.lerp(targetModelX, -0.4, p6Ease);
      const p6ModelY = THREE.MathUtils.lerp(targetModelY, -5.2, p6Ease);
      const p6ModelZ = THREE.MathUtils.lerp(targetModelZ, -1.0, p6Ease);

      // Mouse Interactive Rotation for the Model (subtler than the logo)
      const pointerX = targetMouse.x * 2 - 1;
      const pointerY = targetMouse.y * 2 - 1;
      const mouseRotX = pointerY * 0.05; // Less vertical tilt
      const mouseRotY = pointerX * 0.1; // Less horizontal turn

      // Interpolate model rotation
      // Rotate counter-clockwise starting from 0.15, ending exactly at 0.55!
      const rotProgress = Math.max(0, Math.min(1.0, (scrollProgress - 0.12) / 0.28));

      const targetModelRotX = THREE.MathUtils.lerp(-0.05026, -0.2, transitionProgress);
      const finalRotX = THREE.MathUtils.lerp(targetModelRotX, P4.phase4RotX, phase4Progress);
      const p6RotX = THREE.MathUtils.lerp(finalRotX, 0.0 + mouseRotX, p6Ease);

      // Rotate 180 degrees (Math.PI) during the initial scroll (0 to 0.15) while moving down
      const initialRotY = -0.92781;
      const transitionRotY = THREE.MathUtils.lerp(initialRotY, initialRotY + Math.PI, transitionProgress);
      // Then continue spinning seamlessly from that point to a full circle during rotProgress
      const baseRotY = THREE.MathUtils.lerp(transitionRotY, Math.PI * 2, rotProgress);
      const finalRotY = THREE.MathUtils.lerp(baseRotY, P4.phase4RotY, phase4Progress);
      const p6RotY = THREE.MathUtils.lerp(finalRotY, 0.0 + mouseRotY, p6Ease);

      const targetModelRotZ = THREE.MathUtils.lerp(-0.12566, 0.0, transitionProgress);
      const finalRotZ = THREE.MathUtils.lerp(targetModelRotZ, P4.phase4RotZ, phase4Progress);
      const p6RotZ = THREE.MathUtils.lerp(finalRotZ, 0.0, p6Ease);

      mainModel.position.x = snapLerp(mainModel.position.x, p6ModelX, lerpSpeed);
      mainModel.position.y = snapLerp(mainModel.position.y, p6ModelY, lerpSpeed);
      mainModel.position.z = snapLerp(mainModel.position.z, p6ModelZ, lerpSpeed);

      mainModel.rotation.x = snapLerp(mainModel.rotation.x, p6RotX, lerpSpeed);
      mainModel.rotation.y = snapLerp(mainModel.rotation.y, p6RotY, lerpSpeed);
      mainModel.rotation.z = snapLerp(mainModel.rotation.z, p6RotZ, lerpSpeed);

      // Phase 4: Model scales down to GUI setting
      const baseScale = baseModelScale || 1.0;
      const finalScale = baseScale * P4.phase4Scale;
      const targetScale = THREE.MathUtils.lerp(baseScale, finalScale, phase4Progress);
      if (!currentModelScale) currentModelScale = baseScale;
      currentModelScale = snapLerp(currentModelScale, targetScale, lerpSpeed);
      mainModel.scale.set(currentModelScale, currentModelScale, currentModelScale);

      // Phase 5: Fade out the model, Phase 6: Fade back in!
      if (mainModelMaterial) {
        let targetOpacity = 0.95;
        if (modelFlyInProgress > 0) {
          // Fade in rapidly during the first half of Phase 6
          targetOpacity = THREE.MathUtils.lerp(0.0, 0.95, Math.min(1.0, modelFlyInProgress * 2.0));
        } else if (phase5Progress > 0) {
          // Fade out rapidly during the first half of Phase 5
          targetOpacity = THREE.MathUtils.lerp(0.95, 0.0, Math.min(1.0, phase5Progress * 2.0));
        }
        mainModelMaterial.opacity = targetOpacity;
      }

      // Keep the intro reveal centered on the model's real screen position. getWorldPosition forces a
      // world-matrix update, project() maps it to NDC, then we convert into the shader's aspect-corrected
      // screenUv space so the reveal circle always grows from the model — even if it moves mid-reveal.
      if (shaderUniforms.uRevealProgress.value < 0.999) {
        mainModel.getWorldPosition(_revealVec);
        _revealVec.project(camera);
        shaderUniforms.uRevealOrigin.value.set(
          (_revealVec.x * 0.5 + 0.5) * (view.w / view.h),
          _revealVec.y * 0.5 + 0.5,
        );
      }
    }

    // Phase 5: Assemble Logo Particles via GPU
    if (logoParticles) {
      const u = logoParticles.material.uniforms;
      if (phase5Progress > 0) {
        logoParticles.visible = true;

        let targetProgress = phase5Progress;
        let targetFade = 0.0;

        // Phase 6: Logo shatters and fades out
        if (logoShatterProgress > 0) {
          // Use smoothstep for the master timeline
          const explodeEase = THREE.MathUtils.smoothstep(logoShatterProgress, 0.0, 1.0);

          // The vertex shader uses a pow(..., 4.0) curve for assembling the particles so they snap into place.
          // When played backwards linearly, it causes them to stay assembled too long and then violently explode at the end.
          // Taking the 0.3 power of the ease counteracts the shader's pow(4) curve,
          // making the explosion smooth and gradual across the entire scroll range.
          targetProgress = 1.0 - Math.pow(explodeEase, 0.3);

          targetFade = 0.0; // KEEP THEM VISIBLE! Never fade out!
        }

        // Smoothly animate the progress uniform instead of snapping instantly
        u.uProgress.value = snapLerp(u.uProgress.value, targetProgress, lerpSpeed * 1.5);

        // Update fade out uniform
        u.uShatterFade.value = snapLerp(u.uShatterFade.value, targetFade, lerpSpeed * 1.5);

        // Rotate logo based on mouse cursor (scaled by phase5Progress so it only fully rotates when assembled)
        const pointerX = targetMouse.x * 2 - 1;
        const pointerY = targetMouse.y * 2 - 1;

        const targetRotX = pointerY * 0.15 * phase5Progress; // Slight vertical tilt
        const targetRotY = pointerX * 0.25 * phase5Progress; // Slight horizontal turn

        logoParticles.rotation.x = snapLerp(logoParticles.rotation.x, targetRotX, lerpSpeed);
        logoParticles.rotation.y = snapLerp(logoParticles.rotation.y, targetRotY, lerpSpeed);

        // Phase 6: Logo scales up by an additional 20% (Total 40% -> 1.4)
        // Uses the exact same p6Ease curve as the model
        const p6Ease = THREE.MathUtils.smoothstep(modelFlyInProgress, 0.0, 1.0);
        const targetScale = THREE.MathUtils.lerp(1.0, 1.4, p6Ease) * responsiveScale;

        // Apply the same snapLerp damping as the model so they move at the exact same physical speed
        const currentScale = logoParticles.scale.x;
        const smoothScale = snapLerp(currentScale, targetScale, lerpSpeed);
        logoParticles.scale.set(smoothScale, smoothScale, smoothScale);
        u.uScale.value = smoothScale;
      } else {
        logoParticles.visible = false;
        u.uProgress.value = 0.0;
        logoParticles.rotation.x = 0;
        logoParticles.rotation.y = 0;
        logoParticles.scale.set(1, 1, 1);
        u.uScale.value = 1.0;
      }
    }

    // Update HTML Flying Words
    // Compressed timeline so all words finish exactly by 0.55
    if (mobile) {
      updateWordSimple(word1, scrollProgress, 0.14, 0.26);
      updateWordSimple(word2, scrollProgress, 0.22, 0.34);
      updateWordSimple(word3, scrollProgress, 0.3, 0.4, true);
    } else {
      updateWordAnimation(word1, scrollProgress, 0.14, 0.26);
      updateWordAnimation(word2, scrollProgress, 0.22, 0.34);
      updateWordAnimation(word3, scrollProgress, 0.3, 0.4, true);
    }

    // Phase 3 & 4 Final Transitions: Slide glass container
    if (glassContainer && !mobile) {
      if (scrollProgress <= 0.54) {
        const easeIn = phase3Progress * phase3Progress; // Accelerate upwards matching word3
        const glassY = 100 - easeIn * 100;
        glassContainer.style.transform = `translateY(${glassY}vh)`;
        if (glassY < 60) stage().reveal("phase3-title");

        if (glassGradient) {
          // Animate scale from 0.65 to 1, and border-radius from 0 to 24px
          const currentScale = 0.65 + 0.35 * phase3Progress;
          glassGradient.style.transform = `translate(-50%, -50%) scale(${currentScale})`;
          glassGradient.style.borderRadius = `${phase3Progress * 24}px`;
        }
      } else {
        // Phase 4: Glass leaves out the top
        const easeOut = 1 - Math.pow(1 - phase4Progress, 3); // Smooth departure
        // 연결 시안: 원본은 -100vh. 휴대폰에서는 보이는 창 높이(innerHeight)가 100vh 보다 커서(주소창)
        // 유리 패널 아래 띠가 화면 위에 남았다 — 같은 움직임을 실제 창 높이만큼 올린다(데스크톱은 같은 값).
        const glassY = -(easeOut * Math.max(window.innerHeight, view.h));
        glassContainer.style.transform = `translateY(${glassY}px)`;

        if (glassGradient) {
          glassGradient.style.transform = `translate(-50%, -50%) scale(1)`;
          glassGradient.style.borderRadius = `24px`;
        }
      }
    }

    if (mixer) {
      mixer.update(ambientDelta);
    }

    // Animate the spectacular reveal (slower and smoother)
    // Only start the reveal AFTER the preloader finishes scattering!
    if (revealing && mainModel && shaderUniforms.uRevealProgress.value < 0.999) {
      if (!revealStartTime) {
        // Starts with the blob's burst (the shipped page: 0.5 s after it ended).
        revealStartTime = shaderUniforms.time.value;
      }
      const elapsed = shaderUniforms.time.value - revealStartTime;

      if (elapsed > 0) {
        // Exactly 2.3 seconds to match the total text stagger duration
        const progress = Math.min(1.0, elapsed / 2.3);

        // Cubic ease out for perfectly smooth deceleration
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        shaderUniforms.uRevealProgress.value = easeOutCubic;
      }
    }

    controls.update();

    rendererBg.render(bgScene, camera);
    renderer.render(scene, camera);
  }

  // The gradient's and the loader blob's programs, compiled off the main
  // thread before the first frame — drawn first, they linked synchronously
  // inside it. A frame or two later, under the odometer's opening beat.
  await Promise.allSettled([rendererBg.compileAsync(bgScene, camera), renderer.compileAsync(scene, camera)]);
  animate();

  return () => {
    disposed = true;
    cancelAnimationFrame(rafId);
    stageObserver?.disconnect();
    timers.forEach((t) => window.clearTimeout(t));
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("resize", onResize);
    controls.dispose();
    dracoLoader.dispose();
    mixer?.stopAllAction();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    bgGeo.dispose();
    bgMat.dispose();
    rendererBg.dispose();
    renderer.dispose();
  };
}
