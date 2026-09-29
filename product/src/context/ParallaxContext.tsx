import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

export interface ParallaxState {
  rotateX: number;
  rotateY: number;
  bgX: number;
  bgY: number;
  contentX: number;
  contentY: number;
}

const ParallaxContext = createContext<ParallaxState>({
  rotateX: 0,
  rotateY: 0,
  bgX: 0,
  bgY: 0,
  contentX: 0,
  contentY: 0,
});

export function ParallaxProvider({ children, intensity = 1 }: { children: ReactNode; intensity?: number }) {
  const [state, setState] = useState<ParallaxState>({
    rotateX: 0, rotateY: 0, bgX: 0, bgY: 0, contentX: 0, contentY: 0,
  });

  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | undefined>(undefined);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    const x = (clientX / window.innerWidth - 0.5) * 2;
    const y = (clientY / window.innerHeight - 0.5) * 2;
    targetRef.current = { x, y };
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const lerp = (s: number, e: number, f: number) => s + (e - s) * f;

    const animate = () => {
      currentRef.current.x = lerp(currentRef.current.x, targetRef.current.x, 0.07);
      currentRef.current.y = lerp(currentRef.current.y, targetRef.current.y, 0.07);

      const cx = currentRef.current.x;
      const cy = currentRef.current.y;

      setState({
        rotateX: -cy * 6 * intensity,
        rotateY: cx * 6 * intensity,
        bgX: -cx * 30 * intensity,
        bgY: -cy * 30 * intensity,
        contentX: cx * 8 * intensity,
        contentY: cy * 8 * intensity,
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleMove, intensity]);

  return (
    <ParallaxContext.Provider value={state}>
      {children}
    </ParallaxContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- 훅과 Provider를 한 파일에 두는 기존 구조 유지
export function useParallax() {
  return useContext(ParallaxContext);
}