/**
 * Glass Card Pinwheel — 대표 전달 효과(2026-10-10, glass-card-pinwheel.html · three 0.170). 그라데이션 유리판 7장이 바람개비처럼
 * 천천히 돌며 서로를 비춰 굴절시킨다. drei MeshTransmissionMaterial 이식(셰이더 @N8Programs)과 CONFIG · 카드 정의는 원본 그대로.
 * 앱 자리: 타로 해석을 기다리는 동안 — 「카드가 당신 쪽으로 돌아서는 중」.
 *
 * 원본에서 바꾼 것(「통합에 필요한 변경」 — 시각 값 변경 0). [통합] 표시.
 *   [통합] 번들 three 0.186(원본 0.170). 투명 굴절 셰이더 조각 이름(transmission_pars_fragment · transmission_fragment)과
 *          EnvironmentBRDF 는 0.186 에도 같다 — 브라우저 검사에서 셰이더 오류 0 확인.
 *   [통합] 크기: 창 전체 → 효과 영역. 포인터도 효과 영역 기준. 끌어 돌리기(OrbitControls) 끔 — 앱 화면에서 끌기는 스크롤과 다툰다
 *          (원본도 가만히 두면 카메라는 움직이지 않는다).
 *   [통합] 글꼴(Inter) 외부 불러오기 0 — 이 장면에 글자가 없다. 2.4초 서서히 나타나기는 CSS 대신 효과 영역의 투명도로 같게.
 *   [통합] 재생: 'live' / 'still'(움직임 줄이기 — 한 장) · 탭 숨김·화면 밖이면 멈춤 · dispose() 가 GPU 자원을 모두 푼다.
 */
import * as THREE from "three";
import type { FxHandle, FxPlay } from "./house";
import { clampPixelRatio, frameBudget, readTier } from "@/doit/flora/scene/device";

export const GLASS_CONFIG = {
  // glass (drei MeshTransmissionMaterial)
  samples: 5,
  resolution: 256,
  transmission: 0.94,
  roughness: 0.53,
  clearcoat: 0.55,
  clearcoatRoughness: 0.14,
  thickness: 0.9,
  ior: 1.36,
  chromaticAberration: 0.36,
  anisotropy: 0.4,
  distortion: 0.0,
  distortionScale: 0.3,
  temporalDistortion: 0.0,
  attenuationDistance: 4.0,
  attenuationColor: "#ffffff",
  // arrangement + motion
  radius: 1.95,
  spinSpeed: 0.06,
  floatAmp: 0.12,
  floatSpeed: 0.8,
  parallax: 0.35,
  parallaxEase: 0.06,
  // backdrop
  bgTop: "#f6f8fb",
  bgBottom: "#d7dce4",
};
const CONFIG = GLASS_CONFIG;

