import { MAIN_ENTRY_PATH } from '@/lib/echo/appMode';
import { saveRoundtripValue, takeRoundtripValue } from '@/lib/auth/roundtripStorage';

// 로그인 후 돌아갈 "안전한 내부 경로"만 허용한다.
// - 반드시 '/'로 시작, '//'(외부 도메인 우회)·스킴(':')·역슬래시·공백 금지
// - 외부 주소·자바스크립트 주소는 모두 기본 경로로 대체된다.

// 2026-09-20 대표 확정: 돌아갈 곳을 따로 정하지 않았으면 메인 진입(Plan A)으로 보낸다.
// 예전에는 브라우저에 남아 있던 여정 선택(appMode='echo')만으로 로그인 직후 마음 날씨로 끌려갔다.
// 사용자가 있던 화면으로 돌아가는 경로(rememberReturnPath)는 그대로 유지된다.
export function defaultReturnPath(): string {
  return MAIN_ENTRY_PATH;
}
const RETURN_PATH_KEY = 'echo:auth-return';
const SAFE_PATH = /^\/(?![/\\])[^\s\\]*$/;

export function isSafeInternalPath(path: unknown): path is string {
  return typeof path === 'string' && path.length <= 512 && SAFE_PATH.test(path) && !path.includes(':');
}

export function sanitizeReturnPath(path: unknown): string {
  return isSafeInternalPath(path) ? path : defaultReturnPath();
}

// OAuth는 외부 페이지를 거쳐 돌아오므로 돌아갈 경로를 브라우저에 잠깐 보관한다(개인정보 아님).
// 다른 탭·브라우저 창으로 돌아와도 읽히게 localStorage + 10분 만료(roundtripStorage). 꺼낼 때도 다시 걸러 낸다.
export function rememberReturnPath(path: unknown): void {
  saveRoundtripValue(RETURN_PATH_KEY, sanitizeReturnPath(path));
}

export function consumeReturnPath(): string {
  return sanitizeReturnPath(takeRoundtripValue(RETURN_PATH_KEY));
}
