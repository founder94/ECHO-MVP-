import { useEffect, useState, type CSSProperties } from 'react';

// 여정 화면 공통 스타일·등장 애니메이션(컴포넌트 파일과 분리 — react-refresh 규칙).

export const PRIMARY_BUTTON =
  'w-full h-14 rounded-2xl bg-white text-[#0c1526] text-[15px] font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer hover:bg-white/90 active:scale-[0.99] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white';
export const GHOST_BUTTON =
  'w-full h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md text-white text-[15px] font-semibold whitespace-nowrap cursor-pointer hover:bg-white/20 active:scale-[0.99] transition-all duration-200 disabled:opacity-40';
export const TEXT_BUTTON =
  'w-full h-12 text-[13px] text-white/55 cursor-pointer hover:text-white/80 transition-colors duration-200 whitespace-nowrap disabled:opacity-40';

export function useReveal(): (delay: number) => CSSProperties {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);
  return (delay: number) => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? 'translateY(0)' : 'translateY(30px)',
    transition: `opacity 700ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, transform 700ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
  });
}