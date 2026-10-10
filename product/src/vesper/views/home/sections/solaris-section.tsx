"use client";
// GetLayers 3D Scenes 「Solaris」 원본(solaris.html) 그대로 — 2026-10-08 대표 「색도 글씨체도 3D 효과도 코드대로」.
// 바꾼 것: CDN importmap → 번들 three · 제어판·localStorage 제거 · 화면에 보일 때만 그림 · 위에 ECHO 문구.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { solarisBackgroundFragmentShader, solarisBackgroundVertexShader, solarisParticleFragmentShader, solarisParticleVertexShader } from "./solaris-shaders";
import { pageMotionPaused } from "@vesper/lib/scene/page-motion";

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

// 2026-10-09 대표 「글씨는 내가 준 코드 원본 그대로 우선」 → 원본 Solaris 에는 글이 없다. 글 0.

export const SolarisSection = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLElement>(null);
  // 2026-10-10 Codex P2(4236722006): WebGL 을 못 쓰면 빈 화면 한 장이 남지 않게 이 장식 구간을 접는다(글·버튼 없음 · 다른 구간 그대로).
  const [noGL, setNoGL] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch { setNoGL(true); return; }
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

    let stillDrawn = false;
    const resize = () => {
      ({ w, h } = size());
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h); composer.setSize(w, h);
      bgMaterial.uniforms.uResolution.value.set(w, h);
      // 크기가 바뀌면 버퍼가 지워진다: 멈춤 중이어도 다음 프레임에 한 장 다시(회전한 채 빈 화면 0).
      stillDrawn = false;
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
      // 2026-10-09(Codex P2): 움직임 줄이기 · 이용 안내 창 열림 → 한 장만 그리고 멈춤(풀리면 다시 진행).
      const paused = pageMotionPaused();
      if (paused && stillDrawn) return;
      stillDrawn = paused;
      time += 0.005 * CONFIG.noiseSpeed;
      if (introStart === 0) introStart = now;
      // 멈춤 상태의 한 장은 등장(intro) 이 끝난 모습이어야 한다(uIntro 0 이면 입자 불투명도 0 → 빈 화면).
      if (paused) introStart = now - CONFIG.introSeconds * 1000;
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

  if (noGL) return null;
  return (
    <section ref={hostRef} id="solaris" aria-label="Solaris" className="relative h-lvh w-full overflow-hidden bg-black text-white">
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 block h-full w-full" />
      {/* 2026-10-09 대표: 스크롤할 때 앞 장면과 선처럼 끊겨 보임 → 위·아래를 검정으로 녹여 한 편처럼 이어지게. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[34vh] bg-gradient-to-b from-black via-black/70 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[26vh] bg-gradient-to-t from-black to-transparent" />
    </section>
  );
};