/* ====== MeshTransmissionMaterial (port of drei/core, shader by @N8Programs) — 원본 그대로 ====== */
function makeTransmissionMaterial(samples = 6, transmissionSampler = false) {
  const material: any = new THREE.MeshPhysicalMaterial();
  material.uniforms = {
    chromaticAberration: { value: 0.05 },
    transmission: { value: 0 },
    _transmission: { value: 1 },
    transmissionMap: { value: null },
    roughness: { value: 0 },
    thickness: { value: 0 },
    thicknessMap: { value: null },
    attenuationDistance: { value: Infinity },
    attenuationColor: { value: new THREE.Color("white") },
    anisotropicBlur: { value: 0.1 },
    time: { value: 0 },
    distortion: { value: 0.0 },
    distortionScale: { value: 0.5 },
    temporalDistortion: { value: 0.0 },
    buffer: { value: null },
  };

  material.onBeforeCompile = (shader: any) => {
    shader.uniforms = { ...shader.uniforms, ...material.uniforms }
    if (material.anisotropy > 0) shader.defines.USE_ANISOTROPY = ''
    if (transmissionSampler) shader.defines.USE_SAMPLER = ''
    else shader.defines.USE_TRANSMISSION = ''

    shader.fragmentShader =
      /* glsl */ `
      uniform float chromaticAberration;
      uniform float anisotropicBlur;
      uniform float time;
      uniform float distortion;
      uniform float distortionScale;
      uniform float temporalDistortion;
      uniform sampler2D buffer;

      vec3 random3(vec3 c) {
        float j = 4096.0*sin(dot(c,vec3(17.0, 59.4, 15.0)));
        vec3 r;
        r.z = fract(512.0*j);
        j *= .125;
        r.x = fract(512.0*j);
        j *= .125;
        r.y = fract(512.0*j);
        return r-0.5;
      }

      uint hash( uint x ) {
        x += ( x << 10u );
        x ^= ( x >>  6u );
        x += ( x <<  3u );
        x ^= ( x >> 11u );
        x += ( x << 15u );
        return x;
      }
      uint hash( uvec2 v ) { return hash( v.x ^ hash(v.y)                         ); }
      uint hash( uvec3 v ) { return hash( v.x ^ hash(v.y) ^ hash(v.z)             ); }
      uint hash( uvec4 v ) { return hash( v.x ^ hash(v.y) ^ hash(v.z) ^ hash(v.w) ); }

      float floatConstruct( uint m ) {
        const uint ieeeMantissa = 0x007FFFFFu;
        const uint ieeeOne      = 0x3F800000u;
        m &= ieeeMantissa;
        m |= ieeeOne;
        float  f = uintBitsToFloat( m );
        return f - 1.0;
      }

      float randomBase( float x ) { return floatConstruct(hash(floatBitsToUint(x))); }
      float randomBase( vec2  v ) { return floatConstruct(hash(floatBitsToUint(v))); }
      float randomBase( vec3  v ) { return floatConstruct(hash(floatBitsToUint(v))); }
      float randomBase( vec4  v ) { return floatConstruct(hash(floatBitsToUint(v))); }
      float rand(float seed) {
        float result = randomBase(vec3(gl_FragCoord.xy, seed));
        return result;
      }

      const float F3 =  0.3333333;
      const float G3 =  0.1666667;

      float snoise(vec3 p) {
        vec3 s = floor(p + dot(p, vec3(F3)));
        vec3 x = p - s + dot(s, vec3(G3));
        vec3 e = step(vec3(0.0), x - x.yzx);
        vec3 i1 = e*(1.0 - e.zxy);
        vec3 i2 = 1.0 - e.zxy*(1.0 - e);
        vec3 x1 = x - i1 + G3;
        vec3 x2 = x - i2 + 2.0*G3;
        vec3 x3 = x - 1.0 + 3.0*G3;
        vec4 w, d;
        w.x = dot(x, x);
        w.y = dot(x1, x1);
        w.z = dot(x2, x2);
        w.w = dot(x3, x3);
        w = max(0.6 - w, 0.0);
        d.x = dot(random3(s), x);
        d.y = dot(random3(s + i1), x1);
        d.z = dot(random3(s + i2), x2);
        d.w = dot(random3(s + 1.0), x3);
        w *= w;
        w *= w;
        d *= w;
        return dot(d, vec4(52.0));
      }

      float snoiseFractal(vec3 m) {
        return 0.5333333* snoise(m)
              +0.2666667* snoise(2.0*m)
              +0.1333333* snoise(4.0*m)
              +0.0666667* snoise(8.0*m);
      }\n` + shader.fragmentShader

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <transmission_pars_fragment>',
      /* glsl */ `
      #ifdef USE_TRANSMISSION
        uniform float _transmission;
        uniform float thickness;
        uniform float attenuationDistance;
        uniform vec3 attenuationColor;
        #ifdef USE_TRANSMISSIONMAP
          uniform sampler2D transmissionMap;
        #endif
        #ifdef USE_THICKNESSMAP
          uniform sampler2D thicknessMap;
        #endif
        uniform vec2 transmissionSamplerSize;
        uniform sampler2D transmissionSamplerMap;
        uniform mat4 modelMatrix;
        uniform mat4 projectionMatrix;
        varying vec3 vWorldPosition;
        vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
          vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
          vec3 modelScale;
          modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
          modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
          modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
          return normalize( refractionVector ) * thickness * modelScale;
        }
        float applyIorToRoughness( const in float roughness, const in float ior ) {
          return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
        }
        vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
          float framebufferLod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
          #ifdef USE_SAMPLER
            #ifdef texture2DLodEXT
              return texture2DLodEXT(transmissionSamplerMap, fragCoord.xy, framebufferLod);
            #else
              return texture2D(transmissionSamplerMap, fragCoord.xy, framebufferLod);
            #endif
          #else
            return texture2D(buffer, fragCoord.xy);
          #endif
        }
        vec3 applyVolumeAttenuation( const in vec3 radiance, const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
          if ( isinf( attenuationDistance ) ) {
            return radiance;
          } else {
            vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
            vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );
            return transmittance * radiance;
          }
        }
        vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
          const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
          const in mat4 viewMatrix, const in mat4 projMatrix, const in float ior, const in float thickness,
          const in vec3 attenuationColor, const in float attenuationDistance ) {
          vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
          vec3 refractedRayExit = position + transmissionRay;
          vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
          vec2 refractionCoords = ndcPos.xy / ndcPos.w;
          refractionCoords += 1.0;
          refractionCoords /= 2.0;
          vec4 transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
          vec3 attenuatedColor = applyVolumeAttenuation( transmittedLight.rgb, length( transmissionRay ), attenuationColor, attenuationDistance );
          vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
          return vec4( ( 1.0 - F ) * attenuatedColor * diffuseColor, transmittedLight.a );
        }
      #endif\n`
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <transmission_fragment>',
      /* glsl */ `
      material.transmission = _transmission;
      material.transmissionAlpha = 1.0;
      material.thickness = thickness;
      material.attenuationDistance = attenuationDistance;
      material.attenuationColor = attenuationColor;
      #ifdef USE_TRANSMISSIONMAP
        material.transmission *= texture2D( transmissionMap, vUv ).r;
      #endif
      #ifdef USE_THICKNESSMAP
        material.thickness *= texture2D( thicknessMap, vUv ).g;
      #endif

      vec3 pos = vWorldPosition;
      float runningSeed = 0.0;
      vec3 v = normalize( cameraPosition - pos );
      vec3 n = inverseTransformDirection( normal, viewMatrix );
      vec3 transmission = vec3(0.0);
      float transmissionR, transmissionB, transmissionG;
      float randomCoords = rand(runningSeed++);
      float thickness_smear = thickness * max(pow(roughnessFactor, 0.33), anisotropicBlur);
      vec3 distortionNormal = vec3(0.0);
      vec3 temporalOffset = vec3(time, -time, -time) * temporalDistortion;
      if (distortion > 0.0) {
        distortionNormal = distortion * vec3(snoiseFractal(vec3((pos * distortionScale + temporalOffset))), snoiseFractal(vec3(pos.zxy * distortionScale - temporalOffset)), snoiseFractal(vec3(pos.yxz * distortionScale + temporalOffset)));
      }
      for (float i = 0.0; i < ${samples}.0; i ++) {
        vec3 sampleNorm = normalize(n + roughnessFactor * roughnessFactor * 2.0 * normalize(vec3(rand(runningSeed++) - 0.5, rand(runningSeed++) - 0.5, rand(runningSeed++) - 0.5)) * pow(rand(runningSeed++), 0.33) + distortionNormal);
        transmissionR = getIBLVolumeRefraction(
          sampleNorm, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
          pos, modelMatrix, viewMatrix, projectionMatrix, material.ior, material.thickness  + thickness_smear * (i + randomCoords) / float(${samples}),
          material.attenuationColor, material.attenuationDistance
        ).r;
        transmissionG = getIBLVolumeRefraction(
          sampleNorm, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
          pos, modelMatrix, viewMatrix, projectionMatrix, material.ior  * (1.0 + chromaticAberration * (i + randomCoords) / float(${samples})) , material.thickness + thickness_smear * (i + randomCoords) / float(${samples}),
          material.attenuationColor, material.attenuationDistance
        ).g;
        transmissionB = getIBLVolumeRefraction(
          sampleNorm, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
          pos, modelMatrix, viewMatrix, projectionMatrix, material.ior * (1.0 + 2.0 * chromaticAberration * (i + randomCoords) / float(${samples})), material.thickness + thickness_smear * (i + randomCoords) / float(${samples}),
          material.attenuationColor, material.attenuationDistance
        ).b;
        transmission.r += transmissionR;
        transmission.g += transmissionG;
        transmission.b += transmissionB;
      }
      transmission /= ${samples}.0;
      totalDiffuse = mix( totalDiffuse, transmission.rgb, material.transmission );\n`
    )
  }

  // Mirror drei: expose each custom uniform as a live material property.
  Object.keys(material.uniforms).forEach((name) =>
    Object.defineProperty(material, name, {
      get: () => material.uniforms[name].value,
      set: (val) => (material.uniforms[name].value = val),
      configurable: true,
    }),
  );
  return material;
}

