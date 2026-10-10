/**
 * DNA Helix — 대표 전달 효과(2026-10-10, dna-helix.html · three 0.143). 빛 점으로 엮인 두 가닥 나선이 깊은 남색 공간에서 오른다.
 * CONFIG · 기하 · 셰이더는 원본 그대로. 공통 파이프라인과 [통합] 변경은 house.ts 머리말.
 * 앱 자리: ECHO가 내 말을 읽는 동안(대화 기다림) — 「내 이야기가 한 가닥씩 엮인다」.
 */
import { LAYERS, SNOISE, createHouse, hexToVec3, type FxHandle, type FxPlay, type SceneImpl } from "./house";

export const DNA_CONFIG = {
  bgColor: "#03142e",
  flameColor: "#2bd6ff",
  flameColor2: "#aef0ff",
  flameAmt: 0.2,
  atmoColor: "#7fe6ff",
  atmoCount: 780,
  atmoSize: 24,
  atmoSpeed: 0.4,
  colorLow: "#04123a",
  colorHigh: "#27043e",
  opacity: 2,
  pointSize: 4,
  brightness: 1.15,
  twist: 0.65,
  waveAmt: 0.7,
  dnaFloat: 0.95,
  spin: 0.18,
  scale: 0.63,
  scrollClimb: 9.5,
  scrollTwist: 0.9,
  scrollDolly: 0,
  scrollSpin: 1.8,
  parallax: 1,
  pointerRadius: 2.2,
  pointerStrength: 0.2,
};
const CONFIG = DNA_CONFIG;

const DNA_VERT = `
        uniform float uTime; uniform float uSize; uniform float uTwist; uniform float uWaveAmt; uniform float uScale; uniform float uFloat;
        uniform vec3 uColLow; uniform vec3 uColHigh;
        uniform vec3 uCursor; uniform float uRepelRadius; uniform float uRepelStrength; uniform float uActivity;
        varying float vFade; varying vec3 vColor;
        ${SNOISE}
        void main() {
          float stretchedY = position.y * 7.0 - 8.0;
          float rnd1 = random(position);
          float rnd2 = random(position + vec3(1.0));
          float rnd3 = random(position + vec3(2.0));

          float t = stretchedY + sin(uTime * 0.8 + rnd1 * 6.28318) * uFloat;
          float twist = t * uTwist;
          float dnaRadius = 1.0;
          float strandThickness = 0.35;

          vec3 dnaPos;
          if (rnd1 < 0.40) {
            vec3 core = vec3(dnaRadius * cos(twist), t, dnaRadius * sin(twist));
            vec3 offset = vec3(rnd1 - 0.2, rnd2 - 0.5, rnd3 - 0.5) * 2.0 * strandThickness;
            dnaPos = core + offset;
          } else if (rnd1 < 0.80) {
            vec3 core = vec3(dnaRadius * cos(twist + 3.14159), t, dnaRadius * sin(twist + 3.14159));
            vec3 offset = vec3(rnd1 - 0.6, rnd2 - 0.5, rnd3 - 0.5) * 2.0 * strandThickness;
            dnaPos = core + offset;
          } else {
            float rungT = (rnd1 - 0.80) * 5.0;
            float discreteT = floor(t * 2.5) / 2.5;
            float discreteTwist = discreteT * uTwist;
            vec3 p1 = vec3(dnaRadius * cos(discreteTwist), discreteT, dnaRadius * sin(discreteTwist));
            vec3 p2 = vec3(dnaRadius * cos(discreteTwist + 3.14159), discreteT, dnaRadius * sin(discreteTwist + 3.14159));
            vec3 core = mix(p1, p2, rungT);
            vec3 offset = vec3(rnd1 - 0.9, rnd2 - 0.5, rnd3 - 0.5) * 2.0 * 0.10;
            dnaPos = core + offset;
          }
          dnaPos.x += snoise(vec3(0.0, t * 0.2, uTime * 0.2)) * uWaveAmt;
          dnaPos.z += snoise(vec3(t * 0.2, 0.0, uTime * 0.2)) * uWaveAmt;

          vec3 finalPos = (dnaPos - vec3(0.0, -8.0, 0.0)) * uScale;
          vec4 modelPosition = modelMatrix * vec4(finalPos, 1.0);
          vec3 toP = modelPosition.xyz - uCursor;
          float cd = length(toP);
          float fall = smoothstep(uRepelRadius, 0.0, cd);
          modelPosition.xyz += normalize(toP + vec3(0.0001)) * fall * uRepelStrength * uActivity;
          vec4 mvPosition = viewMatrix * modelPosition;

          float colMix = smoothstep(-20.0, 12.0, t);
          vColor = mix(uColLow, uColHigh, clamp(colMix, 0.0, 1.0));
          vFade = 1.0;

          gl_PointSize = uSize * (10.0 / -mvPosition.z);
          gl_PointSize = max(gl_PointSize, 1.5);
          gl_Position = projectionMatrix * mvPosition;
        }`;

