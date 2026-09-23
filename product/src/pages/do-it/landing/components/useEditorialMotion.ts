import { useEffect, useRef, useState } from 'react';

// 페이지 전체가 하나의 스크롤 프레임을 공유한다. 스크롤 강제 이동·AI/API 호출 없음.
export default function useEditorialMotion() {
  const rootRef = useRef<HTMLElement>(null);
  const [motionPaused, setMotionPaused] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scenes = Array.from(root.querySelectorAll<HTMLElement>('[data-motion-scene]'));
    const visible = new Set<HTMLElement>();
    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let frame = 0;
    let observer: IntersectionObserver | undefined;
    let disposed = false;
    const enabled = () => !motionPaused && !media?.matches && !document.hidden;

    const paint = () => {
      frame = 0;
      if (disposed || !enabled()) return;
      const height = window.innerHeight;
      // 먼저 위치를 모아서 읽은 다음 스타일만 쓴다. 읽기/쓰기를 번갈아 하지 않는다.
      const positions = Array.from(visible, (scene) => {
        const rect = scene.getBoundingClientRect();
        const progress = Math.max(-1, Math.min(1, (height / 2 - rect.top - rect.height / 2) / ((height + rect.height) / 2)));
        return { scene, shift: progress * (window.innerWidth <= 700 ? 16 : 30) };
      });
      positions.forEach(({ scene, shift }) => scene.style.setProperty('--scene-shift', `${shift.toFixed(2)}px`));
    };
    const schedule = () => {
      if (!frame && !disposed && enabled()) frame = window.requestAnimationFrame(paint);
    };
    const syncMotion = () => {
      root.dataset.motion = enabled() ? 'running' : 'paused';
      if (!enabled()) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        scenes.forEach((scene) => scene.style.setProperty('--scene-shift', '0px'));
      } else schedule();
    };

    try {
      if (typeof IntersectionObserver !== 'undefined') {
        observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            const scene = entry.target as HTMLElement;
            scene.dataset.inView = String(entry.isIntersecting);
            if (entry.isIntersecting) {
              visible.add(scene);
              scene.dataset.revealed = 'true';
            } else visible.delete(scene);
          });
          schedule();
        }, { rootMargin: '40px 0px', threshold: 0 });
        scenes.forEach((scene) => observer?.observe(scene));
      } else {
        // 관찰 기능이 없는 브라우저에서도 모든 내용과 정적인 심볼은 보인다.
        scenes.forEach((scene) => { scene.dataset.revealed = 'true'; });
      }
    } catch {
      scenes.forEach((scene) => { scene.dataset.revealed = 'true'; });
    }
    syncMotion();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', syncMotion);
    media?.addEventListener?.('change', syncMotion);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', syncMotion);
      media?.removeEventListener?.('change', syncMotion);
    };
  }, [motionPaused]);

  return { rootRef, motionPaused, setMotionPaused };
}