/* ====== soft studio backdrop (gradient + light blooms) — 원본 그대로 ====== */
function makeBackground(top: string, bottom: string) {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 1024;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 1024);
  const bloom = ctx.createRadialGradient(300, 200, 40, 300, 200, 620);
  bloom.addColorStop(0, "rgba(255,255,255,0.85)"); bloom.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = bloom; ctx.fillRect(0, 0, 1024, 1024);
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 30; ctx.lineCap = "round";
  for (const [x1, y1, x2, y2] of [[120, 60, 420, 240], [200, 120, 340, 380], [520, 40, 700, 180]]) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ====== environment: a small studio of lightformers baked to PMREM — 원본 그대로 ====== */
function buildEnvironment(renderer: THREE.WebGLRenderer) {
  const envScene = new THREE.Scene();
  const group = new THREE.Group();
  group.rotation.set(-Math.PI / 2, 0, 0);
  envScene.add(group);
  const rect = new THREE.PlaneGeometry(1, 1);
  const circle = new THREE.CircleGeometry(1, 64);
  const mats: THREE.Material[] = [];
  const add = (geo: THREE.BufferGeometry, intensity: number, pos: [number, number, number], rot: [number, number, number], scl: [number, number, number]) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(intensity), toneMapped: false, side: THREE.DoubleSide });
    mats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scl); group.add(m);
  };
  add(rect, 4, [0, 5, -9], [Math.PI / 2, 0, 0], [10, 10, 1]);
  [2, 0, 2, 0, 2, 0, 2, 0].forEach((x, i) => add(circle, 4, [x, 4, i * 4], [Math.PI / 2, 0, 0], [4, 1, 1]));
  add(rect, 2, [-5, 1, -1], [0, Math.PI / 2, 0], [50, 2, 1]);
  add(rect, 2, [-5, -1, -1], [0, Math.PI / 2, 0], [50, 2, 1]);
  add(rect, 2, [10, 1, 0], [0, -Math.PI / 2, 0], [50, 2, 1]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromScene(envScene, 0, 0.1, 1000);
  pmrem.dispose(); rect.dispose(); circle.dispose(); for (const m of mats) m.dispose();
  return rt;
}

