// ConsentGate 가 막지 않는 경로. 공개 화면(홈·문서·로그인·가입·인증 복귀·운영센터·준비 중 안내)은 동의 없이도 연다.
const OPEN_PREFIXES = ['/legal', '/login', '/signup', '/auth/', '/admin', '/coming-soon'];
const OPEN_EXACT = new Set(['/', '/home', '/do-it/landing', '/do-it/hero']);

export function isConsentGateOpenPath(pathname: string): boolean {
  return OPEN_EXACT.has(pathname) || OPEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
