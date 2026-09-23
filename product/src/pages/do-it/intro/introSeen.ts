// 심볼 온보딩(1%→100%)을 이 브라우저 세션에서 이미 봤는지. 개인정보 없음, 탭을 닫으면 사라진다.
// 저장이 막힌 환경(시크릿 모드 등)에서는 매번 온보딩을 보여 준다(막지 않는다).
const KEY = 'doit:intro-seen';

export function hasSeenIntro(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // 무시
  }
}