/* ====== card geometry — 원본 그대로 ====== */
function roundedRectShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function cardGeometry(w: number, h: number, thick: number, r: number) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), {
    depth: thick, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 4, curveSegments: 16,
  });
  geo.center(); geo.computeVertexNormals();
  return geo;
}
function applyGradient(geo: THREE.BufferGeometry, a: string, b: string, angleDeg: number) {
  const ang = (angleDeg * Math.PI) / 180, dx = Math.cos(ang), dy = Math.sin(ang);
  const pos = geo.attributes.position, n = pos.count;
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < n; i++) { const p = pos.getX(i) * dx + pos.getY(i) * dy; if (p < mn) mn = p; if (p > mx) mx = p; }
  const cA = new THREE.Color(a), cB = new THREE.Color(b), tmp = new THREE.Color();
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (pos.getX(i) * dx + pos.getY(i) * dy - mn) / (mx - mn || 1);
    tmp.copy(cA).lerp(cB, t);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}

/* ====== the pinwheel of cards — 원본 그대로 ====== */
const CARD_DEFS = [
  { angle: 70, gA: "#2b46d0", gB: "#2fbf9f", gAng: 115, tilt: [0.09, -0.1], depth: -0.72, pw: 1.2 },
  { angle: 128, gA: "#ffb347", gB: "#ff6f8f", gAng: 0, tilt: [0.05, 0.08], depth: -0.36, pw: 1.05 },
  { angle: 176, gA: "#ff8fe0", gB: "#a86bff", gAng: 200, tilt: [-0.03, 0.11], depth: 0.0, pw: 0.9 },
  { angle: 232, gA: "#7fd0ff", gB: "#cfe6ff", gAng: 65, tilt: [-0.1, 0.05], depth: 0.36, pw: 0.75 },
  { angle: 286, gA: "#8f9dff", gB: "#eaf0ff", gAng: 100, tilt: [-0.08, -0.06], depth: 0.72, pw: 0.85 },
  { angle: 332, gA: "#ff6fce", gB: "#a34bff", gAng: 150, tilt: [0.03, -0.1], depth: 1.08, pw: 1.0 },
  { angle: 18, gA: "#9fb6ff", gB: "#d7e0ff", gAng: 130, tilt: [0.1, -0.03], depth: -1.08, pw: 1.1 },
];

