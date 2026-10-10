import { useEffect, useRef } from "react";
import { homeHeroScene } from "./scene/config";
import { frameBudget, readTier, sceneShouldFreeze } from "./scene/device";
import { readSceneTokens } from "./scene/tokens";
import type { DandelionScene } from "./scene/dandelion/dandelion-scene";
import type { DandelionGeometry } from "./scene/dandelion/dandelion-geometry";

/**
 * 앱 첫 화면들의 그림 자리 — Flora 원본의 민들레(입자 꽃)가 봉오리에서 자라 한 번 흔들리고 피어 있는 장면
 * (2026-10-10 대표 「모바일웹 Flora 그대로 · 기존 파스텔 그림 지움」: 예전 유리 리본 그림 자리).
 * 원본 장면 클래스(DandelionScene)·셰이더·값은 그대로 쓰고, 스크롤 비행(카메라가 꽃 속으로 들어가는 구간)은 앱에 없으므로
 * 진행값 0(첫 장면)에 머문다.
 *
 * 통합에 필요한 변경(시각 값 변경 0):
 *  - 꽃을 화면 가운데에(frameOffsetX 0.3 → 0): 원본은 PC 글자 자리를 비키려고 오른쪽으로 민다. 앱 그림 칸은 가운데 정렬.
 *  - 입자 수: 원본 휴대폰 값(42만)을 모든 기기에 — 그림 칸이 작고 앱 화면은 휴대폰 기준. 밝기는 원본이 입자 수로 보정한다(referenceCount).
 *  - 화면 밖·탭 숨김이면 멈춤 · 움직임 줄이기/절전이면 다 자란 한 장(원본 settle) · 크기 바뀌면 다시 맞춤.
 *  - 입자는 작업 스레드에서 한 번 만들어 재사용 · 셰이더 준비는 한 프레임에 한 단계(원본 dandelion-canvas 와 같은 방식).
 *  - WebGL 을 못 쓰면 그림 칸만 비고 화면은 그대로.
 */
const CONFIG = {
  ...homeHeroScene,
  frameOffsetX: 0,
  particleCount: { desktop: 420_000, tablet: 420_000, mobile: 420_000 },
};

/* Codex #158 P1: 입자 42만 개는 원본처럼 작업 스레드(worker)에서 만든다 — 화면 스레드가 멈추지 않는다.
   설정이 하나뿐이라 한 번 만든 버퍼를 앱이 켜져 있는 동안 다시 쓴다(화면을 오가도 다시 만들지 않음 · 장면은 버퍼를 읽기만 함). */
let particlesOnce: Promise<DandelionGeometry> | null = null;
const loadParticles = (): Promise<DandelionGeometry> => {
  if (!particlesOnce) {
    particlesOnce = Promise.all([import("./scene/dandelion/dandelion-geometry-off-thread"), import("./scene/dandelion/dandelion-scene")])
      .then(([off, mod]) => off.buildDandelionOffThread(mod.dandelionGeometryOptions(CONFIG)));
    particlesOnce.catch(() => { particlesOnce = null; });
  }
  return particlesOnce;
};

export default function FloraBloom({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let scene: DandelionScene | null = null;
    let raf = 0;
    let visible = true;
    let disposed = false;
    let frozen = false;
    const io = new IntersectionObserver((e) => { visible = e.some((x) => x.isIntersecting); }, { rootMargin: "100px 0px" });
    io.observe(canvas);
    // Codex #158 P2: 멈춘 장면(움직임 줄이기·절전)도 화면 크기가 바뀌면 다시 맞추고 다 자란 한 장을 다시 그린다.
    const onResize = () => { if (!scene) return; scene.resize(); if (frozen) scene.settle(); };
    window.addEventListener("resize", onResize);

    void Promise.all([import("./scene/dandelion/dandelion-scene"), loadParticles()]).then(([{ DandelionScene }, particles]) => {
      if (disposed) return;
      try {
        scene = new DandelionScene({ canvas, tokens: readSceneTokens(canvas), config: CONFIG, particles });
      } catch {
        canvas.style.display = "none";
        return;
      }
      const tier = readTier();
      frozen = sceneShouldFreeze(tier);
      const budget = frameBudget(tier);
      // Codex #158 P2: 원본처럼 셰이더 준비·첫 그리기를 한 프레임에 한 단계씩(prewarmSteps) — 한 번에 몰아서 화면이 멈추지 않게.
      const steps = scene.prewarmSteps();
      let step = 0;
      const startLoop = () => {
        if (disposed || !scene) return;
        canvas.dataset.ready = "1";
        if (frozen) { scene.settle(); return; }
        let last = performance.now();
        let drawn = 0;
        const frame = (now: number) => {
          raf = requestAnimationFrame(frame);
          if (!visible || document.hidden) { last = now; return; }
          if (budget > 0 && now - drawn < budget - 4) return;
          drawn = now;
          const dt = (now - last) / 1000;
          last = now;
          scene?.update(dt);
        };
        raf = requestAnimationFrame(frame);
      };
      const warm = () => {
        if (disposed || !scene) return;
        if (step >= steps.length) { startLoop(); return; }
        void Promise.resolve(steps[step]()).then(() => { step += 1; raf = requestAnimationFrame(warm); });
      };
      raf = requestAnimationFrame(warm);
    }).catch(() => { canvas.style.display = "none"; });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
      scene?.dispose();
    };
  }, []);
  return <canvas ref={ref} className={`doit-flora-bloom ${className}`} aria-hidden="true" />;
}
