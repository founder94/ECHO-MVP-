/**
 * Planet — 대표 전달 효과(2026-10-10, planet.html · three 0.143). 아래에서 떠오르는 지구 · 구름 3겹 · 낮과 밤 · 도시 불빛 ·
 * 바다 반짝임 · 대기 빛 · 땅 위 신호 고리 · 별. CONFIG · 셰이더는 원본 그대로. 공통 파이프라인과 [통합] 변경은 house.ts 머리말.
 * 앱 자리: 아직 보여 드릴 사람이 없을 때(잠든 사이 기다림).
 *
 * 이 장면만의 [통합] 변경:
 *   [통합] 모형: 원본 planet.glb · planet-lights.glb 는 Draco 압축이라 해제기를 gstatic 에서 받는다. 우리 앱 보안 규칙(CSP: 스크립트·연결은 우리 주소만)
 *          에서는 막히므로, 같은 모형을 압축만 푼 파일(public/doit/fx — 모양·텍스처 같음)로 바꿔 우리 주소에서 받는다. Draco 불러오기 0.
 *   [통합] 빛 세기 × π: three 0.155 부터 빛 단위가 물리 단위로 바뀌었다. 원본(옛 단위)과 같은 밝기가 되게 π 를 곱한다.
 *   [통합] 끌어 돌리기(OrbitControls) 끔: 원본 autoRotate 0 이라 카메라는 원래 가만히 있다. 앱 화면에서 끌기는 스크롤과 다투므로 뺀다.
 *   [통합] 신호 고리는 장식이다 — 실제 사람·위치와 무관(아래 글도 위치를 말하지 않는다).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { LAYERS, Lerp, SNOISE, createHouse, hexToVec3, type FxHandle, type FxPlay, type SceneImpl } from "./house";

export const PLANET_CONFIG = {
  rimColor: "#c1faff",
  rimPower: 2.4,
  nightLights: 10,
  terrainDepth: 0.33,
  terrainShade: 1.3,
  oceanGlint: 0.45,
  oceanDeep: 0.12,
  oceanFlow: 3,
  oceanFlowSpeed: 0.8,
  oceanFlowScale: 2.1,
  glowColor: "#3a6cff",
  glowIntensity: 3.35,
  planetRadius: 1.95,
  spin: 0.03,
  initRotation: 2.07,
  tilt: 0.37,
  autoRotate: 0,
  cloud1Height: 1.005,
  cloud1Opacity: 0.6,
  cloud1Spin: 0.06,
  cloud2Height: 1.03,
  cloud2Opacity: 0.5,
  cloud2Spin: 0.14,
  cloud3Height: 1.075,
  cloud3Opacity: 0.5,
  cloud3Spin: 0.1,
  bgColor: "#040a1e",
  flameColor: "#3a6cff",
  flameColor2: "#c1faff",
  flameAmt: 0.15,
  atmoColor: "#9fc4ff",
  atmoCount: 320,
  atmoSize: 22,
  atmoSpeed: 0.8,
  starColor: "#cfe0ff",
  starCount: 1400,
  starSize: 1.6,
  starFlicker: 1,
  markerColor: "#ffd27a",
  markerCount: 60,
  markerSize: 16,
  markerSpeed: 0.5,
};
const CONFIG = PLANET_CONFIG;
const ASSET = "/doit/fx";

const PLANET_INJECT = `#include <dithering_fragment>
      // --- atmospheric rim (Fresnel) ---
      vec3 normalizedNormal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      float rim = 1.0 - max(dot(viewDir, normalizedNormal), 0.0);
      rim = pow(rim, rimPower); rim = pow(rim, 1.5); rim *= 0.7;
      // --- ocean detection + water look ---
      vec3 currentColor = gl_FragColor.rgb;
      float blueDom = currentColor.b - max(currentColor.r, currentColor.g);
      float waterMask = clamp(smoothstep(-0.005, 0.03, blueDom), 0.0, 1.0);
      // large-scale surface shimmer (kept from the original water effect)
      float shimmer = snoise(vec3(vCustomUv.x * noiseScale + time * speedX, vCustomUv.y * noiseScale - time * speedY, time * speedZ));
      gl_FragColor.rgb += waterMask * shimmer * 0.025;
      // flowing water — domain-warped noise so the whole ocean visibly moves
      float fT = time * oceanFlowSpeed * 4.0;
      float fS = 4.0 * oceanFlowScale;
      float warp = snoise(vec3(vCustomUv.x * fS - fT * 0.5, vCustomUv.y * fS + fT * 0.4, fT * 0.5));
      float flow = snoise(vec3(vCustomUv.x * fS * 2.0 + fT * 0.6 + warp, vCustomUv.y * fS * 2.0 - fT * 0.5, fT * 0.7));
      flow = warp * 0.6 + flow * 0.4;
      gl_FragColor.rgb += waterMask * flow * 0.12 * oceanFlow;
      // deepen the open ocean toward a richer sea blue so it reads as water, not paint
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.01, 0.06, 0.16), waterMask * oceanDeep);
      vec3 finalColor = mix(gl_FragColor.rgb, rimColor, rim);
      gl_FragColor = vec4(finalColor, 1.0);
      // --- terrain relief (derivative bump from the day-map luminance) ---
      vec3 surfPos = -vViewPosition;
      float terrH = dot(texture2D(map, vCustomUv).rgb, vec3(0.299, 0.587, 0.114));
      vec3 sigX = dFdx(surfPos), sigY = dFdy(surfPos);
      vec3 vR1 = cross(sigY, normalizedNormal), vR2 = cross(normalizedNormal, sigX);
      float fDet = dot(sigX, vR1);
      vec3 vGrad = sign(fDet) * (dFdx(terrH) * vR1 + dFdy(terrH) * vR2);
      vec3 bumpedNormal = normalize(abs(fDet) * normalizedNormal - terrainDepth * vGrad);
      vec3 shadeNormal = mix(bumpedNormal, normalizedNormal, waterMask);
      // --- day/night terminator in VIEW space (matches the reference) ---
      vec3 cityLights = texture2D(nightBlendTexture, vCustomUv).rgb * gl_FragColor.rgb * nightLights;
      vec3 viewSunDir = normalize(vec3(-0.9, 0.18, 0.4));
      float ndl = dot(normalizedNormal, viewSunDir);   // smooth geometric terminator: >0 day, <0 night
      float dayAmt = smoothstep(-0.05, 0.35, ndl);
      float relief = dot(shadeNormal, viewSunDir) - ndl;
      gl_FragColor.rgb *= clamp(1.0 + relief * terrainShade * dayAmt, 0.55, 1.6);
      float nightFactor  = smoothstep(0.18, -0.30, ndl);
      float lightsFactor = smoothstep(0.30, -0.35, ndl);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.08, nightFactor);
      gl_FragColor.rgb += cityLights * lightsFactor;
      // --- ocean sun glint (specular) ---
      vec3 halfDir = normalize(viewSunDir + viewDir);
      float ripple = snoise(vec3(vCustomUv * 240.0, time * 4.0));
      float ndh = max(dot(normalizedNormal, halfDir) + ripple * 0.02, 0.0);
      float glint = pow(ndh, 140.0);
      gl_FragColor.rgb += glint * waterMask * dayAmt * oceanGlint * vec3(1.0, 0.97, 0.88);
    `;

const CLOUD_INJECT = `#include <dithering_fragment>
        gl_FragColor.rgb = vec3(1.0);
        float cloudNoise = snoise(vec3(vCloudUv.x * noiseScale + uTime * uSpeedX + uPhase, vCloudUv.y * noiseScale - uTime * uSpeedY + uPhase, uTime * uSpeedZ + uPhase));
        float cloudNdv = max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0);
        float cloudEdge = pow(1.0 - cloudNdv, 3.0);          // ~0 across the disc, ->1 at the limb
        float cloudMod = mix(cloudNoise, 1.0, cloudEdge);
        // dim clouds on the view-space night side (same fixed sun as the globe)
        float cloudNdl = dot(normalize(vNormal), normalize(vec3(-0.9, 0.18, 0.4)));
        float cloudDay = 1.0 - smoothstep(0.30, -0.30, cloudNdl) * 0.9;
        gl_FragColor.a *= cloudMod * uOpacity * cloudDay;
      `;

const CLOUD_LAYERS = [
  { h: CONFIG.cloud1Height, o: CONFIG.cloud1Opacity, s: CONFIG.cloud1Spin, ry: 0.0, phase: 0.0 },
  { h: CONFIG.cloud2Height, o: CONFIG.cloud2Opacity, s: CONFIG.cloud2Spin, ry: 2.2, phase: 13.0 },
  { h: CONFIG.cloud3Height, o: CONFIG.cloud3Opacity, s: CONFIG.cloud3Spin, ry: 4.3, phase: 27.0 },
];

function firstMesh(obj: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  obj.traverse((o) => { if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh; });
  return found;
}

export function createPlanet(canvas: HTMLCanvasElement, host: HTMLElement, opts: { play: FxPlay; onReady?: () => void; onFail?: () => void }): FxHandle | null {
  return createHouse(canvas, host, {
    bgColor: CONFIG.bgColor, flameColor: CONFIG.flameColor, flameColor2: CONFIG.flameColor2, flameAmt: CONFIG.flameAmt,
    atmoColor: CONFIG.atmoColor, atmoCount: CONFIG.atmoCount, atmoSize: CONFIG.atmoSize, atmoSpeed: CONFIG.atmoSpeed, atmoAlpha: 0.55,
    bloom: [0.5, 0.6], fov: 40, near: 0.1, far: 200, camZ: 8, fog: false, outputSRGB: true,
  }, (ctx): SceneImpl => {
    const { scene, camera, dpr, size } = ctx;
    const disposables: { dispose: () => void }[] = [];
    let disposed = false;

    // Lights must live on the ENTIRE_SCENE layer — 원본. [통합] × π (옛 빛 단위와 같은 밝기)
    const ambient = new THREE.AmbientLight(0xffffff, 1.8 * Math.PI); ambient.layers.enable(LAYERS.ENTIRE_SCENE); scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 0.8 * Math.PI); sun.position.set(0, 10, 2); sun.layers.enable(LAYERS.ENTIRE_SCENE); scene.add(sun);

    const planetGroup = new THREE.Group(); planetGroup.rotation.z = CONFIG.tilt; scene.add(planetGroup);
    const cloudGroup = new THREE.Group(); cloudGroup.rotation.z = CONFIG.tilt; cloudGroup.visible = false; scene.add(cloudGroup);
    const planetTime = { value: 0 };
    const cloudTime = { value: 0 };
    const starTime = { value: 0 };
    const markerTime = { value: 0 };
    let glowMesh: THREE.Mesh | null = null;
    let spinPhase = 0;
    let entryActive = false;
    let entryT = 0;
    let loaded = false;
    let loadFailed = false; // [통합] 모형 404·끊김·깨짐 → 은은한 빛으로(투명 칸 + GPU 계속 돌기 0)
    const fail = () => { if (!disposed) loadFailed = true; };
    // 느린 망에서 모형이 끝내 안 오면(15초) 실패와 같게 → 반복 멈춤 + 은은한 빛(빈 칸이 계속 GPU 를 쓰지 않게)
    const LOAD_TIMEOUT_MS = 15_000;
    const loadTimer = setTimeout(() => { if (!loaded) fail(); }, LOAD_TIMEOUT_MS);
    const ENTRY_DUR = 1.9;
    const ENTRY_START_Y = -6.5;
    const res = () => { const { w, h } = size(); return new THREE.Vector2(w * dpr, h * dpr); };
    const resUniforms: { value: THREE.Vector2 }[] = [];

    /* clouds — 원본 그대로 */
    const cloudTex = new THREE.TextureLoader().load(`${ASSET}/planet-clouds.png`);
    cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;
    cloudTex.repeat.set(5, 5);
    disposables.push(cloudTex);
    const cloudMeshes: { mesh: THREE.Mesh; spin: number; phase: number }[] = [];
    for (const layer of CLOUD_LAYERS) {
      const g = new THREE.SphereGeometry(CONFIG.planetRadius * layer.h, 64, 64);
      const mat = new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, depthWrite: false });
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = cloudTime;
        shader.uniforms.noiseScale = { value: 20.0 };
        shader.uniforms.uSpeedX = { value: 1.0 };
        shader.uniforms.uSpeedY = { value: 2.0 };
        shader.uniforms.uSpeedZ = { value: 2.0 };
        shader.uniforms.uOpacity = { value: layer.o };
        shader.uniforms.uPhase = { value: layer.phase };
        shader.vertexShader = `varying vec2 vCloudUv;\n` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("void main() {", "void main() {\n  vCloudUv = uv;");
        shader.fragmentShader = `
        uniform float uTime; uniform float noiseScale; uniform float uSpeedX; uniform float uSpeedY; uniform float uSpeedZ; uniform float uOpacity; uniform float uPhase;
        varying vec2 vCloudUv;
        ${SNOISE}
      ` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace("#include <dithering_fragment>", CLOUD_INJECT);
      };
      mat.needsUpdate = true;
      const clouds = new THREE.Mesh(g, mat);
      clouds.rotation.y = layer.ry;
      clouds.renderOrder = 2;
      clouds.layers.enable(LAYERS.ENTIRE_SCENE);
      cloudGroup.add(clouds);
      cloudMeshes.push({ mesh: clouds, spin: layer.s, phase: layer.ry });
      disposables.push(g, mat);
    }

    /* starfield — 원본 그대로 */
    {
      const COUNT = Math.max(0, Math.floor(CONFIG.starCount));
      const R = 90;
      const pos = new Float32Array(COUNT * 3), seed = new Float32Array(COUNT), bright = new Float32Array(COUNT);
      for (let i = 0; i < COUNT; i++) {
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        pos[i * 3] = R * r * Math.cos(th); pos[i * 3 + 1] = R * u; pos[i * 3 + 2] = R * r * Math.sin(th);
        seed[i] = Math.random() * 6.2831853;
        bright[i] = 0.35 + Math.random() * 0.65;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("seed", new THREE.Float32BufferAttribute(seed, 1));
      geo.setAttribute("bright", new THREE.Float32BufferAttribute(bright, 1));
      const uRes = { value: res() }; resUniforms.push(uRes);
      const starMat = new THREE.ShaderMaterial({
        uniforms: { uTime: starTime, uSize: { value: CONFIG.starSize }, uFlicker: { value: CONFIG.starFlicker }, uColor: { value: hexToVec3(CONFIG.starColor) }, uRes },
        vertexShader: `
      attribute float seed; attribute float bright;
      uniform float uTime; uniform float uSize; uniform float uFlicker; uniform vec2 uRes;
      varying float vTw;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.6 + 0.4 * sin(uTime * uFlicker + seed);   // smooth twinkle, never fully off
        vTw = bright * tw;
        gl_PointSize = max(uSize * uRes.y / 900.0 * (90.0 / max(-mv.z, 1.0)), 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
        fragmentShader: `
      uniform vec3 uColor; varying float vTw;
      void main(){
        vec2 p = gl_PointCoord - 0.5; float l = length(p); if (l > 0.5) discard;
        float core = smoothstep(0.5, 0.0, l);                  // soft round star
        gl_FragColor = vec4(uColor, core * vTw);
      }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
      });
      const stars = new THREE.Points(geo, starMat);
      stars.frustumCulled = false;
      stars.layers.enable(LAYERS.ENTIRE_SCENE);
      scene.add(stars);
      disposables.push(geo, starMat);
    }

    const applyPlanetShader = (material: THREE.MeshStandardMaterial, nightTex: THREE.Texture | null) => {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.time = planetTime;
        shader.uniforms.noiseScale = { value: 30.0 };
        shader.uniforms.speedX = { value: 1.5 };
        shader.uniforms.speedY = { value: 2.0 };
        shader.uniforms.speedZ = { value: 2.5 };
        shader.uniforms.rimColor = { value: hexToVec3(CONFIG.rimColor) };
        shader.uniforms.rimPower = { value: CONFIG.rimPower };
        shader.uniforms.nightBlendTexture = { value: nightTex };
        shader.uniforms.nightLights = { value: CONFIG.nightLights };
        shader.uniforms.terrainDepth = { value: CONFIG.terrainDepth };
        shader.uniforms.terrainShade = { value: CONFIG.terrainShade };
        shader.uniforms.oceanGlint = { value: CONFIG.oceanGlint };
        shader.uniforms.oceanDeep = { value: CONFIG.oceanDeep };
        shader.uniforms.oceanFlow = { value: CONFIG.oceanFlow };
        shader.uniforms.oceanFlowSpeed = { value: CONFIG.oceanFlowSpeed };
        shader.uniforms.oceanFlowScale = { value: CONFIG.oceanFlowScale };
        shader.vertexShader = `varying vec2 vCustomUv;\n` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("void main() {", "void main() {\n  vCustomUv = uv;");
        shader.fragmentShader = `
      uniform float time; uniform float noiseScale; uniform float speedX; uniform float speedY; uniform float speedZ;
      uniform vec3 rimColor; uniform float rimPower; uniform sampler2D nightBlendTexture; uniform float nightLights;
      uniform float terrainDepth; uniform float terrainShade;
      uniform float oceanGlint; uniform float oceanDeep; uniform float oceanFlow;
      uniform float oceanFlowSpeed; uniform float oceanFlowScale;
      varying vec2 vCustomUv;
      ${SNOISE}
    ` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace("#include <dithering_fragment>", PLANET_INJECT);
      };
      material.needsUpdate = true;
    };

    const addAtmosphereGlow = (radius: number) => {
      const g = new THREE.PlaneGeometry(2, 2);
      const glowMat = new THREE.ShaderMaterial({
        transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uGlow: { value: hexToVec3(CONFIG.glowColor) }, uIntensity: { value: CONFIG.glowIntensity } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uGlow; uniform float uIntensity; varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;           // 0 centre -> 1 disc edge
        float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2); // soft outward falloff
        gl_FragColor = vec4(uGlow * a * uIntensity, a);
      }`,
      });
      glowMesh = new THREE.Mesh(g, glowMat);
      glowMesh.scale.setScalar(radius * 2.3);
      glowMesh.layers.enable(LAYERS.ENTIRE_SCENE);
      scene.add(glowMesh);
      disposables.push(g, glowMat);
    };

    const addMarkers = (planetMesh: THREE.Mesh, planetMat: THREE.MeshStandardMaterial) => {
      const tex = planetMat.map;
      const img = tex?.image as (HTMLImageElement | ImageBitmap | HTMLCanvasElement) | undefined;
      if (!img) return;
      const W = Math.min(img.width || 1024, 1024), H = Math.min(img.height || 512, 512);
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const cctx = cv.getContext("2d");
      if (!cctx) return;
      cctx.drawImage(img, 0, 0, W, H);
      let px: Uint8ClampedArray;
      try { px = cctx.getImageData(0, 0, W, H).data; } catch { return; }
      const geom = planetMesh.geometry;
      const pos = geom.attributes.position, uv = geom.attributes.uv as THREE.BufferAttribute | undefined;
      if (!uv) return;
      const index = geom.index;
      const triCount = index ? index.count / 3 : pos.count / 3;
      const triIdx = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
      const cum = new Float32Array(triCount);
      const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
      let total = 0;
      for (let t = 0; t < triCount; t++) {
        A.fromBufferAttribute(pos, triIdx(t, 0)); B.fromBufferAttribute(pos, triIdx(t, 1)); C.fromBufferAttribute(pos, triIdx(t, 2));
        e1.subVectors(B, A); e2.subVectors(C, A);
        total += e1.cross(e2).length() * 0.5;
        cum[t] = total;
      }
      const pickTri = () => {
        const rnd = Math.random() * total;
        let lo = 0, hi = triCount - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < rnd) lo = m + 1; else hi = m; }
        return lo;
      };
      const want = Math.max(0, Math.floor(CONFIG.markerCount));
      const positions: number[] = [], seeds: number[] = [];
      const lift = 1.012;
      const uvA = new THREE.Vector2(), uvB = new THREE.Vector2(), uvC = new THREE.Vector2();
      let attempts = 0;
      const maxAtt = want * 400 + 2000;
      while (positions.length / 3 < want && attempts < maxAtt) {
        attempts++;
        const t = pickTri();
        const i0 = triIdx(t, 0), i1 = triIdx(t, 1), i2 = triIdx(t, 2);
        let r1 = Math.random(), r2 = Math.random();
        if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
        const w0 = 1 - r1 - r2, w1 = r1, w2 = r2;
        uvA.fromBufferAttribute(uv, i0); uvB.fromBufferAttribute(uv, i1); uvC.fromBufferAttribute(uv, i2);
        const u = uvA.x * w0 + uvB.x * w1 + uvC.x * w2;
        const vv = uvA.y * w0 + uvB.y * w1 + uvC.y * w2;
        const sx = Math.min(W - 1, Math.max(0, (u * W) | 0));
        const sy = Math.min(H - 1, Math.max(0, ((1 - vv) * H) | 0));
        const o = (sy * W + sx) * 4;
        const cr = px[o], cg = px[o + 1], cb = px[o + 2];
        if (cb > cr + 6 && cb > cg + 6) continue; // skip ocean (blue-dominant)
        A.fromBufferAttribute(pos, i0); B.fromBufferAttribute(pos, i1); C.fromBufferAttribute(pos, i2);
        positions.push((A.x * w0 + B.x * w1 + C.x * w2) * lift, (A.y * w0 + B.y * w1 + C.y * w2) * lift, (A.z * w0 + B.z * w1 + C.z * w2) * lift);
        seeds.push(Math.random());
      }
      if (!positions.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute("seed", new THREE.Float32BufferAttribute(seeds, 1));
      const uRes = { value: res() }; resUniforms.push(uRes);
      const markerMat = new THREE.ShaderMaterial({
        uniforms: { uTime: markerTime, uColor: { value: hexToVec3(CONFIG.markerColor) }, uSize: { value: CONFIG.markerSize }, uSpeed: { value: CONFIG.markerSpeed }, uRes },
        vertexShader: `
      attribute float seed; uniform float uSize; uniform vec2 uRes;
      varying float vSeed; varying float vFade;
      void main(){
        vSeed = seed;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 vn = normalize(normalMatrix * normalize(position));
        vec3 vd = normalize(-mv.xyz);
        vFade = smoothstep(0.15, 0.5, dot(vn, vd));
        gl_PointSize = max(uSize * uRes.y / 900.0 * (7.0 / max(-mv.z, 1.0)), 2.0);
        gl_Position = projectionMatrix * mv;
      }`,
        fragmentShader: `
      uniform vec3 uColor; uniform float uTime; uniform float uSpeed;
      varying float vSeed; varying float vFade;
      void main(){
        if (vFade <= 0.001) discard;
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p) * 2.0;                              // 0 centre .. 1 edge
        if (d > 1.0) discard;
        float core = smoothstep(0.30, 0.0, d) * 1.2;           // solid glowing dot
        float ph = fract(uTime * uSpeed + vSeed);              // radar-ping phase 0..1
        float ring = smoothstep(0.07, 0.0, abs(d - ph)) * (1.0 - ph);  // expanding, fading ring
        gl_FragColor = vec4(uColor, clamp(core + ring, 0.0, 1.0) * vFade);
      }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
      });
      const marks = new THREE.Points(g, markerMat);
      marks.frustumCulled = false;
      marks.layers.enable(LAYERS.ENTIRE_SCENE);
      planetMesh.add(marks);
      disposables.push(g, markerMat);
    };

    /* planet — [통합] 압축 푼 같은 모형을 우리 주소에서 */
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(`${ASSET}/planet-lights.glb`, (lights) => {
      if (disposed || loadFailed) return; // 시간 넘김 뒤 늦게 온 모형은 쓰지 않는다
      const lmesh = firstMesh(lights.scene);
      const lmat = lmesh?.material as THREE.MeshStandardMaterial | undefined;
      const nightTex = lmat?.map ?? null;
      if (nightTex) disposables.push(nightTex);
      gltfLoader.load(`${ASSET}/planet.glb`, (gltf) => {
        if (disposed || loadFailed) return;
        const mesh = firstMesh(gltf.scene);
        if (!mesh) { fail(); return; }
        mesh.geometry.computeBoundingSphere();
        const r = mesh.geometry.boundingSphere ? mesh.geometry.boundingSphere.radius : 1;
        const s = CONFIG.planetRadius / r;
        const planetMat = (mesh.material as THREE.MeshStandardMaterial).clone();
        planetMat.metalness = 0.0;
        planetMat.roughness = 1.0;
        planetMat.envMapIntensity = 0.0;
        applyPlanetShader(planetMat, nightTex);
        const planet = new THREE.Mesh(mesh.geometry, planetMat);
        planet.scale.setScalar(s);
        planet.layers.enable(LAYERS.ENTIRE_SCENE);
        planetGroup.add(planet);
        disposables.push(mesh.geometry, planetMat);
        if (planetMat.map) disposables.push(planetMat.map);
        addMarkers(planet, planetMat);
        addAtmosphereGlow(CONFIG.planetRadius);
        const gm = glowMesh as THREE.Mesh | null;
        planetGroup.position.y = ENTRY_START_Y;
        cloudGroup.position.y = ENTRY_START_Y;
        if (gm) gm.position.y = ENTRY_START_Y;
        cloudGroup.visible = true;
        entryActive = true; entryT = 0;
        loaded = true;
        clearTimeout(loadTimer);
      }, undefined, fail);
    }, undefined, fail);

    return {
      // 움직임: 모형이 오면 바로 보여 떠오르는 장면을 보이게(Codex #159 P2) · 한 장(still): 다 떠오른 자리에서만
      ready: () => loaded && (opts.play === "live" || !entryActive),
      failed: () => loadFailed,
      update: (_scroll, _now, dt, still) => {
        planetTime.value += dt / 12;
        cloudTime.value += dt / 20;
        starTime.value += dt;
        markerTime.value += dt;
        spinPhase += dt * CONFIG.spin;
        planetGroup.rotation.y = CONFIG.initRotation + spinPhase;
        for (const cl of cloudMeshes) { cl.phase += dt * cl.spin; cl.mesh.rotation.y = cl.phase; }
        if (entryActive) {
          // still(움직임 줄이기): 떠오르는 장면 없이 제자리에서 한 장
          entryT = still ? 1 : Math.min(1, entryT + dt / ENTRY_DUR);
          const e = 1 - Math.pow(1 - entryT, 3);
          const entryY = Lerp(ENTRY_START_Y, 0, e);
          planetGroup.position.y = entryY;
          cloudGroup.position.y = entryY;
          if (glowMesh) glowMesh.position.y = entryY;
          if (entryT >= 1) entryActive = false;
        }
        if (glowMesh) glowMesh.quaternion.copy(camera.quaternion);
      },
      resize: (w, h) => { for (const u of resUniforms) u.value.set(w * dpr, h * dpr); },
      dispose: () => { disposed = true; clearTimeout(loadTimer); for (const d of disposables) d.dispose(); },
    };
  }, { play: opts.play, interactive: false, onReady: opts.onReady, onFail: opts.onFail });
}
