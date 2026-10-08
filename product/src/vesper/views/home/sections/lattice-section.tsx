"use client";
// GetLayers 3D Scenes 「Einstein–Rosen Lattice」 원본(einstein-rosen-lattice.html) 그대로 — 2026-10-08 대표 「색도 글씨체도 3D 효과도 코드대로」.
// 바꾼 것: CDN importmap → 번들 three(WebGL1Renderer → WebGLRenderer · PlaneBufferGeometry → PlaneGeometry) · 제어판·localStorage 제거 · 보일 때만 그림 · 위에 ECHO 문구 + 제작 과정 영상.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { GammaCorrectionShader } from "three/addons/shaders/GammaCorrectionShader.js";
import { CopyShader } from "three/addons/shaders/CopyShader.js";
import { RobotText as TextEngine } from "@vesper/components/common/robot-text";
import { Inview } from "@vesper/components/common/robot-inview";
import { FollowLineBlur, wordCount } from "../line-blur";
import { LETTER_FADE, UNIT_REVEAL, WORD_FADE } from "../reveal";
import { BRIDGE_FRAG, GLOW_FRAG, QUAD_VERT } from "./lattice-shaders";
import BrandFilm, { BRAND_FILM_COPY } from "@/pages/do-it/brand-home/BrandFilm";
import { STORIES } from "@/pages/do-it/brand-home/copy";

const CONFIG = {
  lineColor: '#eef3ff', throatTint: '#ffd9a6', rimTint: '#5878ff', glowColor: '#8fb4ff',
  throatRadius: 1.000, flareHeight: 1.700, cameraDistance: 14.500, cameraFov: 60.000,
  meridians: 60.000, ringSpacing: 1.000,
  lineWidth: 0.900, lineGain: 0.440, hazeMax: 0.263, throatBoost: 0.380, tintAmount: 0.300, tintFalloff: 3.000,
  fadeStart: 160.000, fadeEnd: 20000.000, vignette: 0.180, vignettePower: 1.600, horizonFloor: 1.000, seamGap: 1.500,
  spinSpeed: 0.022, driftSpeed: 0.120, breathAmp: 0.020, breathSpeed: 0.300, pulseAmp: 0.320, pulseDecay: 1.150, fadeInSeconds: 1.250,
  zoomAmount: 0.060, zoomDuration: 0.900,
  parallaxAz: 0.110, parallaxEl: 0.000, parallaxEase: 0.055,
  glowIntensity: 0.000, glowWidth: 0.150, glowHeight: 0.330, glowFalloff: 2.400,
  bloomStrength: 0.300, bloomRadius: 0.550, bloomThreshold: 0.000, torusStrength: 0.220, torusRadius: 0.200,
};

const hexToVec3 = (hex: string) => {
  const h = String(hex).replace('#', '');
  return new THREE.Vector3(parseInt(h.substring(0, 2), 16) / 255, parseInt(h.substring(2, 4), 16) / 255, parseInt(h.substring(4, 6), 16) / 255);
};
const LAYERS = { NONE: 0, TORUS_SCENE: 1, BLOOM_SCENE: 2, ENTIRE_SCENE: 3 };

const STORY = STORIES[7];
const TITLE = STORY.title.join(" ");
const BODY = STORY.body.join(" ");

