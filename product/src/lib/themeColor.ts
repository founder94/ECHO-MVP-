// 2026-09-26 대표 PRE-DEPLOY FIX #2: 앱 화면별 휴대폰 상단 막대 색. 기능 화면(/doit/…)은 파스텔 첫 색, 우주·검은 바탕 화면은 검정.
export const APP_PASTEL = '#010b24'; // 2026-10-10 대표 「모바일웹 = Flora」: 앱 첫 바탕 = Flora 밤(#010b24) · 이름은 호출부 변경 0 을 위해 그대로 // src/doit/components/feature/pastel-bg.css --pastel-underlay 0% (manifest·index.html 과 같은 값)
// index.html(앱 빌드)의 <html> 에 붙는 첫 파스텔 바탕 표시. vite.config.ts 와 같은 이름.
export const APP_ROOT_CLASS = 'echo-app-pastel-root';
// 2026-09-29 대표 「시작 화면 배경 변경」: 앱 아이콘을 눌러 온보딩(/do-it/intro)으로 들어올 때 React 가 뜨기 전 첫 바탕 = 시작 화면 딥 네이비(manifest 와 같은 값). ThemeColorSync 가 뜨자마자 뗀다.
export const APP_LAUNCH_CLASS = 'echo-app-launch-root';
export const APP_LAUNCH_COLOR = '#041433';
export const APP_LAUNCH_IMAGE = '/pwa/echo-launch-artwork.webp?v=20260930f';
// 2026-09-30 대표 「온보딩 전 임시 비주얼 스플래시」: 첫 화면에서 최소 이만큼(페이지를 연 때부터) 보인 뒤 부드럽게 사라진다.
export const APP_LAUNCH_OUT_CLASS = 'echo-app-launch-out';
export const APP_LAUNCH_MIN_MS = 1500;
export const APP_LAUNCH_FADE_MS = 260;
const DARK = '#08070c'; // 히어로·관리자: 이전과 같은 값(Hero FINAL LOCK — 상단 막대 색도 그대로)

export function themeColorFor(pathname: string): string {
  if (pathname.startsWith('/doit/admin')) return DARK;
  // 2026-09-26: 로그인·가입·약관·동의 화면도 파스텔(검정은 히어로만).
  if (/^\/(login|signup|legal)(\/|$)/.test(pathname)) return APP_PASTEL;
  return pathname.startsWith('/doit/') || pathname === '/doit' ? APP_PASTEL : DARK;
}
