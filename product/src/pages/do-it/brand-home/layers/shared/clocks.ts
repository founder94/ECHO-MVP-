// 장면 시계(React 상태 아님 · 매 프레임 읽는 가변 객체). 등장(intro 0→1) · 스크롤로 흩어짐(out 0→1) · 포인터 · 보임/숨김.
import { Vector2 } from 'three';

/** 프레임 속도와 무관한 완화 계수: k 는 1/60초마다 닫는 비율. */
export const perFrame = (k: number, delta: number): number => 1 - Math.pow(1 - k, Math.max(0, delta) * 60);

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
/** Ken Perlin smootherstep. */
export const smootherstep = (x: number): number => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };

export interface Clocks {
  intro: number;
  out: number;
  outTarget: number;
  visible: boolean;
  hidden: boolean;
  pointer: Vector2;
  pointerActive: boolean;
  shouldDraw(): boolean;
  step(nowMs: number): void;
}

/** @param introMs 등장(0→1) 시간. 첫 그리기부터 센다(화면 밖이면 시작 안 함). */
export function createClocks(introMs = 2900): Clocks {
  let introStart = -1;
  let last = -1;
  const c: Clocks = {
    intro: 0,
    out: 0,
    outTarget: 0,
    visible: true,
    hidden: false,
    pointer: new Vector2(0, 0),
    pointerActive: false,
    shouldDraw: () => c.visible && !c.hidden && c.out < 0.999,
    step(now) {
      if (introStart < 0) introStart = now;
      if (last < 0) last = now;
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;
      c.intro = easeOutCubic((now - introStart) / introMs);
      // 스크롤 위치(outTarget)로 천천히 따라간다 — 손가락 움직임을 그대로 따라 뚝뚝 끊기지 않게.
      c.out += (c.outTarget - c.out) * perFrame(0.14, delta);
      if (Math.abs(c.outTarget - c.out) < 0.0005) c.out = c.outTarget;
    },
  };
  return c;
}
