import { useEffect, useRef } from "react";
import { homeHeroScene } from "./scene/config";
import { frameBudget, readTier, sceneShouldFreeze } from "./scene/device";
import { readSceneTokens } from "./scene/tokens";
import type { DandelionScene } from "./scene/dandelion/dandelion-scene";

/**
 * 앱 첫 화면들의 그림 자리 — Flora 원본의 민들레(입자 꽃)가 봉오리에서 자라 한 번 흔들리고 피어 있는 장면
 * (2026-10-10 대표 「모바일웹 Flora 그대로 · 기존 파스텔 그림 지움」: 예전 유리 리본 그림 자리).
 * 원본 장면 클래스(DandelionScene)·셰이더·값은 그대로 쓰고, 스크롤 비행(카메라가 꽃 속으로 들어가는 구간)은 앱에 없으므로
 * 진행값 0(첫 장면)에 머문다.
 *
 * 통합에 필요한 변경(시각 값 변경 0):
 *  - 꽃을 화면 가운데에(frameOffsetX 0.3 → 0): 원본은 PC 글자 자리를 비키려고 오른쪽으로 민다. 앱 그림 칸은 가운데 정렬.
 *  - 입자 수: 원본 휴대폰 값(42만)을 모든 기기에 — 그림 칸이 작고 앱 화면은 휴대폰 기준. 밝기는 원본이 입자 수로 보정한다(referenceCount).
 *  - 화면 밖·탭 숨김이면 멈춤 · 움직임 줄이기/절전이면 다 자란 한 장(원본 settle).
 *  - WebGL 을 못 쓰면 그림 칸만 비고 화면은 그대로.
 */
const CONFIG = {
  ...homeHeroScene,
  frameOffsetX: 0,
  particleCount: { desktop: 420_000, tablet: 420_000, mobile: 420_000 },
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
    const io = new IntersectionObserver((e) => { visible = e.some((x) => x.isIntersecting); }, { rootMargin: "100px 0px" });
    io.observe(canvas);
    const onResize = () => scene?.resize();

    void import("./scene/dandelion/dandelion-scene").then(({ DandelionScene }) => {
      if (disposed) return;
      try {
        scene = new DandelionScene({ canvas, tokens: readSceneTokens(canvas), config: CONFIG });
      } catch {
        canvas.style.display = "none";
        return;
      }
      canvas.dataset.ready = "1";
      const tier = readTier();
      if (sceneShouldFreeze(tier)) { scene.settle(); return; }
      const budget = frameBudget(tier);
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
      window.addEventListener("resize", onResize);
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
