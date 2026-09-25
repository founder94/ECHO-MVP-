// 여정 선택(앱 모드). 로그인 뒤 /start 에서 고르고, 브라우저에만 기억한다(서버 저장 0, 개인정보 0).
// - echo : ECHO(B, 오늘 내 마음의 날씨)만 사용
// - doit : DO IT(A, 당신이 잠든 사이에)만 사용
// - both : ECHO로 시작해 리포트 뒤 DO IT 문으로 이어진다
export type AppMode = 'echo' | 'doit' | 'both';

export const APP_MODES: readonly AppMode[] = ['echo', 'doit', 'both'] as const;
const STORAGE_KEY = 'echo:app-mode';

export const ECHO_ENTRY_PATH = '/weather';
export const DOIT_ENTRY_PATH = '/doit';
export const DOIT_SELECT_PATH = '/doit';
// A구조 진입 온보딩(1%→100% 우주 점형 심볼). 재생 뒤 MAIN_ENTRY_PATH로 replace 이동한다.
export const DOIT_ONBOARDING_PATH = '/do-it/intro';
export const MODE_SELECT_PATH = '/start';
// 2026-09-20 대표 확정: 메인 진입(/)은 온보딩을 거쳐 Plan A 소개로 이어진다.
// 로그인 복귀 기본값은 이 소개 주소를 유지해 온보딩을 반복하지 않는다.
// B 홈(마음의 날씨)은 메인 진입에서 내린다. 화면 파일은 지우지 않고 연결만 끊는다.
export const MAIN_ENTRY_PATH = '/do-it/landing';

export const ECHO_BRAND_SENTENCE = '오늘 내 마음의 날씨는 어때?';
export const DOIT_BRAND_SENTENCE = '당신이 잠든 사이에';
export const DOIT_DOOR_LABEL = 'DO IT으로 이어가기';

export function isAppMode(value: unknown): value is AppMode {
  return typeof value === 'string' && (APP_MODES as readonly string[]).includes(value);
}

export function getAppMode(): AppMode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === null) return null;
    if (isAppMode(value)) return value;
    // 잘못 저장된 값은 실제로 삭제하고 미선택으로 처리(교차 버튼 노출 없음, /start 안내)
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

export function setAppMode(mode: AppMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* 저장 불가 시에도 이번 세션은 진행한다 */
  }
}

export function clearAppMode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 무시 */
  }
}

// 선택에 따라 처음 들어갈 화면. 미선택이면 선택 화면.
export function entryPathForMode(mode: AppMode | null): string {
  // DO IT만·둘 다 → A 스크롤 소개 9구간으로 진입. 시작하기는 목적 선택·진행 복원으로 이어진다.
  if (mode === 'doit' || mode === 'both') return '/do-it/landing';
  // ECHO만 → 기존 B 흐름(마음의 날씨)으로 진입
  if (mode === 'echo') return ECHO_ENTRY_PATH;
  return MODE_SELECT_PATH;
}

// ECHO 리포트·다음 여정에서 DO IT 문을 보여줄지. 'both'를 고른 사람에게만(ECHO 완료 확인 뒤) 보인다.
// echo / doit / 미선택·잘못된 값에서는 교차 버튼을 보이지 않는다.
export function showDoitDoor(): boolean {
  return getAppMode() === 'both';
}

// DO IT 화면에서 ECHO 문을 보여줄지. 'both'를 고른 사람에게만 보인다.
export function showEchoDoor(): boolean {
  return getAppMode() === 'both';
}
