// 설정 → 접근성 「움직임 줄이기」(2026-09-28 대표 최종: 첫 화면·본문에는 두지 않고 설정 안에만).
// 이 기기(브라우저)에만 기억한다(서버 저장 0). 켜면 <html data-echo-reduce-motion> 로 제품 화면의 반복 움직임을 멈춘다.
// 기기 설정의 「동작 줄이기」(prefers-reduced-motion)는 이것과 상관없이 늘 따른다.
const KEY = 'echo:reduce-motion';

export function getReduceMotion(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function applyReduceMotion(on: boolean = getReduceMotion()): void {
  try {
    if (on) document.documentElement.setAttribute('data-echo-reduce-motion', '');
    else document.documentElement.removeAttribute('data-echo-reduce-motion');
  } catch { /* 문서가 없는 환경 */ }
}

export function setReduceMotion(on: boolean): void {
  try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* 저장이 막힌 환경: 이번 화면에서만 */ }
  applyReduceMotion(on);
}
