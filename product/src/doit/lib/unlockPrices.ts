// KEY 로 여는 것들의 값(2026-10-06 대표 「스토리·추가 사진 몇 KEY 써야 열리는지 훅킹」).
// 숫자 출처 = 2026-07-27 KEY 경제 설계서 v1(대표 대화) — 스토리 해제 30 [흡수 락] · 페이드 사진 1장 20 [제안].
// 이 값은 아직 「대표 확인 필요」다. 가격·결제 변경은 대표 승인 대상이라, 여기 숫자는 화면 안내용이며 실제로 KEY 를 빼지 않는다.
// 실제로 열려면 서버 KEY 원장(잔액·차감·중복 방지)이 먼저 있어야 한다 → UNLOCK_LIVE 가 false 인 동안 버튼은 「준비 중」만 보인다.
export const UNLOCK_KEY_COST = {
  extraPhoto: 20, // 추가 사진 1장(흐린 아래 35%까지 보기)
  story: 30, // 한 사람의 스토리 전체 보기
} as const;

export type UnlockKind = keyof typeof UNLOCK_KEY_COST;

// 서버 KEY 원장 연결 전까지 false. true 로 바꾸는 것은 원장·결제가 운영에 올라간 뒤(대표 승인).
export const UNLOCK_LIVE = false;

// Codex PR #141 b198296 P1: 대표가 값을 확인하기 전에는 화면에 숫자를 내보내지 않는다(아직 정하지 않은 값을 약속처럼 보이지 않게).
// 대표가 값을 확정하면 이 줄만 true 로 바꾼다(값은 위 UNLOCK_KEY_COST 한 곳).
export const UNLOCK_PRICES_APPROVED = false;

// 화면에 보이는 짧은 표시: 값이 정해졌으면 「KEY 30」, 아니면 「KEY」.
export function keyCostBadge(kind: UnlockKind): string {
  return UNLOCK_PRICES_APPROVED ? `KEY ${UNLOCK_KEY_COST[kind]}` : "KEY";
}

export function unlockLabel(kind: UnlockKind): string {
  return UNLOCK_PRICES_APPROVED ? `KEY ${UNLOCK_KEY_COST[kind]}개로 열기` : "KEY로 열기(필요한 개수는 정하는 중)";
}

// 다른 사람이 볼 때 무엇이 잠기는지 한 곳에서 정한다(화면마다 다르게 판단하지 않게).
// - 기본 5칸: 그대로 보인다.
// - 추가 사진: 위쪽 65%만, 아래 35%는 흐리게(내가 연 경우만 전부).
// - 스토리: 버튼 안에 자물쇠, 누르면 KEY 로 열린다는 안내(개수는 값이 정해진 뒤에만).
export function viewerSees(slot: number, opts: { isOwner: boolean; unlocked: boolean; baseCount: number }): "full" | "faded" {
  if (opts.isOwner || opts.unlocked) return "full";
  return slot >= opts.baseCount ? "faded" : "full";
}
