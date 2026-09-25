// 2026-09-26 대표 PRE-DEPLOY FIX #2: 앱 화면별 휴대폰 상단 막대 색. 기능 화면(/doit/…)은 파스텔 첫 색, 우주·검은 바탕 화면은 검정.
export const APP_PASTEL = '#3fdcb3'; // src/doit/components/feature/pastel-bg.css --pastel-underlay 0% (manifest·index.html 과 같은 값)
// index.html(앱 빌드)의 <html> 에 붙는 첫 파스텔 바탕 표시. vite.config.ts 와 같은 이름.
export const APP_ROOT_CLASS = 'echo-app-pastel-root';
const DARK = '#08070c'; // 히어로·관리자: 이전과 같은 값(Hero FINAL LOCK — 상단 막대 색도 그대로)

export function themeColorFor(pathname: string): string {
  if (pathname.startsWith('/doit/admin')) return DARK;
  return pathname.startsWith('/doit/') || pathname === '/doit' ? APP_PASTEL : DARK;
}
