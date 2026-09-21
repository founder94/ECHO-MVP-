// 사이트 역할 (대표 확정 2026-09-21): 코드 한 벌, 주소 두 개.
// - brand : do-it.company — 브랜딩만(온보딩·랜딩·시작하기·약관 열람). 로그인·제품 화면 없음. 제품 경로는 앱 주소로 넘긴다.
// - app   : app.do-it.company — 제품 전부(로그인·대화·사진·연결). 모바일 웹 앱(PWA).
// - all   : (기본) 지금까지의 통합 빌드. 7차까지의 검사 환경. 스위치를 안 주면 이 값이다.
// 빌드 때 VITE_SITE_ROLE 로 정한다. 실행 중에 바뀌지 않으며, 역할에 없는 화면 코드는 번들에 들어가지 않는다(라우터에서 lazy 를 조건 안에 둔다).
export type SiteRole = 'brand' | 'app' | 'all';

const raw = import.meta.env.VITE_SITE_ROLE;
export const SITE_ROLE: SiteRole = raw === 'brand' ? 'brand' : raw === 'app' ? 'app' : 'all';
export const IS_BRAND_SITE = SITE_ROLE === 'brand';
export const IS_APP_SITE = SITE_ROLE === 'app';

// 제품 주소. 브랜드 빌드가 "지금 시작하기"·"로그인"·제품 경로를 보낼 곳. 빌드 변수로 바꿀 수 있다(예: 검사용 주소).
export const APP_ORIGIN: string = (import.meta.env.VITE_APP_ORIGIN as string | undefined)?.replace(/\/$/, '') || 'https://app.do-it.company';
export const BRAND_ORIGIN: string = (import.meta.env.VITE_BRAND_ORIGIN as string | undefined)?.replace(/\/$/, '') || 'https://do-it.company';

// 브랜드 사이트에서 제품으로 넘길 때 쓰는 주소. 내부 경로만 받는다(외부 주소·스킴 금지).
export function appUrl(path: string): string {
  const safe = typeof path === 'string' && /^\/(?![/\\])[^\s\\]*$/.test(path) && !path.includes(':') ? path : '/';
  return `${APP_ORIGIN}${safe}`;
}
