// KEY 로 여는 것들의 값.
// 숫자 출처 = KEY 사용량표 v2(2026-08 대표 FINAL MERGE 락: 페이드 사진 1장 8 · 스토리 12 · 관계 열기 50 · 100 KEY = 9,900원)
//            + 2026-10-10 대표 승인 「스토리 12개 · 추가 사진 8개」.
// (예전 30·20 은 v2 확정 때 버린 v1 표 값이었다 — 2026-10-10 정정.)
// 화면 안내용 값이며 실제로 KEY 를 빼지 않는다(UNLOCK_LIVE=false). 실제 차감·결제는 서버 KEY 원장·결제 연결 뒤(대표 승인).
// 실제로 열려면 서버 KEY 원장(잔액·차감·중복 방지)이 먼저 있어야 한다 → UNLOCK_LIVE 가 false 인 동안 버튼은 「준비 중」만 보인다.
export const UNLOCK_KEY_COST = {
  extraPhoto: 8, // 추가 사진 1장을 선명하게(사진 전체 35% 막 걷기)
  story: 12, // 한 사람의 스토리 전체 보기
} as const;

export type UnlockKind = keyof typeof UNLOCK_KEY_COST;

// 서버 KEY 원장 연결 전까지 false. true 로 바꾸는 것은 원장·결제가 운영에 올라간 뒤(대표 승인).
export const UNLOCK_LIVE = false;

// Codex PR #141 b198296 P1: 대표가 값을 확인하기 전에는 화면에 숫자를 내보내지 않는다(아직 정하지 않은 값을 약속처럼 보이지 않게).
// 2026-10-10 대표 승인(스토리 12 · 추가 사진 8) → 켬. 값을 다시 바꿀 때는 대표 승인 뒤 위 UNLOCK_KEY_COST 한 곳만.
export const UNLOCK_PRICES_APPROVED = true;

// 화면에 보이는 짧은 표시: 값이 정해졌으면 「KEY 30」, 아니면 「KEY」.
export function keyCostBadge(kind: UnlockKind): string {
  return UNLOCK_PRICES_APPROVED ? `KEY ${UNLOCK_KEY_COST[kind]}` : "KEY";
}

export function unlockLabel(kind: UnlockKind): string {
  return UNLOCK_PRICES_APPROVED ? `KEY ${UNLOCK_KEY_COST[kind]}개로 열기` : "KEY로 열기(필요한 개수는 정하는 중)";
}

// 다른 사람이 볼 때 무엇이 잠기는지 한 곳에서 정한다(화면마다 다르게 판단하지 않게).
// - 기본 5칸: 그대로 보인다.
// - 추가 사진: 사진 전체에 35% 막(본인 · 연 사람 · 맛보기로 고른 한 장은 선명).
// - 스토리: 버튼 안에 자물쇠, 누르면 KEY 로 열린다는 안내.
export function viewerSees(slot: number, opts: { isOwner: boolean; unlocked: boolean; baseCount: number; tasted?: boolean }): "full" | "faded" {
  if (opts.isOwner || opts.unlocked || opts.tasted) return "full";
  return slot >= opts.baseCount ? "faded" : "full";
}

// 맛보기(2026-10-10 대표 승인 후킹 ③): 한 사람의 추가 사진 중 한 장은 KEY 없이 선명하게 볼 수 있다.
// 지금은 화면 상태로만 기억한다(새로고침하면 다시 고를 수 있음) — 사람마다 영구로 「한 장」을 지키려면 서버 KEY 원장 기록이 필요하다(초안 doit_unlocks.kind = 'taste').
export const FREE_TASTE_PER_PERSON = 1;
export function canTaste(tastedSlots: readonly number[]): boolean {
  return tastedSlots.length < FREE_TASTE_PER_PERSON;
}