function applyMaterialConfig(material: any) {
  material.uniforms._transmission.value = CONFIG.transmission;
  material.uniforms.roughness.value = CONFIG.roughness;
  material.uniforms.thickness.value = CONFIG.thickness;
  material.uniforms.chromaticAberration.value = CONFIG.chromaticAberration;
  material.uniforms.anisotropicBlur.value = CONFIG.anisotropy;
  material.uniforms.distortion.value = CONFIG.distortion;
  material.uniforms.distortionScale.value = CONFIG.distortionScale;
  material.uniforms.temporalDistortion.value = CONFIG.temporalDistortion;
  material.uniforms.attenuationDistance.value = CONFIG.attenuationDistance;
  material.uniforms.attenuationColor.value.set(CONFIG.attenuationColor);
  material.ior = CONFIG.ior;
  material.clearcoat = CONFIG.clearcoat;
  material.clearcoatRoughness = CONFIG.clearcoatRoughness;
  material.needsUpdate = true;
}

const canWebGL = () => {
  try { const c = document.createElement("canvas"); return !!c.getContext("webgl2"); } catch { return false; }
};

export function createGlass(canvas: HTMLCanvasElement, host: HTMLElement, opts: { play: FxPlay; onReady?: () => void }): FxHandle | null {
  if (!canWebGL()) return null; // 이 셰이더는 WebGL2(uint · 비트 연산) 전용
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); } catch { return null; }
  const size = () => { const r = host.getBoundingClientRect(); return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) }; };
  // 1.5 not 2 — this scene is fill-bound (원본). [통합] 손가락 화면은 저장소 공통 기준(배율 1 · 초당 30장 · Codex #159 P2)
  const tier = readTier();
  const budget = frameBudget(tier);
  renderer.setPixelRatio(Math.min(clampPixelRatio(tier), 1.5));
  const s0 = size();
  renderer.setSize(s0.w, s0.h, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, s0.w / s0.h, 0.1, 100);
  camera.position.set(0, 0, 13);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, Math.PI));
  const dir = new THREE.DirectionalLight(0xffffff, 0.65 * Math.PI);
  dir.position.set(-3, 4, 10);
  scene.add(dir);
  const bgTex = makeBackground(CONFIG.bgTop, CONFIG.bgBottom);
  scene.background = bgTex;
  const envRT = buildEnvironment(renderer);
  scene.environment = envRT.texture;

  const pinwheel = new THREE.Group();
  scene.add(pinwheel);
  type Card = { mesh: THREE.Mesh; floatGroup: THREE.Group; material: any; geo: THREE.BufferGeometry; fbo: THREE.WebGLRenderTarget; def: (typeof CARD_DEFS)[number]; offset: number };
  const cards: Card[] = [];
  CARD_DEFS.forEach((def, i) => {
    const geo = cardGeometry(1.9, 2.5, 0.28, 0.2);
    applyGradient(geo, def.gA, def.gB, def.gAng);
    const material = makeTransmissionMaterial(CONFIG.samples, false);
    material.toneMapped = false;
    material.vertexColors = true;
    material.color.set("#ffffff");
    material.transmission = 0;
    applyMaterialConfig(material);
    const mesh = new THREE.Mesh(geo, material);
    mesh.renderOrder = 100;
    const a = (def.angle * Math.PI) / 180;
    mesh.position.set(Math.cos(a) * CONFIG.radius, Math.sin(a) * CONFIG.radius, def.depth);
    mesh.rotation.set(def.tilt[0], def.tilt[1], a - Math.PI / 2);
    const floatGroup = new THREE.Group();
    floatGroup.add(mesh);
    pinwheel.add(floatGroup);
    const fbo = new THREE.WebGLRenderTarget(CONFIG.resolution, CONFIG.resolution);
    cards.push({ mesh, floatGroup, material, geo, fbo, def, offset: i * 1.7 });
  });

  /* per-frame transmission buffers — round-robin, 원본 그대로 */
  const BUFFERS_PER_FRAME = 2;
  let bufferCursor = 0;
  const renderTransmissionBuffers = (elapsed: number, all: boolean) => {
    const oldTone = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    for (const c of cards) c.material.uniforms.time.value = elapsed;
    // [통합] still 한 장은 모든 카드의 굴절 버퍼를 한 번에 채운다(원본 live 는 2장씩 돌아가며)
    const n = all ? cards.length : Math.min(BUFFERS_PER_FRAME, cards.length);
    for (let i = 0; i < n; i++) {
      const c = cards[bufferCursor % cards.length];
      bufferCursor++;
      c.mesh.visible = false;
      renderer.setRenderTarget(c.fbo);
      renderer.render(scene, camera);
      c.mesh.visible = true;
      c.material.uniforms.buffer.value = c.fbo.texture;
    }
    renderer.setRenderTarget(null);
    renderer.toneMapping = oldTone;
  };

  /* pointer — [통합] 효과 영역 기준 */
  const pointer = { x: 0, y: 0 }, pointerEased = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const onLeave = () => { pointer.x = 0; pointer.y = 0; };

  let last = performance.now() / 1000;
  const step = (all: boolean) => {
    const now = performance.now() / 1000;
    const dt = Math.min(now - last, 0.05); last = now;
    pinwheel.rotation.z += CONFIG.spinSpeed * dt;
    pointerEased.x += (pointer.x - pointerEased.x) * CONFIG.parallaxEase;
    pointerEased.y += (pointer.y - pointerEased.y) * CONFIG.parallaxEase;
    for (const c of cards) {
      const g = c.floatGroup;
      const bob = Math.sin(now * CONFIG.floatSpeed + c.offset) * CONFIG.floatAmp;
      g.position.x = bob * 0.15 + pointerEased.x * CONFIG.parallax * c.def.pw;
      g.position.y = bob + pointerEased.y * CONFIG.parallax * 0.5 * c.def.pw;
    }
    renderTransmissionBuffers(now, all);
    renderer.render(scene, camera);
  };

  const resize = () => {
    const { w, h } = size();
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const still = opts.play === "still";
  let raf = 0, running = false, inView = true, readyFired = false;
  let drawnAt = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (budget > 0 && now - drawnAt < budget - 4) return; // 손가락 화면 = 초당 30장
    drawnAt = now;
    step(false);
    if (!readyFired) { readyFired = true; opts.onReady?.(); }
  };
  const sync = () => {
    const want = !still && !document.hidden && inView;
    if (want && !running) { running = true; last = performance.now() / 1000; raf = requestAnimationFrame(frame); }
    else if (!want && running) { running = false; cancelAnimationFrame(raf); }
  };
  const io = new IntersectionObserver((es) => { inView = es.some((e) => e.isIntersecting); sync(); });
  io.observe(host);
  const ro = new ResizeObserver(() => { resize(); if (!running) step(true); });
  ro.observe(host);
  if (!still) {
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave, { passive: true });
  }
  document.addEventListener("visibilitychange", sync);
  resize();
  if (still) { step(true); step(true); opts.onReady?.(); } else sync();

  return {
    dispose: () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      for (const c of cards) { c.material.dispose(); c.geo.dispose(); c.fbo.dispose(); }
      bgTex.dispose();
      envRT.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
