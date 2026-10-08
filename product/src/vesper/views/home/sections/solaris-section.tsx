"use client";
// GetLayers 3D Scenes 「Solaris」 원본(solaris.html) 그대로 — 2026-10-08 대표 「색도 글씨체도 3D 효과도 코드대로」.
// 바꾼 것: CDN importmap → 번들 three · 제어판·localStorage 제거 · 화면에 보일 때만 그림 · 위에 ECHO 문구.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RobotText as TextEngine } from "@vesper/components/common/robot-text";
import { Inview } from "@vesper/components/common/robot-inview";
import { FollowLineBlur, wordCount } from "../line-blur";
import { LETTER_FADE, UNIT_REVEAL, WORD_FADE } from "../reveal";
import { solarisBackgroundFragmentShader, solarisBackgroundVertexShader, solarisParticleFragmentShader, solarisParticleVertexShader } from "./solaris-shaders";
import { STORIES } from "@/pages/do-it/brand-home/copy";

const CONFIG = {
  colorWarm: "#ff4c33",
  colorCool: "#3366ff",
  bloomStrength: 1.64,
  bloomRadius: 1.14,
  bloomThreshold: 0.04,
  noiseSpeed: 1.41,
  introSeconds: 2.4,
  cameraDistance: 10.8,
  cursorRadius: 2.0,
  cursorFlare: 1.4,
  cursorHeat: 1.0,
};

const hexToVec3 = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const STORY = STORIES[4];
const TITLE = STORY.title.join(" ");
const BODY = STORY.body.join(" ");

export const SolarisSection = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch { return; }
    const size = () => ({ w: host.clientWidth, h: host.clientHeight });
    let { w, h } = size();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.autoClear = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    camera.position.z = CONFIG.cameraDistance;

    const bgScene = new THREE.Scene();
    const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    const bgMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uScroll: { value: 0.0 }, uResolution: { value: new THREE.Vector2(w, h) },
        color1: { value: new THREE.Color(CONFIG.colorWarm) }, color2: { value: new THREE.Color(CONFIG.colorCool) },
      },
      vertexShader: solarisBackgroundVertexShader, fragmentShader: solarisBackgroundFragmentShader, depthWrite: false,
    });
    bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMaterial));

    const geometry = new THREE.SphereGeometry(4.2, 200, 600);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uScroll: { value: 0.0 }, uIntro: { value: 0.0 },
        uColorTop: { value: hexToVec3(CONFIG.colorWarm) }, uColorBottom: { value: hexToVec3(CONFIG.colorCool) },
        uCursor: { value: new THREE.Vector3(0, 0, 4.2) }, uCursorStrength: { value: 0 },
        uCursorRadius: { value: CONFIG.cursorRadius }, uCursorFlare: { value: CONFIG.cursorFlare }, uCursorHeat: { value: CONFIG.cursorHeat },
      },
      vertexShader: solarisParticleVertexShader, fragmentShader: solarisParticleFragmentShader,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const particles = new THREE.Points(geometry, material);
    particles.frustumCulled = false;
    scene.add(particles);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(bgScene, bgCamera));
    const renderFg = new RenderPass(scene, camera);
    renderFg.clear = false; renderFg.clearDepth = true;
    composer.addPass(renderFg);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), CONFIG.bloomStrength, CONFIG.bloomRadius, CONFIG.bloomThreshold);
    composer.addPass(bloomPass);

    const resize = () => {
      ({ w, h } = size());
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h); composer.setSize(w, h);
      bgMaterial.uniforms.uResolution.value.set(w, h);
    };
    window.addEventListener("resize", resize);

    const pickSphere = new THREE.Mesh(new THREE.SphereGeometry(4.2, 48, 48));
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerInside = false;
    const cursorTarget = new THREE.Vector3(0, 0, 4.2);
    const onPointerMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      pointerInside = true;
    };
    const onLeave = () => { pointerInside = false; };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);

    let visible = false;
    const io = new IntersectionObserver((entries) => { for (const e of entries) visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(host);

    let time = 0;
    let introStart = 0;
    let raf = 0;
    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      if (!visible || document.hidden) return;
      time += 0.005 * CONFIG.noiseSpeed;
      if (introStart === 0) introStart = now;
      const introRaw = Math.min((now - introStart) / (CONFIG.introSeconds * 1000), 1);
      const introEased = 1 - Math.pow(1 - introRaw, 3);
      material.uniforms.uIntro.value = introEased;
      material.uniforms.uTime.value = time;
      bgMaterial.uniforms.uTime.value = time;
      const introZoom = (1 - introEased) * -3.0;
      camera.position.set(0, 0, CONFIG.cameraDistance + introZoom);
      camera.lookAt(0, 0, CONFIG.cameraDistance - 100.0);
      let overSphere = false;
      if (pointerInside) {
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObject(pickSphere, false)[0];
        if (hit) { cursorTarget.copy(hit.point); overSphere = true; }
      }
      const sU = material.uniforms.uCursorStrength;
      sU.value += ((overSphere ? 1 : 0) - sU.value) * 0.09;
      material.uniforms.uCursor.value.lerp(cursorTarget, 0.18);
      composer.render();
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerMove);
      window.removeEventListener("pointerleave", onLeave);
      geometry.dispose(); material.dispose(); bgMaterial.dispose(); pickSphere.geometry.dispose();
      composer.dispose(); renderer.dispose();
    };
  }, []);

  return (
    <section ref={hostRef} id="solaris" aria-label={TITLE} className="relative h-lvh w-full overflow-hidden bg-black text-white">
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 block h-full w-full" />
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end px-[1.667vw] pb-[2.222vw] max-lg:px-[1.5rem] max-lg:pb-[2rem] max-sm:px-[1.25rem]">
        <Inview mode="always" immediateOut={false} from={UNIT_REVEAL.from} to={UNIT_REVEAL.to} config={UNIT_REVEAL.config} className="font-tag text-[1.111vw] leading-[1.2] uppercase max-lg:text-[0.8125rem]">
          {STORY.no} — {STORY.label}
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
    </section>
  );
};