export const LatticeSection = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch { return; }
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const U = {
      iTime: { value: 0 }, iAlpha: { value: 0 }, iResolution: { value: new THREE.Vector3(1, 1, 1) }, uAspect: { value: 1 },
      iAz: { value: 0 }, iEl: { value: 0 }, iSpin: { value: 0 }, iPhase: { value: 0 }, iPulse: { value: 0 }, iBreath: { value: 1 },
      uA: { value: 1.0 }, uB: { value: 1.7 }, uCamDist: { value: 14.5 }, uTanFov: { value: Math.tan(60 * Math.PI / 360) },
      uMeridians: { value: 60 }, uRingSpacing: { value: 1 },
      uLineWidth: { value: 0.9 }, uLineGain: { value: 0.55 }, uHazeMax: { value: 0.14 }, uThroatBoost: { value: 0.38 }, uTintAmount: { value: 0.3 }, uTintFalloff: { value: 3 },
      uFadeStart: { value: 160 }, uFadeEnd: { value: 3200 }, uVignette: { value: 0.18 }, uVignettePower: { value: 1.6 }, uHorizonFloor: { value: 0.6 }, uPulseAmp: { value: 0.32 }, uSeamGap: { value: 1.5 },
      uLineColor: { value: new THREE.Vector3(1, 1, 1) }, uThroatTint: { value: new THREE.Vector3(1, 1, 1) }, uRimTint: { value: new THREE.Vector3(1, 1, 1) },
      uGlowColor: { value: new THREE.Vector3(1, 1, 1) }, uGlowIntensity: { value: 0.15 }, uGlowWidth: { value: 0.15 }, uGlowHeight: { value: 0.33 }, uGlowFalloff: { value: 2.4 },
    };
    renderer.setPixelRatio(dpr);
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 1);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.layers.enable(LAYERS.NONE); camera.layers.enable(LAYERS.TORUS_SCENE); camera.layers.enable(LAYERS.BLOOM_SCENE); camera.layers.enable(LAYERS.ENTIRE_SCENE);
    scene.add(camera);

    const bridgeMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: QUAD_VERT, fragmentShader: BRIDGE_FRAG, depthTest: false, depthWrite: false, transparent: false });
    const bridge = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bridgeMat);
    bridge.frustumCulled = false; bridge.renderOrder = 0; bridge.layers.enable(LAYERS.ENTIRE_SCENE); bridge.layers.enable(LAYERS.TORUS_SCENE);
    scene.add(bridge);
    const glowMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: QUAD_VERT, fragmentShader: GLOW_FRAG, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glowMat);
    glow.frustumCulled = false; glow.renderOrder = 1; glow.layers.enable(LAYERS.ENTIRE_SCENE); glow.layers.enable(LAYERS.BLOOM_SCENE);
    scene.add(glow);

    const live = { t0: performance.now() / 1000, last: performance.now() / 1000, spin: 0, phase: 0, pulse: 0, zoomStart: -1, px: 0, py: 0, tx: 0, ty: 0 };

    const res = new THREE.Vector2(1, 1);
    const renderScene = new RenderPass(scene, camera);
    const torusComposer = new EffectComposer(renderer); torusComposer.renderToScreen = false;
    torusComposer.addPass(renderScene); torusComposer.addPass(new ShaderPass(GammaCorrectionShader));
    const torusBloom = new UnrealBloomPass(res, CONFIG.torusStrength, CONFIG.torusRadius, 0);
    torusComposer.addPass(torusBloom); torusComposer.addPass(new ShaderPass(CopyShader));
    const bloomComposer = new EffectComposer(renderer); bloomComposer.renderToScreen = false;
    bloomComposer.addPass(renderScene);
    const bloomPass = new UnrealBloomPass(res, CONFIG.bloomStrength, CONFIG.bloomRadius, 0);
    bloomComposer.addPass(bloomPass); bloomComposer.addPass(new ShaderPass(GammaCorrectionShader));
    const blackPixel = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat); blackPixel.needsUpdate = true;
    const FinalPass = {
      uniforms: { tDiffuse: { value: null }, torusTexture: { value: null }, bloomTexture: { value: null }, haloTexture: { value: null } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D torusTexture; uniform sampler2D bloomTexture; uniform sampler2D haloTexture; varying vec2 vUv;
        void main(){ vec4 base = texture2D(tDiffuse, vUv); vec4 torus = texture2D(torusTexture, vUv); vec4 bloom = texture2D(bloomTexture, vUv); vec4 halo = texture2D(haloTexture, vUv); gl_FragColor = vec4(bloom.rgb + torus.rgb + base.rgb + halo.rgb, 1.0); }`,
    };
    const finalComposer = new EffectComposer(renderer);
    finalComposer.addPass(renderScene);
    const finalPass = new ShaderPass(FinalPass);
    finalPass.uniforms.bloomTexture.value = bloomComposer.renderTarget1.texture;
    finalPass.uniforms.torusTexture.value = torusComposer.renderTarget1.texture;
    finalPass.uniforms.haloTexture.value = blackPixel;
    finalComposer.addPass(finalPass);

    const applyConfig = () => {
      U.uLineColor.value.copy(hexToVec3(CONFIG.lineColor)); U.uThroatTint.value.copy(hexToVec3(CONFIG.throatTint)); U.uRimTint.value.copy(hexToVec3(CONFIG.rimTint)); U.uGlowColor.value.copy(hexToVec3(CONFIG.glowColor));
      U.uA.value = CONFIG.throatRadius; U.uB.value = CONFIG.flareHeight; U.uCamDist.value = CONFIG.cameraDistance; U.uTanFov.value = Math.tan(CONFIG.cameraFov * Math.PI / 360);
      U.uMeridians.value = CONFIG.meridians; U.uRingSpacing.value = CONFIG.ringSpacing;
      U.uLineWidth.value = CONFIG.lineWidth; U.uLineGain.value = CONFIG.lineGain; U.uHazeMax.value = CONFIG.hazeMax; U.uThroatBoost.value = CONFIG.throatBoost; U.uTintAmount.value = CONFIG.tintAmount; U.uTintFalloff.value = CONFIG.tintFalloff;
      U.uFadeStart.value = CONFIG.fadeStart; U.uFadeEnd.value = CONFIG.fadeEnd; U.uVignette.value = CONFIG.vignette; U.uVignettePower.value = CONFIG.vignettePower; U.uHorizonFloor.value = CONFIG.horizonFloor; U.uPulseAmp.value = CONFIG.pulseAmp; U.uSeamGap.value = CONFIG.seamGap;
      U.uGlowIntensity.value = CONFIG.glowIntensity; U.uGlowWidth.value = CONFIG.glowWidth; U.uGlowHeight.value = CONFIG.glowHeight; U.uGlowFalloff.value = CONFIG.glowFalloff;
      bloomPass.strength = CONFIG.bloomStrength; bloomPass.radius = CONFIG.bloomRadius; bloomPass.threshold = CONFIG.bloomThreshold;
      torusBloom.strength = CONFIG.torusStrength; torusBloom.radius = CONFIG.torusRadius; torusBloom.threshold = 0;
    };
    applyConfig();

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setPixelRatio(dpr); renderer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      torusComposer.setSize(w, h); bloomComposer.setSize(w, h); finalComposer.setSize(w, h);
      finalPass.uniforms.bloomTexture.value = bloomComposer.renderTarget1.texture;
      finalPass.uniforms.torusTexture.value = torusComposer.renderTarget1.texture;
      U.iResolution.value.set(w * dpr, h * dpr, 1); U.uAspect.value = w / h;
    };
    window.addEventListener('resize', resize);
    resize();

    const ndc = (clientX: number, clientY: number) => {
      const r = host.getBoundingClientRect();
      const w = r.width, h = r.height, a = w / h;
      let x = ((clientX - r.left) / w) * 2 - 1;
      let y = -(((clientY - r.top) / h) * 2 - 1);
      if (a >= 1) x *= a; else y /= a;
      return [Math.max(-2, Math.min(2, x)), Math.max(-2, Math.min(2, y))];
    };
    const onMove = (e: PointerEvent) => { const p = ndc(e.clientX, e.clientY); live.tx = p[0]; live.ty = p[1]; };
    const onDown = () => { if (live.zoomStart < 0) live.zoomStart = performance.now() / 1000; };
    const onLeave = () => { live.tx = 0; live.ty = 0; };
    window.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerleave', onLeave, { passive: true });

    let visible = false;
    const io = new IntersectionObserver((entries) => { for (const e of entries) visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(host);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      if (!visible || document.hidden) { live.last = performance.now() / 1000; return; }
      const now = performance.now() / 1000;
      let dt = now - live.last; live.last = now; dt = Math.min(Math.max(dt, 0), 0.05);
      U.iTime.value = now;
      const f = Math.min(1, (now - live.t0) / Math.max(CONFIG.fadeInSeconds, 0.001));
      U.iAlpha.value = f * f * (3 - 2 * f);
      live.spin += dt * CONFIG.spinSpeed; if (live.spin > Math.PI * 2) live.spin -= Math.PI * 2; U.iSpin.value = live.spin;
      const ringPeriod = 2 * Math.PI * CONFIG.flareHeight / Math.max(CONFIG.meridians, 1) * CONFIG.ringSpacing;
      live.phase += dt * CONFIG.driftSpeed; if (live.phase > ringPeriod) live.phase -= ringPeriod; U.iPhase.value = live.phase;
      live.pulse *= Math.exp(-dt * CONFIG.pulseDecay); U.iPulse.value = live.pulse;
      U.iBreath.value = 1 + CONFIG.breathAmp * Math.sin(now * CONFIG.breathSpeed);
      let zoom = 0;
      if (live.zoomStart >= 0) { const zt = (now - live.zoomStart) / Math.max(CONFIG.zoomDuration, 0.001); if (zt >= 1) live.zoomStart = -1; else zoom = Math.sin(Math.PI * zt); }
      U.uCamDist.value = CONFIG.cameraDistance * (1 - zoom * CONFIG.zoomAmount);
      const e = 1 - Math.pow(1 - Math.min(CONFIG.parallaxEase, 0.999), dt * 60);
      live.px += (live.tx - live.px) * e; live.py += (live.ty - live.py) * e;
      U.iAz.value = live.px * CONFIG.parallaxAz; U.iEl.value = live.py * CONFIG.parallaxEl;
      camera.layers.set(LAYERS.TORUS_SCENE); torusComposer.render();
      camera.layers.set(LAYERS.BLOOM_SCENE); bloomComposer.render();
      camera.layers.set(LAYERS.ENTIRE_SCENE); finalComposer.render();
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf); io.disconnect();
      window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onMove); host.removeEventListener('pointerdown', onDown); window.removeEventListener('pointerleave', onLeave);
      bridge.geometry.dispose(); glow.geometry.dispose(); bridgeMat.dispose(); glowMat.dispose(); blackPixel.dispose();
      torusComposer.dispose(); bloomComposer.dispose(); finalComposer.dispose(); renderer.dispose();
    };
  }, []);

  return (
    <section ref={hostRef} id="making" aria-label={BRAND_FILM_COPY.title} className="relative min-h-lvh w-full overflow-hidden bg-black text-white">
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 block h-full w-full" />
      <div className="relative z-10 flex min-h-lvh flex-col justify-end px-[1.667vw] pt-[6.5vw] pb-[2.222vw] max-lg:px-[1.5rem] max-lg:pt-[6.5rem] max-lg:pb-[2rem] max-sm:px-[1.25rem]">
        <div className="pointer-events-none">
          <Inview mode="always" immediateOut={false} from={UNIT_REVEAL.from} to={UNIT_REVEAL.to} config={UNIT_REVEAL.config} className="font-tag text-[1.111vw] leading-[1.2] uppercase max-lg:text-[0.8125rem]">
            {STORY.no} — {STORY.label} · MAKING FILM
          </Inview>
          <FollowLineBlur letters={TITLE.length}>
            {(onTextStart) => (
              <TextEngine tag="h2" mode="always" immediateOut={false} {...LETTER_FADE} onTextStart={onTextStart} className="mt-[0.833vw] w-[46vw] font-general text-[5.556vw] leading-[0.9] font-light max-lg:mt-[0.5rem] max-lg:w-full max-lg:text-[2.75rem] max-sm:text-[2.125rem]">
                {TITLE}
              </TextEngine>
            )}
          </FollowLineBlur>
          <FollowLineBlur unit="word" letters={wordCount(BODY)}>
            {(onTextStart) => (
              <TextEngine tag="p" mode="always" immediateOut={false} delayIn={160} {...WORD_FADE} onTextStart={onTextStart} className="mt-[1.111vw] w-[27.5vw] font-general text-[1.111vw] leading-[1.2] max-lg:mt-[0.75rem] max-lg:w-full max-lg:text-[0.9375rem]">
                {BODY}
              </TextEngine>
            )}
          </FollowLineBlur>
        </div>
        {/* 제작 과정 영상(2026-10-05 대표 · PR #137 BrandFilm 그대로) — 격자 위 */}
        <div className="bh mx-auto mt-[2.222vw] w-full max-w-[26rem] max-lg:mt-[1.5rem]">
          <p className="font-tag text-[1.111vw] leading-[1.2] uppercase max-lg:text-[0.8125rem]">{BRAND_FILM_COPY.title}</p>
          <BrandFilm />
        </div>
      </div>
    </section>
  );
};
