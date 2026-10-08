// 그리기 문지기: frameloop="demand" 인 캔버스를 직접 깨운다. 화면 폭별 fps 상한 · 첫 화면이 보이지 않거나 탭이 숨겨지면 0 · 다 흩어진 뒤 0.
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { Clocks } from './clocks';

const JITTER_MS = 1;

export function FrameGate({ clocks, targetFps }: { clocks: Clocks; targetFps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const interval = 1000 / targetFps;
    let raf = 0;
    let last = -Infinity;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!clocks.shouldDraw()) return;
      if (now - last < interval - JITTER_MS) return;
      last = now;
      clocks.step(now);
      invalidate();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clocks, invalidate, targetFps]);
  return null;
}
