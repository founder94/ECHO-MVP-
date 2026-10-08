// 장면 공통 입력: 포인터·손가락(캔버스는 pointer-events 없음 → 창에서 받아 칸 기준 NDC) · 섹션 보임 여부 · 탭 숨김 · (첫 화면만) 스크롤 → 흩어짐.
import type { RefObject } from 'react';
import type { Clocks } from './clocks';

export interface InputOptions {
  /** 첫 화면: 섹션 높이의 85% 를 내리면 다 흩어진다(out 1). 다른 자리는 0 고정. */
  scrollDissolve: boolean;
  /** 누르면(pointerdown) 부를 것 — 격자 장면의 맥동 등. */
  onPress?: () => void;
}

export function bindSceneInputs(host: RefObject<HTMLDivElement | null>, clocks: Clocks, opts: InputOptions): () => void {
  const el = host.current;
  if (!el) return () => {};
  const sec = el.closest<HTMLElement>('.bh-sec') ?? el;
  const toNdc = (x: number, y: number) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    clocks.pointer.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    clocks.pointerActive = true;
  };
  const onPointer = (e: PointerEvent) => toNdc(e.clientX, e.clientY);
  const onTouch = (e: TouchEvent) => { const t = e.touches[0]; if (t) toNdc(t.clientX, t.clientY); };
  const onLeave = () => { clocks.pointerActive = false; };
  const onPress = () => { opts.onPress?.(); };
  const onScroll = () => {
    if (!opts.scrollDissolve) return;
    const h = Math.max(1, el.clientHeight * 0.85);
    clocks.outTarget = Math.min(1, Math.max(0, window.scrollY / h));
  };
  const onVisibility = () => { clocks.hidden = document.hidden; };
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });
  window.addEventListener('touchstart', onTouch, { passive: true });
  window.addEventListener('pointerleave', onLeave);
  window.addEventListener('touchend', onLeave, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  sec.addEventListener('pointerdown', onPress, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  onScroll(); onVisibility();
  let io: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver((entries) => { for (const e of entries) clocks.visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(el);
  }
  return () => {
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('touchmove', onTouch);
    window.removeEventListener('touchstart', onTouch);
    window.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('touchend', onLeave);
    window.removeEventListener('scroll', onScroll);
    sec.removeEventListener('pointerdown', onPress);
    document.removeEventListener('visibilitychange', onVisibility);
    io?.disconnect();
  };
}
