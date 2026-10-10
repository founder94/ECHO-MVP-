import { useEffect, useRef } from "react";
import { BackdropGradient, type BackdropConfig, type BackdropTokens } from "./backdrop-gradient";

/**
 * ECHO 앱 전 화면의 바탕 — Flora 원본 「Kindle」(밤색 들판 위로 번지는 불빛) 그대로(2026-10-10 대표 「모바일웹 Flora 로 전부」).
 * 원본 값: homeHeroBackdrop(data/mocks/home.ts) · 색: --scene-field-*(#010b24 → #9fc2ff).
 *
 * 원본과 다른 점(통합에 필요한 것만 · 시각 값 변경 0):
 *  - 원본은 스크롤 진행에 따라 검게 사라진다(fade). 앱은 스크롤 무대가 없으므로 늘 1(그대로 밝게).
 *  - 원본 공용 ticker 대신 이 바탕 하나만의 requestAnimationFrame. 탭이 숨으면 그리지 않는다.
 *  - 손가락 화면(coarse)은 원본 frameBudget 처럼 초당 30장, 손가락 따라오기 없음(원본도 fine pointer 만).
 *  - 움직임 줄이기면 한 장만 그리고 멈춘다(원본: 시계·포인터 정지).
 *  - WebGL2 를 못 쓰면 캔버스 대신 CSS 바탕색(#010b24)만 남는다 — 화면은 그대로 쓸 수 있다.
 */
const KINDLE: BackdropConfig = {
  scale: 0.585, speed: 0.33, spread: 0.07, rise: 0.3, threshold: 0.63, ember: 0.15, lick: 0.53,
  roughness: 0.5, lacunarity: 1.8, contrast: 1.5, midpoint: 0.85, sink: 0.42, glow: 0.95,
  grain: 0, grainAnim: 0, dither: 1.2, vignette: 0.5, cursor: 1, pointerRadius: 0.9, pointerStrength: 0.36,
  wake: 4, parallax: 0.01, maxDpr: 0.7,
};
const FIELD: BackdropTokens = { ground: "#010b24", deep: "#061a4d", mid: "#0a2a7a", hot: "#2e6bff", light: "#9fc2ff" };

export default function FloraBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let field: BackdropGradient;
    try {
      field = new BackdropGradient({ canvas, tokens: FIELD, config: KINDLE });
    } catch {
      canvas.style.display = "none"; // WebGL2 불가 — CSS 바탕만
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    const budget = coarse ? 1000 / 30 : 0;
    const target = { x: 0, y: 0 };
    const lead = { x: 0, y: 0 };
    const body = { x: 0, y: 0 };
    let clock = 0;
    let last = performance.now();
    let drawn = 0;
    let raf = 0;
    field.render(0, 0, 0, 0, 0, 1);
    canvas.dataset.ready = "1";

    const onMove = (e: PointerEvent) => {
      const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
      target.x = (e.clientX / window.innerWidth - 0.5) * aspect;
      target.y = 0.5 - e.clientY / window.innerHeight;
    };
    let width = window.innerWidth;
    const onResize = () => {
      if (coarse && window.innerWidth === width) return; // 주소창이 접히고 펴질 때(높이만 바뀜)는 다시 만들지 않는다
      width = window.innerWidth;
      if (lost) return;
      field.resize();
      if (reduced) field.render(clock, 0, 0, 0, 0, 1);
    };
    window.addEventListener("resize", onResize);
    if (!reduced && !coarse) window.addEventListener("pointermove", onMove, { passive: true });

    // GPU 가 문맥을 잃으면(저사양 기기 · 오래 뒤로 가 있던 앱) 캔버스를 숨겨 CSS 바탕만 남기고,
    // 브라우저가 문맥을 돌려주면(webglcontextrestored) 같은 캔버스에 바탕을 다시 만든다.
    let lost = false;
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      canvas.style.display = "none";
    };
    const onRestored = () => {
      try {
        field = new BackdropGradient({ canvas, tokens: FIELD, config: KINDLE });
      } catch {
        return; // 다시 만들지 못하면 CSS 바탕 그대로
      }
      lost = false;
      canvas.style.display = "";
      field.render(clock, body.x, body.y, 0, 0, 1);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || lost) { last = now; return; }
      if (budget > 0 && now - drawn < budget - 4) return;
      drawn = now;
      const ms = Math.min(Math.max(now - last, 4.167), 50);
      last = now;
      const step = ms > 36.7 ? 2.2 : ms * 0.06;
      clock += ms / 1000;
      lead.x += (target.x - lead.x) * 0.105 * step;
      lead.y += (target.y - lead.y) * 0.105 * step;
      body.x += (lead.x - body.x) * 0.043 * step;
      body.y += (lead.y - body.y) * 0.043 * step;
      field.render(clock, body.x, body.y, lead.x - body.x, lead.y - body.y, 1);
    };
    if (!reduced) raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      field.dispose();
    };
  }, []);
  return <canvas ref={ref} className="doit-flora-backdrop" aria-hidden="true" />;
}