const DNA_FRAG = `
        uniform float uOpacity; uniform float uBrightness; uniform float uAppear;
        varying float vFade; varying vec3 vColor;
        void main() {
          vec2 xy = gl_PointCoord - 0.5;
          float ll = length(xy);
          if (ll > 0.5) discard;
          float a = smoothstep(0.5, 0.1, ll);
          gl_FragColor = vec4(vColor * uBrightness, vFade * a * uOpacity * uAppear);
        }`;

export function createDna(canvas: HTMLCanvasElement, host: HTMLElement, opts: { play: FxPlay; progress?: { max: number; seconds: number }; onFail?: () => void }): FxHandle | null {
  return createHouse(canvas, host, {
    bgColor: CONFIG.bgColor, flameColor: CONFIG.flameColor, flameColor2: CONFIG.flameColor2, flameAmt: CONFIG.flameAmt,
    atmoColor: CONFIG.atmoColor, atmoCount: CONFIG.atmoCount, atmoSize: CONFIG.atmoSize, atmoSpeed: CONFIG.atmoSpeed, atmoAlpha: 0.6,
    bloom: [0.6, 0.6], fov: 45, near: 0.1, far: 400, camZ: 8.67, fog: true,
  }, (ctx): SceneImpl => {
    const { THREE, scene, camera, pointer, mouse } = ctx;
    const uniforms = {
      uTime: { value: 0 },
      uAppear: { value: 0 },
      uColLow: { value: hexToVec3(CONFIG.colorLow) },
      uColHigh: { value: hexToVec3(CONFIG.colorHigh) },
      uOpacity: { value: CONFIG.opacity },
      uSize: { value: CONFIG.pointSize },
      uBrightness: { value: CONFIG.brightness },
      uTwist: { value: CONFIG.twist },
      uWaveAmt: { value: CONFIG.waveAmt },
      uFloat: { value: CONFIG.dnaFloat },
      uScale: { value: CONFIG.scale },
      uCursor: { value: new THREE.Vector3() },
      uRepelRadius: { value: CONFIG.pointerRadius },
      uRepelStrength: { value: CONFIG.pointerStrength },
      uActivity: { value: 0 },
    };
    const geometry = new THREE.SphereGeometry(4.2, 200, 600);
    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: DNA_VERT, fragmentShader: DNA_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const group = new THREE.Group();
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.layers.enable(LAYERS.ENTIRE_SCENE);
    group.add(points);
    scene.add(group);

    const appearStart = performance.now();
    let spinPhase = 0;
    return {
      // [통합] 점 크기 = 원본 값 × (그림 높이 ÷ 원본 기준 900 화소) — storm.ts 와 같은 이유(작은 영역에서 하얗게 뭉침 방지)
      resize: (_w, h) => { uniforms.uSize.value = CONFIG.pointSize * ((h * ctx.dpr) / 900); },
      update: (scroll, now, dt, still) => {
        uniforms.uTime.value = now;
        // Camera dollies in with cursor parallax; the helix slides downward (climbing) and tightens its coils with scroll. — 원본 그대로
        camera.position.set(mouse.x * CONFIG.parallax, mouse.y * CONFIG.parallax, 8.67 - scroll * CONFIG.scrollDolly);
        camera.lookAt(0, 0, 0);
        group.position.y = -scroll * CONFIG.scrollClimb;
        uniforms.uTwist.value = CONFIG.twist * (1 + scroll * CONFIG.scrollTwist);
        spinPhase += dt * (CONFIG.spin + scroll * CONFIG.scrollSpin);
        group.rotation.y = spinPhase;
        uniforms.uCursor.value.copy(pointer.world);
        uniforms.uActivity.value = pointer.activity;
        const elapsed = (performance.now() - appearStart) / 1000;
        uniforms.uAppear.value = still ? 1 : Math.max(0, Math.min(1, (elapsed - 0.2) / 1.4));
      },
      dispose: () => { geometry.dispose(); material.dispose(); },
    };
  }, { play: opts.play, progress: opts.progress, interactive: true, onFail: opts.onFail });
}
