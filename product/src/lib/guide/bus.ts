import type { GuideSectionId } from './content';

// 이용 안내 열기 — 어느 화면에서든 같은 안내 창 하나를 연다(화면 이동 0 → 적던 글·스크롤·선택이 그대로 남는다).
export const GUIDE_OPEN_EVENT = 'echo:guide-open';

export function openGuide(section?: GuideSectionId): void {
  try { window.dispatchEvent(new CustomEvent(GUIDE_OPEN_EVENT, { detail: { section: section ?? null } })); } catch { /* 이벤트를 못 보내도 화면은 그대로 */ }
}

// 기능 옆 짧은 도움말을 닫았는지 — 이 기기 브라우저에만 남긴다(새 DB 0 · 다른 기기에는 다시 보일 수 있다).
// 닫기·건너뛰기는 약관·개인정보 동의가 아니다(어떤 동의 값도 바꾸지 않는다).
const HINT_KEY = (id: GuideSectionId) => `echo:guide-hint-seen:${id}`;

export function hintSeen(id: GuideSectionId): boolean {
  try { return localStorage.getItem(HINT_KEY(id)) === '1'; } catch { return false; }
}

export function markHintSeen(id: GuideSectionId): void {
  try { localStorage.setItem(HINT_KEY(id), '1'); } catch { /* 저장이 막혀도 이번 화면에서는 닫힌다 */ }
}
